# THREAT MODEL

> Method: STRIDE per trust boundary, plus an explicit abuse-case pass for the marketplace.
> Scope: desktop client, component supply chain, backend API, marketplace, website.
> Status: living document. Every new trust boundary must be added here before it ships.
>
> This document does not claim the system is secure. It states what we defend, how, and
> **what we knowingly do not defend against**.

---

## 0. Assets, ranked

| # | Asset | Why it ranks here |
|---|---|---|
| 1 | The user's machine and files | Compromise here is unrecoverable and is the reason the product could be dangerous at all |
| 2 | User secrets (API keys, tokens) held for workflows | Directly monetisable, reused elsewhere by the victim |
| 3 | Integrity of the component supply chain | One poisoned popular component compromises every installer of it |
| 4 | The release/update channel | A malicious update is a compromise of the entire installed base at once |
| 5 | Account and session integrity | Account takeover → publish malicious components as a trusted author |
| 6 | Marketplace funds and payout integrity | Fraud, chargeback abuse, payout redirection |
| 7 | Backend data (projects, PII) | GDPR exposure, reputational |
| 8 | Availability | Painful, not existential, for a local-first product |

Note the ordering: an outage is far less bad than a single successful supply-chain attack.
Design trade-offs follow that ordering — we will accept downtime to avoid shipping something
unverified.

---

## 1. Trust boundaries

```
 (T1) third-party component  ──►  host runtime
 (T2) desktop client         ──►  backend API
 (T3) publisher              ──►  registry
 (T4) update server          ──►  installed client
 (T5) browser                ──►  website / API
 (T6) admin operator         ──►  admin plane
 (T7) host runtime           ──►  OS (files, network, processes, keystore)
```

Everything below is organised by boundary. Each threat gets: vector → control → residual risk.

---

## T1 — Third-party component → host runtime

**The primary boundary.** A component is assumed hostile. Not "probably fine because we
reviewed it" — *hostile*.

| # | Threat | Control | Residual |
|---|---|---|---|
| T1.1 | Reads arbitrary files (`~/.ssh`, browser profiles, wallets) | No `wasi:filesystem` in the component world. Files reachable only through host-owned handles scoped to wired ports (ARCHITECTURE §4.2). Paths are never expressible. | A component can still read data the user *deliberately* wired to it. Mitigated by the consent dialog naming the folder. |
| T1.2 | Exfiltrates data over the network | `http-request` is capability-gated, default deny. Grant is per-component, and where a host allowlist is declared it is enforced by the broker, not by the component. DNS is not exposed. | A component granted broad network access can exfiltrate what it can read. The consent dialog states this in those words. |
| T1.3 | Spawns processes / RCE | No process capability exists in the Wasm world at all. Not "denied" — absent. | None via this path. Native escape would require a `wasmtime` sandbox-escape CVE → §6. |
| T1.4 | Cryptomining / CPU burn | Fuel ceiling + epoch interruption + per-node wall-clock timeout. Runs are foreground and cancellable; there is no background execution a user did not start. | A component can waste CPU up to its ceiling within a run the user started. |
| T1.5 | Memory exhaustion / host OOM | `ResourceLimiter` caps linear memory and table growth per instance; instances are dropped at run end. | Host under memory pressure degrades; does not grant authority. |
| T1.6 | Infinite loop / hang | DAG validation forbids cycles structurally; `Loop` has bounded iteration; epoch interruption kills a non-yielding instance. | — |
| T1.7 | Reads another component's data in the same run | Handles are per-node and revoked at run end. No shared linear memory. | — |
| T1.8 | Behaves benignly during review, maliciously later ("sleeper") | Capabilities are enforced at run time from the *signed* manifest, so a sleeper still cannot exceed what the user granted and saw. Review is not the control. | A component granted powerful capabilities can misuse them later. Handled by revocation (T3.5) and by the permission UI discouraging broad grants. |
| T1.9 | Confused-deputy: tricks a *core* component into acting for it | Core components call the same broker with the *calling node's* grant set, not an ambient privilege. There is no privileged bypass path. | — |
| T1.10 | Manifest says one thing, code does another | Enforcement is entirely broker-side from the manifest. A lying manifest under-declares and simply gets denied at run time — it cannot over-reach. | Under-declaring produces a confusing failure, not an escalation. Treated as a UX bug. |

