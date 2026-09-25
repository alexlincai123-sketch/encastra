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
import tempfile

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


def verify_candidate_build(ref: str, setup: pathlib.Path, exe: pathlib.Path, sums: pathlib.Path) -> dict:
    """A candidate before its tag: the publication commit, pushed, and the candidate run it names.

    A tag is immutable, so the Clean VM acceptance runs BEFORE it, on the bytes the tag will
    publish. Nothing about the identity is weaker than for a tag - it only comes from a different
    pair of independent sources:

      * the ref resolves to a commit that is on the remote (a pushed branch contains it), and
        docs/RELEASE.md at that commit names the installer and the executable, their SHA-256, the
        build commit and the candidate run; the local files hash to exactly those values;
      * GitHub is asked about that run again (release_provenance.verify_candidate): candidate.yml,
        on the build commit, green in every job, each artefact zip equal to the digest GitHub holds,
        copy B byte-identical to copy A - and copy A's files are these files;
      * the SHA256SUMS the run wrote agrees, and the executable is stamped with the build commit,
        an ancestor of the ref.

    release.yml publishes only bytes equal to the manifest, so these are the bytes a release of this
    ref ships. The acceptance is bound to them by hash (release_check.py --evidence-vm), not by tag.
    """
    sys.path.insert(0, str(ROOT / "scripts"))
    import release_provenance as prov  # noqa: E402 - the release gate's own verification

    evidence: list[str] = []
    ref_commit = git("rev-parse", f"{ref}^{{commit}}")
    remote = [b.strip() for b in git("branch", "-r", "--contains", ref_commit).splitlines() if b.strip()]
    if not remote:
        raise Refused(f"{ref} ({ref_commit}) is on no remote branch; push the publication commit first")
    evidence.append(f"{ref} -> {ref_commit}, on {', '.join(remote)}")
    m = release_manifest(ref)
    text = git("show", f"{ref_commit}:docs/RELEASE.md")
    run = prov.RUN_IN_MANIFEST.search(text)
    if not run:
        raise Refused(f"docs/RELEASE.md at {ref} names no candidate run")
    for f in (setup, exe):
        want, got = m["hashes"].get(f.name), sha256(f)
        if want != got:
            raise Refused(f"{f.name}: docs/RELEASE.md at {ref} says {want}, the file hashes to {got}")
        evidence.append(f"RELEASE.md@{ref_commit[:12]}: {f.name} {got}")
    repo = prov.repository()
    if repo is None:
        raise Refused("origin is not a GitHub repository")
    with tempfile.TemporaryDirectory() as staging:
        verified, problems = prov.verify_candidate(repo, run.group(1), m["build_commit"], pathlib.Path(staging), download=True)
    if problems:
        raise Refused(f"candidate run {run.group(1)}: {problems[0]}")
    for f in (setup, exe):
        if verified["files"].get(f.name) != sha256(f):
            raise Refused(f"{f.name}: candidate run {run.group(1)} copy A holds {verified['files'].get(f.name)}, the file is {sha256(f)}")
    evidence.append(f"candidate run {run.group(1)}: candidate.yml on {m['build_commit'][:12]}, green, zips = GitHub digests, copy B identical, copy A = these files")
    lines = dict(reversed(l.split()) for l in sums.read_text().splitlines() if l.strip())
    for f in (setup, exe):
        if lines.get(f.name) != sha256(f):
            raise Refused(f"{sums.name} says {lines.get(f.name)} for {f.name}")
    evidence.append(f"{sums.name} (written by the run) agrees")
    data = exe.read_bytes()
    stamp = re.search(rb"encastra-build-commit=([0-9a-f]{40})(-dirty)?;", data)
    if not stamp or stamp.group(2) or stamp.group(1).decode() != m["build_commit"]:
        raise Refused(f"executable stamp {stamp.group(0) if stamp else None!r} != build commit {m['build_commit']}")
    if not is_ancestor(m["build_commit"], ref_commit):
        raise Refused(f"build commit {m['build_commit']} is not an ancestor of {ref_commit}")
    evidence.append(f"executable stamped {m['build_commit'][:12]}, ancestor of the publication commit")
    return {
        "file": setup.name, "sha256": sha256(setup), "version": m["version"], "build_commit": m["build_commit"],
        "exe_sha256": sha256(exe), "installed_exe_sha256": hashlib.sha256(installed_exe_bytes(data)).hexdigest(),
        "signature": "Valid" if m["signed"] else "NotSigned", "tag": None, "tag_commit": ref_commit,
        "candidate_run": int(run.group(1)), "github_release": False, "host_verified": True, "host_evidence": evidence,
    }


