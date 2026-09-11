# TESTING

> Counts in this document were produced by running the suites, not by counting `#[test]`
> attributes. They will drift as the repository moves; the commands in §1 are the authority.

---

## 1. Running everything

```bash
npm install
npm run check            # biome + tsc --build + vitest        (TypeScript)
cargo test --workspace   # every Rust suite, including the conformance gate
```

The individual pieces, when one of them is what you want:

| Command | What it does |
|---|---|
| `npm run lint` | Biome over the whole repository |
| `npm run typecheck` | `tsc --build` for the packages, then the desktop app's own `tsc --noEmit` |
| `npm run test` | Vitest |
| `npx vitest` | the same, in watch mode |
| `cargo test --workspace` | the Rust suites |
| `cargo clippy --workspace --all-targets -- -D warnings` | the lint gate CI enforces |
| `cargo fmt --all --check` | formatting |
| `UPDATE_MATRIX=1 npx vitest run` | regenerate the conformance fixture — read §4 before you do this |

Rust needs the toolchain pinned in `rust-toolchain.toml` (1.98.1). On Windows it needs the MSVC
linker, and the GNU toolchain is not a supported alternative — the reasoning, and the exact
Build Tools components to install, are in
[ADR-0009](adr/0009-windows-msvc-toolchain.md).

---

## 2. What exists

**Rust: 126 tests across 17 suites.** Twelve of those are test binaries and five are doctest
runs; eight report zero — the `encastra-cli` binary, both `encastra-desktop` targets, and every
doctest run, since nothing in the tree has an executable example. The nine that matter:

| Suite | Tests | What it covers |
|---|---|---|
| `encastra-protocol` unit | 18 | type-expression parsing and formatting, compatibility rules, manifest parsing and validation, canonical form and digest |
| `encastra-protocol` `tests/conformance.rs` | 2 | the cross-language gate (§4) |
| `encastra-core` unit | 51 | the broker, conversions, the journal, media limits, values, the graph model, the registry, the session |
| `encastra-core` `tests/validate.rs` | 14 | graph validation end to end, against a fixture registry |
| `encastra-project` unit | 15 | the container, determinism, history and the graph diff |
| `encastra-project` `tests/on_disk.rs` | 7 | real files on a real filesystem (§6) |
| `encastra-builtins` unit | 8 | the first-party set as a set: manifests, implementations, capability surface |
| `encastra-builtins` `tests/end_to_end.rs` | 6 | a whole graph through the real runtime |
| `encastra-builtins` `tests/image_processor.rs` | 5 | the checkpoint (§3) |

**TypeScript: 27 tests across 2 files**, both in `packages/protocol/test` — `type-graph.test.ts`
(23) and `conformance-matrix.test.ts` (4).

`vitest.config.ts` includes `packages/*/test`, `apps/*/test` and `services/*/test`. The `apps/*`
entry was added because a test placed in the desktop app would otherwise never have run; there
are still none there. Tests time out at 10 seconds, because a hanging test is a failing test and
should not hold CI open.

---

## 3. The checkpoint

`crates/encastra-builtins/tests/image_processor.rs` is the test the product is judged by. It
builds a real graph — Watch Folder → Resize Image → Save File — grants the two permissions a
person would actually be asked for, writes a real PNG into a real folder, turns the session, and
asserts that a smaller real PNG appears in another folder with the right dimensions.

If it fails, the product does not work, whatever the interface looks like.

Around it sit four tests for the behaviours that make a watcher usable rather than merely
functional: the same file is not processed twice; a file of the wrong kind is ignored rather
than failing the workflow; a watcher pointed at a folder nobody allowed is refused; and stopping
a session ends it even with work waiting in the queue.

`tests/end_to_end.rs` does the same job for the one-shot path, including the two cases that are
easy to get wrong — a denied capability fails *that* node and is named as the reason the rest
stopped, and a graph that does not validate never runs at all, with nothing written to disk.

---

## 4. The cross-language conformance gate

The editor (TypeScript) and the runtime (Rust) each decide whether a connection is legal. Both
read `packages/protocol/data/type-graph.json`, but **reading the same data is not the same as
agreeing**: two implementations of the same rules drift, and the failure is silent and horrible
in both directions — the editor lets you build a graph the runtime refuses, or the editor forbids
something the runtime would happily have done.

So the gate has two halves.

**The TypeScript side writes down its answer.** `conformance-matrix.test.ts` asks
`checkCompatibility` about every ordered pair of every named type plus eight composite shapes —
`list<image>`, `option<string>`, `list<option<file>>` and so on — and serialises the verdicts,
kinds and operation lists to `packages/protocol/data/compat-matrix.json`. The test fails if the
committed file does not match what was just computed, so the fixture cannot go stale.

