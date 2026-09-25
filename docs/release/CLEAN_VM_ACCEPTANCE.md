# Clean VM acceptance

An automated, repeatable acceptance run of a **published** Encastra installer on a Windows 11
client that has never seen Encastra, with every result traceable to evidence and every verdict
re-derived by a program that does not trust the machine it judges.

`CLEAN_WINDOWS_VM.md` is the procedure for a person; this page is the machine that does the parts
a machine can do, on a real Windows client (not a CI server image), including a restart, an
upgrade, uninstall/reinstall, a second cycle from the same snapshot, and runs that are broken on
purpose to prove the harness notices.

## Architecture

```
 Windows host (repo)                      Linux with /dev/kvm (WSL2 here)          Windows 11 VM
 ───────────────────                      ───────────────────────────────          ─────────────
 make_harness.py  ── verifies identity ──▶ lab.sh cycle NAME                         bootstrap.ps1 (base)
   tag→commit, RELEASE.md@tag,              fresh qcow2 overlay of CLEAN_BASELINE      └▶ guest\entry.ps1 (disc)
   GitHub digests, SHA256SUMS,              + harness ISO (read-only CD)                  plan.json steps, state on R:
   build stamp; writes expected.json        + results disk (FAT32, CLEANVM_R)             Check → result.json + COM1
 run_cycle.py ── copies disc ────────────▶  + COM1 captured to serial.log              powers off
 report.py  ◀── results + serial.log ────  mcopy results back
   re-derives every verdict
```

* **The artefact** is the published installer, never a rebuild: `make_harness.py` refuses to build
  a disc unless the tag resolves to a commit on `origin/main`, `docs/RELEASE.md` *at that tag* names
  the installer and executable with the same SHA-256 as the local files and the GitHub Release
  digests and `SHA256SUMS`, and the executable carries the build commit the manifest names.
  `expected.json` then states what the VM must observe, including the documented three-byte
  difference between the published and the installed executable (Tauri rewrites
  `__TAURI_BUNDLE_TYPE_VAR_UNK` to `…_NSS`).
* **The base image (`CLEAN_BASELINE`)** is built once from the Microsoft Windows 11 Enterprise
  Evaluation ISO by `lab.sh build-base` with `autounattend.xml`. It is read-only afterwards and
  identified by its SHA-256; every cycle boots a *new* overlay backed by it, with its own copy of
  the UEFI variables and TPM state. "Restore the snapshot" is "make a new overlay".
* **Two channels of evidence.** The guest writes each assertion to the results disk *and* to COM1;
  the host captures COM1 itself. `report.py` requires the two to agree.
* **The judge is not the guest.** `report.py` recomputes every scenario from its assertions,
  requires the checks it lists per scenario (a deleted check fails the scenario), re-reads the
  journeys logs, checks the disc the VM saw is the disc that was assembled, compares cycle A with
  cycle B, and requires every negative cycle to fail exactly where its spec says.

## What the base image is

Windows 11 Enterprise Evaluation 25H2 (26200), en-US, from
`https://go.microsoft.com/fwlink/?linkid=2334167` (ISO SHA-256 recorded in the evidence; its boot
and setup binaries carry valid Microsoft Authenticode signatures). Deliberate differences from a
stock install, and nothing else:

| Change | Why |
|---|---|
| Local account `tester` in Administrators, **empty password**, automatic logon | A desktop the harness can drive; UAC gives it a filtered token like a home user. No password means no secret stored. |
| Device encryption prevented | A snapshot nobody can read is not auditable. |
| No sleep, screen timeout or lock screen | The harness drives a desktop. |
| `C:\ProgramData\cleanvm-agent\bootstrap.ps1` + HKCU `Run\CleanVmAgent` | Starts the harness when (and only when) a CD labelled `CLEANVM_H` is inserted. |
| Evaluation licence activated during the build (the only time the VM has network) | An evaluation that was never activated sits in notification state. |
| Secure Boot off; Setup's Secure Boot requirement waived (`LabConfig\BypassSecureBootCheck`) | OVMF's Secure Boot build needs SMM, which does not survive nested KVM under Hyper-V (WSL2) on the host used. TPM 2.0 (swtpm), CPU and RAM requirements still apply. |

