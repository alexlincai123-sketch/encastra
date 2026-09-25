# Clean VM guest harness - shared helpers. Dot-sourced by entry.ps1. Windows PowerShell 5.1
# (a clean Windows 11 has no PowerShell 7). Pure ASCII on purpose, like scripts/verify/*.ps1.
#
# Every assertion goes through Check, which writes it to the scenario record AND to COM1. The
# serial port is a second channel the host captures to a file of its own (lab.sh), so a record on
# the results disk that says PASS while the serial log says FAIL is caught by the host report.

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$script:InstallDir = Join-Path $env:LOCALAPPDATA 'Encastra'
$script:InstalledExe = Join-Path $script:InstallDir 'encastra-desktop.exe'
$script:Uninstaller = Join-Path $script:InstallDir 'uninstall.exe'
$script:AppDataRoaming = Join-Path $env:APPDATA 'dev.encastra.app'
$script:AppDataLocal = Join-Path $env:LOCALAPPDATA 'dev.encastra.app'
$script:CdpPort = 9222
$script:Utf8 = New-Object System.Text.UTF8Encoding $false

function Now { (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ') }

function Find-Volume([string]$label) {
    [IO.DriveInfo]::GetDrives() | Where-Object { $_.IsReady -and $_.VolumeLabel -eq $label } |
        Select-Object -First 1 | ForEach-Object { $_.RootDirectory.FullName.TrimEnd('\') }
}

function Serial([string]$line) {
    $stamped = "$(Now) $line"
    try { [IO.File]::AppendAllText((Join-Path $script:R 'serial-mirror.log'), "$stamped`r`n", $script:Utf8) } catch { }
    try {
        $port = New-Object System.IO.Ports.SerialPort 'COM1', 115200
        $port.WriteTimeout = 2000
        $port.Open(); $port.WriteLine($stamped); $port.Close()
    } catch { }
}

function Save-Json($obj, [string]$path) {
    $dir = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    # -InputObject, not the pipeline: piped, a one-element array becomes an object and an empty one
    # becomes nothing at all.
    [IO.File]::WriteAllText($path, (ConvertTo-Json -InputObject $obj -Depth 16), $script:Utf8)
}

function Load-Json([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    [IO.File]::ReadAllText($path, $script:Utf8) | ConvertFrom-Json
}

function Sha256([string]$path) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLower() }

function Short($value, [int]$max = 400) {
    $s = if ($null -eq $value) { '(null)' } else { ($value | Out-String).Trim() }
    $s = $s -replace '\s+', ' '
    if ($s.Length -gt $max) { $s.Substring(0, $max) + '...' } else { $s }
}

# --- state that survives a reboot -----------------------------------------------------------

function Prop($obj, [string]$name) {
    # A dictionary (Get-Inventory returns an [ordered] one) keeps its entries as KEYS, not as
    # properties: asking its PSObject would find Count and Keys, never the entry.
    if ($obj -is [System.Collections.IDictionary]) { if ($obj.Contains($name)) { return $obj[$name] } else { return $null } }
    if ($null -ne $obj -and $obj -isnot [string] -and (@($obj.PSObject.Properties | ForEach-Object { $_.Name }) -contains $name)) { $obj.$name } else { $null }
}

function Set-StateField([string]$name, $value) {
    $st = Get-State
    $st | Add-Member -NotePropertyName $name -NotePropertyValue $value -Force
    Set-State $st
}

function Get-State { Load-Json (Join-Path $script:R 'state.json') }
function Set-State($state) { Save-Json $state (Join-Path $script:R 'state.json') }

# --- the scenario record ----------------------------------------------------------------------

$script:Cur = $null

function Begin-Scenario([string]$id, [string]$title) {
    $script:Cur = [ordered]@{
        scenario_id = $id; title = $title; cycle = $script:Plan.cycle
        started = Now; finished = $null
        environment = 'environment.json'
        artifact = [ordered]@{ file = $script:Expected.installer.file; sha256 = $script:Expected.installer.sha256; version = $script:Expected.installer.version }
        expected = New-Object System.Collections.ArrayList
        observed = [ordered]@{}
        assertions = New-Object System.Collections.ArrayList
        evidence = New-Object System.Collections.ArrayList
        result = 'RUNNING'; forced_reason = $null
    }
    $dir = Join-Path $script:R "scenarios\$id"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $script:ScenarioDir = $dir
    Save-Json $script:Cur (Join-Path $dir 'result.json')
    Serial "RUNNING $id $title"
}

function Check([string]$name, [bool]$ok, $expected, $observed) {
    $a = [ordered]@{ name = $name; ok = $ok; expected = (Short $expected); observed = (Short $observed 1200); at = (Now) }
    [void]$script:Cur.assertions.Add($a)
    Serial ("{0} {1} {2} -> {3}" -f $(if ($ok) { 'PASS' } else { 'FAIL' }), $script:Cur.scenario_id, $name, (Short $observed 300))
}

function Expect([string]$what) { [void]$script:Cur.expected.Add($what) }
function Observe([string]$key, $value) { $script:Cur.observed[$key] = $value }

function Evidence([string]$name, $content) {
    $path = Join-Path $script:ScenarioDir $name
    if ($content -is [string]) { [IO.File]::WriteAllText($path, $content, $script:Utf8) }
    else { Save-Json $content $path }
    [void]$script:Cur.evidence.Add("scenarios/$($script:Cur.scenario_id)/$name")
    $path
}

function Force-Result([string]$result, [string]$reason) {
    $script:Cur.result = $result; $script:Cur.forced_reason = $reason
}

# PASS needs at least one executed assertion and no failed one. BLOCKED / NOT_APPLICABLE come only
# from Force-Result with a reason; a FAIL assertion outranks either.
function End-Scenario {
    $c = $script:Cur
    $failed = @($c.assertions | Where-Object { -not $_.ok }).Count
    $count = @($c.assertions).Count
    if ($failed -gt 0) { $c.result = 'FAIL' }
    elseif ($c.forced_reason) { }
    elseif ($count -eq 0) { $c.result = 'FAIL'; $c.forced_reason = 'no assertion was executed' }
    else { $c.result = 'PASS' }
    $c.finished = Now
    Save-Json $c (Join-Path $script:ScenarioDir 'result.json')
    Serial ("RESULT {0} {1} assertions={2} failed={3}{4}" -f $c.scenario_id, $c.result, $count, $failed, $(if ($c.forced_reason) { " reason=$($c.forced_reason)" } else { '' }))
    $c.result
}

function Run-Scenario([string]$id, [string]$title, [scriptblock]$body) {
    Begin-Scenario $id $title
    try { & $body }
    catch { Check 'scenario body ran to the end without an exception' $false 'no exception' ("$($_.Exception.GetType().Name): $($_.Exception.Message) at $($_.InvocationInfo.PositionMessage)") }
    finally {
        # Every scenario leaves nothing of the application running for the next one - except
        # CLEAN-003, whose running copy CLEAN-004 examines (install_check started it).
        if ($id -ne 'CLEAN-003') { try { Close-AppGracefully | Out-Null; Stop-App | Out-Null } catch { } }
    }
    End-Scenario
}

# --- faults injected on purpose (negative cycles only) --------------------------------------

function Injected([string]$name) { @($script:Plan.inject) -contains $name }

# --- processes ---------------------------------------------------------------------------------

function Get-AppProcesses {
    # The host and every WebView2 browser process whose user-data folder is this application's.
    $host_ = @(Get-CimInstance Win32_Process -Filter "Name='encastra-desktop.exe'")
    $web = @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -match 'dev\.encastra\.app' })
    @($host_) + @($web)
}

function Stop-App([int]$timeoutSec = 30) {
    Get-Process encastra-desktop -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    while ((Get-Date) -lt $deadline -and @(Get-AppProcesses).Count -gt 0) { Start-Sleep -Milliseconds 500 }
    @(Get-AppProcesses).Count
}

function Start-App([switch]$Cdp, [hashtable]$ExtraEnv) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $script:InstalledExe
    $psi.WorkingDirectory = $script:InstallDir
    $psi.UseShellExecute = $false
    # A clean child environment: this harness's PATH carries nothing of the harness disc.
    $psi.Environment['PATH'] = $script:CleanPath
    # Nothing of the harness in the product's environment: the debugging flag (added back below
    # only when asked for), the execution-policy override the harness itself runs under, and the
    # CI switch gui_journeys reads.
    foreach ($k in 'WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS', 'PSExecutionPolicyPreference', 'GITHUB_ACTIONS') { $psi.Environment.Remove($k) | Out-Null }
    if ($Cdp) { $psi.Environment['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = "--remote-debugging-port=$($script:CdpPort)" }
    if ($ExtraEnv) { foreach ($k in $ExtraEnv.Keys) { $psi.Environment[$k] = [string]$ExtraEnv[$k] } }
    [System.Diagnostics.Process]::Start($psi)
}

# --- the page, over the DevTools protocol (scripts/verify/cdp.mjs, node from the harness disc) --

function Cdp([string]$mode, [string]$expr, [int]$timeoutMs = 5000) {
    $args_ = @($script:CdpScript, '--port', $script:CdpPort, $mode, $expr)
    if ($mode -eq 'wait') { $args_ += @('--timeout-ms', $timeoutMs, '--interval-ms', 250) }
    # Under $ErrorActionPreference='Stop', Windows PowerShell turns the first stderr line of a native
    # program into a terminating error when stderr is redirected. Here node's stderr is collected
    # and set aside instead, so a warning from node is an answer of 'not ok', never an exception.
    $ErrorActionPreference = 'Continue'
    $raw = & $script:NodeExe @args_ 2>&1
    $code = $LASTEXITCODE
    $text = (@($raw | Where-Object { $_ -is [string] }) -join "`n").Trim()
    if (-not $text) { return [pscustomobject]@{ ok = $false; error = "cdp.mjs printed nothing on stdout (exit $code): $(Short (@($raw) -join ' '))"; value = $null } }
    try { $v = $text | ConvertFrom-Json } catch { return [pscustomobject]@{ ok = $false; error = "not JSON: $text"; value = $null } }
    if ($v -is [pscustomobject] -and (@($v.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'error') -and @($v.PSObject.Properties).Count -eq 1) {
        return [pscustomobject]@{ ok = $false; error = $v.error; value = $null }
    }
    [pscustomobject]@{ ok = $true; error = $null; value = $v }
}

# Ready = the window is up, the interface has rendered its top bar, and the backend answers an
# IPC round trip (list_components - it reads no per-user state, so a damaged library cannot
# make a running application look not-ready). Returns a description; $script:LastReady has the parts.
$READY_JS = "(async()=>{const bar=!!document.querySelector('header.topbar .brand');const welcome=!!document.querySelector('.welcome');let ipc='no __TAURI_INTERNALS__';if(window.__TAURI_INTERNALS__){try{const r=await window.__TAURI_INTERNALS__.invoke('list_components');ipc='ok components='+(Array.isArray(r)?r.length:'?');}catch(e){ipc='error '+JSON.stringify(e).slice(0,200);}}return {bar,welcome,ipc,lang:document.documentElement.lang,title:document.title};})()"

function Wait-Ready($proc, [int]$timeoutSec = 90) {
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    $last = 'never answered'
    while ((Get-Date) -lt $deadline) {
        if ($proc.HasExited) { $script:LastReady = "process exited with code $($proc.ExitCode)"; return $false }
        $r = Cdp 'eval' $READY_JS 8000
        if ($r.ok -and (Prop $r.value 'bar') -and ((Prop $r.value 'ipc') -like 'ok*')) { $script:LastReady = $r.value; return $true }
        $last = if ($r.ok) { Short $r.value } else { $r.error }
        Start-Sleep -Seconds 2
    }
    $script:LastReady = "not ready after ${timeoutSec}s; last: $last"
    $false
}

# Graceful close the way a person closes it: WM_CLOSE to the main window.
function Close-AppGracefully([int]$timeoutSec = 30) {
    $p = Get-Process encastra-desktop -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $p) { return 'not running' }
    [void]$p.CloseMainWindow()
    if ($p.WaitForExit($timeoutSec * 1000)) { return "exited $($p.ExitCode)" }
    'still running'
}

function Get-LocalStorageDump {
    $r = Cdp 'eval' "(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k);}return o;})()"
    if ($r.ok) { $r.value } else { $null }
}

# --- evidence about the machine ----------------------------------------------------------------

function Get-NamedFiles([string]$pattern) {
    # Every file or folder on C: whose name contains the pattern. cmd's dir is the fastest walk a
    # stock Windows has; access-denied folders are skipped, which is recorded.
    $out = & cmd.exe /c "dir /s /b /a C:\*$pattern* 2>nul"
    @($out | Where-Object { $_ })
}

function Get-Inventory([switch]$NoNameScan) {
    $inv = [ordered]@{ taken = (Now) }
    $inv.run_keys = @(@(foreach ($k in 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce',
            'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce',
            'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run') {
            $p = Get-ItemProperty -LiteralPath $k -ErrorAction SilentlyContinue
            if ($p) { foreach ($prop in $p.PSObject.Properties) { if ($prop.Name -notmatch '^PS') { "$k|$($prop.Name)=$($prop.Value)" } } }
        }))
    $inv.startup_items = @(@(foreach ($d in (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'), (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Startup')) {
            Get-ChildItem -LiteralPath $d -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName } }))
    # Per-user service instances (AarSvc_1a2b3, BcastDVRUserService_...) get a new suffix for every
    # logon session; the suffix is replaced so a restart does not read as a change of services.
    # A service that appears or disappears is always a change, and so is any change of start mode -
    # except for the two Windows services seen flipping their own start mode with nothing installed
    # that could touch them (BITS Auto->Manual, PcaSvc Manual->Auto). Named, not a whole class.
    $svc = @(Get-CimInstance Win32_Service)
    $inv.services = @($svc | ForEach-Object { "$($_.Name -replace '_[0-9a-f]{4,8}$', '_<session>')|$($_.PathName)" } | Sort-Object -Unique)
    $isWin = { param($s) ([string]$s.PathName).TrimStart('"') -like "$env:SystemRoot\*" }
    $inv.services_thirdparty_start = @($svc | Where-Object { -not (& $isWin $_) } | ForEach-Object { "$($_.Name)|$($_.StartMode)|$($_.PathName)" } | Sort-Object -Unique)
    $inv.services_windows_start = @($svc | Where-Object { (& $isWin $_) -and $_.Name -notin 'BITS', 'PcaSvc' } | ForEach-Object { "$($_.Name -replace '_[0-9a-f]{4,8}$', '_<session>')|$($_.StartMode)" } | Sort-Object -Unique)
    # Per-user and machine autostart points beyond Run/RunOnce and the Startup folders.
    $inv.autostart_extra = @(@(foreach ($pair in @(
                    @('HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon', 'Shell'),
                    @('HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon', 'Shell'),
                    @('HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon', 'Userinit'),
                    @('HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows', 'Load'),
                    @('HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows', 'Run'),
                    @('HKCU:\Software\Microsoft\Command Processor', 'AutoRun'),
                    @('HKLM:\SOFTWARE\Microsoft\Command Processor', 'AutoRun'),
                    @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders', 'Startup'))) {
                $p = Get-ItemProperty -LiteralPath $pair[0] -ErrorAction SilentlyContinue
                $v = if ($p -and (@($p.PSObject.Properties | ForEach-Object { $_.Name }) -contains $pair[1])) { $p.($pair[1]) } else { '(absent)' }
                "$($pair[0])|$($pair[1])=$v" }) | Sort-Object)
    # Application registration: App Paths and RegisteredApplications, per user and per machine.
    $inv.registration = @(@(foreach ($k in 'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths', 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths') {
                Get-ChildItem -LiteralPath $k -ErrorAction SilentlyContinue | ForEach-Object { "$k\$($_.PSChildName)" } }) +
        @(foreach ($k in 'HKCU:\Software\RegisteredApplications', 'HKLM:\SOFTWARE\RegisteredApplications') {
                $p = Get-ItemProperty -LiteralPath $k -ErrorAction SilentlyContinue
                if ($p) { foreach ($prop in $p.PSObject.Properties) { if ($prop.Name -notmatch '^PS') { "$k|$($prop.Name)" } } } }) | Sort-Object)
    # The top of %TEMP%, as evidence of what an installer or uninstaller left there (not compared:
    # Windows and PowerShell write there constantly).
    $inv.temp_top = @(Get-ChildItem -LiteralPath $env:TEMP -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.Name } | Sort-Object)
    $inv.scheduled_tasks = @(Get-ScheduledTask -ErrorAction SilentlyContinue | ForEach-Object { "$($_.TaskPath)$($_.TaskName)" } | Sort-Object)
    $inv.uninstall_entries = @(@(foreach ($k in 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall') {
            Get-ChildItem -LiteralPath $k -ErrorAction SilentlyContinue | ForEach-Object {
                $p = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
                $dn = if ($p -and (@($p.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'DisplayName')) { $p.DisplayName } else { '' }
                "$k\$($_.PSChildName)|$dn" } }) | Sort-Object)
    $inv.shortcuts = @(@(foreach ($d in (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu'), (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu'), [Environment]::GetFolderPath('Desktop'), (Join-Path $env:PUBLIC 'Desktop')) {
            Get-ChildItem -LiteralPath $d -Recurse -Force -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName } }) | Sort-Object)
    $inv.hkcu_software = @(Get-ChildItem 'HKCU:\Software' -ErrorAction SilentlyContinue | ForEach-Object { $_.PSChildName } | Sort-Object)
    $inv.hkcu_classes = @(Get-ChildItem 'HKCU:\Software\Classes' -ErrorAction SilentlyContinue | ForEach-Object { $_.PSChildName } | Sort-Object)
    $inv.hklm_software = @(Get-ChildItem 'HKLM:\Software' -ErrorAction SilentlyContinue | ForEach-Object { $_.PSChildName } | Sort-Object)
    $inv.environment = @(@(foreach ($k in 'HKCU:\Environment', 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment') {
            $p = Get-ItemProperty -LiteralPath $k -ErrorAction SilentlyContinue
            if ($p) { foreach ($prop in $p.PSObject.Properties) { if ($prop.Name -notmatch '^PS') { "$k|$($prop.Name)=$($prop.Value)" } } } }) | Sort-Object)
    $inv.webview2_policies = @(@(foreach ($k in 'HKCU:\Software\Policies\Microsoft\Edge\WebView2', 'HKLM:\Software\Policies\Microsoft\Edge\WebView2') {
            Get-ChildItem -LiteralPath $k -ErrorAction SilentlyContinue | ForEach-Object {
                $sub = $_.PSPath; $p = Get-ItemProperty -LiteralPath $sub -ErrorAction SilentlyContinue
                if ($p) { foreach ($prop in $p.PSObject.Properties) { if ($prop.Name -notmatch '^PS') { "$k\$($_.PSChildName)|$($prop.Name)=$($prop.Value)" } } } } }) | Sort-Object)
    $inv.firewall_rules = @(Get-NetFirewallRule -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Name)|$($_.DisplayName)" } | Sort-Object)
    $inv.top_dirs = @(@(foreach ($d in $env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:ProgramData, $env:LOCALAPPDATA, $env:APPDATA, $env:USERPROFILE, (Join-Path $env:LOCALAPPDATA 'Programs')) {
            Get-ChildItem -LiteralPath $d -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName } }) | Sort-Object)
    $inv.encastra_named = if ($NoNameScan) { @() } else { @(Get-NamedFiles 'encastra' | Sort-Object) }
    $inv.processes = @(Get-CimInstance Win32_Process | ForEach-Object { $_.Name } | Sort-Object -Unique)
    $inv
}

# Every surface that must look, after uninstall and at the end, exactly as the baseline had it.
# (hkcu_software is judged separately: Tauri keeps one key there with the user data.)
$script:PersistenceSurfaces = @('run_keys', 'autostart_extra', 'startup_items', 'services', 'services_thirdparty_start',
    'services_windows_start', 'scheduled_tasks', 'uninstall_entries', 'shortcuts', 'firewall_rules', 'environment',
    'hkcu_classes', 'hklm_software', 'registration', 'webview2_policies')

function Save-Inventory([string]$label, [switch]$NoNameScan) {
    $inv = Get-Inventory -NoNameScan:$NoNameScan
    $path = Join-Path $script:R "inventory\$label.json"
    Save-Json $inv $path
    # What is compared is what was recorded: the inventory read back from its JSON, exactly as the
    # baseline it will be compared with was. Comparing a live inventory with a deserialised one made
    # a key name with unusual characters differ from itself.
    Load-Json $path
}

function Diff-List($before, $after) {
    # $null is never an entry: a function returning an EMPTY list hands its caller $null (PowerShell
    # unrolls it), and @($null) is a one-element list - which read as "removed {$null}" once.
    $before = @(@($before) | Where-Object { $null -ne $_ })
    $after = @(@($after) | Where-Object { $null -ne $_ })
    $b = @{}; foreach ($x in $before) { $b[[string]$x] = $true }
    $a = @{}; foreach ($x in $after) { $a[[string]$x] = $true }
    [ordered]@{
        added = @($after | Where-Object { -not $b.ContainsKey([string]$_) })
        removed = @($before | Where-Object { -not $a.ContainsKey([string]$_) })
    }
}

# Harness-owned paths: the only things on C: this harness itself creates.
function Test-HarnessPath([string]$p) {
    $p -match '\\encastra-journeys(\\|$)' -or $p -match '\\cleanvm-work(\\|$)' -or $p -match '\\cleanvm-agent(\\|$)'
}

# --- screenshots of the desktop, for the record -----------------------------------------------

function Save-Screenshot([string]$name) {
    try {
        Add-Type -AssemblyName System.Windows.Forms, System.Drawing
        $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
        $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
        $path = Join-Path $script:ScenarioDir "$name.png"
        $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
        $g.Dispose(); $bmp.Dispose()
        [void]$script:Cur.evidence.Add("scenarios/$($script:Cur.scenario_id)/$name.png")
    } catch { }
}

# --- a script from the harness disc, as a child process with a time limit ----------------------

function Invoke-HarnessScript([string]$script, [string[]]$arguments, [string]$log, [int]$timeoutSec, [hashtable]$env_) {
    $saved = @{}
    if ($env_) { foreach ($k in $env_.Keys) { $saved[$k] = [Environment]::GetEnvironmentVariable($k, 'Process'); [Environment]::SetEnvironmentVariable($k, [string]$env_[$k], 'Process') } }
    try {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script) + $arguments
        $quoted = ($all | ForEach-Object { if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ } }) -join ' '
        $p = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList $quoted `
            -RedirectStandardOutput $log -RedirectStandardError "$log.stderr" -PassThru -WindowStyle Hidden
        # Windows PowerShell only fills ExitCode later if the handle was taken while it lived.
        $null = $p.Handle
        if (-not $p.WaitForExit($timeoutSec * 1000)) {
            try { $p.Kill() } catch { }
            return [pscustomobject]@{ exit = $null; timedOut = $true }
        }
        $p.WaitForExit()
        [pscustomobject]@{ exit = $p.ExitCode; timedOut = $false }
    } finally {
        foreach ($k in $saved.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k], 'Process') }
    }
}

function Read-Log([string]$path) {
    if (Test-Path -LiteralPath $path) { @(Get-Content -LiteralPath $path -Encoding UTF8) } else { @() }
}
