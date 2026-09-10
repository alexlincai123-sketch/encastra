# ADR-0010 — Dependency versions: current stable, pinned, and few

**Status:** accepted · 2026-09-11

## Context

"Use the latest" and "use what I know" are both wrong. Versions were chosen from a
verification pass against npm, crates.io and official release notes on 11 Sept 2026, not from
memory.

## Policy

1. **Current stable, not newest.** A release days old goes in only if nothing in the tree
   depends on the ecosystem around it.
2. **Pin exact where the project ships fast breaking minors** — anything pre-1.0
   (`wit-bindgen`, `rusqlite`, `componentize-*`), and `zod`, which shipped two patches inside
   26 hours.
3. **Before adding a dependency**, four questions: is it maintained (commits and *distinct*
   authors, not release count); is the licence compatible; is there a known advisory; could we
   write it in an afternoon. A wrapper around three lines of standard library is a liability.
4. **`cargo deny` and `npm audit` run in CI**, and an advisory fails the build rather than
   filing a ticket nobody reads.

## Choices worth recording

| Choice | Reasoning |
|---|---|
| **TypeScript 7.0.2** | Current stable major. Nothing in this toolchain consumes the TypeScript compiler API — Biome and Vitest do not — so the usual "ecosystem lag" objection does not apply here. Verified empirically: the build and tests pass on it. Fallback to `^5.9` is a one-line change if it bites. |
| **Vitest 4.1.11**, not 5.0.0 | 5.0.0 was eight days old and changes mock-clearing defaults. No feature in it is needed. |
| **Biome**, not ESLint + Prettier | One tool, one config, actively released. Prettier's v4 alpha has been untouched for ten months. |
| **wasmtime 48.x** | An LTS line (24-month support), not merely the newest. |
| **Fastify 5.x** for the API | The only minimal Node framework closing more issues than it opens, with genuine co-maintainership. Hono only if edge deployment becomes a requirement; NestJS is not minimal. |
| **Next.js 16.3.4** | Adopted knowing 17 lands around October — majors are annual and predictable, so the upgrade is scheduled work, not a surprise. |
| **`keyring` 4.2.0** | Still the answer for OS-native secret storage. Note v4 is an architectural break onto `keyring-core`, and the repository moved to `open-source-cooperative/keyring-rs`. |
| **`ed25519-dalek` 3.0.0** | BSD-3-Clause, which differs from the rest of the tree — noted for the third-party licence file. |

## Deliberate non-adoptions

- **`cargo-component`** — being deprecated by the Bytecode Alliance, no commits since July
  2025. The native `wasm32-wasip2` target replaces it.
- **WASI 0.3 / p3** — shipped, and Wasmtime enables it by default from 46, but Rust guests are
  still Tier 3 on stable. p2 components run on p3 hosts, so p2 is the compatible choice.
- **`componentize-js` as an unwrapped public SDK path** — self-described experimental,
  mid-rewrite, and it promises incompatible changes without a semver-major bump. JavaScript
  will be the highest-volume plugin language and has the least stable build path, so we ship a
  pinned wrapper and authors never invoke a floating version directly.

## Review cadence

Quarterly, and immediately on any advisory. Every entry above records *why*, so a future
upgrade is a decision with context rather than an archaeology exercise.