During a cycle the VM has **no route out** (QEMU user networking, `restrict=on`).

## Running it

Host prerequisites: Windows with WSL2 and nested virtualisation (`/dev/kvm` present in the
distro), and in the distro `qemu-system-x86 qemu-utils ovmf swtpm swtpm-tools xorriso mtools
dosfstools socat python3-pil`. About 30 GB free.

```bash
# once: the ISO, then the base image (about 25 minutes)
curl -L -o /srv/encastra-vm/iso/win11-ent-eval-26200.iso "<the fwlink above>"
/srv/encastra-vm/lab/lab.sh build-base          # lab/ is scripts/cleanvm/lab copied into the distro

# on the Windows host, from the repository
gh release download v0.5.0-rc.5 -D rc5
python scripts/cleanvm/run_cycle.py --cycle A --evidence ../cleanvm-evidence -- --mode full --release-dir rc5
python scripts/cleanvm/run_cycle.py --cycle B --evidence ../cleanvm-evidence -- --mode full --release-dir rc5
python scripts/cleanvm/run_cycle.py --cycle U --evidence ../cleanvm-evidence -- --mode upgrade --release-dir rc5 \
    --upgrade-from-setup <rc.4 installer> --upgrade-from-exe <rc.4 encastra-desktop.exe>
for n in N1-tampered N2-missing N3-contaminated N4-wrong-version N5-runtime; do
  python scripts/cleanvm/run_cycle.py --cycle $n --negative $n --evidence ../cleanvm-evidence -- --release-dir rc5
done
python scripts/cleanvm/report.py --cycles ../cleanvm-evidence/{A,B,U,N*} \
    --negative-spec scripts/cleanvm/negative-spec.json --out ../cleanvm-evidence/report
```

Before the baseline the guest waits until Windows' own first-logon work is over (the per-user
OneDriveSetup has replaced its `Run` value and exited): on a loaded host it once overlapped the
install and landed in the diff as if the installer had done it.

## Scenario matrix

Every scenario writes `results/scenarios/<ID>/result.json` (expected, observed, every assertion
with what it saw, evidence files) and the same assertions to COM1. A cycle in `full` mode runs
CLEAN-001..010, 012, 013 and CONTAMINATION with one real Windows restart between 006 and 007;
`upgrade` mode runs CLEAN-001, 002, 011 and CONTAMINATION. CLEAN-014 is cycle B compared with A.

