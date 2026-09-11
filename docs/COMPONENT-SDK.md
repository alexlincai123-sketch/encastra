# COMPONENT SDK

> **Third-party components cannot be executed by this build.** There is no `encastra-host`
> crate, no `wasmtime`, and no WIT world in the repository. A manifest with `kind: "wasm"`
> parses, validates, appears in the graph and is type-checked like anything else — and then the
> runtime refuses it with `no-implementation` and the message "Sandboxed components are not
> executable in this build yet."
>
> This document therefore describes **the contract**, not a working path. The manifest format,
> the type system and the capability model are implemented and enforced today, and everything
> in §1 to §5 is real and testable. §6 is a plan.

---

## 1. What a component is

A manifest, an implementation, and — eventually — a signature.

The manifest is the part that matters here. It is what the editor type-checks a graph against,
what the consent dialog is built from, what the broker enforces against at run time, and what
gets hashed and signed. A component's behaviour is not the contract; its manifest is.

### It is JSON, not TOML

The manifest on disk is JSON. Signatures are computed over bytes, and one on-disk format means
there is no conversion step between the thing that was signed and the thing that is executed.

> **Discrepancy.** [ARCHITECTURE](ARCHITECTURE.md) §3.1 shows a `component.toml` canonicalised
> to JSON for hashing. The implementation in `crates/encastra-protocol/src/manifest.rs` reads
> JSON only, and says so in its own module documentation. The code is the authority.

### There is no "parse but do not check"

`ComponentManifest::parse` validates fully, or returns an error. A manifest that exists as a
value inside the program has been validated. The first-party set parses its own manifests
through exactly this function at start-up, so a typo in a built-in fails on launch rather than
in the middle of somebody's run — the built-ins are held to precisely the rules a third party
would be.

### The published JSON Schema is documentation, not the authority

`packages/protocol/schema/component.schema.json` exists so an author's editor can autocomplete
and catch obvious mistakes early. It says so in its own `description`. It cannot express the
rules that matter most — that every port type resolves in the type graph, that every declared
capability is one the host can actually enforce, that no floating-point number appears anywhere
in the document. **Passing the schema does not mean a manifest will load.**

---

## 2. Manifest fields

```json
{
  "schema": 1,
  "id": "acme.image.watermark",
  "version": "1.2.0",
  "name": "Watermark",
  "description": "Stamps a mark onto an image.",
  "author": "Acme Ltd",
  "license": "MIT",
  "category": "image",
  "runtime": ">=0.1.0 <2.0.0",
  "kind": "wasm",
  "ports": {
    "inputs":  { "image": { "type": "image", "required": true, "label": "Image" } },
    "outputs": { "image": { "type": "image", "label": "Watermarked" } }
  },
  "config": {
    "opacity": { "type": "i64", "min": 0, "max": 100, "default": 60, "label": "Opacity" }
  },
  "capabilities": [
    { "kind": "fs.read", "scope": "input-handles",
      "reason": "Reads the image you connect to this node, and nothing else." }
  ],
  "platforms": ["windows", "macos", "linux"],
  "retryable": true
}
```

| Field | Required | Rules |
|---|---|---|
| `schema` | yes | Protocol revision. Currently `1`. Additive-only: adding a field never breaks an old host, removing or re-typing one requires `schema = 2`. A host refuses a value it does not know rather than guessing |
| `id` | yes | Reverse-DNS, at least two segments, 1–128 characters. Each segment starts with a lower-case letter and contains only lower-case letters, digits and hyphens. **Immutable for the life of the component** |
| `version` | yes | Semver, parsed by the `semver` crate. **Immutable once published**: the registry will refuse different bytes under the same `id@version` |
| `name` | yes | Non-empty after trimming. What a person sees |
| `runtime` | yes | A semver *range* of host versions this component is known to work on, e.g. `">=0.1.0 <2.0.0"`. Parsed and required to be well formed; **nothing matches it against the host version yet**, so today it documents an intention rather than gating anything |
| `kind` | yes | `"core"` (first-party, compiled into the host) or `"wasm"` (everything else) |
| `description`, `author`, `license`, `category`, `icon`, `documentation`, `changelog` | no | Metadata. `license` is an SPDX identifier |
| `trigger` | no | A source of events rather than a step. See §2.3 |
| `ports` | no | See §2.1 |
| `config` | no | See §2.2 |
| `capabilities` | no | See §3 |
| `platforms` | no | Any of `windows`, `macos`, `linux`. An unknown platform is refused |
| `retryable` | no | Whether a failed run is safe to repeat automatically. Defaults to `false`: retrying something non-idempotent is worse than failing once. **Nothing reads this yet** — the runtime does not retry |

