# Encastra

**Build software from parts that actually fit.**

Encastra is a local-first runtime that executes a typed graph of sandboxed components, plus
the ecosystem around it: a visual editor, a component registry, an SDK, and a marketplace.

> *encastrar* (Spanish, from Latin *incastrare*) — to interlock or couple two pieces so that
> each holds the other.

---

## What it is, precisely

Three primitives, and everything else is a surface on top of them:

- **Component protocol** — what a piece *is*: a manifest, typed ports, declared capabilities,
  a signature.
- **Runtime** — what happens when you press RUN: scheduling, capability enforcement, resource
  limits, and a journal of exactly what each node did.
- **Project format** — what you save and share: a graph plus a lockfile that pins every
  component by content hash, so a project that ran yesterday runs today.

The interesting problem is not the canvas. It is that a stranger's component runs on your
machine. Encastra's answer is that third-party components have **no ambient authority at
all** — they execute as WebAssembly components with nothing but the capabilities you granted,
and they never see a filesystem path. See [ARCHITECTURE](docs/ARCHITECTURE.md) §2 and
[THREAT-MODEL](docs/THREAT-MODEL.md) T1.

**No AI in the runtime.** Workflows execute without a model in the loop, by design.

---

## Status

**Beta 0.1.0-beta.1.** A desktop application that builds and runs workflows on this machine.

| Piece | State |
|---|---|
| Component protocol — manifests, validation, canonical form, digest | working |
| Type system — one rule table, TypeScript + Rust readers, conformance gate | working, cross-checked |
| Runtime — validation, execution, journal, conversions | working, sequential |
| Capability broker — handles, grants, refusals, audit trail | working |
| Triggers and sessions — watch a folder, run per event, stop | working |
| 19 components + 2 triggers | working |
| Image work — resize, convert, thumbnail, info, with decode limits | working |
| Desktop application — canvas, palette, debugger, consent, navigation | working |
| Projects — `.encastra` files, save/open, version history, restore | working |
| CLI — same runtime, headless | working |
| **Third-party components (WebAssembly sandbox)** | **not built** — designed and documented only |
| **Registry, marketplace, accounts, updates, website** | **not built** |

The checkpoint this beta had to pass, and does:

> Watch a folder. Drop an 800×400 PNG into it. A 200×100 copy appears in another folder,
> and nothing was written anywhere that was not explicitly allowed.

That is a test (`crates/encastra-builtins/tests/image_processor.rs`), not a screenshot.

```console
$ cd examples/json-report
$ cargo run -p encastra-cli -- run graph.json --input read.file=./data.json
ok   read  (encastra.file.read@1.0.0) 0ms
       -> name: text (9 characters)
       -> text: text (62 characters)
ok   parse  (encastra.data.json@1.0.0) 0ms
       -> json: json (3 fields)
FAIL write  (encastra.file.write@1.0.0) 0ms
       denied: This component tried to use fs.write and was not allowed: no folder has been allowed for this node.
       Grant this component access to a folder, then run again.
       1 capability call(s) refused
skip notify  (encastra.system.notify@1.0.0)
       because "write" did not finish

Finished with 1 failure(s). The rest of the graph still ran. in 1ms
```

That refusal is the product working, not failing: a first-party component asked to write
somewhere nobody had allowed, and the broker said no. Add `--allow-write write=./out` and the
file appears.

## Getting started

Requires **Node ≥ 22** and the **Rust toolchain** pinned in `rust-toolchain.toml`. On Windows,
Rust needs the MSVC linker — the Visual Studio Build Tools "Desktop development with C++"
workload. The GNU toolchain is not a supported alternative
([ADR-0009](docs/adr/0009-windows-msvc-toolchain.md)).

```bash
npm install
npm run check        # lint + typecheck + tests (TypeScript)
cargo test --workspace   # tests (Rust), including the cross-language conformance gate
```

---

## Layout

```
apps/desktop      Tauri 2 + React editor
apps/web          Next.js marketing and docs
apps/admin        moderation, advisories, revocation
packages/protocol component protocol: type system, manifest schema   ← the shared rules live here
packages/…        project-format · ui · types · sdk
crates/…          encastra-protocol · encastra-core · encastra-host · encastra-builtins
components/       the first-party component set
services/api      backend
docs/             architecture, threat model, roadmap, ADRs
```

### One rule worth knowing before you touch anything

`packages/protocol/data/type-graph.json` is the **only** place connection rules are written
down. The TypeScript editor and the Rust runtime both read it; neither reimplements it. A
generated matrix (`compat-matrix.json`) is replayed by a Rust test that fails the build if the
two sides ever disagree. If you find yourself adding `if (type === 'image')` to either
language, the rule belongs in the data file instead.

---

## Documentation

- [ARCHITECTURE](docs/ARCHITECTURE.md) — how it is built and why
- [THREAT-MODEL](docs/THREAT-MODEL.md) — what we defend, how, and what we knowingly do not
- [PRODUCT-ROADMAP](docs/PRODUCT-ROADMAP.md) — what ships when, and what would make this fail
- [BRANDING](docs/BRANDING.md) — the name, and its unresolved legal question
- [ADRs](docs/adr/) — the decisions, with the alternatives that lost

## Licence

Not yet determined. The repository is currently `UNLICENSED` — no rights are granted. The
licence is a launch decision, not a scaffolding decision.
