# Clean VM acceptance - summary

**CLEAN_VM_ACCEPTANCE: FAIL**

| Scenario | Result |
|---|---|
| CLEAN-001@A | PASS |
| CLEAN-002@A | PASS |
| CLEAN-003@A | PASS |
| CLEAN-004@A | PASS |
| CLEAN-005@A | PASS |
| CLEAN-006@A | PASS |
| CLEAN-007@A | PASS |
| CLEAN-008@A | PASS |
| CLEAN-009@A | FAIL |
| CLEAN-010@A | PASS |
| CLEAN-012@A | PASS |
| CLEAN-013@A | PASS |
| CLEAN-CONTAMINATION@A | PASS |
| CLEAN-001@B | PASS |
| CLEAN-002@B | PASS |
| CLEAN-003@B | PASS |
| CLEAN-004@B | PASS |
| CLEAN-005@B | PASS |
| CLEAN-006@B | PASS |
| CLEAN-007@B | PASS |
| CLEAN-008@B | PASS |
| CLEAN-009@B | FAIL |
| CLEAN-010@B | PASS |
| CLEAN-012@B | PASS |
| CLEAN-013@B | PASS |
| CLEAN-CONTAMINATION@B | PASS |
| CLEAN-001@U | PASS |
| CLEAN-002@U | PASS |
| CLEAN-011@U | PASS |
| CLEAN-CONTAMINATION@U | PASS |
| CLEAN-014 | FAIL |
| NEGATIVE | PASS |

## Evidence index

