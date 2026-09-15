# Final release readiness — 2026-09-15

The closure report of the same date (`docs/security/2026-09-15-security-closure-report.md`)
ended in RELEASE CANDIDATE *conditional* on things nobody had executed: the native folder
chooser through a real window, a Linux CI run on the release commit, and a way to say "the
installer is the final code" better than "somebody built it". Two findings were parked as
ACCEPTED RISK because they were small — ENC-NEW-17, the manifest naming the commit before the
release; ENC-NEW-18, two builds of one commit not being the same bytes. This report is what
happened when those were treated as work instead of as risks.

Every status below is one of **PASS**, **FAIL**, **BLOCKED**, **NOT EXECUTED** or
**NOT OBSERVED**. A PASS names what was run. Nothing that was not executed is written as if it
had been.

## Executive summary

ENC-NEW-17 and ENC-NEW-18 are fixed structurally and tested, not re-classified. The binary now
states the commit it was built from; the manifest reads it out of the binary and refuses anything
else; a production version cannot be published unsigned by any flag. Two clean builds of the
final commit from two different directories produced a byte-identical executable **and** a
byte-identical installer, twice (once on an intermediate commit, once on the final one), after
two separate causes of non-determinism were found and removed — the MSVC linker's timestamps and
PDB GUID, and NSIS recording the embedded file's modification time. The native folder chooser was
driven through the real window, in the raw build and in the installed copy, and found a real
defect on the way (the chosen path came back in Windows' verbatim `\\?\` form), which is fixed.
The final installer was installed for real on this machine, over the previous beta, and
inspected.

What is still not verified, and cannot be from this repository as it stands: **Linux CI has
never run on any commit**, because the repository has no remote; **no clean-VM install** has
been done; **nothing is signed**. The decision at the end follows from those three facts and
not from the many things that went well.

## Repository state

| | |
|---|---|
| Branch | `release/final-readiness-remediation`, worktree `C:\Users\alexl\encastra-final` |
| Base | `feat/readiness@9d1ec13` — the candidate after the parallel session's final-audit fixes (ENC-NEW-19 among them); includes the closure report `6af48a8` |
| Final **code** commit | **`c975bd4`** (`c975bd4fd39f47b323855abfd1f0923bd9bbca2e`) — the commit both reproducibility builds, the GUI run and the installation below are of |
| This report | one docs-only commit after `c975bd4`; the shipping build commit will be the merge of this branch into `feat/readiness`, and **the two-build comparison must be repeated on it** (the stamp changes with the commit, so its bytes are not `c975bd4`'s) |
| `main` | `4f2932e`, not written to at any point |
| Working tree at the end | clean (`git status --porcelain` empty) |
| Build worktrees | `C:\Users\alexl\eB` and `C:\Users\alexl\eC`, detached, two directories on purpose |

Commits on the branch over `9d1ec13`, in order: `d1b7b0d` build stamp + `/Brepro`; `7294904`
manifest reads the stamp, `pe_diff.py`, 20 tests; `e94837c` bytecode ignored; `a88d2b1`
release/ci workflows, `site.ts` written by the script, docs; `f3f468e` NSIS hook + `\\?\`
display fix; `09dc6dc` clippy; `c975bd4` `tauri.conf.json` as Biome formats it.

**Inventory, verified rather than remembered.** Tauri 2 (`@tauri-apps/cli` in
`package-lock.json`); Rust `1.98.1` pinned in `rust-toolchain.toml`, host
`x86_64-pc-windows-msvc`, LLVM 22.1.8; MSVC `link.exe` 14.44.35207 (Build Tools 2022); Node
`v24.15.0` on this machine, CI pins 22; npm 11.12.1; NSIS 3.11 (Tauri's cached copy under
`%LOCALAPPDATA%\tauri\NSIS`); GitHub Actions (`ci.yml`, `release.yml`); `scripts/version.py`,
`release_manifest.py`, `pe_diff.py`; `[profile.release]` `lto = true`, `codegen-units = 1`,
`strip = true`; no `.cargo/config.toml`; no updater. **`git remote -v` prints nothing** — the
repository has never been pushed, so no CI provider holds any commit of it.

## Findings

### ENC-NEW-17 — the manifest named the commit before the release (was ACCEPTED RISK → FIXED)

**Origin.** `release_manifest.py` ran `git rev-parse HEAD` when it ran. It runs after the build
and before the commit that carries the manifest, so the commit it named was always the parent of
the commit that published it. `f6e7c29` for release `966c5e0` was exactly this. It is not a
one-line bug: a file cannot contain the hash of the commit that contains it.

**Fix.** The binary states its own commit. `apps/desktop/src-tauri/build.rs` sets
`ENCASTRA_BUILD_COMMIT` from `git rev-parse HEAD` — `<hash>-dirty` when any tracked file differs
from the commit, `unknown` without git — and `lib.rs` embeds it as
`encastra-build-commit=<hash>;` and shows it in Settings → About (`about().buildCommit`).
`release_manifest.py` reads that string out of `encastra-desktop.exe` and refuses (exit 4) a
binary that is unstamped, dirty, `unknown`, or from any commit other than HEAD. The vocabulary
is now explicit and enforced: the **build commit** is what the bytes came from (named in the
binary, the manifest and the website's `RELEASE` constant, which the script now writes too); the
**publication commit** is the build commit plus `docs/RELEASE.md` and `site.ts`, one later, where
the tag goes. `release_manifest.py --verify` checks that the two differ in nothing else while the
version is unchanged, that the artefacts on disk hash to what the manifest says, that the
binary's stamp is the manifest's commit, and that `site.ts` agrees with all of it.

**Works in:** local builds (this report); CI (`release.yml` now checks out the build commit the
published manifest names, builds it, restores the published manifest beside the result and runs
`--verify` — so an unsigned release that does not reproduce the published bytes does not pass);
tagged builds; detached HEAD (`rev-parse HEAD` works; the ref watch is optional). **Limits,
stated:** a shallow clone can build (HEAD resolves) but `--verify` needs the build commit's
ancestry, hence `fetch-depth: 0` in the gates job; a source tarball builds `unknown` and is
refused by design; a signed build is not byte-identical to an unsigned rebuild (the signature is
appended), so for a signed build the manifest is regenerated from the signed artefacts under
`--require-signature` instead of compared.

**Tests.** `scripts/tests/test_release_manifest.py`, 15 cases against a synthetic PE32+ image in
a fixture git repository that Windows' own `Get-AuthenticodeSignature` reads as an unsigned
executable: the manifest names the stamped commit and writes both files; a binary from another
commit, a dirty build, a `unknown` build and an unstamped binary are refused with the document
untouched; `--verify` accepts a publication commit and rejects a source change under the same
version, a tampered hash, a rebuilt binary from another commit, a stale website record, and a
manifest for a version the tree has left; `--build-commit` prints what the manifest names.
Rust: `the_binary_states_the_commit_it_was_built_from`. All of it also ran against the real
final artefacts (§ Artifact verification).

### ENC-NEW-18 — two builds of one commit were not the same bytes (was ACCEPTED RISK → FIXED)

See § Reproducibility. Two mechanisms, two fixes, proof on two commits.

### ENC-NEW-19 — adaptive attacker: 8 of 20 strategies died before the control (MEDIUM, test quality; FIXED in `9d1ec13`)

Found by the parallel session's independent audit of `966c5e0`: `adaptive_attacker.rs` wrote
`listingId`/`sizeBytes` in camelCase, so `deny_unknown_fields` refused eight strategies before
they reached the check they named. Recorded here because the closure report's "no known vacuous
test" was wrong when it was written; each of the 21 strategies now asserts its exact refusal
variant, and that is true of this tree.

### ENC-NEW-20 — the chosen folder came back as `\\?\C:\...` (LOW, functional; NEW; FIXED)

Found by executing the GUI procedure rather than reading it. Settings → Projects → Browse put
`\\?\C:\Users\alexl\AppData\Local\Temp\Encastra GUI ñ 日本語 test` into the folder field:
`choose_folder` returned the canonical path exactly as recorded, and on Windows
`std::fs::canonicalize` returns the verbatim form. That string then travels into the consent
prompt and into saved preferences. Not a permission defect — the path is canonicalised again on
the way back and compared to the record — but a path a person is asked to approve should read
like a path. Fixed with `for_display`: `\\?\C:` → `C:`, `\\?\UNC\` → `\\`, anything else
untouched; unit tests plus a Windows round-trip test that the displayed form resolves to what
was recorded. Verified again through the window after the fix (§ Windows GUI).

### ENC-NEW-21 — the installer had a clock of its own (LOW; NEW; FIXED)

With `/Brepro` the two executables were identical and the two installers still differed from the
first byte of the LZMA stream. NSIS stores each embedded file's last-write time, which is when
the linker finished. `apps/desktop/src-tauri/nsis/hooks.nsh` sets `SetDateSave off` in
`NSIS_HOOK_PREINSTALL`, which Tauri's template inserts at the top of the Install section, before
the one `File` command that embeds the executable. `SOURCE_DATE_EPOCH` was tried and is not
needed. Part of ENC-NEW-18 in effect; listed on its own because it is a different mechanism.

### Other observations, each acted on

* **No guard against an unsigned production release.** `--allow-unsigned` accepted any
  version. Now exit 3 for a version without a pre-release suffix, with no override flag,
  environment variable or workflow input; `release.yml` fails the same way with no certificate
  and a production version. Tested.
* **Signing in CI edited `tauri.conf.json`** and restored it afterwards; that would now stamp
  the binary `-dirty` and the manifest would refuse it. The thumbprint goes to Tauri as a
  `--config` overlay file outside the tree (`docs/SIGNING.md` updated).
* **`RUSTFLAGS: -D warnings` at workflow level** silently overrides `.cargo/config.toml`
  rustflags; a `/Brepro` placed there would have been lost in the release build. It lives in
  `build.rs` (`cargo:rustc-link-arg-bins`) for that reason.
* **The tag was never checked against the version.** `release.yml` now fails when `v<tag>`
  is not `tauri.conf.json`'s version.
* **No `continue-on-error`** anywhere in `.github/workflows/`. No separate `cargo audit` step;
  `cargo deny check advisories` is the advisory gate and is blocking.
* **`docs/RELEASE.md`'s "differs by three bytes"** claim about the installed binary was checked
  with `pe_diff.py`: exactly 3 bytes in `.rdata`, `UNK` → `NSS`, Tauri's bundle-type marker.
* **`docs/security/RELEASE_SECURITY.md` said "No reproducible build."** It now says what is
  reproducible, under what conditions, and what is not claimed.

## Reproducibility

**Before** (established in the closure report with a byte-level parse, restated): two builds of
`966c5e0` differed in exactly 24 bytes — COFF `TimeDateStamp` at `0xf8`, the three
`IMAGE_DEBUG_DIRECTORY` timestamps (types 2, 12, 13) and the 16-byte PDB GUID of the `RSDS`
record. No code, data or path bytes.

**Causes.** MSVC `link.exe` writes the clock into the image and a fresh GUID into the CodeView
record on every link. NSIS writes the embedded file's mtime into the archive.

**Fixes.** `/Brepro` from `build.rs` for the application binary on `msvc` targets (the linker
derives timestamps and the GUID from the content); `SetDateSave off` through the NSIS hook.
Nothing in `.cargo/config.toml`, nothing in `RUSTFLAGS`, no `SOURCE_DATE_EPOCH`.

**Proof, intermediate commit `e94837c`** (before the NSIS hook existed, so the installer
difference is shown as found):

```
Artifact: encastra-desktop.exe (9 620 480 B)
Build A (C:\Users\alexl\eB)  SHA-256: 7f93c457b835a76d9e16b3d12a5f68ec0e5e6c87af43bcfe47b1e23aaba268de
Build B (C:\Users\alexl\eC)  SHA-256: 7f93c457b835a76d9e16b3d12a5f68ec0e5e6c87af43bcfe47b1e23aaba268de
Equal: YES

Artifact: Encastra_0.5.0-beta.1_x64-setup.exe, as built
Build A  SHA-256: cb27cea3508af12cb2bee9dcd7149783352df59f92d8260a79c3832b881ba666  (3 531 207 B)
Build B  SHA-256: e1c08e98bca06a7c4e07e6e5391f5066ca0c79428a3c2dd081b3e0c192a97829  (3 531 206 B)
Equal: NO — first difference at 0xce18, the NSIS first header's compressed-size field
(0x3513c7 vs 0x3513c6), then the whole LZMA stream: the executable's mtime inside it.

Artifact: Encastra_0.5.0-beta.1_x64-setup.exe, both trees re-bundled with the hook
Build A  SHA-256: 2ecd7dcb7de3198d45a0b005f30a171d745e2bf50059445cb62ca153f93f3c82
Build B  SHA-256: 2ecd7dcb7de3198d45a0b005f30a171d745e2bf50059445cb62ca153f93f3c82
Equal: YES  (and still YES with SOURCE_DATE_EPOCH unset on one side)
```

**Proof, final code commit `c975bd4`**, two clean checkouts, `npm ci` and `npm run tauri:build`
in each, nothing touched in either tree while building:

```
Artifact: encastra-desktop.exe (9 620 480 B)
Build A (C:\Users\alexl\eB, 213 s)  SHA-256: 9b799ea8bb2eb0ec3b0e78c802987b4f01dcbebd8ddd19a4f90dbf61b6cdecf8
Build B (C:\Users\alexl\eC, 205 s)  SHA-256: 9b799ea8bb2eb0ec3b0e78c802987b4f01dcbebd8ddd19a4f90dbf61b6cdecf8
Equal: YES  (cmp: identical; pe_diff.py: "Identical.", exit 0)

Artifact: Encastra_0.5.0-beta.1_x64-setup.exe (3 529 699 B)
Build A  SHA-256: 2b6c86e528ecac3594035da7b801a306c2ac839d9d40e3a7be31245e064cc1a1
Build B  SHA-256: 2b6c86e528ecac3594035da7b801a306c2ac839d9d40e3a7be31245e064cc1a1
Equal: YES  (cmp: identical)

Binary structural comparison (pe_diff.py, the two executables):
Code differences: NO   Data differences: NO   Metadata differences: NO   Debug differences: NO
COFF TimeDateStamp: 1413834775 on both — a content hash, not the clock (the builds ran at ~1789450000)
RSDS GUID: 24160569edbae889ec3e05b9c71cac99 on both
Build stamp in the binary: c975bd4fd39f47b323855abfd1f0923bd9bbca2e
Occurrences of "Users\alexl", "eB\", "eC\" in the binary: 0 — no build path is embedded
```

**What is and is not claimed.** Same commit, `1.98.1`/msvc, `link.exe` 14.44.35207, the same
`Cargo.lock` and `package-lock.json`, NSIS 3.11, any directory, this machine → identical bytes,
on two commits, in two directories each. Not claimed: across `link.exe` versions, across NSIS
versions, across machines; the release workflow's rebuild-and-compare gate is where that would be
earned and it has never run (no remote). The MSVC linker version is not pinned by the repository;
it is recorded here. **A third build**, by the parallel session in a third directory
(`C:\Users\alexl\encastra-wt-build`, detached checkout, clean `npm ci`), produced the same two
hashes — `9b799ea8…` and `2b6c86e5…` — so the claim rests on three builds in three directories
by two independent operators, on one machine.

## Windows GUI verification

**Executed, twice, through the real window** — not simulated, not a unit test — with
`scripts/verify/gui_chooser.ps1`, which drives the application through UI Automation (the
WebView2 content exposes its buttons by name) and the native chooser through its window handles
(`BM_CLICK`, `WM_SETTEXT`), and prints one PASS/FAIL per check with the observed value.

Run 1: the raw build of `c975bd4` (`C:\Users\alexl\eB\target\release\encastra-desktop.exe`).
Run 2: the **installed** copy (`%LOCALAPPDATA%\Encastra\encastra-desktop.exe`, after the
installation below). Both runs, every check **PASS**:

1. Main window found (`Tauri Window`); the sidebar is exposed to UI Automation.
2. Settings → Projects reached; the Browse button is on screen and enabled.
3. Browse opens the native chooser: a `#32770` window titled `Seleccionar carpeta`, in the
   application's own process.
4. Cancel closes it; the application is still running; the folder field is unchanged.
5. Browse again; the folder-name field (id 1152) and the confirm button
   (`Seleccionar carpeta`) are found; the path
   `C:\Users\alexl\AppData\Local\Temp\Encastra GUI ñ 日本語 test` (spaces, `ñ`, CJK) is entered
   and confirmed; the chooser closes; the application is still running.
6. The folder field shows **exactly** that path — after the ENC-NEW-20 fix. Before it, the same
   run showed `\\?\C:\...`, which is how the defect was found.
7. Home responds afterwards; the process is alive and `Responding`.

**Not executed through the GUI:** running a workflow with a folder grant and confirming the
result lands in the chosen folder and nowhere else (procedure steps 6–7 of
`RELEASE_SECURITY.md`), the scratch-folder check (step 8), uninstall (step 9). The grant binding
is covered by the Tauri crate's tests (`grant_set` refuses an unchosen folder), not by a window.
No crash, hang or error was observed in either run.

## Linux CI

```
commit:   c975bd4 (and every earlier commit)
workflow: .github/workflows/ci.yml — jobs typescript, rust [ubuntu-latest, windows-latest, macos-latest], supply-chain, secrets
run:      none exists
status:   BLOCKED
evidence: `git remote -v` prints nothing. The repository has never been pushed anywhere, so no
          CI provider has any commit of it. `gh auth status` shows a logged-in account; creating
          a remote and pushing is an outward action that belongs to the owner, not to this pass.
```

The Linux-only gates — the two symlink escape tests and the publication link-refusal test must
run and not skip — are in `ci.yml` and `release.yml`. On this machine those tests **skip**
(verified with `--nocapture`: "skipped: this platform would not create a symlink" ×2, and the
importer's equivalent); the startup-folder refusal ran. No WSL distribution and no Docker are
installed here, so there is no local Linux either. This condition stays **OPEN**; it is the
first reason for the decision below.

## Security

Re-run on `c975bd4`, not carried over:

| Check | Result |
|---|---|
| `cargo deny check advisories bans licenses sources` | PASS — advisories ok, bans ok, licenses ok, sources ok |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| Lockfiles | `Cargo.lock`, `package-lock.json` unchanged by this branch |
| Tauri capabilities / IPC boundary | unchanged by this branch except `about()` gaining `buildCommit` (a string constant) and `choose_folder` returning the display form of the same resolved path; `grant_set`'s comparison is on the canonicalised path and is unchanged; 17 tests in the Tauri crate pass including the new round-trip |
| Filesystem / network / shell access | no new capability, no new dependency; `build.rs` runs `git` at build time only |
| Release packaging | the NSIS hook adds one compile-time flag (`SetDateSave off`) and no runtime behaviour |
| Security regression suite (broker ~40, hostile archive, importer, adaptive attacker 21 strategies, URL authority, hostile text) | PASS inside `cargo test --workspace` 316/0 and `vitest` 502/502 |
| Unsigned production guard | PASS — `--allow-unsigned` with version `0.5.0` exits 3 (tested); workflow fails likewise |

## Test matrix

Full gate on `c975bd4`, clean tree, every exit code recorded (`/tmp/gate-*.log`):

| Command | Exit | Result | Time |
|---|---|---|---|
| `python scripts/version.py --check` | 0 | one version everywhere (site.ts included) | 0 s |
| `python -m unittest discover -s scripts/tests` | 0 | 22 passed | 19 s |
| `cargo fmt --all --check` | 0 | clean | 1 s |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean (one `collapsible_if` in `build.rs` fixed on the way) | 3 s |
| `cargo test --workspace` | 0 | **316 passed, 0 failed**, 28 suites | 36 s |
| `npm run lint` (Biome) | 0 | 226 files, clean | 2 s |
| `npm run typecheck` | 0 | | 1 s |
| `npm run test` (Vitest) | 0 | **502 passed, 0 failed**, 28 files | 6 s |
| `npm run build --workspace @encastra/web` | 0 | | 14 s |
| `cargo deny check advisories bans licenses sources` | 0 | | 6 s |
| `npm audit --audit-level=high` | 0 | 0 vulnerabilities | 2 s |
| `npm run tauri:build` ×2 | 0, 0 | see § Reproducibility | 213 s, 205 s |

Warnings worth recording: the Vite build's chunk-size notice (pre-existing); rustc's
`linker_messages` notice about `link.exe` printing "Creating library … .dll.lib" for the cdylib
(pre-existing, informational). Nothing was suppressed.

## Artifact verification

Final artefacts of `c975bd4`, from build A (identical to build B):

| | |
|---|---|
| `encastra-desktop.exe` | 9 620 480 B · `9b799ea8bb2eb0ec3b0e78c802987b4f01dcbebd8ddd19a4f90dbf61b6cdecf8` · x64 · ProductVersion `0.5.0-beta.1` · stamp `c975bd4…` · unsigned |
| `Encastra_0.5.0-beta.1_x64-setup.exe` | 3 529 699 B · `2b6c86e528ecac3594035da7b801a306c2ac839d9d40e3a7be31245e064cc1a1` · NSIS · unsigned |

The real manifest script against these real files, in the build tree at `c975bd4`:

* `release_manifest.py --require-signature` → **exit 1**, "Refusing to publish: these artefacts
  are not signed" (both listed) — the gate refuses, as documented.
* `release_manifest.py --allow-unsigned` → **exit 0**; wrote `docs/RELEASE.md` with build commit
  `c975bd4fd39f4…`, the toolchain line, both hashes; wrote `site.ts` (`commit`,
  `installerSha256`, `binarySha256`, `installerVersion`, `signed: false`).
* `release_manifest.py --verify` → **exit 0**, "describes 0.5.0-beta.1 at build commit
  c975bd4…: consistent."
* Those two written files were then discarded from the build tree: **the publication commit is
  the candidate owner's to make**, from the build commit that is actually tagged.

## Installation

**Executed on this machine (not a clean VM)** with `scripts/verify/install_check.ps1`, over the
previously installed 0.4.0-beta.1:

| Check | Result |
|---|---|
| Installer signature state | PASS — `NotSigned`, as documented |
| Silent install (`/S`) | PASS — exit 0, 3 s, no elevation prompt |
| Installed to the per-user directory | PASS — `%LOCALAPPDATA%\Encastra\encastra-desktop.exe` + `uninstall.exe` |
| Installed ProductVersion / FileVersion | PASS — `0.5.0-beta.1` / `0.5.0-beta.1` |
| Installed binary states the build commit | PASS — `c975bd4fd39f47b323855abfd1f0923bd9bbca2e` |
| Installed binary vs raw build | 3 bytes differ in `.rdata` (`UNK`→`NSS`, Tauri's bundle marker), everything else identical — `pe_diff.py` |
| Uninstall entry | PASS — `HKCU\…\Uninstall`, DisplayVersion `0.5.0-beta.1`; **0** entries under `HKLM` |
| Start Menu shortcut | PASS — `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Encastra.lnk` |
| Directory ACL | recorded: SYSTEM (F), Administrators (F), the user (F) — writable by the user, the trade a per-user install makes (procedure step 4) |
| First launch of the installed copy | PASS — window `Encastra`, process stays up |
| Native chooser through the installed copy | PASS — § Windows GUI, run 2 |
| Uninstall | NOT EXECUTED — the installed copy is left in place |
| Clean VM | NOT EXECUTED — no VM available in this session; procedure and scripts are in the tree |

## Signing

```
SIGNING STATUS: NOT CONFIGURED
```

No certificate exists. `release.yml` imports one from two secrets when present, now as a config
overlay that leaves the tree clean; nothing fabricates one. `--require-signature` refuses the
real installer (verified above). *Technical release readiness* (this document) and *distribution
trust* (a signature) are separate columns and one does not stand in for the other.

## Residual risk

| Item | Status | Owner |
|---|---|---|
| Linux CI has never run on any commit; the Linux-only symlink gates are untested on Linux | **OPEN — BLOCKED** on the repository having a remote | owner |
| Clean-VM install and steps 5 (network/file checks), 6–9 of the procedure | **NOT EXECUTED** | owner / release manager |
| Releases are unsigned; SmartScreen warns | **ACCEPTED for a beta, prohibited for a production version by the script and the workflow** | owner (certificate) |
| Reproducibility is proven on one machine and one linker version; `link.exe` is not pinned by the repository | **DESIGN LIMITATION**, documented; the release workflow's rebuild-and-compare gate would extend it to a second machine | — |
| The shipping build commit is the merge of this branch, not `c975bd4`; its two-build proof has to be run before its hashes are published | **PENDING** — handed to the candidate owner with the exact procedure | candidate owner |
| ENC-01b (prompt rendered by the webview), hard links, no per-node timeout | unchanged from the closure report | — |
| ENC-NEW-16 (library bytes uncapped) | **FIXED** after this audit, on `rc/import-policy`: `MAX_LIBRARY_BYTES` 4 GiB, measured rather than believed, reserved under the index lock | — |
| Node 24 here vs 22 in CI | INFO — the frontend built identically twice; CI's pin stands | — |

## Acceptance matrix

| Criterio | Resultado | Evidencia |
|---|---|---|
| ENC-NEW-17 | **PASS** | binary stamp + manifest refusal + `--verify`; 15 tests; real run on the final artefacts |
| ENC-NEW-18 | **PASS** | two builds of `c975bd4` from two directories identical, exe and installer |
| EXE reproducible | **PASS** | `9b799ea8…` in all three builds; `cmp` identical; `pe_diff` "Identical." |
| Installer reproducible | **PASS** | `2b6c86e5…` in all three builds; `cmp` identical |
| PE binary diff limpio | **PASS** | 0 differing bytes; earlier 24-byte diff fully attributed |
| Version consistency | **PASS** | `version.py --check` exit 0; `tests/version.test.ts` in Vitest |
| Rust tests | **PASS** | 316/0, 28 suites |
| Vitest | **PASS** | 502/0, 28 files |
| Biome | **PASS** | 226 files |
| Typecheck | **PASS** | exit 0 |
| Build web | **PASS** | exit 0 |
| Tauri build | **PASS** | exit 0, twice |
| Clippy | **PASS** | `-D warnings`, exit 0 |
| cargo audit | **PASS** (via `cargo deny check advisories`) | exit 0 |
| cargo deny | **PASS** | advisories/bans/licenses/sources ok |
| Windows GUI chooser | **PASS** | 17 checks on the raw build, 18 on the installed copy, all PASS; Cancel, confirm, Unicode+spaces, state after |
| Linux CI | **BLOCKED** | no remote; no run exists; local Linux not available |
| Installer install | **PASS** (dev machine) / **NOT EXECUTED** (clean VM) | § Installation |
| Signing | **NOT CONFIGURED** | no certificate; refusal verified |
| Production unsigned guard | **PASS** | exit 3, no override; tested; workflow mirrors it |
| Security regression | **PASS** | deny, audit, suites, boundary unchanged |
| Worktree clean | **PASS** | `git status --porcelain` empty at the end |

## Final release decision

**NOT RELEASE READY.**

Not because anything executed failed — everything executed passed — but because two conditions
the brief names as required are not executed and cannot be executed from here: Linux CI has
never run on the release commit (there is no remote to run it on), and the clean-VM
installation has not been done. Signing is a third, accepted for a beta and barred for anything
else. Putting "RELEASE READY" above three unexecuted rows would be the thing this document
exists to prevent.

What it *is*: technically release-ready for an **unsigned beta**, with a reproducible build, a
manifest that cannot name the wrong commit, a chooser that has been clicked, an installer that
has been installed, and a written, scripted procedure for the rest. The distance to RELEASE
READY is three actions, all outside this repository, all listed under "Residual risk" with an
owner.
