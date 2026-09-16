"""Package the same build twice and require the two installers to be the same bytes.

Why this exists
---------------

`docs/RELEASE.md` says two builds of the build commit produce the artefacts it names. For the
executable that is `/Brepro` and can be checked by building twice. For the installer it was taken
on trust, and the trust was misplaced: 0.5.0-rc.3's release workflow built the same commit twice
on the same hosted runner, wrapped a byte-identical executable both times, and produced two
different installers.

The cause was not the executable and not the compiler. NSIS stores each packaged file's
last-write time, and `SetDateSave off` — which turns that off — was only in effect from the top of
the Install section, because that is where Tauri inserts NSIS_HOOK_PREINSTALL. Two files are
packaged before that point: the MUI welcome bitmap, once for the installer's welcome page and
once for the uninstaller's, taken from the NSIS installation Tauri downloads into
%LOCALAPPDATA%\\tauri\\NSIS. On a developer machine that download happened once and its date never
moves again, so repeated builds agreed. A hosted runner downloads NSIS again for every job, so the
date is the time of the job, and no two jobs agree.

Reading it out of the rc.3 installers: 159 of 161 extractions carried no date, and the two that
did were that bitmap — 2026-09-11T01:01:18Z on the developer machine against 15:29:08Z and
15:51:48Z in the runner's two runs of the same commit.

What this checks
----------------

Packaging is repeated on an already-built tree — no recompile, about half a minute — and the
second installer must equal the first byte for byte.

That alone would be a weak test. The thing that varies is a file date, and on the machine where
the bug was invisible the dates do not move, so a plain repeat would have passed while the defect
was live. So between the two packagings every file in Tauri's NSIS installation is re-stamped,
which is what a runner does to itself by downloading NSIS again. With the fix removed this test
fails; with it in place it passes. Only modification times are touched, and nothing reads them
except NSIS.

Tauri patches the built executable in place while packaging (it writes which kind of package the
binary came from), so the executable's hash is taken after the first packaging and required not
to move during the second: a changing executable would make the installer comparison meaningless.

Exit codes: 0 identical · 1 the installers differ · 2 packaging failed or the tree is not built.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "target" / "release"
BINARY = TARGET / "encastra-desktop.exe"
BUNDLE = TARGET / "bundle" / "nsis"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def nsis_home() -> Path | None:
    """Where Tauri keeps the NSIS installation it downloads."""
    local = os.environ.get("LOCALAPPDATA")
    if not local:
        return None
    home = Path(local) / "tauri" / "NSIS"
    return home if home.is_dir() else None


def restamp(home: Path) -> int:
    """Give every file in the NSIS installation a current modification time."""
    now = time.time()
    touched = 0
    for path in home.rglob("*"):
        if path.is_file():
            os.utime(path, (now, now))
            touched += 1
    return touched


def installer() -> Path:
    found = sorted(BUNDLE.glob("*-setup.exe"))
    if len(found) != 1:
        raise SystemExit(f"expected exactly one installer in {BUNDLE}, found {len(found)}")
    return found[0]


def package(step: str) -> None:
    tauri = ROOT / "node_modules" / ".bin" / ("tauri.cmd" if os.name == "nt" else "tauri")
    if not tauri.exists():
        raise SystemExit(f"{step}: {tauri} is missing — run npm ci first")
    result = subprocess.run(
        [str(tauri), "bundle"],
        cwd=ROOT / "apps" / "desktop",
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stdout[-4000:] + result.stderr[-4000:])
        raise SystemExit(f"{step}: tauri bundle failed with {result.returncode}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--no-restamp",
        action="store_true",
        help="do not re-stamp the NSIS installation between the two packagings. The test still "
        "runs, but on a machine whose NSIS download never moves it can pass without exercising "
        "anything — use only when investigating.",
    )
    args = parser.parse_args()

    if not BINARY.exists():
        print(f"no build to package: {BINARY} is missing", file=sys.stderr)
        return 2

    package("first packaging")
    first = installer()
    first_bytes = first.read_bytes()
    binary_hash = sha256(BINARY)
    print(f"first  {first.name}  {hashlib.sha256(first_bytes).hexdigest()}  {len(first_bytes)} B")

    home = nsis_home()
    if args.no_restamp:
        print("not re-stamping the NSIS installation (asked not to)")
    elif home is None:
        print("NOTE: Tauri's NSIS installation was not found; the dates it packages were not moved,")
        print("      so this run does not prove the property it is here to prove.")
    else:
        print(f"re-stamped {restamp(home)} files under {home}")

    # Keep the first installer: the second packaging writes over it.
    keep = first.with_suffix(".first.exe")
    shutil.copy2(first, keep)

    package("second packaging")
    second = installer()
    second_bytes = second.read_bytes()
    print(f"second {second.name}  {hashlib.sha256(second_bytes).hexdigest()}  {len(second_bytes)} B")

    after = sha256(BINARY)

    # Whatever the verdict, leave the first installer where the build left it: the steps after
    # this one compare the artefact against the published hashes, and they must see the build's
    # own output rather than this check's second packaging of it.
    shutil.move(str(keep), str(second))

    if after != binary_hash:
        print(
            f"the executable changed between packagings ({binary_hash[:16]} -> {after[:16]}), so "
            "the two installers do not describe the same build",
            file=sys.stderr,
        )
        return 1

    if first_bytes != second_bytes:
        at = next(
            (i for i, (a, b) in enumerate(zip(first_bytes, second_bytes)) if a != b),
            min(len(first_bytes), len(second_bytes)),
        )
        print(
            f"the installer is not a function of its inputs: two packagings of one build differ, "
            f"first at byte {at} ({at:#x})",
            file=sys.stderr,
        )
        return 1

    print("the installer is the same bytes both times, across a re-stamp of everything NSIS packages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
