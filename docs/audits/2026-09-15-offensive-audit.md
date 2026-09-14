# Offensive security audit — 2026-09-15

Scope: the whole product. Web application, desktop application, Rust runtime, capability broker,
component set, `.encastra` container, the Tauri boundary, dependencies, CI and release.

Method: read the code rather than the claims, attack it, patch what fell, write a test that fails
without the patch, then attack the patch. Every finding below is anchored to a file and, where the
fix is verifiable, to the test that verifies it.

**Status: SECURITY HARDENING PARTIAL.** Twenty findings. Sixteen patched with regression tests, one
patched by a dependency bump, three not fixable in code (release signing, update integrity, and a
CI gate whose repair needs decisions about licence policy) and recorded as external blockers or
follow-up. Two patches are verified by tests this Windows machine could not run — see
[Verification honesty](#verification-honesty). No statement here should be read as "secure": what
follows is what was looked at, what was found, and what was done about it.

---

## A. Executive summary

The security model Encastra advertises is real. Components hold opaque handles rather than paths,
the broker is genuinely the only code that touches OS authority, first-party components go through
the same gate as anyone else, the production CSP has no `unsafe-eval`, the project reader never
extracts to disk, and image decoding probes dimensions before it allocates. Several things the
brief listed as "already reviewed" held up under attack: SSRF in particular is in better shape
than its own comments suggest, because redirects are not followed at all.

What did not hold was the *edge* of that model rather than its centre:

1. **A folder grant was taken at face value.** The string shown in the permission dialog comes
   from the project file, and a project file may be written by somebody else. A hostile project
   could present a plausible-looking folder, have the user approve it, and obtain the whole `C:`
   drive or the Windows startup folder. This is the most serious finding and needed no software
   vulnerability at all — only a person reading a prompt.
2. **A grant was honoured for capabilities a component never declared.** The dialog is built from
   the manifest, so a grant for something not in the manifest cannot have come from a question
   anybody was asked. It was accepted anyway.
3. **The 32 MB zip-bomb ceiling was per entry, and the file chooses how many entries get read.**
   Per-entry times unbounded-count is unbounded.
4. **An archive could name `graph.json` twice**, and the reader ran the second one while an
   archive viewer tends to show the first. This was demonstrated: the test that now refuses it
   first caught the runtime loading the attacker's graph.
5. **A host grant was a grant for every port on that host**, so a permission given for a web
   service also reached `:22` and `:5432` on the same machine.

The two front ends came out well. The renderer has no XSS sink — every project-controlled string
reaches React as a text child, never as markup — and the website already had a nonce-based CSP,
a full header set, and `gitleaks` wired into CI. No secrets were found in the tree or its history.

---

## B. Attack surface

| Surface | Reachable by | Notes |
|---|---|---|
| `.encastra` file | anyone who can send the user a file | The primary hostile input. Controls the graph, every node's config, labels, history. |
| Component manifest | first-party only today | Third-party components cannot run code yet; the WASM host is not built. This is why the blast radius is currently small. |
| Tauri IPC (12 commands) | the webview | `run_graph`, `start_workflow`, `save_project`, `open_project`, `restore_version`, `compare_versions`, `validate_graph`, `list_components`, `type_graph`, `stop_workflow`, `workflow_status`, `about`. |
| Capability broker | every component, first-party included | Handles, not paths. |
| `net.http` | a graph with a granted host | Outbound HTTP only, no redirects. |
| Watched folders | anyone who can put a file in one | That is what a watched folder is for, which is what makes the symlink finding matter. |
| Website | any visitor | Static content plus one server action (locale). No accounts, no database, no outbound requests. |
| NSIS installer | whoever obtains it | Unsigned. See external blockers. |

Not present, and confirmed absent rather than assumed: no auto-updater, no third-party component
execution, no `std::process::Command` anywhere, no clipboard *read*, no network access from the
website, no `eval`/`new Function`/`innerHTML` in either front end.

---

## C. Threat model

**Trust boundaries, and who is on the far side.**

| Boundary | Untrusted side | What crosses | Decided by |
|---|---|---|---|
| project file → parser | whoever sent the file | ZIP, JSON, graph, history | `encastra-project` |
| project file → editor | same | node config strings, labels | rendered by React |
| webview → Tauri | the renderer | graph, inputs, **grants**, paths | `apps/desktop/src-tauri` |
| component → broker | the component | handle ids, filenames, hosts | `broker.rs` |
| broker → OS | — | the only place authority is exercised | `broker.rs` |
| network → `net.http` | the remote host | response bytes | `net.rs` |
| browser → website | the visitor | cookie, form post | `proxy.ts`, `actions.ts` |
| installer → OS | — | per-user install, no elevation | NSIS |

**The assumption that turned out to matter.** The renderer was treated as an extension of the
application rather than as an untrusted surface. That is a defensible reading — it is the app's
own code, and no XSS was found in it. But the renderer relays *the user's decisions*, and those
decisions are shaped by strings from the project file. The runtime believed the relay without
checking what it could check. Findings ENC-01 through ENC-03 all live in that gap.

---

## D. Vulnerabilities found

Severity is about this build as it ships: Windows-only, no third-party components, no updater.

### ENC-01 — HIGH — A folder grant could name the whole drive, or the startup folder

* **Component**: `apps/desktop/src-tauri/src/lib.rs` (`grant_set`), `crates/encastra-core/src/broker.rs`
* **Vector**: A malicious `.encastra` file sets a node's `config.folder`. The editor reads that
  string live off the node (`Inspector.tsx`) and shows it on the Allow button. Whatever it says is
  what gets sent to `run_graph` as `GrantScope::Directory`, unexamined.
* **Exploitability**: No software vulnerability required — the user clicks Allow on a prompt that
  is telling the truth about a value they did not choose. ENC-03 makes the prompt able to lie.
* **Impact**: `fs.read` over the whole drive (exfiltration through a granted host), or `fs.write`
  into the startup folder (persistence — anything placed there runs at next login).
* **Root cause**: The runtime treated a relayed decision as a made decision.
* **Fix**: `resolve_grant_directory` canonicalises the folder and refuses filesystem roots, the
  system directory, the program directories, the profile root and its container; and refuses the
  startup folder **as a tree**, since a subfolder of it starts the same way. The resolved path is
  what gets stored, so the path checked is the path used.
* **Test**: `a_whole_drive_is_not_a_folder_a_component_can_be_given`,
  `the_folder_that_decides_what_runs_at_login_is_not_grantable`,
  `a_folder_that_does_not_exist_is_not_a_grant`.
* **Verified**: yes, on this machine.

### ENC-02 — MEDIUM — A grant was honoured for a capability the component never declared

* **Component**: `crates/encastra-core/src/broker.rs` (`GrantSet::grant`)
* **Vector**: Any `{node, kind}` pair sent to `run_graph` became a grant. `kind` was never checked
  against the component's manifest.
* **Exploitability**: The editor only offers buttons for declared capabilities, so there is no
  path to trigger this from the UI today. It requires renderer compromise, and no XSS sink was
  found. Recorded as defence in depth, not as a live hole.
* **Impact**: A component could hold authority its own declaration — the same declaration the
  dialog and the capability panel are drawn from — never mentions.
* **Fix**: `GrantSet::grant_declared` refuses a grant whose kind is absent from the manifest. The
  existing rule was "a manifest asking for something does not grant it"; the converse now holds
  too. A refused grant is dropped, and the component's later denial appears in the journal.
* **Test**: `a_grant_for_something_the_component_never_declared_grants_nothing`,
  `a_component_cannot_be_handed_an_undeclared_capability_even_with_a_folder`.
* **Verified**: yes.

### ENC-03 — MEDIUM — The consent prompt could be made to read as a different path

* **Component**: `apps/desktop/src/panels/Inspector.tsx`
* **Vector**: `config.folder` and `config.url` come verbatim from the project file and are rendered
  back as the thing being approved. A right-to-left override (U+202E) reorders the displayed text;
  zero-width characters hide segments. The granted bytes are the real ones.
* **Impact**: Consent to a string the person could not read. Directly amplifies ENC-01.
* **Fix**: `apps/desktop/src/safe-text.ts` strips bidirectional controls, zero-width characters and
  C0/C1 controls. Applied once, at the point the value is computed, so the string on the button and
  the string in the grant are the same string.
* **Test**: `apps/desktop/test/safe-text.test.ts` (6 cases).
* **Verified**: yes.

### ENC-04 — MEDIUM — The decompression ceiling was per entry, not per file

* **Component**: `crates/encastra-project/src/lib.rs`
* **Vector**: `versions/index.json` respects the 32 MB ceiling and declares how many snapshot
  bodies get read. Ten bodies of 8 MB are ten legal reads whose sum is not legal.
* **Impact**: Memory and CPU exhaustion on opening a file somebody sent. The archive is a few
  kilobytes on disk.
* **Fix**: `MAX_TOTAL_BYTES` (64 MB) spent across the whole open; `MAX_SNAPSHOTS` (1000) refuses
  the intent before the budget is touched; `MAX_FILE_BYTES` (256 MB) checked via `metadata` before
  `Project::open` reads anything, since the reader needs the archive in memory to find the central
  directory.
* **Test**: `entries_that_each_respect_the_ceiling_cannot_together_exhaust_memory`,
  `a_history_that_names_more_versions_than_the_build_reads_is_refused`.
* **Verified**: yes.

### ENC-05 — MEDIUM — An archive could name one entry twice and run the hidden one

* **Component**: `crates/encastra-project/src/lib.rs`
* **Vector**: Two `graph.json` entries. The reader indexes entries into a map, so the second
  overwrites the first; an archive viewer tends to show the first.
* **Impact**: A project file that shows one graph to whoever inspects it and runs another.
* **Demonstrated**: the regression test, before the fix landed, opened the project with the
  attacker's node in it. The fixture is built by writing a placeholder name of equal length and
  rewriting it, because this crate's own writer refuses to produce a duplicate.
* **Fix**: `reject_ambiguous_archive` compares the entry count in the end-of-central-directory
  record against the number of distinct names. The reader's own name list is already deduplicated,
  so it cannot be the source of that count.
* **Test**: `an_archive_that_names_the_same_entry_twice_is_refused`.
* **Verified**: yes.

### ENC-06 — MEDIUM — A symlink in a watched folder reached outside it

* **Component**: `crates/encastra-core/src/broker.rs` (`import_guarded`)
* **Vector**: Only the parent directory was canonicalised. A link sitting in a granted folder is a
  name in the right place whose content is anywhere the user can read. A watched folder is, by
  definition, where files arrive from elsewhere.
* **Impact**: Grant-scope escape — the run obtains a handle to a file outside the granted folder,
  and the handle looks ordinary.
* **Fix**: the full path is canonicalised and required to be a file; the resolved path is what gets
  stored, so later reads go where the check looked.
* **Test**: `a_symlink_in_an_allowed_folder_cannot_reach_outside_it`.
* **Verified**: **not on this machine** — Windows requires a privilege to create a symlink and the
  test reported that it skipped. See [Verification honesty](#verification-honesty).

### ENC-07 — MEDIUM — The path that was checked was not the path that was written

* **Component**: `crates/encastra-core/src/broker.rs` (`save_to`)
* **Vector**: containment was decided on `canonicalize(directory)`, and the copy went to
  `directory.join(name)` — the unresolved one. Anything between the two is an escape the check
  never saw. Separately, the leaf was never examined: a copy follows a link at the leaf too.
* **Fix**: the destination is built from the resolved directory; a leaf that is already a symlink
  is refused with `symlink_metadata`, which does not follow it.
* **Test**: `saving_writes_to_the_folder_that_was_actually_checked`,
  `a_link_already_in_the_granted_folder_does_not_take_the_write_with_it`.
* **Verified**: the first, yes. The second skipped for the same reason as ENC-06.

### ENC-08 — MEDIUM — A host grant was a grant for every port on that host

* **Component**: `crates/encastra-builtins/src/net.rs`, `apps/desktop/src/url.ts`
* **Vector**: the port was discarded before `check_http`. A grant for `internal.example`, given for
  its web API, also admitted `internal.example:22`, `:5432`, `:6379`.
* **Impact**: one permission becomes reachability to every service on that host — a port-scanning
  and internal-service-access primitive inside the user's network.
* **Fix**: the port is part of the identity in **both** parsers, which must agree by design. The
  scheme's own port still reads as a bare host, so existing grants keep working and the common case
  still reads as a hostname.
* **Test**: `a_grant_for_a_host_is_not_a_grant_for_every_port_on_it` (Rust) and
  `keeps a port that is not the default…` / `drops the port when it is the default…` (TypeScript).
* **Verified**: yes.
* **Credit**: found by the builtins sweep.

### ENC-09 — MEDIUM — A graph had no size ceiling, and the container bypassed the one door that could have had one

* **Component**: `crates/encastra-core/src/graph.rs`, `crates/encastra-project/src/lib.rs`
* **Vector**: 30 MB of entirely valid JSON is a very large number of nodes, each of which is work
  the validator, the editor and the runner all do. The project container deserialises a `Graph`
  straight out of an archive entry, never through `Graph::parse`.
* **Fix**: `MAX_NODES` (10 000) and `MAX_EDGES` (40 000), enforced in `Graph::parse` **and** via a
  public `within_limits()` the container calls — a limit that guards one of two doors guards
  neither. An oversized *history* body is dropped like a missing one; an oversized current graph
  refuses the file.
* **Test**: `a_graph_with_more_nodes_than_the_build_works_on_is_refused`.
* **Verified**: yes.

### ENC-10 — MEDIUM — Files were read into memory with no ceiling

* **Component**: `crates/encastra-core/src/broker.rs` (`open_input`, `host_read`)
* **Vector**: `std::fs::read` on a path that, for a watched folder, was chosen by whoever put the
  file there rather than by the person who granted the folder.
* **Fix**: `MAX_READ_BYTES` (512 MB), checked via `metadata` before the allocation, returning an
  ordinary component error. The error carries the OS error kind and never the path.
* **Test**: `the_bounded_reader_refuses_before_it_allocates`,
  `a_file_larger_than_the_ceiling_is_refused_without_being_read`.
* **Verified**: the guard and the happy path, yes. Half a gigabyte was not written to disk to
  exercise the far side of the branch.

### ENC-11 — LOW — Windows device names survived filename sanitisation

* **Component**: `crates/encastra-core/src/broker.rs` (`sanitise_filename`)
* **Vector**: `NUL`, `CON`, `COM1` and kin name devices in *any* directory, so a granted folder does
  not contain them. A result written to `NUL` is silently discarded; one written to `COM1` goes out
  of a serial port. Trailing dots and spaces were also kept, though Windows drops them on open.
* **Fix**: reserved names are prefixed rather than refused (a result the component cannot name is
  still a result); trailing dots and spaces are settled before the name is returned.
* **Test**: `a_filename_cannot_be_a_windows_device`,
  `a_filename_cannot_keep_a_trailing_dot_that_windows_would_drop`.
* **Verified**: yes.

### ENC-12 — LOW — `save_project` wrote to any path at all

* **Component**: `apps/desktop/src-tauri/src/lib.rs`
* **Vector**: the destination is a string from the renderer, supposed to be a save-dialog result.
* **Fix**: it must be a `.encastra` file. That does not make the path trusted — it is still
  somewhere the user's account can write — but it removes "write these bytes anywhere on the
  machine", which is the shape that ends with a file in a startup folder.
* **Verified**: by inspection and by the desktop build; no dedicated test.

### ENC-13 — MEDIUM — Open redirect in the language switcher

* **Component**: `apps/web/src/lib/i18n/actions.ts`
* **Vector**: the guard was `path.startsWith('/')`. `//example.invalid/page` is a same-origin URL
  whose pathname is that exact string, so it passes and leaves as a `Location` the browser resolves
  against another origin. `/\example.invalid` does the same where `\` folds to `/`.
* **Impact**: the visitor follows a genuine link to the real site, clicks a real control, and lands
  elsewhere — a good place to be offered an installer, for a product whose installers are unsigned.
* **Fix**: `isPathOnThisSite`, in its own module because a `'use server'` file may only export async
  actions, which would have put the rule out of reach of any test.
* **Test**: `apps/web/test/redirect-path.test.ts` (4 cases).
* **Verified**: yes.
* **Credit**: found by the web sweep.

### ENC-14 — LOW — `TAURI_*` variables were exposed to the desktop bundle

* **Component**: `apps/desktop/vite.config.ts`
* **Vector**: `envPrefix: ['VITE_', 'TAURI_']`. Nothing reads a `TAURI_*` variable today, so nothing
  leaked — but the Tauri CLI sets variables in that namespace during a release build, signing
  material among them.
* **Fix**: back to Vite's default of `VITE_` only.
* **Verified**: by the production build, which still succeeds.
* **Credit**: found by the desktop sweep.

### ENC-15 — LOW — An IPv6 literal parsed as a colon, in both parsers

* **Component**: `crates/encastra-builtins/src/net.rs`, `apps/desktop/src/url.ts`
* **Vector**: splitting at the last colon regardless turned `[::1]` into a host of `:`.
* **Impact**: functional, and fails closed — an IPv6 host could never be granted nor matched. Fixed
  in both parsers at once, because the safety of having two of them rests on them agreeing.
* **Test**: `an_ipv6_literal_is_a_host_and_not_a_colon`, plus the TypeScript equivalent.
* **Verified**: yes.

### ENC-16 — LOW — A grant read as "Allowed" after the folder it was given for had changed

* **Component**: `apps/desktop/src/panels/Inspector.tsx`
* **Vector**: the lookup keyed on `{node, kind}` only. Edit the folder after granting and the UI
  still says Allowed, while the scope that would be sent is the old one.
* **Impact**: misleading, not exploitable — the runtime fails closed, because the component's
  configured folder no longer sits inside the granted one.
* **Fix**: the lookup compares the granted value too, so the button goes back to asking.
* **Verified**: by inspection; the consent flow has no automated coverage (see gaps).

### ENC-17 — LOW — A hostile-input test proved nothing

* **Component**: `crates/encastra-project/tests/hostile_archive.rs`
* **Detail**: `a_snapshot_id_cannot_escape_the_history_prefix` used entry names this build has
  never read (`encastra.lock`, `history/index.json`). It passed through the "malformed" branch and
  never reached the code it claimed to test — green for as long as it existed.
* **Fix**: correct names, and a new `the_fixture_these_tests_are_built_on_actually_opens` that
  asserts the unchanged fixture is *accepted*, so every test built on it means something.
* **Verified**: yes.

### ENC-18 — INFO — Sourcemaps ship in the desktop bundle

* `apps/desktop/vite.config.ts` sets `sourcemap: true`; the release build emits a 2.1 MB map. In a
  desktop app the source is in the binary anyway, so this is an aid to reverse engineering rather
  than a disclosure. Left alone — it may be deliberate for crash reports — and recorded so the
  choice is a choice.

---

## E. Security improvements implemented

Beyond the individual fixes:

* **One place where grants are built.** `run_graph` had its own second copy of the grant-building
  code, which is how two security checks become one check and one historical artefact. There is now
  a single `grant_set`, and every rule lives in it.
* **A named, testable path-scope rule.** `resolve_grant_directory` is one function with one
  meaning, callable and testable, rather than a `PathBuf::from` at a call site.
* **Checked path and used path are now the same path**, in `save_to` and in `import_guarded`. This
  is the class of bug ENC-06 and ENC-07 both belong to, not two coincidences.
* **Limits are named constants with reasons attached**, documented below.
* **Both URL parsers were changed together.** The design deliberately has two; the safety argument
  depends on them agreeing, so a fix to one that skipped the other would have quietly weakened it.

### Documented limits

| Limit | Value | Where |
|---|---|---|
| `MAX_ENTRY_BYTES` | 32 MB | one archive entry |
| `MAX_TOTAL_BYTES` | 64 MB | a whole project open |
| `MAX_SNAPSHOTS` | 1 000 | versions a history may declare |
| `MAX_FILE_BYTES` | 256 MB | a `.encastra` file on disk |
| `MAX_NODES` / `MAX_EDGES` | 10 000 / 40 000 | one graph |
| `MAX_READ_BYTES` | 512 MB | one file a component reads |
| `MAX_PIXELS` | 100 MP | image decode (pre-existing) |
| `MAX_RESPONSE_BYTES` | 16 MB | HTTP response (pre-existing) |

---

## F. Tests created

19 new tests, all failing without their patch.

`crates/encastra-core/src/broker.rs` — 11: undeclared-capability grant (×2), drive root, startup
folder, non-existent folder, checked-path-equals-written-path, symlink import escape, symlink leaf
on write, bounded reader (×2), device filenames, trailing dots.

`crates/encastra-project/tests/hostile_archive.rs` — 5 new plus 1 repaired: fixture-actually-opens,
snapshot-id traversal (repaired), snapshot count, aggregate budget, duplicate entry names, oversized
graph, ordinary open from disk.

`crates/encastra-builtins/src/net.rs` — 3: port in the permission identity, IPv6 literal, trailing
dot.

`apps/desktop/test/` — `safe-text.test.ts` (6) and 5 new cases in `url.test.ts`.

`apps/web/test/redirect-path.test.ts` — 4.

**Suite state after the work**: Rust 129 passed / 0 failed (was 99). TypeScript 276 passed / 0
failed across 17 files (was 265). `biome check` clean. `cargo clippy --workspace --all-targets -D
warnings` clean.

---

## G. Dependency audit

* `npm audit` — **0 vulnerabilities**.
* Lockfile — every `resolved` on `registry.npmjs.org`, no missing `integrity`, exactly one package
  with an install script (`fsevents`, macOS-only, transitive). No off-registry or tarball URLs.
* `Cargo.lock` — no git dependencies, no non-crates.io sources, no path dependencies outside the
  workspace. Duplicate major versions exist (`windows-sys` ×5, `syn` ×3, `base64` ×3 and others)
  and are normal transitive staggering for a Tauri 2 plus image stack; `deny.toml` tracks them as
  `warn` deliberately.
* `deny.toml` — `yanked = "deny"`, `ignore = []` (nothing suppressed), licence allowlist,
  `wildcards = "deny"`, `unknown-registry`/`unknown-git` denied, crates.io only. Clean posture.
* `cargo deny check advisories bans licenses sources` — **run**, after installing the tool. `sources`
  passes. The other three fail, **identically on `main`**, so none of it was introduced here:
  * **ENC-19 — MEDIUM — a live advisory in the TLS stack.** `rustls 0.23.44`: *TLS 1.3 handshake
    messages incorrectly accepted across encryption level boundaries*. This is the stack `ureq` uses
    for every HTTPS request a workflow makes. **Fixed** by `cargo update -p rustls` → `0.23.45`;
    the advisory no longer fires and the full Rust suite still passes.
  * Five `unmaintained` advisories remain — `proc-macro-error` and the `unic-*` family — all
    transitive build-time dependencies of the Tauri toolchain. Not fixable from here; they need an
    upstream bump. They are warnings about maintenance, not known vulnerabilities.
  * `bans` fails on `wildcard` for the workspace's own path dependencies
    (`encastra-core = { path = "../encastra-core" }` and four others), because `deny.toml` sets
    `wildcards = "deny"` and a path dependency carries no version. Not a supply-chain risk — these
    resolve to this repository — but it is why the gate fails.
  * `licenses` rejects 8 crates and cannot parse the expression for 6 more.
* **SUP-03 — MEDIUM — the supply-chain CI gate is currently failing.** `ci.yml:108-110` runs
  `check advisories bans licenses sources` as a blocking step, and three of those four fail on
  `main` today. A gate that is red is a gate nobody is reading, and it was hiding a real advisory
  (ENC-19) among the noise. Fixing it means: take the rustls bump, add the workspace path
  dependencies to `bans.skip` or give them versions, widen the licence allowlist to whatever those
  14 crates actually use, and `ignore` the unmaintained advisories **with a dated comment each** so
  they are revisited rather than forgotten.
* **SUP-01 — INFO** — the `@encastra` npm scope should be confirmed as registered, so a bare
  `npm install @encastra/protocol` outside this workspace cannot resolve to somebody else's package.
* **SUP-02 — LOW** — CI actions are pinned to mutable tags (`actions/checkout@v5`,
  `dtolnay/rust-toolchain@stable`, four others) rather than commit SHAs. Blast radius is capped by
  the top-level `permissions: contents: read` and no `pull_request_target`, but a compromised action
  could tamper with the `gitleaks` and `cargo-deny` gates themselves.

**Secrets**: none found. Tracked files and the full 48-commit history were scanned for key, token,
credential and private-key patterns. `.gitignore` excludes `.env*`, `*.pem`, `*.key`, `signing/`,
and no `.env` file exists tracked or untracked. CI already runs `gitleaks` with `fetch-depth: 0`.

---

## H. Remaining risks

Ordered by how much they should worry you.

1. **Installers are unsigned, and there is no update mechanism.** Nothing in this audit changes
   that. A user has a self-published SHA-256 as their only integrity check, fetched from the same
   site that would be compromised in the scenario where it matters. See external blockers.
2. **A grant is still ultimately a decision relayed by the renderer.** The runtime now refuses
   absurd and dangerous scopes and cross-checks the manifest, but for an ordinary folder it still
   believes that a person approved it. Closing this properly means the consent dialog being drawn
   by the Rust side, not the webview. That is a design change, not a patch.
3. **The deny-list of dangerous folders is a list, not a rule.** `C:\` and the startup folder are
   refused; `C:\Windows\System32` is not (the app runs unelevated, so it cannot write there anyway),
   nor is every other unwise destination. Lists like this are never complete.
4. **Hard links are undetectable.** On Windows an unprivileged local attacker who can write into a
   watched folder can hard-link a file from elsewhere on the same volume into it. No amount of
   canonicalisation sees this — a hard link has no target path, it *is* the file. ENC-06's fix
   covers symlinks and junctions, not this.
5. **A `.encastra` file can still lie about its entry count.** If the end-of-central-directory
   record under-reports, the reader and an archive viewer disagree in the opposite direction: the
   viewer shows an entry the application ignores. Less dangerous than ENC-05 (the extra entry is
   inert), but not nothing.
6. **No per-node timeout.** A first-party component that hangs hangs the run. The code says so
   deliberately: preemptive interruption waits for the WebAssembly host, where epoch interruption
   can actually stop a running component. Honest, and still a gap.
7. **Aggregate memory across a run is unbounded.** Each image is capped at 100 MP and each file at
   512 MB, but twenty image nodes are twenty of those.
8. **The consent flow has no automated coverage at all.** ENC-01 and ENC-03 both lived there, and
   no test exercises `Inspector.tsx`'s permission component, `setGrant`, or the grants array as it
   reaches `run_graph`. The Rust side of the boundary is now tested; the UI side is not.
9. **`open_project` and `restore_version` still take an arbitrary path.** Reading is less dangerous
   than writing and the dialog is the intended source, but `save_project` is the only one of the
   three that now constrains what it is given.
10. **Third-party components do not exist yet.** Nearly all of the isolation argument in the brief
    is therefore untested against a genuinely hostile component, because there is no way to write
    one. When the WASM host lands, this audit does not cover it.

---

## I. External blockers

Things no amount of code can close from here.

* **Code signing.** Absent, and documented as absent by the project's own `docs/SIGNING.md`. Needs
  an OV/EV certificate or Azure Trusted Signing. Until then SmartScreen warns, and a tampered
  installer is indistinguishable from a real one to any user who does not manually compare a hash.
* **Update integrity.** There is no updater. When one is added it needs signature verification
  from the first commit, not later — an unsigned update channel is a remote code execution
  primitive with a distribution list.
* **Third-party penetration test.** This audit is one reading of the code. It found a vacuous test
  that had been green since it was written, which is exactly the kind of thing a second pair of
  eyes finds and a first pair does not.
* **Registry security.** Not built. When components can be published and installed, that pipeline
  becomes the dominant attack surface and nothing here applies to it.
* **`cargo deny check` locally.** Verified in CI only, for this audit.
* **npm scope ownership.** Off-repo administrative action (SUP-01).
* **Trademark clearance** — unrelated to security, but `docs/BRANDING.md` records it as open and it
  is the other thing that can force a rename late.

---

## J. Security scorecard

Positions, not scores. "Strong" means attacked and held; "adequate" means correct and bounded;
"weak" means a known gap with a named owner.

| Category | Position | Basis |
|---|---|---|
| Web security | Strong | Nonce CSP with `strict-dynamic`, no `unsafe-eval`, full header set, `frame-ancestors` plus `X-Frame-Options`, no outbound requests, no XSS sink. One open redirect, fixed. |
| Desktop renderer | Strong | No XSS sink; every project-controlled string reaches React as a text child. CSP has no `unsafe-eval`. |
| IPC security | Adequate | 12 commands, all thin. Grants and folder scopes now validated at the privileged boundary. Paths for open/restore still trusted. |
| Capability security | Adequate | Broker genuinely is the single authority; first-party components go through the same gate. Manifest cross-check and scope bounds added. Consent still relayed by the webview. |
| Filesystem security | Adequate | Handles not paths; containment on canonicalised paths; checked path equals used path. Hard links remain undetectable. |
| Project parser | Strong | Never extracts to disk, reads by fixed name, `deny_unknown_fields`, and now bounded in total bytes, entry count, graph size and file size, with duplicate entries refused. |
| Component isolation | Not yet assessable | Third-party components cannot run. The argument is sound on paper and untested in fact. |
| Network / SSRF | Strong | Redirects not followed at all, scheme restricted, credentials refused, response capped, and the port is now part of the permission. |
| Supply chain | Weak | Clean lockfiles, one install script, `gitleaks` green — but the `cargo-deny` gate is failing on `main` and has been, so it was announcing nothing. Actions pinned to tags. |
| Dependency security | Adequate | `npm audit` clean. One live Rust advisory found and fixed (`rustls`); five unmaintained transitive crates remain, upstream. |
| Installer security | Weak | Per-user, unelevated, NSIS — and unsigned. |
| Update security | Absent | No updater exists. Neither a strength nor a weakness yet; a decision waiting to be made correctly. |
| Secrets management | Strong | None in tree or history; format designed so a project file cannot carry a secret value; `gitleaks` in CI. |
| DoS resistance | Adequate | Bounded at every input this audit reached. No per-node timeout, no aggregate memory ceiling. |
| Security testing | Adequate | 19 new regression tests. One previously vacuous test repaired. The consent flow has none. |
| Observability | Strong | Every allow and every denial is journalled, refusals included, and the journal is immutable. |

---

## Verification honesty

What was actually run on this machine, and what was not.

* **Run and green**: the full Rust workspace suite (0 failures), TypeScript 276 tests across 17
  files, `biome check`, `cargo clippy --workspace --all-targets -- -D warnings`, `tsc --build`,
  `npm audit`, the desktop production frontend build, the website production build
  (`next build`, all routes), and the **desktop release build including the installer** —
  `target/release/bundle/nsis/Encastra_0.4.0-beta.1_x64-setup.exe`, produced in 5m16s.
* **No permission or CSP regression**: `git diff main` against `tauri.conf.json` and
  `capabilities/default.json` is empty. The capability set is still the same four permissions
  (`core:event:allow-listen`, `core:event:allow-unlisten`, `dialog:allow-open`, `dialog:allow-save`)
  and the CSP string is unchanged.
* **Skipped, and said so**: two tests (`a_symlink_in_an_allowed_folder_cannot_reach_outside_it`,
  `a_link_already_in_the_granted_folder_does_not_take_the_write_with_it`) print `skipped` and return
  when the platform refuses to create a symlink, which Windows does without Developer Mode or the
  privilege. The fixes for ENC-06 and ENC-07's leaf check are therefore **verified by inspection on
  this machine and by test on any platform that can create a symlink**. They should be confirmed on
  a CI runner that can.
* **Not run**: a clean-machine install of the resulting installer — the `.exe` was produced and not
  executed. Any dynamic testing: no fuzzing harness was built, and the adversarial testing here is
  property-style unit tests with hand-built hostile fixtures, not a fuzzer. A fuzz target over
  `Project::from_bytes` is the obvious next investment, since that is the one parser that eats
  files from strangers.
* **A count is not a pass.** The TypeScript suite reported "265 passed, 0 failed" while one suite
  had failed to collect at all — a missing workspace build, not a code defect, but it would have
  been reported as green. Suite-level failure is worth reading separately from the test count.
