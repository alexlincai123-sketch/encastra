#!/usr/bin/env python3
"""Run one Clean VM cycle end to end from the Windows development machine.

    python scripts/cleanvm/run_cycle.py --cycle A --evidence OUT -- <make_harness.py arguments>

1. make_harness.py assembles the disc (and refuses if the artefact's identity does not hold);
2. the disc is copied into the lab (a WSL distro with /dev/kvm, default Ubuntu-24.04:/srv/encastra-vm);
3. lab.sh boots a fresh overlay of CLEAN_BASELINE with it and waits for the guest to power off;
4. the cycle directory comes back to OUT/<cycle>/ without the disk images (overlay, results image,
   harness ISO, firmware variables, TPM state), which stay in the lab.

A negative cycle is a name from negative-spec.json: `--negative N1-tampered` takes its harness
arguments from there.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
KEEP_OUT = {"overlay.qcow2", "results.img", "harness.iso", "vars.fd", "tpm", "monitor.sock"}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cycle", required=True)
    ap.add_argument("--evidence", required=True)
    ap.add_argument("--negative")
    ap.add_argument("--distro", default="Ubuntu-24.04")
    ap.add_argument("--lab", default="/srv/encastra-vm")
    ap.add_argument("--timeout", type=int, default=10800)
    ap.add_argument("harness_args", nargs=argparse.REMAINDER)
    args = ap.parse_args()
    extra = [a for a in args.harness_args if a != "--"]
    if args.negative:
        spec = json.loads((HERE / "negative-spec.json").read_text())[args.negative]
        extra = spec["harness"] + extra
    unc = pathlib.Path(rf"\\wsl.localhost\{args.distro}") / args.lab.strip("/").replace("/", "\\")
    with tempfile.TemporaryDirectory() as tmp:
        disc = pathlib.Path(tmp) / "disc"
        r = subprocess.run([sys.executable, str(HERE / "make_harness.py"), "--out", str(disc), "--cycle", args.cycle, *extra])
        if r.returncode != 0:
            print("make_harness refused; no cycle run", file=sys.stderr)
            return 1
        dst = unc / "harness" / args.cycle
        if dst.exists():
            print(f"{dst} exists; cycles are never reused", file=sys.stderr)
            return 1
        shutil.copytree(disc, dst)
    cmd = f"cd {args.lab} && TIMEOUT={args.timeout} lab/lab.sh cycle {args.cycle} harness/{args.cycle}"
    r = subprocess.run(["wsl", "-d", args.distro, "--", "bash", "-c", cmd])
    out = pathlib.Path(args.evidence) / args.cycle
    src = unc / "cycles" / args.cycle
    shutil.copytree(src, out, ignore=lambda d, names: [n for n in names if n in KEEP_OUT])
    print(f"cycle {args.cycle}: lab exit {r.returncode}; evidence in {out}")
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
