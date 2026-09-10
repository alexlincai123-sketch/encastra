# ARCHITECTURE

> Status: **Phase 0 — foundational.** This document is the source of truth for structural
> decisions. Anything that contradicts it is a bug in the code, not in the document.
> Brand: **Encastra** (working name, chosen in Phase 0 — see [BRANDING.md](BRANDING.md)). The
> earlier codename "Digital LEGO" is retired: LEGO is an enforced trademark of the LEGO Group
> and is never used in public copy, domains, or repositories.

---

## 1. What this system actually is

A **local-first runtime that executes a typed graph of sandboxed components**, plus the
ecosystem around it (editor, registry, marketplace, SDK).

Everything else — the canvas, the marketplace, the website — is a surface on top of three
primitives:

| Primitive | Owns | Lives in |
|---|---|---|
| **Component Protocol** | what a piece *is*: manifest, typed ports, declared capabilities, signature | `packages/protocol` + `crates/encastra-protocol` |
| **Runtime** | what happens when you press RUN: scheduling, capability enforcement, limits, telemetry of a run | `crates/encastra-core` (single implementation) |
| **Project Format** | what you save, share, and reproduce: graph + lockfile + assets | `packages/project-format` |

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

The defence is that a third-party component **has no ambient authority**: it cannot open a
file, resolve a hostname, spawn a process, or read the clipboard, because the execution
environment does not expose those things at all. It can only ask the host, and the host only
answers for capabilities the user granted to that specific component.

That requirement selects the technology:

### Decision: WebAssembly Component Model (WASI 0.2) for third-party code

WASI 0.2 is capability-based by construction: a component starts with zero authority and
receives only the handles the host hands it (a preopened directory, an outbound socket
permission, a clock). This is the property we need, and it is a property of the *platform*,
not of our code being careful. `wasmtime` additionally gives us the enforcement knobs a
runtime needs: fuel/epoch interruption for timeouts and runaway loops, a `ResourceLimiter`
for memory ceilings, and no threads.

The alternatives were evaluated and rejected:

| Option | Why rejected |
|---|---|
| Native dynamic libraries (`.dll`/`.so`) | Full process authority. Unfixable. |
| Child process + OS sandbox (AppContainer/seatbelt/bubblewrap) | Three different, partially-documented sandboxes to maintain; weakest link is the platform we test least. Kept as a **future** option for heavy native tools (ffmpeg) that cannot be Wasm. |
| A JS sandbox (isolate/VM) | Sandbox escapes are a recurring class; also forces every component author into one language. |
| "We'll just review submissions" | Not a security boundary. |

The trade-off accepted: Wasm components pay a boundary cost and cannot (today) use threads.
Mitigated by §4 — bulk data never crosses the boundary.

### The two tiers

```
                    ┌───────────────────────────────┐
                    │        CAPABILITY BROKER      │  ← single enforcement chokepoint
                    │  (grants, prompts, audit log) │
                    └───────────┬───────────────────┘
                                │  every capability call, both tiers
              ┌─────────────────┴─────────────────┐
              │                                   │
     ┌────────▼─────────┐               ┌─────────▼──────────┐
     │  TIER A: CORE    │               │ TIER B: SANDBOXED  │
     │  first-party,    │               │ third-party,       │
     │  compiled into   │               │ .wasm component,   │
     │  the host        │               │ run by wasmtime    │
     └──────────────────┘               └────────────────────┘
```

**Tier A — core components** ship with the app, are written in Rust, and are compiled into the
host binary. They are fast and can use native crates (image codecs, SQLite).

**Tier B — sandboxed components** are `.wasm` components loaded at runtime. Everything not
first-party is Tier B. There is no path for a third party to reach Tier A.

**Both tiers go through the same capability broker.** Tier A is *trusted to be correct*, not
*trusted to be unconstrained*: a core component that declares no network capability still
cannot open a socket, because it calls the same broker API and the broker refuses. This is
deliberate — it means the permission UI never lies, the audit log is complete, and there is no
second, weaker enforcement path to forget about. (A risk control that some code paths can
bypass is not a control.)

---

## 3. Component Protocol

A component is a **manifest + an implementation + a signature**.

### 3.1 Manifest

`component.toml` (authored) → canonicalised to JSON for hashing and signing. Full schema:
[`packages/protocol/schema/component.schema.json`](../packages/protocol/schema/component.schema.json).
Shape:

```toml
schema  = 1                       # protocol version, integer, additive-only
id      = "encastra.image.resize"    # reverse-DNS, immutable for the life of the component
version = "1.2.0"                 # semver, immutable once published
name    = "Image Resize"
runtime = ">=0.4.0 <2.0.0"        # host versions this is known to work on
kind    = "wasm"                  # "wasm" | "core"

[ports.inputs.image]
type     = "image"
required = true

[ports.outputs.image]
type = "image"

[config.width]
type = "u32"
min  = 1
max  = 20000

[[capabilities]]
kind   = "fs.read"
scope  = "input-handles"          # NOT a path — see §4
reason = "Reads the image you connect to this node."
```

