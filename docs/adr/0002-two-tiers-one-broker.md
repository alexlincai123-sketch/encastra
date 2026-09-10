# ADR-0002 — Two component tiers behind a single capability broker

**Status:** accepted · 2026-09-11

## Context

Some components need native codecs, SQLite, and OS notifications; compiling all of that to
Wasm is slow, large, or impossible today. But every third-party component must be sandboxed
([ADR-0001](0001-wasm-component-model-for-third-party-code.md)).

## Decision

Two tiers:

- **Tier A — core components.** First-party, written in Rust, compiled into the host binary.
  Fast, native crates available. A closed set, kept deliberately small.
- **Tier B — sandboxed components.** Everything not first-party. A `.wasm` component run by
  `wasmtime`. There is no path for a third party to reach Tier A. No native plugin escape
  hatch will be added; if that appears, this ADR has been reversed and the security story is
  gone.

**Both tiers call the same capability broker, with the calling node's grant set.**

A core component that declares no network capability still cannot open a socket, because it
asks the broker and the broker refuses.

## Why route trusted code through the same gate

It costs a little performance and buys three things that are hard to get any other way:

1. **The permission UI never lies.** What the dialog says is what the enforcement point does,
   for every component on the canvas.
2. **The audit log and the debugger's "permissions used" panel are complete.** They are not
   "complete except for the built-ins".
3. **There is no second, weaker enforcement path to forget about.** A control that some code
   paths bypass is not a control — it is a control-shaped object.

Tier A is trusted to be *correct*, not trusted to be *unconstrained*.

## Consequences

Core components are part of the trust base: a bug in one is a bug in the trust base, which is
why the set stays small and is reviewed as security-relevant code. Confused-deputy attacks —
a sandboxed component tricking a core one into acting on its behalf — are structurally
addressed, because the broker authorises against the *calling node's* grants and not an
ambient privilege.

Capabilities that cannot yet be offered safely to third parties (process execution, raw device
access) simply do not exist in the Tier B world. They are absent, not denied.
