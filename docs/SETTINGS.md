# Settings

What the settings screen is, what every control does, and — the part that took the most
deciding — what deliberately is not a control.

---

## 1. The rule

**Every control writes a real preference.** Nothing on this screen is decorative.

That rule did most of the design work. A settings screen is where a product is most tempted to
look finished: switches are cheap to draw and expensive to honour, and a screen full of them
reads as a mature application until somebody flips one and nothing happens. After that, they
have no reason to trust any of the others — including the ones that work.

So where the honest answer is "there is nothing here to configure", this screen says that as a
statement of fact instead of offering a switch. A short screen that tells the truth is worth
more than a long one that does not.

## 2. Shape

A sidebar of categories on the left; on the right a title, a sentence of context, and settings
grouped into cards. Each setting is a row: a label, one explanatory sentence, and its control.

The organising principle is borrowed from mature desktop applications — categories, grouping,
explanatory text rather than bare labels. None of the visual language is: colours, spacing,
type and controls all come from this product's own tokens in `packages/ui/src/tokens.css`.

Nine categories: **General**, **Workspace**, **Editor**, **Runtime**, **Components**,
**Security**, **Privacy**, **Advanced**, **About**.

The sidebar is keyboard navigable — Tab to reach it, then arrow keys, Home and End to move
within it, which is the roving-focus pattern a list of choices is supposed to use.

## 3. Every control, and what it writes

Preferences live in `apps/desktop/src/preferences.ts` and persist to `localStorage`.

| Category | Control | Writes |
|---|---|---|
| General | Theme (system / light / dark) | `theme` |
| General | Motion (follow system / reduced) | `motion` |
| General | Show the welcome again | `welcomeSeen = false` |
| Workspace | Default project folder, with a picker | `projectFolder` |
| Workspace | On startup (home / last project) | `startup` |
| Editor | Show the grid | `showGrid` |
| Editor | Snap to grid | `snapToGrid` |
| Editor | Show the minimap | `showMinimap` |
| Runtime | Open the run panel when a workflow starts | `openRunPanelOnRun` |
| Advanced | Developer mode | `developerMode` |
| Advanced | Reset all settings | restores every default |

`theme` and `motion` are pushed onto the document element, where the token file reads them.
`motion` only ever moves *towards* less motion: the default follows the system preference, and
the override exists for somebody who has not set one system-wide but still wants transitions
off.

## 4. What is deliberately not a control

Each of these would have been a plausible switch. Each is a statement instead, because the
switch would have been a lie.

| In the screen | Why it is not a control |
|---|---|
| **Telemetry** | None is collected. There is no server, no account and no endpoint to send it to. An "off" switch would imply it could be turned on. |
| **Crash reports** | None are collected or sent. Same reasoning. |
| **Analytics** | None. Same reasoning. |
| **Automatic updates** | There is no update channel in this build. Updating means downloading a new installer. A toggle would promise a mechanism that does not exist. |
| **Code signing** | The build is **not signed**, and Settings says so rather than staying quiet about it. |
| **Install a third-party component** | The WebAssembly sandbox is designed and not built, so no third-party component can be installed — or executed at all. Shown as visibly inert. |
| **Account, plan, subscription** | There are no accounts. There is nothing to sign in to. |

## 5. Status

The status block is small and every line of it is derived rather than written:

- **Runtime** — ready or not attached, from whether a runtime is actually attached.
- **Component protocol** — the schema number the build reports.
- **Project format** — the schema number the build reports.
- **Installed components** — counted from the loaded manifests. Never a number typed into the
  interface, so it cannot drift from what is actually installed.
- **Updates** — the honest line from §4.

## 6. About

The mark, the product name, the one-line description, the version, and the three schema numbers
that travel beside it. Links onward to the real documents rather than restating them.

The version comes from the build — `CARGO_PKG_VERSION` — not from anything typed into the
interface, which is what makes it impossible for the About screen to disagree with the binary it
is part of. `Cargo.toml` is the single source and `tests/version.test.ts` fails if any of the six
files that must carry it drift apart.

## 7. What it does not do yet

- **Settings are per machine, not per project.** A project does not carry its own preferences.
- **Nothing is synchronised.** There is no account, so there is nowhere to sync to.
- **There is no import or export.** Preferences live in browser storage in the application's own
  origin; moving them between machines means setting them again.

Writing this document is what caught the one control that broke §1: **On startup** stored
`last-project` and nothing read it. It is now wired — opening or saving a project records its
path, and start-up reopens it when the preference asks. A project that has since been moved or
deleted is a perfectly ordinary thing to find at start-up, so that failure is quiet: the path is
forgotten and Home is shown, rather than greeting somebody with an error about a file they did
not ask for.
