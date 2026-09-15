# Platform architecture — designed, not built

Everything in this document is **design**. None of it exists in the shipped product, and nothing
in the application or the website presents any of it as working.

**One exception, added 2026-09-15.** The part of publishing that needs no server now
exists, at both ends: the shape of a publication and the check that refuses one, in
`crates/encastra-publish`, reached from the desktop application's Publish panel (ADR-0011);
and the receiving side — a folder can be inspected and imported into a local library, with
the same check run again on the receiving machine and nothing executed (ADR-0012,
`crates/encastra-library`). A publication travels as a folder a person carries. There is
still no registry, no account, no upload, no signature and no money — everything else below
remains design.

It is written down now for one reason: these pieces constrain each other. The sandbox decides
what a component may declare; the declaration decides what the registry must record; the record
decides what a signature covers; the signature decides what an update can safely replace.
Deciding them one at a time, later, in isolation, is how each one ends up incompatible with the
last.

---

## 1. Third-party components — the WebAssembly sandbox

**Status: designed, not built. Nothing third-party can be installed or executed.**

That last sentence is the honest reason the missing sandbox exposes nothing today.

### The model

Two tiers, one broker:

- **Tier A — core.** First-party components, compiled into the host as native Rust. Fast, and
  trusted because they ship with the product.
- **Tier B — wasm.** Everything else. A WebAssembly Component Model module (WASI 0.2), run under
  `wasmtime`, with **no ambient authority at all**: no filesystem preopens, no sockets, no
  environment, no clock beyond what is granted.

Both tiers call the same capability broker. That is the property worth protecting: a first-party
component that did not declare `fs.read` cannot open a file either, so the security model is not
a special case applied to strangers.

### What a sandbox must enforce that the current broker does not

| Limit | Why | Mechanism |
|---|---|---|
| Wall-clock timeout | A component that never returns hangs the workflow | `wasmtime` epoch interruption |
| Fuel | An infinite loop burns a core indefinitely | `wasmtime` fuel metering |
| Memory ceiling | A component can otherwise exhaust the machine | `ResourceLimiter` |
| Instance lifetime | State must not leak between runs | Fresh instance per execution |

None of these exist today, because nothing untrusted runs today. All four must exist **before**
the first third-party component does — they are not a later optimisation.

### The interface

A `.wit` world defining what the host offers and what a component must export. It does not exist
yet, and `docs/ARCHITECTURE.md` §3.2 is labelled accordingly.

### The rule that must not bend

**Do not ship an insecure execution path in order to claim third-party support.** A component
system whose sandbox is "mostly" effective is worse than one that honestly cannot install
components, because the first invites people to run strangers' code.

---

## 2. Component registry

### What exists already

`crates/encastra-publish` holds the vocabulary this section uses — listing, release, publisher,
licence, pricing, entitlement, purchase, payout, moderation state — as types with tests rather
than as prose. Two things follow:

- **A publication can be prepared today, offline.** The desktop application reads a saved project
  the way somebody receiving it would, refuses it if it carries a secret, names its author's home
  folder, uses a component this build cannot read, no longer matches a pinned digest, or carries
  a copyleft part into other terms — and otherwise writes the project and a `publication.json`
  into a folder. That document is what would be uploaded on the day there is anywhere to send it.
- **The capability list in a release record is gathered, not typed.** It comes from the manifests
  of the components the project actually uses, which is the only version of that field anybody
  should trust.
- **A publication can be taken in today, offline, and nothing runs when it is.** The receiving
  machine reads the two files, verifies the project's bytes against the document, runs the
  same review against its own components, refuses a document that disagrees with the project
  about its runtime or its permissions, and only then copies the verified bytes into a local
  library. Opening is a separate act; running still asks, per run, like any other project
  (ADR-0012).
- **A local library remembers what is on this machine** — created, imported, prepared — with a
  content hash taken when each was last seen, so a file that changed or went missing is shown
  as such rather than opened on trust.

What this does **not** do: sign anything (the checksum is integrity, not provenance — ADR-0008),
verify a publisher (there are no accounts, and the interface says so wherever a publisher's
name appears), or move a publication anywhere on its own. See ADR-0011 and ADR-0012.


