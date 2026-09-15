# OBSERVABILITY

What Encastra would need to know about itself after it ships, what it collects today, and the
line it will not cross to find out.

**Status: nothing is collected and nothing is sent.** There is no telemetry, no crash reporter,
no analytics on the website, and no network call the application makes on its own behalf.
Settings states this as a fact rather than offering a switch. This document exists so that when
the question is asked — and it will be asked the first time somebody reports "it just closed" —
the answer is designed rather than improvised.

---

## 1. What is already observable, locally

More than it looks. Every run writes a journal: which step ran, for how long, what it was given
and what it produced (as summaries, never contents), every capability it asked for and whether
the broker allowed it. A refusal is a record, not a missing record. That journal is shown in the
run panel, and it is the answer to most "why did this not work" questions without anything
leaving the machine.

The library records a content hash for every project it knows about, so a file that changed or
went missing is reported as such rather than opened on trust. An import that is refused says
which of its checks refused it. A save is atomic, so a crash mid-save leaves the previous file.

What is **not** observable today: a crash of the application itself (nothing is written
anywhere when the process dies), a failed start-up, and any pattern across many machines.

---

## 2. What would be worth measuring, and why

Each of these is a question that would change what gets fixed next. Nothing is listed here
because a dashboard would look empty without it.

| Question | Signal | Why it matters |
|---|---|---|
| Does the application crash, and where? | An unhandled panic or a native crash, with the version and the top of the stack — no arguments, no paths | The only failure mode with no local trace today |
| Do imports get refused, and why? | The refusal *kind* (one of the `ImportError` variants), never the folder, name or publisher | Tells whether the check is catching real problems or refusing honest folders |
| Do publications get refused, and why? | The finding *code* (`secret-in-settings`, `path-names-its-author`, …), never the value | Same question from the sending side |
| Do runs fail, and where? | The component id and the error code, never inputs or outputs | A component that fails everywhere is a bug in the trust base |
| Are projects corrupt on open? | The `ProjectError` variant | Tells whether the container is being damaged in transit or by a bug |
| Does start-up fail? | The step that did not complete | Nothing is worse to debug remotely than a window that never appears |
| Would an update have failed? | Not applicable — there is no updater. When there is: a verification failure, by reason, never the artefact | An update channel that fails silently is one nobody trusts |

Not on the list, deliberately: how long people use the application, which views they open,
which components they place, what they name things, where they save. None of it changes what
gets fixed, all of it is somebody's business, and a product whose argument is that strangers'
code has no ambient authority should not quietly reserve some for itself.

---

## 3. How it would be collected, if it is

**Opt in, per machine, off by default, with the exact payload visible before sending.** A
switch in Settings that says what leaves and shows the last thing that left. Not a first-run
dialog with a pre-ticked box.

**Written locally first, always.** A crash or a refusal is recorded to a local diagnostics file
(under the application's data directory, alongside the library) whether or not sending is on.
A person who says "it crashed" can be asked for that file. This is the piece that is worth
building first, because it needs no server and no consent question: the data never leaves.

**Sent, if at all, as a fixed shape with no free text.** Enumerated kinds and codes, the
version, the platform, a random installation id that can be reset from Settings. No file names,
no folder names, no project names, no publisher names, no titles, no summaries, no hostnames,
no user names, no machine names, no IP-derived location, no stack frames from anywhere but this
codebase.

**Never sent, under any setting:** project contents, run inputs or outputs, capability scopes
(folders, hosts), anything typed into a setting, anything from a publication's document, the
library index, the journal.

---

## 4. What has to exist before any of it is switched on

1. The local diagnostics file, and a person having actually used one to fix a bug.
2. A server that holds nothing but the fixed shape above, with a retention period written
   down.
3. The privacy policy in `apps/web/src/config/legal.ts` updated to say exactly what §3 says,
   reviewed by somebody qualified to review it. The drafts there are drafts.
4. The Settings switch, off by default, with the payload preview.

Until then the honest sentence is the one Settings already has: nothing is collected.
