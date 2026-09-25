"""Mutation run over scripts/cleanvm/report.py: every mutant must be killed by the unit tests.

    python scripts/cleanvm/mutate_report.py

Each mutant disables one rule of the judge; scripts/tests/test_cleanvm_report.py must fail against
it. Exit 1 if a non-equivalent mutant survives. M6 is equivalent by construction: judge_scenario
keeps a second, independent "no assertion was executed" guard.

M21-M35 cover the host-side checks (qemu.cmdline, net.pcap, WebView2 profile databases). The
tests assert the specific problem text of each rule, so a rule that is disabled cannot hide behind
another rule that happens to fail the same fixture. The whole-page guard on a kept SQLite copy has
no mutant: SQLite rejects the same cut-off copies itself, so disabling it is equivalent.
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
    # Host-side checks: the VM's network and the WebView2 profile kept after uninstall.
    "M21 restrict=on not required": ('        if not restricts or any(r != "on" for r in restricts):', '        if False:'),
    "M22 missing command line accepted": ('    if not cmd_text:\n        netdev, network_problems = [], [', '    if False:\n        netdev, network_problems = [], ['),
    "M23 non-user backend accepted": ('        if kind != "user":\n', '        if False:\n'),
    "M24 guestfwd accepted": ('        if any(k == "guestfwd" for k, _ in pairs):', '        if False:'),
    "M25 no restricted -netdev accepted": ('    if not restricted_netdev:', '    if False:'),
    "M26 missing capture accepted": ('return summary, ["no network capture', 'return summary, [] if True else ["no network capture'),
    "M27 truncated capture accepted": ('        if start + incl > len(data):', '        if False:'),
    "M28 encastra DNS names ignored": ('    bad = sorted(n for n in acc["dns"] if "encastra" in n.lower())', '    bad = []'),
    "M29 encastra match case-sensitive": ('if "encastra" in n.lower())', 'if "encastra" in n)'),
    "M30 unparsed encastra DNS ignored": ('    if acc["dns_unparsed_encastra"]:', '    if False:'),
    "M31 IPv6 frames ignored": ('        elif etype == 0x86DD:\n', '        elif False:\n'),
    "M32 negative cycle network ignored": ('        if c.network_problems:', '        if False:'),
    "M33 profile not checked": ('    if sid in PROFILE_SCENARIOS:', '    if False:'),
    "M34 kept credential rows ignored": ('            if n:\n                problems.append(f"credential-like', '            if False:\n                problems.append(f"credential-like'),
    "M35 unreadable kept database accepted": ('            problems.append(f"webview2-profile/{fname} could not be read', '            pass  # problems.append(f"webview2-profile/{fname} could not be read'),
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
