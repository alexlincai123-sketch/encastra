# Clean VM guest harness - entry point. Started at logon by C:\ProgramData\cleanvm-agent\bootstrap.ps1
# when the harness disc (CLEANVM_H) is inserted. Runs the steps of plan.json in order, keeping
# its place in R:\state.json so a Windows restart in the middle resumes where it stopped, then
# writes summary.json and powers the VM off.
#
# A step that is interrupted (the VM restarted while it was RUNNING, not because the plan asked)
# is recorded FAIL. A critical step that fails stops the cycle: the rest are recorded NOT_RUN,
# never PASS. Nothing here turns a skipped or blocked step into a pass.

$ErrorActionPreference = 'Stop'
$script:H = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'lib.ps1')
. (Join-Path $PSScriptRoot 'scenarios.ps1')

$script:R = $null
for ($i = 0; $i -lt 60 -and -not $script:R; $i++) { $script:R = Find-Volume 'CLEANVM_R'; if (-not $script:R) { Start-Sleep -Seconds 2 } }
if (-not $script:R) {
    # No results disk means nothing could be recorded; say so on the serial line and stop.
    $script:R = $env:TEMP
    Serial 'FATAL no CLEANVM_R results volume found; powering off'
    & shutdown.exe /s /t 5 /c 'cleanvm: no results volume'
    exit 1
}

$script:Plan = Load-Json (Join-Path $script:H 'plan.json')
$script:Expected = Load-Json (Join-Path $script:H 'expected.json')
$script:ToolsDir = Join-Path $script:H 'tools\node'
$script:NodeExe = Join-Path $script:ToolsDir 'node.exe'
$script:CdpScript = Join-Path $script:H 'verify\cdp.mjs'

$state = Get-State
if (-not $state) {
    $state = [pscustomobject]@{
        cycle = $script:Plan.cycle; started = (Now); boots = 0; next = 0; aborted = $null
        clean_path = $env:PATH; steps = @(); reboot_requested_at = $null
    }
    Set-State $state
}
$script:CleanPath = $state.clean_path
$state.boots = [int]$state.boots + 1
Set-State $state
Serial "BOOT cycle=$($script:Plan.cycle) boot=$($state.boots) next=$($state.next) mode=$($script:Plan.mode) inject=$(@($script:Plan.inject) -join ',')"

if ([int]$state.boots -gt 6) {
    Serial 'FATAL more than 6 boots in one cycle; stopping to avoid a reboot loop'
    Set-StateField 'aborted' 'reboot loop'
    & shutdown.exe /s /t 5 /c 'cleanvm: reboot loop'
    exit 1
}

# Give the desktop time to settle after logon before anything drives it.
Start-Sleep -Seconds 45

