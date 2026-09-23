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
import hashlib
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
    unchecked = [n for n, s in states.items() if s.get("status") == "unchecked"]
    unstamped = [n for n, s in states.items() if s.get("status") == "signed" and not s.get("timestamped")]
    if broken:
        return Check("signing", FAIL, f"signature present but not valid on: {', '.join(broken)}", "do not distribute; re-sign")
    # An artefact nobody could ask about is not an artefact known to be unsigned. Folded together,
    # a beta said "unsigned; accepted for a beta build and stated in the manifest" about a file
    # whose Authenticode state had never been read — off Windows, or any time the probe fell over.
    if unchecked:
        return Check("signing", NOT_VERIFIED, f"the Authenticode state could not be read on: {', '.join(unchecked)}", "run the gate on Windows, where the probe can answer")
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


GUI_SUBJECT = re.compile(r"^SUBJECT\b.*?\bstamp=([0-9a-f]{40}(?:-dirty)?|unknown|none)(?=\s|$)", re.M)
GUI_SUBJECT_SHA = re.compile(r"\bsha256=([0-9a-f]{64}|none)(?=\s|$)")
GUI_SUMMARY_STAMP = re.compile(r"\bstamp=([0-9a-f]{40}(?:-dirty)?|unknown|none)(?=\s|$)")
GUI_ITERATION = re.compile(r"^--- iteration (\d+) of (\d+) ---$", re.M)
# The harness prints its counters as plain decimal integers. `03`, `3.0` or `+3` are not something
# it writes, so a SUMMARY carrying them has been written by something else.
GUI_NUMBER = r"(0|[1-9]\d{0,5})(?![\w.])"
# Tauri's NSIS installer rewrites this marker in the copy it installs, so the application knows
# which kind of package it came from (docs/RELEASE.md): the installed executable is the built one
# with these bytes changed and nothing else.
TAURI_BUNDLE_MARKER = (b"__TAURI_BUNDLE_TYPE_VAR_UNK", b"__TAURI_BUNDLE_TYPE_VAR_NSS")
# A verdict line the harness does not write: indented, or not in capitals. Its own are exactly
# `PASS  `, `FAIL  ` and `SKIP  ` at the start of a line, and a FAIL or a SKIP in any other shape
# is one that the tally above would not count.
GUI_ODD_VERDICT = re.compile(r"^(?!(?:FAIL|SKIP)  )[ \t]*(?i:fail|skip)\b.*$", re.M)
# The section header each journey prints as it starts (gui_journeys.ps1); every iteration walks all four.
GUI_JOURNEY_SECTIONS = (
    "--- journey 1: projects-location ",
    "--- journey 2: publish-into ",
    "--- journey 3: import-from ",
    "--- journeys 4 and 5: grant-to-component and run-input ",
)


def _gui_missing_iterations(text: str, repeat: int) -> list[str]:
    """What is absent from a log that says it ran the suite `repeat` times; empty if nothing."""
    headers = list(GUI_ITERATION.finditer(text))
    numbers = [(int(h.group(1)), int(h.group(2))) for h in headers]
    # Built from what the log contains, never from `repeat`: the list is only as long as the headers.
    if len(numbers) != repeat or numbers != [(i, repeat) for i in range(1, len(numbers) + 1)]:
        return [f"its iteration headers are {[f'{i} of {n}' for i, n in numbers] or 'absent'}"]
    problems = []
    for index, header in enumerate(headers):
        end = headers[index + 1].start() if index + 1 < len(headers) else len(text)
        block = text[header.start():end]
        iteration = index + 1
        if not re.search(rf"^PASS.*\[iteration {iteration}/{repeat}\]\s*$", block, re.M):
            problems.append(f"iteration {iteration} has no PASS line of its own")
        # Every journey in every iteration asserts something. A section that is there as a header
        # and carries no PASS of this iteration is a journey that was announced and not driven.
        starts = []
        for section in GUI_JOURNEY_SECTIONS:
            found = re.search(rf"^{re.escape(section)}", block, re.M)
            if found is None:
                problems.append(f"iteration {iteration} has no '{section.strip()}' section")
            else:
                starts.append((found.start(), section))
        starts.sort()
        for position, (start, section) in enumerate(starts):
            stop = starts[position + 1][0] if position + 1 < len(starts) else len(block)
            if not re.search(rf"^PASS.*\[iteration {iteration}/{repeat}\]\s*$", block[start:stop], re.M):
                problems.append(f"iteration {iteration}: '{section.strip()}' has no PASS line of its own")
    return problems


def _gui_read(evidence: pathlib.Path) -> str:
    """The log as text, whichever way the shell that tee'd it encoded it.

    PowerShell 7 writes UTF-8 without a BOM; Windows PowerShell 5.1's Tee-Object writes a UTF-8 BOM,
    and some of its redirections write UTF-16. A BOM is not part of the first line.
    """
    raw = evidence.read_bytes()
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        text = raw.decode("utf-16", errors="replace")
    else:
        text = raw.decode("utf-8-sig", errors="replace")
    # The runner writes CRLF; a line is the same line either way. A lone CR is left alone: no shell
    # writes one as a line end, and one inside an observed string must not split a PASS line.
    return text.replace("\r\n", "\n")


