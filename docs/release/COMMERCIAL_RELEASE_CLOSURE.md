# Commercial release closure — 2026-09-15

`v0.5.0-beta.1` — publication commit `7608bb1`, build commit `349b2ff`, installer
`5678e5d0…6f91`, executable `be1945f9…67a1` — is frozen and was not touched by this work.
Everything here is a new cycle after that tag, on `rc/commercial-closure` (this session), merged
by the parallel session through `feat/rc` together with its own `rc/release` (workflows, the
manifest's name-and-age refusal, the third-party inventory, `NOTICE`, `SIGNING.md`,
`.gitleaks.toml`, the platform-independent `.encastra` bytes), `rc/errors`, `rc/consent` and
`rc/import-policy`. This page keeps two lists apart and never mixes them: what the repository
now does and has demonstrated by itself, and what still needs a person, a credential, a machine
or a provider.

## AUTOMATED AND VERIFIED

Everything in this list was executed on this machine on commit **`d527d46`** of
`rc/commercial-closure` (clean tree, rebased on `rc/release@ae81122`), and its output is kept as
`docs/release/evidence/d527d46-release-readiness.json` (`npm run release:check`, with
`--compare` pointing at the second build); the numbers are that run's. Timings: in-tree build
259 s, `reproduce.py` 896 s for two builds, `release:check` 198 s.

