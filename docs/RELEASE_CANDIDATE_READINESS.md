# Release candidate readiness — 0.5.0 line, written 2026-09-15

**Verdict: RELEASE CANDIDATE — BLOCKED.** The blockers are external, named, and each has an
owner, an exact action and the evidence that would close it (§13). Everything that can be done
from the repository has been done and is listed with how it was verified. Nothing in this
document is a certification: it is the project's own account of its state, and §12 is an
adversarial review of that account by a second model with the questions it was asked.

Vocabulary, used strictly: **IMPLEMENTED** (code exists), **TESTED** (an automated test
exercises it and passed in the run named), **RUNTIME VERIFIED** (observed on the built
artefact), **CI EXECUTED** (a run on GitHub Actions with a URL), **NOT VERIFIED**, **BLOCKED**
(cannot be done from the repository), **ACCEPTED RISK** (decided, with the reason).

---

## 1. Repository state

| | |
|---|---|
| Remote | `github.com/alexlincai123-sketch/encastra`, private, created 2026-09-15 |
| Frozen beta | `v0.5.0-beta.1` → publication commit `7608bb1`, build commit `349b2ff`; hashes in `docs/RELEASE.md`; unsigned; not modified by this work |
| Release-candidate branch | `feat/rc` (see §14 for the integration order and the final SHA) |
| Waves integrated | `rc/release` (release engineering, CI, docs), `rc/consent` (folder and file consent by purpose), `rc/errors` (typed, localised errors), `rc/import-policy` (import state machine, library byte ceiling), `rc/commercial-closure` (release identity and verdict scripts, legal drafts, pentest handoff — by the security session) |
| Working tree at the end | clean; every worktree listed in §14 |

## 2. Engineering debt closed in this cycle

Each item was open in the vault's "lo siguiente con valor real" list or in the security
closure report of 2026-09-15. Status names the evidence.

| Item | Status | Evidence |
|---|---|---|
| Rust-side errors reach the UI typed and localised in six languages | see §14 (wave `rc/errors`) | Rust: one `kind` per variant asserted; TS: every kind has a key in every locale, and a non-English locale must differ from English |
| `chosen_folders` split by purpose (`publish-into`, `import-from`, `grant-to-component`, `projects-location`) | IMPLEMENTED, TESTED | `apps/desktop/src-tauri/src/lib.rs` tests: purpose matrix 4×4, wrong purpose, forged purpose, `..`/case/trailing-separator/verbatim/junction substitution, fresh `Runtime` empty and nothing written to disk, IPC bypass with a never-chosen path at all three gates. Follow-up `choose_file` for run inputs: see §14 |
| Import busy state machine IDLE → BUSY → SUCCESS/ERROR/CANCELLED | see §14 (wave `rc/import-policy`) | pure reducer, every legal and illegal transition tested; Close/Escape inert while BUSY |
| `MAX_LIBRARY_BYTES` with staging space, concurrent imports, rollback, cleanup | see §14 (wave `rc/import-policy`) | adversarial tests including two simultaneous imports into a library with room for one |
| ENC-NEW-22: the manifest refuses installers of another version/commit | IMPLEMENTED, TESTED | `scripts/release_manifest.py` `artefact_problems`: other version in the name, no version in the name, older than the binary → exit 4; `--verify` refuses an installer the manifest does not describe. `scripts/tests/test_release_manifest.py` (+4) |
| `.encastra` bytes independent of the platform that wrote them | IMPLEMENTED, TESTED, CI EXECUTED | found by the first Linux CI run (fuzz corpus differed by the ZIP "version made by" byte); pinned to Unix in `deterministic_options`; test reads the central directory |
| Generated artefacts gated locally, not only in CI | IMPLEMENTED | `CLAUDE.md` gate: conformance matrix, fuzz corpus, third-party inventory, version, release scripts |

## 3. Tests and gates

Final numbers are in §14, from raw logs (the `rtk` hook summarises `cargo test` output and
hides failures; every count here was read from a redirected log, not from the summary).

## 4. CI, executed

`docs/security/CI_SECURITY.md` §4 is the run table with URLs and outcomes; the short form:

- The first push of `main` ran CI for real. TypeScript, supply chain, secret scanning,
  Rust on Windows and Rust on macOS passed. **Rust on Linux failed**: the committed fuzz corpus
  was stale, and behind that, platform-dependent. Both fixed; the second and third runs are in
  the table.
- The release workflow, dispatched on the frozen tag, **failed its gates**: gitleaks over the
  full history found the fake API key the review tests use. Allowlisted by exact value.
- The Linux job is the one that runs the symlink-escape suites Windows cannot; its anti-skip
  greps are the gate that turns "passed" into "ran". They execute only after the corpus gate,
  which is why the first run never reached them.
