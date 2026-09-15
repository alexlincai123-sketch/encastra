# THREAT MODEL

> Method: STRIDE per trust boundary, plus an explicit abuse-case pass for the marketplace.
> Scope of the *analysis*: desktop client, component supply chain, backend API, marketplace,
> website.
> Status: living document. Every new trust boundary must be added here before it ships.
>
> This document does not claim the system is secure. It states what we defend, how, and
> **what we knowingly do not defend against**.
>
> **Read the scope note before the tables.** Most of what is analysed here does not exist in
> the shipped build. Of the seven boundaries below, two are crossed by running code today —
> **T7, the host runtime against the OS**, and **T5, a browser against the website** (static
> pages and one locale cookie; no API). The other five are analyses of systems that have not
> been built: there is no third-party component loader, no backend, no registry, no update
> channel and no admin plane. A control described for an unbuilt boundary is a
> requirement on whoever builds it, not a defence anybody currently has.
>
> [SECURITY](SECURITY.md) is the implementation report — what the code actually enforces, and
> §9 of it is the list of gaps. Where the two disagree, the code wins.

### Which boundaries exist

| Boundary | Exists in the shipped build? |
|---|---|
| T1 — third-party component → host runtime | **no.** Nothing can load a third-party component; a `kind: "wasm"` node fails with `no-implementation` |
| T2 — desktop client → backend API | **no.** There is no backend, no account and no sign-in |
| T3 — publisher → registry | **no.** There is no registry, no publishing and no signing |
| T4 — update server → installed client | **no.** There is no update channel |
| T5 — browser → website / API | **the website, yes.** `apps/web` is a Next.js site with a nonce-based CSP, no accounts, no database and one server action (the locale cookie); there is no API |
| T6 — admin operator → admin plane | **no.** There is no `apps/admin` at all |
| **T7 — host runtime → OS** | **yes.** The capability broker is built, enforced and tested |

---

## 0. Assets, ranked

The ranking is of the finished product, and it is what the design is steered by. Assets 3–7 do
not exist yet, which does not change their order — it changes only whether anything can reach
them today.

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
 (T1) third-party component  ──►  host runtime            DESIGNED, NOT BUILT
 (T2) desktop client         ──►  backend API             DESIGNED, NOT BUILT
 (T3) publisher              ──►  registry                DESIGNED, NOT BUILT
 (T4) update server          ──►  installed client        DESIGNED, NOT BUILT
 (T5) browser                ──►  website / API           DESIGNED, NOT BUILT
 (T6) admin operator         ──►  admin plane             DESIGNED, NOT BUILT
 (T7) host runtime           ──►  OS (files, network, clipboard, notifications)      BUILT
 (T8) editor (webview)       ──►  privileged runtime (Tauri IPC)                     BUILT
