# Getting started

This page takes you from "I have just installed this" to "I ran something and I understood what
came out". It assumes nothing. If you have never seen a tool like this before, you are the
person it is written for.

Everything else in `docs/` is reference material for people building on Encastra.
[CONCEPTS](CONCEPTS.md) is the vocabulary; [TUTORIALS](TUTORIALS.md) is the first workflow built
step by step; [COMPONENTS](COMPONENTS.md) is the list of parts you have.

---

## 1. What Encastra is, in one paragraph

Encastra runs small jobs on your own machine that you assemble out of ready-made parts instead
of writing code. You drag a few blocks onto a canvas, draw lines between them to say what feeds
what, and press run. A job might watch a folder and shrink every photo that lands in it, or read
a spreadsheet and turn it into a file some other program expects. The work happens on your
computer. Nothing is uploaded, there is no account, and there is no model deciding anything
behind your back.

The part worth knowing up front: **a block can only reach what you have allowed it to reach.**
A block that shrinks images cannot write anywhere on your disk until you point at a folder and
say yes. That is not a setting you can leave on by accident — it is how the thing is built, and
[§5](#5-the-first-time-something-refuses-to-run) is where you will meet it.

---

## 2. Installing

The Windows installer is an `.exe` produced by the build. It installs **for you only** and does
not ask for an administrator.

| Where things go | Path |
|---|---|
| The application | `%LOCALAPPDATA%\Encastra\` |
| Uninstaller | `%LOCALAPPDATA%\Encastra\uninstall.exe` |
| Your saved work | Wherever you save it. `.encastra` files are ordinary files |

Two things will happen on first run that are worth expecting.

**Windows will warn you about an unrecognised publisher.** That warning is accurate and we are
not going to tell you to ignore it. These builds are not code-signed, which means nothing in the
file proves who made it. What you have instead is a published hash: compare the installer's
SHA-256 against the one in [RELEASE](RELEASE.md) before you run it. When signing arrives the
warning goes away; until then, the warning is telling you the truth.

**Nothing updates itself.** There is no automatic update mechanism in this build. A new version
means downloading a new installer and running it. That is a gap, not a design choice, and it is
recorded as one.

Uninstalling removes the application and leaves your `.encastra` files alone.

---

## 3. First launch — what you are looking at

The window has a strip of icons down the left, a toolbar across the top, your work in the middle,
and a status bar along the bottom that stays the same wherever you are.

The left strip has five places. Five, not fifteen — there is no Marketplace or Community button,
because there is no marketplace and no community, and a menu item that opens a "coming soon"
page teaches you that half the application is decoration.

**Home** is where you start. It asks one question — what do you want to do now — and gets out of
the way. You can begin an empty workflow, open one you saved, or open one of the demo workflows
that ship with the application.

**Builder** is the canvas, and it is where you will spend your time. It has three parts: a
**palette** on one side listing every block you can use, the **canvas** in the middle where you
arrange them, and an **inspector** on the other side that shows the settings for whichever block
is selected. The inspector is also the debugger — after a run it shows what that block actually
did — and it is where permission questions appear.

**Components** is the catalogue: all nineteen blocks and both triggers, each stating what it
does, what it takes in, what it gives out, and what it can reach. The wording there is the same
wording the permission prompt will use, deliberately, so nothing is a surprise later.

**Security** is the screen that makes the permission model legible: what is installed, what each
thing is able to reach, what the workflow currently open was actually allowed, and — stated on
the same screen rather than hidden in a document — what the product does *not* protect you
against.

**Settings** is theme, where your data lives, and which version you are running.

### The shortcuts that exist

Three, and they work anywhere in the application:

| Keys | What happens |
|---|---|
| `Ctrl` + `Enter` | Run the workflow (or start watching, if it begins with a trigger) |
| `Ctrl` + `S` | Save. `Ctrl` + `Shift` + `S` saves a copy under a new name |
| `Ctrl` + `O` | Open a saved workflow |

On a Mac, `Cmd` works in place of `Ctrl`.

That is the complete list. If you have read somewhere that some other key does something, it
does not.

> **A known gap, stated because you may hit it.** Reaching the blocks *on the canvas* using only
> the keyboard has been a defect in this build: focus moves through the sidebar, the toolbar and
> the palette but has not visited the nodes themselves, and a block you cannot select is a block
> you cannot configure. Closing that hole was the first item of work in 0.2 — see
> [BETA-0.2](BETA-0.2.md) — and the release report for your build records where it landed.

---

## 4. Your first workflow, end to end

The shortest complete thing you can build is three blocks: watch a folder, shrink whatever
appears, save the result somewhere else. It is also the workflow the project uses as its own
proof that everything works — there is an automated test that drops a real 800×400 PNG into a
real folder and checks that a real 200×100 PNG comes out of another one.

**Open it rather than building it.** From Home, open the **Image Processor** demo. It arrives as
three connected blocks with the two folders deliberately left empty, because a demo that quietly
wrote into a folder you had not chosen would be doing exactly the thing this product exists to
prevent.

Now fill in the gaps.

1. **Click the first block, Watch Folder.** In the inspector, set *Watch this folder* to a folder
   you can easily drop a file into. Make a new empty one if you like; that makes what happens
   next easier to see.
2. **Click the last block, Save File.** Set its folder to a *different* folder — somewhere you
   are happy for new files to appear.
3. **Grant the two permissions.** With Watch Folder selected, the inspector has a **Permissions**
   section listing `fs.read` with a sentence explaining why it wants it. Press **Allow this
   folder**. Do the same on Save File, which asks for `fs.write`. Neither button does anything
   until you have chosen a folder, because a permission with no folder attached is not a
   permission anybody decided to give.
4. **Press `Ctrl` + `Enter`.** Because this workflow starts with a trigger, it does not run once
   and finish — it starts watching, and the toolbar button says so.
5. **Drop a photo into the folder you are watching.** Within a second or so the blocks light up
   in turn, the status bar counts the run, and a smaller copy appears in the other folder with
   `-small` on the end of its name.

Press **Stop** when you have seen enough.

### What actually happened

Worth understanding, because it is the whole product in miniature:

- The watcher noticed a new file — and waited until the file stopped growing before doing
  anything with it, so a large photo still being copied in is never handed over half-written.
- It passed the file to the resizer **as a handle, not as a path**. The resizer was never told
  where on your disk the file lives. It cannot go looking for anything else, because it has
  nothing to look with.
- The resizer wrote its result into scratch space belonging to that run. That needs no permission
  from you, because it is not anywhere you can see.
- Save File is the step that put a file somewhere you *can* see, and it is therefore the step
  that had to ask. It could write into the folder you named and nowhere else.

For the same three blocks assembled from an empty canvas, with every choice explained, go to
[TUTORIALS](TUTORIALS.md).

---

## 5. The first time something refuses to run

It will happen, and it is not a bug. Try it deliberately: take the permission away from Save File
and run again. The step fails and says so, in these words or close to them:

```
denied: This component tried to use fs.write and was not allowed: no folder has
been allowed for this node.
Grant this component access to a folder, then run again.
```

Three things about that refusal are worth noticing.

**The rest of the workflow still ran.** Steps that had nothing to do with the refusal completed
normally; steps that depended on the refused one are marked skipped, with the reason. A run
where something failed is reported as partly finished, never as fine.

**It tells you what to do next.** A refusal that only says "denied" has told you nothing you
could act on.

**It applies to the blocks that ship with the product too.** There is no separate, weaker path
for first-party components. A built-in block that forgot to declare that it writes files cannot
write files, and there is a test that proves it. That is what makes the permission prompt worth
reading: it is describing what is actually enforced.

---

## 6. Where your work lives

A workflow you save is a single `.encastra` file, wherever you put it. It holds the graph, the
settings on each block, and a version history, so you can look at what a workflow used to be and
go back to it.

It never holds a secret value. Not "it should not" — the place that would store one does not
exist in the format, and a hand-edited file that tries to add one is refused when opened. The
consequence is honest and worth knowing: **a workflow that needs a password or an API token has
nowhere safe to keep it in this build.** The mechanism that would make that safe is designed and
not yet built.

Permissions are not saved either. They last one run and are assembled fresh each time, so
opening a workflow someone sent you grants nothing until you say yes yourself.

---

## 7. Where to go next

- [CONCEPTS](CONCEPTS.md) — components, ports, types, connections, triggers, permissions, runs
  and the journal, each explained once and properly.
- [TUTORIALS](TUTORIALS.md) — the first workflow built from nothing, and an honest list of which
  other tutorials exist.
- [COMPONENTS](COMPONENTS.md) — every block you have, what it needs and what it can reach.
- [BETA-0.2](BETA-0.2.md) — what this release is, and what is still missing.

For the engineering reference underneath all of this: [RUNTIME](RUNTIME.md) for how a run works,
[SECURITY](SECURITY.md) for the permission model as implemented and its stated limits, and
[PROJECT-FORMAT](PROJECT-FORMAT.md) for what is inside a `.encastra` file.
