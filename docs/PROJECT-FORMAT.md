# PROJECT FORMAT

> The `.encastra` container as `crates/encastra-project` implements it. Where
> [ARCHITECTURE](ARCHITECTURE.md) §6 and §7 describe something this build does not produce, the
> difference is noted rather than glossed.

A project is one file. It holds the graph, a lockfile pinning every component it uses, the
variables it expects, and its whole version history. You can email it. You can put it in a
repository. You can rename it. Nothing about it depends on the machine that wrote it.

---

## 1. What is inside

`.encastra` is a ZIP archive. Open it with anything.

| Entry | What it is |
|---|---|
| `project.json` | the manifest: schema, stable id, name, description, runtime range, created and modified timestamps |
| `graph.json` | what runs — nodes, edges, positions, per-node configuration |
| `lock.json` | every component the graph uses, pinned by digest |
| `variables.json` | the names, types and secrecy of values the project expects. Never a value |
| `versions/index.json` | the snapshot chain: id, parent, timestamp, label, message, graph hash |
| `versions/<id>.json` | the graph as it was at that snapshot |
| `README.md` | a short note explaining, to whoever opened the archive out of curiosity, what they are looking at and that it contains no secrets |

Every JSON entry is pretty-printed with sorted keys and ends with a newline. Every struct that
is read back declares `deny_unknown_fields`: a key this build does not understand is a refusal,
not something to ignore. Silently dropping an unrecognised field is how a file written by a
newer version gets quietly downgraded and written back out with the new part missing.

`project.json` carries `schema`, currently `1`. A higher value is refused with
`UnsupportedSchema` rather than parsed on a guess.

### What is not in there

There is no `assets/` entry. [ARCHITECTURE](ARCHITECTURE.md) §6 lists one, and
[ADR-0007](adr/0007-native-snapshot-versioning.md) talks about assets being content-addressed
separately; this build writes no assets and reads none. A project references the files it works
on through the run, not through the container.

There is no `groups` concept in `graph.json`, though ARCHITECTURE §6 mentions one.

---

## 2. Why the ZIP is deterministic

Saving an unchanged project produces byte-identical output. Two properties make that true:

- **Entries are sorted by name** before writing, so the archive's order never depends on a
  map's iteration order or on which snapshot happened to be created first.
- **Every entry gets the same fixed timestamp** (`zip::DateTime::default()`), Deflate
  compression, and `0o644` permissions. A real clock here would make two saves of an unchanged
  project differ.

This is not tidiness. It is what makes "did this project change?" answerable by comparing
hashes; it is what keeps version history honest, because a snapshot's `graph_hash` means
something only if identical content hashes identically; and it is what stops a save from
appearing as a diff in somebody's repository because the clock moved.

A test asserts both halves: that `to_bytes()` called twice gives the same bytes, and that a
save-open-save round trip gives the same bytes as the original.

### Saving is atomic

`Project::save` writes to `<path>.encastra-writing` and renames it into place. A crash
mid-write leaves the previous project intact rather than a truncated file where it used to be.
A test checks that no temporary file is left behind on success, and that a failed save leaves
the previous file readable.

### Errors never carry a path

`ProjectError::Io` is built from `std::io::Error::kind()`, not from its message. An I/O error
message can contain a path from the user's machine, and these surface in logs and in the UI.
There is a test that constructs an error whose message is a full home-directory path and
asserts the rendered error does not contain it.

---

## 3. The lockfile

```json
{
  "components": [
    {
      "id": "encastra.file.read",
      "version": "1.0.0",
      "manifest_digest": "…64 hex…",
      "origin": "builtin"
    }
  ]
}
```

A graph node names a component as `id@version` and nothing else — there is deliberately no
version *range* anywhere in a graph, because a graph that could resolve differently tomorrow is
a graph that stops being reproducible, which is the promise the whole format exists to keep.
`ComponentRef::parse` refuses a reference without an exact version.

The lockfile adds the digest. It is built at save time from what is actually installed, sorted
and de-duplicated, so a project records what it was built against rather than a name that could
mean different bytes later. `manifest_digest` is `sha256` of the component's canonical manifest
JSON — see [COMPONENT-SDK](COMPONENT-SDK.md) §4 for what "canonical" means and why it is
stable.

Opening a project compares the lock against the installed registry and reports what is
**missing** by `id@version`. The desktop app surfaces that list; nothing is silently
substituted, and nothing is silently dropped.

> **Discrepancy.** ARCHITECTURE §6 describes `lock.json` as holding the "artifact sha256" and
> describes an *offer to resolve or open read-only* when a lock cannot be satisfied. This build
> records the manifest digest — there is no artifact, because third-party components cannot be
> executed yet — and the resolve/read-only flow does not exist. The missing list is reported and
> that is all. Signature and hash verification ([ADR-0008](adr/0008-signing-and-revocation.md))
> is a design, not code: nothing in this build verifies the digest it stores.

---

## 4. The graph

`graph.json` holds no runtime state and no absolute paths — only node identity, component
identity, configuration, and wiring. That is what lets it be saved, versioned, exported and
reopened on another machine.

