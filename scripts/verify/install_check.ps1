# Installs an installer for real (per-user, silent) and checks what landed: version, the build
# commit stamped in the binary, the uninstall entry (HKCU only), the shortcut, the directory ACL,
# and that the installed copy launches. Prints PASS/FAIL per check with what was observed.
#
#   .\scripts\verify\install_check.ps1 -Installer .\target\release\bundle\nsis\Encastra_<v>_x64-setup.exe -ExpectedVersion <v>
#
# It replaces whatever Encastra is installed for this user. Run scripts/verify/gui_chooser.ps1
# afterwards against the installed copy it leaves running.
param([Parameter(Mandatory)][string]$Installer, [Parameter(Mandatory)][string]$ExpectedVersion)
$ErrorActionPreference = 'Stop'
function Report($ok, $what, $observed) { "{0}  {1}  -> {2}" -f ($(if ($ok) { 'PASS' } else { 'FAIL' }), $what, $observed) }

$installDir = Join-Path $env:LOCALAPPDATA 'Encastra'
$exe = Join-Path $installDir 'encastra-desktop.exe'
$before = if (Test-Path $exe) { (Get-Item $exe).VersionInfo.ProductVersion } else { '(none)' }
"installed before: $before"
"installer: $Installer  sha256=$((Get-FileHash $Installer).Hash.ToLower())"
$sig = Get-AuthenticodeSignature -LiteralPath $Installer
Report ($sig.Status -eq 'NotSigned') "installer signature state as documented (NotSigned)" $sig.Status

Get-Process encastra-desktop -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 1
$t = Get-Date
$p = Start-Process -FilePath $Installer -ArgumentList '/S' -PassThru -Wait
Report ($p.ExitCode -eq 0) "silent install exit code" "$($p.ExitCode) in $([int]((Get-Date) - $t).TotalSeconds)s"
Report (Test-Path $exe) "binary present in the per-user install directory" $exe
$vi = (Get-Item $exe).VersionInfo
Report ($vi.ProductVersion -eq $ExpectedVersion) "installed ProductVersion" "$($vi.ProductVersion) (FileVersion $($vi.FileVersion))"
$hash = (Get-FileHash $exe).Hash.ToLower()
"installed binary sha256: $hash  size: $((Get-Item $exe).Length)"
$stamp = [regex]::Match([IO.File]::ReadAllText($exe, [Text.Encoding]::GetEncoding(28591)), 'encastra-build-commit=([0-9a-f]{40}(?:-dirty)?|unknown);').Groups[1].Value
"installed binary build stamp: $stamp"
Report (Test-Path (Join-Path $installDir 'uninstall.exe')) "uninstaller present" (Join-Path $installDir 'uninstall.exe')
$entry = Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' | ForEach-Object { Get-ItemProperty $_.PSPath } | Where-Object { $_.DisplayName -eq 'Encastra' } | Select-Object -First 1
Report ($null -ne $entry -and $entry.DisplayVersion -eq $ExpectedVersion) "HKCU uninstall entry" "DisplayVersion=$($entry.DisplayVersion) InstallLocation=$($entry.InstallLocation)"
$hklm = Get-ChildItem 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue | ForEach-Object { Get-ItemProperty $_.PSPath } | Where-Object { $_.DisplayName -eq 'Encastra' }
Report ($null -eq $hklm) "nothing written under HKLM (per-user install)" "$(@($hklm).Count) entries"
$shortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Encastra.lnk'
Report (Test-Path $shortcut) "Start Menu shortcut" $shortcut
$acl = (icacls $installDir | Select-Object -First 3) -join ' | '
"install dir ACL: $acl"

# First run of the installed copy.
$run = Start-Process -FilePath $exe -PassThru
Start-Sleep 6
$run.Refresh()
Report (-not $run.HasExited) "installed application launches and stays up" "pid $($run.Id) title='$($run.MainWindowTitle)'"
