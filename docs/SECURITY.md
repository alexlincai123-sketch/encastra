# SECURITY

> **This document does not claim the product is secure.** It describes the posture as
> implemented, what each control actually enforces, and — in §9 — what it does not. Encastra has
> been security reviewed by the people who wrote it; it has not been externally audited, and
> the boundary that matters most for third-party code does not yet exist in this build.
>
> [THREAT-MODEL](THREAT-MODEL.md) is the analysis: assets, trust boundaries, STRIDE per
> boundary. This is the implementation report. Where they disagree, the code wins and the
> difference is recorded here.

---

## 1. The capability broker

`crates/encastra-core/src/broker.rs` is the only code in the runtime that touches OS authority.
Every capability call from every component goes through it, **including first-party ones**
([ADR-0002](adr/0002-two-tiers-one-broker.md)). A core component that did not declare `fs.read`
cannot open a file, because it asks the broker and the broker refuses. There is a test that
proves it.

Routing trusted code through the same gate costs a little and buys three things:

1. the permission dialog cannot lie, because what it says is what this enforces;
2. the debugger's "capabilities used" panel is complete, not "complete except the built-ins";
3. there is no second, weaker path to forget about. A control that some code can bypass is not
   a control.

### Grants

A grant is a `(node, kind, scope)` triple. Scopes are:

| Scope | Meaning |
|---|---|
| `InputHandles` | only what the graph wired to this node's ports. Needs no decision from the user, because it adds nothing they have not already expressed by drawing an edge |
| `Directory(path)` | one folder the user chose. Nothing outside it, symlinks resolved |
| `HttpHosts(list)` | hosts the user allowed. **An empty list is not "all hosts" — it is no hosts** |
| `Allowed` | a plain yes, for a capability with nothing to parameterise, such as showing a notification |

`GrantSet::allow_declared_input_handles` admits *only* the capabilities a manifest declares with
an `input-handles` scope. Everything wider requires an explicit `grant()` call, which the
application makes after a person has actually said yes. **A manifest asking for something does
not make it granted** — that is the entire point of declaring it.

Grants last one run. They are assembled per invocation and thrown away; nothing persists them.

### Every call is recorded

`allow()` and `deny()` both write a `CapabilityCall` into the journal, carrying a timestamp, the
kind, a detail already made safe to display (a handle number, a folder's name, a host — never a
full path and never a secret), and, for a refusal, the reason. `deny()` records *and* builds the
error in one function, so there is no path where a refusal happens without being written down.

---

## 2. Handles

A file, image, video, folder or byte blob is never a path on the wire and never a byte buffer.
It is an opaque `u64` plus a kind ([ADR-0004](adr/0004-handle-based-media.md)). The host keeps
the path; the component gets the number.

This is what makes "read `~/.ssh/id_rsa` instead" *unrepresentable* rather than merely
forbidden. Path traversal is not blocked here — there is no path to traverse.

`Broker::open_input` makes three independent checks, all of which must pass:

1. **The node declared `fs.read`.** A component that did not ask cannot read, however the graph
   is wired.
2. **The graph gave this node this handle.** Reachability is populated by the executor as it
   delivers inputs. Guessing a number reaches nothing; a forged handle id fails.
3. **The kind the caller claims matches the host's record.** `Handle` is a plain value, so a
   component can construct one with whatever kind it likes. That grants no new authority —
   reachability is checked above — but it would let a component pass a text file off as an image
   and confuse whatever it hands the result to. The host's record is the one that counts.

Only the host can change a handle's kind, through `reclassify`, and only after the content has
actually been checked: `decode-image` probes the bytes before promoting a `file` to an `image`.

`Broker::host_read` reads without any of those checks, and is host-only — it is not exposed on
`NodeContext`. It exists because conversions on an edge are performed by the runtime on behalf
of the edge, not by the node that receives the value. It hands a component nothing: the result
is written into another host-owned handle, and opening *that* still requires the component's own
grant and its own reachability. A test asserts that a component with no `fs.read` still cannot
see what `host_read` could.

### The one thing a component learns about a file

`NodeContext::source_name` returns the filename with no directory. That is the minimum a
workflow needs in order to name its output after its input — a watcher cannot ask a person for
a filename per file — and it reveals nothing about *where* the file is, which is the part that
matters.

---

## 3. Filesystem

