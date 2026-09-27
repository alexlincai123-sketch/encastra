# Clean VM acceptance - summary

**CLEAN_VM_ACCEPTANCE: FAIL**

| Scenario | Result |
|---|---|
| CLEAN-001@A | NOT_RUN |
| CLEAN-002@A | NOT_RUN |
| CLEAN-003@A | NOT_RUN |
| CLEAN-004@A | NOT_RUN |
| CLEAN-005@A | NOT_RUN |
| CLEAN-006@A | NOT_RUN |
| CLEAN-007@A | NOT_RUN |
| CLEAN-008@A | NOT_RUN |
| CLEAN-009@A | NOT_RUN |
| CLEAN-010@A | NOT_RUN |
| CLEAN-012@A | NOT_RUN |
| CLEAN-013@A | NOT_RUN |
| CLEAN-CONTAMINATION@A | NOT_RUN |
| CLEAN-001@B | NOT_RUN |
| CLEAN-002@B | NOT_RUN |
| CLEAN-003@B | NOT_RUN |
| CLEAN-004@B | NOT_RUN |
| CLEAN-005@B | NOT_RUN |
| CLEAN-006@B | NOT_RUN |
| CLEAN-007@B | NOT_RUN |
| CLEAN-008@B | NOT_RUN |
| CLEAN-009@B | NOT_RUN |
| CLEAN-010@B | NOT_RUN |
| CLEAN-012@B | NOT_RUN |
| CLEAN-013@B | NOT_RUN |
| CLEAN-CONTAMINATION@B | NOT_RUN |
| CLEAN-001@U | NOT_RUN |
| CLEAN-002@U | NOT_RUN |
| CLEAN-011@U | NOT_RUN |
| CLEAN-CONTAMINATION@U | NOT_RUN |
| CLEAN-014 | NOT_RUN |
| NEGATIVE | NOT_RUN |

## Evidence index

| Cycle | Scenario | Result | Assertions | Evidence |
|---|---|---|---|---|
| D | CLEAN-001 | PASS | 17 | scenarios/CLEAN-001/encastra-named-files.txt, scenarios/CLEAN-001/base-activation.txt, scenarios/CLEAN-001/base-network.txt |
| D | CLEAN-002 | PASS | 6 |  |
| D | CLEAN-003 | PASS | 34 | scenarios/CLEAN-003/install.log, scenarios/CLEAN-003/install-dir.json |
| D | CLEAN-004 | PASS | 10 | scenarios/CLEAN-004/first-launch.png, scenarios/CLEAN-004/host-modules.txt |
| D | CLEAN-005 | PASS | 19 | scenarios/CLEAN-005/gui-journeys.log, scenarios/CLEAN-005/gui-journeys.log.policy-cleanup.log, scenarios/CLEAN-005/gui-journeys.log.windows-events.txt |
| D | CLEAN-006 | PASS | 12 | scenarios/CLEAN-006/state-before-close.json, scenarios/CLEAN-006/state-after-relaunch.json, scenarios/CLEAN-006/after-relaunch.png |
| D | CLEAN-007 | PASS | 27 | scenarios/CLEAN-007/state-after-reboot.json, scenarios/CLEAN-007/after-reboot.png, scenarios/CLEAN-007/gui-journeys-after-reboot.log, scenarios/CLEAN-007/gui-journeys-after-reboot.log.policy-cleanup.log ... |
| D | CLEAN-008 | PASS | 17 | scenarios/CLEAN-008/damaged-library.png |
| D | CLEAN-009 | PASS | 29 |  |
| D | CLEAN-010 | PASS | 10 |  |
| D | CLEAN-012 | PASS | 42 | scenarios/CLEAN-012/uninstall-user-data-kept.txt, scenarios/CLEAN-012/webview2-profile/Login Data, scenarios/CLEAN-012/webview2-profile/Cookies, scenarios/CLEAN-012/webview2-profile/Web Data |
| D | CLEAN-013 | PASS | 60 | scenarios/CLEAN-013/reinstall.log, scenarios/CLEAN-013/second-uninstall-user-data-kept.txt, scenarios/CLEAN-013/webview2-profile/Login Data, scenarios/CLEAN-013/webview2-profile/Cookies ... |
| D | CLEAN-CONTAMINATION | PASS | 22 | scenarios/CLEAN-CONTAMINATION/temp-top-diff.json, scenarios/CLEAN-CONTAMINATION/encastra-named-at-end.txt |

## Problems


## Network (host capture)

Evidence, not a verdict: a frame names no process and Windows calls Microsoft by itself. Only a DNS name containing "encastra" fails a cycle.

- D: `-netdev user,id=n0,restrict=on`; capture read, 2296 packet(s), 6 guest destination(s), 20 DNS name(s)
  - DNS: aefd.nelreports.net, config.edge.skype.com, cp801.prod.do.dsp.mp.microsoft.com, ctldl.windowsupdate.com, dns.msftncsi.com, ecs.office.com, edge.microsoft.com, fe2cr.update.microsoft.com, fs.microsoft.com, g.live.com, geo.prod.do.dsp.mp.microsoft.com, geover.prod.do.dsp.mp.microsoft.com, go.microsoft.com, officeclient.microsoft.com, searchapp.bundleassets.example, self.events.data.microsoft.com, settings-win.data.microsoft.com, to-do.microsoft.com, wdcp.microsoft.com, www.bing.com
  - destinations: udp 10.0.2.255:137, udp 224.0.0.252:5355, udp 239.255.255.250:1900, udp [fec0:0:0:ffff::1]:53, udp [fec0:0:0:ffff::2]:53, udp [fec0:0:0:ffff::3]:53

## WebView2 profile kept after uninstall

- D CLEAN-012: Login Data: logins=0; Cookies: cookies=0; Web Data: autofill=1, credit_cards=0
- D CLEAN-013: Login Data: logins=0; Cookies: cookies=0; Web Data: autofill=1, credit_cards=0

## Repeatability
- cycles A and B are both needed

## Negative cycles

