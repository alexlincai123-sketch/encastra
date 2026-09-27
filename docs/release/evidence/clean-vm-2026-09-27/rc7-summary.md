# Clean VM acceptance — 0.5.0-rc.7

**`CLEAN_VM_ACCEPTANCE: PASS`** — 2026-09-27, judged by `scripts/cleanvm/report.py`
(sha256 `864ef5a2…b23f`) and bound to the artefacts by `release_check.py --evidence-vm`
(verdict `BETA_READY` at `85fc59e`, `rc7-release-readiness.json` beside this file).

| | |
|---|---|
| Candidate | `Encastra_0.5.0-rc.7_x64-setup.exe` `2e340eb4b462a408feaf35052b2d6743002a8ed0fc706eddeb5b69cbf0ebd438`, `encastra-desktop.exe` `460e9f86b7eba6d9983105ac9de1493b72ed3ca52aa5c142dff9fee2674e9764`, NotSigned |
| Built by | candidate run 36280870081 (copy A = copy B), build commit `cdc4c35`, publication `85fc59e` (the tag `v0.5.0-rc.7`) |
| Machine | CLEAN_BASELINE `bbc062866d5aa7d9…` — Windows 11 Enterprise Evaluation 25H2 (26200.6584), WebView2 140; QEMU `-netdev user,restrict=on` in every cycle |
| Harness | `85fc59e`, clean tree, the same for every cycle judged |
| Upgrade source | 0.5.0-rc.5 (`afaec18b…4f10`, the published Release) |

## Results

| | A | B | U (rc.5 → rc.7) |
|---|---|---|---|
| CLEAN-001 … CLEAN-010, CLEAN-012, CLEAN-013 | 12/12 PASS | 12/12 PASS | — |
| CLEAN-001, CLEAN-002 | | | PASS |
| CLEAN-011 upgrade (98 assertions, exact install directory) | — | — | PASS |
| CLEAN-CONTAMINATION | PASS | PASS | PASS |
| CLEAN-014 (A ≡ B: base, results, installed bytes) | PASS | | |

GUI journeys on the installed build: 348 checks over three repetitions (CLEAN-005) and 117 (CLEAN-007)
in each of A and B, 0 failed, 0 skipped, stamped with build commit `cdc4c35`. The install directory
holds exactly `encastra-desktop.exe`, `uninstall.exe`, `LICENSE.txt` (PolyForm Noncommercial 1.0.0),
`NOTICE.txt`, `THIRD-PARTY.md` and `THIRD-PARTY-LICENSES.md`.

Negative cycles (the harness sees faults): all five fail exactly where `negative-spec.json` says.

| Cycle | Failed | Not run |
|---|---|---|
| N1-tampered | CLEAN-002 | CLEAN-003 |
| N2-missing | CLEAN-002 | CLEAN-003 |
| N3-contaminated | CLEAN-001 | CLEAN-002, CLEAN-003 |
| N4-wrong-version | CLEAN-003 | CLEAN-004 |
| N5-runtime | CLEAN-004, CLEAN-005, CLEAN-012, CLEAN-CONTAMINATION | — |

Host-side: 0 DNS names containing "encastra" in any cycle (Windows' own Microsoft lookups recorded,
not attributed).

## What did not count, and why

- **Cycle U, first attempt (02:17:31Z) — lab script defect.** `lab/lab.sh` looked for the QEMU
  process with `pgrep … | head -1` under `set -euo pipefail`. When pgrep ran before QEMU had
  exec'd, its exit 1 ended lab.sh. The orphaned VM then made the one-VM guard refuse N1–N5, and
  systemd killed it with the battery's unit before it wrote `serial.log`. The failure depends on
  host load: A and B were not affected. Fixed by `|| true` on that line; the repository copy has the same fix. A and B
  ran with the old `lab.sh` (sha256 `d5f801aa…b0fa`), U and N1–N5 with the fixed one
  (`0361d7d0…5a18`). `lab.sh` is not on the harness disc and nothing the judge reads comes from it:
  the harness hashes and commit are identical across all eight cycles.
- **A false start of the re-run (02:53:47Z).** Editing `lab.sh` from Windows dropped its exec bit,
  so every cycle stopped at `Permission denied` before lab.sh ran; no cycle directory was created.
  Re-started at 02:54:08Z after `chmod 755`.

Evidence (not in the repository: disk images and captures): `C:\Users\alexl\cleanvm-evidence\rc7-acceptance`
on the lab host, with `LAB-CHANGE.md` recording the lab.sh change; `rc7-verdict.json` beside this file
is the judge's output for it. Superseded attempts are kept on the lab host under
`/srv/encastra-vm/superseded/` (`rc7-try1-session-restart`, `rc7-U-qemu-start-failure`,
`rc7-battery2-noexec`).
