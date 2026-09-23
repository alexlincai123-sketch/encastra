#!/usr/bin/env python3
"""What a machine built the release with, written down beside the bytes it built.

B7 ended at two bytes nobody's recipe controlled. `encastra-desktop.exe` imports `RevertToSelf`
(from `clipboard-win`, through `arboard`) and `SystemFunction036` (from `getrandom` 0.2, through
`ring`, `rustls` and `ureq`). Both crates declare them with `#[link(name = "advapi32")]`, so the
linker resolves them through the Windows SDK's import library, `um\\x64\\AdvAPI32.Lib`, and copies
each function's *hint* — where the loader should look first in advapi32's export table — out of
that file into the image. The hint is two bytes. The developer machine's AdvAPI32.Lib says
0x2bb and 0x31d; the hosted runner's says 0x2bd and 0x31f; `/Brepro` then hashes the whole image
into the timestamps and the PDB GUID, and two bytes become seventy. Both machines report Windows
SDK 10.0.26100.0: the difference is inside one SDK version, in its servicing, which `vcvarsall`
cannot select.

So "same SDK version" is not the same input. This records the input itself — the import library's
digest and the two hints it hands the linker — along with the toolchain versions, the runner image
and the commit, so that two builds can be compared by what actually went into them.

    python scripts/verify/build_environment.py                 # print it
    python scripts/verify/build_environment.py --out FILE.json # write it
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import platform
import re
import struct
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]

# The two named imports that reach the image through the SDK's advapi32 import library. See the
# module docstring; `scripts/pe_diff.py` found them and this names where they come from.
SDK_IMPORTS = ("RevertToSelf", "SystemFunction036")


def run(command: list[str]) -> str:
    try:
        out = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=120)
    except Exception as error:  # a missing tool is an answer, not a crash
        return f"unavailable ({type(error).__name__})"
    text = (out.stdout or out.stderr).strip()
    return text.splitlines()[0] if text else f"exit {out.returncode}, no output"


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def import_hints(library: pathlib.Path, names: tuple[str, ...] = SDK_IMPORTS) -> dict[str, int]:
    """The hint of each named import in a COFF import library (its short import objects).

    An archive member that is a short import object starts with IMPORT_OBJECT_HEADER: Sig1 = 0,
    Sig2 = 0xFFFF, then version, machine, time/date stamp, size of data, ordinal-or-hint, type;
    the import name follows as a NUL-terminated string.
    """
    data = library.read_bytes()
    if data[:8] != b"!<arch>\n":
        raise ValueError(f"{library} is not an archive")
    wanted = {name.encode() for name in names}
    found: dict[str, int] = {}
    position = 8
    while position + 60 <= len(data):
        size = int(data[position + 48 : position + 58].strip() or 0)
        body = data[position + 60 : position + 60 + size]
        if len(body) >= 20 and body[:4] == b"\x00\x00\xff\xff":
            hint = struct.unpack_from("<H", body, 16)[0]
            name = body[20:].split(b"\0", 1)[0]
            if name in wanted:
                found[name.decode()] = hint
        position += 60 + size + (size & 1)
    return found


def advapi32_library() -> pathlib.Path | None:
    """The AdvAPI32.Lib the linker would read: the first match on LIB, as link.exe searches it."""
    for directory in filter(None, os.environ.get("LIB", "").split(os.pathsep)):
        for name in ("AdvAPI32.Lib", "advapi32.lib"):
            candidate = pathlib.Path(directory) / name
            if candidate.is_file():
                return candidate
    # Outside a developer command prompt there is no LIB; fall back to the SDK version the
    # environment names, and failing that the newest installed.
    kits = pathlib.Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Windows Kits" / "10" / "Lib"
    version = os.environ.get("WindowsSDKVersion", "").strip("\\")
    candidates = [kits / version] if version else sorted(kits.glob("10.*"), reverse=True)
    for base in candidates:
        library = base / "um" / "x64" / "AdvAPI32.Lib"
        if library.is_file():
            return library
    return None


def linker() -> dict[str, str]:
    path = os.environ.get("CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER", "")
    if not path:
        return {"path": "not set (rustc asks Visual Studio)"}
    banner = run([path])  # link.exe with no arguments prints its version banner first
    return {"path": path, "banner": banner}


def environment() -> dict:
    toolchain = json.loads(
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "verify" / "toolchain.py"), "--json"],
            cwd=ROOT,
            capture_output=True,
            text=True,
        ).stdout
        or "{}"
    ).get("found", {})
    library = advapi32_library() if platform.system() == "Windows" else None
    sdk: dict = {
        "WindowsSDKVersion": os.environ.get("WindowsSDKVersion", "").strip("\\") or None,
        "UCRTVersion": os.environ.get("UCRTVersion") or None,
    }
    if library is not None:
        hints = import_hints(library)
        sdk["advapi32_lib"] = {
            "path": str(library),
            "sha256": sha256(library),
            "hints": {name: f"0x{hint:x}" for name, hint in sorted(hints.items())},
        }
    commit = run(["git", "rev-parse", "HEAD"])
    return {
        "commit": commit if re.fullmatch(r"[0-9a-f]{40}", commit) else None,
        "runner": {
            "os": os.environ.get("RUNNER_OS") or platform.system(),
            "arch": os.environ.get("RUNNER_ARCH") or platform.machine(),
            "image": os.environ.get("ImageOS"),
            "image_version": os.environ.get("ImageVersion"),
            "github_run_id": os.environ.get("GITHUB_RUN_ID"),
            "github_workflow_ref": os.environ.get("GITHUB_WORKFLOW_REF"),
            "platform": platform.platform(),
        },
        "toolchain": {
            "msvc": toolchain.get("msvc") or os.environ.get("VCToolsVersion"),
            "rustc": run(["rustc", "--version"]),
            "cargo": run(["cargo", "--version"]),
            "node": run(["node", "--version"]),
            "npm": run(["npm", "--version"] if platform.system() != "Windows" else ["cmd", "/c", "npm", "--version"]),
            "python": platform.python_version(),
            "pwsh": run(["pwsh", "-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"]),
            "linker": linker(),
        },
        "windows_sdk": sdk,
        "rustflags": os.environ.get("RUSTFLAGS"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=pathlib.Path)
    parser.add_argument("--hints", type=pathlib.Path, help="print the SDK import hints of one import library")
    args = parser.parse_args()
    if args.hints:
        print(json.dumps({k: f"0x{v:x}" for k, v in import_hints(args.hints).items()}))
        return 0
    report = json.dumps(environment(), indent=2) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(report, encoding="utf-8", newline="\n")
    print(report, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
