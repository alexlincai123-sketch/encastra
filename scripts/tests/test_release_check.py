"""release_check reaches one verdict from the tree, the artefacts and the history, and writes it down.

The slow gates (tests, dependency audits, the network) are skipped here; what is tested is the
logic that turns the other checks into a mode and a verdict, against a fixture repository with
synthetic artefacts — the same fixture the identity and manifest tests use.
"""

from __future__ import annotations

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
        result = subprocess.run([sys.executable, str(MANIFEST), "--allow-unsigned"], cwd=self.root, capture_output=True, text=True, env=self.env())
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
        self.assertEqual(status_of(report, "signing"), "PASS")
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
        self.assertEqual(status_of(report, "signing"), "FAIL")
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

    def test_a_clean_machine_log_is_evidence_only_when_every_line_passed(self) -> None:
        tree = self.fixture("0.6.0-beta.1")
        tree.binary("0.6.0-beta.1")
        tree.installer("0.6.0-beta.1")
        log = tree.root / "vm.log"
        log.write_text("PASS  a\nPASS  b\n", "utf-8")
        _, report, _ = tree.check("--evidence-vm", str(log))
        self.assertEqual(status_of(report, "clean_vm"), "PASS")
        log.write_text("PASS  a\nFAIL  b -> broken\n", "utf-8")
        _, report, _ = tree.check("--evidence-vm", str(log))
        self.assertEqual(status_of(report, "clean_vm"), "FAIL")

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

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)

    def judge(self, text: str):
        sys.path.insert(0, str(SCRIPT.parent))
        import release_check

        log = pathlib.Path(self._tmp.name) / "gui-journeys.log"
        log.write_text(text, "utf-8")
        return release_check.check_gui_journeys(log)

    def test_three_runs_of_the_suite_all_passing_is_evidence(self) -> None:
        check = self.judge(
            "PASS  j1 something  -> observed  [iteration 1/3]\n"
            "PASS  j1 something  -> observed  [iteration 2/3]\n"
            "PASS  j1 something  -> observed  [iteration 3/3]\n"
            "SUMMARY  passed=3 failed=0 skipped=0  repeat=3  sandbox=C:\\x\n",
        )
        self.assertEqual(check.status, "PASS")
        self.assertIn("repeat=3", check.evidence)

    def test_one_run_is_not_yet_evidence(self) -> None:
        # A chooser that works once and not twice works by accident, and the log of a single run
        # cannot tell the two apart.
        check = self.judge(
            "PASS  j1 something  -> observed  [iteration 1/1]\n"
            "SUMMARY  passed=1 failed=0 skipped=0  repeat=1  sandbox=C:\\x\n",
        )
        self.assertEqual(check.status, "NOT_VERIFIED")
        self.assertIn("repeat=1", check.evidence)
        self.assertIn("-Repeat 3", check.action)

    def test_a_log_that_stops_before_its_summary_is_a_failure(self) -> None:
        # Everything in it passed, and it says nothing about what came after the cut.
        check = self.judge("PASS  j1 something  -> observed  [iteration 1/3]\n")
        self.assertEqual(check.status, "FAIL")
        self.assertIn("no SUMMARY", check.evidence)

    def test_a_failed_line_outranks_the_repeat_count(self) -> None:
        check = self.judge(
            "PASS  a  -> ok  [iteration 1/3]\n"
            "FAIL  b  -> broken  [iteration 2/3]\n"
            "SUMMARY  passed=1 failed=1 skipped=0  repeat=3  sandbox=C:\\x\n",
        )
        self.assertEqual(check.status, "FAIL")

    def test_a_skip_is_still_not_a_pass_however_many_times_it_ran(self) -> None:
        check = self.judge(
            "PASS  a  -> ok  [iteration 1/3]\n"
            "SKIP  b  -> the chooser never appeared  [iteration 1/3]\n"
            "SUMMARY  passed=1 failed=0 skipped=1  repeat=3  sandbox=C:\\x\n",
        )
        self.assertEqual(check.status, "NOT_VERIFIED")
        self.assertIn("skipped", check.evidence)


if __name__ == "__main__":
    unittest.main()