Unknown top-level keys are **refused**, not ignored. Silently tolerating a field you do not
understand is how a signed manifest and an executed manifest drift apart: a future field that
grants something would be dropped by an old host that still reports the component as valid.
Refusing is the only safe reading of "I do not understand this".

### 2.1 Ports

```json
"ports": {
  "inputs":  { "image": { "type": "image", "required": true, "label": "Image", "doc": "…" } },
  "outputs": { "width": { "type": "i64" } }
}
```

Port names contain only lower-case letters, digits and underscores. `type` is a type expression
(§4) and must resolve in the shared type table. `required` defaults to `false`; a required input
with nothing connected and nothing supplied by the application is a validation error in any
graph that uses the component.

A component with no ports at all is refused: it can neither receive nor produce anything.

Output ports are a promise. The runtime checks what a component returns against them and fails
the node with `contract-broken` if it produces an undeclared port or a value whose type is not
*directly* compatible with the declaration. A coercion is not good enough there — the manifest is
what the graph was type-checked against.

### 2.2 Configuration

Config fields are what a person fills in on the node, as opposed to what the graph wires in.

```json
"config": {
  "mode":    { "type": "string", "choices": ["contain", "cover", "stretch"], "default": "contain" },
  "quality": { "type": "i64", "min": 1, "max": 100, "default": 85 },
  "folder":  { "type": "string", "required": true, "label": "Folder" }
}
```

Usable types are `bool`, `i64`, `f64`, `string` and `json`. A field typed as a *handle* type is
refused by graph validation with "cannot be configured; `file` values come from a connection" —
handles are produced by the graph, never typed into a form.

`min` above `max` is refused. An empty `choices` list is refused, because then no value would be
valid. A field marked `required` with no `default` and no value set on a node is a validation
error on that node.

A field set on a node that the manifest does not declare is a *warning*, not an error: it is
usually left over from an older version of the component, and blocking the run over it would be
unhelpful.

### 2.3 Triggers

Setting `"trigger": true` declares a source of events rather than a step. A trigger has outputs
and no inputs — connecting something into a trigger is meaningless and the validator refuses a
trigger with any input port, or with no output ports (it could never start anything).

A trigger does not "run" when the graph runs. The session layer polls it and runs the rest of
the graph once per event it produces; see [RUNTIME](RUNTIME.md) §8. Keeping this a property of
the manifest rather than a separate concept means the editor, the validator and the permission
model all see it without a second code path.

> **Not available to third parties.** A trigger needs a `TriggerFactory` registered in the host.
> The trigger interface is not part of the (unbuilt) Wasm world, so triggers are first-party
> only for the foreseeable future.

### 2.4 No floating-point numbers, anywhere

A manifest may not contain a non-integer number in any position — not in a `min`, not in a
`default`, not nested inside a JSON object. It is checked recursively before deserialisation and
the error names the path.

Canonicalisation has exactly one genuinely hard part: agreeing how to serialise a float.
Refusing floats removes it, and this check is what makes the refusal true rather than
aspirational. Nothing a manifest needs to express requires one — a resize width is an integer, a
quality setting is an integer, a timeout is milliseconds. A component that wants a float takes
it as config from the user at run time, which is not part of the signed identity.

---

## 3. Capabilities

A capability is declared in the manifest, granted by the user, and enforced by the broker —
never by the component.

```json
{ "kind": "fs.write", "scope": "chosen-folder",
  "reason": "Saves the result into the folder you pick. It cannot write anywhere else." }
```

