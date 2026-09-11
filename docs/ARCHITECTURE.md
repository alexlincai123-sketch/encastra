# ARCHITECTURE

> Status: **0.1.0-beta.1.** This document describes the structural decisions the product rests
> on, and marks — wherever one appears — which of them are **built** and which are **designed
> and not built**.
>
> **The code is the authority.** Where this document and the repository disagree, the
> repository is right and this document is wrong. That is the reverse of what an earlier
> revision claimed, and the reversal is deliberate: a specification that outranks the code
> produces a document nobody can trust and a build nobody can check.
>
> [RUNTIME](RUNTIME.md), [SECURITY](SECURITY.md), [PROJECT-FORMAT](PROJECT-FORMAT.md) and
> [COMPONENT-SDK](COMPONENT-SDK.md) are the implementation reports for their areas and go
> further into detail than this overview does. [README](../README.md) carries the same
> built/not-built split in one screen.
>
> Brand: **Encastra** (working name, chosen in Phase 0 — see [BRANDING.md](BRANDING.md)). The
> earlier codename "Digital LEGO" is retired: LEGO is an enforced trademark of the LEGO Group
> and is never used in public copy, domains, or repositories.

### What is built, and what is not

| | State |
|---|---|
| Component protocol — manifests, validation, canonical form, digest | built |
| Type system — one rule table, two readers, conformance gate | built |
| Runtime — validation, sequential execution, journal, conversions | built |
| Capability broker — handles, grants, refusals, audit trail | built |
| 19 components and 2 triggers, first-party and in-process | built |
| `.encastra` project container and its version history | built |
| Desktop application and CLI, over one runtime | built |
| **Tier B: third-party WebAssembly components** | **designed, not built** — no host crate, no `wasmtime`, no WIT world |
| **Per-node timeouts, fuel metering, memory ceilings** | **designed, not built** — they arrive with the Wasm host |
| **Automatic retry, and `PAUSE`** | **designed, not built** |
| **Signing, revocation, registry, marketplace, accounts, updates, website** | **designed, not built** |
| **Secret resolution from an OS keystore** | **designed, not built** |

Everything in bold is nevertheless described below, because the design is worth keeping and
worth arguing with. None of it runs.

---

## 1. What this system actually is

A **local-first runtime that executes a typed graph of components**, plus the ecosystem
designed around it (editor, registry, marketplace, SDK). The runtime and the editor exist. The
sandbox, the registry, the marketplace and the SDK's execution path do not.

Everything else — the canvas, the marketplace, the website — is a surface on top of three
primitives:

| Primitive | Owns | Lives in |
|---|---|---|
| **Component Protocol** | what a piece *is*: manifest, typed ports, declared capabilities | `crates/encastra-protocol` (the authority) + `packages/protocol` (the shared type table, and a documentation-only JSON Schema) |
| **Runtime** | what happens when you press RUN: validation, scheduling, capability enforcement, and the journal of a run | `crates/encastra-core` (single implementation) |
| **Project Format** | what you save, share, and reproduce: graph + lockfile + variables + history | `crates/encastra-project` |

> A signature is designed as the third part of a component's identity and is not built (§3.3),
> so it is left out of the table above rather than listed as though something produced one.
> `packages/project-format` exists as an empty workspace directory and holds nothing; the
> container is Rust.

If those three are right, the product can be rebuilt around them. If they are wrong, no
amount of UI saves it. They are therefore specified before any UI code exists.

### Non-goal: AI in the runtime

Per product requirement, the runtime executes without any LLM. No component, no scheduling
decision, and no validation path calls a model. AI may later exist as an *optional authoring
aid* (suggest a component, explain an error) that is strictly outside the execution path and
can be compiled out.

---

## 2. The security problem drives the architecture

The single largest risk in this product is not "will the canvas feel nice". It is:

> A third party publishes a component. A user installs it. That component now runs on the
> user's machine.

Any design where a third-party component can execute arbitrary native code with the user's
privileges is unshippable, regardless of how good the review process is. Code review, malware
scanning, and reputation are **defence in depth** — they are not the defence.

The intended defence is that a third-party component **has no ambient authority**: it cannot
open a file, resolve a hostname, spawn a process, or read the clipboard, because the execution
environment does not expose those things at all. It can only ask the host, and the host only
answers for capabilities the user granted to that specific component.