**Scratch space is free.** `create_output` places a file in the run's own directory and returns
a handle the node can immediately read back. No user decision is involved, because it is host
storage rather than the user's filesystem. It becomes a file a person can see only when
something later saves it, and that step does need a decision. Note that the journal records this
as an allowed `fs.write`, so the audit trail is complete, even though the component did not need
to declare `fs.write` to perform it.

**Saving is not.** `save_to` requires an `fs.write` grant scoped to a directory. The destination
is canonicalised — symlinks resolved — and containment is checked *on the resolved path*, never
on the string that was passed in. Checking before resolution is how traversal bugs happen. With
no grant at all the refusal says so and tells the user what to do about it.

**Filenames are sanitised** to alphanumerics plus `. - _` and space, trimmed, leading dots
stripped, capped at 120 characters. `../../etc/passwd` becomes `etcpasswd`;
`C:\Windows\system32\x` becomes `CWindowssystem32x`; an empty result becomes `output`.

**A move needs permission at both ends.** Copying into an allowed folder and then deleting from
somewhere that was never allowed would be a deletion the user did not agree to — the more
dangerous half of the operation. `move_to` checks the source directory first and refuses with a
hint saying why. If the copy succeeds and the removal fails, the result is reported as
`move-incomplete` rather than silently accepted as a move.

**Listing a folder** requires an `fs.read` grant scoped to a directory. One level deep, files
only, sorted. A watcher that descended into subfolders would be reading places the person
granting the folder may not have pictured, and recursion is a separate decision deserving its
own answer. Size and modification time come back with the listing so that no caller ever has to
reach for `std::fs` itself — a convenience that let one caller skip the broker would make the
audit trail a fiction.

`import_guarded` is how a trigger turns a file it found into a handle; it re-checks the folder
grant. The unguarded `import_file` is host-only and is what the application calls for a file a
person picked in a dialog.

---

## 4. Network

`net.http` is granted per node **and per host**. Allowing a component to call
`api.example.com` does not allow it to call anywhere else, and `check_http` compares the host
exactly against the granted list. An empty list denies everything.

The `encastra.net.http` component constrains the request before it leaves:

- **HTTPS by default.** A plain `http://` address is refused unless the node's `allow_http`
  setting is on, with an error explaining that plain HTTP can be read and changed in transit.
- **No redirects.** `max_redirects(0)`. Redirects are the SSRF vector: a permitted host can hand
  back a `Location` pointing anywhere, including an address inside the machine. Refusing to
  follow them keeps "allowed hosts" meaning what it says.
- **A 30-second timeout** and a **16 MB response cap**.
- **A strict URL parser** whose output *is* the permission check. It refuses anything but
  `http`/`https`, refuses a URL with no host, lower-cases the host, strips the port, and refuses
  credentials in the URL outright — a password in a URL would land in the journal and in the
  permission prompt. A parser that disagreed with the one making the request would be a way to
  reach a host that was never allowed, so it is deliberately strict rather than forgiving.
- **Errors are described by kind, never by message.** A transport error's message can contain
  the whole URL, and a URL can contain a token in a query string.

A non-2xx status is returned as a result, not raised as a failure: "the server said 404" is
often the useful answer rather than a reason to stop the graph.

---

## 5. Image decoding

Image decoding is the classic way to turn a small file into gigabytes of memory: a 30 KB PNG can
declare 60,000 × 60,000 pixels and ask the decoder to allocate 14 GB before a single pixel is
read. The codec and every limit on it live in one place, `encastra_core::media`, so a file that
is too large or claims an impossible size is refused identically whichever component was asked
to handle it.

| Limit | Value |
|---|---|
| Largest input read | 256 MB |
| Largest image decoded | 100 megapixels (roughly 10,000 × 10,000) |
| Decoder allocation ceiling | 512 MB |
| Decoder dimension ceiling | 65,535 per axis |

`probe()` reads the header only and checks the declared dimensions *before* anything is
allocated; `decode()` probes first and then applies the decoder's own limits as belt and braces.
A resize target is checked against the same pixel limit, so a resize cannot be used to build a
bomb either. Exceeding a limit is an ordinary component error — not a crash and not a hang.

Formats read: PNG, JPEG, GIF, WebP, BMP, TIFF. The `image` crate's default feature set is
deliberately *not* used; it pulls in AVIF (which needs a C toolchain), DDS, farbfeld, HDR, PNM,
QOI and EXR, none of which anything here reads or writes. Formats written: PNG, JPEG, WebP.
JPEG has no alpha, so an RGBA image is explicitly flattened rather than producing a file that
merely looks wrong.

---

## 6. What the journal and the logs do not contain

