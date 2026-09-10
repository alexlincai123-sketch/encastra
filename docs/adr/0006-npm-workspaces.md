# ADR-0006 — npm workspaces, and no monorepo framework until one earns its place

**Status:** accepted · 2026-09-11

## Context

The repository holds a desktop app, a website, an admin app, several TypeScript packages, a
Cargo workspace and a backend. That shape usually attracts pnpm + Turborepo or Nx on day one.

## Decision

**npm workspaces** with TypeScript project references, and nothing else. Cargo has its own
workspace. Task running is npm scripts.

Turborepo, Nx and pnpm are all reasonable tools. They are also four more moving parts, a
second lockfile format, and a caching layer to debug — before there is a build slow enough to
need caching. The product requirement is explicit that the initial architecture should be
small, and a build tool adopted "because monorepo" is the cheapest possible example of the
thing to avoid.

## Reversal criteria — written down now so the decision is not sentimental

Adopt Turborepo when **either**:

- a clean `npm run check` exceeds ~90 seconds locally, or
- CI spends more than ~5 minutes rebuilding packages that did not change.

Adopt pnpm if `node_modules` duplication becomes a measured problem (disk, or install time in
CI beyond ~60 s). Nx is not planned: it ships roughly two majors a year against Turborepo's
one in two, and churn is the cost we are trying not to pay.

## Consequences

No remote caching and no task graph — acceptable at the current size. Cross-package types work
through project references, which `tsc --build` already understands. Vite and Next resolve
workspace packages natively.

One real edge: npm workspaces hoist, so a package can import a dependency it never declared
and still work locally, then fail when published. The lint step guards against undeclared
imports, and every package declares what it uses.