def check_gui_journeys(evidence: pathlib.Path | None, expected_commit: str | None, entries: list[dict]) -> Check:
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
    -Repeat runs the whole suite again on a fresh sandbox and an empty project each time (with
    -Launch on a freshly started application, and under CI on cleared per-user state as well — the
    harness header says exactly what carries over where) and writes the number into its SUMMARY
    line, and fewer than three is NOT_VERIFIED rather than a pass. A log with no SUMMARY line at all
    is a run that did not reach its end — a killed process, a truncated artefact — and the PASS
    lines above the cut say nothing about what came after it.

    And a log is only evidence about the build it drove. The harness names that build before the
    first iteration (under -Launch, after a few PASS lines about clearing state), in one line
    `SUBJECT exe=... sha256=... stamp=<commit>[-dirty] version=...` read out of the executable it
    drove the same way release_identity reads a stamp, and the SUMMARY line repeats `stamp=`. The
    sha256 has to be the executable built here (artefacts.identity): the stamp says which commit,
    the hash says which bytes. The stamp has to be the commit this release expects
    (`expected_build_commit`: HEAD, or the build commit on a publication commit). A missing stamp, a `-dirty` one, `unknown`, a
    SUBJECT and a SUMMARY that disagree, or another commit is a FAIL that names both — a green run
    of some other program says nothing about this one.
    """
    if evidence is None:
        return Check("gui.journeys", NOT_VERIFIED, "no chooser-journey log given", "run scripts/verify/gui_journeys.ps1 on a machine nobody is using; then --evidence-gui <log>")
    if not evidence.is_file():
        return Check("gui.journeys", FAIL, f"{evidence} does not exist or is not a file")
    text = _gui_read(evidence)
    fails = re.findall(r"^FAIL.*$", text, re.M)
    skips = re.findall(r"^SKIP.*$", text, re.M)
    passes = len(re.findall(r"^PASS", text, re.M))
    summaries = re.findall(r"^SUMMARY.*$", text, re.M)
    summary = re.search(r"^SUMMARY.*$", text, re.M)
    if fails:
        return Check("gui.journeys", FAIL, f"{len(fails)} failed: {fails[0][:120]}")
    odd = GUI_ODD_VERDICT.findall(text)
    if odd:
        return Check("gui.journeys", FAIL, f"{evidence.name} has a verdict line the harness does not write, so its tally cannot be trusted: {odd[0][:120]}")
    if passes == 0:
        return Check("gui.journeys", FAIL, f"{evidence.name} has no PASS lines; is it a gui_journeys.ps1 log?")
    if summary is None:
        return Check("gui.journeys", FAIL, f"{evidence.name} has {passes} PASS lines and no SUMMARY line; the run did not reach its end", "run it again and keep the whole log")
    rerun = "run scripts/verify/gui_journeys.ps1 -Repeat 3 against a build of the expected commit, from a clean tree"
    # One run writes one SUBJECT and ends on one SUMMARY. Two of either is two logs, or an edit, and
    # whichever the reading happened to pick first would decide the verdict.
    subjects = re.findall(r"^SUBJECT\b.*$", text, re.M)
    last_line = next((line for line in reversed(text.splitlines()) if line.strip(" \t\x00")), "")
    if len(summaries) != 1 or not last_line.startswith("SUMMARY"):
        return Check("gui.journeys", FAIL, f"{evidence.name} has {len(summaries)} SUMMARY line(s) and ends on {last_line[:60]!r}; one run ends on exactly one", rerun)
    if len(subjects) > 1:
        return Check("gui.journeys", FAIL, f"{evidence.name} has {len(subjects)} SUBJECT lines; one run names one build", rerun)
    subject = GUI_SUBJECT.search(text)
    summary_stamps = GUI_SUMMARY_STAMP.findall(summary.group(0))
    summary_stamp = GUI_SUMMARY_STAMP.search(summary.group(0)) if len(summary_stamps) == 1 else None
    if subject is None:
        return Check("gui.journeys", FAIL, f"{evidence.name} has no SUBJECT line naming the build it drove; expected commit {expected_commit or '(unknown)'}, the log's build: (not stated)", rerun)
    stamp = subject.group(1)
    # The harness names its build before it drives anything: SubjectLine runs before the first
    # iteration opens. A SUBJECT below an iteration header was put there afterwards.
    first_iteration = GUI_ITERATION.search(text)
    if first_iteration is not None and subject.start() > first_iteration.start():
        return Check("gui.journeys", FAIL, f"{evidence.name} names its build after the suite started; the harness names it before the first iteration", rerun)
    if summary_stamp is None or summary_stamp.group(1) != stamp:
        said = summary_stamp.group(1) if summary_stamp else "(no stamp)"
        return Check("gui.journeys", FAIL, f"{evidence.name}: the SUBJECT line says the build was {stamp} and the SUMMARY line says {said}; a log that disagrees with itself about its build is evidence of neither", rerun)
    if stamp in ("none", "unknown"):
        return Check("gui.journeys", FAIL, f"{evidence.name} drove a build with no commit stamp ({stamp}); expected commit {expected_commit or '(unknown)'}", rerun)
    if stamp.endswith("-dirty"):
        return Check("gui.journeys", FAIL, f"{evidence.name} drove a build of a dirty tree ({stamp}); expected commit {expected_commit or '(unknown)'} built clean", rerun)
    if expected_commit is None:
        return Check("gui.journeys", FAIL, f"{evidence.name} drove build {stamp}, and the commit this release expects cannot be determined here (no git), so the log cannot be matched to it", rerun)
    if stamp != expected_commit:
        return Check("gui.journeys", FAIL, f"{evidence.name} drove build {stamp}; this release expects {expected_commit}", rerun)
    # The SUMMARY's counters are the harness's own tally of the lines above it. A log whose lines
    # and tally disagree has been cut, spliced or edited, and is evidence of neither.
    counted = {"passed": passes, "failed": len(fails), "skipped": len(skips)}
    for name, lines in counted.items():
        said_n = re.search(rf"(?<![\w.]){name}={GUI_NUMBER}", summary.group(0))
        if said_n is None or int(said_n.group(1)) != lines:
            return Check("gui.journeys", FAIL, f"{evidence.name}: the SUMMARY line says {name}={said_n.group(1) if said_n else '(nothing it writes)'} and the log has {lines} such lines; a log that disagrees with its own tally is evidence of neither", rerun)
    found = re.search(rf"(?<![\w.])repeat={GUI_NUMBER}", summary.group(0))
    if found is None:
        return Check("gui.journeys", FAIL, f"{evidence.name}: the SUMMARY line's repeat is not a count the harness writes ({summary.group(0)[:120]})", rerun)
    repeat = int(found.group(1))
    # And the build it names is the build here. The stamp says which commit; the hash says which
    # bytes - a debug build, a patched one or another machine's build of the same commit has the
    # same stamp and a different hash. The harness hashes the executable it drove: under -Launch the
    # installed copy, which is the built one with the NSIS bundle marker rewritten, and otherwise
    # whatever -Exe named, which may be target/ itself. Those two hashes are the only ones accepted.
    binary = next((e for e in entries if e.get("name") == "encastra-desktop.exe"), None)
    if binary is None:
        return Check("gui.journeys", BLOCKED, f"{evidence.name} drove build {stamp[:12]}, and there is no built encastra-desktop.exe here to compare its hash with", "build the expected commit, then run this again")
    sha = GUI_SUBJECT_SHA.search(subject.group(0))
    built = pathlib.Path(binary["path"]).read_bytes()
    unk, nss = TAURI_BUNDLE_MARKER
    installed = hashlib.sha256(built.replace(unk, nss)).hexdigest() if built.count(unk) == 1 else None
    accepted = {binary.get("sha256"): "the executable built here"}
    if installed:
        accepted[installed] = "the executable built here as its installer leaves it (bundle marker rewritten)"
    if sha is None or sha.group(1) not in accepted:
        return Check("gui.journeys", FAIL, f"{evidence.name} drove an executable with sha256={sha.group(1) if sha else '(not stated)'}; built here: {binary.get('sha256')}, installed from it: {installed or '(no single bundle marker in it)'}", rerun)
    driven = accepted[sha.group(1)]
    if skips:
        # A journey that did not run is not a journey that passed, and the two are the same colour
        # unless something says so.
        return Check("gui.journeys", NOT_VERIFIED, f"{passes} passed over repeat={repeat} but {len(skips)} skipped: {skips[0][:120]}")
    if repeat < 3:
        return Check("gui.journeys", NOT_VERIFIED, f"{passes} checks passed in {evidence.name} but repeat={repeat}: one run of a chooser is not evidence that it works", "run scripts/verify/gui_journeys.ps1 -Repeat 3")
    # `repeat=` is the number the harness was asked for, not the number it ran. Every iteration it
    # ran opens with a header and walks all four journey sections, and each says so in the log; a
    # PASS over three iterations is only as good as three iterations that are actually there.
    missing = _gui_missing_iterations(text, repeat)
    if missing:
        return Check("gui.journeys", FAIL, f"{evidence.name} claims repeat={repeat} but {missing[0]}", rerun)
    return Check("gui.journeys", PASS, f"{passes} checks passed in {evidence.name} over repeat={repeat} runs of the suite, against build {stamp[:12]}, the commit this release expects, on {driven}")


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
    checks.append(check_gui_journeys(args.evidence_gui, expected_build_commit(version), entries))
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