- **Value summaries never quote content.** Text is described by length, structured data by
  shape. There is a test that puts a token-shaped string through and asserts it does not appear.
  The live inspector's `preview()` does include content and is memory-only; persisting it would
  end the guarantee.
- **Clipboard detail is a character count**, not the text. A clipboard is exactly the sort of
  place a password passes through.
- **Clipboard and I/O errors are described by kind.** Some clipboard backends quote the content
  they were handling; `std::io::Error` messages can contain a path.
- **Project errors carry no path** — see [PROJECT-FORMAT](PROJECT-FORMAT.md) §2.
- **Capability details are display-safe by construction**: a handle number, a folder's own name,
  a host.
- **A `.encastra` file can never contain a secret value** — the type that would hold one does not
  exist, and `deny_unknown_fields` refuses a hand-edited attempt.

---

## 7. What each first-party component asks for

The first-party set is Tier A: compiled into the host, fast, able to use native crates, and
holding no more authority than its manifests declare. It is deliberately small, because
everything in it is part of the trust base and a bug in one is a bug in the trust base.

| Component | Asks for | Scope |
|---|---|---|
| Read File | `fs.read` | `input-handles` |
| Write File · Save File · Move File · Rename File | `fs.write` | `chosen-folder` |
| Resize Image · Convert Image · Thumbnail · Image Info | `fs.read` | `input-handles` |
| Parse JSON · Write JSON · Read CSV · Write CSV | nothing | — |
| If · Switch · Delay | nothing | — |
| Notify | `system.notify` | `notifications` |
| Copy to Clipboard | `system.clipboard` | `write` |
| HTTP Request | `net.http` | `allowed-hosts` |
| Watch Folder *(trigger)* | `fs.read` | `watched-folder` |
| Timer *(trigger)* | nothing | — |

The image components read and produce images without ever writing anywhere a person can see;
that is Save File's job, and it is the step that asks. Move and Rename ask for `fs.write` rather
than something gentler because both delete a name, and the reason string says so.

This table is also a test. `nothing_first_party_quietly_asks_for_more_than_it_needs` holds the
same list in code and fails if any component's declared capabilities change or if a new
component appears without being added deliberately. Widening a component's reach is a visible
edit to that file rather than a line buried in a manifest.

Two further tests guard the reasons themselves: every reason must be at least five words and end
in a full stop — the validator only requires a non-empty string, and "required" is not something
a person can consent to — and no first-party component may declare a capability whose kind
starts with `process`.

---

## 8. What is deliberately absent

These are not denied. They do not exist.

**Process execution.** There is no `process.*` capability anywhere in the build. The manifest
validator holds an allowlist — `fs.read`, `fs.write`, `net.http`, `system.notify`,
`system.clipboard` — and refuses any other kind with "A capability this build cannot enforce
must not be granted." So a manifest cannot smuggle one in, and no consent dialog can ever be
made to offer one. A **Launch Application** component was considered and left out: process
execution has the worst blast radius of any capability, and it is not going into the set that
establishes how permission dialogs read.

**A webhook listener.** Receiving a request means listening on a port, which is a different
security question from making one. It belongs with the trigger work, not with the HTTP client.

**Video Information.** Reading a container's metadata honestly needs a parser this build does
not have, and shelling out to `ffprobe` would need the capability above. A component that
returned guesses would be worse than no component. This is why `probe-video` and `probe-audio`
remain declared-but-unimplemented conversions rather than quietly working badly.

**A native plugin escape hatch.** There is no path for a third party to reach Tier A, and none
will be added. If one appears, [ADR-0002](adr/0002-two-tiers-one-broker.md) has been reversed
and the security story is gone.

---

## 9. Known limitations

Stated plainly, because a security document that only lists controls is marketing.

1. **The sandbox does not exist yet.** Third-party components cannot execute at all. There is no
   `encastra-host` crate, no `wasmtime`, no WIT world — a `kind: "wasm"` node fails with
   `no-implementation`. Everything running today is first-party and in-process. The boundary
   [ADR-0001](adr/0001-wasm-component-model-for-third-party-code.md) describes is designed and
   unbuilt, which means it is also untested. [COMPONENT-SDK](COMPONENT-SDK.md) documents the
   contract, not a working path.