| ID | What is asserted (the property, not a proxy for it) |
|---|---|
| CLEAN-001 | Fresh overlay (no marker from an earlier cycle); provisioned base; Windows' first-logon setup finished; no file/folder named `*encastra*` on C:, no uninstall entry, shortcut, process, WebView2 policy; no rustc/cargo/node/npm/git/cl/msbuild/makensis on PATH, no toolchain directories or variables, developer mode off; harness token at medium integrity; licence usable for the whole cycle. Records `environment.json`. |
| CLEAN-002 | Installer on the disc = the digest the host verified (tag → commit on `origin/main`, `RELEASE.md` at the tag, GitHub Release digest, `SHA256SUMS`); `NotSigned` as documented; the copy in Downloads is byte-identical. Critical: a wrong byte stops the cycle before anything is installed. |
| CLEAN-003 | `scripts/verify/install_check.ps1` (silent per-user install, no FAIL line, finished — an elevation prompt would have hung it); build commit stamped in the binary; installed exe = published exe with only the NSIS marker rewritten; install dir = exe + uninstaller; exactly one HKCU uninstall entry; Run keys, startup items, services, scheduled tasks, firewall rules, environment, HKCU classes, HKLM software, WebView2 policies unchanged; only Encastra shortcuts; no top-level folder but Encastra's. |
| CLEAN-004 | The installed copy reaches *ready* (top bar rendered and an IPC round trip to the Rust side), first-run welcome shown, still up 20 s later; every module the host loads comes from Windows, the install directory or the WebView2 runtime — none from a toolchain or the harness disc; WebView2 processes run from the Windows runtime; no non-loopback connection; no Application Error/WER/Hang event. |
| CLEAN-005 | `scripts/verify/gui_journeys.ps1 -Launch -Repeat N` on the installed copy: the five chooser journeys (projects-location, publish-into, import-from, grant-to-component, run-input) and their refusals, SUMMARY failed=0 skipped=0, no FAIL/SKIP line anywhere, stamp = build commit, no crash event. |
| CLEAN-006 | Welcome dismissed and language switched to Español *through Settings*; after a graceful close (WM_CLOSE) nothing is left running; after relaunch language, preferences and the library listing are identical. |
| CLEAN-007 | Windows really restarted (LastBootUpTime moved); Encastra did not start by itself; installed files byte-identical; state read before the restart is what is read after it; the journeys pass again after the restart. |
| CLEAN-008 | open_project on a missing file (`project/io`), on win.ini (`not-a-project`), on a damaged file (`project/archive`); import from an unchosen folder (`import/folder-not-chosen`): each a structured refusal, the application still ready. Garbage preferences: starts on defaults. Garbage `library.json`: starts, moves it to `library.json.corrupt-<ms>` with exactly the unreadable bytes, says so, reads a new empty library; with the index restored, reads it again. |
| CLEAN-009 | With no folder chosen in the process, import from `C:\Windows`, Documents, traversal and `\\?\` forms is refused; run_graph with grants to unchosen/system folders is refused *for the folder* (`folder-not-chosen`/`folder-unusable`); save/reopen through a path with spaces and non-ASCII letters works; saving into `C:\Windows`, into a missing folder or over a read-only file fails with `project/io` and writes nothing; a library index locked by another process is reported (`library/io`), not quarantined, not touched. |
| CLEAN-010 | Launch, graceful close with no orphan within 15 s, relaunch, a second launch, hard kill of the host with no orphaned WebView2 within 45 s, relaunch after the kill with state readable. |
| CLEAN-011 | Previous published version (0.5.0-rc.4, identity from `RELEASE.md` at its tag) installed, state set through the interface, this version installed over it: one HKCU entry at the new version, only exe + uninstaller in the directory, language/welcome/preferences carried over, journeys pass, footprint and uninstall as for a fresh install. |
| CLEAN-012 | Silent uninstall, following the uninstaller's whole process tree: exe, uninstaller, directory, uninstall entry, shortcuts, processes gone; `%TEMP%\encastra` empty or absent; user data kept (documented) with no credential-like file outside the WebView2 profile; `HKCU\Software\encastra` holds only what Tauri keeps with the user data; every persistence surface as the baseline had it. |
| CLEAN-013 | Reinstall over the kept user data passes CLEAN-003's checks, reaches ready, picks the data up; a second uninstall is as clean as the first. |
| CONTAMINATION | At the end, every persistence surface equals the baseline, and the only Encastra-named paths are the documented user data, the downloaded installer, an empty `%TEMP%\encastra`, and the harness's own folders. |
| CLEAN-014 | Cycle B, on a new overlay of the same base image (same SHA-256): same scenario results, same installed file hashes, same Windows build and machine identity as A. |

## Negative cycles and mutation testing

A harness that only ever says PASS proves nothing. `negative-spec.json` names five cycles that are
broken on purpose, each of which must FAIL exactly where the spec says (report.py checks the
failing assertion, not just the verdict):

| Cycle | Fault | Must fail |
|---|---|---|
| N1-tampered | one byte of the installer flipped on the disc | CLEAN-002 (digest, Downloads copy); CLEAN-003 must not run |
| N2-missing | installer absent from the disc | CLEAN-002 (present); CLEAN-003 must not run |
| N3-contaminated | marker from "an earlier cycle", an `%LOCALAPPDATA%\Encastra` with an HKCU uninstall entry, a process named `encastra-desktop.exe` | CLEAN-001 (four checks); CLEAN-002/003 must not run |
| N4-wrong-version | install_check told to expect another version | CLEAN-003; CLEAN-004 must not run |
| N5-runtime | WebView2 pointed at a folder with no runtime; a journeys log whose SUMMARY says failed=0 with a FAIL line inside; an HKCU `Run` value named for Encastra | CLEAN-004 (ready), CLEAN-005 (buried FAIL), CLEAN-012 and CONTAMINATION (Run keys) |

`scripts/tests/test_cleanvm_report.py` does the same to the judge: 40 tests, each breaking one
thing in otherwise complete evidence (PASS with no assertions, a failed assertion under a PASS,
serial and disk disagreeing, a required check deleted, a buried FAIL in a journeys log, an injected,
uncommitted or dev-build cycle offered as acceptance, a timed-out VM, a different base between A
and B, a VM started without `restrict=on`, a DNS name for Encastra in the capture, a login or a
secret-looking form value kept in the WebView2 profile…).
A mutation run over report.py (37 mutants that each disable one of its rules) is killed by those
tests 36/37; the survivor removes one of two redundant guards against "no assertion executed",
and is equivalent.
(`python scripts/cleanvm/mutate_report.py` repeats it and exits non-zero on a survivor.)

## What the clean machine found

Classified as the mission's taxonomy requires; nothing here was turned green by weakening a check.

| Finding | Class | Evidence | Resolution |
|---|---|---|---|
| `gui_journeys.ps1` pressed a hidden **WebView2 frame caption "Close"** at the end of j2 and closed the application; j3–j5 then failed. WebView2 140 (the runtime a clean Windows 11 25H2 ships) publishes `BrowserCaptionButtonContainer` > Minimize/Maximize/Close (`WindowsCaptionButton`, rect Empty) ahead of the page; the runners' 152 does not, so 348 CI passes never saw it. | TEST_HARNESS_BUG | DIAG-UIA dump; CI log line `rect=(644,723 56x28)` for the page's Close vs the VM's unreadable one; no Application Error/WER event | `Find`/`FindEvery` ignore `WindowsCaptionButton`; `ElementFacts` prints `rect=Empty` instead of throwing |
| The installed executable differs from the published one by 3 bytes | EXPECTED_BEHAVIOR (documented in `RELEASE.md`) | `installed_exe_sha256` computed by the host | asserted exactly |
| Silent uninstall keeps `HKCU\Software\encastra\Encastra` (install location, installer language) | EXPECTED_BEHAVIOR (Tauri NSIS template: removed only with "Delete app data") | inventories; `installer.nsi` Section Uninstall | allowed only with exactly those values |
| An empty `%TEMP%\encastra` remains after runs | EXPECTED_BEHAVIOR (`ScratchDir::drop` removes each run's folder; this page's procedure accepts "empty or absent") | contamination scan | allowed only when empty |
| Evaluation never activated → notification state | ENVIRONMENT_PROBLEM | CLEAN-001 licence check, S1 | base build activates it (network only then) |
| Online OOBE "zero-day patch" failed (`OOBEZDP`) | ENVIRONMENT_PROBLEM | lab screenshot | link down during Setup/OOBE, up on request |
| OneDrive installing itself, Windows flipping BITS/PcaSvc start modes, Explorer's `IconCache.db`, per-user service suffixes, Recent-items shortcuts to harness files | ENVIRONMENT_PROBLEM (OS churn) | inventory diffs | quiet-wait before the baseline; start-mode changes judged only for non-Windows services; named allowances |
| A refused save (target read-only) leaves `<name>.encastra-writing` — a full copy of the project — beside the user's file: `Project::save` writes the temporary, the rename fails, the error returns and the temporary stays. | **PRODUCT_BUG** (present in 0.5.0-rc.5) | security review of cycle S6's final name scan (`cleanvm-work\read-only.encastra-writing`); `crates/encastra-project/src/lib.rs` | fixed on this branch: the temporary is removed when the write or the move fails; regression test `a_save_that_cannot_be_moved_into_place_leaves_nothing_beside_the_target` fails against the old code; CLEAN-009 now asserts no temporary is left |
| First *Save As* after a cold restart on a loaded host had not created its name edit when the journeys typed into it | TEST_HARNESS_BUG (race) | cycle A, CLEAN-007: "edit windows=[]", the next Save As seconds later fine | the name edit is waited for (bounded, 10 s) before falling back to typing |
| PowerShell 5.1 / StrictMode, uninstaller timing, node stderr under `Stop`, loose refusal matching, empty-vs-empty comparisons, a check that could never see outbound attempts, credentials not looked for inside the WebView2 profile, nothing inventoried while the product was installed and in use | HARNESS_BUG | S1–S3; two independent reviews | fixed: see the scenario table; network traffic is now captured by the host (`net.pcap`) and summarised, the profile databases are counted by the host, an inventory is taken just before each uninstall |
| Inventory floors read an ordered dictionary as if it were an object; a live inventory compared with one read back from disk; `Diff-List` counted `$null` as an entry | HARNESS_BUG | battery v2 aborted at CLEAN-001; battery v3 cycle D failed CLEAN-012/013 on "added: (null)" | `Prop` reads dictionaries; `Save-Inventory` returns what it wrote; `Diff-List` drops `$null` |
| Every WebView2 form-history row treated as a kept credential | HARNESS_BUG (rule too broad) | the one row kept is `_r_0_-version=1.0.0` | autofill rows are recorded and fail only when name or value looks like a secret |
| CLEAN-011 overwrote the expected artefact (`$A`) with the running application's handle (`$a`): PowerShell names are case-insensitive | HARNESS_BUG | cycle U (battery v4) | renamed to `$fromArt`/`$toArt`; U is archived as invalid and not counted; rerun as U2 |

One PRODUCT_BUG was found, in the published 0.5.0-rc.5: it is fixed in code on this branch, so a
release that carries the fix needs its own candidate build and its own Clean VM run.

## Results: 0.5.0-rc.5, 2026-09-25

**Artefact under acceptance.** `Encastra_0.5.0-rc.5_x64-setup.exe`, SHA-256
`afaec18b217d66171a5c9c9f530d94b6e7e591ca61af18a3101733cb01674f10`; `encastra-desktop.exe`
`14dc5d615676830ce34882fe663f64f56be32910047b20f3d20a65fdd1a40402` (installed:
`b7239b56…e74e82c`); build commit `1ce8e864`; tag `v0.5.0-rc.5` → `182b3d5`, an ancestor of
`origin/main` `99e1195`; identity agreed by `RELEASE.md` at the tag, the GitHub Release digests and
`SHA256SUMS`. Upgrade source: 0.5.0-rc.4, installer
`28b7b1bba351249f6f33e58bb41f6e08cd383de9c7c3db78e3a944e577a179d9`, identity from `RELEASE.md` at
`v0.5.0-rc.4` → `25d007d` (rc.4 has no GitHub Release).

**Machine.** `CLEAN_BASELINE` SHA-256 `bbc062866d5aa7d92433f6381e175b82269e66224c92d887ed8483ed2a97a2f0`
(the same in every cycle): Windows 11 Enterprise Evaluation 25H2, build 26200.6584, en-US,
WebView2 140.0.3485.66, PowerShell 5.1, harness at medium integrity.

**Verdict: `CLEAN_VM_ACCEPTANCE: FAIL`.** One PRODUCT_BUG in the published installer, found by
CLEAN-009 in both A and B.

| Scenario | A | B | U2 (upgrade) | D (dev build of the fix, not acceptance) |
|---|---|---|---|---|
| CLEAN-001 baseline | PASS | PASS | PASS | PASS |
| CLEAN-002 artefact | PASS | PASS | PASS | PASS |
| CLEAN-003 install | PASS | PASS | — | PASS |
| CLEAN-004 first launch | PASS | PASS | — | PASS |
| CLEAN-005 core flow (journeys ×3) | PASS | PASS | — | PASS |
| CLEAN-006 persistence | PASS | PASS | — | PASS |
| CLEAN-007 restart | PASS | PASS | — | PASS |
| CLEAN-008 errors | PASS | PASS | — | PASS |
| CLEAN-009 filesystem boundaries | **FAIL** | **FAIL** | — | PASS |
| CLEAN-010 lifecycle | PASS | PASS | — | PASS |
| CLEAN-011 upgrade rc.4 → rc.5 | — | — | PASS | — |
| CLEAN-012 uninstall | PASS | PASS | — | PASS |
| CLEAN-013 reinstall | PASS | PASS | — | PASS |
| CONTAMINATION | PASS | PASS | PASS | PASS |
| assertions | 305 | 305 | 149 | 305 |

* **CLEAN-009** in A and B: `a refused save leaves no .encastra-writing temporary beside the target
  -> …\cleanvm-work\read-only.encastra-writing exists=True`. The same assertion, the same observation,
  on two fresh overlays: it is the product, not the machine. D, the same matrix on a local build of
  the fixed source, passes it.
* **CLEAN-014: FAIL**, because B is not all PASS. The A/B comparison itself found no difference
  (same base image, same results scenario by scenario, same installed bytes, same Windows build).
* **NEGATIVE: PASS.** N1–N5 each failed exactly where `negative-spec.json` says, and the scenarios
  that must not run did not.
* **Network.** Every cycle ran with `-netdev user,id=n0,restrict=on`; the host capture shows only
  Windows' own DNS lookups (Microsoft, Bing, Office) and link-local broadcast — no DNS name
  containing "encastra", nothing reached.
* **WebView2 profile kept after uninstall:** 0 logins, 0 cookies, 0 cards; one form-history row
  (`_r_0_-version=1.0.0`).

**Harness.** Every cycle was assembled from a committed, clean harness tree. A and D ran at
`823f4dc`, B at `b9477e5` — the change between them is only in the host's judge, and the discs
A and B saw are byte-identical except `plan.json` and its manifest. U2 and the verdict ran at
`0192e34`, whose only guest change is confined to CLEAN-011. The first upgrade cycle, U, hit the
CLEAN-011 harness bug above; it is archived and not counted.

**Evidence** is kept outside the repository (about 45 MB for A, B, U2 and D: screenshots every
30 s, packet captures, the guest's results disk). The judge's output for this run —
`verdict.json` and `summary.md`, for the acceptance cycles and for D — is in
`docs/release/evidence/clean-vm-2026-09-25/`.

**What closes it.** 0.5.0-rc.5 cannot be closed: the defect is in its bytes. A candidate that
carries `efc0374` (the fix) together with `6263182` and `31ddbef` (the journeys' fixes), built by
`candidate.yml` and published, then the same battery — A, B, U, N1–N5, `report.py` → PASS — closes
the next candidate.

## Evidence a cycle leaves

`<evidence>/<cycle>/`: `plan.json`, `expected.json` (what the VM must observe, with the host's
identity evidence), `harness-manifest.json` + `harness.sha256` (the disc assembled vs the disc the
VM saw), `base.sha256`, `qemu.cmdline` (must show `restrict=on`), `net.pcap` (every frame the guest
sent), `serial.log` (the host's own capture of COM1), `shots/` (a screen every 30 s), and
`results/` — the guest's disk: `environment.json`, `state.json`, `summary.json`,
`inventory/{baseline,post-install,pre-*,post-uninstall,post-reinstall,final}.json`, and one folder
per scenario with `result.json` and its logs (install_check, gui_journeys, Windows events, dumps,
the WebView2 profile databases kept after uninstall). `report.py` writes `verdict.json` and
`summary.md`. Nothing in the evidence is a secret: the VM's only account has no password.

## Verifying a fix: local dev builds

A PRODUCT_BUG found here is fixed in code, and the fix can be run through the same matrix before
any release exists:

```bash
npm run tauri:build          # on a clean tracked tree; the executable is stamped with HEAD
python scripts/cleanvm/run_cycle.py --cycle D --evidence ../cleanvm-evidence -- --mode full \
    --dev-setup target/release/bundle/nsis/Encastra_<v>_x64-setup.exe --dev-exe target/release/encastra-desktop.exe
