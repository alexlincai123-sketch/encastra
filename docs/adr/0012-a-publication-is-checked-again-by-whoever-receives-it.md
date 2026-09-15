# ADR-0012 — A publication is checked again by whoever receives it, and nothing runs on import

**Status:** accepted · 2026-09-15

## Context

ADR-0011 gave a publication a shape and a check, both on the machine that makes it. It stopped
at a folder: a project file and a `publication.json` beside it, going nowhere. That folder is
the first thing this product produces on one machine to be read on another, and nothing read
it. There was no way to take one in, no record of what had been taken in, and no answer to the
question a person asks about a file that arrived from somewhere — *what will this do to my
machine if I open it?*

The obvious way to close the gap is also the wrong one: read the document, trust it, copy the
file, open it. Every field in `publication.json` was written by the sender, and the sender is
the party this whole exercise exists to be careful about. A capability list the sender typed is
a disclosure nobody checked. A checksum the sender wrote proves nothing about who wrote it. A
review outcome the sender recorded is a refusal the sender could have edited away.

There was also nowhere to put anything. Projects lived wherever a person saved them and the
application remembered one path, the last one open. A second machine's project had no place to
land that the application would know about afterwards.

## Decision

**The receiving side runs the same check the sender ran, on its own components, and believes
the result rather than the document.** `encastra_publish::import::inspect` reads exactly two
files out of a folder, refuses anything else in it, verifies that the project's bytes are the
bytes the document describes, parses the project with the same bounded reader the editor uses,
and then runs `review()` — the function from ADR-0011 — against *this* build's registry. A
secret in a setting, a path naming its author, a component this build cannot read or that no
longer matches its pinned digest, a licence conflict: each is refused here exactly as it would
have been refused at preparation, whatever the document says happened at preparation.

**The document has to agree with the project it describes, or it is refused.** Its runtime range
must equal the project's own. Its capability list must equal, as a set, what the review gathers
from the components the project actually uses — understating permissions is the obvious
attack, and overstating them is the subtler one, because a list people learn to skim is a list
that stops protecting them. Its listing id must be a name and not a path, inside the namespace
its publisher claims. Its free text must fit a ceiling and carry none of the characters that
make text display as something other than what it contains. Which side is wrong is not
knowable from here and is not guessed at.

**Nothing follows a link and nothing is read twice.** The folder, the document and the project
are examined with `symlink_metadata`; a link where any of them should be is a refusal, because
following it reads a file outside the folder the person chose. `import()` copies the bytes it
verified, held in memory, rather than reading the source again — verifying a file and then
copying it is two reads of something somebody else can change in between.

**Importing never runs anything.** It opens no socket, executes no graph, resolves no variable.
It copies two files into `<app data>/library/imports/<listing>/<version>/`, staged beside the
destination and moved into place so that an interruption leaves a half-written temporary folder
rather than a half-written publication that looks complete. Opening the imported project is a
separate act, and running it is a third, with the same per-run consent as any other project.

**A library is an index, not a store.** `crates/encastra-library` records what a person has —
created, imported, prepared — with the path, a content hash taken when it was last seen, and
what was known about it. It is written atomically. An index that cannot be parsed is set aside
under a dated name and an empty one takes its place; an index written by a build that
understood more than this one is left exactly where it is, because renaming somebody's library
for being from the future is not recovery. Removing an entry removes the entry; deleting files
is offered only for an imported copy, only inside the imports folder, and never for a project a
person created — that file is theirs and stays where they put it.

**Integrity is said to be integrity.** `Inspected` carries `provenance_verified: false` and
`publisher_verified: false` as fields, not as omissions, so that an interface has to render
"no" rather than being free to imply "yes" by saying nothing. The checksum proves the bytes did
not change on the way. The signature that would prove who made them is ADR-0008 and does not
exist in this build.

## Consequences

The loop the website describes — build, publish, import, reuse — now has a receiving end that
is real, offline, and as suspicious as it should be. A publication can be prepared on one
machine and taken in on another, and the person taking it in sees what it will ask for before
it is anywhere it could run.

The check catches what is mechanical enough to catch and nothing else. It is not an audit, the
publisher's name is a claim, and a project can be honest about its permissions and still do
something unwelcome with them. Every run still asks.

A publication that is refused by the receiving check while having passed the sender's is a
publication whose document was edited, whose components differ between the two builds, or
whose project changed after it was described. All three are worth refusing and none is worth
distinguishing for the person on the receiving end, who is told what would have to change.

The imports folder is per version and never overwritten, so taking in `1.1.0` cannot disturb
the `1.0.0` somebody is still using. The cost is disk, in kilobytes.

## Alternatives considered

**Trust the document's own review outcome and capability list.** Rejected: the document is
written by the party being checked.

**Register the source folder in the library without copying.** Rejected: the source may be a
removable drive, a download folder somebody empties, or a place another program rewrites. What
the library points at should be something the application put there.

**Strip dangerous characters from titles rather than refusing them.** Rejected, as in
ADR-0011: stripping changes what somebody wrote and hands back a name they never chose.

**Let a folder with an extra file through with a warning.** Rejected: a publication folder holds
two things, and the reader has no way to know what the third one is for. Files a file manager
drops on its own (`desktop.ini`, `Thumbs.db`, `.DS_Store`) are the one carve-out, and they are
ignored rather than read.
