#!/usr/bin/env python3
"""Judge Clean VM cycles from their evidence, trusting none of the guest's own verdicts.

    python scripts/cleanvm/report.py --cycles DIR [DIR ...] --negative-spec spec.json --out OUT

A cycle directory is what scripts/cleanvm/lab/lab.sh leaves: results/ (the guest's results disk),
serial.log (the host's own capture of COM1), plan.json, expected.json, harness-manifest.json,
harness.sha256, base.sha256, qemu.exit, qemu.cmdline (the command line QEMU really ran with) and
net.pcap (every frame on the guest's only NIC, from QEMU's filter-dump).

Host-side checks, which read what the host itself recorded and so owe nothing to the guest:

  * qemu.cmdline must exist and show `-netdev user,...,restrict=on` as the only network backend,
    with no guestfwd: otherwise the VM had a route out and nothing it did is evidence of an
    offline machine. This holds for negative cycles too;
  * net.pcap must exist and parse. Its packet count, the guest's TCP SYN / UDP destinations and
    the DNS names it asked for are recorded as EVIDENCE only - the capture cannot say which process
    sent a frame, and Windows itself calls Microsoft - with one rule: a DNS question for a name
    containing "encastra" fails the cycle;
  * for CLEAN-012 and CLEAN-013, the WebView2 profile databases the guest copied out after the
    uninstall are opened (read-only, on a temporary copy) and any row in logins, cookies, autofill
    or credit_cards fails the scenario.

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
import ipaddress
import json
import pathlib
import re
import shutil
import sqlite3
import struct
import sys
import tempfile
from dataclasses import dataclass, field

FULL_REQUIRED = ["CLEAN-001", "CLEAN-002", "CLEAN-003", "CLEAN-004", "CLEAN-005", "CLEAN-006", "CLEAN-007",
                 "CLEAN-008", "CLEAN-009", "CLEAN-010", "CLEAN-012", "CLEAN-013", "CLEAN-CONTAMINATION"]
UPGRADE_REQUIRED = ["CLEAN-001", "CLEAN-002", "CLEAN-011", "CLEAN-CONTAMINATION"]

# Assertion-name fragments each scenario must contain. Deleting or skipping one of these checks
# turns the scenario into FAIL here, whatever the guest wrote.
REQUIRED = {
    "CLEAN-001": ["no marker from an earlier cycle", "no file or folder named *encastra*", "no Encastra uninstall entry",
                  "no developer tool on PATH", "no developer tool installation directory", "medium integrity",
                  "Windows licence usable", "first-logon setup (OneDrive) had finished",
                  "baseline inventory is populated", "baseline inventory sees the harness's own Run value"],
    "CLEAN-002": ["installer sha256 is the published digest", "host verified the", "signature state",
                  "byte-identical"],
    "CLEAN-003": ["install_check exit code", "install_check reported no FAIL line", "build commit stamped",
                  "only the NSIS bundle marker rewritten", "exactly one Encastra uninstall entry, under HKCU",
                  "leaves run_keys unchanged", "leaves services unchanged", "leaves scheduled_tasks unchanged",
                  "the installer asks for no elevation", "the uninstaller asks for no elevation"],
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
                  "not mistaken for a corrupt one", "a refused save leaves no .encastra-writing temporary"],
    "CLEAN-010": ["graceful close ends the host", "no orphan within 15 s of a graceful close", "hard kill of the host leaves no orphaned",
                  "relaunch after a hard kill reaches ready"],
    "CLEAN-011": ["saw version A installed before the upgrade", "exactly one Encastra uninstall entry, at version B",
                  "language carried over the upgrade", "preferences carried over the upgrade", "gui_journeys exit code",
                  "executable removed"],
    "CLEAN-012": ["uninstaller exit code", "executable removed", "install directory removed", "no Encastra uninstall entry left",
                  "no Encastra shortcut left", "after uninstall, services is as the baseline", "no credential-like file",
                  "uninstaller process tree finished", "holds only what Tauri keeps", "HKCU" + chr(92) + "Software gained nothing but",
                  "while installed and used, run_keys is as the baseline", "while installed and used, scheduled_tasks is as the baseline"],
    "CLEAN-013": ["install_check exit code", "reinstalled application reaches ready", "second uninstall: executable removed"],
    "CLEAN-CONTAMINATION": ["run_keys unchanged from the baseline", "services unchanged from the baseline",
                            "scheduled_tasks unchanged from the baseline", "no Encastra-named path outside",
                            "no new top-level folder", "hkcu_software gained nothing but", "at the end: HKCU",
                            "final inventory is populated"],
}

SERIAL_ASSERT = re.compile(r"^\S+ (PASS|FAIL) (\S+) (.*?) -> ")
SERIAL_RESULT = re.compile(r"^\S+ RESULT (\S+) (\S+) assertions=(\d+) failed=(\d+)")
SUMMARY_RE = re.compile(r"^SUMMARY\s+passed=(\d+) failed=(\d+) skipped=(\d+)\s+repeat=(\d+)\s+stamp=(\S+)")

# QEMU options that create (or name) a network backend. A backend that is not restricted user
# networking is a route out, whichever spelling put it there.
NET_FLAGS = ("netdev", "nic", "net")
# QEMU user networking: 10.0.2.2 is the gateway (the host), 10.0.2.3 the DNS server, and the guest
# gets an address of its own in 10.0.2.0/24 (normally .15). Anything else in the subnet speaking
# is taken to be the guest. The IPv6 side mirrors it on slirp's default fec0::/64 prefix.
GUEST_NET4 = ipaddress.ip_network("10.0.2.0/24")
SLIRP_HOSTS4 = {ipaddress.ip_address("10.0.2.2"), ipaddress.ip_address("10.0.2.3")}
GUEST_NET6 = ipaddress.ip_network("fec0::/64")
SLIRP_HOSTS6 = {ipaddress.ip_address("fec0::2"), ipaddress.ip_address("fec0::3")}
# Classic libpcap magic numbers (microsecond and nanosecond timestamps), as they appear on disk.
PCAP_BYTE_ORDER = {b"\xd4\xc3\xb2\xa1": "<", b"\xa1\xb2\xc3\xd4": ">", b"\x4d\x3c\xb2\xa1": "<", b"\xa1\xb2\x3c\x4d": ">"}
LINKTYPE_ETHERNET = 1

# The WebView2 profile a Tauri application leaves behind is a Chromium profile. These are the
# tables that hold what a person typed into the web view: a single row in any of them, still on
# disk after the uninstall, is personal data the product kept.
PROFILE_SCENARIOS = ("CLEAN-012", "CLEAN-013")
PROFILE_DBS = {"Login Data": ("logins",), "Cookies": ("cookies",), "Web Data": ("autofill", "credit_cards")}
SQLITE_MAGIC = b"SQLite format 3\x00"


@dataclass
class Scenario:
    id: str
    result: str
    problems: list[str] = field(default_factory=list)
    assertions: int = 0
    evidence: list[str] = field(default_factory=list)
    webview2_profile: dict = field(default_factory=dict)


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
    netdev: list[str] = field(default_factory=list)
    network: dict = field(default_factory=dict)
    network_problems: list[str] = field(default_factory=list)


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


def sha256_file(p: pathlib.Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def check_qemu_cmdline(text: str) -> tuple[list[str], list[str]]:
    """The network options of a recorded QEMU command line, and why they may be a route out.

    lab.sh writes /proc/PID/cmdline with its NULs turned into spaces, so an option and its value
    are separate words. The VM is offline only if every network backend is user networking with
    restrict=on (every occurrence of the key, since a repeated key is resolved differently by
    different QEMU parsers), none of them has a guestfwd (explicit forwarding rules are not affected
    by restrict=on), and there is such a -netdev at all (with no network option QEMU adds its
    default, unrestricted, user network). Only the literal value "on" is accepted, the one lab.sh
    writes: an equivalent spelling is a reason to look, not to pass.
    """
    words = text.split()
    found: list[str] = []
    problems: list[str] = []
    restricted_netdev = False
    for i, word in enumerate(words):
        flag, eq, inline = word.partition("=")
        name = flag.lstrip("-")
        if not flag.startswith("-") or name not in NET_FLAGS:
            continue
        value = inline if eq else (words[i + 1] if i + 1 < len(words) else "")
        label = f"-{name} {value}"
        found.append(label)
        parts = value.split(",")
        pairs = [p.split("=", 1) for p in parts if "=" in p]
        kind = next((v for k, v in pairs if k == "type"), parts[0] if "=" not in parts[0] else "")
        if kind == "none" or (name == "net" and kind == "nic"):
            continue  # no backend at all, or only a guest-side NIC
        if kind != "user":
            problems.append(f"the VM had a route out: {label} is not restricted user networking")
            continue
        restricts = [v for k, v in pairs if k == "restrict"]
        if not restricts or any(r != "on" for r in restricts):
            problems.append(f"the VM had a route out: {label} (restrict=on required)")
        elif name == "netdev":
            restricted_netdev = True
        if any(k == "guestfwd" for k, _ in pairs):
            problems.append(f"the VM had a route out: {label} forwards guest connections (guestfwd ignores restrict=on)")
    if not restricted_netdev:
        problems.append("the VM had a route out: no '-netdev user,...,restrict=on' in the QEMU command line")
    return found, problems


def read_pcap(data: bytes) -> tuple[int, list[bytes]]:
    """(link type, frames) of a classic libpcap file of either byte order; ValueError if it is not one.

    A record that runs past the end of the file is an error, not a short last frame: a capture that
    stops in the middle of a record did not see the whole cycle, and what it missed is unknown.
    """
    if len(data) < 24:
        raise ValueError(f"{len(data)} bytes, shorter than a pcap header")
    order = PCAP_BYTE_ORDER.get(data[:4])
    if order is None:
        raise ValueError(f"not a classic pcap file (magic {data[:4].hex()})")
    linktype = struct.unpack(order + "I", data[20:24])[0] & 0xFFFF
    frames: list[bytes] = []
    off = 24
    while off < len(data):
        if off + 16 > len(data):
            raise ValueError(f"truncated record header at byte {off}")
        incl = struct.unpack(order + "I", data[off + 8:off + 12])[0]
        start = off + 16
        if start + incl > len(data):
            raise ValueError(f"record at byte {off} claims {incl} bytes, {len(data) - start} left")
        frames.append(data[start:start + incl])
        off = start + incl
    return linktype, frames


def _dns_name(buf: bytes, off: int) -> tuple[str | None, int]:
    """One domain name at off (compression pointers followed, loops refused) and the offset after it."""
    labels: list[str] = []
    end = None
    for _ in range(128):
        if off >= len(buf):
            return None, 0
        n = buf[off]
        if n == 0:
            return ".".join(labels) or ".", end if end is not None else off + 1
        if n & 0xC0 == 0xC0:
            if off + 1 >= len(buf):
                return None, 0
            if end is None:
                end = off + 2
            off = ((n & 0x3F) << 8) | buf[off + 1]
            continue
        if n & 0xC0:
            return None, 0  # reserved label type
        label = buf[off + 1:off + 1 + n]
        if len(label) < n:
            return None, 0
        labels.append("".join(chr(c) if 32 < c < 127 else f"\\x{c:02x}" for c in label))
        off += 1 + n
    return None, 0


def dns_question_names(payload: bytes) -> list[str]:
    """The names in the question section of a DNS message (queries and answers carry the same)."""
    if len(payload) < 12:
        return []
    names = []
    off = 12
    for _ in range(min(struct.unpack(">H", payload[4:6])[0], 64)):
        name, off = _dns_name(payload, off)
        if name is None:
            break
        names.append(name)
        off += 4  # QTYPE, QCLASS
    return names


def _transport(proto: int, dst: str, body: bytes, guest: bool, acc: dict) -> None:
    if proto == 6 and len(body) >= 14:
        dport, flags = struct.unpack(">H", body[2:4])[0], body[13]
        if guest and flags & 0x02 and not flags & 0x10:
            acc["destinations"].add(f"tcp {dst}:{dport}")
    elif proto == 17 and len(body) >= 8:
        sport, dport = struct.unpack(">HH", body[:4])
        if guest:
            acc["destinations"].add(f"udp {dst}:{dport}")
        if 53 in (sport, dport):
            payload = body[8:]
            names = dns_question_names(payload)
            acc["dns"].update(names)
            # A message the parser could not read must not hide the one thing that is a rule.
            if b"encastra" in payload.lower() and not any("encastra" in n.lower() for n in names):
                acc["dns_unparsed_encastra"] += 1


def _ipv4(pkt: bytes, acc: dict) -> None:
    if len(pkt) < 20 or pkt[0] >> 4 != 4:
        return
    ihl = (pkt[0] & 0x0F) * 4
    if ihl < 20 or len(pkt) < ihl:
        return
    if struct.unpack(">H", pkt[6:8])[0] & 0x1FFF:
        return  # a later fragment carries no transport header
    total = struct.unpack(">H", pkt[2:4])[0]
    body = pkt[ihl:total] if total >= ihl else pkt[ihl:]  # the total length drops Ethernet padding
    src = ipaddress.IPv4Address(pkt[12:16])
    guest = src in GUEST_NET4 and src not in SLIRP_HOSTS4
    _transport(pkt[9], str(ipaddress.IPv4Address(pkt[16:20])), body, guest, acc)


def _ipv6(pkt: bytes, acc: dict) -> None:
    if len(pkt) < 40 or pkt[0] >> 4 != 6:
        return
    nh = pkt[6]
    body = pkt[40:40 + struct.unpack(">H", pkt[4:6])[0]]
    for _ in range(8):  # hop-by-hop, routing, destination options, fragment
        if nh in (0, 43, 60) and len(body) >= 8:
            nh, body = body[0], body[(body[1] + 1) * 8:]
        elif nh == 44 and len(body) >= 8:
            if struct.unpack(">H", body[2:4])[0] & 0xFFF8:
                return
            nh, body = body[0], body[8:]
        else:
            break
    src = ipaddress.IPv6Address(pkt[8:24])
    guest = src in GUEST_NET6 and src not in SLIRP_HOSTS6
    _transport(nh, f"[{ipaddress.IPv6Address(pkt[24:40])}]", body, guest, acc)


def check_network_capture(path: pathlib.Path) -> tuple[dict, list[str]]:
    """What the guest's NIC carried during the cycle, and the one thing in it that fails a cycle.

    The summary is evidence: restrict=on drops every attempt to leave, and the capture still shows
    it, but a frame names no process, and Windows reaches for Microsoft endpoints on its own. So
    destinations are listed, not judged. A DNS question for a name containing "encastra" is
    different: nothing in a clean Windows asks for it, so something from the product tried to
    reach home.
    """
    summary: dict = {"capture": path.name}
    if not path.exists():
        summary["state"] = "missing"
        return summary, ["no network capture (net.pcap missing): what the VM tried to reach is unknown"]
    data = path.read_bytes()
    summary["sha256"] = hashlib.sha256(data).hexdigest()
    try:
        linktype, frames = read_pcap(data)
    except ValueError as e:
        summary["state"] = f"unreadable: {e}"
        return summary, [f"network capture unreadable: {e}"]
    if linktype != LINKTYPE_ETHERNET:
        summary["state"] = f"link type {linktype}"
        return summary, [f"network capture unreadable: link type {linktype}, not Ethernet ({LINKTYPE_ETHERNET})"]
    acc: dict = {"destinations": set(), "dns": set(), "dns_unparsed_encastra": 0}
    for f in frames:
        if len(f) < 14:
            continue
        etype, off = struct.unpack(">H", f[12:14])[0], 14
        while etype in (0x8100, 0x88A8) and len(f) >= off + 4:  # VLAN tags
            etype, off = struct.unpack(">H", f[off + 2:off + 4])[0], off + 4
        if etype == 0x0800:
            _ipv4(f[off:], acc)
        elif etype == 0x86DD:
            _ipv6(f[off:], acc)
    summary.update(state="read", packets=len(frames), guest_destinations=sorted(acc["destinations"]),
                   dns_queries=sorted(acc["dns"]))
    problems = []
    bad = sorted(n for n in acc["dns"] if "encastra" in n.lower())
    for n in bad:
        problems.append(f"DNS query for {n}: something in the VM tried to resolve an Encastra name")
    if acc["dns_unparsed_encastra"]:
        problems.append(f"{acc['dns_unparsed_encastra']} DNS message(s) mention encastra but could not be parsed")
    return summary, problems


def count_rows_readonly(db: pathlib.Path, tables: tuple[str, ...]) -> tuple[dict[str, int], list[str]]:
    """Row counts of tables in an SQLite file, read from a temporary copy opened read-only.

    The evidence file is never opened by SQLite: opening a database can create journal or WAL
    files beside it, or roll back a hot journal into it, and evidence must stay the bytes the guest
    wrote. The copy is opened with mode=ro&immutable=1 so even the copy is not written. A table that
    does not exist holds no rows; it is named so the reader knows it was absent, not empty.
    """
    with tempfile.TemporaryDirectory() as tmp:
        copy = pathlib.Path(tmp) / "copy.sqlite"
        shutil.copyfile(db, copy)
        con = sqlite3.connect(copy.as_uri() + "?mode=ro&immutable=1", uri=True)
        try:
            present = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
            rows: dict[str, int] = {}
            missing: list[str] = []
            for t in tables:
                if t in present:
                    rows[t] = con.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0]
                else:
                    rows[t] = 0
                    missing.append(t)
        finally:
            con.close()
    return rows, missing


def check_webview2_profile(folder: pathlib.Path) -> tuple[dict, list[str]]:
    """What the WebView2 profile kept after the uninstall, counted here instead of trusted.

    An absent file is fine - the profile never created it - and is recorded as absent. A file that
    is present but cannot be read as SQLite fails the scenario: what it keeps is unknown, and an
    empty or cut-off copy is exactly what a failed copy of a locked database looks like.
    """
    out: dict = {}
    problems: list[str] = []
    for fname, tables in PROFILE_DBS.items():
        p = folder / fname
        if not p.exists():
            out[fname] = {"state": "absent"}
            continue
        try:
            with p.open("rb") as fh:
                head = fh.read(100)
            if head[:16] != SQLITE_MAGIC or len(head) < 100:
                raise sqlite3.DatabaseError("not an SQLite database file")
            # SQLite reads a short file as zeros past its end, so a copy cut off mid-way can open
            # as a smaller database that looks clean. A whole database is whole pages, and as many
            # as its header says when that count is valid (change counter = version-valid-for).
            size = p.stat().st_size
            page = struct.unpack(">H", head[16:18])[0]
            page = 65536 if page == 1 else page
            if not page or size % page:
                raise sqlite3.DatabaseError(f"cut-off copy: {size} bytes is not a whole number of {page}-byte pages")
            if head[24:28] == head[92:96] and struct.unpack(">I", head[28:32])[0] * page > size:
                raise sqlite3.DatabaseError(f"cut-off copy: the header counts {struct.unpack('>I', head[28:32])[0]} pages, the file holds {size // page}")
            rows, missing = count_rows_readonly(p, tables)
        except (sqlite3.Error, OSError) as e:
            out[fname] = {"state": "unreadable", "error": f"{type(e).__name__}: {e}"}
            problems.append(f"webview2-profile/{fname} could not be read as SQLite ({type(e).__name__}: {e}): what it keeps is unknown")
            continue
        out[fname] = {"state": "read", "sha256": sha256_file(p), "rows": rows, "missing_tables": missing}
        for t, n in rows.items():
            if n:
                problems.append(f"credential-like data kept after uninstall: {t}={n} (webview2-profile/{fname})")
    return out, problems


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
    # The WebView2 profile the uninstall kept, counted from the databases themselves.
    if sid in PROFILE_SCENARIOS:
        s.webview2_profile, profile_problems = check_webview2_profile(results_dir / "scenarios" / sid / "webview2-profile")
        s.problems.extend(profile_problems)
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
    # No route out: the command line QEMU really ran with, not the one lab.sh meant to run.
    cmdline = path / "qemu.cmdline"
    cmd_text = cmdline.read_text(encoding="utf-8", errors="replace").strip() if cmdline.exists() else ""
    if not cmd_text:
        netdev, network_problems = [], ["no QEMU command line recorded (qemu.cmdline missing or empty): the VM cannot be shown to have had no route out"]
    else:
        netdev, network_problems = check_qemu_cmdline(cmd_text)
    # What the NIC carried.
    network, capture_problems = check_network_capture(path / "net.pcap")
    network_problems += capture_problems
    problems.extend(network_problems)
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
    return Cycle(path, plan["cycle"], plan, expected, scenarios, problems, base_sha, env, netdev, network, network_problems)


def is_clean_acceptance(c: Cycle) -> list[str]:
    p = []
    if c.plan.get("inject"):
        p.append(f"cycle {c.name} carried injected faults {c.plan['inject']}")
    if c.plan.get("tamper_installer") or c.plan.get("omit_installer"):
        p.append(f"cycle {c.name} carried a tampered or missing installer")
    if c.plan.get("harness_dirty"):
        p.append(f"cycle {c.name} ran an uncommitted harness")
    if c.plan.get("dev_build") or c.expected.get("installer", {}).get("dev_build"):
        p.append(f"cycle {c.name} tested a local dev build, not the published artefact")
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
            "netdev": c.netdev, "network": c.network,
            "scenarios": {k: {"result": v.result, "assertions": v.assertions, "problems": v.problems,
                              **({"webview2_profile": v.webview2_profile} if v.webview2_profile else {})}
                          for k, v in c.scenarios.items()},
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
        # A fault detected on a machine with a route out, or one that asked for an Encastra name,
        # is not the offline evidence the negative cycle exists to provide.
        if c.network_problems:
            obs["_network"] = c.network_problems[:3]; good = False
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
    lines += ["", "## Network (host capture)", "",
              "Evidence, not a verdict: a frame names no process and Windows calls Microsoft by itself. "
              "Only a DNS name containing \"encastra\" fails a cycle.", ""]
    for c in cycles:
        n = c.network
        head = f"- {c.name}: {', '.join(f'`{x}`' for x in c.netdev) or 'no network option recorded'}; capture {n.get('state', 'not read')}"
        if n.get("state") == "read":
            head += f", {n['packets']} packet(s), {len(n['guest_destinations'])} guest destination(s), {len(n['dns_queries'])} DNS name(s)"
        lines.append(head)
        for label, items in (("DNS", n.get("dns_queries") or []), ("destinations", n.get("guest_destinations") or [])):
            if items:
                lines.append(f"  - {label}: {', '.join(items[:20])}" + (f" ... (+{len(items) - 20}, see verdict.json)" if len(items) > 20 else ""))
    profile_lines = []
    for c in cycles:
        for sid, sc in sorted(c.scenarios.items()):
            if sc.webview2_profile:
                parts = []
                for fname, info in sc.webview2_profile.items():
                    if info["state"] == "read":
                        rows = ", ".join(f"{t}={k}" for t, k in info["rows"].items())
                        missing = f" (no table {', '.join(info['missing_tables'])})" if info["missing_tables"] else ""
                        parts.append(f"{fname}: {rows}{missing}")
                    else:
                        parts.append(f"{fname}: {info['state']}")
                profile_lines.append(f"- {c.name} {sid}: " + "; ".join(parts))
    if profile_lines:
        lines += ["", "## WebView2 profile kept after uninstall", ""] + profile_lines
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