# First-logon work Windows does by itself must be over before the baseline is taken, or it lands
# in the diff and reads as the installer's doing (S4: OneDrive installed itself during CLEAN-003 on
# a slow host; in S3 it had finished before the baseline). The signs: the per-user OneDriveSetup
# Run value is gone and no OneDriveSetup process is left. Recorded either way; CLEAN-001 asserts it.
if ([int]$state.boots -eq 1) {
    $q0 = Get-Date
    $quiet = $false
    while (((Get-Date) - $q0).TotalMinutes -lt 20) {
        $run = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -ErrorAction SilentlyContinue
        $pending = $run -and (@($run.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'OneDriveSetup')
        $busy = @(Get-Process -Name 'OneDriveSetup' -ErrorAction SilentlyContinue)
        if (-not $pending -and $busy.Count -eq 0) { $quiet = $true; break }
        Start-Sleep -Seconds 10
    }
    Start-Sleep -Seconds 30
    Set-StateField 'quiet' ([ordered]@{ reached = $quiet; seconds = [int]((Get-Date) - $q0).TotalSeconds })
    Serial "QUIET reached=$quiet after $([int]((Get-Date) - $q0).TotalSeconds)s"
}

$CRITICAL = @('CLEAN-001', 'CLEAN-002', 'CLEAN-003')
if (@($script:Plan.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'critical') { $CRITICAL = @($script:Plan.critical) }

function Record-Step([string]$name, [string]$result) {
    $st = Get-State
    $st.steps = @($st.steps) + @([pscustomobject]@{ step = $name; result = $result; at = (Now) })
    Set-State $st
}

$steps = @($script:Plan.steps)
$state = Get-State

# A step left RUNNING across a boot the plan did not ask for was interrupted.
$running = Join-Path $script:R 'running-step.txt'
if (Test-Path -LiteralPath $running) {
    $was = (Get-Content -LiteralPath $running -Raw).Trim()
    Serial "INTERRUPTED $was (the VM restarted while it ran)"
    Record-Step $was 'FAIL-INTERRUPTED'
    $dir = Join-Path $script:R "scenarios\$was"
    $res = Join-Path $dir 'result.json'
    if (Test-Path $res) { $j = Load-Json $res; $j.result = 'FAIL'; $j.forced_reason = 'interrupted by an unplanned restart'; Save-Json $j $res }
    Remove-Item -LiteralPath $running -Force
    if ($CRITICAL -contains $was) {
        Set-StateField 'aborted' "$was was interrupted by an unplanned restart"
        Serial "ABORT after ${was}=interrupted; later steps are NOT_RUN"
    }
    $state = Get-State
    $state.next = [int]$state.next + 1
    Set-State $state
}

while ([int]$state.next -lt $steps.Count) {
    $name = [string]$steps[[int]$state.next]
    if ($state.aborted) {
        Serial "NOT_RUN $name (cycle aborted: $($state.aborted))"
        Record-Step $name 'NOT_RUN'
    } elseif ($name -eq 'REBOOT') {
        # Never let a failure here stop the cycle: without a restart and a resume nothing after
        # this point would run. A failed pre-reboot record makes CLEAN-007 fail on its own terms.
        try { Step-PreReboot } catch {
            Serial "PRE-REBOOT failed: $($_.Exception.GetType().Name): $($_.Exception.Message)"
            Save-Json ([ordered]@{ at = (Now); ready = $false; error = "$($_.Exception.Message)"; last_boot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime().ToString('o'); state = $null; install = @() }) (Join-Path $script:R 'pre-reboot.json')
        }
        $state = Get-State; $state.next = [int]$state.next + 1; $state.reboot_requested_at = (Now); Set-State $state
        Record-Step 'REBOOT' 'REQUESTED'
        & shutdown.exe /r /t 10 /c 'cleanvm: restart requested by the plan'
        exit 0
    } else {
        Set-Content -LiteralPath $running -Value $name
        $fn = "Scenario-$($name -replace '-', '')"
        $result = if (Get-Command $fn -ErrorAction SilentlyContinue) { & $fn } else {
            Begin-Scenario $name "unknown step $name"; Check 'the plan names a step this harness has' $false 'a known step' $name; End-Scenario }
        $result = @($result)[-1]
        Remove-Item -LiteralPath $running -Force -ErrorAction SilentlyContinue
        Record-Step $name $result
        if ($result -ne 'PASS' -and $CRITICAL -contains $name) {
            Set-StateField 'aborted' "$name was $result"
            Serial "ABORT after ${name}=${result}; later steps are NOT_RUN"
        }
    }
    $state = Get-State
    $state.next = [int]$state.next + 1
    Set-State $state
}

$state = Get-State
$summary = [ordered]@{
    cycle = $script:Plan.cycle; mode = $script:Plan.mode; inject = @($script:Plan.inject)
    started = $state.started; finished = (Now); boots = $state.boots; aborted = $state.aborted
    steps = @($state.steps)
    scenarios = @(Get-ChildItem -LiteralPath (Join-Path $script:R 'scenarios') -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $j = Load-Json (Join-Path $_.FullName 'result.json'); [pscustomobject]@{ id = $j.scenario_id; result = $j.result; assertions = @($j.assertions).Count; failed = @($j.assertions | Where-Object { -not $_.ok }).Count } })
}
Save-Json $summary (Join-Path $script:R 'summary.json')
Serial "CLEANVM-DONE cycle=$($script:Plan.cycle) $(@($summary.scenarios | ForEach-Object { "$($_.id)=$($_.result)" }) -join ' ')"
& shutdown.exe /s /t 15 /c 'cleanvm: cycle finished'