**Status: designed, not built.**

The registry is the thing that makes a component ecosystem possible, and the thing that makes it
dangerous. Its record must carry everything a host needs to refuse:

| Field | Why it must be there |
|---|---|
| `id`, `version` | Identity, semver-ordered |
| `publisher` | Who is accountable; verified, not self-asserted |
| `signature` | Over the artefact, by a key tied to the publisher |
| `checksum` (SHA-256) | Integrity independent of transport |
| `capabilities` | Declared up front, so a host can refuse *before* downloading |
| `runtime` range | What host versions it claims to work on |
| `protocol schema` | Refused outright if higher than the host understands |
| `yanked` / `advisory` | A published version must be retractable |

Non-negotiable properties:

- **Immutable versions.** A published version is never replaced, only yanked. Otherwise a
  checksum means nothing.
- **Capabilities visible before install.** "This component wants to read your files and use the
  network" has to be answerable before the bytes arrive.
- **Yanking is not deletion.** Somebody who has it installed must be told, not silently broken.
- **No install-time execution.** No post-install scripts, ever. That is the single most exploited
  feature of every package ecosystem that has one.

---

## 3. Marketplace and payments

**Status: designed, not built. No payment integration exists and none should until there is a
backend that can hold it safely.**

Tiers: free, paid, commercial. A creator publishes; the platform takes a commission; refunds are
possible.

The rules that matter more than the model:

- **No card data ever touches Encastra.** A payment provider's hosted flow, always. Storing a
  card is a compliance obligation nobody here should take on.
- **A paid component is not a more-trusted component.** Money buys distribution, not permissions.
  The permission prompt must look identical whether something was free or expensive.
- **Refunds have to work before sales do.** Building charging without refunding produces a
  support burden and, in the EU, a legal problem.
- Consumer withdrawal rights, VAT/MOSS obligations and marketplace-operator liability all apply
  the moment money moves. `apps/web/src/config/legal.ts` holds drafts; all of them need counsel.

---

## 4. Community and accounts

**Status: designed, not built. There is no sign-in and no server.**

If accounts ever exist, they exist for publishing — not for using the product. **The application
must keep working with no account at all**, because local-first is the claim it makes about
itself, and an account requirement would quietly retract it.

Shape: profile, sessions, devices, and a publisher identity distinct from a user identity.
Community surfaces projects, components and templates that real people published. Until that is
true, showing any of it populated would be inventing users, which the product does not do.

---

## 5. Updates

**Status: designed, not built. Updating means downloading a new installer, and Settings says so.**

The design, which is settled:

- **Verify before writing anywhere executable.** The signature is checked against a key pinned in
  the binary *before* the artefact lands somewhere it could be run from. The reverse order is how
  update mechanisms become malware delivery.
- **Monotonic versions.** A lower version is refused unless somebody deliberately rolls back to a
  build they already have.
- **Key rotation through a signed key-history chain**, so a compromised online key does not
  require shipping a new binary to everybody.
- **A failed verification is discarded and surfaced.** Never retried silently in a loop, and
  there is no "install anyway".
- **Channels**: stable, beta, nightly. A channel is a manifest, not a different codebase.
- **Rollback is part of the design, not an afterthought.** An update that cannot be undone is an
  update nobody should accept.

The updater's signing key is **separate** from the code-signing certificate, and losing it means
no installed copy can ever be updated again. It is backed up before the first release that uses
it. See `docs/SIGNING.md`.

---

## 6. What has to be true before any of this ships

In order, because each depends on the one before:

1. **An external security review of the broker and the handle model.** Not done. Everything here
   rests on the broker being correct, and it has never been audited by anybody outside this
   repository.
2. **The sandbox, with all four limits.** Third-party code cannot run before this.
3. **Signing**, for the application and for components. See `docs/SIGNING.md`.
4. **A licence decision.** See `docs/LICENSING.md`.
5. **The registry**, with immutable versions and pre-install capability disclosure.
6. **Legal review** of the marketplace terms, the creator agreement and the EULA.
7. **Then, and only then**, money.

Skipping step 1 or 2 to reach step 5 sooner would make every claim the product makes about
security false at once.
