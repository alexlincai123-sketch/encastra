#!/usr/bin/env python3
"""Describes what a build produced, checks whether it is signed, and writes it down.

Run after `npm run tauri:build`. It finds the artefacts, hashes them, asks Windows whether each
one carries a valid Authenticode signature, and regenerates the "this build" section of
docs/RELEASE.md.

The hashes matter because an installer nobody can verify is an installer that can be swapped on
the way to somebody. But a hash published on the same site that serves the installer proves
nothing against whoever can change both; it is what you have until releases are signed, not a
substitute for signing them.

So this also refuses. `--require-signature` exits non-zero unless every artefact is signed, and
that is what the release workflow passes. Shipping unsigned then becomes a deliberate act with
`--allow-unsigned`, recorded in the manifest, rather than the silent default it was — this script
used to state "not code-signed" as a fact of life and exit 0 either way. And `--allow-unsigned`
is only accepted for a pre-release version: a `1.0.0` cannot be published unsigned by anybody,
because the one time it matters most is the one time nobody should be able to.

The commit it names is the one the binary says it was built from. `build.rs` embeds the commit
in the executable; this reads it back out and refuses if it is missing, marked dirty, or not the
commit the tree is at. It used to ask git at manifest time, which named the commit *before* the
one that carries the manifest — every published commit was one behind (ENC-NEW-17). The
commit that produced the bytes is the **build commit**; the commit that records the hashes is the
**publication commit**, always a later one, and `--verify` checks that the two differ only in the
files a publication is allowed to touch.

Usage:
    python scripts/release_manifest.py                      # describe, refusing a build no commit explains
    python scripts/release_manifest.py --require-signature  # fail unless everything is signed
    python scripts/release_manifest.py --allow-unsigned     # deliberate unsigned pre-release
    python scripts/release_manifest.py --verify             # the manifest on disk matches the artefacts and the history

Exit codes: 0 ok · 1 no artefacts, or unsigned under --require-signature · 2 usage ·
3 unsigned production refused · 4 provenance (stamp missing, dirty, unknown, or not HEAD; or an
installer in target/ that is not from this build: another version in its name, no version in its
name, or older than the binary) · 5 --verify found a disagreement.
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

# Tests point this at a fixture repository; nothing else should.
ROOT = pathlib.Path(os.environ.get("ENCASTRA_RELEASE_ROOT") or pathlib.Path(__file__).resolve().parent.parent)
BUNDLE = ROOT / "target" / "release" / "bundle"
# Cargo names the executable after the crate, not after the product. Guessing "Encastra.exe"
# meant the binary was silently left out of the manifest while the installer still appeared.
BINARY = ROOT / "target" / "release" / "encastra-desktop.exe"
RELEASE_DOC = ROOT / "docs" / "RELEASE.md"
# The website's copy of the same facts (download page). Written here too, so the two cannot
# disagree by hand; `--verify` checks that they do not.
SITE_CONFIG = ROOT / "apps/web/src/config/site.ts"
TAURI_CONFIG = ROOT / "apps/desktop/src-tauri/tauri.conf.json"

MARKER_START = "<!-- BUILD:START -->"
MARKER_END = "<!-- BUILD:END -->"

# What the binary carries, put there by apps/desktop/src-tauri/build.rs and lib.rs.
STAMP = re.compile(rb"encastra-build-commit=([0-9a-f]{40}(?:-dirty)?|unknown);")

# The only files a publication commit may change relative to the build commit it describes.
# Anything else means the published hashes describe a tree that is not the one tagged.
PUBLICATION_FILES = frozenset({"docs/RELEASE.md", "apps/web/src/config/site.ts"})


def is_publication_change(path: str) -> bool:
    """Whether a file changed after the build commit leaves the published hashes true.

    The publication files themselves, and the written record of the release: Markdown under
    `docs/` — the readiness report, the audits, the session notes that name the tag they could
    not name before it existed. None of it is compiled into anything. Everything else — source,
    scripts, workflows, configuration, lockfiles, the website's code — is a tree the hashes do
    not describe, and needs a new version and a new build.
    """
    return path in PUBLICATION_FILES or (path.startswith("docs/") and path.endswith(".md"))

# What Windows says about a file's signature, mapped to what it means for a release.
SIGNED = "signed"
UNSIGNED = "unsigned"
BROKEN = "broken"
UNCHECKED = "unchecked"

EXIT_OK = 0
EXIT_REFUSED = 1
EXIT_USAGE = 2
EXIT_PRODUCTION_UNSIGNED = 3
EXIT_PROVENANCE = 4
EXIT_VERIFY = 5


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        # Hashed in chunks: an installer is tens of megabytes and there is no reason to hold
        # all of it in memory to produce 32 bytes.
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def human(size: int) -> str:
    megabytes = size / (1024 * 1024)
    return f"{megabytes:.1f} MB"


def version() -> str:
    config = json.loads(TAURI_CONFIG.read_text("utf-8"))
    return str(config["version"])


def is_prerelease(number: str) -> bool:
    """`0.5.0-beta.1` is; `0.5.0` is not. SemVer: a hyphen after the patch number."""
    return re.match(r"^\d+\.\d+\.\d+-", number) is not None


def git(*args: str) -> str | None:
    try:
        out = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    return out.stdout.strip()


def stamp_in(path: pathlib.Path) -> str | None:
    """The commit the binary says it was built from, or None if it does not say."""
    found = STAMP.search(path.read_bytes())
    return found.group(1).decode("ascii") if found else None


def provenance_problems(binary: pathlib.Path) -> list[str]:
    """Why this binary cannot be described by a commit, if it cannot. Empty means it can."""
    stamp = stamp_in(binary)
    if stamp is None:
        return [
            f"{binary.name} carries no build stamp. It was not built by this tree's build.rs, "
            "or it is not the binary that was built."
        ]
    if stamp == "unknown":
        return [f"{binary.name} was built without git available, so no commit describes it."]
    if stamp.endswith("-dirty"):
        return [
            f"{binary.name} was built from {stamp[:-6]} with uncommitted changes; no commit "
            "describes those bytes. Commit, rebuild, and run this again."
        ]
    head = git("rev-parse", "HEAD")
    if head is None:
        return ["git cannot say which commit this tree is at."]
    if stamp != head:
        return [
            f"{binary.name} was built from {stamp} but the tree is at {head}. Rebuild from the "
            "current commit, or check out the one the binary came from."
        ]
    return []


def signature(path: pathlib.Path) -> tuple[str, str]:
    """Asks Windows about a file's Authenticode signature.

    Returns the state and a description of who signed it, if anyone.

    Only Windows can answer this, so on any other platform the answer is `UNCHECKED` — which
    `--require-signature` treats as a refusal rather than as a pass. A release job that cannot
    verify a signature has not verified one.

    The path goes through the environment rather than into the command string. It is our own
    build output and not hostile, but a script that interpolates a filesystem path into a shell
    is a habit that eventually meets a path with a quote in it.
    """
    if platform.system() != "Windows":
        return UNCHECKED, "this platform cannot check Authenticode"

    command = (
        "$s = Get-AuthenticodeSignature -LiteralPath $env:ENCASTRA_ARTEFACT; "
        'Write-Output "$($s.Status)|$($s.SignerCertificate.Subject)"'
    )
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", command],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
            env={**os.environ, "ENCASTRA_ARTEFACT": str(path)},
        )
    except Exception as error:
        return UNCHECKED, f"could not be checked ({type(error).__name__})"

    status, _, subject = out.stdout.strip().partition("|")
    subject = subject.strip() or "no certificate"

    if status == "Valid":
        return SIGNED, subject
    if status == "NotSigned":
        return UNSIGNED, "not signed"
    # HashMismatch, NotTrusted, UnknownError: a signature that is present and does not check out
    # is worse news than no signature, and must never be reported as merely unsigned.
    return BROKEN, f"{status} — {subject}"


# Tauri names an installer after the product and the version it was built from:
# `Encastra_0.5.0-beta.1_x64-setup.exe`, `Encastra_0.5.0-beta.1_x64_en-US.msi`. The version is the
# only thing an installer states about itself that this script can read without unpacking it.
VERSION_IN_NAME = re.compile(r"_(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)_")


def artefact_problems(files: list[pathlib.Path], binary: pathlib.Path) -> list[str]:
    """Installers under target/ that are not from the build that produced the binary.

    `cargo`/`tauri build` never delete the previous build's installer. A `0.4.0` setup left in
    `bundle/nsis/` beside the new `0.5.0` one was once listed in the manifest as if it were part
    of the release, under the new build commit's name. So an installer is refused when its name
    carries a version other than the tree's, when it carries no version at all (nothing states
    what it is), or when it is older than the binary it claims to contain — the bundler writes
    the installer after the executable, never before.
    """
    problems: list[str] = []
    current = version()
    binary_mtime = binary.stat().st_mtime if binary.exists() else None
    for path in files:
        if path == binary:
            continue
        found = VERSION_IN_NAME.search(path.name)
        if found is None:
            problems.append(
                f"{path.name} carries no version in its name; nothing states which build it is "
                "from. Delete it from target/ if it is not this build's, or rebuild."
            )
            continue
        if found.group(1) != current:
            problems.append(
                f"{path.name} is a {found.group(1)} installer but the tree is at {current}. It is "
                "left over from another build; delete it from target/ or rebuild."
            )
            continue
        if binary_mtime is not None and path.stat().st_mtime + 1 < binary_mtime:
            problems.append(
                f"{path.name} is older than {binary.name}; the bundler writes the installer after "
                "the executable, so this installer is not from this build. Rebuild."
            )
    return problems


def artefacts() -> list[pathlib.Path]:
    """Installers and the executable, in the order a person cares about them."""
    found: list[pathlib.Path] = []
    if BUNDLE.exists():
        for pattern in ("nsis/*.exe", "msi/*.msi", "deb/*.deb", "appimage/*.AppImage", "dmg/*.dmg"):
            found.extend(sorted(BUNDLE.glob(pattern)))
    if BINARY.exists():
        found.append(BINARY)
    return found


def tool_version(command: list[str]) -> str:
    """`<tool> --version`, or `<tool> unknown` if it is not there. Never raises."""
    try:
        out = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True,
            shell=platform.system() == "Windows",
        )
        return out.stdout.strip().splitlines()[0]
    except Exception:
        return f"{command[0]} unknown"


def toolchain() -> str:
    """What built it, for whoever wants to build it again and compare."""
    return f"{tool_version(['rustc', '--version'])} · node {tool_version(['node', '--version'])}"


def describe_signing(states: dict[pathlib.Path, tuple[str, str]], allow_unsigned: bool) -> list[str]:
    """The paragraph under the table, which has to say what is actually true of this build."""
    kinds = {state for state, _ in states.values()}

    if kinds == {SIGNED}:
        signers = sorted({who for state, who in states.values() if state == SIGNED})
        return [
            "These builds are code-signed. Windows will show the publisher below rather than an "
            "unrecognised-publisher warning, and a file that has been altered after signing will "
            "fail its own signature check before it reaches the hash above.",
            "",
            *[f"Signed by: `{signer}`" for signer in signers],
        ]

    if BROKEN in kinds:
        return [
            "**One or more artefacts carry a signature that does not verify.** That is a worse "
            "state than unsigned: something is claiming a publisher it cannot prove. Do not "
            "distribute this build. See the Signature column above.",
        ]

    warning = [
        "These builds are **not code-signed**, so Windows SmartScreen will warn about an "
        "unrecognised publisher. That warning is accurate: nothing here proves who built the "
        "file. The hash above is what you have instead, and it is worth checking — with the "
        "caveat that a hash published beside the download is only as trustworthy as the site "
        "serving both.",
    ]
    if allow_unsigned:
        warning += [
            "",
            "This build was published unsigned deliberately (`--allow-unsigned`). See "
            "docs/SIGNING.md for what is needed to stop doing that.",
        ]
    return warning


def render_block(
    files: list[pathlib.Path], states: dict[pathlib.Path, tuple[str, str]], commit: str, allow_unsigned: bool
) -> str:
    lines = [
        MARKER_START,
        "",
        f"**Version {version()}** · built {datetime.date.today().isoformat()} on "
        f"{platform.system()} {platform.machine()} · build commit `{commit}`",
        "",
        f"Toolchain: {toolchain()}. Two builds of the build commit with this toolchain produce "
        "these exact bytes; `scripts/pe_diff.py` says how they differ if they do not.",
        "",
        "| Artefact | Size | Signature | SHA-256 |",
        "|---|---|---|---|",
    ]

    for path in files:
        state, detail = states[path]
        shown = {
            SIGNED: f"signed — {detail}",
            UNSIGNED: "**not signed**",
            BROKEN: f"**{detail}**",
            UNCHECKED: f"unchecked — {detail}",
        }[state]
        lines.append(
            f"| `{path.name}` | {human(path.stat().st_size)} | {shown} | `{sha256(path)}` |"
        )

    lines += [
        "",
        "Verify before installing:",
        "",
        "```powershell",
        f"Get-FileHash .\\{files[0].name} -Algorithm SHA256",
        f"Get-AuthenticodeSignature .\\{files[0].name}",
        "```",
        "",
        *describe_signing(states, allow_unsigned),
        "",
        MARKER_END,
    ]
    return "\n".join(lines)


def write_block(block: str) -> bool:
    """Replaces the BUILD block in docs/RELEASE.md. False if the document has no markers."""
    if not RELEASE_DOC.exists():
        return False
    existing = RELEASE_DOC.read_text("utf-8")
    if MARKER_START not in existing or MARKER_END not in existing:
        return False
    updated = re.sub(
        re.escape(MARKER_START) + r".*?" + re.escape(MARKER_END),
        # A function, not the string: as a replacement string, the backslashes in a
        # Windows path are read as escapes, and `.\Encastra...` fails outright.
        lambda _match: block,
        existing,
        flags=re.S,
    )
    RELEASE_DOC.write_text(updated, encoding="utf-8", newline="\n")
    return True


SITE_FIELDS = (
    "installerFilename", "installerVersion", "installerSize", "installerSha256",
    "binaryFilename", "binarySize", "binarySha256", "builtOn", "builtFor", "commit", "signed",
)


def site_field(name: str) -> re.Pattern[str]:
    """`  name: 'value',` or `  name: true,` inside `export const RELEASE`; only the value is replaced."""
    return re.compile(rf"(^\s*{name}:\s*)('[^']*'|true|false)(,)", re.M)


def site_values(files: list[pathlib.Path], states: dict, commit: str) -> dict[str, str]:
    installers = [path for path in files if path != BINARY]
    installer = installers[0] if installers else None
    values = {
        "builtOn": repr(datetime.date.today().isoformat()),
        "builtFor": repr(f"{platform.system()} {platform.machine()}"),
        "commit": repr(commit),
        "signed": "true" if all(state == SIGNED for state, _ in states.values()) else "false",
    }
    if installer is not None:
        values |= {
            "installerFilename": repr(installer.name),
            "installerVersion": repr(version()),
            "installerSize": repr(human(installer.stat().st_size)),
            "installerSha256": repr(sha256(installer)),
        }
    if BINARY in files:
        values |= {
            "binaryFilename": repr(BINARY.name),
            "binarySize": repr(human(BINARY.stat().st_size)),
            "binarySha256": repr(sha256(BINARY)),
        }
    return values


def write_site(values: dict[str, str]) -> bool:
    """Updates the RELEASE constant in site.ts. False if the file or a field is not there."""
    if not SITE_CONFIG.exists():
        return False
    text = SITE_CONFIG.read_text("utf-8")
    for name, value in values.items():
        text, count = site_field(name).subn(
            lambda m, v=value: f"{m.group(1)}{v}{m.group(3)}", text, count=1
        )
        if count != 1:
            return False
    SITE_CONFIG.write_text(text, encoding="utf-8", newline="\n")
    return True


def read_site() -> dict[str, str] | None:
    if not SITE_CONFIG.exists():
        return None
    text = SITE_CONFIG.read_text("utf-8")
    found = {}
    for name in SITE_FIELDS:
        match = site_field(name).search(text)
        if not match:
            return None
        found[name] = match.group(2).strip("'")
    return found


def read_block() -> dict | None:
    """What the manifest on disk claims: version, build commit, and a hash per artefact name."""
    if not RELEASE_DOC.exists():
        return None
    text = RELEASE_DOC.read_text("utf-8")
    start, end = text.find(MARKER_START), text.find(MARKER_END)
    if start < 0 or end < 0:
        return None
    block = text[start:end]
    head = re.search(r"\*\*Version ([^*]+)\*\*.*?build commit `([0-9a-f]{40})`", block, re.S)
    if not head:
        return None
    hashes = {
        name: digest
        for name, digest in re.findall(r"^\| `([^`]+)` \| [^|]+ \| [^|]+ \| `([0-9a-f]{64})` \|$", block, re.M)
    }
    return {"version": head.group(1).strip(), "commit": head.group(2), "hashes": hashes}


def verify() -> list[str]:
    """Every way the manifest on disk could be lying about the artefacts or the history."""
    claim = read_block()
    if claim is None:
        return ["docs/RELEASE.md has no readable BUILD block (version, build commit, table)."]
    problems: list[str] = []
    commit = claim["commit"]

    if git("cat-file", "-e", f"{commit}^{{commit}}") is None:
        return [f"the manifest names build commit {commit}, which this repository does not have."]
    head = git("rev-parse", "HEAD") or ""
    ancestor = subprocess.run(
        ["git", "merge-base", "--is-ancestor", commit, "HEAD"], cwd=ROOT, capture_output=True
    )
    if ancestor.returncode != 0:
        problems.append(f"build commit {commit} is not an ancestor of HEAD {head}.")

    # While the tree still carries the version the manifest describes, the only thing that may
    # have changed since the build commit is the publication itself. After a version bump the
    # manifest describes a previous release and the rule no longer applies.
    current = version()
    if claim["version"] != current:
        problems.append(
            f"the manifest describes {claim['version']} but the tree is at {current}; "
            "a new build needs a new manifest."
        )
    elif head and head != commit:
        changed = set((git("diff", "--name-only", commit, "HEAD") or "").split())
        extra = sorted(path for path in changed if not is_publication_change(path))
        if extra:
            problems.append(
                f"since build commit {commit} the tree changed more than a publication may: "
                + ", ".join(extra)
                + ". The published hashes describe a tree that is not this one."
            )

    # If the artefacts are here, they must be the ones the table describes, byte for byte, and
    # the binary must say it came from the commit the table names.
    for path in artefacts():
        if path.name not in claim["hashes"]:
            problems.append(f"{path.name} is in target/ but not in the manifest.")
            continue
        actual = sha256(path)
        if actual != claim["hashes"][path.name]:
            problems.append(
                f"{path.name} hashes to {actual}, the manifest says {claim['hashes'][path.name]}."
            )
    if BINARY.exists():
        stamp = stamp_in(BINARY)
        if stamp != commit:
            problems.append(f"{BINARY.name} states build commit {stamp!r}; the manifest names {commit}.")

    # The website says the same things in its own file, and a download page that shows one
    # build's hash under another build's version is the lie this whole script exists to prevent.
    site = read_site()
    if site is not None:
        if site["commit"] != commit:
            problems.append(f"site.ts names commit {site['commit']!r}; the manifest names {commit}.")
        if site["installerVersion"] != claim["version"]:
            problems.append(
                f"site.ts says version {site['installerVersion']!r}; the manifest says {claim['version']!r}."
            )
        for field, name in (("installerSha256", site["installerFilename"]), ("binarySha256", site["binaryFilename"])):
            if name in claim["hashes"] and site[field] != claim["hashes"][name]:
                problems.append(
                    f"site.ts {field} is {site[field]}; the manifest says {claim['hashes'][name]} for {name}."
                )
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--require-signature",
        action="store_true",
        help="exit non-zero unless every artefact carries a valid signature",
    )
    parser.add_argument(
        "--allow-unsigned",
        action="store_true",
        help="publish a pre-release unsigned on purpose, and say so in the manifest",
    )
    parser.add_argument(
        "--build-commit",
        action="store_true",
        help="print the build commit the manifest on disk names, and nothing else",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="check the manifest on disk against the artefacts and the history instead of writing it",
    )
    args = parser.parse_args()

    if args.require_signature and args.allow_unsigned:
        print("--require-signature and --allow-unsigned contradict each other.", file=sys.stderr)
        return EXIT_USAGE

    if args.build_commit:
        claim = read_block()
        if claim is None:
            print("docs/RELEASE.md has no readable BUILD block.", file=sys.stderr)
            return EXIT_VERIFY
        print(claim["commit"])
        return EXIT_OK

    if args.verify:
        problems = verify()
        for problem in problems:
            print(f"verify: {problem}", file=sys.stderr)
        if problems:
            return EXIT_VERIFY
        claim = read_block() or {}
        print(f"docs/RELEASE.md describes {claim.get('version')} at build commit {claim.get('commit')}: consistent.")
        return EXIT_OK

    # The one guard with no override: a version that is not a pre-release is a production
    # release, and a production release is signed or it does not happen.
    current = version()
    if args.allow_unsigned and not is_prerelease(current):
        print(
            f"Refusing: {current} is not a pre-release, and a production release is not published "
            "unsigned. There is no flag for that. See docs/SIGNING.md.",
            file=sys.stderr,
        )
        return EXIT_PRODUCTION_UNSIGNED

    files = artefacts()
    if not files:
        print(f"No build artefacts under {BUNDLE}.", file=sys.stderr)
        print("Run `npm run tauri:build` first.", file=sys.stderr)
        return EXIT_REFUSED

    if not BINARY.exists():
        print(f"{BINARY} is missing; nothing states which commit the installer came from.", file=sys.stderr)
        return EXIT_PROVENANCE
    problems = provenance_problems(BINARY) + artefact_problems(files, BINARY)
    if problems:
        for problem in problems:
            print(f"Refusing: {problem}", file=sys.stderr)
        return EXIT_PROVENANCE
    commit = stamp_in(BINARY) or ""

    states = {path: signature(path) for path in files}
    block = render_block(files, states, commit, args.allow_unsigned)

    # The refusal happens before the document is written. A manifest describing a release that
    # is not allowed to happen is a file somebody later mistakes for a release that did.
    unsigned = [path for path, (state, _) in states.items() if state != SIGNED]
    # No flag reaches past this one. `--allow-unsigned` was already refused for a production
    # version above; a bare invocation on unsigned production artefacts used to write the
    # manifest and exit 0, which made the documented rule true only for people who passed a flag.
    if unsigned and not is_prerelease(current):
        print(
            f"Refusing: {current} is not a pre-release and these artefacts are not signed. A "
            "production release is signed or it does not happen; there is no flag for that.",
            file=sys.stderr,
        )
        for path in unsigned:
            state, detail = states[path]
            print(f"  {path.relative_to(ROOT)}: {state} ({detail})", file=sys.stderr)
        return EXIT_PRODUCTION_UNSIGNED
    if args.require_signature and unsigned:
        print("Refusing to publish: these artefacts are not signed.", file=sys.stderr)
        for path in unsigned:
            state, detail = states[path]
            print(f"  {path.relative_to(ROOT)}: {state} ({detail})", file=sys.stderr)
        print(
            "\nSee docs/SIGNING.md. To publish a pre-release unsigned on purpose, pass "
            "--allow-unsigned instead, which records that choice in the manifest.",
            file=sys.stderr,
        )
        return EXIT_REFUSED

    if write_block(block):
        print(f"Updated {RELEASE_DOC.relative_to(ROOT)} for build commit {commit}")
        if write_site(site_values(files, states, commit)):
            print(f"Updated {SITE_CONFIG.relative_to(ROOT)}")
        else:
            print(
                f"{SITE_CONFIG.relative_to(ROOT)} not updated: file or a RELEASE field missing",
                file=sys.stderr,
            )
        for path in files:
            state, detail = states[path]
            print(f"  {path.relative_to(ROOT)}  {human(path.stat().st_size)}  [{state}]")
        return EXIT_OK

    print("docs/RELEASE.md has no BUILD markers; printing the block instead:\n")
    print(block)
    return EXIT_OK


if __name__ == "__main__":
    raise SystemExit(main())