**`kind`** must be one the host can actually enforce. The allowlist is `fs.read`, `fs.write`,
`net.http`, `system.notify`, `system.clipboard`. Anything else is refused with "A capability
this build cannot enforce must not be granted." Process execution and raw device access are not
on that list and are not denied — they are absent. See [SECURITY](SECURITY.md) §8.

**`scope`** must be non-empty; an unscoped capability is an unbounded one. One scope value is
special: **`input-handles`** means "only what the graph wired to my ports", and it is the only
scope that needs no decision from the user, because it grants nothing they have not already
expressed by drawing an edge. `ComponentManifest::requires_consent()` is exactly "does any
capability have a scope other than `input-handles`".

Other scope strings — `chosen-folder`, `allowed-hosts`, `watched-folder`, `notifications`,
`write` — are descriptive today. The broker's enforcement is driven by the *grant* the
application creates, not by the scope string, so the scope's job is to tell the user and the
reviewer what shape of answer is being asked for.

**`reason` is shown verbatim to the user** in the consent dialog. A capability with an empty
reason fails validation, because the reason is what the person is consenting to and without it
there is nothing to consent to.

The validator only requires non-empty. The first-party set holds itself to more, in a test:
at least five words, ending in a full stop. That is the standard to write to.

> Write it for the person deciding, not for the reviewer.
> **Good:** "Uploads the finished image to the web address you configure, and no other."
> **Bad:** "network access required".

Declaring the same `kind` twice with the same `scope` is refused — one of the two reasons shown
to the user would be a lie.

### Ask for the least you can

Every capability beyond an `input-handles` scope puts a question in front of a person, and a
component that asks for more than it needs is one people decline. Note the shape of the
first-party set: the image components ask only for `fs.read` on their inputs and write their
results into run-scoped scratch space, which needs no permission at all. Putting a file
somewhere a person will find it is a separate component, and it is the one that asks.

### A lying manifest under-declares; it cannot over-reach

Enforcement is entirely broker-side, from the manifest. A component that declares less than it
uses is denied at run time — a confusing failure, treated as a bug in the component, not an
escalation. A component that declares more than it uses simply asks the user a question it did
not need to ask, and pays for it in installs.

---

## 4. The type system

### 4.1 Where the rules live

`packages/protocol/data/type-graph.json` is the **only** place connection rules are written
down. The TypeScript editor imports it; the Rust runtime embeds it with `include_str!`. Neither
reimplements the rules, and a conformance gate fails the build if the two readers ever disagree
([ADR-0003](adr/0003-one-runtime-shared-type-table.md), [TESTING](TESTING.md) §4).

If you find yourself adding `if (type === 'image')` to either language, the rule belongs in the
data file instead.

### 4.2 The types

**Scalars:** `bool`, `i64`, `f64`, `string`, `json`.

**Handles:** `file`, `dir`, `bytes`, `image`, `video`, `audio`. A handle is an opaque reference
the host owns — never a path, never a byte buffer
([ADR-0004](adr/0004-handle-based-media.md)).

`image`, `video` and `audio` each `extend` `file`. `bytes` deliberately does **not**: bytes are a
file's *contents*, not a kind of file, and modelling it as a subtype would make
`image → file → bytes` look like a narrowing and break the sibling rule below.

**Composites:** `list<T>` and `option<T>`, nestable — `list<option<file>>` parses. The grammar is
`ident | list<expr> | option<expr>`; names are lower-case with digits and underscores. `list` and
`option` without an argument are a parse error, and a non-generic name with an argument is too.

### 4.3 Conversion kinds

| Kind | Meaning |
|---|---|
| `direct` | the same type, or a widening to a supertype. Nothing happens at run time, and nothing is shown |
| `implicit` | a total conversion that cannot fail for any input. Applied by the runtime, marked on the edge — silent but visible |
| `explicit` | legal, but it may fail or lose information. Never silent: the editor raises a warning carrying the table's note, and a conversion that can fail must have a place in the graph where its failure is reported |

### 4.4 The rules that compose them

**Widening is free, narrowing is explicit.** `image → file` is `direct`. `file → image` is
`explicit`, because it is a claim about content that has to be checked.

