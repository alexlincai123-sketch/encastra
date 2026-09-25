"""scripts/cleanvm/report.py: a green verdict only from evidence that is complete and consistent.

Each test builds cycle directories the way lab.sh leaves them, then breaks one thing - the ways a
Clean VM run could be wrong while looking right - and requires the verdict to stop being PASS.
"""

from __future__ import annotations

import copy
import hashlib
import json
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "cleanvm"))
import report  # noqa: E402

BUILD = "1ce8e864da3eba12043684d86f4accf51707e519"
SETUP = "Encastra_0.5.0-rc.5_x64-setup.exe"
SHA = "afaec18b217d66171a5c9c9f530d94b6e7e591ca61af18a3101733cb01674f10"
EXPECTED = {"installer": {"file": SETUP, "sha256": SHA, "version": "0.5.0-rc.5", "build_commit": BUILD,
                          "installed_exe_sha256": "e" * 64}}
BASE_SHA = "b" * 64


def journeys_log(fail_line: bool = False, summary: bool = True, failed: int = 0) -> str:
    lines = [f"SUBJECT exe=x sha256={'e' * 64} stamp={BUILD} version=0.5.0-rc.5"]
    lines += [f"PASS  j{(i % 5) + 1} step {i} -> ok" for i in range(20)]
    if fail_line:
        lines.insert(10, "FAIL  j3 import landed -> nothing")
    if summary:
        lines.append(f"SUMMARY  passed=20 failed={failed} skipped=0  repeat=1  stamp={BUILD}")
    return "\n".join(lines) + "\n"


class Fixture:
    """One cycle directory, every scenario PASS, serial log consistent with the records."""

    def __init__(self, root: pathlib.Path, name: str, mode: str = "full", inject=None, base_sha=BASE_SHA):
        self.dir = root / name
        self.results = self.dir / "results"
        (self.results / "scenarios").mkdir(parents=True)
        self.plan = {"cycle": name, "mode": mode, "inject": inject or [], "tamper_installer": False,
                     "omit_installer": False, "harness_dirty": False}
        self.serial: list[str] = []
        ids = report.FULL_REQUIRED if mode == "full" else report.UPGRADE_REQUIRED
        for sid in ids:
            self.add(sid)
        self.serial.append("t CLEANVM-DONE")
        (self.results / "environment.json").write_text(json.dumps({"build": "26200.6584", "machine_guid": "g"}))
        manifest = {"plan.json": "1" * 64}
        (self.dir / "harness-manifest.json").write_text(json.dumps(manifest))
        (self.dir / "harness.sha256").write_text(f"{'1' * 64}  ./plan.json\n")
        (self.dir / "base.sha256").write_text(f"{base_sha}  base.qcow2\n")
        (self.dir / "qemu.exit").write_text("0\n")
        (self.dir / "expected.json").write_text(json.dumps(EXPECTED))
        self.flush()
        s3 = self.results / "scenarios" / "CLEAN-003"
        if s3.exists():
            (s3 / "install-dir.json").write_text(json.dumps([{"path": "encastra-desktop.exe", "sha256": "e" * 64}]))

    def add(self, sid: str, names=None, oks=None, result="PASS", evidence=None, serial=True):
        names = names or [f"{frag} (check)" for frag in report.REQUIRED.get(sid, ["generic check"])]
        oks = oks if oks is not None else [True] * len(names)
        rec = {"scenario_id": sid, "result": result, "forced_reason": None,
               "artifact": {"file": SETUP, "sha256": SHA, "version": "0.5.0-rc.5"},
               "assertions": [{"name": n, "ok": o, "observed": "x"} for n, o in zip(names, oks)],
               "evidence": evidence or []}
        d = self.results / "scenarios" / sid
        d.mkdir(parents=True, exist_ok=True)
        (d / "result.json").write_text(json.dumps(rec))
        if sid == "CLEAN-005":
            (d / "gui-journeys.log").write_text(journeys_log())
            rec["evidence"] = [f"scenarios/{sid}/gui-journeys.log"]
            (d / "result.json").write_text(json.dumps(rec))
        if serial:
            for n, o in zip(names, oks):
                self.serial.append(f"t {'PASS' if o else 'FAIL'} {sid} {n} -> x")
            self.serial.append(f"t RESULT {sid} {result} assertions={len(names)} failed={oks.count(False)}")

    def record(self, sid: str) -> dict:
        return json.loads((self.results / "scenarios" / sid / "result.json").read_text())

    def write_record(self, sid: str, rec: dict) -> None:
        (self.results / "scenarios" / sid / "result.json").write_text(json.dumps(rec))

    def flush(self):
        (self.dir / "plan.json").write_text(json.dumps(self.plan))
        (self.dir / "serial.log").write_text("\n".join(self.serial) + "\n")


class ReportTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.tmp.name)
        self.A = Fixture(self.root, "A")
        self.B = Fixture(self.root, "B")
        self.U = Fixture(self.root, "U", mode="upgrade")
        self.N = Fixture(self.root, "N1", inject=["hidden-fail"])
        rec = self.N.record("CLEAN-001")
        self.spec = {"N1": {"must_fail": {"CLEAN-001": "FAIL: no marker"}}}
        rec["assertions"][0]["ok"] = False
        rec["result"] = "FAIL"
        self.N.write_record("CLEAN-001", rec)
        self.N.serial = [l.replace("PASS CLEAN-001 no marker", "FAIL CLEAN-001 no marker").replace("RESULT CLEAN-001 PASS assertions=6 failed=0", "RESULT CLEAN-001 FAIL assertions=6 failed=1") for l in self.N.serial]
        self.N.flush()

    def tearDown(self):
        self.tmp.cleanup()

    def verdict(self):
        cycles = [report.load_cycle(f.dir) for f in (self.A, self.B, self.U, self.N)]
        return report.judge(cycles, self.spec)

    def assertNotPass(self, why: str):
        v = self.verdict()
        self.assertEqual(v["CLEAN_VM_ACCEPTANCE"], "FAIL", why)
        return v

    def test_complete_consistent_evidence_passes(self):
        v = self.verdict()
        self.assertEqual(v["CLEAN_VM_ACCEPTANCE"], "PASS", json.dumps(v, indent=1)[:3000])

    def test_pass_with_zero_assertions_is_fail(self):
        rec = self.A.record("CLEAN-004"); rec["assertions"] = []; self.A.write_record("CLEAN-004", rec)
        v = self.assertNotPass("a scenario with no executed assertion")
        self.assertEqual(v["matrix"]["CLEAN-004@A"], "FAIL")

    def test_failed_assertion_under_a_pass_result_is_fail(self):
        rec = self.A.record("CLEAN-003"); rec["assertions"][0]["ok"] = False; self.A.write_record("CLEAN-003", rec)
        self.assertNotPass("result.json says PASS over a failed assertion")

    def test_missing_scenario_is_not_run(self):
        import shutil
        shutil.rmtree(self.B.results / "scenarios" / "CLEAN-009")
        v = self.assertNotPass("a scenario that never ran")
        self.assertEqual(v["matrix"]["CLEAN-009@B"], "NOT_RUN")

    def test_blocked_or_not_applicable_is_not_pass(self):
        for forced in ("BLOCKED", "NOT_APPLICABLE"):
            with self.subTest(forced=forced):
                rec = self.A.record("CLEAN-008"); rec["result"] = forced; rec["forced_reason"] = "no disk"; self.A.write_record("CLEAN-008", rec)
                v = self.assertNotPass(f"{forced} must not count")
                self.assertNotEqual(v["matrix"]["CLEAN-008@A"], "PASS")

    def test_disabled_required_check_is_fail(self):
        rec = self.A.record("CLEAN-012")
        rec["assertions"] = [a for a in rec["assertions"] if "install directory removed" not in a["name"]]
        self.A.write_record("CLEAN-012", rec)
        self.A.serial = [l for l in self.A.serial if "install directory removed" not in l]
        self.A.serial = [l.replace("RESULT CLEAN-012 PASS assertions=7", "RESULT CLEAN-012 PASS assertions=6") for l in self.A.serial]
        self.A.flush()
        v = self.assertNotPass("a required check deleted from the scenario")
        self.assertTrue(any("required check missing" in p for p in v["cycles"]["A"]["scenarios"]["CLEAN-012"]["problems"]))

    def test_results_disk_disagreeing_with_serial_is_fail(self):
        self.A.serial = [l.replace("PASS CLEAN-006 language choice", "FAIL CLEAN-006 language choice") for l in self.A.serial]
        self.A.flush()
        self.assertNotPass("the serial line saw a FAIL the results disk does not show")

    def test_serial_assertion_missing_from_the_record_is_fail(self):
        # The guest printed a check the record does not carry: the record lost something.
        self.A.serial.insert(3, "t FAIL CLEAN-004 a check the record dropped -> x")
        self.A.flush()
        v = self.assertNotPass("an assertion seen on the serial line and absent from result.json")
        self.assertEqual(v["matrix"]["CLEAN-004@A"], "FAIL")

    def test_recorded_fail_with_passing_assertions_is_not_upgraded_to_pass(self):
        rec = self.A.record("CLEAN-010"); rec["result"] = "FAIL"; self.A.write_record("CLEAN-010", rec)
        self.A.serial = [l.replace("RESULT CLEAN-010 PASS", "RESULT CLEAN-010 FAIL") for l in self.A.serial]
        self.A.flush()
        v = self.assertNotPass("a scenario the guest called FAIL must not become PASS here")
        self.assertEqual(v["matrix"]["CLEAN-010@A"], "FAIL")

    def test_missing_serial_result_line_is_fail(self):
        self.A.serial = [l for l in self.A.serial if "RESULT CLEAN-010" not in l]
        self.A.flush()
        self.assertNotPass("no RESULT line for a scenario")

    def test_wrong_artifact_in_a_record_is_fail(self):
        rec = self.A.record("CLEAN-004"); rec["artifact"]["sha256"] = "0" * 64; self.A.write_record("CLEAN-004", rec)
        self.assertNotPass("a record about some other installer")

    def test_hidden_fail_in_journeys_log_is_fail(self):
        (self.A.results / "scenarios" / "CLEAN-005" / "gui-journeys.log").write_text(journeys_log(fail_line=True))
        v = self.assertNotPass("a FAIL buried in a journeys log whose SUMMARY says failed=0")
        self.assertEqual(v["matrix"]["CLEAN-005@A"], "FAIL")

    def test_journeys_log_without_summary_is_fail(self):
        (self.B.results / "scenarios" / "CLEAN-005" / "gui-journeys.log").write_text(journeys_log(summary=False))
        self.assertNotPass("a journeys run that never reached its end")

    def test_injected_cycle_cannot_be_acceptance(self):
        self.A.plan["inject"] = ["persist"]; self.A.flush()
        self.assertNotPass("an acceptance cycle carrying an injected fault")

    def test_dirty_harness_cannot_be_acceptance(self):
        self.U.plan["harness_dirty"] = True; self.U.flush()
        self.assertNotPass("an acceptance cycle run from an uncommitted harness")

    def test_timed_out_cycle_is_fail(self):
        (self.B.dir / "timed-out").write_text("timeout")
        self.assertNotPass("a cycle whose VM was killed at the time limit")

    def test_guest_that_never_finished_is_fail(self):
        self.B.serial = [l for l in self.B.serial if "CLEANVM-DONE" not in l]; self.B.flush()
        self.assertNotPass("a guest that did not report CLEANVM-DONE")

    def test_harness_disc_mismatch_is_fail(self):
        (self.A.dir / "harness.sha256").write_text(f"{'2' * 64}  ./plan.json\n")
        self.assertNotPass("the disc the VM saw is not the disc that was assembled")

    def test_different_base_between_A_and_B_breaks_repeatability(self):
        (self.B.dir / "base.sha256").write_text(f"{'c' * 64}  base.qcow2\n")
        v = self.assertNotPass("cycle B on a different base image")
        self.assertEqual(v["matrix"]["CLEAN-014"], "FAIL")

    def test_different_installed_bytes_between_A_and_B_breaks_repeatability(self):
        (self.B.results / "scenarios" / "CLEAN-003" / "install-dir.json").write_text(json.dumps([{"path": "encastra-desktop.exe", "sha256": "f" * 64}]))
        v = self.assertNotPass("the two cycles installed different bytes")
        self.assertEqual(v["matrix"]["CLEAN-014"], "FAIL")

    def test_negative_cycle_that_did_not_fail_is_fail(self):
        rec = self.N.record("CLEAN-001"); rec["assertions"][0]["ok"] = True; rec["result"] = "PASS"; self.N.write_record("CLEAN-001", rec)
        self.N.serial = [l.replace("FAIL CLEAN-001 no marker", "PASS CLEAN-001 no marker").replace("RESULT CLEAN-001 FAIL assertions=6 failed=1", "RESULT CLEAN-001 PASS assertions=6 failed=0") for l in self.N.serial]
        self.N.flush()
        v = self.assertNotPass("a fault the harness did not detect")
        self.assertEqual(v["matrix"]["NEGATIVE"], "FAIL")

    def test_negative_cycle_without_a_fault_is_not_evidence(self):
        self.N.plan["inject"] = []; self.N.flush()
        self.assertNotPass("a 'negative' cycle that carried no fault")

    def test_no_negative_spec_is_not_pass(self):
        self.spec = {}
        v = self.assertNotPass("no negative testing at all")
        self.assertEqual(v["matrix"]["NEGATIVE"], "NOT_RUN")

    def test_upgrade_cycle_missing_is_not_run(self):
        cycles = [report.load_cycle(f.dir) for f in (self.A, self.B, self.N)]
        v = report.judge(cycles, self.spec)
        self.assertEqual(v["CLEAN_VM_ACCEPTANCE"], "FAIL")
        self.assertEqual(v["matrix"]["CLEAN-011@U"], "NOT_RUN")


if __name__ == "__main__":
    unittest.main()
