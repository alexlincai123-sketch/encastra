# Licensing

**Status: undecided, and deliberately so. This document lays out the options and what each one
commits to. The decision is the owner's to make.**

---

## Where it stands today

`Cargo.toml` and `package.json` both say `UNLICENSED`. There is **no `LICENSE` file** in the
repository.

That combination means exactly one thing, and it is worth being blunt about it: **nobody has any
rights to this code at all.** Not to use it, not to copy it, not to modify it, not to distribute
it. Under copyright, absence of a licence is not permission — it is the default, and the default
is no.

That is a perfectly reasonable state for an unreleased beta. It stops being reasonable the moment
the installer is handed to anybody, because then a person has a binary and no stated terms for
it.

One technical note: `UNLICENSED` is npm's convention and is understood there. It is **not** a
valid SPDX identifier, so `Cargo.toml` carrying it would be rejected by `cargo publish`. It does
not matter while nothing is published; it has to be fixed before anything is.

## What has to be decided

Three questions, in this order. The third one is usually what actually settles it.

1. **May somebody read the source?**
2. **May somebody run the binary, and under what terms?**
3. **May somebody build a competing product out of it?**

## The options

### Proprietary, closed source

Source stays private; the binary ships under an EULA.

- **For**: nothing given away; total freedom to change the model later; simplest to reason about.
- **Against**: no outside contributions, no scrutiny of the security model, and a component
  platform whose core nobody can read is a harder sell to the people most likely to adopt it.
- **Needs**: an EULA. A draft already exists in `apps/web/src/config/legal.ts`, marked as
  requiring review by counsel.

### Source available

Source is public and readable; commercial use restricted. Business Source License 1.1, Elastic
License 2.0, Functional Source License, or a bespoke licence.

- **For**: readable and auditable — which matters a great deal for a product whose entire claim
  is a permission model somebody should be able to check. Protects against a cloud provider
  reselling it.
- **Against**: **not open source**, and calling it so would be false. Some companies will not
  touch a non-OSI licence. BUSL's automatic conversion to an open licence after a fixed term is a
  commitment made now and honoured years later.
- **Needs**: a licence choice, a change date and a converted licence if BUSL.

### Open source

MIT or Apache-2.0 (permissive), or AGPL-3.0 (copyleft).

- **For**: the widest adoption, real contributions, and it is what a component ecosystem usually
  needs to become one — people write components for platforms they can inspect.
- **Against**: irreversible in practice. Code released under MIT stays available under MIT
  forever, whatever is decided later; the only thing that can change is the licence of future
  versions. Permissive licences allow a competitor to take it wholesale.
- **Needs**: **Apache-2.0 over MIT** if this route is taken, for the explicit patent grant —
  worth having in a product that defines a protocol other people implement.

## A relevant asymmetry

Closed → open is easy and can be done at any time.
Open → closed is impossible for code already released.

That argues for **not choosing an open licence in a hurry**, and for choosing one deliberately if
at all.

## A recommendation, offered rather than applied

For what Encastra is — a local-first product with a security model whose whole value depends on
being checkable, plus a component protocol meant for other people to implement:

- **Apache-2.0 for `packages/protocol` and `crates/encastra-protocol`.** The protocol only
  becomes a standard if other people can implement it without asking, and the patent grant
  matters for exactly that.
- **A decision still to be made for the application and runtime**, between source-available and
  open. Both are defensible; the question is whether outside components are meant to become a
  real ecosystem.

**This is not applied.** Nothing in the repository has been changed. Splitting the licence across
a repository is a real commitment with real consequences, and it is not a decision to make on
somebody's behalf.

## What has to happen before anything ships publicly

1. Decide, using the three questions above.
2. Add a `LICENSE` file at the repository root.
3. Make `Cargo.toml` and `package.json` agree with it — including replacing `UNLICENSED` in
   `Cargo.toml` with a valid SPDX identifier.
4. Add a licence header policy, or deliberately decide not to have one.
5. Check the dependency licences are compatible. `cargo-deny` already runs a licence check in CI;
   the npm side has no equivalent gate yet.
6. Have counsel review the EULA and the marketplace terms, which are currently drafts.

## Related

- `apps/web/src/config/legal.ts` — nine draft documents, each marked as requiring review
- `docs/BETA-0.3.md` — where this sits among everything else outstanding
