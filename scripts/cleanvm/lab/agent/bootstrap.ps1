# The only harness code that lives inside the base image. Started at every logon by the HKCU Run
# value `CleanVmAgent`. It looks for a CD labelled CLEANVM_H (the harness disc the host builds for
# one cycle) and hands over to guest\entry.ps1 on it. With no such disc it does nothing at all, so
# the base image boots to an ordinary desktop.
$drive = [IO.DriveInfo]::GetDrives() | Where-Object { $_.IsReady -and $_.VolumeLabel -eq 'CLEANVM_H' } | Select-Object -First 1
if (-not $drive) { exit 0 }
$entry = Join-Path $drive.RootDirectory.FullName 'guest\entry.ps1'
if (-not (Test-Path -LiteralPath $entry)) { exit 0 }
& $entry
