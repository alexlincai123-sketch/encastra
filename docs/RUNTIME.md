# RUNTIME

> How a graph actually executes, as the code in `crates/encastra-core` does it today. Where
> something is designed but not built, this document says so rather than describing the
> design in the present tense. [ARCHITECTURE](ARCHITECTURE.md) §5 is the intent; this is the
> implementation, and where the two disagree the code is right and the discrepancy is noted
> here.

There is one runtime. The editor does not have a second, simplified copy for previews, because
a workflow that behaves differently in preview than in production is worse than having no
preview at all ([ADR-0003](adr/0003-one-runtime-shared-type-table.md)). The desktop app and the
`encastra` CLI call the same functions with different arguments.

---

## 1. The shape of a run

```
Graph + registry + grants
        │
        ▼
   validate ───────────► issues (errors and warnings), an order, and a conversion plan
        │
        │ any error? nothing runs. There is no partial execution to unwind.
        ▼
   execute, node by node, in that order
        │
        ▼
   RunJournal  +  the values each output port produced
```

Three functions, all in `runner.rs`, all the same path underneath:

| Function | Used by |
|---|---|
| `run` | the simplest case: a graph with nothing supplied from outside |
| `run_seeded` | the CLI and the desktop's one-shot `Run` — the user picked a file |
| `execute_request` | everything that also wants live progress, including the session loop |

`execute_request` takes a `RunRequest` rather than eight positional arguments. That is not
style: a call with eight parameters of similar shape is one transposition away from a bug the
type system cannot catch.

---

## 2. Validation

`validate.rs` is written around two rules.

**Report everything, not the first thing.** A validator that stops at the first error turns
fixing a graph into whack-a-mole. Every issue is collected, each carrying a `Location` the
editor can highlight — `Graph`, `Node`, `Port`, or `Edge` — a message written for the person
reading it, and a `hint` that is present when there is an honest next step and absent rather
than filled with a guess.

**A graph that passes validation is a graph that can be scheduled.** Success carries the
execution order and the per-edge conversion plan, so there is no second, subtly different
traversal at run time that could disagree about what is runnable. When there is an error,
`order` and `conversions` come back empty — a partial order is an invitation for somebody to
use it.

### What is checked

Components are resolved first. A node whose component is not installed is reported once and
then excluded from every later check, so a missing component produces one error rather than a
cascade about ports that could never have been known.

Then, in order:

- **Edges.** Both endpoints must exist; the named output and input ports must exist on their
  manifests (the hint lists the ports that do); and the types must be compatible according to
  the shared rule table. An incompatible pair is an error, with the bridging types offered as
  a hint when there are any. A compatible pair that needs conversion records an `EdgePlan`; if
  the conversion is *explicit* — it can fail or lose information — a warning is also raised
  carrying the table's note.
- **Fan-in.** Two edges arriving at one input is an error. An input takes one value, and two
  producers would make the result depend on which finished last.
- **Required inputs.** An input marked `required` must be filled by an edge *or* supplied by
  the application. Without that second case, every graph's first node would look unconnected —
  the file a person picked and the event a trigger produced are both values nothing on the
  canvas produces. Disabled nodes are skipped by this check.
- **Configuration.** Each set key must exist on the manifest (an unknown key is a *warning*,
  since it is usually left over from an older version of the component), must match its
  declared type (`bool`, `i64`, `f64`, `string`, `json`), and must satisfy `min`, `max` and
  `choices`. A field declared `required` with no default and no value set is an error. A
  config field whose type is a handle type is rejected outright — handles come from a
  connection, never from a form.
- **Disabled dependencies.** A switched-off node feeding a live one is an error before the run
  rather than an empty input halfway through it.
- **Triggers.** If a graph contains triggers and every one of them is switched off, that is an
  error: pressing Run would do nothing at all, which reads as a broken application rather than
  as a switched-off node.
- **Cycles.** Kahn's algorithm produces the topological order. On failure the reported error
  names the loop itself — walked forward from a node known to be inside it — not the tail that
  led into it, which is not part of the problem.

`Validation::is_runnable()` is "no issue has severity `Error`". Warnings never block.

---

## 3. Values on the wire

`value.rs` defines what travels along an edge: `Bool`, `Int`, `Float`, `Text`, `Json`,
`Handle`, `List`, and `Absent`.

`Absent` is the empty case of `option<T>` and is deliberately distinct from every other value.
"There is no value" and "there is an empty value" are different facts, and collapsing them is
how a failure becomes invisible.

A `Handle` is an opaque `u64` plus a kind (`file`, `dir`, `bytes`, `image`, `video`, `audio`).
It is never a path and never a byte buffer ([ADR-0004](adr/0004-handle-based-media.md)). A
component holds the number; the host holds everything else. See [SECURITY](SECURITY.md) §2 for
what that buys.

