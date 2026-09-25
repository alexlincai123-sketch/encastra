"""scripts/cleanvm/report.py: a green verdict only from evidence that is complete and consistent.

Each test builds cycle directories the way lab.sh leaves them, then breaks one thing - the ways a
Clean VM run could be wrong while looking right - and requires the verdict to stop being PASS.
"""

from __future__ import annotations

import copy
import hashlib
import ipaddress
import json
import pathlib
import sqlite3
import struct
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "cleanvm"))
import report  # noqa: E402

BUILD = "1ce8e864da3eba12043684d86f4accf51707e519"
SETUP = "Encastra_0.5.0-rc.5_x64-setup.exe"
SHA = "afaec18b217d66171a5c9c9f530d94b6e7e591ca61af18a3101733cb01674f10"
EXPECTED = {"installer": {"file": SETUP, "sha256": SHA, "version": "0.5.0-rc.5", "build_commit": BUILD,
                          "installed_exe_sha256": "e" * 64}}
BASE_SHA = "b" * 64


def journeys_log(fail_line: bool = False, summary: bool = True, failed: int = 0) -> str:
    lines = [f"SUBJECT exe=x sha256={'e' * 64} stamp={BUILD} version=0.5.0-rc.5"]
    lines += [f"PASS  j{(i % 5) + 1} step {i} -> ok" for i in range(20)]
    if fail_line:
        lines.insert(10, "FAIL  j3 import landed -> nothing")
    if summary:
        lines.append(f"SUMMARY  passed=20 failed={failed} skipped=0  repeat=1  stamp={BUILD}")
    return "\n".join(lines) + "\n"


# What lab.sh records: /proc/PID/cmdline with its NULs turned into spaces.
QEMU_CMDLINE = ("qemu-system-x86_64 -enable-kvm -machine q35,smm=off -m 8192 "
                "-netdev user,id=n0,restrict=on -device e1000e,netdev=n0 -serial file:/srv/encastra-vm/cycles/X/serial.log "
                "-name cleanvm-X -object filter-dump,id=cap0,netdev=n0,file=/srv/encastra-vm/cycles/X/net.pcap ")
GUEST_MAC = bytes.fromhex("525400123456")
SLIRP_MAC = bytes.fromhex("52550a000202")


def ipv4_frame(src: str, dst: str, proto: int, body: bytes, frag: int = 0) -> bytes:
    hdr = struct.pack(">BBHHHBBH4s4s", 0x45, 0, 20 + len(body), 1, frag, 128, proto, 0,
                      bytes(int(x) for x in src.split(".")), bytes(int(x) for x in dst.split(".")))
    from_guest = src.startswith("10.0.2.") and src not in ("10.0.2.2", "10.0.2.3")
    macs = SLIRP_MAC + GUEST_MAC if from_guest else GUEST_MAC + SLIRP_MAC
    return macs + struct.pack(">H", 0x0800) + hdr + body


def ipv6_frame(src: str, dst: str, nh: int, body: bytes) -> bytes:
    hdr = struct.pack(">IHBB", 6 << 28, len(body), nh, 64) + ipaddress.IPv6Address(src).packed + ipaddress.IPv6Address(dst).packed
    return SLIRP_MAC + GUEST_MAC + struct.pack(">H", 0x86DD) + hdr + body


def udp(sport: int, dport: int, payload: bytes) -> bytes:
    return struct.pack(">HHHH", sport, dport, 8 + len(payload), 0) + payload


def tcp(sport: int, dport: int, flags: int) -> bytes:
    return struct.pack(">HHIIBBHHH", sport, dport, 1, 0, 0x50, flags, 64240, 0, 0)


def dns_query(name: str, qid: int = 0x1234, response: bool = False) -> bytes:
    q = b"".join(bytes([len(l)]) + l.encode() for l in name.split(".")) + b"\x00" + struct.pack(">HH", 1, 1)
    return struct.pack(">HHHHHH", qid, 0x8180 if response else 0x0100, 1, 0, 0, 0) + q


