"""release_check reaches one verdict from the tree, the artefacts and the history, and writes it down.

The slow gates (tests, dependency audits, the network) are skipped here; what is tested is the
logic that turns the other checks into a mode and a verdict, against a fixture repository with
synthetic artefacts — the same fixture the identity and manifest tests use.
"""

from __future__ import annotations

import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from test_release_identity import Tree  # noqa: E402

SCRIPT = HERE.parent / "release_check.py"
MANIFEST = HERE.parent / "release_manifest.py"
# Authenticode can only be read on Windows; elsewhere the signing check is NOT_VERIFIED.
READS_AUTHENTICODE = sys.platform == "win32"
GIT = ["git", "-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false"]

SITE_TS = """export const VERSION = '{v}';
export const RELEASE = {{
  installerFilename: 'x',
  installerVersion: 'x',
  installerSize: 'x',
  installerSha256: 'x',
  binaryFilename: 'x',
  binarySize: 'x',
  binarySha256: 'x',
  builtOn: 'x',
  builtFor: 'x',
  commit: 'x',
  signed: true,
}} as const;
"""


class Fixture(Tree):
    """The identity fixture plus the two publication files, so the manifest can be written."""

    def __init__(self, root: pathlib.Path, version: str) -> None:
        (root / "docs").mkdir(parents=True)
        (root / "docs/RELEASE.md").write_text("# R\n\n<!-- BUILD:START -->\nnone\n<!-- BUILD:END -->\n", "utf-8")
        (root / "apps/web/src/config").mkdir(parents=True)
        (root / "apps/web/src/config/site.ts").write_text(SITE_TS.format(v=version), "utf-8")
        (root / "scripts").mkdir()
        # version.py --check is invoked from the tree; give the fixture one that agrees.
        (root / "scripts/version.py").write_text("import sys; sys.exit(0)\n", "utf-8")
        super().__init__(root, version)

    def env(self) -> dict:
        return {**os.environ, "ENCASTRA_RELEASE_ROOT": str(self.root)}

    def publish(self) -> None:
        result = subprocess.run([sys.executable, str(MANIFEST), "--allow-unsigned", "--local-build"], cwd=self.root, capture_output=True, text=True, env=self.env())
        assert result.returncode == 0, result.stderr
        subprocess.run([*GIT, "add", "-A"], cwd=self.root, check=True)
        subprocess.run([*GIT, "commit", "-q", "-m", "publication"], cwd=self.root, check=True)

    def check(self, *flags: str) -> tuple[int, dict, str]:
        out = self.root / "readiness.json"
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--skip-gate", "--skip-deps", "--no-network", "--out", str(out), *flags],
            cwd=self.root,
            capture_output=True,
            text=True,
            env=self.env(),
        )
        return result.returncode, json.loads(out.read_text("utf-8")), result.stdout + result.stderr


def status_of(report: dict, check_id: str) -> str:
    return next(c["status"] for c in report["checks"] if c["id"] == check_id)


class ReleaseCheckTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def fixture(self, version: str) -> Fixture:
        return Fixture(pathlib.Path(self._tmp.name), version)

    def test_a_published_unsigned_beta_is_beta_ready_with_only_external_items_left(self) -> None:
        tree = self.fixture("0.6.0-beta.1")
        tree.binary("0.6.0-beta.1")
        tree.installer("0.6.0-beta.1")
        tree.publish()
        # The gate and the dependency audits were skipped, so they are NOT_VERIFIED and block.
        code, report, _ = tree.check()
        self.assertEqual(report["mode"], "beta")
        self.assertEqual(status_of(report, "artefacts.identity"), "PASS")
        self.assertEqual(status_of(report, "manifest.verify"), "PASS")
        # Only Windows can read Authenticode; anywhere else the state is unknown, and unknown is
        # NOT_VERIFIED rather than "unsigned, accepted" (fix/signature-probe).
        self.assertEqual(status_of(report, "signing"), "PASS" if READS_AUTHENTICODE else "NOT_VERIFIED")
        self.assertEqual(status_of(report, "clean_vm"), "EXTERNAL_REQUIRED")
        self.assertEqual(report["verdict"], "BLOCKED")
        self.assertIn("gate.scripts", report["reason"])
        self.assertEqual(code, 1)

    def test_a_release_version_unsigned_fails_on_signing(self) -> None:
        tree = self.fixture("0.6.0")
        tree.binary("0.6.0")
        tree.installer("0.6.0")
        code, report, _ = tree.check()
        self.assertEqual(report["mode"], "release")
        self.assertEqual(status_of(report, "signing"), "FAIL" if READS_AUTHENTICODE else "NOT_VERIFIED")
        self.assertEqual(report["verdict"], "BLOCKED")
        self.assertEqual(code, 1)

    def test_a_dirty_tree_is_a_dev_build_and_not_a_release(self) -> None:
        tree = self.fixture("0.6.0-beta.1")
        tree.binary("0.6.0-beta.1")
        tree.installer("0.6.0-beta.1")
        (tree.root / "src.rs").write_text("fn main() { changed(); }\n", "utf-8")
        code, report, _ = tree.check()
        self.assertEqual(report["mode"], "dev")
        self.assertEqual(status_of(report, "git.state"), "FAIL")
        self.assertEqual(report["verdict"], "NOT_A_RELEASE")
        self.assertEqual(code, 1)

    def test_claiming_release_for_a_prerelease_version_is_refused(self) -> None:
        tree = self.fixture("0.6.0-beta.1")
        tree.binary("0.6.0-beta.1")
        tree.installer("0.6.0-beta.1")
        _, report, _ = tree.check("--mode", "release")
        self.assertEqual(status_of(report, "mode"), "FAIL")
        self.assertEqual(report["mode"], "beta", "a claim never raises the mode")

    def test_a_stale_artefact_fails_identity(self) -> None:
        tree = self.fixture("0.6.0-beta.1")
        tree.binary("0.6.0-beta.1")
        tree.installer("0.6.0-beta.1")
        tree.installer("0.5.0-beta.1", name="Encastra_0.6.0-beta.1_x64-setup.exe")
        _, report, _ = tree.check()
        self.assertEqual(status_of(report, "artefacts.identity"), "FAIL")
        self.assertIn("artefacts.identity", report["reason"])

    def test_no_artefacts_is_blocked_not_failed(self) -> None:
        tree = self.fixture("0.6.0-beta.1")
        _, report, _ = tree.check()
        self.assertEqual(status_of(report, "artefacts.identity"), "BLOCKED")
        self.assertEqual(status_of(report, "signing"), "BLOCKED")

    def test_a_second_identical_build_passes_reproducibility_and_a_different_one_fails(self) -> None:
        tree = self.fixture("0.6.0-beta.1")
        tree.binary("0.6.0-beta.1")
        tree.installer("0.6.0-beta.1")
        other = pathlib.Path(self._tmp.name) / "other"
        for rel in ("target/release/encastra-desktop.exe", "target/release/bundle/nsis/Encastra_0.6.0-beta.1_x64-setup.exe"):
            (other / rel).parent.mkdir(parents=True, exist_ok=True)
            (other / rel).write_bytes((tree.root / rel).read_bytes())
        _, report, _ = tree.check("--compare", str(other))
        self.assertEqual(status_of(report, "reproducibility"), "PASS")
        (other / "target/release/encastra-desktop.exe").write_bytes(b"MZ" + b"\0" * 100)
        _, report, _ = tree.check("--compare", str(other))
        self.assertEqual(status_of(report, "reproducibility"), "FAIL")

    def test_a_clean_machine_log_alone_is_never_clean_vm_evidence(self) -> None:
        # One install_check log proves one install. The acceptance is the cycles, judged again in
        # scripts/tests/test_release_check_vm.py; a log that passed is not enough, one that failed is.
        tree = self.fixture("0.6.0-beta.1")
        tree.binary("0.6.0-beta.1")
        tree.installer("0.6.0-beta.1")
        log = tree.root / "vm.log"
        log.write_text("PASS  a\nPASS  b\n", "utf-8")
        _, report, _ = tree.check("--evidence-vm", str(log))
        self.assertEqual(status_of(report, "clean_vm"), "EXTERNAL_REQUIRED")
        log.write_text("PASS  a\nFAIL  b -> broken\n", "utf-8")
        _, report, _ = tree.check("--evidence-vm", str(log))
        self.assertEqual(status_of(report, "clean_vm"), "FAIL")

    def test_the_journey_log_is_judged_against_the_artefacts_of_this_tree(self) -> None:
        # The command, not the function: main() hands the artefacts to the journey check.
        tree = self.fixture("0.6.0-beta.1")
        tree.binary("0.6.0-beta.1")
        tree.installer("0.6.0-beta.1")
        built = hashlib.sha256((tree.root / "target/release/encastra-desktop.exe").read_bytes()).hexdigest()
        text = GuiJourneyEvidenceTests.three_passing_runs(tree.commit)
        log = tree.root / "gui-journeys.log"
        log.write_text(text.replace(GuiJourneyEvidenceTests.INSTALLED_SHA, built), "utf-8")
        _, report, _ = tree.check("--evidence-gui", str(log))
        self.assertEqual(status_of(report, "gui.journeys"), "PASS")
        log.write_text(text.replace(GuiJourneyEvidenceTests.INSTALLED_SHA, "cd" * 32), "utf-8")
        _, report, _ = tree.check("--evidence-gui", str(log))
        self.assertEqual(status_of(report, "gui.journeys"), "FAIL")

    def test_a_published_version_cannot_get_a_second_binary(self) -> None:
        # Release immutability: version + commit + hashes are one identity. The code moves on
        # under the same number, a new binary appears — and the check blocks until the version
        # changes, whatever else is green.
        tree = self.fixture("0.6.0-beta.1")
        tree.binary("0.6.0-beta.1")
        tree.installer("0.6.0-beta.1")
        tree.publish()
        _, report, _ = tree.check()
        self.assertEqual(status_of(report, "version.unique"), "PASS")
        (tree.root / "src.rs").write_text("fn main() { moved_on(); }\n", "utf-8")
        subprocess.run([*GIT, "add", "-A"], cwd=tree.root, check=True)
        subprocess.run([*GIT, "commit", "-q", "-m", "more code, same version"], cwd=tree.root, check=True)
        head = subprocess.run([*GIT, "rev-parse", "HEAD"], cwd=tree.root, capture_output=True, text=True, check=True).stdout.strip()
        tree.binary("0.6.0-beta.1", stamp=head)  # rebuilt from the new HEAD: correct stamp, same version
        tree.installer("0.6.0-beta.1")
        _, report, _ = tree.check()
        self.assertEqual(status_of(report, "version.unique"), "FAIL")
        self.assertIn("bump the version", next(c["action"] for c in report["checks"] if c["id"] == "version.unique"))
        self.assertEqual(status_of(report, "artefacts.identity"), "PASS", "the artefacts are HEAD's; the version is the problem")
        self.assertEqual(report["verdict"], "BLOCKED")
        self.assertIn("version.unique", report["reason"])

    def test_the_report_uses_only_the_five_words(self) -> None:
        tree = self.fixture("0.6.0-beta.1")
        _, report, _ = tree.check()
        self.assertTrue(set(report["statuses"]) <= {"PASS", "FAIL", "BLOCKED", "NOT_VERIFIED", "EXTERNAL_REQUIRED"}, report["statuses"])