Rules that matter:

- **`id` + `version` are immutable.** Republishing different bytes under the same
  `id@version` is rejected by the registry; the content hash is part of the identity.
- **Capabilities are declared, scoped, and carry a human `reason`.** The reason string is
  what the user sees in the consent dialog. A capability with no reason fails validation.
- **`schema` is additive-only.** Adding a field never breaks an old host; removing or
  re-typing one requires `schema = 2`. Hosts refuse manifests with a `schema` they do not
  know rather than guessing.
- **Unknown top-level keys are rejected**, not ignored. Silent tolerance of unknown fields is
  how a signed manifest and an executed manifest drift apart.

### 3.2 Wire interface (Tier B)

Defined once in WIT, in `packages/protocol/wit/`. Sketch:

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

interface host {                     // the ONLY authority a component has
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

There is no `wasi:filesystem` import in the default world. A component that wants files gets
**handles**, not paths.

### 3.3 Signing and revocation

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

Types are checked at **edit time** (can these two ports connect?) and at **run time** (is what
actually arrived what was promised?).

### 4.1 Types

Scalars: `bool`, `i64`, `f64`, `string`, `json`.
Handles: `file`, `image`, `video`, `audio`, `bytes`, `dir`.
Composites: `list<T>`, `option<T>`.

Compatibility is **data, not code**: a single table at
`packages/protocol/data/type-graph.json` declares every legal edge and whether it is direct or
requires an inserted coercion node. The Rust host and the TypeScript editor both read that
file. They do not each implement the rules.

> This is deliberate. Two independent implementations of the same rule drift silently — the
> editor allows a connection the runtime then rejects, or worse, the reverse. One table, two
> readers, plus a conformance test that asserts both readers agree on every pair.

`image → i64` has no edge and cannot be connected. `i64 → string` has a `lossless` coercion.
`string → i64` has a `fallible` coercion which the editor surfaces as an explicit
"Convert" node rather than performing silently.

### 4.2 Handles: why media never crosses the sandbox boundary

An `image` is not bytes on the wire. It is an opaque `resource-handle` that the **host** owns:

```
Component A                 HOST                         Component B
  produce image  ──────►  handle #7 = /run/tmp/a3f.png
                          (host owns the path)
                                     ──────►  receives handle #7
                                              opens it via host.open-input
```

Consequences, all of them load-bearing:

1. **Security.** A component never sees or supplies a filesystem path, so path traversal and
   "read `~/.ssh/id_rsa` instead" are not expressible. It can only open handles that the graph
   actually wired to its ports.
2. **Performance.** A 4 GB video is never copied through linear memory. The Wasm boundary
   cost stops scaling with file size.
3. **Reproducibility.** The host knows every artifact a run produced and can hash it.

Handles are scoped to a single run and revoked when it ends.

---

## 5. Runtime

One implementation, in Rust, in `crates/encastra-core`. The editor calls it over Tauri IPC. There
is no second runtime in TypeScript — the editor performs *static* validation only, from the
shared type table.

### 5.1 Execution model

1. **Validate** the graph: no unknown components, no type-illegal edges, required inputs
   satisfied, versions resolvable from the lockfile.
2. **Cycle check.** The graph is a DAG. Cycles are rejected at validation with the offending
   path named. Iteration is expressed by `Loop`, a component with bounded semantics — not by
   an edge that points backwards. This is what makes "no infinite loops" a structural
   property instead of a watchdog.
3. **Topological schedule**, executing independent branches concurrently on a bounded pool.
4. **Per-node execution** under: wall-clock timeout (epoch interruption), fuel ceiling,
   memory ceiling, and the node's granted capabilities.
5. **Record** into the run journal: inputs, outputs, duration, capability calls made, logs,
   error. This journal *is* the debugger's data source — it is not extra instrumentation
   bolted on afterwards.

### 5.2 Failure semantics

- A node fails → its downstream subtree is marked `skipped`, siblings continue. The run ends
  `partial`, not silently `ok`.
- Retries only where the component declared `retryable` **and** the error is marked
  `retryable: true`. Exponential backoff with jitter. Never retry a non-idempotent capability
  call (a write, a POST) unless the component explicitly opted in.
- `STOP` is cooperative-then-forced: epoch interruption first, then the instance is dropped.
  Handles are revoked and temp artifacts cleaned regardless of how the run ended.
- **A run that could not be evaluated is never reported as a successful run.** Empty output
  and failure are distinct states everywhere in the API, the UI, and the journal. (An
  operation that returns "nothing" for both "genuinely nothing" and "the thing broke" makes
  every failure invisible.)

### 5.3 What PAUSE means

True mid-instruction pause is not offered — it would mean suspending a Wasm instance holding
an open OS resource, which is a correctness minefield. `PAUSE` is defined as **"finish the
in-flight nodes, then stop before scheduling the next"**, and the UI says exactly that. A
button that claims more than the engine does is a lie with a nice icon.

---

## 6. Project format

`.encastra` = a deterministic ZIP (fixed timestamps, sorted entries, no platform metadata) so the
same project always hashes the same:

```
project.json        manifest: id, name, schema, created/modified, runtime range
graph.json          nodes, edges, positions, groups, config
lock.json           every component: id, exact version, artifact sha256, registry origin
variables.json      names + types + which are secrets (NEVER the secret values)
assets/             files the project owns
versions/           snapshot chain (see §7)
README.md
```

Reproducibility comes from `lock.json`: a project pins **content hashes**, not version ranges.
Opening a project whose lock cannot be satisfied offers *resolve* or *open read-only* — it does
not silently substitute a different version.

Secrets are referenced by name and resolved at run time from the OS keystore (Windows
Credential Manager / macOS Keychain / Linux Secret Service). A `.encastra` file is safe to share;
that is a hard invariant with a test that asserts no secret value can reach the archive.

---

## 7. Versioning

Native, not Git — users are not required to know Git, and the unit of versioning is a graph,
not a text diff.

Content-addressed snapshots in the local SQLite database:

```
snapshot { id, project_id, parent_id, created_at, label, message, graph_hash, blob }
```

Immutable, singly-linked, so `RESTORE` is "create a new snapshot whose content equals an old
one" — history is never rewritten and restore is itself undoable. `COMPARE` diffs at the graph
level (node added / config changed / edge rewired), which is the only diff a user of this
product can act on. Branches and merge are a later phase; the parent pointer is already the
shape they need.

---

## 8. Processes and layout

```
┌─────────────────────────────────────────────┐
│ Tauri shell (Rust)                          │
│  ├── WebView: React editor  ── IPC ──┐      │
│  ├── encastra-core (runtime + broker) ◄─┘      │
│  ├── encastra-host (wasmtime, Tier B)          │
│  └── SQLite (projects, snapshots, journal)  │
└─────────────────────────────────────────────┘
        │ HTTPS, only when the user asks
┌───────▼──────────────────────────────────────┐
│ services/api — auth, registry, marketplace   │
│ PostgreSQL · object storage · Stripe          │
└──────────────────────────────────────────────┘
```

The desktop app is fully functional offline for local projects. Network is required only for
account, registry install, marketplace, sync, and updates — and the absence of network
degrades those features rather than the editor.

```
apps/desktop   Tauri 2 + React 19 + Vite + React Flow (canvas substrate, custom nodes)
apps/web       Next.js marketing + docs
apps/admin     moderation, advisories, revocation (MFA + RBAC + audit log)
packages/      protocol · project-format · ui · types · sdk (+CLI)
crates/        encastra-core · encastra-host · encastra-builtins · encastra-protocol
components/    manifests + source for the shipped set
services/api   backend
```

React Flow is the canvas *substrate* (pan/zoom/selection/minimap — solved problems, MIT). Node
and edge rendering, connection validation, and the entire visual language are ours; the
library is not visible in the result.

---

## 9. Performance targets

Budgets, to be measured in CI, not aspirations:

| Metric | Target |
|---|---|
| Cold start to interactive editor | < 1.5 s |
| Idle RSS, one project open | < 200 MB |
| Canvas pan/zoom, 300 nodes | ≥ 55 fps |
| Component registry list (500 entries) | < 100 ms, virtualised |
| Installer size (Windows) | < 25 MB |

Components are lazy-loaded; the palette is metadata-only until a node is placed.

---

## 10. Decisions recorded

Each has an ADR in [`docs/adr/`](adr/):

| ADR | Decision |
|---|---|
| 0001 | Wasm Component Model + wasmtime for third-party components |
| 0002 | Two tiers (core / sandboxed) behind one capability broker |
| 0003 | Rust-only runtime; the editor validates statically from a shared type table |
| 0004 | Handle-based media passing |
| 0005 | React Flow as canvas substrate, custom visual language |
| 0006 | npm workspaces; no monorepo framework until it earns its place |
| 0007 | Native snapshot versioning rather than Git |
| 0008 | Ed25519 signing + signed revocation list |
| 0009 | Windows builds require the MSVC toolchain |
| 0010 | Dependency version policy: current stable, pinned, few |