```json
{
  "nodes": {
    "resize": {
      "component": "encastra.image.resize@1.0.0",
      "label": "Make thumbnails",
      "config": { "width": 200, "mode": "contain" },
      "position": { "x": 260, "y": 0 },
      "disabled": false
    }
  },
  "edges": [
    { "from": { "node": "watch", "port": "file" },
      "to":   { "node": "resize", "port": "image" } }
  ]
}
```

Node ids are stable across saves and are never shown in the interface; `label` is what a user
renamed a node to, and falls back to the component's own name. `position` is part of the saved
graph but not of its meaning — two graphs differing only in position compute the same thing,
which is why the diff in §7 treats a move as a change that does not change behaviour.

`Project::graph_hash()` is `sha256` of the serialised graph. A rename of the *project* does not
change it; removing a node does. It answers "do these two projects compute the same thing?"

---

## 5. Variables, and the rule about secrets

```json
{
  "api_token": { "type": "string", "secret": true, "doc": "Used by the upload step." }
}
```

A variable records that it exists, what type it is, and whether it is a secret. **There is no
field that could hold a value.** That is not a convention — `Variable` declares
`deny_unknown_fields`, so a hand-edited file that tries to smuggle `"value": "hunter2"` in is
refused at parse time rather than parsed with the extra key quietly dropped and then written
back out somewhere else. A test asserts exactly that.

This is what makes a `.encastra` file safe to send to somebody. The container's own README says
so, in the archive, to whoever opens it.

> **Not implemented.** The other half of the design — resolving a secret from the OS keystore
> at the point of use (Windows Credential Manager, macOS Keychain, Linux Secret Service) —
> does not exist. Nothing in this build reads `variables.json` at run time, and no component
> can reference a variable. The invariant that a secret value cannot reach the file is real and
> tested; the mechanism that would make secrets *usable* is not built.

---

## 6. Version history

History is content-addressed snapshots, immutable and singly linked by `parent`, stored
**inside the project file** so that history travels with the project. Email somebody a
`.encastra` and they get its past too.

[ADR-0007](adr/0007-native-snapshot-versioning.md) records why this is not Git, and the
amendment that moved snapshots out of a local database and into the container: history that does
not travel with the project vanishes the moment somebody shares the file, and sharing is the
whole point of the format. It also removes a second store that could disagree with the first
about what a project's past was.

**Recording.** `History::record` returns nothing when the graph is identical to the most recent
snapshot. Saving twice without changing anything should not manufacture history.

**Snapshot ids** are derived from the graph hash *salted with the snapshot's position in the
chain and the timestamp*, truncated to 16 hex characters. Content addressing alone would give a
restored version the same id as the version it restored, and those must remain two distinct
events.

**Restore is not destructive.** Restoring version 3 appends a *new* snapshot whose content
equals version 3, labelled "Restored …" and carrying `restored_from` so the history reads as
what happened rather than as a mysterious duplicate. Nothing is rewritten and nothing is
removed, which means the restore is itself undoable — and that is the property that makes people
willing to press the button. A test walks exactly that path: record, record, restore the first,
then restore the second.

**A snapshot without a body is dropped.** Bodies live as separate archive entries beside the
index. On open, any index entry whose `versions/<id>.json` did not survive is removed from the
chain. Losing one old version is survivable; offering a version in the UI that cannot be
restored is worse, and refusing to open the project at all is worse still.

---

## 7. The diff is about the graph, not about text

`compare_graphs` produces changes at the level a person thinks in:

```
resize: width changed from 800 to 1200
Added watermark (encastra.image.convert@1.0.0)
Connected resize.image to watermark.image
save switched off
```

The variants are node added, node removed, component changed, setting changed, node switched
on or off, node moved, connection added, connection removed. Each renders one line through
`describe()`.

Two things about it are load-bearing.

**A line diff of `graph.json` is not actionable and is dangerous to merge.** Auto-merging one
can produce a syntactically valid, semantically broken graph — the worst possible outcome for a
versioning system. Comparing structures avoids the question entirely.

**`Change::changes_behaviour()` separates a nudge from an edit.** Moving a node reports as a
change, because the user did something, but it returns `false` here, so the UI can answer "did
anything actually change?" without a person reading past a list of repositions.

**Long settings are described, not printed.** A history entry is stored and displayed, and a
config field can hold something a user pasted. A string over 40 characters renders as
`text (N characters)`; arrays and objects render as counts. A test pastes a token-shaped string
into a config field and asserts it does not appear in the rendered change.

Branches and merge are later work. The `parent` pointer is already the shape they need — a
branch is a second child, and a merge is a snapshot with two parents — and merge semantics for a
graph (both sides edited the same node's config) are a real design problem, deliberately
deferred rather than half-built.

---

## 8. Identity and renaming

`project.json` carries an `id` that is a slug of the original name plus eight hex characters
derived from the name and the creation time. It is stable across renames, so history and shares
survive somebody deciding the project should be called something else. The desktop app relies
on this: saving over an existing project opens it first, keeps its identity and its history, and
moves only its content forward.