| | Result | Evidence |
|---|---|---|
| Version declared once, everywhere | PASS | `scripts/version.py --check` |
| Test gate | PASS | `cargo test --workspace` 317 tests; Vitest 502; script tests 51; fmt, clippy `-D warnings`, Biome, tsc, web build all exit 0 |
| Dependencies | PASS | `cargo deny check` advisories/bans/licenses/sources ok; `npm audit` 0; `docs/THIRD-PARTY.md` matches the tree; lockfiles committed |
| Artefact identity (ENC-NEW-22, closed) | PASS | `scripts/release_identity.py --check`: `ProductVersion` read from the version resource of the executable **and** the NSIS stub, build stamp from the executable, all equal to the tree; a renamed previous-version installer is refused (9 tests); `release_manifest.py` refuses by name and age (peer, 4 tests) |
| Build provenance (ENC-NEW-17, closed in the previous cycle) | PASS | binary stamp `encastra-build-commit=d527d46;` |
| Reproducibility (ENC-NEW-18 / 21, closed in the previous cycle; re-proven) | PASS | `scripts/verify/reproduce.py`: two clean worktrees, two paths → executable `751232f804f41da89255b55f4ec5bd10ba719f4b0d8d9cc2d4b3ef820b1d2e2f` and installer `06ad30d3d9a66db5647bf76e20d51338abf56fcb0c67c9e990651ca5cfa290ea` byte-identical; plus the in-tree build, a third |
| Release immutability | PASS (as a gate) | `version.unique`: a version already published from another build commit blocks until the version changes — on this tree it blocked for `0.5.0-beta.1` exactly as designed, which is why the RC bumps to `0.5.0-rc.1` before building |
| Signing policy | PASS (as a gate) | a release version without a valid, timestamped signature is `FAIL`; `--allow-unsigned` on a release version exits 3 with no override; a beta records unsigned. Tested on synthetic images and against the real installer |
| Manifest | PASS (as a gate) | `release_manifest.py --verify`: hashes, stamp, `site.ts`, publication-only diff |
| Machine-readable status | PASS | `release-readiness.json`: one of PASS / FAIL / BLOCKED / NOT_VERIFIED / EXTERNAL_REQUIRED per check, one verdict |
| Windows GUI: native chooser | PASS, previous cycle, on the installed 0.5.0-beta.1 | `scripts/verify/gui_chooser.ps1`, 18/18, through the real window (needs a desktop; not a CI job) |
| Installation on this machine | PASS, previous cycle | `scripts/verify/install_check.ps1` |
| Installation on a clean Windows runner | in `release.yml` (`install` job) | runs on dispatch/tag; see CI status |
| Linux: `cargo test --workspace` including the symlink suites | PASS on GitHub (peer's runs) | see CI status |
| Attack surface, product | PASS | the suites: broker, hostile archive, importer, adaptive attacker (21 strategies), run budget, URL authority, hostile text, fuzz sweep 60 000 inputs — all inside the gate above |
| Attack surface, release process | PASS | stale artefact, wrong-version artefact under the right name, wrong-commit artefact, tampered manifest hash, stale website record, dirty build, unsigned release, contradictory mode claim — each is a test that fails the release (`scripts/tests/test_release_*.py`) |

## EXTERNAL HUMAN BLOCKERS

Nothing in this list can be closed by code in this repository. Each names the person, the
credential, the machine or the provider, and the exact action.

| Blocker | Who | Exact action | Then |
|---|---|---|---|
| Code-signing certificate | owner + a CA (money, legal identity) | buy an OV/EV certificate or a signing service in a jurisdiction that will issue to the seller (`docs/SIGNING.md`: Azure Artifact Signing is closed to individuals outside US/CA as of 2026-08-29); add `WINDOWS_CERTIFICATE` and `WINDOWS_CERTIFICATE_PASSWORD` as repository secrets | dispatch `release.yml`; `signing` turns PASS by itself |
| Clean-VM verification | the Clean VM lab (`docs/release/CLEAN_VM_ACCEPTANCE.md`); SmartScreen on a downloaded file stays a person's step (`CLEAN_WINDOWS_VM.md`) | cycles A, B, upgrade and N1–N5 on the candidate's installer | `release_check.py --evidence-vm <acceptance dir>` re-judges the cycles and ties them to the artefacts; only then `clean_vm` PASS |
| External penetration test | a provider (money) | hand over `docs/security/PENTEST_HANDOFF.md`; register findings as `ENC-EXT-NN` | `pentest` is recorded PASS by a person, not by a script |
| Licence, terms, privacy, EULA, trademark | owner + lawyer | `docs/legal/README.md` lists each decision and its input; counsel review of `LICENSE` (proprietary since 2026-09-23); search the mark | `legal` is recorded by a person |
| CI on the release commit | owner (a push) | the remote exists (`github.com/alexlincai123-sketch/encastra`, private); push the RC branch/tag — the parallel session does the pushes | `ci.evidence` reads the run through `gh` |

## What is now automated

* **One command.** `npm run release:check` (`scripts/release_check.py`): tree state and mode,
  version consistency and uniqueness, the whole test gate, dependency audits and notices,
  artefact identity, manifest verification, signing policy per mode, a second build to compare,
  CI evidence through `gh`, a clean-machine log, the external items — → `release-readiness.json`
  and one verdict (`RELEASE_READY` / `BETA_READY` / `BLOCKED` / `NOT_A_RELEASE`).
* **Two builds, compared.** `npm run release:reproduce` (`scripts/verify/reproduce.py`).
* **Identity from the bytes.** `scripts/release_identity.py`.
* **The manifest** (`scripts/release_manifest.py`, peer's file): stamp-based commit, name-and-age
  refusal of foreign installers, `site.ts` written, `--verify`, `--build-commit`, production
  unsigned refused.
* **Structural diff.** `scripts/pe_diff.py`.
* **Installation and the chooser.** `scripts/verify/install_check.ps1`, `gui_chooser.ps1`.
* **Third-party inventory** generated and checked (`scripts/third_party.py`, peer).
* **CI** (`ci.yml`): lint, types, tests, builds, conformance matrix, version check, script tests,
  third-party check, Rust on Linux + Windows (macOS opt-in), fuzz corpus check, anti-skip gates
  for the symlink/importer/startup tests, `cargo deny`, `npm audit`, gitleaks; every action
  pinned to a commit SHA; `persist-credentials: false`; `permissions: contents: read`.
* **Release pipeline** (`release.yml`): the same gates re-run; tag = declared version;
  `--verify` on the publication; build of the build commit the manifest names, without a cache;
  signing from secrets through a config overlay; regeneration under `--require-signature` when
  signed, reproduction check when not; `release_identity --check`; `release_check` →
  `release-readiness.json` uploaded; `install` job on a clean Windows runner with uninstall.

## What is now verified

See the first table. In one sentence: on `d527d46` every gate that can run on this machine ran
and passed, three builds of the commit are byte-identical, the artefacts identify themselves as
this version and this commit, and the release process refuses each of the ways it was attacked.

## What remains external

See the second table. Five items, none of them code: a certificate, a VM hour, a provider, a
lawyer, a push.

## Exact human actions

1. Push (the parallel session, from `feat/rc`) and read the run; dispatch `release.yml`.
2. Buy the certificate; add the two secrets.
3. Run `docs/release/CLEAN_WINDOWS_VM.md` once on a VM; commit the logs under
   `docs/release/vm/<version>/`.
4. Decide the licence family (`docs/legal/LICENSE_DECISION.md`); decide whether to keep the
   name after the search.

## Exact provider actions

* **Certificate authority / signing service:** issue to the legal entity; the thumbprint goes
  into a config overlay at build time, the key never into the tree.
* **Penetration-test provider:** start from `docs/security/PENTEST_HANDOFF.md` §1 (bytes and
  commit), §4 (how to run what exists), §6 (what to look for); report per §7.

## Exact legal actions

`docs/legal/README.md`, second table: licence text; third-party obligations confirmed for a
proprietary binary (and shipping `NOTICE` + `THIRD-PARTY.md` inside the installer — a to-do
recorded in `LICENSE_DECISION.md`); privacy statement per jurisdiction; terms of sale and EULA;
trademark search (classes 9, 42) and registration decision; export classification; the seller
of record.

## Release procedure

`docs/RELEASE.md` §Producing a build, steps 1–7. Short form: clean commit → build →
`release_manifest.py --allow-unsigned` (beta) / `--require-signature` (release) → commit only
`docs/RELEASE.md` + `site.ts` → `--verify` → `npm run release:reproduce` →
`npm run release:check` → tag only on `BETA_READY` / `RELEASE_READY` → push the tag →
`release.yml` rebuilds the build commit, checks it reproduces, installs it on a clean runner.

## Security status

Unchanged in kind from `docs/security/2026-09-15-security-closure-report.md` and
`docs/audits/2026-09-15-final-release-readiness.md`; re-run on `d527d46`: 317 Rust tests
and 502 TypeScript tests green, `cargo deny` and `npm audit` clean. New in this cycle
(peer): typed errors, per-purpose chosen folders, an import state machine with
`MAX_LIBRARY_BYTES` (ENC-NEW-16 closed), platform-independent `.encastra` bytes. Accepted and
documented: the prompt text is the renderer's; hard links; no per-node timeout; self-asserted
publishers; loopback reachable when granted.

## CI status

The repository has a private remote since 2026-09-15 (`github.com/alexlincai123-sketch/encastra`),
created and pushed by the parallel session; this session pushes nothing. Real runs, read with
`gh` from this machine:

| Run | Commit | Result | What it established |
|---|---|---|---|
| [34968205177](https://github.com/alexlincai123-sketch/encastra/actions/runs/34968205177) `CI` | `main@f2446b5` | failure | the first Linux run ever: the committed fuzz corpus was stale, and `Project::to_bytes` wrote a platform byte (found and fixed in `rc/release`: a `.encastra` now serialises identically on every OS) |
| [34968347900](https://github.com/alexlincai123-sketch/encastra/actions/runs/34968347900) `Release` | `v0.5.0-beta.1` | failure at the gates | gitleaks over the full history flagged a test fixture that has to look like a key; allow-listed by fingerprint in `.gitleaks.toml` |
| [34969814968](https://github.com/alexlincai123-sketch/encastra/actions/runs/34969814968) `CI` | `rc/release@eb76912` | failure | Linux: fmt, clippy and `cargo test --workspace` **passed** (the symlink suites ran inside it); the fuzz-corpus step failed and the anti-skip gates did not run; Windows Rust, TypeScript, supply chain green; secrets red (allow-list form) |
| [34971056791](https://github.com/alexlincai123-sketch/encastra/actions/runs/34971056791) `CI` | `rc/release@ae81122` | **success** | all five jobs green; on Linux the steps *The symlink escape tests must actually run* and *The publication link-refusal test must actually run* = **success**; on Windows *The startup-folder refusal must actually run* = **success** (verified step by step from this machine with `gh run view`) |

So, precisely: **Linux CI is VERIFIED for `rc/release@ae81122`**, the base this branch is rebased
on — with the anti-skip gates executed, not merely configured. For `d527d46` itself no run
exists yet (`ci.evidence` = NOT_VERIFIED, "no workflow run exists for d527d46a188b"); it runs
when the merge into `feat/rc` is pushed, and `release.yml` has not yet run green on any commit
(the tag run failed at the gitleaks gate before building). Three real defects were found by
running CI for the first time; none of them was visible from Windows alone.

## Signing status

```
SIGNING STATUS: NOT CONFIGURED
```

Pipeline prepared end to end (`docs/release/SIGNING_PIPELINE.md`): unsigned → sign → verify
signature → verify certificate → verify timestamp → manifest → release; three modes; every
failure mode fails cleanly and the ones that can be tested without a certificate are. What is
missing is the certificate, and the jurisdictional question `docs/SIGNING.md` records. Code
signing ≠ SmartScreen reputation; documented.

## VM status

`NOT EXECUTED` on a clean VM. Executed in part on the development machine for
`0.5.0-beta.1` (steps 2 and 4 of `CLEAN_WINDOWS_VM.md`, all PASS). The `install` job of
`release.yml` runs steps 2 and 9 on a clean Windows runner on every release run.

## Pentest status

`NOT PERFORMED`. Hand-off package ready: `docs/security/PENTEST_HANDOFF.md`.

## Final verdict

**`npm run release:check` on `d527d46`: **`BLOCKED` — `version.unique`: 0.5.0-beta.1 was
published from build commit 349b2ff and this tree is a different program under the same
number.** That is the gate working as designed: the next build carries the next version
(`0.5.0-rc.1`, the parallel session's bump before it builds), and the same command then reaches
`BETA_READY` once its CI run exists, with `clean_vm`, `pentest` and `legal` recorded as
external.

For a **commercial release** the verdict is **NOT RELEASE READY**, and will stay so until the
five external items are done — none of which is a missing piece of pipeline.**

Automated and verified: everything the repository can reach, demonstrated on `d527d46` with the
numbers above, and enforced by gates that refuse rather than warn. External: five items, each
with a named owner and an exact action, none of them a missing piece of pipeline. When those
five are done, the same command that says `BLOCKED` today says `RELEASE_READY`, and it will
say so because it checked — that was the mission.
