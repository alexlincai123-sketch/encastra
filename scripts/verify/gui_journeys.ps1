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
#   * "What is on screen" is asked of the *window list* (`EnumWindows`), not of the accessibility
#     tree. Asking the tree only ever found the dialogs some provider had hung under the desktop,
#     and `j2 native save dialog opened -> ''` is what that costs: a dialog that is up and not
#     listed leaves the save waiting on it, the store `busy`, and every later journey greyed out
#     for a reason the log cannot name. Whenever something expected is not found, the log now
#     prints every top-level window this process owns - class, caption, visible, enabled - so a
#     run nobody can watch says what *was* there rather than only what was not.
#   * Its name field is a *descendant* and not a child, and on some builds it owns no window
#     handle of its own; the routes to it are in "the native chooser" below. The path is read
#     back out of the field before anything is confirmed, because a confirm pressed on an empty
#     field leaves the dialog standing - and a dialog left standing is modal to the application,
#     so the next journey finds that dialog instead of its own and every button underneath it
#     reads as disabled. Each journey therefore asserts an empty screen before it starts and
#     after it ends, and closes anything it finds.
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
  // Reading a control's text back out of it. Nothing here trusts that a WM_SETTEXT landed.
  [DllImport("user32.dll", EntryPoint="SendMessageW", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageText(IntPtr h, uint m, IntPtr w, System.Text.StringBuilder l);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  // The two documented ways to reach a common dialog's controls without walking an accessibility
  // tree: by the id the dialog template gave the control, and by class among its child windows.
  [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h, int id);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowExW(IntPtr parent, IntPtr after, string cls, string title);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, System.Text.StringBuilder s, int max);
  // The window WebView2 renders into throttles when it has no focus, which turns a poll into a
  // false negative. Raised once, by handle, at the start - never a global SendKeys.
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
  // A window's caption, read the way that works across a process boundary for a top-level window.
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, System.Text.StringBuilder s, int max);
  // Every top-level window this process owns, whatever its class and wherever UI Automation
  // decides to hang it. `RootElement.FindAll(Children, pid)` is a view of the accessibility tree
  // and a dialog is only in it if a provider put it there; this is the window list itself, so a
  // chooser that is genuinely on screen cannot hide from it. See "the native chooser" below.
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  public static IntPtr[] TopLevelWindows(int pid) {
    var found = new System.Collections.Generic.List<IntPtr>();
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      uint p = 0;
      GetWindowThreadProcessId(h, out p);
      if ((int)p == pid) { found.Add(h); }
      return true;
    }, IntPtr.Zero);
    return found.ToArray();
  }
  // TEMP on a hosted runner is handed out in its 8.3 short form - C:\Users\RUNNER~1\... - and the
  // application canonicalises every path it records, so a raw string comparison against what the
  // harness typed compares two spellings of the same folder and calls them different.
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] public static extern int GetLongPathNameW(string path, System.Text.StringBuilder buf, int len);
}
"@
$A = [System.Windows.Automation.AutomationElement]
$T = [System.Windows.Automation.TreeScope]
$TRUE_COND = [System.Windows.Automation.Condition]::TrueCondition
$BM_CLICK = 0x00F5; $WM_SETTEXT = 0x000C; $WM_GETTEXT = 0x000D
$WM_CLOSE = 0x0010; $WM_COMMAND = 0x0111; $IDOK = 1; $IDCANCEL = 2
$NULLPTR = [IntPtr]::Zero

$script:passed = 0; $script:failed = 0; $script:skipped = 0