**Never to a sibling.** `image → video` is refused, even though `image → file` and
`file → video` are both legal. Widening and then narrowing back down the same tree would let an
Image connect to a Video port and fail on every single run. A statically-knowable impossibility
is refused in the editor, not discovered during a run. The failure message says so: "Image and
Video are both kinds of File, but one is not the other."

**One coercion hop, never a chain.** A value is also a value of each of its supertypes, so the
table is tried from every ancestor of the source type — but only one coercion is ever applied.
Chained conversions are how a graph ends up doing something nobody wrote down. When more than
one candidate exists, the weakest kind wins (`direct` over `implicit` over `explicit`).

**`T → option<T>` is `direct`.** A present value is always a valid option.

**`option<T> → T` is `explicit`**, and prepends `unwrap-option`. The absent case has to be
handled somewhere a person can see it.

**`list<A> → list<B>` is legal exactly when `A → B` is**, prepending `map` and keeping the
element's kind — an explicit element conversion makes the whole list conversion explicit. A bare
value does not connect to a list.

**An unknown type is a version problem, not a typo.** Connecting a port whose type the host does
not know reports "…is not a type this runtime knows. The component may need a newer runtime
version."

**A refusal offers bridges.** When `A → B` fails, the checker looks for types `X` where `A → X`
and `X → B` are both legal and offers them as "You could convert through … first."

### 4.5 The conversion table

Every entry declares an operation name, and `crates/encastra-core/src/convert.rs` must implement
it — a test fails the build if the table gains an operation nothing can execute. What each one
does at run time is in [RUNTIME](RUNTIME.md) §5.

| From → to | Kind | Operation |
|---|---|---|
| `i64 → f64` | implicit | `int-to-float` (refuses beyond 2^53 rather than rounding silently) |
| `i64 → string`, `f64 → string`, `bool → string` | implicit | `to-text` |
| `bool → i64` | implicit | `bool-to-int` |
| `i64 → bool` | explicit | `int-to-bool` |
| `f64 → i64` | explicit | `round` |
| `string → i64`, `string → f64`, `string → bool` | explicit | `parse-int`, `parse-float`, `parse-bool` |
| `string → json`, `json → string` | explicit | `parse-json`, `stringify-json` |
| `bool`/`i64`/`f64` → `json` | explicit | `encode-json` |
| `json` → `bool`/`i64`/`f64` | explicit | `decode-json` |
| `file → bytes` | explicit | `read-bytes` |
| `bytes → file` | explicit | `write-temp` |
| `file → image` | explicit | `decode-image` |
| `file → video` | explicit | `probe-video` — **declared, not implemented** |
| `file → audio` | explicit | `probe-audio` — **declared, not implemented** |

The last two fail at run time with `conversion-unavailable` and a message naming what is
missing. They stay in the table so that `file → video` keeps meaning "this must be verified",
and the cost — a connection the editor allows and the run refuses — is recorded honestly rather
than hidden by removing the rows.

---

## 5. Canonical form, digest, and identity

`ComponentManifest::canonical_json()` is the exact byte string that gets hashed and signed. It
is `serde_json` over struct fields and `BTreeMap`s, which gives sorted keys and compact
separators; floats are refused at parse time (§2.4); so the output is stable across platforms
and versions without needing a full RFC 8785 implementation.

`digest()` is `sha256(canonical_json)` in lower-case hex. It is half of what a publisher will
sign; the other half is the artifact hash
([ADR-0008](adr/0008-signing-and-revocation.md)). Today it is what a project's `lock.json`
pins — see [PROJECT-FORMAT](PROJECT-FORMAT.md) §3.

Identity is `id@version` **plus the content hash**. The registry will refuse a republish of the
same `id@version` with different bytes, and projects pin hashes rather than ranges. None of that
registry behaviour exists yet; the digest that would make it work does.

**A lost publishing key means a publisher can no longer update their components.** They must
re-establish a namespace with a new key, and the trust reset is visible to users rather than
silent. This is stated here, prominently, because it is the failure people actually hit.

---

## 6. The Wasm plan — not implemented

Everything in this section is design. No code in this repository does any of it.

### Target

