# CI security: what runs where, what it may touch, and the evidence that it ran

Until 2026-09-15 this repository had no remote, so `.github/workflows/*.yml` described a CI
that had never executed. A private repository now exists (`alexlincai123-sketch/encastra`,
created that day with `gh`), and the workflows have run for real. This document records the
trust model of those workflows and, at the bottom, the runs themselves — with what each one
found, because the first ones found things.

## 1. Two workflows, two trust levels

| | `ci.yml` | `release.yml` |
|---|---|---|
| Triggers | push to `main`, every pull request, manual dispatch | push of a `v*` tag, manual dispatch on a ref |
| Who can trigger | anyone who can open a PR (collaborators; the repository is private) | anyone who can push a tag or dispatch: write access only |
| Token | `GITHUB_TOKEN`, `contents: read`, workflow-wide | same |
| Secrets used | none beyond the token (gitleaks reads it for PR annotations) | `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD` — absent today; the build job tests whether they exist and never prints them |
| Cache | Rust build cache (`Swatinem/rust-cache`) shared across branches | **none** — a release links nothing the cache had |
| Artefacts | none uploaded | the installer and `docs/RELEASE.md`, 30 days, for a person to look at |
| Publishes | nothing | nothing: no GitHub release, no push. Publishing stays a human act |

The rule between them: **pull-request CI is untrusted; release CI is trusted; nothing flows
from the first to the second.** The release workflow re-runs every gate itself rather than
believing a green tick on the commit, builds from a full clone with no cache, and its artefact
is verified against the published hashes before anybody sees it.

## 2. The controls, one line each

- **Every action pinned to a commit SHA**, with the tag it was resolved from in a comment
  (`actions/checkout@fbc6f39… # v5`). A moving tag is a supply-chain input nobody reviews.
  Dependabot's `github-actions` ecosystem proposes bumps as pull requests, which are read
  before they are taken (`docs/adr/0010`).
- **`persist-credentials: false` on every checkout.** The token is not left in `.git/config`
  for a later step, or a compromised dependency, to find.
- **`permissions: contents: read`** at the top of both files. No job can write to the
  repository, open issues, or publish packages with the token.
- **No `pull_request_target`.** Fork code never runs with base-repository secrets.
- **The release build has no cache and a full clone.** The Actions cache is shared with
  pull-request runs; a compiled artefact planted there would otherwise be linked into a
  release without any file in this repository noticing. The full clone is also a correctness
  need: the manifest names a build commit that is an ancestor of the tag, and a depth-1 clone
  cannot check it out (the first dispatch would have failed at that step).
- **Secrets never appear.** The certificate arrives base64 in a secret, is written to
  `RUNNER_TEMP`, imported, deleted; the thumbprint (not a secret) goes to Tauri as a config
  overlay outside the tree, never into a tracked file.
- **The manifest refuses** a binary without a build stamp, with a dirty stamp, from a commit
  that is not HEAD, an installer of another version or older than the binary, an unsigned
  production version; `--verify` refuses a tree that differs from the build commit by more
  than a publication. Tested in `scripts/tests/` on every run.
- **Gates that must not skip are checked for skipping.** The symlink-escape and link-refusal
  tests build fixtures the platform may refuse to create; on Linux the job greps their output
  for `skipped` and fails on it.
- **Generated artefacts are checked, not trusted:** the conformance matrix, the fuzz corpus and
  the third-party inventory are regenerated and diffed against what is committed.
- **Dependencies:** `cargo deny check advisories bans licenses sources` (crates.io only, an
  allowlist of licences, every exception dated), `npm audit --audit-level=high`, gitleaks over
  the whole history on a release and over the pushed range on CI, with one exact-value
  allowlist (`.gitleaks.toml`) for the fake key the publication review is tested against.
- **macOS is opt-in** on dispatch: nothing ships for it, and its minutes cost ten times
  Linux ones on a private repository. Linux is the platform that runs the symlink suites
  Windows skips; Windows is the platform that ships.

## 3. What is not there

- **No signing**, so no attestation of who built the artefact. `docs/SIGNING.md`.
- **No SBOM in a machine format.** `docs/THIRD-PARTY.md` is the human-readable inventory;
  CycloneDX/SPDX output would be one script away and nobody asked for it yet.
- **No branch protection is configured on `main`**, and on this plan it cannot be: GitHub
  answers `403 — Upgrade to GitHub Pro or make this repository public` to the protection API
  for a private repository on a free account (checked 2026-09-15). It is a plan change or a
  visibility change, both the owner's; until then the rule is a habit, and `main` is written to
  by one session at a time.