# --- paths, in the one spelling the application will answer in -------------------------------
#
# `resolve_grant_directory` canonicalises before it records, which is the whole point of it: the
# runtime learns a folder from the operating system and stores the one name that folder has. So
# the harness has to ask the same question of its own paths before it compares. Two things differ:
#
#   * 8.3 short names. `$env:TEMP` on a hosted runner is `C:\Users\RUNNER~1\AppData\Local\Temp`,
#     and the application answers `C:\Users\runneradmin\...`. Same folder, different spelling.
#     `(Get-Item $p).FullName` does not expand that; `GetLongPathNameW` does, for a path that
#     exists. The sandbox is also built under USERPROFILE rather than TEMP so the question mostly
#     does not arise, and the harness says so below if a `~` survives anyway.
#   * Case. Windows paths are case-insensitive, and `-eq` between strings in PowerShell already is.
function LongPath($p) {
    if (-not $p) { return '' }
    $sb = New-Object System.Text.StringBuilder 1024
    $n = 0
    try { $n = [W32]::GetLongPathNameW($p, $sb, 1024) } catch { $n = 0 }
    # 0 means the path is not on disk (a deliberately missing folder, say). Its own spelling is
    # then the only one there is, and GetFullPath still normalises the separators.
    $long = if ($n -gt 0 -and $n -lt 1024) { $sb.ToString() } else { $p }
    try { return [System.IO.Path]::GetFullPath($long) } catch { return $long }
}
# Two paths naming one folder. Never used to widen an assertion: what it removes is the harness's
# own spelling, not any difference the application put there. A path that resolves somewhere else
# - a junction followed to the wrong place, a preference holding a different folder - still fails.
function SamePath($a, $b) {
    if (-not $a -or -not $b) { return $false }
    $la = LongPath ($a.Trim().Trim('"').TrimEnd('\'))
    $lb = LongPath ($b.Trim().Trim('"').TrimEnd('\'))
    return ($la -eq $lb)
}

# Report, Skip and Note write their line to the success stream, which is how it reaches the log
# scripts/release_check.py reads. That has one consequence the whole file obeys: a function that
# reports must not also return a value, because `$x = SomeFn` would collect the printed line into
# $x and `@('FAIL ...', $false)` is *true* in PowerShell. That is exactly how
# `j1 chooser closed on confirm -> dialogs left: 1` came out PASS. Results travel in $script:
# variables instead; see $script:chooserClosed below.
# One line per result, whatever was observed. Sentences read off the screen wrap, and a name with
# a newline in it would split a FAIL into two lines - one of which release_check.py would then be
# reading as something other than the result it belongs to.
function OneLine($s) {
    if ($null -eq $s) { return '' }
    return ((([string]$s) -replace '\r?\n', ' / ') -replace '\s{3,}', '  ')
}
function Report($ok, $what, $observed) {
    if ($ok) { $script:passed++ } else { $script:failed++ }
    "{0}  {1}  -> {2}" -f ($(if ($ok) { 'PASS' } else { 'FAIL' }), (OneLine $what), (OneLine $observed))
}
function Skip($what, $why) { $script:skipped++; "SKIP  {0}  -> {1}" -f (OneLine $what), (OneLine $why) }
function Note($text) { "note  $(OneLine $text)" }
# How every journey ends, including badly. A journey that could not be driven - a control that was
# not on screen, a button the application had greyed out, a prerequisite another journey failed to
# produce - raises `throw 'SKIP: reason'` and is reported as SKIP, with the reason. Anything else
# is a FAIL carrying the exception. Neither is ever a PASS, and both leave the screen clear.
function JourneyEnded($err, $what) {
    ForceCloseDialogs
    $message = $err.Exception.Message
    if ($message -like 'SKIP:*') { Skip $what ($message.Substring(5).Trim()) }
    else { Report $false $what "$($err.Exception.GetType().Name): $message" }
}

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
$CONTROL_TYPES = @{
    Edit   = [System.Windows.Automation.ControlType]::Edit
    Button = [System.Windows.Automation.ControlType]::Button
    Text   = [System.Windows.Automation.ControlType]::Text
}
function ControlsOfType($ctrl) {
    $el = AppWindow
    if (-not $el) { return @() }
    $ct = $CONTROL_TYPES[$ctrl]
    if (-not $ct) { return @() }
    $cond = New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, $ct)
    return @($el.FindAll($T::Descendants, $cond))
}
function ByIdSuffix($suffix, $seconds) {
    for ($i = 0; $i -lt $seconds * 4; $i++) {
        # Narrow first. Every field these journeys look for is a text box, and asking UI
        # Automation for the Edits alone is one cross-process call, where walking the whole tree
        # and reading `.Current` off each element is one call per element. With a canvas and a run
        # panel on screen that difference is the difference between a poll and a timeout - and a
        # timeout reads exactly like an element that is not there.
        foreach ($e in (ControlsOfType 'Edit')) {
            $id = $e.Current.AutomationId
            if ($id -and $id.EndsWith($suffix)) { return $e }
        }
        Start-Sleep -Milliseconds 250
    }
    # Once, at the end: the same question of everything on screen, in case the control is not an
    # Edit at all. Slow, so it is not in the poll.
    foreach ($e in (Descendants (AppWindow))) {
        $id = $e.Current.AutomationId
        if ($id -and $id.EndsWith($suffix)) { return $e }
    }
    return $null
}
function HasPattern($el, $pattern) {
    if (-not $el) { return $false }
    try { [void]$el.GetCurrentPattern($pattern); return $true } catch { return $false }
}
function HelpTextOf($el) {
    if (-not $el) { return '' }
    try { return $el.Current.HelpText } catch { return '' }
}
# Like Wait, but for a control the application arms a moment after it appears. Returns the
# control even when it never armed, so the caller can report what state it was actually in
# rather than "not found" - which is a different thing and used to be reported as the same.
function WaitEnabled($ctrl, $namePattern, $seconds) {
    $last = $null
    for ($i = 0; $i -lt $seconds * 4; $i++) {
        $e = Find (AppWindow) $ctrl $namePattern
        if ($e) {
            $last = $e
            if ($e.Current.IsEnabled) { return $e }
        }
        Start-Sleep -Milliseconds 250
    }
    return $last
}

# --- what was on screen, for the times something was not ---------------------------------------
#
# Each of these is printed only on a failure, and each answers the question a log that says
# "not found" leaves open. A run costs about twenty-five minutes on the runner; a log that names
# what it did see is worth more than one that has to be guessed at afterwards.

function AutomationIdDump($max) {
    $ids = @()
    try {
        foreach ($e in (Descendants (AppWindow))) {
            if ($ids.Count -ge $max) { break }
            $id = $e.Current.AutomationId
            if ($id) { $ids += ("{0}({1})" -f $id, ($e.Current.ControlType.ProgrammaticName -replace '^ControlType\.', '')) }
        }
    } catch { $ids += "(the tree could not be read: $($_.Exception.GetType().Name))" }
    if ($ids.Count -eq 0) { return '(nothing on screen publishes an automation id)' }
    return ($ids -join ' ')
}
# What UI Automation sees for a step that has been placed. ComponentNode gives each one
# id="node-<id>" and deliberately no ARIA role - see the comment in ComponentNode.tsx - so it
# arrives as a plain grouping element with no Invoke pattern. That is exactly the thing to say
# out loud if a step turns out not to be selectable from here.
function PlacedStepsDump {
    $out = @()
    try {
        foreach ($e in (Descendants (AppWindow))) {
            $id = $e.Current.AutomationId
            if (-not $id -or -not $id.StartsWith('node-')) { continue }
            $n = $e.Current.Name
            if (-not $n) { $n = '' }
            if ($n.Length -gt 28) { $n = $n.Substring(0, 28) }
            $out += ("{0} type={1} name='{2}' invokable={3}" -f $id, ($e.Current.ControlType.ProgrammaticName -replace '^ControlType\.', ''), $n, (HasPattern $e ([System.Windows.Automation.InvokePattern]::Pattern)))
        }
    } catch { $out += "(the tree could not be read: $($_.Exception.GetType().Name))" }
    if ($out.Count -eq 0) { return '(nothing on screen carries a node-* id: either no step was placed or the canvas publishes none)' }
    return ($out -join ' | ')
}
# The sentences the interface is showing. A failed save puts its reason in the status bar
# (store.ts saveProject: `set({ message: { tone: 'error', text: describe(error) } })`), so when a
# chooser does not appear the reason may already be written on screen.
function AppNotices($max) {
    $lines = @()
    try {
        foreach ($e in (Descendants (AppWindow))) {
            if ($lines.Count -ge $max) { break }
            if ($e.Current.ControlType.ProgrammaticName -ne 'ControlType.Text') { continue }
            $n = $e.Current.Name
            if ($n -and $n.Length -gt 18) { $lines += "'" + $n + "'" }
        }
    } catch { }
    if ($lines.Count -eq 0) { return '(no sentence on screen long enough to be a message)' }
    return ($lines -join ' | ')
}
# The prompt `newProject` and `openProject` raise when there is unsaved work (store.ts:677 ->
# requestDiscard -> panels/UnsavedChanges.tsx). It is an in-page alertdialog, not a window, so
# none of the dialog handling above sees it - and left standing it swallows the rest of a journey.
# Prints and returns nothing, for the reason given above Report: a function that writes to the
# success stream must not also hand a value back, or the caller collects the printed line.
function DismissDiscardPrompt {
    $discard = Wait 'Button' '^(Descartar los cambios|Discard changes)$' 4
    if (-not $discard) { return }
    Note 'the application asked about unsaved changes; discarding them so the journey starts from a clean canvas'
    Click $discard
    Start-Sleep -Milliseconds 900
}
# A click on nothing, or on a control the application has greyed out, is not a click: it threw
# `Unrecognized error` out of Invoke on the runner and took the rest of the journey with it. Both
# cases raise a SKIP: the journey did not run, and a journey that did not run is not a pass.
# `throw 'SKIP: ...'` is caught at the bottom of each journey and printed as SKIP with its reason.
function Click($el) {
    if (-not $el) { throw 'SKIP: a control that had to be clicked was not on screen' }
    if (-not $el.Current.IsEnabled) { throw "SKIP: the control '$($el.Current.Name)' is on screen but disabled, so it cannot be clicked" }
    if ($el.Current.IsOffscreen) { throw "SKIP: the control '$($el.Current.Name)' is off screen, so it cannot be clicked" }
    $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
}
function MustFind($el, $why) { if (-not $el) { throw "SKIP: $why" }; return $el }
function ValueOf($el) {
    if (-not $el) { return '' }
    try { return $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value } catch { return '' }
}
function IsReadOnly($el) {
    try { return $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.IsReadOnly } catch { return $false }
}
function HasValuePattern($el) {
    if (-not $el) { return $false }
    try { [void]$el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern); return $true } catch { return $false }
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
#
# Two things about this dialog bit the first hosted-runner run (Windows Server 2025) and are the
# reason for the length here.
#
#   * Its file-name control is not a child of the dialog, and on some builds it does not own a
#     window handle of its own either. The modern IFileDialog nests an Edit inside a ComboBox
#     inside a ComboBoxEx32, and how deep that sits differs between Windows builds and themes, so
#     one fixed search finds nothing at all - `chooser name field found -> none found`, and then
#     a confirm pressed on an empty field, and then a dialog left standing for the next journey
#     to trip over. Five routes are tried here, most certain first, and the one that answered is
#     printed. Asking by control id comes before any search by class, because a file dialog also
#     contains an Edit for the search box and typing a path into a search would look like success.
#   * "The chooser closed" has to be a count of the dialogs actually on screen. It was a variable,
#     and the variable had the printed FAIL line in it, so it was true. Every confirm below reads
#     the count.
#
# Everything is still a message to one specific window handle. There is no global SendKeys here.

# What is on screen, asked of the window list rather than of the accessibility tree.
#
# `RootElement.FindAll(Children, pid)` only ever showed the dialogs some provider had hung under
# the desktop, and `j2 native save dialog opened -> ''` is what that costs when a dialog is up and
# not there: the save is still awaiting a chooser nobody can see, the store stays `busy`, and
# every later journey finds its own buttons greyed out for a reason the log cannot name. So the
# question is put to `EnumWindows` instead, which is the list of windows themselves.
#
# The application's own window is excluded by class, and so is the noise every WebView2 process
# carries around - input-method and tooltip windows, which are top-level but are not in front of
# anybody. What is left is either a common dialog (#32770) or some other window of this process
# standing over the interface with a caption of its own, and both are things a journey has to
# deal with before it can claim the screen was clear.
$MAIN_WINDOW_CLASS = 'Tauri Window'
$NOISE_CLASSES = @('IME', 'MSCTFIME UI', 'Default IME', 'tooltips_class32', 'OleMainThreadWndClass', 'CicMarshalWndClass')
function ProcWindows {
    $out = @()
    foreach ($h in [W32]::TopLevelWindows($proc.Id)) {
        $sb = New-Object System.Text.StringBuilder 512
        [void][W32]::GetWindowTextW($h, $sb, 512)
        $out += @{
            Hwnd    = $h
            Class   = (HwndClass $h)
            Title   = $sb.ToString()
            Visible = [W32]::IsWindowVisible($h)
            Enabled = [W32]::IsWindowEnabled($h)
        }
    }
    return $out
}
# Printed whenever something expected was not found, so a run nobody can watch still says what
# *was* on screen instead of only what was not.
function ProcWindowsDump {
    $parts = @()
    foreach ($w in (ProcWindows)) {
        $t = $w.Title
        if ($t.Length -gt 44) { $t = $t.Substring(0, 44) }
        $parts += ("{0}'{1}'#{2} visible={3} enabled={4}" -f $w.Class, $t, $w.Hwnd, $w.Visible, $w.Enabled)
    }
    if ($parts.Count -eq 0) { return '(this process owns no top-level window at all)' }
    return ($parts -join ' | ')
}
function DialogHwnds {
    $out = @()
    foreach ($w in (ProcWindows)) {
        if (-not $w.Visible) { continue }
        if ($w.Class -eq $MAIN_WINDOW_CLASS) { continue }
        if ($NOISE_CLASSES -contains $w.Class) { continue }
        if ($w.Class -like 'Chrome_*') { continue }
        # A common dialog counts whether or not it has a caption yet; anything else has to be
        # showing a caption before it is treated as a window somebody is looking at.
        if ($w.Class -eq '#32770' -or $w.Title) { $out += $w.Hwnd }
    }
    return $out
}
function Dialogs {
    $out = @()
    foreach ($h in (DialogHwnds)) {
        try { $e = $A::FromHandle($h); if ($e) { $out += $e } } catch { }
    }
    return $out
}
function DialogCount { @(DialogHwnds).Count }
function WaitDialog($seconds) { for ($i = 0; $i -lt $seconds * 4; $i++) { $d = Dialogs; if ($d.Count -gt 0) { return $d[0] }; Start-Sleep -Milliseconds 250 }; return $null }
function WaitNoDialog($seconds) { for ($i = 0; $i -lt $seconds * 4; $i++) { if ((DialogCount) -eq 0) { return $true }; Start-Sleep -Milliseconds 250 }; return $false }
function Hwnd($el) { if (-not $el) { return $NULLPTR }; return [IntPtr]$el.Current.NativeWindowHandle }

function HwndClass($h) {
    if ($h -eq $NULLPTR) { return '' }
    $sb = New-Object System.Text.StringBuilder 256
    [void][W32]::GetClassNameW($h, $sb, 256)
    return $sb.ToString()
}
function HwndText($h) {
    if ($h -eq $NULLPTR) { return '' }
    $sb = New-Object System.Text.StringBuilder 2048
    [void][W32]::SendMessageText($h, $WM_GETTEXT, [IntPtr]2048, $sb)
    return $sb.ToString()
}
# FindWindowExW only ever sees one level of children; the control this is after is three down.
function ChildByClass($parent, $cls, $depth) {
    if ($parent -eq $NULLPTR -or $depth -le 0) { return $NULLPTR }
    $child = $NULLPTR
    while ($true) {
        $child = [W32]::FindWindowExW($parent, $child, $null, $null)
        if ($child -eq $NULLPTR) { return $NULLPTR }
        if ((HwndClass $child) -eq $cls) { return $child }
        $deeper = ChildByClass $child $cls ($depth - 1)
        if ($deeper -ne $NULLPTR) { return $deeper }
    }
}

# The file-name control's well-known ids: 1148 and 1152 in the modern dialog, 1090 and 1152 in the
# older one, 1001 in the oldest. Whichever answers may be the combo rather than the edit inside it.
$NAME_FIELD_IDS = @(1152, 1148, 1090, 1001)
function DlgNameField($dlg) {
    $dh = Hwnd $dlg
    $fallback = $null
    if ($dh -ne $NULLPTR) {
        foreach ($id in $NAME_FIELD_IDS) {
            $h = [W32]::GetDlgItem($dh, $id)
            if ($h -eq $NULLPTR) { continue }
            $cls = HwndClass $h
            if ($cls -eq 'Edit') { return @{ Hwnd = $h; Combo = $NULLPTR; Element = $null; Route = "GetDlgItem($id) Edit" } }
            $inner = ChildByClass $h 'Edit' 3
            if ($inner -ne $NULLPTR) { return @{ Hwnd = $inner; Combo = $h; Element = $null; Route = "GetDlgItem($id) $cls -> Edit" } }
            # That id exists but holds no edit. Keep it in case nothing better turns up - a combo
            # takes a WM_SETTEXT of its own - but keep looking rather than settling for it here.
            if (-not $fallback) { $fallback = @{ Hwnd = $h; Combo = $NULLPTR; Element = $null; Route = "GetDlgItem($id) $cls" } }
        }
        # The same control found by class instead of by id.
        foreach ($outer in @('ComboBoxEx32', 'ComboBox')) {
            $c = ChildByClass $dh $outer 4
            if ($c -eq $NULLPTR) { continue }
            $inner = ChildByClass $c 'Edit' 3
            if ($inner -ne $NULLPTR) { return @{ Hwnd = $inner; Combo = $c; Element = $null; Route = "$outer -> Edit" } }
        }
    }
    # UI Automation, anywhere below the dialog - descendants, never children. An Edit that owns no
    # window handle can still be written through its Value pattern.
    foreach ($c in (Descendants $dlg)) {
        if ($c.Current.ControlType.ProgrammaticName -ne 'ControlType.Edit') { continue }
        if ($c.Current.NativeWindowHandle -ne 0) {
            return @{ Hwnd = (Hwnd $c); Combo = $NULLPTR; Element = $c; Route = "UIA descendant Edit '$($c.Current.Name)'" }
        }
        if ((HasValuePattern $c) -and -not (IsReadOnly $c)) {
            return @{ Hwnd = $NULLPTR; Combo = $NULLPTR; Element = $c; Route = "UIA descendant Edit '$($c.Current.Name)' (value pattern, no window handle)" }
        }
    }
    # Last resort: any Edit window at all under the dialog, whatever it turns out to be. What it
    # holds is read back before anything is confirmed, so a wrong guess reports itself.
    if ($dh -ne $NULLPTR) {
        $any = ChildByClass $dh 'Edit' 5
        if ($any -ne $NULLPTR) { return @{ Hwnd = $any; Combo = $NULLPTR; Element = $null; Route = 'first Edit window under the dialog' } }
    }
    if ($fallback) { return $fallback }
    return $null
}
function ReadNameField($f) {
    if (-not $f) { return '' }
    if ($f.Element) { $v = ValueOf $f.Element; if ($v) { return $v } }
    if ($f.Hwnd -ne $NULLPTR) { $v = HwndText $f.Hwnd; if ($v) { return $v } }
    if ($f.Combo -ne $NULLPTR) { return (HwndText $f.Combo) }
    return ''
}
function WriteNameField($f, $path) {
    if ($f.Hwnd -ne $NULLPTR) { [void][W32]::SendMessageW($f.Hwnd, $WM_SETTEXT, $NULLPTR, $path) }
    elseif ($f.Element) { try { $f.Element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($path) } catch { } }
    Start-Sleep -Milliseconds 350
    # A ComboBoxEx32 hands its own WM_SETTEXT to the edit it owns; if writing the edit directly
    # did not take, the combo is the other documented way in.
    if ((ReadNameField $f) -ne $path -and $f.Combo -ne $NULLPTR) {
        [void][W32]::SendMessageW($f.Combo, $WM_SETTEXT, $NULLPTR, $path)
        Start-Sleep -Milliseconds 350
    }
}

$CONFIRM = '^(Seleccionar carpeta|Seleccionar|Select Folder|Elegir carpeta|Elegir|Choose|Aceptar|OK|Guardar|Save|Abrir|Open)$'
$CANCEL = '^(Cancelar|Cancel)$'
# A dialog button by the names it can carry in either display language, and failing that by the
# id every common dialog gives it (IDOK 1, IDCANCEL 2). Descendants, never children.
function DlgButtonHwnd($dlg, $namePattern, $fallbackId) {
    foreach ($c in (Descendants $dlg)) {
        if ($c.Current.NativeWindowHandle -eq 0) { continue }
        $n = $c.Current.Name
        if (-not $n -or $n -notmatch $namePattern) { continue }
        $t = $c.Current.ControlType.ProgrammaticName
        if ($t -eq 'ControlType.Button' -or $t -eq 'ControlType.SplitButton' -or $t -eq 'ControlType.Pane') { return [IntPtr]$c.Current.NativeWindowHandle }
    }
    $dh = Hwnd $dlg
    if ($dh -ne $NULLPTR) {
        $h = [W32]::GetDlgItem($dh, $fallbackId)
        if ($h -ne $NULLPTR) { return $h }
    }
    return $NULLPTR
}
# What the dialog is actually made of, printed only when something was not found in it, so that a
# failure on a machine nobody can watch still says enough to be acted on.
function DialogShape($dlg) {
    $parts = @()
    try {
        foreach ($c in (Descendants $dlg)) {
            if ($parts.Count -ge 24) { break }
            $n = $c.Current.Name
            if (-not $n) { $n = '' }
            if ($n.Length -gt 24) { $n = $n.Substring(0, 24) }
            $parts += ("{0}'{1}'#{2}" -f ($c.Current.ControlType.ProgrammaticName -replace '^ControlType\.', ''), $n, $c.Current.NativeWindowHandle)
        }
    } catch { $parts += "(the dialog tree could not be read: $($_.Exception.GetType().Name))" }
    $classes = @(); $child = $NULLPTR; $dh = Hwnd $dlg
    while ($dh -ne $NULLPTR -and $classes.Count -lt 12) {
        $child = [W32]::FindWindowExW($dh, $child, $null, $null)
        if ($child -eq $NULLPTR) { break }
        $classes += (HwndClass $child)
    }
    return ('uia=[' + ($parts -join ' ') + '] child windows=[' + ($classes -join ',') + ']')
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
# Cancel, then IDCANCEL to the dialog's own handle, then WM_CLOSE. Prints nothing and returns
# nothing: callers read DialogCount afterwards.
function ForceCloseDialogs {
    for ($i = 0; $i -lt 8; $i++) {
        $d = Dialogs
        if ($d.Count -eq 0) { return }
        # EnumWindows answers in Z order, topmost first, so index 0 is the one in front - and a
        # dialog in front of another dialog is the one that has to go first.
        $dlg = $d[0]
        $dh = Hwnd $dlg
        $btn = DlgButtonHwnd $dlg $CANCEL $IDCANCEL
        if ($btn -ne $NULLPTR) { [void][W32]::SendMessage($btn, $BM_CLICK, $NULLPTR, $NULLPTR); Start-Sleep -Milliseconds 400 }
        if ((DialogCount) -eq 0) { return }
        if ($dh -ne $NULLPTR) { [void][W32]::SendMessage($dh, $WM_COMMAND, [IntPtr]$IDCANCEL, $NULLPTR); Start-Sleep -Milliseconds 400 }
        if ((DialogCount) -eq 0) { return }
        if ($dh -ne $NULLPTR) { [void][W32]::SendMessage($dh, $WM_CLOSE, $NULLPTR, $NULLPTR); Start-Sleep -Milliseconds 600 }
    }
}
# Every journey starts and ends through here. One journey's chooser left standing was the whole
# cascade: journey 2 confirmed into journey 1's dialog and read its name back as 'Select Folder'.
function EnsureNoDialogs($what) {
    $before = DialogCount
    if ($before -gt 0) {
        Note "$what : $before chooser(s) still open from earlier; closing: $(DialogTexts)"
        ForceCloseDialogs
    }
    $after = DialogCount
    Report ($before -eq 0 -and $after -eq 0) "$what : no chooser on screen" "open before=$before after=$after"
}

# $script:chooserClosed - the chooser is no longer on screen.
# $script:chooserConfirmed - the confirm button was actually pressed with the path in the field.
# The pair is what tells "the shell refused this path" (confirmed, still open - a real refusal, and
# a PASS for the negative probes) from "this harness could not drive the dialog" (not confirmed -
# already reported FAIL above, and never a refusal).
$script:chooserClosed = $false
$script:chooserConfirmed = $false
function CancelChooser($dlg, $what) {
    $script:chooserClosed = $false
    $script:chooserConfirmed = $false
    $btn = DlgButtonHwnd $dlg $CANCEL $IDCANCEL
    if ($btn -eq $NULLPTR) {
        Report $false "$what : chooser has a Cancel button" "none found; the dialog holds: $(DialogShape $dlg)"
        ForceCloseDialogs
        return
    }
    [void][W32]::SendMessage($btn, $BM_CLICK, $NULLPTR, $NULLPTR)
    [void](WaitNoDialog 10)
    $left = DialogCount
    $script:chooserClosed = ($left -eq 0)
    Report ($left -eq 0) "$what : chooser closed on Cancel" "dialogs left: $left"
    if ($left -gt 0) { ForceCloseDialogs }
}
# Types a path into the chooser, proves it landed, and confirms it. $script:chooserClosed says
# whether the dialog actually went away: a path the shell will not accept leaves it standing,
# which is itself the refusal. A confirm is never pressed on a field that does not hold the path.
function ConfirmChooser($dlg, $path, $what) {
    $script:chooserClosed = $false
    $script:chooserConfirmed = $false
    if (-not $dlg) { Report $false "$what : a chooser was on screen to drive" 'none'; return }
    $field = DlgNameField $dlg
    if (-not $field) {
        Report $false "$what : chooser name field found" "no id, class or accessibility route found one; the dialog holds: $(DialogShape $dlg)"
        ForceCloseDialogs
        return
    }
    Report $true "$what : chooser name field found" "via $($field.Route)"
    WriteNameField $field $path
    # `-ne` between strings is case-insensitive here, which is right for a path; the trims are for
    # a shell that quotes what it holds. Anything else and the confirm is not pressed at all.
    $landed = (ReadNameField $field).Trim().Trim('"')
    if ($landed -ne $path) {
        Report $false "$what : the path is in the chooser before it is confirmed" "the field holds '$landed', wanted '$path' (route: $($field.Route)) - not confirming on that"
        ForceCloseDialogs
        return
    }
    Report $true "$what : the path is in the chooser before it is confirmed" "'$landed'"
    $ok = DlgButtonHwnd $dlg $CONFIRM $IDOK
    if ($ok -eq $NULLPTR) {
        Report $false "$what : chooser confirm button found" "nothing matching $CONFIRM and no IDOK; the dialog holds: $(DialogShape $dlg)"
        ForceCloseDialogs
        return
    }
    $script:chooserConfirmed = $true
    [void][W32]::SendMessage($ok, $BM_CLICK, $NULLPTR, $NULLPTR)
    [void](WaitNoDialog 10)
    $script:chooserClosed = ((DialogCount) -eq 0)
}
# The line that has to be a count, never a hope. It also clears whatever is left, so that a
# chooser that would not close stops here instead of becoming the next journey's subject.
function ReportChooserClosed($what) {
    $left = DialogCount
    Report ($script:chooserClosed -and $left -eq 0) "$what chooser closed on confirm" "dialogs left: $left$(if ($left -gt 0) { ' - ' + (DialogTexts) })"
    if ($left -gt 0) { ForceCloseDialogs }
}

# --- somewhere to work ------------------------------------------------------------------------

# Not under TEMP. A hosted runner hands the process `C:\Users\RUNNER~1\AppData\Local\Temp` - the
# 8.3 short form - and every path the application gives back has been canonicalised, so the two
# never match as strings. USERPROFILE has no short form to expand, and LongPath expands it anyway
# if some other machine disagrees. SamePath is still what the journeys compare with; this only
# stops the log being full of two spellings of the same folder.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$sandbox = Join-Path (Join-Path (LongPath $env:USERPROFILE) 'encastra-journeys') $stamp
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
# Said out loud because everything the journeys compare rests on it: if a `~` survived here, the
# harness and the application would be spelling the same folder two ways.
Report (-not ($sandbox -like '*~*')) 'the sandbox path carries no 8.3 short name' "$sandbox"

$junctionMade = $false
try {
    cmd /c mklink /J "$junction" "$junctionTarget" | Out-Null
    $junctionMade = Test-Path $junction
} catch { $junctionMade = $false }

# A chooser left open by an earlier attempt would block everything below - it is modal to the
# application, so every button underneath it reads as disabled.
EnsureNoDialogs 'harness start'

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
    EnsureNoDialogs 'j1 before'
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
    CancelChooser $dlg 'j1'
    $afterCancel = ValueOf (ById 'pref-project-folder')
    Report ($afterCancel -eq $before) 'j1 preference unchanged after Cancel' "'$afterCancel'"

    # Confirm: the path comes back into the preference exactly.
    Click (MustFind (Wait 'Button' '(Examinar|Browse)' 10) 'the Browse button did not come back after the cancelled chooser')
    $dlg = WaitDialog 10
    ConfirmChooser $dlg $projectsLocation 'j1'
    ReportChooserClosed 'j1'
    Start-Sleep -Milliseconds 800
    $after = ValueOf (ById 'pref-project-folder')
    # SamePath, not `-eq`: the preference holds what `resolve_grant_directory` canonicalised, and
    # the harness's own string may be a short-name spelling of the same folder. A different folder
    # still fails - what is removed is the spelling, not the difference.
    Report (SamePath $after $projectsLocation) 'j1 chosen folder became the projects preference' "'$after' (expected the same folder as '$projectsLocation')"

    # Negative, junction: choose_folder canonicalises before it records (lib.rs, resolve_grant_
    # directory), so a junction must come back as the folder it points at. If the link's own path
    # came back, what was recorded and what the person chose would be two different places.
    #
    # Resolving the link to its target IS the pass condition, and the line below says so rather
    # than leaving it to be inferred. Refusing the link outright is the other acceptable answer -
    # both are the runtime declining to record one folder under another folder's name. The only
    # failure is the link path coming back unresolved, or nothing being said at all.
    if (-not $junctionMade) {
        Skip 'j1 junction resolves to its target' 'mklink /J was refused on this machine'
    } else {
        Click (MustFind (Wait 'Button' '(Examinar|Browse)' 10) 'the Browse button was not on screen for the junction probe')
        $dlg = WaitDialog 10
        ConfirmChooser $dlg $junction 'j1-junction'
        $closed = $script:chooserClosed
        if (-not $closed) { ForceCloseDialogs }
        Start-Sleep -Milliseconds 900
        $afterLink = ValueOf (ById 'pref-project-folder')
        $refusal = FindText '(cannot be used|no se puede usar|not a folder on this machine|no es una carpeta)' 2
        if (-not $script:chooserConfirmed) {
            Skip 'j1 junction resolves to its target' 'the chooser could not be driven, so the link was never offered to it'
        } elseif (SamePath $afterLink $junctionTarget) {
            Report $true 'j1 junction resolved to its target, not the link (resolving is the pass)' "the preference holds the target '$afterLink', not the link '$junction'"
        } elseif (SamePath $afterLink $junction) {
            Report $false 'j1 junction resolved to its target, not the link (resolving is the pass)' "the link path came back unresolved: '$afterLink'"
        } elseif ($refusal) {
            Report $true 'j1 junction refused rather than followed' "'$refusal'"
        } else {
            Report $false 'j1 junction resolved to its target, not the link (resolving is the pass)' "chooser closed=$closed, the preference now holds '$afterLink' - neither the target '$junctionTarget' nor the link '$junction' - and no refusal is on screen"
        }
    }
} catch {
    JourneyEnded $_ 'j1 projects-location journey ran to the end'
}
EnsureNoDialogs 'j1 after'

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
    EnsureNoDialogs 'j2 before'
    [void](GoTo '^(Constructor|Builder)$' 'Builder')
    $palette = Wait 'Button' '(Parse JSON|encastra\.data\.json)' 15
    if (-not $palette) { throw 'the Parse JSON palette item never appeared' }
    Click $palette
    Start-Sleep -Milliseconds 700
    Report ($null -ne (FindText '(Parse JSON)' 5)) 'j2 a step is on the canvas' 'Parse JSON placed'

    # Save is armed by nothing but the store's `busy` flag (App.tsx: `disabled={busy}`) - not by a
    # name, and not by the project being dirty, though the step just placed made it dirty anyway.
    # So a Save that reads enabled is a Save that will run, and `saveProject` asks for a path
    # whenever the project has none (store.ts:753) - which is this one.
    #
    # This chooser is NOT the one journeys 1 and 3 to 5 drive. Those go through the application's
    # own `choose_folder` command, which runs `blocking_pick_folder` on the privileged side
    # (src-tauri/src/lib.rs:374). Save and Open instead call `@tauri-apps/plugin-dialog` from the
    # renderer (ipc.ts:214 and :223). Both end in tauri-plugin-dialog, so both should put an
    # ordinary common dialog on screen - but they arrive by different routes and on different
    # threads, and the first hosted run found no dialog at all here, so what is on screen is now
    # asked of the window list rather than of the accessibility tree (see ProcWindows above).
    $save = Wait 'Button' '^(Guardar|Save)$' 10
    Report ($null -ne $save -and $save.Current.IsEnabled) 'j2 Save button found and armed' "'$($save.Current.Name)' enabled=$($save.Current.IsEnabled)"
    Click $save
    $dlg = WaitDialog 12
    if (-not $dlg) {
        # Which of the two it is, the log now says. `saveProject` sets busy on the way in and
        # clears it in a finally, so a Save still greyed out means the promise has not settled -
        # the chooser is up somewhere this harness cannot reach. A Save that has come back means
        # the call returned or threw, and if it threw the sentence is already in the status bar.
        $saveNow = Find (AppWindow) 'Button' '^(Guardar|Save)$'
        $stillWaiting = ($null -ne $saveNow -and -not $saveNow.Current.IsEnabled)
        Report $false 'j2 native save dialog opened' ("none on screen; every top-level window this process owns: " + (ProcWindowsDump) + "; Save is now enabled=$($saveNow.Current.IsEnabled) (still disabled means the save is waiting on a chooser that is not in the list above; enabled means the call returned or failed); the interface is saying: " + (AppNotices 6))
        throw "SKIP: the save chooser never appeared (save still waiting=$stillWaiting), so nothing downstream of a saved project - publish-into included - can be driven"
    }
    Report $true 'j2 native save dialog opened' "'$($dlg.Current.Name)' class=$(HwndClass (Hwnd $dlg))"
    ConfirmChooser $dlg $projectFile 'j2-save'
    ReportChooserClosed 'j2-save'
    Start-Sleep -Milliseconds 1500
    $projectSaved = Test-Path $projectFile
    Report $projectSaved 'j2 project saved to disk' "$projectFile exists=$projectSaved"
    # Publish.tsx arms Prepare only for a saved project that matches the canvas. Without one the
    # chooser under test never opens, and reporting the greyed-out button as a failure of
    # publish-into would be reporting the save twice under another name.
    if (-not $projectSaved) { throw 'SKIP: the project never reached disk, so the Publish panel cannot arm Prepare and publish-into cannot be driven' }

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
        CancelChooser $dlg 'j2'
        Start-Sleep -Milliseconds 900
        $doneSection = FindText '(D.nde ha quedado|Where it went)' 2
        $wrote = @(Get-ChildItem -Force -Path $publishInto -ErrorAction SilentlyContinue)
        Report ($null -eq $doneSection -and $wrote.Count -eq 0) 'j2 Cancel wrote nothing and claimed nothing' "'Where it went' shown=$($null -ne $doneSection); entries in the folder=$($wrote.Count)"

        # Confirm, and then the thing the folder was chosen for actually happening.
        Click (MustFind (Wait 'Button' '^(Preparar|Prepare)' 10) 'the Prepare button did not come back after the cancelled chooser')
        $dlg = WaitDialog 12
        ConfirmChooser $dlg $publishInto 'j2'
        ReportChooserClosed 'j2'
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
    JourneyEnded $_ 'j2 publish-into journey ran to the end'
}
EnsureNoDialogs 'j2 after'

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
    EnsureNoDialogs 'j3 before'
    [void](GoTo '^(Biblioteca|Library)$' 'Library')
    # Both halves are the check. A chooser left open by an earlier journey is modal to the
    # application, and every button underneath it - this one included - then reads as disabled;
    # that is why `Import... enabled=False` was reported as a find and then threw out of Invoke.
    #
    # Waited on rather than read once. Library.tsx greys this button on exactly three things -
    # `!ipc.live || busy || !canBeginImport(importState)` - and two of them are transient: `busy`
    # is the store's own flag, raised by whatever ran last and lowered in a finally, and the
    # import machine is only 'busy' while an import is actually in flight. The third is not
    # transient at all, and the button's own tooltip is what tells them apart: it reads
    # "Needs the desktop application" precisely when `ipc.live` is false.
    $import = WaitEnabled 'Button' '^(Importar|Import)' 25
    $importReady = ($null -ne $import -and $import.Current.IsEnabled)
    Report $importReady 'j3 Import button is on screen and enabled' "'$($import.Current.Name)' enabled=$($import.Current.IsEnabled) tooltip='$(HelpTextOf $import)'"
    if (-not $importReady) {
        if (-not $import) {
            throw ('SKIP: no Import button is on screen in the Library at all; the automation ids there are: ' + (AutomationIdDump 30))
        }
        $why = HelpTextOf $import
        $live = -not ($why -match '(Needs the desktop application|Necesita la aplicaci)')
        throw ("SKIP: the Import button stayed greyed out for 25s. Library.tsx disables it on !ipc.live || busy || importState.phase == 'busy'. Its tooltip reads '$why', so ipc.live=$live; with ipc.live true the remaining condition is the store's busy flag or an import already in flight - something earlier in this run has not settled. Windows on screen: " + (ProcWindowsDump) + '; the interface is saying: ' + (AppNotices 6))
    }

    # Negative: cancel. `dismissed` must leave the machine idle - no dialog, nothing taken in.
    Click $import
    $dlg = WaitDialog 12
    Report ($null -ne $dlg) 'j3 chooser opened for import-from' "'$($dlg.Current.Name)'"
    CancelChooser $dlg 'j3'
    Start-Sleep -Milliseconds 1200
    $panel = FindText '(Recibir una publicaci|Take in a publication)' 2
    Report ($null -eq $panel) 'j3 Cancel took nothing in and opened no panel' "import panel on screen=$($null -ne $panel)"

    # Negative: a path that is not there. Either the shell refuses to close on it, or the
    # application refuses it - both are refusals, and both are reported with their own words.
    Click (MustFind (Wait 'Button' '^(Importar|Import)' 10) 'the Import button did not come back after the cancelled chooser')
    $dlg = WaitDialog 12
    if ($dlg) {
        ConfirmChooser $dlg $missing 'j3-missing'
        if (-not $script:chooserConfirmed) {
            Skip 'j3 a path that is not there was refused' 'the chooser could not be driven, so it was never asked to accept the path'
            ForceCloseDialogs
        } elseif (-not $script:chooserClosed) {
            Report $true 'j3 a path that is not there was refused' "the chooser would not accept it: $(DialogTexts)"
            ForceCloseDialogs
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
        Click (MustFind (Wait 'Button' '^(Importar|Import)' 10) 'the Import button was not on screen for the junction probe')
        $dlg = WaitDialog 12
        if ($dlg) {
            ConfirmChooser $dlg $junction 'j3-junction'
            if (-not $script:chooserConfirmed) {
                Skip 'j3 a junction is resolved or refused, never followed blindly' 'the chooser could not be driven, so it was never asked to accept the link'
                ForceCloseDialogs
            } elseif (-not $script:chooserClosed) {
                Report $true 'j3 a junction is resolved or refused, never followed blindly' "the chooser would not accept it: $(DialogTexts)"
                ForceCloseDialogs
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
        Click (MustFind (Wait 'Button' '^(Importar|Import)' 10) 'the Import button was not on screen for the round trip')
        $dlg = WaitDialog 12
        ConfirmChooser $dlg $preparedFolder 'j3'
        ReportChooserClosed 'j3'
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
    JourneyEnded $_ 'j3 import-from journey ran to the end'
}
EnsureNoDialogs 'j3 after'

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
    EnsureNoDialogs 'j4/j5 before'
    [void](GoTo '^(Constructor|Builder)$' 'Builder')
    $new = Wait 'Button' '^(Nuevo|New)$' 10
    if ($new) { Click $new; Start-Sleep -Milliseconds 900 }
    # New does not start a new project while there is unsaved work: it puts the discard question
    # on screen instead (store.ts:677) and waits. That question is an in-page alertdialog, not a
    # window, so nothing in the dialog handling above sees it - and the step journey 2 left on the
    # canvas is exactly what makes it appear here. Answered, so this journey starts on its own
    # canvas rather than on top of journey 2's.
    DismissDiscardPrompt
    $palette = Wait 'Button' '(Save File|encastra\.file\.save)' 15
    if (-not $palette) { throw 'the Save File palette item never appeared' }
    Click $palette
    Start-Sleep -Milliseconds 900

    # The Inspector shows a step's settings only for the step that is selected (Inspector.tsx:506
    # returns the empty panel when `selectedNodeId` names nothing). Placing from the palette is
    # enough to select: `addNode` sets `selectedNodeId` to the step it just made (store.ts:355,
    # "a newly placed node is the one you want to configure"). That matters, because selecting by
    # clicking the step on the canvas is not available from here - React Flow draws each step as a
    # plain div with, deliberately, no ARIA role and so no Invoke pattern (ComponentNode.tsx).
    # If the field below is missing, the two dumps say whether a step was placed at all and what
    # the interface is publishing instead, rather than leaving that to be guessed at.
    $folderField = ByIdSuffix '-folder' 12
    if (-not $folderField) {
        Report $false 'j4 the Inspector shows the folder setting for the selected step' ("no element publishes an id ending in '-folder'. Steps UI Automation can see: " + (PlacedStepsDump) + ' ... ids on screen: ' + (AutomationIdDump 40))
        throw 'SKIP: the folder setting of the selected step is not exposed to UI Automation - either the step was not placed, or placing it did not select it - so neither chooser below it can be reached'
    }
    Report $true 'j4 the Inspector shows the folder setting for the selected step' "automationId='$($folderField.Current.AutomationId)'"
    # Everything below is addressed relative to this field - the Choose button is found by the row
    # it sits in. Without it there is nothing to drive, and carrying on only produced
    # `You cannot call a method on a null-valued expression` three checks later.
    $nodeId = $folderField.Current.AutomationId -replace '-folder$', ''
    Note "the step is '$nodeId'"

    $allow = Wait 'Button' '^(Permitir esta carpeta|Allow this folder)$' 10
    Report ($null -ne $allow) 'j4 the permission control is on screen before any folder is chosen' "'$($allow.Current.Name)' enabled=$($allow.Current.IsEnabled)"
    $hint = FindText '(Elige antes una carpeta|Choose a folder first)' 3
    Report ($null -ne $hint -and $null -ne $allow -and -not $allow.Current.IsEnabled) 'j4 nothing can be allowed until a folder is chosen' "hint='$hint' allowEnabled=$($allow.Current.IsEnabled)"

    # Negative: cancel. Nothing is configured, so nothing can be allowed.
    $chooseFolder = ChooseButtonNear $folderField
    Report ($null -ne $chooseFolder) 'j4 the folder row has its own Choose button' "'$($chooseFolder.Current.Name)'"
    Click (MustFind $chooseFolder 'the folder row has no Choose button next to it, so grant-to-component cannot be driven')
    $dlg = WaitDialog 12
    Report ($null -ne $dlg) 'j4 chooser opened for grant-to-component' "'$($dlg.Current.Name)'"
    CancelChooser $dlg 'j4'
    Start-Sleep -Milliseconds 700
    $stillEmpty = ValueOf (ByIdSuffix '-folder' 5)
    $allow = Wait 'Button' '^(Permitir esta carpeta|Allow this folder)$' 5
    Report ($stillEmpty -eq '' -and $null -ne $allow -and -not $allow.Current.IsEnabled) 'j4 Cancel granted nothing and configured nothing' "folder='$stillEmpty' allowEnabled=$($allow.Current.IsEnabled)"

    # Confirm, then allow: the button's own label is the application saying the folder answered
    # the question it was asked.
    Click (MustFind (ChooseButtonNear (ByIdSuffix '-folder' 5)) 'the folder row lost its Choose button after the cancelled chooser')
    $dlg = WaitDialog 12
    ConfirmChooser $dlg $grantFolder 'j4'
    ReportChooserClosed 'j4'
    Start-Sleep -Milliseconds 800
    $folderValue = ValueOf (ByIdSuffix '-folder' 5)
    Report (SamePath $folderValue $grantFolder) 'j4 the chosen folder became the step configuration' "'$folderValue' (expected the same folder as '$grantFolder')"
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
    Report ($null -ne $readonlyBox) 'j5 the read-only box for the starting file is exposed' "found=$($null -ne $readonlyBox)"
    if (-not $readonlyBox) { throw 'SKIP: the read-only box for the starting file is not exposed, so run-input cannot be driven' }
    $chooseFile = ChooseButtonNear $readonlyBox
    Report ($null -ne $chooseFile) 'j5 the starting-material row has its own Choose button' "'$($chooseFile.Current.Name)'"

    Click (MustFind $chooseFile 'the starting-material row has no Choose button next to it, so run-input cannot be driven')
    $dlg = WaitDialog 12
    Report ($null -ne $dlg) 'j5 chooser opened for run-input' "'$($dlg.Current.Name)'"
    CancelChooser $dlg 'j5'
    Start-Sleep -Milliseconds 600
    $afterCancel = ValueOf $readonlyBox
    Report ($afterCancel -eq '') 'j5 Cancel seeded no input' "box='$afterCancel'"

    Click (MustFind (ChooseButtonNear $readonlyBox) 'the starting-material row lost its Choose button after the cancelled chooser')
    $dlg = WaitDialog 12
    ConfirmChooser $dlg $inputFile 'j5'
    ReportChooserClosed 'j5'
    Start-Sleep -Milliseconds 800
    $inputValue = ValueOf $readonlyBox
    Report (SamePath $inputValue $inputFile) 'j5 the chosen file became the input for the run' "'$inputValue' (expected the same file as '$inputFile')"

    # The proof that both answers were real: a run that writes into the granted folder.
    $run = Wait 'Button' '^(Ejecutar|Run)$' 10
    Report ($null -ne $run -and $run.Current.IsEnabled) 'j4/j5 Run is available with a folder allowed and a file chosen' "enabled=$($run.Current.IsEnabled)"
    Click (MustFind $run 'the Run button is not on screen, so the granted folder cannot be written into')
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
    $typed = SetValue (MustFind (ByIdSuffix '-folder' 5) 'the folder box is no longer exposed, so a folder it never chose cannot be typed into it') $projectsLocation
    Report ($typed -eq $projectsLocation) 'neg the interface accepts a typed folder it never chose' "'$typed'"
    $allowAgain = Wait 'Button' '^(Permitir esta carpeta|Allow this folder)$' 8
    Report ($null -ne $allowAgain) 'neg the permission went back to asking when the folder changed' "button reads '$($allowAgain.Current.Name)' rather than Allowed"
    Click (MustFind $allowAgain 'the permission control did not go back to asking, so the refusal cannot be provoked')
    Start-Sleep -Milliseconds 400
    Click (MustFind (Wait 'Button' '^(Ejecutar|Run)$' 10) 'the Run button is not on screen for the refusal probe')
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
    JourneyEnded $_ 'j4/j5 grant-to-component and run-input journeys ran to the end'
}
EnsureNoDialogs 'j4/j5 after'

# --- the application is still standing ---------------------------------------------------------
ForceCloseDialogs
$proc.Refresh()
Report (-not $proc.HasExited) 'application still running at the end' "exited=$($proc.HasExited) responding=$($proc.Responding)"

"SUMMARY  passed=$script:passed failed=$script:failed skipped=$script:skipped  sandbox=$sandbox"
if ($script:failed -gt 0) { exit 1 }
if ($script:skipped -gt 0) { exit 2 }
exit 0
