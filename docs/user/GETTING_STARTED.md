# Getting started with Encastra 0.5.0-rc.6

This guide is for someone who has never used Encastra. It covers what the application is, how to
check and install it, a first workflow from an empty canvas, where your data ends up, how to
remove it, and how to report a problem.

0.5.0-rc.6 is a **release candidate**, not a finished release. Where something is not built, this
guide says "Not built". It does not guess when it will be.

---

## 1. What Encastra is

Encastra is a Windows desktop application for building small automated jobs out of ready-made
parts called components. You place components on a canvas, connect the output of one to the input
of the next, and press **Run**. A job can make a smaller copy of a photo, sort files into folders
by type, or turn a CSV file into structured data. Everything runs on your computer. There is no
account, no server and no AI deciding anything. A component can only touch the folders and web
addresses you allow it, one step at a time.

---

## 2. System requirements

| | |
|---|---|
| Operating system | Windows 10 or 11, 64-bit (x64). No macOS or Linux build: Not built. |
| WebView2 runtime | Required. Windows 11 includes it. If a Windows 10 machine does not have it, install Microsoft's Evergreen WebView2 Runtime from Microsoft before installing Encastra. |
| Disk | About 25 MB once installed, plus whatever your own workflows write. |
| Network | Not needed to run a workflow. |
| Administrator rights | Not needed. The installer installs for the current user only. |

Sources: `apps/web/src/config/site.ts` (`REQUIREMENTS`), `docs/RELEASE.md`,
`docs/adr/0009-windows-msvc-toolchain.md`.

This candidate's clean-machine acceptance runs on Windows 11. Windows 10 is listed as supported,
but no Windows 10 machine is part of that test.

---

## 3. Download and verify the installer

Releases are published on the repository's Releases page:
<https://github.com/alexlincai123-sketch/encastra/releases>. As of 2026-09-26, 0.5.0-rc.6 has been
built but **not yet published** there. The owner publishes it after the remaining checks in
`docs/release/RELEASE_READINESS.md` pass.

The file you want is:

| File | Size | SHA-256 |
|---|---|---|
| `Encastra_0.5.0-rc.6_x64-setup.exe` | 3.5 MB | `9ddaeef3e6814cebf57c5836047023217732baa40780591c448192a42bca8e56` |

Before you run it, open PowerShell in the folder you downloaded it to and run:

```powershell
Get-FileHash .\Encastra_0.5.0-rc.6_x64-setup.exe -Algorithm SHA256
Get-AuthenticodeSignature .\Encastra_0.5.0-rc.6_x64-setup.exe
```

The first line has to print the same hash as the table above, character for character. If it
doesn't, don't run the file.

The second line reports that the file is **not signed**. That is expected. This build is not
code-signed, so nothing inside the file proves who made it. The hash is what you have instead. It
proves the file was not changed between the publisher and you. It doesn't prove who the publisher
is, and it is only as trustworthy as the page you read it from.

### The Windows SmartScreen warning

Because the installer is unsigned, Windows SmartScreen will probably stop it with a blue dialog
titled **"Windows protected your PC"** that names an unknown publisher. **That warning is
accurate.** Continue only if the hash matched:

1. Click **More info** in the dialog.
2. Check that the file name shown is `Encastra_0.5.0-rc.6_x64-setup.exe`.
3. Click **Run anyway**.

Those are Windows' own words, not Encastra's. How a downloaded copy of this exact build appears
under SmartScreen has not been recorded yet (`docs/release/RELEASE_READINESS.md`), so what you
see may differ slightly. Your browser may also warn when the download finishes. The same reasoning
applies there.

---

## 4. Install

Run the installer and follow its steps. It installs **for your user account only** and does not
ask for administrator rights. Nothing is written to `Program Files` or to the machine-wide
registry.

| What | Where |
|---|---|
| The application | `%LOCALAPPDATA%\Encastra\encastra-desktop.exe` |
| Uninstaller | `%LOCALAPPDATA%\Encastra\uninstall.exe` |
| Start menu shortcut | **Encastra** |

