# Beta 0.2

> **Read this first.** This document describes what 0.2 is *for* and the shape it takes. It is
> written while the release is being built, so it deliberately makes no claim about final test
> counts, file sizes, installer hashes or which items landed. **Those come from the release
> report for your build** — see [RELEASE](RELEASE.md) — and where the two disagree, the release
> report is right.
>
> The measured starting point, taken before any 0.2 work began, is
> [BETA-0.2-AUDIT](BETA-0.2-AUDIT.md). Everything stated here as an existing fact comes from
> there.

---

## What 0.1 was, and why 0.2 exists

0.1 produced something that genuinely works. The component protocol, the type system, the
runtime, the capability broker, the project format and the command-line interface were all
built, tested and cross-checked. Nineteen components and two triggers. A desktop application with
a real canvas over a real engine. An installer. And a checkpoint test that takes a real 800×400
PNG, watches a real folder, and produces a real 200×100 PNG somewhere else — which is the whole
product in one automated test rather than a screenshot.

The audit's summary of that position is the reason this release exists:

> This is a working engine with an interface attached. That is exactly the problem 0.2 has to
> solve.

An engine with an interface attached is not a product. Somebody who installed 0.1 met a canvas
and no explanation of what a component was, what a port was, why a connection might be refused,
or why anything would ask them for permission. There was nothing to read, nothing to follow, and
no website to find out from — `apps/web/` was an empty directory. A product whose claim is
*assembling software is easier than writing it* had no way to show anybody that.

**0.2 is the release that makes the thing explicable.** It adds almost nothing to the engine on
purpose.

---

## What 0.2 is for

Five things, in the order the audit put them.

### 1. The canvas can be used without a mouse

First, ahead of everything more visible, because it is a correctness problem rather than a polish
one. In 0.1, keyboard focus moved through the sidebar, the toolbar and the palette and then
wrapped — it never visited the blocks on the canvas. A block that cannot be selected cannot be
configured, because its folder, its settings and its permission prompt all live in the inspector.
Somebody who cannot use a mouse could not use the product at all.

That is an exclusion, not a rough edge, and it was named the first item of 0.2 for that reason.
Alongside it: accessible roles on the canvas, names on icon-only controls, and a stated contrast
target.

### 2. There is a website

`apps/web/` was empty. There was no way for anybody who had not read the source to find out what
Encastra is. The website exists to answer that, and its centrepiece is a recorded terminal
showing a workflow being **refused** and then permitted — the permission model demonstrated
rather than described.

That terminal carries one hard constraint, recorded in the audit as a design property rather than
a task: **it is an animation and never an evaluator.** No `eval`, no server-side execution, no
visitor input reaching anything that runs. A site advertising that untrusted software should not
be able to reach what you did not permit, with a box that runs whatever a visitor types, would be
refuting itself in the act. [TERMINAL-DEMO](TERMINAL-DEMO.md) is the design and the transcript.

### 3. The application teaches itself

Onboarding, so a first launch leads somebody to a run they understand within about three minutes,
and never detains anybody who would rather skip. [ONBOARDING](ONBOARDING.md) is that design.

And a settings screen that reads as one: 0.1's was 115 lines in a single flat column — a theme
toggle, three lines of prose and an About block — which was the clearest place the product read as
a prototype.

### 4. The interface explains itself

Four specific failures from the audit, each with the same shape: the product knew the answer and
did not say it.

- **Empty states said "nothing here yet"**, which tells somebody what they can already see, at
  the exact moment they most need teaching.
- **A refused connection was silent.** The editor simply did not complete the drag. It knew why
  precisely — the type rules are in a table it had just consulted — and said nothing.
- **Permissions appeared as a capability id** and a reason. No statement of what the component
  will *not* be able to reach, which is the more reassuring half and the half that makes the
  narrow truth visible.
- **A run was nearly invisible.** Node states updated; there was no execution panel, no readable
  timing, no sense that something was happening.

[UX](UX.md) states these as principles with their reasoning, so they can be checked against rather
than admired.

### 5. There is documentation for somebody who is not an engineer

`RUNTIME.md`, `SECURITY.md` and `COMPONENT-SDK.md` are good, and they are reference material
written for the person who built the thing. 0.2 adds the friendly counterpart, which is the set of
documents this one belongs to:

