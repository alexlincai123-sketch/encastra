#!/usr/bin/env python3
"""One command that says whether this tree, these artefacts and this history are a release.

Every gate a release has to pass, run from the repository and written down in one structure a
person, a workflow or another program can read without interpreting prose:

    python scripts/release_check.py                    # everything; writes release-readiness.json
    python scripts/release_check.py --skip-gate        # do not re-run the test gate (it is marked NOT_VERIFIED)
    python scripts/release_check.py --compare DIR      # DIR holds a second build of this commit; compare bytes
    python scripts/release_check.py --evidence-vm LOG  # an install_check.ps1 log from a clean machine
    python scripts/release_check.py --evidence-gui LOG # a gui_journeys.ps1 log: the chooser journeys (B5)
    python scripts/release_check.py --no-network       # do not ask GitHub about workflow runs
    python scripts/release_check.py --mode release     # what mode is being claimed (default: from the version)

Each check ends in exactly one of:

    PASS               executed here, and true
    FAIL               executed here, and false — the release does not happen
    BLOCKED            cannot be executed from this repository as it stands (no remote, no artefacts)
    NOT_VERIFIED       could be executed and was not (an option was skipped, evidence was not given)
    EXTERNAL_REQUIRED  needs a person, a credential, a machine or a provider outside this repository

Modes, derived from the version unless `--mode` says otherwise and never contradicting it:

    dev       the tree is dirty, or the binary says so — nothing is published from it
    beta      a pre-release version (`x.y.z-something`): unsigned is allowed, on record
    release   a version with no suffix: signed with a timestamp countersignature, or it does not happen

The verdict is RELEASE_READY only when the mode is `release` and every check is PASS;
BETA_READY when the mode is `beta`, every executable check is PASS and what remains is
EXTERNAL_REQUIRED; otherwise BLOCKED, with the first reason named. Exit 0 for RELEASE_READY or
BETA_READY, 1 otherwise, 2 for a usage error.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import pathlib
import platform
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import release_identity  # noqa: E402
import release_manifest  # noqa: E402

ROOT = release_identity.ROOT
PASS, FAIL, BLOCKED, NOT_VERIFIED, EXTERNAL = "PASS", "FAIL", "BLOCKED", "NOT_VERIFIED", "EXTERNAL_REQUIRED"
MODES = ("dev", "beta", "release")

# The workflows a release commit must have run green, by name as `gh run list` reports them.
REQUIRED_WORKFLOWS = ("CI",)


class Check:
    def __init__(self, id: str, status: str, evidence: str, action: str = "") -> None:
        self.id, self.status, self.evidence, self.action = id, status, evidence, action

    def as_dict(self) -> dict:
        out = {"id": self.id, "status": self.status, "evidence": self.evidence}
        if self.action:
            out["action"] = self.action
        return out


def run(command: list[str], cwd: pathlib.Path = ROOT, timeout: int = 1800) -> subprocess.CompletedProcess:
    return subprocess.run(
        command,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=timeout,
        shell=platform.system() == "Windows" and command[0] in ("npm", "npx"),
    )


def git(*args: str) -> str | None:
    result = run(["git", *args])
    return result.stdout.strip() if result.returncode == 0 else None


def tail(text: str, lines: int = 3) -> str:
    kept = [line for line in text.strip().splitlines() if line.strip()]
    return " | ".join(kept[-lines:])[:400]


# ----------------------------------------------------------------------------- the checks


def check_git() -> tuple[Check, bool]:
    head = git("rev-parse", "HEAD")
    if head is None:
        return Check("git.state", FAIL, "not a git repository, or git is missing"), True
    dirty = git("status", "--porcelain", "--untracked-files=no") or ""
    branch = git("branch", "--show-current") or "(detached)"
    tags = git("tag", "--points-at", "HEAD") or ""
    where = f"HEAD {head[:12]} on {branch}" + (f", tagged {tags.replace(chr(10), ', ')}" if tags else "")
    if dirty:
        changed = ", ".join(line[3:] for line in dirty.splitlines()[:5])
        return Check("git.state", FAIL, f"{where}; uncommitted: {changed}", "commit or stash; a release comes from a commit"), True
    return Check("git.state", PASS, f"{where}; tree clean"), False


def derive_mode(requested: str | None, dirty: bool, version: str) -> tuple[str, Check]:
    prerelease = release_manifest.is_prerelease(version)
    natural = "dev" if dirty else ("beta" if prerelease else "release")
    if requested is None or requested == natural:
        return natural, Check("mode", PASS, f"{natural} (version {version}{', tree dirty' if dirty else ''})")
    if dirty:
        return "dev", Check("mode", FAIL, f"{requested} requested but the tree is dirty; that is a dev build", "commit first")
    if requested == "release" and prerelease:
        return natural, Check("mode", FAIL, f"release requested for pre-release version {version}", "set a release version, or claim beta")
    if requested == "beta" and not prerelease:
        return natural, Check("mode", FAIL, f"beta requested for version {version}, which is a release version", "add a pre-release suffix, or claim release")
    return requested, Check("mode", PASS, f"{requested} (version {version})")


def check_version() -> Check:
    result = run([sys.executable, str(HERE / "version.py"), "--check"])
    if result.returncode == 0:
        return Check("version.consistent", PASS, f"{release_identity.tree_version()} declared identically everywhere")
    return Check("version.consistent", FAIL, tail(result.stdout + result.stderr), "python scripts/version.py --sync")


def check_gate(skip: bool) -> list[Check]:
    steps = [
        ("gate.scripts", [sys.executable, "-m", "unittest", "discover", "-s", "scripts/tests"]),
        ("gate.fmt", ["cargo", "fmt", "--all", "--check"]),
        ("gate.clippy", ["cargo", "clippy", "--workspace", "--all-targets", "--", "-D", "warnings"]),
        ("gate.cargo_test", ["cargo", "test", "--workspace"]),
        ("gate.lint", ["npm", "run", "lint"]),
        ("gate.typecheck", ["npm", "run", "typecheck"]),
        ("gate.vitest", ["npm", "run", "test"]),
        ("gate.web_build", ["npm", "run", "build", "--workspace", "@encastra/web"]),
        # Generated artefacts that are committed: each command regenerates one and fails when
        # the committed copy differs. A candidate once reached its CI with a stale fuzz corpus
        # because the local gate that checks it was not run; the verdict now runs it.
        ("gate.generated", [sys.executable, "scripts/generated_check.py"]),
    ]
    if skip:
        return [Check(id, NOT_VERIFIED, "skipped by --skip-gate", "run without --skip-gate") for id, _ in steps]
    out = []
    for id, command in steps:
        try:
            result = run(command)
        except subprocess.TimeoutExpired:
            out.append(Check(id, FAIL, "timed out"))
            continue
        combined = result.stdout + result.stderr
        if result.returncode == 0:
            summary = re.findall(r"test result: ok\. (\d+) passed", combined)
            evidence = f"exit 0" + (f"; {sum(map(int, summary))} Rust tests" if summary and id == "gate.cargo_test" else "")
            tests = re.search(r"Tests\s+(\d+) passed", combined)
            if tests and id == "gate.vitest":
                evidence += f"; {tests.group(1)} tests"
            ran = re.search(r"Ran (\d+) tests", combined)
            if ran and id == "gate.scripts":
                evidence += f"; {ran.group(1)} tests"
            out.append(Check(id, PASS, evidence))
        else:
            out.append(Check(id, FAIL, f"exit {result.returncode}: {tail(combined)}"))
    return out


def check_dependencies(skip: bool) -> list[Check]:
    if skip:
        return [Check("deps.cargo_deny", NOT_VERIFIED, "skipped"), Check("deps.npm_audit", NOT_VERIFIED, "skipped")]
    out = []
    deny = run(["cargo", "deny", "check", "advisories", "bans", "licenses", "sources"])
    summary = [
        line.strip()
        for line in (deny.stdout + deny.stderr).splitlines()
        if line.startswith(("advisories", "bans", "licenses", "sources")) or "FAILED" in line or line.startswith("error")
    ]
    out.append(Check("deps.cargo_deny", PASS if deny.returncode == 0 else FAIL, " | ".join(summary[-4:]) or tail(deny.stdout + deny.stderr, 2)))
    audit = run(["npm", "audit", "--audit-level=high"])
    out.append(Check("deps.npm_audit", PASS if audit.returncode == 0 else FAIL, tail(audit.stdout + audit.stderr, 2)))
    notices = HERE / "third_party.py"
    if notices.exists():
        result = run([sys.executable, str(notices), "--check"])
        out.append(Check("deps.third_party_notices", PASS if result.returncode == 0 else FAIL, tail(result.stdout + result.stderr, 2), "python scripts/third_party.py"))
    lock = git("status", "--porcelain", "--", "Cargo.lock", "package-lock.json") or ""
    out.append(Check("deps.lockfiles", PASS if not lock else FAIL, "Cargo.lock and package-lock.json committed" if not lock else f"modified: {lock}"))
    return out


def publication_of(version: str) -> tuple[dict | None, bool]:
    """The manifest on disk if it describes this version from an ancestor of HEAD, and whether
    HEAD is that build commit or its publication (nothing but the publication files changed)."""
    head = release_identity.head_commit()
    claim = release_manifest.read_block()
    if not claim or claim["version"] != version:
        return None, False
    if claim["commit"] == head:
        return claim, True
    ancestor = run(["git", "merge-base", "--is-ancestor", claim["commit"], "HEAD"])
    if ancestor.returncode != 0:
        return claim, False
    changed = set((git("diff", "--name-only", claim["commit"], "HEAD") or "").split())
    return claim, all(release_manifest.is_publication_change(path) for path in changed)


def check_version_unique(version: str) -> Check:
    """One version, one build. A manifest that already names this version from another tree
    means the version was published and the code moved on under the same number — the one
    state a release identity must never be in. The way out is a new version, never a new
    binary under the old one."""
    claim, publication = publication_of(version)
    if claim is None:
        return Check("version.unique", PASS, f"{version} has not been published from an ancestor of this tree")
    if publication:
        return Check("version.unique", PASS, f"{version} is published from {claim['commit'][:12]}, and this tree is that build or its publication")
    return Check(
        "version.unique",
        FAIL,
        f"{version} was published from build commit {claim['commit'][:12]} and this tree is a different program under the same number",
        "bump the version (python scripts/version.py --set <next>); a published version never gets a second binary",
    )


def expected_build_commit(version: str) -> str | None:
    """The commit the artefacts must state: HEAD, or — on a publication commit — the build commit
    the manifest names, since the publication is one commit after the build by construction."""
    claim, publication = publication_of(version)
    if claim and publication:
        return claim["commit"]
    return release_identity.head_commit()


def check_artefacts() -> tuple[Check, list[dict]]:
    files = release_identity.artefacts()
    if not files:
        return Check("artefacts.identity", BLOCKED, f"nothing under {release_identity.BUNDLE.relative_to(ROOT)}", "npm run tauri:build"), []
    version = release_identity.tree_version()
    commit = expected_build_commit(version)
    entries = [release_identity.describe(path) for path in files]
    problems = release_identity.problems(entries, version, commit)
    if problems:
        return Check("artefacts.identity", FAIL, " | ".join(problems), "delete what is not this build's from target/, or rebuild"), entries
    described = ", ".join(f"{e['name']} {e['size']} B {e['sha256'][:12]}" for e in entries)
    return Check("artefacts.identity", PASS, f"{version} @ {commit[:12] if commit else '?'}: {described}"), entries


def check_manifest(mode: str) -> Check:
    if mode == "dev":
        return Check("manifest.verify", BLOCKED, "a dev build is not published, so there is no manifest to verify")
    problems = release_manifest.verify()
    if not problems:
        claim = release_manifest.read_block() or {}
        return Check("manifest.verify", PASS, f"docs/RELEASE.md and site.ts describe {claim.get('version')} at {str(claim.get('commit'))[:12]} and match the artefacts")
    return Check(
        "manifest.verify",
        FAIL,
        " | ".join(problems),
        "python scripts/release_manifest.py --allow-unsigned (beta) or --require-signature (release), then commit docs/RELEASE.md and site.ts as the publication commit",
    )


def check_signing(mode: str, entries: list[dict]) -> Check:
    if not entries:
        return Check("signing", BLOCKED, "no artefacts to inspect")
    states = {e["name"]: e.get("signature", {}) for e in entries}
    unsigned = [n for n, s in states.items() if s.get("status") != "signed"]
    broken = [n for n, s in states.items() if s.get("status") == "broken"]
    unstamped = [n for n, s in states.items() if s.get("status") == "signed" and not s.get("timestamped")]
    if broken:
        return Check("signing", FAIL, f"signature present but not valid on: {', '.join(broken)}", "do not distribute; re-sign")
    if mode == "release":
        if unsigned:
            return Check("signing", FAIL, f"unsigned: {', '.join(unsigned)}; a release version is signed or it does not happen", "provide the certificate to the release workflow (docs/SIGNING.md)")
        if unstamped:
            return Check("signing", FAIL, f"signed without a timestamp countersignature: {', '.join(unstamped)}", "sign with a timestamp server (tauri.conf.json timestampUrl)")
        signer = next(iter(states.values())).get("signer")
        return Check("signing", PASS, f"every artefact signed and timestamped by {signer}")
    if unsigned:
        return Check("signing", PASS, f"unsigned ({', '.join(unsigned)}); accepted for a {mode} build and stated in the manifest")
    return Check("signing", PASS, "signed")


def check_reproducibility(compare: pathlib.Path | None, entries: list[dict]) -> Check:
    if compare is None:
        return Check("reproducibility", NOT_VERIFIED, "no second build given", "python scripts/verify/reproduce.py, or --compare DIR")
    if not entries:
        return Check("reproducibility", BLOCKED, "no artefacts here to compare")
    other_root = compare
    mismatches, compared = [], []
    for entry in entries:
        here = pathlib.Path(entry["path"])
        rel = here.relative_to(ROOT)
        there = other_root / rel
        if not there.exists():
            mismatches.append(f"{rel} missing in {compare}")
            continue
        other = release_identity.sha256(there)
        compared.append(rel.name)
        if other != entry["sha256"]:
            mismatches.append(f"{rel.name}: {entry['sha256'][:12]} here, {other[:12]} there")
    if mismatches:
        return Check("reproducibility", FAIL, " | ".join(mismatches), "python scripts/pe_diff.py A B names the differing bytes")
    return Check("reproducibility", PASS, f"byte-identical in {compare}: {', '.join(compared)}")


def check_ci(no_network: bool) -> Check:
    remote = git("remote", "get-url", "origin")
    if remote is None:
        return Check("ci.evidence", BLOCKED, "no git remote; no CI has ever run on this repository", "create the remote and push (a person)")
    head = git("rev-parse", "HEAD") or ""
    if no_network:
        return Check("ci.evidence", NOT_VERIFIED, f"remote {remote}; runs not queried (--no-network)", f"gh run list --commit {head[:12]}")
    result = run(["gh", "run", "list", "--commit", head, "--json", "name,status,conclusion,url", "--limit", "20"], timeout=60)
    if result.returncode != 0:
        return Check("ci.evidence", NOT_VERIFIED, f"remote {remote}; gh could not list runs: {tail(result.stderr, 1)}", "gh auth login, or check the runs in the browser")
    try:
        runs = json.loads(result.stdout or "[]")
    except json.JSONDecodeError:
        runs = []
    return judge_runs(runs, remote, head)


def judge_runs(runs: list[dict], remote: str, head: str) -> Check:
    """What the runs for this commit say, separated from the business of fetching them.

    A run that has not finished is not a run that failed. Both used to come out FAIL, because the
    test was `conclusion != "success"` and an unfinished run has no conclusion at all — so asking
    for the verdict while CI was still going said the release was broken, and asking again a few
    minutes later said it was fine. NOT_VERIFIED is what "not known yet" means here, and it blocks
    a release just the same; FAIL is for a run that finished and did not pass.
    """
    if not runs:
        return Check("ci.evidence", NOT_VERIFIED, f"remote {remote}; no workflow run exists for {head[:12]}", "push this commit and let CI run")
    by_name: dict[str, dict] = {}
    for item in runs:
        by_name.setdefault(item["name"], item)
    missing = [w for w in REQUIRED_WORKFLOWS if w not in by_name]
    if missing:
        return Check("ci.evidence", NOT_VERIFIED, f"no run of {', '.join(missing)} for {head[:12]}", "push and wait for CI")

    finished = {n: r for n, r in by_name.items() if r.get("status") == "completed"}
    running = {n: r for n, r in by_name.items() if r.get("status") != "completed"}
    failed = [f"{n}: {r.get('conclusion')}" for n, r in finished.items() if r.get("conclusion") != "success"]

    # A run that finished badly is known to be bad, whatever else is still going.
    if failed:
        return Check("ci.evidence", FAIL, "; ".join(failed), "fix the workflow before releasing; " + by_name[REQUIRED_WORKFLOWS[0]].get("url", ""))
    if running:
        still = "; ".join(f"{name}: {item.get('status')}" for name, item in running.items())
        where = next(iter(running.values())).get("url", "")
        return Check("ci.evidence", NOT_VERIFIED, f"run in progress: {still} — {where}", "wait for the run to finish, then ask again")
    return Check("ci.evidence", PASS, f"{', '.join(by_name)} green for {head[:12]}: " + by_name[REQUIRED_WORKFLOWS[0]].get("url", ""))


def check_vm(evidence: pathlib.Path | None) -> Check:
    if evidence is None:
        return Check("clean_vm", EXTERNAL, "no clean-machine installation log given", "docs/release/CLEAN_WINDOWS_VM.md; then --evidence-vm <log>")
    if not evidence.exists():
        return Check("clean_vm", FAIL, f"{evidence} does not exist")
    text = evidence.read_text("utf-8", errors="replace")
    passes = len(re.findall(r"^PASS", text, re.M))
    fails = re.findall(r"^FAIL.*$", text, re.M)
    if fails:
        return Check("clean_vm", FAIL, f"{len(fails)} failed check(s) in {evidence.name}: {fails[0][:120]}")
    if passes == 0:
        return Check("clean_vm", FAIL, f"{evidence.name} contains no PASS lines; is it an install_check.ps1 log?")
    return Check("clean_vm", PASS, f"{passes} checks passed in {evidence.name} (a log is evidence of a run, not of the machine it ran on — keep the VM record with it)")


def check_gui_journeys(evidence: pathlib.Path | None) -> Check:
    """Have the chooser journeys that gate permissions been driven through the interface?

    B5. Four folder purposes and one file purpose decide what the application may read and write,
    and until 0.5.0-rc.4 only `projects-location` — the one that gates nothing — had ever been
    driven by a person or by automation. A unit test cannot stand in for this: what is in doubt is
    the whole path from the native chooser through IPC to the registry, and that path has a native
    dialog in the middle of it.

    The evidence is a gui_journeys.ps1 log. A log proves a run happened, not where; keep it with
    the run that produced it.

    A run of one is not evidence either. These journeys drive a native modal dialog through a
    browser engine, and a chooser that works once and not twice works by accident; the harness's
    -Repeat runs the whole suite from a clean state each time and writes the number into its
    SUMMARY line, and fewer than three is NOT_VERIFIED rather than a pass. A log with no SUMMARY
    line at all is a run that did not reach its end — a killed process, a truncated artefact — and
    the PASS lines above the cut say nothing about what came after it.
    """
    if evidence is None:
        return Check("gui.journeys", NOT_VERIFIED, "no chooser-journey log given", "run scripts/verify/gui_journeys.ps1 on a machine nobody is using; then --evidence-gui <log>")
    if not evidence.exists():
        return Check("gui.journeys", FAIL, f"{evidence} does not exist")
    text = evidence.read_text("utf-8", errors="replace")
    fails = re.findall(r"^FAIL.*$", text, re.M)
    skips = re.findall(r"^SKIP.*$", text, re.M)
    passes = len(re.findall(r"^PASS", text, re.M))
    summary = re.search(r"^SUMMARY.*$", text, re.M)
    if fails:
        return Check("gui.journeys", FAIL, f"{len(fails)} failed: {fails[0][:120]}")
    if passes == 0:
        return Check("gui.journeys", FAIL, f"{evidence.name} has no PASS lines; is it a gui_journeys.ps1 log?")
    if summary is None:
        return Check("gui.journeys", FAIL, f"{evidence.name} has {passes} PASS lines and no SUMMARY line; the run did not reach its end", "run it again and keep the whole log")
    found = re.search(r"repeat=(\d+)", summary.group(0))
    repeat = int(found.group(1)) if found else 0
    if skips:
        # A journey that did not run is not a journey that passed, and the two are the same colour
        # unless something says so.
        return Check("gui.journeys", NOT_VERIFIED, f"{passes} passed over repeat={repeat} but {len(skips)} skipped: {skips[0][:120]}")
    if repeat < 3:
        return Check("gui.journeys", NOT_VERIFIED, f"{passes} checks passed in {evidence.name} but repeat={repeat}: one run of a chooser is not evidence that it works", "run scripts/verify/gui_journeys.ps1 -Repeat 3")
    return Check("gui.journeys", PASS, f"{passes} checks passed in {evidence.name} over repeat={repeat} runs of the suite")


def check_toolchain() -> Check:
    """Would this machine's tools produce the published bytes?

    rustc is pinned in rust-toolchain.toml and Node in .nvmrc, but the C toolchain underneath
    rustc was pinned by nothing until B7: rustc asks Visual Studio for a linker and takes whatever
    that installation calls its default. That is why 0.5.0-rc.3's bytes did not reproduce on the
    hosted runner — it had moved to Visual Studio 2026 and a newer toolset. scripts/verify has the
    pin and the comparison; this puts the answer in the verdict.
    """
    script = ROOT / "scripts" / "verify" / "toolchain.py"
    if not script.exists():
        return Check("toolchain.msvc", NOT_VERIFIED, f"{script.name} is missing", "restore scripts/verify/toolchain.py")
    result = run([sys.executable, str(script), "--json"], timeout=300)
    if result.returncode not in (0, 1):
        return Check("toolchain.msvc", NOT_VERIFIED, f"could not read the toolchain: {tail(result.stderr, 1)}")
    try:
        report = json.loads(result.stdout or "{}")
    except json.JSONDecodeError:
        return Check("toolchain.msvc", NOT_VERIFIED, "toolchain.py did not answer in JSON")
    expected, found = report.get("expected", {}), report.get("found", {})
    if report.get("agrees"):
        return Check("toolchain.msvc", PASS, f"MSVC {found.get('msvc')}, node {found.get('node')}, rustc {found.get('rustc')}")
    return Check(
        "toolchain.msvc",
        FAIL,
        "; ".join(report.get("problems", [])) or f"expected {expected}, found {found}",
        "python scripts/verify/toolchain.py",
    )


def check_external(mode: str) -> list[Check]:
    legal = ROOT / "docs" / "legal"
    drafts = sorted(p.name for p in legal.glob("*.md")) if legal.exists() else []
    # Both are outside the repository in every mode. A beta ships without them, on record; a
    # release does not — the verdict, not the status, is what differs between the two modes.
    need = "required before a release version" if mode == "release" else "not required for a beta; recorded"
    return [
        Check(
            "pentest",
            EXTERNAL,
            f"no external test has been performed ({need}); docs/security/PENTEST_HANDOFF.md is the hand-off",
            "engage a provider (a person, money)",
        ),
        Check(
            "legal",
            EXTERNAL,
            f"drafts present: {', '.join(drafts) if drafts else 'none'}; the tree is UNLICENSED; the name is not cleared ({need})",
            "a lawyer signs off the licence, the terms, the privacy statement and the mark (docs/legal/)",
        ),
    ]


# ----------------------------------------------------------------------------- the verdict


def verdict(mode: str, checks: list[Check]) -> tuple[str, str]:
    statuses = {c.id: c.status for c in checks}
    failing = [c for c in checks if c.status == FAIL]
    if mode == "dev":
        return "NOT_A_RELEASE", "the tree is a dev build; nothing is published from it"
    if failing:
        return "BLOCKED", f"{failing[0].id}: {failing[0].evidence[:160]}"
    blocked = [c for c in checks if c.status in (BLOCKED, NOT_VERIFIED)]
    if mode == "release":
        external = [c for c in checks if c.status == EXTERNAL]
        if blocked or external:
            first = (blocked + external)[0]
            return "BLOCKED", f"{first.id} is {first.status}: {first.evidence[:160]}"
        return "RELEASE_READY", "every check passed"
    if blocked:
        first = blocked[0]
        return "BLOCKED", f"{first.id} is {first.status}: {first.evidence[:160]}"
    external = [c.id for c in checks if c.status == EXTERNAL]
    return "BETA_READY", "every executable check passed; external: " + ", ".join(external) if external else "every check passed"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--mode", choices=MODES)
    parser.add_argument("--skip-gate", action="store_true")
    parser.add_argument("--skip-deps", action="store_true")
    parser.add_argument("--compare", type=pathlib.Path, help="root of a second build of this commit")
    parser.add_argument("--evidence-vm", type=pathlib.Path, help="an install_check.ps1 log from a clean machine")
    parser.add_argument("--evidence-gui", type=pathlib.Path, help="a gui_journeys.ps1 log: the chooser journeys driven through the interface")
    parser.add_argument("--no-network", action="store_true")
    parser.add_argument("--out", type=pathlib.Path, default=ROOT / "release-readiness.json")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    if args.compare is not None and not args.compare.is_dir():
        print(f"--compare: {args.compare} is not a directory", file=sys.stderr)
        return 2

    checks: list[Check] = []
    git_check, dirty = check_git()
    checks.append(git_check)
    version = release_identity.tree_version()
    mode, mode_check = derive_mode(args.mode, dirty, version)
    checks.append(mode_check)
    checks.append(check_version())
    checks.append(check_version_unique(version))
    checks += check_gate(args.skip_gate)
    checks += check_dependencies(args.skip_deps)
    artefact_check, entries = check_artefacts()
    checks.append(artefact_check)
    checks.append(check_manifest(mode))
    checks.append(check_signing(mode, entries))
    checks.append(check_reproducibility(args.compare, entries))
    checks.append(check_toolchain())
    checks.append(check_ci(args.no_network))
    checks.append(check_vm(args.evidence_vm))
    checks.append(check_gui_journeys(args.evidence_gui))
    checks += check_external(mode)

    result, reason = verdict(mode, checks)
    report = {
        "generated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "version": version,
        "commit": release_identity.head_commit(),
        "mode": mode,
        "verdict": result,
        "reason": reason,
        "artefacts": [{k: v for k, v in e.items() if k != "path"} for e in entries],
        "checks": [c.as_dict() for c in checks],
        "statuses": sorted({c.status for c in checks}),
    }
    args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    if not args.quiet:
        width = max(len(c.id) for c in checks)
        for c in checks:
            line = f"{c.status:<17} {c.id:<{width}}  {c.evidence}"
            if c.action and c.status != PASS:
                line += f"\n{'':<17} {'':<{width}}  -> {c.action}"
            print(line)
        print()
        print(f"{version} @ {str(report['commit'])[:12]}  mode={mode}  verdict={result}: {reason}")
        print(f"written: {args.out}")
    return 0 if result in ("RELEASE_READY", "BETA_READY") else 1


if __name__ == "__main__":
    raise SystemExit(main())
