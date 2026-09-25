# Clean VM guest harness - the scenarios. Dot-sourced by entry.ps1 after lib.ps1.
#
# Each scenario states what it expects (Expect), asserts what it observed (Check), and keeps the
# raw material (Evidence). A scenario is PASS only when every assertion it executed held and it
# executed at least one; see End-Scenario in lib.ps1.

$DEV_COMMANDS = 'rustc', 'cargo', 'rustup', 'node', 'npm', 'npx', 'git', 'cl', 'devenv', 'msbuild', 'nsis', 'makensis'
$DEV_DIRS = @(
    (Join-Path $env:USERPROFILE '.cargo'), (Join-Path $env:USERPROFILE '.rustup'),
    (Join-Path $env:ProgramFiles 'nodejs'), (Join-Path $env:ProgramFiles 'Git'),
    (Join-Path $env:ProgramFiles 'Microsoft Visual Studio'), (Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio'),
    (Join-Path ${env:ProgramFiles(x86)} 'Windows Kits'), (Join-Path ${env:ProgramFiles(x86)} 'NSIS'),
    (Join-Path $env:LOCALAPPDATA 'tauri'), 'C:\BuildTools'
)
$DEV_ENV = 'CARGO_HOME', 'RUSTUP_HOME', 'NODE_PATH', 'NVM_HOME', 'VSINSTALLDIR', 'VCToolsInstallDir', 'WindowsSdkDir', 'RUSTFLAGS'

# "Unchanged" means something only if the list was read at all: a query that failed silently
# (every inventory query runs with -ErrorAction SilentlyContinue, as a standard user) gives an
# empty list twice, and two empty lists are equal. So each inventory has to be populated to a
# floor a stock Windows 11 is far above, and must contain the harness's own Run value.
function Assert-InventoryPopulated($inv, [string]$label) {
    $floors = [ordered]@{ services = 100; services_windows_start = 100; scheduled_tasks = 50; firewall_rules = 100; uninstall_entries = 5; hklm_software = 5; environment = 5; hkcu_software = 3; autostart_extra = 8 }
    $short = @(foreach ($k in $floors.Keys) { $n = @(Prop $inv $k).Count; if ($n -lt $floors[$k]) { "$k=$n<$($floors[$k])" } })
    Check "$label inventory is populated (each surface read, not an empty failure)" ($short.Count -eq 0) (($floors.Keys | ForEach-Object { "$_>=$($floors[$_])" }) -join ' ') $(if ($short.Count) { $short -join ' ' } else { (($floors.Keys | ForEach-Object { "$_=$(@(Prop $inv $_).Count)" }) -join ' ') })
    Check "$label inventory sees the harness's own Run value (CleanVmAgent)" (@(@(Prop $inv 'run_keys') | Where-Object { $_ -match '\|CleanVmAgent=' }).Count -eq 1) 'present' (Short (Prop $inv 'run_keys'))
}

function Get-WorkDir { $d = Join-Path $env:LOCALAPPDATA 'cleanvm-work'; if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force $d | Out-Null }; $d }

