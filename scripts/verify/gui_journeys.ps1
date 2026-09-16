# Usage: start Encastra (any build), then `.\scripts\verify\gui_journeys.ps1`. Needs a desktop
# session; the interface language may be English or Spanish (the two the checks know).
#
# Blocker B5 in docs/RELEASE_CANDIDATE_READINESS.md: every filesystem permission in this
# application is gated on a folder somebody picked in a *native* chooser, *for a stated purpose*.
# There are four folder purposes and one file purpose, and only `projects-location` - the one
# purpose that gates nothing - had ever been driven through the interface. This script drives the
# other four end to end, and then the part that is the whole point of a purpose: the refusals.
#
#   1. projects-location   Settings -> Projects -> Browse            (Settings.tsx:293)
#   2. publish-into        Builder -> Publish -> Prepare             (panels/Publish.tsx:108)
#   3. import-from         Library -> Import                         (store.ts:863)
#   4. grant-to-component  Inspector -> folder field -> Choose       (panels/Inspector.tsx:101)
#   5. run-input (a file)  Inspector -> Starting material -> Choose  (panels/Inspector.tsx:163)
#
# The journeys are chained on purpose: journey 2 prepares a publication into a folder, and
# journey 3 imports that same folder back. A chooser that merely closed proves nothing; what is
# asserted after every confirm is that the folder became usable *for that one purpose* - a
# publication written into it, a publication read out of it, a file actually saved into the
# granted folder by a real run.
#
# Conventions inherited from scripts/verify/gui_chooser.ps1, deliberately, so the two logs read
# the same and scripts/release_check.py can read `^PASS` / `^FAIL` out of either:
#
#   * `Report $ok $what $observed` prints one line carrying the value that was observed, never
#     "the button exists".
#   * The application's own controls are WebView2 content and are driven through UI Automation.
#     WebView2 publishes its accessibility tree only once a client asks for it, so everything
#     here polls for an element rather than sleeping a fixed time and hoping.
#   * The chooser is a Win32 common dialog (`#32770`). Its OK/Cancel/name controls surface as
#     plain panes with no Invoke or Value pattern, so they are driven the way the shell itself
#     would: BM_CLICK and WM_SETTEXT to their window handles. Never a global SendKeys: every
#     message in this file goes to one specific window handle.
#
# A journey that cannot run prints FAIL, or SKIP with the reason. It never prints PASS. The exit
# code is 1 if anything failed and 2 if anything was skipped, because a skipped journey leaves
# B5 without the evidence it was asking for and a skip that exits 0 is a pass wearing a hat.
#
# This file is deliberately pure ASCII, so it is safe with or without a BOM (this repo has been
# bitten by Spanish and CJK literals arriving mangled from a BOM-less file). Where a Spanish
# string carries an accent the pattern spells it with `.` - `Qu. dice que es`, `bot.n Elegir`.
# The native dialog's own button names come from the *Windows* display language, not from the
# application's, which is why both languages are matched there too.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class W32 {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageW(IntPtr h, uint m, IntPtr w, string l);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  // The window WebView2 renders into throttles when it has no focus, which turns a poll into a
  // false negative. Raised once, by handle, at the start - never a global SendKeys.
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@
$A = [System.Windows.Automation.AutomationElement]
$T = [System.Windows.Automation.TreeScope]
$TRUE_COND = [System.Windows.Automation.Condition]::TrueCondition
$BM_CLICK = 0x00F5; $WM_SETTEXT = 0x000C

$script:passed = 0; $script:failed = 0; $script:skipped = 0

function Report($ok, $what, $observed) {
    if ($ok) { $script:passed++ } else { $script:failed++ }
    "{0}  {1}  -> {2}" -f ($(if ($ok) { 'PASS' } else { 'FAIL' }), $what, $observed)
}
function Skip($what, $why) { $script:skipped++; "SKIP  {0}  -> {1}" -f $what, $why }
function Note($text) { "note  $text" }

# --- the application ------------------------------------------------------------------------

$proc = Get-Process encastra-desktop -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) {
    "FAIL  Encastra is running  -> no encastra-desktop process; start the application first"
    "SUMMARY  passed=0 failed=1 skipped=0"
    exit 1
}
"app pid $($proc.Id) exited=$($proc.HasExited) exe=$($proc.Path)"

$root = $A::RootElement
$byPid = New-Object System.Windows.Automation.PropertyCondition($A::ProcessIdProperty, $proc.Id)

function AppWindow { $root.FindAll($T::Children, $byPid) | Where-Object { $_.Current.ClassName -eq 'Tauri Window' } | Select-Object -First 1 }
function Descendants($el) { if (-not $el) { return @() }; @($el.FindAll($T::Descendants, $TRUE_COND)) }

