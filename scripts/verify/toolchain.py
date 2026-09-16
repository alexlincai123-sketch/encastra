"""The tools a release is built with, in one place, and a check that a machine has them.

`rustc 1.98.1` is pinned in rust-toolchain.toml and says nothing about the C toolchain underneath
it. rustc does not carry a linker: it finds Visual Studio's and takes whichever toolset that
installation calls its default. That is not a detail — it is what kept 0.5.0-rc.3 from
reproducing across machines. In September 2026 GitHub's `windows-latest` became `win25-vs2026`,
Visual Studio Enterprise 2026, whose default toolset is 14.51.36231; this project's machine has
14.44.35207. Same rustc, same Cargo.lock, 199 KB of code and 3.1 MB of data apart, and the
executables said so themselves: the Rich header — the records the linker writes before the PE
signature, naming the build of every tool that contributed — read 36256 there and 35228 here.

So the C toolset is pinned here, the way the Rust one is pinned in rust-toolchain.toml and Node's
in .nvmrc. This file is what the release workflow asks before it builds, and what a person can run
to find out whether their machine would produce the published bytes.

    python scripts/verify/toolchain.py            # what is expected and what this machine has
    python scripts/verify/toolchain.py --check    # exit 1 unless they agree
    python scripts/verify/toolchain.py --json     # the same, for the release verdict
    python scripts/verify/toolchain.py --msvc     # 14.44.35207, for a workflow to read
    python scripts/verify/toolchain.py --msvc-line  # 14.44, what vcvarsall wants

What it cannot do is tell a machine that has never built anything which linker rustc *would*
choose in some other environment. It reports what this environment resolves to now: the toolset
named by VCToolsVersion when a developer command prompt set it, and otherwise the default the
Visual Studio installation names for itself, which is what rustc reads.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# The MSVC toolset the published bytes are built with. Changing this changes the bytes, so it
# changes the release: bump it deliberately, rebuild, and republish the hashes — never to make a
# machine that happens to have something else go green.
MSVC_TOOLSET = "14.44.35207"

PROGRAM_FILES_X86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
VSWHERE = Path(PROGRAM_FILES_X86) / "Microsoft Visual Studio" / "Installer" / "vswhere.exe"


def expected_node() -> str:
    return (ROOT / ".nvmrc").read_text(encoding="utf-8").strip()


def expected_rustc() -> str:
    data = tomllib.loads((ROOT / "rust-toolchain.toml").read_text(encoding="utf-8"))
    return str(data["toolchain"]["channel"])


def visual_studio() -> Path | None:
    if not VSWHERE.exists():
        return None
    found = subprocess.run(
        [str(VSWHERE), "-latest", "-products", "*", "-property", "installationPath"],
        text=True,
        capture_output=True,
    )
    path = found.stdout.strip()
    return Path(path) if found.returncode == 0 and path else None


def active_msvc() -> tuple[str | None, str]:
    """The toolset this environment would build with, and how that was decided."""
    from_env = os.environ.get("VCToolsVersion", "").strip()
    if from_env:
        return from_env, "VCToolsVersion (a developer command prompt set it)"

    install = visual_studio()
    if install is None:
        return None, "no Visual Studio found by vswhere"

    default = install / "VC" / "Auxiliary" / "Build" / "Microsoft.VCToolsVersion.default.txt"
    if default.exists():
        return default.read_text(encoding="utf-8").strip(), f"the default of {install.name}"

    tools = install / "VC" / "Tools" / "MSVC"
    installed = sorted(p.name for p in tools.iterdir()) if tools.is_dir() else []
    if installed:
        return installed[-1], "the newest installed (no default file)"
    return None, "Visual Studio has no MSVC toolset installed"


def installed_toolsets() -> list[str]:
    install = visual_studio()
    tools = (install / "VC" / "Tools" / "MSVC") if install else None
    if tools is None or not tools.is_dir():
        return []
    return sorted(p.name for p in tools.iterdir() if p.is_dir())


def linker_on_path() -> Path | None:
    """The `link.exe` PATH resolves to, which is not always the one a build uses.

    rustc does not look on PATH: it asks Visual Studio where the linker is, so a developer
    building from Git Bash — where Git's coreutils `link` comes first — still links with MSVC's
    and still produces the published bytes. PATH only decides when something has deliberately set
    up a developer command prompt, which is what the release workflow does so it can choose the
    toolset. So this is reported always and judged only then; see `survey`.
    """
    found = shutil.which("link.exe") or shutil.which("link")
    return Path(found) if found else None


def running_version(exe: Path) -> str:
    try:
        out = subprocess.run([str(exe)], text=True, capture_output=True, timeout=60)
    except (OSError, subprocess.SubprocessError) as exc:
        return f"could not run it ({type(exc).__name__})"
    first = (out.stdout or out.stderr).strip().splitlines()
    return first[0].strip() if first else "said nothing"


def tool_version(command: list[str]) -> str:
    try:
        out = subprocess.run(command, text=True, capture_output=True, timeout=120)
    except (OSError, subprocess.SubprocessError) as exc:
        return f"not available ({type(exc).__name__})"
    return (out.stdout or out.stderr).strip().splitlines()[0] if (out.stdout or out.stderr) else ""


def survey() -> dict:
    active, how = active_msvc()
    linker = linker_on_path()
    node = tool_version(["node", "--version"]).lstrip("v")
    rustc = tool_version(["rustc", "--version"])
    rustc_version = rustc.split()[1] if rustc.startswith("rustc ") else rustc

    problems = []
    if active is None:
        problems.append(f"no MSVC toolset found; this release needs {MSVC_TOOLSET}")
    elif active != MSVC_TOOLSET:
        installed = installed_toolsets()
        has_it = MSVC_TOOLSET in installed
        problems.append(
            f"MSVC {active} is what this environment would use ({how}); the release is built with "
            f"{MSVC_TOOLSET}, which is "
            + (
                "installed — select it with `vcvarsall x64 -vcvars_ver="
                + ".".join(MSVC_TOOLSET.split(".")[:2])
                + "`"
                if has_it
                else "not installed here (installed: " + (", ".join(installed) or "none") + ")"
            )
        )
    # Only judged inside a developer command prompt. Elsewhere rustc ignores PATH and asks Visual
    # Studio, so Git's coreutils `link` coming first is untidy rather than wrong. Inside one, PATH
    # is the whole point: it is how the workflow hands rustc a chosen toolset, and a linker from
    # anywhere else means the selection did not take and the bytes will not match.
    in_developer_prompt = bool(os.environ.get("VCToolsVersion", "").strip())
    if in_developer_prompt and linker is not None and MSVC_TOOLSET not in str(linker):
        problems.append(
            f"this is a developer command prompt for MSVC {active}, but the first link.exe on "
            f"PATH is {linker} — the toolset selection did not take"
        )
    elif in_developer_prompt and linker is None:
        problems.append("this is a developer command prompt, but there is no link.exe on PATH")

    if node and node != expected_node():
        problems.append(f"node {node} against the pinned {expected_node()} (.nvmrc)")
    if rustc_version and rustc_version != expected_rustc():
        problems.append(f"rustc {rustc_version} against the pinned {expected_rustc()}")

    return {
        "expected": {"msvc": MSVC_TOOLSET, "node": expected_node(), "rustc": expected_rustc()},
        "found": {
            "msvc": active,
            "msvc_decided_by": how,
            "msvc_installed": installed_toolsets(),
            "node": node,
            "rustc": rustc_version,
            "linker": str(linker) if linker else None,
            "linker_version": running_version(linker) if linker else None,
        },
        "problems": problems,
        "agrees": not problems,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="The tools a release is built with.")
    parser.add_argument("--check", action="store_true", help="exit 1 unless this machine agrees")
    parser.add_argument("--json", action="store_true", help="print the survey as JSON")
    parser.add_argument("--msvc", action="store_true", help="print the pinned MSVC toolset")
    parser.add_argument("--msvc-line", action="store_true", help="print it as vcvarsall wants it")
    args = parser.parse_args()

    if args.msvc:
        print(MSVC_TOOLSET)
        return 0
    if args.msvc_line:
        print(".".join(MSVC_TOOLSET.split(".")[:2]))
        return 0

    report = survey()
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        expected, found = report["expected"], report["found"]
        print(f"MSVC   expected {expected['msvc']}  found {found['msvc']}  ({found['msvc_decided_by']})")
        print(f"node   expected {expected['node']}  found {found['node'] or '—'}")
        print(f"rustc  expected {expected['rustc']}  found {found['rustc'] or '—'}")
        print(f"linker {found['linker'] or '— none on PATH'}")
        if found["linker_version"]:
            print(f"       {found['linker_version']}")
        for problem in report["problems"]:
            print(f"  ! {problem}")
        if report["agrees"]:
            print("this machine builds with the tools the published bytes were built with")

    if args.check and not report["agrees"]:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
