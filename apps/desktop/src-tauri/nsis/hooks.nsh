; Included by Tauri's NSIS template through bundle.windows.nsis.installerHooks.
;
; NSIS records each embedded file's last-write time so it can restore it on install. That time
; is when the linker finished, so two installers of one commit differed from the first byte of
; the compressed data on, while the executables inside them were identical. Turned off, the
; installer is a function of its inputs and two builds of one commit hash the same
; (verified 2026-09-15, see docs/security/RELEASE_SECURITY.md, "Reproducible builds").
;
; The macro runs at the top of the Install section, before `File "${MAINBINARYSRCPATH}"`, which is
; the only File command that matters; the flag stays off for everything after it.
!macro NSIS_HOOK_PREINSTALL
  SetDateSave off
!macroend