function Find($scopeEl, $ctrl, $namePattern) {
    foreach ($e in (Descendants $scopeEl)) {
        if ($e.Current.ControlType.ProgrammaticName -eq "ControlType.$ctrl" -and $e.Current.Name -match $namePattern) { return $e }
    }
    return $null
}
function FindEvery($scopeEl, $ctrl, $namePattern) {
    $out = @()
    foreach ($e in (Descendants $scopeEl)) {
        if ($e.Current.ControlType.ProgrammaticName -eq "ControlType.$ctrl" -and $e.Current.Name -match $namePattern) { $out += $e }
    }
    return $out
}
# WebView2 answers the first scans with panes only, so every lookup that matters waits.
function Wait($ctrl, $namePattern, $seconds) {
    for ($i = 0; $i -lt $seconds * 4; $i++) {
        $e = Find (AppWindow) $ctrl $namePattern
        if ($e) { return $e }
        Start-Sleep -Milliseconds 250
    }
    return $null
}
function ById($id) { (AppWindow).FindFirst($T::Descendants, (New-Object System.Windows.Automation.PropertyCondition($A::AutomationIdProperty, $id))) }
# React's useId makes the first half of every id unpredictable; the half that names the field is
# not, so fields are found by the suffix the component wrote.
function ByIdSuffix($suffix, $seconds) {
    for ($i = 0; $i -lt $seconds * 4; $i++) {
        foreach ($e in (Descendants (AppWindow))) {
            if ($e.Current.AutomationId -and $e.Current.AutomationId.EndsWith($suffix)) { return $e }
        }
        Start-Sleep -Milliseconds 250
    }
    return $null
}
function Click($el) { $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke() }
function ValueOf($el) {
    if (-not $el) { return '' }
    try { return $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value } catch { return '' }
}
function IsReadOnly($el) {
    try { return $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.IsReadOnly } catch { return $false }
}
# Chromium's SetValue on a text input dispatches the input event React listens for, so the store
# sees the change. The value is read back rather than assumed.
function SetValue($el, $text) {
    $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($text)
    Start-Sleep -Milliseconds 200
    return (ValueOf $el)
}
# Any sentence on screen matching a pattern - how a refusal is read back in the reader's own
# language, rather than inferred from a state that is not shown.
function FindText($pattern, $seconds) {
    for ($i = 0; $i -lt $seconds * 4; $i++) {
        foreach ($e in (Descendants (AppWindow))) {
            $n = $e.Current.Name
            if ($n -and $n -match $pattern) { return $n }
        }
        Start-Sleep -Milliseconds 250
    }
    return $null
}
function Rect($el) { return $el.Current.BoundingRectangle }
# Two "Choose" buttons can be on screen at once - one for the folder a component is granted, one
# for the file a run starts from. They are told apart by the row they sit in.
function ChooseButtonNear($anchor) {
    if (-not $anchor) { return $null }
    $r = Rect $anchor
    $best = $null; $bestGap = 1e9
    foreach ($b in (FindEvery (AppWindow) 'Button' '^(Elegir|Choose)')) {
        $br = Rect $b
        $gap = [Math]::Abs($br.Top - $r.Top)
        if ($gap -lt 40 -and $gap -lt $bestGap) { $best = $b; $bestGap = $gap }
    }
    return $best
}

# --- the native chooser ---------------------------------------------------------------------

