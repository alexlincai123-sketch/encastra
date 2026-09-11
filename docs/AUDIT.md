# AUDIT — state of the repository before the beta build

Date: 2026-09-11 · Commit at audit: `4650e39`

Everything here was verified by running it, not by reading the previous session's summary.
Where the summary and the repository disagreed, the repository won.

---

## 1. What is actually here

| Measure | Value |
|---|---|
| Rust + TypeScript + CSS | 10,826 lines |
| Rust tests | 99 passing, 16 suites |
| TypeScript tests | 27 passing |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `biome check .` | clean |
| Frontend production build | works — 441 kB JS (138 kB gzip), 23 kB CSS |
| Tauri crate | compiles |

Crates: `encastra-protocol`, `encastra-core`, `encastra-project`, `encastra-builtins`,
`encastra-cli`, `encastra-desktop`. Packages: `@encastra/protocol`, `@encastra/ui`,
`@encastra/desktop`.

### Genuinely working

- **Type system.** One rule table (`packages/protocol/data/type-graph.json`), read by both a
  TypeScript and a Rust implementation, with a generated conformance matrix a Rust test replays
  to prove the two agree. Mutation-tested.
- **Manifests.** Parsing, validation, canonical form, digest. Rejects unknown fields, refuses a
  capability with no reason, refuses floats.
- **Graph validation.** Reports every problem rather than the first; cycles reported as a path;
  fan-in refused; disabled-node dependencies caught before a run.
- **Runtime.** Executes a validated graph, applies declared conversions, writes a journal.
- **Capability broker.** Handle-based, deny by default, every call recorded including refusals.
  First-party components go through the same gate — proven by a test.
- **Project format.** Deterministic ZIP, atomic save, version history inside the container,
  non-destructive restore, graph-level diff.
- **Desktop editor.** Canvas with type-checked connections, palette, inspector/debugger,
  per-run consent, save/open/restore.
- **CLI.** `run`, `validate`, `components`. Same runtime as the app.

---

## 2. What does not work, or does not exist

Ordered by what blocks the beta's critical checkpoint.

### Blocking

| Gap | Detail |
|---|---|
| **No trigger model** | The runtime is a one-shot DAG executor. `file.watch` cannot exist as an ordinary node: a watcher produces values over time and must run the downstream graph once per event. |
| **No image processing** | `decode-image` is declared in the type table and listed in `PENDING_OPS` — a graph that needs it fails at run time with `conversion-unavailable`. There is no resize, convert or thumbnail. |
| **`file.write` is text-only** | Its input port is `string`. It cannot save an image. |
| **No live progress** | The journal arrives only when the whole run finishes. A node never shows as `running`. |
| **No Stop** | Cancellation exists in the runtime as a cooperative `AtomicBool` that nothing sets, and there is no button. |

### Not blocking, but the directive asks for them

- Five components exist. The directive asks for 15–20: no move, rename, watcher, image work,
  video info, clipboard, timer, launch, HTTP, webhook, CSV, switch, delay.
- No application navigation at all — the desktop app is a single screen. No Home, Projects,
  Components library, Templates, Activity, Settings, Security Center.
- No undo/redo, copy/paste, duplicate, group, or select-all on the canvas.
- No demo projects.
- No production build of the desktop app, no installer, nothing installed.
- No version shown anywhere. `0.1.0` in metadata, not `0.1.0-beta.1`.
- Secrets: `variables.json` records that a variable is secret and nothing reads it. No keystore
  integration yet.
- No WebAssembly host, so third-party components cannot execute at all. The architecture is
  in place (ADR-0001/0002); the runtime is not.

---

## 3. Technical debt found

### D1 — CI never typechecks the desktop app *(real, fixed in this session)*

`npm run typecheck` runs `tsc --build`, and the root `tsconfig.json` references only
`packages/protocol`. `apps/desktop` has its own `typecheck` script that **nothing calls**. A
type error in the entire editor would pass CI.

### D2 — CI never runs desktop tests, because there are none *(real, fixed in this session)*

`vitest.config.ts` includes `packages/*/test` and `services/*/test`. `apps/*` is not matched,
so no test placed in the desktop app would ever run. There are currently zero.

### D3 — The type table declares operations nothing implements

`decode-image`, `probe-video`, `probe-audio` are legal connections in the editor and fail at
run time. A guard test keeps the list honest, but the user-visible effect is a connection the
editor allows and the runtime refuses — the exact failure ADR-0003 exists to prevent, arrived
at from the other direction.

