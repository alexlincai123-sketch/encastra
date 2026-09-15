# Release candidate readiness — Encastra 0.5.0-rc.2, written 2026-09-15

**Verdict: RELEASE CANDIDATE — BLOCKED.** Five blockers are external (a certificate, a licence
and a legal identity, a trademark clearance, an external security assessment, a repository
plan) and each has an owner, an exact action and the evidence that would close it (§13). Two
are internal and are stated as such: the four native chooser flows that gate permissions have
never been driven end to end by a person or by GUI automation on any build (§7, B5), and the
candidate's bytes are reproducible on the developer machine but **were not reproduced by the
hosted Windows runner** (§6, B7) — found by the release workflow itself on rc.1, under
analysis on rc.2. Everything else that can be done from the repository has been done, and §14
says how it was verified — including what the second model that reviewed this document said
before it was fixed, and what CI found after that.

Nothing here is a certification. It is the project's own account, written by the session that
did the work, with an adversarial review by a second model (§12) whose findings were acted on
and are listed with what changed.

Vocabulary, used strictly: **IMPLEMENTED** (code exists), **TESTED** (an automated test
exercises it and passed in the run named), **RUNTIME VERIFIED** (observed on the built
artefact), **CI EXECUTED** (a run on GitHub Actions with a URL), **NOT VERIFIED**, **BLOCKED**
(cannot be done from the repository), **ACCEPTED RISK** (decided, with the reason).

---

## 1. Repository state

| | |
|---|---|
| Remote | `github.com/alexlincai123-sketch/encastra`, private, free plan, created 2026-09-15 |
| Frozen beta | `v0.5.0-beta.1` → publication commit `7608bb1`, build commit `349b2ff`; not modified |
| **Candidate** | **`v0.5.0-rc.2`** → publication commit `8d96366`, **build commit `90e479d`**; `docs/RELEASE.md` at the tag holds the hashes; unsigned, on record |
| Superseded | `v0.5.0-rc.1` (publication `ea1ad29`, build `137c93a`): its own CI run failed at the fuzz-corpus gate (the seed carried the runtime version and went stale with the bump — fixed by making the seed version-independent and by one command that checks every generated artefact), and its release run showed the hosted runner does not reproduce the developer machine's bytes (B7). Same code otherwise; rc.2 differs from it by the seed, the generated-artefacts check, the version and the runner-build upload |
| Branch | `feat/rc` (36 commits over `main` at the rc.2 publication commit; merged into `main` at the end of this cycle — §14) |
| Waves integrated, in order | `rc/release` (release engineering, CI, inventories, docs) · `rc/errors` (typed, localised refusals; status-bar messages) · `rc/import-policy` (import state machine; library byte ceiling) · `rc/consent` (folder and file consent by purpose; `choose_file`) · `rc/commercial-closure` (artefact identity from the artefact, one release verdict, reproduce script, hand-off and legal drafts — by the security session `akuinu-28`) · the adversarial review's fixes |
| Working tree | clean at every build; the build commit's binary states its own commit |

## 2. Engineering debt closed in this cycle

