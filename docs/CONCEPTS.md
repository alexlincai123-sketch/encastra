# Concepts

The vocabulary, explained once and properly. Nothing here assumes you have written software.
If a word in the application is puzzling you, it is defined on this page.

The order is deliberate: each idea uses the one before it.

---

## A component is a part that does one thing

A **component** is a block that performs a single job. *Resize Image* changes an image's size.
*Read CSV* turns comma-separated text into rows. *Notify* puts a message on your screen. That is
the whole of what any one of them does.

Components are deliberately narrow. A block that resized an image *and* saved it *and* sent you a
message would be easier to use exactly once, and then impossible to reuse for anything else. Kept
narrow, the same resizer serves a photo workflow, a thumbnail workflow and a workflow you have
not thought of yet.

You have **nineteen components and two triggers**. That number is small on purpose: everything in
the set is code that ships with the product and is trusted by it, so each addition is a
deliberate decision rather than a feature count. [COMPONENTS](COMPONENTS.md) lists them all.

> **Components from other people are not possible in this build.** The design for running a
> stranger's component safely — as WebAssembly, with no access to anything you did not grant —
> is written down in [ADR-0001](adr/0001-wasm-component-model-for-third-party-code.md) and
> [COMPONENT-SDK](COMPONENT-SDK.md), and it is **not built**. There is no marketplace, no
> registry, and no way to install a component. Everything you can use is in the box.

---

## A port is a named socket on a component

Each component has labelled sockets. The ones on the way in are **inputs**; the ones on the way
out are **outputs**. Collectively they are **ports**.

*Resize Image* has one input port called `image` and three output ports: `image` (the resized
result), `width` and `height` (the size it came out at). *Watch Folder* has no inputs at all —
nothing feeds it, it produces — and three outputs: `file`, `name` and `extension`.

Ports have names because a component often produces more than one useful thing, and you need to
say which one you mean. A workflow that sorts files by type reads the `extension` port to decide
the route and the `file` port for the thing that actually travels along it. Same block, two
different outputs, used for two different purposes.

Some inputs are **required** and some are optional. A required input with nothing connected to it
is an error the application catches before the workflow runs, rather than a failure in the middle
of it.

---

## A type says what kind of thing a port carries

Every port has a **type** — a statement of what sort of value moves through it. This is the idea
that makes a visual editor honest rather than decorative: two blocks either fit together or they
do not, and you find out when you draw the line, not when the workflow fails.

There are eleven types in two families.

### Values

| Type | Shown as | What it is |
|---|---|---|
| `bool` | Boolean | True or false |
| `i64` | Integer | A whole number |
| `f64` | Number | A number that may have a fractional part |
| `string` | Text | Text |
| `json` | JSON | Structured data — lists, and things with named fields |

### Handles

| Type | Shown as | What it is |
|---|---|---|
| `file` | File | A file |
| `dir` | Folder | A folder |
| `bytes` | Bytes | Raw binary content |
| `image` | Image | A file the runtime has checked really is a decodable image |
| `video` | Video | A file the runtime has checked really contains video |
| `audio` | Audio | A file the runtime has checked really is decodable audio |

A **handle** is the important one to understand. When a file moves between two components, what
actually travels is not the file's location on your disk and not its contents — it is an opaque
ticket. The application keeps the path; the component gets a number that means "the file you were
given".

This is the reason a component cannot go rummaging. "Read `~/.ssh/id_rsa` instead" is not
something a component is *forbidden* from expressing — it is something it *cannot* express,
because it has no path to change. The only thing a component learns about a file is its name
without the folder, which is the minimum needed to name an output after its input.

### Why `image` → `image` is allowed and `image` → `video` is not

`image`, `video` and `audio` are each a *kind of* `file`. That relationship decides what fits.

**Same type fits, always.** An `image` output into an `image` input is the ordinary case. Nothing
is converted; the value is the value.

**Narrower into wider fits, silently.** An `image` output into a `file` input is fine, because
every image is a file. You are being less specific about something, which can never fail.