```

The disc, the plan and every CLEAN-002 line say *LOCAL DEV BUILD*, and `report.py` refuses such a
cycle as acceptance evidence. It shows the fix works on a clean machine; it does not replace a
candidate built by `candidate.yml` and its own acceptance run.

## Reset, repeat, troubleshoot

* **Reset** is structural: every cycle is a new overlay of the read-only base, with its own UEFI
  variables and TPM state. There is no state to clean between cycles. `lab.sh` refuses to reuse a
  cycle name and refuses to start while another cleanvm VM is running.
* **Rebuild the base** (`mv base base-old; lab.sh build-base`) only for a new Windows image; its new
  SHA-256 then appears in every cycle's `base.sha256`, and A and B must share it.
* **A cycle is slow or times out**: the host is short of memory (a 4 GB guest inside WSL2's default
  half of host RAM). `Wsl/Service/0x8007274c` from the host side means the WSL service timed out —
  retry, it is not the VM. Timeouts are reported as the cycle failing, never as a pass.
* **The guest never reports `BOOT`**: the harness disc is not labelled `CLEANVM_H`, or the base was
  built without `bootstrap.ps1`. `serial.log` shows how far firmware and Windows got.
* **A scenario fails**: read `results/scenarios/<ID>/result.json` (each assertion states what it
  expected and what it observed), then the logs beside it; `report.py`'s `summary.md` lists every
  problem per scenario.

## Known limitations

* **Secure Boot is off** in the VM (see *What the base image is*). Encastra does not depend on it,
  but a Secure-Boot-specific behaviour would not be seen.
* **Windows 11 25H2 only** (build 26200, en-US). Windows 10 and other display languages are not
  covered by this lab.
* **WebView2 is the inbox 140** — older than what an online machine auto-updates to. That is what
  exposed the journeys' hidden-caption-button bug; a runtime-version-specific product behaviour on a
  newer runtime is covered by the CI runners (152), not here.
* **The native folder chooser is driven by the journeys, not by a person**, and SmartScreen's
  reaction to a *downloaded* file (Mark of the Web) is not exercised: the cycles have no network,
  and a scripted install from a file with MotW would stop at the SmartScreen prompt. That remains a
  person's step in `CLEAN_WINDOWS_VM.md`.
* **Outbound connections are prevented, and recorded, but not attributed**: the host's `net.pcap`
  shows every frame the guest sent, but a capture outside the VM cannot say which process sent it.
  The per-process check (CLEAN-004) sees established connections only.
* **`release_check.py --evidence-vm` takes the evidence directory, not a log or a verdict.** Until
  0.5.0-rc.6 it took one `install_check.ps1` log and passed on its PASS lines, so CLEAN-003's
  `install.log` from a cycle whose acceptance FAILED satisfied it. It now takes the directory that
  holds the cycle directories (A, B, one upgrade cycle, the negative cycles in `negative-spec.json`
  and nothing else), judges them again with this tree's `report.py`, requires every required result
  PASS, and requires the installer and executable those cycles ran - name, SHA-256, version, build
  commit - to be this tree's artefacts. A `verdict.json` beside the cycles must equal the re-derived
  one. A log, or a verdict on its own, is never PASS (`scripts/tests/test_release_check_vm.py`).
* **The journeys run with `GITHUB_ACTIONS=true`** (their "unattended desktop" switch), which also
  clears the application's per-user state before each launch they make. Persistence is therefore
  checked by CLEAN-006/007/011 directly, not through the journeys.

## Closure criteria

`CLEAN_VM_ACCEPTANCE: PASS` requires, from committed, clean harness trees (A and B from
byte-identical harness discs): every scenario PASS in cycles A, B and U for the artefact under
acceptance (no injected fault, no dev build); CLEAN-014 PASS (same base image, same results, same
installed bytes); every negative cycle failing exactly where
`negative-spec.json` says; `report.py` exit 0. `CLEAN_VM_CLOSURE: CLOSED` additionally requires no
unresolved PRODUCT_BUG or HARNESS_BUG in that artefact.