> **That is the design, not the build.** No third-party component can execute in
> 0.1.0-beta.1, because nothing can load one: a node whose manifest says `kind: "wasm"` fails
> with `no-implementation`. The boundary is not crossed today because it does not exist, which
> also means it has never been exercised and is therefore untested. Everything below about
> Tier B should be read as a specification to build against.

That requirement selects the technology:

### Decision: WebAssembly Component Model (WASI 0.2) for third-party code — *designed, not built*

Recorded as [ADR-0001](adr/0001-wasm-component-model-for-third-party-code.md). WASI 0.2 is
capability-based by construction: a component starts with zero authority and receives only the
handles the host hands it (a preopened directory, an outbound socket permission, a clock). This
is the property we need, and it is a property of the *platform*, not of our code being careful.
`wasmtime` would additionally give us the enforcement knobs a runtime needs: fuel and epoch
interruption for timeouts and runaway loops, a `ResourceLimiter` for memory ceilings, and no
threads.

None of that is in the repository — there is no `wasmtime` dependency, no host crate, and no
WIT world. The alternatives were nevertheless evaluated, and this is why they were rejected:

| Option | Why rejected |
|---|---|
| Native dynamic libraries (`.dll`/`.so`) | Full process authority. Unfixable. |
| Child process + OS sandbox (AppContainer/seatbelt/bubblewrap) | Three different, partially-documented sandboxes to maintain; weakest link is the platform we test least. Kept as a **future** option for heavy native tools (ffmpeg) that cannot be Wasm. |
| A JS sandbox (isolate/VM) | Sandbox escapes are a recurring class; also forces every component author into one language. |
| "We'll just review submissions" | Not a security boundary. |

The trade-off accepted: Wasm components would pay a boundary cost and could not (today) use
threads. Mitigated by §4 — bulk data never crosses the boundary.

### The two tiers

```
                    ┌───────────────────────────────┐
                    │        CAPABILITY BROKER      │  ← single enforcement chokepoint
                    │  (grants, refusals, journal)  │            BUILT
                    └───────────┬───────────────────┘
                                │  every capability call, both tiers
              ┌─────────────────┴─────────────────┐
              │                                   │
     ┌────────▼─────────┐               ┌─────────▼───────────┐
     │  TIER A: CORE    │               │ TIER B: SANDBOXED   │
     │  first-party,    │               │ third-party,        │
     │  compiled into   │               │ .wasm component     │
     │  the host        │               │                     │
     │      BUILT       │               │ DESIGNED, NOT BUILT │
     └──────────────────┘               └─────────────────────┘
```

**Tier A — core components** ship with the app, are written in Rust, and are compiled into the
host binary. They are fast and can use native crates: this build uses `image` for codecs, `csv`
for tabular data, `ureq` for HTTP and `arboard` for the clipboard. Everything that runs in
0.1.0-beta.1 is Tier A.

**Tier B — sandboxed components** would be `.wasm` components loaded at runtime. Everything not
first-party is Tier B, and there is deliberately no path for a third party to reach Tier A. No
loader exists, so the set of installable third-party components is presently empty by
construction rather than by policy.

**Both tiers are designed to go through the same capability broker**, and the Tier A half of
that is real and tested. Tier A is *trusted to be correct*, not *trusted to be unconstrained*: a
core component that declares no network capability still cannot open a socket, because it calls
the same broker API and the broker refuses. This is deliberate — it means the permission UI
never lies, the audit trail is complete, and there is no second, weaker enforcement path to
forget about. (A risk control that some code paths can bypass is not a control.) Recorded as
[ADR-0002](adr/0002-two-tiers-one-broker.md).

---

## 3. Component Protocol

A component is a **manifest + an implementation**. A signature is designed as the third part of
its identity and is not built (§3.3).

### 3.1 Manifest — JSON, not TOML

A manifest is **JSON**: authored as JSON, hashed as JSON, executed as JSON. There is no TOML
anywhere in the protocol and no conversion step between the two. That is the point — a
signature is computed over bytes, and one on-disk format means there is nothing sitting between
the thing that was signed and the thing that runs.

The authority is `crates/encastra-protocol/src/manifest.rs`. The editor does not read manifests
at all; it receives already-validated metadata from the runtime, because a second validator in
TypeScript would be free to disagree with the loader.
[`packages/protocol/schema/component.schema.json`](../packages/protocol/schema/component.schema.json)
is published so an author's editor can autocomplete, and it says in its own description that it
is documentation rather than the authority: it cannot express the rules that matter — that every
port type resolves in the type graph, that every declared capability is one this build can
enforce, that no floating-point number appears anywhere in the document.