def verify_dev_build(setup: pathlib.Path, exe: pathlib.Path) -> dict:
    """A local build of this checkout - evidence that a fix works on a clean machine, never a release.

    Its identity is what can be checked here: the tracked tree is clean, the executable is stamped
    with HEAD (not `-dirty`), and the installer is the one tauri:build just wrote beside it. The
    disc says so, the plan says so, and report.py refuses such a cycle as acceptance evidence.
    """
    head = git("rev-parse", "HEAD")
    if git("status", "--porcelain", "--untracked-files=no"):
        raise Refused("the tracked tree is dirty; a dev build must be of a commit")
    data = exe.read_bytes()
    stamp = re.search(rb"encastra-build-commit=([0-9a-f]{40})(-dirty)?;", data)
    if not stamp or stamp.group(2):
        raise Refused(f"dev executable stamp {stamp.group(0) if stamp else None!r} is not a clean commit")
    built = stamp.group(1).decode()
    # Built from HEAD, or from an ancestor of it with not one byte of product source changed since
    # (only the harness moved on): either way these are the bytes this checkout's product builds.
    product = ["apps", "crates", "packages", "Cargo.toml", "Cargo.lock", "package.json", "package-lock.json"]
    if built != head:
        if not is_ancestor(built, head):
            raise Refused(f"dev executable stamp {built} is not HEAD {head} nor an ancestor of it")
        changed = git("diff", "--name-only", built, head, "--", *product)
        if changed:
            raise Refused(f"product source changed between the dev build {built[:12]} and HEAD: {changed.splitlines()[:5]}")
    version = json.loads((ROOT / "apps" / "desktop" / "src-tauri" / "tauri.conf.json").read_text())["version"]
    if f"Encastra_{version}_x64-setup.exe" != setup.name:
        raise Refused(f"{setup.name} is not the installer tauri:build writes for version {version}")
    return {
        "file": setup.name, "sha256": sha256(setup), "version": version, "build_commit": built,
        "exe_sha256": sha256(exe), "installed_exe_sha256": hashlib.sha256(installed_exe_bytes(data)).hexdigest(),
        "signature": "NotSigned", "tag": None, "tag_commit": head, "github_release": False,
        "dev_build": True, "host_verified": True,
        "host_evidence": [f"LOCAL DEV BUILD of {built} - not a release", "tracked tree clean", f"executable stamped {built[:12]}",
                          f"HEAD {head[:12]}; product source identical between them" if built != head else "built from HEAD",
                          f"installer name matches version {version}"],
    }


def build(args: argparse.Namespace) -> int:
    out = pathlib.Path(args.out)
    if out.exists():
        raise Refused(f"{out} exists; each cycle gets a new disc")
    if args.dev_setup:
        setup, exe = pathlib.Path(args.dev_setup), pathlib.Path(args.dev_exe)
        cand = verify_dev_build(setup, exe)
        sums = None
    else:
        rel = pathlib.Path(args.release_dir)
        setup = next(rel.glob("Encastra_*_x64-setup.exe"))
        exe = rel / "encastra-desktop.exe"
        sums = rel / "SHA256SUMS"
        cand = verify_candidate_build(args.candidate_ref, setup, exe, sums) if args.candidate_ref else verify_release(args.tag, setup, exe, sums)
    cand["sums_file"] = "SHA256SUMS"
    expected = {"installer": cand}
    (out / "artifacts").mkdir(parents=True)
    shutil.copy2(setup, out / "artifacts" / setup.name)
    if sums is not None:
        shutil.copy2(sums, out / "artifacts" / "SHA256SUMS")
    else:
        (out / "artifacts" / "SHA256SUMS").write_text(f"{cand['sha256']}  {setup.name}\n{cand['exe_sha256']}  {exe.name}\n", newline="\n")
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
        "dev_build": bool(args.dev_setup),
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
    ap.add_argument("--release-dir", help="a `gh release download` of --tag, or copy A of the candidate run (the artefact under acceptance)")
    ap.add_argument("--candidate-ref", help="instead of --tag: the pushed publication commit of a candidate not yet tagged")
    ap.add_argument("--dev-setup", help="a LOCAL build's installer instead of a release (evidence for a fix; never acceptance)")
    ap.add_argument("--dev-exe", help="the encastra-desktop.exe of that local build")
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
    if bool(args.dev_setup) == bool(args.release_dir) or bool(args.dev_setup) != bool(args.dev_exe):
        ap.error("give either --release-dir, or --dev-setup with --dev-exe")
    if args.dev_setup and args.mode == "upgrade":
        ap.error("an upgrade cycle upgrades between published versions only")
    if args.candidate_ref and not args.release_dir:
        ap.error("--candidate-ref needs --release-dir (copy A of the candidate run, with its SHA256SUMS)")
    try:
        return build(args)
    except Refused as e:
        print(f"REFUSED: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