function Dialogs { @($root.FindAll($T::Children, $byPid) | Where-Object { $_.Current.ClassName -eq '#32770' }) }
function WaitDialog($seconds) { for ($i = 0; $i -lt $seconds * 4; $i++) { $d = Dialogs; if ($d.Count -gt 0) { return $d[0] }; Start-Sleep -Milliseconds 250 }; return $null }
function WaitNoDialog($seconds) { for ($i = 0; $i -lt $seconds * 4; $i++) { if ((Dialogs).Count -eq 0) { return $true }; Start-Sleep -Milliseconds 250 }; return $false }
function Hwnd($el) { [IntPtr]$el.Current.NativeWindowHandle }
function DlgFind($dlg, $ctrl, $namePattern) {
    foreach ($c in (Descendants $dlg)) {
        if ($c.Current.ControlType.ProgrammaticName -eq "ControlType.$ctrl" -and $c.Current.Name -match $namePattern -and $c.Current.NativeWindowHandle -ne 0) { return $c }
    }
    return $null
}
function DlgEdit($dlg) {
    foreach ($c in (Descendants $dlg)) {
        if ($c.Current.ControlType.ProgrammaticName -eq 'ControlType.Edit' -and $c.Current.NativeWindowHandle -ne 0) { return $c }
    }
    return $null
}
$CONFIRM = '^(Seleccionar carpeta|Select Folder|Aceptar|OK|Guardar|Save|Abrir|Open)$'
$CANCEL = '^(Cancelar|Cancel)$'
function CancelChooser($dlg, $what) {
    $btn = DlgFind $dlg 'Button' $CANCEL
    if (-not $btn) { Report $false "$what : chooser has a Cancel button" 'none found'; return $false }
    [void][W32]::SendMessage((Hwnd $btn), $BM_CLICK, 0, 0)
    $gone = WaitNoDialog 10
    Report $gone "$what : chooser closed on Cancel" "dialogs left: $((Dialogs).Count)"
    return $gone
}
# Types a path into the chooser and confirms it. Returns whether the chooser actually closed:
# a path the shell will not accept leaves the dialog standing, which is itself the refusal.
function ConfirmChooser($dlg, $path, $what) {
    $edit = DlgEdit $dlg
    if (-not $edit) { Report $false "$what : chooser name field found" 'none found'; return $false }
    [void][W32]::SendMessageW((Hwnd $edit), $WM_SETTEXT, 0, $path)
    Start-Sleep -Milliseconds 400
    $ok = DlgFind $dlg 'Button' $CONFIRM
    if (-not $ok) { Report $false "$what : chooser confirm button found" 'none found'; return $false }
    [void][W32]::SendMessage((Hwnd $ok), $BM_CLICK, 0, 0)
    return (WaitNoDialog 10)
}
# Whatever the shell put on screen when it would not accept a path: its own message box is a
# second #32770 owned by this process, and its static text is the sentence the person reads.
function DialogTexts {
    $lines = @()
    foreach ($d in (Dialogs)) {
        $lines += "'" + $d.Current.Name + "'"
        foreach ($c in (Descendants $d)) {
            $n = $c.Current.Name
            if ($n -and $n.Length -gt 12 -and $c.Current.ControlType.ProgrammaticName -eq 'ControlType.Text') { $lines += "'" + $n + "'" }
        }
    }
    if ($lines.Count -eq 0) { return '(no dialog on screen)' }
    return ($lines -join ' | ')
}
function CloseAnyDialogs {
    for ($i = 0; $i -lt 6; $i++) {
        $d = Dialogs
        if ($d.Count -eq 0) { return $true }
        $btn = DlgFind $d[$d.Count - 1] 'Button' $CANCEL
        if ($btn) { [void][W32]::SendMessage((Hwnd $btn), $BM_CLICK, 0, 0) } else { return $false }
        Start-Sleep -Milliseconds 500
    }
    return ((Dialogs).Count -eq 0)
}

# --- somewhere to work ------------------------------------------------------------------------

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$sandbox = Join-Path $env:TEMP "encastra-journeys-$stamp"
$projectsLocation = Join-Path $sandbox 'projects-location'
$publishInto = Join-Path $sandbox 'publish-into'
$grantFolder = Join-Path $sandbox 'grant-to-component'
$inputFolder = Join-Path $sandbox 'run-input'
$junctionTarget = Join-Path $sandbox 'junction-target'
$junction = Join-Path $sandbox 'junction-link'
$missing = Join-Path $sandbox 'this-folder-does-not-exist'
foreach ($d in @($sandbox, $projectsLocation, $publishInto, $grantFolder, $inputFolder, $junctionTarget)) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
}
$inputFile = Join-Path $inputFolder 'evidence.txt'
Set-Content -Path $inputFile -Value 'evidence for the run-input journey' -Encoding ASCII
$projectFile = Join-Path $sandbox 'journeys.encastra'
"sandbox $sandbox"

$junctionMade = $false
try {
    cmd /c mklink /J "$junction" "$junctionTarget" | Out-Null
    $junctionMade = Test-Path $junction
} catch { $junctionMade = $false }

# A chooser left open by an earlier attempt would block everything below.
if ((Dialogs).Count -gt 0) { Note 'closing a stale chooser first'; [void](CloseAnyDialogs) }

$win = AppWindow
Report ($null -ne $win) 'main window found' "$($win.Current.Name) class=$($win.Current.ClassName)"
if ($win) { [void][W32]::SetForegroundWindow((Hwnd $win)) }

$sidebarSettings = Wait 'Button' '^(Ajustes|Settings)$' 30
Report ($null -ne $sidebarSettings) 'sidebar exposed to UI Automation' "settings item: '$($sidebarSettings.Current.Name)'"
if (-not $sidebarSettings) {
    "SUMMARY  passed=$script:passed failed=$script:failed skipped=$script:skipped  (harness could not reach the interface)"
    exit 1
}

function GoTo($pattern, $what) {
    $item = Wait 'Button' $pattern 15
    if (-not $item) { Report $false "navigate to $what" 'sidebar item not found'; return $false }
    Click $item
    Start-Sleep -Milliseconds 900
    return $true
}