```

Everything below is organised by boundary. Each threat gets: vector → control → residual risk.

> T7's line has changed since an earlier revision: it named the keystore and process execution
> as things the runtime reaches across this boundary. It reaches neither. There is no keystore
> integration and no process capability in this build.

---

## T1 — Third-party component → host runtime — *designed, not built*

> **This boundary is designed and not built, which means it is also untested.** No third-party
> component can execute in 0.1.0-beta.1, because there is no loader: no host crate, no
> `wasmtime`, no WIT world. The reason a hostile component cannot get past this boundary today
> is that it cannot get *to* it. Nothing in the table below has ever been exercised against a
> real adversary, and a control marked "needs the Wasm host" does not exist in any form.
>
> The analysis is kept because it is the specification the host has to be built to, and because
> several of its controls are already real for first-party components (§T7) and will simply
> extend.

**The primary boundary, once it exists.** A component is assumed hostile. Not "probably fine
because we reviewed it" — *hostile*.

The **Built today?** column says whether the control has an implementation now, for the
first-party components that do run. It is the difference between a defence and a plan.

| # | Threat | Control (designed) | Built today? | Residual |
|---|---|---|---|---|
| T1.1 | Reads arbitrary files (`~/.ssh`, browser profiles, wallets) | No `wasi:filesystem` in the component world. Files reachable only through host-owned handles scoped to wired ports (ARCHITECTURE §4.2). Paths are never expressible. | **Partly.** The handle model and per-node reachability are built and tested in the broker; the Wasm world that would make paths unrepresentable for third-party code is not | A component can still read data the user *deliberately* wired to it. Mitigated by the consent dialog naming the folder. |
| T1.2 | Exfiltrates data over the network | `http-request` is capability-gated, default deny. The grant is per node *and per host*, enforced by the broker rather than by the component, and an empty allowlist means no hosts rather than all hosts. | **Partly.** Built for the first-party HTTP component: the broker checks the host before anything is sent, redirects are not followed at all, credentials in a URL are refused, plain `http` needs an explicit opt-in, and the response is size-capped. No Wasm equivalent exists | A component granted network access can exfiltrate what it can read. The allowlist is an exact host match and does not refuse private or loopback addresses — a user who allows one has allowed it. |
| T1.3 | Spawns processes / RCE | No process capability exists at all. Not "denied" — absent. | **Yes.** There is no `process.*` capability kind, a manifest declaring one is refused at validation, and a test asserts no first-party component asks for one | None via this path. A native escape would need a `wasmtime` sandbox-escape CVE → §6. |
| T1.4 | Cryptomining / CPU burn | Fuel ceiling + epoch interruption + per-node wall-clock timeout. | **No.** None of the three exists. Cancellation is a cooperative flag checked between nodes and by components that choose to check it; a component that loops without checking is not stopped | Runs are still started by a user, and a session started by a user can be stopped by one. Within a run, CPU is unbounded. |
| T1.5 | Memory exhaustion / host OOM | `ResourceLimiter` caps linear memory and table growth per instance; instances are dropped at run end. | **No.** There is no `ResourceLimiter` and no memory ceiling. The image components apply their own decode limits, which is a property of those components | A first-party component with a bug can exhaust memory. Nothing grants authority as a result. |
| T1.6 | Infinite loop / hang | DAG validation forbids cycles structurally; a `Loop` component has bounded iteration; epoch interruption kills a non-yielding instance. | **Partly.** Cycle rejection is built and tested, including self-loops, and it is genuinely structural. The `Loop` component does not exist — the cycle error's hint recommends one anyway, which is a wrong hint. Epoch interruption does not exist | A graph cannot loop. A single node can. |
| T1.7 | Reads another component's data in the same run | Handles are per-node and dropped with the run. No shared linear memory. | **Yes**, for the handle half: reachability is per node, a forged handle number reaches nothing, and a component cannot relabel a handle because the host's record of its kind is the one that counts. Tested | — |
| T1.8 | Behaves benignly during review, maliciously later ("sleeper") | Capabilities are enforced at run time from the *signed* manifest, so a sleeper still cannot exceed what the user granted and saw. Review is not the control. | **Partly.** Run-time enforcement from the manifest is built. **Nothing is signed and nothing is verified**, so "from the *signed* manifest" is not true today | A component granted powerful capabilities can misuse them later. Designed to be handled by revocation (T3.5), which does not exist. |
| T1.9 | Confused-deputy: tricks a *core* component into acting for it | Core components call the same broker with the *calling node's* grant set, not an ambient privilege. There is no privileged bypass path. | **Yes.** Built and tested: a core component that did not declare `fs.read` cannot read even a file wired to it, and the host's own read path hands nothing to any component | — |
| T1.10 | Manifest says one thing, code does another | Enforcement is entirely broker-side from the manifest. A lying manifest under-declares and simply gets denied at run time — it cannot over-reach. | **Yes.** Also checked in the other direction: a component that returns an output its manifest does not declare fails with `contract-broken` rather than passing an unexpected value downstream | Under-declaring produces a confusing failure, not an escalation. Treated as a UX bug. |

**Explicitly not defended:** side-channel and speculative-execution attacks from within Wasm
against host memory. Out of scope for v1; revisit if `wasmtime` guidance changes. This is
hypothetical in the strongest sense — there is no Wasm.

---

## T2 — Desktop client → backend API — *designed, not built*

> There is no backend. `services/api` is an empty directory, there is no account, no sign-in,
> no session and no token. Nothing below is implemented; it is the specification the API has to
> be built to.

| # | Threat | Control (designed) |
|---|---|---|
| T2.1 | Credential theft from disk | Tokens live in the OS keystore, never in a config file or `localStorage`. Refresh tokens are rotated on use; reuse of a rotated token revokes the family. |
| T2.2 | MITM | TLS only; HSTS on all web origins; the updater additionally verifies a signature, so TLS is not the only integrity control. |
| T2.3 | IDOR (read/modify another user's project) | Every handler authorises on the *resource*, not just authenticates the caller. Enforced by a shared guard rather than per-route discipline, with tests that assert cross-tenant reads 404. |
| T2.4 | Mass assignment / privilege escalation via payload | Strict input schemas (allowlist fields); role and ownership fields are never bindable from the request body. |
| T2.5 | Abuse / scraping | Rate limits per account, per IP, and per expensive endpoint; publishing and payout endpoints are stricter. |
| T2.6 | SSRF via a user-supplied URL reaching backend infra | Any server-side fetch resolves the host first and refuses private/link-local/loopback ranges, refuses redirects to them, and runs from an egress-restricted path. |

---

## T3 — Publisher → registry (supply chain) — *designed, not built*

> There is no registry, no publishing flow, no signing and no revocation. The only components
> that exist are compiled into the binary. This is the highest-leverage attack surface a
> finished product would have — one compromise, many victims — and none of it is defended
> today because none of it is reachable.

| # | Threat | Control (designed) |
|---|---|---|
| T3.1 | Malicious component published | Sandbox is the boundary (T1). On top: manifest validation, capability review weighted by how much the component asks for, automated scanning, staged rollout for new publishers. |
| T3.2 | Typosquatting a popular id | Reverse-DNS ids tied to a verified publisher namespace; similarity check against popular ids at submission; the install UI shows publisher identity, not just a pretty display name. |
| T3.3 | Account takeover of a trusted publisher | MFA required to publish. Publishing keys are separate from login credentials. New signing keys start a visible trust-reset with a cooling period rather than silently inheriting reputation. |
| T3.4 | Tampering after acceptance (registry or CDN compromise) | Client verifies publisher signature **and** content hash at install *and* at every load. The CDN is untrusted by design. |
| T3.5 | A component turns out to be malicious after distribution | Signed, monotonically-versioned revocation list, cached locally, checked at load. Kill switch is per `id@version`. List rollback is rejected; a stale cached list is preferred over no list. |
| T3.6 | Dependency confusion / poisoned transitive dep | Components resolve against pinned content hashes in `lock.json`. No range resolution at install time. |
| T3.7 | Malicious build toolchain in the SDK | SDK pins its own dependencies by hash; release builds are reproducible so a published artifact can be independently rebuilt and compared. |

Two pieces of the design already exist in a partial form and are worth naming, because they
are what the rest bolts onto: `lock.json` pins components by **manifest digest** rather than
by version range, and component lookup is by exact `id@version` with no resolution step. What
is missing is any code that *checks* the pinned digest when a project is opened.

---

## T4 — Update channel → installed client — *designed, not built*

> There is no updater and no release channel. Nothing downloads anything.

| # | Threat | Control (designed) |
|---|---|---|
| T4.1 | Malicious or tampered update | Updates are signed; the client verifies the signature against a pinned key **before** the artifact is written to a location it would execute from. An unverified artifact is never executed. |
| T4.2 | Downgrade to a known-vulnerable version | Version is monotonic; the client refuses lower versions unless the user explicitly performs a rollback to a locally-retained previous build. |
| T4.3 | Signing key compromise | Key rotation via a signed key-history chain; the pinned root can endorse a successor. Offline root, online signing key. |
| T4.4 | Installer tampering on the download page | Published SHA-256 next to every artifact, plus a signature; the download page states how to verify. |

**No unsigned binary is ever to be downloaded and executed.** If verification fails the update
is discarded and the failure is surfaced — never retried silently in a loop, never "install
anyway". Stated as a requirement on the updater, since there is not one.

---

## T5 — Browser → website / API — *designed, not built*

> There is no website. `apps/web` is an empty directory, and there is no landing page, no
> marketing site and no docs site to attack.

The standard web surface, as a requirement for whoever builds it: XSS (CSP with nonces, no
`unsafe-inline`, no `dangerouslySetInnerHTML` on user content), CSRF (SameSite + token on
state-changing routes), clickjacking (`frame-ancestors 'none'`), open redirect (allowlist),
enumeration (uniform responses on auth endpoints), bot signup and review-bombing (§4).

One constraint is recorded here in advance rather than after the fact: if the landing page
gets an interactive terminal, it is to be a **scripted simulation with no eval and no
backend**, accepting no input that is interpreted as a command — noted so that nobody
"improves" it later into a real shell.

---

## T6 — Admin plane — *designed, not built*

> There is no admin application. `apps/admin` is an empty directory, and there is nothing to
> moderate, revoke or pay out.

Compromise here would mean the ability to unrevoke malware and redirect payouts, so it is to be
treated as a separate application, not a flag on a user row: separate origin, MFA mandatory,
RBAC with least privilege, every action written to an append-only audit log, dangerous actions
(takedown, refund, payout change, role grant) additionally recorded with actor, reason, and
before/after. Admins must not be able to read user project contents by default.

---

## T7 — Host runtime → OS

**This is the boundary that exists, and it is enforced.** `crates/encastra-core/src/broker.rs`
is the only code in the runtime that touches OS authority, and every capability call from every
component — first-party included, since that is all there is — goes through it. It:

- **grants by allow-list, not by deny-list.** A node can reach a directory only if the user
  granted *that* node *that* directory. Every filesystem operation is resolved with
  `std::fs::canonicalize` — so symlinks and `..` are resolved away — and the result must be
  contained within a granted root. Containment is decided on the resolved path, never by
  inspecting the string that was passed in, which is where traversal bugs live. A node with no
  grant reaches nothing, and an empty grant means *nothing* rather than *everything*.

  > An earlier revision of this document said the broker "refuses to grant capabilities over
  > sensitive locations (the app's own data, the keystore, system directories) regardless of
  > user consent". **No such deny-list exists in `broker.rs`.** The document was describing a
  > weaker control than the one that is actually implemented, and the difference is worth being
  > exact about.
  >
  > A deny-list of sensitive paths refuses the locations somebody thought to enumerate and
  > permits everything else. An allow-list of granted roots does the reverse: it refuses
  > everything nobody explicitly permitted, **including the locations nobody thought of** — the
  > wallet directory that did not exist when the list was written, the config file of a tool
  > shipped next year. For the property that matters here — *can a component reach somewhere it
  > was not given?* — the allow-list is the stronger of the two, and it is the one that is built.
  >
  > What a deny-list would add is a second, narrower guarantee: refusing a sensitive path even
  > when the user *did* grant it. That guarantee is the one the allow-list does not provide, and
  > it is missing. The correction is in the product's favour and is recorded rather than quietly
  > swapped, because the limitation travels with it: see below.

- **scopes reachability to what the graph actually wired.** A capability grant is not enough on
  its own. Opening a handle requires two independent checks, and both must pass: the node
  declared the capability, *and* the executor made that particular handle reachable by that
  particular node because an edge delivered it there. A component that invents a handle number
  reaches nothing; a node wired to a watcher's *filename* output has not thereby been given the
  file. Nor can a component relabel a handle to a kind it is not — the host's record wins.

- **refuses a capability this build cannot enforce**, at validation, before it can ever reach a
  consent dialog. The enforceable set is `fs.read`, `fs.write`, `net.http`, `system.notify`,
  `system.clipboard`. There is no `process.*` capability: not denied, absent.

- **requires permission for both ends of a destructive operation.** A move needs `fs.write`
  covering the source folder as well as the destination, because copying into an allowed folder
  and then deleting from one that was never allowed is a deletion the user did not agree to,
  and that is the more dangerous half.

- **writes an entry to the run journal for every capability call, allowed or denied**, which is
  what the debugger shows under "permissions used". Refusals are constructed and recorded in the
  same function, so there is no path on which a denial happens without being written down. The
  detail recorded is safe to display — a handle number, a folder's name, a host — never a full
  path from the user's machine.

- **keeps file contents and paths out of everything it records.** Journal entries hold
  summaries, never contents; an I/O error is reported by *kind*, never by message, because an
  OS error message can contain a path and a network error message can contain a URL that
  contains a key. There is a test asserting an I/O error never carries a path.

**The limitation that travels with the allow-list.** The broker checks *containment within a
granted root*. It does not check whether that root is somewhere it ought to refuse. A user who
grants a node their home directory, a system directory, or the application's own data folder
gets exactly that grant, and the broker will honour it. The remaining control is therefore the
narrowness of what people are asked to grant, which makes it a UI property as much as a runtime
one: the broker can only be as careful as the scope it is handed. What the editor and the CLI
can currently express as a scope is recorded in [SECURITY](SECURITY.md) §9, which is the
document that tracks the front ends.

**Not in this boundary, despite an earlier revision saying so.** The broker never passes a
secret value to a component — but only because no secret value ever exists: there is no
keystore integration, and nothing substitutes a reference at the point of use. See §2.

---

## T8 — Editor (webview) → privileged runtime

This boundary was missing from earlier revisions of this document, and that omission is where the
2026-09-15 offensive audit found most of what it found. T7 asks what the runtime may do to the
operating system. T8 asks a different question: **who decided it should.**

The editor is a webview. It renders strings that come out of a `.encastra` file — node
configuration, labels, component names — and a `.encastra` file is written by whoever sent it. It
is also the thing that tells the runtime what a person agreed to. Treating it as part of the
application rather than as a surface is defensible right up to the moment a project file supplies
the text in a permission prompt.

No XSS sink was found in the editor: every project-controlled string reaches React as a text
child, never as markup, and the CSP has no `unsafe-eval`. The threats below do not need one.

| Threat | Vector | Control | Residual risk |
|---|---|---|---|
| **Spoofing a decision** — a grant for a folder nobody chose | A hostile project puts `C:\` in a node's `config.folder`. The prompt displays it accurately. The person clicks Allow. | The runtime opens the folder chooser itself (`choose_folder`) and records what the OS returned. A folder grant is admitted only for a path in that record, which the editor cannot add to. | A person can still choose an unwise folder deliberately. Informed consent, not prevented consent. |
| **Reusing a decision for another question** | Somebody picks a folder to import a publication *from*. The graph on the canvas — from a project file they were sent — has a Save step configured with that same folder, or the Publish panel is asked to write into it. | The record is `(purpose, canonical path)`, not a path. `choose_folder` takes the purpose the chooser is being opened for, and each command checks the pair for **its own** purpose: `grant-to-component` for a grant, `publish-into` for `prepare_publication`, `import-from` for `inspect_publication`/`import_publication`. A purpose the editor invents does not deserialise; a purpose it swaps records the folder where only the swapped-to flow reads. | The person still reads only one sentence, drawn by the webview. Per-purpose consent narrows what an answer can be reused for; it does not make the question itself trustworthy. |
| **Substituting a path for the one that was chosen** | The command is called with `C:\a\..\b`, a trailing separator, `\\?\C:\a`, a different case, or a junction that reads as the chosen folder and points elsewhere. | The path is canonicalised by `resolve_grant_directory` *before* it is compared, so every spelling of the chosen folder collapses to it and anything that resolves elsewhere is a different folder. A junction to somewhere else is refused; a junction to the chosen folder is admitted, because it *is* the chosen folder. | Hard links cannot be seen this way (see §7 residual 4b). Canonicalisation is a race in principle — the folder could be replaced between the check and the use — though the window is inside one command. |
| **Spoofing what the prompt says** | Unicode bidirectional overrides and zero-width characters in a project-supplied path reorder or hide what is displayed, so the string read is not the string granted. | `safe-text.ts` strips bidi controls, zero-width characters and C0/C1 controls once, at the point the value is computed, so the string on the button and the string in the grant are the same string. | The prompt is still drawn by the webview. Only its *content* is constrained, not its rendering. |
| **Elevation via an undeclared capability** | A grant naming a capability the component's manifest never declares. | `GrantSet::grant_declared` refuses it. The dialog is built from the manifest, so a grant for something not in the manifest did not come from a question anybody was asked. | None known. Defence in depth: there is no UI path that produces one today. |
| **Elevation via an over-wide scope** | A grant naming a drive root, the system directory, the profile root, or the folder that decides what runs at login. | `resolve_grant_directory` canonicalises and refuses those, the startup folder as a whole tree. | It is a list, not a rule. `C:\Windows\System32` is not on it (the app runs unelevated), nor is every unwise destination. |
| **Elevation via port** | A grant given for `internal.example`'s web API also reaching `:22` or `:5432`. | The port is part of the permission identity in **both** parsers, and a shared conformance table asserts they agree. | None known. |
| **Arbitrary write via a save path** | `save_project` writing bytes to any path the renderer names. | The destination must be a `.encastra` file. | Still any `.encastra` path the user's account can write. `open_project` and `restore_version` still take an arbitrary path to *read*. |
| **Arbitrary read via an input path** | `run_graph`/`start_workflow` take `inputs[].path`; the file is imported into the run's scratch folder, where the step wired to that port can read it. A path filled in from anywhere but a chooser used to be enough. | `choose_file` opens the file chooser on the runtime side and records `(run-input, canonical path)` in the same per-session state as the folders. `seed_for` refuses any input path not in that record, *before* the import, so an unchosen input reads nothing. `canonicalize` means a link whose name sits beside the chosen file and whose content is elsewhere resolves elsewhere, and is refused. | A person can still pick a file they should not have. Informed consent, not prevented consent. `.encastra` holds no inputs, so there is nothing stored to pre-seed — and if that changed the gate would still refuse it, because the gate does not consult the project. |
| **Denial of service** | A component panics; the workflow thread unwinds past the bookkeeping that says a run has finished. | The work is wrapped in `catch_unwind`; cleanup runs either way and the status bar says the run stopped. | A panicking node still ends its run. |

### What this boundary still rests on

**The prompt is rendered by the webview.** The runtime now refuses grants that are forged,
undeclared, over-wide, or for a folder nobody picked — but the sentence a person reads before
clicking Allow is still produced in the renderer. Closing that means the consent dialog being
drawn by the privileged side, which is a design change and not a patch. It is the largest open
item on this boundary.

---

## 2. Secrets

**What is true today:** a secret value cannot reach a `.encastra` file. `Variable` records that
a variable exists, its type, and that it is secret; it has no field that could hold a value, and
a hand-edited file that tries to smuggle one in is refused rather than parsed with the extra
field quietly dropped. That invariant has a test. Journal entries hold summaries rather than
contents, so a token that arrived as a value is recorded as "text (37 characters)" and not as
the token itself. There is no telemetry to leak into and no log file to leak into, because this
build writes neither.

**What is not built:** the mechanism that would make secrets *usable*. There is no keystore
integration — no Windows Credential Manager, no macOS Keychain, no Linux Secret Service, and no
abstraction over them — and nothing reads `variables.json` at run time. A workflow that needs a
token has nowhere safe to put one today, which is a gap rather than a defence.

**The discipline that holds the line, and what it actually is:** error objects from I/O and
network layers are reduced to a *kind* at the point they are constructed — `e.kind()` for I/O, a
hand-written description for HTTP — because a message can contain a URL that contains a key. An
earlier revision described this as redaction applied "at the sink, not at each call site". There
is no sink: there is no logging framework in this repository at all. The protection is
per-construction-site discipline, which is exactly the thing that fails once and leaks forever,
and it is held today by there being very few such sites and a test on the one that matters
most. If a logging framework is ever added, a redacting sink should come with it.

---

## 3. Privacy

Default: collect as little as possible, which in this build means collect nothing.

**There is no telemetry and no crash reporting** — not opt-in, not opt-out, none. Nothing is
collected and nothing is sent. There is no account, no sign-in and no server, so there is also
no sync and no publish path. Project contents, file paths, file names and workflow structure do
not leave the machine, and the only network traffic the product makes is what a workflow the
user built makes itself, through a component granted a specific host.

The desktop app has a Security view that states this and lists the grants active in the current
session. It is read-only: the designed Security Center that **exports or deletes** each
category of data is not built, and neither is any distinction between local, cloud, telemetry
and account data, because three of those four categories are empty. Grants themselves last for
one session and are not remembered — closing the application forgets them.

---

## 4. Marketplace abuse cases — *designed, not built*

> There is no marketplace: no listings, no reviews, no downloads, no payments and no payouts.
> These are the abuse cases to build against, not controls anybody currently has.

Not STRIDE, but the ones that actually happen to marketplaces:

| Abuse | Control (designed) |
|---|---|
| Fake reviews / review bombing | Only verified installs may review; one review per account per component; velocity anomaly detection; reviews weighted by account age and history; ratings are never a raw mean of unweighted stars |
| Sockpuppet download inflation | Downloads deduplicated per account and per install id; obvious farms excluded from ranking rather than banned loudly |
| Paid component that does nothing / does not match description | Refund window, dispute flow, seller strike system |
| Stolen/relicensed content | DMCA-style takedown route, publisher attestation at submit, provenance shown on the listing |
| Payout fraud / stolen card laundering | Payments and KYC delegated to the payment provider; payout hold for new sellers; we never touch card data |
| Impersonating a known brand or author | Verified publisher badges tied to domain or repo proof; name-similarity review before a namespace is granted |

---

## 5. Security testing

What CI runs today, on every push and pull request:

| Layer | What runs |
|---|---|
| Static | `cargo fmt --check`, `cargo clippy --workspace --all-targets -D warnings`, Biome lint, `tsc` type-check across the packages *and* the desktop application |
| Dependencies | `cargo deny check advisories bans licenses sources` and `npm audit --audit-level=high`. A failing advisory blocks the merge rather than opening a ticket nobody reads |
| Secrets | Gitleaks over the full history on every push |
| Protocol | The type-system conformance gate: the TypeScript side generates a compatibility matrix, the Rust side replays it and must agree on every pair, and CI regenerates the matrix and fails on a diff — so a rule change that did not refresh the fixture cannot merge |
| Runtime | Tests on all three platforms (Linux, Windows, macOS) |

**Boundary tests that assert a denial.** These are correctness tests for T7: if one starts
passing, the boundary is gone.

| What it attempts | Where |
|---|---|
| A handle the graph never wired to this node | `broker.rs` — refused, and the refusal is journalled |
| A forged handle number that belongs to nothing | `broker.rs` — refused |
| Relabelling a handle to a kind it is not | `broker.rs` — refused; the host's record wins |
| Reading a connected file without declaring `fs.read` | `broker.rs` — refused, including for first-party code |
| `..` climbing out of a granted folder | `broker.rs` — refused after canonicalisation |
| Writing outside a granted folder | `broker.rs` — refused |
| Moving a file out of a folder that was never granted | `broker.rs` — refused, and nothing is deleted |
| A path smuggled inside a filename | `broker.rs` — sanitised |
| An empty host allowlist treated as "all hosts" | `broker.rs` — refused |
| A watcher pointed at a folder nobody allowed | `image_processor.rs` — refused |
| A node wired to a filename reaching the file behind it | `image_processor.rs` — refused |
| A denied capability failing that node and naming it as why the rest stopped | `end_to_end.rs` |
| File contents reaching the journal | `end_to_end.rs` — asserted absent |

**What is not tested, because it does not exist.** There is no hostile *component* suite, since
there are no third-party components to make hostile. There are no fuel-exhaustion or
memory-exhaustion fixtures, because there is no fuel ceiling and no memory ceiling to exhaust.
There are no signature-verification or revocation tests, because nothing signs and nothing
verifies. There are no web, header, authz-matrix or SSRF tests, because there is no web surface.
An earlier revision of this table listed all four as things that run. They do not.

---

## 6. Known limitations — stated, not hidden

1. **The boundary that matters most does not exist.** Third-party components cannot execute at
   all: no host crate, no `wasmtime`, no WIT world. T1 is an analysis of a system that has not
   been built, and an unbuilt boundary is also an untested one. Everything running today is
   first-party and in-process.
2. **Nothing is signed and nothing is verified.** No Ed25519 signing, no registry
   counter-signature, no verification at install or load, no revocation list. `lock.json` stores
   a manifest digest and no code checks it when a project is opened.
3. **No timeout, fuel ceiling or memory ceiling on a node.** Cancellation is a cooperative flag
   checked between nodes and by components that choose to check it. A component that loops
   without checking is not stopped, and the run cannot be forced to end.
   *Since 2026-09-15:* a **run** has a wall-clock ceiling (`MAX_RUN_DURATION`, one hour), checked
   between nodes, after which it is cancelled as if Stop had been pressed. That bounds a chain of
   `Delay` nodes. It does not bound one node that never returns, which still needs the
   WebAssembly host and epoch interruption.
4. **The broker's deny-list of locations is a list, not a rule.**
   *This item used to read "the broker has no sensitive-location deny-list", which is no longer
   true.* `resolve_grant_directory` now refuses a drive root, the system and program directories,
   the profile root and its container, and the startup folder as a whole tree — and, at the T8
   boundary, refuses any folder the person did not choose in the native chooser *for that
   purpose*: the record is a `(purpose, canonical path)` pair, held in memory for the session and
   never written to disk, so a folder chosen to import from does not become one a component may
   be given. The same record holds the files a run may be seeded with (`choose_file`,
   `run-input`), so `inputs[].path` is no longer a path the renderer names freely. What remains is
   that a list of known-bad destinations can never be complete: `C:\Windows\System32` is not on
   it (the application runs unelevated and cannot write there anyway), and neither is every other
   unwise choice. The allow-list containment check is still the stronger of the two controls.
4b. **Hard links cannot be detected.** On Windows, somebody who can already write into a granted
   folder can hard-link a file from elsewhere on the same volume into it. Canonicalisation cannot
   see this: a hard link has no target path, it *is* the file. The symlink and junction cases are
   closed; this one has no known mitigation short of checking file identity against the granted
   subtree, which NTFS does not make cheap.
4c. **Aggregate memory across a run is bounded by the graph's width, not its length.** Each
   file is capped at 512 MB and each image at 100 megapixels, and a value is released the
   moment its last consumer has finished — so a chain of twenty thousand steps holds one
   document, not twenty thousand (measured: 3.9 GB → 67 MB). What is *not* bounded is width:
   twenty producers feeding one consumer are twenty values held at once, each under its own
   cap. *Since `sec/findings-runtime`:* width is bounded too. `MAX_LIVE_VALUE_BYTES` (1 GiB)
   is the sum of every value held at once by the runtime's own accounting; a producer that would
   cross it fails with `run-memory-budget`, its consumers are skipped, and the run finishes.
   It is a bound on the accounting, not on the process: component working memory, decoder
   buffers and the per-edge delivery copies (`TODO(ENC-NEW-05b)`) sit outside it.
5. **Secrets are declared and never resolved.** No keystore integration exists. The invariant
   that a secret value cannot reach the project file is real and tested; the mechanism that
   would make a secret usable is not built.
6. **Grants are per run and are not remembered**, with no record of what was allowed before and
   no distinction between "allowed once" and "allowed always".
7. **Tier A core components run native with full process authority *as code*.** The broker
   constrains what they may do, but a bug in a core component is a bug in the trust base. The
   set is kept deliberately small — 19 components and 2 triggers — and reviewed accordingly.
8. **A `wasmtime` sandbox-escape vulnerability would defeat T1**, once T1 exists. Mitigation
   will be version currency and rapid patch releases, not cleverness on our part.
9. **Heavy native tools (e.g. video transcoding) cannot be Wasm today.** Until an OS-sandboxed
   sidecar exists, such functionality ships only as first-party, or not at all — it is **not**
   opened to third parties as a native plugin escape hatch.
10. **A user who grants broad capabilities to a malicious component can be harmed.** The UI can
    make this informed; it cannot make it impossible.
11. **This model has not been externally audited.** Encastra has been reviewed by the people who
    wrote it, which is not the same thing. An external audit is a prerequisite for a production
    marketplace launch, not for this beta. An offensive audit was carried out on 2026-09-15
    (`docs/audits/2026-09-15-offensive-audit.md`) and found, among other things, a hostile-input
    test that had been green since the day it was written without ever reaching the code it
    claimed to test. That is the kind of thing a second reader finds and a first one does not,
    and it is the argument for the external audit rather than against it.
12. **The consent prompt is rendered by the webview.** See T8. The runtime independently refuses
    grants that are forged, undeclared, over-wide, or for a folder nobody chose — but the
    sentence a person reads before agreeing is produced in the renderer. This is the largest open
    design item in the built part of the system.
13. **Every command that takes a project path takes the same thing.** `open_project`,
    `restore_version`, `compare_versions`, `review_publication` and `prepare_publication` now go
    through the one `project_path` guard `save_project` had: the name must end in `.encastra`.
    That is a shape check, not a trust boundary — the path still comes from a dialog the person
    drove and `Project::open` is where a file that is not a project is found out — but the
    application no longer reads a shape it would refuse to write.
