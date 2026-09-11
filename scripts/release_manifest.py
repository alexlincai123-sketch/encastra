#!/usr/bin/env python3
"""Describes what a build produced, and writes it down.

Run after `npm run tauri:build`. It finds the artefacts, hashes them, and regenerates the
"this build" section of docs/RELEASE.md.

The hashes are the point. An installer nobody can verify is an installer that can be swapped
on the way to somebody, and until releases are signed a published SHA-256 is the only thing a
person has to check against.

Usage:  python scripts/release_manifest.py
"""

from __future__ import annotations

import datetime
import hashlib
import json
import pathlib
import platform
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BUNDLE = ROOT / "target" / "release" / "bundle"
# Cargo names the executable after the crate, not after the product. Guessing "Encastra.exe"
# meant the binary was silently left out of the manifest while the installer still appeared.
BINARY = ROOT / "target" / "release" / "encastra-desktop.exe"
RELEASE_DOC = ROOT / "docs" / "RELEASE.md"

MARKER_START = "<!-- BUILD:START -->"
MARKER_END = "<!-- BUILD:END -->"


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        # Hashed in chunks: an installer is tens of megabytes and there is no reason to hold
        # all of it in memory to produce 32 bytes.
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def human(size: int) -> str:
    megabytes = size / (1024 * 1024)
    return f"{megabytes:.1f} MB"


def version() -> str:
    config = json.loads((ROOT / "apps/desktop/src-tauri/tauri.conf.json").read_text("utf-8"))
    return str(config["version"])


def git_commit() -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        return out.stdout.strip()
    except Exception:
        return "unknown"


def artefacts() -> list[pathlib.Path]:
    """Installers and the executable, in the order a person cares about them."""
    found: list[pathlib.Path] = []
    if BUNDLE.exists():
        for pattern in ("nsis/*.exe", "msi/*.msi", "deb/*.deb", "appimage/*.AppImage", "dmg/*.dmg"):
            found.extend(sorted(BUNDLE.glob(pattern)))
    if BINARY.exists():
        found.append(BINARY)
    return found


def main() -> int:
    files = artefacts()
    if not files:
        print(f"No build artefacts under {BUNDLE}.", file=sys.stderr)
        print("Run `npm run tauri:build` first.", file=sys.stderr)
        return 1

    lines = [
        MARKER_START,
        "",
        f"**Version {version()}** · built {datetime.date.today().isoformat()} on "
        f"{platform.system()} {platform.machine()} · commit `{git_commit()}`",
        "",
        "| Artefact | Size | SHA-256 |",
        "|---|---|---|",
    ]

    for path in files:
        lines.append(
            f"| `{path.name}` | {human(path.stat().st_size)} | `{sha256(path)}` |"
        )

    lines += [
        "",
        "Verify before installing:",
        "",
        "```powershell",
        f"Get-FileHash .\\{files[0].name} -Algorithm SHA256",
        "```",
        "",
        "These builds are **not code-signed**, so Windows SmartScreen will warn about an "
        "unrecognised publisher. That warning is accurate: nothing here proves who built the "
        "file. The hash above is what you have instead, and it is worth checking.",
        "",
        MARKER_END,
    ]

    block = "\n".join(lines)

    if RELEASE_DOC.exists():
        existing = RELEASE_DOC.read_text("utf-8")
        if MARKER_START in existing and MARKER_END in existing:
            updated = re.sub(
                re.escape(MARKER_START) + r".*?" + re.escape(MARKER_END),
                # A function, not the string: as a replacement string, the backslashes in a
                # Windows path are read as escapes, and `.\Encastra...` fails outright.
                lambda _match: block,
                existing,
                flags=re.S,
            )
            RELEASE_DOC.write_text(updated, encoding="utf-8", newline="\n")
            print(f"Updated {RELEASE_DOC.relative_to(ROOT)}")
            for path in files:
                print(f"  {path.relative_to(ROOT)}  {human(path.stat().st_size)}")
            return 0

    print("docs/RELEASE.md has no BUILD markers; printing the block instead:\n")
    print(block)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