class SigningTests(unittest.TestCase):
    """What an artefact's Authenticode state is taken to mean.

    The probe can fail to answer — off Windows, or when the cmdlet cannot be loaded. `unchecked`
    is that: a question nobody got an answer to. It is neither `broken`, which would tell somebody
    to re-sign a file nothing inspected, nor `unsigned`, which would have a beta state in writing
    that the artefact carries no signature when that was never read.
    """

    @staticmethod
    def module():
        sys.path.insert(0, str(SCRIPT.parent))
        import release_check

        return release_check

    @classmethod
    def judge(cls, mode: str, *statuses: str):
        entries = [{"name": f"a{i}.exe", "signature": {"status": s, "timestamped": s == "signed"}} for i, s in enumerate(statuses)]
        return cls.module().check_signing(mode, entries)

    def test_an_unreadable_state_is_not_verified_rather_than_an_unsigned_pass(self) -> None:
        verdict = self.judge("beta", "unchecked")
        self.assertEqual(verdict.status, self.module().NOT_VERIFIED)
        self.assertIn("could not be read", verdict.evidence)

    def test_a_genuinely_unsigned_beta_still_passes(self) -> None:
        self.assertEqual(self.judge("beta", "unsigned").status, self.module().PASS)

    def test_a_broken_signature_still_fails_and_outranks_an_unreadable_one(self) -> None:
        verdict = self.judge("beta", "broken", "unchecked")
        self.assertEqual(verdict.status, self.module().FAIL)
        self.assertIn("not valid", verdict.evidence)

    def test_a_release_never_ships_on_a_state_nobody_read(self) -> None:
        self.assertNotEqual(self.judge("release", "unchecked").status, self.module().PASS)


