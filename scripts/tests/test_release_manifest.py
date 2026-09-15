"""The manifest names the commit that built the bytes, and refuses everything else.

Each test builds a small repository with a synthetic executable carrying a build stamp, runs the
real script against it through ENCASTRA_RELEASE_ROOT, and checks the exit code and what was
written. Run with `python -m unittest discover -s scripts/tests`.
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import pe_fixture  # noqa: E402

SCRIPT = HERE.parent / "release_manifest.py"
SITE_TS = """export const VERSION = '0.5.0-beta.1';
export const RELEASE = {
  installerFilename: 'old.exe',
  installerVersion: '0.4.0-beta.1',
  installerSize: '0.0 MB',
  installerSha256: 'old',
  binaryFilename: 'old.exe',
  binarySize: '0.0 MB',
  binarySha256: 'old',
  builtOn: '2000-01-01',
  builtFor: 'nowhere',
  commit: 'old',
  signed: true,
} as const;
"""
GIT = ["git", "-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false"]


class Repo:
    def __init__(self, root: pathlib.Path, version: str = "0.5.0-beta.1") -> None:
        self.root = root
        (root / "apps/desktop/src-tauri").mkdir(parents=True)
        (root / "docs").mkdir()
        (root / "target/release/bundle/nsis").mkdir(parents=True)
        self.set_version(version)
        (root / "docs/RELEASE.md").write_text(
            "# Release\n\n<!-- BUILD:START -->\nnothing yet\n<!-- BUILD:END -->\n\ntail\n", "utf-8"
        )
        (root / "apps/web/src/config").mkdir(parents=True)
        (root / "apps/web/src/config/site.ts").write_text(SITE_TS, "utf-8")
        (root / "src.rs").write_text("fn main() {}\n", "utf-8")
        (root / ".gitignore").write_text("target/\n", "utf-8")
        self.git("init", "-q")
        self.commit("source")

    def set_version(self, version: str) -> None:
        (self.root / "apps/desktop/src-tauri/tauri.conf.json").write_text(
            json.dumps({"version": version}), "utf-8"
        )

    def git(self, *args: str) -> str:
        return subprocess.run(
            [*GIT, *args], cwd=self.root, capture_output=True, text=True, check=True
        ).stdout.strip()

    def commit(self, message: str) -> str:
        self.git("add", "-A")
        self.git("commit", "-q", "-m", message)
        return self.git("rev-parse", "HEAD")

    def build(self, stamp: str | None) -> None:
        """Puts a binary and an installer in target/ whose binary states the given commit."""
        payload = b"" if stamp is None else f"encastra-build-commit={stamp};".encode()
        (self.root / "target/release/encastra-desktop.exe").write_bytes(pe_fixture.build(payload=payload))
        (self.root / "target/release/bundle/nsis/Encastra_0.5.0-beta.1_x64-setup.exe").write_bytes(
            pe_fixture.build(code=b"\x90\x90\xc3", payload=b"installer" + payload)
        )

    def manifest(self, *flags: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(SCRIPT), *flags],
            cwd=self.root,
            capture_output=True,
            text=True,
            env={**os.environ, "ENCASTRA_RELEASE_ROOT": str(self.root)},
        )

    def block(self) -> str:
        text = (self.root / "docs/RELEASE.md").read_text("utf-8")
        return text[text.index("<!-- BUILD:START -->") : text.index("<!-- BUILD:END -->")]


class ManifestTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = Repo(pathlib.Path(self._tmp.name))
        self.head = self.repo.git("rev-parse", "HEAD")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_the_manifest_names_the_commit_the_binary_states(self) -> None:
        self.repo.build(self.head)
        result = self.repo.manifest("--allow-unsigned")
        self.assertEqual(result.returncode, 0, result.stderr)
        block = self.repo.block()
        self.assertIn(f"build commit `{self.head}`", block)
        self.assertIn("Encastra_0.5.0-beta.1_x64-setup.exe", block)
        self.assertIn("encastra-desktop.exe", block)
        self.assertEqual(len(re.findall(r"`[0-9a-f]{64}`", block)), 2)
        self.assertNotIn("nothing yet", block)
        site = (self.repo.root / "apps/web/src/config/site.ts").read_text("utf-8")
        self.assertIn(f"commit: '{self.head}'", site)
        self.assertIn("installerFilename: 'Encastra_0.5.0-beta.1_x64-setup.exe'", site)
        self.assertIn("installerVersion: '0.5.0-beta.1'", site)
        self.assertIn("signed: false", site)
        installer_hash = re.search(
            r"Encastra_0.5.0-beta.1_x64-setup.exe` \| [^|]+ \| [^|]+ \| `([0-9a-f]{64})`", block
        ).group(1)
        self.assertIn(f"installerSha256: '{installer_hash}'", site)

    def test_an_installer_of_another_version_is_refused(self) -> None:
        # The previous build's installer is still in target/; it must not be published as this one.
        self.repo.build(self.head)
        stale = self.repo.root / "target/release/bundle/nsis/Encastra_0.4.0-beta.1_x64-setup.exe"
        stale.write_bytes(pe_fixture.build(code=b"\x90\xc3", payload=b"old installer"))
        result = self.repo.manifest("--allow-unsigned")
        self.assertEqual(result.returncode, 4, result.stderr)
        self.assertIn("0.4.0-beta.1 installer but the tree is at 0.5.0-beta.1", result.stderr)
        self.assertIn("nothing yet", self.repo.block())
        stale.unlink()
        self.assertEqual(self.repo.manifest("--allow-unsigned").returncode, 0)

    def test_an_installer_without_a_version_in_its_name_is_refused(self) -> None:
        self.repo.build(self.head)
        nameless = self.repo.root / "target/release/bundle/nsis/Encastra_x64-setup.exe"
        nameless.write_bytes(pe_fixture.build(code=b"\x90\xc3", payload=b"nameless"))
        result = self.repo.manifest("--allow-unsigned")
        self.assertEqual(result.returncode, 4, result.stderr)
        self.assertIn("carries no version in its name", result.stderr)
        self.assertIn("nothing yet", self.repo.block())

    def test_an_installer_older_than_the_binary_is_refused(self) -> None:
        # Same name, same version, but written before the executable: a previous build's
        # installer that a rebuild of the binary alone did not replace.
        self.repo.build(self.head)
        binary = self.repo.root / "target/release/encastra-desktop.exe"
        installer = self.repo.root / "target/release/bundle/nsis/Encastra_0.5.0-beta.1_x64-setup.exe"
        earlier = binary.stat().st_mtime - 120
        os.utime(installer, (earlier, earlier))
        result = self.repo.manifest("--allow-unsigned")
        self.assertEqual(result.returncode, 4, result.stderr)
        self.assertIn("is older than encastra-desktop.exe", result.stderr)
        self.assertIn("nothing yet", self.repo.block())

    def test_verify_notices_an_installer_the_manifest_does_not_describe(self) -> None:
        self.repo.build(self.head)
        self.assertEqual(self.repo.manifest("--allow-unsigned").returncode, 0)
        stale = self.repo.root / "target/release/bundle/nsis/Encastra_0.4.0-beta.1_x64-setup.exe"
        stale.write_bytes(pe_fixture.build(code=b"\x90\xc3", payload=b"old installer"))
        result = self.repo.manifest("--verify")
        self.assertEqual(result.returncode, 5, result.stderr)
        self.assertIn("in target/ but not in the manifest", result.stderr)

    def test_build_commit_prints_what_the_manifest_names(self) -> None:
        self.repo.build(self.head)
        self.assertEqual(self.repo.manifest("--allow-unsigned").returncode, 0)
        result = self.repo.manifest("--build-commit")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), self.head)

    def test_verify_notices_the_website_disagreeing(self) -> None:
        self.repo.build(self.head)
        self.assertEqual(self.repo.manifest("--allow-unsigned").returncode, 0)
        site = self.repo.root / "apps/web/src/config/site.ts"
        text = site.read_text("utf-8")
        site.write_text(
            re.sub(r"installerSha256: '[0-9a-f]{64}'", "installerSha256: '" + "1" * 64 + "'", text),
            "utf-8",
        )
        self.repo.commit("publication with a stale site")
        result = self.repo.manifest("--verify")
        self.assertEqual(result.returncode, 5, result.stderr)
        self.assertIn("site.ts installerSha256", result.stderr)

    def test_a_binary_from_another_commit_is_refused(self) -> None:
        # The bug this exists for: the manifest used to name whatever HEAD was when it ran.
        # Now the binary names its commit, and a tree that has moved on cannot describe it.
        self.repo.build(self.head)
        (self.repo.root / "src.rs").write_text("fn main() { moved(); }\n", "utf-8")
        later = self.repo.commit("moved on")
        result = self.repo.manifest("--allow-unsigned")
        self.assertEqual(result.returncode, 4, result.stderr)
        self.assertIn(self.head, result.stderr)
        self.assertIn(later, result.stderr)
        self.assertIn("nothing yet", self.repo.block(), "the document must not be written")

    def test_a_dirty_build_is_refused(self) -> None:
        self.repo.build(f"{self.head}-dirty")
        result = self.repo.manifest("--allow-unsigned")
        self.assertEqual(result.returncode, 4, result.stderr)
        self.assertIn("uncommitted", result.stderr)

    def test_a_build_without_git_is_refused(self) -> None:
        self.repo.build("unknown")
        result = self.repo.manifest("--allow-unsigned")
        self.assertEqual(result.returncode, 4, result.stderr)
        self.assertIn("without git", result.stderr)

    def test_a_binary_with_no_stamp_is_refused(self) -> None:
        self.repo.build(None)
        result = self.repo.manifest("--allow-unsigned")
        self.assertEqual(result.returncode, 4, result.stderr)
        self.assertIn("no build stamp", result.stderr)

    def test_a_production_version_cannot_be_published_unsigned(self) -> None:
        self.repo.set_version("0.5.0")
        self.repo.commit("release version")
        self.repo.build(self.repo.git("rev-parse", "HEAD"))
        result = self.repo.manifest("--allow-unsigned")
        self.assertEqual(result.returncode, 3, result.stderr)
        self.assertIn("not a pre-release", result.stderr)
        self.assertIn("nothing yet", self.repo.block(), "the document must not be written")

    def test_require_signature_refuses_an_unsigned_build(self) -> None:
        self.repo.build(self.head)
        result = self.repo.manifest("--require-signature")
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("not signed", result.stderr)
        self.assertIn("nothing yet", self.repo.block(), "the document must not be written")

    def test_the_two_flags_contradict(self) -> None:
        result = self.repo.manifest("--require-signature", "--allow-unsigned")
        self.assertEqual(result.returncode, 2)

    def test_verify_accepts_a_publication_commit(self) -> None:
        self.repo.build(self.head)
        self.assertEqual(self.repo.manifest("--allow-unsigned").returncode, 0)
        self.repo.commit("publication")
        result = self.repo.manifest("--verify")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(self.head, result.stdout)

    def test_verify_notices_a_source_change_after_the_build(self) -> None:
        self.repo.build(self.head)
        self.assertEqual(self.repo.manifest("--allow-unsigned").returncode, 0)
        self.repo.commit("publication")
        (self.repo.root / "src.rs").write_text("fn main() { changed(); }\n", "utf-8")
        self.repo.commit("a code change under the same version")
        result = self.repo.manifest("--verify")
        self.assertEqual(result.returncode, 5, result.stderr)
        self.assertIn("src.rs", result.stderr)

    def test_verify_accepts_the_written_record_after_the_publication(self) -> None:
        # The readiness report and the audits name the tag; they can only be written after it
        # exists. Markdown under docs/ is not compiled into anything, so the hashes stay true.
        self.repo.build(self.head)
        self.assertEqual(self.repo.manifest("--allow-unsigned").returncode, 0)
        (self.repo.root / "docs/audits").mkdir()
        (self.repo.root / "docs/audits/record.md").write_text("# what was observed\n", "utf-8")
        self.repo.commit("the record of the release")
        result = self.repo.manifest("--verify")
        self.assertEqual(result.returncode, 0, result.stderr)
        # A file that is not Markdown under docs/ is not a record; a script beside the docs is code.
        (self.repo.root / "docs/audits/helper.py").write_text("print(1)\n", "utf-8")
        self.repo.commit("code hiding among the records")
        result = self.repo.manifest("--verify")
        self.assertEqual(result.returncode, 5, result.stderr)
        self.assertIn("docs/audits/helper.py", result.stderr)

    def test_an_unsigned_production_version_is_refused_without_any_flag(self) -> None:
        # The rule is "signed or it does not happen", not "unless nobody passed a flag". The
        # synthetic artefacts carry no signature, and on a non-pre-release version that is enough.
        self.repo.set_version("1.0.0")
        head = self.repo.commit("production")
        self.repo.build(head)
        nsis = self.repo.root / "target/release/bundle/nsis"
        (nsis / "Encastra_0.5.0-beta.1_x64-setup.exe").rename(nsis / "Encastra_1.0.0_x64-setup.exe")
        result = self.repo.manifest()
        self.assertEqual(result.returncode, 3, result.stderr)
        self.assertIn("not a pre-release", result.stderr)
        self.assertIn("nothing yet", self.repo.block(), "the document must not be written")

    def test_verify_notices_a_tampered_hash(self) -> None:
        self.repo.build(self.head)
        self.assertEqual(self.repo.manifest("--allow-unsigned").returncode, 0)
        doc = self.repo.root / "docs/RELEASE.md"
        text = doc.read_text("utf-8")
        digest = re.search(r"`([0-9a-f]{64})`", text).group(1)
        doc.write_text(text.replace(digest, "0" * 64), "utf-8")
        self.repo.commit("publication with a wrong hash")
        result = self.repo.manifest("--verify")
        self.assertEqual(result.returncode, 5, result.stderr)
        self.assertIn("hashes to", result.stderr)

    def test_verify_notices_a_binary_from_another_commit(self) -> None:
        self.repo.build(self.head)
        self.assertEqual(self.repo.manifest("--allow-unsigned").returncode, 0)
        self.repo.commit("publication")
        # Same table, but the binary in target/ was rebuilt from somewhere else.
        self.repo.build("f" * 40)
        result = self.repo.manifest("--verify")
        self.assertEqual(result.returncode, 5, result.stderr)
        self.assertIn("hashes to", result.stderr)
        self.assertIn("states build commit", result.stderr)

    def test_verify_lets_a_bumped_version_move_on(self) -> None:
        self.repo.build(self.head)
        self.assertEqual(self.repo.manifest("--allow-unsigned").returncode, 0)
        self.repo.commit("publication")
        self.repo.set_version("0.6.0-beta.1")
        (self.repo.root / "src.rs").write_text("fn main() { next(); }\n", "utf-8")
        self.repo.commit("next cycle")
        for path in (self.repo.root / "target/release").rglob("*.exe"):
            path.unlink()
        result = self.repo.manifest("--verify")
        self.assertEqual(result.returncode, 5, result.stderr)
        self.assertIn("a new build needs a new manifest", result.stderr)


if __name__ == "__main__":
    unittest.main()
