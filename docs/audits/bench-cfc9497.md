# Runtime benchmark — 2026-09-15, commit cfc9497

`python scripts/bench_graph.py` against `target/release/encastra` on Windows 11 AMD64, Python 3.14.4.
Each node is a real first-party component working on a deterministic 45 KB JSON document.
Time is wall-clock for the whole CLI process; memory is the process's peak working set.
One run each, no warm-up: this is a regression fence, not a microbenchmark.

| Case | Nodes | Edges | Exit | Seconds | Peak MiB | Last line |
|---|---:|---:|---:|---:|---:|---|
| chain-1000 | 1000 | 999 | 0 | 1.69 | 12.4 | Finished. in 1634ms |
| chain-5000 | 5000 | 4999 | 0 | 5.85 | 22.5 | Finished. in 5753ms |
| chain-10000 | 10000 | 9999 | 0 | 10.69 | 36.1 | Finished. in 10533ms |
| limit-10001 | 10001 | 10000 | 1 | 0.05 | 13.2 | error: That is not a valid graph: this graph has 10001 nodes, and this build works on at m |
| fanout-2000 | 2002 | 2001 | 0 | 2.6 | 193.3 | Finished. in 2503ms |
| wide-300 | 600 | 300 | 0 | 0.42 | 175.2 | Finished. in 262ms |

Reading it: a chain's peak memory must stay flat as N grows (values are released when
their last consumer finishes); its time must grow linearly, not quadratically. The
`limit` case must exit non-zero fast without running anything. `fanout` shows the
per-edge clone cost of ENC-NEW-05b; `wide` shows breadth with nothing shared.
