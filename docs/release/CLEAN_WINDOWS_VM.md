# Clean Windows machine verification

The procedure a release has to survive on a machine that has never seen Encastra, with the
parts that a script can do done by a script, and the parts that only a person at a desktop can
do named as such. `docs/security/RELEASE_SECURITY.md` §Clean-install verification is the older,
prose-only version of this; this page is the one to follow.

**Automated:** [`CLEAN_VM_ACCEPTANCE.md`](CLEAN_VM_ACCEPTANCE.md) runs steps 2–10 and much more
(restart, upgrade, damaged state, filesystem boundaries, a second cycle from the same snapshot,
runs broken on purpose) on a real Windows 11 client VM, with a judge that re-derives every verdict.
What stays with a person is step 1 (SmartScreen on a downloaded file) and a look at the machine.

## What exists that is close to a clean machine, and what it does not cover

`.github/workflows/release.yml` has an `install` job: a fresh `windows-latest` runner downloads
the installer the build job produced, runs `scripts/verify/install_check.ps1` (silent per-user
install, version, build stamp, HKCU uninstall entry, nothing under HKLM, shortcut, directory ACL,
first launch stays up), then uninstalls and checks nothing is left. That runner is a clean
Windows Server image with no user profile history — the nearest thing to a clean VM the
repository can reach without a person, and `release_check.py` counts a green run of it as CI
evidence.

It does **not** cover: the native folder chooser (a modal Win32 dialog needs an interactive
desktop; the runner has none), SmartScreen's behaviour on a downloaded file (the runner does
not download through a browser), the WebView2 runtime being absent (the image has it), and
Windows 10. Those are the reasons a person still does this once per release on a real VM.

## The machine

| | |
|---|---|
| Windows | 11, current public build; **and** 10 22H2 if a 10 user is expected — record the build number (`winver`) |
| Profile | a fresh user, no prior Encastra, no Rust, no Node, no developer mode |
| WebView2 | note whether it is present before installing (`Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'` or `Get-AppxPackage *WebView*`); Windows 11 ships it, 10 may not |
| Network | on, so SmartScreen can be observed; a proxy or Resource Monitor open to watch for connections |
| Snapshot | taken **before** step 1, restored after step 9 |

## The artefact

Copy exactly one installer to the VM, and its published hash from `docs/RELEASE.md` at the
publication commit. Before running it:

```powershell
Get-FileHash .\Encastra_<version>_x64-setup.exe -Algorithm SHA256     # must equal RELEASE.md
Get-AuthenticodeSignature .\Encastra_<version>_x64-setup.exe | Format-List Status, SignerCertificate, TimeStamperCertificate
```

`NotSigned` is the expected and documented answer until there is a certificate; `Valid` with a
timestamper afterwards. Anything else (`HashMismatch`, `NotTrusted`) stops the procedure.

## Steps

Each step says who does it. **SCRIPT** steps are `scripts/verify/*.ps1`; run them from a
PowerShell prompt in the folder that holds the installer and the scripts (copy `scripts/verify`
to the VM with the installer). Keep every script's output with the VM record. They are a person's
check of one machine; the gate's `clean_vm` is the automated acceptance in `CLEAN_VM_ACCEPTANCE.md`.

1. **PERSON — SmartScreen.** Double-click the installer once, from Explorer, and record exactly
   what Windows shows (screenshot). Cancel it. This is what a user meets first; the release notes
   must describe it no more gently than it appears.
2. **SCRIPT — install and inspect.**
   ```powershell
   .\install_check.ps1 -Installer .\Encastra_<version>_x64-setup.exe -ExpectedVersion <version> *> install.log
   ```
   Every line must read `PASS`. It checks: `NotSigned`/`Valid` as expected; silent install exit 0
   with no elevation prompt; `%LOCALAPPDATA%\Encastra\encastra-desktop.exe` and `uninstall.exe`;
   ProductVersion; the build commit stamped in the binary; HKCU uninstall entry and **no** HKLM
   entry; the Start Menu shortcut; the directory ACL (recorded, not judged: a per-user directory
   is writable by the user by design); the installed copy launches and stays up.
