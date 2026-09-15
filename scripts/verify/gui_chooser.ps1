# Usage: start Encastra (any build), then `.\scripts\verify\gui_chooser.ps1`. Needs a desktop
# session; the interface language may be English or Spanish (the two the checks know).
#
# Drives the running Encastra build through Settings -> Projects -> Browse, twice: once to cancel
# the native folder chooser, once to pick a folder with spaces and non-ASCII characters in its
# name, and checks what the application shows afterwards. Every check prints PASS/FAIL with the
# observed value; nothing is assumed from "the button exists".
#
# The chooser is a Win32 common dialog (#32770). Its OK/Cancel/folder-name controls surface to
# UI Automation as plain panes without Invoke/Value patterns, so they are driven the way the
# shell itself would: BM_CLICK and WM_SETTEXT to their window handles. The application's own
# controls are WebView2 content and are driven through UI Automation proper.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class W32 {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageW(IntPtr h, uint m, IntPtr w, string l);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
}
"@
$A = [System.Windows.Automation.AutomationElement]
$T = [System.Windows.Automation.TreeScope]
$BM_CLICK = 0x00F5; $WM_SETTEXT = 0x000C

function Report($ok, $what, $observed) { "{0}  {1}  -> {2}" -f ($(if ($ok) { 'PASS' } else { 'FAIL' }), $what, $observed) }

$proc = Get-Process encastra-desktop | Select-Object -First 1
"app pid $($proc.Id) exited=$($proc.HasExited) exe=$($proc.Path)"
$root = $A::RootElement
$byPid = New-Object System.Windows.Automation.PropertyCondition($A::ProcessIdProperty, $proc.Id)

function AppWindow { $root.FindAll($T::Children, $byPid) | Where-Object { $_.Current.ClassName -eq 'Tauri Window' } | Select-Object -First 1 }
function Find($scopeEl, $ctrl, $namePattern) {
    foreach ($e in $scopeEl.FindAll($T::Descendants, [System.Windows.Automation.Condition]::TrueCondition)) {
        if ($e.Current.ControlType.ProgrammaticName -eq "ControlType.$ctrl" -and $e.Current.Name -match $namePattern) { return $e }
    }
    return $null
}
function ById($scopeEl, $id) { $scopeEl.FindFirst($T::Descendants, (New-Object System.Windows.Automation.PropertyCondition($A::AutomationIdProperty, $id))) }
function Click($el) { $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke() }
function Dialogs { @($root.FindAll($T::Children, $byPid) | Where-Object { $_.Current.ClassName -eq '#32770' }) }
function WaitDialog($seconds) { for ($i = 0; $i -lt $seconds * 4; $i++) { $d = Dialogs; if ($d.Count -gt 0) { return $d[0] }; Start-Sleep -Milliseconds 250 }; return $null }
function WaitNoDialog($seconds) { for ($i = 0; $i -lt $seconds * 4; $i++) { if ((Dialogs).Count -eq 0) { return $true }; Start-Sleep -Milliseconds 250 }; return $false }
function DlgChild($dlg, $class, $namePattern) {
    foreach ($c in $dlg.FindAll($T::Children, [System.Windows.Automation.Condition]::TrueCondition)) {
        if ($c.Current.ClassName -eq $class -and $c.Current.Name -match $namePattern) { return $c }
    }
    return $null
}
function Hwnd($el) { [IntPtr]$el.Current.NativeWindowHandle }
function FolderField { $f = ById (AppWindow) 'pref-project-folder'; $f.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value }

# A chooser left open by an earlier attempt would block everything below.
$stale = Dialogs
if ($stale.Count -gt 0) { "closing a stale chooser first"; [void][W32]::SendMessage((Hwnd (DlgChild $stale[0] 'Button' '^(Cancelar|Cancel)$')), $BM_CLICK, 0, 0); [void](WaitNoDialog 5) }

$win = AppWindow
Report ($null -ne $win) "main window found" "$($win.Current.Name) class=$($win.Current.ClassName)"

