# Settings

What the settings screen is, what every control does, and — the part that took the most
deciding — what deliberately is not a control.

---

## 1. The rule

**Every control writes a real preference that something actually reads.** Nothing on this screen
is decorative.

That rule did most of the design work. A settings screen is where a product is most tempted to
look finished: switches are cheap to draw and expensive to honour, and a screen full of them
reads as a mature application until somebody flips one and nothing happens. After that, they
have no reason to trust any of the others — including the ones that work.

So where the honest answer is "there is nothing here to configure", this screen says that as a
statement of fact instead of offering a switch. A short screen that tells the truth is worth more
than a long one that does not.

The rule has teeth. Writing the 0.2 version of this document caught **On startup**, which stored
a value nothing read; it was wired rather than explained away. The 0.3 pass caught
`openRunPanelOnRun` the same way, and that too is now read — turned off, the run panel stays out
of the way until there is something to report.

## 2. Shape

A sidebar of categories on the left; on the right a title, a sentence of context, and settings
grouped into cards. Each setting is a row: a label, one explanatory sentence, and its control.

The organising principle is borrowed from mature desktop applications — categories, grouping,
explanatory text rather than bare labels. None of the visual language is: colours, spacing, type
and controls all come from this product's own tokens in `packages/ui/src/tokens.css`.

Eighteen categories: **General · Appearance · Language & Region · Workspace · Projects · Editor ·
Canvas · Runtime · Components · Security · Privacy · Notifications · Files · Updates · Account ·
Developer · Diagnostics · About**.

Not every category is full of options, and that is the point — the architecture is complete, and
where a section has nothing to configure it says why rather than being hidden.

The sidebar is keyboard navigable: Tab to reach it, then arrows, Home and End within it, which
is the roving-focus pattern a list of choices is supposed to use.

## 3. Every control, and what it writes

| Category | Control | Writes |
|---|---|---|
| General | Show the welcome again | `welcomeSeen = false` |
| General, Workspace | On startup (home / last project) | `startup` |
| Appearance | Theme (system / light / dark) | `theme` |
| Appearance | Motion (follow system / reduced) | `motion` |
| Language & Region | Language | the i18n store's `locale`, after loading that locale |
| Projects | Default project folder, with a picker | `projectFolder` |
| Canvas | Show the grid | `showGrid` |
| Canvas | Snap to grid | `snapToGrid` |
| Canvas | Show the minimap | `showMinimap` |
| Runtime | Keep the run panel open | `openRunPanelOnRun` |
| Developer | Developer mode | `developerMode`, which reveals the raw preference dump |
| Developer | Reset all settings | restores every default |
| Diagnostics | Copy / Export diagnostics | writes to the clipboard / a file |

`theme` and `motion` are pushed onto the document element, where the token file reads them.
`motion` only ever moves *towards* less motion: the default follows the system preference, and
the override exists for somebody who has not set one system-wide but still wants transitions off.

## 4. Language and region

Six languages with real locale files — English, Español, Français, Deutsch, Italiano, Português —
listed by their own names. Choosing one loads it on demand; English ships in the bundle and is
always the fallback, so a half-translated locale reads as a half-translated application rather
than a broken one. The choice persists and wins over detection from then on.

Japanese, Korean and Chinese are listed as **prepared but not translated**, and are visibly not
choices. Offering them as selectable would be offering English under another name.

Dates, times and numbers are formatted through `Intl` with the active locale, shown as a live
preview so the choice demonstrably does something. No separate format preference was invented:
`Intl` already ties formatting to the locale, and a second control that disagreed with the first
would be worse than none.

## 5. What is deliberately not a control

Each of these would have been a plausible switch. Each is a statement instead, because the switch
would have been a lie.

| In the screen | Why it is not a control |
|---|---|
| **Telemetry, crash reports, analytics** | None is collected. There is no server, no account and no endpoint to send it to. Each says what it would be, why, and what data — then that none is gathered. |
| **Automatic updates, update channels** | There is no update channel. Updating means downloading a new installer. |
| **Code signing** | The build is **not signed**, and Settings says so rather than staying quiet. |
| **Install a third-party component** | The WebAssembly sandbox is designed and not built, so no third-party component can be installed — or executed at all. |
| **Account, plan, subscription, sessions, devices** | There are no accounts. There is nothing to sign in to. |
| **Notifications** | The count of in-application notices is real and shown; there is no OS, email or push notification to configure. |
| **Parallel execution, timeouts, retries, resource limits** | The runtime does not support them. A toggle would promise scheduling that does not exist. |
| **Keyboard shortcuts** | Shown as a reference table of what the shortcuts actually are. Remapping is not built, so nothing pretends to accept a new binding. |

## 6. Diagnostics

Version, runtime, schemas, installed component count, platform, architecture, GPU where
discoverable, and the WebView's user agent — assembled by a pure function so it can be tested.
Copy and Export both work.

It deliberately excludes paths from the person's home directory, preferences, and anything
resembling a token. A diagnostics blob is pasted into bug reports by people who have not read it.

## 7. Status

Every line is derived, never typed: runtime attached or not, protocol schema, project format
schema, installed components counted from the loaded manifests, and the honest updates line.

The version comes from the build — `CARGO_PKG_VERSION` — not from anything typed into the
interface, which is what makes it impossible for About to disagree with the binary it is part of.
`Cargo.toml` is the single source and `tests/version.test.ts` fails if any of the six files that
must carry it drift apart.

## 8. What it does not do yet

- **Settings are per machine, not per project.**
- **Nothing is synchronised.** There is no account, so there is nowhere to sync to.
- **No import or export of preferences.** They live in browser storage in the application's own
  origin; moving them between machines means setting them again.
- **Interface density, UI scale, accent colour, connection style, node spacing and zoom limits**
  are not implemented. They are absent rather than present-and-dead, which is the same choice §1
  makes everywhere else.
