"""release_check's clean_vm gate: a green only from cycles judged again here and tied to this tree's artefacts.

The gate used to read `^PASS`/`^FAIL` lines out of one install_check log, so a log from an install
that went well inside a cycle that failed elsewhere turned clean_vm green. Each test below builds a
complete acceptance directory (the same fixtures the judge's own tests use), proves the control is
PASS, then breaks exactly one thing - a failed cycle, another artefact, another hash, a missing
piece, a scenario that never ran, an edited result - and requires the gate to stop being PASS.
"""

from __future__ import annotations

import json
import pathlib
import shutil
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
SCRIPTS = HERE.parent
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(SCRIPTS / "cleanvm"))
sys.path.insert(0, str(HERE))
import release_check  # noqa: E402
import report  # noqa: E402
from test_cleanvm_report import BUILD, EXE_SHA, SETUP, SHA, Fixture  # noqa: E402

VERSION = "0.5.0-rc.5"
SPEC = {"N1": {"must_fail": {"CLEAN-001": "FAIL: no marker"}}}


def entries(setup_name: str = SETUP, setup_sha: str = SHA, exe_sha: str = EXE_SHA) -> list[dict]:
    return [{"name": setup_name, "sha256": setup_sha}, {"name": "encastra-desktop.exe", "sha256": exe_sha}]


class VmGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        base = pathlib.Path(self.tmp.name)
        # The gate reads its judge and its negative spec from CLEANVM; a copy with a one-cycle spec
        # keeps the fixtures small without changing a line of the judge.
        self.lab = base / "cleanvm"
        self.lab.mkdir()
        shutil.copy2(SCRIPTS / "cleanvm" / "report.py", self.lab / "report.py")
        (self.lab / "negative-spec.json").write_text(json.dumps(SPEC))
        self._real = release_check.CLEANVM
        release_check.CLEANVM = self.lab
        self.root = base / "evidence"
        self.root.mkdir()
        self.A = Fixture(self.root, "A")
        self.B = Fixture(self.root, "B")
        self.U = Fixture(self.root, "U", mode="upgrade")
        self.N = Fixture(self.root, "N1", inject=["hidden-fail"])
        rec = self.N.record("CLEAN-001")
        rec["assertions"][0]["ok"] = False
        rec["result"] = "FAIL"
        self.N.write_record("CLEAN-001", rec)
        self.N.serial = [
            line.replace("PASS CLEAN-001 no marker", "FAIL CLEAN-001 no marker").replace(
                "RESULT CLEAN-001 PASS assertions=6 failed=0", "RESULT CLEAN-001 FAIL assertions=6 failed=1"
            )
            for line in self.N.serial
        ]
        self.N.flush()

    def tearDown(self) -> None:
        release_check.CLEANVM = self._real
        self.tmp.cleanup()

    def gate(self, evidence: pathlib.Path | None = None, files: list[dict] | None = None, version: str = VERSION, commit: str = BUILD):
        return release_check.check_vm(self.root if evidence is None else evidence, entries() if files is None else files, version, commit)

    def assertNotPass(self, check, why: str):
        self.assertNotEqual(check.status, release_check.PASS, f"{why}: {check.evidence}")
        return check

    # --- the control ------------------------------------------------------------------------

    def test_complete_evidence_for_this_trees_artefacts_passes(self) -> None:
        check = self.gate()
        self.assertEqual(check.status, release_check.PASS, check.evidence)
        self.assertIn(SETUP, check.evidence)

    def test_no_evidence_is_external_not_pass(self) -> None:
        self.assertEqual(release_check.check_vm(None).status, release_check.EXTERNAL)

    # --- mutation A: a failed cycle cannot pass -----------------------------------------------

    def test_a_failed_full_cycle_cannot_pass(self) -> None:
        rec = self.A.record("CLEAN-009")
        rec["assertions"][0]["ok"] = False
        rec["result"] = "FAIL"
        self.A.write_record("CLEAN-009", rec)
        self.A.serial = [
            line.replace(f"PASS CLEAN-009 {rec['assertions'][0]['name']}", f"FAIL CLEAN-009 {rec['assertions'][0]['name']}") for line in self.A.serial
        ]
        self.A.flush()
        self.assertEqual(self.gate().status, release_check.FAIL)

    def test_a_valid_install_log_beside_a_failed_cycle_is_not_a_pass(self) -> None:
        """The hole the log-reading gate had: one good install_check log + a cycle that failed."""
        rec = self.B.record("CLEAN-004")
        rec["assertions"][0]["ok"] = False
        rec["result"] = "FAIL"
        self.B.write_record("CLEAN-004", rec)
        log = self.root / "install.log"
        log.write_text("PASS  installed ProductVersion\nPASS  uninstall entry\n", "utf-8")
        self.assertEqual(self.gate().status, release_check.FAIL)
        self.assertNotPass(self.gate(evidence=log), "a passing log with nothing else")

    def test_a_log_alone_is_never_a_pass(self) -> None:
        log = self.root / "install.log"
        log.write_text("PASS  a\nPASS  b\n", "utf-8")
        self.assertEqual(self.gate(evidence=log).status, release_check.EXTERNAL)
        log.write_text("PASS  a\nFAIL  b -> broken\n", "utf-8")
        self.assertEqual(self.gate(evidence=log).status, release_check.FAIL)

    def test_a_failed_negative_cycle_that_did_not_fail_cannot_pass(self) -> None:
        rec = self.N.record("CLEAN-001")
        rec["assertions"][0]["ok"] = True
        rec["result"] = "PASS"
        self.N.write_record("CLEAN-001", rec)
        self.N.serial = [
            line.replace("FAIL CLEAN-001 no marker", "PASS CLEAN-001 no marker").replace(
                "RESULT CLEAN-001 FAIL assertions=6 failed=1", "RESULT CLEAN-001 PASS assertions=6 failed=0"
            )
            for line in self.N.serial
        ]
        self.N.flush()
        self.assertEqual(self.gate().status, release_check.FAIL)

    # --- mutations B and C: another artefact, another hash ----------------------------------------

    def test_another_installer_than_this_trees_cannot_pass(self) -> None:
        check = self.gate(files=entries(setup_name="Encastra_0.5.0-rc.6_x64-setup.exe"))
        self.assertEqual(check.status, release_check.FAIL)
        self.assertIn("installer", check.evidence)

    def test_another_hash_cannot_pass(self) -> None:
        for what, files in (("installer", entries(setup_sha="0" * 64)), ("executable", entries(exe_sha="0" * 64))):
            with self.subTest(what):
                check = self.gate(files=files)
                self.assertEqual(check.status, release_check.FAIL)
                self.assertIn("sha256", check.evidence)

    def test_another_version_or_build_commit_cannot_pass(self) -> None:
        self.assertEqual(self.gate(version="0.5.0-rc.6").status, release_check.FAIL)
        self.assertEqual(self.gate(commit="f" * 40).status, release_check.FAIL)

    def test_cycles_that_ran_different_installers_cannot_pass(self) -> None:
        # B is a complete, self-consistent run - of another build. Every record in it agrees with
        # its own expected.json, so only the cross-cycle identity can catch it.
        data = json.loads((self.B.dir / "expected.json").read_text())
        data["installer"]["sha256"] = "9" * 64
        (self.B.dir / "expected.json").write_text(json.dumps(data))
        for sid in report.FULL_REQUIRED:
            rec = self.B.record(sid)
            rec["artifact"]["sha256"] = "9" * 64
            self.B.write_record(sid, rec)
        check = self.gate()
        self.assertEqual(check.status, release_check.FAIL)
        self.assertIn("one installer", check.evidence)

    # --- the gate does not take the judge's word for it ------------------------------------------

    def lenient_judge(self, edit) -> None:
        """A judge that says PASS over whatever `edit` does to its verdict - a future report.py that
        dropped a matrix entry, or stopped enforcing the negatives, must not turn clean_vm green."""
        real = release_check._load_judge

        def load():
            module = real()
            inner = module.judge

            def judge(cycles, spec):
                result = inner(cycles, spec)
                edit(result)
                result["problems"], result["repeatability"], result["CLEAN_VM_ACCEPTANCE"] = [], [], "PASS"
                return result

            module.judge = judge
            return module

        release_check._load_judge = load
        self.addCleanup(setattr, release_check, "_load_judge", real)

    def test_a_judge_that_drops_a_required_result_does_not_make_a_pass(self) -> None:
        self.lenient_judge(lambda r: r["matrix"].pop("CLEAN-011@U"))
        check = self.gate()
        self.assertEqual(check.status, release_check.FAIL)
        self.assertIn("CLEAN-011@U", check.evidence)

    def test_a_judge_that_passes_a_negative_that_did_not_fail_does_not_make_a_pass(self) -> None:
        def weaken(r):
            r["negative"]["N1"]["ok"] = False  # the negative did not fail where it must...
            r["matrix"]["NEGATIVE"] = "PASS"  # ...and the judge said PASS anyway
        self.lenient_judge(weaken)
        check = self.gate()
        self.assertEqual(check.status, release_check.FAIL)
        self.assertIn("N1", check.evidence)

    def test_a_judge_that_reports_problems_but_passes_does_not_make_a_pass(self) -> None:
        real = release_check._load_judge

        def load():
            module = real()
            inner = module.judge
            module.judge = lambda cycles, spec: {**inner(cycles, spec), "problems": ["something the judge saw"], "CLEAN_VM_ACCEPTANCE": "PASS"}
            return module

        release_check._load_judge = load
        self.addCleanup(setattr, release_check, "_load_judge", real)
        check = self.gate()
        self.assertEqual(check.status, release_check.FAIL)
        self.assertIn("something the judge saw", check.evidence)

    def test_a_dev_build_cannot_pass(self) -> None:
        plan = self.A.plan
        plan["dev_build"] = True
        self.A.flush()
        self.assertEqual(self.gate().status, release_check.FAIL)

    def test_artefacts_missing_from_the_tree_cannot_be_tied_and_do_not_pass(self) -> None:
        check = self.gate(files=[])
        self.assertEqual(check.status, release_check.NOT_VERIFIED)

    # --- mutation D: an incomplete matrix -------------------------------------------------------

    def test_a_missing_upgrade_cycle_cannot_pass(self) -> None:
        shutil.rmtree(self.U.dir)
        self.assertNotPass(self.gate(), "no upgrade evidence")

    def test_a_missing_second_full_cycle_cannot_pass(self) -> None:
        shutil.rmtree(self.B.dir)
        self.assertNotPass(self.gate(), "no cycle B, so no repeatability")

    def test_a_missing_negative_cycle_cannot_pass(self) -> None:
        shutil.rmtree(self.N.dir)
        self.assertNotPass(self.gate(), "no negative evidence")

    def test_a_scenario_that_is_missing_from_a_cycle_cannot_pass(self) -> None:
        shutil.rmtree(self.B.results / "scenarios" / "CLEAN-009")
        self.assertNotPass(self.gate(), "CLEAN-009 never ran in B")

    def test_a_directory_without_cycles_cannot_pass(self) -> None:
        empty = pathlib.Path(self.tmp.name) / "empty"
        empty.mkdir()
        self.assertEqual(self.gate(evidence=empty).status, release_check.FAIL)

    def test_two_directories_claiming_one_cycle_cannot_pass(self) -> None:
        shutil.copytree(self.A.dir, self.root / "A-superseded")
        check = self.gate()
        self.assertEqual(check.status, release_check.FAIL)
        self.assertIn("claimed by both", check.evidence)

    def test_a_second_upgrade_cycle_is_ambiguous_and_cannot_pass(self) -> None:
        Fixture(self.root, "U2", mode="upgrade")
        check = self.gate()
        self.assertEqual(check.status, release_check.FAIL)
        self.assertIn("upgrade cycles", check.evidence)

    def test_a_cycle_from_another_run_left_in_the_directory_cannot_pass(self) -> None:
        dev = Fixture(self.root, "D")
        dev.plan["dev_build"] = True
        dev.flush()
        check = self.gate()
        self.assertEqual(check.status, release_check.FAIL)
        self.assertIn("D", check.evidence)

    # --- mutation E: NOT_RUN is not PASS ------------------------------------------------------------

    def test_a_scenario_that_did_not_run_is_not_a_pass(self) -> None:
        for forced in ("BLOCKED", "NOT_APPLICABLE", "NOT_RUN"):
            with self.subTest(forced=forced):
                rec = self.A.record("CLEAN-008")
                original = json.dumps(rec)
                rec["result"] = forced
                rec["forced_reason"] = "not exercised"
                self.A.write_record("CLEAN-008", rec)
                self.assertNotPass(self.gate(), f"CLEAN-008 {forced}")
                (self.A.results / "scenarios" / "CLEAN-008" / "result.json").write_text(original)

    # --- mutation F: a manipulated result --------------------------------------------------------

    def test_a_result_edited_after_the_fact_disagrees_with_the_serial_channel(self) -> None:
        rec = self.A.record("CLEAN-003")
        rec["assertions"][0]["ok"] = False  # the record now says FAIL while the serial line said PASS
        self.A.write_record("CLEAN-003", rec)
        self.assertEqual(self.gate().status, release_check.FAIL)

    def test_a_stored_verdict_that_differs_from_the_rederived_one_cannot_pass(self) -> None:
        judged = report.judge([report.load_cycle(f.dir) for f in (self.A, self.B, self.U, self.N)], SPEC)
        stored = self.root / "verdict.json"
        stored.write_text(json.dumps(judged))
        self.assertEqual(self.gate().status, release_check.PASS, "a faithful stored verdict is accepted")
        judged["cycles"]["A"]["scenarios"]["CLEAN-004"]["assertions"] += 1
        stored.write_text(json.dumps(judged))
        check = self.gate()
        self.assertEqual(check.status, release_check.FAIL)
        self.assertIn("differs", check.evidence)

    def test_a_verdict_from_another_judge_cannot_pass(self) -> None:
        judged = report.judge([report.load_cycle(f.dir) for f in (self.A, self.B, self.U, self.N)], SPEC)
        judged["subject"]["judge"]["report_py_sha256"] = "0" * 64
        (self.root / "verdict.json").write_text(json.dumps(judged))
        self.assertEqual(self.gate().status, release_check.FAIL)

    def test_a_verdict_alone_is_a_claim_and_is_not_a_pass(self) -> None:
        lone = pathlib.Path(self.tmp.name) / "verdict.json"
        lone.write_text(json.dumps({"CLEAN_VM_ACCEPTANCE": "PASS", "matrix": {}}))
        self.assertEqual(self.gate(evidence=lone).status, release_check.EXTERNAL)
        lone.write_text(json.dumps({"CLEAN_VM_ACCEPTANCE": "FAIL"}))
        self.assertEqual(self.gate(evidence=lone).status, release_check.FAIL)

    def test_a_missing_path_fails(self) -> None:
        self.assertEqual(self.gate(evidence=pathlib.Path(self.tmp.name) / "nope").status, release_check.FAIL)

    def test_evidence_that_cannot_be_read_fails_closed(self) -> None:
        (self.A.dir / "expected.json").write_text("not json")
        self.assertEqual(self.gate().status, release_check.FAIL)


if __name__ == "__main__":
    unittest.main()
