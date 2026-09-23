#!/usr/bin/env python3
"""Where the published bytes came from, and the checks that say so.

Since 0.5.0-rc.5 the artefacts a release publishes are the ones `candidate.yml` built on a hosted
runner — twice, on two fresh machines, byte-identical — not the ones a developer's laptop built.
B7 is why: the laptop and the runner report the same Windows SDK version and still hand the linker
different import hints for two advapi32 functions, and nothing in the repository can select an SDK
servicing revision. Two runners of one image agree; a runner and a laptop do not.

That moves the root of trust from "the machine that ran release_manifest.py" to "a named workflow
run on GitHub". This module is the one place that decides whether a run qualifies and which bytes
it produced. Three callers use it, independently:

- `release_fetch.py` downloads a run's artefacts and puts copy A into target/;
- `release_check.py` judges target/ against the run before a tag;
- `release.yml` (`--verify-manifest`) judges the published manifest against the run at the tag,
  before anything is built or published.

What it never trusts is a local claim. The bytes a run produced are read out of the artefact zips
themselves, and each zip is accepted only if it hashes to the digest GitHub reports for it *now*.
`target/release/candidate-provenance.json` only says which run to ask about; editing it changes
the question, never the answer.

    python scripts/release_provenance.py --verify-manifest     # CI: the manifest names a qualifying run's bytes
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import zipfile

ROOT = pathlib.Path(os.environ.get("ENCASTRA_RELEASE_ROOT") or pathlib.Path(__file__).resolve().parent.parent)
PROVENANCE = ROOT / "target" / "release" / "candidate-provenance.json"
STAGING = ROOT / "target" / "candidate"

WORKFLOW_PATH = ".github/workflows/candidate.yml"
WORKFLOW_NAME = "Candidate build"
# Every job the workflow has, by the name GitHub reports. A run is only a candidate if all of
# them ran and passed: a copy B that never ran reproduced nothing, and journeys that were skipped
# drove nothing. Matched exactly, so a renamed job fails closed instead of passing unexamined.
REQUIRED_JOBS = (
    "Build copy a",
    "Build copy b",
    "Copy B reproduces copy A byte for byte",
    "Drive the choosers through copy A's installer",
)
CANDIDATE_ARTEFACT = "encastra-candidate-a"
REPRODUCTION_ARTEFACT = "encastra-candidate-b"
BINARY = "encastra-desktop.exe"
# How the manifest names the run, written by release_manifest.built_by and read back here.
RUN_IN_MANIFEST = re.compile(r"by GitHub Actions run \[(\d+)\]\(")


def journeys_artefact(run_id: int | str) -> str:
    return f"chooser-journeys-{run_id}"


def required_artefacts(run_id: int | str) -> tuple[str, str, str]:
    return (CANDIDATE_ARTEFACT, REPRODUCTION_ARTEFACT, journeys_artefact(run_id))


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def repository() -> str | None:
    """owner/name of origin, from its URL. None if there is no GitHub origin."""
    try:
        url = subprocess.run(
            ["git", "remote", "get-url", "origin"], cwd=ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None
    found = re.search(r"github\.com[:/]([^/]+/[^/]+?)(?:\.git)?/?$", url)
    return found.group(1) if found else None


def gh_api(path: str, binary: bool = False, timeout: int = 300):
    """GET a GitHub API path through `gh`. Raises RuntimeError with gh's own words on failure."""
    result = subprocess.run(["gh", "api", path], cwd=ROOT, capture_output=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(f"gh api {path}: {result.stderr.decode(errors='replace').strip()[:300]}")
    return result.stdout if binary else json.loads(result.stdout or b"null")


def judge_run(run: dict, jobs: list[dict], artefacts: list[dict], commit: str, repo: str | None = None) -> list[str]:
    """Every reason this workflow run is not a candidate build of `commit`. Empty means it is.

    `jobs` must be every attempt's jobs (`filter=all`): a failure fixed by "re-run failed jobs"
    is still a failure of the thing this run was meant to show, and the run must be run anew.
    Pure: takes what GitHub said and decides, so the rules can be tested without a network.
    """
    problems: list[str] = []
    rid = run.get("id")
    if run.get("path") != WORKFLOW_PATH:
        problems.append(f"run {rid} is {run.get('path')!r}, not {WORKFLOW_PATH}")
    if run.get("head_sha") != commit:
        problems.append(f"run {rid} built {run.get('head_sha')}, not {commit}")
    # A dispatch or a push builds the commit itself; a pull_request run builds a merge ref.
    if run.get("event") not in ("workflow_dispatch", "push"):
        problems.append(f"run {rid} was triggered by {run.get('event')!r}; a candidate is dispatched or pushed")
    if run.get("run_attempt") != 1:
        problems.append(f"run {rid} is attempt {run.get('run_attempt')}; a candidate that needed a re-run is dispatched again")
    if repo is not None and (run.get("head_repository") or {}).get("full_name") != repo:
        problems.append(f"run {rid} built {(run.get('head_repository') or {}).get('full_name')!r}, not {repo}")
    if run.get("status") != "completed" or run.get("conclusion") != "success":
        problems.append(f"run {rid} is {run.get('status')}/{run.get('conclusion')}, not completed/success")
    for job in jobs:
        if job.get("name") in REQUIRED_JOBS and job.get("conclusion") != "success":
            problems.append(f"job {job.get('name')!r} concluded {job.get('conclusion')} (attempt {job.get('run_attempt')})")
    names = [job.get("name") for job in jobs]
    for name in REQUIRED_JOBS:
        if name not in names:
            problems.append(f"job {name!r} is not in run {rid}")
    counts: dict[str, int] = {}
    for artefact in artefacts:
        counts[artefact.get("name")] = counts.get(artefact.get("name"), 0) + 1
    by_name = {a.get("name"): a for a in artefacts}
    for name in required_artefacts(rid):
        artefact = by_name.get(name)
        if artefact is None:
            problems.append(f"artefact {name} is not in run {rid}")
        elif counts[name] != 1:
            problems.append(f"artefact {name} appears {counts[name]} times in run {rid}; which one was tested is not knowable")
        elif artefact.get("expired"):
            problems.append(f"artefact {name} has expired")
        elif not re.fullmatch(r"sha256:[0-9a-f]{64}", str(artefact.get("digest") or "")):
            problems.append(f"artefact {name} has no sha256 digest to check a download against")
    return problems


def fetch_run(repo: str, run_id: int | str) -> tuple[dict, list[dict], list[dict]]:
    run = gh_api(f"repos/{repo}/actions/runs/{run_id}")
    jobs = gh_api(f"repos/{repo}/actions/runs/{run_id}/jobs?filter=all&per_page=100").get("jobs", [])
    artefacts = gh_api(f"repos/{repo}/actions/runs/{run_id}/artifacts?per_page=100").get("artifacts", [])
    return run, jobs, artefacts


def zip_contents(data: bytes, label: str) -> tuple[dict[str, str], list[str]]:
    """The executables in a candidate artefact zip, by name and sha256, and SHA256SUMS checked."""
    problems: list[str] = []
    found: dict[str, str] = {}
    listed: dict[str, str] = {}
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for member in archive.infolist():
                name = member.filename
                if "/" in name or "\\" in name or name.startswith("."):
                    problems.append(f"{label}: unexpected member {name!r}")
                    continue
                if name.lower().endswith(".exe"):
                    found[name] = sha256_bytes(archive.read(member))
                elif name == "SHA256SUMS":
                    for line in archive.read(member).decode("utf-8").splitlines():
                        if line.strip():
                            digest, _, listed_name = line.partition("  ")
                            listed[listed_name.strip().lstrip("*")] = digest.strip()
    except zipfile.BadZipFile:
        return {}, [f"{label}: not a zip"]
    if found != listed:
        problems.append(f"{label}: SHA256SUMS {listed} disagrees with the files {found}")
    if BINARY not in found or sum(n.endswith("-setup.exe") for n in found) != 1:
        problems.append(f"{label}: expected {BINARY} and exactly one *-setup.exe, found {sorted(found)}")
    return found, problems


def zip_member(data: bytes, name: str) -> bytes | None:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        try:
            return archive.read(name)
        except KeyError:
            return None


def verify_candidate(repo: str, run_id: int | str, commit: str, folder: pathlib.Path, download: bool) -> tuple[dict, list[str]]:
    """Ask GitHub about the run and read what it produced out of digest-checked zips.

    `folder` holds the zips (`<artefact>.zip`); with `download`, they are fetched there first.
    Returns {run, files (copy A), reproduction (copy B), journeys_log, environment} and problems.
    """
    run, jobs, artefacts = fetch_run(repo, run_id)
    problems = judge_run(run, jobs, artefacts, commit, repo)
    if problems:
        return {"run": run}, problems
    by_name = {a["name"]: a for a in artefacts}
    folder.mkdir(parents=True, exist_ok=True)
    blobs: dict[str, bytes] = {}
    for name in required_artefacts(run["id"]):
        path = folder / f"{name}.zip"
        if download:
            path.write_bytes(gh_api(f"repos/{repo}/actions/artifacts/{by_name[name]['id']}/zip", binary=True))
        if not path.is_file():
            problems.append(f"{path.relative_to(ROOT) if path.is_relative_to(ROOT) else path} is missing; fetch the run again")
            continue
        data = path.read_bytes()
        if "sha256:" + sha256_bytes(data) != by_name[name]["digest"]:
            problems.append(f"{name}.zip is not the artefact GitHub holds: {sha256_bytes(data)[:12]} vs {by_name[name]['digest']}")
            continue
        blobs[name] = data
    if problems:
        return {"run": run}, problems
    copy_a, pa = zip_contents(blobs[CANDIDATE_ARTEFACT], "copy A")
    copy_b, pb = zip_contents(blobs[REPRODUCTION_ARTEFACT], "copy B")
    problems += pa + pb
    if not (pa or pb) and copy_a != copy_b:
        problems.append(f"copy B {copy_b} is not copy A {copy_a}")
    journeys = zip_member(blobs[journeys_artefact(run["id"])], "gui-journeys.log")
    if journeys is None:
        problems.append("the journeys artefact has no gui-journeys.log")
    environment = zip_member(blobs[CANDIDATE_ARTEFACT], "build-environment.json")
    return {
        "run": run,
        "files": copy_a,
        "reproduction": copy_b,
        "journeys_log": journeys,
        "environment": json.loads(environment) if environment else {},
        "artefacts": {name: {"id": by_name[name]["id"], "digest": by_name[name]["digest"]} for name in blobs},
        "blobs": blobs,
    }, problems


def load() -> dict | None:
    if not PROVENANCE.exists():
        return None
    try:
        return json.loads(PROVENANCE.read_text("utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def judge_local(record: dict, files: dict[str, str], commit: str | None) -> list[str]:
    """Whether the files in target/ are the ones `record` says the run produced.

    `record` is either the fetch record (a claim, used offline by the manifest to refuse a stale
    record) or what verify_candidate read out of the zips (evidence, used by the gate).
    """
    problems: list[str] = []
    if commit and record.get("head_sha", commit) != commit:
        problems.append(f"the record names commit {record.get('head_sha')}; the artefacts must be {commit}'s")
    claimed = record.get("files") or {}
    if not claimed:
        problems.append("the record lists no files")
    for name, digest in sorted(files.items()):
        if name not in claimed:
            problems.append(f"{name} is in target/ but the run did not produce it")
        elif claimed[name] != digest:
            problems.append(f"{name} hashes to {digest[:12]} here; the run produced {claimed[name][:12]}")
    for name in sorted(set(claimed) - set(files)):
        problems.append(f"{name} was produced by the run but is not in target/")
    reproduced = record.get("reproduction") or {}
    for name, digest in sorted(claimed.items()):
        if reproduced.get(name) != digest:
            problems.append(f"{name}: copy B {str(reproduced.get(name))[:12]} is not copy A {digest[:12]}")
    return problems


def verify_manifest() -> list[str]:
    """CI, at the tag: the manifest's hashes are exactly copy A of a qualifying candidate run of
    the build commit it names. Without this the release workflow would only prove that *some*
    bytes reproduce — not that they are the bytes whose journeys passed and whose copy B matched."""
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    import release_manifest

    claim = release_manifest.read_block()
    if claim is None:
        return ["docs/RELEASE.md has no readable BUILD block."]
    text = release_manifest.RELEASE_DOC.read_text("utf-8")
    found = RUN_IN_MANIFEST.findall(text[text.find(release_manifest.MARKER_START) : text.find(release_manifest.MARKER_END)])
    if len(found) != 1:
        return ["the manifest does not name exactly one candidate run (\"by GitHub Actions run [<id>](...)\"); it was not built by candidate.yml"]
    repo = os.environ.get("GITHUB_REPOSITORY") or repository()
    if repo is None:
        return ["no GitHub repository to ask about the run"]
    with tempfile.TemporaryDirectory() as tmp:
        try:
            verified, problems = verify_candidate(repo, found[0], claim["commit"], pathlib.Path(tmp), download=True)
        except (RuntimeError, OSError, subprocess.TimeoutExpired) as error:
            return [f"could not read run {found[0]}: {error}"]
    if problems:
        return problems
    if verified["files"] != claim["hashes"]:
        return [f"the manifest publishes {claim['hashes']}; candidate run {found[0]} produced {verified['files']}"]
    return []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--verify-manifest", action="store_true", help="the manifest publishes copy A of a qualifying candidate run")
    args = parser.parse_args()
    if not args.verify_manifest:
        parser.print_help()
        return 2
    problems = verify_manifest()
    for problem in problems:
        print(f"provenance: {problem}", file=sys.stderr)
    if problems:
        return 1
    print("docs/RELEASE.md publishes copy A of a qualifying candidate run, byte for byte.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