| Item | Status | Evidence |
|---|---|---|
| Rust-side refusals reach the UI typed and localised in six languages (83 kinds → 34 `AppError` + nested project/library/bundle/import vocabularies; 5 status-bar messages) | IMPLEMENTED, TESTED | `apps/desktop/src-tauri/src/error.rs` exhaustive `kind()`; fixture `apps/desktop/test/fixtures/error-kinds.json` written by a Rust test and replayed by `apps/desktop/test/errors.test.ts` (every tag has a key in all six locales; every non-English sentence differs from English; no unfilled placeholder). `docs/desktop/ERRORS.md` |
| Consent by purpose: `publish-into`, `import-from`, `grant-to-component`, `projects-location`; a file chooser on the privileged side (`run-input`) | IMPLEMENTED, TESTED, RUNTIME VERIFIED (refusal side) | `lib.rs` tests: purpose matrix, wrong and forged purpose, `..`/case/separator/verbatim/junction substitution, fresh runtime empty and nothing written to disk, IPC bypass at every gate, a stored input path is not a choice. Runtime: `docs/audits/2026-09-15-rc-runtime-qa.md` (23/23). The junction test is now grep-gated on Windows in CI (it could print `skipped` and pass) |
| Import as a state machine (`idle → busy(choosing/inspecting/importing) → success/error/cancelled → idle`) | IMPLEMENTED, TESTED | pure reducer, all 64 state×event pairs tested; Close/Escape inert and Import disabled while busy; a second `beginImport` is a refused no-op; the window will not close over an import — the flag is set by `import_publication` itself, not by the editor (see §12, F6) |
| `MAX_LIBRARY_BYTES` = 4 GiB with staging counted, reservation under the index lock, rollback, sweep | IMPLEMENTED, TESTED | `crates/encastra-library/tests/library_bytes.rs`; desktop `ceiling::*` (two threads into room for one — exactly one lands; index-save failure rolls the copy back; sweep at load); `adaptive_attacker` reservation strategy. ENC-NEW-16 closed |
| ENC-NEW-22: an installer that is not this build's is refused — by name, by age, and by the `VS_VERSIONINFO` resource inside the bytes | IMPLEMENTED, TESTED | `release_manifest.py` `artefact_problems`; `release_identity.py --check` (exit 6); tests in `scripts/tests` |
| A production version is never published unsigned, whatever the flags | IMPLEMENTED, TESTED | found by the review (§12, F3): the bare invocation used to write and exit 0. Now exit 3 with no flag able to change it; `test_an_unsigned_production_version_is_refused_without_any_flag` |
| Long commands leave the main thread | IMPLEMENTED, RUNTIME VERIFIED | `#[tauri::command(async)]` on twelve commands; measured: a 438 ms `save_project`+`open_project` did not delay an `about` (40 ms) issued during it |
| A run never replaces a file in a granted folder | IMPLEMENTED, TESTED | `broker::save_to` refuses an existing name (a link of that name was already refused); test: the file that was there is untouched, another name lands |
| `.encastra` bytes independent of the platform that wrote them | IMPLEMENTED, TESTED, CI EXECUTED | the first Linux run found the ZIP "version made by" byte; pinned; test reads the central directory |
| `Cargo.lock` part of the version bump and of the check | IMPLEMENTED | the first rc.1 build came out `-dirty` because cargo rewrote the lock; `version.py --sync` writes it, `--check` fails on it, CI runs `--locked` |
| The IPC surface held to its documentation and its callers | TESTED | `apps/desktop/test/ipc-surface.test.ts`: 22 commands, each named in `docs/DESKTOP.md`, each invoked from `ipc.ts` or listed as tooling |
| Generated artefacts gated locally, not only in CI | IMPLEMENTED | `CLAUDE.md` gate: conformance matrix, fuzz corpus, third-party inventory, version + lock, release scripts |

Not closed, and said so: the `NodeError` codes shown in the run journal are still English
(`code` now travels typed; the sentences do not); `NodeError` inside a `trigger-error` status
message is quoted verbatim inside a translated sentence.

## 3. Tests and gates at the build commit (raw logs, not the `rtk` summary)

| Gate | Result |
|---|---|
| `cargo test --workspace --locked` | **358 passed, 0 failed, 29 suites**; no `skipped` line |
| `cargo clippy --workspace --all-targets --locked -- -D warnings` | clean |
| `cargo fmt --all --check` | clean |
| `vitest run` | **652 passed, 0 failed, 33 files** |
| `biome check .` | clean (233 files) |
| `tsc --noEmit` web and desktop | clean |
| `python -m unittest discover -s scripts/tests` | **52 passed** |
| `cargo deny check advisories bans licenses sources` | ok (six dated, reasoned ignores; no vulnerability) |
| `npm audit --audit-level=high` | 0 |
| `scripts/third_party.py --check`, `scripts/version.py --check`, conformance matrix, fuzz corpus | all match the tree |
| `release_identity.py --check` on the artefacts | exit 0: `137c93a`, `0.5.0-rc.1` in every artefact |
| `release_manifest.py --verify` at the publication commit | consistent |

