# Security limits

Every ceiling this build enforces, what it bounds, and why it is where it is.

The reason for one page: a limit whose number lives only at its call site is a limit nobody can
audit and nobody remembers to test. Several of these were added on 2026-09-15 after an offensive
audit found that the ones which existed bounded the wrong thing — a per-entry ceiling on an
archive that chooses how many entries get read is not a ceiling.

Each has a regression test. Where a limit is large enough that reaching it in a test would be
absurd, the ceiling is a parameter of an internal function so the branch can be exercised against
a small value — the alternative is a branch that has never run, which is what
`the_bounded_reader_refuses_before_it_allocates` was before this.

## The project container

`crates/encastra-project/src/lib.rs`

| Limit | Value | Bounds | Why |
|---|---|---|---|
| `MAX_FILE_BYTES` | 256 MB | A `.encastra` file on disk, checked with `metadata` before it is read | Reading an archive needs it in memory to find the central directory, so this is the only limit that can apply before the allocation. |
| `MAX_ENTRY_BYTES` | 32 MB | One archive entry, unpacked | A ZIP entry's compressed size says nothing about its uncompressed size. |
| `MAX_TOTAL_BYTES` | 64 MB | Every entry read during one open, summed | The per-entry ceiling bounds one read and says nothing about a thousand of them. `versions/index.json` is itself an entry, and it decides how many further entries get read. Per-entry × unbounded-count is unbounded. |
| `MAX_SNAPSHOTS` | 1 000 | Versions a history may declare | A second bound on the same attack at a different layer: it refuses the intent before any of the byte budget is spent, and gives a person a message about their project rather than about bytes. |
| Duplicate entry names | refused | An archive naming one entry twice | The reader indexes entries into a map, so a second `graph.json` overwrites the first; an archive viewer tends to show the first. A file that shows one graph and runs another. Detected from the end-of-central-directory count, because the reader's own name list is already deduplicated. |

## The graph

`crates/encastra-core/src/graph.rs`

| Limit | Value | Why |
|---|---|---|
| `MAX_NODES` | 10 000 | A graph is drawn by a person on a canvas. The ceiling is not for them — it is because a graph arrives inside a file somebody was sent, and every node is work the validator, the editor and the runner each do. |
| `MAX_EDGES` | 40 000 | Higher than the node ceiling because a real graph fans out; low enough that the repeated passes over edges in validation stay cheap. |

Enforced in `Graph::parse` **and** exposed as `within_limits()`, because the project container
deserialises a graph straight out of an archive entry without going through `parse`. A limit that
guards one of two doors guards neither.

## The broker

`crates/encastra-core/src/broker.rs`

| Limit | Value | Bounds | Why |
|---|---|---|---|
| `MAX_READ_BYTES` | 512 MB | One file a component reads | Every read lands in a `Vec` — the runtime passes bytes between components, it does not stream them. In a watched folder the size of that allocation is chosen by whoever put the file there, not by whoever granted the folder. |
| `MAX_DIR_ENTRIES` | 50 000 | One folder listing | A watched folder is somewhere other people put files, and a trigger re-reads it every 600 ms. Refused rather than truncated: a watcher that silently skipped files would be worse than one that says the folder is too full to watch. |

Also here, and not a number: `sanitise_filename` refuses Windows device names (`NUL`, `CON`,
`COM1`…), which name a device in any directory and so are not contained by a granted folder at
all, and settles trailing dots and spaces, which Windows drops when it opens a file.

## The runner

`crates/encastra-core/src/runner.rs`

| Limit | Value | Why |
|---|---|---|
| `MAX_RUN_DURATION` | 1 hour | Validation refuses cycles, so a run's step count is already bounded by the node ceiling. Duration is not: a chain of `Delay` nodes is a legal graph and each may wait an hour. Checked between nodes; past it the run is cancelled exactly as if Stop had been pressed, so there is one mechanism and one appearance in the journal. Per run — a session with a trigger starts a new run per event and is unaffected. |

**There is still no per-node timeout.** Cancellation is cooperative. A component that never
returns is not stopped, and that needs a host which can interrupt a running component — epoch
interruption in the WebAssembly host — rather than a flag nobody is checking.

## Media

`crates/encastra-core/src/media.rs`

| Limit | Value | Why |
|---|---|---|
| `MAX_INPUT_BYTES` | 256 MB | Checked before any decoding is attempted. |
| `MAX_PIXELS` | 100 MP | A 30 KB PNG can declare 60 000 × 60 000 and ask the decoder for 14 GB. The header is checked before a pixel is read. |
| decoder `max_alloc` | 512 MB | Belt and braces: the dimension check catches a declared size, this catches anything that gets past it. |

## Network

`crates/encastra-builtins/src/net.rs`

| Limit | Value | Why |
|---|---|---|
| `MAX_RESPONSE_BYTES` | 16 MB | Counted as bytes actually read, never from a `Content-Length` header. |
| `TIMEOUT` | 30 s | Global per request. |
| redirects | **0** | Not "checked on each hop" — not followed at all. A permitted host handing back a `Location` pointing inside the machine is the SSRF vector, and the strongest answer to it is that there is no second hop to check. |

Scheme is restricted to `http`/`https`; credentials in a URL are refused outright; the port is
part of the permission identity, so a grant for a host's web API does not also admit `:22`.

## The session queue

`crates/encastra-core/src/session.rs`

| Limit | Value | Why |
|---|---|---|
| `MAX_PENDING` | 512 | A trigger can produce events faster than runs consume them. Past this the oldest is dropped and the count is reported — through `Tick::dropped` to the status bar — rather than the queue growing until the process dies. Dropping silently would be the worse failure. |

## What is deliberately unbounded

* **The number of grants in a run.** Each is checked individually and a list of them costs
  nothing; bounding it would be a number with no threat behind it.
* **Aggregate memory across a run, by width.** Each file and each image is capped, and since
  `feat/readiness` a produced value is dropped once every edge out of its port has been read —
  the executor works that out from the graph, which is what this entry used to say it should do
  and did not. What stays unbounded is the *width* of the graph: twenty producers feeding one
  consumer are twenty values held at once, each under its own cap, and no number would be right
  for a shape a person chose.
