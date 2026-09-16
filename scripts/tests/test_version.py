"""The npm lockfile's own version fields are declarations, and the tool owns them.

At v0.5.0-rc.3 `package-lock.json` still said `0.5.0-beta.1` for every workspace package and
`version.py --check` reported that everything agreed, because the lockfile was not one of the
files it looked at. npm rewrites those fields from the package manifests the moment it runs, so
a lockfile left behind is both a file that disagrees with the release and a diff waiting to
appear in the next build's tree.
"""

from __future__ import annotations

import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import version  # noqa: E402

SCRIPT = HERE.parent / "version.py"

CARGO = """[workspace]
members = ["crates/core"]

[workspace.package]
version = "VERSION"
edition = "2021"

[workspace.dependencies]
serde = { version = "1.0.0" }
"""


def lockfile(version: str, root: str | None = None, desktop: str | None = None) -> str:
    """A package-lock.json written the way npm writes one: two-space JSON, trailing newline.

    `root` and `desktop` override individual entries so a single stale declaration can be aimed
    at one entry at a time.
    """
    data = {
        "name": "encastra",
        "version": version,
        "lockfileVersion": 3,
        "requires": True,
        "packages": {
            "": {
                "name": "encastra",
                "version": root or version,
                "license": "UNLICENSED",
                "workspaces": ["packages/*", "apps/*", "services/*"],
                "devDependencies": {"typescript": "^7.0.2"},
            },
            "apps/desktop": {"name": "@encastra/desktop", "version": desktop or version, "dependencies": {"react": "^19.3.0"}},
            "node_modules/@encastra/desktop": {"resolved": "apps/desktop", "link": True},
            "node_modules/react": {
                "version": "19.3.0",
                "resolved": "https://registry.npmjs.org/react/-/react-19.3.0.tgz",
                "license": "MIT",
            },
            "packages/protocol": {"name": "@encastra/protocol", "version": version},
        },
    }
    return json.dumps(data, indent=2) + "\n"


class Tree:
    """A repository just complete enough for version.py to run against it."""

    def __init__(self, root: pathlib.Path, version: str, lock: str | None = None) -> None:
        self.root = root
        (root / "scripts").mkdir()
        shutil.copy2(SCRIPT, root / "scripts/version.py")
        (root / "Cargo.toml").write_text(CARGO.replace("VERSION", version, 1), "utf-8")
        (root / "package.json").write_text(
            json.dumps({"name": "encastra", "version": version, "workspaces": ["packages/*", "apps/*", "services/*"]}, indent=2) + "\n",
            "utf-8",
        )
        for path, name in (("apps/desktop", "@encastra/desktop"), ("packages/protocol", "@encastra/protocol")):
            (root / path).mkdir(parents=True)
            (root / path / "package.json").write_text(json.dumps({"name": name, "version": version}, indent=2) + "\n", "utf-8")
        self.lock = root / "package-lock.json"
        self.lock.write_text(lock if lock is not None else lockfile(version), "utf-8", newline="\n")

    def run(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(self.root / "scripts/version.py"), *args],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )

    def entries(self) -> dict[str, str]:
        packages = json.loads(self.lock.read_text("utf-8"))["packages"]
        return {key: entry.get("version") for key, entry in packages.items()}


class NpmLockIsChecked(unittest.TestCase):
    def test_a_stale_workspace_entry_fails_the_check_and_is_named(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tree = Tree(pathlib.Path(directory), "0.5.0-rc.3", lockfile("0.5.0-rc.3", desktop="0.5.0-beta.1"))
            result = tree.run("--check")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        # The file and the entry, not just "something disagrees": the point of the failure is
        # knowing which of the six declarations in that file is the stale one.
        self.assertIn("package-lock.json", result.stderr)
        self.assertIn('packages["apps/desktop"]', result.stderr)
        self.assertIn("0.5.0-beta.1", result.stderr)

    def test_a_stale_root_entry_fails_the_check(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tree = Tree(pathlib.Path(directory), "0.5.0-rc.3", lockfile("0.5.0-rc.3", root="0.5.0-beta.1"))
            result = tree.run("--check")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn('packages[""]', result.stderr)

    def test_a_lockfile_that_agrees_passes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tree = Tree(pathlib.Path(directory), "0.5.0-rc.3")
            result = tree.run("--check")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("package-lock.json: 4 workspace declarations at 0.5.0-rc.3", result.stdout)


class NpmLockIsWritten(unittest.TestCase):
    def test_set_rewrites_exactly_the_workspace_entries(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tree = Tree(pathlib.Path(directory), "0.5.0-rc.3", lockfile("0.5.0-beta.1"))
            result = tree.run("--set", "0.6.0")
            entries = tree.entries()
            data = json.loads(tree.lock.read_text("utf-8"))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(data["version"], "0.6.0")
        self.assertEqual(entries[""], "0.6.0")
        self.assertEqual(entries["apps/desktop"], "0.6.0")
        self.assertEqual(entries["packages/protocol"], "0.6.0")
        # A third party's version is not ours to set, and a link entry has none at all.
        self.assertEqual(entries["node_modules/react"], "19.3.0")
        self.assertIsNone(entries["node_modules/@encastra/desktop"])
        self.assertTrue(data["packages"]["node_modules/@encastra/desktop"]["link"])

    def test_sync_leaves_a_matching_lockfile_byte_for_byte_identical(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tree = Tree(pathlib.Path(directory), "0.5.0-rc.3")
            before = tree.lock.read_bytes()
            result = tree.run("--sync")
            after = tree.lock.read_bytes()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(before, after)

    def test_a_rewrite_keeps_npm_formatting(self) -> None:
        text = lockfile("0.5.0-beta.1")
        rewritten = version.write_npm_lock(text, "0.6.0", ["apps/desktop", "packages/protocol"])
        self.assertTrue(rewritten.endswith("\n"))
        self.assertNotIn("\r", rewritten)
        self.assertIn('\n    "apps/desktop": {\n      "name": "@encastra/desktop",\n      "version": "0.6.0",\n', rewritten)
        # Only the version strings moved; every other line is the one npm wrote.
        changed = [(a, b) for a, b in zip(text.splitlines(), rewritten.splitlines()) if a != b]
        self.assertEqual(len(changed), 4)
        self.assertTrue(all('"version"' in a for a, _ in changed), changed)


class WorkspacesAreResolvedTheWayNpmResolvesThem(unittest.TestCase):
    def test_only_directories_that_exist_and_carry_a_manifest_count(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            Tree(root, "0.5.0-rc.3")
            # `services/*` is declared and matches nothing; a directory without a package.json
            # is not a workspace however well its path fits the glob.
            (root / "packages/notes").mkdir()
            (root / "packages/notes/README.md").write_text("x\n", "utf-8")
            found = version.workspace_paths(root)
        # In the order the globs declare them: `packages/*` is the first pattern.
        self.assertEqual(found, ["packages/protocol", "apps/desktop"])

    def test_the_versions_read_back_are_the_repo_s_own(self) -> None:
        found = version.npm_lock_versions(lockfile("0.5.0-rc.3"), ["apps/desktop", "packages/protocol"])
        self.assertEqual(
            found,
            [
                ("version", "0.5.0-rc.3"),
                ('packages[""]', "0.5.0-rc.3"),
                ('packages["apps/desktop"]', "0.5.0-rc.3"),
                ('packages["packages/protocol"]', "0.5.0-rc.3"),
            ],
        )


if __name__ == "__main__":
    unittest.main()
