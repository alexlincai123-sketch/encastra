#!/usr/bin/env python3
"""Assemble the harness disc for one Clean VM cycle, after proving which bytes it carries.

    python scripts/cleanvm/make_harness.py --out DIR --cycle A --mode full \\
        --release-dir <gh release download of the tag> [--upgrade-from-setup F --upgrade-from-exe F]

Before anything is copied, the artefact's identity is established from sources that do not depend
on each other, and the disc is refused (exit 1) if any two disagree:

  * the tag resolves to a commit, and that commit is an ancestor of origin/main;
  * docs/RELEASE.md *at that tag* names the installer and the executable with their SHA-256 and the
    build commit, and the local files hash to exactly those values;
  * the GitHub Release's own asset digests (when the version has a Release) and its SHA256SUMS say
    the same;
  * the executable carries `encastra-build-commit=<that commit>` and the build commit is an
    ancestor of the tag.

expected.json then states what the VM must observe, including the one documented difference
between the published and the installed executable (Tauri rewrites `__TAURI_BUNDLE_TYPE_VAR_UNK`
to `..._NSS`, three bytes; docs/RELEASE.md). The guest checks the VM against expected.json; the host
report (report.py) checks the guest's record against expected.json again, independently.

Faults for negative cycles are explicit flags (--inject, --tamper-installer, --omit-installer) and
are written into plan.json, so an acceptance verdict can refuse any cycle that carried one.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent
MARKER_UNK = b"__TAURI_BUNDLE_TYPE_VAR_UNK"
MARKER_NSS = b"__TAURI_BUNDLE_TYPE_VAR_NSS"
VERIFY_SCRIPTS = ["install_check.ps1", "gui_journeys.ps1", "cdp.mjs", "webview2_state.ps1"]
REPO = "alexlincai123-sketch/encastra"

PLANS = {
    "full": ["CLEAN-001", "CLEAN-002", "CLEAN-003", "CLEAN-004", "CLEAN-005", "CLEAN-006", "REBOOT",
             "CLEAN-007", "CLEAN-008", "CLEAN-009", "CLEAN-010", "CLEAN-012", "CLEAN-013", "CONTAMINATION"],
    "upgrade": ["CLEAN-001", "CLEAN-002", "CLEAN-011", "CONTAMINATION"],
}


class Refused(Exception):
    pass


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()


def is_ancestor(a: str, b: str) -> bool:
    return subprocess.run(["git", "merge-base", "--is-ancestor", a, b], cwd=ROOT).returncode == 0


def release_manifest(tag: str) -> dict:
    text = git("show", f"{tag}:docs/RELEASE.md")
    block = text.split("<!-- BUILD:START -->", 1)[1].split("<!-- BUILD:END -->", 1)[0]
    version = re.search(r"\*\*Version ([0-9A-Za-z.\-]+)\*\*", block)
    build = re.search(r"build commit `([0-9a-f]{40})`", block)
    rows = dict(re.findall(r"\|\s*`([^`]+)`\s*\|[^|]*\|[^|]*\|\s*`([0-9a-f]{64})`\s*\|", block))
    if not (version and build and rows):
        raise Refused(f"docs/RELEASE.md at {tag} has no readable BUILD block")
    signed = "not signed" not in block
    return {"version": version.group(1), "build_commit": build.group(1), "hashes": rows, "signed": signed}


def github_digests(tag: str) -> dict[str, str] | None:
    r = subprocess.run(["gh", "release", "view", tag, "-R", REPO, "--json", "assets"], capture_output=True, text=True)
    if r.returncode != 0:
        return None
    return {a["name"]: a["digest"].split(":", 1)[1] for a in json.loads(r.stdout)["assets"]}


def installed_exe_bytes(exe: bytes) -> bytes:
    if exe.count(MARKER_UNK) != 1:
        raise Refused(f"the executable carries the bundle marker {exe.count(MARKER_UNK)} times, not once")
    out = exe.replace(MARKER_UNK, MARKER_NSS)
    diff = sum(1 for x, y in zip(exe, out) if x != y)
    if diff != 3 or len(out) != len(exe):
        raise Refused(f"rewriting the marker changed {diff} bytes, not 3")
    return out


def verify_release(tag: str, setup: pathlib.Path, exe: pathlib.Path, sums: pathlib.Path | None) -> dict:
    evidence: list[str] = []
    tag_commit = git("rev-parse", f"{tag}^{{commit}}")
    evidence.append(f"{tag} -> {tag_commit}")
    main = git("rev-parse", "origin/main")
    if not is_ancestor(tag_commit, main):
        raise Refused(f"{tag} ({tag_commit}) is not an ancestor of origin/main {main}")
    evidence.append(f"{tag_commit[:12]} is an ancestor of origin/main {main[:12]}")
    m = release_manifest(tag)
    for f in (setup, exe):
        want = m["hashes"].get(f.name)
        got = sha256(f)
        if want != got:
            raise Refused(f"{f.name}: docs/RELEASE.md at {tag} says {want}, the file hashes to {got}")
        evidence.append(f"RELEASE.md@{tag}: {f.name} {got}")
    gh = github_digests(tag)
    if gh is not None:
        for f in (setup, exe):
            if gh.get(f.name) != sha256(f):
                raise Refused(f"{f.name}: GitHub Release digest {gh.get(f.name)} != {sha256(f)}")
        evidence.append("GitHub Release asset digests equal")
    else:
        evidence.append(f"no GitHub Release for {tag}: identity rests on docs/RELEASE.md at the tag")
    if sums is not None:
        lines = dict(reversed(l.split()) for l in sums.read_text().splitlines() if l.strip())
        for f in (setup, exe):
            if lines.get(f.name) != sha256(f):
                raise Refused(f"{sums.name} says {lines.get(f.name)} for {f.name}")
        evidence.append(f"{sums.name} agrees")
    data = exe.read_bytes()
    stamp = re.search(rb"encastra-build-commit=([0-9a-f]{40})(-dirty)?;", data)
    if not stamp or stamp.group(2) or stamp.group(1).decode() != m["build_commit"]:
        raise Refused(f"executable stamp {stamp.group(0) if stamp else None!r} != build commit {m['build_commit']}")
    if not is_ancestor(m["build_commit"], tag_commit):
        raise Refused(f"build commit {m['build_commit']} is not an ancestor of {tag_commit}")
    evidence.append(f"executable stamped {m['build_commit'][:12]}, ancestor of the tag")
    installed = installed_exe_bytes(data)
    return {
        "file": setup.name, "sha256": sha256(setup), "version": m["version"], "build_commit": m["build_commit"],
        "exe_sha256": sha256(exe), "installed_exe_sha256": hashlib.sha256(installed).hexdigest(),
        "signature": "Valid" if m["signed"] else "NotSigned", "tag": tag, "tag_commit": tag_commit,
        "github_release": gh is not None, "host_verified": True, "host_evidence": evidence,
    }


def build(args: argparse.Namespace) -> int:
    out = pathlib.Path(args.out)
    if out.exists():
        raise Refused(f"{out} exists; each cycle gets a new disc")
    rel = pathlib.Path(args.release_dir)
    setup = next(rel.glob("Encastra_*_x64-setup.exe"))
    exe = rel / "encastra-desktop.exe"
    sums = rel / "SHA256SUMS"
    cand = verify_release(args.tag, setup, exe, sums)
    cand["sums_file"] = "SHA256SUMS"
    expected = {"installer": cand}
    (out / "artifacts").mkdir(parents=True)
    shutil.copy2(setup, out / "artifacts" / setup.name)
    shutil.copy2(sums, out / "artifacts" / "SHA256SUMS")
    if args.mode == "upgrade":
        a_setup, a_exe = pathlib.Path(args.upgrade_from_setup), pathlib.Path(args.upgrade_from_exe)
        a = verify_release(args.upgrade_from_tag, a_setup, a_exe, None)
        a["sums_file"] = "SHA256SUMS-upgrade-from"
        (out / "artifacts" / a["sums_file"]).write_text(
            f"{a['sha256']}  {a_setup.name}\n{a['exe_sha256']}  {a_exe.name}\n", newline="\n")
        a["host_evidence"].append(f"{a['sums_file']} written by the host from docs/RELEASE.md at {args.upgrade_from_tag}")
        shutil.copy2(a_setup, out / "artifacts" / a_setup.name)
        expected["upgrade_from"] = a
    if args.tamper_installer:
        p = out / "artifacts" / setup.name
        b = bytearray(p.read_bytes()); b[len(b) // 2] ^= 0x01; p.write_bytes(bytes(b))
    if args.omit_installer:
        (out / "artifacts" / setup.name).unlink()
    shutil.copytree(HERE / "guest", out / "guest")
    (out / "verify").mkdir()
    for name in VERIFY_SCRIPTS:
        shutil.copy2(ROOT / "scripts" / "verify" / name, out / "verify" / name)
    (out / "tools" / "node").mkdir(parents=True)
    shutil.copy2(args.node, out / "tools" / "node" / "node.exe")
    steps = args.steps.split(",") if args.steps else PLANS[args.mode]
    plan = {
        "cycle": args.cycle, "mode": args.mode, "steps": steps, "inject": args.inject,
        "tamper_installer": args.tamper_installer, "omit_installer": args.omit_installer,
        "journeys_repeat": args.repeat, "journeys_min_pass_per_iteration": args.min_pass,
        "harness_commit": git("rev-parse", "HEAD"), "harness_dirty": bool(git("status", "--porcelain", "--", "scripts/cleanvm", "scripts/verify")),
    }
    if args.critical is not None:
        plan["critical"] = [c for c in args.critical.split(",") if c]
    (out / "plan.json").write_text(json.dumps(plan, indent=2), newline="\n")
    (out / "expected.json").write_text(json.dumps(expected, indent=2), newline="\n")
    manifest = {str(p.relative_to(out)).replace("\\", "/"): sha256(p) for p in sorted(out.rglob("*")) if p.is_file()}
    (out / "harness-manifest.json").write_text(json.dumps(manifest, indent=2), newline="\n")
    print(json.dumps({"out": str(out), "installer": cand["file"], "sha256": cand["sha256"], "steps": steps, "inject": args.inject}, indent=2))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", required=True)
    ap.add_argument("--cycle", required=True)
    ap.add_argument("--mode", choices=sorted(PLANS), default="full")
    ap.add_argument("--steps", help="comma-separated steps instead of the mode's plan (negative cycles)")
    ap.add_argument("--critical", help="comma-separated critical steps (default: CLEAN-001,002,003)")
    ap.add_argument("--tag", default="v0.5.0-rc.5")
    ap.add_argument("--release-dir", required=True)
    ap.add_argument("--upgrade-from-tag", default="v0.5.0-rc.4")
    ap.add_argument("--upgrade-from-setup")
    ap.add_argument("--upgrade-from-exe")
    ap.add_argument("--node", default=r"C:\Program Files\nodejs\node.exe")
    ap.add_argument("--repeat", type=int, default=3)
    ap.add_argument("--min-pass", type=int, default=100)
    ap.add_argument("--inject", action="append", default=[], choices=["stale", "preinstalled", "stray-process", "wrong-version", "not-ready", "hidden-fail", "persist"])
    ap.add_argument("--tamper-installer", action="store_true")
    ap.add_argument("--omit-installer", action="store_true")
    args = ap.parse_args()
    try:
        return build(args)
    except Refused as e:
        print(f"REFUSED: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
