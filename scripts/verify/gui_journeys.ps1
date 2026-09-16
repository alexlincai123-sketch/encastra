# Usage: `.\scripts\verify\gui_journeys.ps1 -Launch`, which starts the installed application itself
# and drives that; or start Encastra by hand (any build) and run the script with no -Launch to
# attach to it. Needs a desktop session; the interface language may be English or Spanish (the two
# the checks know).
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
#   * Reading the path back out of a field proves what is in a control, not which control it is.
#     A Save As dialog carries a search box as well as a name box, and a path typed into the
#     search box reads back perfectly, runs a search, and saves nothing: three PASS lines and
#     then `j2 project saved to disk -> exists=False`. So no candidate whose label says search is
#     ever accepted, the name box is preferred by label and by control id, and the read-back line
#     names the control it read.
#   * An `aria-modal="true"` dialog inside the WebView does not merely cover the interface: while
#     it has focus, Chromium leaves everything outside it out of the accessibility tree, so every
#     lookup in this file returns nothing. The first-run welcome is one of those, and it is
#     dismissed before anything is looked for - see "the first-run welcome" below.
#
# A journey that cannot run prints FAIL, or SKIP with the reason. It never prints PASS. The exit
# code is 1 if anything failed and 2 if anything was skipped, because a skipped journey leaves
# B5 without the evidence it was asking for and a skip that exits 0 is a pass wearing a hat.
#
#   * The canvas is the one thing here that is NOT asked of UI Automation, and the reason is not a
#     preference. Chromium publishes a div with no ARIA role as role `generic` with an empty name,
#     and it does not publish that element's `id` as an AutomationId at all: a dump of the whole
#     accessibility tree of the Builder contains zero nodes referencing `node-*`. So the check this
#     file used to make - wait for an element whose AutomationId is `node-<id>` - was waiting for
#     something that cannot exist in the tree it was waiting in, and its permanent negative was a
#     measurement artefact, not a product failure. React Flow's `onlyRenderVisibleElements` is the
#     second half of it: `addNode` places each step at `rightmost.x + 260`, so from the third step
#     on a node is inserted into the DOM and unmounted again about three milliseconds later, and
#     only Fit View brings it back. The canvas is therefore observed through the page itself, over
#     the DevTools protocol - see scripts/verify/cdp.mjs and "the canvas, through the page itself"
#     below. Everything native stays on UI Automation, which is what UI Automation is for.
#
# -Launch makes the harness the owner of what it drives: it stops every Encastra host and every
# WebView2 browser process belonging to this application, then starts the application with the
# debugging flag on the child's own environment block. That is not tidiness - WebView2 keeps one
# browser process per user-data directory and the host that creates it settles its command line for
# everyone after, so attaching to a window somebody else opened means driving a browser whose
# arguments nobody in this file chose. See "the application, started by the harness that drives it".
#
# -Repeat n runs the whole suite n times, each iteration on its own sandbox and its own empty
# project, and suffixes every line with `[iteration k/n]`. A journey that passes once and fails the
# second time has not passed; CI asks for three. -SelfTest exercises only the CDP side of this
# file - connectivity and the canvas oracle - and touches no UI Automation at all, so it is safe to
# run on a desktop somebody is sitting at.
#
# This file is deliberately pure ASCII, so it is safe with or without a BOM (this repo has been
# bitten by Spanish and CJK literals arriving mangled from a BOM-less file). Where a Spanish
# string carries an accent the pattern spells it with `.` - `Qu. dice que es`, `bot.n Elegir`.
# The native dialog's own button names come from the *Windows* display language, not from the
# application's, which is why both languages are matched there too.

param(
    # How many times the whole suite runs. A chooser that works once and not twice works by
    # accident, and B5 is asking whether these paths work - so CI passes 3 and the SUMMARY line
    # carries the number, which scripts/release_check.py reads and refuses to call verified below 3.
    [int]$Repeat = 1,
    # Only the part of this file that talks to the page: connectivity, and the canvas oracle driven
    # by DOM clicks. No UI Automation, no native dialog, nothing that needs the desktop to itself.
    [switch]$SelfTest,
    # Where the application publishes the DevTools protocol. Test-only, and only there because
    # whoever started the application set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS.
    [int]$CdpPort = 9222,
    # Start the application here rather than attaching to one somebody else started. What this is
    # for is in "the application, started by the harness that drives it" below: the flag only ever
    # reaches the browser process if it is on the environment of the host that CREATES that browser
    # process, and a harness that attaches to a window it did not open cannot know that it was.
    [switch]$Launch,
    [string]$Exe = (Join-Path $env:LOCALAPPDATA 'Encastra\encastra-desktop.exe')
)
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
  // Who a window's parent actually is, and what id its dialog template gave it. `child windows=[]`
  // printed next to a pane that plainly owns a handle is a contradiction, and these two settle it:
  // either the pane is not under the handle the enumeration was started from, or it is and the
  // enumeration is wrong. Both are printed rather than guessed at.
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
  // Keystrokes to one window handle. PostMessage rather than SendMessage because a key press is
  // two messages the target has to see in order and process on its own thread; and to a handle,
  // never to "whatever has focus on this desktop" - there is no global SendKeys in this file.
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool PostMessageW(IntPtr h, uint m, IntPtr w, IntPtr l);
  // MSAA's hit test. This is what the accessibility layer itself answers for a screen point, so it
  // says two things at once: which element is really on top at the palette item's own coordinates
  // (an item covered by something else is an item whose clicks land elsewhere), and it hands back
  // the IAccessible whose accDoDefaultAction is what LegacyIAccessiblePattern.DoDefaultAction
  // calls. The managed UI Automation wrapper does not expose that pattern at all - it knows Invoke,
  // Value, Toggle and the rest, and nothing about the legacy bridge - so this is the route to it.
  // IAccessible is a dual interface, so it is called by name through IDispatch and no vtable is
  // redeclared here.
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int x; public int y; }
  [DllImport("oleacc.dll")] public static extern int AccessibleObjectFromPoint(POINT pt, [MarshalAs(UnmanagedType.IDispatch)] out object acc, [MarshalAs(UnmanagedType.Struct)] out object child);
  // Typing into the Common Item Dialog. This is the one place in this file where a message to a
  // window handle cannot do the job, and the reason is in "the file name a file dialog will
  // actually use" below: the dialog's file-name box is a DirectUI element with no window of its
  // own. On Save As it publishes as a ComboBox with ctrlId=0; on Open the only thing carrying the
  // label is a Static with ctrlId=1090 - the label itself. WM_SETTEXT to either changes what is
  // displayed and nothing the dialog will read. Keystrokes go to whatever holds keyboard focus,
  // which is the real control, and the dialog is made foreground and checked to BE foreground
  // before a single one is sent.
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  // 64-bit layout: 4 bytes of type, 4 of padding to align the union, 24 of KEYBDINPUT = 32, which
  // is what SendInput is told and what it expects. SendInput validates that size, so a 32-bit
  // PowerShell would fail this call loudly rather than corrupt anything; the harness runs 64-bit.
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public uint padding; public KEYBDINPUT ki; }
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  const uint INPUT_KEYBOARD = 1;
  const uint KEYEVENTF_KEYUP = 0x0002;
  const uint KEYEVENTF_UNICODE = 0x0004;
  // Unicode scan codes rather than virtual keys: what is typed is a path, and a virtual key means
  // a different character under every keyboard layout. This way the same characters arrive on a
  // runner set to any layout at all.
  public static int TypeText(string s) {
    var list = new System.Collections.Generic.List<INPUT>();
    foreach (char c in s) {
      INPUT down = new INPUT(); down.type = INPUT_KEYBOARD; down.ki.wScan = (ushort)c; down.ki.dwFlags = KEYEVENTF_UNICODE;
      INPUT up = new INPUT(); up.type = INPUT_KEYBOARD; up.ki.wScan = (ushort)c; up.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
      list.Add(down); list.Add(up);
    }
    if (list.Count == 0) { return 0; }
    return (int)SendInput((uint)list.Count, list.ToArray(), Marshal.SizeOf(typeof(INPUT)));
  }
  // One key under a modifier: Alt+N for the file-name accelerator, Ctrl+A to select whatever is
  // already in the box before replacing it.
  public static int KeyUnder(ushort modifier, ushort vk) {
    INPUT[] seq = new INPUT[4];
    seq[0].type = INPUT_KEYBOARD; seq[0].ki.wVk = modifier;
    seq[1].type = INPUT_KEYBOARD; seq[1].ki.wVk = vk;
    seq[2].type = INPUT_KEYBOARD; seq[2].ki.wVk = vk; seq[2].ki.dwFlags = KEYEVENTF_KEYUP;
    seq[3].type = INPUT_KEYBOARD; seq[3].ki.wVk = modifier; seq[3].ki.dwFlags = KEYEVENTF_KEYUP;
    return (int)SendInput(4, seq, Marshal.SizeOf(typeof(INPUT)));
  }
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
$WM_KEYDOWN = 0x0100; $WM_KEYUP = 0x0101
$VK_RETURN = 0x0D; $VK_SPACE = 0x20
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
# Which run of the suite a line belongs to. Appended at the END of the line on purpose: what
# release_check.py reads is the `^PASS` / `^FAIL` / `^SKIP` at the start, and a suffix cannot move
# it. Empty until the loop at the bottom sets it.
$script:iteration = ''
function Report($ok, $what, $observed) {
    if ($ok) { $script:passed++ } else { $script:failed++ }
    "{0}  {1}  -> {2}{3}" -f ($(if ($ok) { 'PASS' } else { 'FAIL' }), (OneLine $what), (OneLine $observed), $script:iteration)
}
function Skip($what, $why) { $script:skipped++; "SKIP  {0}  -> {1}{2}" -f (OneLine $what), (OneLine $why), $script:iteration }
function Note($text) { "note  $(OneLine $text)$script:iteration" }
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

# --- the application, started by the harness that drives it -----------------------------------
#
# -Launch exists because of a measurement, not a preference. WebView2 keeps ONE browser process per
# user-data directory, and the host that creates it settles its command line for every host after
# it. Measured on this machine, both orders, one browser process each time:
#
#   first host without the flag, second host with it -> browser has no --remote-debugging-port,
#                                                       nothing listens, and the second host's
#                                                       environment variable changed nothing;
#   first host with the flag, second host without it -> browser carries the flag, the port listens,
#                                                       and the second host shares it.
#
# So WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS is not a property of the application, it is a property
# of whichever host happened to be first - and a harness that attaches to a window somebody else
# opened cannot know whether that host had it. Run 35060930065 is what this is for: the variable
# was provably set in the process that called Start-Process (install.log line 15), the application
# was up, and the browser process had no flag on it.
#
# With -Launch the harness stops every host AND every browser process belonging to this
# application's user-data directory, waits until none is left, and then starts the application
# itself with the variable written onto the child's own environment block - UseShellExecute=false,
# so this is a CreateProcess with an environment we built, not inheritance through a shell that may
# or may not carry it. Both candidate causes go at once.
#
# Without -Launch the old behaviour is kept: attach to whatever is running, and let the CDP
# precondition say whether that one has the port open.
$USER_DATA_MARK = 'dev.encastra.app'   # tauri.conf.json `identifier`; names the EBWebView folder.

