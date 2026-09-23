#!/usr/bin/env python3
"""The last check before a GitHub release is created: these files are the manifest's files.

release.yml's `publish` job runs this on the artefact the same run built and verified. It refuses
unless every artefact the manifest in the tag lists is present and hashes to exactly the value the
manifest publishes, nothing else is present, and the tag names the manifest's version. Then it
copies the files it checked — and only those — into the upload directory, writes SHA256SUMS, and
writes the release notes from the manifest itself, so the page a person downloads from states the
same hashes and the same signing status as docs/RELEASE.md.

    python scripts/release_publish.py --from verified --to dist --tag v0.5.0-rc.5 --notes notes.md

Exit codes: 0 ok · 1 refused (a hash, a name, the version or the set of files disagrees) · 2 usage.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import pathlib
import shutil
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import release_manifest  # noqa: E402


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def plan(source: pathlib.Path, tag: str) -> tuple[list[pathlib.Path], list[str]]:
    """The files to publish, and every reason not to. Publish only when the second list is empty."""
    claim = release_manifest.read_block()
    if claim is None:
        return [], ["docs/RELEASE.md has no readable BUILD block; there is nothing to check the files against."]
    problems: list[str] = []
    if tag.removeprefix("v") != claim["version"]:
        problems.append(f"the tag is {tag} but the manifest describes {claim['version']}.")
    if not claim["hashes"]:
        problems.append("the manifest lists no artefacts.")

    found: dict[str, list[pathlib.Path]] = {}
    for path in sorted(source.rglob("*.exe")):
        found.setdefault(path.name, []).append(path)
    chosen: list[pathlib.Path] = []
    for name, expected in sorted(claim["hashes"].items()):
        copies = found.pop(name, [])
        if len(copies) != 1:
            problems.append(f"{name}: expected exactly one copy in {source}, found {len(copies)}.")
            continue
        actual = sha256(copies[0])
        if actual != expected:
            problems.append(f"{name} hashes to {actual}; the manifest publishes {expected}.")
            continue
        chosen.append(copies[0])
    for name in sorted(found):
        problems.append(f"{name} is in the artefact but not in the manifest; it will not be published.")
    return chosen, problems


def notes(tag: str) -> str:
    text = release_manifest.RELEASE_DOC.read_text("utf-8")
    start = text.find(release_manifest.MARKER_START) + len(release_manifest.MARKER_START)
    end = text.find(release_manifest.MARKER_END)
    body = text[start:end].strip()
    run = ""
    if os.environ.get("GITHUB_RUN_ID"):
        run = (
            f"\n\nThese files were built, reproduced against the hashes above and installed on a clean "
            f"runner by {os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/"
            f"{os.environ.get('GITHUB_REPOSITORY', '')}/actions/runs/{os.environ['GITHUB_RUN_ID']}."
        )
    return f"{body}{run}\n\nThe full release record for {tag} is docs/RELEASE.md in the tag.\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--from", dest="source", type=pathlib.Path, required=True)
    parser.add_argument("--to", dest="target", type=pathlib.Path, required=True)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--notes", type=pathlib.Path, required=True)
    args = parser.parse_args()
    if not args.source.is_dir():
        print(f"--from: {args.source} is not a directory", file=sys.stderr)
        return 2

    chosen, problems = plan(args.source, args.tag)
    for problem in problems:
        print(f"refused: {problem}", file=sys.stderr)
    if problems or not chosen:
        return 1

    args.target.mkdir(parents=True, exist_ok=True)
    sums = []
    for path in chosen:
        shutil.copyfile(path, args.target / path.name)
        sums.append(f"{sha256(args.target / path.name)}  {path.name}")
    (args.target / "SHA256SUMS").write_text("\n".join(sums) + "\n", encoding="utf-8", newline="\n")
    args.notes.write_text(notes(args.tag), encoding="utf-8", newline="\n")
    for line in sums:
        print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
