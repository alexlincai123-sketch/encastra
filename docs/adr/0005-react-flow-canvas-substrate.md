# ADR-0005 — React Flow as the canvas substrate, with an entirely custom visual language

**Status:** accepted · 2026-09-11

## Context

The editor needs pan, zoom, selection, marquee, a minimap, edge routing, drag handles,
viewport virtualisation and keyboard interaction. All of that is solved, tedious, and full of
edge cases that take months to find (trackpad momentum, high-DPI, touch, undo during a drag).

But the product must not look like the other node editors, and one of them — n8n — is built on
the same library. That is a real concern to address, not to wave away.

## Decision

Use **`@xyflow/react` 12.x** (MIT) as the canvas *substrate*. Build our own:

- node rendering, port rendering, and every piece of the visual language
- edge rendering, including how a coercion is shown on an edge
- connection validation, driven by the shared type table
  ([ADR-0003](0003-one-runtime-shared-type-table.md))
- execution state overlay, selection chrome, grouping, and inspector

The library provides the viewport and the interaction plumbing. It provides no pixels the user
sees.

## Why the n8n resemblance is not an argument against it

Visual identity comes from node design, typography, colour, spacing, motion and edge
rendering — all of which are ours. React Flow is not visible in the output any more than
React itself is. Writing a viewport from scratch would spend months to arrive at the same
interaction model, worse, and would not change how the product looks by a single pixel.

## Alternatives rejected

| Option | Why not |
|---|---|
| Custom canvas/WebGL renderer | Months of work before the first node appears; loses DOM accessibility and text rendering. Revisit only if profiling shows the DOM is the bottleneck at our node-count target. |
| Rete.js / LiteGraph | Opinionated visuals and node models that would have to be fought rather than styled. |
| Svelte Flow | Same library family, but the app is React. |

## Consequences

We take a dependency on a library we do not control. It is MIT, widely used, and its viewport
API is small — the parts we depend on are `<ReactFlow>`, node/edge types, and the viewport
hooks, which is a shallow enough surface that replacing it later would be a rewrite of the
canvas shell rather than of the editor.

Performance target (300 nodes at ≥ 55 fps) will use `onlyRenderVisibleElements`, memoised node
components, and a store that does not re-render the graph on every viewport change. If that
target cannot be met, the fallback is a custom renderer for nodes inside React Flow's
viewport — not a full rewrite.

**Accessibility is ours to add:** a node editor is not keyboard-navigable by default, and the
product requires it. Keyboard placement, port-to-port connection without a pointer, and a
focus model are canvas work items, not library features.
