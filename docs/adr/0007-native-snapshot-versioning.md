# ADR-0007 — Native snapshot versioning, not Git

**Status:** accepted · 2026-09-11

## Context

Users need version history: create a version, restore an old one, compare two, keep a
changelog. The reflex is "it's a file, use Git".

## Decision

Version history is **content-addressed snapshots in the local SQLite database**, owned by the
app. Git is not required, not embedded, and not assumed.

```sql
snapshot(id, project_id, parent_id, created_at, label, message, graph_hash, blob)
```

Snapshots are immutable and singly-linked by `parent_id`.

## Why not Git

1. **The audience.** A designer automating a folder of images should not have to learn a
   staging area to undo yesterday's change. Git's model is not incidental complexity we can
   hide; a UI that hides it produces users who cannot recover when it surfaces.
2. **The unit is a graph, not text.** A useful diff is "the Resize node's width changed from
   800 to 1200" and "this edge was rewired". A line diff of `graph.json` is noise, and
   auto-merging it can produce a *syntactically valid, semantically broken* graph — the worst
   possible outcome for a versioning system.
3. **A repository is not a project file.** Projects are single portable `.encastra` files that
   users email and upload. A `.git` directory is not that.

Git remains available to anyone who wants it, on top of the exported files. It is not a
dependency.

## Consequences

**Restore is non-destructive.** Restoring version 3 creates a *new* snapshot whose content
equals version 3. History is never rewritten, so restore is itself undoable — which is the
property that makes people willing to press the button.

Branches and merge are later work, and the `parent_id` pointer is already the shape they need:
a branch is a second child, and a merge is a snapshot with two parents. Merge semantics for a
graph (both sides edited the same node's config) are a real design problem and are deliberately
deferred rather than half-built.

Snapshot blobs are compressed graph JSON, not assets — assets are content-addressed separately,
so re-saving a project with a 4 GB video does not store the video again.

The database is the user's data. Its writes are crash-safe (WAL, atomic replace), migrations
are versioned and tested, and export produces a plain `.encastra` file that never requires
this database to read.
