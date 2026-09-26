# Release readiness — 0.5.0-rc.6

What stands between this repository and a product a stranger can install, use and pay for — each
line is **PASS** (with the evidence that makes it so), **PENDING** (what closes it, inside the
repository) or **EXTERNAL** (what the owner has to do, exactly). Nothing here is PASS because it
ought to be; NOT_TESTED is never PASS.

Last updated: 2026-09-26. Candidate: see `docs/RELEASE.md` (the BUILD block is generated).

## The product

| Criterion | State | Evidence / what closes it |
|---|---|---|
| Builds reproducibly on two machines | PASS | `candidate.yml` builds copy A and copy B on two hosted runners and requires them byte-identical; `release_fetch.py` re-checks the digests GitHub holds. Residual: the Windows SDK / CRT / `cl.exe` are not pinned by content — a change there fails the reproduction gates closed (`docs/RELEASE.md`, *Reproducible*). |
| Test gate green | PASS | `ci.yml` 5/5 on the candidate's commits; local gate 11/11 (lint, typecheck, vitest, fmt, clippy, cargo test, generated artefacts, script tests, version, web build). |
| Type graph TS ↔ Rust in agreement (anti-drift) | PASS | conformity tests in vitest and cargo test, both in the gate; the matrix is never regenerated to make them pass. |
| Chooser journeys driven through the real installer | PASS | the candidate run's `Drive the choosers through copy A's installer` (repeat 3) and the standalone `Chooser journeys` workflow. |
| Clean Windows 11 acceptance (install, first run, restart, upgrade from 0.5.0-rc.5, uninstall/reinstall, contamination, network, WebView2 state) | PENDING | the Clean VM battery A, B, U, N1–N5 on this candidate's installer, judged by `scripts/cleanvm/report.py` and bound to the artefacts by `release_check.py --evidence-vm` (`docs/release/CLEAN_VM_ACCEPTANCE.md`). 0.5.0-rc.5 FAILED it (CLEAN-009, fixed in this candidate). |
| Security review of the shipped code | PASS (internal) | defensive review of the Tauri surface, path handling, import/publish, network, secrets and installer for rc.6: no blocker; the startup-folder write gap it found is fixed and tested. An internal review is not a pentest — see EXTERNAL. |
| No telemetry, no network by default | PASS | no updater/telemetry in the dependency tree; the HTTP step needs a per-host grant; the Clean VM cycles record every frame the guest sends (no DNS name containing "encastra"). |
| Errors, languages and accessibility | PASS | six desktop locales at key parity; built-in components, categories and React Flow controls translated; typed `AppError` vocabulary identical in Rust and TS; focus kept in confirmations; tests for each. |
| Installer carries its licence and third-party notices | PASS | `LICENSE.txt`, `NOTICE.txt`, `THIRD-PARTY.md` bundled (`tauri.conf.json`). |
| Website says only what the product does | PASS | cookie and privacy text match the code; release labelled as a candidate; contact = GitHub private vulnerability reporting (enabled). Pricing says what is true today (free, no purchase flow). |

## Owner decisions that block selling (not engineering)

1. What is sold (licence, subscription, support), at what price and currency. The site says "Nothing" today because nothing is for sale.
2. Whether the free download stays, and whether a licence is enforced at all — an online activation would break the "no network" promise; an offline signed key is the option compatible with it.
3. Refund window and support promise; markets and the language of the binding legal texts.

## EXTERNAL — what the owner does, exactly, grouped by cost

Costs are orders of magnitude to plan with, not quotes.

**Free (time only)**

| Item | Exact step |
|---|---|
| Decide the tag | `git tag -a v0.5.0-rc.6 <publication commit> -m "Encastra 0.5.0-rc.6"` and push it — tags `v*` are immutable here, so this is the owner's call, after `release_check.py` says BETA_READY with `clean_vm` PASS. |
| Publish | `gh workflow run release.yml --ref v0.5.0-rc.6 -f allow_unsigned=true -f publish=true` (`docs/RELEASE.md` step 7): rebuilds at the tag, requires the published bytes, uploads them. |
| Merge | PR #20 `rc/rc6-closure → main` (merge commit, no squash, so the tagged commits stay on main). |
| SmartScreen on a downloaded file | run the downloaded installer once on a clean machine and record what Windows shows (`docs/release/CLEAN_WINDOWS_VM.md`); the offline VM cannot exercise Mark of the Web. |
| Trademark clearance search | search "Encastra" in USPTO, EUIPO and TMview, classes 9 and 42. |
| Product decisions | price, licence model, refunds, markets (section above). |
| CI | none: the repository is public, so hosted Actions (CI, candidate, chooser journeys, release) cost nothing. |

**One-off payment**

| Item | Exact step |
|---|---|
| Seller of record | register or name the legal entity; replace "the Encastra author" in `LICENSE`, `NOTICE`, `docs/legal/*`. |
| Legal review | a lawyer signs off `LICENSE`, the EULA, terms, privacy, refunds, third-party obligations and export classification (bundled TLS: rustls + ring) — `docs/legal/`. |
| Trademark registration | file in the chosen offices if the search is clear. |
| Independent pentest | a vendor working from `docs/security/PENTEST_HANDOFF.md`. |

**Recurring**

| Item | Exact step |
|---|---|
| Code signing | an OV/EV certificate or signing service issued to the seller (yearly); add `WINDOWS_CERTIFICATE` and `WINDOWS_CERTIFICATE_PASSWORD` as repository secrets. Until then every build is published **unsigned**, stated in the manifest, and SmartScreen warns; `allow_unsigned` is never used to hide it. |
| Domain and hosting | the domain the site's canonical URLs assume (`encastra.dev`, or change `site.ts`), a host for the site and the installer, mailboxes if wanted. |
| Payments | a merchant of record or payment provider (handles EU VAT) with a verified account — only once the price is decided. |

No OAuth or app registration is needed: nothing in the product authenticates.

## Known, not blocking this candidate

- `release_manifest.signature()` inherits `PSModulePath` from a PowerShell 7 parent and records an
  unanswered probe as a broken signature (`release_identity.signature()` was fixed for the same
  thing earlier). This candidate's manifest was written with `PSModulePath` unset and says
  "not signed", which is true. Fixed on `fix/manifest-signature-probe` for the next build.
- Commands that take a `.encastra` path from the web view without a chooser record
  (`save_project`, `open_project`, …) need a compromised renderer; accepted in `THREAT-MODEL.md`.
- The Clean VM judge cannot detect a forger who rewrites `serial.log` on the lab host
  (`CLEAN_VM_ACCEPTANCE.md`, *Known limitations*).
