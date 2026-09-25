# RELEASE

How a build of Encastra is produced, what it contains, and what a person can check about it.

---

## This build

<!-- BUILD:START -->

**Version 0.5.0-rc.6** · built 2026-09-25 on Windows X64 by GitHub Actions run [36139017073](https://github.com/alexlincai123-sketch/encastra/actions/runs/36139017073) · build commit `8803a4fa3a3e20ff5372efb33399b0131f0e45fc`

Toolchain: rustc 1.98.1 (48a229cea 2026-09-01) · node v24.15.0 · MSVC 14.44.35207 · Windows SDK 10.0.26100.0 (AdvAPI32.Lib `ecafe89a632a35b1…`) · runner image win25-vs2026 20260907.229.1. Built twice in that run, on two machines, byte-identical; the release workflow builds the build commit a third time at the tag and requires these bytes again. `scripts/pe_diff.py` names any byte that differs.

| Artefact | Size | Signature | SHA-256 |
|---|---|---|---|
| `Encastra_0.5.0-rc.6_x64-setup.exe` | 3.5 MB | **not signed** | `3085bff8d54873db5ed916b193b22112bb8244055651ba6d4ec2d5a9214ed248` |
| `encastra-desktop.exe` | 9.4 MB | **not signed** | `afd091c4897d578ebc0a4ddbc9d95fb9b47d399169a9d07c571217e59e18b377` |

Verify before installing:

```powershell
Get-FileHash .\Encastra_0.5.0-rc.6_x64-setup.exe -Algorithm SHA256
Get-AuthenticodeSignature .\Encastra_0.5.0-rc.6_x64-setup.exe
```

These builds are **not code-signed**, so Windows SmartScreen will warn about an unrecognised publisher. That warning is accurate: nothing here proves who built the file. The hash above is what you have instead, and it is worth checking — with the caveat that a hash published beside the download is only as trustworthy as the site serving both.

This build was published unsigned deliberately (`--allow-unsigned`). See docs/SIGNING.md for what is needed to stop doing that.

<!-- BUILD:END -->

The hash for `encastra-desktop.exe` is the hash of the **built** binary. The copy the installer
leaves in `%LOCALAPPDATA%\Encastra\` differs from it by exactly three bytes: Tauri's NSIS installer
rewrites a marker inside the binary (`__TAURI_BUNDLE_TYPE_VAR_UNK` becomes `…_NSS`) so the running
application knows which kind of package it came from. So an installed copy will not match the hash
above, and that is expected rather than a sign of tampering. Check the installer's hash, which is
the artefact that actually travels.

---

## Producing a build

Everything runs from the repository root, on a **clean, committed tree**. The binary records the
commit it was built from (`build.rs` embeds it; Settings → About shows it as the build commit),
and the manifest refuses to describe a build whose tree had uncommitted changes.

**Since 0.5.0-rc.5 the published bytes are built by CI, not on a developer machine.** A developer
machine and a hosted runner cannot produce the same bytes (see *Reproducible* below for the exact
two bytes and why); two hosted runners can. So a release publishes what `candidate.yml` built,
reproduced on a second runner in the same run, and rebuilt a third time by `release.yml` at the
tag.

```bash
# 1. The gate. A release is not made from a tree that does not pass.
npm ci
npm run lint
npm run typecheck
npm test
python scripts/version.py --check
python scripts/generated_check.py
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
python -m unittest discover -s scripts/tests

# 2. Push the commit that will be the BUILD COMMIT and build it on two hosted runners. The run
#    builds copy A and copy B on two fresh machines with .github/actions/windows-release-toolchain,
#    requires them byte-identical, installs copy A's installer on a third runner and drives the
#    chooser journeys through it (repeat=3). Every job has to be green.
git push origin <branch>
gh workflow run candidate.yml --ref <branch>

# 3. Put copy A into target/, having checked it is that run's: right workflow, this commit, every
#    job green, each artefact zip equal to the digest GitHub recorded at upload, copy B identical,
#    and the executable stamped with this commit. Writes target/release/candidate-provenance.json.
python scripts/release_fetch.py --run <run id>

# 4. Record what came out: hashes, signature state, the build commit read out of the binary, and
#    the run and toolchain that produced it. Writes the block above and site.ts.
python scripts/release_manifest.py --allow-unsigned     # a pre-release; refused for a production version

# 5. Commit those two files, and nothing else. This is the PUBLICATION COMMIT. Push it, and run CI
#    on it: ci.evidence reads the runs of this exact commit.
git commit -m "release: <version>" docs/RELEASE.md apps/web/src/config/site.ts
python scripts/release_manifest.py --verify
git push origin <branch>
gh workflow run ci.yml --ref <branch>

# 6. The verdict. Every gate above plus artefact identity and provenance (the run is asked again,
#    not trusted from the record), signing for the mode, copy B as the second build, CI for this
#    commit and the journeys log of the candidate run.
python scripts/release_check.py --compare target/candidate/<run id>/compare \
    --evidence-gui target/candidate/<run id>/journeys/gui-journeys.log

# 7. Tag the publication commit only on BETA_READY (a pre-release) or RELEASE_READY. The release
#    workflow builds the build commit a third time on a clean runner, fails unless the bytes are
#    the published bytes, and installs them. Publishing is a separate, explicit dispatch: it
#    uploads only the bytes that run verified, and never replaces an existing release.
git tag -a v<version> -m "Encastra <version>"
git push origin v<version>
gh workflow run release.yml --ref v<version> -f allow_unsigned=true -f publish=true
```

A tag push on its own also runs `release.yml`; with no certificate and no `allow_unsigned` input it
refuses at the unsigned-release step, by design. The dispatch in step 7 is the recorded decision.

What each of those refuses, and why, is in `docs/release/` — `SIGNING_PIPELINE.md` for the
three modes (dev, beta, release) and the signing chain, `CLEAN_WINDOWS_VM.md` for the machine
procedure, `COMMERCIAL_RELEASE_CLOSURE.md` for what is automated and what is still a person's.

`npm run tauri:build` invokes `vite build` first, through Tauri's `beforeBuildCommand`, so there
is no separate frontend step to forget.

### Build commit and publication commit

A manifest cannot live in the commit it describes: the hashes of a build are known only after
the build, and the commit that records them comes after the commit that was built. Every release
therefore has two commits, one apart:

| | What it is | Where it is named |
|---|---|---|
| **Build commit** | The tree that produced the bytes | Inside `encastra-desktop.exe` (`encastra-build-commit=<hash>;`), Settings → About, the block above, `site.ts` |
| **Publication commit** | Build commit + `docs/RELEASE.md` + `site.ts` | The `v<version>` tag |

`release_manifest.py --verify` is the check that the two are one publication apart and nothing
else; it runs in CI on every release. Before this was written down the block above named the
commit *before* the publication, read from `git rev-parse HEAD` at manifest time — one behind by
construction, and nothing noticed.

### Reproducible

Two builds of the build commit **on the same toolchain** produce byte-identical
`encastra-desktop.exe` and byte-identical installers. The recipe: `rust-toolchain.toml`, `.nvmrc`,
`package-lock.json`, the MSVC toolset pinned by `scripts/verify/toolchain.py`, build paths remapped
out of the binary, `/Brepro` passed to the linker from `build.rs` (image timestamps and the PDB
GUID become hashes of the content), and `SetDateSave off` in the NSIS hooks. `candidate.yml` proves
it on every candidate (copy A = copy B, two machines) and `release.yml` proves it again at the tag.

What is **not** reproducible, and why: a developer machine and a hosted runner. 0.5.0-rc.4's
release run found them 70 bytes apart with every PE section equal. Two of those bytes are *import
hints* — the index at which the loader first looks for a function in the DLL's export table —
for `RevertToSelf` (imported by `clipboard-win`, through `arboard`) and `SystemFunction036`
(imported by `getrandom` 0.2, through `ring` → `rustls` → `ureq`). Both crates declare them with
`#[link(name = "advapi32")]`, so the linker copies the hint out of the Windows SDK's
`um\x64\AdvAPI32.Lib`: 0x2bb and 0x31d on the developer machine, 0x2bd and 0x31f on the runner,
with both reporting SDK 10.0.26100.0 — the file differs inside one SDK version, by servicing, which
`vcvarsall` cannot select. The other 68 bytes are `/Brepro` doing its job: it hashes the image
into the COFF timestamp, the debug directory and the RSDS GUID, so two different bytes anywhere
become seventy. A wrong hint changes nothing at run time (the loader falls back to a lookup by
name); the two builds are the same program, and they are still not the same bytes.

`scripts/verify/build_environment.py` records the import library's digest and those two hints
with every CI build, so a disagreement names its input. `scripts/pe_diff.py A.exe B.exe` names
every differing byte by PE structure.

### What comes out

| Path | What it is |
|---|---|
| `target/release/encastra-desktop.exe` | The application binary, named after the crate |
| `target/release/bundle/nsis/*.exe` | The Windows installer |

The release profile sets `opt-level = "z"`, `lto = true` and `codegen-units = 1`. That makes the
build slow — ten to twenty minutes on a laptop — and the binary small, which is the right trade
for something people download.

`panic = "abort"` is deliberately **not** set. A first-party component that panics would
otherwise take the whole application with it, and the runtime already treats a component failure
as an ordinary, recoverable outcome.

---

## Why NSIS and not MSI

`bundle.targets` is `["nsis"]`. Leaving it as `"all"` would produce both, and the choice matters:

- NSIS installs per user without elevation, so a first run does not need an administrator.
- One installer covers every language. MSI needs one per language.
- The updater supports NSIS's quiet and passive modes properly; MSI cannot elevate quietly.
- An MSI-to-NSIS migration works later. The reverse does not, so choosing MSI would be a
  one-way door.

The known cost is that NSIS installers draw more SmartScreen and antivirus false positives. That
is a code-signing problem rather than a packaging one, and the answer to it is signing.

---

## Signing — not done, and what that means

**These builds are not signed.** Windows will show a SmartScreen warning naming an unknown
publisher, and that warning is accurate: nothing in the file proves who produced it.

The published SHA-256 is what a person has instead. It proves the file was not altered *between
here and them*; it proves nothing about who "here" is. Both facts belong together whenever the
hash is shown.

Signing needs a certificate and a private key, which is a decision with a cost attached and not
one to make on somebody's behalf. When it happens:

- An OV or EV certificate, or Azure Artifact Signing.
- The key never in the repository, never in CI logs, never in an environment variable that gets
  echoed.
- The updater's signing key is separate from the code-signing certificate, and losing it means
  no installed copy can ever be updated again — so it is backed up before the first release that
  uses it.

---

## Installing

The installer is per user and needs no administrator. Verified by installing this build:

| What | Where |
|---|---|
| Program files | `%LOCALAPPDATA%\Encastra\` — `encastra-desktop.exe` and `uninstall.exe` |
| Start Menu | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Encastra.lnk` |
| Uninstall entry | `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall` |

Nothing is written under `HKLM` and nothing goes into `Program Files`, which is what "per user"
means in practice. The installed executable keeps the crate's name rather than the product's.

Its bytes are **not** identical to `target/release/encastra-desktop.exe`: Tauri patches the
executable with bundle information before packaging it, so the two hash differently. Verify an
installer against the hash published below; do not expect an installed copy to match the raw
build output.

Silent install, for a machine being set up by a script:

```powershell
.\Encastra_<version>_x64-setup.exe /S
```

Uninstalling removes the application. It does not touch `.encastra` files, which live wherever
the person saved them — the application keeps no hidden library and no separate copy.

---

## Updates — architecture only

There is no update channel in this build. The design is settled and the code is not written:

- The client verifies a signature against a key pinned in the binary **before** the artefact is
  written anywhere it would be executed from.
- Versions are monotonic; a lower version is refused unless the person explicitly rolls back to
  a build they still have.
- Key rotation happens through a signed key-history chain, so a compromised online key does not
  require shipping a new binary.
- An update that fails verification is discarded and the failure is surfaced. It is never
  retried silently in a loop, and there is no "install anyway".

Until that exists, updating means downloading a new installer and running it. The beta says so
in Settings rather than implying an update mechanism it does not have.

---

## Version numbering

One version — the one in the BUILD block above — set in `Cargo.toml`'s `[workspace.package]` and in
`tauri.conf.json`, and shown in Settings by reading it from the build rather than from anything
typed into the interface.

Three schema numbers travel beside it and move independently, because they are promises about
compatibility rather than about features:

| Schema | Meaning |
|---|---|
| Component protocol | What a manifest may contain. Additive-only; a host refuses a higher number rather than guessing. |
| Project format | What a `.encastra` file contains. Same rule. |
| Runtime | What a component's `runtime` range is matched against. |

---

## Before a release that is not a beta

Not a checklist to tick through quietly — each of these is a decision somebody has to make.

1. External security review, particularly of the capability broker and the handle model.
2. Code signing, with the key management above actually in place.
3. The updater, including a tested rollback.
4. Counsel's review of the licence. `LICENSE` exists and the terms are proprietary, but it was
   drafted in-house; a signed-off licence is what a production release needs.
5. Trademark clearance for the name. See [BRANDING.md](BRANDING.md) — availability of a domain
   and a package name is not clearance.
6. A crash path that does something useful, since there is no crash reporting and none is
   planned without asking first.
