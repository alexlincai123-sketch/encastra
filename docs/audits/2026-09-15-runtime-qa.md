# Runtime QA — 2026-09-15

What was actually run against the real desktop binary, how, and what could not be.

The distinction this document exists to keep: **a test passing is not the product working.**
Everything below was executed against `target/release/encastra-desktop.exe` built from the named
commit, driven through the WebView2 DevTools protocol, with results read back from the real DOM
and from the real filesystem. Nothing here was inferred from unit tests.

---

## Method

- The release binary is launched with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`.
  Nothing in the product changes for this; it is a WebView2 runtime flag.
- A Node script (no dependencies — Node ≥ 22 has a global `WebSocket`) connects to the page target,
  evaluates expressions in the page, and reads DOM state. Buttons are found by their visible text
  and clicked with `element.click()`; the application was running in Spanish, the machine's
  language, which is itself evidence for the locale detection.
- Rust commands are exercised through the real bridge — `window.__TAURI_INTERNALS__.invoke` from
  the page — so what is measured is the shipped Tauri command, its serialisation and its refusals,
  not a test double.
- **Native dialogs were not driven.** The save/open/folder choosers are Windows common dialogs
  outside the WebView. Synthesising keystrokes into them is unsafe while a person is using the
  machine (they were: a full-screen game was in the foreground during this session, and a first
  attempt typed a path into it before that was noticed and stopped), and UI Automation against a
  background dialog answered `0x800704C7`. So every step that requires a chooser is verified only
  as far as its *refusal* — which is the security property that makes the chooser mandatory.
- The application's data folder (`%APPDATA%\dev.encastra.app`) did not exist before the run and
  was removed after it, so nothing of the person's was touched or left behind.

---

## Build `4944b41` (merge of `sec/hardening-audit` into `feat/readiness`), 0.4.0-beta.1

### Through the interface (real clicks, real DOM)

| Step | Result | Evidence |
|---|---|---|
| Application starts and renders the shell | PASS | `document.title === 'Encastra'`, `.sidebar` present |
| Welcome dialog dismissed via its own button | PASS | `.welcome` gone |
| Sidebar has six destinations including the library | PASS | `Inicio, Constructor, Biblioteca, Componentes, Seguridad, Ajustes` |
| Release build exposes no dev-only store hook | PASS | `window.__encastra` undefined |
| Library view opens with its empty state | PASS | heading and explanatory copy rendered in Spanish |
| A sample loads into the builder | PASS | «Procesador de imágenes» |
| Canvas renders the sample's steps | PASS | 3 React Flow nodes |
| Save → native dialog → project name updates | **NOT RUNTIME VERIFIED** | the dialog opened (`#32770 "Guardar como"` owned by the process, confirmed by window enumeration) and was not driven — see Method |
| Publish → Prepare → folder chooser → folder written | **NOT RUNTIME VERIFIED** | same reason; the command's refusals are verified below |
| Import → folder chooser → inspection dialog → import → library row | **NOT RUNTIME VERIFIED** | same reason; the command's refusals are verified below |

### Through the bridge (real Tauri commands in the release binary)

19 of 19 passed. Each row is a command the shipped interface calls.