- **No required-status-checks rule**: the same reason.
- **The Windows job does not run the anti-skip greps for the Linux-only suites**, by design;
  the reverse holds for the startup-folder refusal.

## 4. Evidence: the runs

The repository's Actions tab is the record; these are the runs this document was written
against, with their outcome. A run is listed whether it passed or not.

| Run | Ref | Trigger | Outcome | What it showed |
|---|---|---|---|---|
| [34968205177](https://github.com/alexlincai123-sketch/encastra/actions/runs/34968205177) | `main` @ `f2446b5` | first push | TypeScript ✓ · supply chain ✓ · secrets ✓ · Rust macOS ✓ · Rust Windows ✓ · **Rust Linux ✗** | The committed fuzz corpus was three commits stale; the corpus gate failed and the symlink gates after it were skipped — which is what a red gate is supposed to do. Fixed by regenerating the corpus (`fcf59e6`) and adding the check to the local gate in `CLAUDE.md`. |
| [34968347900](https://github.com/alexlincai123-sketch/encastra/actions/runs/34968347900) | tag `v0.5.0-beta.1` @ `7608bb1` | dispatch, `allow_unsigned=true` (the tag push itself did not trigger the workflow — recorded as an open question below) | **gates ✗**, build skipped | gitleaks over the full history found the fake API key the review tests use (`review.rs`, two lines). On CI's push-range scan it had passed. Fixed with an exact-value allowlist (`2fd9d23`). |
| [34969814968](https://github.com/alexlincai123-sketch/encastra/actions/runs/34969814968) | `rc/release` @ `eb76912` | dispatch | TypeScript ✓ · supply chain ✓ · Rust Windows ✓ · secrets ✗ (allowlist written in a table this gitleaks ignores; corrected in `2fd9d23`) · Rust Linux ✗ (the fuzz corpus differed again: the ZIP "version made by" byte is the running platform's unless pinned; pinned in `a16f36c`) | Two findings, both real, both fixed in the next row. |
| [34971056791](https://github.com/alexlincai123-sketch/encastra/actions/runs/34971056791) | `rc/release` @ `ae81122` | dispatch | **all green**: TypeScript ✓ · supply chain ✓ · secrets ✓ · Rust Linux ✓ (corpus gate, symlink-escape and link-refusal anti-skip greps executed) · Rust Windows ✓ (startup-folder anti-skip executed) | The first run in which every gate ran and passed. It covers the deterministic ZIP and the pinned actions; it does **not** cover the waves merged afterwards. |
| [34978855319](https://github.com/alexlincai123-sketch/encastra/actions/runs/34978855319) | `feat/rc` @ `ea1ad29` (the publication commit of `v0.5.0-rc.1`) | dispatch | see §4.1 | The candidate's own tree, with `--locked` and the junction anti-skip grep on Windows. |
| [34978855610](https://github.com/alexlincai123-sketch/encastra/actions/runs/34978855610) | tag `v0.5.0-rc.1` | **tag push** | see §4.1 | This time the tag push *did* start `release.yml` (the open question below is answered). Expected to refuse at "an unsigned release is a pre-release, published on purpose": a tag push carries no `allow_unsigned` input, and since `260b0c9` that is a refusal, not a warning. |
| [34978859110](https://github.com/alexlincai123-sketch/encastra/actions/runs/34978859110) | tag `v0.5.0-rc.1` | dispatch, `allow_unsigned=true` | see §4.1 | The run that builds the build commit on a hosted runner, checks artefact identity, reproduces the published hashes, writes the verdict file, and installs the result on a runner that has never seen Encastra. |

### 4.1 Outcomes of the candidate's runs

Filled in when the runs finish (they take of the order of an hour together on the free plan's
runners); until then this section says so rather than guessing.

Open question from the second row, now answered: pushing the annotated tag `v0.5.0-beta.1`
seconds after the first push of `main` did not start `release.yml`; pushing `v0.5.0-rc.1` to a
repository that already had the workflow did. The likely reason is the ordering on the first
day (the workflow file was registered by the same push the tag followed). The rule stays:
**dispatch the release workflow on the tag explicitly and check that a run exists** — and, since
an unsigned build now needs the `allow_unsigned` input, the dispatch is the only path that
publishes one anyway.

## 5. Minutes

A private repository on a free account has 2 000 Actions minutes a month, Windows at ×2 and
macOS at ×10. A full CI run with the three-OS matrix is of the order of 200 Linux-equivalent
minutes; with macOS opt-in it is roughly a third of that. Dependabot's first day opened six
pull requests and started CI on each; the two still running were cancelled. The account's
usage is visible only to its owner (the `gh` token lacks the `user` scope), so this document
cannot state a number.