`Value::type_name()` returns `None` for `Absent` — absence has no type of its own — and for an
empty list, which has no knowable element type and must not claim one.

---

## 4. Execution, node by node

The executor walks `validation.order` once. For each node, in this order of precedence:

1. **Disabled** → status `Disabled`, nothing runs.
2. **Cancelled** → if the stop flag is set, status `Cancelled`.
3. **Blocked upstream** → if any immediate producer finished `Failed`, `Skipped` or
   `Cancelled`, this node is `Skipped` and the journal records *which* node was responsible in
   `skipped_because`. Because the walk is topological, the effect is transitive: the whole
   downstream subtree is skipped, and each entry names its own nearest blocker rather than the
   original failure. Saying which node is responsible is the difference between a debuggable
   run and a mystery.
4. **Component missing** → `Failed` with code `component-missing`.
5. **Inputs gathered** (below). A failure here — a conversion that could not be performed —
   fails the node before its code runs.
6. **Trigger** → a node whose manifest sets `trigger: true` does not execute. Its outputs were
   supplied by the session; the record is marked `Ok` with a zero duration and those outputs
   summarised, so the debugger shows where the event entered.
7. **No implementation** → a manifest with no code in this build fails with `no-implementation`
   and the hint "Sandboxed components are not executable in this build yet." This is the path a
   `kind: "wasm"` component takes today: manifests parse, validate and appear in the graph, and
   then the run refuses them. See §9.
8. Otherwise the component runs.

### Gathering inputs

`gather_inputs` builds the map a component sees:

- Application-supplied values go in first. An edge into the same port cannot also exist —
  validation already refuses two sources for one input.
- For each incoming edge, the producer's value is looked up. If the producer succeeded but
  left the port empty, the input arrives as `Absent`; optional outputs are legitimately absent.
- Any conversion the validator planned for that edge is applied here, by `apply_ops`.
- Only *then* does the receiving node become able to open a handle, and only that handle. A
  list of handles makes each element reachable.
- Finally, every declared input not otherwise filled is set to `Absent`, so a component reads
  one shape of input map regardless of how the graph was wired.

### Checking what came back

`check_outputs` holds a component to its manifest. An output port it does not declare is a
`contract-broken` failure; so is a value whose type is not *directly* compatible with the
declared type — an implicit or explicit coercion is not good enough here, because the manifest
is what the editor type-checked the graph against and what the user consented to. `Absent` is
allowed on any port, and a value with no knowable type (an empty list) is not checked.

Passing an unexpected value downstream would turn a contract violation into a confusing
failure somewhere else, so the run says so at the source.

---

## 5. Conversions on an edge

Validation decides *which* operations an edge performs; `convert.rs` performs them. The split
is deliberate: the editor can show what will happen before anything runs, and the runtime
cannot decide something different at the last moment.

Every operation name comes from `packages/protocol/data/type-graph.json`. A test
(`convert::tests::every_declared_operation_is_accounted_for`) fails the build if the table
gains an operation this module has never heard of, so a rule change cannot quietly produce an
edge nobody can execute.

**Absence survives every conversion except `unwrap-option`.** Turning "there is no value" into
a zero or an empty string is how a missing input becomes an invisible wrong answer.

| Operation | Behaviour |
|---|---|
| `unwrap-option` | fails when the value is absent, with a hint about supplying a fallback |
| `to-text` | int, float, bool or text to text |
| `int-to-float` | refuses beyond 2^53, where the conversion stops being exact, rather than rounding silently |
| `bool-to-int`, `int-to-bool` | 0/1; zero is false |
| `round` | refuses non-finite values and anything outside `i64` |
| `parse-int`, `parse-float` | fail on non-numeric text, quoting the first 40 characters |
| `parse-bool` | an allowlist — `true/yes/1/on`, `false/no/0/off`. Anything else fails. Treating every non-empty string as true is how a workflow ends up branching on the word "false" |
| `parse-json`, `stringify-json` | serde, failing with the parser's message |
| `encode-json`, `decode-json` | scalars to and from `json`; decoding a JSON array or object to a scalar fails |
| `read-bytes` | host-side read of the handle into a new host-owned artefact |
| `decode-image` | probes the content; a file that does not decode fails on the edge the user drew, and a real image has its handle reclassified to `image` |
| `write-temp` | relabels a `bytes` handle as `file`. The bytes already live in a host-owned file, so nothing is copied |
| `map` | applies the remaining operations to each element of a list. One bad element fails the whole list rather than being dropped |

`read-bytes` and `decode-image` read through `Broker::host_read`, which is host-only and is not
exposed on `NodeContext`. Conversions are performed *by the runtime on behalf of an edge*, not
by the node that receives the value, so requiring the receiving component to hold `fs.read`
would be wrong in both directions — it would refuse legitimate conversions, and it would teach
components to ask for a capability they do not need. The result is written into another
host-owned handle, and opening *that* still requires the component's own `fs.read` grant and
its own reachability.

