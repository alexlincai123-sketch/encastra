#!/usr/bin/env python3
"""One version, written in one place, copied everywhere it has to appear.

`Cargo.toml`'s `[workspace.package] version` is the source of truth. It is the one the binary
itself reports — Settings reads `CARGO_PKG_VERSION` from the build rather than from anything
typed into the interface — so making any other file the source would mean the number a person
sees could disagree with the number that shipped.

The other files are ecosystems that insist on their own copy: npm needs it in each
`package.json`, Tauri needs it in `tauri.conf.json` to name the installer. They cannot be
generated away, so they are synchronised here and a test fails if they ever drift.

The two lockfiles are declarations too, not derived files: `Cargo.lock` and `package-lock.json`
each record the workspace members' own versions, and each package manager rewrites them from the
manifests the moment it runs. A lockfile left behind is a file that disagrees with the release
and a build that comes out of a dirty tree, so both are synchronised and checked here.

Usage:
    python scripts/version.py            # show what each file says
    python scripts/version.py --check    # exit 1 if anything disagrees
    python scripts/version.py --set X    # set the source, then sync
    python scripts/version.py --sync     # copy the source into the rest

A package-lock.json declaration that is missing altogether (the top-level `version`,
`packages[""]`, or a workspace's entry) is a disagreement under --check, and --sync reports it
and exits non-zero rather than creating it: npm writes those entries, so `npm install` is the fix.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CARGO = ROOT / "Cargo.toml"

# Every file that has to carry the number, and how to reach it inside that file.
JSON_TARGETS = [
    (ROOT / "package.json", ("version",)),
    (ROOT / "apps/desktop/package.json", ("version",)),
    (ROOT / "apps/web/package.json", ("version",)),
    (ROOT / "packages/protocol/package.json", ("version",)),
    (ROOT / "packages/ui/package.json", ("version",)),
    (ROOT / "apps/desktop/src-tauri/tauri.conf.json", ("version",)),
]

# Declarations that are not JSON. The website carries one because a page needs the version
# at render time and importing a package.json into the bundle is a build-config decision
# nobody should have to make to print a number.
TS_TARGETS = [
    (ROOT / "apps/web/src/config/site.ts", "VERSION"),
]

# The version in [workspace.package], not any dependency's version= that happens to look alike.
WORKSPACE_VERSION = re.compile(
    r"(?P<before>\[workspace\.package\](?:[^\[]*?)\bversion\s*=\s*\")(?P<version>[^\"]+)(?P<after>\")",
    re.S,
)


def source_version() -> str:
    match = WORKSPACE_VERSION.search(CARGO.read_text("utf-8"))
    if not match:
        raise SystemExit("Cargo.toml has no [workspace.package] version")
    return match.group("version")


def set_source(version: str) -> None:
    text = CARGO.read_text("utf-8")
    updated = WORKSPACE_VERSION.sub(
        lambda m: f"{m.group('before')}{version}{m.group('after')}", text, count=1
    )
    CARGO.write_text(updated, encoding="utf-8", newline="\n")


def ts_pattern(name: str) -> re.Pattern[str]:
    """`export const NAME = 'x.y.z'`, with the quotes captured so only the value is replaced."""
    return re.compile(rf"(export\s+const\s+{re.escape(name)}\s*(?::[^=]+)?=\s*['\"])([^'\"]*)(['\"])")


def read_ts(path: pathlib.Path, name: str) -> str | None:
    if not path.exists():
        return None
    match = ts_pattern(name).search(path.read_text("utf-8"))
    return match.group(2) if match else None


def write_ts(path: pathlib.Path, name: str, version: str) -> bool:
    if not path.exists():
        return False
    text = path.read_text("utf-8")
    pattern = ts_pattern(name)
    if not pattern.search(text):
        return False
    updated = pattern.sub(lambda m: f"{m.group(1)}{version}{m.group(3)}", text, count=1)
    if updated != text:
        path.write_text(updated, encoding="utf-8", newline="\n")
        return True
    return False


def read_at(path: pathlib.Path, keys: tuple[str, ...]) -> str | None:
    if not path.exists():
        return None
    data = json.loads(path.read_text("utf-8"))
    for key in keys:
        if not isinstance(data, dict) or key not in data:
            return None
        data = data[key]
    return data if isinstance(data, str) else None


def write_at(path: pathlib.Path, keys: tuple[str, ...], version: str) -> bool:
    """Rewrites only the version line, so nothing else in the file is reformatted."""
    if not path.exists():
        return False
    text = path.read_text("utf-8")
    key = keys[-1]
    pattern = re.compile(rf'("{re.escape(key)}"\s*:\s*")([^"]*)(")')
    if not pattern.search(text):
        return False
    updated = pattern.sub(lambda m: f"{m.group(1)}{version}{m.group(3)}", text, count=1)
    if updated != text:
        path.write_text(updated, encoding="utf-8", newline="\n")
        return True
    return False


LOCK = ROOT / "Cargo.lock"


def lock_members(text: str) -> list[tuple[str, str]]:
    """The workspace crates as Cargo.lock records them: `[[package]]` entries with no `source`."""
    found = []
    for block in text.split("[[package]]")[1:]:
        head = block.split("\n\n", 1)[0]
        name = re.search(r'^name = "([^"]+)"', head, re.M)
        version = re.search(r'^version = "([^"]+)"', head, re.M)
        if name and version and not re.search(r"^source = ", head, re.M):
            found.append((name.group(1), version.group(1)))
    return found


def write_lock(text: str, version: str) -> str:
    """Rewrites the version of every workspace crate in Cargo.lock, nothing else."""
    parts = text.split("[[package]]")
    for index in range(1, len(parts)):
        head, sep, tail = parts[index].partition("\n\n")
        if not re.search(r"^source = ", head, re.M):
            head = re.sub(r'^version = "[^"]+"', f'version = "{version}"', head, count=1, flags=re.M)
        parts[index] = head + sep + tail
    return "[[package]]".join(parts)


NPM_LOCK = ROOT / "package-lock.json"


def workspace_paths(root: pathlib.Path = ROOT) -> list[str]:
    """The workspace directories, resolved the way npm resolves them: the globs in the root
    `package.json`, kept only where a directory with a `package.json` actually exists."""
    manifest = root / "package.json"
    if not manifest.exists():
        return []
    declared = json.loads(manifest.read_text("utf-8")).get("workspaces") or []
    if isinstance(declared, dict):  # the { "packages": [...] } spelling
        declared = declared.get("packages") or []
    found = []
    for pattern in declared:
        for path in sorted(root.glob(pattern)):
            if (path / "package.json").exists():
                relative = path.relative_to(root).as_posix()
                if relative not in found:
                    found.append(relative)
    return found


def npm_lock_versions(text: str, paths: list[str]) -> list[tuple[str, str | None]]:
    """The versions package-lock.json declares for this repo's own packages: its top-level
    `version`, the root entry of the `packages` map, and one entry per workspace directory.

    Every one of those declarations is expected, so every one is returned — with `None` where
    the lockfile does not carry it as a string. Returning only the entries that happened to be
    present made a lockfile with no `packages["apps/desktop"]`, or no `packages` map at all,
    look like one with fewer declarations, all of which agreed; `--check` passed on it.

    Deliberately not the `node_modules/...` entries — npm writes those as links with no version
    of their own — and never a third-party package, whose version is not ours to set.
    """
    data = json.loads(text)
    if not isinstance(data, dict):
        data = {}
    top = data.get("version")
    found: list[tuple[str, str | None]] = [("version", top if isinstance(top, str) else None)]
    packages = data.get("packages")
    for key in ["", *paths]:
        entry = packages.get(key) if isinstance(packages, dict) else None
        declared = entry.get("version") if isinstance(entry, dict) else None
        found.append((f'packages["{key}"]', declared if isinstance(declared, str) else None))
    return found


def write_npm_lock(text: str, version: str, paths: list[str]) -> str:
    """Rewrites those same version fields in place, touching nothing else.

    Textual rather than a re-serialisation: npm's own formatting (two-space JSON, one trailing
    newline) is the formatting a later `npm install` will produce, and reprinting a 137 kB file
    to change five strings is how a lockfile acquires an unrelated diff. An entry's fields are
    the six-space lines under its four-space key, so a replacement cannot leak into the next
    entry, and a value that already matches leaves the text byte-for-byte unchanged.
    """

    def replace(pattern: re.Pattern[str], subject: str) -> str:
        return pattern.sub(lambda m: f"{m.group(1)}{version}{m.group(3)}", subject, count=1)

    updated = replace(re.compile(r'(\n  "version": ")([^"]*)(")'), text)
    for key in ["", *paths]:
        entry = re.compile(
            r'(\n    "' + re.escape(key) + r'": \{\n(?:      [^\n]*\n)*?      "version": ")([^"]*)(")'
        )
        updated = replace(entry, updated)
    return updated


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if anything disagrees")
    parser.add_argument(
        "--sync",
        action="store_true",
        help=(
            "copy the source into the rest; never creates a package-lock.json entry npm did not "
            "write - a missing one is reported and the sync exits non-zero (run `npm install`)"
        ),
    )
    parser.add_argument("--set", metavar="VERSION", help="set the source version, then sync")
    args = parser.parse_args()

    if args.set:
        set_source(args.set)
        args.sync = True

    version = source_version()
    print(f"Cargo.toml [workspace.package]  {version}   (source of truth)")

    disagreements = 0
    for path, keys in JSON_TARGETS:
        found = read_at(path, keys)
        rel = path.relative_to(ROOT).as_posix()
        if found is None:
            print(f"  {rel}: no version field (skipped)")
            continue
        if found == version:
            print(f"  {rel}: {found}")
            continue
        if args.sync:
            write_at(path, keys, version)
            print(f"  {rel}: {found} -> {version}")
        else:
            print(f"  {rel}: {found}   DISAGREES", file=sys.stderr)
            disagreements += 1

    for path, name in TS_TARGETS:
        found = read_ts(path, name)
        rel = path.relative_to(ROOT).as_posix()
        if found is None:
            print(f"  {rel}: no {name} constant (skipped)")
            continue
        if found == version:
            print(f"  {rel} ({name}): {found}")
            continue
        if args.sync:
            write_ts(path, name, version)
            print(f"  {rel} ({name}): {found} -> {version}")
        else:
            print(f"  {rel} ({name}): {found}   DISAGREES", file=sys.stderr)
            disagreements += 1

    # Cargo.lock records the workspace crates' own versions. `cargo build` rewrites them to match
    # Cargo.toml — which made the first build after a bump come out of a dirty tree, stamped
    # `-dirty`, and refused by the manifest. So the lock is part of the bump, and of the check.
    if LOCK.exists():
        lock_text = LOCK.read_text("utf-8")
        stale = [(name, found) for name, found in lock_members(lock_text) if found != version]
        if stale and args.sync:
            LOCK.write_text(write_lock(lock_text, version), encoding="utf-8", newline="\n")
            for name, found in stale:
                print(f"  Cargo.lock ({name}): {found} -> {version}")
        elif stale:
            for name, found in stale:
                print(f"  Cargo.lock ({name}): {found}   DISAGREES", file=sys.stderr)
            disagreements += len(stale)
        else:
            print(f"  Cargo.lock: {len(lock_members(lock_text))} workspace crates at {version}")

    # package-lock.json is the same story on the npm side: it carries a version for the root
    # package and for every workspace package, and `npm install` rewrites them from the
    # package.json files. Left out of the sync, they stayed at 0.5.0-beta.1 through a whole
    # release candidate while --check reported that everything agreed.
    #
    # A declaration the lockfile does not carry at all is a disagreement too, and one the sync
    # will not repair: npm writes those entries, and a lockfile missing one is a lockfile npm did
    # not finish writing. Inventing the entry would hide that, so the sync names it and fails,
    # and `npm install` is what regenerates it.
    missing = 0
    if NPM_LOCK.exists():
        npm_text = NPM_LOCK.read_text("utf-8")
        paths = workspace_paths()
        declared = npm_lock_versions(npm_text, paths)
        absent = [where for where, found in declared if found is None]
        stale = [(where, found) for where, found in declared if found is not None and found != version]
        if absent:
            for where in absent:
                print(f"  package-lock.json ({where}): missing   DISAGREES", file=sys.stderr)
            missing = len(absent)
            disagreements += len(absent) + len(stale)
            for where, found in stale:
                print(f"  package-lock.json ({where}): {found}   DISAGREES", file=sys.stderr)
            print(
                "  package-lock.json lacks declarations npm writes; not rewritten. "
                "Run `npm install` to regenerate it.",
                file=sys.stderr,
            )
        elif stale and args.sync:
            rewritten = write_npm_lock(npm_text, version, paths)
            if rewritten != npm_text:
                NPM_LOCK.write_text(rewritten, encoding="utf-8", newline="\n")
            for where, found in stale:
                print(f"  package-lock.json ({where}): {found} -> {version}")
        elif stale:
            for where, found in stale:
                print(f"  package-lock.json ({where}): {found}   DISAGREES", file=sys.stderr)
            disagreements += len(stale)
        else:
            count = len(npm_lock_versions(npm_text, paths))
            print(f"  package-lock.json: {count} workspace declarations at {version}")

    if args.check and disagreements:
        print(
            f"\n{disagreements} declaration(s) disagree with Cargo.toml or are missing. "
            "Run `python scripts/version.py --sync`, and `npm install` for a missing "
            "package-lock.json entry.",
            file=sys.stderr,
        )
        return 1
    if args.sync and missing:
        print(
            f"\n{missing} package-lock.json declaration(s) are missing and were not created. "
            "Run `npm install`, then this again.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
