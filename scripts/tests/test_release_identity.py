"""An artefact of another version is refused however correct its name, hash and bytes are."""

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
sys.path.insert(0, str(HERE.parent))
import pe_fixture  # noqa: E402
import release_identity  # noqa: E402

SCRIPT = HERE.parent / "release_identity.py"
GIT = ["git", "-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false"]


def version_resource(version: str) -> bytes:
    """A `ProductVersion` string entry as it sits in VS_VERSIONINFO: key, padding, value, NUL."""
    key = "ProductVersion".encode("utf-16-le") + b"\0\0"
    padded = key + b"\0" * ((-len(key)) % 4)
    return padded + version.encode("utf-16-le") + b"\0\0"


def image(version: str | None, stamp: str | None = None, code: bytes = b"\xc3") -> bytes:
    payload = b""
    if stamp is not None:
        payload += f"encastra-build-commit={stamp};".encode()
    # A decoy: the same key as an ordinary string, followed by something that is not a version,
    # exactly as the real executable has it. The reader must skip it.
    payload += b"\0\0" + "ProductVersion".encode("utf-16-le") + b"\0\0" + b"\0\0" + "junk".encode("utf-16-le") + b"\0\0"
    if version is not None:
        payload += b"\0\0" + version_resource(version)
    return pe_fixture.build(code=code, payload=payload)


class Tree:
    def __init__(self, root: pathlib.Path, version: str) -> None:
        self.root = root
        (root / "apps/desktop/src-tauri").mkdir(parents=True)
        (root / "target/release/bundle/nsis").mkdir(parents=True)
        (root / "apps/desktop/src-tauri/tauri.conf.json").write_text(json.dumps({"version": version}), "utf-8")
        (root / "src.rs").write_text("fn main() {}\n", "utf-8")
        (root / ".gitignore").write_text("target/\n", "utf-8")
        subprocess.run([*GIT, "init", "-q"], cwd=root, check=True)
        subprocess.run([*GIT, "add", "-A"], cwd=root, check=True)
        subprocess.run([*GIT, "commit", "-q", "-m", "source"], cwd=root, check=True)
        self.commit = subprocess.run([*GIT, "rev-parse", "HEAD"], cwd=root, capture_output=True, text=True, check=True).stdout.strip()

    def binary(self, version: str, stamp: str | None = None) -> None:
        (self.root / "target/release/encastra-desktop.exe").write_bytes(image(version, stamp or self.commit))

    def installer(self, version: str, name: str | None = None) -> pathlib.Path:
        path = self.root / "target/release/bundle/nsis" / (name or f"Encastra_{version}_x64-setup.exe")
        path.write_bytes(image(version, None, code=b"\x90\xc3"))
        return path

    def run(self, *flags: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--no-signature", *flags],
            cwd=self.root,
            capture_output=True,
            text=True,
            env={**os.environ, "ENCASTRA_RELEASE_ROOT": str(self.root)},
        )


class IdentityTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tree = Tree(pathlib.Path(self._tmp.name), "0.6.0-beta.1")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_the_reader_finds_the_real_version_and_skips_the_decoy(self) -> None:
        self.assertEqual(release_identity.product_versions(image("0.6.0-beta.1")), ["0.6.0-beta.1"])
        self.assertEqual(release_identity.product_versions(image(None)), [])

    def test_this_release_passes(self) -> None:
        self.tree.binary("0.6.0-beta.1")
        self.tree.installer("0.6.0-beta.1")
        result = self.tree.run("--check", "--json")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        report = json.loads(result.stdout)
        self.assertEqual(report["problems"], [])
        self.assertEqual({e["product_versions"][0] for e in report["artefacts"]}, {"0.6.0-beta.1"})

    def test_an_installer_of_another_version_is_refused_even_under_the_right_name(self) -> None:
        # The ENC-NEW-22 shape, sharpened: the file is *named* for this release and is a valid,
        # complete installer — of the previous release. Name and mtime cannot tell; the resource can.
        self.tree.binary("0.6.0-beta.1")
        self.tree.installer("0.5.0-beta.1", name="Encastra_0.6.0-beta.1_x64-setup.exe")
        result = self.tree.run("--check")
        self.assertEqual(result.returncode, 6, result.stdout)
        self.assertIn("states ProductVersion 0.5.0-beta.1", result.stdout)
        self.assertIn("tree is at 0.6.0-beta.1", result.stdout)

    def test_a_stale_installer_beside_the_right_one_is_refused(self) -> None:
        self.tree.binary("0.6.0-beta.1")
        self.tree.installer("0.6.0-beta.1")
        self.tree.installer("0.5.0-beta.1")
        result = self.tree.run("--check")
        self.assertEqual(result.returncode, 6, result.stdout)
        self.assertIn("Encastra_0.5.0-beta.1_x64-setup.exe", result.stdout)

    def test_a_stale_executable_is_refused(self) -> None:
        self.tree.binary("0.5.0-beta.1")
        self.tree.installer("0.6.0-beta.1")
        result = self.tree.run("--check")
        self.assertEqual(result.returncode, 6, result.stdout)
        self.assertIn("encastra-desktop.exe states ProductVersion 0.5.0-beta.1", result.stdout)

    def test_an_executable_from_another_commit_is_refused(self) -> None:
        self.tree.binary("0.6.0-beta.1", stamp="f" * 40)
        self.tree.installer("0.6.0-beta.1")
        result = self.tree.run("--check")
        self.assertEqual(result.returncode, 6, result.stdout)
        self.assertIn("was built from " + "f" * 40, result.stdout)

    def test_an_artefact_without_a_version_resource_is_refused(self) -> None:
        self.tree.binary("0.6.0-beta.1")
        (self.tree.root / "target/release/bundle/nsis/Encastra_0.6.0-beta.1_x64-setup.exe").write_bytes(image(None, None))
        result = self.tree.run("--check")
        self.assertEqual(result.returncode, 6, result.stdout)
        self.assertIn("carries no ProductVersion resource", result.stdout)

    def test_a_missing_installer_or_binary_is_refused(self) -> None:
        self.tree.binary("0.6.0-beta.1")
        result = self.tree.run("--check")
        self.assertEqual(result.returncode, 6, result.stdout)
        self.assertIn("no installer", result.stdout)
        (self.tree.root / "target/release/encastra-desktop.exe").unlink()
        self.tree.installer("0.6.0-beta.1")
        result = self.tree.run("--check")
        self.assertEqual(result.returncode, 6, result.stdout)
        self.assertIn("is missing", result.stdout)

    def test_the_right_release_still_works_after_the_stale_one_is_removed(self) -> None:
        self.tree.binary("0.6.0-beta.1")
        self.tree.installer("0.6.0-beta.1")
        stale = self.tree.installer("0.5.0-beta.1")
        self.assertEqual(self.tree.run("--check").returncode, 6)
        stale.unlink()
        self.assertEqual(self.tree.run("--check").returncode, 0)


if __name__ == "__main__":
    unittest.main()