# =============================================================================================
# JOURNEY 1 - projects-location (views/Settings.tsx:293)
#
# First on purpose. This is the one purpose that has been driven before, and it gates nothing:
# if it fails, the harness is broken rather than the feature.
# =============================================================================================
"--- journey 1: projects-location (Settings -> Projects -> Browse) ---"
try {
    [void](GoTo '^(Ajustes|Settings)$' 'Settings')
    $projectsNav = Wait 'Button' '^(Proyectos|Projects)' 10
    Report ($null -ne $projectsNav) 'j1 Settings nav Projects found' "'$($projectsNav.Current.Name)'"
    Click $projectsNav
    Start-Sleep -Milliseconds 800

    $field = ById 'pref-project-folder'
    $before = ValueOf $field
    $browse = Wait 'Button' '(Examinar|Browse)' 10
    Report ($null -ne $browse -and -not $browse.Current.IsOffscreen) 'j1 Browse button on screen' "'$($browse.Current.Name)' enabled=$($browse.Current.IsEnabled)"

    # Cancel: nothing chosen, nothing recorded, the preference untouched.
    Click $browse
    $dlg = WaitDialog 10
    Report ($null -ne $dlg) 'j1 chooser opened for projects-location' "'$($dlg.Current.Name)'"
    [void](CancelChooser $dlg 'j1')
    $afterCancel = ValueOf (ById 'pref-project-folder')
    Report ($afterCancel -eq $before) 'j1 preference unchanged after Cancel' "'$afterCancel'"

    # Confirm: the path comes back into the preference exactly.
    Click (Wait 'Button' '(Examinar|Browse)' 10)
    $dlg = WaitDialog 10
    $closed = ConfirmChooser $dlg $projectsLocation 'j1'
    Report $closed 'j1 chooser closed on confirm' "dialogs left: $((Dialogs).Count)"
    Start-Sleep -Milliseconds 800
    $after = ValueOf (ById 'pref-project-folder')
    Report ($after -eq $projectsLocation) 'j1 chosen folder became the projects preference' "'$after' (expected '$projectsLocation')"

    # Negative, junction: choose_folder canonicalises before it records (lib.rs, resolve_grant_
    # directory), so a junction must come back as the folder it points at. If the link's own path
    # came back, what was recorded and what the person chose would be two different places.
    if (-not $junctionMade) {
        Skip 'j1 junction resolves to its target' 'mklink /J was refused on this machine'
    } else {
        Click (Wait 'Button' '(Examinar|Browse)' 10)
        $dlg = WaitDialog 10
        $closed = ConfirmChooser $dlg $junction 'j1-junction'
        Start-Sleep -Milliseconds 900
        $afterLink = ValueOf (ById 'pref-project-folder')
        $refusal = FindText '(cannot be used|no se puede usar|not a folder on this machine|no es una carpeta)' 2
        if ($afterLink -eq $junctionTarget) {
            Report $true 'j1 junction resolved to its target, not the link' "'$afterLink'"
        } elseif ($afterLink -eq $junction) {
            Report $false 'j1 junction resolved to its target, not the link' "the link path came back unresolved: '$afterLink'"
        } elseif ($refusal) {
            Report $true 'j1 junction refused rather than followed' "'$refusal'"
        } else {
            Report $false 'j1 junction resolved to its target, not the link' "chooser closed=$closed, field now '$afterLink', no refusal on screen"
        }
    }
} catch {
    [void](CloseAnyDialogs)
    Report $false 'j1 projects-location journey ran to the end' "$($_.Exception.GetType().Name): $($_.Exception.Message)"
}

