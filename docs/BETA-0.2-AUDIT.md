# BETA 0.2 — audit before anything is changed

What is actually here on 2026-09-11, measured rather than remembered, before a line of 0.2 work
is written. Everything below was produced by running the thing, not by reading the last report.

Starting point: `1621f65`, version `0.1.0-beta.1`, installed on this machine at
`%LOCALAPPDATA%\Encastra\`.

---

## 1. The gate, run first

| Check | Command | Result |
|---|---|---|
| Lint | `biome check .` | **pass** |
| Types | `npm run typecheck` | **pass** |
| TypeScript tests | `vitest run` | **35 passed** |
| Rust format | `cargo fmt --all --check` | **pass** |
| Rust lint | `cargo clippy --workspace --all-targets -- -D warnings` | **pass** |
| Rust tests | `cargo test --workspace` | **127 passed**, 17 suites |

Nothing is red. The engine is not the problem, and none of the work below is allowed to make
any of these red.

---

## 2. What genuinely works

Verified by tests, by the CLI, and by opening the installed application.

- **Type system.** One rule table (`type-graph.json`), a TypeScript reader and a Rust reader,
  and a generated conformance matrix replayed by a Rust test so the two cannot drift apart.
- **Component protocol.** JSON manifests, validation, canonical form, digest.
- **Runtime.** Validation, execution order, conversions on edges, a run journal, triggers and
  sessions. Sequential by design.
- **Capability broker.** Handles rather than paths, grants per node, every request recorded
  allowed-or-refused. Refusals were exercised live: no grant → refused; wrong host granted →
  refused; right host granted → the request proceeds.
- **19 components + 2 triggers**, counted from the manifests rather than from a document.
- **Project format.** Deterministic `.encastra` ZIP, atomic save, non-destructive version
  history.
- **CLI.** The same runtime, headless, with the whole permission model expressible.
- **Desktop shell.** Five views, a canvas that renders a real graph with typed ports and
  wires, a palette, an inspector that doubles as the debugger.
- **Installer.** NSIS, per user, no administrator. Installs, runs, reports its version from
  the build.
- **The checkpoint.** Watch a folder → resize → save, as an automated test against the real
  runtime: a real 800×400 PNG in, a real 200×100 PNG out.

**This is a working engine with an interface attached. That is exactly the problem 0.2 has to
solve.**

---

## 3. What is missing, incomplete, or wrong

### 3.1 There is no website at all

`apps/web/` exists and is **empty**. Nothing explains the product to anybody who has not read
the source. For a product whose entire pitch is "assembling software is easier than writing
it", having no way to show that is the single largest gap.

### 3.2 Nothing teaches the product

- **No onboarding.** A new person opens the application to a Home screen with three cards and
  no idea what a component is, what a port is, or why a connection would be refused.
- **No tutorials**, anywhere, in any form.
- **Documentation is written for the person who built it.** `RUNTIME.md`, `SECURITY.md` and
  `COMPONENT-SDK.md` are good, and they are reference material for engineers. There is no
  "what is this and how do I use it" for anybody else.

### 3.3 Settings is a technical panel, not a settings screen

115 lines, one flat column: theme, three lines of prose about data, an About block. No
navigation, no categories, no grouping, no controls beyond a theme toggle. Nothing that a
person would recognise as the settings of a real application. It is the clearest place where
the product reads as a prototype.

### 3.4 The canvas cannot be reached without a mouse — **open defect**

Carried over from `AUDIT.md §8.7` and still true. Tabbing goes sidebar → toolbar → palette and
then wraps; the nodes are never visited. A step that cannot be selected cannot be configured,
because its folder, its settings and its permission prompt all live in the inspector.

This is not a rough edge. Somebody who cannot use a mouse cannot use the product. It is the
most serious defect in the build and 0.2 has to fix it.

### 3.5 The interface does not explain itself

- **Empty states state a fact and stop.** "Nothing here yet" tells somebody what they can
  already see.
- **A refused connection is silent.** React Flow simply will not complete the drag. The
  editor knows exactly why — the type rule table is right there — and says nothing.
- **Permissions appear as a capability id.** `fs.write` and a sentence of reason. No statement
  of what the component will *not* be able to reach, which is the more reassuring half.
- **A run is nearly invisible.** Node states update, but there is no execution panel, no
  per-node timing anybody can read, no sense that something is happening.

### 3.6 Version lives in six places

`Cargo.toml`, root `package.json`, `apps/desktop/package.json`, `packages/protocol/package.json`,
`packages/ui/package.json`, `tauri.conf.json`. They agree today because they were edited
together. Nothing enforces it, so the first release where somebody misses one ships an
installer whose About screen disagrees with its filename.

### 3.7 Accessibility beyond the canvas

Focus rings exist and keyboard navigation works in the shell — verified by driving the
installed application entirely from the keyboard. What is missing: ARIA roles on the canvas,
labels on icon-only controls, and any statement of contrast targets.

### 3.8 Directories that exist and are empty

`apps/admin`, `components`, `security`, `services/api`, `packages/sdk`, `packages/types`,
`packages/project-format`, `crates/encastra-host`, `tests`. They read as a plan, not a build.
Either they get content or they get removed; an empty directory that looks like a subsystem is
a small lie about the shape of the project.

---

## 4. Security posture going in

Unchanged and stated plainly, because 0.2 adds a website and must not weaken any of it.

- **Reviewed, not audited.** No external security review has happened.
- **Not signed.** SmartScreen warns, and the warning is accurate.
- **Third-party WebAssembly sandboxing is designed and not built.** No third-party component
  can be installed, which is the honest reason nothing is exposed by that gap.
- **The broker is the only code touching OS authority**, and both tiers are designed to go
  through it.

New risk introduced by this phase: **the interactive terminal on the website.** It must be an
animation, never an evaluator. No `eval`, no server-side execution, no visitor input reaching
anything that runs. That is a design constraint, not a to-do.

---

## 5. What 0.2 must deliver

In priority order, most important first.

1. **Fix the canvas keyboard hole.** Correctness and accessibility before polish.
2. **Website**, including the interactive terminal demo, because there is currently no way for
   anybody to find out what this is.
3. **Settings**, rebuilt as a navigated, categorised screen.
4. **Onboarding and first-run**, so the application teaches itself.
5. **Interface that explains**: empty states, connection feedback, permission dialogs that say
   what is *not* granted, a real execution panel.
6. **Documentation and tutorials for beginners**, with the first-workflow tutorial as the
   spine.
7. **One version, enforced by a test.**
8. **Build, installer, install, and verify by using it.**

## 6. What will not change

The runtime, the type system, the capability broker, the project format, the CLI and the
security model are working and are not being rewritten to make room for any of the above. Every
change in 0.2 is additive to them or is confined to the interface layer above them.