This is a real manifest — the one behind Resize Image, shortened:

```json
{
  "schema": 1,
  "id": "encastra.image.resize",
  "version": "1.0.0",
  "name": "Resize Image",
  "description": "Changes an image's size. Leave one side empty to keep the proportions.",
  "category": "media",
  "runtime": ">=0.1.0",
  "kind": "core",
  "ports": {
    "inputs":  { "image": { "type": "image", "required": true, "label": "Image" } },
    "outputs": { "image": { "type": "image", "label": "Resized" },
                 "width": { "type": "i64",   "label": "Width" } }
  },
  "config": {
    "width": { "type": "i64", "min": 0, "max": 20000, "label": "Width",
               "doc": "Leave at 0 to work it out from the height." }
  },
  "capabilities": [
    { "kind": "fs.read", "scope": "input-handles",
      "reason": "Reads the image you connect to this node, and nothing else." }
  ],
  "platforms": ["windows", "macos", "linux"],
  "retryable": true
}
```

Rules that matter:

- **`kind` is `"core"` or `"wasm"`.** Only `"core"` is executable in this build.
- **Capabilities are declared, scoped, and carry a human `reason`.** The reason string is what
  the user is shown when deciding, and a capability without one fails validation: an unexplained
  permission request is not consent. So does a capability kind this build cannot enforce — a
  manifest asking for `process.spawn` is refused outright rather than surfaced in a dialog the
  runtime could not honour. The enforceable set is `fs.read`, `fs.write`, `net.http`,
  `system.notify`, `system.clipboard`. The scope `input-handles` means "only what the graph
  wired to my ports" and is the one scope that needs no further decision from the user.
- **`schema` is additive-only.** Adding a field never breaks an old host; removing or
  re-typing one requires `schema = 2`. Hosts refuse manifests with a `schema` they do not
  know rather than guessing.
- **Unknown top-level keys are rejected**, not ignored. Silent tolerance of unknown fields is
  how a signed manifest and an executed manifest drift apart: a future field that granted
  something would be dropped by an old host that still called the manifest valid.
- **No floating-point numbers, anywhere in the document.** Canonicalisation has exactly one
  genuinely hard part — agreeing how to serialise a float — and refusing floats removes it.
  Sorted keys plus integers only give a stable canonical form without an RFC 8785
  implementation. A component that wants a float takes it as config from the user at run time,
  which is not part of the signed identity.
- **`trigger` and `retryable` are manifest fields.** `trigger` is enforced: a trigger has
  outputs, no inputs, and no implementation in the component set, because it produces values
  over time rather than running as a step. `retryable` is recorded and **nothing reads it**,
  because automatic retry is not built (§5.2).
- **`id` + `version` are intended to be immutable.** Republishing different bytes under the same
  `id@version` would be rejected by a registry that does not exist. What is enforced today is
  narrower and local: a registry refuses two components claiming the same `id@version` at load,
  so which code runs never depends on directory iteration order.

`canonical_json()` and `digest()` — `sha256` of the canonical form — are implemented and tested,
including that the digest does not depend on key order in the source. What consumes a digest is
`lock.json` (§6); nothing verifies one when a project is opened.

### 3.2 Wire interface (Tier B) — *designed, not built*

The intended shape, to be defined once in WIT:

```wit
package encastra:component@0.4.0;

interface types {
  variant value {
    unit, boolean(bool), integer(s64), number(f64), text(string),
    json(string),
    handle(resource-handle),        // file / image / video / stream — see §4
    list-of(list<value>),
  }
  record port-value { port: string, value: value }
  record run-error { code: string, message: string, retryable: bool }
}

interface host {                     // the ONLY authority a component would have
  open-input: func(port: string) -> result<input-stream, run-error>;
  create-output: func(port: string, hint: option<string>) -> result<output-stream, run-error>;
  http-request: func(req: request) -> result<response, run-error>;   // gated by capability
  log: func(level: level, message: string);
  progress: func(fraction: f64);
}

world component {
  import host;
  export run: func(inputs: list<port-value>, config: string) -> result<list<port-value>, run-error>;
}
```

