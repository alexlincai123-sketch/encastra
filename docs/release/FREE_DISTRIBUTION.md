# Free distribution — what changes when Encastra is given away

**Decision (owner, 2026-09-26):** Encastra is distributed free on public GitHub — free to
download, free to use — under the **PolyForm Noncommercial License 1.0.0** (SPDX
`PolyForm-Noncommercial-1.0.0`). Nothing is sold.

This file is an inventory and a compatibility check. It is not legal advice: every statement
about what a licence permits or requires is a reading of the licence texts and of the repository,
and **a lawyer should confirm it** before a non-beta release.

Line numbers are those of `HEAD` = `ec79cfc` on `chore/free-public`. At the time of writing,
another change in the same working tree had already (uncommitted) edited `Cargo.toml`,
`package.json`, `package-lock.json`, `LICENSE`, `NOTICE`, `README.md`,
`apps/desktop/src-tauri/tauri.conf.json`, `apps/web/src/config/site.ts`, `deny.toml` and
`docs/LICENSING.md`; those rows say **WT: done** where the working tree already matches the
decision. Re-check them against the tree before committing.

---

## 1. Commercial material to remove or rewrite

### 1.1 Root files and build metadata

| File:line (HEAD) | What it says | What to do | Status |
|---|---|---|---|
| `LICENSE` (whole file) | "Encastra — Proprietary Licence … All rights reserved"; §2 forbids copying, redistribution, selling "with or without charge"; §3 says installers are supplied "under their own end-user terms" | Replace with the unmodified PolyForm Noncommercial 1.0.0 text, preceded by `Required Notice: Copyright (c) 2026 the Encastra author` | WT: done (38 lines, Required Notice on line 1) |
| `NOTICE:4-9` | "This software is proprietary … not an offer of terms … Cargo.toml carries `LicenseRef-Encastra-Proprietary` and package.json carries `SEE LICENSE IN LICENSE`" | Name PolyForm NC 1.0.0 and the SPDX id; keep the third-party paragraph (lines 14-16) unchanged | WT: done |
| `NOTICE:11-12` | legal identity "deliberately not asserted" | Keep; see 2.5 (unnamed licensor) | open |
| `README.md:146-153` | "## Licence — Proprietary … not an open-source licence and not an offer of terms. No general right to copy, modify, redistribute…" | Rewrite for PolyForm NC; say "source-available", never "open source" | WT: done (also adds a free "Download and install" section) |
| `Cargo.toml:18` | `license = "LicenseRef-Encastra-Proprietary"` | `license = "PolyForm-Noncommercial-1.0.0"` (all 8 members inherit via `license.workspace = true`) | WT: done |
| `Cargo.toml:19` | `publish = false` | **Keep** — `deny.toml` `private.ignore` depends on it (2.4) | keep |
| `package.json:6` | `"license": "SEE LICENSE IN LICENSE"` | `"PolyForm-Noncommercial-1.0.0"` | WT: done |
| `package-lock.json:10` | mirror of the root `license` field | must match `package.json` (npm rewrites it) | WT: done |
| `apps/desktop/src-tauri/tauri.conf.json:35` | `"copyright": "… All rights reserved. See LICENSE.txt."` — shown in the installer and the exe's version resource | Name the PolyForm NC licence, keep "See LICENSE.txt" | WT: done |
| `apps/desktop/src-tauri/tauri.conf.json:37-39` | bundles root `LICENSE` → `LICENSE.txt`, `NOTICE` → `NOTICE.txt`, `THIRD-PARTY.md` | **Keep** — the installer then carries the new licence automatically; `scripts/cleanvm/guest/scenarios.ps1:47` expects exactly these file names | keep |
| `deny.toml:49-50, 98-101` | comments: "Encastra ships as a proprietary binary (`LicenseRef-Encastra-Proprietary` …)", "a licence that is not in the SPDX list, because it is ours" | Comment-only rewrite for PolyForm NC; line 82 "Shipping a proprietary binary that includes unmodified MPL crates" can become "a binary under other terms" | WT: done for 49, 98-99; line 82 still says "proprietary" |
| `deny.toml:103-106` | `private = { ignore = true }` "keys off `publish = false`" | **Keep both** (see 2.4) | keep |
| `SECURITY.md` (root) | no commercial or licence wording | nothing | — |

