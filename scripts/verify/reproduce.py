#!/usr/bin/env python3
"""Builds the current commit twice, from two directories, and compares what came out.

"Reproducible" is not a property a build can claim about itself; it is a comparison. This
creates two detached worktrees of HEAD in a scratch location (two different paths on purpose —
a path leaking into the binary is one of the things being tested), runs `npm ci` and
`npm run tauri:build` in each without touching either tree while it builds, and compares the
executable and the installer byte for byte. On a difference, `scripts/pe_diff.py` says which
bytes and in which structure.

    python scripts/verify/reproduce.py                 # two builds under %TEMP%/encastra-reproduce
    python scripts/verify/reproduce.py --keep          # leave the worktrees for inspection
    python scripts/verify/reproduce.py --into D:\\r     # scratch location on another drive

Takes twice a release build (about four minutes each on a laptop). Exit 0 when identical, 1 when
not, 2 when a build failed. The tree must be clean: a dirty tree builds a `-dirty` stamp and is
not a commit anybody can reproduce.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import pathlib
import platform
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = pathlib.Path(__file__).resolve().parents[2]
ARTEFACTS = ("target/release/encastra-desktop.exe", "target/release/bundle/nsis")


def sh(command: list[str], cwd: pathlib.Path, log: pathlib.Path) -> int:
    with log.open("ab") as handle:
        handle.write(f"\n$ {' '.join(command)}\n".encode())
        handle.flush()
        return subprocess.run(
            command, cwd=cwd, stdout=handle, stderr=subprocess.STDOUT, shell=platform.system() == "Windows"
        ).returncode


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def outputs(tree: pathlib.Path) -> dict[str, pathlib.Path]:
    found = {}
    exe = tree / ARTEFACTS[0]
    if exe.exists():
        found[exe.name] = exe
    for installer in sorted((tree / ARTEFACTS[1]).glob("*.exe")) if (tree / ARTEFACTS[1]).exists() else []:
        found[installer.name] = installer
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--into", type=pathlib.Path, default=pathlib.Path(tempfile.gettempdir()) / "encastra-reproduce")
    parser.add_argument("--keep", action="store_true")
    args = parser.parse_args()

    dirty = subprocess.run(["git", "status", "--porcelain", "--untracked-files=no"], cwd=ROOT, capture_output=True, text=True).stdout
    if dirty.strip():
        print("the tree has uncommitted changes; commit first, a dirty build is not reproducible by definition", file=sys.stderr)
        return 2
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()

    args.into.mkdir(parents=True, exist_ok=True)
    trees = [args.into / "a", args.into / "build-b-longer-path-on-purpose"]
    for tree in trees:
        if tree.exists():
            subprocess.run(["git", "worktree", "remove", "--force", str(tree)], cwd=ROOT, capture_output=True)
            shutil.rmtree(tree, ignore_errors=True)
    log = args.into / "reproduce.log"
    log.write_text(f"reproducing {head} from {ROOT}\n", encoding="utf-8")

    hashes: list[dict[str, str]] = []
    for tree in trees:
        started = time.time()
        if subprocess.run(["git", "worktree", "add", "--detach", str(tree), head], cwd=ROOT, capture_output=True).returncode != 0:
            print(f"could not create worktree {tree}", file=sys.stderr)
            return 2
        for command in (["npm", "ci", "--no-audit", "--no-fund"], ["npm", "run", "tauri:build"]):
            if sh(command, tree, log) != 0:
                print(f"{' '.join(command)} failed in {tree}; see {log}", file=sys.stderr)
                return 2
        found = outputs(tree)
        hashes.append({name: sha256(path) for name, path in found.items()})
        print(f"{tree}: built {head[:12]} in {int(time.time() - started)} s")
        for name, digest in hashes[-1].items():
            print(f"  {name}  {digest}")

    a, b = hashes
    names = sorted(set(a) | set(b))
    different = [n for n in names if a.get(n) != b.get(n)]
    if not different:
        print(f"IDENTICAL: {', '.join(names)}")
    else:
        print(f"DIFFERENT: {', '.join(different)}")
        exe = ARTEFACTS[0].split("/")[-1]
        if exe in different:
            subprocess.run([sys.executable, str(ROOT / "scripts" / "pe_diff.py"), str(trees[0] / ARTEFACTS[0]), str(trees[1] / ARTEFACTS[0])])
    if not args.keep:
        for tree in trees:
            subprocess.run(["git", "worktree", "remove", "--force", str(tree)], cwd=ROOT, capture_output=True)
    return 0 if not different else 1


if __name__ == "__main__":
    raise SystemExit(main())