> **`packages/protocol/wit/` does not exist, and there is no `.wit` file anywhere in this
> repository.** The block above is a sketch of an intended interface, not a published one.
> Every signature in it is provisional, none of it has been compiled against anything, and the
> `0.4.0` in the package line is aspirational rather than a release.
> [COMPONENT-SDK](COMPONENT-SDK.md) says the same and goes further.

The intent it records survives the absence of the file, and is the part worth keeping: there
would be no `wasi:filesystem` import in the default world. A component that wants files gets
**handles**, not paths — which is exactly how the built broker already treats Tier A (§4.2).

### 3.3 Signing and revocation — *designed, not built*

Recorded as [ADR-0008](adr/0008-signing-and-revocation.md). **None of this is implemented.**
There is no signing code, no signature verification, no revocation list, and no registry to
fetch either from. `lock.json` stores a manifest digest and no code checks it on open.

The design is kept here because it is what a registry would have to be built to:

- Publisher signs `sha256(canonical_manifest_json) || sha256(artifact)` with **Ed25519**.
- The registry counter-signs on acceptance; the client trusts the registry root key, which is
  pinned in the binary and rotatable via a signed key-history file.
- The client verifies signature **and** content hash on install and again on load. A hash
  mismatch at load time is a hard failure, not a warning.
- **Revocation / kill switch:** the client fetches a signed, monotonically-versioned
  revocation list (component version → reason) on a schedule, caches it, and refuses to load
  revoked artifacts. It is fail-*closed* for a revoked entry it already knows about and
  fail-*open* for "cannot reach the server" — never the reverse, and a stale list is used
  rather than none. Rollback of the list version is rejected.

---

## 4. Type system and the handle model

Built. Types are checked at **edit time** (can these two ports connect?) and at **run time**
(is what actually arrived what was promised?). The run-time half is real: a node that produces
an output its manifest does not declare, or declares as a different type, fails with
`contract-broken` rather than passing an unexpected value downstream where it becomes a
confusing failure somewhere else.

### 4.1 Types

Scalars: `bool`, `i64`, `f64`, `string`, `json`.
Handles: `file`, `dir`, `bytes`, plus `image`, `video` and `audio`, which extend `file`.
Composites: `list<T>`, `option<T>`.

Compatibility is **data, not code**: a single table at
`packages/protocol/data/type-graph.json` declares every legal edge and whether it is direct or
requires an inserted coercion. The Rust host embeds that file at compile time and the
TypeScript editor imports it. They do not each implement the rules.

> This is deliberate. Two independent implementations of the same rule drift silently — the
> editor allows a connection the runtime then rejects, or worse, the reverse. One table, two
> readers, plus a conformance matrix generated by the TypeScript side and replayed by the Rust
> side, asserting both produce the same answer for every pair. CI regenerates the matrix and
> fails on a diff, so a rule change that did not refresh the fixture cannot merge.

A coercion is one of three kinds, and these are the words the table and the code use:

- **`direct`** — the same type, or a widening. Nothing happens at run time. `image → file`.
- **`implicit`** — a total conversion that cannot fail, applied automatically. `i64 → string`.
- **`explicit`** — may fail or lose information, so the editor materialises it as a Convert
  node the user can see rather than performing it silently. `string → i64`, `file → image`.

`image → i64` has no edge and cannot be connected. Widening and then narrowing to a sibling is
refused too: `image → file → video` would let an Image connect to a Video port and fail on
every run, so the resolver declines it in the editor rather than at the end of a long job.

> Two coercions are declared in the table and refused at run time: `probe-video` and
> `probe-audio` would need a container parser this build does not have, and a component
> returning guesses would be worse than no component. The editor offers the conversion; the run
> says plainly that it cannot perform it.

### 4.2 Handles: why media never crosses the sandbox boundary

An `image` is not bytes on the wire. It is an opaque handle that the **host** owns:

```
Component A                 HOST                         Component B
  produce image  ──────►  handle #7 = <run scratch>/7-a3f.png
                          (host owns the path)
                                     ──────►  receives handle #7
                                              opens it through the broker
```

Consequences, all of them load-bearing, and all of them true of the built broker today even
though everything currently running is in-process:

1. **Security.** A component never sees or supplies a filesystem path, so path traversal and
   "read `~/.ssh/id_rsa` instead" are not expressible — not blocked, unrepresentable. A
   component can open only the handles the graph actually wired to its ports: the broker tracks
   reachability per node, and a component that invents a handle number reaches nothing. Nor can
   it relabel one, because the host's record of a handle's kind is the one that counts, so a
   text file cannot be passed off as an image.
2. **Performance.** Bulk data is not copied through a component's own memory, so the boundary
   cost would stop scaling with file size once a Wasm boundary exists.
3. **Reproducibility.** The host knows every artifact a run produced and can hash it.

Handles live in the broker, which is constructed for one run and dropped with it; the host
deletes that run's scratch directory when the run ends, however it ended. Recorded as
[ADR-0004](adr/0004-handle-based-media.md).

---

## 5. Runtime

One implementation, in Rust, in `crates/encastra-core`. The desktop editor calls it over Tauri
IPC and the `encastra` CLI calls the same functions with different arguments. There is no second
runtime in TypeScript — the editor performs *static* validation only, from the shared type
table. Recorded as [ADR-0003](adr/0003-one-runtime-shared-type-table.md).
[RUNTIME](RUNTIME.md) is the detailed implementation report and lists every gap in one table.

### 5.1 Execution model

1. **Validate** the graph: no unknown components, no type-illegal edges, required inputs
   satisfied, and every node's exact `id@version` present in the registry — lookup is exact and
   there is no resolution step, because a graph that could resolve differently tomorrow has
   stopped being reproducible. (Pinning is a project-format concern that happens once, when
   `lock.json` is written; it is not re-decided per run.) An input may be satisfied by an edge
   **or** by a value the application supplies — a trigger's event, or the file the user picked.
   Without that, every graph's first node would look unconnected. Validation reports every
   issue rather than stopping at the first, and a graph with any error is never partially
   executed: there is no state to unwind and no half-written result to explain.
2. **Cycle check.** The graph is a DAG. Cycles are rejected at validation with the offending
   path named, which is what makes "no infinite loops" a structural property rather than a
   watchdog. The design intent is that iteration be expressed by a `Loop` component with
   bounded semantics rather than by an edge that points backwards. **No `Loop` component exists
   in this build.** The cycle error's hint suggests one anyway; that hint is a known wrong
   suggestion, not a description of something a user can reach for.
3. **Topological schedule.** Execution is sequential, in that order. Running independent
   branches on a bounded pool is the intended next step and the order already permits it — it
   is planned, not done, and the code does not claim otherwise anywhere.
4. **Per-node execution** under the node's granted capabilities, which the broker enforces on
   every call. **Wall-clock timeouts, a fuel ceiling and a memory ceiling are designed and not
   built.** They arrive with the Wasm host, where epoch interruption can genuinely stop a
   running component — a timeout that cannot stop anything would be a progress bar, not a
   control. Today a component that loops without checking for cancellation is not stopped. (The
   HTTP component sets its own request timeout and response-size limit, which is a property of
   that component, not of the scheduler.)
5. **Record** into the run journal: input and output summaries, duration, every capability call
   made — allowed *and* denied — logs, and the error. This journal *is* the debugger's data
   source; it is not extra instrumentation bolted on afterwards. It holds summaries, never
   contents, because a journal is rendered on screen and written where a file's contents or a
   secret should not end up. **Persisting a journal is not built:** it lives as long as the
   process holds it.

### 5.2 Failure semantics

- A node fails → everything downstream of it is marked `skipped`, and the journal records
  *which* node was responsible, which is the difference between a debuggable run and a mystery.
  Independent branches continue. The run ends `partial`, not silently `ok`. Built and tested.
- **A run that could not be evaluated is never reported as a successful run.** Empty output
  and failure are distinct states everywhere in the API, the UI, and the journal. (An
  operation that returns "nothing" for both "genuinely nothing" and "the thing broke" makes
  every failure invisible.) Cancellation outranks failure in the same spirit: somebody who
  pressed Stop is not told their run failed.
- **Automatic retry is designed and not built.** `retryable` exists on the manifest *and* on
  `NodeError`, and nothing reads either one to retry anything. The design, for when it is
  built: retry only where the component declared `retryable` **and** the error is marked
  `retryable: true`; exponential backoff with jitter; never retry a non-idempotent capability
  call (a write, a POST) unless the component explicitly opted in.