| Cycle | Scenario | Result | Assertions | Evidence |
|---|---|---|---|---|
| A | CLEAN-001 | PASS | 17 | scenarios/CLEAN-001/encastra-named-files.txt, scenarios/CLEAN-001/base-activation.txt, scenarios/CLEAN-001/base-network.txt |
| A | CLEAN-002 | PASS | 6 |  |
| A | CLEAN-003 | PASS | 34 | scenarios/CLEAN-003/install.log, scenarios/CLEAN-003/install-dir.json |
| A | CLEAN-004 | PASS | 10 | scenarios/CLEAN-004/first-launch.png, scenarios/CLEAN-004/host-modules.txt |
| A | CLEAN-005 | PASS | 19 | scenarios/CLEAN-005/gui-journeys.log, scenarios/CLEAN-005/gui-journeys.log.policy-cleanup.log, scenarios/CLEAN-005/gui-journeys.log.windows-events.txt |
| A | CLEAN-006 | PASS | 12 | scenarios/CLEAN-006/state-before-close.json, scenarios/CLEAN-006/state-after-relaunch.json, scenarios/CLEAN-006/after-relaunch.png |
| A | CLEAN-007 | PASS | 27 | scenarios/CLEAN-007/state-after-reboot.json, scenarios/CLEAN-007/after-reboot.png, scenarios/CLEAN-007/gui-journeys-after-reboot.log, scenarios/CLEAN-007/gui-journeys-after-reboot.log.policy-cleanup.log ... |
| A | CLEAN-008 | PASS | 17 | scenarios/CLEAN-008/damaged-library.png |
| A | CLEAN-009 | FAIL | 29 |  |
| A | CLEAN-010 | PASS | 10 |  |
| A | CLEAN-012 | PASS | 42 | scenarios/CLEAN-012/uninstall-user-data-kept.txt, scenarios/CLEAN-012/webview2-profile/Login Data, scenarios/CLEAN-012/webview2-profile/Cookies, scenarios/CLEAN-012/webview2-profile/Web Data |
| A | CLEAN-013 | PASS | 60 | scenarios/CLEAN-013/reinstall.log, scenarios/CLEAN-013/second-uninstall-user-data-kept.txt, scenarios/CLEAN-013/webview2-profile/Login Data, scenarios/CLEAN-013/webview2-profile/Cookies ... |
| A | CLEAN-CONTAMINATION | PASS | 22 | scenarios/CLEAN-CONTAMINATION/temp-top-diff.json, scenarios/CLEAN-CONTAMINATION/encastra-named-at-end.txt |
| B | CLEAN-001 | PASS | 17 | scenarios/CLEAN-001/encastra-named-files.txt, scenarios/CLEAN-001/base-activation.txt, scenarios/CLEAN-001/base-network.txt |
| B | CLEAN-002 | PASS | 6 |  |
| B | CLEAN-003 | PASS | 34 | scenarios/CLEAN-003/install.log, scenarios/CLEAN-003/install-dir.json |
| B | CLEAN-004 | PASS | 10 | scenarios/CLEAN-004/first-launch.png, scenarios/CLEAN-004/host-modules.txt |
| B | CLEAN-005 | PASS | 19 | scenarios/CLEAN-005/gui-journeys.log, scenarios/CLEAN-005/gui-journeys.log.policy-cleanup.log, scenarios/CLEAN-005/gui-journeys.log.windows-events.txt |
| B | CLEAN-006 | PASS | 12 | scenarios/CLEAN-006/state-before-close.json, scenarios/CLEAN-006/state-after-relaunch.json, scenarios/CLEAN-006/after-relaunch.png |
| B | CLEAN-007 | PASS | 27 | scenarios/CLEAN-007/state-after-reboot.json, scenarios/CLEAN-007/after-reboot.png, scenarios/CLEAN-007/gui-journeys-after-reboot.log, scenarios/CLEAN-007/gui-journeys-after-reboot.log.policy-cleanup.log ... |
| B | CLEAN-008 | PASS | 17 | scenarios/CLEAN-008/damaged-library.png |
| B | CLEAN-009 | FAIL | 29 |  |
| B | CLEAN-010 | PASS | 10 |  |
| B | CLEAN-012 | PASS | 42 | scenarios/CLEAN-012/uninstall-user-data-kept.txt, scenarios/CLEAN-012/webview2-profile/Login Data, scenarios/CLEAN-012/webview2-profile/Cookies, scenarios/CLEAN-012/webview2-profile/Web Data |
| B | CLEAN-013 | PASS | 60 | scenarios/CLEAN-013/reinstall.log, scenarios/CLEAN-013/second-uninstall-user-data-kept.txt, scenarios/CLEAN-013/webview2-profile/Login Data, scenarios/CLEAN-013/webview2-profile/Cookies ... |
| B | CLEAN-CONTAMINATION | PASS | 22 | scenarios/CLEAN-CONTAMINATION/temp-top-diff.json, scenarios/CLEAN-CONTAMINATION/encastra-named-at-end.txt |
| U2 | CLEAN-001 | PASS | 17 | scenarios/CLEAN-001/encastra-named-files.txt, scenarios/CLEAN-001/base-activation.txt, scenarios/CLEAN-001/base-network.txt |
| U2 | CLEAN-002 | PASS | 12 |  |
| U2 | CLEAN-011 | PASS | 98 | scenarios/CLEAN-011/install-A.log, scenarios/CLEAN-011/state-A.json, scenarios/CLEAN-011/install-B-over-A.log, scenarios/CLEAN-011/install-dir-after-upgrade.json ... |
| U2 | CLEAN-CONTAMINATION | PASS | 22 | scenarios/CLEAN-CONTAMINATION/temp-top-diff.json, scenarios/CLEAN-CONTAMINATION/encastra-named-at-end.txt |
| N1-tampered | CLEAN-001 | PASS | 17 | scenarios/CLEAN-001/encastra-named-files.txt, scenarios/CLEAN-001/base-activation.txt, scenarios/CLEAN-001/base-network.txt |
| N1-tampered | CLEAN-002 | FAIL | 6 |  |
| N2-missing | CLEAN-001 | PASS | 17 | scenarios/CLEAN-001/encastra-named-files.txt, scenarios/CLEAN-001/base-activation.txt, scenarios/CLEAN-001/base-network.txt |
| N2-missing | CLEAN-002 | FAIL | 1 |  |
| N3-contaminated | CLEAN-001 | FAIL | 17 | scenarios/CLEAN-001/encastra-named-files.txt, scenarios/CLEAN-001/base-activation.txt, scenarios/CLEAN-001/base-network.txt |
| N4-wrong-version | CLEAN-001 | PASS | 17 | scenarios/CLEAN-001/encastra-named-files.txt, scenarios/CLEAN-001/base-activation.txt, scenarios/CLEAN-001/base-network.txt |
| N4-wrong-version | CLEAN-002 | PASS | 6 |  |
| N4-wrong-version | CLEAN-003 | FAIL | 34 | scenarios/CLEAN-003/install.log, scenarios/CLEAN-003/install-dir.json |
| N5-runtime | CLEAN-001 | PASS | 17 | scenarios/CLEAN-001/encastra-named-files.txt, scenarios/CLEAN-001/base-activation.txt, scenarios/CLEAN-001/base-network.txt |
| N5-runtime | CLEAN-002 | PASS | 6 |  |
| N5-runtime | CLEAN-003 | PASS | 34 | scenarios/CLEAN-003/install.log, scenarios/CLEAN-003/install-dir.json |
| N5-runtime | CLEAN-004 | FAIL | 9 | scenarios/CLEAN-004/first-launch.png, scenarios/CLEAN-004/host-modules.txt |
| N5-runtime | CLEAN-005 | FAIL | 19 | scenarios/CLEAN-005/gui-journeys.log, scenarios/CLEAN-005/gui-journeys.log.policy-cleanup.log, scenarios/CLEAN-005/gui-journeys.log.windows-events.txt |
| N5-runtime | CLEAN-012 | FAIL | 42 | scenarios/CLEAN-012/uninstall-user-data-kept.txt, scenarios/CLEAN-012/webview2-profile/Login Data, scenarios/CLEAN-012/webview2-profile/Cookies, scenarios/CLEAN-012/webview2-profile/Web Data |
| N5-runtime | CLEAN-CONTAMINATION | FAIL | 22 | scenarios/CLEAN-CONTAMINATION/temp-top-diff.json, scenarios/CLEAN-CONTAMINATION/encastra-named-at-end.txt |