class CiEvidenceTests(unittest.TestCase):
    """What the CI runs for a commit are taken to mean.

    Asked of the reading directly rather than through the fixture: the thing under test is what
    `gh run list`'s answer means, not the machinery that fetches it.
    """

    @staticmethod
    def judge(*runs: dict):
        sys.path.insert(0, str(SCRIPT.parent))
        import release_check

        return release_check.judge_runs(list(runs), "git@example.invalid:x/y.git", "0123456789abcdef")

    @staticmethod
    def a_run(name: str = "CI", *, status: str, conclusion: str | None) -> dict:
        return {
            "name": name,
            "status": status,
            "conclusion": conclusion,
            "url": f"https://example.invalid/{name.replace(' ', '-')}",
        }

    def test_a_green_run_is_evidence(self) -> None:
        self.assertEqual(self.judge(self.a_run(status="completed", conclusion="success")).status, "PASS")

    def test_a_run_that_finished_badly_fails(self) -> None:
        check = self.judge(self.a_run(status="completed", conclusion="failure"))
        self.assertEqual(check.status, "FAIL")
        self.assertIn("failure", check.evidence)

    def test_a_run_still_going_is_not_yet_known(self) -> None:
        # An unfinished run has no conclusion at all. Reading that as "not success" said the
        # release was broken while CI was still running, and said the opposite minutes later.
        check = self.judge(self.a_run(status="in_progress", conclusion=None))
        self.assertEqual(check.status, "NOT_VERIFIED")
        self.assertIn("in progress", check.evidence)
        self.assertIn("https://example.invalid/CI", check.evidence)

    def test_a_queued_run_is_not_yet_known_either(self) -> None:
        self.assertEqual(self.judge(self.a_run(status="queued", conclusion=None)).status, "NOT_VERIFIED")

    def test_a_finished_failure_outranks_something_still_going(self) -> None:
        check = self.judge(
            self.a_run("CI", status="completed", conclusion="failure"),
            self.a_run("Cross-machine reproduction", status="in_progress", conclusion=None),
        )
        self.assertEqual(check.status, "FAIL", "a run known to have failed is known now")

    def test_a_cancelled_run_is_a_failure_not_an_unknown(self) -> None:
        self.assertEqual(self.judge(self.a_run(status="completed", conclusion="cancelled")).status, "FAIL")

    def test_no_run_of_a_required_workflow_is_not_yet_known(self) -> None:
        check = self.judge(self.a_run("Something else", status="completed", conclusion="success"))
        self.assertEqual(check.status, "NOT_VERIFIED")
        self.assertIn("no run of CI", check.evidence)


