# PRODUCT ROADMAP

> Ordering principle, applied whenever two items compete:
> **works > fast > beautiful > scalable.** A broken feature ranks below a missing one.

---

## Phase map

| Phase | Outcome | Status |
|---|---|---|
| 0 | Research, architecture, threat model, protocol spec | ✅ done |
| 1 | Monorepo, tooling, CI skeleton | ✅ done |
| 2 | Design system + visual language | ⬜ |
| 3 | Desktop shell (Tauri) boots and holds a window | ⬜ |
| 4 | Component engine: manifest → registry → instantiation | 🔨 manifests, validation and a local registry work; installing from a registry service does not exist |
| 5 | Canvas: place, connect, type-check, save | ⬜ |
| 6 | Runtime: RUN / STOP, journal, debugger | 🔨 executes a validated graph and writes a journal, sequentially; STOP is cooperative, concurrency and preemptive timeouts are not built |
| 7 | Projects + native versioning | ⬜ |
| 8 | Capability broker + consent UI + Security Center | 🔨 the broker enforces and audits; there is no UI to grant anything, so grants are assembled in code |
| 9 | Component SDK + CLI + first Wasm component end-to-end | ⬜ |
| 10 | Backend: auth, users, projects, registry | ⬜ |
| 11 | Community | ⬜ |
| 12 | Marketplace (listings, no money movement) | ⬜ |
| 13 | Payments (sandbox only) | ⬜ |
| 14 | Website + landing narrative | ⬜ |
| 15 | Docs + tutorials | ⬜ |
| 16 | Installer + signed updates | ⬜ |
| 17 | Test hardening | ⬜ |
| 18 | Performance + security audit pass | ⬜ |
| 19 | Production readiness review | ⬜ |

Phases 8 and 17 are not "later" in practice — the capability broker lands with the runtime in
Phase 6, and tests land with each phase. They are listed separately because they each get a
dedicated hardening pass at that point.

---

## The MVP, stated as one sentence

> A user downloads an installer, opens the app, drags three components onto a canvas, connects
> them, presses RUN, watches it execute, and — when a node fails — clicks it and sees exactly
> what went in, what came out, and why it stopped.

Everything that does not serve that sentence is after the MVP.

### In the MVP

**Desktop:** projects (create/open/save/export `.encastra`) · canvas (place, connect, multi-select,
copy/paste, undo/redo, group, zoom/pan, minimap, snapping) · type-checked connections ·
~20 core components · runtime with RUN/STOP · run journal + node debugger · capability consent ·
Security Center · native versioning (create/restore/compare) · settings · update architecture
(not yet a signed public channel).

**Web:** landing with the assembly narrative · features · how it works · component catalogue
(indexable per component) · pricing · security · docs · tutorials scaffold · download page with
checksums · simulated terminal · legal drafts.

**Backend:** auth (+MFA) · users · projects · component registry (publish/verify/install/revoke)
· plans · admin plane. Marketplace listing model exists; **money movement does not**.

### Explicitly *not* in the MVP

Real payments · cloud sync · team workspaces · branches/merge · remote execution · component
certification · private registries · plugin marketplace analytics · mobile anything · AI.

---

## Phase detail (near-term)

### Phase 1 — Monorepo and tooling
npm workspaces, TypeScript project references, Biome, Vitest, Cargo workspace, CI running lint
+ typecheck + tests + `cargo deny` on every push. **Exit:** a fresh clone reaches green with two
commands.

### Phase 2 — Design system
Tokens (colour, type scale, spacing, motion, elevation) as the single source for both app and
web. Dark-first, light supported. Core primitives. `prefers-reduced-motion` respected at the
token layer so it cannot be forgotten per-component. **Exit:** the palette and primitives render
in a storybook-style page and pass contrast checks.

### Phase 3 — Desktop shell
Tauri 2 window, IPC surface, navigation, SQLite schema + migrations, crash-safe writes.
**Exit:** app starts in < 1.5 s and survives a kill mid-write without database corruption.

### Phase 4 — Component engine
Manifest parse/validate/canonicalise, local registry index, capability declaration parsing,
core-component trait, first three core components. **Exit:** a component is discovered,
validated, shown in the palette, and instantiated with config.

### Phase 5 — Canvas
React Flow substrate, custom node/edge rendering, type-checked connections driven by the shared
type table, selection/clipboard/undo, save/load round-trip. **Exit:** a graph survives
save → close → open byte-identically, and an illegal connection is impossible to make.

### Phase 6 — Runtime + debugger
Validation, topological scheduling, execution with limits, journal, live node state on the
canvas, per-node inspector. **Exit:** the Video Processor demo runs end-to-end locally, and a
deliberately-failed node shows input, output, error, duration, capabilities used, and logs.

---

## Demo projects (they are also fixtures)

The three demos double as end-to-end test fixtures — they are not screenshots.

1. **Video Processor** — watch folder → info → convert → thumbnail → save → notify
2. **Image Pipeline** — image → resize → compress → watermark → export
3. **File Organizer** — watch → classify by type → route to folder (branching)

---

## Component set for v1 (~20, all first-party)

`file.watch` `file.read` `file.write` `file.move` `file.rename`
`image.resize` `image.convert` `image.thumbnail` `image.watermark` `video.info`
`system.notify` `system.clipboard` `system.timer`
`net.http` `net.webhook`
`data.json` `data.csv.read` `data.csv.write` `data.sqlite`
`flow.if` `flow.switch` `flow.loop` `flow.delay`

`system.launch-application` is **deliberately postponed**: process execution is the capability
with the worst blast radius, and it should not be in the set that establishes the permission
UX. It returns when the consent flow has been through a security pass.

---

## Beyond v1

**Next:** branches/merge · cloud sync · teams · real payments · Wasm SDK for other languages ·
component analytics for creators.
**Later:** certification and verified creators · private/enterprise registries · remote
runtimes · app→component promotion (a project published as a single reusable node — the loop
that closes the ecosystem).

---

## What would make this fail

Named so they can be watched, not so they can be admired:

1. **The sandbox is bypassed or made optional under delivery pressure.** The moment a native
   third-party plugin escape hatch exists, the security story is gone and cannot be recovered.
2. **The canvas is impressive and the runtime is a demo.** Reversing that order later is a
   rewrite.
3. **Reproducibility is dropped as "too strict".** Projects that break silently on someone
   else's machine end the sharing loop, which is the entire network effect.
4. **Second runtime appears in TypeScript** "just for previews", and drifts from the Rust one.
5. **Component count is used as a success metric.** Twenty that work beats two hundred that
   mostly do.
