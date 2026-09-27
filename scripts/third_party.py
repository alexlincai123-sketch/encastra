"""What ships inside the binary, and under which licence — generated, not typed.

`docs/THIRD-PARTY.md` lists every crate compiled into the desktop application and every npm
package the shipped frontend depends on, with its version, licence and origin. It is produced
from `cargo metadata` and from the `package.json` of each installed npm package, so it cannot
describe a dependency the tree does not have, and `--check` fails when the committed file no
longer matches the tree — the same rule the conformance matrix and the fuzz corpus follow.

    python scripts/third_party.py            # rewrite docs/THIRD-PARTY.md
    python scripts/third_party.py --check    # exit 1 if docs/THIRD-PARTY.md is stale

Exit codes: 0 ok · 1 stale under --check · 2 a tool this needs is missing.

This is an inventory, not a legal opinion. Which of these licences oblige what, when a
distributed binary links them, is answered in `deny.toml` (the allowlist, with a reason per
entry) and left to a lawyer in `docs/LICENSING.md`.
"""

from __future__ import annotations

import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "THIRD-PARTY.md"
# The crates that end up in the shipped executable: the desktop application and everything it
# pulls in for the Windows target. Development-only tools (the fuzz targets, the CLI used for
# benchmarks) are not part of the installer and are not listed.
SHIPPED_CRATE = "encastra-desktop"
# The npm packages the frontend bundle is built from. Dev dependencies (vite, vitest, biome,
# typescript) run on the build machine and ship nothing.
SHIPPED_NPM_WORKSPACE = ROOT / "apps" / "desktop"


def cargo_metadata() -> dict:
    try:
        out = subprocess.run(
            ["cargo", "metadata", "--format-version", "1", "--filter-platform", "x86_64-pc-windows-msvc"],
            cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True,
        )
    except (OSError, subprocess.CalledProcessError) as error:
        print(f"cargo metadata failed: {error}", file=sys.stderr)
        raise SystemExit(2) from error
    return json.loads(out.stdout)


def crates_shipped(metadata: dict) -> list[dict]:
    """Every package reachable from the desktop crate through normal (non-dev, non-build)
    dependencies for the Windows target, workspace crates excluded."""
    by_id = {package["id"]: package for package in metadata["packages"]}
    nodes = {node["id"]: node for node in metadata["resolve"]["nodes"]}
    root = next(package["id"] for package in metadata["packages"] if package["name"] == SHIPPED_CRATE)
    seen: set[str] = set()
    stack = [root]
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.add(current)
        for dep in nodes[current]["deps"]:
            # A dependency that is only ever a dev or build dependency does not reach the binary.
            kinds = {(kind.get("kind") or "normal") for kind in dep["dep_kinds"]}
            if "normal" in kinds:
                stack.append(dep["pkg"])
    workspace = set(metadata["workspace_members"])
    found = [by_id[package_id] for package_id in seen if package_id not in workspace]
    return sorted(found, key=lambda package: (package["name"], package["version"]))


def npm_shipped() -> list[dict]:
    """Production dependencies of the desktop frontend, transitively, from the installed tree."""
    lock = json.loads((ROOT / "package-lock.json").read_text("utf-8"))
    packages = lock["packages"]
    workspace_key = SHIPPED_NPM_WORKSPACE.relative_to(ROOT).as_posix()
    root_deps = list((packages[workspace_key].get("dependencies") or {}).keys())
    seen: dict[str, dict | None] = {}

    def locate(name: str, from_path: str) -> str | None:
        # Node's resolution: nearest node_modules walking up from the dependant.
        base = from_path
        while True:
            candidate = f"{base}/node_modules/{name}" if base else f"node_modules/{name}"
            if candidate in packages:
                return candidate
            if not base:
                return None
            base = base.rsplit("/node_modules/", 1)[0] if "/node_modules/" in base else ""

    stack = [(name, workspace_key) for name in root_deps]
    while stack:
        name, from_path = stack.pop()
        path = locate(name, from_path)
        if path is None or path in seen:
            continue
        entry = packages[path]
        if entry.get("dev"):
            continue
        if entry.get("link"):
            # A workspace package (`packages/protocol`) symlinked into node_modules: ours, not
            # third-party. Its own dependencies still ship, so walk them from the real path.
            target = entry["resolved"]
            seen[path] = None  # visited, never listed
            for dep in (packages.get(target, {}).get("dependencies") or {}):
                stack.append((dep, target))
            continue
        manifest_path = ROOT / path / "package.json"
        licence = "?"
        repository = ""
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text("utf-8"))
            licence = manifest.get("license") or manifest.get("licenses") or "?"
            if isinstance(licence, list):
                licence = " OR ".join(item.get("type", "?") if isinstance(item, dict) else str(item) for item in licence)
            elif isinstance(licence, dict):
                licence = licence.get("type", "?")
            repo = manifest.get("repository")
            repository = repo.get("url", "") if isinstance(repo, dict) else (repo or "")
        seen[path] = {
            "name": name,
            "path": path,
            "version": entry.get("version", "?"),
            "license": str(licence),
            "source": repository or entry.get("resolved", ""),
        }
        for dep in (entry.get("dependencies") or {}):
            stack.append((dep, path))
        for dep in (entry.get("optionalDependencies") or {}):
            stack.append((dep, path))
    return sorted((item for item in seen.values() if item is not None), key=lambda item: (item["name"], item["version"]))