2. **Nothing is signed and nothing is verified.**
   [ADR-0008](adr/0008-signing-and-revocation.md) specifies Ed25519 signing, a counter-signing
   registry, verification at install and at every load, and a signed revocation list. None of it
   is implemented. `lock.json` stores a manifest digest; opening a project does not check it,
   and importing a publication does — the review refuses a component whose manifest no longer
   matches the pinned digest ([ADR-0012](adr/0012-a-publication-is-checked-again-by-whoever-receives-it.md)).
   There is no registry to install from. A publication travels as a folder a person carries,
   its checksum proves the file was not altered on the way, and nothing proves who prepared it:
   the interface says "not verified" next to every publisher name, because it is not.

3. **No timeout, fuel ceiling or memory ceiling on a single node.** Cancellation is a
   cooperative flag checked between nodes and by components that choose to check it; a component
   that loops without checking is not stopped. Per-node interruption arrives with the Wasm host.
   The *run* is bounded: an outer deadline (`MAX_RUN_DURATION`), a ceiling on the bytes held at
   once across the run (`MAX_LIVE_VALUE_BYTES`), a value released once its last consumer has
   finished, and per-node log ceilings — see [security/LIMITS](security/LIMITS.md).

4. **The broker's sensitive-location refusals are a list, not a rule.** *(Was "no deny-list";
   partly fixed.)* `resolve_grant_directory` refuses filesystem roots, the system and program
   directories, the profile root and the startup folders as trees, and a folder grant is only
   accepted for a folder the person picked in the native chooser this session **to give to a
   component**. What remains true is that a list is never complete: an unwise folder that is not
   on it is granted if a person grants it.

5. **Secrets are declared and never resolved.** `variables.json` records that a variable is
   secret; nothing reads it, and there is no keystore integration. The invariant that a secret
   value cannot reach the project file is real and tested. The mechanism that would make secrets
   usable is not built, so today a workflow needing a token has nowhere safe to put one.

6. **Grants live while a project is open and are not remembered across sessions.** The Security
   view shows what is installed, what each component can reach and what has been allowed in the
   open workflow; nothing is written down, and there is no distinction between "allowed once"
   and "allowed always".

7. **Both front ends now express the whole grant model.** *(Was a limitation; fixed.)* The
   inspector scopes `fs.read` and `fs.write` to a folder and `net.http` to the host taken from
   the address on the node itself, and the command line has `--allow-read`, `--allow-write`,
   `--allow-http`, `--allow-clipboard` and `--allow-notify`. Previously only `fs.write` could be
   scoped from the editor and everything else fell through to a bare allow — which the broker
   reads as *no* readable directories and *no* permitted hosts, so it failed closed, but it also
   meant Watch Folder and HTTP Request could not be granted from the editor at all.

   One property is worth keeping in view: the editor reads the host out of the address, which
   makes it a second parser for a string the runtime also parses. The grant stores exactly what
   the editor computed and the runtime compares its own reading against it for equality, so the
   two disagreeing costs a refused request and never a host nobody allowed. `apps/desktop/src/url.ts`
   carries the reasoning and the tests.

8. **A trigger's handle reaches only what is wired to that port.** *(Was a limitation; fixed.)*
   Seeding a trigger's output used to make the handle reachable to every node with an edge from
   that trigger, regardless of which port the edge came from — so a node wired only to a
   watcher's `name` output was given reach over the `file`. It was not exploitable, because
   values travel along edges and such a node never receives the handle, but it was wider than
   the rule the model states. Seeding is now filtered by the edge's source port, and
   `a_step_wired_to_the_name_cannot_read_the_file` pins it. That test was checked by reverting
   the fix and confirming it fails.