function EncastraHosts { return @(Get-CimInstance Win32_Process -Filter "Name='encastra-desktop.exe'" -ErrorAction SilentlyContinue) }
function EncastraBrowsers {
    return @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*$USER_DATA_MARK*" })
}
# Everything of this application that is running, gone, and said out loud - because "there was
# already one running" and "a browser process outlived its host" are exactly the findings that
# would explain a run where the flag never reached the browser.
function StopSubject {
    $hosts = EncastraHosts
    $browsers = EncastraBrowsers
    Note "-Launch : before starting anything, $($hosts.Count) encastra-desktop host(s) and $($browsers.Count) browser process(es) for $USER_DATA_MARK were already running"
    foreach ($h in $hosts) { Note "-Launch : stopping host pid=$($h.ProcessId) started=$($h.CreationDate.ToString('s'))"; try { Stop-Process -Id $h.ProcessId -Force -ErrorAction Stop } catch { Note "-Launch : host pid=$($h.ProcessId) would not stop ($($_.Exception.GetType().Name))" } }
    # The browser usually goes when its host does. Usually is not always, and a survivor is the
    # thing that would silently hand the next launch a browser with the wrong command line.
    for ($i = 0; $i -lt 60; $i++) {
        if ((EncastraHosts).Count -eq 0 -and (EncastraBrowsers).Count -eq 0) { break }
        Start-Sleep -Milliseconds 500
    }
    foreach ($b in (EncastraBrowsers)) {
        Note "-Launch : a browser process outlived its host and is being stopped: pid=$($b.ProcessId) parent=$($b.ParentProcessId) - a survivor here is what makes a later host's WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS do nothing"
        try { Stop-Process -Id $b.ProcessId -Force -ErrorAction Stop } catch { }
    }
    for ($i = 0; $i -lt 30; $i++) {
        if ((EncastraBrowsers).Count -eq 0) { break }
        Start-Sleep -Milliseconds 500
    }
    $left = (EncastraHosts).Count
    $leftBrowsers = (EncastraBrowsers).Count
    Report ($left -eq 0 -and $leftBrowsers -eq 0) '-Launch the machine has no Encastra of its own left before the harness starts one' "hosts left=$left, browser processes left=$leftBrowsers"
}
$script:launchedPid = 0
function LaunchSubject($exe, $port) {
    if (-not (Test-Path $exe)) {
        Report $false '-Launch the application to drive is where it was said to be' "$exe does not exist"
        return
    }
    $args_ = "--remote-debugging-port=$port"
    # Set on this process too, so that anything else started from here agrees with the child.
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $args_
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $exe
    $psi.WorkingDirectory = (Split-Path $exe -Parent)
    # The whole point. UseShellExecute=false is what makes StartInfo.Environment mean anything: with
    # it true the variable is whatever the shell decides to pass on, which is the thing that cannot
    # be relied upon and the thing run 35060930065 could not rule out.
    $psi.UseShellExecute = $false
    $psi.Environment['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = $args_
    try {
        $started = [System.Diagnostics.Process]::Start($psi)
    } catch {
        Report $false '-Launch the harness started the application it drives' "$exe would not start: $($_.Exception.GetType().Name) - $($_.Exception.Message)"
        return
    }
    $script:launchedPid = $started.Id
    Report $true '-Launch the harness started the application it drives' "$exe as pid $($started.Id), with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=$args_ written onto its own environment block (UseShellExecute=false, so this is not inheritance through a shell)"
}

# --- asking WebView2 for the port the other way ------------------------------------------------
#
# Run 35062783047 ruled out everything else: -Launch had cleared the machine (hosts=0, browsers=0),
# started the application itself with the variable on the child's own environment block, the
# browser process was parented to that very host - and its command line still carried no
# --remote-debugging-port. The documentation says why, and it is not a bug:
#
#   "Elevated apps ignore flags that are set via the local device environment"
#     - WebView2 browser flags, "Setting browser flags in your local device environment"
#
#   "To help protect elevated processes from configuration that can be modified by standard users,
#    WebView2 ignores certain user-scoped override mechanisms when the host process is running
#    elevated. When the host process is running elevated:
#      - WEBVIEW2_* environment variable overrides (flags) are ignored, including
#        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS.
#      - HKEY_CURRENT_USER (HKCU) policy overrides are ignored.
#      - AdditionalBrowserArguments registry overrides that are under HKCU are ignored.
#      - HKEY_LOCAL_MACHINE (HKLM) policy overrides are honored.
#    Non-elevated WebView2 apps honor all of the supported override mechanisms."
#     - Develop secure WebView2 apps, "For an elevated host app, use appropriate override flags"
#
# A hosted runner runs as an administrator with UAC off, so every host started there is a High
# Integrity Level process, and the environment variable was never going to reach the browser. The
# registry route is the same override by another road:
#
#   [{Root}]\Software\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments
#   "{AppId}"=""
#
#   "First verify with Root as HKLM and then HKCU. AppId is first set to the Application User Model
#    ID of the process, then if no corresponding registry key, the AppId is set to the compiled code
#    name of the process, or if that is not a registry key then *."
#     - CreateCoreWebView2EnvironmentWithOptions
#
# So: HKCU when this process is not elevated (which is the case it is honoured in), and HKLM when it
# is - which is also exactly when this process has the rights to write there. The value is named for
# this application and never `*`: a wildcard would put a debugging port into every WebView2 app on
# the machine, Teams and the shell's own search included.
#
# And it is taken back. A debugging-port policy left behind on any machine is a hole somebody else
# walks into, so every exit path from here on goes through EndRun, which removes what was written -
# restoring any value that was already there rather than deleting somebody else's configuration.
$POLICY_KEY = 'Software\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments'
# The two spellings of "the compiled code name of the process", because the documentation does not
# say which one it means and both are specific to this application.
$POLICY_VALUE_NAMES = @('encastra-desktop.exe', 'encastra-desktop')
$script:policyWrote = @()
$script:policyKeysCreated = @()
$script:policyCleanupFailed = $false

function IsElevated {
    try {
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        return (New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch { return $false }
}
function WriteBrowserArgsPolicy($port) {
    $wanted = "--remote-debugging-port=$port"
    $elevated = IsElevated
    # HKCU is ignored by an elevated host, and HKLM is the one that is honoured - and needs the
    # rights that being elevated is. So the two cases do not overlap, and each writes where its own
    # host will actually read.
    $roots = if ($elevated) { @('HKLM:', 'HKCU:') } else { @('HKCU:') }
    Note "-Launch : this process is $(if ($elevated) { 'ELEVATED, so WebView2 ignores the environment variable and any HKCU policy; the override has to be under HKLM' } else { 'not elevated, so the environment variable and an HKCU policy are both honoured' })"
    foreach ($root in $roots) {
        $path = Join-Path $root $POLICY_KEY
        try {
            if (-not (Test-Path $path)) {
                # Every ancestor that does not exist yet, remembered deepest-first, because
                # New-Item -Force creates the whole chain and "leave the machine as it was found"
                # has to mean the chain too - not just the leaf with our value in it.
                $missing = @()
                $walk = $path
                while ($walk -and -not (Test-Path $walk)) {
                    $missing = @($walk) + $missing
                    $parent = Split-Path $walk -Parent
                    if (-not $parent -or $parent -eq $walk) { break }
                    $walk = $parent
                }
                New-Item -Path $path -Force | Out-Null
                [array]::Reverse($missing)
                $script:policyKeysCreated += $missing
            }
            foreach ($name in $POLICY_VALUE_NAMES) {
                $had = $false; $old = $null
                try {
                    $existing = Get-ItemProperty -Path $path -Name $name -ErrorAction Stop
                    $had = $true; $old = $existing.$name
                } catch { $had = $false }
                if ($had) { Note "-Launch : $path\$name already held '$old'; it will be put back at the end of the run" }
                New-ItemProperty -Path $path -Name $name -Value $wanted -PropertyType String -Force | Out-Null
                $script:policyWrote += @{ Path = $path; Name = $name; Had = $had; Old = $old }
                Note "-Launch : wrote $path\$name = '$wanted'"
            }
        } catch {
            Note "-Launch : could not write the policy under $root ($($_.Exception.GetType().Name) - $($_.Exception.Message))"
        }
    }
}
# Called on every way out of this script. Idempotent, and it never throws: a run that failed must
# still leave the machine as it found it.
function RemoveBrowserArgsPolicy {
    if (@($script:policyWrote).Count -eq 0 -and @($script:policyKeysCreated).Count -eq 0) { return }
    foreach ($v in $script:policyWrote) {
        try {
            if ($v.Had) {
                New-ItemProperty -Path $v.Path -Name $v.Name -Value $v.Old -PropertyType String -Force | Out-Null
                Note "-Launch : put $($v.Path)\$($v.Name) back to the value it held before this run"
            } else {
                Remove-ItemProperty -Path $v.Path -Name $v.Name -ErrorAction Stop
                Note "-Launch : removed $($v.Path)\$($v.Name), so no debugging-port policy is left on this machine"
            }
        } catch {
            $script:policyCleanupFailed = $true
            Note "-Launch : COULD NOT clean up $($v.Path)\$($v.Name) ($($_.Exception.GetType().Name)) - remove it by hand"
        }
    }
    $script:policyWrote = @()
    # And the key itself, but only one this run created and only while it is empty: an empty policy
    # key is litter rather than a hole, and somebody else's key is not ours to remove.
    foreach ($key in $script:policyKeysCreated) {
        try {
            $item = Get-Item -Path $key -ErrorAction Stop
            if ($item.ValueCount -eq 0 -and $item.SubKeyCount -eq 0) {
                Remove-Item -Path $key -ErrorAction Stop
                Note "-Launch : removed the empty policy key $key that this run created"
            } else {
                Note "-Launch : left $key in place - it holds $($item.ValueCount) value(s) and $($item.SubKeyCount) subkey(s) that are not this run's"
            }
        } catch { }
    }
    $script:policyKeysCreated = @()
}
# The only way this script ends. Everything below that used to say `exit N` says this instead, so
# that a debugging-port policy cannot outlive the run that wrote it.
function EndRun($code) {
    RemoveBrowserArgsPolicy
    # A policy this run could not take back is a debugging port left armed on somebody's machine,
    # which is a worse outcome than any journey failing. It is said in the words release_check.py
    # reads - `^FAIL` anywhere in the log fails the evidence - and the run cannot exit 0 on it.
    if ($script:policyCleanupFailed) {
        Report $false 'the debugging-port policy this run wrote was taken back' 'it could NOT be removed - see the notes above; remove it by hand, the machine is left with a WebView2 AdditionalBrowserArguments policy naming a debugging port'
        if ($code -eq 0) { $code = 1 }
    }
    exit $code
}
# And for a terminating error nobody caught, which would otherwise walk straight past EndRun.
trap { RemoveBrowserArgsPolicy; break }

if ($Launch) {
    StopSubject
    WriteBrowserArgsPolicy $CdpPort
    LaunchSubject $Exe $CdpPort
}

$proc = if ($script:launchedPid -gt 0) { Get-Process -Id $script:launchedPid -ErrorAction SilentlyContinue } else { Get-Process encastra-desktop -ErrorAction SilentlyContinue | Select-Object -First 1 }
if (-not $proc) {
    "FAIL  Encastra is running  -> no encastra-desktop process; start the application first, or pass -Launch and let the harness start it"
    "SUMMARY  passed=0 failed=1 skipped=0  repeat=$Repeat"
    EndRun 1
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
    $prefix = ''
    if (WelcomeShowing) { $prefix = '(the first-run welcome is on screen, and while it has focus everything behind it is out of the accessibility tree) ' }
    try {
        foreach ($e in (Descendants (AppWindow))) {
            if ($ids.Count -ge $max) { break }
            $id = $e.Current.AutomationId
            if ($id) { $ids += ("{0}({1})" -f $id, ($e.Current.ControlType.ProgrammaticName -replace '^ControlType\.', '')) }
        }
    } catch { $ids += "(the tree could not be read: $($_.Exception.GetType().Name))" }
    if ($ids.Count -eq 0) { return ($prefix + '(nothing on screen publishes an automation id)') }
    return ($prefix + ($ids -join ' '))
}
# What UI Automation sees for a step that has been placed. ComponentNode gives each one
# id="node-<id>" and deliberately no ARIA role - see the comment in ComponentNode.tsx - so it
# arrives as a plain grouping element with no Invoke pattern. That is exactly the thing to say
# out loud if a step turns out not to be selectable from here.
function PlacedStepsDump {
    $out = @()
    $prefix = ''
    if (WelcomeShowing) { $prefix = '(the first-run welcome is on screen, so the canvas behind it is out of the accessibility tree whether or not a step is on it) ' }
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
    if ($out.Count -eq 0) { return ($prefix + '(nothing on screen carries a node-* id: either no step was placed or the canvas publishes none)') }
    return ($prefix + ($out -join ' | '))
}
# Just the ids, for the question "is a step on the canvas". ComponentNode gives every step
# `id="node-<id>"` (ComponentNode.tsx:131) and the canvas points `aria-activedescendant` at it,
# so the id is not decoration - it is what the interface itself uses to name a placed step.
function PlacedStepIds {
    $out = @()
    try {
        foreach ($e in (Descendants (AppWindow))) {
            $id = $e.Current.AutomationId
            if ($id -and $id.StartsWith('node-')) { $out += $id }
        }
    } catch { }
    return $out
}
# Every id on screen that carries `node-` anywhere in it, not only at the start, so the shape of
# the id is on the record rather than being assumed to be the shape this file went looking for.
function NodeIdDump {
    $out = @()
    try {
        foreach ($e in (Descendants (AppWindow))) {
            $id = $e.Current.AutomationId
            if ($id -and $id -like '*node-*') { $out += ("{0}({1})" -f $id, ($e.Current.ControlType.ProgrammaticName -replace '^ControlType\.', '')) }
        }
    } catch { $out += "(the tree could not be read: $($_.Exception.GetType().Name))" }
    if ($out.Count -eq 0) { return '(no id anywhere on screen contains node-)' }
    return ($out -join ' ')
}
# What the palette is actually offering. "The item was not found" and "the palette is empty" are
# different answers and only one of them is a harness problem: `Palette()` renders
# `palette.empty` - "No components are installed." - when the `manifests` map is empty, and an
# empty map is also exactly what makes `addNode` return without doing anything (store.ts:328,
# `const manifest = get().manifests[componentRef]; if (!manifest) return;`). So if the palette is
# empty the silence is the product's, not this file's, and that is worth saying out loud.
# A palette item is told apart from every other button on screen by its own title attribute, which
# `PaletteItem` sets to the component reference - `encastra.data.json@1.0.0` and the description -
# and which Chromium publishes as HelpText. So the list below is not "buttons that might be palette
# items": it is the set of references the palette is offering, which is the `manifests` map itself,
# which is the very thing `addNode` looks the reference up in.
function PaletteDump($max) {
    $empty = FindText '(No components are installed|No hay componentes instalados)' 1
    $items = @(); $others = 0
    try {
        foreach ($b in (ControlsOfType 'Button')) {
            $ref = (HelpTextOf $b) -split "`n" | Select-Object -First 1
            if (-not $ref -or $ref -notmatch '^[a-z0-9._-]+@') { $others++; continue }
            if ($items.Count -ge $max) { continue }
            $n = $b.Current.Name
            if (-not $n) { $n = '' }
            if ($n.Length -gt 26) { $n = $n.Substring(0, 26) }
            $items += ("{0} ('{1}')" -f $ref.Trim(), $n)
        }
    } catch { $items += "(the tree could not be read: $($_.Exception.GetType().Name))" }
    $head = if ($empty) { "the palette is showing its empty state ('$empty'), so the store's manifests map is empty and addNode returns without placing anything; " } else { '' }
    if ($items.Count -eq 0) { return ($head + "the palette is offering no component at all ($others other buttons are on screen)") }
    return ($head + "the palette is offering $($items.Count) components ($others other buttons on screen): " + ($items -join ' '))
}
# Everything UI Automation will say about one element, before it is asked to do anything. The
# patterns are the point: a control that publishes no Invoke is a control `Invoke()` cannot press,
# and `IsOffscreen` or `IsEnabled=False` is a click that was never going to land. LegacyIAccessible
# is deliberately absent from this list - the managed UI Automation wrapper knows Invoke, Value,
# Toggle, SelectionItem and the rest and nothing at all about the legacy bridge, so whether the
# element supports it cannot be asked here; route 2 below reaches it through MSAA instead.
function ElementFacts($el) {
    if (-not $el) { return '(no element)' }
    try {
        $c = $el.Current
        $pats = @()
        if (HasPattern $el ([System.Windows.Automation.InvokePattern]::Pattern)) { $pats += 'Invoke' }
        if (HasPattern $el ([System.Windows.Automation.SelectionItemPattern]::Pattern)) { $pats += 'SelectionItem' }
        if (HasPattern $el ([System.Windows.Automation.TogglePattern]::Pattern)) { $pats += 'Toggle' }
        if (HasPattern $el ([System.Windows.Automation.ValuePattern]::Pattern)) { $pats += 'Value' }
        if (HasPattern $el ([System.Windows.Automation.ScrollItemPattern]::Pattern)) { $pats += 'ScrollItem' }
        if ($pats.Count -eq 0) { $pats += 'none' }
        $n = $c.Name
        if (-not $n) { $n = '' }
        if ($n.Length -gt 70) { $n = $n.Substring(0, 70) }
        $r = $c.BoundingRectangle
        return ("type={0} automationId='{1}' name='{2}' enabled={3} offscreen={4} keyboardFocusable={5} rect=({6},{7} {8}x{9}) hwnd={10} helpText='{11}' patterns={12}" -f `
            ($c.ControlType.ProgrammaticName -replace '^ControlType\.', ''), $c.AutomationId, $n, $c.IsEnabled, $c.IsOffscreen, $c.IsKeyboardFocusable, `
            [int]$r.Left, [int]$r.Top, [int]$r.Width, [int]$r.Height, $c.NativeWindowHandle, (HelpTextOf $el), ($pats -join '+'))
    } catch { return "(the element could not be read: $($_.Exception.GetType().Name))" }
}
# The window Chromium renders into, which is where a keystroke aimed at the page has to be sent.
# Under the Tauri window it is a Chrome_WidgetWin host with a Chrome_RenderWidgetHostHWND inside
# it; the innermost is preferred because that is the one with the input handler on it.
function WebViewHwnd {
    $w = AppWindow
    if (-not $w) { return $NULLPTR }
    $wh = Hwnd $w
    if ($wh -eq $NULLPTR) { return $NULLPTR }
    foreach ($cls in @('Chrome_RenderWidgetHostHWND', 'Chrome_WidgetWin_1', 'Chrome_WidgetWin_0')) {
        $h = ChildByClass $wh $cls 4
        if ($h -ne $NULLPTR) { return $h }
    }
    return $NULLPTR
}
function ChildClassesDump($parent, $max) {
    $out = @(); $child = $NULLPTR
    while ($parent -ne $NULLPTR -and $out.Count -lt $max) {
        $child = [W32]::FindWindowExW($parent, $child, $null, $null)
        if ($child -eq $NULLPTR) { break }
        $out += ("{0}#{1}" -f (HwndClass $child), $child)
    }
    if ($out.Count -eq 0) { return '(no child windows)' }
    return ($out -join ' ')
}
# MSAA by name through IDispatch: IAccessible is a dual interface, so no vtable is redeclared.
function AccName($acc, $child) {
    if (-not $acc) { return '' }
    try { return [string]$acc.GetType().InvokeMember('accName', 'GetProperty', $null, $acc, @($child)) } catch { return '' }
}
function AccRole($acc, $child) {
    if (-not $acc) { return '' }
    try { return [string]$acc.GetType().InvokeMember('accRole', 'GetProperty', $null, $acc, @($child)) } catch { return '' }
}

# --- the canvas, through the page itself ------------------------------------------------------
#
# Everything above asks UI Automation. These ask the page, over the DevTools protocol, because the
# canvas is not in the accessibility tree to be asked about: see the note at the top of this file
# and the header of scripts/verify/cdp.mjs. Three rules hold for everything below.
#
#   * No double quote ever appears in an expression. PowerShell hands a native command its
#     arguments as a command line, and a double quote inside one is the one character that does not
#     survive that reliably. JavaScript has single quotes; these use them. The check is enforced
#     rather than remembered.
#   * A PowerShell variable interpolated into one of these strings is never followed by `?`. In a
#     double-quoted string `$beforeCount?c:0` is not "the variable, then a ternary": PowerShell
#     reads on past the `?` and the `:` and expands the whole of it to nothing, so
#     `return c>$beforeCount?c:0;` reaches the page as `return c>;`, the page answers with a
#     SyntaxError, and the harness reports "the step count did not move" about an expression that
#     was never valid. It cost an hour once. Interpolations here are followed by `;`, `)` or a
#     space, and the ternaries that are left have no variable in front of them.
#   * These functions return values and print nothing, for the reason given above Report: a
#     function that writes to the success stream cannot also hand a value back. What went wrong is
#     left in $script:cdpError for the caller to report.
$script:cdpError = ''
$script:cdpHelper = Join-Path $PSScriptRoot 'cdp.mjs'
# The port actually in use. It starts as the one that was asked for and only ever moves to one a
# DevToolsActivePort file names - see "can the page be asked anything at all" below.
$script:cdpPort = $CdpPort
$script:nodeExe = $null
try { $script:nodeExe = (Get-Command node -ErrorAction Stop).Source } catch { $script:nodeExe = $null }

function CdpRun($mode, $expression, $timeoutMs) {
    $script:cdpError = ''
    if (-not $script:nodeExe) {
        $script:cdpError = 'node is not on PATH, so the page cannot be asked anything'
        return $null
    }
    if ($expression -like '*"*') {
        $script:cdpError = "the expression contains a double quote, which does not survive the command line: $expression"
        return $null
    }
    $out = ''
    try {
        if ($mode -eq 'wait') {
            $out = & $script:nodeExe $script:cdpHelper '--port' "$script:cdpPort" 'wait' $expression '--timeout-ms' "$timeoutMs" '--interval-ms' '100'
        } else {
            $out = & $script:nodeExe $script:cdpHelper '--port' "$script:cdpPort" 'eval' $expression
        }
    } catch {
        $script:cdpError = "$($_.Exception.GetType().Name): $($_.Exception.Message)"
        return $null
    }
    $text = ($out -join '').Trim()
    if ($LASTEXITCODE -ne 0) {
        $script:cdpError = if ($text) { $text } else { "cdp.mjs exited $LASTEXITCODE with no output" }
        return $null
    }
    if ($text -eq '') { $script:cdpError = 'cdp.mjs printed nothing'; return $null }
    try { return (ConvertFrom-Json $text) } catch {
        $script:cdpError = "cdp.mjs printed something that is not JSON: $text"
        return $null
    }
}
# One evaluation. $null back means either the expression evaluated to null or it could not be
# evaluated at all, and $script:cdpError is what tells those apart - they are different answers.
function Cdp-Eval($expression) { return (CdpRun 'eval' $expression 0) }
# Polls until the expression is truthy. This is what replaces a fixed sleep: the condition itself
# is what is waited on, so a fast machine does not wait and a slow one is not cut off.
function Cdp-Wait($expression, $timeoutMs) { return (CdpRun 'wait' $expression $timeoutMs) }

# The store's own count of steps, read off the status bar. App.tsx renders it from `nodes.length`
# into the FIRST span of `footer.statusbar`; the spans after it are run counts and messages, so the
# first one is asked for by name rather than the bar being scraped whole. Immune to the culling
# that makes the DOM lie about how many nodes are mounted. -1 means the bar was not on screen.
$CDP_STEP_COUNT = "(()=>{const s=document.querySelector('footer.statusbar > span');if(!s)return -1;const m=s.innerText.match(/[0-9]+/);return m?Number(m[0]):-1;})()"
function CdpStepCount { return (Cdp-Eval $CDP_STEP_COUNT) }
# Every step React Flow currently has mounted, by the id the store gave it.
$CDP_CANVAS_IDS = "[...document.querySelectorAll('.react-flow__node[data-id]')].map(e=>e.getAttribute('data-id'))"
function CdpCanvasIds { return @(Cdp-Eval $CDP_CANVAS_IDS) }
# Fit View, so that a step placed outside the viewport is mounted again before it is looked for.
$CDP_FIT_VIEW = "(()=>{const b=document.querySelector('.react-flow__controls-fitview');if(!b)return false;b.click();return true;})()"
function CdpFitView { return (Cdp-Eval $CDP_FIT_VIEW) }
# The WHOLE graph, not the part of it that happens to be in view.
#
# This is the only way the canvas may be read, and the reason is a real wrong answer. Taking a
# before-set while two steps were culled and an after-set once Fit View had mounted them again
# made the set difference {write-3, write-4, json-5} and the harness named `write-3` as the step
# just placed - a step that had been on the canvas the whole time. Both sides of every comparison
# are read through here, so both are the same graph.
#
# What says Fit View has finished is not a delay: it is the DOM agreeing with the store about how
# many steps there are. The two disagree exactly while something is culled.
function CdpFittedCanvasIds {
    [void](CdpFitView)
    [void](Cdp-Wait "(()=>{const s=document.querySelector('footer.statusbar > span');if(!s)return false;const m=s.innerText.match(/[0-9]+/);const want=m?Number(m[0]):-1;const have=document.querySelectorAll('.react-flow__node[data-id]').length;return want>=0&&have===want;})()" 6000)
    return @(CdpCanvasIds)
}
function CdpInspectorText { return (Cdp-Eval "(document.querySelector('.panel--inspector')||{innerText:''}).innerText") }
# --- reaching a control the Inspector has scrolled off the bottom ------------------------------
#
# `PASS j4 the permission control armed once a folder was chosen -> enabled=True` and then
# `SKIP ... the control 'Allow this folder' is off screen, so it cannot be clicked`. The Inspector
# is a scrolling panel and the runner's window is shorter than this developer's, so Allow was below
# the fold. That is the harness's problem and not the product's: a panel that scrolls is correct,
# and a person would have scrolled to it.
#
# Scrolling is done through the page because that is the only place a scroll container exists; it
# is setup rather than the thing under test, and every assertion afterwards still goes through the
# interface. The control is named by a CSS expression rather than by its words wherever it can be -
# the folder row's Choose is the button beside the input whose id ends in `-folder`, the starting
# material's is the button beside the read-only input - so that a translation cannot pick the wrong
# one of two buttons both called "Choose".
$CDP_SCROLL_PRELUDE = "const p=document.querySelector('.panel--inspector');if(!p)return 'the Inspector panel is not on the page';"
$CDP_SCROLL_EPILOGUE = "if(!b)return 'not found';b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return 'at '+Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height)+' of a '+Math.round(document.documentElement.clientHeight)+'px window';"
$CDP_SCROLL_FOLDER_CHOOSE = "(()=>{$CDP_SCROLL_PRELUDE const i=[...p.querySelectorAll('input')].find(e=>(e.id||'').endsWith('-folder'));const b=i&&i.parentElement.querySelector('button');$CDP_SCROLL_EPILOGUE})()"
$CDP_SCROLL_ENTRY_CHOOSE = "(()=>{$CDP_SCROLL_PRELUDE const i=p.querySelector('input[readonly]');const b=i&&i.parentElement.querySelector('button');$CDP_SCROLL_EPILOGUE})()"
$CDP_SCROLL_ALLOW = "(()=>{$CDP_SCROLL_PRELUDE const b=[...p.querySelectorAll('button')].find(e=>/^(Permitir|Allow|Permitido|Allowed)/.test((e.innerText||'').trim()));$CDP_SCROLL_EPILOGUE})()"
# Run is in the toolbar rather than the Inspector, so it is named across the whole page.
$CDP_SCROLL_RUN = "(()=>{const b=[...document.querySelectorAll('button')].find(e=>/^(Ejecutar|Run)$/.test((e.innerText||'').trim()));if(!b)return 'not found';b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return 'at '+Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height);})()"
function ScrollInspectorTo($js, $what) {
    $where = Cdp-Eval $js
    Note "$what : scrolled it into view - $where$(if ($script:cdpError) { " ($script:cdpError)" })"
}
# A click that will not be thrown away. `Click` raises SKIP for an off-screen control, which is the
# right answer for a control nobody can reach - but a control that merely needs scrolling to is one
# the harness can reach, and a SKIP the harness could have avoided is a skip that is really a
# defect in the harness. So: scroll, wait for the element to say it is on screen, and only then
# press it. If it is still off screen after that, it FAILS with what the page said, and never SKIPs.
function ClickInspector($el, $js, $what) {
    if (-not $el) { throw "SKIP: $what is not on screen at all" }
    if (-not $el.Current.IsOffscreen) { Click $el; return }
    ScrollInspectorTo $js $what
    for ($i = 0; $i -lt 20; $i++) {
        if (-not $el.Current.IsOffscreen) { break }
        Start-Sleep -Milliseconds 100
    }
    # Failing that, the element's own scroll pattern - the accessibility layer's way of asking for
    # the same thing, which works on controls the CSS expression above did not name.
    if ($el.Current.IsOffscreen -and (HasPattern $el ([System.Windows.Automation.ScrollItemPattern]::Pattern))) {
        try {
            $el.GetCurrentPattern([System.Windows.Automation.ScrollItemPattern]::Pattern).ScrollIntoView()
            Note "$what : asked the element's own ScrollItem pattern to bring it into view"
        } catch { Note "$what : ScrollItemPattern.ScrollIntoView threw $($_.Exception.GetType().Name)" }
        for ($i = 0; $i -lt 20; $i++) {
            if (-not $el.Current.IsOffscreen) { break }
            Start-Sleep -Milliseconds 100
        }
    }
    if ($el.Current.IsOffscreen) {
        Report $false "$what can be brought on screen" "it is still off screen after scrolling: $(ElementFacts $el)"
        throw "SKIP: $what stayed off screen after the panel was scrolled to it, so it could not be pressed"
    }
    Click $el
}
# The assertion that the oracle is not reading the thing it is meant to be checking. The palette
# item carries the component reference in its own title, so an oracle that read the palette would
# report the reference back whether or not anything was placed - which is exactly the mistake this
# harness made once before (`FindText '(Parse JSON)'` matching the button that had just been
# pressed). Answers 'clean', or names what is wrong.
$CDP_ORACLE_IS_CLEAN = "(()=>{const p=document.querySelector('.panel--palette');if(!p)return 'the palette panel is not on screen at all';const roots={statusbar:document.querySelector('footer.statusbar > span'),inspector:document.querySelector('.panel--inspector'),canvas:document.querySelector('.react-flow')};for(const k of Object.keys(roots)){const r=roots[k];if(!r)continue;if(p.contains(r)||r.contains(p))return 'the palette and the '+k+' are the same region';if(r.querySelectorAll('.palette-item').length>0)return 'the '+k+' contains palette items';}return 'clean';})()"
function CdpOracleIsClean { return (Cdp-Eval $CDP_ORACLE_IS_CLEAN) }
# What id the store will give a step of this component. `makeId` (store.ts) takes the reference,
# drops the version, takes the last dotted segment and appends a counter - so a step of
# `encastra.data.json@1.0.0` is `json-1`, `json-2`, and a step of `encastra.file.save@1.0.0` is
# `save-1`. That is not decoration: it is what lets the canvas be asked whether the step that
# appeared is the step that was asked for, rather than merely a step.
function StepIdPattern($componentId) { return ('^' + (($componentId -split '\.')[-1]) + '-[0-9]+$') }
# The one place the canvas is asked "did exactly the step I asked for appear". Shared by PlaceStep
# and by the self test so that the two cannot drift, which is how the culled before-set got past a
# reviewer once already. Prints its line; the answer is in $script:freshStep.
#
# Three things, and all three are needed. One new id, because two would mean this cannot say which
# one was placed. The id matching the pattern the store derives from the reference that was
# activated, because "some step appeared" is not "this step appeared". And a real rectangle for its
# `#node-<id>`, because a node in the DOM with no box is not on the canvas in any sense a person
# would recognise.
$script:freshStep = $null
function ReportFreshStep($what, $beforeIds, $componentId) {
    $script:freshStep = $null
    $expected = StepIdPattern $componentId
    $afterIds = CdpFittedCanvasIds
    $fresh = @($afterIds | Where-Object { $beforeIds -notcontains $_ })
    $named = ($fresh.Count -eq 1 -and $fresh[0] -match $expected)
    $drawn = $false
    if ($named) {
        $drawn = ((Cdp-Wait "(()=>{for(const w of document.querySelectorAll('.react-flow__node[data-id]')){if(w.getAttribute('data-id')!=='$($fresh[0])')continue;const e=w.querySelector('[id^=node-]');if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}return false;})()" 6000) -eq $true)
    }
    if ($named -and $drawn) { $script:freshStep = $fresh[0] }
    Report ($named -and $drawn) "$what exactly one new step is on the canvas and it is a step of $componentId" ("new ids [" + ($fresh -join ', ') + "] against $expected, which is what makeId derives from the reference that was activated; drawn=$drawn; the whole graph after Fit View is [" + ($afterIds -join ', ') + "], and it was [" + ($beforeIds -join ', ') + "] before - both read after Fit View, so nothing that was merely culled can count as new")
}
# Whether the sidebar says this is the view we are on. `aria-current='page'` is the interface's own
# statement about that, which is a better thing to wait for than a fixed number of milliseconds.
function CdpOnView($jsPattern) {
    return (Cdp-Wait "(()=>{const i=[...document.querySelectorAll('.sidebar__item')].find(e=>new RegExp('$jsPattern').test(e.innerText.trim()));return i?i.getAttribute('aria-current')==='page':false;})()" 8000)
}

# Is the Inspector configuring a step of this component? `Inspector()` returns the empty panel
# unless `selectedNodeId` names a node that is really in `nodes` (Inspector.tsx:516), and when it
# does not it prints the component reference - `encastra.data.json@1.0.0` - into a `<dd>`. So a
# Text element carrying that reference is the store saying, in its own words, that `addNode`
# added a node and selected it. Restricted to Text on purpose: the palette item is a Button, and
# its reference lives in a `title` attribute, which Chromium publishes as HelpText and not as the
# name - but the restriction makes that impossible to get wrong rather than merely unlikely.
function InspectorShows($pattern) {
    if (-not $pattern) { return $null }
    try {
        foreach ($e in (Descendants (AppWindow))) {
            if ($e.Current.ControlType.ProgrammaticName -ne 'ControlType.Text') { continue }
            $n = $e.Current.Name
            if ($n -and $n -match $pattern) { return $n }
        }
    } catch { }
    return $null
}

# The three ways to activate a control, most ordinary first. Each writes a note saying what it did
# and what came back, so a run where none of them worked says which of them was even possible.
#
#   1. InvokePattern.Invoke - what a client normally does, and what this file has always done.
#   2. MSAA accDoDefaultAction - what LegacyIAccessiblePattern.DoDefaultAction calls underneath.
#      The element is found by hit-testing the accessibility layer at the item's own centre, which
#      also answers a question Invoke cannot: if the element sitting at those coordinates is not
#      the palette item, something is covering it and every click lands on that instead.
#   3. Focus, then a key press to the window Chromium renders into. A `<button>` activates on both
#      Enter and Space, so both are sent - to that one window handle, never to the desktop.
function RouteName($n) {
    switch ($n) {
        1 { return 'route 1 (InvokePattern.Invoke)' }
        2 { return 'route 2 (MSAA accDoDefaultAction, what LegacyIAccessible.DoDefaultAction calls)' }
        3 { return 'route 3 (SetFocus, then VK_RETURN and VK_SPACE to the WebView2 window)' }
    }
    return "route $n"
}
function ActivateRoute($item, $n, $what) {
    $tag = "$what $(RouteName $n)"
    if ($n -eq 1) {
        if (-not (HasPattern $item ([System.Windows.Automation.InvokePattern]::Pattern))) {
            Note "$tag : the element publishes no Invoke pattern, so there was nothing to invoke"
            return
        }
        try {
            $item.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
            Note "$tag : invoked, no error"
        } catch { Note "$tag : threw $($_.Exception.GetType().Name) - $($_.Exception.Message)" }
        return
    }
    if ($n -eq 2) {
        $cx = 0; $cy = 0
        try {
            $r = $item.Current.BoundingRectangle
            if ($r.Width -le 0 -or $r.Height -le 0) { Note "$tag : the element has no rectangle to hit-test"; return }
            $cx = [int]($r.Left + $r.Width / 2); $cy = [int]($r.Top + $r.Height / 2)
        } catch { Note "$tag : the element's rectangle could not be read ($($_.Exception.GetType().Name))"; return }
        $pt = New-Object 'W32+POINT'
        $pt.x = $cx; $pt.y = $cy
        $acc = $null; $child = $null; $hr = -1
        try { $hr = [W32]::AccessibleObjectFromPoint($pt, [ref]$acc, [ref]$child) } catch {
            Note "$tag : AccessibleObjectFromPoint threw $($_.Exception.GetType().Name)"
            return
        }
        if ($hr -ne 0 -or $null -eq $acc) { Note "$tag : AccessibleObjectFromPoint($cx,$cy) returned hr=$hr and no object"; return }
        Note "$tag : at the item's own centre ($cx,$cy) the accessibility layer says the element there is '$(AccName $acc $child)' role=$(AccRole $acc $child) - if that is not this palette item, something is covering it and a click lands on that instead"
        try {
            [void]$acc.GetType().InvokeMember('accDoDefaultAction', 'InvokeMethod', $null, $acc, @($child))
            Note "$tag : accDoDefaultAction returned without error"
        } catch { Note "$tag : accDoDefaultAction threw $($_.Exception.GetType().Name) - $($_.Exception.Message)" }
        return
    }
    try { $item.SetFocus(); Note "$tag : focus set on the element" }
    catch { Note "$tag : SetFocus threw $($_.Exception.GetType().Name) - $($_.Exception.Message)" }
    $wv = WebViewHwnd
    if ($wv -eq $NULLPTR) {
        $w = AppWindow
        Note "$tag : no Chromium window under the main window to send a key to; its child windows are: $(ChildClassesDump (Hwnd $w) 12)"
        return
    }
    Note "$tag : sending to $(HwndClass $wv)#$wv"
    foreach ($vk in @($VK_RETURN, $VK_SPACE)) {
        [void][W32]::PostMessageW($wv, $WM_KEYDOWN, [IntPtr]$vk, [IntPtr]1)
        Start-Sleep -Milliseconds 60
        [void][W32]::PostMessageW($wv, $WM_KEYUP, [IntPtr]$vk, [IntPtr]1)
        Start-Sleep -Milliseconds 500
    }
}

# Places a step from the palette and proves one arrived, which is not the same question as
# whether the palette item was clicked. Journey 2 used to ask the second and call it the first:
# `FindText '(Parse JSON)'` matches the palette button that was just pressed, so it would have
# said "a step is on the canvas" with an empty canvas.
#
# Asking the first question through UI Automation then failed in every run, and the negative was a
# measurement artefact rather than a product failure: Chromium publishes a div with no ARIA role as
# role `generic` with an empty name and no AutomationId, so an element whose AutomationId is
# `node-<id>` cannot exist in that tree at all. That is now established rather than suspected - a
# dump of the whole accessibility tree of the Builder references `node-*` nowhere - and it is why
# the oracle below asks the page instead. PlacedStepIds is kept, but only as the diagnostic it
# always was: what UI Automation can and cannot see about the canvas.
#
# Three things have to hold, and all three are asked of the store or of the page, never of the
# palette. The palette item is the ROUTE - the button that gets pressed - and the pass criterion is
# the oracle, so a route that works is not evidence and a route that does not is not a failure.
#
#   1. the store's own step count, off the status bar, is exactly one higher than before. This is
#      the culling-immune witness: React Flow unmounts nodes outside the viewport, so the DOM can
#      be honest and still not hold the node.
#   2. exactly one `.react-flow__node[data-id]` that was not there before, carrying the id the
#      store derives from the reference that was activated (`json-5` for `encastra.data.json`),
#      with a real rectangle for its inner `#node-<id>`. Fit View is clicked before BOTH readings,
#      because `addNode` places each step at `rightmost.x + 260` and React Flow unmounts what falls
#      outside the viewport: a before-set read while two steps were culled and an after-set read
#      once Fit View had brought them back differ by three ids, only one of which is new, and the
#      harness named the wrong one. See CdpFittedCanvasIds.
#   3. the Inspector is configuring what was placed - the component reference, in the panel, seen
#      twice over: by the page (`.panel--inspector` innerText) and by UI Automation (the Text
#      element InspectorShows finds). Two independent observers of one fact; a disagreement between
#      them is itself worth knowing.
#
#   $script:placedStep - the canvas id of the step, for the journeys that have to target it.
#   $script:stepPlaced - a step was placed: 1 and 2. Whether it is also SELECTED is 3, and journeys
#                        4 and 5 check that for themselves, because it is their precondition.
$script:placedStep = $null
$script:stepPlaced = $false
#
# $componentId is the reference without its version - `encastra.data.json` - and everything the
# oracle expects is derived from it: the id the store will make (`json-<n>`) and the reference the
# Inspector has to be showing (`encastra.data.json@<version>`). Derived rather than passed
# separately so that the two cannot be given a chance to disagree with each other.
function PlaceStep($palettePattern, $what, $componentId) {
    $script:placedStep = $null
    $script:stepPlaced = $false
    $refPattern = [regex]::Escape($componentId) + '@'

    # Before anything is claimed about the oracle, that the oracle is not reading the palette.
    $clean = CdpOracleIsClean
    Report ($clean -eq 'clean') "$what the oracle reads the store and the canvas, never the palette" "$clean$(if ($script:cdpError) { " ($script:cdpError)" })"

    $beforeCount = CdpStepCount
    $beforeIds = CdpFittedCanvasIds
    if ($null -eq $beforeCount -or $beforeCount -lt 0) {
        Report $false "$what the step count is readable before anything is placed" "the status bar answered '$beforeCount'$(if ($script:cdpError) { "; $script:cdpError" })"
        return
    }
    Note "$what before: the store says $beforeCount step(s) and the canvas has mounted [$($beforeIds -join ', ')]"

    $item = Wait 'Button' $palettePattern 20
    if (-not $item) {
        throw "SKIP: the palette item matching $palettePattern never appeared. $(PaletteDump 30). Ids on screen: $(AutomationIdDump 40)"
    }
    Note "$what the palette item, as UI Automation sees it before it is touched: $(ElementFacts $item)"
    Note "$what $(PaletteDump 30)"

    # Route 1 is what a client normally does. The other two are tried only if the count did not
    # move, and only so that a run where nothing worked says which routes were even possible.
    $grew = $null
    $used = ''
    $waitTrouble = ''
    foreach ($n in 1, 2, 3) {
        ActivateRoute $item $n $what
        $grew = Cdp-Wait "(()=>{const s=document.querySelector('footer.statusbar > span');if(!s)return 0;const m=s.innerText.match(/[0-9]+/);const c=m?Number(m[0]):0;if(c>$beforeCount){return c;}return 0;})()" 8000
        # Read out of $script:cdpError before anything else asks the page, because the next call
        # clears it. A wait that failed for a reason is a different finding from a wait that
        # honestly saw nothing, and the reason is gone by the end of the line otherwise.
        $waitTrouble = $script:cdpError
        if ($grew) { $used = (RouteName $n); break }
        Note "$what $(RouteName $n) did not change the store's step count$(if ($waitTrouble) { " - $waitTrouble" }) (it still reads $(CdpStepCount))"
        # React re-renders the palette on every store change, which can leave the element this
        # loop is holding stale; the next route is given a fresh one where there is one.
        $again = Find (AppWindow) 'Button' $palettePattern
        if ($again) { $item = $again }
    }
    $afterCount = CdpStepCount
    $counted = ($grew -and $afterCount -eq ($beforeCount + 1))
    Report $counted "$what the store's step count went up by exactly one" "$beforeCount -> $afterCount after $(if ($used) { $used } else { 'all three routes' })$(if ($waitTrouble) { "; the page said: $waitTrouble" })"
    if (-not $counted) {
        Report $false "$what a step is on the canvas" ("the palette item '$($item.Current.Name)' was activated by all three routes and the store never counted a step. The item now: " + (ElementFacts $item) + '. ' + (PaletteDump 30) + '; the interface is saying: ' + (AppNotices 4))
        return
    }

    ReportFreshStep $what $beforeIds $componentId
    if ($script:freshStep) {
        $script:placedStep = $script:freshStep
        $script:stepPlaced = $true
        Note "$what the canvas calls the step '$script:placedStep'; UI Automation publishes no node-* id for it, by construction: $(NodeIdDump)"
    }

    # And the Inspector, twice over. `addNode` selects what it placed (store.ts:355) and
    # Inspector.tsx renders the empty panel for anything else, so the reference in that panel is
    # the store saying what it added and that it is the step now being configured.
    #
    # It is also the cross-check on the id above: this pattern and the id pattern are both built
    # from $componentId, so a panel showing some other component's reference fails here even though
    # a step did appear on the canvas. "Something was placed" and "this was placed" are different
    # claims and the harness now has to make the second one twice.
    $wantsRef = "$refPattern[0-9][0-9.]*"
    $panelText = CdpInspectorText
    $seenByPage = ''
    if ($panelText -and ($panelText -match $wantsRef)) { $seenByPage = $Matches[0] }
    $seenByUia = InspectorShows $refPattern
    Report ($seenByPage -and $seenByUia) "$what the Inspector is configuring a step of $componentId, seen by the page and by UI Automation" "the page reads '$seenByPage' out of .panel--inspector and UI Automation reads '$(OneLine $seenByUia)'; wanted $wantsRef, the same reference the new id '$script:placedStep' was checked against; the panel currently says: $(OneLine $panelText)"
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
    # Waited on rather than slept through: the question is answered when the question is gone.
    for ($i = 0; $i -lt 24; $i++) {
        if (-not (Find (AppWindow) 'Button' '^(Descartar los cambios|Discard changes)$')) { break }
        Start-Sleep -Milliseconds 100
    }
}
# --- the first-run welcome -------------------------------------------------------------------
#
# onboarding/Welcome.tsx puts the first-run card on screen - `role="dialog" aria-modal="true"`,
# portalled into the body - until the preference `welcomeSeen` has been recorded. Chromium
# honours aria-modal the way the specification asks it to: while such a dialog holds focus,
# everything outside it is left out of the accessibility tree *entirely*. Not covered - absent.
# Every Wait in this file then times out and every dump prints four ids, one of them the card's
# own title, which is what `j4 ... ids on screen: RootWebArea(Document) root(Group)
# react-flow__aria-live-1(Group) welcome-title(Text)` was. The step that journey had just placed
# was on the canvas the whole time, behind it.
#
# And it comes back. Blink re-reads which modal is active on every focus change, and
# a11y/focus.ts deliberately hands focus back to whatever had it when an in-page dialog closes -
# so answering the unsaved-changes question can return focus to the welcome card and put the
# whole interface out of reach again in the middle of a journey. Working around it is therefore
# not enough; it has to be gone. This is called at the start and again after anything that
# closes an in-page dialog.
#
# Skip is the choice that changes nothing else. It runs `finish()`, which records welcomeSeen and
# hands the person back to the editor; the other two either start the seven-card tour or load a
# sample graph, and a journey asserting about a sample's steps would be asserting about somebody
# else's work. The button's accessible name is its title and its note run together - "Skip Go
# straight in..." / "Omitir Ve directo..." - so the pattern anchors on the title alone.
#
# And the Skip button cannot be pressed through UI Automation, which is the part that took a run
# to learn. Run 35064817460 dumped the whole tree while the card was up:
#
#   RootWebArea(Document) root(Group) welcome-title(Text)
#
# Three elements. The card's own buttons are not among them - Chromium leaves them out along with
# everything else - so `Wait 'Button' '^(Omitir|Skip)'` was waiting for something that was not
# there to be found, timed out, and the harness reported the welcome as immovable. It was not:
# something dismissed it later (by journey 4 it was gone), but the start-of-run check had already
# failed and three iterations ran with that FAIL against them.
#
# So the card is asked of, and dismissed through, the page - which is where it exists. That is a
# legitimate route because this is setup: it is not the thing under test, no journey asserts
# anything about the welcome, and every check that matters still goes through the interface.
# The Skip choice is taken by position rather than by its words - Welcome.tsx renders
# createFirst, then optionally the sample, then skip, so skip is the last `.welcome__choice` - with
# the localised title as a first preference, so that a reordering of the card is noticed rather
# than silently dismissing something else.
$WELCOME_PRESENT_JS = "!!document.querySelector('.welcome')"
$WELCOME_SKIP_JS = "(()=>{const w=document.querySelector('.welcome');if(!w)return 'gone';const all=[...w.querySelectorAll('button.welcome__choice')];if(all.length===0)return 'no choices';let b=all.find(e=>/^(Omitir|Skip)/.test((e.innerText||'').trim()));const how=b?'by its title':'as the last choice';if(!b)b=all[all.length-1];b.click();return 'clicked '+how+': '+(b.innerText||'').replace(/\s+/g,' ').slice(0,60);})()"
$WELCOME_DOM_JS = "(()=>{const w=document.querySelector('.welcome');if(!w)return 'no .welcome element on the page';return (w.innerText||'').replace(/\s+/g,' ').slice(0,300)+' || choices: '+[...w.querySelectorAll('button.welcome__choice')].map(e=>(e.innerText||'').replace(/\s+/g,' ').slice(0,30)).join(' / ');})()"
# Defensive: this is called from inside the failure dumps, and a page that goes away mid-dump must
# not turn a FAIL that was about to be printed into an exception about the printing of it. A CDP
# call that cannot be made answers "not showing" rather than throwing - the UI Automation reading
# is kept as a second opinion for exactly that case.
function WelcomeShowing {
    try {
        $onPage = Cdp-Eval $WELCOME_PRESENT_JS
        if ($onPage -eq $true) { return $true }
        if ($null -ne $onPage -and -not $script:cdpError) { return $false }
    } catch { }
    try { return ($null -ne (ById 'welcome-title')) } catch { return $false }
}
# Clicks Skip through the page and waits for the card to be gone - a condition, not a sleep.
# Returns nothing and reports nothing; the caller reads WelcomeShowing and decides what that means,
# because this runs outside any journey's try as well as inside one.
function DismissWelcome($what) {
    if (-not (WelcomeShowing)) { return }
    Note "$what : the first-run welcome is on screen; its buttons are not in the accessibility tree while it is, so Skip is pressed through the page"
    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        $did = Cdp-Eval $WELCOME_SKIP_JS
        if ($did) { Note "$what : $did" }
        # Wait on the card being gone from the page, not on a number of milliseconds.
        $gone = Cdp-Wait "!document.querySelector('.welcome')" 5000
        if ($gone -eq $true) { break }
    }
    if (WelcomeShowing) {
        Note "$what : the welcome is STILL on the page after 20s; it holds: $(Cdp-Eval $WELCOME_DOM_JS)"
    }
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
# Every descendant window of that class, not the first. A file dialog holds more than one combo
# box - one of them is the search box - and a search that stops at the first match is a search
# that can stop on the wrong control and then read a path back out of it quite correctly.
function ChildrenByClass($parent, $cls, $depth) {
    $out = @()
    if ($parent -eq $NULLPTR -or $depth -le 0) { return $out }
    $child = $NULLPTR
    while ($true) {
        $child = [W32]::FindWindowExW($parent, $child, $null, $null)
        if ($child -eq $NULLPTR) { break }
        if ((HwndClass $child) -eq $cls) { $out += $child }
        $deeper = @(ChildrenByClass $child $cls ($depth - 1))
        if ($deeper.Count -gt 0) { $out += $deeper }
    }
    return $out
}
# A control's label is not its window text - its window text is whatever it currently holds - so
# what a control is called is asked of UI Automation even when the control was found by handle.
function HwndUiaName($h) {
    if ($h -eq $NULLPTR) { return '' }
    try { $e = $A::FromHandle($h); if ($e) { return $e.Current.Name } } catch { }
    return ''
}

# What the box a path is typed into is called, in the two display languages these checks know.
# The dialog's language is the *Windows* display language, not the application's.
#
# A Save As dialog and a folder picker are not the same dialog and do not label that box the
# same way, so they are looked up separately rather than through one chain that happens to suit
# whichever was driven first.
$FILE_NAME_LABEL = '(?i)(file *name|nombre de archivo|nombre del archivo)'
$FOLDER_NAME_LABEL = '(?i)(folder|carpeta|file *name|nombre de archivo|nombre del archivo)'
# And what it is never, on either dialog. A file dialog also carries a search box; a path typed
# into a search box reads back out of it perfectly, runs a search, and saves nothing. That is
# `j2-save : the path is in the chooser -> '...journeys.encastra'` immediately above `j2 project
# saved to disk -> exists=False`: the read-back was honest about the text and silent about the
# control. Nothing matching this is accepted, whichever route found it.
$SEARCH_LABEL = '(?i)(search|buscar|find|filtro|filter)'
function LooksLikeSearch($name) {
    if (-not $name) { return $false }
    return (([string]$name) -match $SEARCH_LABEL)
}
# The file-name control's well-known ids. 1148 is the ComboBoxEx32 the Vista-style dialog wraps
# the edit in - the edit inside it is 1001 - and 1152 and 1090 belong to the older dialogs. The
# combo comes first because that is the shape a Save As dialog reliably has, and every route
# drills in with FindWindowExW rather than settling for the container it found.
$NAME_FIELD_IDS = @(1148, 1152, 1090, 1001)
# What was turned down, so a dialog where nothing was acceptable says why rather than "none
# found". Module scope for the reason given above Report: DlgNameField returns its answer, so it
# cannot also print, and the caller needs both.
$script:fieldRejected = @()
function NameFieldCandidate($hwnd, $combo, $element, $label, $wanted, $route) {
    return @{
        Hwnd    = $hwnd
        Combo   = $combo
        Element = $element
        Label   = $label
        # True when the dialog itself labels this control as its name box. A candidate that is
        # merely the only writable box left is still used - some builds label nothing - but the
        # difference is printed, because "we know this is the right control" and "nothing else
        # was on offer" are not the same claim.
        Trusted = ($label -and ($label -match $wanted))
        Route   = $route
    }
}
function DlgNameField($dlg, $kind) {
    if (-not $kind) { $kind = 'folder' }
    $wanted = if ($kind -eq 'file') { $FILE_NAME_LABEL } else { $FOLDER_NAME_LABEL }
    $script:fieldRejected = @()
    $dh = Hwnd $dlg
    $fallback = $null
    if ($dh -ne $NULLPTR) {
        foreach ($id in $NAME_FIELD_IDS) {
            $h = [W32]::GetDlgItem($dh, $id)
            if ($h -eq $NULLPTR) { continue }
            $cls = HwndClass $h
            $edit = $NULLPTR; $combo = $NULLPTR
            if ($cls -eq 'Edit') { $edit = $h } else {
                $inner = ChildByClass $h 'Edit' 3
                if ($inner -ne $NULLPTR) { $edit = $inner; $combo = $h }
            }
            if ($edit -ne $NULLPTR) {
                $label = HwndUiaName $edit
                if (LooksLikeSearch $label) { $script:fieldRejected += "GetDlgItem($id) $cls -> Edit '$label'"; continue }
                return (NameFieldCandidate $edit $combo $null $label $wanted "GetDlgItem($id) $cls -> Edit '$label'")
            }
            # That id exists but holds no edit. Keep it in case nothing better turns up - a combo
            # takes a WM_SETTEXT of its own - but keep looking rather than settling for it here.
            $label = HwndUiaName $h
            if (LooksLikeSearch $label) { $script:fieldRejected += "GetDlgItem($id) $cls '$label'"; continue }
            if (-not $fallback) { $fallback = NameFieldCandidate $h $NULLPTR $null $label $wanted "GetDlgItem($id) $cls '$label'" }
        }
        # The same control found by class instead of by id - every one of that class, and the one
        # the dialog labels as its name box preferred over one it does not label at all.
        foreach ($outer in @('ComboBoxEx32', 'ComboBox')) {
            $spare = $null
            foreach ($c in @(ChildrenByClass $dh $outer 4)) {
                $inner = ChildByClass $c 'Edit' 3
                if ($inner -eq $NULLPTR) { continue }
                $label = HwndUiaName $inner
                if (LooksLikeSearch $label) { $script:fieldRejected += "$outer -> Edit '$label'"; continue }
                $candidate = NameFieldCandidate $inner $c $null $label $wanted "$outer -> Edit '$label'"
                if ($candidate.Trusted) { return $candidate }
                if (-not $spare) { $spare = $candidate }
            }
            if ($spare) { return $spare }
        }
    }
    # UI Automation, anywhere below the dialog - descendants, never children. An Edit that owns no
    # window handle can still be written through its Value pattern.
    #
    # Every Edit is weighed rather than the first one taken. Taking the first is exactly how the
    # path went into the search box: on this dialog the search box comes before the name box in
    # the tree, so "the first Edit" was never the name box at all. Labelled as the name box beats
    # a real window handle, which beats merely being writable.
    $best = $null; $bestScore = -1
    foreach ($c in (Descendants $dlg)) {
        if ($c.Current.ControlType.ProgrammaticName -ne 'ControlType.Edit') { continue }
        $label = $c.Current.Name
        if (LooksLikeSearch $label) { $script:fieldRejected += "UIA descendant Edit '$label'"; continue }
        $handled = ($c.Current.NativeWindowHandle -ne 0)
        $writable = ((HasValuePattern $c) -and -not (IsReadOnly $c))
        if (-not $handled -and -not $writable) { continue }
        $score = 0
        if ($label -and $label -match $wanted) { $score += 4 }
        if ($handled) { $score += 2 }
        if ($writable) { $score += 1 }
        if ($score -gt $bestScore) {
            $bestScore = $score
            $route = "UIA descendant Edit '$label'"
            if (-not $handled) { $route += ' (value pattern, no window handle)' }
            $best = NameFieldCandidate $(if ($handled) { Hwnd $c } else { $NULLPTR }) $NULLPTR $c $label $wanted $route
        }
    }
    if ($best) { return $best }
    # A control that is not an Edit, that the dialog labels as its file-name box, and that owns a
    # real window handle. The Save As dialog on Windows Server 2025 came back as exactly that:
    #
    #   uia=[... Text'File name:'#0 Pane'File name:'#328292] child windows=[] edit windows=[]
    #
    # - a labelled Pane with a handle, no Edit anywhere, and the search box already named and
    # turned down above. A handle is a handle: WM_SETTEXT to it is how the shell's own controls are
    # written, and what it holds is read straight back before anything is confirmed, so a pane that
    # turns out not to be the name box reports itself instead of confirming on nothing.
    #
    # For a *file* dialog only. The folder pickers are driven by a label pattern that includes the
    # bare word "folder", which a folder dialog's own title and tree also carry, and those journeys
    # already reach their name box by id or by class; widening their search to any labelled pane
    # would be trading a route that works for one that might.
    if ($kind -eq 'file') {
        $labelled = $null; $labelledScore = -1
        foreach ($c in (Descendants $dlg)) {
            $label = $c.Current.Name
            if (-not $label -or $label -notmatch $wanted) { continue }
            if (LooksLikeSearch $label) { $script:fieldRejected += "UIA descendant '$label'"; continue }
            $h = [IntPtr]$c.Current.NativeWindowHandle
            if ($h -eq $NULLPTR) { continue }
            $cls = HwndClass $h
            $inner = ChildByClass $h 'Edit' 3
            # An Edit inside it is the control the text really belongs in; failing that, a combo
            # takes a WM_SETTEXT of its own and hands it to the edit it owns; failing that, the
            # window itself, which is still better than nothing and still read back afterwards.
            $s = 0
            if ($inner -ne $NULLPTR) { $s = 3 } elseif ($cls -eq 'Edit') { $s = 2 } elseif ($cls -like 'ComboBox*') { $s = 1 }
            if ($s -le $labelledScore) { continue }
            $labelledScore = $s
            $type = ($c.Current.ControlType.ProgrammaticName -replace '^ControlType\.', '')
            $route = "UIA descendant $type '$label' #$h class=$cls parent=#$([W32]::GetParent($h)) ctrlId=$([W32]::GetDlgCtrlID($h))"
            if ($inner -ne $NULLPTR) {
                $route += " -> Edit #$inner"
                $labelled = NameFieldCandidate $inner $h $null $label $wanted $route
            } else {
                # No Edit window under it, which is the modern Common Item Dialog hosting a
                # windowless edit inside its combo. WM_SETTEXT to the combo's own handle sets what
                # the combo displays and reads straight back out of it - which is why the read-back
                # passed on the runner while `j2 project saved to disk -> exists=False` followed -
                # but the dialog takes its file name from its own state, not from that window text.
                # So the element is carried along, and WriteNameField prefers its Value pattern,
                # which is the route that goes through the control rather than around it.
                $writable = ((HasValuePattern $c) -and -not (IsReadOnly $c))
                $route += if ($writable) { ' (no Edit window under it; written through its UIA Value pattern, falling back to its own handle)' } else { ' (written through its own handle; it holds no Edit window and publishes no writable Value pattern)' }
                $labelled = NameFieldCandidate $h $NULLPTR $(if ($writable) { $c } else { $null }) $label $wanted $route
            }
        }
        if ($labelled) { return $labelled }
    }
    # Last resort: any Edit window under the dialog that is not a search box, whatever else it
    # turns out to be. What it holds is read back before anything is confirmed, so a wrong guess
    # reports itself rather than confirming on nothing.
    if ($dh -ne $NULLPTR) {
        foreach ($any in @(ChildrenByClass $dh 'Edit' 5)) {
            $label = HwndUiaName $any
            if (LooksLikeSearch $label) { $script:fieldRejected += "Edit window '$label'"; continue }
            return (NameFieldCandidate $any $NULLPTR $null $label $wanted "first Edit window under the dialog that is not a search box ('$label')")
        }
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
    # The Value pattern first wherever the control publishes one. It goes through the control - the
    # dialog's own edit, windowless or not - where WM_SETTEXT to a container's handle only changes
    # what that window displays. Both are tried; the read-back below still decides.
    $wrote = $false
    if ($f.Element) {
        try {
            $f.Element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($path)
            $wrote = $true
        } catch { $wrote = $false }
    }
    if (-not $wrote -and $f.Hwnd -ne $NULLPTR) { [void][W32]::SendMessageW($f.Hwnd, $WM_SETTEXT, $NULLPTR, $path) }
    Start-Sleep -Milliseconds 350
    # And if the Value pattern took the string but the dialog did not, the handle is still there.
    if ((ReadNameField $f) -ne $path -and $f.Hwnd -ne $NULLPTR) {
        [void][W32]::SendMessageW($f.Hwnd, $WM_SETTEXT, $NULLPTR, $path)
        Start-Sleep -Milliseconds 350
    }
    # A ComboBoxEx32 hands its own WM_SETTEXT to the edit it owns; if writing the edit directly
    # did not take, the combo is the other documented way in.
    if ((ReadNameField $f) -ne $path -and $f.Combo -ne $NULLPTR) {
        [void][W32]::SendMessageW($f.Combo, $WM_SETTEXT, $NULLPTR, $path)
        Start-Sleep -Milliseconds 350
    }
    # And if the control that was found is a container rather than a box - the labelled Pane the
    # Save As dialog offers instead of an Edit - the box may be a combo inside it. Tried only after
    # the direct write did not take, and the read-back still decides whether anything is confirmed.
    if ((ReadNameField $f) -ne $path -and $f.Hwnd -ne $NULLPTR) {
        foreach ($cls in @('ComboBox', 'ComboBoxEx32', 'Edit')) {
            $inner = ChildByClass $f.Hwnd $cls 3
            if ($inner -eq $NULLPTR) { continue }
            [void][W32]::SendMessageW($inner, $WM_SETTEXT, $NULLPTR, $path)
            Start-Sleep -Milliseconds 350
            if ((HwndText $inner) -eq $path) {
                $f.Combo = $f.Hwnd
                $f.Hwnd = $inner
                # $f is the caller's own hashtable, so the read-back and the confirm that follow
                # are about this control; the route says so rather than naming the container.
                $f.Route = "$($f.Route) -> written through its $cls child #$inner"
                break
            }
        }
    }
}

# --- the file name a file dialog will actually use --------------------------------------------
#
# Every other control in this file is driven by a message to one specific window handle, and this
# is the one place that cannot work. The Common Item Dialog's file-name box is a DirectUI element
# with no window of its own, and run 35067019767 showed what the harness had been talking to
# instead - three iterations each, every one "passing":
#
#   Save As: Pane 'File name:' class=ComboBox ctrlId=0     - a DirectUI pane, not a dialog control
#   Open:    Pane 'File name:' class=Static  ctrlId=1090   - the LABEL that reads "File name:"
#
# WM_SETTEXT to either changes what that window displays. It changes nothing the dialog will read.
# So the Save As returned its own default instead - `pickProjectToSave` passes
# `defaultPath: '${suggested}.encastra'` with `suggested` = `projectName`, which starts as `''`
# (store.ts:1186), so the default name is the bare string `.encastra`; Rust's `Path::extension()`
# is None for a leading-dot name, `is_project_path` (lib.rs:581) says no, and the application
# refused it in words. That refusal is correct and is now asserted as a contract of its own. The
# Open dialog, whose `choose_file` passes no default at all (lib.rs:418), was confirmed with
# nothing selected and stayed on screen saying "No items match your search."
#
# The name is therefore typed, at the dialog, into whatever holds keyboard focus:
#
#   1. the dialog is raised and the harness waits until GetForegroundWindow() IS that dialog -
#      never a key sent at the desktop and hoping;
#   2. focus is put on the name box - the element's own SetFocus() where UI Automation offers it,
#      and Alt+N, the file-name accelerator both dialogs carry, where it does not;
#   3. whatever now has focus is asked what it is, and if it publishes a writable Value pattern the
#      path goes in through that - no keystrokes at all. Otherwise Ctrl+A and the path is typed as
#      Unicode scan codes, which arrive the same under any keyboard layout;
#   4. the read-back comes from the FOCUSED element, which is not the control the write chose. A
#      read-back from the control you wrote to cannot tell you that you wrote to the wrong one.
#
# This is the only global input in the file, and it is fenced: the run happens on a machine with
# nobody at the keyboard (that is why these journeys run on a runner at all), the dialog is
# verified to be foreground first, and nothing is confirmed unless the read-back matches.
$VK_MENU = 0x12; $VK_CONTROL = 0x11; $VK_N = 0x4E; $VK_A = 0x41
function FocusedElement {
    try { return [System.Windows.Automation.AutomationElement]::FocusedElement } catch { return $null }
}
# What is in a control, asked of the control rather than of its window text.
function ValueOfElement($el) {
    if (-not $el) { return '' }
    try { return $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value } catch { }
    try { return $el.Current.Name } catch { return '' }
}
# Returns its answer and therefore must not print: a function that writes to the success stream
# cannot also hand a value back - see above Report, and `j1 chooser closed on confirm -> dialogs
# left: 1` coming out PASS. What it wants said is left in $script:typeNotes for the caller.
$script:typeNotes = @()
function TypeIntoDialog($dlg, $field, $path, $what) {
    $script:typeNotes = @()
    $dh = Hwnd $dlg
    $how = 'typed into the dialog'
    # 1. The dialog in front, proven rather than assumed.
    [void][W32]::SetForegroundWindow($dh)
    $front = $false
    for ($i = 0; $i -lt 30; $i++) {
        if ([W32]::GetForegroundWindow() -eq $dh) { $front = $true; break }
        Start-Sleep -Milliseconds 100
        [void][W32]::SetForegroundWindow($dh)
    }
    if (-not $front) {
        $script:typeNotes += "$what : the chooser would not come to the foreground (it is #$dh, the foreground is #$([W32]::GetForegroundWindow())); nothing is typed at a window that is not in front"
        return @{ Read = ''; How = 'the dialog never came to the foreground, so nothing was typed' }
    }
    # 2. Focus on the name box.
    $focusedBy = ''
    if ($field.Element) {
        try { $field.Element.SetFocus(); $focusedBy = "the name box's own SetFocus()" } catch { $focusedBy = '' }
    }
    if (-not $focusedBy) {
        [void][W32]::KeyUnder($VK_MENU, $VK_N)
        Start-Sleep -Milliseconds 250
        $focusedBy = 'Alt+N, the file-name accelerator'
    }
    $focused = FocusedElement
    $facts = '(nothing reports keyboard focus)'
    if ($focused) {
        try {
            $facts = "$($focused.Current.ControlType.ProgrammaticName -replace '^ControlType\.', '') '$($focused.Current.Name)' class=$($focused.Current.ClassName) ctrlId=$([W32]::GetDlgCtrlID([IntPtr]$focused.Current.NativeWindowHandle))"
        } catch { $facts = '(the focused element could not be read)' }
    }
    $script:typeNotes += "$what : focus put on the name box by $focusedBy; what has keyboard focus now is $facts"
    # 3. Through the control where it offers a way in, by keystroke where it does not.
    $wroteByValue = $false
    if ($focused -and (HasValuePattern $focused) -and -not (IsReadOnly $focused)) {
        try {
            $focused.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($path)
            $wroteByValue = $true
            $how = "the focused element's Value pattern, after $focusedBy"
        } catch { $wroteByValue = $false }
    }
    if (-not $wroteByValue) {
        [void][W32]::KeyUnder($VK_CONTROL, $VK_A)
        Start-Sleep -Milliseconds 120
        $sent = [W32]::TypeText($path)
        $how = "$sent keystrokes typed as Unicode into whatever had focus, after $focusedBy"
    }
    Start-Sleep -Milliseconds 350
    # 4. Read back from the focused element - somewhere the write did not choose.
    $again = FocusedElement
    $read = ValueOfElement $again
    if (-not $read) { $read = ValueOfElement $focused }
    # And if the focused element says nothing useful, anything under the dialog now holding the
    # whole path counts - still not the control the write picked out.
    if (([string]$read).Trim().Trim('"') -ne $path) {
        foreach ($c in (Descendants $dlg)) {
            $v = ''
            try { $v = $c.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value } catch { continue }
            if ($v -and $v.Trim().Trim('"') -eq $path -and -not (LooksLikeSearch $c.Current.Name)) {
                $read = $v
                $how = "$how; read back from the dialog's $($c.Current.ControlType.ProgrammaticName -replace '^ControlType\.', '') '$($c.Current.Name)'"
                break
            }
        }
    } else {
        $how = "$how; read back from the element that has keyboard focus"
    }
    return @{ Read = $read; How = $how }
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
    $dh = Hwnd $dlg
    $parts = @()
    # Every element the accessibility tree hangs under the dialog, and for the ones that own a
    # window, who their parent really is. `uia=[... Pane'File name:'#328292] child windows=[]` is a
    # contradiction - a window with a handle that the enumeration starting at the dialog cannot
    # reach - and only the parent chain says which half is wrong: either the pane is not under this
    # handle at all (the shell hosts its file dialog somewhere else and UI Automation stitches the
    # two together), or it is and the enumeration below is being asked the wrong question.
    $handles = @()
    try {
        foreach ($c in (Descendants $dlg)) {
            if ($parts.Count -ge 24) { break }
            $n = $c.Current.Name
            if (-not $n) { $n = '' }
            if ($n.Length -gt 24) { $n = $n.Substring(0, 24) }
            $parts += ("{0}'{1}'#{2}" -f ($c.Current.ControlType.ProgrammaticName -replace '^ControlType\.', ''), $n, $c.Current.NativeWindowHandle)
            $h = [IntPtr]$c.Current.NativeWindowHandle
            if ($h -ne $NULLPTR -and $handles.Count -lt 10) {
                $handles += ("#{0} {1} parent=#{2} ctrlId={3} underThisDialog={4}" -f $h, (HwndClass $h), [W32]::GetParent($h), [W32]::GetDlgCtrlID($h), ([W32]::GetParent($h) -eq $dh))
            }
        }
    } catch { $parts += "(the dialog tree could not be read: $($_.Exception.GetType().Name))" }
    $classes = @(); $child = $NULLPTR
    while ($dh -ne $NULLPTR -and $classes.Count -lt 12) {
        $child = [W32]::FindWindowExW($dh, $child, $null, $null)
        if ($child -eq $NULLPTR) { break }
        $classes += (HwndClass $child)
    }
    # Every Edit anywhere under the dialog, with what the dialog calls it. The name is the whole
    # question when a path has to go into one of them and not into another: "the dialog holds an
    # Edit" was true of the run that typed a path into the search box.
    $edits = @()
    foreach ($e in @(ChildrenByClass $dh 'Edit' 5)) {
        if ($edits.Count -ge 8) { break }
        $edits += ("#{0}'{1}'" -f $e, (HwndUiaName $e))
    }
    # The four control ids a common dialog gives its name box, asked directly. This is the route
    # that does not depend on enumerating anything, so when the enumeration comes back empty this
    # is what says whether the controls are there under ids or are not there at all.
    $probe = @()
    foreach ($id in $NAME_FIELD_IDS) {
        $h = if ($dh -eq $NULLPTR) { $NULLPTR } else { [W32]::GetDlgItem($dh, $id) }
        if ($h -eq $NULLPTR) { $probe += "$id=none" }
        else { $probe += ("{0}=#{1} {2} '{3}'" -f $id, $h, (HwndClass $h), (HwndUiaName $h)) }
    }
    return ('dialog=#' + $dh + ' ' + (HwndClass $dh) + ' uia=[' + ($parts -join ' ') + '] child windows=[' + ($classes -join ',') + '] edit windows=[' + ($edits -join ' ') + '] GetDlgItem=[' + ($probe -join ' ') + '] windowed uia elements=[' + ($handles -join ' | ') + ']')
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
function ConfirmChooser($dlg, $path, $what, $kind) {
    $script:chooserClosed = $false
    $script:chooserConfirmed = $false
    if (-not $dlg) { Report $false "$what : a chooser was on screen to drive" 'none'; return }
    $field = DlgNameField $dlg $kind
    $turnedDown = ''
    if (@($script:fieldRejected).Count -gt 0) { $turnedDown = '; turned down as search boxes: ' + ($script:fieldRejected -join ', ') }
    if (-not $field) {
        Report $false "$what : chooser name field found" "no id, class or accessibility route found one$turnedDown; the dialog holds: $(DialogShape $dlg)"
        ForceCloseDialogs
        return
    }
    $named = if ($field.Trusted) { "the control the dialog labels as its name box" } else { "not labelled as a name box; nothing better was on this dialog" }
    Report $true "$what : chooser name field found" "via $($field.Route) - $named$turnedDown"
    # A file dialog is typed into; a folder picker is written by handle, which works and is left
    # alone. Why they differ is in "the file name a file dialog will actually use" above TypeIntoDialog.
    $landed = ''
    $route = $field.Route
    if ($kind -eq 'file') {
        $typed = TypeIntoDialog $dlg $field $path $what
        foreach ($n in $script:typeNotes) { Note $n }
        $landed = ([string]$typed.Read).Trim().Trim('"')
        $route = $typed.How
    } else {
        WriteNameField $field $path
        $landed = (ReadNameField $field).Trim().Trim('"')
    }
    # `-ne` between strings is case-insensitive here, which is right for a path; the trims are for
    # a shell that quotes what it holds. Anything else and the confirm is not pressed at all.
    #
    # Which control, as well as what is in it. That distinction is the whole of run 35067019767:
    # the old read-back read the same control it had just written to, so writing a path into a
    # Static label and reading it straight back out of that label passed perfectly, three times an
    # iteration, while the dialog's own file-name buffer still held what it started with. A
    # read-back is only evidence if it comes from somewhere the write did not choose - which for a
    # file dialog is now the element that has keyboard focus, whatever that turns out to be.
    $inSearch = LooksLikeSearch $field.Label
    if ($landed -ne $path -or $inSearch) {
        Report $false "$what : the path is in the chooser's name box before it is confirmed" "the name box holds '$landed', wanted '$path' (route: $route)$(if ($inSearch) { ' - and that control is a search box' }) - not confirming on that. The dialog holds: $(DialogShape $dlg)"
        ForceCloseDialogs
        return
    }
    Report $true "$what : the path is in the chooser's name box before it is confirmed" "'$landed' read back through $route"
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

# --- can the page be asked anything at all ----------------------------------------------------
#
# A harness precondition, not a journey. The canvas oracle is the whole point of this run, and
# without the DevTools protocol there is no oracle - so this is reported as a FAIL and the run
# stops. It is never a SKIP: a skip that exits 0 is a pass wearing a hat, and a skip on the one
# check the rest of the file rests on would be worse than that.
#
# Waited on rather than asked once. A run on a hosted runner (35058615026) said exactly this and
# nothing else:
#
#   PASS  installed application launches and stays up  -> pid 5080 title='Encastra'
#   FAIL  CDP reachable  -> no CDP endpoint on 127.0.0.1:9222 (fetch failed)
#
# with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS in that step's environment and an application that was
# up with a window of its own. One attempt cannot tell "the port never opened" from "the port
# opened a second after we looked", and the log left nobody a way to find out on a machine nobody
# can watch. So: poll for a minute and a half, say how long it took, and when nothing ever answers
# print what this machine's WebView2 actually is - whether anything is listening, whether the flag
# reached the browser process's own command line, which runtime is installed - BEFORE the verdict,
# in the order somebody reads it.
$CDP_WAIT_SECONDS = 90
function WaitForCdp($seconds) {
    $script:cdpWaitedMs = 0
    $started = Get-Date
    if (-not $script:nodeExe) {
        $script:cdpError = 'node is not on PATH, so the page cannot be asked anything'
        return $null
    }
    $deadline = $started.AddSeconds($seconds)
    while ($true) {
        $title = Cdp-Eval 'document.title'
        # An empty document.title is still an answer. $script:cdpError is what says whether the
        # page was reached, and it is the only thing that does.
        if (-not $script:cdpError) {
            $script:cdpWaitedMs = [int]((Get-Date) - $started).TotalMilliseconds
            return $title
        }
        if ((Get-Date) -ge $deadline) { break }
        Start-Sleep -Milliseconds 1000
    }
    $script:cdpWaitedMs = [int]((Get-Date) - $started).TotalMilliseconds
    return $null
}
# What this machine's WebView2 looks like, from the same script the workflow and install_check run,
# so all three say the same things in the same words.
function WebView2State($port) {
    $probe = Join-Path $PSScriptRoot 'webview2_state.ps1'
    if (-not (Test-Path $probe)) { return @('webview2: scripts/verify/webview2_state.ps1 is not next to this file, so nothing can be said about the WebView2') }
    try { return @(& $probe -Port $port) } catch { return @("webview2: the probe threw $($_.Exception.GetType().Name)") }
}
# Chromium writes the port it really bound into DevToolsActivePort, which is the answer when a
# fixed port was refused and a random one taken instead. Edge WebView2 153.0.4234.32 writes no such
# file - checked against a running application with the port open and listening, and against the
# whole of LOCALAPPDATA - so this is expected to find nothing here, and is kept for the runtime
# that does write one. One level of user-data directories, never a walk of LOCALAPPDATA: that takes
# minutes, and this runs on a failure path.
function DevToolsPortFromDisk {
    try {
        foreach ($dir in @(Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA '*\EBWebView') -Directory -ErrorAction SilentlyContinue)) {
            foreach ($candidate in @((Join-Path $dir.FullName 'DevToolsActivePort'), (Join-Path $dir.FullName 'Default\DevToolsActivePort'))) {
                if (-not (Test-Path $candidate)) { continue }
                $first = Get-Content $candidate -TotalCount 1 -ErrorAction SilentlyContinue
                $port = 0
                if ([int]::TryParse(([string]$first).Trim(), [ref]$port) -and $port -gt 0) { return $port }
            }
        }
    } catch { }
    return 0
}

$cdpTitle = WaitForCdp $CDP_WAIT_SECONDS
$cdpOk = -not $script:cdpError
if (-not $cdpOk) {
    $firstTrouble = $script:cdpError
    $waitedFirst = $script:cdpWaitedMs
    foreach ($line in (WebView2State $script:cdpPort)) { Note $line }
    $onDisk = DevToolsPortFromDisk
    if ($onDisk -gt 0 -and $onDisk -ne $script:cdpPort) {
        Note "CDP reachable : a DevToolsActivePort file names port $onDisk rather than the $($script:cdpPort) that was asked for, so the browser bound somewhere else; trying that instead"
        $script:cdpPort = $onDisk
        $cdpTitle = WaitForCdp 15
        $cdpOk = -not $script:cdpError
    }
    # The first failure is the one that describes the run, not whatever the fallback said last.
    if (-not $cdpOk) { $script:cdpError = $firstTrouble; $script:cdpWaitedMs = $waitedFirst }
}
Report $cdpOk 'CDP reachable' $(if ($cdpOk) { "node $($script:nodeExe) is talking to the page titled '$cdpTitle' on 127.0.0.1:$($script:cdpPort), after $($script:cdpWaitedMs) ms of waiting" } else { "nothing answered on 127.0.0.1:$($script:cdpPort) in $($script:cdpWaitedMs) ms of polling; last: $script:cdpError. The application has to be started with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=$($script:cdpPort) - the webview2 notes above this line say whether that flag reached the browser process - and node has to be on PATH (found: $(if ($script:nodeExe) { $script:nodeExe } else { 'nothing' }))" })
if (-not $cdpOk) {
    "SUMMARY  passed=$script:passed failed=$script:failed skipped=$script:skipped  repeat=$Repeat  (the page could not be reached, so the canvas cannot be observed)"
    EndRun 1
}

# --- the CDP half of this file, on its own -----------------------------------------------------
#
# -SelfTest exercises the parts that talk to the page and nothing else: no UI Automation, no native
# dialog, no window raised. It is therefore safe on a desktop somebody is using, which is where the
# rest of this file is not. It places one step by clicking the palette item in the DOM - the route
# does not matter here, the oracle does - and reports what the oracle saw. It leaves that step on
# whatever project is open.
function RunSelfTest {
    '--- self test: the page, the canvas oracle, and nothing native ---'
    # The application opens on Home, which is not a fault - so this is one check about where we end
    # up, not a failure for not already being there followed by a pass for arriving.
    $already = (CdpOnView '^(Constructor|Builder)$') -eq $true
    $clicked = $false
    if (-not $already) {
        $clicked = (Cdp-Eval "(()=>{const i=[...document.querySelectorAll('.sidebar__item')].find(e=>/Constructor|Builder/.test(e.innerText));if(!i)return false;i.click();return true;})()") -eq $true
    }
    $wentTo = $already -or ((CdpOnView '^(Constructor|Builder)$') -eq $true)
    Report $wentTo 'self test: the Builder is the view on screen' "$(if ($already) { 'it already was' } elseif ($wentTo) { 'the sidebar item was clicked and now carries aria-current=page' } else { "the sidebar item was clicked=$clicked and it still does not carry aria-current=page: $script:cdpError" })"
    if (-not $wentTo) { return }

    $clean = CdpOracleIsClean
    Report ($clean -eq 'clean') 'self test: the oracle reads the store and the canvas, never the palette' "$clean"

    # Whatever the palette is offering first, taken from the page rather than assumed, so this runs
    # against any build. The reference without its version is what everything downstream expects:
    # the id the store will make and the reference the Inspector has to show.
    $componentId = Cdp-Eval "(()=>{const b=document.querySelector('.palette-item');if(!b)return '';return (b.title||'').split('@')[0];})()"
    Report ([bool]$componentId) 'self test: the palette is offering a component to place' "'$componentId'"
    if (-not $componentId) { return }

    $beforeCount = CdpStepCount
    # Read after Fit View, exactly as PlaceStep does, so a culled step cannot turn up in the set
    # difference later and be reported as the one just placed.
    $beforeIds = CdpFittedCanvasIds
    $ref = Cdp-Eval "(()=>{const b=document.querySelector('.palette-item');if(!b)return '';b.click();return b.title.split(String.fromCharCode(10))[0];})()"
    Report ([bool]$ref) 'self test: a palette item was activated in the page' "'$ref' (this is the route, not the oracle)"
    if (-not $ref) { return }

    $grew = Cdp-Wait "(()=>{const s=document.querySelector('footer.statusbar > span');if(!s)return 0;const m=s.innerText.match(/[0-9]+/);const c=m?Number(m[0]):0;if(c>$beforeCount){return c;}return 0;})()" 8000
    # The page's own complaint is read out before anything else asks the page anything: the next
    # call clears it.
    $waitTrouble = $script:cdpError
    Report ($grew -eq ($beforeCount + 1)) 'self test: the store step count went up by exactly one' "the wait answered '$grew'$(if ($waitTrouble) { "; the page said: $waitTrouble" }); the bar went $beforeCount -> $(CdpStepCount)"

    # The same function PlaceStep uses, not a copy of it. A copy is how the culled before-set
    # survived being reviewed: it was fixed in one place and left standing in the other.
    ReportFreshStep 'self test:' $beforeIds $componentId

    $wantsRef = [regex]::Escape($componentId) + '@[0-9][0-9.]*'
    $panelText = CdpInspectorText
    $seen = ''
    if ($panelText -and ($panelText -match $wantsRef)) { $seen = $Matches[0] }
    Report ([bool]$seen) "self test: the Inspector is configuring a step of $componentId" "the panel reads '$seen'; wanted $wantsRef, the same reference the new id '$script:freshStep' was checked against. The panel currently says: $(OneLine $panelText)"
}
if ($SelfTest) {
    RunSelfTest
    "SUMMARY  passed=$script:passed failed=$script:failed skipped=$script:skipped  repeat=1  (self test: CDP only, no UI Automation)"
    if ($script:failed -gt 0) { EndRun 1 }
    if ($script:skipped -gt 0) { EndRun 2 }
    EndRun 0
}

# --- somewhere to work ------------------------------------------------------------------------
#
# One of these per iteration, so that a second run of the suite cannot be reading the first run's
# folders or importing the first run's publication and calling it evidence.
#
# Not under TEMP. A hosted runner hands the process `C:\Users\RUNNER~1\AppData\Local\Temp` - the
# 8.3 short form - and every path the application gives back has been canonicalised, so the two
# never match as strings. USERPROFILE has no short form to expand, and LongPath expands it anyway
# if some other machine disagrees. SamePath is still what the journeys compare with; this only
# stops the log being full of two spellings of the same folder.
function NewSandbox($tag) {
    $stamp = (Get-Date -Format 'yyyyMMdd-HHmmss') + $tag
    $script:sandbox = Join-Path (Join-Path (LongPath $env:USERPROFILE) 'encastra-journeys') $stamp
    $script:projectsLocation = Join-Path $script:sandbox 'projects-location'
    $script:publishInto = Join-Path $script:sandbox 'publish-into'
    $script:grantFolder = Join-Path $script:sandbox 'grant-to-component'
    $script:inputFolder = Join-Path $script:sandbox 'run-input'
    $script:junctionTarget = Join-Path $script:sandbox 'junction-target'
    $script:junction = Join-Path $script:sandbox 'junction-link'
    $script:missing = Join-Path $script:sandbox 'this-folder-does-not-exist'
    foreach ($d in @($script:sandbox, $script:projectsLocation, $script:publishInto, $script:grantFolder, $script:inputFolder, $script:junctionTarget)) {
        New-Item -ItemType Directory -Force -Path $d | Out-Null
    }
    $script:inputFile = Join-Path $script:inputFolder 'evidence.txt'
    Set-Content -Path $script:inputFile -Value 'evidence for the run-input journey' -Encoding ASCII
    $script:projectFile = Join-Path $script:sandbox 'journeys.encastra'
    "sandbox $script:sandbox"
    # Said out loud because everything the journeys compare rests on it: if a `~` survived here,
    # the harness and the application would be spelling the same folder two ways.
    Report (-not ($script:sandbox -like '*~*')) 'the sandbox path carries no 8.3 short name' "$script:sandbox"

    $script:junctionMade = $false
    try {
        cmd /c mklink /J "$script:junction" "$script:junctionTarget" | Out-Null
        $script:junctionMade = Test-Path $script:junction
    } catch { $script:junctionMade = $false }
}

# --- the state every iteration starts from -----------------------------------------------------
#
# The second iteration is the one that finds what the first one left: a project with a path, so
# Save would not ask for one, and a canvas with journey 4's step still on it. The interface's own
# New is what clears that - the same route journey 4 already uses, with the same discard question
# answered the same way - and the store's own step count is what says it worked.
function ResetProject($what) {
    EnsureNoDialogs $what
    DismissWelcome $what
    [void](GoTo '^(Constructor|Builder)$' 'Builder')
    $new = Wait 'Button' '^(Nuevo|New)$' 10
    if ($new) { Click $new }
    DismissDiscardPrompt
    DismissWelcome "$what after the unsaved-changes question"
    $empty = Cdp-Wait "(()=>{const s=document.querySelector('footer.statusbar > span');if(!s)return false;const m=s.innerText.match(/[0-9]+/);return m&&Number(m[0])===0;})()" 10000
    Report ($empty -eq $true) "$what the canvas is empty before the journeys start" "the store says $(CdpStepCount) step(s)"
}

function HarnessStart {
    # A chooser left open by an earlier attempt would block everything below - it is modal to the
    # application, so every button underneath it reads as disabled.
    EnsureNoDialogs 'harness start'

    $win = AppWindow
    Report ($null -ne $win) 'main window found' "$($win.Current.Name) class=$($win.Current.ClassName)"
    if ($win) { [void][W32]::SetForegroundWindow((Hwnd $win)) }

    # Before anything is looked for, because while the first-run welcome has focus there is nothing
    # to look for: an aria-modal dialog takes the rest of the document out of the accessibility
    # tree. On a machine where the application has never been opened by hand - a hosted runner,
    # every time - this is what is on screen at start-up.
    DismissWelcome 'harness start'
    $welcomeCleared = -not (WelcomeShowing)
    Report $welcomeCleared 'the first-run welcome is not standing in front of the interface' $(if ($welcomeCleared) { 'neither the page nor UI Automation can find it' } else { 'still on the page after Skip was pressed and waited on for 20s. The card holds: ' + (Cdp-Eval $WELCOME_DOM_JS) + '. Ids in the accessibility tree: ' + (AutomationIdDump 20) })

    $sidebarSettings = Wait 'Button' '^(Ajustes|Settings)$' 30
    Report ($null -ne $sidebarSettings) 'sidebar exposed to UI Automation' "settings item: '$($sidebarSettings.Current.Name)'"
    if (-not $sidebarSettings) {
        "SUMMARY  passed=$script:passed failed=$script:failed skipped=$script:skipped  repeat=$Repeat  (harness could not reach the interface)"
        EndRun 1
    }
}

function GoTo($pattern, $what) {
    $item = Wait 'Button' $pattern 15
    if (-not $item) { Report $false "navigate to $what" 'sidebar item not found'; return $false }
    Click $item
    # The interface's own statement that this is the view we are on - the sidebar item carries
    # aria-current='page' - rather than a fixed 900ms and a hope. The navigation patterns in this
    # file are alternations of two plain words, which is a regular expression JavaScript reads the
    # same way PowerShell does.
    [void](CdpOnView $pattern)
    return $true
}

# =============================================================================================
# JOURNEY 1 - projects-location (views/Settings.tsx:293)
#
# First on purpose. This is the one purpose that has been driven before, and it gates nothing:
# if it fails, the harness is broken rather than the feature.
# =============================================================================================
function Journey1 {
    "--- journey 1: projects-location (Settings -> Projects -> Browse) ---"
    try {
        EnsureNoDialogs 'j1 before'
        DismissWelcome 'j1 before'
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
        ConfirmChooser $dlg $projectsLocation 'j1' 'folder'
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
            ConfirmChooser $dlg $junction 'j1-junction' 'folder'
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
}

# =============================================================================================
# JOURNEY 2 - publish-into (panels/Publish.tsx:108)
#
# The panel refuses to arm Prepare until there is a saved project that matches the canvas
# (`ready` in Publish.tsx: projectPath, not dirty, no draft problems, no blocking findings), so
# the journey has to build and save one first. One Parse JSON step: it asks for no capability,
# so the review has nothing blocking to say and the chooser is what is under test.
# =============================================================================================
function Journey2 {
    "--- journey 2: publish-into (Builder -> Publish -> Prepare) ---"
    # Set here and read by journey 3: the two are separate functions now, so it has to be
    # script scope or journey 3 would be reading its own empty local.
    $script:preparedFolder = $null
    try {
        EnsureNoDialogs 'j2 before'
        DismissWelcome 'j2 before'
        [void](GoTo '^(Constructor|Builder)$' 'Builder')
        # `FindText '(Parse JSON)'` used to stand here, and it matched the palette button that had
        # just been pressed - so it would have reported "a step is on the canvas" with an empty
        # canvas. What is asked instead is the store's own count and the canvas's own node, neither
        # of which the palette can answer for. Not fatal to this journey if the step does not
        # arrive: what journey 2 exists for is downstream, and the save is what gates that.
        PlaceStep '(Parse JSON|encastra\.data\.json)' 'j2' 'encastra.data.json'

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

        # Negative, and a contract in its own right: a name that is not a project's is refused, in
        # the reader's own language, and nothing is written. `is_project_path` (lib.rs:581) asks
        # `Path::extension()` for `encastra`, and the editor never gets to decide otherwise. This
        # probe exists because run 35067019767 provoked the refusal by accident - the harness was
        # writing into a label rather than the dialog's file-name buffer, so the Save As returned
        # its own default (`.encastra`, which Rust reads as a name with no extension at all) and
        # the application said so. What was an accident is now asked for on purpose.
        $notAProject = Join-Path $script:sandbox 'journeys.txt'
        ConfirmChooser $dlg $notAProject 'j2-refusal' 'file'
        if (-not $script:chooserConfirmed) {
            Skip 'j2 a name that is not a project is refused, in words' 'the chooser could not be driven, so the name was never offered to it'
            ForceCloseDialogs
        } else {
            $refusal = FindText '(no es un proyecto de Encastra|not an Encastra project|termina en \.encastra|ends in \.encastra)' 10
            $wroteAnyway = Test-Path $notAProject
            Report ($null -ne $refusal -and -not $wroteAnyway) 'j2 a name that is not a project is refused, in words' "the application says '$refusal'; $notAProject exists=$wroteAnyway"
        }

        # And now the real one, with a name the runtime will accept.
        $save = WaitEnabled 'Button' '^(Guardar|Save)$' 10
        Click (MustFind $save 'the Save button did not come back after the refused name')
        $dlg = WaitDialog 12
        if (-not $dlg) { throw 'SKIP: the save chooser did not reappear after the refused name, so nothing downstream of a saved project can be driven' }
        ConfirmChooser $dlg $projectFile 'j2-save' 'file'
        ReportChooserClosed 'j2-save'
        # Two different questions, asked in the order that tells them apart.
        #
        # First what the application believes. `saveProject` (store.ts:758) takes the path FROM the
        # chooser - `await ipc.pickProjectToSave(...)` - and only then awaits `ipc.saveProject(path,
        # ...)`, so the file is written after the dialog has already gone; and on success it sets
        # `projectPath`, `projectName` and `dirty: false`. App.tsx renders that as `.project-name`
        # with a `.project-name__dirty` bullet while the project is dirty. So the page can be asked
        # whether the store thinks it saved, and under what name, without touching the disk.
        #
        # Then whether the bytes are there, polled rather than read once: `Test-Path` the instant
        # the dialog closes was asking before the write had been awaited.
        $appSaved = Cdp-Wait "(()=>{const n=document.querySelector('.project-name');if(!n)return '';if(n.querySelector('.project-name__dirty'))return '';return (n.innerText||'').trim()||'(no name)';})()" 15000
        if ($appSaved) {
            Report $true 'j2 the application says the project is saved' "the toolbar reads '$appSaved' and no longer shows the unsaved-changes mark, which store.ts only does after ipc.saveProject resolved"
        } else {
            $toolbarNow = Cdp-Eval "(document.querySelector('.project-name')||{innerText:[]}).innerText"
            $statusNow = Cdp-Eval "(document.querySelector('[class^=statusbar__message]')||{innerText:[]}).innerText"
            Report $false 'j2 the application says the project is saved' "the toolbar still reads '$(OneLine $toolbarNow)' and the status bar says '$(OneLine $statusNow)' - store.ts clears dirty only after ipc.saveProject resolved, so the save either never ran or failed"
        }
        $projectSaved = $false
        for ($i = 0; $i -lt 30; $i++) {
            if (Test-Path $projectFile) { $projectSaved = $true; break }
            Start-Sleep -Milliseconds 500
        }
        # If it is not where it was asked for, say where it went instead. That is the whole
        # difference between "the write had not finished" and "the name never reached the dialog and
        # it saved somewhere else under that name" - and only one of those is a harness bug.
        $whereInstead = ''
        if (-not $projectSaved) {
            $since = (Get-Item $script:sandbox).CreationTime
            $hunt = @($env:USERPROFILE, (Join-Path $env:USERPROFILE 'Documents'), (Join-Path $env:USERPROFILE 'Desktop'), (Join-Path $env:USERPROFILE 'Downloads'), $env:TEMP, (Split-Path $proc.Path -Parent))
            $found = @()
            foreach ($dir in ($hunt | Sort-Object -Unique)) {
                if (-not $dir -or -not (Test-Path $dir)) { continue }
                foreach ($f in @(Get-ChildItem -Path $dir -Filter '*.encastra' -File -ErrorAction SilentlyContinue)) {
                    if ($f.LastWriteTime -ge $since) { $found += "$($f.FullName) (written $($f.LastWriteTime.ToString('s')))" }
                }
            }
            $whereInstead = if ($found.Count -gt 0) { '; a .encastra file newer than this run turned up at ' + ($found -join ', ') + ' - so the chooser took a name but not the folder that was typed' } else { '; no .encastra newer than this run is in the profile, Documents, Desktop, Downloads, TEMP or the install directory either' }
        }
        Report $projectSaved 'j2 project saved to disk' "$projectFile exists=$projectSaved$whereInstead"
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
            ConfirmChooser $dlg $publishInto 'j2' 'folder'
            ReportChooserClosed 'j2'
            $done = FindText '(D.nde ha quedado|Where it went)' 15
            $err = FindText '(no se puede usar|cannot be used|Elige la carpeta|Choose the folder to publish into)' 2
            Report ($null -ne $done) 'j2 the application says where the publication went' "section='$done' refusal='$err'"
            $written = @(Get-ChildItem -Force -Path $publishInto -Directory -ErrorAction SilentlyContinue)
            if ($written.Count -eq 1) { $script:preparedFolder = $written[0].FullName }
            $hasDoc = $false
            if ($script:preparedFolder) { $hasDoc = (Test-Path (Join-Path $script:preparedFolder 'publication.json')) }
            Report ($written.Count -eq 1 -and $hasDoc) 'j2 the chosen folder was actually published into' "folders=$($written.Count) prepared='$script:preparedFolder' publication.json=$hasDoc"
            $shownPath = FindText ([regex]::Escape($publishInto)) 3
            Report ($null -ne $shownPath) 'j2 the panel shows the path it wrote to' "'$shownPath'"
        }

        $close = Wait 'Button' '^(Cerrar|Close)$' 8
        if ($close) { Click $close; Start-Sleep -Milliseconds 600 }
    } catch {
        JourneyEnded $_ 'j2 publish-into journey ran to the end'
    }
    EnsureNoDialogs 'j2 after'
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
function Journey3 {
    "--- journey 3: import-from (Library -> Import) ---"
    try {
        EnsureNoDialogs 'j3 before'
        DismissWelcome 'j3 before'
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
            ConfirmChooser $dlg $missing 'j3-missing' 'folder'
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
                ConfirmChooser $dlg $junction 'j3-junction' 'folder'
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
        if (-not $script:preparedFolder) {
            Skip 'j3 the prepared publication can be imported' 'journey 2 produced no folder to import from'
        } else {
            Click (MustFind (Wait 'Button' '^(Importar|Import)' 10) 'the Import button was not on screen for the round trip')
            $dlg = WaitDialog 12
            ConfirmChooser $dlg $script:preparedFolder 'j3' 'folder'
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
function Journey45 {
    "--- journeys 4 and 5: grant-to-component and run-input (Inspector) ---"
    $folderField = $null
    try {
        EnsureNoDialogs 'j4/j5 before'
        DismissWelcome 'j4/j5 before'
        [void](GoTo '^(Constructor|Builder)$' 'Builder')
        $new = Wait 'Button' '^(Nuevo|New)$' 10
        if ($new) {
            Click $new
            # New does one of two things and both are answers: it empties the canvas, or it puts
            # the unsaved-changes question on screen. Waited on rather than slept through.
            for ($i = 0; $i -lt 30; $i++) {
                if (Find (AppWindow) 'Button' '^(Descartar los cambios|Discard changes)$') { break }
                if ((CdpStepCount) -eq 0) { break }
                Start-Sleep -Milliseconds 100
            }
        }
        # New does not start a new project while there is unsaved work: it puts the discard question
        # on screen instead (store.ts:677) and waits. That question is an in-page alertdialog, not a
        # window, so nothing in the dialog handling above sees it - and the step journey 2 left on the
        # canvas is exactly what makes it appear here. Answered, so this journey starts on its own
        # canvas rather than on top of journey 2's.
        DismissDiscardPrompt
        # And answering that question is exactly where this journey lost the interface. The prompt
        # declares `aria-modal="true"` and traps focus, and a11y/focus.ts hands focus back to whatever
        # had it when the prompt opened - which, on a machine where the first-run welcome has never
        # been dismissed, is the welcome card. The welcome is also `aria-modal="true"`, so from that
        # moment Chromium leaves the whole interface out of the accessibility tree, the step placed
        # next is invisible rather than absent, and the Inspector is looked for on a canvas nothing
        # can see. `ids on screen: ... welcome-title(Text)` was the whole of it.
        DismissWelcome 'j4/j5 after the unsaved-changes question'
        $welcomeGone = -not (WelcomeShowing)
        Report $welcomeGone 'j4 the interface is what is on screen, not the first-run welcome' $(if ($welcomeGone) { 'the welcome is not on screen' } else { 'the welcome is still on screen after Skip was pressed, so nothing behind it can be found: ' + (AutomationIdDump 20) })

        # From here it is exactly the route journey 2 takes: be in the Builder, and place a step from
        # the palette. Placing is the only way in - `addNode` selects what it placed (store.ts:355),
        # while clicking a step on the canvas is not available from here at all, because ComponentNode
        # deliberately publishes no ARIA role and so offers no Invoke pattern.
        [void](GoTo '^(Constructor|Builder)$' 'Builder')
        PlaceStep '(Save File|encastra\.file\.save)' 'j4' 'encastra.file.save'
        if (-not $script:stepPlaced) {
            throw 'SKIP: the store never counted a step and the canvas never drew one, so the Inspector has nothing to show and neither of the two choosers below it can be reached. The routes and what each of them saw are in the notes above this line.'
        }

        # Everything below this line needs the step to be SELECTED, not merely placed: the folder
        # row and the starting-material row are the selected step's rows. `addNode` is supposed to
        # select what it placed (store.ts:355), so this is the product's own promise and it is
        # asserted as its own line rather than being discovered three checks later as "the folder
        # field is not exposed". A step is on the canvas by now - PlaceStep named it - so a failure
        # here is about selection and nothing else.
        $selected = Cdp-Wait "(()=>{const p=document.querySelector('.panel--inspector');if(!p)return '';const t=p.innerText;const i=t.indexOf('encastra.file.save@');if(i<0)return '';return t.substr(i,40);})()" 6000
        Report ([bool]$selected) 'j4 step selected in inspector' "the panel reads '$selected' for the step just placed$(if (-not $selected) { "; the panel is showing instead: $(OneLine (CdpInspectorText))" })"

        # The Inspector shows a step's settings only for the step that is selected (Inspector.tsx:506
        # returns the empty panel when `selectedNodeId` names nothing). Placing from the palette is
        # enough to select: `addNode` sets `selectedNodeId` to the step it just made (store.ts:355,
        # "a newly placed node is the one you want to configure"). That matters, because selecting by
        # clicking the step on the canvas is not available from here - React Flow draws each step as a
        # plain div with, deliberately, no ARIA role and so no Invoke pattern (ComponentNode.tsx).
        # A step is known to be on the canvas by now - PlaceStep above named it - so if the field
        # below is missing, "no step was placed" is already ruled out and what is left is that
        # placing it did not select it, or that the Inspector does not publish the row. The dumps say
        # which, rather than leaving it to be guessed at.
        $folderField = ByIdSuffix '-folder' 12
        $whichStep = if ($script:placedStep) { "the canvas calls it '$script:placedStep'" } else { 'the canvas publishes no id for it, so it is named only by the Inspector' }
        if (-not $folderField) {
            Report $false 'j4 the Inspector shows the folder setting for the selected step' ("a step was placed ($whichStep) and no element publishes an id ending in '-folder'. Steps UI Automation can see: " + (PlacedStepsDump) + ' ... ids on screen: ' + (AutomationIdDump 40))
            throw "SKIP: a step was placed ($whichStep) but its folder setting is not exposed to UI Automation - placing it did not select it, or the Inspector is publishing no row for it - so neither chooser below it can be reached"
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
        ClickInspector (MustFind $chooseFolder 'the folder row has no Choose button next to it, so grant-to-component cannot be driven') $CDP_SCROLL_FOLDER_CHOOSE 'j4 the folder row Choose button'
        $dlg = WaitDialog 12
        Report ($null -ne $dlg) 'j4 chooser opened for grant-to-component' "'$($dlg.Current.Name)'"
        CancelChooser $dlg 'j4'
        Start-Sleep -Milliseconds 700
        $stillEmpty = ValueOf (ByIdSuffix '-folder' 5)
        $allow = Wait 'Button' '^(Permitir esta carpeta|Allow this folder)$' 5
        Report ($stillEmpty -eq '' -and $null -ne $allow -and -not $allow.Current.IsEnabled) 'j4 Cancel granted nothing and configured nothing' "folder='$stillEmpty' allowEnabled=$($allow.Current.IsEnabled)"

        # Confirm, then allow: the button's own label is the application saying the folder answered
        # the question it was asked.
        ClickInspector (MustFind (ChooseButtonNear (ByIdSuffix '-folder' 5)) 'the folder row lost its Choose button after the cancelled chooser') $CDP_SCROLL_FOLDER_CHOOSE 'j4 the folder row Choose button'
        $dlg = WaitDialog 12
        ConfirmChooser $dlg $grantFolder 'j4' 'folder'
        ReportChooserClosed 'j4'
        Start-Sleep -Milliseconds 800
        $folderValue = ValueOf (ByIdSuffix '-folder' 5)
        Report (SamePath $folderValue $grantFolder) 'j4 the chosen folder became the step configuration' "'$folderValue' (expected the same folder as '$grantFolder')"
        $allow = Wait 'Button' '^(Permitir esta carpeta|Allow this folder)$' 8
        Report ($null -ne $allow -and $allow.Current.IsEnabled) 'j4 the permission control armed once a folder was chosen' "enabled=$($allow.Current.IsEnabled)"
        ClickInspector $allow $CDP_SCROLL_ALLOW 'j4 the Allow this folder button'
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

        ClickInspector (MustFind $chooseFile 'the starting-material row has no Choose button next to it, so run-input cannot be driven') $CDP_SCROLL_ENTRY_CHOOSE 'j5 the starting-material Choose button'
        $dlg = WaitDialog 12
        Report ($null -ne $dlg) 'j5 chooser opened for run-input' "'$($dlg.Current.Name)'"
        CancelChooser $dlg 'j5'
        Start-Sleep -Milliseconds 600
        $afterCancel = ValueOf $readonlyBox
        Report ($afterCancel -eq '') 'j5 Cancel seeded no input' "box='$afterCancel'"

        ClickInspector (MustFind (ChooseButtonNear $readonlyBox) 'the starting-material row lost its Choose button after the cancelled chooser') $CDP_SCROLL_ENTRY_CHOOSE 'j5 the starting-material Choose button'
        $dlg = WaitDialog 12
        ConfirmChooser $dlg $inputFile 'j5' 'file'
        ReportChooserClosed 'j5'
        Start-Sleep -Milliseconds 800
        $inputValue = ValueOf $readonlyBox
        $inputSeeded = (SamePath $inputValue $inputFile)
        Report $inputSeeded 'j5 the chosen file became the input for the run' "'$inputValue' (expected the same file as '$inputFile')"

        # The proof that both answers were real: a run that writes into the granted folder.
        #
        # Its precondition is the line directly above. A graph whose starting material was never
        # seeded cannot run at all, and `j4 the granted folder was actually written into by the run
        # -> file='' status='Nothing has run yet'` reported that as a failure of the grant - which
        # it is not. It is the same failure, counted twice, and the second telling hid its cause.
        $run = Wait 'Button' '^(Ejecutar|Run)$' 10
        Report ($null -ne $run -and $run.Current.IsEnabled) 'j4/j5 Run is available with a folder allowed and a file chosen' "enabled=$($run.Current.IsEnabled)"
        ClickInspector (MustFind $run 'the Run button is not on screen, so the granted folder cannot be written into') $CDP_SCROLL_RUN 'j4/j5 the Run button'
        $saved = $null
        for ($i = 0; $i -lt 60; $i++) {
            $hit = @(Get-ChildItem -Force -Path $grantFolder -File -ErrorAction SilentlyContinue)
            if ($hit.Count -gt 0) { $saved = $hit[0].FullName; break }
            Start-Sleep -Milliseconds 500
        }
        $runSays = FindText '(correcto|correctos|ok|fallido|failed|Nada se ha ejecutado|Nothing ran)' 3
        $because = if ($inputSeeded) { '' } else { " - and the run had no starting material to begin with: the line above says the chooser never seeded one, so this is that failure and not a second one" }
        Report ($null -ne $saved) 'j4 the granted folder was actually written into by the run' "file='$saved' status='$runSays'$because"

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
        ClickInspector (MustFind $allowAgain 'the permission control did not go back to asking, so the refusal cannot be provoked') $CDP_SCROLL_ALLOW 'neg the Allow this folder button'
        Start-Sleep -Milliseconds 400
        ClickInspector (MustFind (Wait 'Button' '^(Ejecutar|Run)$' 10) 'the Run button is not on screen for the refusal probe') $CDP_SCROLL_RUN 'neg the Run button'
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
}

# --- the run --------------------------------------------------------------------------------
#
# The suite, n times, in order, each time on its own sandbox and its own empty project. In order
# and not journey-by-journey, because the journeys are chained: journey 2 prepares a publication
# and journey 3 imports that same folder back, and three publications followed by three imports
# would be asserting about somebody else's folder.
#
# A journey that passes once and fails the second time has not passed. Everything the run produced
# is in one log, each line saying which iteration it came from, and the counters run across all of
# them: one FAIL anywhere is a failed run.
HarnessStart
for ($iter = 1; $iter -le $Repeat; $iter++) {
    $script:iteration = "  [iteration $iter/$Repeat]"
    "--- iteration $iter of $Repeat ---"
    NewSandbox "-i$iter"
    ResetProject "iteration $iter"
    $script:preparedFolder = $null
    Journey1
    Journey2
    Journey3
    Journey45
}
$script:iteration = ''

# --- the application is still standing ---------------------------------------------------------
ForceCloseDialogs
$proc.Refresh()
Report (-not $proc.HasExited) 'application still running at the end' "exited=$($proc.HasExited) responding=$($proc.Responding)"

"SUMMARY  passed=$script:passed failed=$script:failed skipped=$script:skipped  repeat=$Repeat  sandbox=$script:sandbox"
if ($script:failed -gt 0) { EndRun 1 }
if ($script:skipped -gt 0) { EndRun 2 }
EndRun 0
