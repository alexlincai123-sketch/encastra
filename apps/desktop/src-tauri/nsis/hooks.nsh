; Included by Tauri's NSIS template through bundle.windows.nsis.installerHooks.
;
; NSIS records each packaged file's last-write time so it can restore it on install. That time is
; whenever the file happened to be written on the building machine, so an installer built twice
; from one commit is not the same bytes — which makes "this installer is the code you can read"
; unprovable by hash.
;
; `SetDateSave` is a *compiler* flag, not an instruction: it does not add a line to the compiled
; script, it changes two DWORDs inside each `File` the compiler has yet to read. So it only covers
; what comes after it, and where it is written decides what it covers.
;
; It is set twice, and both are load-bearing:
;
;   - At file scope, which Tauri `!include`s near the top of the generated script — before the MUI
;     page macros, and so before the `File` that packages the wizard sidebar bitmap
;     (`modern-wizard.bmp`, packaged twice, once per welcome page). That bitmap comes out of the
;     NSIS installation Tauri downloads into %LOCALAPPDATA%\tauri\NSIS, so its date is whenever
;     that download was unpacked: frozen on a developer machine that downloaded it once, and a
;     fresh timestamp on every hosted runner, which downloads NSIS again for each job. This is
;     what made the two release-workflow builds of 0.5.0-rc.3 differ from each other while
;     wrapping a byte-identical executable — and what made three builds on the developer machine
;     agree for a reason that was not the recipe. Read out of the installers themselves: 159 of
;     the 161 extractions carried no date, and the two that did were this bitmap, stamped
;     2026-09-11T01:01:18Z locally against 15:29:08Z and 15:51:48Z on the runner's two runs.
;
;   - In NSIS_HOOK_PREINSTALL, which Tauri inserts at the top of the Install section, before
;     `File "${MAINBINARYSRCPATH}"`. Redundant while the `!include` stays where it is, and kept
;     because the hook is the only part of this file's position that Tauri documents: if a future
;     Tauri moved the include below the pages, this is what would still cover the main binary.
;
; The property is checked rather than assumed: scripts/verify/installer_determinism.py packages
; twice from one build and requires the two installers to be byte-identical.

SetDateSave off

!macro NSIS_HOOK_PREINSTALL
  SetDateSave off
!macroend