function Get-EncastraUninstallEntries {
    @(foreach ($k in 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall') {
            Get-ChildItem -LiteralPath $k -ErrorAction SilentlyContinue | ForEach-Object { Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue } |
                Where-Object { (@($_.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'DisplayName') -and $_.DisplayName -match 'encastra' } |
                ForEach-Object { [pscustomobject]@{ hive = $k; key = $_.PSChildName; name = $_.DisplayName; version = $(if (@($_.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'DisplayVersion') { $_.DisplayVersion } else { '' }) } } })
}

function Get-IntegrityLevel {
    $groups = & whoami.exe /groups /fo csv | ConvertFrom-Csv
    $label = $groups | Where-Object { $_.'Group Name' -like 'Mandatory Label*' } | Select-Object -First 1
    if ($label) { $label.'Group Name' } else { 'unknown' }
}

function Get-InstallListing {
    if (-not (Test-Path -LiteralPath $script:InstallDir)) { return @() }
    @(Get-ChildItem -LiteralPath $script:InstallDir -Recurse -File -Force | ForEach-Object {
            [pscustomobject]@{ path = $_.FullName.Substring($script:InstallDir.Length + 1); size = $_.Length; sha256 = (Sha256 $_.FullName) } })
}

function Get-AppCrashEvents([datetime]$since) {
    @(Get-WinEvent -FilterHashtable @{ LogName = 'Application'; StartTime = $since } -ErrorAction SilentlyContinue |
            Where-Object { ($_.ProviderName -in 'Application Error', 'Windows Error Reporting', 'Application Hang') -and ($_.Message -match 'encastra|msedgewebview2') } |
            ForEach-Object { "$($_.TimeCreated.ToUniversalTime().ToString('o')) $($_.ProviderName) $($_.Id): $(Short $_.Message 300)" })
}

function Get-AppRemoteConnections {
    $pids = @(Get-AppProcesses | ForEach-Object { [int]$_.ProcessId })
    if ($pids.Count -eq 0) { return @() }
    @(Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $pids -contains [int]$_.OwningProcess } |
            Where-Object { $_.RemoteAddress -notin '127.0.0.1', '::1', '0.0.0.0', '::' } |
            ForEach-Object { "$($_.OwningProcess) $($_.LocalAddress):$($_.LocalPort) -> $($_.RemoteAddress):$($_.RemotePort) $($_.State)" })
}

# Base64 of UTF-8, decoded in the page: paths with backslashes, spaces and non-ASCII letters reach
# JavaScript exactly, with no quoting through three layers of command line.
function JsStr([string]$s) {
    $b64 = [Convert]::ToBase64String($script:Utf8.GetBytes($s))
    "decodeURIComponent(escape(atob('$b64')))"
}

function Invoke-Ipc([string]$cmd, [string]$argsJs = '{}', [int]$timeoutMs = 30000) {
    $js = "(async()=>{try{const r=await window.__TAURI_INTERNALS__.invoke('$cmd',$argsJs);return {ok:true,value:r};}catch(e){return {ok:false,error:(e&&typeof e==='object')?e:String(e)};}})()"
    $r = Cdp 'eval' $js $timeoutMs
    if (-not $r.ok) { return [pscustomobject]@{ ok = $false; transport = $r.error; error = $null; value = $null } }
    [pscustomobject]@{ ok = [bool]$r.value.ok; transport = $null; error = $(if (@($r.value.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'error') { $r.value.error } else { $null }); value = $(if (@($r.value.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'value') { $r.value.value } else { $null }) }
}

function Click-Text([string]$selector, [string]$regex) {
    $sel = JsStr $selector; $re = JsStr $regex
    $r = Cdp 'eval' "(()=>{const re=new RegExp($re,'i');const el=[...document.querySelectorAll($sel)].find(e=>re.test((e.innerText||e.textContent||'').trim()));if(!el)return 'none';el.click();return 'clicked: '+(el.innerText||'').trim().slice(0,60);})()"
    if ($r.ok) { [string]$r.value } else { "error: $($r.error)" }
}

function Page-Text { $r = Cdp 'eval' "(document.body&&document.body.innerText||'').replace(/\s+/g,' ').slice(0,4000)"; if ($r.ok) { [string]$r.value } else { '' } }

function Dismiss-Welcome {
    $w = Cdp 'eval' "!!document.querySelector('.welcome')"
    if ($w.ok -and $w.value) { Click-Text '.welcome__choice' '^(Skip|Omitir|Saltar)' } else { 'no welcome' }
}

function Set-LocaleThroughSettings([string]$pillRegex) {
    $steps = @()
    $steps += Click-Text '.sidebar__item' '^(Settings|Ajustes|Configuraci)'
    Start-Sleep -Milliseconds 800
    $steps += Click-Text 'button, [role=tab], a' '^(Language|Idioma)'
    Start-Sleep -Milliseconds 800
    $steps += Click-Text '.s-segmented button.pill' $pillRegex
    Start-Sleep -Seconds 2
    $steps -join ' | '
}

function Start-ReadyApp([switch]$Cdp, [hashtable]$ExtraEnv, [int]$timeoutSec = 90) {
    # WebView2 keeps one browser process per user-data folder, and the host that creates it fixes
    # its command line: starting next to a running copy would attach to a browser that has no
    # debugging port. So whatever is running is stopped first (CLEAN-010 starts a second copy on
    # purpose, with Start-App directly).
    Close-AppGracefully | Out-Null
    Stop-App | Out-Null
    $p = Start-App -Cdp:$Cdp -ExtraEnv $ExtraEnv
    $ok = Wait-Ready $p $timeoutSec
    [pscustomobject]@{ proc = $p; ready = $ok; detail = $script:LastReady }
}

function Get-ExpectedFor([string]$which) { if ($which -eq 'upgrade_from') { $script:Expected.upgrade_from } else { $script:Expected.installer } }

function Get-CdArtifact($art) { Join-Path $script:H "artifacts\$($art.file)" }

# ---------------------------------------------------------------------------------------------
# CLEAN-001 - the machine has never seen Encastra
# ---------------------------------------------------------------------------------------------
function Scenario-CLEAN001 {
    Run-Scenario 'CLEAN-001' 'Baseline: a Windows that has never seen Encastra' {
        $work = Get-WorkDir
        $marker = Join-Path $work 'cycle-marker.txt'
        if (Injected 'stale') { Set-Content -LiteralPath $marker -Value 'left by an earlier cycle (injected)' }
        if (Injected 'stray-process') {
            # A copy of cmd.exe under the product's name, kept alive by a long ping: a process that
            # stays up by itself, unlike a renamed GUI binary that may need resources beside it.
            $fake = Join-Path $work 'encastra-desktop.exe'
            Copy-Item -LiteralPath (Join-Path $env:SystemRoot 'System32\cmd.exe') -Destination $fake -Force
            Start-Process -FilePath $fake -ArgumentList '/c ping -n 3600 127.0.0.1 >nul' -WindowStyle Hidden | Out-Null
            Start-Sleep -Seconds 3
            Observe 'injected_stray_process_alive' (@(Get-Process encastra-desktop -ErrorAction SilentlyContinue).Count)
        }
        if (Injected 'preinstalled') {
            New-Item -ItemType Directory -Force $script:InstallDir | Out-Null
            Set-Content -LiteralPath $script:InstalledExe -Value 'not a real binary (injected)'
            $k = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Encastra-injected'
            New-Item -Path $k -Force | Out-Null; New-ItemProperty -Path $k -Name DisplayName -Value 'Encastra' -Force | Out-Null
        }
        Expect 'a fresh overlay of CLEAN_BASELINE (no marker from an earlier cycle)'
        Expect 'no file, folder, uninstall entry, shortcut, process or policy of Encastra'
        Expect 'no Rust, Node, Git, Visual Studio, Windows SDK or NSIS; developer mode off'
        Expect 'the harness runs with a filtered (medium integrity) token, as a person would'

        $q = Prop (Get-State) 'quiet'
        Check "Windows' own first-logon setup (OneDrive) had finished before the baseline" ([bool](Prop $q 'reached')) 'reached' (Short $q)
        Check 'no marker from an earlier cycle (fresh overlay of the base)' (-not (Test-Path -LiteralPath $marker)) 'absent' $(if (Test-Path $marker) { Get-Content $marker -Raw } else { 'absent' })
        $prov = 'C:\ProgramData\cleanvm-agent\provisioned.txt'
        Check 'this is the provisioned base image' (Test-Path -LiteralPath $prov) $prov $(if (Test-Path $prov) { (Get-Item $prov).LastWriteTimeUtc.ToString('o') } else { 'missing' })

        $named = @(Get-NamedFiles 'encastra' | Where-Object { -not (Test-HarnessPath $_) })
        Evidence 'encastra-named-files.txt' (($named -join "`r`n") + "`r`n") | Out-Null
        Check 'no file or folder named *encastra* anywhere on C:' ($named.Count -eq 0) 0 "$($named.Count): $(Short ($named | Select-Object -First 5))"
        $entries = @(Get-EncastraUninstallEntries)
        Check 'no Encastra uninstall entry in HKCU or HKLM' ($entries.Count -eq 0) 0 (Short $entries)
        $lnk = @(Get-ChildItem -LiteralPath (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu'), (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu'), ([Environment]::GetFolderPath('Desktop')), (Join-Path $env:PUBLIC 'Desktop') -Recurse -Filter '*encastra*' -ErrorAction SilentlyContinue)
        Check 'no Encastra shortcut' ($lnk.Count -eq 0) 0 $lnk.Count
        $procs = @(Get-AppProcesses)
        Check 'no Encastra or Encastra WebView2 process' ($procs.Count -eq 0) 0 (Short ($procs | ForEach-Object { $_.Name }))
        $pol = @((Get-Inventory -NoNameScan).webview2_policies | Where-Object { $_ -match 'encastra' })
        Check 'no WebView2 policy naming Encastra' ($pol.Count -eq 0) 0 (Short $pol)

        $cmds = @(foreach ($c in $DEV_COMMANDS) { $g = Get-Command $c -ErrorAction SilentlyContinue; if ($g) { "$c=$($g.Source)" } })
        Check 'no developer tool on PATH (rustc cargo rustup node npm npx git cl devenv msbuild makensis)' ($cmds.Count -eq 0) 'none' (Short $cmds)
        $dirs = @($DEV_DIRS | Where-Object { Test-Path -LiteralPath $_ })
        Check 'no developer tool installation directory' ($dirs.Count -eq 0) 'none' (Short $dirs)
        $envs = @(foreach ($e in $DEV_ENV) { $v = [Environment]::GetEnvironmentVariable($e); if ($v) { "$e=$v" } })
        Check 'no developer environment variable' ($envs.Count -eq 0) 'none' (Short $envs)
        $devmode = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock' -ErrorAction SilentlyContinue)
        $dm = if ($devmode -and (@($devmode.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'AllowDevelopmentWithoutDevLicense')) { $devmode.AllowDevelopmentWithoutDevLicense } else { 0 }
        Check 'developer mode is off' ($dm -ne 1) 'not 1' $dm
        $il = Get-IntegrityLevel
        Check 'the harness token is medium integrity (not elevated)' ($il -match 'Medium Mandatory') 'Mandatory Label\Medium Mandatory Level' $il
        # An expired evaluation licence powers Windows off every hour: an environment that would
        # restart on its own in the middle of a cycle is not a clean machine, it is a broken one.
        $lic = Get-CimInstance SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL AND ApplicationID='55c92734-d682-4d71-983e-d6ec3f16059f'" -ErrorAction SilentlyContinue | Select-Object -First 1
        $licDesc = if ($lic) { "$($lic.Name) status=$($lic.LicenseStatus) grace_minutes=$($lic.GracePeriodRemaining) eval_end=$($lic.EvaluationEndDate)" } else { 'no licensing product found' }
        Observe 'windows_licence' $licDesc
        foreach ($f in 'activation.txt', 'network.txt') {
            $p = Join-Path 'C:\ProgramData\cleanvm-agent' $f
            if (Test-Path -LiteralPath $p) { Evidence "base-$f" (Get-Content -LiteralPath $p -Raw) | Out-Null }
        }
        Check 'Windows licence usable for the whole cycle (not unlicensed/notification; more than a day of grace)' ($null -ne $lic -and $lic.LicenseStatus -notin 0, 5 -and $lic.GracePeriodRemaining -gt 1440) 'status 1..4 or 6, grace > 1440 min' $licDesc
        $runs = @((Get-Inventory -NoNameScan).run_keys)
        Check 'no autostart entry mentions Encastra' (@($runs | Where-Object { $_ -match 'encastra' }).Count -eq 0) 'none' (Short $runs)

        # The machine, recorded (environment.json is the cycle's record of it).
        $os = Get-CimInstance Win32_OperatingSystem
        $cv = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
        $wv2 = Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue
        $envRec = [ordered]@{
            taken = (Now); os_caption = $os.Caption; os_version = $os.Version; build = "$($cv.CurrentBuild).$($cv.UBR)"; display_version = $cv.DisplayVersion
            edition = $cv.EditionID; architecture = $os.OSArchitecture; install_date = $os.InstallDate.ToUniversalTime().ToString('o'); last_boot = $os.LastBootUpTime.ToUniversalTime().ToString('o')
            hostname = $env:COMPUTERNAME; user = "$env:USERDOMAIN\$env:USERNAME"; integrity = $il
            machine_guid = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Cryptography').MachineGuid
            ui_language = (Get-UICulture).Name; webview2_runtime = $(if ($wv2) { $wv2.pv } else { 'not registered' })
            dotnet_release = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -ErrorAction SilentlyContinue).Release
            powershell = $PSVersionTable.PSVersion.ToString()
            installed_programs = @((Get-Inventory -NoNameScan).uninstall_entries)
            network = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | ForEach-Object { "$($_.InterfaceAlias) $($_.IPAddress)/$($_.PrefixLength)" })
            disk_c_free_gb = [math]::Round((Get-PSDrive C).Free / 1GB, 1)
            path = $env:PATH
        }
        Save-Json $envRec (Join-Path $script:R 'environment.json')
        Observe 'windows' "$($envRec.os_caption) $($envRec.build) ($($envRec.display_version))"
        Observe 'webview2_runtime' $envRec.webview2_runtime
        Observe 'machine_guid' $envRec.machine_guid
        Set-Content -LiteralPath $marker -Value "cycle $($script:Plan.cycle) started $(Now)"
        $baseInv = Save-Inventory 'baseline'
        Assert-InventoryPopulated $baseInv 'baseline'
    }
}

# ---------------------------------------------------------------------------------------------
# CLEAN-002 - exactly the bytes that were published
# ---------------------------------------------------------------------------------------------
function Test-Artifact($art, [string]$label) {
    $path = Get-CdArtifact $art
    Check "$label installer present on the harness disc" (Test-Path -LiteralPath $path) $art.file $path
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    $sha = Sha256 $path
    Check "$label installer sha256 is the published digest" ($sha -eq $art.sha256) $art.sha256 $sha
    $sums = Join-Path $script:H "artifacts\$($art.sums_file)"
    $line = if (Test-Path -LiteralPath $sums) { Get-Content -LiteralPath $sums | Where-Object { $_ -match [regex]::Escape($art.file) } | Select-Object -First 1 } else { $null }
    Check "$label SHA256SUMS on the disc names this digest for this file" ($null -ne $line -and $line -match "^$($art.sha256)\s") "$($art.sha256)  $($art.file)" (Short $line)
    $idWhat = if ([bool](Prop $art 'dev_build')) { "LOCAL DEV BUILD's identity (tracked tree clean, stamp = HEAD) - not a release" } else { 'published identity (release digest = SHA256SUMS = RELEASE.md at the tag)' }
    Check "$label host verified the $idWhat" ([bool]$art.host_verified) 'true' (Short $art.host_evidence)
    $sig = Get-AuthenticodeSignature -LiteralPath $path
    Check "$label signature state is the documented one ($($art.signature))" ([string]$sig.Status -eq $art.signature) $art.signature $sig.Status
    # Where a person would have it: a copy in Downloads, re-hashed after the copy.
    $dl = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Downloads'
    if (-not (Test-Path $dl)) { New-Item -ItemType Directory -Force $dl | Out-Null }
    $copy = Join-Path $dl $art.file
    Copy-Item -LiteralPath $path -Destination $copy -Force
    $csha = Sha256 $copy
    Check "$label the copy in Downloads is byte-identical" ($csha -eq $art.sha256) $art.sha256 $csha
    Observe "$($label)_file" $art.file
    Observe "$($label)_sha256" $sha
    $copy
}

function Scenario-CLEAN002 {
    Run-Scenario 'CLEAN-002' 'Artifact integrity: the published bytes, and only those' {
        Expect "installer $($script:Expected.installer.file) sha256 $($script:Expected.installer.sha256), version $($script:Expected.installer.version)"
        $script:InstallerCopy = Test-Artifact $script:Expected.installer 'candidate'
        if ($script:Plan.mode -eq 'upgrade') {
            Expect "upgrade-from installer $($script:Expected.upgrade_from.file) sha256 $($script:Expected.upgrade_from.sha256)"
            $script:UpgradeFromCopy = Test-Artifact $script:Expected.upgrade_from 'upgrade_from'
        }
        Set-StateField 'installer_copy' $script:InstallerCopy
        if ($script:Plan.mode -eq 'upgrade') { Set-StateField 'upgrade_copy' $script:UpgradeFromCopy }
    }
}

# ---------------------------------------------------------------------------------------------
# Installing, the way install_check.ps1 does it, plus what only a clean machine can show
# ---------------------------------------------------------------------------------------------
function Invoke-InstallCheck([string]$installer, $art, [string]$logName, [string]$versionOverride) {
    $log = Join-Path $script:ScenarioDir $logName
    $version = if ($versionOverride) { $versionOverride } else { $art.version }
    $t0 = Get-Date
    $r = Invoke-HarnessScript (Join-Path $script:H 'verify\install_check.ps1') @('-Installer', $installer, '-ExpectedVersion', $version) $log 600 $null
    [void]$script:Cur.evidence.Add("scenarios/$($script:Cur.scenario_id)/$logName")
    $lines = Read-Log $log
    $pass = @($lines | Where-Object { $_ -match '^PASS' }); $fail = @($lines | Where-Object { $_ -match '^FAIL' })
    Check "install_check finished within 10 minutes (an elevation prompt would hang it)" (-not $r.timedOut) 'finished' $(if ($r.timedOut) { 'TIMED OUT' } else { "exit $($r.exit) in $([int]((Get-Date) - $t0).TotalSeconds)s" })
    Check 'install_check exit code' ($r.exit -eq 0) 0 $r.exit
    Check 'install_check reported no FAIL line' ($fail.Count -eq 0) 0 "$($fail.Count): $(Short ($fail | Select-Object -First 3))"
    foreach ($needle in 'installer signature state', 'silent install exit code', 'binary present', 'installed ProductVersion', 'uninstaller present', 'HKCU uninstall entry', 'nothing written under HKLM', 'Start Menu shortcut', 'launches and stays up') {
        $hit = @($pass | Where-Object { $_ -like "*$needle*" })
        Check "install_check PASS: $needle" ($hit.Count -ge 1) 'one PASS line' (Short ($hit | Select-Object -First 1))
    }
    $stampLine = $lines | Where-Object { $_ -like 'installed binary build stamp:*' } | Select-Object -First 1
    $stamp = if ($stampLine) { ($stampLine -split ':\s*', 2)[1].Trim() } else { '(none)' }
    Check 'build commit stamped in the installed binary' ($stamp -eq $art.build_commit) $art.build_commit $stamp
    if (Test-Path -LiteralPath $script:InstalledExe) {
        # docs/RELEASE.md: the installed copy is the published executable with Tauri's bundle-type
        # marker rewritten (..._UNK -> ..._NSS, 3 bytes). The host computed that exact expectation.
        $esha = Sha256 $script:InstalledExe
        Check 'installed executable = published executable with only the NSIS bundle marker rewritten' ($esha -eq $art.installed_exe_sha256) $art.installed_exe_sha256 $esha
    } else { Check 'installed executable exists' $false $script:InstalledExe 'missing' }
    $lines
}

function Assert-InstallFootprint($before, $after, [string]$what) {
    $d = Diff-List $before.uninstall_entries $after.uninstall_entries
    $enc = @($d.added | Where-Object { $_ -match '\|Encastra$' })
    Check "$what adds exactly one Encastra uninstall entry, under HKCU" ($enc.Count -eq 1 -and $enc[0] -like 'HKCU:*' -and @($d.added).Count -eq 1 -and @($d.removed).Count -eq 0) 'one HKCU entry' (Short $d)
    foreach ($cat in @($script:PersistenceSurfaces | Where-Object { $_ -notin 'uninstall_entries', 'shortcuts' })) {
        $dd = Diff-List $before.$cat $after.$cat
        Check "$what leaves $cat unchanged" (@($dd.added).Count -eq 0 -and @($dd.removed).Count -eq 0) 'no change' (Short $dd)
    }
    $ds = Diff-List $before.shortcuts $after.shortcuts
    $okLnk = @($ds.added | Where-Object { $_ -like '*\Start Menu\Programs\Encastra.lnk' -or $_ -like '*\Desktop\Encastra.lnk' })
    Check "$what adds only Encastra shortcuts (Start Menu, and Desktop if the installer makes one)" (@($ds.added).Count -eq $okLnk.Count -and @($ds.added | Where-Object { $_ -like '*\Start Menu\Programs\Encastra.lnk' }).Count -eq 1 -and @($ds.removed).Count -eq 0) 'Start Menu\Programs\Encastra.lnk' (Short $ds)
    $dh = Diff-List $before.hkcu_software $after.hkcu_software
    Check "$what adds no top-level HKCU\Software key other than the application's" (@($dh.added | Where-Object { $_ -notmatch 'encastra' }).Count -eq 0) 'none' (Short $dh)
    $dt = Diff-List $before.top_dirs $after.top_dirs
    $unexpected = @($dt.added | Where-Object { -not (Test-HarnessPath $_) -and $_ -notmatch '\\(Encastra|dev\.encastra\.app)$' -and $_ -notmatch '\\Downloads$' -and $_ -notmatch '\\AppData\\Local\\IconCache\.db$' })
    Observe "$($what)_new_top_dirs" @($dt.added)
    Check "$what creates no top-level folder other than Encastra's own" ($unexpected.Count -eq 0) 'Encastra, dev.encastra.app' (Short $unexpected)
}

function Scenario-CLEAN003 {
    Run-Scenario 'CLEAN-003' 'Fresh install, per-user, silent, from the published installer' {
        $st = Get-State
        Expect 'silent per-user install succeeds with no elevation, lands in %LOCALAPPDATA%\Encastra, one HKCU entry, Start Menu shortcut, nothing in HKLM'
        Expect 'the installed executable is the published executable, stamped with the build commit'
        $before = Load-Json (Join-Path $script:R 'inventory\baseline.json')
        $override = if (Injected 'wrong-version') { '0.0.0-injected' } else { $null }
        Invoke-InstallCheck $st.installer_copy $script:Expected.installer 'install.log' $override | Out-Null
        $listing = @(Get-InstallListing)
        Evidence 'install-dir.json' $listing | Out-Null
        Observe 'installed_files' @($listing | ForEach-Object { $_.path })
        Check 'install directory holds the executable and the uninstaller' (@($listing | Where-Object { $_.path -in 'encastra-desktop.exe', 'uninstall.exe' }).Count -eq 2) 'encastra-desktop.exe, uninstall.exe' (Short ($listing | ForEach-Object { $_.path }))
        # What really keeps HKLM, services and machine-wide state out of reach is that nothing runs
        # elevated: both the installer and the uninstaller it leaves must ask for no more than the
        # caller has (requestedExecutionLevel asInvoker in their embedded manifests).
        foreach ($pe in @(@('installer', $st.installer_copy), @('uninstaller', $script:Uninstaller))) {
            $txt = if (Test-Path -LiteralPath $pe[1]) { [IO.File]::ReadAllText($pe[1], [Text.Encoding]::GetEncoding(28591)) } else { '' }
            $lvl = [regex]::Match($txt, 'requestedExecutionLevel\s+level="([A-Za-z]+)"').Groups[1].Value
            Check "the $($pe[0]) asks for no elevation (manifest requestedExecutionLevel asInvoker)" ($lvl -eq 'asInvoker') 'asInvoker' $(if ($lvl) { $lvl } else { 'no manifest level found' })
        }
        $acl = (& icacls.exe $script:InstallDir) -join ' | '
        Observe 'install_dir_acl' $acl
        $after = Save-Inventory 'post-install'
        Assert-InstallFootprint $before $after 'the install'
        if (Injected 'persist') {
            New-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'Encastra-injected' -Value $script:InstalledExe -Force | Out-Null
        }
    }
}

# ---------------------------------------------------------------------------------------------
# CLEAN-004 - first launch on a machine with no developer anything
# ---------------------------------------------------------------------------------------------
function Scenario-CLEAN004 {
    Run-Scenario 'CLEAN-004' 'First launch: reaches ready with nothing but Windows underneath' {
        $t0 = (Get-Date).AddMinutes(-15)
        Expect 'the copy install_check started is up; a harness launch renders the interface and answers IPC; first-run welcome shown'
        Expect 'every module loaded comes from Windows, the WebView2 runtime, or the install directory; no crash report; no outbound connection'
        $running = @(Get-Process encastra-desktop -ErrorAction SilentlyContinue)
        Check 'the copy install_check launched is still running' ($running.Count -ge 1) '>= 1 process' $running.Count
        $left = Stop-App
        Check 'stopping it leaves no Encastra or WebView2 process' ($left -eq 0) 0 $left
        $extra = if (Injected 'not-ready') { @{ WEBVIEW2_BROWSER_EXECUTABLE_FOLDER = 'C:\no-webview2-here-injected' } } else { $null }
        $a = Start-ReadyApp -Cdp -ExtraEnv $extra
        Check 'the application reaches ready (interface rendered, IPC round trip)' $a.ready 'bar=True ipc=ok' (Short $a.detail)
        if ($a.ready) { Check 'first-run welcome is shown on a fresh profile' ([bool](Prop $a.detail 'welcome')) 'welcome=True' (Short $a.detail) }
        Save-Screenshot 'first-launch'
        Start-Sleep -Seconds 20
        $p = Get-Process encastra-desktop -ErrorAction SilentlyContinue | Select-Object -First 1
        Check 'still running 20 s after ready' ($null -ne $p) 'running' $(if ($p) { "pid $($p.Id)" } else { 'gone' })
        if ($p) {
            $mods = @($p.Modules | ForEach-Object { $_.FileName })
            Evidence 'host-modules.txt' (($mods -join "`r`n") + "`r`n") | Out-Null
            $bad = @($mods | Where-Object { $_ -notlike "$env:SystemRoot\*" -and $_ -notlike "$($script:InstallDir)\*" -and $_ -notlike "${env:ProgramFiles(x86)}\Microsoft\EdgeWebView\*" -and $_ -notlike "$env:ProgramFiles\WindowsApps\*" -and $_ -notlike "$env:CommonProgramFiles\microsoft shared\*" })
            Check 'host process loads modules only from Windows, the install directory and the WebView2 runtime' ($bad.Count -eq 0) 'none elsewhere' "$($mods.Count) modules; outside: $(Short $bad)"
            $dev = @($mods | Where-Object { $_ -match 'nodejs|\\\.cargo|\\\.rustup|Visual Studio|Windows Kits' -or $_ -like "$($script:H)*" })
            Check 'no module from a developer toolchain or from the harness disc' ($dev.Count -eq 0) 'none' (Short $dev)
        }
        $web = @(Get-AppProcesses | Where-Object { $_.Name -eq 'msedgewebview2.exe' })
        $foreignWeb = @($web | Where-Object { $_.ExecutablePath -notlike "${env:ProgramFiles(x86)}\Microsoft\EdgeWebView\Application\*" })
        Check 'WebView2 browser processes for this application run from the Windows WebView2 runtime' ($web.Count -ge 1 -and $foreignWeb.Count -eq 0) '>= 1, all under Program Files (x86)\Microsoft\EdgeWebView\Application' "$($web.Count); $(Short ($web | Select-Object -First 1 -ExpandProperty ExecutablePath)); elsewhere: $(Short ($foreignWeb | ForEach-Object { $_.ExecutablePath }))"
        $conn = @(Get-AppRemoteConnections)
        Check 'no connection from the application to anything but loopback' ($conn.Count -eq 0) 'none' (Short $conn)
        $crash = @(Get-AppCrashEvents $t0)
        Check 'no Application Error / WER / Hang event for Encastra or its WebView2' ($crash.Count -eq 0) 0 (Short $crash)
        $ver = Cdp 'eval' "navigator.userAgent"
        Observe 'webview_user_agent' $(if ($ver.ok) { $ver.value } else { $ver.error })
    }
}

# ---------------------------------------------------------------------------------------------
# CLEAN-005 - the core flows, through the interface (scripts/verify/gui_journeys.ps1)
# ---------------------------------------------------------------------------------------------
function Invoke-Journeys([int]$repeat, [string]$logName) {
    Stop-App | Out-Null
    $log = Join-Path $script:ScenarioDir $logName
    $env_ = @{ GITHUB_ACTIONS = 'true'; PATH = "$($script:ToolsDir);$($script:CleanPath)" }
    $t0 = Get-Date
    if (Injected 'hidden-fail') {
        # A log that says everything passed, exits 0, and has one FAIL buried in the middle.
        $fake = @("SUBJECT exe=$($script:InstalledExe) sha256=$($script:Expected.installer.installed_exe_sha256) stamp=$($script:Expected.installer.build_commit) version=$($script:Expected.installer.version)")
        $fake += 1..60 | ForEach-Object { "PASS  j$((($_ % 5) + 1)) step $_ -> ok  [iteration 1/1]" }
        $fake[30] = 'FAIL  j3 import landed in the library -> nothing (injected)  [iteration 1/1]'
        $fake += "SUMMARY  passed=60 failed=0 skipped=0  repeat=$repeat  stamp=$($script:Expected.installer.build_commit)"
        [IO.File]::WriteAllLines($log, [string[]]$fake)
        $r = [pscustomobject]@{ exit = 0; timedOut = $false }
    } else {
        $r = Invoke-HarnessScript (Join-Path $script:H 'verify\gui_journeys.ps1') @('-Launch', '-Repeat', "$repeat") $log (150 * 60) $env_
    }
    [void]$script:Cur.evidence.Add("scenarios/$($script:Cur.scenario_id)/$logName")
    $cleanup = Join-Path $script:ScenarioDir "$logName.policy-cleanup.log"
    $rc = Invoke-HarnessScript (Join-Path $script:H 'verify\gui_journeys.ps1') @('-RemovePolicyOnly') $cleanup 300 $env_
    [void]$script:Cur.evidence.Add("scenarios/$($script:Cur.scenario_id)/$logName.policy-cleanup.log")
    Stop-App | Out-Null
    $lines = Read-Log $log
    $summary = $lines | Where-Object { $_ -match '^SUMMARY\s' } | Select-Object -Last 1
    $subject = $lines | Where-Object { $_ -match '^SUBJECT\s' } | Select-Object -First 1
    $fails = @($lines | Where-Object { $_ -match '^(FAIL|SKIP)' })
    $passes = @($lines | Where-Object { $_ -match '^PASS' })
    Check 'gui_journeys finished within its time limit' (-not $r.timedOut) 'finished' $(if ($r.timedOut) { 'TIMED OUT' } else { "exit $($r.exit) in $([int]((Get-Date) - $t0).TotalMinutes) min" })
    Check 'gui_journeys exit code' ($r.exit -eq 0) 0 $r.exit
    Check 'gui_journeys printed a SUMMARY line (the run reached its end)' ($null -ne $summary) 'SUMMARY ...' (Short $summary)
    $m = if ($summary) { [regex]::Match($summary, 'passed=(\d+) failed=(\d+) skipped=(\d+)\s+repeat=(\d+)\s+stamp=(\S+)') } else { $null }
    Check 'SUMMARY: failed=0 skipped=0' ($null -ne $m -and $m.Success -and $m.Groups[2].Value -eq '0' -and $m.Groups[3].Value -eq '0') 'failed=0 skipped=0' (Short $summary)
    Check "SUMMARY: repeat=$repeat" ($null -ne $m -and $m.Success -and [int]$m.Groups[4].Value -eq $repeat) $repeat (Short $summary)
    Check 'SUMMARY stamp is the expected build commit' ($null -ne $m -and $m.Success -and $m.Groups[5].Value -eq $script:Expected.installer.build_commit) $script:Expected.installer.build_commit (Short $summary)
    Check 'no FAIL or SKIP line anywhere in the log (not only in the SUMMARY)' ($fails.Count -eq 0) 0 "$($fails.Count): $(Short ($fails | Select-Object -First 3))"
    Check 'the SUMMARY pass count equals the PASS lines in the log' ($null -ne $m -and $m.Success -and [int]$m.Groups[1].Value -eq $passes.Count) $passes.Count (Short $summary)
    $minPass = [int]$script:Plan.journeys_min_pass_per_iteration * $repeat
    Check "at least $minPass PASS lines ($($script:Plan.journeys_min_pass_per_iteration) per iteration)" ($passes.Count -ge $minPass) ">= $minPass" $passes.Count
    Check 'SUBJECT names the installed executable by its expected hash and stamp' ($null -ne $subject -and $subject -match "sha256=$($script:Expected.installer.installed_exe_sha256)" -and $subject -match "stamp=$($script:Expected.installer.build_commit)") "sha256=$($script:Expected.installer.installed_exe_sha256)" (Short $subject)
    foreach ($j in 1..5) {
        $jp = @($passes | Where-Object { $_ -match "^PASS\s+j$j\b" })
        Check "journey j$j has PASS lines" ($jp.Count -ge 1) '>= 1' $jp.Count
    }
    # What Windows recorded while the journeys ran: every Application-log event from the host or
    # its WebView2, and any Windows Error Reporting folder naming them. A journey that dies because
    # the application went away has to say whether it crashed or was closed.
    $events = @(Get-WinEvent -FilterHashtable @{ LogName = 'Application'; StartTime = $t0 } -ErrorAction SilentlyContinue |
            Where-Object { $_.Message -match 'encastra|msedgewebview2|WebView2' -or $_.ProviderName -match 'Error|WER|Hang' } |
            ForEach-Object { "$($_.TimeCreated.ToUniversalTime().ToString('o')) [$($_.ProviderName) $($_.Id) $($_.LevelDisplayName)] $($_.Message)" })
    $wer = @(foreach ($d in (Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\WER'), (Join-Path $env:ProgramData 'Microsoft\Windows\WER')) {
            Get-ChildItem -LiteralPath $d -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge $t0 } | ForEach-Object { $_.FullName } })
    Evidence "$logName.windows-events.txt" ((@($events) + @('--- WER files ---') + @($wer)) -join "`r`n") | Out-Null
    $crash = @(Get-AppCrashEvents $t0)
    Check 'no Application Error / WER / Hang event for Encastra or its WebView2 during the journeys' ($crash.Count -eq 0) 0 (Short $crash)
    Check 'the debugging-port policy was taken back afterwards' ($rc.exit -eq 0 -and -not $rc.timedOut) 0 $rc.exit
    $pol = @((Get-Inventory -NoNameScan).webview2_policies | Where-Object { $_ -match 'encastra' })
    Check 'no WebView2 policy naming Encastra is left' ($pol.Count -eq 0) 0 (Short $pol)
    $lines
}

function Scenario-CLEAN005 {
    Run-Scenario 'CLEAN-005' 'Core flows through the interface: choose, publish, import, grant, run, and the refusals' {
        $rep = [int]$script:Plan.journeys_repeat
        Expect "gui_journeys.ps1 -Launch -Repeat $rep on the installed copy: every journey PASS, no FAIL/SKIP, stamp = build commit"
        $lines = Invoke-Journeys $rep 'gui-journeys.log'
        $refusals = @($lines | Where-Object { $_ -match '^PASS' -and $_ -match 'refus|not chosen|was not picked|outside' })
        Check 'the refusals were exercised (a folder nobody chose is refused)' ($refusals.Count -ge 1) '>= 1 PASS line about a refusal' "$($refusals.Count): $(Short ($refusals | Select-Object -First 2))"
    }
}

# ---------------------------------------------------------------------------------------------
# CLEAN-006 - what a person set survives closing and reopening
# ---------------------------------------------------------------------------------------------
function Get-PersistedState {
    $ls = Get-LocalStorageDump
    $lib = Invoke-Ipc 'library_list'
    # Built outside the if: an if statement unrolls a one-element array into a scalar.
    $ids = @()
    if ($lib.ok -and $lib.value -and (@($lib.value.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'entries')) { $ids = @($lib.value.entries | ForEach-Object { ($_.entry | ConvertTo-Json -Compress -Depth 4) }) }
    $prefs = $null
    if ($ls -and (@($ls.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'encastra.preferences')) { try { $prefs = $ls.'encastra.preferences' | ConvertFrom-Json } catch { } }
    [pscustomobject]@{
        locale = $(if ($ls -and (@($ls.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'encastra.locale')) { $ls.'encastra.locale' } else { $null })
        preferences = $(if ($ls -and (@($ls.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'encastra.preferences')) { $ls.'encastra.preferences' } else { $null })
        welcome_seen = $(if ($prefs) { $prefs.welcomeSeen } else { $null })
        library_ok = $lib.ok; library = $ids
        text = (Page-Text)
    }
}

function Scenario-CLEAN006 {
    Run-Scenario 'CLEAN-006' 'Persistence: close, reopen, what was set is still set' {
        Expect 'welcome dismissed + language switched to Espanol through Settings survive a graceful close and a relaunch; the library listing is unchanged'
        $a = Start-ReadyApp -Cdp
        Check 'ready before the changes' $a.ready 'ready' (Short $a.detail)
        Observe 'welcome' (Dismiss-Welcome)
        $steps = Set-LocaleThroughSettings '^Espa.ol$'
        Observe 'settings_clicks' $steps
        $before = Get-PersistedState
        Evidence 'state-before-close.json' $before | Out-Null
        Check 'the language choice was saved by the application' ($before.locale -eq 'es') 'es' $before.locale
        Check 'the interface is now in Spanish' ($before.text -match 'Biblioteca|Ajustes|Constructor|Inicio') 'Spanish labels' (Short $before.text 200)
        Check 'welcomeSeen was saved' ($before.welcome_seen -eq $true) 'true' $before.welcome_seen
        $closed = Close-AppGracefully
        Check 'graceful close (WM_CLOSE) ends the process' ($closed -like 'exited*') 'exited' $closed
        Start-Sleep -Seconds 3
        $left = @(Get-AppProcesses)
        Check 'no Encastra or WebView2 process left after the close' ($left.Count -eq 0) 0 (Short ($left | ForEach-Object { "$($_.Name) $($_.ProcessId)" }))
        $b = Start-ReadyApp -Cdp
        Check 'ready after relaunch' $b.ready 'ready' (Short $b.detail)
        $after = Get-PersistedState
        Evidence 'state-after-relaunch.json' $after | Out-Null
        Check 'language still Espanol after relaunch' ($after.locale -eq 'es') 'es' $after.locale
        Check 'interface still in Spanish after relaunch' ($after.text -match 'Biblioteca|Ajustes|Constructor|Inicio') 'Spanish labels' (Short $after.text 200)
        Check 'welcome not shown again' ($b.ready -and -not [bool](Prop $b.detail 'welcome')) 'ready, welcome=False' (Short $b.detail)
        Check 'preferences identical after relaunch' ($null -ne $before.preferences -and $after.preferences -eq $before.preferences) (Short $before.preferences) (Short $after.preferences)
        Check 'library listing identical after relaunch' ($before.library_ok -and $after.library_ok -and (@($after.library) -join "`n") -eq (@($before.library) -join "`n")) "read both times; $(@($before.library).Count) entries" "ok=$($before.library_ok)/$($after.library_ok); $(@($after.library).Count) entries"
        Save-Screenshot 'after-relaunch'
    }
}

# ---------------------------------------------------------------------------------------------
# CLEAN-007 - a real Windows restart in the middle
# ---------------------------------------------------------------------------------------------
function Step-PreReboot {
    $a = Start-ReadyApp -Cdp
    $state = if ($a.ready) { Get-PersistedState } else { $null }
    Close-AppGracefully | Out-Null
    Stop-App | Out-Null
    $pre = [ordered]@{
        at = (Now); last_boot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime().ToString('o')
        ready = $a.ready; state = $state; install = @(Get-InstallListing)
    }
    Save-Json $pre (Join-Path $script:R 'pre-reboot.json')
    Serial "REBOOT requested by the harness (pre-reboot state saved; ready=$($a.ready))"
}

function Scenario-CLEAN007 {
    Run-Scenario 'CLEAN-007' 'Restart: Windows restarts, the application and its state come back intact' {
        $pre = Load-Json (Join-Path $script:R 'pre-reboot.json')
        $ps = Prop $pre 'state'
        Expect 'a real reboot happened; nothing of Encastra started by itself; install bytes unchanged; state unchanged; the application works'
        Check 'pre-reboot state was recorded while the application was ready' ($null -ne $pre -and [bool](Prop $pre 'ready')) 'ready' $(if ($pre) { Prop $pre 'ready' } else { 'no record' })
        Check 'pre-reboot state was actually read (language es, preferences, library)' ((Prop $ps 'locale') -eq 'es' -and $null -ne (Prop $ps 'preferences') -and [bool](Prop $ps 'library_ok')) 'es, preferences present, library read' (Short $ps)
        $boot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime()
        $lastBoot = Prop $pre 'last_boot'
        Check 'Windows really restarted (LastBootUpTime moved forward)' ($null -ne $lastBoot -and $boot -gt ([datetime]::Parse($lastBoot).ToUniversalTime())) "> $lastBoot" $boot.ToString('o')
        $auto = @(Get-AppProcesses)
        Check 'Encastra did not start by itself at logon' ($auto.Count -eq 0) 0 $auto.Count
        $now = @(Get-InstallListing)
        $preInstall = @(Prop $pre 'install')
        $same = $preInstall.Count -gt 0 -and (($now | ForEach-Object { "$($_.path)=$($_.sha256)" }) -join "`n") -eq (($preInstall | ForEach-Object { "$($_.path)=$($_.sha256)" }) -join "`n")
        Check 'installed files byte-identical across the restart' $same "$($preInstall.Count) files" "$($now.Count) files"
        $a = Start-ReadyApp -Cdp
        Check 'ready after the restart' $a.ready 'ready' (Short $a.detail)
        $st = Get-PersistedState
        Evidence 'state-after-reboot.json' $st | Out-Null
        Check 'language unchanged across the restart' ($null -ne (Prop $ps 'locale') -and $st.locale -eq (Prop $ps 'locale')) (Prop $ps 'locale') $st.locale
        Check 'preferences unchanged across the restart' ($null -ne (Prop $ps 'preferences') -and $st.preferences -eq (Prop $ps 'preferences')) (Short (Prop $ps 'preferences')) (Short $st.preferences)
        Check 'library unchanged across the restart' ([bool](Prop $ps 'library_ok') -and $st.library_ok -and (@($st.library) -join "`n") -eq (@(Prop $ps 'library') -join "`n")) "$(@(Prop $ps 'library').Count)" "ok=$($st.library_ok); $(@($st.library).Count)"
        Save-Screenshot 'after-reboot'
        Close-AppGracefully | Out-Null
        Invoke-Journeys 1 'gui-journeys-after-reboot.log' | Out-Null
    }
}

# ---------------------------------------------------------------------------------------------
# CLEAN-008 - errors a person can cause, and one the disk can cause
# ---------------------------------------------------------------------------------------------
# The application's own refusals are structured: {kind:<area>, error:{kind:<what>}} or
# {kind:'grants-refused', refusals:[{kind:<why>}]} (apps/desktop/src-tauri/src/error.rs). Tauri's
# plumbing errors - an unknown command, a missing or renamed argument, a denied capability - are
# plain strings, and a JavaScript exception serialises as {}. Only the first kind counts as the
# boundary having been evaluated, so the kind is flattened to 'area/what/refusal,...' and must
# match what the call is expected to be refused FOR.
function Get-ErrorKinds($err) {
    if ($null -eq $err -or $err -is [string]) { return $null }
    $k = Prop $err 'kind'
    if (-not $k) { return $null }
    $inner = Prop (Prop $err 'error') 'kind'
    $refs = @(@(Prop $err 'refusals') | Where-Object { $_ } | ForEach-Object { Prop $_ 'kind' })
    "$k/$inner/$($refs -join ',')"
}

function Test-Refused([string]$what, $res, [string]$expectKinds) {
    $kinds = Get-ErrorKinds $res.error
    $ok = (-not $res.ok) -and ($null -eq $res.transport) -and ($null -ne $kinds) -and ($kinds -match $expectKinds)
    Check $what $ok "refused with a structured error matching '$expectKinds'" $(if ($res.transport) { "transport: $($res.transport)" } elseif ($res.ok) { "ACCEPTED: $(Short $res.value 200)" } else { "refused: kinds=$kinds $(Short $res.error 200)" })
}

function Assert-StillReady([string]$after) {
    $r = Cdp 'eval' $READY_JS 15000
    $ok = $r.ok -and (Prop $r.value 'bar') -and ((Prop $r.value 'ipc') -like 'ok*')
    Check "still ready after $after" $ok 'bar=True ipc=ok' $(if ($r.ok) { Short $r.value } else { $r.error })
}

function Get-LibraryIndexFiles {
    $root = Join-Path $script:AppDataRoaming 'library'
    @(Get-ChildItem -LiteralPath $root -File -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike '*.tmp' })
}

function Scenario-CLEAN008 {
    Run-Scenario 'CLEAN-008' 'Error handling: bad input and damaged state give clear errors, no crash, no data loss' {
        $t0 = Get-Date
        Expect 'IPC given a missing file, a non-project, a damaged project, an unchosen folder: each refused with a named error, the application stays ready'
        Expect 'damaged preferences: the application starts on defaults. Damaged library index: the application starts, says the library cannot be read, and does not overwrite it'
        $a = Start-ReadyApp -Cdp
        Check 'ready' $a.ready 'ready' (Short $a.detail)
        $work = Get-WorkDir
        $junk = Join-Path $work 'damaged.encastra'
        [IO.File]::WriteAllBytes($junk, [byte[]](0..255 | ForEach-Object { [byte]((($_ * 37) + 11) % 256) }))
        Test-Refused 'open a project that does not exist' (Invoke-Ipc 'open_project' "{path:$(JsStr (Join-Path $work 'no-such-project.encastra'))}") '^project/io/'
        Test-Refused 'open something that is not a project (win.ini)' (Invoke-Ipc 'open_project' "{path:$(JsStr 'C:\Windows\win.ini')}") '^not-a-project/'
        Test-Refused 'open a damaged .encastra file' (Invoke-Ipc 'open_project' "{path:$(JsStr $junk)}") '^project/archive/'
        Test-Refused 'import from a folder nobody chose' (Invoke-Ipc 'import_publication' "{folder:$(JsStr $work)}") '^import/folder-not-chosen/'
        Assert-StillReady 'the refused calls'

        # Damaged preferences.
        $w = Cdp 'eval' "(()=>{localStorage.setItem('encastra.preferences','{not json at all');localStorage.setItem('encastra.locale','xx-not-a-locale');return localStorage.getItem('encastra.preferences');})()"
        Check 'preferences overwritten with garbage (setup)' ($w.ok -and $w.value -eq '{not json at all') '{not json at all' $(if ($w.ok) { $w.value } else { $w.error })
        Close-AppGracefully | Out-Null; Stop-App | Out-Null
        $b = Start-ReadyApp -Cdp
        Check 'starts and reaches ready with damaged preferences' $b.ready 'ready' (Short $b.detail)
        $lang = Cdp 'eval' "document.documentElement.lang"
        Observe 'lang_after_bad_locale' $(if ($lang.ok) { $lang.value } else { $lang.error })
        Check 'falls back to defaults (first-run welcome shows again)' ([bool](Prop $b.detail 'welcome')) 'welcome=True' (Short $b.detail)
        Dismiss-Welcome | Out-Null

        # Damaged library index. The contract (crates/encastra-library, Library::load_or_quarantine,
        # used by LibraryHandle::open): an index that does not parse is RENAMED to
        # library.json.corrupt-<ms>, never deleted or overwritten; the application starts with an
        # empty library and says, once, what it set aside.
        $root = Join-Path $script:AppDataRoaming 'library'
        $target = Join-Path $root 'library.json'
        Observe 'library_root_files' @(Get-ChildItem -LiteralPath $root -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
        if (-not (Test-Path -LiteralPath $target)) {
            Check 'a library index exists to damage (the journeys import into the library)' $false $target 'absent'
        } else {
            $orig = [IO.File]::ReadAllBytes($target)
            Close-AppGracefully | Out-Null; Stop-App | Out-Null
            $bad = $script:Utf8.GetBytes('{"entries": [ this is not json')
            [IO.File]::WriteAllBytes($target, $bad)
            $badSha = Sha256 $target
            $c = Start-ReadyApp -Cdp
            Check 'starts and reaches ready with a damaged library index' $c.ready 'ready' (Short $c.detail)
            Start-Sleep -Seconds 3
            Click-Text '.sidebar__item' '^(Library|Biblioteca)' | Out-Null
            Start-Sleep -Seconds 3
            $txt = Page-Text
            $moved = @(Get-ChildItem -LiteralPath $root -Filter 'library.json.corrupt-*' -File -Force -ErrorAction SilentlyContinue)
            Check 'the unreadable index was moved aside, not deleted (library.json.corrupt-*)' ($moved.Count -eq 1) 1 (Short ($moved | ForEach-Object { $_.Name }))
            if ($moved.Count -ge 1) {
                $msha = Sha256 $moved[0].FullName
                Check 'the file moved aside holds exactly the bytes that could not be read' ($msha -eq $badSha) $badSha $msha
                Copy-Item -LiteralPath $moved[0].FullName -Destination (Join-Path $script:ScenarioDir 'quarantined-index.bin')
            }
            Check 'the interface tells the person the library index was set aside' ($txt -match 'set aside|could not be read|se apart|no se pudo leer') 'set aside ... could not be read' (Short $txt 400)
            $lib = Invoke-Ipc 'library_list'
            Check 'the library now reads as a new, empty one' ($lib.ok -and @($lib.value.entries).Count -eq 0) 'ok, 0 entries' $(if ($lib.ok) { "entries=$(@($lib.value.entries).Count)" } else { Short $lib.error })
            Save-Screenshot 'damaged-library'
            Assert-StillReady 'reading a damaged library'
            # Put the person's library back the way it was, for the scenarios that follow.
            Close-AppGracefully | Out-Null; Stop-App | Out-Null
            foreach ($m in $moved) { Remove-Item -LiteralPath $m.FullName -Force }
            [IO.File]::WriteAllBytes($target, $orig)
            $d = Start-ReadyApp -Cdp
            $lib2 = Invoke-Ipc 'library_list'
            Check 'with the index restored the library reads again' ($d.ready -and $lib2.ok) 'ok' $(if ($lib2.ok) { "entries=$(@($lib2.value.entries).Count)" } else { Short $lib2.error })
        }
        $crash = @(Get-AppCrashEvents $t0)
        Check 'no crash event during the error cases' ($crash.Count -eq 0) 0 (Short $crash)
        Close-AppGracefully | Out-Null; Stop-App | Out-Null
    }
}

# ---------------------------------------------------------------------------------------------
# CLEAN-009 - where the application may and may not touch the filesystem
# ---------------------------------------------------------------------------------------------
function Scenario-CLEAN009 {
    Run-Scenario 'CLEAN-009' 'Filesystem boundaries: valid unusual paths work, unchosen/protected/missing/read-only/locked paths are refused cleanly' {
        $t0 = Get-Date
        Expect 'no folder chosen in this process: every folder-scoped call is refused, including traversal and \\?\ forms'
        Expect 'a project saves to and reopens from a path with spaces and non-ASCII letters; saving into C:\Windows, a missing folder or over a read-only file fails with an error and writes nothing'
        Expect 'a locked library index gives an error, not a crash'
        $a = Start-ReadyApp -Cdp
        Check 'ready' $a.ready 'ready' (Short $a.detail)
        $work = Get-WorkDir
        $docs = [Environment]::GetFolderPath('MyDocuments')
        $targets = @('C:\Windows', $docs, "$($script:AppDataRoaming)\library\imports\..\..\..", '..\..\..\Windows', '\\?\C:\Windows', 'C:\Windows\System32\..\System32')
        foreach ($t in $targets) { Test-Refused "import_publication from unchosen '$t'" (Invoke-Ipc 'import_publication' "{folder:$(JsStr $t)}") '^import/(folder-not-chosen|not-a-folder)/' }

        # A real graph: the project the journeys saved.
        $proj = Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE 'encastra-journeys') -Recurse -Filter *.encastra -File -ErrorAction SilentlyContinue | Select-Object -First 1
        Check 'a project saved by the journeys exists to work with' ($null -ne $proj) '*.encastra under %USERPROFILE%\encastra-journeys' $(if ($proj) { $proj.FullName } else { 'none' })
        if ($proj) {
            $open = Invoke-Ipc 'open_project' "{path:$(JsStr $proj.FullName)}"
            Check 'the journeys project opens' $open.ok 'ok' $(if ($open.ok) { "name=$($open.value.name)" } else { Short $open.error })
            if ($open.ok) {
                $gj = "(await window.__TAURI_INTERNALS__.invoke('open_project',{path:$(JsStr $proj.FullName)})).graph"
                # Grants naming folders nobody chose, for every node of that graph.
                foreach ($t in 'C:\Windows', $docs, '\\?\C:\Windows') {
                    $js = "(async()=>{const g=$gj;const grants=Object.keys(g.nodes||{}).map(n=>({node:n,kind:'filesystem',folder:$(JsStr $t)}));try{const r=await window.__TAURI_INTERNALS__.invoke('run_graph',{graph:g,inputs:[],grants});return {ok:true,value:r,n:grants.length};}catch(e){return {ok:false,error:e,n:grants.length};}})()"
                    $r = Cdp 'eval' $js 60000
                    $res = if ($r.ok) { [pscustomobject]@{ ok = [bool]$r.value.ok; transport = $null; error = $(if (@($r.value.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'error') { $r.value.error } else { $null }); value = $(if (@($r.value.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'value') { $r.value.value } else { $null }) } } else { [pscustomobject]@{ ok = $false; transport = $r.error; error = $null; value = $null } }
                    # Every refusal must be about the folder, not e.g. 'not-declared'.
                    Test-Refused "run_graph with grants to unchosen '$t'" $res '^grants-refused//(folder-not-chosen|folder-unusable)(,(folder-not-chosen|folder-unusable))*$'
                }
                # Valid unusual path: spaces and non-ASCII letters.
                $odd = Join-Path $work ([string]::Concat('Proyecto de prueba ', [char]0x00F1, [char]0x00E9, ' ', [char]0x6F22, [char]0x5B57))
                New-Item -ItemType Directory -Force -Path $odd | Out-Null
                $oddFile = Join-Path $odd 'prueba.encastra'
                $save = Cdp 'eval' "(async()=>{const g=$gj;try{const r=await window.__TAURI_INTERNALS__.invoke('save_project',{path:$(JsStr $oddFile),name:'prueba',graph:g,label:null});return {ok:true,name:r.name};}catch(e){return {ok:false,error:e};}})()" 60000
                Check 'save_project to a path with spaces and non-ASCII letters succeeds' ($save.ok -and $save.value.ok -and (Test-Path -LiteralPath $oddFile)) 'saved, file exists' $(if ($save.ok) { Short $save.value } else { $save.error })
                $re = Invoke-Ipc 'open_project' "{path:$(JsStr $oddFile)}"
                Check 'and reopens from there' $re.ok 'ok' $(if ($re.ok) { "name=$($re.value.name)" } else { Short $re.error })
                foreach ($case in @(
                        @{ what = 'save_project into C:\Windows (protected)'; path = 'C:\Windows\cleanvm-should-not-exist.encastra' },
                        @{ what = 'save_project into a folder that does not exist'; path = (Join-Path $work 'no-such-folder\x.encastra') })) {
                    $s = Cdp 'eval' "(async()=>{const g=$gj;try{await window.__TAURI_INTERNALS__.invoke('save_project',{path:$(JsStr $case.path),name:'x',graph:g,label:null});return {ok:true};}catch(e){return {ok:false,error:e};}})()" 60000
                    $res = if ($s.ok) { [pscustomobject]@{ ok = [bool]$s.value.ok; transport = $null; error = $(if (@($s.value.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'error') { $s.value.error } else { $null }); value = $null } } else { [pscustomobject]@{ ok = $false; transport = $s.error; error = $null; value = $null } }
                    Test-Refused $case.what $res '^project/io/'
                    $tmp = [IO.Path]::ChangeExtension($case.path, 'encastra-writing')
                    Check "$($case.what): nothing written (neither the file nor its .encastra-writing temporary)" (-not (Test-Path -LiteralPath $case.path) -and -not (Test-Path -LiteralPath $tmp)) 'both absent' "file=$(Test-Path -LiteralPath $case.path) temporary=$(Test-Path -LiteralPath $tmp)"
                }
                $ro = Join-Path $work 'read-only.encastra'
                Copy-Item -LiteralPath $oddFile -Destination $ro -Force
                (Get-Item -LiteralPath $ro).IsReadOnly = $true
                $roSha = Sha256 $ro
                $s = Cdp 'eval' "(async()=>{const g=$gj;try{await window.__TAURI_INTERNALS__.invoke('save_project',{path:$(JsStr $ro),name:'changed',graph:g,label:'x'});return {ok:true};}catch(e){return {ok:false,error:e};}})()" 60000
                $res = if ($s.ok) { [pscustomobject]@{ ok = [bool]$s.value.ok; transport = $null; error = $(if (@($s.value.PSObject.Properties | ForEach-Object { $_.Name }) -contains 'error') { $s.value.error } else { $null }); value = $null } } else { [pscustomobject]@{ ok = $false; transport = $s.error; error = $null; value = $null } }
                Test-Refused 'save_project over a read-only file' $res '^project/io/'
                Check 'the read-only file is unchanged' ((Sha256 $ro) -eq $roSha) $roSha (Sha256 $ro)
                # The save writes beside the target first and moves into place (Project::save); a
                # failed move must not leave that copy behind. (RC5 does: found by this check.)
                $roTmp = [IO.Path]::ChangeExtension($ro, 'encastra-writing')
                Check 'a refused save leaves no .encastra-writing temporary beside the target' (-not (Test-Path -LiteralPath $roTmp)) 'absent' "$roTmp exists=$(Test-Path -LiteralPath $roTmp)"
                (Get-Item -LiteralPath $ro).IsReadOnly = $false
            }
        }
        Assert-StillReady 'the boundary calls'

        # A locked library index.
        $idx = @(Get-LibraryIndexFiles | Where-Object { $_.Name -eq 'library.json' })
        if ($idx.Count -ge 1) {
            Close-AppGracefully | Out-Null; Stop-App | Out-Null
            $lockedSha = Sha256 $idx[0].FullName
            $fs = [IO.File]::Open($idx[0].FullName, 'Open', 'ReadWrite', 'None')
            try {
                $b = Start-ReadyApp -Cdp
                Check 'starts and reaches ready while the library index is locked by another process' $b.ready 'ready' (Short $b.detail)
                $lib = Invoke-Ipc 'library_list'
                Observe 'library_list_while_locked' $(if ($lib.ok) { Short $lib.value 300 } else { Short $lib.error 300 })
                # A file that cannot be opened is not a file that does not parse: it must be
                # reported, and must not be quarantined or replaced.
                Test-Refused 'library_list while the index is locked reports an error' $lib '^library/io/'
                Assert-StillReady 'listing a locked library'
            } finally { $fs.Close() }
            $q = @(Get-ChildItem -LiteralPath (Split-Path $idx[0].FullName) -Filter 'library.json.corrupt-*' -Force -ErrorAction SilentlyContinue)
            Check 'a locked index is not mistaken for a corrupt one (nothing moved aside)' ($q.Count -eq 0) 0 (Short ($q | ForEach-Object { $_.Name }))
            Check 'the locked index is untouched' ((Test-Path -LiteralPath $idx[0].FullName) -and (Sha256 $idx[0].FullName) -eq $lockedSha) $lockedSha $(if (Test-Path -LiteralPath $idx[0].FullName) { Sha256 $idx[0].FullName } else { 'missing' })
            Close-AppGracefully | Out-Null; Stop-App | Out-Null
            $c = Start-ReadyApp -Cdp
            $lib2 = Invoke-Ipc 'library_list'
            Check 'once released, the library reads again' ($c.ready -and $lib2.ok) 'ok' $(if ($lib2.ok) { "entries=$(@($lib2.value.entries).Count)" } else { Short $lib2.error })
        } else { Check 'a library index exists to lock' $false '>= 1' 0 }
        $crash = @(Get-AppCrashEvents $t0)
        Check 'no crash event during the boundary cases' ($crash.Count -eq 0) 0 (Short $crash)
        Close-AppGracefully | Out-Null; Stop-App | Out-Null
    }
}

# ---------------------------------------------------------------------------------------------
# CLEAN-010 - start, close, start again, be killed, start again
# ---------------------------------------------------------------------------------------------
function Scenario-CLEAN010 {
    Run-Scenario 'CLEAN-010' 'Process lifecycle: launch, close, relaunch, second launch, hard kill, recovery, no orphans' {
        $t0 = Get-Date
        Expect 'graceful close and hard kill both leave no Encastra or WebView2 process; relaunch after either reaches ready'
        $a = Start-ReadyApp -Cdp
        Check 'launch reaches ready' $a.ready 'ready' (Short $a.detail)
        $c = Close-AppGracefully
        Check 'graceful close ends the host' ($c -like 'exited*') 'exited' $c
        $deadline = (Get-Date).AddSeconds(15)
        while ((Get-Date) -lt $deadline -and @(Get-AppProcesses).Count -gt 0) { Start-Sleep -Milliseconds 500 }
        $orph = @(Get-AppProcesses)
        Check 'no orphan within 15 s of a graceful close' ($orph.Count -eq 0) 0 (Short ($orph | ForEach-Object { "$($_.Name) $($_.ProcessId)" }))
        $b = Start-ReadyApp -Cdp
        Check 'relaunch reaches ready' $b.ready 'ready' (Short $b.detail)
        $second = Start-App
        Start-Sleep -Seconds 15
        $hosts = @(Get-Process encastra-desktop -ErrorAction SilentlyContinue)
        Observe 'hosts_after_second_launch' "$($hosts.Count) (second launch exited=$($second.HasExited))"
        Assert-StillReady 'a second launch'
        Get-Process encastra-desktop -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $b.proc.Id } | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Stop-Process -Id $b.proc.Id -Force
        $deadline = (Get-Date).AddSeconds(45)
        while ((Get-Date) -lt $deadline -and @(Get-AppProcesses).Count -gt 0) { Start-Sleep -Milliseconds 500 }
        $orph = @(Get-AppProcesses)
        Check 'a hard kill of the host leaves no orphaned WebView2 process within 45 s' ($orph.Count -eq 0) 0 (Short ($orph | ForEach-Object { "$($_.Name) $($_.ProcessId)" }))
        $d = Start-ReadyApp -Cdp
        Check 'relaunch after a hard kill reaches ready' $d.ready 'ready' (Short $d.detail)
        $st = Get-PersistedState
        Check 'state still readable after the hard kill' ($null -ne $st.preferences -and $st.library_ok) 'preferences present, library ok' (Short $st)
        $c2 = Close-AppGracefully
        Start-Sleep -Seconds 5
        Check 'final graceful close, nothing left running' (($c2 -like 'exited*') -and @(Get-AppProcesses).Count -eq 0) 'exited, 0 processes' "$c2, $(@(Get-AppProcesses).Count)"
        $crash = @(Get-AppCrashEvents $t0)
        Observe 'crash_events_note' 'a hard kill is not an application error; events listed only if Windows raised one'
        Check 'no Application Error / WER event for Encastra' (@($crash | Where-Object { $_ -notmatch 'Application Hang' }).Count -eq 0) 0 (Short $crash)
    }
}

# ---------------------------------------------------------------------------------------------
# CLEAN-012 - uninstall
# ---------------------------------------------------------------------------------------------
function Invoke-Uninstall([string]$label) {
    Close-AppGracefully | Out-Null
    $left = Stop-App
    Check "$label no application process before uninstalling" ($left -eq 0) 0 $left
    Check "$label uninstaller present" (Test-Path -LiteralPath $script:Uninstaller) $script:Uninstaller (Test-Path -LiteralPath $script:Uninstaller)
    $tag = $label -replace '[^A-Za-z0-9]+', '-'
    # The machine while the product is installed and has been used, just before it goes: anything
    # the application created at run time and the uninstaller then removed (an autostart value, a
    # scheduled task) is visible here and nowhere else. Only the installation's own footprint may
    # differ from the baseline.
    $base = Load-Json (Join-Path $script:R 'inventory\baseline.json')
    $inUse = Save-Inventory "pre-$($tag.Trim('-'))" -NoNameScan
    foreach ($cat in $script:PersistenceSurfaces) {
        if ($cat -in 'uninstall_entries', 'shortcuts') { continue }
        $dd = Diff-List (Prop $base $cat) $inUse.$cat
        Check "$label while installed and used, $cat is as the baseline had it" (@($dd.added).Count -eq 0 -and @($dd.removed).Count -eq 0) 'no change' (Short $dd)
    }
    $t0 = Get-Date
    $p = Start-Process -FilePath $script:Uninstaller -ArgumentList '/S' -PassThru
    $null = $p.Handle
    [void]$p.WaitForExit(120000)
    # The NSIS uninstaller copies itself to %TEMP%, starts the copy and returns at once; the copy
    # removes the registry entry last (S1: 13 s in, the files were gone and the entry was not).
    # So the whole process tree is followed until it has exited, and only then is anything judged.
    $tree = @($p.Id); $seen = @()
    $deadline = (Get-Date).AddSeconds(180)
    do {
        foreach ($c in @(Get-CimInstance Win32_Process | Where-Object { $tree -contains [int]$_.ParentProcessId })) {
            if ($tree -notcontains [int]$c.ProcessId) { $tree += [int]$c.ProcessId; $seen += "$($c.Name) ($($c.ExecutablePath))" }
        }
        $alive = @(Get-Process -Id $tree -ErrorAction SilentlyContinue)
        if ($alive.Count -eq 0) { break }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    Observe "$($tag)uninstaller_processes" $seen
    Check "$label the uninstaller process tree finished within 180 s" (@(Get-Process -Id $tree -ErrorAction SilentlyContinue).Count -eq 0) 'all exited' "$(@(Get-Process -Id $tree -ErrorAction SilentlyContinue).Count) still running; followed: $(Short $seen)"
    Check "$label uninstaller exit code" ($p.ExitCode -eq 0) 0 $p.ExitCode
    Observe "$($tag)uninstall_seconds" ([int]((Get-Date) - $t0).TotalSeconds)
    Check "$label executable removed" (-not (Test-Path -LiteralPath $script:InstalledExe)) 'absent' (Test-Path -LiteralPath $script:InstalledExe)
    Check "$label uninstaller removed" (-not (Test-Path -LiteralPath $script:Uninstaller)) 'absent' (Test-Path -LiteralPath $script:Uninstaller)
    $rest = @(Get-ChildItem -LiteralPath $script:InstallDir -Recurse -Force -ErrorAction SilentlyContinue)
    Check "$label install directory removed" (-not (Test-Path -LiteralPath $script:InstallDir)) 'absent' "exists=$(Test-Path -LiteralPath $script:InstallDir); $($rest.Count) items: $(Short ($rest | Select-Object -First 5 | ForEach-Object { $_.FullName }))"
    $entries = @(Get-EncastraUninstallEntries)
    Check "$label no Encastra uninstall entry left" ($entries.Count -eq 0) 0 (Short $entries)
    $lnk = @(Get-ChildItem -LiteralPath (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu'), ([Environment]::GetFolderPath('Desktop')) -Recurse -Filter '*encastra*' -ErrorAction SilentlyContinue)
    Check "$label no Encastra shortcut left" ($lnk.Count -eq 0) 0 (Short ($lnk | ForEach-Object { $_.FullName }))
    Check "$label no application process left" (@(Get-AppProcesses).Count -eq 0) 0 @(Get-AppProcesses).Count
    $scratch = Join-Path $env:TEMP 'encastra'
    $sc = @(Get-ChildItem -LiteralPath $scratch -Force -ErrorAction SilentlyContinue)
    Check "$label run scratch (%TEMP%\encastra) is empty or absent" ($sc.Count -eq 0) 'empty' "$($sc.Count) items"
    # User data: kept by design (silent uninstall; docs/release/CLEAN_WINDOWS_VM.md). What is kept
    # is recorded, and none of it may be a credential.
    $kept = @(foreach ($d in $script:AppDataRoaming, $script:AppDataLocal) { Get-ChildItem -LiteralPath $d -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName } })
    Evidence "$($tag)user-data-kept.txt" (($kept -join "`r`n") + "`r`n") | Out-Null
    # The WebView2 profile (EBWebView) is Chromium's own directory - its 'Trust Tokens' and 'Vpn
    # Tokens' are Chromium databases, not credentials - so it is recorded, not name-matched.
    $cred = @($kept | Where-Object { $_ -notmatch '\\EBWebView\\' -and $_ -match '(?i)(token|credential|password|secret|\.pem$|\.key$|\.pfx$)' })
    Check "$label no credential-like file among the user data that is kept" ($cred.Count -eq 0) 0 (Short $cred)
    Observe "$($tag)user_data_files_kept" $kept.Count
    # The WebView2 profile is where a browser would keep credentials; its databases go to the host,
    # where report.py counts the rows in logins, cookies, autofill and credit_cards (the guest has no
    # SQLite). Absent means the profile never created that database.
    $prof = Join-Path $script:AppDataLocal 'EBWebView\Default'
    $dbDir = Join-Path $script:ScenarioDir 'webview2-profile'
    New-Item -ItemType Directory -Force -Path $dbDir | Out-Null
    foreach ($db in @(@('Login Data', 'Login Data'), @('Network\Cookies', 'Cookies'), @('Web Data', 'Web Data'))) {
        $src = Join-Path $prof $db[0]
        if (Test-Path -LiteralPath $src) {
            Copy-Item -LiteralPath $src -Destination (Join-Path $dbDir $db[1]) -Force
            [void]$script:Cur.evidence.Add("scenarios/$($script:Cur.scenario_id)/webview2-profile/$($db[1])")
        }
    }
    Test-KeptRegistry $label
}

# Tauri's NSIS template removes HKCU\Software\encastra\Encastra (the install location and the
# installer language) only when "Delete app data" is ticked (installer.nsi, Section Uninstall,
# `${If} $DeleteAppDataCheckboxState = 1`); a silent uninstall keeps it with the user data. That
# key, with exactly those values, is the one registry change a silent uninstall is allowed to leave.
function Get-KeptRegistryKeys {
    @(@(Get-Item -LiteralPath 'HKCU:\Software\encastra' -ErrorAction SilentlyContinue) + @(Get-ChildItem -LiteralPath 'HKCU:\Software\encastra' -Recurse -ErrorAction SilentlyContinue) | Where-Object { $_ })
}

function Get-KeptRegistry {
    @(Get-KeptRegistryKeys | ForEach-Object {
            $k = $_; foreach ($n in $k.GetValueNames()) { "$($k.Name)|$(if ($n) { $n } else { '(default)' })=$($k.GetValue($n))" } })
}

function Test-KeptRegistry([string]$label) {
    $vals = @(Get-KeptRegistry)
    $allowed = @($vals | Where-Object { $_ -like 'HKEY_CURRENT_USER\Software\encastra\Encastra|(default)=*' -or $_ -match '^HKEY_CURRENT_USER\\Software\\encastra\\Encastra\|Installer Language=\d+$' })
    $keys = @(Get-KeptRegistryKeys | ForEach-Object { $_.Name } | Where-Object { $_ -ne 'HKEY_CURRENT_USER\Software\encastra' })
    Observe "$(($label -replace '[^A-Za-z0-9]+', '-'))kept_registry" $vals
    Check "$label HKCU\Software\encastra holds only what Tauri keeps with the user data (install location, installer language)" (($vals.Count -eq $allowed.Count) -and (@($keys | Where-Object { $_ -notin 'HKEY_CURRENT_USER\Software\encastra\Encastra' }).Count -eq 0)) 'only Encastra\(default) and Encastra\Installer Language' (Short $vals)
}

function Scenario-CLEAN012 {
    Run-Scenario 'CLEAN-012' 'Uninstall: program, entry, shortcuts, processes gone; user data kept by contract; nothing else changed' {
        Expect 'silent uninstall removes %LOCALAPPDATA%\Encastra, the HKCU entry and the shortcut; keeps %APPDATA%/%LOCALAPPDATA%\dev.encastra.app (documented); leaves every persistence surface as the baseline had it'
        Invoke-Uninstall 'uninstall:'
        $base = Load-Json (Join-Path $script:R 'inventory\baseline.json')
        $now = Save-Inventory 'post-uninstall'
        foreach ($cat in $script:PersistenceSurfaces) {
            $dd = Diff-List $base.$cat $now.$cat
            Check "after uninstall, $cat is as the baseline had it" (@($dd.added).Count -eq 0 -and @($dd.removed).Count -eq 0) 'no change' (Short $dd)
        }
        $dh = Diff-List $base.hkcu_software $now.hkcu_software
        Check 'after uninstall, HKCU\Software gained nothing but the key Tauri keeps with the user data' (@($dh.added | Where-Object { $_ -ne 'encastra' }).Count -eq 0 -and @($dh.removed).Count -eq 0) "nothing, or 'encastra'" (Short $dh)
    }
}

# ---------------------------------------------------------------------------------------------
# CLEAN-013 - install again after uninstall
# ---------------------------------------------------------------------------------------------
function Scenario-CLEAN013 {
    Run-Scenario 'CLEAN-013' 'Reinstall after uninstall: installs, launches, works; then uninstalls clean again' {
        $st = Get-State
        Expect 'the second install passes install_check identically; the application reaches ready; the kept user data is picked up; a second uninstall is as clean as the first'
        $before = Load-Json (Join-Path $script:R 'inventory\post-uninstall.json')
        Invoke-InstallCheck $st.installer_copy $script:Expected.installer 'reinstall.log' $null | Out-Null
        $after = Save-Inventory 'post-reinstall'
        Assert-InstallFootprint $before $after 'the reinstall'
        Stop-App | Out-Null
        $a = Start-ReadyApp -Cdp
        Check 'reinstalled application reaches ready' $a.ready 'ready' (Short $a.detail)
        $ps = Get-PersistedState
        Check 'the user data kept by the uninstall is picked up (preferences present)' ($null -ne $ps.preferences) 'present' (Short $ps.preferences)
        $comp = Invoke-Ipc 'list_components'
        Check 'the runtime answers after the reinstall (list_components)' ($comp.ok -and @($comp.value).Count -ge 1) '>= 1 component' $(if ($comp.ok) { @($comp.value).Count } else { Short $comp.error })
        Invoke-Uninstall 'second uninstall:'
    }
}

# ---------------------------------------------------------------------------------------------
# CLEAN-011 - upgrade from the previous published version
# ---------------------------------------------------------------------------------------------
function Scenario-CLEAN011 {
    Run-Scenario 'CLEAN-011' 'Upgrade: previous published version -> this one, user state carried over, one entry, works' {
        $st = Get-State
        $fromArt = $script:Expected.upgrade_from; $toArt = $script:Expected.installer
        Expect "install $($fromArt.version) ($($fromArt.sha256)), set state, install $($toArt.version) over it: one HKCU entry, $($toArt.version) bytes, state kept, journeys pass"
        $base = Load-Json (Join-Path $script:R 'inventory\baseline.json')
        Invoke-InstallCheck $st.upgrade_copy $fromArt 'install-A.log' $null | Out-Null
        Stop-App | Out-Null
        $a = Start-ReadyApp -Cdp
        Check "version A ($($fromArt.version)) reaches ready" $a.ready 'ready' (Short $a.detail)
        Observe 'A_welcome' (Dismiss-Welcome)
        Observe 'A_settings_clicks' (Set-LocaleThroughSettings '^Espa.ol$')
        $sa = Get-PersistedState
        Evidence 'state-A.json' $sa | Out-Null
        Check 'state set in version A (language es, welcome seen)' ($sa.locale -eq 'es' -and $sa.welcome_seen -eq $true) 'es, true' "$($sa.locale), $($sa.welcome_seen)"
        Close-AppGracefully | Out-Null; Stop-App | Out-Null
        $lines = Invoke-InstallCheck $st.installer_copy $toArt 'install-B-over-A.log' $null
        $prev = $lines | Where-Object { $_ -like 'installed before:*' } | Select-Object -First 1
        Check 'install_check saw version A installed before the upgrade' ($prev -match [regex]::Escape($fromArt.version)) "installed before: $($fromArt.version)" (Short $prev)
        $entries = @(Get-EncastraUninstallEntries)
        Check 'exactly one Encastra uninstall entry, at version B' ($entries.Count -eq 1 -and $entries[0].version -eq $toArt.version -and $entries[0].hive -like 'HKCU:*') "1 x $($toArt.version) in HKCU" (Short $entries)
        $listing = @(Get-InstallListing)
        Evidence 'install-dir-after-upgrade.json' $listing | Out-Null
        Check 'install directory holds only the executable and the uninstaller' (@($listing).Count -eq 2) 2 (Short ($listing | ForEach-Object { $_.path }))
        Stop-App | Out-Null
        $b = Start-ReadyApp -Cdp
        Check "version B ($($toArt.version)) reaches ready after the upgrade" $b.ready 'ready' (Short $b.detail)
        $sb = Get-PersistedState
        Evidence 'state-B.json' $sb | Out-Null
        Check 'language carried over the upgrade' ($sb.locale -eq 'es') 'es' $sb.locale
        Check 'welcome not shown again after the upgrade' ($b.ready -and -not [bool](Prop $b.detail 'welcome')) 'ready, welcome=False' (Short $b.detail)
        Check 'preferences carried over the upgrade' ($sb.preferences -eq $sa.preferences) (Short $sa.preferences) (Short $sb.preferences)
        Save-Screenshot 'after-upgrade'
        Close-AppGracefully | Out-Null
        Invoke-Journeys 1 'gui-journeys-after-upgrade.log' | Out-Null
        $now = Save-Inventory 'post-upgrade'
        Assert-InstallFootprint $base $now 'the upgrade'
        Invoke-Uninstall 'uninstall after upgrade:'
    }
}

# ---------------------------------------------------------------------------------------------
# DIAG-UIA - diagnostic only (never in an acceptance plan): every Button UI Automation exposes
# under the application window, the way gui_journeys.ps1 looks for them (AppWindow = the root's
# child with this pid and class 'Tauri Window'; FindAll Descendants; first match in tree order).
# ---------------------------------------------------------------------------------------------
function Get-UiaButtonDump([string]$label) {
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    $AE = [System.Windows.Automation.AutomationElement]
    $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
    $out = New-Object System.Collections.ArrayList
    $p = Get-Process encastra-desktop -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $p) { return @("$label : no encastra-desktop process") }
    $cond = New-Object System.Windows.Automation.PropertyCondition($AE::ProcessIdProperty, $p.Id)
    foreach ($w in @($AE::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $cond))) {
        [void]$out.Add("$label WINDOW class='$($w.Current.ClassName)' name='$($w.Current.Name)' framework='$($w.Current.FrameworkId)'")
        $all = @($w.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition))
        $i = 0
        foreach ($e in $all) {
            $i++
            try {
                $c = $e.Current
                if ($c.ControlType.ProgrammaticName -ne 'ControlType.Button') { continue }
                $chain = @(); $q = $walker.GetParent($e)
                while ($q -and $chain.Count -lt 8) { $qc = $q.Current; $chain += "$($qc.ControlType.ProgrammaticName -replace '^ControlType\.', ''):'$($qc.ClassName)':'$($qc.Name)':$($qc.FrameworkId)"; if ($qc.ClassName -eq 'Tauri Window') { break }; $q = $walker.GetParent($q) }
                [void]$out.Add(("{0} #{1}/{2} Button name='{3}' id='{4}' class='{5}' framework='{6}' rect='{7}' offscreen={8} enabled={9} | parents: {10}" -f $label, $i, $all.Count, $c.Name, $c.AutomationId, $c.ClassName, $c.FrameworkId, $c.BoundingRectangle, $c.IsOffscreen, $c.IsEnabled, ($chain -join ' < ')))
            } catch { [void]$out.Add("$label #$i unreadable: $($_.Exception.GetType().Name)") }
        }
    }
    @($out)
}

function Scenario-DIAGUIA {
    Run-Scenario 'DIAG-UIA' 'Diagnostic: the Buttons UI Automation exposes under the application window' {
        Expect 'a dump of every Button under the Tauri window, with framework, class, rect and parent chain'
        $a = Start-ReadyApp -Cdp
        Check 'ready' $a.ready 'ready' (Short $a.detail)
        Dismiss-Welcome | Out-Null
        Click-Text '.sidebar__item' '^(Builder|Constructor)' | Out-Null
        Start-Sleep -Seconds 5
        # WebView2 publishes its tree only once a client asks; keep asking for up to a minute.
        $d1 = Get-UiaButtonDump 'builder-first'
        $d2 = $d1
        for ($i = 0; $i -lt 20 -and @($d2 | Where-Object { $_ -match ' Button ' }).Count -lt 10; $i++) { Start-Sleep -Seconds 3; $d2 = Get-UiaButtonDump "builder-poll-$i" }
        $closes = @($d2 | Where-Object { $_ -match "Button name='(Close|Cerrar)'" })
        Evidence 'uia-buttons.txt' ((@($d1) + @('') + @($d2)) -join "`r`n") | Out-Null
        Observe 'close_buttons' $closes
        Check 'the dump was taken' (@($d2).Count -gt 1) '> 1 line' @($d2).Count
    }
}

# ---------------------------------------------------------------------------------------------
# Contamination - the machine at the end against the machine at the start
# ---------------------------------------------------------------------------------------------
function Scenario-CONTAMINATION {
    Run-Scenario 'CLEAN-CONTAMINATION' 'Contamination: after everything, only documented changes remain' {
        Expect 'every persistence surface equals the baseline; the only Encastra-named paths left are the documented user data and the harness''s own folders'
        $base = Load-Json (Join-Path $script:R 'inventory\baseline.json')
        $now = Save-Inventory 'final'
        Assert-InventoryPopulated $now 'final'
        $dtemp = Diff-List (Prop $base 'temp_top') $now.temp_top
        Observe 'temp_top_added' @($dtemp.added)
        Evidence 'temp-top-diff.json' $dtemp | Out-Null
        foreach ($cat in $script:PersistenceSurfaces) {
            $dd = Diff-List $base.$cat $now.$cat
            Check "$cat unchanged from the baseline" (@($dd.added).Count -eq 0 -and @($dd.removed).Count -eq 0) 'no change' (Short $dd)
        }
        $dh = Diff-List $base.hkcu_software $now.hkcu_software
        Check "hkcu_software gained nothing but the key Tauri keeps with the user data" (@($dh.added | Where-Object { $_ -ne 'encastra' }).Count -eq 0 -and @($dh.removed).Count -eq 0) "nothing, or 'encastra'" (Short $dh)
        Test-KeptRegistry 'at the end:'
        $named = @($now.encastra_named | Where-Object { -not (Test-HarnessPath $_) })
        $documented = @($named | Where-Object { $_ -like "$($script:AppDataRoaming)*" -or $_ -like "$($script:AppDataLocal)*" -or $_ -like '*\Downloads\Encastra_*_x64-setup.exe' -or $_ -match '\\Microsoft\\Windows\\Recent\\(journeys\.encastra|dev\.encastra\.journeys\.[^\\]+)\.lnk$' -or ($_ -eq (Join-Path $env:TEMP 'encastra') -and @(Get-ChildItem -LiteralPath $_ -Force -ErrorAction SilentlyContinue).Count -eq 0) })
        # (An EMPTY %TEMP%\encastra is the parent of the per-run scratch folders, each of which the
        # application removes when its run ends - ScratchDir::drop, apps/desktop/src-tauri/src/lib.rs;
        # CLEAN_WINDOWS_VM.md step 7 accepts "empty or absent". Anything inside it is not accepted.)
        # (The Recent-items shortcut is the shell's record of the project the journeys saved
        # through the Save As dialog: harness activity, named after the harness's own file.)
        $undoc = @($named | Where-Object { $documented -notcontains $_ })
        Evidence 'encastra-named-at-end.txt' (($named -join "`r`n") + "`r`n") | Out-Null
        Check 'no Encastra-named path outside user data, the downloaded installer and harness folders' ($undoc.Count -eq 0) 0 "$($undoc.Count): $(Short ($undoc | Select-Object -First 8))"
        $dt = Diff-List $base.top_dirs $now.top_dirs
        Observe 'new_top_level_folders' @($dt.added)
        Observe 'removed_top_level_folders' @($dt.removed)
        $undocTop = @($dt.added | Where-Object { -not (Test-HarnessPath $_) -and $_ -notmatch '\\dev\.encastra\.app$' -and $_ -notmatch '\\Downloads$' -and $_ -notmatch '\\AppData\\Local\\IconCache\.db$' })
        # (IconCache.db is Explorer's icon cache, written by the shell whenever it draws new icons.)
        Check 'no new top-level folder other than user data and harness folders' ($undocTop.Count -eq 0) 'none' (Short $undocTop)
        Check 'nothing of Encastra running' (@(Get-AppProcesses).Count -eq 0) 0 @(Get-AppProcesses).Count
    }
}