Only the root `package.json` has a `license` field; `apps/desktop`, `apps/web`,
`packages/protocol` and `packages/ui` `package.json` are `"private": true` with no `license` field
(nothing to change; adding one is optional).

**Source file headers:** none. No file under `crates/`, `apps/`, `packages/` or `scripts/` carries
an `SPDX-License-Identifier` or copyright header (the two "All rights reserved" hits,
`crates/encastra-publish/src/license.rs:20` and `apps/desktop/src/i18n/locales/en.ts:328`, are the
Publish feature's name for an unlicensed publication, not a header). `docs/LICENSING.md:145-146`
records that as a deliberate open item. PolyForm NC does not require headers.

### 1.2 Website (`apps/web`)

| File:line | What it says | What to do |
|---|---|---|
| `src/app/pricing/page.tsx:1-60` | whole page: "What it costs today", "What would eventually cost money", a payments card with three "blocked by" items | Delete the page (and its CSS module), or reduce it to one "Free" statement pointing at `/download` and the licence |
| `src/app/pricing/page.tsx:47` | `state={STATUS.payments}` | **Breaks `npm run typecheck` now:** the working tree removed `payments` from `STATUS` in `src/config/site.ts` (HEAD line 90). Delete or edit the page in the same commit |
| `src/config/nav.ts:93` | `{ href: '/pricing', … label: 'Pricing', summary: 'What it costs today.' }` | Remove the entry (or relabel if the page is kept) |
| `src/lib/i18n/dictionaries/en.ts:43` / `es.ts:48` | nav labels `Pricing` / `Precios` | Remove with the nav entry |
| `en.ts:916-946` / `es.ts:906-936` | `pricing` block: "no paid plans", "What would eventually cost money", "A backend with accounts and billing", "Real payments…" | Remove; keep at most "Free — no account, no payment" |
| `en.ts:71-73` / `es.ts:72-74` | footer: "The source is proprietary: the repository is public to be read, not to be copied" | Rewrite: free, source-available under PolyForm NC 1.0.0 |
| `en.ts:651` / `es.ts:636` | docs page lead: "the source is proprietary, so reading it is not a licence to copy it" | Rewrite for PolyForm NC |
| `en.ts:1167-1168` / `es.ts:1157-1158` | ecosystem step `licence`: "Counsel signing off the licence. The source is proprietary…" | Rewrite: the licence is PolyForm NC; counsel review still open |
| `en.ts:1171-1172` / `es.ts:1160-1161` | ecosystem steps `legal` ("terms a marketplace and its creators would be agreeing to") and `money: 'Money, last.'` | Remove `money` (and drop `'money'` from `ORDER` in `src/app/ecosystem/page.tsx:56`) |
| `en.ts:1176-1182` / `es.ts:1165-1171` | ecosystem `money` block: "Modelled, and not moving", "money buys distribution, not permissions", "A paid publication…" | Remove with `src/app/ecosystem/page.tsx:145-153` which renders it |
| `en.ts:1202, 1209` / `es.ts:1193, 1200` | marketplace: "money movement is explicitly out of scope even after that", "listings will come before any money moves" | Remove the money sentences; the marketplace stays "Not built" |
| `en.ts:1017` / `es.ts:1007` | about: "…a marketplace, accounts and payments are designed and not built" | Drop "and payments" |
| `src/config/legal.ts:10-11` | header comment: "the source proprietary under `LICENSE`" | Rewrite |
| `src/config/legal.ts:53-56` (Privacy) | "Accounts and payments … no payments in this build. When those exist…" | Keep "no accounts, no payments"; drop "When those exist" |
| `src/config/legal.ts:70, 75` (Terms) | "no payments to speak of yet"; "the source code licence … is proprietary" | Rewrite: free; source licence is PolyForm NC |
| `src/config/legal.ts:92-96` | "No accounts, no payments, no marketplace" | Keep as fact, without "yet"-style phrasing |
| `src/config/legal.ts:98-101` | "Source code licence — Encastra is proprietary … no general right to copy, modify, redistribute" | Rewrite for PolyForm NC; link `LICENSE_URL` (added in WT `site.ts`) |
| `src/config/legal.ts:111-147` | `eula` document: "End User License Agreement … limited, personal, non-exclusive, non-transferable licence" | Remove: PolyForm NC covers the binary too (the installer bundles it as `LICENSE.txt`); an EULA on top would conflict with it |
| `src/config/legal.ts:275` (Trademark) | "The source code is proprietary and its terms are in the repository's LICENSE file" | Rewrite for PolyForm NC |
| `src/config/legal.ts:295` (Third-party) | "Encastra's own licence is settled: it is proprietary" | Rewrite |
| `src/config/legal.ts:306-326` | `refunds` document: "Refund & Cancellation Policy … When payments exist … payments as a sandboxed, later-stage capability" | Remove the document (and any legal-index link generated from it) |
| `src/config/site.ts:28-29` (HEAD) | "Public to be read, not to be copied — the source is proprietary" | WT: done |
| `src/config/site.ts:90` (HEAD) | `payments: 'planned'` | WT: done (removed) — see `pricing/page.tsx:47` above |

`src/components/site/Footer.tsx:49-50` only renders the dictionary keys above; no text change.
`src/app/download/*` has no pricing or licence wording.

### 1.3 Desktop application (`apps/desktop`)

No string names Encastra's own licence or offers a purchase: there is no About/licence screen
(`docs/legal/LICENSE_DECISION.md:49` "Settings → About names the licence" was never built). The
licence strings in `src/i18n/locales/*.ts` (`publish.fields.licence`, `publish.licences.*`
including `proprietary: 'All rights reserved'`) belong to the **Publish** feature — the licence a
user puts on their own publication — and do not change.

Payment-model code that exists but moves no money (product scope, not distribution terms; remove
or leave dormant as a separate decision):

| File:line | What |
|---|---|
| `crates/encastra-publish/src/money.rs` (whole module) | `Currency`, `Pricing { Free, Paid { amount_minor, currency } }`, `Purchase`, `Entitlement`, `Payout`, `Split`, refund states |
| `crates/encastra-publish/src/lib.rs:7-14, 33, 42` | module docs "money buys distribution, not permissions"; `pub mod money`; re-exports |
| `apps/desktop/src/types.ts:327` | `pricing: { kind: 'free' } \| { kind: 'paid'; … }` |
| `apps/desktop/src/panels/Publish.tsx:130-131` | comment "Free, and only free. There is no payment provider…" |
| `apps/desktop/src/i18n/locales/{en:332, es:303, de:305, fr:303, it:302, pt:303}` | `freeOnly`: "Free, and only free. There is no payment provider and no account to charge…" — can become just "Free." |

### 1.4 Documentation

| File:line | What it says | What to do |
|---|---|---|
| `docs/release/RELEASE_READINESS.md:25-29` | "## Owner decisions that block selling" — what is sold, price, currency, licence enforcement, refund window | Replace with the decision recorded here |
| `docs/release/RELEASE_READINESS.md:44` | "Product decisions — price, licence model, refunds, markets" | Remove |
| `docs/release/RELEASE_READINESS.md:47-52` | "**One-off payment** — Seller of record: register or name the legal entity…"; "Legal review … the EULA, terms, privacy, refunds" | Drop "seller of record"; keep "name the copyright holder" and a legal review of `LICENSE` + third-party obligations + privacy + export classification |
| `docs/release/RELEASE_READINESS.md:60` | code signing "issued to the seller" | "issued to the publisher" |
| `docs/release/RELEASE_READINESS.md:62` | "Payments — a merchant of record or payment provider (handles EU VAT)" | Remove |
| `docs/release/RELEASE_READINESS.md:121` | "1.0 — Licence enforcement, if the owner decides one" | Remove |
| `docs/legal/README.md:1, 13, 16, 19, 25-28, 31, 35, 37, 43-45` | "Legal and commercial preparation"; "decided: proprietary"; EULA "for a proprietary desktop application"; "Company / seller of record"; "Terms of sale, refunds"; "Price, refund window, support promise" | Rewrite for PolyForm NC; drop sale/refund/seller rows |
| `docs/legal/LICENSE_DECISION.md:1-63` | "Status: made — proprietary"; options table; "The proprietary licence is written and in force" | Record the PolyForm NC decision (keep the old one as history, as `docs/LICENSING.md` does) |
| `docs/legal/EULA_DRAFT.md` (whole) | "`[COMPANY]` grants you a … licence"; "licensed, not sold"; "terms of sale" | Retire (move out of `docs/legal/` or mark superseded) — PolyForm NC is the end-user licence |
| `docs/legal/TERMS_DRAFT.md` (whole, esp. 1, 7-14, 26, 34, 40, 44) | "Terms of use and sale"; "`[Price]`, `[currency]`, `[payment provider]`, `[Refund window]`"; "Perpetual for the version purchased / subscription" | Retire, or cut to website terms of use with no sale clauses |
| `docs/legal/PRIVACY_POLICY_DRAFT.md:12, 35, 59` | `[COMPANY]` placeholders | Replace with the copyright holder once named (privacy text itself is not commercial) |
| `docs/legal/TRADEMARK_CHECKLIST.md:10-11, 31` | "jurisdictions where the software will be sold"; "before the first commercial release" | "distributed"; "before the first stable release" |
| `docs/LICENSING.md` | "decided — proprietary", identifiers, "a proprietary binary" (54) | WT: done for the status block (lines 1-22); body kept as history — check lines 28-40 and 139-153 read as history |
| `docs/SIGNING.md:76-77` | "SignPath's free programme requires an open-source licence. Encastra's is proprietary" | Update wording: PolyForm NC is not OSI-approved, so that route is still closed |
| `docs/RELEASE.md:295-296` | "`LICENSE` exists and the terms are proprietary" | PolyForm NC |
| `docs/security/RELEASE_SECURITY.md:181` | "Shipping a proprietary binary that…" (MPL decision) | "a binary under other terms" |
| `docs/PRODUCT-ROADMAP.md:25, 56, 64, 130` | "Payments (sandbox only)"; "pricing" page; "Real payments" (twice) | Remove the payment items and the pricing page from the roadmap |
| `docs/PLATFORM-ARCHITECTURE.md:73, 127-143` | "licence, pricing, entitlement, purchase, payout"; "§3 Marketplace and payments … Tiers: free, paid, commercial … commission … refunds … VAT/MOSS" | Remove §3's payment content or mark it out of scope; keep the marketplace-as-distribution design if wanted |
| `docs/THREAT-MODEL.md:200, 377-379` | refund/payout audit trail; "Paid component", "Payout fraud / stolen card" rows | Remove the payment rows |
| `docs/WEBSITE.md:45` | `/pricing` — "What it costs today" | Remove with the page |
| `scripts/release_check.py:796` | report string "LICENSE present, proprietary, drafted in-house and unreviewed" | Cosmetic: "LICENSE present (PolyForm Noncommercial 1.0.0), not reviewed by counsel". Does not change a verdict |

Historical records — **do not rewrite** (they describe a past state and are cited as evidence):
`docs/release/COMMERCIAL_RELEASE_CLOSURE.md`, `docs/RELEASE_CANDIDATE_READINESS.md` (§10-11,
blockers B1-B2), `docs/audits/*`, `docs/security/2026-09-15-security-closure-report.md`,
`docs/release/evidence/**` (JSON produced by `release_check.py` containing "proprietary"),
`docs/BETA-0.*.md`. A one-line "superseded by FREE_DISTRIBUTION.md" note at the top of
`COMMERCIAL_RELEASE_CLOSURE.md` is enough.

Not commercial despite matching the search: the Publish feature's licence review
(`crates/encastra-publish/src/license.rs`, `review.rs:334` `"UNLICENSED" => License::Proprietary`),
`docs/COMPONENT-SDK.md` manifest `license` field, `.gitattributes` ("checkout"), the Clean VM
Windows-licence checks in `scripts/cleanvm/`.

---

## 2. Licence choice — what each option means here

### 2.1 What ships, by licence (from `docs/THIRD-PARTY.md`, generated by `scripts/third_party.py`)

**295 Rust crates** compiled into `encastra-desktop.exe`:

| Licence expression | Crates |
|---|---|
| MIT OR Apache-2.0 (incl. `Apache-2.0 OR MIT`, `MIT/Apache-2.0`, `Apache-2.0 / MIT`) | 184 |
| MIT | 42 |
| Unicode-3.0 (ICU4X data/tables) | 18 |
| Unlicense OR MIT / Unlicense/MIT (aho-corasick, memchr, csv, jiff…, walkdir…) | 13 |
| MPL-2.0 | 5 |
| Zlib-including dual/triple (MIT OR Apache-2.0 OR Zlib, etc.) | 8 |
| BSD-3-Clause (alloc-no-stdlib, alloc-stdlib, subtle) | 3 |
| other single licences: ISC (rustls-webpki, untrusted), Zlib (foldhash, zlib-rs), BSL-1.0 (clipboard-win, error-code), Apache-2.0 (tao, zopfli), CDLA-Permissive-2.0 (webpki-roots) | 9 |
| conjunctive: `BSD-3-Clause AND MIT` (brotli), `Apache-2.0 AND MIT` (dpi), `Apache-2.0 AND ISC` (ring), `(MIT OR Apache-2.0) AND Unicode-3.0` (unicode-ident) | 4 |
| remaining permissive disjunctions (BSD-3-Clause OR Apache-2.0, BSD-2-Clause OR Apache-2.0 OR MIT, Apache-2.0 OR BSL-1.0 (ryu), 0BSD OR MIT OR Apache-2.0, CC0-1.0 OR MIT-0 OR Apache-2.0, BSD-3-Clause/MIT, Apache-2.0 OR ISC OR MIT) | 9 |

**26 npm packages** bundled into the desktop frontend: MIT 15, ISC 8 (d3-*), BSD-3-Clause 1
(d3-ease), MIT OR Apache-2.0 / Apache-2.0 OR MIT 2.

**Copyleft present:** only **MPL-2.0**, in five crates — `cssparser`, `cssparser-macros`,
`dtoa-short`, `selectors` (the CSS selector engine behind `dom_query`, via Tauri) and
`option-ext` (via `dirs`). **No GPL, LGPL, AGPL, EPL or CDDL** anywhere in the shipped set, and
`deny.toml` (`[licenses] allow`, lines 53-95) admits none: MIT, Apache-2.0,
Apache-2.0 WITH LLVM-exception, BSD-2/3-Clause, ISC, Unicode-3.0, Zlib, MIT-0, BSL-1.0, CC0-1.0,
CDLA-Permissive-2.0, MPL-2.0. `Unlicense` is not on the list; the 13 `Unlicense OR MIT` crates
pass through their MIT arm. The npm side has no licence gate (`docs/LICENSING.md:147`), but all
26 packages are permissive today.

### 2.2 The three options, briefly

| | (a) MIT | (b) Apache-2.0 | (c) PolyForm Noncommercial 1.0.0 — **chosen** |
|---|---|---|---|
| What others may do with Encastra's own code | anything, keep the notice | anything, keep notices, state changes; explicit patent grant | use, modify, distribute **for noncommercial purposes only**; pass on the terms and `Required Notice:` lines; patent grant; no warranty |
| OSI open source | yes | yes | no ("source-available") |
| Compatible with every shipped dependency | yes | yes | yes (2.3) |
| `deny.toml` impact | none | none | none (2.4) |

All three are compatible with the dependency set for the same reason: none of the shipped
licences requires the combined work to be released under its own terms. The dependency
obligations below are identical under (a), (b) and (c); the choice only changes what others may
do with Encastra's own code.

### 2.3 Verification for PolyForm Noncommercial 1.0.0

- **Permissive licences (MIT, BSD, ISC, Zlib, BSL-1.0, Unicode-3.0, 0BSD, MIT-0, CC0, Apache-2.0,
  Unlicense via MIT):** each permits distributing the component, in a larger work, under other
  terms, subject to keeping its notices. None forbids a noncommercial-only licence on the
  combined binary. Those components stay under their own licences: a recipient may use, e.g.,
  `serde` commercially even though the Encastra binary as a whole is licensed only for
  noncommercial use. `NOTICE` and `THIRD-PARTY.md` must keep saying so (they do: `NOTICE:14-16`).
- **MPL-2.0 (5 crates):** MPL is file-level. §3.3 allows a "Larger Work" under terms of your
  choice; §3.2 requires that the MPL files stay under MPL-2.0 and that recipients of the
  executable are told how to get their source. PolyForm NC therefore applies to Encastra's code,
  **not** to those five crates' files, which recipients may use under MPL-2.0 (including
  commercially). Today the source route is the crates.io origin listed in `THIRD-PARTY.md`, which
  the installer bundles. The condition in `deny.toml:86-88` still holds: if any of them is ever
  vendored and modified, the modified files must be published under MPL-2.0.