# 1. Settings -> Projects. WebView2 publishes its accessibility tree only once a client asks for
# it, so the first scans can come back with panes only; ask until the sidebar is there.
$settings = $null
for ($i = 0; $i -lt 60 -and -not $settings; $i++) { $settings = Find (AppWindow) 'Button' '^(Ajustes|Settings)$'; if (-not $settings) { Start-Sleep -Milliseconds 500 } }
Report ($null -ne $settings) "sidebar exposed to UI Automation" "after $i scan(s)"
Click $settings
Start-Sleep -Milliseconds 800
$projectsNav = Find (AppWindow) 'Button' '^(Proyectos|Projects)'
Report ($null -ne $projectsNav) "settings nav 'Projects' found" $projectsNav.Current.Name
Click $projectsNav
Start-Sleep -Milliseconds 800
$before = FolderField
"folder field before: '$before'"
$browse = Find (AppWindow) 'Button' '(Examinar|Browse)'
Report ($null -ne $browse -and -not $browse.Current.IsOffscreen) "Browse button found and on screen" "$($browse.Current.Name) enabled=$($browse.Current.IsEnabled)"

# 2. Open the chooser and cancel it
Click $browse
$dlg = WaitDialog 10
Report ($null -ne $dlg) "native chooser window appeared" "'$($dlg.Current.Name)' class=$($dlg.Current.ClassName) pid=$($dlg.Current.ProcessId)"
$cancel = DlgChild $dlg 'Button' '^(Cancelar|Cancel)$'
Report ($null -ne $cancel) "chooser has a Cancel button" "'$($cancel.Current.Name)' hwnd=$(Hwnd $cancel)"
[void][W32]::SendMessage((Hwnd $cancel), $BM_CLICK, 0, 0)
$gone = WaitNoDialog 10
Report $gone "chooser closed on Cancel" "dialogs left: $((Dialogs).Count)"
$proc.Refresh()
Report (-not $proc.HasExited) "application still running after Cancel" "exited=$($proc.HasExited)"
$afterCancel = FolderField
Report ($afterCancel -eq $before) "folder field unchanged after Cancel" "'$afterCancel'"

# 3. Open the chooser and pick a folder whose name has spaces and non-ASCII characters
$target = Join-Path $env:LOCALAPPDATA 'Temp\Encastra GUI ñ 日本語 test'
New-Item -ItemType Directory -Force -Path $target | Out-Null
$browse = Find (AppWindow) 'Button' '(Examinar|Browse)'
Click $browse
$dlg = WaitDialog 10
Report ($null -ne $dlg) "native chooser window appeared again" "'$($dlg.Current.Name)'"
$edit = DlgChild $dlg 'Edit' '.*'
Report ($null -ne $edit) "chooser folder-name field found" "id=$($edit.Current.AutomationId) hwnd=$(Hwnd $edit)"
[void][W32]::SendMessageW((Hwnd $edit), $WM_SETTEXT, 0, $target)
Start-Sleep -Milliseconds 300
$ok = DlgChild $dlg 'Button' '^(Seleccionar carpeta|Select Folder|Aceptar|OK)$'
Report ($null -ne $ok) "chooser confirm button found" "'$($ok.Current.Name)'"
[void][W32]::SendMessage((Hwnd $ok), $BM_CLICK, 0, 0)
$gone = WaitNoDialog 10
Report $gone "chooser closed on confirm" "dialogs left: $((Dialogs).Count)"
Start-Sleep -Milliseconds 1000
$proc.Refresh()
Report (-not $proc.HasExited) "application still running after confirm" "exited=$($proc.HasExited)"
$after = FolderField
Report ($after -eq $target) "chosen path came back into the application exactly" "'$after' (expected '$target')"

# 4. The application still navigates afterwards
Click (Find (AppWindow) 'Button' '^(Inicio|Home)$')
Start-Sleep -Milliseconds 800
$homeBtn = Find (AppWindow) 'Button' '(Nuevo flujo|New workflow)'
Report ($null -ne $homeBtn) "Home view responds after the chooser round-trips" $homeBtn.Current.Name
$proc.Refresh()
Report (-not $proc.HasExited) "application still running at the end" "exited=$($proc.HasExited) responding=$($proc.Responding)"
