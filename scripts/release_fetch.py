#!/usr/bin/env python3
"""Put a candidate build's bytes into target/, having checked they are that build's bytes.

    python scripts/release_fetch.py --run <id of a Candidate build run on this commit>

Refuses unless (release_provenance.verify_candidate): the tree is clean; the run is
`candidate.yml`, dispatched on exactly this commit of this repository, first attempt, completed
and green, with every job present and green in every attempt; each artefact zip hashes to the
digest GitHub holds for it; each copy's SHA256SUMS matches its files; copy B is byte-identical to
copy A; and the executable states this commit as its build commit.

Only then does it replace target/release/encastra-desktop.exe and the NSIS installer with copy A.
The zips stay under target/candidate/<run>/, where release_check.py reads them again — it trusts
neither this script nor the record it writes (target/release/candidate-provenance.json), which
only names the run.

Exit codes: 0 ok · 1 refused · 2 usage.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import release_manifest  # noqa: E402
import release_provenance as prov  # noqa: E402

ROOT = prov.ROOT


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()


def refuse(message: str) -> int:
    print(f"refused: {message}", file=sys.stderr)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--run", required=True, help="the Candidate build run id")
    args = parser.parse_args()
    if not args.run.isdigit():
        print("--run takes the numeric run id", file=sys.stderr)
        return 2

    if git("status", "--porcelain", "--untracked-files=no"):
        return refuse("the tree has uncommitted changes; a candidate is fetched onto the commit it was built from")
    head = git("rev-parse", "HEAD")
    repo = prov.repository()
    if repo is None:
        return refuse("origin is not a GitHub repository")

    staging = prov.STAGING / args.run
    if staging.exists():
        shutil.rmtree(staging)
    try:
        verified, problems = prov.verify_candidate(repo, args.run, head, staging, download=True)
    except (RuntimeError, OSError, subprocess.TimeoutExpired) as error:
        return refuse(str(error))
    if problems:
        for problem in problems:
            print(f"refused: {problem}", file=sys.stderr)
        return 1

    blob_a = verified["blobs"][prov.CANDIDATE_ARTEFACT]
    exe = prov.zip_member(blob_a, prov.BINARY) or b""
    stamp = release_manifest.STAMP.search(exe)
    if stamp is None or stamp.group(1).decode() != head:
        return refuse(f"the candidate executable states build commit {stamp.group(1).decode() if stamp else None!r}; this tree is {head}")

    # Replace this machine's build outputs with copy A. The executable first and the installer
    # after it: release_manifest refuses an installer older than the binary.
    release = ROOT / "target" / "release"
    nsis = release / "bundle" / "nsis"
    nsis.mkdir(parents=True, exist_ok=True)
    for old in nsis.glob("*.exe"):
        old.unlink()
    (release / prov.BINARY).write_bytes(exe)
    for name in verified["files"]:
        if name.endswith("-setup.exe"):
            (nsis / name).write_bytes(prov.zip_member(blob_a, name) or b"")

    run = verified["run"]
    record = {
        "run_id": run["id"],
        "run_url": run.get("html_url"),
        "head_sha": run.get("head_sha"),
        "created_at": run.get("created_at"),
        "artefacts": verified["artefacts"],
        "files": verified["files"],
        "reproduction": verified["reproduction"],
        "environment": verified["environment"],
    }
    prov.PROVENANCE.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8", newline="\n")

    env = verified["environment"]
    print(f"candidate run {run['id']} ({run.get('html_url')}) on {head}")
    for name, digest in sorted(verified["files"].items()):
        print(f"  {name}  {digest}  (copy B identical)")
    print(f"environment: {env.get('runner', {}).get('image')} {env.get('runner', {}).get('image_version')}, "
          f"MSVC {env.get('toolchain', {}).get('msvc')}, SDK {env.get('windows_sdk', {}).get('WindowsSDKVersion')}, "
          f"AdvAPI32 hints {env.get('windows_sdk', {}).get('advapi32_lib', {}).get('hints')}")
    print("\nnext:")
    print("  python scripts/release_manifest.py --allow-unsigned")
    print('  git commit -m "release: <version>" docs/RELEASE.md apps/web/src/config/site.ts')
    print("  python scripts/release_check.py        # reads copy B and the journeys log from the verified zips")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