The program file keeps the name `encastra-desktop.exe`. The installed copy won't match the
hash of `encastra-desktop.exe` published in `docs/RELEASE.md`. The installer changes three bytes
inside it on purpose, so verify the installer rather than the installed program.

For scripted installs, `Encastra_0.5.0-rc.6_x64-setup.exe /S` installs silently.

---

## 5. First launch

The first time Encastra opens, it shows a dialog titled **Welcome to Encastra** with three
choices:

- **Create your first workflow** ("A short guided run through, about a minute"). This opens the
  Builder and shows seven short cards that walk you through a workflow that watches a folder and
  shrinks the images that land in it. Each card waits until you have done the step it describes.
  **Close** leaves the tour at any point.
- **Explore a sample** ("Image Processor, already built — you choose its folders"). This opens a
  finished sample with its folders left empty on purpose. You pick them.
- **Skip** ("Go straight in. This is in Settings if you want it later."). You can also press
  Escape.

Whatever you choose, the welcome is not shown again. To see it again, go to **Settings →
General** and press **Show the welcome again**.

The left sidebar has six sections:

| Section | What it is for |
|---|---|
| **Home** | Start a **New workflow**, **Open** a `.encastra` file, **Open from your library**, **Browse components**, or open one of the **Samples** |
| **Builder** | The editor: the **Components** palette on the left, the canvas in the middle, the inspector on the right, the toolbar on top |
| **Library** | Every project you saved, imported or prepared on this machine. A list, not a copy |
| **Components** | Every installed component, what it takes, what it gives, and what it can reach |
| **Security** | What the open workflow has been allowed, the privacy facts, and **What this does not protect against** |
| **Settings** | Language, theme, shortcuts, diagnostics and version information |

---

## 6. Your first workflow: a smaller copy of a photo

This workflow reads a photo you pick, resizes it, and saves the result in a folder you choose. It
uses two built-in components, **Resize Image** and **Save File**, and asks for one permission.

**Before you start:**

- Have a `.png` or `.jpg` photo ready.
- Make a new, empty folder for the results, for example `Documents\encastra-out`. Save File never
  replaces a file that already exists. An empty folder means the first run can't be stopped by a
  name clash.

### Step 1 — An empty canvas

On **Home**, choose **New workflow**. The Builder opens and the canvas says **Your canvas is
empty**.

### Step 2 — Add the two components

In the **Components** palette on the left:

1. Under **Media**, drag **Resize Image** onto the canvas. You can also click it, which places it
   on the canvas.
2. Under **Files**, drag **Save File** onto the canvas to the right of it. If you clicked instead
   of dragging, the second component lands on top of the first, so drag it aside.

Each palette entry says what the component will ask for. Save File shows **Asks to: writes files**.
Resize Image asks for nothing beyond the image you give it.

### Step 3 — Connect them

Inputs are on the left side of a component and outputs are on the right. Drag from the **image**
output of Resize Image to the **file** input of Save File. A line appears.

This connection always works: every image is a file. If you try to connect two things that can
never fit, the canvas refuses and says why, for example **A step cannot feed itself.**

### Step 4 — Configure Resize Image

Click **Resize Image**. The inspector on the right shows its **Settings**:

1. Set the width to `800` and leave the height at `0`. Zero means "work it out from the other
   side", so the proportions are kept. If you leave both at `0`, the step fails with
   **Something this step has to be told is not set.**
2. Under **Starting material**, press **Choose…** and pick your photo. This section appears
   because nothing in the workflow feeds Resize Image's input, so the run needs a file from you.

The **Permissions** section says: **This component asks for nothing. It works only on what the
graph hands it, and it cannot reach your files, the network or the clipboard.**

Resize Image doesn't make an image larger than it already is unless you turn that on in its
settings. A photo narrower than 800 pixels comes out the same size.

### Step 5 — Configure Save File and allow its folder

Click **Save File**:

1. In **Settings**, press **Choose…** next to the folder field and pick your empty results
   folder. Use the button rather than typing a path. Encastra only allows a folder you picked
   in the Windows folder chooser.
2. Optional: in the setting that adds text to the name, type `-small`. `photo.jpg` is then saved
   as `photo-small.jpg`. Without it, the copy keeps the original name.
3. In **Permissions**, the `fs.write` entry explains what it wants. Press **Allow this folder**.
   Until a folder is chosen the button is unavailable and the panel says **Choose a folder
   first.** Once pressed, the button reads **Allowed**.

Below the button the inspector says how long that answer lasts: **Allowed while this project is
open. Every run uses exactly this folder or address, and closing or switching projects forgets
it.** Permissions are never saved into the project file. Someone you send the project to has to
allow the folder themselves.

### Step 6 — Run it

Press **Run** in the toolbar, or **Ctrl+Enter**. You can press **Check** first to validate
without running.

The **Run** panel lists each step with its status. When both show **Finished**, open your
results folder: the smaller copy is there.

Click either step to see its **Last run** record in the inspector: **Status**, **Took**, what went
**in** and **out**, **Permissions used**, and **Logs**. Resize Image logs the size before and
after. The record describes values, never the contents of your files. It is kept only while the
window is open.

### Step 7 — Save the project

Press **Save** in the toolbar (or **Ctrl+S**) and choose a name and folder. The status bar says
**Saved. 1 version kept.** Each save keeps a version, which you can see and restore under
**Versions** in the inspector when no step is selected. The project is also added to your
**Library**.

### If it doesn't work

| What you see | What to do |
|---|---|
| **This step asked for something it was not allowed to do. Grant it in the permissions for this step, then run again.** | Select Save File and check that **Permissions** says **Allowed**. If you changed the folder after allowing it, allow it again. If it already says **Allowed**, a file with the same name is probably already in the results folder. Save File never replaces a file. Delete or move the old copy, or use `-small` or another suffix. |
| **Choose the file for … with the Choose button before running. Nothing ran.** | Select Resize Image and pick the photo under **Starting material**. |
| **That file could not be read as an image. Check that what is connected really is one.** | The file you picked is not an image this build can open. |
| **That folder cannot be used (…).** after pressing **Choose…** | Encastra refuses some folders outright: a drive root, Windows and program folders, your user folder itself, and the Startup folder. Pick a folder inside them, such as one in Documents. |

---

## 7. Samples to try next

On **Home**, under **Samples**, there are three ready-made workflows. Each one needs you to pick
its folders before it can start:

- **Image Processor**: watches a folder, and whenever an image appears it makes a smaller copy in
  another folder.
- **File Organiser**: watches a folder and moves what lands in it into one of three others, by
  file type.
- **Thumbnails**: turns a folder of images into square previews.

These start with a trigger (**Watch Folder**), so the toolbar button reads **Start watching**
instead of **Run**. While it is active it shows **Watching**. Drop files into the watched folder
and each one becomes its own run. Press **Stop** when you are done.

---

## 8. Where your work is saved

- **Projects** are single `.encastra` files, saved wherever you choose. Each one holds the
  workflow, each step's settings and the version history. A project never holds a password or
  API token: there is no field for one. Storing secrets safely (a keystore): Not built.
- **Permissions** are not saved anywhere. They last while the project is open and are forgotten
  when you close Encastra or switch projects.
