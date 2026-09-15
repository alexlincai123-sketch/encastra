# Trademark review — checklist

**Status: the name "Encastra" has not been searched in any register.** `docs/BRANDING.md`
records that; no ™ or ® appears in the product, the site or the documents, and that must stay
so until this list is done. A domain being available and an npm scope being free are not
clearance.

## Before the search

- [ ] The jurisdictions where the software will be sold (at least: the seller's; the EU if
      selling in it; the US if selling there).
- [ ] The Nice classes: 9 (downloadable software) and 42 (software as a service / design and
      development), plus any the lawyer adds.
- [ ] The marks to search: the word `Encastra`; the logo as a device mark if one is to be
      registered; the `.encastra` file extension as a word people will type.

## The search (a professional service, or at minimum)

- [ ] EUIPO (eSearch plus) and the national office of the seller's country.
- [ ] USPTO TESS, if the US is a market.
- [ ] WIPO Global Brand Database, for international registrations designating the above.
- [ ] Common-law / unregistered use: app stores, GitHub, npm, crates.io, PyPI, product
      directories, domain registrations — for *encastra* and phonetic or visual near-misses
      (*encastre*, *incastra*, *encasta*, *en castra*).
- [ ] Note in the result: identical marks, similar marks in the same classes, similar marks in
      adjacent classes, and dead/abandoned marks (still a signal).

## The decision (owner, with the lawyer's opinion)

- [ ] Keep the name, register it (word mark first; classes 9 and 42; jurisdictions above), or
- [ ] change the name before the first commercial release — cheaper than after.
- [ ] Record the outcome in `docs/BRANDING.md` and remove the "not cleared" sentence only when
      an application is filed or an opinion says use is safe.

## After a decision to register

- [ ] File; calendar the office-action deadlines.
- [ ] Adopt ™ on the mark until registration, ® after, and only in the jurisdictions where it
      is registered.
- [ ] Buy `encastra.dev` (today referenced in `site.ts` as canonical and **not owned**) and the
      obvious variants; check the `@encastra` npm scope ownership (`docs/security/…closure-report`
      lists it as an external dependency).
- [ ] The certificate for code signing is issued to the legal entity, not to the mark; the
      publisher name Windows shows is the entity's (`docs/SIGNING.md`).