- **`STOP` is cooperative only.** It sets a flag; the executor checks it before each node, and
  a long-running component checks it if its author chose to. The designed second half — forced
  epoch interruption, then dropping the instance — needs the Wasm host and is not built. What
  does happen regardless of how a run ended: the broker is dropped with it, taking every handle
  with it, and the host deletes the run's scratch directory.

### 5.3 What PAUSE means — *designed, not built*

There is no `PAUSE` in this build: not in the runtime, not in the editor. The design is kept
because the definition is the interesting part, and because it is the reason there is no button.

True mid-instruction pause is not offered — it would mean suspending a Wasm instance holding
an open OS resource, which is a correctness minefield. `PAUSE` is *defined* as **"finish the
in-flight nodes, then stop before scheduling the next"**, and the UI will say exactly that when
it exists. A button that claims more than the engine does is a lie with a nice icon, which is
also why one was not shipped ahead of the engine.

---

## 6. Project format

Built, in `crates/encastra-project`. [PROJECT-FORMAT](PROJECT-FORMAT.md) is the detailed report.

`.encastra` is a deterministic ZIP — one fixed timestamp, entries sorted by name, fixed
permissions — so the same project always hashes the same:

```
project.json         manifest: schema, stable id, name, description, runtime range,
                     created and modified timestamps
graph.json           nodes (component, label, config, position, disabled) and edges
lock.json            every component: id, exact version, manifest digest (sha256), origin
variables.json       names + types + which are secrets (NEVER the secret values)
versions/index.json  the snapshot chain (see §7)
versions/<id>.json   the graph at that snapshot
README.md            a note to whoever opened the archive out of curiosity
```

That is the complete list, and three things it does not contain are worth naming because
earlier revisions of this document claimed them:

- **There is no `assets/` entry.** This build writes none and reads none. A project references
  the files it works on through the run, not through the container.
- **There is no `groups` concept** in `graph.json`. `Graph` declares `deny_unknown_fields`, so a
  file containing one would be refused rather than quietly downgraded.
- **`lock.json` pins a manifest digest, not an artifact hash.** There are no artifacts to hash,
  because there is no registry and nothing is distributed as a downloadable file; `origin` is
  `builtin` for the first-party set.

Reproducibility therefore comes from `lock.json` pinning **content hashes rather than version
ranges**, and from the graph itself naming an exact `id@version` per node. **The other half of
that promise is not built:** nothing verifies the digest when a project is opened, and the
"resolve, or open read-only" flow for a lock that cannot be satisfied does not exist.

Secrets are referenced by name and are designed to be resolved at run time from the OS keystore
(Windows Credential Manager / macOS Keychain / Linux Secret Service). **That resolution is not
built** — there is no keystore integration, and nothing reads `variables.json` at run time. What
*is* built and tested is the invariant in the other direction: a `.encastra` file is safe to
share, because `Variable` has no field that could hold a value, and a hand-edited file that
tries to smuggle one in is refused rather than parsed with the extra field quietly dropped and
written back out somewhere else.

---

## 7. Versioning

Built. Native, not Git — users are not required to know Git, and the unit of versioning is a
graph, not a text diff. Recorded as
[ADR-0007](adr/0007-native-snapshot-versioning.md).

Content-addressed snapshots, stored **inside the project file** so that history travels with
the project:

```
versions/index.json     id, parent, created_at, label, message, graph_hash, restored_from
versions/<id>.json      the graph at that point
```

Immutable and singly linked, so `RESTORE` is "append a new snapshot whose content equals an old
one" — history is never rewritten and a restore is itself undoable, which is the property that
makes people willing to press the button. A snapshot created by a restore records which version
it came from, so the history reads as what happened rather than as a mysterious duplicate.
`COMPARE` diffs at the graph level (node added / config changed / edge rewired), which is the
only diff a user of this product can act on, and each change knows whether it altered behaviour
or only the layout. A snapshot whose body did not survive a round trip is dropped and the rest
of the history kept: losing one old version is survivable, refusing to open the project is not.

Branches and merge are a later phase; the parent pointer is already the shape they need.

---

## 8. Processes and layout

What actually runs:

```
┌──────────────────────────────────────────────────────┐
│ Tauri 2 shell (Rust)                                 │
│  ├── WebView: React 19 editor  ── IPC ──┐            │
│  ├── encastra-core (runtime + broker) ◄──┘           │
│  ├── encastra-builtins (19 components, 2 triggers)   │
│  └── encastra-project (.encastra files on disk)      │
└──────────────────────────────────────────────────────┘
```