# =============================================================================================
# JOURNEY 2 - publish-into (panels/Publish.tsx:108)
#
# The panel refuses to arm Prepare until there is a saved project that matches the canvas
# (`ready` in Publish.tsx: projectPath, not dirty, no draft problems, no blocking findings), so
# the journey has to build and save one first. One Parse JSON step: it asks for no capability,
# so the review has nothing blocking to say and the chooser is what is under test.
# =============================================================================================
"--- journey 2: publish-into (Builder -> Publish -> Prepare) ---"
$preparedFolder = $null
try {
    [void](GoTo '^(Constructor|Builder)$' 'Builder')
    $palette = Wait 'Button' '(Parse JSON|encastra\.data\.json)' 15
    if (-not $palette) { throw 'the Parse JSON palette item never appeared' }
    Click $palette
    Start-Sleep -Milliseconds 700
    Report ($null -ne (FindText '(Parse JSON)' 5)) 'j2 a step is on the canvas' 'Parse JSON placed'

    $save = Wait 'Button' '^(Guardar|Save)$' 10
    Report ($null -ne $save) 'j2 Save button found' "'$($save.Current.Name)'"
    Click $save
    $dlg = WaitDialog 12
    Report ($null -ne $dlg) 'j2 native save dialog opened' "'$($dlg.Current.Name)'"
    $closed = ConfirmChooser $dlg $projectFile 'j2-save'
    Start-Sleep -Milliseconds 1500
    Report (Test-Path $projectFile) 'j2 project saved to disk' "$projectFile exists=$(Test-Path $projectFile)"

    $publish = Wait 'Button' '^(Publicar|Publish)$' 10
    Report ($null -ne $publish) 'j2 Publish button found' "'$($publish.Current.Name)'"
    Click $publish
    Start-Sleep -Milliseconds 900
    Report ($null -ne (FindText '(Preparar una publicaci|Prepare a publication)' 8)) 'j2 publish panel opened' 'heading on screen'

    $ns = ByIdSuffix '-namespace' 8
    $summary = ByIdSuffix '-summary' 5
    $title = ByIdSuffix '-title' 5
    $version = ByIdSuffix '-version' 5
    if (-not ($ns -and $summary -and $title -and $version)) { throw 'the publish draft fields are not exposed to UI Automation' }
    $nsValue = SetValue $ns 'dev.encastra.journeys'
    $titleValue = SetValue $title 'Journey evidence'
    $sumValue = SetValue $summary 'A saved project used as evidence for the chooser journeys.'
    $verValue = SetValue $version '1.0.0'
    Report ($nsValue -eq 'dev.encastra.journeys' -and $titleValue.Length -gt 0 -and $sumValue.Length -ge 20 -and $verValue -eq '1.0.0') 'j2 draft fields accepted what was typed' "namespace='$nsValue' title='$titleValue' version='$verValue' summary=$($sumValue.Length) chars"

    # The panel re-reviews on its own; give it a moment, then read whether Prepare is armed.
    Start-Sleep -Milliseconds 1500
    $prepare = Wait 'Button' '^(Preparar|Prepare)' 10
    if (-not $prepare) { throw 'the Prepare button is not on screen' }
    if (-not $prepare.Current.IsEnabled) {
        $why = FindText '(Guarda el proyecto|Save the project first|Guarda los cambios|Save your changes first|necesita|needs a)' 2
        Report $false 'j2 Prepare is armed for a clean saved project' "disabled; nearest sentence on screen: '$why'"
    } else {
        Report $true 'j2 Prepare is armed for a clean saved project' "enabled=$($prepare.Current.IsEnabled)"

        # Negative: cancel. Nothing may be written and the panel must not claim it was.
        Click $prepare
        $dlg = WaitDialog 12
        Report ($null -ne $dlg) 'j2 chooser opened for publish-into' "'$($dlg.Current.Name)'"
        [void](CancelChooser $dlg 'j2')
        Start-Sleep -Milliseconds 900
        $doneSection = FindText '(D.nde ha quedado|Where it went)' 2
        $wrote = @(Get-ChildItem -Force -Path $publishInto -ErrorAction SilentlyContinue)
        Report ($null -eq $doneSection -and $wrote.Count -eq 0) 'j2 Cancel wrote nothing and claimed nothing' "'Where it went' shown=$($null -ne $doneSection); entries in the folder=$($wrote.Count)"

        # Confirm, and then the thing the folder was chosen for actually happening.
        Click (Wait 'Button' '^(Preparar|Prepare)' 10)
        $dlg = WaitDialog 12
        $closed = ConfirmChooser $dlg $publishInto 'j2'
        Report $closed 'j2 chooser closed on confirm' "dialogs left: $((Dialogs).Count)"
        $done = FindText '(D.nde ha quedado|Where it went)' 15
        $err = FindText '(no se puede usar|cannot be used|Elige la carpeta|Choose the folder to publish into)' 2
        Report ($null -ne $done) 'j2 the application says where the publication went' "section='$done' refusal='$err'"
        $written = @(Get-ChildItem -Force -Path $publishInto -Directory -ErrorAction SilentlyContinue)
        if ($written.Count -eq 1) { $preparedFolder = $written[0].FullName }
        $hasDoc = $false
        if ($preparedFolder) { $hasDoc = (Test-Path (Join-Path $preparedFolder 'publication.json')) }
        Report ($written.Count -eq 1 -and $hasDoc) 'j2 the chosen folder was actually published into' "folders=$($written.Count) prepared='$preparedFolder' publication.json=$hasDoc"
        $shownPath = FindText ([regex]::Escape($publishInto)) 3
        Report ($null -ne $shownPath) 'j2 the panel shows the path it wrote to' "'$shownPath'"
    }

    $close = Wait 'Button' '^(Cerrar|Close)$' 8
    if ($close) { Click $close; Start-Sleep -Milliseconds 600 }
} catch {
    [void](CloseAnyDialogs)
    Report $false 'j2 publish-into journey ran to the end' "$($_.Exception.GetType().Name): $($_.Exception.Message)"
}

