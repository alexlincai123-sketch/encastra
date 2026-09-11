# Components

Every part you have: **nineteen components and two triggers**. This is the whole set — there is
no way to install any others, because the ability to run a stranger's component safely is
designed and not built. See [§ What you cannot add](#what-you-cannot-add-yet) at the end.

Each entry states what the component is for, what goes in and comes out, what you can configure,
and **what it can reach**. That last one is the interesting column. Seven of the nineteen can
reach nothing at all — no files, no network, nothing — and that is worth saying plainly, because
a component that cannot reach anything is a component that cannot do anything to you.

The wording of each permission below is the wording the application shows you when it asks.
They are the same string; there is a test that requires every reason to be a real sentence a
person could weigh, because "required" is not something anybody can consent to.

**How to read the tables.** Ports marked *required* must have something connected before the
workflow will run. Types are explained in [CONCEPTS](CONCEPTS.md#a-type-says-what-kind-of-thing-a-port-carries).

---

## Contents

- [Triggers](#triggers) — 2
- [Files](#files) — 5
- [Images](#images) — 4
- [Data](#data) — 4
- [Flow](#flow) — 3
- [System](#system) — 2
- [Network](#network) — 1

---

## Triggers

A trigger starts a workflow rather than being a step inside it. It has no inputs, and it fires
repeatedly: one run of the whole workflow per event.

### Watch Folder

`encastra.file.watch` · Starts the workflow whenever a file appears in a folder.

| Outputs | Type | |
|---|---|---|
| `file` | File | The new file |
| `name` | Text | Its name, e.g. `photo.png` |
| `extension` | Text | Its extension, lower-cased, e.g. `png` |

| Configuration | |
|---|---|
| **Watch this folder** *(required)* | Only this folder, not the ones inside it |
| **Only these kinds** | A comma-separated list, e.g. `png, jpg, jpeg`. Empty means every file |
| **Include files already there** | Off by default, so starting a workflow does not immediately process a folder full of old files |

**Can reach:** `fs.read` — *"Watches the folder you pick and reads the files that appear in it."*
Scoped to that one folder.

It checks the folder roughly twice a second and waits until a file has stopped changing size
before handing it on, so a large file still being copied in is never passed along half-written.
A file that changes again later counts as a new event, which is what makes "save over the top"
behave the way people expect.

### Timer

`encastra.system.timer` · Starts the workflow again and again, on a schedule.

| Outputs | Type | |
|---|---|---|
| `count` | Integer | How many times it has fired so far |

| Configuration | |
|---|---|
| **Every** *(required)* | In seconds, from 1 to 86,400. The first run happens straight away |

**Can reach: nothing.** A timer is a clock. It needs no permission and is never able to touch
anything on its own — whatever the workflow does afterwards asks for itself.

---

## Files

The components that produce a file write into the run's own scratch space, which needs no
permission because it is not anywhere you can see. The components that put a file somewhere you
*will* find it are the ones that ask.

### Read File

`encastra.file.read` · Reads the text content of the file connected to it.

| | Port | Type | |
|---|---|---|---|
| In | `file` | File *(required)* | |
| Out | `text` | Text | The contents |
| Out | `name` | Text | The file's name |

**Can reach:** `fs.read` — *"Reads the file you connect to this node, and nothing else."*

Scoped to input handles, which means **you are never asked about it**. It can read what the
workflow handed it and has no way to name anything else, so there is no decision to make that you
did not already make by drawing the connection.

### Write File

`encastra.file.write` · Saves text into a file in a folder you choose.

| | Port | Type | |
|---|---|---|---|
| In | `content` | Text *(required)* | |
| Out | `saved` | Boolean | Whether it worked |
| Out | `file` | File | The file that was written |

| Configuration | |
|---|---|
| **Folder** *(required)* | Where to save. You are asked to allow this folder before the first run |
| **File name** *(required)* | |

**Can reach:** `fs.write` — *"Saves the result into the folder you pick. It cannot write anywhere
else."*

### Save File

`encastra.file.save` · Puts a file into a folder you choose. Keeps the original name unless you
give one.

| | Port | Type | |
|---|---|---|---|
| In | `file` | File *(required)* | |
| Out | `file` | File | The saved file |

| Configuration | |
|---|---|
| **Folder** *(required)* | Where to save. You are asked to allow this folder before the first run |
| **File name** | Leave empty to keep the name the file already has |
| **Add to the name** | Appended before the extension, so `photo.png` becomes `photo-small.png` |

**Can reach:** `fs.write` — *"Saves the file into the folder you pick. It cannot write anywhere
else."*

This is the block that turns a result into something you can find. In most workflows it is the
only step that touches your disk, which is precisely why it is separate from the components that
do the actual work.

### Move File

`encastra.file.move` · Moves a file into another folder. The original is removed.

| | Port | Type | |
|---|---|---|---|
| In | `file` | File *(required)* | |
| Out | `file` | File | The moved file |

| Configuration | |
|---|---|
| **Move into** *(required)* | Both this folder and the one the file comes from must be allowed, because a move deletes the original |
| **New name** | Leave empty to keep the name it already has |

**Can reach:** `fs.write` — *"Moves the file, which means writing it to the new folder and
deleting it from the old one."*

It asks for the ability to write rather than something gentler because a move destroys a name,
and the sentence you are shown says so rather than glossing it.

### Rename File

`encastra.file.rename` · Gives a file a new name, leaving it where it is.

| | Port | Type | |
|---|---|---|---|
| In | `file` | File *(required)* | |
| In | `name` | Text | A new name. Overrides the pattern when connected |
| Out | `file` | File | The renamed file |

| Configuration | |
|---|---|
| **Folder** *(required)* | The folder the file is in. It must be allowed, because renaming removes the old name |
| **Name pattern** | Use `{name}` for the current name without its extension and `{ext}` for the extension |

**Can reach:** `fs.write` — *"Renames a file in the folder you pick, which means writing the new
name and removing the old one."*

You need either a pattern or something connected to `name`; with neither, the step stops and says
so.

---

## Images

All four read an image and — where they produce one — write the result into the run's scratch
space. **None of them writes anywhere you can see.** That is [Save File](#save-file)'s job, and it
is the step that asks. The consequence is worth noticing the first time you build something: the
block doing the actual work on your photograph never needed a permission decision.

The decoder and its limits live in one place, so a file that is too large or claims an impossible
size is refused identically whichever of these you asked.

This build writes **PNG, JPEG and WebP**. An input in another format comes out as a PNG, and the
component logs that it did rather than producing a file whose extension lies.

### Resize Image

`encastra.image.resize` · Changes an image's size. Leave one side empty to keep the proportions.

| | Port | Type | |
|---|---|---|---|
| In | `image` | Image *(required)* | |
| Out | `image` | Image | The resized result |
| Out | `width` | Integer | What it came out at |
| Out | `height` | Integer | |

| Configuration | |
|---|---|
| **Width** | 0–20000. Leave at 0 to work it out from the height |
| **Height** | 0–20000. Leave at 0 to work it out from the width |
| **Fit** | `contain` fits inside the box · `cover` fills it and crops · `stretch` distorts |
| **JPEG quality** | 1–100 |

Setting both sides to 0 is an error, and it says which setting to change.

**Can reach:** `fs.read` — *"Reads the image you connect to this node, and nothing else."* Scoped
to input handles, so you are not asked.

### Convert Image

`encastra.image.convert` · Writes an image in a different format.

| | Port | Type | |
|---|---|---|---|
| In | `image` | Image *(required)* | |
| Out | `image` | Image | The converted result |

| Configuration | |
|---|---|
| **Format** *(required)* | `png`, `jpeg` or `webp` |
| **JPEG quality** | 1–100. Ignored by PNG and WebP, which are written without loss here |

**Can reach:** `fs.read` — *"Reads the image you connect to this node, and nothing else."* Not
asked.

### Thumbnail

`encastra.image.thumbnail` · Makes a small square preview of an image.

| | Port | Type | |
|---|---|---|---|
| In | `image` | Image *(required)* | |
| Out | `image` | Image | The thumbnail |

| Configuration | |
|---|---|
| **Size** | 16–2048. The width and height of the square, in pixels |
| **JPEG quality** | 1–100 |

It crops rather than padding, because a grid of thumbnails with differently-shaped gaps looks
broken, and cropping is what people mean by the word. The result is named after the original with
`-thumb` added.

**Can reach:** `fs.read` — *"Reads the image you connect to this node, and nothing else."* Not
asked.

### Image Info

`encastra.image.info` · Reports an image's size and format without changing it.

| | Port | Type | |
|---|---|---|---|
| In | `image` | Image *(required)* | |
| Out | `width` | Integer | |
| Out | `height` | Integer | |
| Out | `format` | Text | |
| Out | `info` | JSON | All of the above together, plus the size in bytes |

It reads only the header, so an enormous image can be described without being decoded.

**Can reach:** `fs.read` — *"Reads the image you connect to this node, and nothing else."* Not
asked.

---

## Data

**All four can reach nothing.** No files, no network, no clipboard, no notifications. They take a
value in and give a value back, and that is the entire extent of what they are able to do. This
is why you can compose them freely without thinking about it: there is no question to ask,
because there is nothing they could do wrong.

### Parse JSON

`encastra.data.json` · Turns text into structured data.

| | Port | Type | |
|---|---|---|---|
| In | `text` | Text *(required)* | |
| Out | `json` | JSON | |

Malformed input fails with the line and column of the problem.

**Can reach: nothing.**

### Write JSON

`encastra.data.json.write` · Turns structured data back into text.

| | Port | Type | |
|---|---|---|---|
| In | `json` | JSON *(required)* | |
| Out | `text` | Text | |

| Configuration | |
|---|---|
| **Readable** | On by default. Lay it out over several lines instead of one |

**Can reach: nothing.**

### Read CSV

`encastra.data.csv.read` · Turns comma-separated text into a list of rows.

| | Port | Type | |
|---|---|---|---|
| In | `text` | Text *(required)* | |
| Out | `rows` | JSON | The rows |
| Out | `count` | Integer | How many |

| Configuration | |
|---|---|
| **First row is a header** | On by default. With it on, each row comes out with named fields; with it off, each row is a plain list |
| **Separator** | One character. Defaults to a comma; use a semicolon or a tab if that is what the file has |

A row with the wrong number of columns is kept and mentioned in the log. That is a fact about the
file rather than a reason to abandon the run.

**Can reach: nothing.**

### Write CSV

`encastra.data.csv.write` · Turns a list of rows into comma-separated text.

| | Port | Type | |
|---|---|---|---|
| In | `rows` | JSON *(required)* | |
| Out | `text` | Text | |

| Configuration | |
|---|---|
| **Write a header row** | On by default |
| **Separator** | One character |

Column order is taken from the first row and then held fixed, so the columns line up.

**Can reach: nothing.**

---

## Flow

Deciding what happens next. **All three can reach nothing.**

A path that was not chosen produces *absence* rather than an empty value — not a zero, not an
empty string. Absence survives every conversion, so a branch nobody took cannot quietly turn into
a plausible-looking value further down. A step whose required input is absent is skipped rather
than run on nothing.

### If

`encastra.flow.if` · Sends the value one way or the other depending on a condition.

| | Port | Type | |
|---|---|---|---|
| In | `condition` | Boolean *(required)* | |
| In | `value` | JSON *(required)* | What to send |
| Out | `then` | JSON, possibly absent | Taken when the condition is true |
| Out | `else` | JSON, possibly absent | Taken when it is false |

**Can reach: nothing.**

### Switch

`encastra.flow.switch` · Sends the value down one of several routes depending on a word.

| | Port | Type | |
|---|---|---|---|
| In | `match` | Text *(required)* | Compared against each route's list, ignoring capitals |
| In | `value` | JSON *(required)* | What travels along the chosen route |
| Out | `a` `b` `c` | JSON, possibly absent | Routes A, B and C |
| Out | `other` | JSON, possibly absent | Anything that matched none of them |

| Configuration | |
|---|---|
| **Route A / B / C matches** | A list separated by commas, e.g. `png, jpg, jpeg, webp` |

The first matching route wins. Overlapping lists are a mistake in the configuration rather than a
reason to send one value down two paths, which would run the rest of the workflow twice.

**Can reach: nothing.**

### Delay

`encastra.flow.delay` · Waits, then passes the value on unchanged.

| | Port | Type | |
|---|---|---|---|
| In | `value` | JSON *(required)* | |
| Out | `value` | JSON | The same value |

| Configuration | |
|---|---|
| **Wait for** *(required)* | In seconds, 0–3600. Stopping the run interrupts the wait |

It wakes frequently to check whether you have pressed stop, so an hour-long wait is genuinely
stoppable. A wait you cannot interrupt is the sort of thing that makes people close an
application instead of trusting it.

**Can reach: nothing.**

---

## System

Both of these ask, and both are refused without an answer — including when the refusal is
inconvenient. That is the point: a permission prompt is only honest if "no" actually stops
something.

### Notify

`encastra.system.notify` · Shows a message when this step runs.

| | Port | Type | |
|---|---|---|---|
| In | `message` | Text *(required)* | |
| Out | `message` | Text | What was shown |

| Configuration | |
|---|---|
| **Title** | Defaults to `Encastra` |

**Can reach:** `system.notify` — *"Shows a notification on your desktop when this step runs."*

A plain yes-or-no, because there is nothing to narrow. The runtime does not draw the notification
itself: it records the request, and whichever part of the product has a screen delivers it — the
desktop application shows it, the CLI prints it.

### Copy to Clipboard

`encastra.system.clipboard` · Puts text on the clipboard, ready to paste.

| | Port | Type | |
|---|---|---|---|
| In | `text` | Text *(required)* | |
| Out | `text` | Text | What was copied |

**Can reach:** `system.clipboard` — *"Replaces whatever is currently on your clipboard with this
text."*

The reason says *replaces* because that is what happens to whatever was there. What gets written
to the run's record is the number of characters, never the text — a clipboard is exactly the sort
of place a password passes through.

---

## Network

### HTTP Request

`encastra.net.http` · Fetches a web address, or sends data to one.

| | Port | Type | |
|---|---|---|---|
| In | `body` | Text | Sent with POST, PUT and PATCH. Ignored by GET |
| Out | `body` | Text | The response |
| Out | `status` | Integer | The status code |
| Out | `ok` | Boolean | Whether the status was a success |

| Configuration | |
|---|---|
| **Address** *(required)* | Must be https unless you allow plain http below |
| **Method** | `GET`, `POST`, `PUT`, `PATCH` or `DELETE` |
| **Content type** | For example `application/json` |
| **Allow plain http** | Off by default. Plain http can be read and changed in transit |

**Can reach:** `net.http` — *"Contacts the specific web addresses you allow, and no others."*

This is where the permission model earns its keep, so it is worth reading the detail:

- The grant is **one host**, taken from the address on the step. Allowing `api.example.com` allows
  `api.example.com`. There is no wildcard, and **an empty list of allowed hosts means no hosts,
  not all of them**.
- **Redirects are not followed.** A server you allowed could otherwise hand back a redirect
  pointing anywhere — including an address inside your own machine — and "allowed hosts" would
  stop meaning anything.
- Responses above **16 MB** are refused, and a request that takes longer than **30 seconds** is
  stopped.
- An address with a username and password in it is refused outright, because those would end up in
  the run's record and in the prompt you are shown.
- A 404 or a 500 is an *answer*, not a failure: the step succeeds and reports the status, and the
  workflow decides what to make of it. "The server said 404" is frequently the useful result.

A non-2xx status leaves the `body` output empty; use `status` and `ok` to decide what happens
next.

---

## The full permission map

Every component, and what it is able to reach. Seven ask for nothing.

| Component | Asks for | Are you asked? |
|---|---|---|
| Read File | `fs.read` | No — only what the workflow handed it |
| Resize Image · Convert Image · Thumbnail · Image Info | `fs.read` | No — only what the workflow handed it |
| Write File · Save File · Move File · Rename File | `fs.write` | **Yes** — one folder you choose |
| Watch Folder *(trigger)* | `fs.read` | **Yes** — one folder you choose |
| HTTP Request | `net.http` | **Yes** — the one address on the step |
| Notify | `system.notify` | **Yes** — a plain yes or no |
| Copy to Clipboard | `system.clipboard` | **Yes** — a plain yes or no |
| Parse JSON · Write JSON · Read CSV · Write CSV | nothing | — |
| If · Switch · Delay | nothing | — |
| Timer *(trigger)* | nothing | — |

This table is also a test. The same list exists in the source, and it fails the build if any
component's declared reach changes or a new component appears without being added deliberately.
Widening what something can touch is a visible edit rather than a line buried in a manifest.

---

## What you cannot add — yet

Three things are worth stating plainly, because their absence shapes what the set is.

**You cannot install components.** There is no marketplace, no registry, no accounts, and no
mechanism to load a component from anywhere. The design for executing a stranger's code safely —
as WebAssembly, holding nothing but the capabilities you granted — is written down in
[ADR-0001](adr/0001-wasm-component-model-for-third-party-code.md) and specified in
[COMPONENT-SDK](COMPONENT-SDK.md), and none of it is built. The honest reason nothing is exposed
by that gap is that nothing third-party can run at all.

**Some components were considered and deliberately left out.**

- **Launch Application.** Running another program has the worst blast radius of any permission
  there is. There is no `process.*` capability in this build — not denied, *absent*: the manifest
  validator holds an allowlist of the five kinds that exist and refuses anything else, so no
  manifest can smuggle one in and no permission prompt can ever be made to offer you one.
- **Video Information.** Reading a video container's metadata honestly needs a parser this build
  does not have, and the shortcut would need the permission above. A component that returned
  guesses would be worse than no component at all.
- **A webhook listener.** Receiving a request means listening on a port, which is a different
  security question from making one.

**The components you do have are ordinary native code.** They are compiled into the application
and constrained by what they declared — the same gate, with no faster path for being
first-party — but they are not sandboxed from the operating system the way a third-party
component would need to be. The set is small precisely because everything in it is part of what
you are trusting.

For the reference underneath: [SECURITY](SECURITY.md) §7 and §9 · [COMPONENT-SDK](COMPONENT-SDK.md)
for the manifest format · [RUNTIME](RUNTIME.md) for how a run executes.