**Explicitly not defended:** side-channel and speculative-execution attacks from within Wasm
against host memory. Out of scope for v1; revisit if `wasmtime` guidance changes.

---

## T2 — Desktop client → backend API

| # | Threat | Control |
|---|---|---|
| T2.1 | Credential theft from disk | Tokens live in the OS keystore, never in a config file or `localStorage`. Refresh tokens are rotated on use; reuse of a rotated token revokes the family. |
| T2.2 | MITM | TLS only; HSTS on all web origins; the updater additionally verifies a signature, so TLS is not the only integrity control. |
| T2.3 | IDOR (read/modify another user's project) | Every handler authorises on the *resource*, not just authenticates the caller. Enforced by a shared guard rather than per-route discipline, with tests that assert cross-tenant reads 404. |
| T2.4 | Mass assignment / privilege escalation via payload | Strict input schemas (allowlist fields); role and ownership fields are never bindable from the request body. |
| T2.5 | Abuse / scraping | Rate limits per account, per IP, and per expensive endpoint; publishing and payout endpoints are stricter. |
| T2.6 | SSRF via a user-supplied URL reaching backend infra | Any server-side fetch resolves the host first and refuses private/link-local/loopback ranges, refuses redirects to them, and runs from an egress-restricted path. |

---

## T3 — Publisher → registry (supply chain)

The highest-leverage attack surface: one compromise, many victims.

| # | Threat | Control |
|---|---|---|
| T3.1 | Malicious component published | Sandbox is the boundary (T1). On top: manifest validation, capability review weighted by how much the component asks for, automated scanning, staged rollout for new publishers. |
| T3.2 | Typosquatting a popular id | Reverse-DNS ids tied to a verified publisher namespace; similarity check against popular ids at submission; the install UI shows publisher identity, not just a pretty display name. |
| T3.3 | Account takeover of a trusted publisher | MFA required to publish. Publishing keys are separate from login credentials. New signing keys start a visible trust-reset with a cooling period rather than silently inheriting reputation. |
| T3.4 | Tampering after acceptance (registry or CDN compromise) | Client verifies publisher signature **and** content hash at install *and* at every load. The CDN is untrusted by design. |
| T3.5 | A component turns out to be malicious after distribution | Signed, monotonically-versioned revocation list, cached locally, checked at load. Kill switch is per `id@version`. List rollback is rejected; a stale cached list is preferred over no list. |
| T3.6 | Dependency confusion / poisoned transitive dep | Components resolve against pinned content hashes in `lock.json`. No range resolution at install time. |
| T3.7 | Malicious build toolchain in the SDK | SDK pins its own dependencies by hash; release builds are reproducible so a published artifact can be independently rebuilt and compared. |

---

## T4 — Update channel → installed client

| # | Threat | Control |
|---|---|---|
| T4.1 | Malicious or tampered update | Updates are signed; the client verifies the signature against a pinned key **before** the artifact is written to a location it would execute from. An unverified artifact is never executed. |
| T4.2 | Downgrade to a known-vulnerable version | Version is monotonic; the client refuses lower versions unless the user explicitly performs a rollback to a locally-retained previous build. |
| T4.3 | Signing key compromise | Key rotation via a signed key-history chain; the pinned root can endorse a successor. Offline root, online signing key. |
| T4.4 | Installer tampering on the download page | Published SHA-256 next to every artifact, plus a signature; the download page states how to verify. |

**No unsigned binary is ever downloaded and executed.** If verification fails the update is
discarded and the failure is surfaced — never retried silently in a loop, never "install
anyway".

---

## T5 — Browser → website / API

Standard web surface: XSS (CSP with nonces, no `unsafe-inline`, no `dangerouslySetInnerHTML`
on user content), CSRF (SameSite + token on state-changing routes), clickjacking
(`frame-ancestors 'none'`), open redirect (allowlist), enumeration (uniform responses on
auth endpoints), bot signup and review-bombing (§7).

The interactive terminal on the landing page is a **scripted simulation with no eval and no
backend**. It accepts no input that is interpreted as a command. This is a deliberate
constraint, noted here so nobody "improves" it later into a real shell.

---

## T6 — Admin plane

Compromise here means the ability to unrevoke malware and redirect payouts, so it is treated
as a separate application, not a flag on a user row: separate origin, MFA mandatory, RBAC with
least privilege, every action written to an append-only audit log, dangerous actions
(takedown, refund, payout change, role grant) additionally recorded with actor, reason, and
before/after. Admins cannot read user project contents by default.

---

## T7 — Host runtime → OS

The broker is the only code that touches OS authority. It:

- resolves every filesystem operation against a canonicalised, symlink-resolved root and
  rejects anything that escapes it (checked after resolution, not by string inspection);
- refuses to grant capabilities over sensitive locations (the app's own data, the keystore,
  system directories) regardless of user consent;
- writes an entry to the run journal for every capability call, which is what the debugger
  displays under "permissions used";
- never passes a secret value to a component — a component receives a *reference* the host
  substitutes at the point of use.

---

## 2. Secrets

Never in plaintext, never in the project file, never in logs, never in telemetry.
Windows Credential Manager / macOS Keychain / Linux Secret Service, via one abstraction with a
per-platform test. Log redaction is applied at the sink, not at each call site, because
per-call-site discipline is exactly the thing that fails once and leaks forever. Error objects
from network layers are logged by *type*, not by message, since a message can contain a URL
that contains a key.

---

## 3. Privacy

Default: collect as little as possible. Telemetry and crash reporting are **opt-in** and
presented as a plain question, not a pre-ticked box. Project contents, file paths, file names,
and workflow structure never leave the machine unless the user syncs or publishes. Local data,
cloud data, telemetry, and account data are separated in the UI and in the code, and the
Security Center exports or deletes each.

---

## 4. Marketplace abuse cases

Not STRIDE, but the ones that actually happen to marketplaces:

| Abuse | Control |
|---|---|
| Fake reviews / review bombing | Only verified installs may review; one review per account per component; velocity anomaly detection; reviews weighted by account age and history; ratings are never a raw mean of unweighted stars |
| Sockpuppet download inflation | Downloads deduplicated per account and per install id; obvious farms excluded from ranking rather than banned loudly |
| Paid component that does nothing / does not match description | Refund window, dispute flow, seller strike system |
| Stolen/relicensed content | DMCA-style takedown route, publisher attestation at submit, provenance shown on the listing |
| Payout fraud / stolen card laundering | Payments and KYC delegated to the payment provider; payout hold for new sellers; we never touch card data |
| Impersonating a known brand or author | Verified publisher badges tied to domain or repo proof; name-similarity review before a namespace is granted |

---

## 5. Security testing

| Layer | What runs |
|---|---|
| Static | `cargo clippy -D warnings`, `cargo deny` (licences + advisories), type-check + lint, secret scanning on every commit |
| Dependencies | `cargo audit` and `npm audit` in CI; a failing advisory blocks the merge rather than opening a ticket nobody reads |
| Runtime | A dedicated **hostile component suite**: fixtures that attempt path traversal, unauthorised network, fuel exhaustion, memory exhaustion, and handle forgery. Each asserts a *denial*. These are correctness tests for the boundary — if one starts passing, the boundary is gone. |
| Protocol | Signature-verification and revocation tests, including tampered artifact, rolled-back revocation list, and expired/rotated key |
| Web | Header assertions, authz matrix tests (every role × every route), SSRF fixtures |

---

## 6. Known limitations — stated, not hidden

1. A `wasmtime` sandbox-escape vulnerability would defeat T1. Mitigation is version currency
   and rapid patch releases, not cleverness on our part.
2. Tier A core components run native with full process authority *as code*; the broker
   constrains what they may do, but a bug in a core component is a bug in the trust base.
   Kept deliberately small and reviewed accordingly.
3. Heavy native tools (e.g. video transcoding) cannot be Wasm today. Until an OS-sandboxed
   sidecar exists, such functionality ships only as first-party, or not at all — it is **not**
   opened to third parties as a native plugin escape hatch.
4. A user who grants broad capabilities to a malicious component can be harmed. The UI can
   make this informed; it cannot make it impossible.
5. This model has not been externally audited. That is a prerequisite for a production
   marketplace launch, not for the MVP.