class GuiJourneyEvidenceTests(unittest.TestCase):
    """What a gui_journeys.ps1 log is taken to mean.

    Asked of the reading directly, like the CI evidence above: what is under test is how a log is
    judged, not the machinery that finds one.
    """

    # The commit the release expects, and another one. A log is judged against the first.
    EXPECTED = "0123456789abcdef0123456789abcdef01234567"
    OTHER = "fedcba9876543210fedcba9876543210fedcba98"
    # The executable built here, and what Tauri's NSIS installer leaves on disk from it: the same
    # bytes with the bundle marker rewritten. Under -Launch the harness hashes the installed copy.
    BUILT = b"MZ" + b"\0" * 64 + b"__TAURI_BUNDLE_TYPE_VAR_UNK" + b"\0" * 64 + b"__TAURI_BUNDLE_TYPE_VAR_NSS"
    BUILT_SHA = hashlib.sha256(BUILT).hexdigest()
    INSTALLED_SHA = hashlib.sha256(BUILT.replace(b"__TAURI_BUNDLE_TYPE_VAR_UNK", b"__TAURI_BUNDLE_TYPE_VAR_NSS")).hexdigest()

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        exe = pathlib.Path(self._tmp.name) / "encastra-desktop.exe"
        exe.write_bytes(self.BUILT)
        self.entries = [{"name": "encastra-desktop.exe", "path": str(exe), "sha256": self.BUILT_SHA}]

    def judge(self, text: str, expected: str | None = EXPECTED):
        sys.path.insert(0, str(SCRIPT.parent))
        import release_check

        log = pathlib.Path(self._tmp.name) / "gui-journeys.log"
        log.write_text(text, "utf-8")
        return release_check.check_gui_journeys(log, expected, self.entries)

    @classmethod
    def subject(cls, stamp: str, sha: str | None = None) -> str:
        return f"SUBJECT  exe=C:\\Users\\r\\AppData\\Local\\Encastra\\encastra-desktop.exe sha256={sha or cls.INSTALLED_SHA} stamp={stamp} version=0.5.0-rc.4\n"

    @staticmethod
    def iteration(i: int, n: int = 3) -> str:
        # The headers gui_journeys.ps1 prints: one per iteration, one per journey section in it.
        return (
            f"--- iteration {i} of {n} ---\n"
            "--- journey 1: projects-location (Settings -> Projects -> Browse) ---\n"
            f"PASS  j1 something  -> observed  [iteration {i}/{n}]\n"
            "--- journey 2: publish-into (Builder -> Publish -> Prepare) ---\n"
            f"PASS  j2 something  -> observed  [iteration {i}/{n}]\n"
            "--- journey 3: import-from (Library -> Import) ---\n"
            f"PASS  j3 something  -> observed  [iteration {i}/{n}]\n"
            "--- journeys 4 and 5: grant-to-component and run-input (Inspector) ---\n"
            f"PASS  j4 something  -> observed  [iteration {i}/{n}]\n"
        )

    @classmethod
    def three_passing_runs(cls, stamp: str) -> str:
        return (
            cls.subject(stamp)
            + cls.iteration(1)
            + cls.iteration(2)
            + cls.iteration(3)
            + f"SUMMARY  passed=12 failed=0 skipped=0  repeat=3  stamp={stamp}  sandbox=C:\\x\n"
        )

    def judge_bytes(self, raw: bytes, expected: str | None = EXPECTED, entries: list[dict] | None = None):
        sys.path.insert(0, str(SCRIPT.parent))
        import release_check

        log = pathlib.Path(self._tmp.name) / "gui-journeys.log"
        log.write_bytes(raw)
        return release_check.check_gui_journeys(log, expected, self.entries if entries is None else entries)

    # --- what an adversarial review (2026-09-22) got the gate to accept, each now refused ---------

    def test_the_installed_copy_of_the_executable_built_here_is_the_build_here(self) -> None:
        # What a -Launch run hashes: the copy the installer left, marker rewritten, three bytes off.
        check = self.judge(self.three_passing_runs(self.EXPECTED))
        self.assertEqual(check.status, "PASS")
        self.assertIn("installer leaves it", check.evidence)
        # And a run against target/ itself.
        check = self.judge(self.three_passing_runs(self.EXPECTED).replace(self.INSTALLED_SHA, self.BUILT_SHA))
        self.assertEqual(check.status, "PASS")

    def test_a_log_is_bound_to_the_executable_built_here_not_only_to_its_commit(self) -> None:
        # Same commit, other bytes: a debug build, a patched one, another toolset's.
        for other in ("cd" * 32, "none"):
            with self.subTest(sha=other):
                check = self.judge(self.three_passing_runs(self.EXPECTED).replace(self.INSTALLED_SHA, other))
                self.assertEqual(check.status, "FAIL")
                self.assertIn(other, check.evidence)
                self.assertIn(self.BUILT_SHA, check.evidence)
                self.assertIn(self.INSTALLED_SHA, check.evidence)

    def test_no_built_executable_to_compare_with_is_not_a_pass(self) -> None:
        check = self.judge_bytes(self.three_passing_runs(self.EXPECTED).encode("utf-8"), entries=[])
        self.assertEqual(check.status, "BLOCKED")

    def test_two_summary_lines_are_two_runs(self) -> None:
        good = self.three_passing_runs(self.EXPECTED)
        summary = good.splitlines()[-1]
        check = self.judge(good.replace(summary, summary + "\n" + summary))
        self.assertEqual(check.status, "FAIL")
        self.assertIn("2 SUMMARY", check.evidence)

    def test_a_repeat_the_harness_would_never_write_is_refused_at_once(self) -> None:
        # Used to build a list as long as the number: 10**20 hung the gate.
        text = self.three_passing_runs(self.EXPECTED).replace("repeat=3", "repeat=" + "9" * 20)
        self.assertEqual(self.judge(text).status, "FAIL")

    def test_counters_in_a_shape_the_harness_does_not_write_are_refused(self) -> None:
        for bad in ("repeat=03", "repeat=3.0", "repeat=+3"):
            with self.subTest(bad=bad):
                self.assertEqual(self.judge(self.three_passing_runs(self.EXPECTED).replace("repeat=3", bad)).status, "FAIL")
        self.assertEqual(self.judge(self.three_passing_runs(self.EXPECTED).replace("passed=12", "passed=12.0")).status, "FAIL")

    def test_two_subject_lines_are_two_logs(self) -> None:
        text = self.subject(self.EXPECTED) + self.three_passing_runs(self.EXPECTED)
        check = self.judge(text)
        self.assertEqual(check.status, "FAIL")
        self.assertIn("SUBJECT", check.evidence)

    def test_a_subject_written_after_the_suite_started_is_refused(self) -> None:
        good = self.three_passing_runs(self.EXPECTED)
        subject, rest = good.split("\n", 1)
        check = self.judge(rest.replace("SUMMARY", subject + "\nSUMMARY"))
        self.assertEqual(check.status, "FAIL")
        self.assertIn("before the first iteration", check.evidence)

    def test_a_summary_with_two_stamps_is_refused(self) -> None:
        text = self.three_passing_runs(self.EXPECTED).replace("sandbox=C:\\x", f"stamp={self.OTHER}")
        self.assertEqual(self.judge(text).status, "FAIL")

    def test_a_summary_that_is_not_the_last_line_is_refused(self) -> None:
        good = self.three_passing_runs(self.EXPECTED)
        head, summary = good.rsplit("SUMMARY", 1)
        subject, body = head.split("\n", 1)
        check = self.judge(subject + "\nSUMMARY" + summary + body)
        self.assertEqual(check.status, "FAIL")
        self.assertIn("SUMMARY", check.evidence)

    def test_a_journey_announced_but_not_driven_is_a_failure(self) -> None:
        text = self.three_passing_runs(self.EXPECTED).replace("PASS  j3 something  -> observed  [iteration 2/3]\n", "").replace("passed=12", "passed=11")
        check = self.judge(text)
        self.assertEqual(check.status, "FAIL")
        self.assertIn("iteration 2: '--- journey 3: import-from' has no PASS", check.evidence)

    def test_a_skip_or_fail_in_a_shape_the_tally_misses_is_refused(self) -> None:
        good = self.three_passing_runs(self.EXPECTED)
        for line in ("skip  j2 -> not driven  [iteration 1/3]", "  SKIP  j2 -> not driven", "\tFAIL  j2 -> broken", "Fail  j2 -> broken"):
            with self.subTest(line=line):
                self.assertEqual(self.judge(good.replace("SUMMARY", line + "\nSUMMARY")).status, "FAIL")

    def test_a_directory_is_a_failure_not_a_traceback(self) -> None:
        sys.path.insert(0, str(SCRIPT.parent))
        import release_check

        self.assertEqual(release_check.check_gui_journeys(pathlib.Path(self._tmp.name), self.EXPECTED, self.entries).status, "FAIL")

    def test_the_encodings_a_windows_shell_writes_are_the_same_evidence(self) -> None:
        # Windows PowerShell 5.1's Tee-Object writes a UTF-8 BOM; some of its redirections UTF-16.
        text = self.three_passing_runs(self.EXPECTED).replace("\n", "\r\n")
        for raw in (b"\xef\xbb\xbf" + text.encode("utf-8"), text.encode("utf-16")):
            with self.subTest(head=raw[:4]):
                self.assertEqual(self.judge_bytes(raw).status, "PASS")

    def test_three_pass_lines_without_the_iterations_they_claim_are_a_failure(self) -> None:
        # The shape this gate used to accept as five journeys driven three times: three PASS lines
        # and a SUMMARY that says repeat=3, with no iteration ever opened.
        check = self.judge(
            self.subject(self.EXPECTED)
            + "PASS  j1 something  -> observed  [iteration 1/3]\n"
            + "PASS  j1 something  -> observed  [iteration 2/3]\n"
            + "PASS  j1 something  -> observed  [iteration 3/3]\n"
            + f"SUMMARY  passed=3 failed=0 skipped=0  repeat=3  stamp={self.EXPECTED}  sandbox=C:\\x\n",
        )
        self.assertEqual(check.status, "FAIL")
        self.assertIn("iteration headers", check.evidence)

    def test_a_log_with_windows_line_endings_is_read_the_same(self) -> None:
        # The runner writes the log on Windows; an artefact with CRLF is the same evidence.
        sys.path.insert(0, str(SCRIPT.parent))
        import release_check

        log = pathlib.Path(self._tmp.name) / "gui-journeys.log"
        log.write_bytes(self.three_passing_runs(self.EXPECTED).replace("\n", "\r\n").encode("utf-8"))
        check = release_check.check_gui_journeys(log, self.EXPECTED, self.entries)
        self.assertEqual(check.status, "PASS")

    def test_two_iterations_under_a_summary_of_three_is_a_failure(self) -> None:
        text = self.three_passing_runs(self.EXPECTED).replace(self.iteration(3), "").replace("passed=12", "passed=8")
        check = self.judge(text)
        self.assertEqual(check.status, "FAIL")
        self.assertIn("repeat=3", check.evidence)

    def test_an_iteration_that_skipped_a_journey_section_is_a_failure(self) -> None:
        text = self.three_passing_runs(self.EXPECTED).replace("--- journey 3: import-from (Library -> Import) ---\n", "", 1)
        check = self.judge(text)
        self.assertEqual(check.status, "FAIL")
        self.assertIn("import-from", check.evidence)
        self.assertIn("iteration 1", check.evidence)

    def test_an_iteration_with_no_pass_of_its_own_is_a_failure(self) -> None:
        # Its PASS line moved into another iteration's block: three headers, one of them empty.
        text = self.three_passing_runs(self.EXPECTED).replace("PASS  j1 something  -> observed  [iteration 2/3]\n", "", 1)
        text = text.replace("SUMMARY  passed=12", "PASS  j1 something  -> observed  [iteration 2/3]\nSUMMARY  passed=12")
        check = self.judge(text)
        self.assertEqual(check.status, "FAIL")
        self.assertIn("iteration 2", check.evidence)
        self.assertIn("projects-location' has no PASS line of its own", check.evidence)

    def test_a_summary_whose_tally_disagrees_with_the_lines_is_a_failure(self) -> None:
        # A FAIL line cut out of the middle leaves the harness's own count behind it.
        text = self.three_passing_runs(self.EXPECTED).replace("failed=0", "failed=1")
        check = self.judge(text)
        self.assertEqual(check.status, "FAIL")
        self.assertIn("failed=1", check.evidence)

    def test_three_runs_of_the_suite_all_passing_is_evidence(self) -> None:
        check = self.judge(self.three_passing_runs(self.EXPECTED))
        self.assertEqual(check.status, "PASS")
        self.assertIn("repeat=3", check.evidence)
        self.assertIn(self.EXPECTED[:12], check.evidence)

    def test_a_log_of_another_commit_is_a_failure_that_names_both(self) -> None:
        # Everything in it passed, three times - about some other program.
        check = self.judge(self.three_passing_runs(self.OTHER))
        self.assertEqual(check.status, "FAIL")
        self.assertIn(self.OTHER, check.evidence)
        self.assertIn(self.EXPECTED, check.evidence)

    def test_a_log_of_a_dirty_build_is_a_failure(self) -> None:
        # The right commit plus whatever was uncommitted on top of it is not the right commit.
        check = self.judge(self.three_passing_runs(self.EXPECTED + "-dirty"))
        self.assertEqual(check.status, "FAIL")
        self.assertIn(self.EXPECTED + "-dirty", check.evidence)
        self.assertIn("dirty", check.evidence)

    def test_a_log_that_does_not_say_which_build_it_drove_is_a_failure(self) -> None:
        # The shape every log had before the SUBJECT line existed.
        check = self.judge(
            "PASS  j1 something  -> observed  [iteration 1/3]\n"
            "PASS  j1 something  -> observed  [iteration 2/3]\n"
            "PASS  j1 something  -> observed  [iteration 3/3]\n"
            "SUMMARY  passed=3 failed=0 skipped=0  repeat=3  sandbox=C:\\x\n",
        )
        self.assertEqual(check.status, "FAIL")
        self.assertIn("SUBJECT", check.evidence)
        self.assertIn(self.EXPECTED, check.evidence)

    def test_a_binary_with_no_stamp_is_a_failure(self) -> None:
        check = self.judge(self.three_passing_runs("none"))
        self.assertEqual(check.status, "FAIL")
        self.assertIn("no commit stamp", check.evidence)

    def test_a_summary_that_disagrees_with_its_subject_is_a_failure(self) -> None:
        text = self.three_passing_runs(self.EXPECTED).replace(f"stamp={self.EXPECTED}  sandbox", f"stamp={self.OTHER}  sandbox")
        check = self.judge(text)
        self.assertEqual(check.status, "FAIL")
        self.assertIn(self.OTHER, check.evidence)

    def test_one_run_is_not_yet_evidence(self) -> None:
        # A chooser that works once and not twice works by accident, and the log of a single run
        # cannot tell the two apart.
        check = self.judge(
            self.subject(self.EXPECTED)
            + "PASS  j1 something  -> observed  [iteration 1/1]\n"
            + f"SUMMARY  passed=1 failed=0 skipped=0  repeat=1  stamp={self.EXPECTED}  sandbox=C:\\x\n",
        )
        self.assertEqual(check.status, "NOT_VERIFIED")
        self.assertIn("repeat=1", check.evidence)
        self.assertIn("-Repeat 3", check.action)

    def test_a_log_that_stops_before_its_summary_is_a_failure(self) -> None:
        # Everything in it passed, and it says nothing about what came after the cut.
        check = self.judge(self.subject(self.EXPECTED) + "PASS  j1 something  -> observed  [iteration 1/3]\n")
        self.assertEqual(check.status, "FAIL")
        self.assertIn("no SUMMARY", check.evidence)

    def test_a_failed_line_outranks_the_repeat_count(self) -> None:
        check = self.judge(
            self.subject(self.EXPECTED)
            + "PASS  a  -> ok  [iteration 1/3]\n"
            + "FAIL  b  -> broken  [iteration 2/3]\n"
            + f"SUMMARY  passed=1 failed=1 skipped=0  repeat=3  stamp={self.EXPECTED}  sandbox=C:\\x\n",
        )
        self.assertEqual(check.status, "FAIL")

    def test_one_failed_check_in_an_otherwise_complete_log_is_a_failure(self) -> None:
        # Every iteration and every journey section passes and the tally agrees with the lines, so
        # nothing but the FAIL line itself stands between this log and a PASS. The test above ends
        # its log early and would fail for other reasons, so it could not tell whether a FAIL line
        # is read at all.
        good = self.three_passing_runs(self.EXPECTED)
        broken = "FAIL  j2 the folder the person picked was not used  -> another folder  [iteration 2/3]\n"
        text = good.replace(
            "PASS  j2 something  -> observed  [iteration 2/3]\n",
            "PASS  j2 something  -> observed  [iteration 2/3]\n" + broken,
        ).replace("failed=0", "failed=1")
        check = self.judge(text)
        self.assertEqual(check.status, "FAIL")
        self.assertIn("1 failed", check.evidence)
        self.assertIn("another folder", check.evidence)

    def test_a_skip_is_still_not_a_pass_however_many_times_it_ran(self) -> None:
        check = self.judge(
            self.subject(self.EXPECTED)
            + "PASS  a  -> ok  [iteration 1/3]\n"
            + "SKIP  b  -> the chooser never appeared  [iteration 1/3]\n"
            + f"SUMMARY  passed=1 failed=0 skipped=1  repeat=3  stamp={self.EXPECTED}  sandbox=C:\\x\n",
        )
        self.assertEqual(check.status, "NOT_VERIFIED")
        self.assertIn("skipped", check.evidence)


if __name__ == "__main__":
    unittest.main()