### D4 — `npm run lint` is unreliable in this environment

Not a repository fault: a local command proxy intercepts `biome` output and tries to parse it
as ESLint JSON. `./node_modules/.bin/biome check .` is clean. CI is unaffected.

### D5 — No release profile tuning verified

`profile.release` sets `opt-level = "z"`, `lto`, `panic = "abort"`. Never actually built in
release, so the settings are untested against the Tauri build.

---

## 4. Architecture found, and what it implies

```
UI (React)  ──IPC──▶  Tauri commands  ──▶  encastra-core  ──▶  capability broker  ──▶  OS
                                              │
                                              └──▶  encastra-builtins (Tier A components)
```

The layering the directive asks for already exists, and the broker is already the single
chokepoint. Two consequences for this build:

1. **A trigger belongs in the application layer, not the executor.** The runtime's contract is
   "validate a DAG, run it once, journal it". A watcher that fires repeatedly should call that
   contract once per event rather than change it. This keeps the executor's semantics — and its
   99 tests — intact, and reuses the seeded-input concept that already exists for entry nodes.

2. **Live progress needs an event channel, not a return value.** The journal is the record of a
   finished run. Progress is a stream. These are different things and conflating them would
   make the journal mutable, which would break the debugger's guarantee that what it shows is
   what happened.

---

## 5. Risks

| Risk | Mitigation taken |
|---|---|
| Image codecs are a large dependency surface and a classic source of memory-safety bugs | Use the pure-Rust `image` crate, cap input dimensions and decoded size before decoding, and treat a decode failure as an ordinary component error |
| A folder watcher can fire thousands of times (a file copied in chunks) | Debounce, and refuse to start a second run for a path already in flight |
| Running a workflow per event can pile up unbounded work | One run at a time per session, with a bounded queue and a visible count |
| `panic = "abort"` in release turns a component panic into a dead application | Catch unwinding is unavailable under `abort`; instead, Tier A components must not panic, and the release profile keeps `abort` for size — revisited below |
| Release build untested | Build it early rather than at the end |

---

## 6. Decisions taken for this build

- **`panic = "abort"` removed from the release profile.** A first-party component that panics
  would take the whole application down with it, and the runtime already treats a component
  failure as an ordinary, recoverable outcome. The binary is slightly larger; the application
  survives a bug in one node.
- **Triggers live in a session layer** (`encastra-core::session`), above the executor.
- **Progress is emitted as events**, and the journal remains the immutable record.
- **Image work uses the `image` crate** with explicit limits, not a shell-out to an external
  binary — no process capability exists, and adding one for this would be the wrong trade.
- **The desktop app gains navigation**, because a single screen cannot hold Home, projects,
  components, security and settings without becoming the "dashboard with cards" the brief
  rejects.

---

## 7. What this session builds, in order

1. Fix D1 and D2 so the rest of the work is actually checked.
2. Image components + `file.write` that accepts bytes, closing the `decode-image` gap (D3).
3. Trigger/session model + `file.watch`.
4. Live execution events, node states, Stop.
5. The remaining core components.
6. Application shell: Home, Projects, Components, Security, Settings.
7. Canvas editing: undo/redo, clipboard, duplicate, select-all.
8. Demo projects that use the real runtime.
9. Security hardening pass and tests.
10. Release build, installer, local installation.

The checkpoint in §53 of the directive — watch a folder, resize an image, save it, see
success — is the gate. Nothing secondary ships before it works.

---

## 8. Second pass — what a documentation review found in the finished build

The build was audited a second time, by reading the shipped documents against the code they
describe. Six findings were code defects rather than documentation ones. All are fixed; each is
recorded here with what was actually wrong, because "documentation was out of date" and "the
product does not work" looked identical from the outside in at least one case.

### 8.1 The consent UI could not grant two of the three scoped capabilities — **blocking**

`Inspector.tsx` built a scoped grant for `fs.write` and nothing else. Every other capability
fell through to a bare allow, which reaches the broker as `GrantScope::Allowed`. For `net.http`
the broker reads that as *no permitted hosts*, and for `fs.read` as *no readable folders* —
because an unconfigured allow-list is never "everything".

Nothing was exposed: it failed closed, which is the right direction. But it meant **Watch Folder
and HTTP Request could not be used from the editor at all**, and Watch Folder is the first node
of the checkpoint workflow. The runtime supported it, the command line supported it, and the
one surface a person would actually use did not.

