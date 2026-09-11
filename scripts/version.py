#!/usr/bin/env python3
"""One version, written in one place, copied everywhere it has to appear.

`Cargo.toml`'s `[workspace.package] version` is the source of truth. It is the one the binary
itself reports — Settings reads `CARGO_PKG_VERSION` from the build rather than from anything
typed into the interface — so making any other file the source would mean the number a person
sees could disagree with the number that shipped.

The other files are ecosystems that insist on their own copy: npm needs it in each
`package.json`, Tauri needs it in `tauri.conf.json` to name the installer. They cannot be
generated away, so they are synchronised here and a test fails if they ever drift.

Usage:
    python scripts/version.py            # show what each file says
    python scripts/version.py --check    # exit 1 if anything disagrees
    python scripts/version.py --set X    # set the source, then sync
    python scripts/version.py --sync     # copy the source into the rest
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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if anything disagrees")
    parser.add_argument("--sync", action="store_true", help="copy the source into the rest")
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

    if args.check and disagreements:
        print(
            f"\n{disagreements} file(s) disagree with Cargo.toml. "
            "Run `python scripts/version.py --sync`.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
