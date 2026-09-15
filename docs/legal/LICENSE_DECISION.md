# The licence decision

**Status: not made.** The tree says `UNLICENSED`, which means "all rights reserved, nobody may
do anything" — the safe default for source that is not yet released, and not a licence a
product can ship under.

## The question

Under what terms does a person receive `Encastra_<version>_x64-setup.exe`, and under what terms,
if any, do they receive the source?

## The options, and what each forecloses

| Option | The user may | The owner keeps | Forecloses |
|---|---|---|---|
| **Proprietary, binary only (EULA)** | install and use per the EULA; not copy, modify, reverse-engineer beyond what law allows | everything else; the marketplace model in `docs/PRODUCT-ROADMAP.md` is unconstrained | community contributions to the core; "source available" claims |
| **Proprietary with source available (e.g. BUSL-1.1, PolyForm)** | read, build and use non-competitively; terms convert to an open licence on a date | commercial exclusivity for a period | nothing about the marketplace; some enterprise buyers dislike BUSL |
| **Open core: runtime and format under Apache-2.0/MIT, application and marketplace proprietary** | use, modify and redistribute the open parts | the application and the commercial layer | requires a clean split of the workspace at crate boundaries (`crates/` vs `apps/`) and contributor agreements |
| **Fully open (Apache-2.0 or MIT)** | everything | the trademark, and nothing else about the code | the paid-software model unless it is services or hosting |

## Facts the decision has to respect

* `deny.toml` allows MPL-2.0 (file-level copyleft: fine for a proprietary binary that does not
  modify those files) and no GPL-family licence; that stays true under every option above.
* `docs/THIRD-PARTY.md` lists what ships; each option's attribution obligation is met by
  `NOTICE` and that file being shipped with the installer — confirm with the lawyer that the
  installer includes them (today: **it does not**; add them to the NSIS bundle when the licence
  is chosen — this is a to-do, recorded here).
* The `.encastra` *format* is documented (`docs/PROJECT-FORMAT.md`); a format specification can
  be published under an open licence independently of the code, which matters for a product
  whose files travel between people.
* Third-party components (`docs/adr/0001`) will run under a component licence of their authors'
  choosing; the host's licence has to say what it grants a component author.

## What the tooling enforces once the choice is made

* `Cargo.toml` `[workspace.package] license` and every `package.json` `license` field carry the
  SPDX identifier (or `SEE LICENSE IN LICENSE` for a custom EULA); `scripts/version.py --check`
  does not check these — add a check, or accept that `cargo deny check licenses` only governs
  dependencies.
* A `LICENSE` file at the root; the installer shows it (NSIS `MUI_PAGE_LICENSE`) — Tauri's
  `bundle.licenseFile` option.
* Settings → About names the licence.

## Recommendation, for the owner to accept or reject

Proprietary EULA for the application with the format specification published openly. It
matches what `docs/PRODUCT-ROADMAP.md` plans, foreclosing least; it can be relaxed later
(open-sourcing is always available; the reverse is not). A lawyer writes it.