# =============================================================================================
# JOURNEY 3 - import-from (store.ts:863, panels/Import.tsx)
#
# The folder journey 2 just wrote is exactly what an import reads, so this journey imports it
# back. It is also the only chooser in the application whose *refusal* reaches the screen:
# `beginImport` awaits `pickFolder` inside a try and settles the machine with the error, while
# Settings, Publish and the Inspector all await it outside one. The two negative probes that
# need a visible refusal therefore live here (see the report at the end of this file).
# =============================================================================================
"--- journey 3: import-from (Library -> Import) ---"
try {
    [void](GoTo '^(Biblioteca|Library)$' 'Library')
    $import = Wait 'Button' '^(Importar|Import)' 12
    Report ($null -ne $import) 'j3 Import button found' "'$($import.Current.Name)' enabled=$($import.Current.IsEnabled)"

    # Negative: cancel. `dismissed` must leave the machine idle - no dialog, nothing taken in.
    Click $import
    $dlg = WaitDialog 12
    Report ($null -ne $dlg) 'j3 chooser opened for import-from' "'$($dlg.Current.Name)'"
    [void](CancelChooser $dlg 'j3')
    Start-Sleep -Milliseconds 1200
    $panel = FindText '(Recibir una publicaci|Take in a publication)' 2
    Report ($null -eq $panel) 'j3 Cancel took nothing in and opened no panel' "import panel on screen=$($null -ne $panel)"

    # Negative: a path that is not there. Either the shell refuses to close on it, or the
    # application refuses it - both are refusals, and both are reported with their own words.
    Click (Wait 'Button' '^(Importar|Import)' 10)
    $dlg = WaitDialog 12
    if ($dlg) {
        $closed = ConfirmChooser $dlg $missing 'j3-missing'
        if (-not $closed) {
            Report $true 'j3 a path that is not there was refused' "the chooser would not accept it: $(DialogTexts)"
            [void](CloseAnyDialogs)
        } else {
            $refusal = FindText '(no es una carpeta|not a folder|no se puede usar|cannot be used|no se eligi|was not picked|No hay publication\.json|There is no publication\.json)' 10
            if ($refusal) {
                Report $true 'j3 a path that is not there was refused, in words' "'$refusal'"
            } else {
                Report $false 'j3 a path that is not there was refused, in words' 'the chooser closed and the application showed no refusal at all'
            }
            $close = Wait 'Button' '^(Cerrar|Close)$' 5
            if ($close) { Click $close; Start-Sleep -Milliseconds 500 }
        }
    } else {
        Report $false 'j3 chooser opened for the missing-path probe' 'no chooser appeared'
    }

    # Negative: a junction. The runtime resolves before it records, so what is read is the place
    # the link points at and never the link - either it reads the target, or it says it will not
    # follow the link. Silence would be the failure.
    if (-not $junctionMade) {
        Skip 'j3 a junction is resolved or refused, never followed blindly' 'mklink /J was refused on this machine'
    } else {
        Click (Wait 'Button' '^(Importar|Import)' 10)
        $dlg = WaitDialog 12
        if ($dlg) {
            $closed = ConfirmChooser $dlg $junction 'j3-junction'
            if (-not $closed) {
                Report $true 'j3 a junction is resolved or refused, never followed blindly' "the chooser would not accept it: $(DialogTexts)"
                [void](CloseAnyDialogs)
            } else {
                $link = FindText '(es una ligaz|es un enlace|is a link)' 6
                $notPub = FindText '(No hay publication\.json|There is no publication\.json|no es una carpeta|not a folder)' 6
                if ($link) {
                    Report $true 'j3 a junction is resolved or refused, never followed blindly' "refused as a link: '$link'"
                } elseif ($notPub) {
                    Report $true 'j3 a junction is resolved or refused, never followed blindly' "read the target it points at, which holds no publication: '$notPub'"
                } else {
                    Report $false 'j3 a junction is resolved or refused, never followed blindly' 'the chooser closed and the application said nothing about it'
                }
                $close = Wait 'Button' '^(Cerrar|Close)$' 5
                if ($close) { Click $close; Start-Sleep -Milliseconds 500 }
            }
        } else {
            Report $false 'j3 chooser opened for the junction probe' 'no chooser appeared'
        }
    }

    # The round trip: read back the folder journey 2 wrote.
    if (-not $preparedFolder) {
        Skip 'j3 the prepared publication can be imported' 'journey 2 produced no folder to import from'
    } else {
        Click (Wait 'Button' '^(Importar|Import)' 10)
        $dlg = WaitDialog 12
        $closed = ConfirmChooser $dlg $preparedFolder 'j3'
        Report $closed 'j3 chooser closed on confirm' "dialogs left: $((Dialogs).Count)"
        $what = FindText '(Qu. dice que es|What this says it is)' 20
        $refused = FindText '(no se ha recibido nada|Nothing was taken in|no se eligi|was not picked)' 2
        if ($what) {
            Report $true 'j3 the chosen folder was read as a publication' "section='$what'"
            $named = FindText '(Journey evidence)' 5
            Report ($null -ne $named) 'j3 the report names what was prepared in journey 2' "'$named'"
            $confirm = Wait 'Button' '^(Importar|Import)$' 8
            if ($confirm -and $confirm.Current.IsEnabled) {
                Click $confirm
                $taken = FindText '(Recibido Journey evidence|Imported Journey evidence)' 25
                Report ($null -ne $taken) 'j3 importing put it in the library' "'$taken'"
            } else {
                Report $false 'j3 the Import button is armed for a folder that was read' "enabled=$($confirm.Current.IsEnabled)"
            }
        } else {
            Report $false 'j3 the chosen folder was read as a publication' "no report on screen; refusal: '$refused'"
            $close = Wait 'Button' '^(Cerrar|Close)$' 5
            if ($close) { Click $close }
        }
    }
} catch {
    [void](CloseAnyDialogs)
    Report $false 'j3 import-from journey ran to the end' "$($_.Exception.GetType().Name): $($_.Exception.Message)"
}