def pcap(frames, big_endian: bool = False, linktype: int = 1) -> bytes:
    o = ">" if big_endian else "<"
    out = struct.pack(o + "IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65536, linktype)
    for i, f in enumerate(frames):
        out += struct.pack(o + "IIII", 1_700_000_000 + i, 0, len(f), len(f)) + f
    return out


def default_frames():
    """What an idle clean Windows sends with nowhere to go: a DNS question and a TCP SYN."""
    return [ipv4_frame("10.0.2.15", "10.0.2.3", 17, udp(50000, 53, dns_query("www.msftconnecttest.com"))),
            ipv4_frame("10.0.2.15", "13.107.4.52", 6, tcp(50001, 80, 0x02))]


def make_db(path: pathlib.Path, tables: dict) -> None:
    """A Chromium-like SQLite file: table name -> number of rows."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    con = sqlite3.connect(str(path))
    try:
        for t, n in tables.items():
            # autofill keeps (name, value) pairs; n may be a count or the pairs themselves.
            rows = n if isinstance(n, list) else [(f"field-{i}", f"secret-{i}") for i in range(n)]
            con.execute(f'CREATE TABLE "{t}" (id INTEGER PRIMARY KEY, name TEXT, value TEXT)')
            con.executemany(f'INSERT INTO "{t}" (name, value) VALUES (?, ?)', rows)
        con.commit()
    finally:
        con.close()


class Fixture:
    """One cycle directory, every scenario PASS, serial log consistent with the records."""

    def __init__(self, root: pathlib.Path, name: str, mode: str = "full", inject=None, base_sha=BASE_SHA,
                 big_endian_capture: bool = False):
        self.dir = root / name
        self.results = self.dir / "results"
        (self.results / "scenarios").mkdir(parents=True)
        self.plan = {"cycle": name, "mode": mode, "inject": inject or [], "tamper_installer": False,
                     "omit_installer": False, "harness_dirty": False}
        self.serial: list[str] = []
        ids = report.FULL_REQUIRED if mode == "full" else report.UPGRADE_REQUIRED
        for sid in ids:
            self.add(sid)
        self.serial.append("t CLEANVM-DONE")
        (self.results / "environment.json").write_text(json.dumps({"build": "26200.6584", "machine_guid": "g"}))
        manifest = {"plan.json": "1" * 64}
        (self.dir / "harness-manifest.json").write_text(json.dumps(manifest))
        (self.dir / "harness.sha256").write_text(f"{'1' * 64}  ./plan.json\n")
        (self.dir / "base.sha256").write_text(f"{base_sha}  base.qcow2\n")
        (self.dir / "qemu.exit").write_text("0\n")
        (self.dir / "expected.json").write_text(json.dumps(EXPECTED))
        (self.dir / "qemu.cmdline").write_text(QEMU_CMDLINE.replace("cycles/X", f"cycles/{name}").replace("cleanvm-X", f"cleanvm-{name}"))
        self.write_capture(default_frames(), big_endian=big_endian_capture)
        self.flush()
        s3 = self.results / "scenarios" / "CLEAN-003"
        if s3.exists():
            (s3 / "install-dir.json").write_text(json.dumps([{"path": "encastra-desktop.exe", "sha256": "e" * 64}]))

    def add(self, sid: str, names=None, oks=None, result="PASS", evidence=None, serial=True):
        names = names or [f"{frag} (check)" for frag in report.REQUIRED.get(sid, ["generic check"])]
        oks = oks if oks is not None else [True] * len(names)
        rec = {"scenario_id": sid, "result": result, "forced_reason": None,
               "artifact": {"file": SETUP, "sha256": SHA, "version": "0.5.0-rc.5"},
               "assertions": [{"name": n, "ok": o, "observed": "x"} for n, o in zip(names, oks)],
               "evidence": evidence or []}
        d = self.results / "scenarios" / sid
        d.mkdir(parents=True, exist_ok=True)
        (d / "result.json").write_text(json.dumps(rec))
        if sid == "CLEAN-005":
            (d / "gui-journeys.log").write_text(journeys_log())
            rec["evidence"] = [f"scenarios/{sid}/gui-journeys.log"]
            (d / "result.json").write_text(json.dumps(rec))
        if serial:
            for n, o in zip(names, oks):
                self.serial.append(f"t {'PASS' if o else 'FAIL'} {sid} {n} -> x")
            self.serial.append(f"t RESULT {sid} {result} assertions={len(names)} failed={oks.count(False)}")

    def record(self, sid: str) -> dict:
        return json.loads((self.results / "scenarios" / sid / "result.json").read_text())

    def write_record(self, sid: str, rec: dict) -> None:
        (self.results / "scenarios" / sid / "result.json").write_text(json.dumps(rec))

    def write_capture(self, frames, big_endian: bool = False) -> None:
        (self.dir / "net.pcap").write_bytes(pcap(frames, big_endian))

    def profile(self, sid: str) -> pathlib.Path:
        return self.results / "scenarios" / sid / "webview2-profile"

    def flush(self):
        (self.dir / "plan.json").write_text(json.dumps(self.plan))
        (self.dir / "serial.log").write_text("\n".join(self.serial) + "\n")


class ReportTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.tmp.name)
        self.A = Fixture(self.root, "A")
        self.B = Fixture(self.root, "B", big_endian_capture=True)
        self.U = Fixture(self.root, "U", mode="upgrade")
        self.N = Fixture(self.root, "N1", inject=["hidden-fail"])
        rec = self.N.record("CLEAN-001")
        self.spec = {"N1": {"must_fail": {"CLEAN-001": "FAIL: no marker"}}}
        rec["assertions"][0]["ok"] = False
        rec["result"] = "FAIL"
        self.N.write_record("CLEAN-001", rec)
        self.N.serial = [l.replace("PASS CLEAN-001 no marker", "FAIL CLEAN-001 no marker").replace("RESULT CLEAN-001 PASS assertions=6 failed=0", "RESULT CLEAN-001 FAIL assertions=6 failed=1") for l in self.N.serial]
        self.N.flush()

    def tearDown(self):
        self.tmp.cleanup()

    def verdict(self):
        cycles = [report.load_cycle(f.dir) for f in (self.A, self.B, self.U, self.N)]
        return report.judge(cycles, self.spec)

    def assertNotPass(self, why: str):
        v = self.verdict()
        self.assertEqual(v["CLEAN_VM_ACCEPTANCE"], "FAIL", why)
        return v

    def test_complete_consistent_evidence_passes(self):
        v = self.verdict()
        self.assertEqual(v["CLEAN_VM_ACCEPTANCE"], "PASS", json.dumps(v, indent=1)[:3000])

    def test_pass_with_zero_assertions_is_fail(self):
        rec = self.A.record("CLEAN-004"); rec["assertions"] = []; self.A.write_record("CLEAN-004", rec)
        v = self.assertNotPass("a scenario with no executed assertion")
        self.assertEqual(v["matrix"]["CLEAN-004@A"], "FAIL")

    def test_failed_assertion_under_a_pass_result_is_fail(self):
        rec = self.A.record("CLEAN-003"); rec["assertions"][0]["ok"] = False; self.A.write_record("CLEAN-003", rec)
        self.assertNotPass("result.json says PASS over a failed assertion")

    def test_missing_scenario_is_not_run(self):
        import shutil
        shutil.rmtree(self.B.results / "scenarios" / "CLEAN-009")
        v = self.assertNotPass("a scenario that never ran")
        self.assertEqual(v["matrix"]["CLEAN-009@B"], "NOT_RUN")

    def test_blocked_or_not_applicable_is_not_pass(self):
        for forced in ("BLOCKED", "NOT_APPLICABLE"):
            with self.subTest(forced=forced):
                rec = self.A.record("CLEAN-008"); rec["result"] = forced; rec["forced_reason"] = "no disk"; self.A.write_record("CLEAN-008", rec)
                v = self.assertNotPass(f"{forced} must not count")
                self.assertNotEqual(v["matrix"]["CLEAN-008@A"], "PASS")

    def test_disabled_required_check_is_fail(self):
        rec = self.A.record("CLEAN-012")
        rec["assertions"] = [a for a in rec["assertions"] if "install directory removed" not in a["name"]]
        self.A.write_record("CLEAN-012", rec)
        self.A.serial = [l for l in self.A.serial if "install directory removed" not in l]
        self.A.serial = [l.replace("RESULT CLEAN-012 PASS assertions=7", "RESULT CLEAN-012 PASS assertions=6") for l in self.A.serial]
        self.A.flush()
        v = self.assertNotPass("a required check deleted from the scenario")
        self.assertTrue(any("required check missing" in p for p in v["cycles"]["A"]["scenarios"]["CLEAN-012"]["problems"]))

    def test_results_disk_disagreeing_with_serial_is_fail(self):
        self.A.serial = [l.replace("PASS CLEAN-006 language choice", "FAIL CLEAN-006 language choice") for l in self.A.serial]
        self.A.flush()
        self.assertNotPass("the serial line saw a FAIL the results disk does not show")

    def test_serial_assertion_missing_from_the_record_is_fail(self):
        # The guest printed a check the record does not carry: the record lost something.
        self.A.serial.insert(3, "t FAIL CLEAN-004 a check the record dropped -> x")
        self.A.flush()
        v = self.assertNotPass("an assertion seen on the serial line and absent from result.json")
        self.assertEqual(v["matrix"]["CLEAN-004@A"], "FAIL")

    def test_recorded_fail_with_passing_assertions_is_not_upgraded_to_pass(self):
        rec = self.A.record("CLEAN-010"); rec["result"] = "FAIL"; self.A.write_record("CLEAN-010", rec)
        self.A.serial = [l.replace("RESULT CLEAN-010 PASS", "RESULT CLEAN-010 FAIL") for l in self.A.serial]
        self.A.flush()
        v = self.assertNotPass("a scenario the guest called FAIL must not become PASS here")
        self.assertEqual(v["matrix"]["CLEAN-010@A"], "FAIL")

    def test_missing_serial_result_line_is_fail(self):
        self.A.serial = [l for l in self.A.serial if "RESULT CLEAN-010" not in l]
        self.A.flush()
        self.assertNotPass("no RESULT line for a scenario")

    def test_wrong_artifact_in_a_record_is_fail(self):
        rec = self.A.record("CLEAN-004"); rec["artifact"]["sha256"] = "0" * 64; self.A.write_record("CLEAN-004", rec)
        self.assertNotPass("a record about some other installer")

    def test_hidden_fail_in_journeys_log_is_fail(self):
        (self.A.results / "scenarios" / "CLEAN-005" / "gui-journeys.log").write_text(journeys_log(fail_line=True))
        v = self.assertNotPass("a FAIL buried in a journeys log whose SUMMARY says failed=0")
        self.assertEqual(v["matrix"]["CLEAN-005@A"], "FAIL")

    def test_journeys_log_without_summary_is_fail(self):
        (self.B.results / "scenarios" / "CLEAN-005" / "gui-journeys.log").write_text(journeys_log(summary=False))
        self.assertNotPass("a journeys run that never reached its end")

    def test_injected_cycle_cannot_be_acceptance(self):
        self.A.plan["inject"] = ["persist"]; self.A.flush()
        self.assertNotPass("an acceptance cycle carrying an injected fault")

    def test_dirty_harness_cannot_be_acceptance(self):
        self.U.plan["harness_dirty"] = True; self.U.flush()
        self.assertNotPass("an acceptance cycle run from an uncommitted harness")

    def test_local_dev_build_cannot_be_acceptance(self):
        self.A.plan["dev_build"] = True; self.A.flush()
        v = self.assertNotPass("a cycle that tested a local build, not the published artefact")
        self.assertTrue(any("local dev build" in p for p in v["problems"]))

    def test_timed_out_cycle_is_fail(self):
        (self.B.dir / "timed-out").write_text("timeout")
        self.assertNotPass("a cycle whose VM was killed at the time limit")

    def test_guest_that_never_finished_is_fail(self):
        self.B.serial = [l for l in self.B.serial if "CLEANVM-DONE" not in l]; self.B.flush()
        self.assertNotPass("a guest that did not report CLEANVM-DONE")

    def test_harness_disc_mismatch_is_fail(self):
        (self.A.dir / "harness.sha256").write_text(f"{'2' * 64}  ./plan.json\n")
        self.assertNotPass("the disc the VM saw is not the disc that was assembled")

    def test_different_base_between_A_and_B_breaks_repeatability(self):
        (self.B.dir / "base.sha256").write_text(f"{'c' * 64}  base.qcow2\n")
        v = self.assertNotPass("cycle B on a different base image")
        self.assertEqual(v["matrix"]["CLEAN-014"], "FAIL")

    def test_different_installed_bytes_between_A_and_B_breaks_repeatability(self):
        (self.B.results / "scenarios" / "CLEAN-003" / "install-dir.json").write_text(json.dumps([{"path": "encastra-desktop.exe", "sha256": "f" * 64}]))
        v = self.assertNotPass("the two cycles installed different bytes")
        self.assertEqual(v["matrix"]["CLEAN-014"], "FAIL")

    def test_negative_cycle_that_did_not_fail_is_fail(self):
        rec = self.N.record("CLEAN-001"); rec["assertions"][0]["ok"] = True; rec["result"] = "PASS"; self.N.write_record("CLEAN-001", rec)
        self.N.serial = [l.replace("FAIL CLEAN-001 no marker", "PASS CLEAN-001 no marker").replace("RESULT CLEAN-001 FAIL assertions=6 failed=1", "RESULT CLEAN-001 PASS assertions=6 failed=0") for l in self.N.serial]
        self.N.flush()
        v = self.assertNotPass("a fault the harness did not detect")
        self.assertEqual(v["matrix"]["NEGATIVE"], "FAIL")

    def test_negative_cycle_without_a_fault_is_not_evidence(self):
        self.N.plan["inject"] = []; self.N.flush()
        self.assertNotPass("a 'negative' cycle that carried no fault")

    def test_no_negative_spec_is_not_pass(self):
        self.spec = {}
        v = self.assertNotPass("no negative testing at all")
        self.assertEqual(v["matrix"]["NEGATIVE"], "NOT_RUN")

    def test_upgrade_cycle_missing_is_not_run(self):
        cycles = [report.load_cycle(f.dir) for f in (self.A, self.B, self.N)]
        v = report.judge(cycles, self.spec)
        self.assertEqual(v["CLEAN_VM_ACCEPTANCE"], "FAIL")
        self.assertEqual(v["matrix"]["CLEAN-011@U"], "NOT_RUN")

    # --- Host-side checks: the VM's network (F12, F2) ---------------------------------------

    def test_network_evidence_is_recorded(self):
        v = self.verdict()
        self.assertEqual(v["CLEAN_VM_ACCEPTANCE"], "PASS", json.dumps(v["problems"]))
        for name in ("A", "B"):  # B's capture is big-endian
            with self.subTest(cycle=name):
                cyc = v["cycles"][name]
                self.assertEqual(cyc["netdev"], ["-netdev user,id=n0,restrict=on"])
                net = cyc["network"]
                self.assertEqual(net["state"], "read")
                self.assertEqual(net["packets"], 2)
                self.assertEqual(net["guest_destinations"], ["tcp 13.107.4.52:80", "udp 10.0.2.3:53"])
                self.assertEqual(net["dns_queries"], ["www.msftconnecttest.com"])
        cycles = [report.load_cycle(f.dir) for f in (self.A, self.B, self.U, self.N)]
        out = self.root / "out"
        report.write_summary(v, cycles, out)
        md = (out / "summary.md").read_text(encoding="utf-8")
        self.assertIn("## Network (host capture)", md)
        self.assertIn("www.msftconnecttest.com", md)
        self.assertEqual(json.loads((out / "verdict.json").read_text(encoding="utf-8"))["cycles"]["A"]["network"]["packets"], 2)

    def test_capture_keeps_only_what_the_guest_tried(self):
        frames = [
            ipv4_frame("10.0.2.15", "13.107.4.52", 6, tcp(50010, 443, 0x02)),            # SYN: counted
            ipv4_frame("10.0.2.15", "192.0.2.10", 6, tcp(50011, 443, 0x12)),             # SYN+ACK: not an attempt
            ipv4_frame("10.0.2.15", "192.0.2.11", 6, tcp(50012, 80, 0x10)),              # ACK only
            ipv4_frame("10.0.2.2", "10.0.2.15", 17, udp(67, 68, b"\x02" * 40)),          # from slirp
            ipv4_frame("10.0.2.3", "10.0.2.15", 17, udp(53, 50013, dns_query("ctldl.windowsupdate.com", response=True))),
            ipv4_frame("10.0.2.15", "192.0.2.12", 17, udp(50014, 9999, b"x" * 8), frag=100),  # later fragment
            ipv6_frame("fec0::5054:ff:fe12:3456", "fec0::3", 17, udp(50015, 53, dns_query("login.live.com"))),
            SLIRP_MAC + GUEST_MAC + struct.pack(">H", 0x0806) + b"\x00" * 28,           # ARP
        ]
        self.A.write_capture(frames)
        v = self.verdict()
        self.assertEqual(v["CLEAN_VM_ACCEPTANCE"], "PASS", json.dumps(v["problems"]))
        net = v["cycles"]["A"]["network"]
        self.assertEqual(net["packets"], 8)
        self.assertEqual(net["guest_destinations"], ["tcp 13.107.4.52:443", "udp [fec0::3]:53"])
        self.assertEqual(net["dns_queries"], ["ctldl.windowsupdate.com", "login.live.com"])

    def test_missing_qemu_cmdline_is_fail(self):
        (self.A.dir / "qemu.cmdline").unlink()
        v = self.assertNotPass("no record of the command line the VM ran with")
        self.assertTrue(any("no QEMU command line recorded" in p for p in v["cycles"]["A"]["problems"]), v["cycles"]["A"]["problems"])
        self.assertEqual(v["matrix"]["CLEAN-001@A"], "FAIL")

    def test_route_out_is_fail(self):
        good = (self.A.dir / "qemu.cmdline").read_text()
        variants = {
            "restrict=off": (good.replace("restrict=on", "restrict=off"), "restrict=on required"),
            "restrict not set": (good.replace(",restrict=on", ""), "restrict=on required"),
            "restrict set twice": (good.replace("restrict=on", "restrict=on,restrict=off"), "restrict=on required"),
            "a second backend": (good + "-netdev tap,id=t1,ifname=tap0 -device e1000e,netdev=t1", "is not restricted user networking"),
            "guestfwd": (good.replace("restrict=on", "restrict=on,guestfwd=tcp:10.0.2.100:80-tcp:203.0.113.5:80"), "guestfwd"),
            "no -netdev at all": ("qemu-system-x86_64 -enable-kvm -m 8192 -name cleanvm-A", "no '-netdev user"),
        }
        for label, (text, why) in variants.items():
            with self.subTest(variant=label):
                (self.A.dir / "qemu.cmdline").write_text(text)
                v = self.assertNotPass(f"the VM had a route out: {label}")
                probs = v["cycles"]["A"]["problems"]
                self.assertTrue(any("the VM had a route out" in p and why in p for p in probs), probs)
        (self.A.dir / "qemu.cmdline").write_text(good)

    def test_negative_cycle_with_a_route_out_is_not_evidence(self):
        cmd = self.N.dir / "qemu.cmdline"
        cmd.write_text(cmd.read_text().replace("restrict=on", "restrict=off"))
        v = self.assertNotPass("a negative cycle run with a route out")
        self.assertEqual(v["matrix"]["NEGATIVE"], "FAIL")
        self.assertIn("_network", v["negative"]["N1"]["observed"])

    def test_missing_capture_is_fail(self):
        (self.B.dir / "net.pcap").unlink()
        v = self.assertNotPass("no record of what the NIC carried")
        self.assertTrue(any("no network capture" in p for p in v["cycles"]["B"]["problems"]), v["cycles"]["B"]["problems"])
        self.assertEqual(v["cycles"]["B"]["network"]["state"], "missing")

    def test_unreadable_capture_is_fail(self):
        whole = pcap(default_frames())
        variants = {
            "cut in the middle of a record": whole[:-3],
            "not a pcap file": b"this is not a capture file at all",
            "empty file": b"",
            "not Ethernet": pcap(default_frames(), linktype=101),
        }
        for label, data in variants.items():
            with self.subTest(variant=label):
                (self.A.dir / "net.pcap").write_bytes(data)
                v = self.assertNotPass(f"a capture that cannot be read: {label}")
                self.assertTrue(any("network capture unreadable" in p for p in v["cycles"]["A"]["problems"]), v["cycles"]["A"]["problems"])

    def test_dns_query_for_an_encastra_name_is_fail(self):
        for name in ("telemetry.encastra.app", "Updates.ENCASTRA.example"):
            with self.subTest(name=name):
                self.A.write_capture(default_frames() + [ipv4_frame("10.0.2.15", "10.0.2.3", 17, udp(50020, 53, dns_query(name)))])
                v = self.assertNotPass("something in the VM tried to resolve an Encastra name")
                self.assertTrue(any(f"DNS query for {name}" in p for p in v["cycles"]["A"]["problems"]), v["cycles"]["A"]["problems"])

    def test_unparseable_dns_message_mentioning_encastra_is_fail(self):
        # A reserved label type (0x40) stops the parser before the name; the bytes still say it.
        payload = struct.pack(">HHHHHH", 7, 0x0100, 1, 0, 0, 0) + b"\x48encastra\x03app\x00\x00\x01\x00\x01"
        self.A.write_capture(default_frames() + [ipv4_frame("10.0.2.15", "10.0.2.3", 17, udp(50021, 53, payload))])
        v = self.assertNotPass("a DNS message about encastra the parser could not read")
        self.assertTrue(any("mention encastra but could not be parsed" in p for p in v["cycles"]["A"]["problems"]), v["cycles"]["A"]["problems"])

    # --- Host-side checks: the WebView2 profile kept after uninstall (F3) ---------------------

    def test_cookie_kept_after_uninstall_is_fail(self):
        db = self.A.profile("CLEAN-012") / "Cookies"
        make_db(db, {"cookies": 1})
        before = db.read_bytes()
        v = self.assertNotPass("a cookie still in the WebView2 profile after the uninstall")
        self.assertEqual(v["matrix"]["CLEAN-012@A"], "FAIL")
        sc = v["cycles"]["A"]["scenarios"]["CLEAN-012"]
        self.assertTrue(any("credential-like data kept after uninstall: cookies=1" in p for p in sc["problems"]), sc["problems"])
        self.assertEqual(sc["webview2_profile"]["Cookies"]["rows"], {"cookies": 1})
        self.assertEqual(db.read_bytes(), before, "the evidence file must not be touched")
        self.assertEqual(sorted(x.name for x in db.parent.iterdir()), ["Cookies"], "nothing may be created beside the evidence")

    def test_credential_rows_in_any_kept_database_are_fail(self):
        for sid, fname, table in (("CLEAN-012", "Login Data", "logins"), ("CLEAN-013", "Web Data", "autofill"),
                                  ("CLEAN-013", "Web Data", "credit_cards")):
            with self.subTest(table=table):
                db = self.B.profile(sid) / fname
                make_db(db, {"autofill": 0, "credit_cards": 0, table: 2} if fname == "Web Data" else {table: 2})
                try:
                    v = self.assertNotPass(f"{table} rows kept after the uninstall")
                    self.assertEqual(v["matrix"][f"{sid}@B"], "FAIL")
                    probs = v["cycles"]["B"]["scenarios"][sid]["problems"]
                    want = "credential-like data kept after uninstall: autofill field 'field-0'" if table == "autofill" \
                        else f"credential-like data kept after uninstall: {table}=2"
                    self.assertTrue(any(want in p for p in probs), probs)
                finally:
                    db.unlink()

    def test_ordinary_form_history_in_autofill_is_recorded_not_failed(self):
        # What the Clean VM run found: WebView2 remembered the Publish panel's version field.
        make_db(self.A.profile("CLEAN-012") / "Web Data", {"autofill": [("_r_0_-version", "1.0.0")], "credit_cards": 0})
        v = self.verdict()
        self.assertEqual(v["CLEAN_VM_ACCEPTANCE"], "PASS", json.dumps(v["cycles"]["A"]["scenarios"]["CLEAN-012"]))
        self.assertEqual(v["cycles"]["A"]["scenarios"]["CLEAN-012"]["webview2_profile"]["Web Data"]["autofill"], ["_r_0_-version=1.0.0"])

    def test_secret_looking_autofill_field_is_fail(self):
        for name, value in (("_r_3_-api_token", "abc"), ("_r_1_-note", "Bearer eyJhbGciOi")):
            with self.subTest(name=name):
                make_db(self.A.profile("CLEAN-012") / "Web Data", {"autofill": [(name, value)], "credit_cards": 0})
                v = self.assertNotPass("a form field that looks like it held a secret, remembered by WebView2")
                self.assertTrue(any(f"autofill field {name!r}" in p for p in v["cycles"]["A"]["scenarios"]["CLEAN-012"]["problems"]))

    def test_absent_or_empty_profile_databases_pass(self):
        make_db(self.A.profile("CLEAN-013") / "Login Data", {"logins": 0})
        make_db(self.A.profile("CLEAN-012") / "Web Data", {"autofill": 0})  # no credit_cards table at all
        v = self.verdict()
        self.assertEqual(v["CLEAN_VM_ACCEPTANCE"], "PASS", json.dumps(v["problems"]) + json.dumps(v["cycles"]["A"]["scenarios"]["CLEAN-012"]))
        p13 = v["cycles"]["A"]["scenarios"]["CLEAN-013"]["webview2_profile"]
        self.assertEqual(p13["Login Data"]["rows"], {"logins": 0})
        self.assertEqual(p13["Cookies"], {"state": "absent"})
        self.assertEqual(p13["Web Data"], {"state": "absent"})
        p12 = v["cycles"]["A"]["scenarios"]["CLEAN-012"]["webview2_profile"]
        self.assertEqual(p12["Web Data"]["rows"], {"autofill": 0, "credit_cards": 0})
        self.assertEqual(p12["Web Data"]["missing_tables"], ["credit_cards"])
        # A cycle whose profile kept nothing at all still records that it looked.
        self.assertEqual(v["cycles"]["B"]["scenarios"]["CLEAN-012"]["webview2_profile"]["Login Data"], {"state": "absent"})

    def test_unreadable_profile_database_is_fail(self):
        for label, data in (("not SQLite", b"not a database " * 20), ("empty copy", b""),
                            ("cut-off copy", None)):
            with self.subTest(variant=label):
                db = self.A.profile("CLEAN-012") / "Cookies"
                if data is None:
                    make_db(db, {"cookies": 0, "filler": 200})
                    data = db.read_bytes()[:1500]
                db.parent.mkdir(parents=True, exist_ok=True)
                db.write_bytes(data)
                try:
                    v = self.assertNotPass(f"a kept database that cannot be read: {label}")
                    probs = v["cycles"]["A"]["scenarios"]["CLEAN-012"]["problems"]
                    self.assertTrue(any("webview2-profile/Cookies could not be read as SQLite" in p for p in probs), probs)
                finally:
                    db.unlink()


if __name__ == "__main__":
    unittest.main()