9. **The desktop bridge checks what it can and still relays a decision.** Tauri commands take a
   graph, inputs and grants from the WebView; a grant is dropped unless its node exists, its
   component declared the capability, and its folder resolves to one the person picked in the
   native chooser this session *for that purpose*. What the runtime cannot check is that the
   person *meant* it: the sentence they agreed to is still drawn by the WebView. The CSP in §10
   is what keeps foreign code out of it, and an XSS there would still be a consent-forging bug,
   not merely a defacement.

   **Consent is per purpose, not per path.** `choose_folder` takes a purpose — `publish-into`,
   `import-from`, `grant-to-component` or `projects-location` — and `choose_file` takes
   `run-input`; each records the path paired with its purpose, and each command checks the pair
   for its own question and refuses otherwise
   (`folder-not-chosen` on the import path, and the equivalent refusal on the others). It was
   one shared set until 2026-09-15, so a folder picked to import a publication *from* also
   answered "may this component write here" and "may a publication be written into this" —
   three different sentences, one of which the person read. Browsing for a projects folder in
   Settings answered all three. The path in a command is resolved before it is compared, so
   `..`, a trailing separator, a `\\?\` spelling, a different case on a case-insensitive volume
   and a junction all collapse to the one real folder: substitution buys nothing, and a link
   pointing somewhere else is refused because it resolves somewhere else. Nothing is written to
   disk — a restart forgets every choice, which is what makes "this session" true.

   **`inputs[].path` is gated too.** *(Was a limitation; fixed 2026-09-15.)* A file supplied for
   a graph input used to be imported into the run's scratch folder on the strength of the WebView
   naming it, because the *file* chooser still ran in the editor — the shape the folder chooser
   had before `choose_folder`. `choose_file` now opens the file chooser on this side and records
   `(run-input, canonical path)` in the same per-session state; `seed_for` refuses any input path
   that is not in it, and refuses it *before* the import, so an unchosen input reads nothing. A
   path stored anywhere, or named by a renderer that has been through a debugger, is displayed
   and has to be chosen again. There is no deny-list for a single picked file, deliberately —
   see [DESKTOP](DESKTOP.md) §2.

10. **No external audit.** This model has been reviewed by the people who built it and by the
    tests in [TESTING](TESTING.md) §5. That is not the same thing, and an audit is a
    prerequisite for a production marketplace launch.

11. **Side channels are out of scope.** Speculative-execution and timing attacks from within a
    future Wasm guest against host memory are not defended against and are not analysed.

---

## 10. The desktop application

The editor is a local application, and its Content Security Policy says so:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: asset: http://asset.localhost; font-src 'self';
connect-src 'self' ipc: http://ipc.localhost; object-src 'none';
base-uri 'none'; frame-ancestors 'none'
```

No `unsafe-eval`, no remote origins, no wildcards. Everything the editor needs is bundled;
there is no case where it should fetch code or styles from the network. `style-src` allows
inline styles because the canvas positions nodes with them. Loosening any of this is a security
decision, not a build convenience: if a library needs `unsafe-eval`, the answer is a different
library. See [DESKTOP](DESKTOP.md) §5.

---

## 11. Supply chain and CI

Four gates run on every pull request (`.github/workflows/ci.yml`):

- `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check`, and the full
  Rust test suite on Linux, Windows and macOS;
- `cargo deny check advisories bans licenses sources` — an unpatched advisory fails the build,
  licences are an *allowlist* so an unexpected one fails loudly rather than slipping through,
  wildcard version requirements are denied, and only crates.io is an accepted source;
- `npm audit --audit-level=high`;
- Gitleaks secret scanning over the full history.

An advisory fails the build rather than opening a ticket nobody reads.
[ADR-0010](adr/0010-dependency-version-policy.md) records the version policy behind that: current
stable rather than newest, exact pins where a project ships fast breaking minors, and four
questions before any dependency is added.

---

## 12. Reporting a vulnerability

**Please do not open a public issue for a security problem.** A public report starts a clock
that the people who can fix it may not be able to beat.

*A published security address does not exist yet.* The domain in this project's identifiers
(`encastra.dev`) is not registered — see [BRANDING](BRANDING.md) — so any `security@` address
you might infer from this repository goes nowhere. Until one is published, report privately
through the repository host's private vulnerability reporting, or directly to the maintainer
who owns the repository. Establishing and publishing a real disclosure address is a launch
prerequisite, not an optional extra, and it belongs in this section the moment it exists.

**What to include.** What you found; which component, crate or file; the version or commit;
what an attacker gains; and the smallest reproduction you can manage. A graph file, a
manifest, or a crafted input file is ideal — the runtime is deterministic and a reproduction
usually replays exactly.

**What to expect.** An acknowledgement that a human has read it, an assessment of whether it is
in scope and how severe it looks, and honesty about timelines rather than a promised date that
slips. Fixes to the broker, the type system or the project format are treated as release
blockers. There is no bug bounty.

**Particularly wanted.** A way to make the broker allow something it should not; a path that
reaches the filesystem or the network without passing through it; a handle that resolves to
something the graph did not wire; anything that puts user content, a path, or a secret into the
journal or a log; and anything that makes a `.encastra` file carry a value it should not.

**In scope today:** the runtime, the broker, the project format, the manifest validator, the
first-party components, the CLI, and the desktop shell. **Out of scope today** because they do
not exist: the Wasm host, the registry, signing and revocation, the backend API, the
marketplace, and the update channel. If you have found something in one of those, you have
found it in a design document, and that is still worth telling us about — just say which
document.
