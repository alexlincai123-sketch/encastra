# ADR-0001 — WebAssembly Component Model (WASI 0.2) for third-party components

**Status:** accepted · 2026-09-11

## Context

Third parties will publish components that run on users' machines. If a component can execute
arbitrary native code with the user's privileges, the product is unshippable no matter how
good the review process is. Review, scanning and reputation are defence in depth; they are not
a boundary.

We need a boundary where a component starts with **no authority** and receives only what the
user granted.

## Decision

Third-party components are **WebAssembly components** targeting **WASI 0.2 (preview 2)**,
executed by **`wasmtime` 48.x** (an LTS line) embedded in the Rust host.

Supporting choices:

- **Target p2, not p3.** WASI 0.3 shipped in June 2026 and Wasmtime enables it by default from
  46, but Rust guests for `wasm32-wasip3` are still Tier 3 on stable. p2 components keep
  running on p3 hosts, so p2 is the compatible choice and p3 is a later migration, not a
  rewrite.
- **Build with `cargo build --target wasm32-wasip2`**, which emits a component directly.
  `cargo-component` is *not* used: the Bytecode Alliance is deprecating it and it has had no
  commits since July 2025.
- Pin `wit-bindgen` exactly — it is pre-1.0 with monthly breaking minors.

## Alternatives rejected

| Option | Why not |
|---|---|
| Native dynamic libraries | Full process authority. Not fixable by any amount of care. |
| Child process + OS sandbox (AppContainer / seatbelt / bubblewrap) | Three partially-documented sandboxes; the weakest is the one we test least. Retained as a *future* option for heavy native tools that cannot be Wasm. |
| JavaScript isolate / VM sandbox | Escapes are a recurring class, and it forces every author into one language. |
| Review submissions and hope | Not a boundary. |

## Consequences

**Good.** No ambient authority by construction. Language-agnostic for authors. `wasmtime` gives
us the enforcement knobs a runtime needs: epoch interruption for timeouts, fuel for
determinism, `ResourceLimiter` for memory ceilings.

**Costs, accepted.** A boundary-crossing cost (mitigated by [ADR-0004](0004-handle-based-media.md),
which keeps bulk data off the wire). No threads in WASI 0.2. JS and Python toolchains are
usable but immature — Rust is the first-class SDK language, JS second with a pinned wrapper,
Python experimental.

**Risk we carry.** A `wasmtime` sandbox escape defeats this. Two filesystem escapes were
patched in 2026, one at CVSS 8.8 (`GHSA-vqjp-4c8c-hfgg`). Mitigations: stay current on patch
releases, and — importantly — **do not depend on WASI's own filesystem sandbox as the boundary**.
Components get no preopened directory at all; they get host-mediated handles
([ADR-0004](0004-handle-based-media.md)). Both CVEs required a preopened directory to exploit.