| Command and case | Result | Evidence |
|---|---|---|
| `about` | PASS | `version 0.4.0-beta.1`, `runtime 0.4.0-beta.1`, schemas 1/1 |
| `list_components` | PASS | 21 components |
| `library_list` on a fresh machine | PASS | `entries: []`, `quarantined: null` |
| `save_project` writes a real `.encastra` | PASS | 2 071 bytes on disk, one history snapshot, no missing components |
| `save_project` to `evil.bat` | PASS (refused) | "That is not an Encastra project. A project's name ends in .encastra." — no file created |
| `open_project` reads the file back | PASS | 3 nodes, name `QA IPC` |
| `open_project` on a `.txt` path | PASS (refused) | same message |
| The library remembered the created project | PASS | one entry, `origin: created`, `status: present`, 3 steps |
| `review_publication` on the saved file | PASS | `may-publish`, capabilities `fs.read, fs.write`, finding `reaches-beyond-itself` |
| `inspect_publication` on a folder nobody chose | PASS (refused) | `{ kind: 'folder-not-chosen' }` |
| `import_publication` on a folder nobody chose | PASS (refused) | same; `library/imports` was never created |
| `prepare_publication` into a folder nobody chose | PASS (refused) | "Choose the folder to publish into with the Choose button before preparing." |
| `prepare_publication` with `listing_id = dev.qa.../../../evil` | PASS (refused) | `"dev.qa.../../../evil" is not a usable identifier: id … has an empty segment` — refused in the binary, not only in a unit test |
| `compare_versions` on the real history | PASS | `[]` for a snapshot compared with itself |
| `library_remove` with `deleteCopy: true` on a created project | PASS (refused) | "That file is yours, and it stays where it is…" — file still on disk |
| `library_remove` forget-only | PASS | index empty, file still on disk |
| Index written atomically under app data | PASS | `library.json` present, no `.tmp` left |
| `validate_graph` on the saved graph | PASS | one warning (`file → image` conversion can fail at run time), order `watch-1, resize-1, save-1` |
| `run_graph` on a two-step graph with a real input file | PASS | `outcome: ran`, journal `ok`, both nodes `ok` |

### What this build did not verify

- The three chooser-driven journeys above, end to end. They are the ones a person actually
  takes, and they need a person at the dialog — or a machine nobody is using — to be verified.
  Their Rust halves are covered by the 286 workspace tests at that commit and their refusals by
  the rows above.
- The unsaved-changes prompt and the keyboard connect mode: not in this build (added afterwards
  on this branch); see the next section once it exists.

---

## Build `0.5.0-beta.1` (the release build; tree at `f6e7c29` plus the version bump, lockfiles, the Home→Builder fix and these documents)

The same two scripts, unchanged, against `target/release/encastra-desktop.exe` as produced by
`npm run tauri:build` for the release. `about` reports `version 0.5.0-beta.1`,
`runtime 0.5.0-beta.1`, schemas 1/1.

- **Through the bridge: 19 of 19 passed**, the same nineteen rows as above, with the same
  refusals word for word and the same on-disk evidence (2 071-byte project, one snapshot,
  `library.json` with no `.tmp`, `library/imports` never created by a refused import, both nodes
  `ok` in the two-step run).
- **Through the interface: 7 of 7 non-dialog steps passed** (shell, welcome, six sidebar items
  with the library, no dev hook, library empty state, sample loaded, three nodes rendered), and
  the save step stopped at the native dialog for the reason in Method — it was not driven.
- Added on this branch and **not runtime-verified** in this session, because each needs either a
  dialog or a keyboard at the real window: the unsaved-changes prompt (store logic covered by 14
  vitest cases and the Rust `should_prevent_close` cases), the keyboard connect mode and
  connection focus (pure logic covered by `connect-mode.test.ts` / `edge-focus.test.ts`), the
  Import dialog's rendering of an inspection (`ImportError` → sentence mapping covered
  exhaustively over all variants).

## Build from `9d1ec13` (the final audit's fixes), 0.5.0-beta.1

Rebuilt after the fixes for the false unsaved-work prompt and the disabled Publish button. The
same two scripts: **19 of 19** through the bridge and **7 of 7** non-dialog interface steps,
with the Library view rendering (which is the view the fixes touched) and the save step again
stopping at the native dialog. This binary's hashes are not the release's: the release build is
produced once more from the final commit, with reproducible-build flags, and recorded in
`docs/RELEASE.md`.

## Environment limitation, stated once

Runtime QA that needs a native dialog cannot be automated safely on a machine somebody is using.
Before a release, the chooser journeys — save as, publish into a folder, import from a folder,
allow a folder to a component — should be walked by a person on the release build, or by this
script on a machine with nobody at the keyboard. The script and the dialog helper live in the
session's scratchpad, not in the repository, because a helper that drives native dialogs is not
something the product should ship or CI should run.