- **No LGPL/GPL:** nothing requires relinking rights, source of the whole program, or a
  copyleft licence on Encastra. Result: **no shipped dependency's licence forbids distributing
  the combined binary under PolyForm NC 1.0.0.**
- **Obligation that exists under every option, and is only partly met today:** MIT, BSD, ISC,
  Zlib, Unicode-3.0 and Apache-2.0 ask that the copyright notice and licence text (Apache-2.0
  §4: a copy of the licence and any `NOTICE` file content) accompany binary distributions.
  `THIRD-PARTY.md` lists identifiers and origins, not the texts — `apps/web/src/config/legal.ts:295`
  already says so. A generated full-text notices file in the installer would close it; counsel
  should confirm what is sufficient.
- **CDLA-Permissive-2.0 (webpki-roots):** `deny.toml:73-75` calls it "no attribution requirement";
  the licence text appears to ask that its text be made available when the data is shared.
  Counsel should reconcile the two.
- **Unnamed licensor:** the Required Notice names "the Encastra author" and no legal person is
  asserted (`NOTICE:11-12`, `docs/legal/README.md:19`). Whether a licence grant from an unnamed
  licensor is effective is a question for counsel.

### 2.4 Tooling that reads Encastra's own licence field — checked

| Tool | Reads our own `license`? | Breaks on `PolyForm-Noncommercial-1.0.0`? |
|---|---|---|
| `scripts/third_party.py` | No. Workspace crates are excluded (`crates_shipped`, lines 67-68: `workspace_members`), and linked npm workspace packages are skipped (lines 100-107) | No |
| `scripts/generated_check.py` | No licence logic at all | No |
| `scripts/version.py` | Syncs versions only (9 declarations); no `license` field | No |
| `scripts/release_check.py:176, 796` | Runs `cargo deny check … licenses`; line 796 only tests whether `LICENSE` exists and prints a hard-coded "proprietary" string | No (stale wording only) |
| `scripts/tests/test_version.py:53, 62` | `"UNLICENSED"`/`"MIT"` are fixture data, not our manifests | No |
| `scripts/cleanvm/guest/scenarios.ps1:47` | Expects `LICENSE.txt`, `NOTICE.txt`, `THIRD-PARTY.md` installed | No, while `tauri.conf.json:36-39` keeps the same mapping |
| `deny.toml` `[licenses]` | Workspace crates are skipped by `private = { ignore = true }` because every member has `publish = false` | No. **Do not** add `PolyForm-Noncommercial-1.0.0` to `allow`: that would let a *dependency* under a noncommercial-only licence in. If `publish = false` is ever dropped, add per-crate `[[licenses.exceptions]]` for the eight workspace crates instead |
| `package-lock.json` | npm mirrors the root field (line 10) | No; `PolyForm-Noncommercial-1.0.0` is an SPDX list identifier, so npm's validator accepts it |

