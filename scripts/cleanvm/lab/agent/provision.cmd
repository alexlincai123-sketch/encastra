@echo off
rem Runs once, at the first logon of the base image build (FirstLogonCommands), from the
rem unattend CD whose drive letter is %1. Everything it changes is listed in autounattend.xml and
rem in docs/release/CLEAN_WINDOWS_VM.md; the Clean VM baseline check knows these exact items and
rem nothing else.
setlocal
set SRC=%1:\agent
mkdir C:\ProgramData\cleanvm-agent
copy /y %SRC%\bootstrap.ps1 C:\ProgramData\cleanvm-agent\bootstrap.ps1
reg add HKCU\Software\Microsoft\Windows\CurrentVersion\Run /v CleanVmAgent /t REG_SZ /d "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\ProgramData\cleanvm-agent\bootstrap.ps1" /f
rem Permanent automatic logon (the unattend AutoLogon counts down). Empty password: no secret.
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v AutoAdminLogon /t REG_SZ /d 1 /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v DefaultUserName /t REG_SZ /d tester /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v DefaultPassword /t REG_SZ /d "" /f
reg delete "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v AutoLogonCount /f
rem A desktop that stays on and unlocked.
powercfg /change monitor-timeout-ac 0
powercfg /change standby-timeout-ac 0
powercfg /hibernate off
reg add HKLM\SOFTWARE\Policies\Microsoft\Windows\Personalization /v NoLockScreen /t REG_DWORD /d 1 /f
reg add "HKCU\Control Panel\Desktop" /v ScreenSaveActive /t REG_SZ /d 0 /f
rem Activate the evaluation licence. The base build is the only time the VM has a route out; an
rem evaluation that was never activated sits in notification state (LicenseStatus 5, no end date)
rem and is not a machine anyone would test on. The outcome is kept as evidence either way.
rem Ask the host for the network (lab.sh watches COM1 and brings the link up), then wait for it.
mode COM1: BAUD=115200 PARITY=n DATA=8 STOP=1 >nul
echo PROVISION-NETWORK > COM1
set /a tries=0
:waitnet
set /a tries+=1
ping -n 1 -w 2000 www.microsoft.com >nul 2>&1 && goto netup
if %tries% geq 60 goto netup
timeout /t 5 /nobreak >nul
goto waitnet
:netup
echo network wait: %tries% tries > C:\ProgramData\cleanvm-agent\network.txt
cscript //nologo %SystemRoot%\System32\slmgr.vbs /ato > C:\ProgramData\cleanvm-agent\activation.txt 2>&1
cscript //nologo %SystemRoot%\System32\slmgr.vbs /dli >> C:\ProgramData\cleanvm-agent\activation.txt 2>&1
cscript //nologo %SystemRoot%\System32\slmgr.vbs /xpr >> C:\ProgramData\cleanvm-agent\activation.txt 2>&1
rem Let first-logon provisioning settle before the image is frozen, then power off.
echo cleanvm-provisioned > C:\ProgramData\cleanvm-agent\provisioned.txt
timeout /t 300 /nobreak
shutdown /s /t 0