- **Your library** is an index at `%APPDATA%\dev.encastra.app\library\library.json`. For each
  project it records the path, name, timestamps, size and a content hash. It is a record, not a
  copy. Publications you import are copied into `%APPDATA%\dev.encastra.app\library\imports\`.
- **Preferences** (language, theme, whether you have seen the welcome) are kept in the WebView2
  profile under `%LOCALAPPDATA%\dev.encastra.app\`.
- **Run records and logs** are never written to disk. Closing the window discards them.

To set where the save dialog opens, go to **Settings → Projects → Default project folder**.

---

## 9. Language

Encastra's interface is available in six languages: English, Spanish, French, German, Italian and
Portuguese. On first start it follows your Windows display language if it is one of these, and
uses English otherwise.

To change it, go to **Settings → Language & Region → Interface language**. Dates, times and numbers
follow the language you pick. Any text not yet translated falls back to English.

---

## 10. Updating

There is **no automatic update** and no update check. Updates as a mechanism: Not built. To move
to a newer version, download its installer, verify its hash the same way as in §3, and run it
over the existing installation. The installer does not remove your projects, library or
preferences. For this candidate, the clean-machine upgrade test from 0.5.0-rc.5 is still pending
(`docs/release/RELEASE_READINESS.md`).

To see which version you are running, go to **Settings → About → This build**. It also shows
**Signing: Not signed**.

---

## 11. Uninstall, and what stays behind

Uninstall from **Windows Settings → Apps → Installed apps → Encastra → Uninstall**, or run
`%LOCALAPPDATA%\Encastra\uninstall.exe`. This removes the program folder, the Start menu shortcut
and the uninstall entry.

**By default it leaves your data in place:**

| Left behind | What it is |
|---|---|
| Your `.encastra` files | Wherever you saved them. The uninstaller never touches them |
| `%APPDATA%\dev.encastra.app\` | The library index (`library\library.json`) and copies of imported publications (`library\imports\`) |
| `%LOCALAPPDATA%\dev.encastra.app\` | The WebView2 profile: cache and interface preferences |

If you install Encastra again later, it picks these up. When you uninstall interactively, the
uninstaller offers a checkbox to delete the application's data. It is **unticked by default**.
Tick it to remove the two `dev.encastra.app` folders too. A silent uninstall (`/S`) always keeps
them. You can also delete the two folders by hand after uninstalling. Your `.encastra` files are
only removed if you delete them yourself.

---

## 12. Privacy

- **No telemetry, no crash reports, no usage analytics.** Nothing is collected and nothing is
  sent. There is no off switch because there is nothing to turn off.
- **No account and no server.** There is no sign-in.
- **No network unless you allow it.** Encastra has no updater and no telemetry, so its own code
  makes no network connections. Only a workflow step you added and allowed can reach the network.
  Today that is the **HTTP Request** component, and only for the one host you allowed. Its
  button reads **Allow** followed by the host name. It uses https unless you turn on
  "Allow plain http", and it doesn't follow redirects. The WebView2 runtime is a Windows component
  that Microsoft maintains and updates separately from Encastra.
- **Your files stay on this machine** unless a workflow you built sends them somewhere.

The **Security** section of the application and **Settings → Privacy** state the same things.
**What this does not protect against** on the Security screen lists the limits. For example, a
component you give broad access to can misuse that access, and this build has had no external
security audit. Encastra does not claim to make you completely safe. It limits what each step
can reach and shows you what was used.

---

## 13. Reporting a problem

**Bugs, questions and feedback:** open an issue on the repository:
<https://github.com/alexlincai123-sketch/encastra/issues>. You need a GitHub account. This is a
small project with no support team, so expect replies in days, not hours.

To include your version and machine details, go to **Settings → Diagnostics** and press **Copy**
(or **Export…** to save a text file), then paste it into the issue. That report contains no
project path, preference value or token. Say what you did, what you expected, and what happened.
If a project file shows the problem and it contains nothing private, attach it.

**Security problems:** don't open a public issue. Report privately through GitHub's private
vulnerability reporting:
<https://github.com/alexlincai123-sketch/encastra/security/advisories/new>. There is no security
email address. `SECURITY.md` in the repository says what is in scope and what is already known.
There is no bug bounty.

---

## What is not built in this release

So you don't go looking for it: third-party components (the WebAssembly sandbox they would run in
is designed but not built), code signing, automatic updates, secure storage for passwords and
tokens, macOS and Linux builds, accounts, a registry or marketplace to publish to, and payments.
Each is Not built.