**Two declared conversions are not implemented.** `probe-video` and `probe-audio` are listed in
`PENDING_OPS` and fail with code `conversion-unavailable` and a message naming what is missing.
They need a container parser this build does not have. They remain in the table so the type
system stays honest about what `file -> video` means; the cost is a connection the editor
allows and the run refuses, which is the failure [ADR-0003](adr/0003-one-runtime-shared-type-table.md)
exists to prevent, arrived at from the other direction. `decode-image` used to be on this list
and no longer is.

---

## 6. The journal

`journal.rs` is not logging added afterwards. It is the debugger's data source and the only
record of what a run did. Everything the node inspector shows comes from here.

A `RunJournal` holds the run id, start and finish timestamps, an overall `RunStatus`, a map of
`NodeRecord` keyed by node, and the `order` nodes were scheduled in. The order is stored
separately because iterating the map gives alphabetical order, which is not what happened, and
a debugger showing a run as a sequence needs the sequence.

Each `NodeRecord` carries the component reference, status, start time, duration, a summary of
every input and output, every capability call the broker saw, the component's log lines, an
error if there was one, and `skipped_because` when the node never ran.

### It holds summaries, never contents

A journal is written to disk and rendered in a UI; neither is somewhere a user's file contents
should end up by default. `Value::summary()` describes text by length and structured data by
shape — `text (13 characters)`, `json (1 fields)`, `image #7` — and never quotes either.
Scalars are shown, because they are what makes a graph debuggable and they carry no bulk.

There is a second method, `Value::preview()`, which *does* include content, truncated. It exists
for the live inspector, which shows a person what actually flowed through a node. It must never
be persisted or sent anywhere; the moment it is, the journal's no-content guarantee is gone.

### Overall status

`RunJournal::finish()` decides the outcome from what the nodes did:

- any node `Cancelled` → `Cancelled`. A user who pressed Stop should not be told the run failed.
- any `Failed` *and* any `Ok` → `Partial`.
- any `Failed` and nothing succeeded → `Failed`.
- otherwise → `Ok`.

A run where something failed is never reported as `Ok`. "Partly worked" is its own answer, and
a `Disabled` node does not make a run look broken.

The runtime does not write the journal to disk. The CLI prints it (or emits it as JSON with
`--json`); the desktop app emits it as an event and holds it in memory. There is no run history
store.

### Progress is not the journal

The journal is immutable and arrives once, at the end. Live progress is a stream, delivered
through the `RunObserver` trait — `run_started`, `node_started`, `node_finished`,
`run_finished`. Conflating the two would mean handing the debugger a half-written journal, and
its guarantee — that what it shows is what happened — would stop being true. Observers are
called from the thread running the graph and must not block: a slow observer slows the
workflow.

---

## 7. Cancellation

Cancellation is an `AtomicBool` shared with the caller. It is checked:

- between nodes, before each one starts, producing a `Cancelled` record;
- by components that choose to, through `NodeContext::is_cancelled()`. `Delay` wakes every
  50 ms and checks, so a one-hour wait is stoppable — sleeping for the whole duration would
  make it the sort of thing that makes people close an application rather than trust it;
- by the session loop, between runs and inside its waits.

**It is cooperative and nothing more.** There is no preemptive timeout, no fuel ceiling, and no
memory ceiling on a node. A first-party component that loops without checking the flag is not
stopped. Those controls arrive with the WebAssembly host, where epoch interruption can
genuinely halt a running instance; a timeout that cannot stop anything would be a progress bar,
not a control.

> **Discrepancy.** [ARCHITECTURE](ARCHITECTURE.md) §5.1 step 4 describes per-node execution
> "under wall-clock timeout (epoch interruption), fuel ceiling, memory ceiling". None of those
> exist in this build. §5.3 defines a `PAUSE` semantic; there is no pause at all.

---

## 8. Triggers and the session layer

The executor's contract is "validate a directed acyclic graph, run it once, write a journal". A
folder watcher does not fit inside that and should not be made to: it produces values over
time, and each value is a *separate run* of the same graph.

So a trigger lives above the executor, in `session.rs`. The session polls its triggers and, for
every event, calls the ordinary run path with that value seeded in. The executor's semantics —
and its tests — are untouched, and a trigger cannot introduce a cycle, a partial run, or any of
the states a streaming executor would have to handle.

### How a seed enters the graph

A seed names either an **input** port — the file a person picked — or an **output** port, which
is what a trigger produced. The executor sorts them at the start of a run so the rest of it does
not have to know which kind it is looking at: input seeds are delivered exactly like a
producer's output, and output seeds are placed straight into the output map with their handles
made reachable to the trigger node's consumers. A component cannot tell the difference, and
there is no second delivery path to keep in step.

