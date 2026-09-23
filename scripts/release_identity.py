#!/usr/bin/env python3
"""What an artefact says about itself, read from the artefact and from nothing else.

A release is a version, a commit, and the bytes that came from them. `release_manifest.py`
already refuses a binary whose build stamp is not the commit the tree is at (ENC-NEW-17). This
adds the other half of the identity — the **version** — and reads it from where Windows reads
it: the `VS_VERSIONINFO` resource, `ProductVersion`, which Tauri writes into the executable and
into the NSIS installer's stub from `tauri.conf.json` at build time. A file name can be renamed,
a modification time can be touched; the resource is inside the bytes that are hashed.

So an installer or executable is *this release's* only if all of these agree:

    file name          carries the tree's version (installers) or is the crate's binary name
    ProductVersion     equals the tree's version, in every artefact
    build stamp        equals the tree's commit (executable; the installer embeds the executable
                       compressed, so its own stamp is the ProductVersion above plus the hash of
                       the executable the manifest lists beside it)

Anything that fails one of those is not a stale file to skip: it is a wrong artefact in the
release directory, and the release is refused (ENC-NEW-22). Nothing here writes anything.

    python scripts/release_identity.py            # print the identity of what is in target/
    python scripts/release_identity.py --json     # the same, machine-readable
    python scripts/release_identity.py --check    # exit 6 unless everything is this tree's

Exit codes: 0 ok · 6 an artefact is not this release's · 1 nothing to check.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import platform
import re
import subprocess
import sys

ROOT = pathlib.Path(os.environ.get("ENCASTRA_RELEASE_ROOT") or pathlib.Path(__file__).resolve().parent.parent)
TAURI_CONFIG = ROOT / "apps/desktop/src-tauri/tauri.conf.json"
BUNDLE = ROOT / "target" / "release" / "bundle"
BINARY = ROOT / "target" / "release" / "encastra-desktop.exe"

EXIT_OK = 0
EXIT_NOTHING = 1
EXIT_IDENTITY = 6

STAMP = re.compile(rb"encastra-build-commit=([0-9a-f]{40}(?:-dirty)?|unknown);")
SEMVER = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$")
# The key as it sits in a VS_VERSIONINFO String block: UTF-16LE, NUL-terminated.
PRODUCT_VERSION_KEY = "ProductVersion".encode("utf-16-le") + b"\0\0"


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def tree_version() -> str:
    return str(json.loads(TAURI_CONFIG.read_text("utf-8"))["version"])


def head_commit() -> str | None:
    try:
        out = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    return out.stdout.strip()


def product_versions(raw: bytes) -> list[str]:
    """Every `ProductVersion` value in the file's version resource(s), in file order.

    The key can also appear as an ordinary string constant elsewhere in the image (it does, in
    the executable, from the code that writes the resource), so every occurrence is read and
    only those followed by something shaped like a version are kept. The value runs to the
    first UTF-16 NUL.
    """
    found: list[str] = []
    at = raw.find(PRODUCT_VERSION_KEY)
    while at >= 0:
        # The value starts on the next 4-byte boundary; the key is 30 bytes with its NUL, so
        # that is either straight away or after one NUL pair of padding. Skipping the pair by
        # value rather than by arithmetic also reads a block that is not 4-aligned in the file.
        cursor = at + len(PRODUCT_VERSION_KEY)
        if raw[cursor : cursor + 2] == b"\0\0":
            cursor += 2
        value = bytearray()
        while cursor + 1 < len(raw) and raw[cursor : cursor + 2] != b"\0\0":
            value += raw[cursor : cursor + 2]
            cursor += 2
        text = value.decode("utf-16-le", "replace")
        if SEMVER.match(text):
            found.append(text)
        at = raw.find(PRODUCT_VERSION_KEY, at + 1)
    return found


def build_stamp(raw: bytes) -> str | None:
    match = STAMP.search(raw)
    return match.group(1).decode("ascii") if match else None


def signature(path: pathlib.Path) -> dict:
    """Authenticode state, signer and whether a timestamp countersignature is present.

    Only Windows can answer; elsewhere the answer is `unchecked`, which no gate treats as
    signed. The path travels through the environment, not the command string.
    """
    if platform.system() != "Windows":
        return {"status": "unchecked", "signer": None, "timestamped": None}
    command = (
        "$s = Get-AuthenticodeSignature -LiteralPath $env:ENCASTRA_ARTEFACT; "
        '$t = if ($s.TimeStamperCertificate) { "yes" } else { "no" }; '
        'Write-Output "$($s.Status)|$($s.SignerCertificate.Subject)|$t"'
    )
    # Windows PowerShell autoloads Get-AuthenticodeSignature out of Microsoft.PowerShell.Security.
    # A PowerShell 7 parent exports its own PSModulePath; 5.1 inherits it, finds the Core build of
    # that module first, cannot load it, and writes nothing to stdout while still exiting 0. The
    # child gets to work out its own default instead of an engine's that is not its own.
    env = {name: value for name, value in os.environ.items() if name.upper() != "PSMODULEPATH"}
    env["ENCASTRA_ARTEFACT"] = str(path)
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", command],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
            env=env,
        )
    except Exception as error:
        return {"status": "unchecked", "signer": None, "timestamped": None, "error": type(error).__name__}
    return classify(out.stdout)


def classify(stdout: str) -> dict:
    """What the probe's one line of output means.

    `Valid` is signed and `NotSigned` is not. Every other name Authenticode can return —
    HashMismatch, NotTrusted, UnknownError — is a signature that is present and does not verify.
    No name at all is not a verdict: the probe did not answer, and calling that `broken` tells
    somebody to re-sign a file that nothing has looked at.
    """
    status, _, rest = stdout.strip().partition("|")
    signer, _, stamped = rest.partition("|")
    status = status.strip()
    if not status:
        return {"status": "unchecked", "signer": None, "timestamped": None, "raw": ""}
    state = {"Valid": "signed", "NotSigned": "unsigned"}.get(status, "broken")
    return {"status": state, "signer": signer.strip() or None, "timestamped": stamped.strip() == "yes", "raw": status}


def artefacts() -> list[pathlib.Path]:
    found: list[pathlib.Path] = []
    if BUNDLE.exists():
        for pattern in ("nsis/*.exe", "msi/*.msi"):
            found.extend(sorted(BUNDLE.glob(pattern)))
    if BINARY.exists():
        found.append(BINARY)
    return found


def describe(path: pathlib.Path, with_signature: bool = True) -> dict:
    raw = path.read_bytes()
    entry = {
        "name": path.name,
        "path": str(path),
        "size": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "product_versions": product_versions(raw),
        "build_stamp": build_stamp(raw),
    }
    if with_signature:
        entry["signature"] = signature(path)
    return entry


def problems(entries: list[dict], version: str, commit: str | None) -> list[str]:
    """Why these artefacts are not, together, one release of this tree. Empty means they are."""
    out: list[str] = []
    for entry in entries:
        name = entry["name"]
        versions = entry["product_versions"]
        if not versions:
            out.append(f"{name} carries no ProductVersion resource; nothing in the file states which release it is.")
        elif any(v != version for v in versions):
            out.append(
                f"{name} states ProductVersion {', '.join(sorted(set(versions)))} but the tree is at {version}. "
                "It is another release's artefact; delete it from target/ or rebuild."
            )
        is_binary = name == BINARY.name
        if is_binary:
            stamp = entry["build_stamp"]
            if stamp is None:
                out.append(f"{name} carries no build stamp.")
            elif commit is not None and stamp != commit:
                out.append(f"{name} was built from {stamp}; the tree is at {commit}.")
        else:
            if f"_{version}_" not in name:
                out.append(f"{name} does not carry {version} in its name; an installer is named after its version.")
    names = [e["name"] for e in entries]
    if BINARY.name not in names:
        out.append(f"{BINARY.name} is missing; without it nothing states which commit the installer came from.")
    installers = [n for n in names if n != BINARY.name]
    if not installers:
        out.append("no installer under target/release/bundle.")
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--check", action="store_true", help="exit 6 unless every artefact is this tree's")
    parser.add_argument("--no-signature", action="store_true", help="skip the Authenticode query (faster)")
    args = parser.parse_args()

    files = artefacts()
    if not files:
        print(f"nothing under {BUNDLE} or at {BINARY}", file=sys.stderr)
        return EXIT_NOTHING
    version = tree_version()
    commit = head_commit()
    entries = [describe(path, with_signature=not args.no_signature) for path in files]
    found = problems(entries, version, commit)
    report = {"version": version, "commit": commit, "artefacts": entries, "problems": found}

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"tree: {version} @ {commit}")
        for entry in entries:
            sig = entry.get("signature", {})
            print(
                f"  {entry['name']}: {entry['size']} B  sha256 {entry['sha256'][:16]}..  "
                f"ProductVersion {entry['product_versions'] or '-'}  stamp {entry['build_stamp'] or '-'}  "
                f"signature {sig.get('status', 'skipped')}"
            )
        for problem in found:
            print(f"  ! {problem}")
    if args.check and found:
        return EXIT_IDENTITY
    return EXIT_OK


if __name__ == "__main__":
    raise SystemExit(main())