There is **no host crate and no `wasmtime`**: `crates/encastra-host` exists as an empty
directory, contains no files, and is not a workspace member. There is **no SQLite, and no
database of any kind** — projects and snapshots live in the `.encastra` ZIP, and a run journal
is held in memory for as long as the process holds it.

The designed backend, which does not exist:

```
        │ HTTPS, only when the user asks
┌───────▼──────────────────────────────────────┐
│ services/api — auth, registry, marketplace   │   DESIGNED, NOT BUILT
│ PostgreSQL · object storage · Stripe         │
└──────────────────────────────────────────────┘
```

The desktop app is fully functional offline, which at present is the only way it functions:
there is no account, no sign-in, no registry install, no sync and no update channel. The only
network traffic is what a workflow the user built makes itself, through a component granted a
specific host.

Repository layout, with what each directory actually holds:

```
crates/encastra-protocol   manifest rules + the Rust reader of the shared type table
crates/encastra-core       runtime: graph, validation, broker, executor, journal, sessions
crates/encastra-builtins   the first-party set — 19 components and 2 triggers
crates/encastra-project    the .encastra container and its version history
crates/encastra-cli        the same runtime, headless (`encastra run` / `validate` / `components`)
crates/encastra-host       EMPTY — reserved for the Wasm host that is not built
apps/desktop               Tauri 2 + React 19 + Vite + React Flow (canvas substrate, custom nodes)
packages/protocol          type-graph.json, the TypeScript reader, the conformance matrix,
                           and a documentation-only JSON Schema for manifests
packages/ui                brand assets and design tokens
apps/web · apps/admin · services/api · packages/sdk · packages/types ·
packages/project-format · components/ · security/ · docs/runbooks/
                           EMPTY — reserved for work that is not built
```

Empty directories are listed rather than omitted, because somebody who finds one should be able
to tell "reserved" from "missing".

React Flow is the canvas *substrate* (pan/zoom/selection/minimap — solved problems, MIT). Node
and edge rendering, connection validation, and the entire visual language are ours; the
library is not visible in the result. Recorded as
[ADR-0005](adr/0005-react-flow-canvas-substrate.md).

---

## 9. Performance targets

These are **budgets we have committed to, not measurements we have taken.** Nothing in CI
measures any of them: CI runs formatting, lint, type-checking, the test suites, the type-system
conformance gate, dependency advisories and secret scanning, and no benchmark. Until a
benchmark job exists, every row below is a target and none is a result.

| Metric | Target |
|---|---|
| Cold start to interactive editor | < 1.5 s |
| Idle RSS, one project open | < 200 MB |
| Canvas pan/zoom, 300 nodes | ≥ 55 fps |
| Component registry list (500 entries) | < 100 ms, virtualised |
| Installer size (Windows) | < 25 MB |

One choice already works in their favour, without being evidence that any number is met: the
release profile optimises for size, with LTO, a single codegen unit and symbols stripped, and
the dependency policy keeps the tree deliberately small — default features are turned off and
re-enabled one at a time, so the image crate pulls in six formats rather than a dozen and the
ZIP crate pulls in one compression method rather than five.

Lazy component loading is not among them. The first-party set is compiled into the binary and
registered at start-up; lazy loading is a property a component *loader* would have, and there
is not one.

---

## 10. Decisions recorded

Each has an ADR in [`docs/adr/`](adr/). An ADR records a **decision and its reasoning**; it is
not a claim that the decision has been implemented. Where those differ, this table says so.

| ADR | Decision | State |
|---|---|---|
| 0001 | Wasm Component Model + wasmtime for third-party components | designed, not built |
| 0002 | Two tiers (core / sandboxed) behind one capability broker | the broker is built; the sandboxed tier is not |
| 0003 | Rust-only runtime; the editor validates statically from a shared type table | built |
| 0004 | Handle-based media passing | built |
| 0005 | React Flow as canvas substrate, custom visual language | built |
| 0006 | npm workspaces; no monorepo framework until it earns its place | built |
| 0007 | Native snapshot versioning rather than Git | built |
| 0008 | Ed25519 signing + signed revocation list | designed, not built |
| 0009 | Windows builds require the MSVC toolchain | built |
| 0010 | Dependency version policy: current stable, pinned, few | built |