**The Rust side replays it.** `crates/encastra-protocol/tests/conformance.rs` embeds that file
with `include_str!` and asserts, for every entry, that this implementation agrees on legality, on
the coercion kind, and on the exact operations applied. Divergences are collected and reported
together rather than one per run.

Three further assertions guard the fixture itself: it must contain the full cartesian product of
the shapes it claims to cover; every type must connect to itself `direct` with no operations;
and **it must record at least one refusal**, so a rule change that accidentally made everything
connectable is caught rather than passing every other assertion. The Rust side separately
refuses a matrix with fewer than a hundred entries, which would mean it is not the generated one.

CI runs the regeneration and then `git diff --exit-code` on the fixture, so a rule change with an
unrefreshed matrix fails the TypeScript job before the Rust job gets to check a stale contract.

### The direction of the fix is not negotiable

**If the gate fails, the two implementations disagree. Fix the divergence.** Never regenerate the
fixture to make Rust happy — that converts a caught bug into a shipped one, and the whole point
of the mechanism is that it fails on the commit that caused it rather than surfacing as a
confusing bug report months later. `UPDATE_MATRIX=1` exists for one situation only: you changed
the rules *deliberately*, in the data file or in both readers' interpretation, and you now expect
the fixture to move. [ADR-0003](adr/0003-one-runtime-shared-type-table.md) records this.

### The other anti-drift tests

- `convert::tests::every_declared_operation_is_accounted_for` asserts that every operation the
  table declares is one `convert.rs` recognises, and — in the other direction — that every
  operation listed as pending is still declared, so the pending list cannot go stale.
- `value::tests::handle_kinds_round_trip_through_the_shared_type_names` asserts that every
  `HandleKind` maps to a name the type table actually knows, so a handle can never carry a type
  the editor has never heard of.
- `conformance::every_named_type_in_the_table_is_resolvable_here` catches the case where the
  JSON gains a type the Rust reader silently ignores.
- `type-graph.test.ts` checks the table's own internal consistency: no inheritance cycles, no
  coercion that merely duplicates plain widening, at most one coercion per ordered pair, and a
  note on every explicit coercion so the Convert node has something to show.

---

## 5. Hostile-input tests

These are correctness tests for the boundary. **If one starts passing where it used to fail, the
boundary is gone.**

### The broker (`crates/encastra-core/src/broker.rs`)

| Test | Asserts |
|---|---|
| `refuses_a_handle_the_graph_never_gave_this_node` | a handle that exists but was not wired is denied, and a forged id (`9999`) resolves to nothing |
| `a_component_that_did_not_declare_fs_read_cannot_read_even_a_connected_file` | Tier A goes through the same gate as everyone else |
| `a_component_cannot_relabel_a_handle_to_something_it_is_not` | claiming a text file is an image is refused, because the host's record of the kind is the one that counts |
| `only_the_host_can_reclassify_a_handle_and_only_after_checking` | promotion works, and the stale label stops working once it has |
| `host_read_is_not_a_back_door_into_a_component` | the host-side read hands a component nothing it did not already have |
| `every_denial_is_written_down` | a refusal is never the call that goes unlogged |
| `writing_outside_the_granted_folder_is_refused` | containment |
| `dot_dot_cannot_climb_out_of_a_granted_folder` | `..` resolves during canonicalisation, so containment is decided on the real path |
| `a_move_needs_permission_for_the_folder_it_deletes_from` | and the original still exists afterwards |
| `a_filename_cannot_smuggle_a_path` | `../../etc/passwd` → `etcpasswd`, `C:\Windows\system32\x` → `CWindowssystem32x`, empty → `output` |
| `an_empty_host_allowlist_means_no_hosts_not_all_hosts` | the difference between unconfigured and unrestricted |

### Media (`crates/encastra-core/src/media.rs`)

`refuses_a_declared_size_that_would_exhaust_memory` builds a decompression bomb by rewriting a
1×1 PNG's IHDR to claim 60,000 × 60,000 and asserts it is refused on the header, before anything
is allocated. `refuses_a_file_larger_than_the_limit_without_reading_it` and
`a_resize_cannot_be_used_to_create_a_bomb_either` cover the other two entry points, and
`refuses_something_that_is_not_an_image` asserts that plain text produces a readable error rather
than a panic.

### URLs (`crates/encastra-builtins/src/net.rs`)