3. **PERSON — first run, network.** With the application open, confirm in Resource Monitor (or
   the proxy) that it makes **no** outbound connection. Confirm nothing was created outside
   `%LOCALAPPDATA%\Encastra` and `%APPDATA%\dev.encastra.app` (`Get-ChildItem -Recurse $env:APPDATA,$env:LOCALAPPDATA | Where-Object LastWriteTime -gt <install time>`).
4. **SCRIPT — the native chooser.** With the application still open:
   ```powershell
   .\gui_chooser.ps1 *> chooser.log
   ```
   Drives Settings → Projects → Browse through UI Automation: the chooser appears, Cancel leaves
   the application and the field intact, a folder with spaces and non-ASCII characters comes
   back exactly, Home responds afterwards. Every line `PASS`. (Interface language English or
   Spanish.)
5. **PERSON — a real workflow.** Home → *Thumbnails* example. Choose its two folders with the
   Choose buttons, allow the permissions, put an image in the watched folder, run. The output
   lands in the chosen output folder and nowhere else.
6. **PERSON — the permission binds.** Edit the output node's folder by hand to a folder that was
   **not** chosen (type a path). Run again. It must be refused with a message naming the
   folder, and nothing written there.
7. **PERSON — scratch is cleaned.** After the runs finish, `%TEMP%\encastra` is empty or absent.
8. **PERSON — close and reopen.** The application reopens; the project folder chosen in step 4
   is still shown in Settings.
9. **SCRIPT — uninstall and nothing is left.**
   ```powershell
   Get-Process encastra-desktop -ErrorAction SilentlyContinue | Stop-Process -Force
   Start-Process "$env:LOCALAPPDATA\Encastra\uninstall.exe" -ArgumentList '/S' -Wait
   Test-Path "$env:LOCALAPPDATA\Encastra\encastra-desktop.exe"                                       # False
   Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' | % { Get-ItemProperty $_.PSPath } | ? DisplayName -eq 'Encastra'   # nothing
   Get-ChildItem "$env:APPDATA\dev.encastra.app" -ErrorAction SilentlyContinue                        # record what is left: preferences are a choice, credentials would not be
   ```
10. **SCRIPT — reinstall.** Run step 2 again on the same machine (no snapshot restore): a
    second install over a clean uninstall must pass identically. Then restore the snapshot.

## Recording the result

Put `install.log`, `chooser.log`, the SmartScreen screenshot, `winver`'s build number and the
answers to steps 3, 5–8 in `docs/release/vm/<version>/`.

A log from these steps does **not** turn `clean_vm` PASS: one install proves one install. Since
0.5.0-rc.6 `release_check.py --evidence-vm` takes the Clean VM acceptance directory (cycles A, B,
upgrade and the negative cycles), judges it again and ties it to this tree's artefacts
(`CLEAN_VM_ACCEPTANCE.md`). Handed a log, it says EXTERNAL_REQUIRED if the log passed and FAIL if
it did not.

## Status

| Version | Machine | Steps | Result |
|---|---|---|---|
| 0.5.0-beta.1 | development machine (Windows 11 26200), **not** a clean VM | 2, 4, and steps 1/3/5–9 **not executed** | see `docs/audits/2026-09-15-final-release-readiness.md` |
| 0.5.0-rc.3 | GitHub-hosted `windows-latest` runner (a fresh image; not a VM anyone can inspect afterwards), `release.yml` → `install`, runs 34986561347 and 34986561591 | 1 (hash, `NotSigned`), 3 (silent install, per-user, nothing under HKLM), 4 in part (ACL recorded), 5 in part (the window opens and stays up; network and file-creation checks **not** made), 9 (uninstall leaves nothing) — steps 2, 6, 7, 8 **not** executed (no chooser can be driven there) | PASS for what it covers; the rest is B5 in `docs/RELEASE_CANDIDATE_READINESS.md` |
