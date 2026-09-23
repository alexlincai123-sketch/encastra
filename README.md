# Encastra

**Build software from parts that actually fit.**

Encastra is a local-first runtime that executes a typed graph of components, with a visual
editor around it. The rest of the ecosystem — a sandbox for strangers' components, a registry,
an SDK, a marketplace — is designed and not built; the status table below says which is which.

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

The interesting problem is not the canvas. It is that one day a stranger's component would run
on your machine. Encastra's answer is designed and not yet built: third-party components would
have **no ambient authority at all** — WebAssembly components with nothing but the capabilities
you granted, never seeing a filesystem path. Today only first-party components run, and they go
through the same capability broker that would gate a stranger's. See
[ARCHITECTURE](docs/ARCHITECTURE.md) §2 and [THREAT-MODEL](docs/THREAT-MODEL.md) T1.

**No AI in the runtime.** Workflows execute without a model in the loop, by design.

---

## Status

**Beta.** The exact build, its hash and how to verify it are in [RELEASE](docs/RELEASE.md); the
version is set in one place (`Cargo.toml`, `[workspace.package]`) and copied everywhere else by
`scripts/version.py`. A desktop application that builds and runs workflows on this machine,
explains itself while you do it, and can hand a project to somebody else as a publication that
their copy checks again before taking in.

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
| CLI — same runtime, headless, the whole permission model | working |
| First run — welcome, and a guided first workflow that waits rather than drives | working |
| Settings — navigated and categorised, every control wired to something real | working |
| Keyboard — the canvas is reachable and navigable without a mouse | working |
| Website — what Encastra is, how it works, tutorials, download, the ecosystem and what of it exists | working, English and Spanish |
| Publish — a saved project reviewed for secrets, personal paths, unreadable components and licence conflicts, then written as a publication folder | working, offline, refuses rather than warns |
| Import — a publication folder verified, reviewed again on this machine, and copied into a local library without running | working, offline |
| Library — what is on this machine: created, imported, prepared; status by content hash | working, local only |
| **Third-party components (WebAssembly sandbox)** | **not built** — designed and documented only |
| **Registry, marketplace, accounts, signing, payments, updates** | **not built** — a publication travels as a folder a person carries |

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
packages/protocol component protocol: type system, manifest schema   ← the shared rules live here
packages/ui       design tokens
crates/           encastra-protocol · encastra-core · encastra-project · encastra-builtins
                  encastra-publish · encastra-library · encastra-cli
examples/         graphs the CLI runs
docs/             architecture, threat model, roadmap, ADRs
```

Not present, and not pretended to be: an `apps/admin`, a `services/api`, an `encastra-host`
crate for the WebAssembly sandbox, or a `components/` directory of third-party parts. The
first-party component set is `crates/encastra-builtins`. Each of the missing pieces is design
only — see [PLATFORM-ARCHITECTURE](docs/PLATFORM-ARCHITECTURE.md).

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

Proprietary. See [LICENSE](LICENSE). This repository is public so the source can be read and its
checks can run in the open — **that is not an open-source licence and not an offer of terms**. No
general right to copy, modify, redistribute or build derived works is granted; anything wider has
to be granted in writing. Third-party dependencies keep their own licences, listed in
[THIRD-PARTY](docs/THIRD-PARTY.md) with the attribution they require in [NOTICE](NOTICE). How the
choice was reached is in [LICENSING](docs/LICENSING.md).