The panel now renders a control per grant shape: a folder for `fs.read` and `fs.write`, the host
for `net.http`, taken from the address already typed on the node, and a plain allow for the
capabilities that have nothing to scope. The Tauri command already mapped `folder` and `hosts`
onto the right `GrantScope`; only the editor never sent them.

### 8.2 A trigger made its file reachable by every node downstream of it — **narrowed**

A watcher emits the file, its name and its extension from one event. The executor seeded
reachability for the handle to *every* node the trigger had an edge to, regardless of which port
that edge came from — so a node wired only to the name was given reach over the file.

Not exploitable today: values travel along edges, so a node wired to the name never receives the
handle, and every component in the build is first-party. It was still wider than the graph the
person drew, which is the only thing reachability is supposed to mean. Seeding is now filtered
by the edge's source port.

`a_step_wired_to_the_name_cannot_read_the_file` pins it. The test was checked by reverting the
fix and confirming it fails — a gate that passes against the bug it is meant to catch is not a
gate.

### 8.3 The command line could not express two thirds of the permission model

`--allow-write` and `--allow-notify` existed; `fs.read`, `net.http` and `system.clipboard` had no
flag. A headless run therefore could not do what the same runtime does under the UI, which
undermines the reason the CLI exists — being the version of "it works" somebody else can check.
Added `--allow-read`, `--allow-http` and `--allow-clipboard`, each naming a single node.

### 8.4 Three places claimed the run journal is written to disk. Nothing writes one

`Security.tsx` told people so on the privacy screen, and two source comments and `RUNTIME.md`
repeated it. The rule those comments justify — summaries, never contents — is right and unchanged.
The reason was restated honestly: a journal is the obvious thing to persist, export or paste into
a bug report, and a format holding file contents could not be given those abilities later.

### 8.5 The release manifest looked for a binary that is never produced

`release_manifest.py` hashed `target/release/Encastra.exe`. Cargo names the executable after the
crate, so the real path is `encastra-desktop.exe`. The script found the installer and silently
omitted the binary rather than failing, which is the worst shape for a verification tool.

### 8.6 The editor's host parser was stricter than the runtime's

The new consent UI reads the host out of the address to know what to ask permission for, which
makes it a second parser for a string the runtime already parses. It rejected an upper-case
scheme that the runtime accepts, leaving the Allow button dead for a working address.

Two parsers for one string is a smell, and the mitigation is the direction it fails in: the grant
stores exactly what the editor computed and the runtime compares its own reading for equality, so
a disagreement costs a refused request rather than an unintended reach. `hostOf` now lives in
`apps/desktop/src/url.ts` with tests covering credentials in the address, a path that tries to
smuggle a second host, ports, case, and the empty cases.

### 8.7 The canvas cannot be reached without a mouse — **open, not fixed**

Found by trying to drive the installed application from the keyboard. Tabbing through the editor
goes sidebar → toolbar → palette, and then wraps to the beginning. The nodes on the canvas are
never visited, so a step cannot be selected without a mouse, and a step that cannot be selected
cannot be configured: its folder, its settings and its permission prompt all live in the
inspector, which only opens for a selected step.

The consequence is not a degraded experience. It is that somebody who cannot use a mouse cannot
use the product at all.

`nodesFocusable` is set on the React Flow instance and does not produce tabbable nodes, so this
needs a real investigation rather than another prop. `onSelectionChange` is now wired, which is
correct on its own merits — the inspector should follow the selection rather than the click that
usually causes one — and it is what a fix would build on, because once a node can be focused and
selected the inspector will already follow. **It does not fix this, and nothing in the build
should be read as claiming it does.**

Two things are worth separating here:

- **The product defect**, above. Real, open, and the most serious thing outstanding in the
  editor.
- **A limit of how this beta was checked**, which is not a defect: synthetic mouse clicks do not
  activate controls in this WebView2 — the cursor moves and hover states appear, but neither
  `mouse_event` nor `SendInput` causes activation, while synthetic keystrokes work normally.
  So the end-to-end checkpoint could not be driven through the interface automatically, and it
  could not be driven by keyboard either, for the reason above. What the checkpoint's automated
  test proves it proves against the real runtime; what it does not prove is the hand-driven
  path through the editor. See RELEASE.md for exactly which claims rest on which evidence.
