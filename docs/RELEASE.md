# RELEASE

How a build of Encastra is produced, what it contains, and what a person can check about it.

---

## This build

<!-- BUILD:START -->

**Version 0.3.0-beta.1** · built 2026-09-11 on Windows AMD64 · commit `57a4f9b`

| Artefact | Size | SHA-256 |
|---|---|---|
| `Encastra_0.3.0-beta.1_x64-setup.exe` | 3.1 MB | `a11b96ce4a44ddc3afdc8e7a876f621b1b614079220493973a14064eda812a56` |
| `encastra-desktop.exe` | 8.7 MB | `ea5abdbb1351141783e56e4e295f8a4d700808fd30d58f2e8b51b0086e9f04d6` |

Verify before installing:

```powershell
Get-FileHash .\Encastra_0.3.0-beta.1_x64-setup.exe -Algorithm SHA256
```

These builds are **not code-signed**, so Windows SmartScreen will warn about an unrecognised publisher. That warning is accurate: nothing here proves who built the file. The hash above is what you have instead, and it is worth checking.

<!-- BUILD:END -->

The hash for `encastra-desktop.exe` is the hash of the **built** binary. The copy the installer
leaves in `%LOCALAPPDATA%\Encastra\` differs from it by exactly three bytes: Tauri's NSIS installer
rewrites a marker inside the binary (`__TAURI_BUNDLE_TYPE_VAR_UNK` becomes `…_NSS`) so the running
application knows which kind of package it came from. So an installed copy will not match the hash
above, and that is expected rather than a sign of tampering. Check the installer's hash, which is
the artefact that actually travels.

---

## Producing a build

Everything runs from the repository root.

```bash
# 1. The gate. A release is not made from a tree that does not pass.
npm ci
npm run lint
npm run typecheck
npm test
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

# 2. The build. Compiles the frontend, then the Rust binary in release, then packages it.
npm run tauri:build

# 3. Record what came out.
python scripts/release_manifest.py
```

`npm run tauri:build` invokes `vite build` first, through Tauri's `beforeBuildCommand`, so there
is no separate frontend step to forget.

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
.\Encastra_0.1.0-beta.1_x64-setup.exe /S
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

`0.1.0-beta.1`. One version, set in `Cargo.toml`'s `[workspace.package]` and in
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
4. A licence. The repository is currently `UNLICENSED`, which grants nobody any rights.
5. Trademark clearance for the name. See [BRANDING.md](BRANDING.md) — availability of a domain
   and a package name is not clearance.
6. A crash path that does something useful, since there is no crash reporting and none is
   planned without asking first.
