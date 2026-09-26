# Clean VM acceptance — 0.5.0-rc.6

**`CLEAN_VM_ACCEPTANCE: PASS`** — run 2 (definitive), 2026-09-26, judged by `scripts/cleanvm/report.py`
(sha256 `864ef5a2…b23f`) and bound to the artefacts by `release_check.py --evidence-vm`.

| | |
|---|---|
| Candidate | `Encastra_0.5.0-rc.6_x64-setup.exe` `59a00802f15803d6092ddbe9160f7d697ea83f096146a38a29a78e6649825b50`, `encastra-desktop.exe` `23203bcadde9a7585422141517038b55cf1707ae6e449e827018447a0a8c265c`, NotSigned |
| Built by | candidate run 36210428063 (copy A = copy B), build commit `627c293`, publication `1eed5bb`, verified before the tag against `ed516af` (`make_harness.py --candidate-ref`) |
| Machine | CLEAN_BASELINE `bbc062866d5aa7d9…` — Windows 11 Enterprise Evaluation 25H2 (26200.6584), WebView2 140; QEMU `-netdev user,restrict=on` in every cycle |
| Harness | `98f7ea5` (`test/rc6-harness`), the same for every cycle judged |
| Upgrade source | 0.5.0-rc.5 (`afaec18b…4f10`, the published Release) |

## Results

| | A | B | U2 (rc.5 → rc.6) |
|---|---|---|---|
| CLEAN-001 … CLEAN-010, CLEAN-012, CLEAN-013 | 12/12 PASS | 12/12 PASS | — |
| CLEAN-001, CLEAN-002 | | | PASS |
| CLEAN-011 upgrade (98 assertions, exact install directory) | — | — | PASS |
| CLEAN-CONTAMINATION | PASS | PASS | PASS |
| CLEAN-014 (A ≡ B: base, results, installed bytes) | PASS | | |

CLEAN-009 — the scenario 0.5.0-rc.5 failed (a refused save left `<name>.encastra-writing`) — passes
in A and B.

Negative cycles (the harness sees faults): all five fail exactly where `negative-spec.json` says.

| Cycle | Failed | Not run |
|---|---|---|
| N1-tampered | CLEAN-002 | CLEAN-003 |
| N2-missing | CLEAN-002 | CLEAN-003 |
| N3-contaminated | CLEAN-001 | CLEAN-002, CLEAN-003 |
| N4-wrong-version | CLEAN-003 | CLEAN-004 |
| N5-runtime | CLEAN-004, CLEAN-005, CLEAN-012, CLEAN-CONTAMINATION | — |

Host-side: 0 DNS names containing "encastra" in any cycle (Windows' own Microsoft lookups recorded,
not attributed). WebView2 profile kept after uninstall: 0 logins, 0 cookies, 0 payment cards, 1
autofill row (form history; recorded, not a credential).

## What did not count, and why

- **Run 1** (harness `ed516af`, 05:09–06:52Z): A 13/13, B 13/13, negatives all correct, but U 3/4 —
  CLEAN-011 expected exactly two files in the install directory, and rc.6 ships LICENSE.txt,
  NOTICE.txt and THIRD-PARTY.md (`fba750a`). A harness expectation, not a product defect; fixed in
  `98f7ea5` (one exact list, now also checked after a fresh install), and the whole battery re-run.
- **Run 2, cycle U — infrastructure incident.** The VM froze as a whole at 08:28:29Z, right after
  CLEAN-011's journeys: the guest clock stopped, QEMU spun at ~320 % CPU for 30 minutes, the host had
  0.5 GB free, and the WSL kernel log showed `Time jumped backwards` and repeated
  `UtilAcceptVsock: Waiting for abnormally long accept`. The cycle was terminated and kept aside
  (not part of the judged set); the upgrade was re-run as **U2** with the same harness, installer and
  base image, and passed.

Evidence (not in the repository: disk images and captures): `C:\Users\alexl\cleanvm-evidence\rc6-acceptance`
on the lab host; `verdict.json` beside this file is the judge's output for it.
