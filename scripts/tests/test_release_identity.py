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


class Signature(unittest.TestCase):
    """The probe's silence is not a verdict about the file.

    Run under PowerShell 7, the Authenticode probe inherits a PSModulePath that Windows PowerShell
    cannot load Microsoft.PowerShell.Security from. The cmdlet is then not found, the error goes to
    stderr, the exit code is still 0, and stdout is `||no`. Read as `broken`, that turned an
    unsigned beta artefact into "signature present but not valid — do not distribute; re-sign",
    and the release gate failed a release that was correct.
    """

    def test_an_empty_status_is_unchecked_and_not_broken(self) -> None:
        self.assertEqual(release_identity.classify("||no")["status"], "unchecked")
        self.assertEqual(release_identity.classify("")["status"], "unchecked")

    def test_a_status_that_is_not_valid_or_notsigned_is_still_broken(self) -> None:
        for status in ("HashMismatch", "NotTrusted", "UnknownError"):
            self.assertEqual(release_identity.classify(f"{status}|CN=x|no")["status"], "broken")

    def test_the_two_good_answers_are_read_as_before(self) -> None:
        self.assertEqual(release_identity.classify("NotSigned||no")["status"], "unsigned")
        signed = release_identity.classify("Valid|CN=Someone|yes")
        self.assertEqual(signed["status"], "signed")
        self.assertEqual(signed["signer"], "CN=Someone")
        self.assertTrue(signed["timestamped"])

    def test_the_probe_does_not_hand_the_child_another_engines_module_path(self) -> None:
        if sys.platform != "win32":  # Elsewhere the probe never runs at all.
            self.skipTest("the Authenticode probe only runs on Windows")
        seen: dict[str, str] = {}

        class Recorded:
            stdout = "NotSigned||no"

        def fake_run(_argv, **kwargs):
            seen.update(kwargs.get("env") or {})
            return Recorded()

        real_run, real_path = release_identity.subprocess.run, os.environ.get("PSModulePath")
        release_identity.subprocess.run = fake_run
        os.environ["PSModulePath"] = r"C:\Program Files\PowerShell\Modules"
        try:
            state = release_identity.signature(pathlib.Path("x.exe"))
        finally:
            release_identity.subprocess.run = real_run
            os.environ.pop("PSModulePath", None)
            if real_path is not None:
                os.environ["PSModulePath"] = real_path
        self.assertEqual(state["status"], "unsigned")
        self.assertEqual([name for name in seen if name.upper() == "PSMODULEPATH"], [])


if __name__ == "__main__":
    unittest.main()
