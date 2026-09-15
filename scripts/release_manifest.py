#!/usr/bin/env python3
"""Describes what a build produced, checks whether it is signed, and writes it down.

Run after `npm run tauri:build`. It finds the artefacts, hashes them, asks Windows whether each
one carries a valid Authenticode signature, and regenerates the "this build" section of
docs/RELEASE.md.

The hashes matter because an installer nobody can verify is an installer that can be swapped on
the way to somebody. But a hash published on the same site that serves the installer proves
nothing against whoever can change both; it is what you have until releases are signed, not a
substitute for signing them.

So this also refuses. `--require-signature` exits non-zero unless every artefact is signed, and
that is what the release workflow passes. Shipping unsigned then becomes a deliberate act with
`--allow-unsigned`, recorded in the manifest, rather than the silent default it was — this script
used to state "not code-signed" as a fact of life and exit 0 either way.

Usage:
    python scripts/release_manifest.py                      # describe, whatever the state
    python scripts/release_manifest.py --require-signature  # fail unless everything is signed
    python scripts/release_manifest.py --allow-unsigned     # deliberate unsigned build
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
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

# What Windows says about a file's signature, mapped to what it means for a release.
SIGNED = "signed"
UNSIGNED = "unsigned"
BROKEN = "broken"
UNCHECKED = "unchecked"


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


def signature(path: pathlib.Path) -> tuple[str, str]:
    """Asks Windows about a file's Authenticode signature.

    Returns the state and a description of who signed it, if anyone.

    Only Windows can answer this, so on any other platform the answer is `UNCHECKED` — which
    `--require-signature` treats as a refusal rather than as a pass. A release job that cannot
    verify a signature has not verified one.

    The path goes through the environment rather than into the command string. It is our own
    build output and not hostile, but a script that interpolates a filesystem path into a shell
    is a habit that eventually meets a path with a quote in it.
    """
    if platform.system() != "Windows":
        return UNCHECKED, "this platform cannot check Authenticode"

    command = (
        "$s = Get-AuthenticodeSignature -LiteralPath $env:ENCASTRA_ARTEFACT; "
        'Write-Output "$($s.Status)|$($s.SignerCertificate.Subject)"'
    )
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", command],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
            env={**os.environ, "ENCASTRA_ARTEFACT": str(path)},
        )
    except Exception as error:
        return UNCHECKED, f"could not be checked ({type(error).__name__})"

    status, _, subject = out.stdout.strip().partition("|")
    subject = subject.strip() or "no certificate"

    if status == "Valid":
        return SIGNED, subject
    if status == "NotSigned":
        return UNSIGNED, "not signed"
    # HashMismatch, NotTrusted, UnknownError: a signature that is present and does not check out
    # is worse news than no signature, and must never be reported as merely unsigned.
    return BROKEN, f"{status} — {subject}"


def artefacts() -> list[pathlib.Path]:
    """Installers and the executable, in the order a person cares about them."""
    found: list[pathlib.Path] = []
    if BUNDLE.exists():
        for pattern in ("nsis/*.exe", "msi/*.msi", "deb/*.deb", "appimage/*.AppImage", "dmg/*.dmg"):
            found.extend(sorted(BUNDLE.glob(pattern)))
    if BINARY.exists():
        found.append(BINARY)
    return found


def describe_signing(states: dict[pathlib.Path, tuple[str, str]], allow_unsigned: bool) -> list[str]:
    """The paragraph under the table, which has to say what is actually true of this build."""
    kinds = {state for state, _ in states.values()}

    if kinds == {SIGNED}:
        signers = sorted({who for state, who in states.values() if state == SIGNED})
        return [
            "These builds are code-signed. Windows will show the publisher below rather than an "
            "unrecognised-publisher warning, and a file that has been altered after signing will "
            "fail its own signature check before it reaches the hash above.",
            "",
            *[f"Signed by: `{signer}`" for signer in signers],
        ]

    if BROKEN in kinds:
        return [
            "**One or more artefacts carry a signature that does not verify.** That is a worse "
            "state than unsigned: something is claiming a publisher it cannot prove. Do not "
            "distribute this build. See the Signature column above.",
        ]

    warning = [
        "These builds are **not code-signed**, so Windows SmartScreen will warn about an "
        "unrecognised publisher. That warning is accurate: nothing here proves who built the "
        "file. The hash above is what you have instead, and it is worth checking — with the "
        "caveat that a hash published beside the download is only as trustworthy as the site "
        "serving both.",
    ]
    if allow_unsigned:
        warning += [
            "",
            "This build was published unsigned deliberately (`--allow-unsigned`). See "
            "docs/SIGNING.md for what is needed to stop doing that.",
        ]
    return warning


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--require-signature",
        action="store_true",
        help="exit non-zero unless every artefact carries a valid signature",
    )
    parser.add_argument(
        "--allow-unsigned",
        action="store_true",
        help="publish unsigned on purpose, and say so in the manifest",
    )
    args = parser.parse_args()

    if args.require_signature and args.allow_unsigned:
        print("--require-signature and --allow-unsigned contradict each other.", file=sys.stderr)
        return 2

    files = artefacts()
    if not files:
        print(f"No build artefacts under {BUNDLE}.", file=sys.stderr)
        print("Run `npm run tauri:build` first.", file=sys.stderr)
        return 1

    states = {path: signature(path) for path in files}

    lines = [
        MARKER_START,
        "",
        f"**Version {version()}** · built {datetime.date.today().isoformat()} on "
        f"{platform.system()} {platform.machine()} · commit `{git_commit()}`",
        "",
        "| Artefact | Size | Signature | SHA-256 |",
        "|---|---|---|---|",
    ]

    for path in files:
        state, detail = states[path]
        shown = {
            SIGNED: f"signed — {detail}",
            UNSIGNED: "**not signed**",
            BROKEN: f"**{detail}**",
            UNCHECKED: f"unchecked — {detail}",
        }[state]
        lines.append(
            f"| `{path.name}` | {human(path.stat().st_size)} | {shown} | `{sha256(path)}` |"
        )

    lines += [
        "",
        "Verify before installing:",
        "",
        "```powershell",
        f"Get-FileHash .\\{files[0].name} -Algorithm SHA256",
        f"Get-AuthenticodeSignature .\\{files[0].name}",
        "```",
        "",
        *describe_signing(states, args.allow_unsigned),
        "",
        MARKER_END,
    ]

    block = "\n".join(lines)

    # The refusal happens before the document is written. A manifest describing a release that
    # is not allowed to happen is a file somebody later mistakes for a release that did.
    unsigned = [path for path, (state, _) in states.items() if state != SIGNED]
    if args.require_signature and unsigned:
        print("Refusing to publish: these artefacts are not signed.", file=sys.stderr)
        for path in unsigned:
            state, detail = states[path]
            print(f"  {path.relative_to(ROOT)}: {state} ({detail})", file=sys.stderr)
        print(
            "\nSee docs/SIGNING.md. To publish unsigned on purpose, pass --allow-unsigned "
            "instead, which records that choice in the manifest.",
            file=sys.stderr,
        )
        return 1

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
                state, detail = states[path]
                print(f"  {path.relative_to(ROOT)}  {human(path.stat().st_size)}  [{state}]")
            return 0

    print("docs/RELEASE.md has no BUILD markers; printing the block instead:\n")
    print(block)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
