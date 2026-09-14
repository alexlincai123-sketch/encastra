# ADR-0011 — A publication is prepared locally, checked twice, and goes nowhere

**Status:** accepted · 2026-09-15

## Context

`docs/PLATFORM-ARCHITECTURE.md` §2–§4 describes a registry, a marketplace and the accounts
behind them, and states that none of it exists. §6 fixes the order the rest has to happen in,
ending with money, and says what skipping the first two steps would cost.

That left a gap. Everything about publishing was deferred behind a registry that nobody has
started, including the parts that need no registry at all: what a publication *is*, what it must
declare about itself, and whether the project being offered is fit to hand to a stranger. The
last of those is not a distribution problem. It is a property of the file, and it can be decided
on the machine the file was made on.

The gap has a cost that grows. A project is private until it is not, and two things that were
harmless while it was private stop being harmless the moment somebody else opens it: a secret
typed into a settings box, which the project file saves along with everything else, and a folder
path under the author's home directory, which names them and exists on no other machine. Both
are ordinary, both are invisible, and both are discovered by the person on the receiving end.

## Decision

**A publication has a shape, and it lives in `crates/encastra-publish`.** Listing, release,
publisher, licence, pricing, entitlement, purchase, payout, moderation state. The types exist
now, with tests, so that the code that one day talks to a registry is written against something
that already knows what those words mean. Nothing in the crate opens a socket.

**The check is on the path, not beside it.** `review()` reads a saved project the way somebody
receiving it would and returns findings. `PublicationBundle::prepare` is the only way to make a
publication and refuses outright if the review it is handed was refused, so there is no version
of this that skips the check by calling a different function.

**The check runs twice, and the second one decides.** The desktop panel reviews the project so
that somebody sees the findings while they can still act on them. `prepare_publication` reviews
it again on the Rust side and its answer is final. A front end is not a trust boundary
(`THREAT-MODEL.md` T2), and one that has been through a debugger must not be able to publish
what the check refuses.

**Every finding says what would change the answer.** A refusal without a remedy is a dead end,
and the person facing it usually cannot tell which of forty settings is the problem. A test
holds this property for every finding rather than trusting each new one to remember.

**What it refuses, today:** a secret in a setting; a path inside a home folder; a component this
build cannot read, because a capability nobody can read is one nobody can consent to; a
component whose content no longer matches the digest the project pinned it by; and a copyleft
part carried into a work offered under other terms. Warnings and notes do not refuse.

**What comes out is a folder, not a request.** The project file and a `publication.json`
alongside it: who is offering it, under what name and licence, the content hash and size, and
every capability it will ask for — gathered from the components rather than typed by the author,
because nobody discloses their own permissions accurately from memory. The project is copied,
never moved: publishing must not be able to take somebody's only copy of their own work.

**Money is modelled and does not move.** Whole minor units, a split whose shares add to the
gross at every amount and rate, states that move one way so a refunded purchase cannot come back
to life, and entitlements that a client may never assert about itself. No commission rate is
written down: nobody has decided one, and a number in a source file has a way of becoming a
promise. §6's order is unchanged — money is still last.

**A licence question is answered with "no" or "I cannot tell", never with "yes" for terms this
software cannot read.** Custom terms always come back as needing a person.

## Consequences

A project can be prepared for publication today, offline, and the preparation is worth
something on its own: it is the moment somebody finds out their API key is in the file. The
folder it produces is what would be uploaded, so building the registry later does not mean
rewriting what a publication is.

The checksum in the bundle is integrity, not provenance. It proves the bytes did not change on
the way; it says nothing about who made them. That is ADR-0008's signature, which does not
exist in this build, and the two must never be spoken of as though they were the same thing.

This is not an audit and must not be described as one. It finds the mistakes that are mechanical
enough to find. No external security review has happened.

A component still cannot be published: there is no WebAssembly host to run one in, so
`Kind::Component` is refused by `prepare` rather than offered and disappointing somebody later.

## Alternatives considered

**Wait for the registry.** Every check here would have been written anyway, later, under
schedule pressure, by whoever was building the upload path — which is exactly the moment a
check gets described as "we can add that after launch".

**Check only in the interface.** Faster to build and worth nothing: the interface is the one
part of this that an attacker controls.

**Let a warning be clicked past.** Rejected for the blocking findings. A secret in a published
file is not a matter of taste, and neither is a component nobody can read.
