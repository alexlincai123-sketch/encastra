"""Mutation run over scripts/cleanvm/report.py: every mutant must be killed by the unit tests.

    python scripts/cleanvm/mutate_report.py

Each mutant disables one rule of the judge; scripts/tests/test_cleanvm_report.py must fail against
it. Exit 1 if a non-equivalent mutant survives. M6 is equivalent by construction: judge_scenario
keeps a second, independent "no assertion was executed" guard.
"""
import pathlib, shutil, subprocess, sys, tempfile

REPO = pathlib.Path(__file__).resolve().parents[2]
EQUIVALENT = {"M6 zero assertions allowed"}
SRC = (REPO / "scripts/cleanvm/report.py").read_text(encoding="utf-8")

MUTANTS = {
    "M1 serial assertions ignored": ('        if want not in ser_names:\n', '        if False:\n'),
    "M2 serial count ignored": ('    if len(ser) != len(asserts):\n', '    if False:\n'),
    "M3 serial RESULT ignored": ('    if sid in serial_r:\n', '    if True:\n        pass\n    elif sid in serial_r:\n'),
    "M4 required checks ignored": ('        if not any(frag in n for n in names):\n', '        if False:\n'),
    "M5 BLOCKED counts as PASS": ('    s.result = "PASS" if not s.problems and derived == "PASS" else', '    s.result = "PASS" if derived in ("PASS", "BLOCKED", "NOT_APPLICABLE") else'),
    "M6 zero assertions allowed": ('("FAIL" if forced or not asserts else "PASS")', '("FAIL" if forced else "PASS")'),
    "M7 journeys logs not re-read": ('            s.problems.extend(check_journeys_log(results_dir / ev, expected["installer"]))', '            pass'),
    "M8 buried FAIL lines ignored": ('    if bad:\n        problems.append', '    if False:\n        problems.append'),
    "M9 inject ignored": ('    if c.plan.get("inject"):\n        p.append', '    if False:\n        p.append'),
    "M10 dirty harness ignored": ('    if c.plan.get("harness_dirty"):', '    if False:'),
    "M11 timeout ignored": ('    if (path / "timed-out").exists():', '    if False:'),
    "M12 CLEANVM-DONE ignored": ('    if "CLEANVM-DONE" not in serial_text:', '    if False:'),
    "M13 base identity ignored": ('        if not a.base_sha or a.base_sha != b.base_sha:', '        if False:'),
    "M14 artefact ignored": ('    if art.get("sha256") != expected["installer"]["sha256"] or art.get("file") != expected["installer"]["file"]:', '    if False:'),
    "M15 negative always ok": ('            hit = sc is not None and sc.result == "FAIL" and all(any(f in p for p in sc.problems) for f in frags)', '            hit = True'),
    "M16 harness disc ignored": ('        if seen.get(f) != h:', '        if False:'),
    "M17 no negative spec passes": ('    matrix["NEGATIVE"] = "PASS" if negative_spec and neg_ok else', '    matrix["NEGATIVE"] = "PASS" if neg_ok else'),
    "M18 recorded result trusted": ('    if rec.get("result") != derived:', '    if False:'),
    "M19 fingerprint ignored": ('            if fa[k] != fb.get(k):', '            if False:'),
    "M20 missing upgrade cycle ok": ('                matrix[key] = "NOT_RUN"; continue', '                matrix[key] = "PASS"; continue'),
}

results = {}
for name, (old, new) in MUTANTS.items():
    if SRC.count(old) != 1:
        results[name] = f"NOT APPLIED (pattern found {SRC.count(old)} times)"
        continue
    with tempfile.TemporaryDirectory() as t:
        t = pathlib.Path(t)
        (t / "scripts" / "cleanvm").mkdir(parents=True)
        (t / "scripts" / "tests").mkdir(parents=True)
        (t / "scripts" / "cleanvm" / "report.py").write_text(SRC.replace(old, new), encoding="utf-8")
        shutil.copy2(REPO / "scripts/tests/test_cleanvm_report.py", t / "scripts/tests/test_cleanvm_report.py")
        r = subprocess.run([sys.executable, "-m", "unittest", "discover", "-s", str(t / "scripts/tests"), "-p", "test_cleanvm_report.py"],
                           capture_output=True, text=True, cwd=t)
        results[name] = "KILLED" if r.returncode != 0 else "SURVIVED"
for k, v in results.items():
    print(f"{v:10} {k}")
print(f"killed {sum(v == 'KILLED' for v in results.values())}/{len(results)} (equivalent: {sorted(EQUIVALENT)})")
survivors = [k for k, v in results.items() if v != "KILLED" and k not in EQUIVALENT]
sys.exit(1 if survivors else 0)
