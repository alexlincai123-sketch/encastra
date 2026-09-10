# ADR-0008 — Ed25519 signing, content-hash identity, and a signed revocation list

**Status:** accepted · 2026-09-11

## Context

A component travels from a publisher, through a registry and a CDN, onto a user's machine. Any
hop can tamper with it. And sometimes a component that was legitimately published turns out to
be malicious, and every installation of it needs to stop working.

## Decision

**Identity.** A component is `id@version`, and its identity *includes the content hash*. The
registry refuses a republish of the same `id@version` with different bytes. Projects pin
hashes in `lock.json`, not version ranges.

**Signing.** The publisher signs `sha256(canonical_manifest) || sha256(artifact)` with
**Ed25519** (`ed25519-dalek` 3.x). The registry counter-signs on acceptance. Clients pin the
registry root key in the binary; rotation happens through a signed key-history chain so a
compromised online key does not require shipping a new binary.

**Verification happens twice:** at install, and again at every load. A hash mismatch at load
is a hard failure, never a warning. The CDN is untrusted by design — TLS is not the integrity
control.

**Revocation.** A signed, monotonically-versioned revocation list maps `id@version` to a
reason. The client fetches it on a schedule, caches it, and checks it at load.

Its failure modes are chosen deliberately:

| Situation | Behaviour |
|---|---|
| Entry says revoked | **Refuse to load.** Fail closed. |
| Server unreachable, cached list exists | Use the cached list. A stale list beats no list. |
| Server unreachable, no cached list | Load, and surface that revocation data is unavailable. Fail open — otherwise a network outage bricks every offline install. |
| Server offers a *lower* list version than cached | **Reject.** This is a rollback attack. |

The asymmetry is the point: unavailability must not brick a local-first product, but a known
revocation must always win.

## Alternatives rejected

- **TLS alone.** Trusts the registry and the CDN completely, and offers nothing after a
  breach.
- **Signature only, no content hash in identity.** Lets a compromised publisher key
  re-sign different bytes under a version a user already trusts.
- **Online-only revocation check.** Breaks offline use, which is a core promise.
- **RSA / X.509 / Sigstore.** Ed25519 keys are small and fast, and a full PKI is more
  machinery than a first-party registry needs. Transparency-log signing is a credible future
  upgrade once there is an ecosystem to make it meaningful.

## Consequences

**A lost publisher key means a publisher can no longer update their components** — they must
re-establish a namespace with a new key, and the trust reset is visible to users rather than
silent. This is documented in the SDK, prominently, because it is the failure people
actually hit.

The updater has the same shape and the same rule: no unverified binary is ever written to a
location it would be executed from.
