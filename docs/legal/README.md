# Legal and commercial preparation — what is drafted, and what only a lawyer can decide

**Nothing in this directory is legal advice, a licence in force, or a cleared name.** These are
drafts written so that the people who can decide have something concrete to decide on, and so
that the release tooling can point at a missing signature rather than at a missing document.
`release_check.py` reports `legal` as `EXTERNAL_REQUIRED` until the items in the last table are
done by the people named there.

## State of the repository today

| Item | State | Where |
|---|---|---|
| Software licence | `UNLICENSED` in `Cargo.toml` and every `package.json`: nobody is granted any right to the code. That is a placeholder, not a decision | `LICENSE_DECISION.md` |
| Third-party licences | inventoried, generated from the lockfiles, checked in CI (`python scripts/third_party.py --check`) | `docs/THIRD-PARTY.md`, `NOTICE`, `deny.toml` (the allow-list, with a reason per entry; MPL-2.0 is a recorded decision), `docs/LICENSING.md` |
| Privacy | the product makes no network connection, keeps no account, sends no telemetry; a statement saying so is drafted | `PRIVACY_POLICY_DRAFT.md` |
| Terms of use / EULA | drafted for a proprietary desktop application distributed as an installer | `TERMS_DRAFT.md`, `EULA_DRAFT.md` |
| Trademark | **not searched**; `docs/BRANDING.md` says so and no ™/® appears anywhere | `TRADEMARK_CHECKLIST.md` |
| Export / sanctions | not assessed; the software contains no cryptography of its own (TLS through the platform's `ureq`/`rustls`) — a line a lawyer should confirm | `TERMS_DRAFT.md` §Export |
| Company / seller of record | none named anywhere; every draft has `[COMPANY]` | all |

## Exactly what requires a lawyer

| Decision | Why it cannot be made here | Input they will need |
|---|---|---|
| Choose the licence for the product (proprietary EULA vs. an open licence) and write the operative text | a licence is a contract; the drafts are structure, not terms anyone should rely on | `LICENSE_DECISION.md` (the options and what each forecloses), `docs/PRODUCT-ROADMAP.md` (the marketplace plans, which constrain the choice) |
| Confirm the third-party obligations are met for a proprietary binary (attribution, MPL file-level copyleft, any GPL-family exclusion) | `deny.toml` encodes a reading of the licences; a lawyer confirms the reading | `docs/THIRD-PARTY.md`, `deny.toml`, `NOTICE` |
| Privacy statement and, if any jurisdiction requires it, a data-protection assessment | which law applies depends on where the seller and the users are | `PRIVACY_POLICY_DRAFT.md`; the fact that no data leaves the machine |
| Terms of sale, refunds, warranty disclaimers, limitation of liability | jurisdiction-specific and enforceability-specific | `TERMS_DRAFT.md`, `EULA_DRAFT.md` |
| Trademark search and, if wanted, registration of the name | a search in the relevant registers and classes is a professional service | `TRADEMARK_CHECKLIST.md`, `docs/BRANDING.md` |
| Export-control classification | depends on the encryption analysis and the seller's jurisdiction | the dependency list; `crates/encastra-builtins/src/net.rs` (TLS is the platform's) |
| The seller of record (a person or a company), and the identity the code-signing certificate is issued to | a certificate authority verifies a legal identity; the drafts cannot name one | `docs/SIGNING.md` |

## What is decided by the owner, not by a lawyer

* Which licence family, before the lawyer writes it (`LICENSE_DECISION.md` lists the choice).
* Whether the name is kept after the search result.
* Price, refund window, support promise — business terms the drafts leave as `[…]`.

## How the tooling sees this

`release_check.py` lists the drafts present and reports `legal` as `EXTERNAL_REQUIRED` in every
mode. For a beta that is recorded and does not block; for a release version it blocks the
verdict until a person replaces the drafts with executed documents and the `UNLICENSED` marker
with the chosen licence identifier — at which point `cargo deny` (`licenses`) and
`scripts/version.py --check` keep them consistent.