**Wider into narrower is allowed but has to be checked.** A `file` output into an `image` input is
a claim that this particular file really is an image, and that claim can be wrong. It is legal,
but never silent: the editor inserts a visible conversion step, so that when a text file turns up
where an image was expected, there is somewhere in the workflow for the failure to be reported.
A conversion that can fail must have a place in the picture.

**Sideways does not fit at all.** `image` into `video` is refused. Both are kinds of `file`, which
makes them siblings, and being siblings is not a relationship that converts. There is no operation
that turns a photograph into a video, so the editor will not let you draw the line and pretend
there is. This is the one people ask about most, and the answer is simply that nothing sensible
could happen.

### Conversions between values

Values convert according to a fixed table, and every conversion is one of three kinds.

| Kind | What it means |
|---|---|
| **Direct** | The same type, or a widening. Nothing happens |
| **Implicit** | A conversion that cannot fail for any input. Done automatically, and marked on the connection so you can see it happened |
| **Explicit** | Legal, but it may fail or lose information. A conversion step appears in the workflow where you can see and inspect it |

Some real examples, all from the same table:

- A whole number into a text input is **implicit**. Every number can be written as text; nothing
  can go wrong.
- True or false into a text input is **implicit**, and so is true or false into a number
  (`false` becomes `0`, `true` becomes `1`).
- Text into a whole number is **explicit**, because `"banana"` is not a number and somebody has
  to be told when that happens.
- Structured data into text is **explicit** — not because it can fail, but because a workflow
  should never turn structured data into a blob of text by accident.
- A file into an image is **explicit**, because the file is inspected and might not be one.

The rules live in exactly one place, a data file both halves of the product read. The editor that
decides whether to let you draw a line and the engine that performs the conversion are not two
implementations that might drift apart; there is a test that fails the build if they ever
disagree about any pair of types. See [COMPONENT-SDK](COMPONENT-SDK.md) §4 for the full table.

---

## A connection says what feeds what

A **connection** — the line you draw — takes one output port and attaches it to one input port.
It means "when this step produces its result, hand it to that step".

Connections also define the order things happen in. You do not schedule anything: the shape of
what is connected to what says that the resizer cannot start before the file exists, and the
engine works out the rest. Steps run one after another.

An output can feed several inputs. An input takes one connection, because two things arriving at
the same socket would leave nobody able to say which one won.

**A connection that would not work cannot be drawn.** The types either fit or they do not, and
the editor refuses before the workflow exists rather than letting you find out during a run. When
the application refuses a connection it should say why — it knows the reason exactly, because the
rule table is right there. Saying nothing and simply not completing the drag is a failure of the
interface, and it is one this release set out to fix; [UX](UX.md) states the principle.

---

## A trigger starts a workflow; a step is something it does

Most components are **steps**. A step waits for its inputs, does its job once, produces its
outputs, and is finished.

A **trigger** is different. It does not wait to be fed and it does not run once. It watches for
something in the world and starts the whole workflow each time that something happens.

You have two.

**Watch Folder** starts the workflow whenever a file appears in a folder you choose. Drop in five
photos and the workflow runs five times, once per photo. It checks the folder roughly twice a
second, and it waits until a file has stopped changing size before handing it on — a large file
copied across a network shows up immediately and keeps growing for several seconds afterwards,
and passing on half a file produces a failure that looks like your workflow's fault. It also does
not process what was already in the folder when you started, unless you ask it to, so switching a
workflow on does not immediately chew through a folder full of old files.

**Timer** starts the workflow on a schedule — every N seconds, from one second up to a day, with
the first run happening straight away.

The practical difference: a workflow with no trigger runs once when you press run, and stops. A
workflow that begins with a trigger *starts watching* when you press run, and keeps going until
you press stop. The button says which, and the status bar counts the runs as they happen.

---

## A permission is a decision you made about one step

A component's manifest declares what it needs to reach — reading files, writing files, using the
network, showing a notification, using the clipboard — and, alongside each one, a sentence saying
why in words a person can weigh. There is a test that rejects a reason too thin to consent to;
"required" is not an explanation.

**Declaring is not being granted.** A component that asks for the ability to write files still
cannot write anything. The asking is what puts the question in front of you; your answer is what
grants it.