- Hardening applied before any of this was trusted: every action pinned to a SHA, tokens not
  persisted, read-only `GITHUB_TOKEN`, no `pull_request_target`, no cache and a full clone in
  the release build, macOS opt-in.

**No branch protection or required checks are configured** — repository settings, not files,
and on a one-person repository they protect against habit only. Listed so it is not mistaken
for done.

## 5. Supply chain

- `cargo deny check advisories bans licenses sources`: passes; six unmaintained-crate
  advisories ignored individually with a reason and a revisit date (2026-12-15), all in the
  GTK/Linux path or Unicode tables, none with a vulnerability.
- `npm audit --audit-level=high`: 0.
- `docs/THIRD-PARTY.md`: 295 crates in the shipped executable, 27 npm packages in the shipped
  frontend, generated, CI-checked. Licence census of the Rust side: MIT/Apache-2.0 dual for
  the large majority; MPL-2.0 ×5 (file-level copyleft, unmodified), BSL-1.0 ×2, Unicode-3.0,
  ISC, Zlib, CDLA-Permissive-2.0 (webpki-roots); nothing work-level copyleft.
- Dependabot: cargo, npm, github-actions, weekly, grouped; six pull requests on day one, none
  merged here (dependency policy `docs/adr/0010`).
- Actions pinned to SHAs; the resolution date is in the comment beside each.
- **Not done:** SBOM in a machine format; signed attestation of the build (needs signing).

## 6. Release engineering

- Reproducibility: the frozen beta's build commit was built twice in clean worktrees and once
  by the security session: byte-identical (`/Brepro`, commit stamp, NSIS date hook). For the
  RC: see §14.
- The manifest chain (`release_manifest.py`): stamp present, clean, equal to HEAD; installers
  are this version's and not older than the binary; `--allow-unsigned` refused for a
  non-pre-release; `--require-signature` refuses unsigned and refuses "cannot check";
  `--verify` compares hashes, ancestry, publication-only diffs and the website's copy.
- `release.yml`: gates re-run, build from the manifest's build commit on a full clone with no
  cache, reproduce the published hashes (unsigned) or regenerate as signed
  (`--require-signature`), an explicit `allow_unsigned` input for pre-releases, and an
  `install` job that installs the artefact on a hosted Windows runner that has never seen
  Encastra and uninstalls it.
- Benchmark: `scripts/bench_graph.py`, `docs/audits/bench-cfc9497.md`.

## 7. Installation on a clean machine

| Path | Status |
|---|---|
| Clean Windows VM on this machine | **BLOCKED — EXTERNAL INFRASTRUCTURE.** Windows 11 Home: no Hyper-V, no Windows Sandbox; no Docker, no VirtualBox installed. Enabling any of them is a machine-level change the owner makes |
| Hosted Windows runner (`release.yml` → `install`) | IMPLEMENTED; executes at the next tag (§14). Covers silent install, version, stamp, HKCU entry, nothing under HKLM, shortcut, ACL, first launch stays up, uninstall leaves nothing. Does **not** cover the native folder chooser |
| This machine, real install of the beta | done 2026-09-15 by the security session for `c975bd4` (`docs/audits/2026-09-15-final-release-readiness.md`); the final `349b2ff` build was not installed |
| Native chooser journeys by a person | executed by GUI automation on `c975bd4` (17/17); **not repeated on the RC**, whose chooser now takes a purpose |

## 8. Signing

**BLOCKED — EXTERNAL (identity, money).** `docs/SIGNING.md` is current against Microsoft's
comparison page of 2026-08-29: Azure Artifact Signing is closed to individuals outside the USA
and Canada; the publisher is one person in Spain; the route is an OV certificate as an
individual (identity validation, hardware token or the CA's cloud HSM, of the order of
$150–300/year) or an EU-registered organisation, which is the same legal-identity decision the
licence waits on. EV buys nothing extra for SmartScreen since 2024. SmartScreen will warn on
the first signed releases regardless; a consistent signing identity is what ends that.

The pipeline is ready for the day it lifts: the certificate arrives as a secret, the thumbprint
as a config overlay, the manifest regenerates as signed and refuses anything else, and a
production version cannot be published unsigned by anybody.

## 9. Security

- Pentest: `docs/security/PENTEST_SCOPE.md` (scope, boundaries, what is accepted, how to
  reproduce the project's own checks) and `docs/security/PENTEST_HANDOFF.md` (security
  session). The freeze for the tester is the RC tag and its hashes (§14). **The test itself is
  BLOCKED — EXTERNAL (provider, money):** nobody outside the repository has examined it.
- AI agents: `docs/security/AI-AGENT-SURFACE.md` — the three positions an agent can hold, what
  each reaches, what is tested, and the honest limit (a shared desktop session cannot tell the
  user from software acting as the user; nothing the editor process alone says becomes a
  permission).
