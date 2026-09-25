#!/usr/bin/env python3
"""Judge Clean VM cycles from their evidence, trusting none of the guest's own verdicts.

    python scripts/cleanvm/report.py --cycles DIR [DIR ...] --negative-spec spec.json --out OUT

A cycle directory is what scripts/cleanvm/lab/lab.sh leaves: results/ (the guest's results disk),
serial.log (the host's own capture of COM1), plan.json, expected.json, harness-manifest.json,
harness.sha256, base.sha256, qemu.exit.

For every scenario the verdict is re-derived here:

  * PASS needs at least one assertion, every assertion ok, no forced reason - recomputed from the
    assertions, and the recorded result must agree;
  * every assertion in result.json must appear on the serial line with the same PASS/FAIL, and the
    serial RESULT line must agree - a results disk edited after the fact disagrees with a channel
    the guest could not rewrite;
  * each scenario must carry the assertions this file requires of it (REQUIRED), so a check that
    was deleted or never reached cannot leave a green scenario behind;
  * the artefact named in every record must be expected.json's installer;
  * gui_journeys logs are parsed again: SUMMARY present, failed=0 skipped=0, no FAIL/SKIP line
    anywhere, stamp = build commit.

The acceptance verdict needs: every required scenario PASS in two full cycles (A, B) and the
upgrade cycle, none of them carrying an injected fault or a dirty harness, the same base image,
equivalent results (CLEAN-014), and every negative cycle failing exactly where its spec says.
Anything else is FAIL, NOT_RUN or BLOCKED - never PASS.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import sys
from dataclasses import dataclass, field

FULL_REQUIRED = ["CLEAN-001", "CLEAN-002", "CLEAN-003", "CLEAN-004", "CLEAN-005", "CLEAN-006", "CLEAN-007",
                 "CLEAN-008", "CLEAN-009", "CLEAN-010", "CLEAN-012", "CLEAN-013", "CLEAN-CONTAMINATION"]
UPGRADE_REQUIRED = ["CLEAN-001", "CLEAN-002", "CLEAN-011", "CLEAN-CONTAMINATION"]

# Assertion-name fragments each scenario must contain. Deleting or skipping one of these checks
# turns the scenario into FAIL here, whatever the guest wrote.
REQUIRED = {
    "CLEAN-001": ["no marker from an earlier cycle", "no file or folder named *encastra*", "no Encastra uninstall entry",
                  "no developer tool on PATH", "no developer tool installation directory", "medium integrity",
                  "Windows licence usable", "first-logon setup (OneDrive) had finished"],
    "CLEAN-002": ["installer sha256 is the published digest", "host verified the published identity", "signature state",
                  "byte-identical"],
    "CLEAN-003": ["install_check exit code", "install_check reported no FAIL line", "build commit stamped",
                  "only the NSIS bundle marker rewritten", "exactly one Encastra uninstall entry, under HKCU",
                  "leaves run_keys unchanged", "leaves services unchanged", "leaves scheduled_tasks unchanged"],
    "CLEAN-004": ["reaches ready", "first-run welcome", "loads modules only from", "no module from a developer toolchain",
                  "no connection from the application", "no Application Error"],
    "CLEAN-005": ["gui_journeys exit code", "SUMMARY: failed=0 skipped=0", "no FAIL or SKIP line anywhere",
                  "SUMMARY stamp is the expected build commit", "journey j1", "journey j5", "refusals were exercised",
                  "during the journeys"],
    "CLEAN-006": ["language choice was saved", "language still Espanol after relaunch", "preferences identical after relaunch",
                  "library listing identical", "no Encastra or WebView2 process left after the close"],
    "CLEAN-007": ["Windows really restarted", "did not start by itself", "byte-identical across the restart",
                  "ready after the restart", "preferences unchanged across the restart", "gui_journeys exit code"],
    "CLEAN-008": ["open something that is not a project", "import from a folder nobody chose",
                  "reaches ready with damaged preferences", "moved aside, not deleted", "exactly the bytes that could not be read",
                  "tells the person the library index was set aside"],
    "CLEAN-009": ["import_publication from unchosen 'C:\\Windows'", "run_graph with grants to unchosen", "non-ASCII letters succeeds",
                  "into C:\\Windows (protected)", "over a read-only file", "while the library index is locked",
                  "not mistaken for a corrupt one"],
    "CLEAN-010": ["graceful close ends the host", "no orphan within 15 s of a graceful close", "hard kill of the host leaves no orphaned",
                  "relaunch after a hard kill reaches ready"],
    "CLEAN-011": ["saw version A installed before the upgrade", "exactly one Encastra uninstall entry, at version B",
                  "language carried over the upgrade", "preferences carried over the upgrade", "gui_journeys exit code",
                  "executable removed"],
    "CLEAN-012": ["uninstaller exit code", "executable removed", "install directory removed", "no Encastra uninstall entry left",
                  "no Encastra shortcut left", "after uninstall, services is as the baseline", "no credential-like file",
                  "uninstaller process tree finished", "holds only what Tauri keeps", "HKCU" + chr(92) + "Software gained nothing but"],
    "CLEAN-013": ["install_check exit code", "reinstalled application reaches ready", "second uninstall: executable removed"],
    "CLEAN-CONTAMINATION": ["run_keys unchanged from the baseline", "services unchanged from the baseline",
                            "scheduled_tasks unchanged from the baseline", "no Encastra-named path outside",
                            "no new top-level folder", "hkcu_software gained nothing but", "at the end: HKCU"],
}

SERIAL_ASSERT = re.compile(r"^\S+ (PASS|FAIL) (\S+) (.*?) -> ")
SERIAL_RESULT = re.compile(r"^\S+ RESULT (\S+) (\S+) assertions=(\d+) failed=(\d+)")
SUMMARY_RE = re.compile(r"^SUMMARY\s+passed=(\d+) failed=(\d+) skipped=(\d+)\s+repeat=(\d+)\s+stamp=(\S+)")


@dataclass
class Scenario:
    id: str
    result: str
    problems: list[str] = field(default_factory=list)
    assertions: int = 0
    evidence: list[str] = field(default_factory=list)


@dataclass
class Cycle:
    path: pathlib.Path
    name: str
    plan: dict
    expected: dict
    scenarios: dict[str, Scenario]
    problems: list[str]
    base_sha: str
    environment: dict


def load_json(p: pathlib.Path):
    return json.loads(p.read_text(encoding="utf-8-sig"))


def parse_serial(text: str) -> tuple[dict[str, list[tuple[str, str]]], dict[str, tuple[str, int, int]]]:
    asserts: dict[str, list[tuple[str, str]]] = {}
    results: dict[str, tuple[str, int, int]] = {}
    for line in text.splitlines():
        m = SERIAL_RESULT.match(line)
        if m:
            results[m.group(1)] = (m.group(2), int(m.group(3)), int(m.group(4)))
            continue
        m = SERIAL_ASSERT.match(line)
        if m:
            asserts.setdefault(m.group(2), []).append((m.group(1), m.group(3)))
    return asserts, results


def check_journeys_log(path: pathlib.Path, expected: dict) -> list[str]:
    if not path.exists():
        return [f"{path.name} missing"]
    lines = path.read_text(encoding="utf-8-sig", errors="replace").splitlines()
    problems = []
    summaries = [l for l in lines if l.startswith("SUMMARY")]
    if not summaries:
        problems.append(f"{path.name}: no SUMMARY line (the run did not reach its end)")
    else:
        m = SUMMARY_RE.match(summaries[-1])
        if not m:
            problems.append(f"{path.name}: unreadable SUMMARY {summaries[-1]!r}")
        else:
            if m.group(2) != "0" or m.group(3) != "0":
                problems.append(f"{path.name}: SUMMARY failed={m.group(2)} skipped={m.group(3)}")
            if m.group(5) != expected["build_commit"]:
                problems.append(f"{path.name}: SUMMARY stamp {m.group(5)} != {expected['build_commit']}")
    bad = [l for l in lines if l.startswith("FAIL") or l.startswith("SKIP")]
    if bad:
        problems.append(f"{path.name}: {len(bad)} FAIL/SKIP line(s), first: {bad[0][:160]}")
    return problems


def judge_scenario(sid: str, rec: dict, serial_a: dict, serial_r: dict, expected: dict, results_dir: pathlib.Path) -> Scenario:
    asserts = rec.get("assertions") or []
    s = Scenario(sid, "FAIL", assertions=len(asserts), evidence=list(rec.get("evidence") or []))
    failed = [a for a in asserts if not a.get("ok")]
    forced = rec.get("forced_reason")
    derived = "FAIL" if failed else (rec.get("result") if forced and rec.get("result") in ("BLOCKED", "NOT_APPLICABLE") else ("FAIL" if forced or not asserts else "PASS"))
    if rec.get("result") != derived:
        s.problems.append(f"recorded result {rec.get('result')} but the assertions say {derived}")
    for a in failed:
        s.problems.append(f"FAIL: {a.get('name')} -> {str(a.get('observed'))[:200]}")
    if forced:
        s.problems.append(f"forced: {forced}")
    if not asserts:
        s.problems.append("no assertion was executed")
    # The serial channel.
    ser = serial_a.get(sid, [])
    ser_names = [(v, n) for v, n in ser]
    for a in asserts:
        want = ("PASS" if a.get("ok") else "FAIL", a.get("name"))
        if want not in ser_names:
            s.problems.append(f"assertion not on the serial line as {want[0]}: {a.get('name')}")
    if len(ser) != len(asserts):
        s.problems.append(f"serial line has {len(ser)} assertions for {sid}, result.json has {len(asserts)}")
    if sid in serial_r:
        sr, sn, sf = serial_r[sid]
        if sr != rec.get("result") or sn != len(asserts) or sf != len(failed):
            s.problems.append(f"serial RESULT {sr} {sn}/{sf} disagrees with result.json {rec.get('result')} {len(asserts)}/{len(failed)}")
    else:
        s.problems.append("no RESULT line for this scenario on the serial line")
    # Required checks.
    names = [a.get("name", "") for a in asserts]
    for frag in REQUIRED.get(sid, []):
        if not any(frag in n for n in names):
            s.problems.append(f"required check missing: {frag!r}")
    # The artefact.
    art = rec.get("artifact") or {}
    if art.get("sha256") != expected["installer"]["sha256"] or art.get("file") != expected["installer"]["file"]:
        s.problems.append(f"record names artefact {art} not {expected['installer']['file']} {expected['installer']['sha256']}")
    # Journeys logs, read again.
    for ev in s.evidence:
        if re.search(r"gui-journeys[^/]*\.log$", ev) and not ev.endswith("policy-cleanup.log"):
            s.problems.extend(check_journeys_log(results_dir / ev, expected["installer"]))
    s.result = "PASS" if not s.problems and derived == "PASS" else ("BLOCKED" if derived == "BLOCKED" and not failed else "FAIL")
    return s


def load_cycle(path: pathlib.Path) -> Cycle:
    problems: list[str] = []
    plan = load_json(path / "plan.json")
    expected = load_json(path / "expected.json")
    results = path / "results"
    serial_text = (path / "serial.log").read_text(encoding="utf-8", errors="replace") if (path / "serial.log").exists() else ""
    if not serial_text:
        problems.append("no serial log")
    serial_a, serial_r = parse_serial(serial_text)
    qexit = (path / "qemu.exit").read_text().strip() if (path / "qemu.exit").exists() else "missing"
    if qexit != "0":
        problems.append(f"QEMU exit {qexit}")
    if (path / "timed-out").exists():
        problems.append("the cycle hit its time limit and the VM was killed")
    if "CLEANVM-DONE" not in serial_text:
        problems.append("the guest never reported CLEANVM-DONE")
    # The disc the VM saw is the disc the host assembled.
    manifest = load_json(path / "harness-manifest.json") if (path / "harness-manifest.json").exists() else {}
    seen = {}
    if (path / "harness.sha256").exists():
        for line in (path / "harness.sha256").read_text().splitlines():
            h, f = line.split(None, 1)
            seen[f.strip().lstrip("*").removeprefix("./")] = h
    for f, h in manifest.items():
        if seen.get(f) != h:
            problems.append(f"harness disc file {f}: manifest {h} vs disc {seen.get(f)}")
    base_sha = ""
    if (path / "base.sha256").exists():
        base_sha = next((l.split()[0] for l in (path / "base.sha256").read_text().splitlines() if l.endswith("base.qcow2")), "")
    scenarios: dict[str, Scenario] = {}
    for d in sorted((results / "scenarios").glob("*")) if (results / "scenarios").exists() else []:
        rp = d / "result.json"
        if rp.exists():
            rec = load_json(rp)
            scenarios[rec["scenario_id"]] = judge_scenario(rec["scenario_id"], rec, serial_a, serial_r, expected, results)
    env = load_json(results / "environment.json") if (results / "environment.json").exists() else {}
    return Cycle(path, plan["cycle"], plan, expected, scenarios, problems, base_sha, env)


def is_clean_acceptance(c: Cycle) -> list[str]:
    p = []
    if c.plan.get("inject"):
        p.append(f"cycle {c.name} carried injected faults {c.plan['inject']}")
    if c.plan.get("tamper_installer") or c.plan.get("omit_installer"):
        p.append(f"cycle {c.name} carried a tampered or missing installer")
    if c.plan.get("harness_dirty"):
        p.append(f"cycle {c.name} ran an uncommitted harness")
    return p


def fingerprint(c: Cycle) -> dict:
    """What two equivalent cycles must share."""
    out = {}
    s3 = c.path / "results" / "scenarios" / "CLEAN-003" / "install-dir.json"
    if s3.exists():
        try:
            data = load_json(s3)
        except ValueError:
            data = []
        data = [data] if isinstance(data, dict) else (data if isinstance(data, list) else [])
        out["installed_files"] = sorted((str(x.get("path")), str(x.get("sha256"))) for x in data if isinstance(x, dict))
    out["scenario_results"] = {k: v.result for k, v in c.scenarios.items()}
    out["windows_build"] = c.environment.get("build")
    out["machine_guid"] = c.environment.get("machine_guid")
    return out


def judge(cycles: list[Cycle], negative_spec: dict) -> dict:
    verdict: dict = {"cycles": {}, "matrix": {}, "negative": {}, "problems": []}
    for c in cycles:
        verdict["cycles"][c.name] = {
            "mode": c.plan.get("mode"), "inject": c.plan.get("inject"), "problems": c.problems,
            "scenarios": {k: {"result": v.result, "assertions": v.assertions, "problems": v.problems} for k, v in c.scenarios.items()},
        }
    by_name = {c.name: c for c in cycles}
    full = [c for c in cycles if c.plan.get("mode") == "full" and not c.plan.get("inject") and c.name in ("A", "B")]
    upg = [c for c in cycles if c.plan.get("mode") == "upgrade" and not c.plan.get("inject")]
    matrix = verdict["matrix"]

    def req(c: Cycle | None, ids: list[str], label: str):
        for sid in ids:
            key = f"{sid}@{label}"
            if c is None:
                matrix[key] = "NOT_RUN"; continue
            sc = c.scenarios.get(sid)
            state = "NOT_RUN" if sc is None else sc.result
            if state == "PASS" and (c.problems or is_clean_acceptance(c)):
                state = "FAIL"
            matrix[key] = state

    req(by_name.get("A"), FULL_REQUIRED, "A")
    req(by_name.get("B"), FULL_REQUIRED, "B")
    req(upg[0] if upg else None, UPGRADE_REQUIRED, "U")
    for c in full + upg:
        verdict["problems"].extend(c.problems)
        verdict["problems"].extend(is_clean_acceptance(c))
    # CLEAN-014: B is A again, from a fresh overlay of the same base.
    a, b = by_name.get("A"), by_name.get("B")
    rep = []
    if not (a and b):
        rep.append("cycles A and B are both needed")
    else:
        if not a.base_sha or a.base_sha != b.base_sha:
            rep.append(f"base image differs: {a.base_sha} vs {b.base_sha}")
        fa, fb = fingerprint(a), fingerprint(b)
        for k in fa:
            if fa[k] != fb.get(k):
                rep.append(f"{k} differs between A and B")
        if a.path == b.path:
            rep.append("A and B are the same directory")
    matrix["CLEAN-014"] = "PASS" if not rep and all(matrix.get(f"{s}@B") == "PASS" for s in FULL_REQUIRED) else ("NOT_RUN" if not (a and b) else "FAIL")
    verdict["repeatability"] = rep
    # Negative cycles: each must fail where its spec says, and nowhere pass what it should not.
    neg_ok = True
    for name, spec in negative_spec.items():
        c = by_name.get(name)
        res = {"expected": spec, "observed": None, "ok": False}
        if c is None:
            res["observed"] = "NOT_RUN"; neg_ok = False; verdict["negative"][name] = res; continue
        if not c.plan.get("inject") and not c.plan.get("tamper_installer") and not c.plan.get("omit_installer"):
            res["observed"] = "the cycle carried no fault"; neg_ok = False; verdict["negative"][name] = res; continue
        obs = {}
        good = True
        for sid, frags in spec.get("must_fail", {}).items():
            frags = [frags] if isinstance(frags, str) else list(frags)
            sc = c.scenarios.get(sid)
            hit = sc is not None and sc.result == "FAIL" and all(any(f in p for p in sc.problems) for f in frags)
            obs[sid] = "FAIL as expected" if hit else f"{sc.result if sc else 'NOT_RUN'}: {sc.problems[:3] if sc else ''}"
            good &= hit
        for sid in spec.get("must_not_run", []):
            ran = sid in c.scenarios
            obs[sid] = "ran (should not have)" if ran else "not run, as expected"
            good &= not ran
        if "CLEANVM-DONE" not in (c.path / "serial.log").read_text(errors="replace"):
            obs["_done"] = "guest did not finish"; good = False
        res["observed"], res["ok"] = obs, good
        neg_ok &= good
        verdict["negative"][name] = res
    matrix["NEGATIVE"] = "PASS" if negative_spec and neg_ok else ("NOT_RUN" if not negative_spec else "FAIL")
    all_pass = all(v == "PASS" for v in matrix.values()) and not verdict["problems"]
    verdict["CLEAN_VM_ACCEPTANCE"] = "PASS" if all_pass else "FAIL"
    return verdict


def write_summary(verdict: dict, cycles: list[Cycle], out: pathlib.Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    (out / "verdict.json").write_text(json.dumps(verdict, indent=2), encoding="utf-8")
    lines = ["# Clean VM acceptance - summary", "", f"**CLEAN_VM_ACCEPTANCE: {verdict['CLEAN_VM_ACCEPTANCE']}**", "",
             "| Scenario | Result |", "|---|---|"]
    for k, v in verdict["matrix"].items():
        lines.append(f"| {k} | {v} |")
    lines += ["", "## Evidence index", "", "| Cycle | Scenario | Result | Assertions | Evidence |", "|---|---|---|---|---|"]
    for c in cycles:
        for sid, sc in sorted(c.scenarios.items()):
            ev = ", ".join(sc.evidence[:4]) + (" ..." if len(sc.evidence) > 4 else "")
            lines.append(f"| {c.name} | {sid} | {sc.result} | {sc.assertions} | {ev} |")
    lines += ["", "## Problems", ""]
    for c in cycles:
        for p in c.problems:
            lines.append(f"- {c.name}: {p}")
        for sid, sc in sorted(c.scenarios.items()):
            for p in sc.problems:
                lines.append(f"- {c.name} {sid}: {p}")
    if verdict.get("repeatability"):
        lines += ["", "## Repeatability"] + [f"- {p}" for p in verdict["repeatability"]]
    lines += ["", "## Negative cycles", ""]
    for n, r in verdict["negative"].items():
        lines.append(f"- {n}: {'OK' if r['ok'] else 'NOT OK'} - {r['observed']}")
    (out / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cycles", nargs="+", required=True)
    ap.add_argument("--negative-spec")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    cycles = [load_cycle(pathlib.Path(p)) for p in args.cycles]
    spec = json.loads(pathlib.Path(args.negative_spec).read_text()) if args.negative_spec else {}
    verdict = judge(cycles, spec)
    write_summary(verdict, cycles, pathlib.Path(args.out))
    print(f"CLEAN_VM_ACCEPTANCE: {verdict['CLEAN_VM_ACCEPTANCE']}")
    for k, v in verdict["matrix"].items():
        print(f"  {k:28} {v}")
    return 0 if verdict["CLEAN_VM_ACCEPTANCE"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
