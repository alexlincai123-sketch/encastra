"""Reproducible runtime benchmark: how time and memory grow with the size of a graph.

Generates graphs of known shape, runs each through the release CLI (`encastra run`), and
records wall-clock time, peak working set and the exit code. Every graph is generated from a
seed so two runs on two machines measure the same thing, and the result is written as a
Markdown table with the machine and the commit beside it — a number without those is not a
measurement, it is a memory of one.

    cargo build --release -p encastra-cli
    python scripts/bench_graph.py                 # the standard set, writes docs/audits/bench-<commit>.md
    python scripts/bench_graph.py --sizes 1000    # a quick one
    python scripts/bench_graph.py --json          # machine-readable to stdout

Shapes (each node is a real component doing real work on a 37 KB JSON document):

- `chain N`      n0 reads a file, then N-1 nodes alternate JSON parse / JSON write. Memory used
                 to grow with N because every produced value was held until the run ended; it
                 is now released when the last consumer has finished (see runner.rs), so this
                 shape is what proves that stays true.
- `limit`        a chain one node over MAX_NODES (10 000): validation refuses it before anything
                 runs, and the refusal has to be fast and small.
- `fanout N`     one parse feeding N writers: the value is cloned once per consuming edge
                 (ENC-NEW-05b, accepted risk), so this is the shape that shows the cost of that.
- `wide N`       N independent two-node chains: breadth, not depth; nothing shared. Capped at
                 300 because each reader is an `--input` flag on one command line.

Exit codes: 0 · 2 the CLI is not built.
"""

from __future__ import annotations

import argparse
import ctypes
import datetime
import json
import pathlib
import platform
import subprocess
import sys
import tempfile
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
CLI = ROOT / "target" / "release" / ("encastra.exe" if platform.system() == "Windows" else "encastra")
MAX_NODES = 10_000  # crates/encastra-core: MAX_NODES. Kept in step by the `limit` case refusing.
PARSE = "encastra.data.json@1.0.0"
WRITE = "encastra.data.json.write@1.0.0"
READ = "encastra.file.read@1.0.0"


def document() -> bytes:
    """A deterministic ~37 KB JSON document: the same bytes every run, everywhere."""
    rows = [{"id": i, "name": f"item-{i:05d}", "tags": ["a", "b", "c"][: (i % 3) + 1], "value": i * 1.5} for i in range(600)]
    return json.dumps({"rows": rows}, separators=(",", ":")).encode()


def node(component: str, i: int) -> dict:
    return {"component": component, "config": {}, "position": {"x": (i % 50) * 260, "y": (i // 50) * 120}}


def chain(n: int) -> dict:
    nodes = {"n0": node(READ, 0)}
    edges = []
    for i in range(1, n):
        parse = i % 2 == 1
        nodes[f"n{i}"] = node(PARSE if parse else WRITE, i)
        from_port = "text" if i == 1 else ("json" if (i - 1) % 2 == 1 else "text")
        edges.append({"from": {"node": f"n{i - 1}", "port": from_port}, "to": {"node": f"n{i}", "port": "text" if parse else "json"}})
    return {"nodes": nodes, "edges": edges}


def fanout(n: int) -> dict:
    nodes = {"n0": node(READ, 0), "n1": node(PARSE, 1)}
    edges = [{"from": {"node": "n0", "port": "text"}, "to": {"node": "n1", "port": "text"}}]
    for i in range(2, n + 2):
        nodes[f"n{i}"] = node(WRITE, i)
        edges.append({"from": {"node": "n1", "port": "json"}, "to": {"node": f"n{i}", "port": "json"}})
    return {"nodes": nodes, "edges": edges}


def wide(n: int) -> dict:
    nodes: dict = {}
    edges = []
    for i in range(n):
        nodes[f"r{i}"] = node(READ, 2 * i)
        nodes[f"p{i}"] = node(PARSE, 2 * i + 1)
        edges.append({"from": {"node": f"r{i}", "port": "text"}, "to": {"node": f"p{i}", "port": "text"}})
    return {"nodes": nodes, "edges": edges}


def inputs_for(graph: dict, data: pathlib.Path) -> list[str]:
    flags = []
    for name, spec in graph["nodes"].items():
        if spec["component"] == READ:
            flags += ["--input", f"{name}.file={data}"]
    return flags


def peak_working_set(process: subprocess.Popen) -> int | None:
    """Peak resident memory of a finished child, in bytes, where the platform can say."""
    if platform.system() == "Windows":
        class Counters(ctypes.Structure):
            _fields_ = [
                ("cb", ctypes.c_ulong), ("PageFaultCount", ctypes.c_ulong),
                ("PeakWorkingSetSize", ctypes.c_size_t), ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t), ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t), ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t), ("PeakPagefileUsage", ctypes.c_size_t),
            ]
        counters = Counters()
        counters.cb = ctypes.sizeof(Counters)
        handle = int(process._handle)  # type: ignore[attr-defined]  # still open until the Popen is collected
        if ctypes.windll.psapi.GetProcessMemoryInfo(handle, ctypes.byref(counters), counters.cb):
            return int(counters.PeakWorkingSetSize)
        return None
    try:
        import resource
        usage = resource.getrusage(resource.RUSAGE_CHILDREN)
        # Linux reports kilobytes, macOS bytes.
        return usage.ru_maxrss * (1 if platform.system() == "Darwin" else 1024)
    except Exception:
        return None


