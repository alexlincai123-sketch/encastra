# Beta 0.5

The receiving end of a publication, a library of what is on this machine, and a pass over
everything else that stood between the product and a person who would pay for it.

---

## 1. What this release is, and what it is not

0.4 could prepare a publication and nothing could read one. 0.5 closes that loop as far as it
can be closed without a server: a publication folder can be inspected and imported, the same
check the publisher ran runs again on the receiving machine, and nothing executes on import. A
local library remembers what was created, imported and prepared.

| Asked for | Delivered |
|---|---|
| Import a publication safely | **Done.** `crates/encastra-publish/src/import.rs`; 26 named refusals; 20-strategy adaptive-attacker suite; refusals verified in the release binary |
| A local library | **Done.** `crates/encastra-library`; atomic index; status by content hash; a created project's file is never deleted |
| Publish → import → library → open → reuse, end to end | **Done in code and tests.** The chooser-driven journeys were **not** driven at runtime in this session — see `docs/audits/2026-09-15-runtime-qa.md` for why and what was |
| Security hardening | **Done**, from two independent audits merged: folder grants resolved and bounded, a native folder chooser on the Rust side, per-file and per-run byte ceilings, duplicate archive entries refused, a run deadline, a panicking node no longer wedges the runtime, the same URL grammar in both parsers, fuzz targets — `docs/audits/2026-09-15-*.md` |
| Memory and time under scale | **Done and measured.** A 10 000-step chain: 1.97 GB → 38 MB peak, 19.7 s → 5.2 s; 20 000 steps are refused by the node ceiling; a live-byte budget bounds width as well |
| Unsaved work never discarded silently | **Done.** New, open, sample, restore, library open and the window's close button ask first |
| Keyboard-only editing | **Done.** Connections can be drawn and removed from the keyboard; the tour can be completed without a mouse |
| Dialogs that trap focus as they claim | **Done** |
| Spanish website without English leaks; per-page metadata; branded 404 | **Done** |
| Registry, accounts, signing, payments, updates | **Not built.** Unchanged, and said so everywhere the words appear |

## 2. Import, and what it refuses

A publication folder holds exactly two things: a `.encastra` file and a `publication.json`
beside it. Importing one reads both, and refuses when the folder or either file is a link;
when there is more than one project or anything else in the folder (what a file manager drops
in on its own is ignored, not refused); when the document is too large, malformed, or carries a
field this build does not know; when the project is larger than a publication may be; when the
bytes are not the bytes the document describes; when the project cannot be read; when the
document names a kind nothing here can install, a listing id that is not a name, a version that
is not one, or a namespace the publisher does not own; when its text hides what it says; when
it disagrees with the project about the runtime, or the runtime is not this one; when the same
review the publisher ran refuses it here — a secret in a setting, a path naming its author, a
component this build cannot read or that no longer matches its digest, a licence conflict; when
its permission list understates or overstates what the project asks for; when the version is
already here; and when the folder was not chosen in the native chooser this session.

What comes through is copied — the verified bytes, never a second read of the source — into
the application's own data folder, one folder per version, and a line is added to the library.
Nothing opens and nothing runs. `docs/adr/0012-*.md` has the reasoning.

The checksum is integrity, not provenance. The publisher's name is a claim. The interface says
both, next to every publication it shows.

## 3. The library

What is on this machine: created (saved or opened here), imported, prepared. Each entry carries
the path, a content hash from when it was last seen, and what was known about it; the status —
present, missing, changed — is computed when the list is drawn, never stored. The index is
written atomically. One this build cannot parse is set aside under a dated name; one written by
a newer build is left exactly where it is, and every write says why it will not. Removing an
entry forgets it; deleting files is offered only for an imported copy, only inside the imports
folder, and never for a project a person created.

## 4. The runtime under scale

Measured with the CLI on a chain of steps each handing a 45 KB document to the next:

| Steps | Before (peak) | After (peak) | Before (time) | After (time) |
|---|---|---|---|---|
| 1 000 | 199 MB | 11 MB | 0.9 s | 0.8 s |
| 5 000 | 986 MB | 24 MB | 5.8 s | 2.6 s |
| 10 000 | 1.97 GB | 38 MB | 19.7 s | 5.2 s |
| 20 000 | 3.94 GB | refused | 57.9 s | 0.1 s |

"After" is the release CLI at this commit. The 20 000-step row is refused before anything
runs: the security branch put a ceiling of 10 000 nodes and 40 000 edges on a graph, and the
message says so ("this graph has 20000 nodes, and this build works on at most 10000"). On the
branch before that ceiling landed, the same chain ran in 16.6 s at 67 MB, which is the number
that shows the memory fix working at scale; the ceiling is what a person now meets first.

Two changes. A value is released the moment its last consumer has finished, whatever happened
to that consumer, so memory follows the graph's width rather than its length. The edges into
each node are indexed once rather than scanned three times per step, which is the difference
between quadratic and linear. A third, from the security branch, bounds the bytes held at once
across the whole run — the width — at 1 GiB, and fails the producer that would cross it.

## 5. Known limitations, stated

- **Nothing is signed.** The installer is unsigned and says so; the publication checksum proves
  integrity and nothing about authorship. `docs/SIGNING.md`, ADR-0008.
- **There is no registry**, so a publication travels as a folder a person carries, and
  "discover" does not exist.
- **The chooser journeys were not driven at runtime in this session.** Save-as, publish into a
  folder, import from a folder and folder grants need a person at the dialog, or a machine
  nobody is using; the commands behind them are tested and their refusals were verified in the
  release binary.
- **The library bounds entries (10 000), not bytes.** Ten thousand imports of the largest
  publication is disk without a ceiling. Accepted for this beta because every import needs a
  human gesture at the native chooser; a byte ceiling is post-launch work.
- **No external security review.** Two internal audits are not one external one.
- **Windows only.** macOS and Linux are not built.

## 6. Numbers

| | 0.4.0-beta.1 | 0.5.0-beta.1 |
|---|---|---|
| Rust tests | 173 (20 suites) | 313 (28 suites) |
| TypeScript tests | 296 (17 files) | 500 (27 files) |
| Tauri commands | 14 | 21 |
| Desktop-crate unit tests | 0 | 14 |
| Languages, desktop | 6 | 6, with the connection refusals now translated |
| Languages, website | 2 | 2, with no English left in the Spanish page |