Baseline at the start of the cycle (`main` @ `f2446b5`): cargo 316 / vitest 502 / scripts 22.

## 4. CI, executed

`docs/security/CI_SECURITY.md` §4 is the run table with URLs. The short form:

- Before this cycle the workflows had never run (no remote). Six runs now exist. The first push
  of `main` found a stale, platform-dependent fuzz corpus on Linux; the first release dispatch
  found a test fixture gitleaks reads as a key; the first run on the hardened branch found the
  allowlist written in a table gitleaks ignores. All three fixed; run **34971056791** on
  `rc/release` @ `ae81122` is fully green with every anti-skip gate executed.
- **rc.1's own tree** was dispatched as run **34978855319**: **Rust Linux ✗** — the fuzz-corpus
  gate again, because `Project::new` writes the runtime version into the seed and the bump had
  changed it; the local check that catches this exists and was not run before the tag. The tag
  push started **34978855610**: gates ✓, build ✓, artefact identity ✓, **reproduction of the
  published hashes ✗** — the hosted runner's bytes differ from the developer machine's (B7).
  The dispatch **34978859110** is the same workflow with the unsigned decision on record.
- **rc.2** (seed version-independent; `scripts/generated_check.py` in the local gate and in the
  verdict; the runner's build uploaded even when it does not reproduce, so it can be diffed):
  CI **34981764114** on the publication commit, release **34981765564** (tag push) and
  **34981768456** (dispatch, `allow_unsigned=true`). Outcomes in `CI_SECURITY.md` §4.1 and §14.
- Hardening applied before any run was trusted: actions pinned to SHAs, tokens not persisted,
  read-only `GITHUB_TOKEN`, no `pull_request_target`, no cache and a full clone in the release
  build, `--locked`, macOS opt-in, unsigned refused without an explicit dispatch input.
- Not there: branch protection (**impossible on this plan for a private repository** — B6).

## 5. Supply chain

- `docs/THIRD-PARTY.md`: 295 crates in the shipped executable, 27 npm packages in the shipped
  frontend, generated, CI-checked. Licence census: MIT/Apache-2.0 dual for the large majority;
  MPL-2.0 ×5 (file-level, unmodified), BSL-1.0 ×2, Unicode-3.0, ISC, Zlib, CDLA-Permissive-2.0;
  nothing work-level copyleft. **The executable bundles `rustls` 0.23 and `ring` 0.17** — the
  legal drafts said otherwise until the review caught it (§12, F10).
- Dependabot: six pull requests on day one, four of them red in CI (major bumps of `checkout`,
  `setup-node`, `upload-artifact`, `@types/node`), none merged (`docs/adr/0010`); the runs they
  start cost minutes, so two were cancelled.
- Not done: SBOM in a machine format; a signed attestation of the build (needs B1).

## 6. Release engineering

- **Reproducibility, on one machine:** `scripts/verify/reproduce.py` builds the build commit
  twice in two fresh worktrees (short and long paths) and compares bytes. On `137c93a`: the
  in-tree build and both fresh builds are byte-identical (installer `41168df8…`, executable
  `b5d98cef…`, 378 s and 403 s). The security session had the same result on `d527d46`. For
  `90e479d` see §14.
- **Reproducibility, across machines: NOT ACHIEVED (B7).** The release workflow builds the
  build commit on `windows-latest` and compares with the published hashes; on `137c93a` the
  runner produced installer `9725e01e…` and executable `8e5d6ae1…` against the published
  `41168df8…`/`b5d98cef…`. Same pinned rustc 1.98.1 and `package-lock.json`; the runner's MSVC
  toolset, NSIS and Node differ from this machine's (local toolset 14.44.35207, Node 24; the
  runner image's are in its log). `/Brepro` makes a build deterministic *for a toolchain*, not
  across toolchains. rc.2 uploads the runner's bytes so `scripts/pe_diff.py` can say which
  structures differ; until that says "linker metadata only" or the toolchains are made equal,
  the honest claim is: *two builds on the same machine match; a build elsewhere has not.*
- **The chain:** `version.py --set` (eight files and the lock) → clean build commit → build →
  `release_identity.py --check` → `release_manifest.py --allow-unsigned` (pre-release only;
  production refuses unsigned with no override) → publication commit → tag → `release.yml`
  dispatched with the decision on record. `release_check.py` writes the one-file verdict
  (`release-readiness.json`), including `version.unique`: one version, one binary.
- **What the written record may do:** Markdown under `docs/` may follow the publication commit
  (this document, the audits); anything else after it fails `--verify`, tested.
- **Benchmark:** `scripts/bench_graph.py`, `docs/audits/bench-cfc9497.md` — chain memory flat
  (12 → 36 MiB from 1 000 to 10 000 nodes), the 10 001st node refused in 50 ms, fan-out of
  2 000 at 193 MiB (the per-edge clone, ENC-NEW-05b, accepted).

## 7. Installation on a clean machine, and the chooser journeys

| Path | Status |
|---|---|
| Clean Windows VM on this machine | **BLOCKED — EXTERNAL INFRASTRUCTURE.** Windows 11 Home: no Hyper-V, no Windows Sandbox; no Docker, no VirtualBox. `docs/release/CLEAN_WINDOWS_VM.md` is the procedure |
| Hosted Windows runner (`release.yml` → `install`) | IMPLEMENTED; executes in run 34978859110: silent install, version, stamp, HKCU entry, nothing under HKLM, shortcut, ACL, first launch stays up, uninstall leaves nothing. It cannot drive a native chooser |
| Real install of the beta on this machine | done by the security session for `c975bd4`; the candidate was **not** installed here (the runtime QA ran the built executable) |
| **Native chooser journeys with a purpose** | **NOT VERIFIED on any build.** The 17/17 GUI run of 2026-09-15 drove Settings → Projects → Browse — `projects-location`, the one purpose that gates nothing. Publish-into, import-from, grant-to-component and the new file chooser have never been driven by a person or by `gui_chooser.ps1`. This is the internal blocker (B5): it needs a machine where nobody is working, and this session could not use this one for it |

## 8. Signing

**BLOCKED — EXTERNAL (identity, money).** `docs/SIGNING.md` and `docs/release/SIGNING_PIPELINE.md`
say what exists: Azure Artifact Signing is closed to individuals outside the USA and Canada;
the publisher is one person in Spain; the route is an OV certificate as an individual
(identity validation, hardware token or the CA's cloud HSM, of the order of $150–300/year) or
an EU-registered organisation. EV buys nothing extra for SmartScreen since 2024. The pipeline
refuses an unsigned production version at three places (manifest, release check, workflow), and
a signed build regenerates the manifest as signed; none of it has run with a certificate.

## 9. Security

- The candidate for a tester: `docs/security/PENTEST_SCOPE.md`, `docs/security/PENTEST_HANDOFF.md`
  (now naming `v0.5.0-rc.1`). **The test itself is BLOCKED — EXTERNAL (provider, money).**
- AI agents: `docs/security/AI-AGENT-SURFACE.md`; the IPC-surface test closes the gap it named.
- Observability: nothing collected, nothing sent (`docs/OBSERVABILITY.md`).
- Adversarial review of this cycle: §12.

## 10. Legal

| Item | Status |
|---|---|
| Licence | **BLOCKED — LEGAL, owner's decision.** `NOTICE`, `docs/THIRD-PARTY.md`, `deny.toml`, `docs/LICENSING.md`, `docs/legal/LICENSE_DECISION.md`. No `LICENSE`, no holder asserted |
| Trademark | **BLOCKED — LEGAL, external.** No clearance search; TMview reset the connection from here, USPTO/EUIPO need a browser session; `encastra.com` is a third party's since 2020. `docs/legal/TRADEMARK_CHECKLIST.md`, `docs/BRANDING.md` |
| Commercial documents | drafts, labelled as drafts, in `apps/web/src/config/legal.ts` and `docs/legal/*`; the export-control line corrected to say the binary bundles TLS libraries |

## 11. Commercial architecture, validated against the code

Marketplace, registry, accounts, payments: designed, not built (`docs/PLATFORM-ARCHITECTURE.md`,
`docs/THREAT-MODEL.md` T2/T3/T6). No commission rate, no price, no client-side entitlement in
the tree (`crates/encastra-publish/src/money.rs`; `Pricing::Free` is the only variant a
publication carries). WebAssembly sandbox: not built (`docs/adr/0001`), said so in the present
tense wherever it is mentioned. The ordering that must not bend: external security review →
sandbox → signing → licence → registry → legal review → money.

## 12. Adversarial review

A second model (Claude Fable 5.1) reviewed the tree and this document at `11c5df0`/`8efe710`,
read-only, with three questions: (1) what is claimed as done, verified or tested that the code,
the tests or the recorded evidence do not support; (2) the most likely real break the threat
model does not name; (3) the worst outcome if it shipped tomorrow, and whether the verdict is
honest. Its verdict on the verdict was **OVERSTATED**: "external blockers only" was false. Its
findings, and what happened to each:

| Id | Sev | Finding | Outcome |
|---|---|---|---|
| F1 | P1 | The RC tree had no CI run; the only green run was on an earlier commit | CI dispatched on the publication commit and the tag (§4); outcomes in `CI_SECURITY.md` §4.1 |
| F2 | P1 | "17/17 chooser journeys" drove only the purpose that gates nothing | Stated as the internal blocker B5 (§7); not claimed otherwise anywhere now |
| F3 | P1 | The manifest wrote an unsigned production release when invoked without flags | Fixed, tested (`260b0c9`) |
| F4 | P1 | The first rc.1 build was stamped `-dirty` (lock not bumped); CI never checked the lock | Fixed (`8efe710`, `--locked`) |
| F5 | P1 | Non-async commands ran on the main thread: a long run or import froze the window and every guard | Fixed; measured (§2) |
| F6 | P2 | `report_busy` let the editor pin the window closed; `closing` never cleared after a failed close | Command removed; the runtime sets the flag itself with a drop guard; `closing` cleared on failure |
| F7 | P2 | A poisoned mutex is reported as "busy" | Documented here as accepted for the candidate: a panic under the lock is itself the bug to fix; the sentence is misleading but safe (nothing proceeds) |
| F8 | P2 | `ERRORS.md` counted 21 commands / 29 tags against 23 / 34 | Regenerated (22 / 34 after F6) |
| F9 | P2 | The pentest hand-off froze the beta's bytes and quoted stale numbers | Rewritten against the tag |
| F10 | P2 | Legal drafts said the binary carries no cryptography; it bundles `rustls`/`ring` | Corrected in both drafts |
| F11 | P2 | B6's action (branch protection) is impossible on the plan | Stated (§4, §13) |
| F12 | P2 | The CI table omitted the green run; Dependabot PRs were red, not "none merged" | Table completed; §5 |
| F13 | P2 | The junction consent test could print `skipped` on Windows and pass | Anti-skip grep on Windows in CI |
| F14 | P2 | `save_to` truncated an existing file in a granted folder | Fixed, tested; threat model updated |
| F15 | P2 | An unsigned build from a tag push carried no recorded decision | Refused on a tag push; the dispatch input is the decision |
| F16 | P3 | Verdict written before §14; `site.ts` showed rc.1 over beta.1's hash until publication | This document; the publication commit |
| F17 | P3 | Sweep by mtime vs a clock jump; per-process byte lock across two instances | Documented in `LIMITS.md` as accepted |
| F18 | P3 | "The name appears in exactly three shapes" was false | `BRANDING.md` lists all of them |
| F19 | P3 | The two `.encastra` dialogs stay in the editor beside prose saying choosers moved | `DESKTOP.md` says which two stay and why a project path is not a permission |

The reviewer's answer to question 3 — the worst outcome for a tester — was data loss in a folder
they trusted (F5/F14), not a tampered installer. Both are fixed above; the honest residue is
that neither fix has been exercised through the GUI on this build (B5).

## 13. Blockers

| # | Blocker | Owner | Why it blocks | Exact action | Depends on | Evidence that closes it |
|---|---|---|---|---|---|---|
| B1 | No code-signing certificate | owner | an unsigned installer cannot be told from a tampered one; SmartScreen blocks; every gate refuses production unsigned | decide the legal identity; buy an OV certificate (individual, identity-validated, token or cloud HSM) or register an EU organisation and enrol in Azure Artifact Signing; add the two repository secrets | B2 | a `release.yml` run with `HAS_CERTIFICATE=true` whose `--require-signature` passes and whose manifest says `signed: true` |
| B2 | No licence / legal identity | owner (+ counsel) | nobody has any rights to the software; no EULA binds; no signing identity | choose among `docs/LICENSING.md`; record the holder; add `LICENSE`; set an SPDX id or `LicenseRef-…` | — | a commit with `LICENSE` and `NOTICE` naming the holder; `cargo deny` green; drafts reviewed |
| B3 | Trademark not cleared | owner (+ attorney) | the name may infringe; a domain is taken | clearance search, classes 9 and 42, US + EU + ES; decide on filing | — | the search report; a filing receipt if filed |
| B4 | No external security assessment | owner (+ provider) | every security claim is the project's own | contract a test against `v0.5.0-rc.1` with the hand-off | the tag (done) | the report and the fixes it produces |
| B5 | **Chooser journeys with a purpose never driven** | owner, or this project on a free machine | the permission-gating flows of this candidate have no GUI evidence on any build | on a machine where nobody is working: install the candidate, run `scripts/verify/install_check.ps1`, then `scripts/verify/gui_chooser.ps1` extended to publish-into, import-from, grant-to-component and the file chooser — or do the four flows by hand and attach the observations to `docs/audits/` | the candidate (done) | PASS lines for the four flows on `137c93a` |
| B6 | Branch protection unavailable | owner | a private repository on a free plan cannot protect `main` | GitHub Pro, or make the repository public (which is B2's decision) | B2 | the protection rule visible on `main` |
| B7 | **Bytes not reproduced across machines** | this project | "reproducible" currently means "on this machine"; a tester or a runner building the tag gets different bytes and cannot tell a toolchain difference from a tampered build | diff the runner's rc.2 build against the published bytes with `scripts/pe_diff.py`; if the difference is linker/toolchain metadata only, pin the toolset in CI (or publish the runner's build as the artefact and make the developer machine reproduce *it*); if it is code or data, find the source | rc.2 release run (uploads the runner's build) | `release.yml`'s "the build reproduces the published hashes" step green on a tag, or a documented equivalence with `pe_diff` output |

## 14. Integration record, final numbers, self-critique

**Commits that matter:** `main` @ `f2446b5` (start) → rc.1: build `137c93a`, publication `ea1ad29` → rc.2: build `90e479d`, publication `8d96366`, tag `v0.5.0-rc.2`. Per-wave commits: `rc/release` a0c81af…ae81122,
`rc/errors` 1ca6365, d3fe5d3, `rc/import-policy` 41ffa9d, 1a924be, `rc/consent` 369d688, aeff618,
`rc/commercial-closure` f7dcf0a…d5f1618, review fixes 260b0c9, 137c93a.

**Numbers:** §3. Runtime: 23/23 IPC checks and 3/3 main-thread checks on `137c93a` and again on
`90e479d` (`docs/audits/2026-09-15-rc-runtime-qa.md`).

**Reproducibility and CI outcomes for the candidate:** recorded in `CI_SECURITY.md` §4.1 and
below as they landed; a row that is empty at the commit you are reading means the run had not
finished when this file was committed, and the next docs-only commit fills it.

| Evidence | Outcome |
|---|---|
| `reproduce.py` on `137c93a` (rc.1) | **IDENTICAL** to the published bytes, both fresh builds |
| CI run 34978855319 (rc.1 tree) | **✗** Rust Linux at the fuzz-corpus gate (seed carried the version); TypeScript, supply chain, secrets, Rust Windows ✓ |
| Release run 34978855610 (rc.1, tag push) | gates ✓ · build ✓ · identity ✓ · **reproduction ✗** (B7); never reached the unsigned-decision step |
| Release run 34978859110 (rc.1, dispatch) | see the last commit of this file |
| `reproduce.py` on `90e479d` (rc.2) | see the last commit of this file |
| CI run 34981764114 (rc.2 tree) | see the last commit of this file |
| Release runs 34981765564 (tag push) / 34981768456 (dispatch) for rc.2 | see the last commit of this file; the runner's build is uploaded either way for `pe_diff` |

**Self-critique — twenty questions, answered without softening:**

1. *Did every number come from a raw log?* Yes; the `rtk` hook summarises `cargo test`, and every
   count here was read from a redirected file or an exit code.
2. *Is anything marked TESTED that a unit test of a helper covers?* The import state machine is a
   pure reducer tested as one; the panel's Close/Escape gating is tested at the store level, not
   in a rendered DOM (the repo has no DOM test environment). Said in §2.
3. *Did I merge anything I did not run?* No wave was merged before its own gate; the merged tree
   ran the whole gate again (§3).
4. *Was the tree clean at every build?* No — the first rc.1 build was dirty (F4). Fixed and gated.
5. *Did CI run on the bytes that were tagged?* Yes, and it failed rc.1 twice: a stale generated
   fixture I had not checked locally, and bytes the runner could not reproduce. rc.2 exists
   because of the first; B7 exists because of the second.
6. *Did I invent state?* The GUI-verification claim inherited from the beta was overstated (F2);
   it is now stated as never done.
7. *Did I weaken any test?* Two tests asserting that the editor reports busy were deleted because
   the mechanism they tested was removed as a hostage risk (F6); a test now checks the command
   is gone. Nothing else was loosened.
8. *Is the verdict honest?* BLOCKED, with one internal item, after a reviewer said the earlier
   draft was not.
9. *What did I not do that I could have?* Drive the four choosers by GUI — a person was using this
   machine and keystroke injection had already gone wrong once in this project. And run the
   generated-artefacts check before tagging rc.1: it was in the gate I had written that morning.
10. *Is anything "coming soon"?* No; grep finds none.
11. *Could an agent still turn text into a permission?* No path found; the IPC-surface test now
    holds the command list to the docs.
12. *Did the security session's work get reviewed?* Its scripts run in the release workflow and
    its tests in CI; two of its documents contained the false cryptography sentence (F10), found
    by the reviewer, corrected.
13. *Are the six languages real translations?* The test requires every non-English sentence to
    differ from English; that is necessary, not sufficient, and a native reader has not checked.
14. *Does the website say anything untrue?* `STATUS` flags unchanged (nothing new shipped for the
    site); the third-party notices draft now points at the generated inventory; the download
    page describes rc.1 after the publication commit.
15. *Is the byte ceiling enforced against a lying index?* Measured from disk, not summed from
    the index; hard links and sparse files over-count (safe direction).
16. *What about two instances?* Not handled (F17), documented.
17. *Did Dependabot cost anything?* Minutes; four red PRs are open and unmerged.
18. *Would I sign this?* No one should sign it: that is B1, B2 and B4.
19. *What is the next real risk?* The chooser flows (B5) and, after them, whatever an external
    tester finds (B4).
20. *Is the vault updated?* Yes — session note, `ESTADO_ACTUAL.md`, `NEXT_SESSION.md`.
