# Release security

What has to be true of an installer before it goes anywhere, what enforces it, and what is still
missing. `docs/RELEASE.md` describes how to produce a build; this describes what is allowed to
leave.

## The chain

```
source  →  security gates  →  build  →  signature check  →  hash  →  artefact
             (fails red)                  (refuses)        (published)
```

Nothing after a failing gate runs. `.github/workflows/release.yml` re-runs every gate itself
rather than trusting that CI passed on the commit: a tag can point at a commit whose CI run was
cancelled, was never required, or predates a settings change. "It passed once" is not a property
of the thing being shipped.

The gates, in order, all blocking:

| Gate | Command |
|---|---|
| Lint | `npm run lint` |
| Types | `npm run typecheck` |
| TypeScript tests | `npm run test` |
| One version everywhere | `python3 scripts/version.py --check` |
| Format | `cargo fmt --all --check` |
| Clippy, warnings as errors | `cargo clippy --workspace --all-targets -- -D warnings` |
| Rust tests, security suite included | `cargo test --workspace` |
| Symlink escape tests actually ran | grep for `skipped` in their output |
| npm advisories | `npm audit --audit-level=high` |
| Rust advisories, bans, licences, sources | `cargo deny check` |
| Secrets, full history | `gitleaks` |

### Why a skip is a failure

Two security tests build their fixture with a symlink and return early where the platform will
not create one — on Windows, without Developer Mode or `SeCreateSymbolicLinkPrivilege`. That is
honest behaviour for a test and it is exactly how a control ends up covered by nothing: a skip and
a pass are the same colour in every dashboard.

So CI greps for it. On Linux the symlink tests must run; on Windows the startup-folder refusal
must run. Both gates were checked against a real skip, not only against a pass — a gate that has
only ever seen the passing case is a gate nobody has tested.

## Signing

**Status: prepared, not done. Nothing released so far is signed.**

`scripts/release_manifest.py` asks Windows about each artefact's Authenticode signature, records
the answer in the published table, and `--require-signature` exits non-zero unless every artefact
is signed. It treats "this platform cannot check" as a refusal rather than as a pass: a release
job that could not verify a signature has not verified one.

That flag is what the release workflow passes by default. Publishing unsigned now takes an
explicit `allow_unsigned` input on the workflow, which prints a warning and is recorded in the
manifest — a decision somebody makes, rather than what happens when nobody does anything.

Verified against the real 0.4.0-beta.1 installer on 2026-09-15: it correctly refuses.

### What is needed to stop refusing

1. **A certificate.** OV, EV, or Azure Trusted Signing. `docs/SIGNING.md` compares them on cost,
   SmartScreen behaviour and key storage. This is a purchase, not a patch.
2. **Two repository secrets**: `WINDOWS_CERTIFICATE` (the `.pfx`, base64) and
   `WINDOWS_CERTIFICATE_PASSWORD`. The release workflow already reads them. With them absent it
   skips the import step, the build comes out unsigned, and the manifest step refuses — which is
   the current state and is correct.
3. Nothing else. The workflow imports the certificate into the runner's store, writes the
   thumbprint into `tauri.conf.json` for that build only, and restores the file afterwards. The
   `.pfx` is written outside the working directory and deleted immediately; the thumbprint is
   never committed.

**The key never goes in the repository, in an environment variable printed to a log, or in a
build artefact.** If a certificate is ever exposed, it is revoked, not rotated quietly.

### What a signature would and would not buy

It would let somebody who downloads an installer establish that it came from whoever holds that
certificate and has not been altered since. It would replace the SmartScreen "unrecognised
publisher" warning with a publisher name.

It would not mean the software is safe, and the release notes must not imply that it does. A
signature is an identity claim, not a security review.

## Hashes, and their limits

Every artefact's SHA-256 goes into `docs/RELEASE.md`. Until releases are signed this is the only
integrity check a person has.

It is weaker than it looks, and the document says so: a hash published beside the download is
only as trustworthy as the site serving both. Anybody who can replace the installer can replace
the number next to it. It defends against a corrupted download and against a mirror; it does not
defend against a compromised release.