- Observability: nothing is collected, nothing is sent, stated in Settings as a fact
  (`docs/OBSERVABILITY.md`); the local journal is the diagnostic.
- Internal audits and their closure: `docs/security/2026-09-15-security-closure-report.md`,
  `docs/audits/2026-09-15-final-release-readiness.md`.

## 10. Legal

| Item | Status |
|---|---|
| Licence | **BLOCKED — LEGAL, owner's decision.** `UNLICENSED` means no rights granted, on purpose. Structure in place: `NOTICE`, `docs/THIRD-PARTY.md`, `deny.toml` allowlist, `docs/LICENSING.md` with the options and a recommendation, `docs/legal/LICENSE_DECISION.md` (security session). Not invented: no `LICENSE` file, no copyright holder asserted |
| Trademark | **BLOCKED — LEGAL, external.** No professional clearance search. Web search on 2026-09-15 found no registered mark "Encastra"; USPTO, EUIPO and TMview could not be queried from here (TMview's API reset the connection; the others need a browser session). `encastra.com` is registered to a third party since 2020 (`docs/BRANDING.md`). Exact action: a knockout and full clearance search in classes 9 and 42, US + EU + ES, by a trademark attorney, before the name is used commercially |
| Commercial documents | drafts exist and say they are drafts: website `apps/web/src/config/legal.ts` (privacy, terms, EULA, AUP, security disclosure, cookies, trademark, third-party notices, refunds) and `docs/legal/*` (security session). None reviewed by counsel; the third-party notices draft now points at the generated inventory instead of saying none exists |

## 11. Commercial architecture, validated against the code

- **Marketplace and backend: designed, not built** (`docs/PLATFORM-ARCHITECTURE.md` §2–4,
  `docs/THREAT-MODEL.md` T2/T3/T6). The code carries no commission rate, no price, no
  entitlement check that a client could be trusted with: `crates/encastra-publish/src/money.rs`
  says so in its header and `may_install` only distinguishes free from "needs an entitlement
  the server would have to issue". `Pricing::Free` is the only variant a publication can carry
  today. The website's pricing page describes the free beta. Server-authoritative is a stated
  rule, not an implementation, and nothing in the tree contradicts it.
- **WebAssembly sandbox: not built** (`docs/adr/0001`). No third-party component can run.
  The README, the ecosystem page and the platform document say so in the present tense.
- **Ordering that must not bend** (`docs/PLATFORM-ARCHITECTURE.md` §6): external security
  review → sandbox → signing → licence → registry → legal review → money.

## 12. Adversarial review

See §14: the three questions and the answers as given.

## 13. Blockers

| # | Blocker | Owner | Why it blocks | Exact action | Depends on | Evidence that closes it |
|---|---|---|---|---|---|---|
| B1 | No code-signing certificate | owner | an unsigned installer cannot be told from a tampered one; SmartScreen blocks; `--require-signature` refuses | decide the legal identity; buy an OV certificate (individual, identity-validated, token or cloud HSM) or register an EU organisation and enrol in Azure Artifact Signing; put the PFX + password in the two repository secrets | legal identity (B2) | `release.yml` run with `HAS_CERTIFICATE=true` whose `--require-signature` passes and whose manifest says `signed: true` |
| B2 | No licence / legal identity | owner (+ counsel) | nobody has any rights to the software; no EULA can bind; no signing identity | choose between the options in `docs/LICENSING.md`; record the copyright holder; add `LICENSE`, fix `Cargo.toml` `license` to an SPDX id or `LicenseRef-…` | none | a commit with `LICENSE`, `NOTICE` naming the holder, `cargo deny` green, drafts updated by counsel |
| B3 | Trademark not cleared | owner (+ trademark attorney) | the name may infringe; a domain is already taken | professional clearance search, classes 9 and 42, US + EU + ES; decide on filing | none | the search report; a filing receipt if filed |
| B4 | No external security assessment | owner (+ provider) | every claim in the security documents is the project's own | contract a pentest against the RC tag using `PENTEST_SCOPE.md`/`PENTEST_HANDOFF.md` | RC tag (§14) | the report and the fixes it produces |
| B5 | No clean-VM walkthrough with a person | owner | the chooser journeys on the RC have not been done on a machine that never ran Encastra | any Windows 10/11 VM or spare machine: run `scripts/verify/install_check.ps1` then `scripts/verify/gui_chooser.ps1`; or enable Hyper-V/Sandbox on a Pro edition | none | the two scripts' PASS lines and a screenshot of the chooser flows, attached to `docs/audits/` |
| B6 | Branch protection / required checks | owner | repository settings; not files | enable on `main`: require the CI workflow, no force-push | remote (done) | settings page |

None of these is a code change. Everything that is a code change is in §2, §4–6 and §14.

## 14. Integration record, final numbers, adversarial answers, self-critique

Filled at integration; see the end of this document.
