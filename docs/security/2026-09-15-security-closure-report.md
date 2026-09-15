# Security closure report — 2026-09-15

Third and final pass over Encastra's security posture for this release cycle. The first pass
([`../audits/2026-09-15-offensive-audit.md`](../audits/2026-09-15-offensive-audit.md)) found
twenty things. The second ([`../audits/2026-09-15-remediation.md`](../audits/2026-09-15-remediation.md))
closed what it could and found seven more. This one took the merged candidate, attacked it
again, integrated a parallel branch, and closed or formally classified everything that was left.

Every status below is one of exactly seven words, defined at the end. Nothing here says "secure".

**Release decision: see [§13](#13-release-decision).**

---

## 1. Executive summary

The state that matters, in five sentences.

Every finding that can be fixed in this repository is fixed, and each fix has a regression test
that was shown to fail with the fix reverted. The two things the last report left as *open* —
an aggregate memory bound across a run's width, and the quadratic paths a hostile graph could
reach in the validator — are closed. The runtime, not the editor, now decides which folder a
grant covers, which was the largest finding of the whole cycle. The three things no code in this
repository can close — a signing certificate, an update channel that does not exist yet, and a
review by somebody who did not write it — are named as such, with what each would take. The
installer that ships must be built from the final commit, and this document says which commit
that is, or that it is not yet known.

Five new defects were found in this pass, on code that landed while the previous pass was being
written. That is the expected shape of things — an audit is a statement about a commit, and
commits keep arriving — and it is the reason the last section is a procedure rather than a
verdict.

---

## 2. Where the work is

| Branch | Base | Contents | State |
|---|---|---|---|
| `feat/readiness` | `main` `4f2932e` | The release candidate. Merged `sec/hardening-audit` at `4944b41`. | Owned by a parallel session; final SHA pending |
| `sec/hardening-audit` | `main` | Passes 1 and 2 | Merged into the candidate at `4944b41` |
| `sec/readiness-findings` | `4944b41` | This pass: `a02d5b8` (findings) + merge of `sec/findings-runtime` at `df5fc33` + docs `0b29848` | Verified; handed to the candidate's owner to merge |
| `sec/findings-runtime` | `4944b41` | `b70e4a1`: the run budget, log caps, cached validation | Merged into `sec/readiness-findings` |

`main` has not been written to by this work at any point.

---

## 3. Findings

Severity is about this build as it ships: Windows-only, first-party components only, no updater.

| ID | Severity | Finding | Fix | Regression test | Status | Residual risk |
|---|---|---|---|---|---|---|
| ENC-01 | HIGH | A folder grant could name a folder nobody chose (`C:\`, the startup folder), because the string came from the project file and the prompt displayed it accurately | The runtime opens the chooser (`choose_folder`), records the canonical result per session, and admits a folder grant only for a recorded path; roots, system, program, profile and startup trees refused; `inspect_/import_publication` and `prepare_publication` require the same | 7 tests in `src-tauri/src/lib.rs`, `resolve_grant_directory` tests in `broker.rs` | **VERIFIED** | A person can still choose an unwise folder deliberately; see ENC-01b |
| ENC-01b | MEDIUM | The consent prompt is rendered by the webview | Not a patch. Content constrained (`safe-text.ts` + shared table); authority moved to Rust; presentation still in the renderer | — | **DESIGN LIMITATION** | A renderer compromise could present an honest grant misleadingly. No XSS sink found. Closing it means a native or isolated-window dialog drawn by the privileged side |
| ENC-02 | MEDIUM | A grant was honoured for a capability the component never declared | `GrantSet::grant_declared` | `a_grant_for_something_the_component_never_declared_grants_nothing` +1 | **VERIFIED** | None known |
| ENC-03 | MEDIUM | Bidi/zero-width characters let a path read as another in the prompt | `forDisplay` strips them, once, where the value is computed; list extended this pass and shared with the runtime | `safe-text.test.ts`, `hostile-text.test.ts` | **VERIFIED** | Only content is constrained, not rendering (ENC-01b) |
| ENC-04 | MEDIUM | Per-entry zip ceiling, no total; index chooses how many entries get read | `MAX_TOTAL_BYTES`, `MAX_SNAPSHOTS`, `MAX_FILE_BYTES` before the read | 3 tests in `hostile_archive.rs` (sparse file for the size ceiling) | **VERIFIED** | None known |
| ENC-05 | MEDIUM | Duplicate `graph.json`: reader ran the second, viewers show the first | Refused from the end-of-central-directory count | `an_archive_that_names_the_same_entry_twice_is_refused` (hand-patched central directory) | **VERIFIED** | Under-reported count → viewer shows an entry the app ignores. Inert |
| ENC-06 | MEDIUM | A symlink in a watched folder reached outside it | `import_guarded` canonicalises the file | `a_symlink_in_an_allowed_folder_cannot_reach_outside_it` | **VERIFIED** (Linux CI, gated against skip) / PARTIALLY VERIFIED on this Windows machine | Hard links (ENC-NEW-06) |
| ENC-07 | MEDIUM | `save_to` checked one path, wrote another; leaf symlink followed | Destination from the resolved directory; leaf checked with `symlink_metadata` | 2 tests | **VERIFIED** (one of the two symlink-gated as above) | Hard links |
| ENC-08 | MEDIUM | A host grant admitted every port | Port in the permission identity, both parsers | Rust + TS + shared `url-authority-cases.json` | **VERIFIED** | None known |
| ENC-09 | MEDIUM | No graph size ceiling; container bypassed `parse` | `MAX_NODES`/`MAX_EDGES` via `within_limits()` at both doors | 3 tests | **VERIFIED** | None known |
| ENC-10 | MEDIUM | `fs::read` with no ceiling | `MAX_READ_BYTES` via `metadata` first; ceiling injectable so the branch is tested | 2 tests (rewritten — the first version never reached the refusal) | **VERIFIED** | Aggregate: ENC-NEW-05 |
| ENC-11 | LOW | Windows device names survived filename sanitising | Prefixed; trailing dots/spaces settled | 2 tests | **VERIFIED** | None known |
| ENC-12 | LOW | `save_project` wrote to any path | `.encastra` required; the candidate extended the same guard to open/restore/compare/review/prepare | `a_project_is_saved_only_as_a_project` | **VERIFIED** | A shape check, not a trust boundary |
| ENC-13 | MEDIUM | Open redirect via `//evil` in the language switcher | `isPathOnThisSite` | `redirect-path.test.ts` | **VERIFIED** | None known |
| ENC-14 | LOW | `TAURI_*` exposed to the bundle | Vite default prefix | Production build | **VERIFIED** | None |
| ENC-15 | LOW | IPv6 literal parsed as a colon, both parsers | Fixed in both; shared table | Rust + TS | **VERIFIED** | None known |
| ENC-16 | LOW | "Allowed" shown after the granted folder changed | Lookup compares the value | — (UI state; runtime fails closed) | **FIXED**, NOT VERIFIED by test | The consent component has no automated coverage |
| ENC-17 | LOW | A hostile-input test that never reached its code | Repaired; fixture asserted valid | Itself | **VERIFIED** | The class recurred; see §7 |
| ENC-18 | INFO | Sourcemaps ship in the desktop bundle | — | — | **ACCEPTED RISK** | Reverse-engineering aid; the source is in the binary anyway |
| ENC-19 | MEDIUM | Live `rustls` advisory hidden by a failing gate | `0.23.45`; `deny.toml` repaired | `cargo deny check` exit 0 | **VERIFIED** | Five `unmaintained` transitive advisories, individually ignored with provenance and a 2026-12-15 revisit |
| SUP-03 | MEDIUM | `cargo deny` red on `main` for long enough that nobody read it | Policy with reasons; `private.ignore`; `allow-wildcard-paths` | The gate | **VERIFIED** | MPL-2.0 allowed on record — a decision |
| ENC-NEW-01 | HIGH | A panicking component left the runtime unable to run again | `catch_unwind` around the workflow thread; cleanup on both arms | — | **FIXED**, PARTIALLY VERIFIED (release build; no live-thread test) | A panicking node still ends its run |
| ENC-NEW-02 | MEDIUM | `list_dir` unbounded from an attacker-writable folder, every 600 ms | `MAX_DIR_ENTRIES`, injectable | `a_folder_with_more_files_than_the_build_lists_is_refused_not_truncated` | **VERIFIED** | None known |
| ENC-NEW-03 | MEDIUM | No wall-clock bound on a run | `MAX_RUN_DURATION` through the Stop mechanism | — | **FIXED**, NOT VERIFIED by test (an hour) | No per-node timeout |
| ENC-NEW-04 | MEDIUM | Security tests could skip and count as green | CI greps for `skipped` on the OS that can run each; broker, startup folder, importer | The gates, checked against a real skip | **VERIFIED** | A test skipping on every OS would need a third condition |
| ENC-NEW-05 | MEDIUM | No aggregate memory bound. Depth was closed by the candidate (release at last consumer: 20 000 steps 3.9 GB → 67 MB); **width was not** | `MAX_LIVE_VALUE_BYTES` (1 GiB) over the runtime's accounting of live values; producer over it fails `run-memory-budget`, consumers skipped, run finishes; counter is a local of `execute` | 14 tests in `run_budget.rs`, incl. 200 small producers that add up, and sum > budget with peak < budget that must pass; each shown to fail with its change reverted | **VERIFIED** | Bounds the accounting, not the OS: component working memory, decoder buffers, per-edge clones (ENC-NEW-05b) outside it |
| ENC-NEW-05b | LOW | A value is cloned once per consuming edge at delivery | Not done; `TODO` at the clone site | — | **ACCEPTED RISK** | Peak bounded (sequential); cumulative N × size. Fix is `Arc` in `Value`, a type every component touches |
| ENC-NEW-06 | LOW | Hard links invisible to canonicalisation | No mitigation on stable Rust | — | **ACCEPTED RISK** | Requires write access to a granted folder, which the grant already gives; NTFS file identity needs unstable `file_index`. Junctions and symlinks are closed |
| ENC-NEW-07 | MEDIUM | `listing_id` became a directory; `owns()` is a prefix test on two strings from the same caller | One identifier grammar (`validate_identifier`), before the namespace test; destination chosen + contained | 3 tests that assert `owns()` accepts the hostile id first | **VERIFIED** | Publisher identity is self-asserted (§9) |
| **ENC-NEW-08** | MEDIUM | Validator's topological sort O(V·E), cycle report O(V²); watcher pruning O(n²) per poll | Outgoing edges indexed once; `BTreeSet` in both places | 2 timing tests at the ceilings, `< 3 s` where the old path took orders of magnitude more | **VERIFIED** | Timing tests distinguish linear from quadratic, not fast from slow |
| **ENC-NEW-09** | MEDIUM | `run_graph` leaked `%TEMP%\encastra\run-*` on any `?` before cleanup — one folder per call for a caller that could name a missing input | `ScratchDir` guard with `Drop` | `a_scratch_folder_is_gone_however_the_run_left` (return, early return, unwind) | **VERIFIED** | `start_workflow` already cleaned on every path via `catch_unwind` |
| **ENC-NEW-10** | LOW | `validate_identifier` claimed an id was safe as a directory name; `nul.x`, `con.tools`, `com1.z` pass and are devices on Windows 10 | First segment refused if a reserved stem | `an_id_cannot_start_with_a_windows_device_name` | **VERIFIED** | Empirically a plain folder on this Windows 11 build; the risk is a listing that imports on one machine and writes to a serial port on another |
| **ENC-NEW-11** | MEDIUM | CSV → JSON amplification ~50–150× with no ceiling of its own | `MAX_CSV_ROWS` 1 M / `MAX_CSV_CELLS` 10 M, refused not truncated | e2e through the real component | **VERIFIED** | None known |
| **ENC-NEW-12** | LOW | A publication folder of a million junk files was listed and stat'ed to the end and its names put in the error | `MAX_FOLDER_ENTRIES` 64, refused before the 65th is stat'ed | `a_folder_full_of_junk_is_refused_before_it_is_listed_to_the_end` | **VERIFIED** | None known |
| **ENC-NEW-13** | LOW | The two hostile-text lists (runtime refuses, editor strips) had drifted; neither knew U+206A–206F, U+061C, U+180E, U+2028/2029 | Both extended; one shared table replayed by both | Rust + TS over `hostile-text-cases.json` | **VERIFIED** | One deliberate difference — the prompt drops `\n\r\t`, a document keeps them — encoded in the TS test rather than hidden |
| **ENC-NEW-14** | MEDIUM | Logs per node unbounded; whole journal cloned over IPC | `MAX_LOG_LINES_PER_NODE` 200, `MAX_LOG_LINE_CHARS` 2 000 | 2 tests | **VERIFIED** | Journal size still scales with node count (≤ 10 000) |
| **ENC-NEW-15** | LOW | Validation recomputed from scratch on every session tick | Cached in `Session`, `execute_request_validated` | Counting-registry test | **VERIFIED** | None known |
| **ENC-NEW-16** | MEDIUM | The library caps entries (10 000) but not bytes: 10 000 imports × 64 MB is disk with no ceiling, and an automated agent driving the UI could produce it | Not fixed in this pass | — | **ACCEPTED RISK**, mitigated | Every import requires a folder chosen in the native chooser this session — a human action per import; no renderer-only path reaches it. A `MAX_LIBRARY_BYTES` is the right fix and needs one variant plus the six-language fan-out |

---

## 4. Fixes, by file

Beyond the table, the shape of the changes this pass:

* `crates/encastra-core/src/validate.rs` — outgoing-edge index; `BTreeSet` for the cycle path; first inline test module.
* `crates/encastra-core/src/runner.rs`, `session.rs`, `value.rs` — run budget, log caps, cached validation; `Value::approx_bytes`; `execute_request_within` seam (`#[doc(hidden)]`, unreachable outside `encastra-core`, verified by grep).
* `crates/encastra-protocol/src/manifest.rs` — device-stem refusal in the one identifier grammar.
* `crates/encastra-builtins/src/{data.rs,triggers.rs,lib.rs}` — CSV ceilings; watcher set; re-exports for the e2e test.
* `crates/encastra-publish/src/{import.rs,bundle.rs}` — folder entry ceiling and its variant; extended character list.
* `apps/desktop/src-tauri/src/lib.rs` — `ScratchDir`.
* `apps/desktop/src/{safe-text.ts,types.ts,library.ts}`, six locales, two test files — the fan-out for the new variant and the shared table.
* `.github/workflows/ci.yml` — importer link test gated against skip.
* `docs/security/{LIMITS.md,PENTEST_SCOPE.md}`, `docs/THREAT-MODEL.md` §6 4c, the remediation report's residual §N.3.

No existing test was weakened, ignored or deleted. No limit was raised to make a test pass.

---

## 5. Tests

Run on `sec/readiness-findings` @ `0b29848` (= `4944b41` + this pass), on this Windows 11
machine, exit codes read rather than summaries.

| Command | Result |
|---|---|
| `cargo test --workspace` | **312 passed, 0 failed**, 27 suites (99 before the cycle; 286 at `4944b41`) |
| `npx vitest run` | **445 passed, 0 failed, 24 files** (265 before the cycle) |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --all --check` | clean |
| `npx tsc --build` / desktop `tsc --noEmit` | exit 0 |
| `npx biome check .` | clean, 219 files |
| `cargo deny check advisories bans licenses sources` | exit 0 (no dependency change in this pass; re-verified by the candidate's owner at `4944b41`) |
| `npm audit --audit-level=low` | 0 |
| `npm run build --workspace @encastra/desktop` | succeeds |
| `next build` (website) | succeeds |

New tests this pass, all shown to fail with their fix reverted (by the author; independently
re-run by this session): 14 in `run_budget.rs`, 2 timing tests in `validate.rs`, 1 in
`manifest.rs`, 1 guard test in the Tauri crate, 1 e2e CSV, 3 in `import_publication.rs`, 1 in
`bundle.rs` (shared table), 24 TS cases in `hostile-text.test.ts`, plus the session and log
tests.

---

## 6. Adversarial testing

What was actually attacked in this pass, by hand or by test, beyond the suites above:

* **The merge commit's new crate** (`encastra-publish` importer and library) read end to end with
  the question "what does a hostile publication folder buy me". Found ENC-NEW-12; confirmed the
  TOCTOU between `symlink_metadata` and `File::open` is neutralised by the checksum binding (a
  swap buys a refusal unless the swapped-in file's hash is predictable); confirmed the
  `check_text` branch for `publisher` is unreachable through import (a dead defence, noted, not
  a bug); confirmed `remove_imported_copy` refuses anything outside `imports/` after
  canonicalisation.
* **Windows device names as identifiers**, tried empirically in Python and in Rust on this
  machine (Windows 11 build 26200): `nul.x`, `con.y`, `com1.z`, `aux` all create as ordinary
  folders here. The refusal stands for Windows 10.
* **The validator at its ceilings**: 10 000 nodes / 40 000 edges, acyclic and as one cycle, timed.
* **The runner's budget**: 200 producers each under 1 % of the budget summing past it; a chain
  whose sum exceeds the budget but whose peak does not; consumers that fail, are skipped, are
  disabled.
* **A CSV one row past the ceiling**, through the real component, and one under it.
* **A publication folder with 65 junk files**, and the same with one.
* **The character list**, with a sample per code point and a control sample per allowed shape,
  replayed through both implementations — which is how the `\n\r\t` divergence was found.
* **Both skip gates**, run in the direction where the test skips, to confirm the gate fails.

Not attacked: the GUI (§10), a live Tauri thread panicking (ENC-NEW-01), an hour-long run
(ENC-NEW-03), a real network redirect (there is no hop to follow).

---

## 7. Security test quality

The failure class from the first two passes — a green test that never reaches its control — was
checked for again on the candidate's new tests by a dedicated read. Findings and what was done:

| Test | Verdict | Action |
|---|---|---|
| `a_value_is_released_once_its_last_consumer_has_finished` (candidate) | WEAK — one consumer per port, every node succeeds, no bound asserted | Left untouched (not weakened); the stronger cases live in `run_budget.rs` and assert timing *through the budget* so a late release fails a later producer |
| `a_link_where_a_file_should_be_is_never_followed` (candidate) | Skips on Windows without a privilege, silently green | CI gate added on Linux, same as the broker's |
| `twenty_strategies_later_the_library_holds_exactly_what_the_honest_import_left` | SOUND for its property (byte-identical state after 20 attacks); WEAK as evidence that each attack met the *right* refusal | Recorded; not changed — the per-case tests in `import_publication.rs` cover the specific refusals |
| `check_text` for `publisher`, `categories`, `tags` | No test | `categories`/`tags` covered now; `publisher` shown unreachable through import |
| `MAX_FOLDER_ENTRIES`, `MAX_CSV_*`, device stems, the scratch guard, the timing bounds | New controls | Each has a test that fails without it |

Rules applied, unchanged from the last pass: a fixture is asserted valid in its unchanged form;
`is_err()` is not an assertion where several errors produce `Err`; side effects are asserted;
a skip is not a pass; a ceiling too large to reach in a test becomes an argument.

---

## 8. AI-agent threat model

The product does not use an AI model. The question the brief asks is what an *automated* actor —
an agent driving the application, or generating files for it — could do with thousands of
individually valid operations.

| Scenario | What bounds it | Residual |
|---|---|---|
| Thousands of `run_graph` calls | Each run: 1 GiB live values, 1 h wall clock, 10 000 nodes, scratch removed on every exit (ENC-NEW-09). One workflow at a time (`state.running`). | CPU for as long as the agent keeps calling. No rate limit on IPC; the renderer is the only caller |
| Thousands of generated `.encastra` files opened | Each open: 256 MB file, 64 MB total unpacked, 1 000 snapshots, graph ceilings, 60 000-input deterministic sweep with no panic | Opening is a human action per file |
| Thousands of publications imported | Each: 64 MB, 64 entries, checksum-bound, review re-run; library ≤ 10 000 entries | **Bytes are not capped** (ENC-NEW-16). Every import needs a folder chosen in the native chooser — a human gesture per import; no renderer-only path |
| A folder flooded by an agent while watched | Listing ≤ 50 000 entries, refused not truncated; pruning is linear now; queue ≤ 512 with drops reported | The watcher keeps polling a folder that is too full, reporting the refusal each time |
| An agent trying to manufacture consent | Grants must name a declared capability, a folder the runtime's own chooser recorded, a host+port the runtime's own parser reads | The prompt's rendering (ENC-01b) |
| Exfiltration through `net.http` | Host and port are granted per node; redirects not followed; 16 MB per response; no loopback/private-range block (deliberate — a local dev server is ordinary) | A granted host is reachable, including private ones |
| Secret discovery | No `process.*` capability exists; no `std::env::var` reads reachable from a component; secrets are declared by name and never resolved (no keystore) | — |
| Supply-chain poisoning | `cargo deny` (crates.io only), lockfile integrity hashes, `gitleaks`, Dependabot | Actions pinned to tags, not SHAs (SUP-02) |
| Denial of wallet | No paid API is called | — |

---

## 9. Identifiers and ownership

One grammar: `encastra_protocol::manifest::validate_identifier` — lowercase reverse-DNS, no
separators, no empty or dot segments, first segment not a Windows device stem. `is_listing_id`
is that grammar plus a 200-character ceiling and nothing else; a second grammar that existed on
a parallel branch was removed in favour of it. It runs before `Publisher::owns` everywhere, so
the namespace test decides namespaces rather than paths.

**Ownership is not authenticated.** The publisher id in a publication document is written by
whoever wrote the document, and `owns()` compares it against a listing id from the same
document. There is no registry, no key, no signature; `provenance_verified` and
`publisher_verified` are `false` fields the interface has to render. This is a **DESIGN
LIMITATION** of a product with no registry, documented in ADR-0008 as future work, and this
report does not pretend otherwise.

---

## 10. Platform verification

| What | Status |
|---|---|
| Windows 11 (this machine, build 26200) — full suites, builds, installer | Run |
| Linux — `cargo test --workspace` on `ubuntu-latest` in CI, with the symlink and importer-link tests gated against skipping | Configured; **NOT VERIFIED in this session** (no CI run was triggered from a branch by this session; the gates were validated locally in both directions) |
| macOS — `cargo test --workspace` in CI matrix | Configured; not verified here |
| Symlink tests on this machine | Skip (no `SeCreateSymbolicLinkPrivilege`); reported, not hidden |
| Native folder chooser through the GUI | **NOT VERIFIED — GUI ENVIRONMENT REQUIRED.** `choose_folder` compiles, is registered, the release build succeeds. Procedure in `RELEASE_SECURITY.md` §clean-install steps 6–7 |
| Clean Windows VM install | **NOT EXECUTED.** Procedure written, ten steps |

---

## 11. Release artefacts

{{ARTEFACTS}}

---

## 12. Signing, fuzzing, external dependencies

**Signing: READY, NOT EXECUTED.** `release_manifest.py --require-signature` asks Windows about
Authenticode per artefact and refuses (verified against the real installer: it refuses);
`release.yml` imports a certificate from two repository secrets when present, and they are
absent. Nothing is signed. There is no updater, so there is no update signing to audit; when one
exists it needs verification from its first commit.

**Fuzzing: integrated, not campaigned.** Four libFuzzer targets with a committed seed corpus
(`fuzz/`); a deterministic 60 000-input sweep on stable in CI with a corpus-health canary; the
address parser fuzzed for output properties, not only crashes. **No long libFuzzer run has been
executed** — it needs nightly and hours, and the pinned toolchain is stable. What ran: the
sweep, every push.

**External dependencies**, unchanged in kind from the last report: a code-signing certificate; an
external penetration test (`PENTEST_SCOPE.md` is ready for one); a clean Windows VM; `@encastra`
npm scope ownership; a GUI session to click the chooser.

---

## 13. Release decision

Applying the gate in the brief literally:

| Condition | Met |
|---|---|
| No P0 | yes |
| No P1 without explicit mitigation | yes — ENC-NEW-01 (HIGH) fixed; ENC-01 (HIGH) fixed |
| No security test skipped where it can run | yes — CI gates on Linux/Windows; local skips reported |
| No known vacuous test | yes — one weak test recorded and superseded, not deleted |
| ENC-NEW-05 closed | yes — depth and width |
| ENC-NEW-06 closed or accepted | accepted, with reason |
| ENC-01b resolved or accepted | accepted as a design limitation |
| Integration clean | `sec/readiness-findings` verified; **merge into the candidate pending** |
| Final build generated from the final commit | **{{BUILD_STATUS}}** |
| Installer matches final code | **{{BUILD_STATUS}}** |
| Runtime verified | tests yes; **GUI no** |
| GUI verification done or marked external | marked external |
| Linux symlink tests executed by CI | configured; **not observed in this session** |
| Fuzzing per capacity | yes |
| Signing ready | yes |
| External pentest identified | yes |
| Clean VM done or pending | pending, marked |
| Documentation current | yes |
| Git working tree clean | yes on `sec/readiness-findings` |

**{{DECISION}}**

---

## Definitions

* **FIXED** — the code was changed.
* **VERIFIED** — the behaviour was checked by reproducible evidence, on this machine, this session.
* **PARTIALLY VERIFIED** — part of the property was checked; the rest is named.
* **EXTERNAL BLOCKER** — needs infrastructure, a credential or a person outside this repository.
* **DESIGN LIMITATION** — not fixable without changing the architecture or the trust model.
* **ACCEPTED RISK** — deliberately left, with the reason written down.
* **NOT VERIFIED** — no sufficient evidence.