**One gotcha, already documented in `docs/RELEASE.md`:** the installed binary's hash differs from
the raw build output by three bytes, because Tauri patches a bundle-type marker into the
executable. Only the installer hash is worth comparing.

## Licence decisions on record

`cargo deny check` enforces an allow-list. One entry on it is a decision rather than a formality
and is recorded here so it is not re-decided by accident:

**MPL-2.0 is allowed.** It reaches the build through `cssparser`, `cssparser-macros`,
`selectors`, `dtoa-short` (the CSS selector engine behind `dom_query`, via Tauri) and
`option-ext` (via `dirs`). MPL-2.0 is file-level copyleft: the obligation attaches to the
MPL-covered source files, not to anything that links them. Shipping a proprietary binary that
includes them unmodified requires their source to be available, which crates.io already provides,
and obliges nothing about Encastra's own code.

**The condition this depends on: we do not modify them.** If one is ever vendored and patched, the
modified files must be published under MPL-2.0. That is a real obligation, and it is why the entry
in `deny.toml` carries a paragraph rather than a bare string.

Five `unmaintained` advisories are ignored, each individually, each with the crate's provenance
verified by `cargo tree` and a revisit date of 2026-12-15. `cargo deny` errors on an ignore that
matches nothing, so a dependency bump that drops one fails the build until the line is removed —
the list cannot go stale silently.

## What is absent

* **No updater.** There is no update mechanism at all — not a misconfigured one, an absent one.
  `docs/adr/0008` designs signing and revocation for the future registry and updater; none of it
  is built. When one is added it needs signature verification from its first commit, because an
  unsigned update channel is a remote code execution primitive with a distribution list.
* **No SBOM, no build provenance, no attestation.** `Cargo.lock` and `package-lock.json` pin
  everything and `cargo deny` restricts sources to crates.io, which is most of the value; a
  generated SBOM would make it legible to somebody outside the project.
* **No reproducible build.** The `.encastra` *format* is byte-deterministic; the binary is not.

## Clean-install verification

**Status: NOT EXECUTED.** The 0.4.0-beta.1 installer was produced and its signing state verified;
it has not been installed on a clean machine from this branch. The procedure below exists so that
the next person does it the same way twice, not because it has been run.

On a Windows VM with no Encastra history, no Rust, no Node, and a fresh user profile:

1. **Before installing.** Snapshot the VM. Record `Get-FileHash <installer> -Algorithm SHA256` and
   compare it against `docs/RELEASE.md`. Record `Get-AuthenticodeSignature <installer>` — today
   this will read `NotSigned`, which is the expected and documented answer.
2. **SmartScreen.** Note exactly what Windows says, with a screenshot. This is what a real user
   meets first and the release notes should not describe it more gently than it appears.
3. **Install.** Confirm it does not prompt for elevation. Record the install directory; it should
   be per-user (`%LOCALAPPDATA%`), not `Program Files`.
4. **Permissions on what was installed.** `icacls` on the install directory. A directory a
   standard user can write to is a directory where the binary can be replaced by anything running
   as that user, which is the risk a per-user install trades for not needing an administrator.
5. **First run.** The window opens; no unexpected network connection (check with Resource Monitor
   or a proxy); no file created outside `%LOCALAPPDATA%` and `%APPDATA%`.
6. **A real workflow.** Open a project, choose a folder with the Choose button, allow the
   permission, run it. Confirm the result lands in the chosen folder and nowhere else.
7. **The permission actually binds.** Edit the node's folder to somewhere not chosen, run again,
   and confirm it is refused rather than written.
8. **Scratch is cleaned.** `%TEMP%\encastra` should be empty after a run finishes.
9. **Uninstall.** Confirm the install directory is gone. Record what is left behind under
   `%APPDATA%` and whether that is intended — leftover configuration is a choice, leftover
   credentials would not be.
10. **Restore the snapshot** before repeating, so each pass starts from the same machine.

Record the results in `docs/RELEASE.md` under the version tested. An unrun procedure that is
described as run is worse than no procedure.