Permissions are attached to **one step**, not to the workflow and not to the component in
general. Two Save File blocks in the same workflow are two separate decisions, each scoped to its
own folder. There is deliberately no way to grant something to everything at once: a permission
that is not attached to a particular step is a permission nobody actually decided to give.

A permission is also **scoped** — it is not a yes-or-no, it is a yes-to-*this*:

| Kind of permission | What you are actually agreeing to |
|---|---|
| Reading or writing files | **One folder**, the one you chose. Nothing outside it, and shortcuts pointing out of it are resolved rather than followed |
| Using the network | **The specific address** on that step. An address you did not list is refused, and there is no wildcard |
| Notifications, clipboard | A plain yes, because there is nothing to narrow |

There is a fourth kind you will never be asked about: a step that only needs to read what the
workflow already handed it. That needs no decision, because it adds nothing you did not already
say by drawing the line.

Permissions last **one run**. Nothing remembers them between runs, and nothing is saved into your
workflow file — so a workflow somebody sends you arrives with no permissions at all and can do
nothing until you say so yourself. The cost of that is real: there is no "allow always", and no
record of what you have allowed before.

### What the permission model does not do

It is worth being exact, because a security claim that only lists its strengths is marketing.

What it does: every request for OS authority goes through one gate, including from the components
that ship with the product; a refusal stops the thing that was refused; every request, allowed or
refused, is written down; files travel as handles, so there is no path for a component to alter.

What it does not do:

- **It does not make a component safe to trust.** Built-in components are ordinary native code.
  They are held to what they declared, not to anything stronger. The isolation that would contain
  a *stranger's* component is designed and not built, and nothing third-party can run here.
- **It does not stop a component that hangs.** There is no time limit and no memory limit on a
  step. Stopping a run is cooperative — a component that ignores the request is not forced.
- **It does not protect you from your own answer.** If you grant a system folder, you have
  granted a system folder. There is no list of places the application refuses to hand over.
- **Nothing is signed or verified.** Not the application, not a component, not a saved workflow.
- **None of this has been externally audited.** It has been reviewed by the people who wrote it,
  which is not the same thing.

[SECURITY](SECURITY.md) §9 is the full list, kept current, and [THREAT-MODEL](THREAT-MODEL.md)
is the analysis behind it.

---

## A run is one execution, and the journal is what it did

A **run** is one pass through the workflow. Press run on a workflow with no trigger and you get
one. A workflow with a trigger produces one run per event — five photos, five runs.

Each step in a run ends in one of a few states: it worked, it failed, it was skipped because
something it needed did not finish, it was stopped, or it was switched off. The run as a whole
gets an honest verdict from those. If anything failed and anything succeeded, the run is
**partly finished** — not "finished", because something did fail, and not "failed", because the
rest of your work did happen. If you pressed stop, the run says stopped rather than failed; you
did that on purpose and should not be told it broke.

The **journal** is the record of what happened, and it is what the inspector shows you after a
run. For each step it holds: which component it was, what state it ended in, when it started and
how long it took, a summary of everything that went in and came out, **every permission request
the gate saw and whether it was allowed or refused**, whatever the component had to say for
itself, and the error if there was one.

The journal describes values rather than quoting them. It records `text (13 characters)` or
`json (3 fields)` or `image #7`, never the text and never the image. A journal is the obvious
thing to export or paste into a bug report, and that is not somewhere the contents of your files
should end up. The live inspector does show you actual values while you are debugging — that is a
different thing, held in memory, and never written down.

Nothing writes a journal to disk in this build. There is no run history; close the application
and the record of what ran is gone. [RUNTIME](RUNTIME.md) §6 has the detail.

---

## Where these ideas live in the application

| Idea | Where you meet it |
|---|---|
| Components | The **palette** in Builder, and the **Components** catalogue |
| Ports and types | The sockets on each block; the colour and label tell you the type |
| Connections | Lines on the canvas |
| Triggers | In the palette beside everything else; the run button changes wording for them |
| Permissions | The **Permissions** section of the inspector, and the **Security** screen |
| Runs and the journal | The status bar while it happens; the inspector once it has |

Next: [TUTORIALS](TUTORIALS.md) builds a workflow using all of the above.
