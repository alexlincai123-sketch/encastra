# Fuzzing

Four libFuzzer targets, one per parser that reads input somebody else wrote.

| Target | Entry point | Why it is here |
|---|---|---|
| `project_from_bytes` | `encastra_project::Project::from_bytes` | The highest-value target in the repository. A `.encastra` file is the one artefact of this product that travels between people, and this is what a victim runs against a stranger's file. |
| `graph_parse` | `encastra_core::graph::Graph::parse` | The part of a project that decides what runs. Also where the node and edge ceilings are applied. |
| `manifest_parse` | `encastra_protocol::manifest::ComponentManifest::parse` | Ahead of the threat rather than behind it: manifests are compiled in today and will arrive from a registry when third-party components exist. |
| `permission_authority` | `encastra_builtins::permission_authority` | The address parser behind a `net.http` grant. Hand-rolled on purpose, which makes every odd string this code's problem rather than a library's. |

## Running them

`cargo-fuzz` needs a nightly toolchain and sanitiser support. This repository pins stable 1.98.1
(`rust-toolchain.toml`), so these do not run in CI and do not build with the default toolchain.

```sh
cargo install cargo-fuzz
rustup toolchain install nightly

# One target, until you stop it. Findings land in fuzz/artifacts/<target>/.
cargo +nightly fuzz run project_from_bytes

# A bounded run, which is what a nightly job would do.
cargo +nightly fuzz run project_from_bytes -- -max_total_time=900

# Reproduce a finding.
cargo +nightly fuzz run project_from_bytes fuzz/artifacts/project_from_bytes/crash-<hash>
```

`fuzz/` is its own workspace (the bare `[workspace]` in `fuzz/Cargo.toml` detaches it), so
`cargo build`, `cargo clippy` and `cargo deny` at the repository root never see `libfuzzer-sys`.

## The corpus

`fuzz/corpus/<target>/` holds committed seeds. A fuzzer started from nothing spends its first
hours rediscovering that a ZIP begins with `PK`; the seeds are the difference between exploring
the parser and exploring the first four bytes.

The project seeds are generated, and the command that generates them is a test:

```sh
UPDATE_FUZZ_CORPUS=1 cargo test -p encastra-project --test fuzz_smoke
```

The same test asserts the corpus exists and that at least one seed is a project that actually
opens — a corpus of only malformed inputs is one a fuzzer cannot mutate its way out of.

## What runs in CI instead

`crates/encastra-project/tests/fuzz_smoke.rs`: a deterministic mutational sweep over the same
entry points, on stable, in about a second. Fixed seed, fixed iteration count, so a failure
reproduces exactly on every machine.

It is a lesser thing than libFuzzer and is not a substitute for it. It will not find a rare input
after eight hours of coverage-guided search. It will notice the day somebody introduces a shape
that panics on the second byte, and it will keep noticing, for free, on every push.

`crates/encastra-builtins/tests/url_authority.rs` does the same for the address parser, and
additionally asserts properties of the *output* — that an authority is non-empty, lowercased, and
carries no path or userinfo — so a wrong answer fails and not only a crash.

## Rules for a target

* No network. No real filesystem writes outside a temporary directory. No secrets.
* Every target must be bounded: if an input can make one allocate without limit, that is the
  finding, not a reason to add a guard inside the target.
* Assert properties of the output where there are any worth asserting. A target that only checks
  for crashes finds only crashes.
