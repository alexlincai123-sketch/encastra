# Beta 0.3

What changed, what is still open, and — the part that matters most — the status of every item
that was outstanding at the end of 0.2, with nothing quietly dropped.

---

## 1. The thing 0.2 could not verify, verified

**The checkpoint now runs through the installed application's own interface, and was watched
doing it.**

0.2 shipped with this honest gap: the workflow was proven by an automated test against the real
runtime, but nobody had driven it through the editor. Synthetic mouse clicks do not activate
controls in this WebView2, and a screen capture's rectangle is offset from the client area — so
the interface could be neither driven nor judged reliably.

The way through was a facility WebView2 already has: launching the installed application with
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` makes the real application —
the real Rust runtime behind its IPC — drivable and, more importantly, **measurable**.

What was done through the interface, and what came back:

| Step | Result |
|---|---|
| Dismiss the welcome, load the Image Processor sample | 3 steps, 2 connections |
| Type the watched folder into Watch Folder | accepted |
| Press Allow on `fs.read` | label became **Allowed** |
| Type the output folder into Save File | accepted |
| Press Allow on `fs.write` | label became **Allowed** |
| Ctrl+Enter | `3 steps running · Watching. It will run whenever something appears.` |
| Drop an 800×400 PNG into the watched folder | `1 run 2 ok`; Resize **Finished**, Save **Finished** |
| Look in the output folder | `photo-small.png` |

It found two real defects on the way, both now fixed and both described below.

## 2. Two defects the checkpoint found

### The sample enlarged photos and called the result `-small`

The Image Processor sample resizes to 1280. Handed an 800-wide photo it produced a **1280-wide**
one: a bigger file, a softer picture, and a filename claiming it had shrunk. Scaling up invents
pixels; there is nothing to find.

Resize Image now has an **Allow making it bigger** option, off by default, and clamps the
request to the source unless it is on. Two tests, because a clamp that simply turned resizing off
would have passed the obvious one.

### A project file could be a zip bomb

Found by reading rather than running, during the security pass. The `.encastra` reader called
`read_to_string` on a ZIP entry with no ceiling, and a ZIP entry's compressed size says nothing
about what reading it costs — a few hundred kilobytes of spaces unpacks to gigabytes. A project
file is the one artefact of this product that travels between people, so opening one somebody
sent you was an out-of-memory crash they could choose for you.

Entries are now read one byte past a 32 MB ceiling and refused above it. Six tests in a new
hostile-archive suite; checked by removing the ceiling and confirming the bomb tests fail.

A third thing the exercise proved by accident: typing a path into Save File's *filename* field
produced `CUsersalexlencastra-gui-testout-small` inside the allowed folder — the sanitiser
stripping separators exactly as intended, so a path in a filename cannot escape a granted folder.

## 3. Status of everything outstanding from 0.2

| # | Item | Status | Where it stands |
|---|---|---|---|
| 1 | Manual GUI workflow | **DONE** | Verified through the installed application, §1 |
| 2 | External security review | **BLOCKED** | Needs a third party. Everything the product claims rests on the broker, and it has never been audited from outside this repository |
| 3 | Code signing | **IN PROGRESS** | Digest and timestamp configured; one thumbprint and a certificate remain. `docs/SIGNING.md` |
| 4 | Licence decision | **PLANNED** | Options and consequences written up; nothing applied, because closed→open is easy and open→closed is impossible. `docs/LICENSING.md` |
| 5 | Website deployment | **IN PROGRESS** | Builds; robots, sitemap, icons and metadata done. OG image, structured data and designed 404/500 outstanding. `docs/DEPLOYMENT.md` |
| 6 | Domain | **BLOCKED** | Needs a registrar account and money. A DNS check found no A record for four candidates, **which is not proof any is available** |
| 7 | WebAssembly sandbox | **PLANNED** | Designed, not built. Nothing third-party can be installed or executed, which is the honest reason the gap exposes nothing. `docs/PLATFORM-ARCHITECTURE.md` §1 |
| 8 | Component registry | **PLANNED** | Record shape and non-negotiables written down. §2 |
| 9 | Marketplace | **PLANNED** | Designed; no payment integration, and none until there is a backend that can hold it. §3 |
| 10 | Community | **PLANNED** | Designed; showing it populated would mean inventing users. §4 |
| 11 | Accounts | **PLANNED** | Designed; the application must keep working with no account at all. §4 |
| 12 | Payments | **BLOCKED** | Needs a provider account and a backend. No card data will ever touch Encastra. §3 |
| 13 | Update system | **PLANNED** | Design settled — verify before writing anywhere executable, monotonic versions, signed key history, rollback. §5 |

Four are blocked on something no amount of work here can supply: a third-party auditor, a
certificate, a registrar and a payment provider. Each needs a credential or money, so each stops
at the point where it would need one.

## 4. What is new in 0.3

- **An immersive homepage.** The scroll is the narrative, not a way to reveal fade-ins. See
  `docs/WEBSITE.md`.
- **Internationalisation.** Six languages with real locale files, English always the fallback,
  locales loaded on demand, and dates and numbers through `Intl` rather than by hand. Three more
  are prepared and honestly marked as untranslated.
- **Settings, extended** across the full category architecture, still under the rule that every
  control writes a preference something reads. See `docs/SETTINGS.md`.
- **A glossary.** `docs/GLOSSARY.md` fixes the vocabulary so the application, the site and the
  documentation stop drifting between component, block, node and module.

## 5. Security notes from this pass

- **The zip-bomb fix**, §2.
- **Release builds do not ship Tauri's devtools** — the feature is enabled for debug builds only.
- **WebView2's remote debugging port is reachable through an environment variable.** That is how
  the checkpoint was finally verified, and it is worth being explicit that it is not a hole: it
  requires controlling the environment of the process at launch, which means already running code
  as that user. It is not a privilege escalation, and it is a property of WebView2 rather than of
  this application.
- **Nothing is signed.** Unchanged, and stated wherever a hash is shown.
- **No external audit has happened.** Unchanged, and the most important thing on this page.

## 6. Known limitations

- Third-party components cannot be installed or executed. By design, until the sandbox exists.
- No update channel. Updating means downloading a new installer, and Settings says so.
- No accounts, no marketplace, no community, no payments.
- Windows only. macOS and Linux are not built, and the download page says so rather than
  offering buttons that do nothing.
- The licence is still `UNLICENSED`, which grants nobody any rights.
