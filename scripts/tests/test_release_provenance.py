"""The published bytes are a candidate build's bytes, and nothing else can pass for them.

0.5.0-rc.5 moved the root of trust from the machine that writes the manifest to a named run of
`candidate.yml`. These tests are the attacks on that move: a run of another commit or another
workflow, a run that failed, is still going, skipped a job or renamed one, an artefact that was
replaced after it was downloaded, a file copied into target/ by hand, a copy B that differs, a
stale record next to a local rebuild, and — at the other end — a publish of a file that is not
the manifest's, under a tag that is not the manifest's version. Each must be refused, and the
honest case must pass, or the refusals prove nothing.

Run with `python -m unittest discover -s scripts/tests`.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import pathlib
import struct
import subprocess
import sys
import tempfile
import unittest
import zipfile
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
SCRIPTS = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(SCRIPTS / "verify"))
import build_environment  # noqa: E402
import pe_fixture  # noqa: E402
import release_check  # noqa: E402
import release_manifest  # noqa: E402
import release_provenance as prov  # noqa: E402
import release_publish  # noqa: E402
from test_release_manifest import Repo  # noqa: E402

COMMIT = "a" * 40
OTHER = "b" * 40
DIGEST = "sha256:" + "c" * 64
REPO = "o/r"


def good_run(run_id: int = 42, commit: str = COMMIT) -> tuple[dict, list[dict], list[dict]]:
    run = {
        "id": run_id, "path": prov.WORKFLOW_PATH, "head_sha": commit, "status": "completed", "conclusion": "success",
        "event": "workflow_dispatch", "run_attempt": 1, "head_repository": {"full_name": REPO},
        "html_url": f"https://github.com/{REPO}/actions/runs/{run_id}",
    }
    jobs = [{"name": name, "conclusion": "success", "run_attempt": 1} for name in prov.REQUIRED_JOBS]
    artefacts = [
        {"id": i, "name": name, "expired": False, "digest": DIGEST}
        for i, name in enumerate((prov.CANDIDATE_ARTEFACT, prov.REPRODUCTION_ARTEFACT, prov.journeys_artefact(run_id)), 1)
    ]
    return run, jobs, artefacts


class JudgeRunTests(unittest.TestCase):
    def test_the_honest_run_qualifies(self) -> None:
        self.assertEqual(prov.judge_run(*good_run(), COMMIT, REPO), [])

    def test_a_run_of_another_commit_is_refused(self) -> None:
        self.assertTrue(any("built" in p for p in prov.judge_run(*good_run(commit=OTHER), COMMIT)))

    def test_a_run_of_another_workflow_is_refused(self) -> None:
        # The CI workflow, or a copy of candidate.yml under another file name, is not the recipe.
        run, jobs, artefacts = good_run()
        for path in (".github/workflows/ci.yml", ".github/workflows/candidate-copy.yml"):
            run["path"] = path
            self.assertTrue(prov.judge_run(run, jobs, artefacts, COMMIT), path)

    def test_a_run_that_failed_or_is_still_going_is_refused(self) -> None:
        for status, conclusion in (("completed", "failure"), ("in_progress", None), ("completed", "cancelled")):
            run, jobs, artefacts = good_run()
            run["status"], run["conclusion"] = status, conclusion
            self.assertTrue(prov.judge_run(run, jobs, artefacts, COMMIT), (status, conclusion))

    def test_every_job_must_have_run_and_passed(self) -> None:
        for name in prov.REQUIRED_JOBS:
            for broken in ("skipped", "failure", None):
                run, jobs, artefacts = good_run()
                next(j for j in jobs if j["name"] == name)["conclusion"] = broken
                self.assertTrue(prov.judge_run(run, jobs, artefacts, COMMIT), (name, broken))
            run, jobs, artefacts = good_run()
            jobs = [j for j in jobs if j["name"] != name]
            self.assertTrue(prov.judge_run(run, jobs, artefacts, COMMIT), f"{name} missing")

    def test_an_artefact_missing_expired_or_without_a_digest_is_refused(self) -> None:
        for field, value in (("name", "something-else"), ("expired", True), ("digest", None), ("digest", "md5:00")):
            run, jobs, artefacts = good_run()
            artefacts[0][field] = value
            self.assertTrue(prov.judge_run(run, jobs, artefacts, COMMIT), (field, value))

    def test_the_journeys_must_be_this_runs(self) -> None:
        # A journeys artefact named after another run is another run's evidence.
        run, jobs, artefacts = good_run(run_id=42)
        artefacts[2]["name"] = prov.journeys_artefact(41)
        self.assertTrue(prov.judge_run(run, jobs, artefacts, COMMIT))

    def test_a_run_not_dispatched_on_this_repository_or_rerun_is_refused(self) -> None:
        for field, value in (("event", "pull_request"), ("event", "pull_request_target"), ("event", "schedule"), ("run_attempt", 2), ("head_repository", {"full_name": "fork/r"})):
            run, jobs, artefacts = good_run()
            run[field] = value
            self.assertTrue(prov.judge_run(run, jobs, artefacts, COMMIT, REPO), (field, value))

    def test_a_failure_in_an_earlier_attempt_is_not_erased_by_a_rerun(self) -> None:
        run, jobs, artefacts = good_run()
        jobs.append({"name": prov.REQUIRED_JOBS[3], "conclusion": "failure", "run_attempt": 1})
        self.assertTrue(prov.judge_run(run, jobs, artefacts, COMMIT, REPO))

    def test_a_duplicated_artefact_name_is_refused(self) -> None:
        run, jobs, artefacts = good_run()
        artefacts.append(dict(artefacts[0], id=77))
        self.assertTrue(prov.judge_run(run, jobs, artefacts, COMMIT, REPO))


def record(files: dict[str, str], reproduction: dict[str, str] | None = None, commit: str = COMMIT) -> dict:
    return {
        "run_id": 42,
        "head_sha": commit,
        "files": files,
        "reproduction": files if reproduction is None else reproduction,
        "artefacts": {
            prov.CANDIDATE_ARTEFACT: {"id": 1, "digest": DIGEST},
            prov.REPRODUCTION_ARTEFACT: {"id": 2, "digest": DIGEST},
            prov.journeys_artefact(42): {"id": 3, "digest": DIGEST},
        },
    }


class JudgeLocalTests(unittest.TestCase):
    FILES = {"encastra-desktop.exe": "1" * 64, "Encastra_0.5.0-rc.5_x64-setup.exe": "2" * 64}

    def test_the_fetched_files_match(self) -> None:
        self.assertEqual(prov.judge_local(record(self.FILES), dict(self.FILES), COMMIT), [])

    def test_a_file_changed_after_the_fetch_is_refused(self) -> None:
        here = dict(self.FILES, **{"encastra-desktop.exe": "9" * 64})
        self.assertTrue(prov.judge_local(record(self.FILES), here, COMMIT))

    def test_an_extra_or_a_missing_file_is_refused(self) -> None:
        self.assertTrue(prov.judge_local(record(self.FILES), dict(self.FILES, **{"other.exe": "3" * 64}), COMMIT))
        self.assertTrue(prov.judge_local(record(self.FILES), {"encastra-desktop.exe": "1" * 64}, COMMIT))

    def test_a_record_of_another_commit_is_refused(self) -> None:
        self.assertTrue(prov.judge_local(record(self.FILES, commit=OTHER), dict(self.FILES), COMMIT))

    def test_a_record_whose_copy_b_differs_is_refused(self) -> None:
        b = dict(self.FILES, **{"encastra-desktop.exe": "8" * 64})
        self.assertTrue(prov.judge_local(record(self.FILES, reproduction=b), dict(self.FILES), COMMIT))

    def test_an_empty_record_is_refused(self) -> None:
        self.assertTrue(prov.judge_local(record({}), {}, COMMIT))


class ManifestWithProvenanceTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = Repo(pathlib.Path(self._tmp.name))
        self.head = self.repo.git("rev-parse", "HEAD")
        self.repo.build(self.head)
        self.path = self.repo.root / "target/release/candidate-provenance.json"

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def files(self) -> dict[str, str]:
        found = {}
        for path in (self.repo.root / "target/release").rglob("*.exe"):
            found[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        return found

    def write(self, **overrides) -> None:
        data = record(self.files(), commit=self.head)
        data |= {
            "run_url": "https://github.com/o/r/actions/runs/42",
            "created_at": "2026-09-24T10:00:00Z",
            "environment": {
                "runner": {"os": "Windows", "arch": "X64", "image": "win25-vs2026", "image_version": "20260915.1"},
                "toolchain": {"rustc": "rustc 1.98.1", "node": "v24.15.0", "msvc": "14.44.35207"},
                "windows_sdk": {"WindowsSDKVersion": "10.0.26100.0", "advapi32_lib": {"sha256": "e" * 64}},
            },
        }
        data |= overrides
        self.path.write_text(json.dumps(data), "utf-8")

    def test_the_manifest_names_the_run_and_what_it_built_with(self) -> None:
        self.write()
        result = self.repo.manifest("--allow-unsigned")
        self.assertEqual(result.returncode, 0, result.stderr)
        block = self.repo.block()
        self.assertIn("GitHub Actions run [42](https://github.com/o/r/actions/runs/42)", block)
        self.assertIn("built 2026-09-24", block)
        self.assertIn("MSVC 14.44.35207", block)
        self.assertIn("runner image win25-vs2026 20260915.1", block)
        self.assertIn(f"build commit `{self.head}`", block)
        # The block stays readable by --verify and by the release workflow.
        self.repo.commit("release")
        verify = self.repo.manifest("--verify")
        self.assertEqual(verify.returncode, 0, verify.stderr)

    def test_a_stale_record_beside_other_bytes_is_refused(self) -> None:
        self.write()
        # A local rebuild after the fetch: the record now names bytes that are not there.
        (self.repo.root / "target/release/encastra-desktop.exe").write_bytes(
            pe_fixture.build(code=b"\x90\x90\x90\xc3", payload=f"encastra-build-commit={self.head};".encode())
        )
        result = self.repo.manifest("--allow-unsigned")
        self.assertEqual(result.returncode, release_manifest.EXIT_PROVENANCE, result.stdout)
        self.assertIn("candidate-provenance.json does not describe target/", result.stderr)
        self.assertIn("nothing yet", self.repo.block(), "nothing may be written on a refusal")

    def test_a_record_of_another_commit_is_refused(self) -> None:
        self.write(head_sha=OTHER)
        result = self.repo.manifest("--allow-unsigned")
        self.assertEqual(result.returncode, release_manifest.EXIT_PROVENANCE)


class PublishTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        root = pathlib.Path(self._tmp.name)
        self.source = root / "verified"
        (self.source / "target/release/bundle/nsis").mkdir(parents=True)
        self.installer = self.source / "target/release/bundle/nsis/Encastra_0.5.0-rc.5_x64-setup.exe"
        self.binary = self.source / "target/release/encastra-desktop.exe"
        self.installer.write_bytes(b"installer bytes")
        self.binary.write_bytes(b"binary bytes")
        doc = root / "RELEASE.md"
        rows = "\n".join(
            f"| `{p.name}` | 0.0 MB | **not signed** | `{hashlib.sha256(p.read_bytes()).hexdigest()}` |"
            for p in (self.installer, self.binary)
        )
        doc.write_text(
            f"<!-- BUILD:START -->\n\n**Version 0.5.0-rc.5** · built x on y · build commit `{COMMIT}`\n\n"
            f"| Artefact | Size | Signature | SHA-256 |\n|---|---|---|---|\n{rows}\n\n<!-- BUILD:END -->\n",
            "utf-8",
        )
        patcher = mock.patch.object(release_manifest, "RELEASE_DOC", doc)
        patcher.start()
        self.addCleanup(patcher.stop)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_the_verified_files_are_published(self) -> None:
        chosen, problems = release_publish.plan(self.source, "v0.5.0-rc.5")
        self.assertEqual(problems, [])
        self.assertEqual(sorted(p.name for p in chosen), sorted([self.installer.name, self.binary.name]))

    def test_a_file_that_is_not_the_manifests_is_refused(self) -> None:
        self.installer.write_bytes(b"somebody else's installer")
        self.assertTrue(release_publish.plan(self.source, "v0.5.0-rc.5")[1])

    def test_another_tag_is_refused(self) -> None:
        self.assertTrue(release_publish.plan(self.source, "v0.5.0-rc.4")[1])

    def test_an_extra_a_missing_or_a_duplicate_file_is_refused(self) -> None:
        extra = self.source / "old-setup.exe"
        extra.write_bytes(b"old")
        self.assertTrue(release_publish.plan(self.source, "v0.5.0-rc.5")[1])
        extra.unlink()
        dup = self.source / "copy"
        dup.mkdir()
        (dup / self.binary.name).write_bytes(self.binary.read_bytes())
        self.assertTrue(release_publish.plan(self.source, "v0.5.0-rc.5")[1])
        (dup / self.binary.name).unlink()
        self.binary.unlink()
        self.assertTrue(release_publish.plan(self.source, "v0.5.0-rc.5")[1])



def zip_of(files: dict[str, bytes], sums: bool = True) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, data in files.items():
            archive.writestr(name, data)
        if sums:
            lines = [f"{hashlib.sha256(d).hexdigest()}  {n}" for n, d in files.items() if n.endswith(".exe")]
            archive.writestr("SHA256SUMS", "\n".join(lines) + "\n")
    return buffer.getvalue()


class CandidateZipTests(unittest.TestCase):
    """The gate reads the run's bytes out of digest-checked zips; the local record decides nothing."""

    EXE = b"MZ exe encastra-build-commit=" + COMMIT.encode() + b"; __TAURI_BUNDLE_TYPE_VAR_UNK"
    SETUP = b"MZ installer"
    SETUP_NAME = "Encastra_0.5.0-rc.5_x64-setup.exe"

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.staging = pathlib.Path(self._tmp.name) / "candidate"
        self.folder = self.staging / "42"
        self.folder.mkdir(parents=True)
        files = {"encastra-desktop.exe": self.EXE, self.SETUP_NAME: self.SETUP, "build-environment.json": b"{}"}
        self.zips = {
            prov.CANDIDATE_ARTEFACT: zip_of(files),
            prov.REPRODUCTION_ARTEFACT: zip_of(files),
            prov.journeys_artefact(42): zip_of({"gui-journeys.log": b"SUMMARY passed=0"}, sums=False),
        }
        self.write_zips()
        patcher = mock.patch.object(prov, "STAGING", self.staging)
        patcher.start()
        self.addCleanup(patcher.stop)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def write_zips(self) -> None:
        for name, data in self.zips.items():
            (self.folder / f"{name}.zip").write_bytes(data)

    def run_tuple(self):
        run, jobs, artefacts = good_run()
        for artefact in artefacts:
            artefact["digest"] = "sha256:" + hashlib.sha256(self.zips[artefact["name"]]).hexdigest()
        return run, jobs, artefacts

    def verify(self):
        with mock.patch.object(prov, "fetch_run", return_value=self.run_tuple()):
            return prov.verify_candidate(REPO, 42, COMMIT, self.folder, download=False)

    def test_the_honest_zips_are_read(self) -> None:
        verified, problems = self.verify()
        self.assertEqual(problems, [])
        self.assertEqual(verified["files"]["encastra-desktop.exe"], hashlib.sha256(self.EXE).hexdigest())
        self.assertEqual(verified["files"], verified["reproduction"])

    def test_a_zip_replaced_after_the_digest_was_taken_is_refused(self) -> None:
        # Both copies swapped for a consistent pair of other bytes: only the digest can tell.
        run_tuple = self.run_tuple()
        replaced = zip_of({"encastra-desktop.exe": b"MZ other", self.SETUP_NAME: self.SETUP})
        for name in (prov.CANDIDATE_ARTEFACT, prov.REPRODUCTION_ARTEFACT):
            (self.folder / f"{name}.zip").write_bytes(replaced)
        with mock.patch.object(prov, "fetch_run", return_value=run_tuple):
            problems = prov.verify_candidate(REPO, 42, COMMIT, self.folder, download=False)[1]
        self.assertTrue(any("is not the artefact GitHub holds" in p for p in problems), problems)

    def test_a_copy_b_that_differs_is_refused(self) -> None:
        self.zips[prov.REPRODUCTION_ARTEFACT] = zip_of({"encastra-desktop.exe": b"MZ other", self.SETUP_NAME: self.SETUP})
        self.write_zips()
        self.assertTrue(self.verify()[1])

    def test_sums_that_disagree_with_the_files_are_refused(self) -> None:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("encastra-desktop.exe", self.EXE)
            archive.writestr(self.SETUP_NAME, self.SETUP)
            archive.writestr("SHA256SUMS", f"{'0' * 64}  encastra-desktop.exe\n")
        self.zips[prov.CANDIDATE_ARTEFACT] = buffer.getvalue()
        self.write_zips()
        self.assertTrue(self.verify()[1])

    def check(self, entries, record=None):
        with mock.patch.object(prov, "load", return_value=record or {"run_id": 42}), mock.patch.object(
            prov, "repository", return_value=REPO
        ), mock.patch.object(prov, "fetch_run", return_value=self.run_tuple()):
            return release_check.check_provenance(False, entries, COMMIT)

    def entries(self, exe: bytes | None = None):
        return [
            {"name": "encastra-desktop.exe", "sha256": hashlib.sha256(exe or self.EXE).hexdigest()},
            {"name": self.SETUP_NAME, "sha256": hashlib.sha256(self.SETUP).hexdigest()},
        ]

    def test_the_gate_passes_the_honest_candidate(self) -> None:
        check, verified = self.check(self.entries())
        self.assertEqual(check.status, release_check.PASS, check.evidence)
        self.assertIsNotNone(verified)

    def test_a_forged_record_does_not_make_other_bytes_pass(self) -> None:
        # The record claims the laptop's bytes for both copies and names the real run: consistent
        # with itself, and false. The gate must read the zips, not the record.
        laptop = self.entries(exe=b"MZ laptop build")
        forged = {"run_id": 42, "files": {e["name"]: e["sha256"] for e in laptop}}
        forged["reproduction"] = dict(forged["files"])
        check, _ = self.check(laptop, record=forged)
        self.assertEqual(check.status, release_check.FAIL, check.evidence)

    def test_no_record_or_no_network_is_not_a_pass(self) -> None:
        with mock.patch.object(prov, "load", return_value=None):
            self.assertEqual(release_check.check_provenance(False, self.entries(), COMMIT)[0].status, release_check.NOT_VERIFIED)
        with mock.patch.object(prov, "load", return_value={"run_id": 42}):
            self.assertEqual(release_check.check_provenance(True, self.entries(), COMMIT)[0].status, release_check.NOT_VERIFIED)

    def test_reproducibility_comes_from_copy_b_not_from_a_folder_named_on_the_command_line(self) -> None:
        _, verified = self.check(self.entries())
        self.assertEqual(release_check.check_reproducibility(None, self.entries(), verified).status, release_check.PASS)
        other = self.entries(exe=b"MZ laptop build")
        self.assertEqual(release_check.check_reproducibility(None, other, verified).status, release_check.FAIL)

    def test_a_journeys_log_other_than_the_runs_is_refused(self) -> None:
        _, verified = self.check(self.entries())
        stray = self.folder / "stray.log"
        stray.write_bytes(b"SUMMARY passed=349")
        check = release_check.gui_check(stray, verified, COMMIT, self.entries())
        self.assertEqual(check.status, release_check.FAIL)
        self.assertIn("is not the journeys log of candidate run", check.evidence)