### 2.5 Exact file changes for PolyForm Noncommercial 1.0.0

| File | Change | Status |
|---|---|---|
| `LICENSE` | Official PolyForm NC 1.0.0 text, unmodified, with `Required Notice: Copyright (c) 2026 the Encastra author` | WT: done |
| `NOTICE` | Header paragraph names PolyForm NC 1.0.0 and the SPDX id; third-party paragraph unchanged (MPL/others keep their licences) | WT: done |
| `Cargo.toml` `[workspace.package] license` | `"PolyForm-Noncommercial-1.0.0"`; `publish = false` unchanged | WT: done |
| `package.json` `license` (root; the only one) + `package-lock.json:10` | `"PolyForm-Noncommercial-1.0.0"` | WT: done |
| `apps/desktop/src-tauri/tauri.conf.json:35` `copyright` | names the licence, "see LICENSE.txt" | WT: done |
| Installer `LICENSE.txt` / `NOTICE.txt` | no config change — copied from root by `tauri.conf.json:37-38` at build time; rebuild to pick up | automatic |
| `deny.toml` | comments at 49-50, 82, 98-101 only; `allow` list and `private.ignore` unchanged | WT: partly done (82 pending) |
| `docs/LICENSING.md` | status block → PolyForm NC; old text kept as history | WT: done |
| `docs/legal/LICENSE_DECISION.md`, `docs/legal/README.md` | record the decision; drop sale/seller/refund rows | pending |
| `docs/legal/EULA_DRAFT.md`, `docs/legal/TERMS_DRAFT.md` | retire (superseded by `LICENSE`); keep website terms of use only if wanted | pending |
| `docs/legal/PRIVACY_POLICY_DRAFT.md`, `TRADEMARK_CHECKLIST.md` | `[COMPANY]` → copyright holder when named; "sold" → "distributed" | pending |
| `apps/web/src/config/legal.ts` | rewrite "Source code licence", trademark and third-party notes; remove `eula` and `refunds` documents | pending |
| `apps/web` pricing page, nav, dictionaries (`en.ts`/`es.ts`) | per 1.2 | pending — `pricing/page.tsx:47` fails typecheck against the WT `site.ts` |
| `README.md` "Licence" | PolyForm NC, "source-available, not open source" | WT: done |
| `docs/release/RELEASE_READINESS.md` | per 1.4 | pending |
| `docs/SIGNING.md:76-77`, `docs/RELEASE.md:295-296`, `docs/security/RELEASE_SECURITY.md:181`, `scripts/release_check.py:796` | "proprietary" → PolyForm NC | pending |
| Source file headers | none exist; none needed | — |

After the edits, the CI gate in `CLAUDE.md` (lint, typecheck, tests, `cargo deny`,
`python scripts/generated_check.py`) is what confirms nothing downstream reads the old
identifiers; the analysis above predicts only the `STATUS.payments` typecheck failure.

## Distribution — how a free release reaches people

`release.yml` is the only path. On a tag `v<version>`, dispatched with `allow_unsigned=true` and
`publish=true`, it rebuilds the build commit on a clean runner, requires the published bytes,
installs them, and runs `gh release create` with the installer, the executable and `SHA256SUMS`;
a version with a suffix (`-rc.N`) is marked **Pre-release** (`release.yml`, the `publish` job). It
never replaces an existing release. The owner's command, after the tag:

```
gh workflow run release.yml --ref v<version> -f allow_unsigned=true -f publish=true
```

GitHub's `/releases/latest` ignores pre-releases, so the site and README link to `/releases`, not
`/releases/latest`, while only candidates exist. The builds are not code-signed; the manifest,
the release notes and the site say so, and SmartScreen warns.
