# ADR-0003 — One runtime, and one place where the type rules are written down

**Status:** accepted · 2026-09-11

## Context

Two things need to answer "may this connection exist?": the **editor**, live, as the user
drags an edge; and the **runtime**, at validation, before a run starts.

The obvious implementation — a TypeScript checker for the editor and a Rust checker for the
runtime — is a trap. Two implementations of the same rules drift, and the failure mode is
nasty in both directions: the editor permits a graph the runtime then refuses (the user built
something that cannot run), or the editor forbids something the runtime would have accepted
(a capability silently disappears). The drift is invisible until a user hits it.

The same trap applies to *execution*: a "preview" runtime in TypeScript would diverge from the
real one, and a workflow that behaves differently in preview than in production is worse than
having no preview.

## Decision

1. **One execution runtime**, in Rust (`crates/encastra-core`). The editor calls it over IPC.
   There is no second runtime, not even for previews.

2. **One rule table**: `packages/protocol/data/type-graph.json`. It declares every type, every
   inheritance edge, and every legal coercion with its kind. The TypeScript editor imports it;
   the Rust runtime embeds it with `include_str!`. Neither hardcodes a pair.

3. **A conformance gate.** The TypeScript implementation generates
   `packages/protocol/data/compat-matrix.json` — its verdict for every ordered pair of a fixed
   set of type expressions — and a Rust test replays that file and asserts the runtime agrees
   on legality, coercion kind, and the exact operations applied. A divergence fails the build
   on the commit that introduced it.

Reading the same data is necessary but not sufficient: the two readers still interpret it, and
interpretation is where drift lives. The gate is what makes the guarantee real.

## Consequences

Adding a type or a conversion is a data change plus a regenerated fixture — no logic in two
languages. Changing an *interpretation* rule (widening, option semantics, list mapping)
requires touching both readers, and the gate makes forgetting one of them a build failure
rather than a bug report.

The gate is only as good as its coverage: it checks the pairs in the generated matrix. The
matrix covers every named type and a set of composite shapes, and an assertion fails if it
ever contains no refusals at all — which would mean the rules had collapsed into "everything
connects" while every other assertion still passed.

**The direction of the fix is not negotiable.** If the gate fails, the two implementations
disagree; fix the divergence. Never regenerate the fixture to match Rust.