## Problems

- A CLEAN-009: FAIL: a refused save leaves no .encastra-writing temporary beside the target -> C:\Users\tester\AppData\Local\cleanvm-work\read-only.encastra-writing exists=True
- B CLEAN-009: FAIL: a refused save leaves no .encastra-writing temporary beside the target -> C:\Users\tester\AppData\Local\cleanvm-work\read-only.encastra-writing exists=True
- N1-tampered CLEAN-002: FAIL: candidate installer sha256 is the published digest -> e38eca7a7bad96a0f91b8720459c9b45beb7e7816ee1ebfc40db2d6021790ec9
- N1-tampered CLEAN-002: FAIL: candidate the copy in Downloads is byte-identical -> e38eca7a7bad96a0f91b8720459c9b45beb7e7816ee1ebfc40db2d6021790ec9
- N2-missing CLEAN-002: FAIL: candidate installer present on the harness disc -> D:\artifacts\Encastra_0.5.0-rc.5_x64-setup.exe
- N2-missing CLEAN-002: required check missing: 'installer sha256 is the published digest'
- N2-missing CLEAN-002: required check missing: 'host verified the'
- N2-missing CLEAN-002: required check missing: 'signature state'
- N2-missing CLEAN-002: required check missing: 'byte-identical'
- N3-contaminated CLEAN-001: FAIL: no marker from an earlier cycle (fresh overlay of the base) -> left by an earlier cycle (injected)
- N3-contaminated CLEAN-001: FAIL: no file or folder named *encastra* anywhere on C: -> 2: C:\Users\tester\AppData\Local\Encastra C:\Users\tester\AppData\Local\Encastra\encastra-desktop.exe
- N3-contaminated CLEAN-001: FAIL: no Encastra uninstall entry in HKCU or HKLM -> hive key name version ---- --- ---- ------- HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall Encastra-injected Encastra
- N3-contaminated CLEAN-001: FAIL: no Encastra or Encastra WebView2 process -> encastra-desktop.exe
- N4-wrong-version CLEAN-003: FAIL: install_check reported no FAIL line -> 2: FAIL installed ProductVersion -> 0.5.0-rc.5 (FileVersion 0.5.0-rc.5) FAIL HKCU uninstall entry -> DisplayVersion=0.5.0-rc.5 InstallLocation="C:\Users\tester\AppData\Local\Encastra"
- N4-wrong-version CLEAN-003: FAIL: install_check PASS: installed ProductVersion -> (null)
- N4-wrong-version CLEAN-003: FAIL: install_check PASS: HKCU uninstall entry -> (null)
- N5-runtime CLEAN-004: FAIL: the application reaches ready (interface rendered, IPC round trip) -> not ready after 90s; last: no CDP endpoint on 127.0.0.1:9222 (fetch failed); the application has to be started with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222
- N5-runtime CLEAN-004: FAIL: WebView2 browser processes for this application run from the Windows WebView2 runtime -> 0; (null); elsewhere: (null)
- N5-runtime CLEAN-004: required check missing: 'first-run welcome'
- N5-runtime CLEAN-005: FAIL: no FAIL or SKIP line anywhere in the log (not only in the SUMMARY) -> 1: FAIL j3 import landed in the library -> nothing (injected) [iteration 1/1]
- N5-runtime CLEAN-005: FAIL: the SUMMARY pass count equals the PASS lines in the log -> SUMMARY passed=60 failed=0 skipped=0 repeat=1 stamp=1ce8e864da3eba12043684d86f4accf51707e519
- N5-runtime CLEAN-005: FAIL: at least 100 PASS lines (100 per iteration) -> 59
- N5-runtime CLEAN-005: FAIL: the refusals were exercised (a folder nobody chose is refused) -> 0: (null)
- N5-runtime CLEAN-005: gui-journeys.log: 1 FAIL/SKIP line(s), first: FAIL  j3 import landed in the library -> nothing (injected)  [iteration 1/1]
- N5-runtime CLEAN-012: FAIL: uninstall: while installed and used, run_keys is as the baseline had it -> Name Value ---- ----- added {HKCU:\Software\Microsoft\Windows\CurrentVersion\Run|Encastra-injected=C:\Users\teste... removed {}
- N5-runtime CLEAN-012: FAIL: after uninstall, run_keys is as the baseline had it -> Name Value ---- ----- added {HKCU:\Software\Microsoft\Windows\CurrentVersion\Run|Encastra-injected=C:\Users\teste... removed {}
- N5-runtime CLEAN-CONTAMINATION: FAIL: run_keys unchanged from the baseline -> Name Value ---- ----- added {HKCU:\Software\Microsoft\Windows\CurrentVersion\Run|Encastra-injected=C:\Users\teste... removed {}

## Network (host capture)

Evidence, not a verdict: a frame names no process and Windows calls Microsoft by itself. Only a DNS name containing "encastra" fails a cycle.

- A: `-netdev user,id=n0,restrict=on`; capture read, 2590 packet(s), 6 guest destination(s), 20 DNS name(s)
  - DNS: aefd.nelreports.net, config.edge.skype.com, cp801.prod.do.dsp.mp.microsoft.com, ctldl.windowsupdate.com, dns.msftncsi.com, ecs.office.com, edge.microsoft.com, fe2cr.update.microsoft.com, fs.microsoft.com, g.live.com, geo.prod.do.dsp.mp.microsoft.com, geover.prod.do.dsp.mp.microsoft.com, go.microsoft.com, officeclient.microsoft.com, searchapp.bundleassets.example, self.events.data.microsoft.com, settings-win.data.microsoft.com, wdcp.microsoft.com, www.bing.com, www.microsoft.com
  - destinations: udp 10.0.2.255:137, udp 224.0.0.252:5355, udp 239.255.255.250:1900, udp [fec0:0:0:ffff::1]:53, udp [fec0:0:0:ffff::2]:53, udp [fec0:0:0:ffff::3]:53
- B: `-netdev user,id=n0,restrict=on`; capture read, 2372 packet(s), 6 guest destination(s), 20 DNS name(s)
  - DNS: aefd.nelreports.net, config.edge.skype.com, cp801.prod.do.dsp.mp.microsoft.com, ctldl.windowsupdate.com, dns.msftncsi.com, ecs.office.com, edge.microsoft.com, fe2cr.update.microsoft.com, fs.microsoft.com, g.live.com, geo.prod.do.dsp.mp.microsoft.com, geover.prod.do.dsp.mp.microsoft.com, go.microsoft.com, officeclient.microsoft.com, searchapp.bundleassets.example, self.events.data.microsoft.com, settings-win.data.microsoft.com, to-do.microsoft.com, wdcp.microsoft.com, www.bing.com
  - destinations: udp 10.0.2.255:137, udp 224.0.0.252:5355, udp 239.255.255.250:1900, udp [fec0:0:0:ffff::1]:53, udp [fec0:0:0:ffff::2]:53, udp [fec0:0:0:ffff::3]:53
- U2: `-netdev user,id=n0,restrict=on`; capture read, 1005 packet(s), 6 guest destination(s), 16 DNS name(s)
  - DNS: aefd.nelreports.net, config.edge.skype.com, cp801.prod.do.dsp.mp.microsoft.com, ctldl.windowsupdate.com, dns.msftncsi.com, edge.microsoft.com, g.live.com, geo.prod.do.dsp.mp.microsoft.com, geover.prod.do.dsp.mp.microsoft.com, officeclient.microsoft.com, searchapp.bundleassets.example, self.events.data.microsoft.com, settings-win.data.microsoft.com, to-do.microsoft.com, wdcp.microsoft.com, www.bing.com
  - destinations: udp 10.0.2.255:137, udp 224.0.0.252:5355, udp 239.255.255.250:1900, udp [fec0:0:0:ffff::1]:53, udp [fec0:0:0:ffff::2]:53, udp [fec0:0:0:ffff::3]:53
- N1-tampered: `-netdev user,id=n0,restrict=on`; capture read, 714 packet(s), 6 guest destination(s), 13 DNS name(s)
  - DNS: aefd.nelreports.net, config.edge.skype.com, cp801.prod.do.dsp.mp.microsoft.com, dns.msftncsi.com, edge.microsoft.com, g.live.com, geover.prod.do.dsp.mp.microsoft.com, officeclient.microsoft.com, searchapp.bundleassets.example, self.events.data.microsoft.com, settings-win.data.microsoft.com, www.bing.com, www.microsoft.com
  - destinations: udp 10.0.2.255:137, udp 224.0.0.252:5355, udp 239.255.255.250:1900, udp [fec0:0:0:ffff::1]:53, udp [fec0:0:0:ffff::2]:53, udp [fec0:0:0:ffff::3]:53
- N2-missing: `-netdev user,id=n0,restrict=on`; capture read, 676 packet(s), 6 guest destination(s), 17 DNS name(s)
  - DNS: aefd.nelreports.net, config.edge.skype.com, cp801.prod.do.dsp.mp.microsoft.com, dns.msftncsi.com, edge.microsoft.com, g.live.com, geo.prod.do.dsp.mp.microsoft.com, geover.prod.do.dsp.mp.microsoft.com, officeclient.microsoft.com, searchapp.bundleassets.example, self.events.data.microsoft.com, settings-win.data.microsoft.com, staging.to-do.microsoft.com, staging.to-do.officeppe.com, to-do.microsoft.com, www.bing.com, www.microsoft.com
  - destinations: udp 10.0.2.255:137, udp 224.0.0.252:5355, udp 239.255.255.250:1900, udp [fec0:0:0:ffff::1]:53, udp [fec0:0:0:ffff::2]:53, udp [fec0:0:0:ffff::3]:53
- N3-contaminated: `-netdev user,id=n0,restrict=on`; capture read, 652 packet(s), 6 guest destination(s), 14 DNS name(s)
  - DNS: aefd.nelreports.net, config.edge.skype.com, cp801.prod.do.dsp.mp.microsoft.com, dns.msftncsi.com, edge.microsoft.com, g.live.com, geo.prod.do.dsp.mp.microsoft.com, geover.prod.do.dsp.mp.microsoft.com, officeclient.microsoft.com, searchapp.bundleassets.example, self.events.data.microsoft.com, settings-win.data.microsoft.com, to-do.microsoft.com, www.bing.com
  - destinations: udp 10.0.2.255:137, udp 224.0.0.252:5355, udp 239.255.255.250:1900, udp [fec0:0:0:ffff::1]:53, udp [fec0:0:0:ffff::2]:53, udp [fec0:0:0:ffff::3]:53
- N4-wrong-version: `-netdev user,id=n0,restrict=on`; capture read, 734 packet(s), 6 guest destination(s), 16 DNS name(s)
  - DNS: aefd.nelreports.net, cp801.prod.do.dsp.mp.microsoft.com, dns.msftncsi.com, ecs.office.com, edge.microsoft.com, g.live.com, geo.prod.do.dsp.mp.microsoft.com, geover.prod.do.dsp.mp.microsoft.com, go.microsoft.com, officeclient.microsoft.com, searchapp.bundleassets.example, self.events.data.microsoft.com, settings-win.data.microsoft.com, teams.microsoft.com, wdcp.microsoft.com, www.bing.com
  - destinations: udp 10.0.2.255:137, udp 224.0.0.252:5355, udp 239.255.255.250:1900, udp [fec0:0:0:ffff::1]:53, udp [fec0:0:0:ffff::2]:53, udp [fec0:0:0:ffff::3]:53
- N5-runtime: `-netdev user,id=n0,restrict=on`; capture read, 908 packet(s), 6 guest destination(s), 13 DNS name(s)
  - DNS: aefd.nelreports.net, config.edge.skype.com, cp801.prod.do.dsp.mp.microsoft.com, dns.msftncsi.com, g.live.com, geover.prod.do.dsp.mp.microsoft.com, officeclient.microsoft.com, searchapp.bundleassets.example, self.events.data.microsoft.com, settings-win.data.microsoft.com, to-do.microsoft.com, wdcp.microsoft.com, www.bing.com
  - destinations: udp 10.0.2.255:137, udp 224.0.0.252:5355, udp 239.255.255.250:1900, udp [fec0:0:0:ffff::1]:53, udp [fec0:0:0:ffff::2]:53, udp [fec0:0:0:ffff::3]:53

## WebView2 profile kept after uninstall

- A CLEAN-012: Login Data: logins=0; Cookies: cookies=0; Web Data: autofill=1, credit_cards=0
- A CLEAN-013: Login Data: logins=0; Cookies: cookies=0; Web Data: autofill=1, credit_cards=0
- B CLEAN-012: Login Data: logins=0; Cookies: cookies=0; Web Data: autofill=1, credit_cards=0
- B CLEAN-013: Login Data: logins=0; Cookies: cookies=0; Web Data: autofill=1, credit_cards=0
- N5-runtime CLEAN-012: Login Data: logins=0; Cookies: cookies=0; Web Data: autofill=0, credit_cards=0

## Negative cycles

- N1-tampered: OK - {'CLEAN-002': 'FAIL as expected', 'CLEAN-003': 'not run, as expected'}
- N2-missing: OK - {'CLEAN-002': 'FAIL as expected', 'CLEAN-003': 'not run, as expected'}
- N3-contaminated: OK - {'CLEAN-001': 'FAIL as expected', 'CLEAN-002': 'not run, as expected', 'CLEAN-003': 'not run, as expected'}
- N4-wrong-version: OK - {'CLEAN-003': 'FAIL as expected', 'CLEAN-004': 'not run, as expected'}
- N5-runtime: OK - {'CLEAN-004': 'FAIL as expected', 'CLEAN-005': 'FAIL as expected', 'CLEAN-012': 'FAIL as expected', 'CLEAN-CONTAMINATION': 'FAIL as expected'}