Third-party components will be **WebAssembly components** targeting **WASI 0.2 (preview 2)**,
executed by **`wasmtime` 48.x** — an LTS line with 24-month support, chosen over merely the
newest ([ADR-0001](adr/0001-wasm-component-model-for-third-party-code.md),
[ADR-0010](adr/0010-dependency-version-policy.md)).

Build with the native target, which emits a component directly:

```bash
cargo build --release --target wasm32-wasip2
```

`rust-toolchain.toml` in this repository already installs `wasm32-wasip2`, so the toolchain a
contributor gets is the toolchain the SDK will use.

**`cargo-component` is not used.** The Bytecode Alliance is deprecating it and it has had no
commits since July 2025; the native `wasm32-wasip2` target replaces it. `wit-bindgen` will be
pinned exactly, because it is pre-1.0 with monthly breaking minors.

**p2, not p3.** WASI 0.3 has shipped and Wasmtime enables it by default from version 46, but
Rust guests for `wasm32-wasip3` are still Tier 3 on stable. p2 components keep running on p3
hosts, so p2 is the compatible choice and p3 is a later migration rather than a rewrite.

### The world

A component's only authority is the host interface. **There is no `wasi:filesystem` import in
the default world, and a component is given no preopened directory at all.** That is not
tidiness: both `wasmtime` filesystem escapes patched during 2026 — one at CVSS 8.8 — required a
preopened directory in order to be exploitable. A component that has none is not reachable by
that class of bug.

Instead it gets handles: `open-input(port)` returns a stream if the graph wired something to
that port, and `create-output(port, hint)` returns a stream the host places somewhere it
chooses. Bulk data never enters linear memory, which is what makes the boundary affordable for a
media tool, and the host knows every artefact a run touched, which is what makes the journal and
reproducibility possible.

> [ARCHITECTURE](ARCHITECTURE.md) §3.2 sketches the WIT and locates it at
> `packages/protocol/wit/`. **That directory does not exist.** The sketch is the intended shape,
> not a published interface; treat any signature in it as provisional.

### Enforcement knobs, once the host exists

`wasmtime` provides what a runtime needs and this build currently lacks: epoch interruption for
wall-clock timeouts, fuel for bounding runaway loops, and a `ResourceLimiter` for memory
ceilings. Those are the controls [RUNTIME](RUNTIME.md) §9 lists as unimplemented, and they
arrive together with the host, because a timeout that cannot stop anything is a progress bar
rather than a control.

### Language support, as planned

Rust is the first-class SDK language. JavaScript will be second, behind a pinned wrapper —
`componentize-js` describes itself as experimental, is mid-rewrite, and promises incompatible
changes without a semver-major bump, and JavaScript will be the highest-volume plugin language
with the least stable build path, so authors never invoke a floating version directly. Python is
experimental. WASI 0.2 has no threads.

---

## 7. Writing a first-party component, today

The one path that does work is adding to the first-party set, which is a useful reference for
the contract even if you are writing something that will eventually be Wasm.
`crates/encastra-builtins` is the whole set, and each component is a `LazyLock<ComponentManifest>`
holding its manifest as a JSON string plus a `CoreComponent` implementation:

```rust
pub trait CoreComponent: Send + Sync {
    fn manifest(&self) -> &ComponentManifest;
    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<BTreeMap<String, Value>, NodeError>;
}
```

`NodeContext` is everything a component may do and nothing else — read a handle, create and
write an output, save or move to a folder, learn a source filename, check and use HTTP, the
clipboard, notifications, log, read config, and check whether it has been cancelled. Each of
those goes through the broker with this node's grants. Being in-process buys speed and native
crates; it buys **no** extra authority.

A `NodeError` carries a stable machine-readable `code`, a `message` written for a person, and an
optional `hint` — present when there is an honest next step, absent rather than filled with a
guess. The code is deliberately left out of the rendered message: it is in the journal for
tooling, and putting it in front of somebody adds noise to the part that matters.

Adding a component means adding it to `install_all()` **and** to the capability list in
`nothing_first_party_quietly_asks_for_more_than_it_needs`, which fails otherwise. That is on
purpose: the set is part of the trust base, and widening its reach should be a visible edit
rather than a line buried in a manifest.