# =============================================================================================
# JOURNEYS 4 and 5 - grant-to-component and run-input (panels/Inspector.tsx:101 and :163)
#
# One step covers both: Save File declares fs.write, takes a `folder` in its configuration (so
# the Inspector offers the folder chooser) and has one unconnected input of type `file` (so it
# offers the file chooser under "Starting material"). With both answered the graph is runnable,
# which is what makes the negative below expressible: the run is the only place the runtime
# gets to say no.
# =============================================================================================
"--- journeys 4 and 5: grant-to-component and run-input (Inspector) ---"
$folderField = $null
try {
    [void](GoTo '^(Constructor|Builder)$' 'Builder')
    $new = Wait 'Button' '^(Nuevo|New)$' 10
    if ($new) { Click $new; Start-Sleep -Milliseconds 900 }
    $palette = Wait 'Button' '(Save File|encastra\.file\.save)' 15
    if (-not $palette) { throw 'the Save File palette item never appeared' }
    Click $palette
    Start-Sleep -Milliseconds 900

    $folderField = ByIdSuffix '-folder' 10
    Report ($null -ne $folderField) 'j4 the Inspector shows the folder setting for the selected step' "automationId='$($folderField.Current.AutomationId)'"
    $nodeId = ''
    if ($folderField) { $nodeId = $folderField.Current.AutomationId -replace '-folder$', '' }
    Note "the step is '$nodeId'"

    $allow = Wait 'Button' '^(Permitir esta carpeta|Allow this folder)$' 10
    Report ($null -ne $allow) 'j4 the permission control is on screen before any folder is chosen' "'$($allow.Current.Name)' enabled=$($allow.Current.IsEnabled)"
    $hint = FindText '(Elige antes una carpeta|Choose a folder first)' 3
    Report ($null -ne $hint -and $null -ne $allow -and -not $allow.Current.IsEnabled) 'j4 nothing can be allowed until a folder is chosen' "hint='$hint' allowEnabled=$($allow.Current.IsEnabled)"

    # Negative: cancel. Nothing is configured, so nothing can be allowed.
    $chooseFolder = ChooseButtonNear $folderField
    Report ($null -ne $chooseFolder) 'j4 the folder row has its own Choose button' "'$($chooseFolder.Current.Name)'"
    Click $chooseFolder
    $dlg = WaitDialog 12
    Report ($null -ne $dlg) 'j4 chooser opened for grant-to-component' "'$($dlg.Current.Name)'"
    [void](CancelChooser $dlg 'j4')
    Start-Sleep -Milliseconds 700
    $stillEmpty = ValueOf (ByIdSuffix '-folder' 5)
    $allow = Wait 'Button' '^(Permitir esta carpeta|Allow this folder)$' 5
    Report ($stillEmpty -eq '' -and $null -ne $allow -and -not $allow.Current.IsEnabled) 'j4 Cancel granted nothing and configured nothing' "folder='$stillEmpty' allowEnabled=$($allow.Current.IsEnabled)"

    # Confirm, then allow: the button's own label is the application saying the folder answered
    # the question it was asked.
    Click (ChooseButtonNear (ByIdSuffix '-folder' 5))
    $dlg = WaitDialog 12
    $closed = ConfirmChooser $dlg $grantFolder 'j4'
    Report $closed 'j4 chooser closed on confirm' "dialogs left: $((Dialogs).Count)"
    Start-Sleep -Milliseconds 800
    $folderValue = ValueOf (ByIdSuffix '-folder' 5)
    Report ($folderValue -eq $grantFolder) 'j4 the chosen folder became the step configuration' "'$folderValue' (expected '$grantFolder')"
    $allow = Wait 'Button' '^(Permitir esta carpeta|Allow this folder)$' 8
    Report ($null -ne $allow -and $allow.Current.IsEnabled) 'j4 the permission control armed once a folder was chosen' "enabled=$($allow.Current.IsEnabled)"
    Click $allow
    $allowed = Wait 'Button' '^(Permitido|Allowed)$' 8
    Report ($null -ne $allowed) 'j4 the application says the folder is allowed' "button now reads '$($allowed.Current.Name)'"

    # --- journey 5: the file a run starts from -------------------------------------------
    $entryTitle = FindText '(Material de partida|Starting material)' 8
    Report ($null -ne $entryTitle) 'j5 the Inspector asks for the file the run starts from' "'$entryTitle'"
    $readonlyBox = $null
    foreach ($e in (Descendants (AppWindow))) {
        if ($e.Current.ControlType.ProgrammaticName -eq 'ControlType.Edit' -and (IsReadOnly $e)) { $readonlyBox = $e; break }
    }
    if (-not $readonlyBox) { throw 'the read-only box for the starting file is not exposed' }
    $chooseFile = ChooseButtonNear $readonlyBox
    Report ($null -ne $chooseFile) 'j5 the starting-material row has its own Choose button' "'$($chooseFile.Current.Name)'"

    Click $chooseFile
    $dlg = WaitDialog 12
    Report ($null -ne $dlg) 'j5 chooser opened for run-input' "'$($dlg.Current.Name)'"
    [void](CancelChooser $dlg 'j5')
    Start-Sleep -Milliseconds 600
    $afterCancel = ValueOf $readonlyBox
    Report ($afterCancel -eq '') 'j5 Cancel seeded no input' "box='$afterCancel'"

    Click (ChooseButtonNear $readonlyBox)
    $dlg = WaitDialog 12
    $closed = ConfirmChooser $dlg $inputFile 'j5'
    Report $closed 'j5 chooser closed on confirm' "dialogs left: $((Dialogs).Count)"
    Start-Sleep -Milliseconds 800
    $inputValue = ValueOf $readonlyBox
    Report ($inputValue -eq $inputFile) 'j5 the chosen file became the input for the run' "'$inputValue' (expected '$inputFile')"

    # The proof that both answers were real: a run that writes into the granted folder.
    $run = Wait 'Button' '^(Ejecutar|Run)$' 10
    Report ($null -ne $run -and $run.Current.IsEnabled) 'j4/j5 Run is available with a folder allowed and a file chosen' "enabled=$($run.Current.IsEnabled)"
    Click $run
    $saved = $null
    for ($i = 0; $i -lt 60; $i++) {
        $hit = @(Get-ChildItem -Force -Path $grantFolder -File -ErrorAction SilentlyContinue)
        if ($hit.Count -gt 0) { $saved = $hit[0].FullName; break }
        Start-Sleep -Milliseconds 500
    }
    $runSays = FindText '(correcto|correctos|ok|fallido|failed|Nada se ha ejecutado|Nothing ran)' 3
    Report ($null -ne $saved) 'j4 the granted folder was actually written into by the run' "file='$saved' status='$runSays'"

    # =========================================================================================
    # NEGATIVE - a folder chosen for one purpose does not answer another.
    #
    # This is the one the whole design exists for. The folder below was chosen in journey 1, and
    # only for `projects-location`. The interface lets it be *typed* into the step's folder box,
    # which is exactly the case the runtime is built to refuse: the editor can put any string
    # there, and the record it is checked against was made by the chooser on the privileged side.
    # Pressing Allow and running must be refused, in the reader's own language, naming the step.
    # =========================================================================================
    $stop = Find (AppWindow) 'Button' '^(Detener|Stop)$'
    if ($stop) { Click $stop; Start-Sleep -Milliseconds 1200 }
    $typed = SetValue (ByIdSuffix '-folder' 5) $projectsLocation
    Report ($typed -eq $projectsLocation) 'neg the interface accepts a typed folder it never chose' "'$typed'"
    $allowAgain = Wait 'Button' '^(Permitir esta carpeta|Allow this folder)$' 8
    Report ($null -ne $allowAgain) 'neg the permission went back to asking when the folder changed' "button reads '$($allowAgain.Current.Name)' rather than Allowed"
    Click $allowAgain
    Start-Sleep -Milliseconds 400
    Click (Wait 'Button' '^(Ejecutar|Run)$' 10)
    $refusal = FindText '(elige esa carpeta con el bot.n Elegir|choose that folder with the Choose button)' 20
    $anything = FindText '(No se ha ejecutado nada|Nothing ran)' 2
    Report ($null -ne $refusal) 'neg a folder chosen for projects-location is refused as a grant' "'$refusal' / '$anything'"
    Start-Sleep -Milliseconds 2000
    $leaked = @(Get-ChildItem -Force -Path $projectsLocation -File -ErrorAction SilentlyContinue)
    Report ($leaked.Count -eq 0) 'neg nothing was written into the folder that was not granted' "files there: $($leaked.Count)"

    # The same question the other way round cannot be asked through this interface, and is not
    # pretended: Publish takes its destination only from the chooser (Publish.tsx:108) and Import
    # only from the chooser (store.ts:863). Neither has a box to type a path into, so a folder
    # chosen for `grant-to-component` can never be offered to them from the GUI at all. The pair
    # is covered where it is expressible - here - and by `a folder chosen for {recorded} must not
    # answer {asked}` in apps/desktop/src-tauri/src/lib.rs, which walks every pair.
} catch {
    [void](CloseAnyDialogs)
    Report $false 'j4/j5 grant-to-component and run-input journeys ran to the end' "$($_.Exception.GetType().Name): $($_.Exception.Message)"
}

# --- the application is still standing ---------------------------------------------------------
[void](CloseAnyDialogs)
$proc.Refresh()
Report (-not $proc.HasExited) 'application still running at the end' "exited=$($proc.HasExited) responding=$($proc.Responding)"

"SUMMARY  passed=$script:passed failed=$script:failed skipped=$script:skipped  sandbox=$sandbox"
if ($script:failed -gt 0) { exit 1 }
if ($script:skipped -gt 0) { exit 2 }
exit 0