def run_case(name: str, graph: dict, workdir: pathlib.Path, data: pathlib.Path) -> dict:
    path = workdir / f"{name}.json"
    path.write_text(json.dumps(graph), "utf-8")
    command = [str(CLI), "run", str(path), *inputs_for(graph, data)]
    started = time.perf_counter()
    process = subprocess.Popen(command, cwd=workdir, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, err = process.communicate()
    elapsed = time.perf_counter() - started
    peak = peak_working_set(process)
    tail = (err or out).decode("utf-8", "replace").strip().splitlines()
    return {
        "case": name,
        "nodes": len(graph["nodes"]),
        "edges": len(graph["edges"]),
        "exit": process.returncode,
        "seconds": round(elapsed, 2),
        "peak_mib": round(peak / (1024 * 1024), 1) if peak is not None else None,
        "last_line": tail[-1] if tail else "",
    }


def standard_cases(sizes: list[int]) -> list[tuple[str, dict]]:
    cases = [(f"chain-{n}", chain(n)) for n in sizes]
    cases.append((f"limit-{MAX_NODES + 1}", chain(MAX_NODES + 1)))
    cases.append(("fanout-2000", fanout(2000)))
    # 300, not more: every reader is one --input flag, and a Windows command line is 32 K.
    cases.append(("wide-300", wide(300)))
    return cases


def git_head() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return "unknown"


def render(results: list[dict], head: str) -> str:
    machine = f"{platform.system()} {platform.release()} {platform.machine()}, Python {platform.python_version()}"
    lines = [
        f"# Runtime benchmark — {datetime.date.today().isoformat()}, commit {head}",
        "",
        f"`python scripts/bench_graph.py` against `target/release/encastra` on {machine}.",
        "Each node is a real first-party component working on a deterministic 37 KB JSON document.",
        "Time is wall-clock for the whole CLI process; memory is the process's peak working set.",
        "One run each, no warm-up: this is a regression fence, not a microbenchmark.",
        "",
        "| Case | Nodes | Edges | Exit | Seconds | Peak MiB | Last line |",
        "|---|---:|---:|---:|---:|---:|---|",
    ]
    for r in results:
        peak = "n/a" if r["peak_mib"] is None else f"{r['peak_mib']}"
        lines.append(f"| {r['case']} | {r['nodes']} | {r['edges']} | {r['exit']} | {r['seconds']} | {peak} | {r['last_line'][:90]} |")
    lines += [
        "",
        "Reading it: a chain's peak memory must stay flat as N grows (values are released when",
        "their last consumer finishes); its time must grow linearly, not quadratically. The",
        "`limit` case must exit non-zero fast without running anything. `fanout` shows the",
        "per-edge clone cost of ENC-NEW-05b; `wide` shows breadth with nothing shared.",
        "",
    ]
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sizes", type=int, nargs="*", default=[1000, 5000, 10000])
    parser.add_argument("--json", action="store_true", help="print results as JSON instead of writing the report")
    parser.add_argument("--out", type=pathlib.Path, help="where to write the Markdown report")
    args = parser.parse_args(argv)
    if not CLI.exists():
        print(f"{CLI} is not built; run `cargo build --release -p encastra-cli`.", file=sys.stderr)
        return 2
    head = git_head()
    results = []
    with tempfile.TemporaryDirectory() as tmp:
        workdir = pathlib.Path(tmp)
        data = workdir / "data.json"
        data.write_bytes(document())
        for name, graph in standard_cases(args.sizes):
            result = run_case(name, graph, workdir, data)
            results.append(result)
            print(f"{result['case']:>12}  exit {result['exit']}  {result['seconds']:>7}s  {result['peak_mib']} MiB  {result['last_line'][:70]}", file=sys.stderr)
    if args.json:
        print(json.dumps({"commit": head, "results": results}, indent=2))
        return 0
    out = args.out or (ROOT / "docs" / "audits" / f"bench-{head}.md")
    out.write_text(render(results, head), encoding="utf-8", newline="\n")
    print(f"wrote {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