def render(crates: list[dict], npm: list[dict]) -> str:
    lines = [
        "# Third-party software in the shipped application",
        "",
        "Generated by `scripts/third_party.py` from `cargo metadata` (Windows target, normal",
        "dependencies of the desktop crate) and from the installed npm tree (production",
        "dependencies of the desktop frontend). Do not edit by hand; CI checks that this file",
        "matches the tree. The full licence texts these packages carry are in",
        "`docs/THIRD-PARTY-LICENSES.md`, which the installer ships beside this file. `deny.toml` is",
        "the allowlist every Rust licence below had to pass.",
        "",
        "This is an inventory, not a legal opinion — see `docs/LICENSING.md`.",
        "",
        f"## Rust crates compiled into `encastra-desktop.exe` ({len(crates)})",
        "",
        "| Crate | Version | Licence | Origin |",
        "|---|---|---|---|",
    ]
    for package in crates:
        origin = package.get("repository") or (package.get("source") or "").replace("registry+", "")
        lines.append(f"| {package['name']} | {package['version']} | {package.get('license') or '?'} | {origin} |")
    lines += [
        "",
        f"## npm packages bundled into the desktop frontend ({len(npm)})",
        "",
        "| Package | Version | Licence | Origin |",
        "|---|---|---|---|",
    ]
    for item in npm:
        lines.append(f"| {item['name']} | {item['version']} | {item['license']} | {item['source']} |")
    lines.append("")
    return "\n".join(lines)


TEXTS_OUT = ROOT / "docs" / "THIRD-PARTY-LICENSES.md"
SUPPLEMENT = ROOT / "docs" / "third-party-licences"
# The files a package ships its terms in. MIT, BSD and Apache-2.0 ask for their text (and any
# NOTICE) to travel with a binary that includes the code, so the text is copied, not named.
LICENCE_FILE_PREFIXES = ("license", "licence", "copying", "notice", "unlicense")


def licence_texts(directory: pathlib.Path, declared: str | None = None) -> list[tuple[str, str]]:
    """(file name, text) for every licence-like file at the top of a package, in name order.
    `declared` is a manifest's own `license-file`, relative to the package."""
    if not directory.is_dir():
        return []
    files = {path for path in directory.iterdir() if path.is_file() and path.name.lower().startswith(LICENCE_FILE_PREFIXES)}
    if declared and (directory / declared).is_file():
        files.add(directory / declared)
    out = []
    for path in sorted(files, key=lambda p: p.name.lower()):
        text = path.read_bytes().decode("utf-8", errors="replace").replace("\r\n", "\n").strip("\n").rstrip()
        if text:
            out.append((path.name, text))
    return out


def render_texts(crates: list[dict], npm: list[dict]) -> str:
    """Every licence text the shipped packages carry, each distinct text once, with who uses it."""
    import hashlib

    groups: dict[str, dict] = {}
    missing: list[str] = []
    entries = [
        (f"{p['name']} {p['version']} (crate, {p.get('license') or '?'})",
         licence_texts(pathlib.Path(p["manifest_path"]).parent, p.get("license_file")))
        for p in crates
    ] + [
        (f"{item['name']} {item['version']} (npm, {item['license']})", licence_texts(ROOT / item["path"]))
        for item in npm
    ]
    for index, (who, texts) in enumerate(entries):
        if not texts:
            # A package published without its licence file: the text kept in the repository, taken
            # from the package's upstream source (SOURCE.txt beside it says exactly where).
            name = who.split(" ", 1)[0]
            texts = licence_texts(SUPPLEMENT / name)
            texts = [(file, text) for file, text in texts if file != "SOURCE.txt"]
            if texts:
                who = f"{who} [text from upstream: docs/third-party-licences/{name}/SOURCE.txt]"
        if not texts:
            missing.append(who)
        for name, text in texts:
            key = hashlib.sha256(text.encode("utf-8")).hexdigest()
            group = groups.setdefault(key, {"text": text, "names": set(), "users": []})
            group["names"].add(name)
            group["users"].append(who)
    lines = [
        "# Licence texts of the third-party software in the shipped application",
        "",
        "Generated by `scripts/third_party.py` from the licence files each package ships (the same",
        "packages as `docs/THIRD-PARTY.md`). Do not edit by hand; CI checks that this file matches the",
        "tree. Each distinct text appears once, followed by the packages that carry it.",
        "",
    ]
    if missing:
        lines += [
            f"## Packages that ship no licence file ({len(missing)})",
            "",
            "Their licence is the one their manifest names (in parentheses); the published package",
            "carries no text of it.",
            "",
            *[f"- {who}" for who in sorted(missing)],
            "",
        ]
    ordered = sorted(groups.values(), key=lambda g: (sorted(g["users"])[0], sorted(g["names"])[0]))
    for number, group in enumerate(ordered, 1):
        users = sorted(set(group["users"]))
        lines += [
            f"## Text {number}: {', '.join(sorted(group['names']))}",
            "",
            "Used by: " + "; ".join(users),
            "",
            "~~~~text",
            group["text"],
            "~~~~",
            "",
        ]
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    check = "--check" in argv
    crates, npm = crates_shipped(cargo_metadata()), npm_shipped()
    outputs = {OUT: render(crates, npm), TEXTS_OUT: render_texts(crates, npm)}
    if check:
        stale = [path for path, text in outputs.items() if (path.read_text("utf-8") if path.exists() else "") != text]
        for path in stale:
            print(f"{path.relative_to(ROOT)} is stale; run `python scripts/third_party.py`.", file=sys.stderr)
        if stale:
            return 1
        print(f"{OUT.relative_to(ROOT)} and {TEXTS_OUT.relative_to(ROOT)} match the tree.")
        return 0
    for path, text in outputs.items():
        path.write_text(text, encoding="utf-8", newline="\n")
        print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
