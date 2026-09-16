# What the WebView2 on this machine is, and whether anything is listening on the debugging port.
#
#   .\scripts\verify\webview2_state.ps1 -Port 9222
#
# Printed by scripts/verify/gui_journeys.ps1 when it cannot reach the page, by
# scripts/verify/install_check.ps1 after it launches the application, and unconditionally by the
# chooser-journeys workflow. The reason it exists is a run on a hosted runner that said only this:
#
#   PASS  installed application launches and stays up  -> pid 5080 title='Encastra'
#   FAIL  CDP reachable  -> no CDP endpoint on 127.0.0.1:9222 (fetch failed)
#
# with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS in the step's environment. That is not a finding, it
# is the absence of one: the port never opened, or it opened late, or the flag never reached the
# browser - and nobody could look at the machine to tell which. These four answers tell them apart.
#
#   * Whether anything is listening on the port, and which process. A listener means the harness's
#     own reach is the problem; no listener means the browser never opened one.
#   * Every msedgewebview2 command line. This is the load-bearing one.
#     WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS is read by the WebView2 loader inside the host process
#     and appended to the browser process's command line, so the flag either is on that line or it
#     is not, and the two mean entirely different things: absent, and the variable never reached
#     the loader; present, and the flag was accepted and the port is a separate question. On this
#     developer's machine the line carries wry's own additional arguments AND the flag together -
#     `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --remote-debugging-port=9333`
#     - so the environment variable does not replace what the application asks for, it adds to it.
#   * The runtime version, because the runner's WebView2 is not this machine's and nothing else in
#     the log says which one it had.
#   * DevToolsActivePort, if the runtime writes one. On Edge WebView2 153.0.4234.32 with an
#     explicit port it writes none - the file is a Chromium convention that this runtime does not
#     appear to follow - so "no DevToolsActivePort file" is the expected answer and not a fault.
#
# Prints plain lines and nothing else: the callers decide what to do with them, and this file is
# called from failure paths, so nothing in it may throw.
param([int]$Port = 9222)
$ErrorActionPreference = 'Continue'

"webview2: port asked about = $Port"

# Anything listening, and whose it is.
try {
    $listening = @(netstat -ano | Select-String -SimpleMatch ":$Port" | ForEach-Object { $_.Line.Trim() })
    if ($listening.Count -eq 0) { "webview2: nothing in netstat mentions port $Port at all" }
    else { foreach ($l in $listening) { "webview2: netstat $l" } }
} catch {
    "webview2: netstat could not be read ($($_.Exception.GetType().Name))"
}

# The command lines. The flag is on them or it is not, and that is the whole question.
try {
    $procs = @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" -ErrorAction Stop)
    if ($procs.Count -eq 0) { "webview2: no msedgewebview2.exe process is running at all" }
    # Every WebView2 host on the machine answers this query - a developer's Windows runs half a
    # dozen of them, Teams and the shell's own search among them - and they are not the subject.
    # The ones that are: anything hosted by the application under test, and anything at all that
    # carries the flag. The rest are counted, so the log says they were looked at and passed over.
    $others = @()
    foreach ($p in $procs) {
        $cmd = [string]$p.CommandLine
        $hosted = if ($cmd -match '--webview-exe-name=([^\s"]+)') { $Matches[1] } else { '(unknown host)' }
        $kind = if ($cmd -match '--type=([^\s"]+)') { $Matches[1] } else { 'browser' }
        $flag = if ($cmd -match '--remote-debugging-port=(\d+)') { $Matches[1] } else { 'absent' }
        $ours = ($cmd -match '(?i)encastra') -or ($flag -ne 'absent')
        if (-not $ours) { $others += $hosted; continue }
        # The parent is the whole of the shared-browser question. WebView2 keeps one browser
        # process per user-data directory, and whichever host created it first settles its
        # arguments for everyone after: a browser whose parent is not the host we just started is
        # a browser somebody else made, and our flag was never going to be on it.
        "webview2: pid=$($p.ProcessId) parent=$($p.ParentProcessId) host=$hosted type=$kind remote-debugging-port=$flag"
        # Whole, never truncated. This line is the evidence; a cut one only says where the cut was.
        if ($kind -eq 'browser') { "webview2:   command line: $cmd" }
    }
    if ($others.Count -gt 0) {
        $names = ($others | Sort-Object -Unique) -join ', '
        "webview2: $($others.Count) other msedgewebview2 processes on this machine belong to something else and were passed over: $names"
    }
} catch {
    "webview2: the process list could not be read ($($_.Exception.GetType().Name))"
}

# And the hosts themselves. How many there are is the first question a shared browser raises, and
# `app pid 5508` in one log beside `pid=7700 host=encastra-desktop.exe` in another does not answer
# it. Creation times say which host was first, which is the one whose arguments the browser has.
try {
    $hosts_ = @(Get-CimInstance Win32_Process -Filter "Name='encastra-desktop.exe'" -ErrorAction Stop)
    if ($hosts_.Count -eq 0) { "webview2: no encastra-desktop.exe process is running" }
    else { "webview2: $($hosts_.Count) encastra-desktop.exe process(es) running" }
    foreach ($h in ($hosts_ | Sort-Object CreationDate)) {
        "webview2: host pid=$($h.ProcessId) parent=$($h.ParentProcessId) started=$($h.CreationDate.ToString('s')) command line: $($h.CommandLine)"
    }
} catch {
    "webview2: the encastra-desktop process list could not be read ($($_.Exception.GetType().Name))"
}

# Which runtime. Per-machine first, then per-user.
foreach ($key in @(
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
        'HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
        'HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}')) {
    try {
        $pv = (Get-ItemProperty -Path $key -ErrorAction Stop).pv
        if ($pv) { "webview2: runtime $pv (from $key)" }
    } catch {
        "webview2: no runtime version under $key"
    }
}

# DevToolsActivePort, where Chromium would put it. One level of user-data directories rather than
# a walk of LOCALAPPDATA: a recursive search there takes minutes and this runs on a failure path.
$found = $false
try {
    foreach ($dir in @(Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA '*\EBWebView') -Directory -ErrorAction SilentlyContinue)) {
        foreach ($candidate in @((Join-Path $dir.FullName 'DevToolsActivePort'), (Join-Path $dir.FullName 'Default\DevToolsActivePort'))) {
            if (-not (Test-Path $candidate)) { continue }
            $found = $true
            $body = ((Get-Content $candidate -Raw -ErrorAction SilentlyContinue) -replace '\r?\n', ' | ')
            "webview2: DevToolsActivePort at $candidate holds '$body'"
        }
    }
} catch {
    "webview2: the user-data directories could not be read ($($_.Exception.GetType().Name))"
}
if (-not $found) {
    "webview2: no DevToolsActivePort file under any $env:LOCALAPPDATA\*\EBWebView (on Chromium that file names the port actually bound; Edge WebView2 153.0.4234.32 writes none, verified against a running application with the port open, so its absence is not itself a fault)"
}