| | |
|---|---|
| [GETTING-STARTED](GETTING-STARTED.md) | Installed it, now what |
| [CONCEPTS](CONCEPTS.md) | Component, port, type, connection, trigger, permission, run, journal |
| [TUTORIALS](TUTORIALS.md) | The first workflow, in full |
| [COMPONENTS](COMPONENTS.md) | All 19 components and both triggers, with what each can reach |
| [UX](UX.md) · [ONBOARDING](ONBOARDING.md) · [TERMINAL-DEMO](TERMINAL-DEMO.md) | The design of the interface, the first run, and the website demo |

These link to the reference material rather than restating it. Where they disagree with it, the
reference material and the code are right.

### And one piece of housekeeping

The version number lived in six files that agreed only because they were edited together. Nothing
enforced it, so the first release where somebody missed one would ship an installer whose About
screen disagreed with its own filename. 0.2 makes that a test.

---

## What 0.2 does not change

Stated as plainly as the audit did, because it is the reason a release like this is safe to make:

> The runtime, the type system, the capability broker, the project format, the CLI and the
> security model are working and are not being rewritten to make room for any of the above.

Every change is additive to those or confined to the interface above them. If you have a workflow
built on 0.1, the engine underneath it is the same engine.

---

## What is still missing

Not a roadmap — a list of things a person might reasonably expect to exist and will not find. The
authoritative, current version is [SECURITY](SECURITY.md) §9; this is the part of it that changes
what you can actually do.

**You cannot install components.** No marketplace, no registry, no accounts, no way to load a
component from anywhere. The nineteen in the box are what there is.

**Third-party components cannot run at all.** The WebAssembly sandbox that would let a stranger's
component execute safely is designed, documented and **not built**. The honest reason nothing is
exposed by that gap is that nothing third-party can execute.

**Nothing is signed and nothing is verified.** Not the installer, not a component, not a saved
workflow. Windows SmartScreen will warn about an unrecognised publisher and the warning is
accurate; a published hash is what you have instead.

**Nothing updates itself.** A new version means downloading a new installer.

**Permissions are not remembered.** They last one run, are never written into your workflow file,
and there is no "allow always" and no record of what you have allowed before. The safety of that
is real and so is the friction.

**Secrets have nowhere to live.** A workflow can declare that a variable is secret; nothing
resolves it and there is no keystore. The guarantee that a secret value can never reach a project
file is real and tested — the mechanism that would make secrets *usable* is not built. A workflow
needing an API token has nowhere safe to put one.

**There is no time limit or memory limit on a step.** Stopping a run is cooperative: a component
that does not check whether you asked it to stop is not forced to. Those controls arrive with the
WebAssembly host, because a timeout that cannot actually halt anything is a progress bar rather
than a control.

**There is no run history.** The journal is held in memory and shown in the inspector. Close the
application and the record of what ran is gone.

**The permission model has no list of places it refuses to hand over.** It checks that a request
stays inside a folder you granted; it does not check whether that folder was somewhere it should
have declined to grant in the first place. Grant a system directory and you have granted a system
directory.

**None of this has been externally audited.** It has been reviewed by the people who wrote it and
by the test suite. That is not the same thing, and an external audit is a prerequisite before
anything resembling a marketplace could launch.

---

## Known limitations of 0.2 itself

Beyond the list above, three things about this release in particular:

**It is a beta, and the word is meant.** The component protocol, the project format and the
permission model are the parts most likely to be relied upon and are the parts most likely to
change. A workflow saved today may need attention later.

**Windows is the tested platform.** The components declare support for Windows, macOS and Linux
and the engine is built to be platform-independent — but the installer, the install location and
the manual verification described in [RELEASE](RELEASE.md) are Windows.

**The parts built in parallel may not agree yet.** The desktop application, the settings screen,
the onboarding flow and the website were built alongside these documents rather than after them.
Where a document describes something the build does differently, the build is right and the
document is a bug. The final reconciliation is the release report's job.

---

## How to tell whether 0.2 worked

One test, and it is not a number: **somebody who has never seen this product installs it, and
without asking anybody, gets a workflow running and can explain why it asked them for permission.**

0.1 could not pass that. Everything in this release is in service of it.