class CompareSelfTests(unittest.TestCase):
    def test_a_build_compared_with_itself_proves_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            exe = root / "target/release/encastra-desktop.exe"
            exe.parent.mkdir(parents=True)
            exe.write_bytes(b"MZ")
            entries = [{"name": exe.name, "sha256": hashlib.sha256(b"MZ").hexdigest(), "path": str(exe)}]
            with mock.patch.object(release_check, "ROOT", root):
                for compare in (root, root / "target" / "release"):
                    check = release_check.check_reproducibility(compare, entries)
                    self.assertEqual(check.status, release_check.FAIL, compare)
                    self.assertIn("compared with itself", check.evidence)


class VerifyManifestTests(unittest.TestCase):
    """release.yml, at the tag: the manifest publishes copy A of a qualifying run, or nothing ships."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.doc = pathlib.Path(self._tmp.name) / "RELEASE.md"
        patcher = mock.patch.object(release_manifest, "RELEASE_DOC", self.doc)
        patcher.start()
        self.addCleanup(patcher.stop)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def write(self, where: str, digest: str = "1" * 64) -> None:
        self.doc.write_text(
            f"<!-- BUILD:START -->\n\n**Version 0.5.0-rc.5** · built x on {where} · build commit `{COMMIT}`\n\n"
            "| Artefact | Size | Signature | SHA-256 |\n|---|---|---|---|\n"
            f"| `encastra-desktop.exe` | 1 MB | **not signed** | `{digest}` |\n\n<!-- BUILD:END -->\n",
            "utf-8",
        )

    def verify(self, produced: dict[str, str]):
        with mock.patch.object(prov, "repository", return_value=REPO), mock.patch.object(
            prov, "verify_candidate", return_value=({"files": produced}, [])
        ):
            return prov.verify_manifest()

    def test_a_manifest_built_on_a_laptop_is_refused(self) -> None:
        self.write("Windows AMD64")
        self.assertTrue(self.verify({"encastra-desktop.exe": "1" * 64}))

    def test_a_manifest_naming_a_run_whose_bytes_it_does_not_publish_is_refused(self) -> None:
        self.write("Windows X64 by GitHub Actions run [42](https://x)")
        self.assertTrue(self.verify({"encastra-desktop.exe": "2" * 64}))

    def test_the_honest_manifest_passes(self) -> None:
        self.write("Windows X64 by GitHub Actions run [42](https://x)")
        self.assertEqual(self.verify({"encastra-desktop.exe": "1" * 64}), [])


class ManifestClaimsTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = Repo(pathlib.Path(self._tmp.name))
        self.repo.build(self.repo.git("rev-parse", "HEAD"))

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_a_manifest_without_a_candidate_needs_local_build_said_out_loud(self) -> None:
        result = self.repo.manifest("--allow-unsigned", local_build=False)
        self.assertEqual(result.returncode, release_manifest.EXIT_PROVENANCE)
        self.assertIn("nothing yet", self.repo.block())

    def test_a_hand_edited_signed_claim_over_unsigned_bytes_fails_verify(self) -> None:
        self.assertEqual(self.repo.manifest("--allow-unsigned").returncode, 0)
        doc = self.repo.root / "docs/RELEASE.md"
        doc.write_text(doc.read_text("utf-8").replace("**not signed**", "signed — Encastra Ltd"), "utf-8")
        site = self.repo.root / "apps/web/src/config/site.ts"
        site.write_text(site.read_text("utf-8").replace("signed: false", "signed: true"), "utf-8")
        self.repo.commit("release")
        result = self.repo.manifest("--verify")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Authenticode says", result.stderr)


class ImportHintTests(unittest.TestCase):
    """The reader that names B7's input: hints out of an import library's short import objects."""

    @staticmethod
    def member(name: bytes, body: bytes) -> bytes:
        header = name.ljust(16) + b"0".ljust(12) + b"0".ljust(6) + b"0".ljust(6) + b"644".ljust(8) + str(len(body)).encode().ljust(10) + b"`\n"
        return header + body + (b"\n" if len(body) % 2 else b"")

    def test_hints_are_read_from_short_import_objects(self) -> None:
        def short(name: bytes, hint: int) -> bytes:
            data = name + b"\0ADVAPI32.dll\0"
            return struct.pack("<HHHHIIHH", 0, 0xFFFF, 0, 0x8664, 0, len(data), hint, 0) + data

        archive = b"!<arch>\n" + self.member(b"/", b"\0\0\0\0") + self.member(b"A/", short(b"RevertToSelf", 0x2BB)) + self.member(
            b"B/", short(b"SystemFunction036", 0x31D)
        ) + self.member(b"C/", short(b"Other", 7))
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "AdvAPI32.Lib"
            path.write_bytes(archive)
            self.assertEqual(build_environment.import_hints(path), {"RevertToSelf": 0x2BB, "SystemFunction036": 0x31D})

    def test_the_real_sdk_library_if_this_machine_has_one(self) -> None:
        library = build_environment.advapi32_library() if os.name == "nt" else None
        if library is None:
            self.skipTest("no Windows SDK here")
        hints = build_environment.import_hints(library)
        self.assertEqual(set(hints), set(build_environment.SDK_IMPORTS))


if __name__ == "__main__":
    unittest.main()