Validation is told which ports are supplied, through `validate_with_supplied`, so a trigger's
required downstream input does not look unconnected.

### What keeps a session from running away

- **One run at a time.** A folder with two hundred files produces two hundred runs, in order,
  not two hundred at once. `Session::tick` polls whatever is due and then runs *at most one*
  queued event, so the caller stays responsive and Stop is checked between runs.
- **A bounded queue.** `MAX_PENDING` is 512. Beyond that the oldest pending events are dropped
  and the count is reported in the `Tick` and in the running total. Queueing without limit is
  how a watcher becomes a memory leak.
- **Validation happens once**, when the session starts, not per event. A graph that cannot run
  should say so when the user presses Start, not on the first file that arrives.
- **A trigger failure is reported, not fatal.** A folder that disappears stops that watcher; it
  does not tear down a workflow that may have other sources.
- **One event carries every value that describes it.** A file appearing in a folder yields a
  handle, a name and an extension. They are queued together as one `Fired`; queuing them
  separately would interleave two files' names and handles the moment two arrived at once,
  which is the kind of bug that only shows up under load and looks like corruption.

### The two triggers that exist

**Watch Folder** (`encastra.file.watch`) polls, rather than using the OS change-notification
APIs, and the trade is deliberate. Polling is the same code on every platform, so the behaviour
a person sees on Windows is the behaviour the tests exercise on Linux. And the awkward part of
watching a folder is not being told that something changed — it is knowing when a file has
*finished* being written. A file copied over a network appears immediately and grows for
seconds afterwards, and a change event fires for every chunk. Either way the answer is to wait
until the size stops moving, which polling gives directly and an event stream has to be
debounced back into. The cost is latency of up to one interval, which for a folder a person
drops files into is not a cost anyone notices. The `Trigger` trait is the real point: a
notification-backed implementation slots in behind it without anything else changing.

Concretely: a 600 ms interval; a file must look identical for two consecutive polls before it
is handed over; one level deep, files only; an optional comma-separated extension filter; and
`existing` off by default, so switching a workflow on does not immediately process a folder
full of old files. A file that changes after being handed over fires again — this is what makes
"save over the top" work the way people expect — and a file that disappears is forgotten, so
putting the same name back starts it again.

**Timer** (`encastra.system.timer`) fires every *n* seconds, 1 to 86 400, with the first run
immediate. It reads its own period during `poll`, because `interval` has no access to the
node's settings; the session asks for the interval *after* polling, so the configured value
takes effect from the first tick onwards.

---

## 9. What is sequential, and what is not implemented

**Sequential today.** Execution is one node at a time, in the validated topological order.
Running independent branches on a bounded pool is the intended next step and the order already
permits it. It is not claimed as done anywhere in the code, and it is not done.

Also not implemented, and stated plainly rather than described in the present tense elsewhere:

| | Status |
|---|---|
| Parallel execution of independent branches | not implemented |
| Per-node timeout, fuel ceiling, memory ceiling | not implemented; they arrive with the Wasm host |
| `PAUSE` | not implemented |
| Automatic retry and backoff | not implemented. `retryable` exists on both the manifest and `NodeError`, and nothing reads it to retry anything |
| A `Loop` component | does not exist. The cycle error's hint mentions one, and there is no such component in the set |
| Third-party (`kind: "wasm"`) execution | not implemented. There is no `encastra-host` crate and no WASI host; such a node fails with `no-implementation`. See [COMPONENT-SDK](COMPONENT-SDK.md) |
| Persisting a journal | not implemented. A run's record lives as long as the process holds it |
| Secret resolution at the point of use | not implemented. See [PROJECT-FORMAT](PROJECT-FORMAT.md) §5 |
| A webhook listener | deliberately absent. Receiving a request means listening on a port, which is a different security question from making one |
| `probe-video`, `probe-audio` | declared in the type table, refused at run time |

---

## 10. Running one from a terminal

`encastra-cli` is the same runtime, called differently. It exists so the engine can be
exercised, scripted and tested without a UI, and so that "it works" is a claim somebody can
check rather than a screenshot.

```console
$ encastra components                 # what this build offers
$ encastra validate graph.json        # report issues, run nothing
$ encastra run graph.json \
    --input read.file=./data.json \
    --allow-write write=./out \
    --json
```

`--input <node.port>=<file>` seeds a port. `--allow-write <node>=<dir>` and
`--allow-notify <node>` are the only grants the CLI can express, so a graph using
`encastra.net.http`, `encastra.system.clipboard` or `encastra.file.watch` cannot be granted what
it needs from the command line and will be refused by the broker. The CLI also runs the
one-shot path only — it does not drive a session, so a trigger-driven graph does not tick from
here.

Exit code is `0` only when the journal's status is `Ok`. A partial run is a failure at the shell.
