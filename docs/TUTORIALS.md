# Tutorials

One tutorial is written. It is the important one, and it is written out in full.

If you have not read [CONCEPTS](CONCEPTS.md), you do not need to — this page explains each idea
at the point you first need it, and links back for the longer version.

| Tutorial | State |
|---|---|
| [Build your first workflow](#build-your-first-workflow) — watch a folder, resize, save | **written** |
| [Further topics](#further-topics) | not written yet, and listed honestly |

---

# Build your first workflow

**What you will end up with:** a workflow that sits and watches a folder. Every time you drop a
photo into it, a smaller copy of that photo appears in a different folder, automatically.

**How long:** about ten minutes, most of it reading.

**What you need:** Encastra installed, and one image file to test with.

This is the same three blocks the project uses as its own proof that everything works. There is
an automated test that puts a real 800×400 PNG into a real folder and checks a real 200×100 PNG
comes out of another one, and if that test fails the product is considered broken whatever the
interface looks like. You are building the thing the product is measured against.

---

## Before you start: make two folders

Make two empty folders somewhere convenient, and call them something you will recognise:

- **`inbox`** — the folder you will drop photos into.
- **`out`** — the folder the smaller copies will appear in.

Two separate folders, not one. If the workflow wrote its results back into the folder it was
watching, the watcher would notice the result and process it again, and the result of *that*
again. Keeping them apart avoids that entirely, which is a better answer than any clever rule.

---

## Step 1 — An empty canvas

Open Encastra. From **Home**, start a new workflow. You land in **Builder**, looking at three
areas:

- the **palette** on one side, listing every block available to you;
- the **canvas** in the middle, currently empty;
- the **inspector** on the other side, which fills in when you select a block.

---

## Step 2 — Add Watch Folder

Find **Watch Folder** in the palette and put it on the canvas, towards the left.

**What it is for.** Watch Folder notices when a file appears in a folder and starts the workflow.
It is a **trigger**, which is a different kind of block from the rest: it has no inputs, because
nothing feeds it — it is the thing that begins.

**What it gives out.** Three output ports:

| Port | Type | What it carries |
|---|---|---|
| `file` | File | The file that appeared |
| `name` | Text | Its name, for example `photo.png` |
| `extension` | Text | Just the part after the dot, in lower case — `png` |

Three outputs rather than one because different workflows want different things. Yours wants the
file. A workflow that sorts files into folders by type would use `extension` to choose the route.
You do not have to connect all of them, and you do not have to connect any you do not need.

**Its settings.** Select it, and in the inspector:

- **Watch this folder** — choose your `inbox`. Required.
- **Only these kinds** — type `png, jpg, jpeg`. Now it ignores anything that is not a photo.
  Leave it empty to accept every file.
- **Include files already there** — leave this off. Off means the workflow starts fresh and only
  reacts to what arrives *after* you press run. On means it immediately processes everything
  already sitting in the folder, which is occasionally what somebody wants and is therefore a
  setting rather than a default.

---

## Step 3 — Add Resize Image

Put **Resize Image** on the canvas to the right of the watcher.

**What it is for.** It changes an image's size, and nothing else. It does not save anything — that
matters, and Step 5 explains why.

**Its ports.**

| Direction | Port | Type |
|---|---|---|
| In | `image` | Image (required) |
| Out | `image` | Image — the resized result |
| Out | `width` | Integer — what it came out at |
| Out | `height` | Integer |

**Its settings.**

- **Width** — set `800`.
- **Height** — leave at `0`. Zero means "work it out from the other one", so the proportions are
  kept and nothing is squashed. Setting both fixes both, and then the **Fit** setting decides what
  gives.
- **Fit** — leave on `contain`. *Contain* fits the image inside the box you asked for. *Cover*
  fills the box and crops off the overflow. *Stretch* distorts to fit exactly, and is almost never
  what you want.
- **JPEG quality** — only relevant if your images are JPEGs; the default is sensible.

---

## Step 4 — The first connection, and what it means

Drag from the watcher's **`file`** output to the resizer's **`image`** input.

**What a connection means.** It says: when this step produces its result, hand it to that one.
It also decides the order — you never schedule anything, because "the resizer cannot start until
the file exists" is already stated by the line you drew.

**Why this particular line is allowed.** The watcher's `file` port is typed `File`, and the
resizer's `image` port is typed `Image`. Those are not the same type, and `Image` is the narrower
of the two — every image is a file, but not every file is an image. Connecting a `File` to an
`Image` is a claim that this file really is one, and that claim can be wrong. So the connection is
allowed, but it is not silent: a conversion appears in the workflow, where a file that turns out
to be a text document has somewhere visible to fail.

It matters that the failure has a *place*. If the check happened invisibly inside the resizer, a
bad file would look like the resizer being broken. With the conversion in the picture, you can see
exactly which step said no.

**What travels along the line.** Not a path. The resizer is never told where on your disk the
photo lives — it receives a **handle**, an opaque ticket meaning "the file you were given". It
cannot look at anything else because it has nothing to look with. This is why the permission
question in Step 6 is narrow enough to be worth answering.

**If a connection is refused**, the types do not fit. The commonest case is trying to connect
sideways: `Image` into `Video`, say. Both are kinds of file, which makes them siblings, and there
is no operation that turns a photograph into a video. [CONCEPTS](CONCEPTS.md#a-type-says-what-kind-of-thing-a-port-carries)
has the full picture.

---

## Step 5 — Add Save File

Put **Save File** to the right of the resizer, and connect the resizer's **`image`** output to
Save File's **`file`** input.

That connection needs no conversion. An `Image` going into a `File` input is a *widening* — you
are being less specific about something, which can never fail.

**Why this block exists at all.** The obvious question is why the resizer does not just save its
own result. The answer is the shape of the whole product: the resizer writes into scratch space
belonging to the run, which is not anywhere you can see and therefore needs no permission from
you. Putting a file somewhere you *can* see is a different act, and it is the act that has to ask.
Splitting them means one block, Save File, is the one that asks — and you always know which step
is the one touching your disk.

**Its settings.**

- **Folder** — choose your `out` folder. Required.
- **File name** — leave empty. Empty means "keep the name it already has", which is the only
  sensible default for a workflow processing a folder: nobody can be asked for a filename per
  file.
- **Add to the name** — type `-small`. This is inserted before the extension, so `photo.png`
  becomes `photo-small.png`, and the original is never at risk of being confused with the copy.

---

## Step 6 — Permissions, and why you are being asked

Select **Watch Folder** again and look at the inspector. Below its settings is a **Permissions**
section:

```
fs.read
Watches the folder you pick and reads the files that appear in it.
[ Allow this folder ]   C:\Users\you\inbox
```

Select **Save File** and you will find its own:

```
fs.write
Saves the file into the folder you pick. It cannot write anywhere else.
[ Allow this folder ]   C:\Users\you\out
```

Press **Allow this folder** on both.

**What you just agreed to.** Not "this workflow may read and write files". You agreed that *this
watcher* may read inside *that one folder*, and that *this Save File block* may write inside *that
other one folder*. The permission is attached to the individual step and scoped to the folder
named next to the button. Nothing outside it, and a shortcut pointing out of it is resolved rather
than followed. A second Save File block would be a second, separate decision.

**Why the button is greyed out until you have chosen a folder.** Because a grant with no folder
attached is an unbounded grant, and the application will not offer you one.

**What the resizer is not asking for.** Look at Resize Image's inspector: there is no permission
question at all. It does declare that it reads files — but only the ones the workflow handed it,
which is not a decision, because you already said so by drawing the line. That is worth noticing:
the step doing the actual work with your photo needed no permission, because it can only ever see
what you passed it.

**Declaring is not being granted.** Until you pressed those buttons, both blocks had asked and
neither could do anything. The manifest is what puts the question in front of you; your answer is
what grants it.

**These last one run.** They are not saved into the file and not remembered between runs. If you
send this workflow to somebody, it arrives able to do nothing until they answer for themselves.
There is no "allow always" in this build.

---

## Step 7 — Run it

Press **`Ctrl` + `Enter`**, or the button in the toolbar.

Notice the button does not say *Run*. It says **Start watching**, because this workflow begins
with a trigger: it does not do a thing once and stop, it waits. A dot in the toolbar and a
counter in the status bar tell you it is live.

**Now drop a photo into `inbox`.**

Within a second or so the three blocks light up in turn. The status bar counts one run. A smaller
copy appears in `out`, named after your original with `-small` on the end.

Drop three more in and watch it happen three more times. Each file is its own run; the workflow
does not batch them.

Press **Stop** when you have had enough.

### Why there is a short pause before anything happens

The watcher checks the folder about twice a second, and then it waits until the file has stopped
changing size before handing it on. A large photo copied from a network drive appears in the
folder immediately and keeps growing for several seconds afterwards. Handing that to the resizer
gives it half a file, which fails in a way that looks like your workflow's fault. Waiting costs a
fraction of a second and avoids the whole class of problem.

---

## Step 8 — Look at what happened

While it was running, the inspector was showing live values. After it stops, it shows the
**journal** — the record of the run.

Select the resizer and you can see what state it ended in, how long it took, a summary of what
went in and came out, whatever the component logged (it reports the before and after dimensions),
and **every permission request the gate saw, and whether each was allowed or refused**.

The journal describes values rather than quoting them — `image #7`, `text (62 characters)` —
never the contents of your files. A journal is the obvious thing to paste into a bug report, and
that is not somewhere your photographs should end up.

Nothing is written to disk. Close the application and this record is gone; there is no run
history in this build.

---

## Step 9 — Save it

**`Ctrl` + `S`.** You get a single `.encastra` file holding the graph, the settings on each
block, and a version history you can look back through and restore from.

It does not hold your permissions, and it cannot hold a secret. Not "should not" — the place that
would store one does not exist in the format, and a hand-edited file attempting to add one is
refused on open. The honest consequence: a workflow that needs a password or an API token has
nowhere safe to keep it in this build.

---

## When it refuses to run

**A step failed with a refusal.**

```
denied: This component tried to use fs.write and was not allowed: no folder has
been allowed for this node.
Grant this component access to a folder, then run again.
```

You have not granted that step its permission, or you changed the folder afterwards and the grant
no longer matches. Select the step, check the **Permissions** section, press the button again.
This is the system working. Note that the rest of the workflow still ran — steps that depended on
the refused one are marked skipped, with the reason.

**A step says nothing is connected to a port.** A required input has no line going into it. The
application checks before running rather than failing halfway through.

**The connection will not draw.** The types do not fit. Check what each port actually carries —
the labels and colours tell you. Connecting the watcher's `name` (Text) to the resizer's `image`
(Image) will not work, and should not: a filename is not a photograph.

**Nothing happens when you drop a file in.**

- Is it actually watching? The workflow has to be started, and the status bar says whether it is.
- Does the file match **Only these kinds**? A `.gif` will be ignored if you typed `png, jpg,
  jpeg`.
- Is it the right folder? The watcher looks in the folder you named and not in folders inside it.
- Was the file already there before you pressed run? With **Include files already there** off, it
  is ignored by design.

**The result is a PNG when the original was something else.** This build writes PNG, JPEG and
WebP. A GIF or a TIFF comes out as a PNG, and the component says so in its log rather than
producing a file whose extension lies about its contents.

---

## What to change next

The workflow is yours; try breaking it.

- Swap **Resize Image** for **Thumbnail** to get square previews instead.
- Add **Notify** after Save File so you are told each time something is processed. It needs its
  own permission, and you will notice it is a plain **Allow** rather than a folder — there is
  nothing to narrow about a notification.
- Put **Convert Image** between the resizer and Save File to force everything to WebP.
- Take a permission away and run it again, just to watch it refuse properly.

---

# Further topics

**Not written yet.** They are listed so you know what is missing rather than discovering it by
searching. Until they exist, [COMPONENTS](COMPONENTS.md) documents every block these would use.

| Topic | What it would cover |
|---|---|
| Sorting files by type | `Switch`, and routing one file down one of several paths. The **File Organiser** demo does this today and can be read as a worked example |
| Reading and writing spreadsheets | `Read CSV`, `Write CSV`, and what a row looks like as structured data |
| Calling a web API | `HTTP Request`, and why the permission is one address rather than "the internet" |
| Making decisions | `If`, and what happens to the branch that was not taken |
| Running on a schedule | The `Timer` trigger, and how it differs from watching a folder |
| Running from a terminal | The CLI: the same engine, headless, with every permission expressible as a flag. [RUNTIME](RUNTIME.md) §10 covers it today |
| Version history | Looking back at what a workflow used to be, and restoring it |

Two demo workflows ship alongside the one you built and can be opened from **Home**: **File
Organiser** (sorts what lands in a folder into three others by file type) and **Thumbnails**
(turns a folder of images into square previews). Both arrive with their folders deliberately
empty, for the same reason yours did.