`refuses_the_shapes_that_would_make_the_permission_check_a_lie` covers credentials in a URL, a
missing host, a scheme-less address, `ftp://` and `file:///etc/passwd`.
`a_path_that_looks_like_a_host_does_not_become_one` asserts that
`https://allowed.example/redirect?to=evil.example` checks permission against `allowed.example`.
`the_host_used_for_the_permission_check_is_the_real_one` pins case-folding and port stripping.

### Data that must not leak

`summaries_do_not_spill_user_data` puts a token-shaped string through `Value::summary()` and
asserts only its length comes out, while confirming that `preview()` — the memory-only one — does
show it. `a_long_setting_is_described_rather_than_printed_into_the_history` does the equivalent
for the version-history diff. `the_journal_never_contains_the_file_contents` asserts it for a
whole real run. `an_io_error_never_carries_a_path` constructs an error whose message is a home
directory path and asserts the rendered error does not contain it.

### Malformed files

`a_secret_value_can_never_reach_the_archive` hand-builds a `Variable` with a `value` field and
asserts it is refused rather than parsed with the field dropped.
`refuses_a_file_that_is_not_an_archive`, `a_truncated_file_is_refused_rather_than_half_read` and
`refuses_a_schema_it_does_not_implement` cover the container.
`refuses_unknown_fields_so_a_newer_file_is_not_silently_downgraded` covers the graph.
`descendants_terminates_even_if_the_graph_has_a_cycle` covers a traversal that validation should
never hand a cycle but which must not hang if something does.

---

## 6. Tests that touch the real filesystem

`crates/encastra-project/tests/on_disk.rs` and the builtins' two integration suites write real
files. They use a small self-cleaning temporary-directory helper defined in the test module
rather than a dependency, for eight lines of code.

What they check that an in-memory test cannot: that saving leaves no `.encastra-writing` file
behind; that a failed save leaves the previous file intact; that saving over an existing project
keeps its identity and its history; that restoring is non-destructive on a real chain; and — a
small but load-bearing one — that the output really is a ZIP anybody can open.

---

## 7. Continuous integration

`.github/workflows/ci.yml` runs four jobs on every pull request.

**TypeScript** (Ubuntu): lint, typecheck, tests, then the conformance-matrix freshness check
described in §4.

**Rust** (Ubuntu, Windows *and* macOS, `fail-fast: false`): `cargo fmt --check`,
`cargo clippy --workspace --all-targets -- -D warnings`, then `cargo test --workspace`. The
toolchain is pinned to the same 1.98.1 as `rust-toolchain.toml`; the pin is what makes builds
reproducible. `RUSTFLAGS: -D warnings` applies to the whole job.

**Supply chain**: `npm audit --audit-level=high` and `cargo deny check advisories bans licenses
sources`. An advisory fails the build rather than opening a ticket nobody reads.

**Secrets**: Gitleaks over the full history.

A new push to a branch cancels the previous run.

---

## 8. What is not covered

Stated here so nobody mistakes a green build for a complete one.

- **The Wasm sandbox.** There is no host, so there are no sandbox tests: no path-traversal
  fixture against a guest, no fuel exhaustion, no memory exhaustion, no handle forgery from
  inside a component. [THREAT-MODEL](THREAT-MODEL.md) §5 describes a "hostile component suite";
  what exists today is the *broker*-level equivalent in §5 above, which is a different and
  weaker thing — it tests the gate, not a hostile caller trying to get past it.
- **Signing, revocation and the registry.** Nothing to test yet.
- **The Tauri command layer.** `encastra-desktop` has zero tests. Every command in
  `apps/desktop/src-tauri/src/lib.rs` — including grant assembly, seeding and project
  save/open/restore — is exercised only by hand.
- **The editor.** No React component tests, no store tests, no end-to-end browser tests. The
  desktop app is covered by `tsc` and Biome and nothing else.
- **The HTTP component's network behaviour.** Its URL parsing is well covered; the redirect
  refusal, the response cap and the timeout are not exercised against a server.
- **The clipboard and notification components.** Both need a desktop session; neither has a test.
- **Performance.** [ARCHITECTURE](ARCHITECTURE.md) §9 sets budgets described as "to be measured
  in CI". Nothing measures them.
- **Concurrency.** Execution is sequential, so there is nothing to race — which also means there
  is no test that would catch a race when parallel execution arrives.
- **Property-based and fuzz testing.** None. The manifest parser, the type-expression parser and
  the image decoders are the obvious candidates.
- **Cross-platform behaviour beyond compilation.** CI runs the Rust suite on all three
  platforms, which is real coverage, but path-handling differences in the broker are exercised
  only incidentally by the tests that happen to touch the filesystem.
