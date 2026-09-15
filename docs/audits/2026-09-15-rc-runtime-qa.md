# Runtime QA of the release-candidate binary — 2026-09-15

**Build:** `encastra-desktop.exe` built from build commit `137c93a` (stamp read from the binary:
`137c93a9e51a3acaac7077d0e89733150ddba608`, clean), version `0.5.0-rc.1` — the bytes the manifest
at tag `v0.5.0-rc.1` describes. The same 23 checks had passed earlier on `e74e9ec` (before the
adversarial review's fixes); the table below is the run on the tagged bytes.

**Method:** the same as `2026-09-15-runtime-qa.md` — the binary launched with
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`, every command invoked
through the real Tauri bridge (`window.__TAURI_INTERNALS__.invoke`) from a Node script over the
Chrome DevTools Protocol. No native chooser was driven: a person may be using the machine, and
a chooser is exactly what this candidate makes the only way in. Everything that needs one is
exercised as far as its refusal, which after this cycle is a **tag**, not a sentence.

## 23 checks, 23 passed

| Check | Observed |
|---|---|
| `about` answers from the build | `buildCommit e74e9ec…`, version and runtime `0.5.0-beta.1` |
| `list_components` | 21 first-party components |
| `library_list` readable | 0 entries, `quarantined: null` |
| `save_project` writes a real `.encastra` | 2 066 bytes |
| `save_project` refuses a non-project path, with a tag | `{"kind":"not-a-project"}`, nothing written |
| `open_project` reads it back | 3 nodes |
| `open_project` refuses a non-`.encastra` path | `{"kind":"not-a-project"}` |
| the library remembers the created project | `origin: created`, `status: present` |
| `review_publication` on the saved file | `may-publish`, capabilities `fs.read`, `fs.write` |
| `choose_folder` without a purpose | refused by deserialisation before any chooser opens: `missing required key purpose` |
| `choose_folder` with a purpose the enum does not spell (`PublishInto`) | refused: `unknown variant`, the four kebab-case purposes listed |
| `inspect_publication` on a folder nobody chose | `{"kind":"import","error":{"kind":"folder-not-chosen"}}` |
| `import_publication` on the same folder | same refusal, nothing written |
| `prepare_publication` into a destination nobody chose | `{"kind":"destination-not-chosen"}` |
| `prepare_publication` with a listing id that is a path | `{"kind":"bundle","error":{"kind":"not-an-identifier",…}}` |
| `run_graph` with an input file nobody chose | `{"kind":"input-not-chosen","node":"r","port":"file"}` — **the path does not appear** in the refusal |
| `run_graph` with a folder grant nobody chose | `{"kind":"grants-refused","refusals":[{"kind":"folder-not-chosen","node":"save-1"}]}` |
| `validate_graph` | answers, 1 issue |
| `report_busy` | **no longer exists** (`Command report_busy not found`): the editor cannot pin the window closed; `import_publication` marks itself in flight |
| `close_window` with nothing in flight | closes the window (the last step) |
| `library_remove` with `deleteCopy` on a created project | `{"kind":"not-ours-to-delete"}`, file still there |
| `library_remove` without `deleteCopy` | entry forgotten, file stays |
| library index under app data | `library.json` only, no `.tmp` |

Results file: `qa-rc-results.json` in the session scratchpad (not committed; the table above is
the record).

## The main thread is not blocked by a long command (3/3)

The adversarial review pointed out that a non-`async` Tauri command runs on the main thread —
the window's message loop — so a long run or a large import would stop the window and every
guard with it. Twelve commands now carry `#[tauri::command(async)]`. Measured on this binary
(`qa-freeze.mjs`, both calls issued from inside the page so no CDP round-trip is in the number):
a `save_project` of a 10 000-node graph followed by `open_project` took **438 ms**; an `about`
issued 30 ms after it answered in **40 ms**, while the heavy command was still running. Before
the attribute the second call could not have answered until the first returned. Not measured on
the previous binary (its bytes were replaced by this build); the claim about the old behaviour
rests on Tauri's documented threading model, the claim about the new one on this measurement.

## What this run says and does not say

- **Says:** the IPC boundary of the candidate behaves as designed for a caller that holds no
  native-chooser result — every path-taking command refuses with a stable tag the interface can
  translate, a run cannot be seeded with a file the editor names, a grant cannot be built from a
  folder the editor names, the window cannot be closed over an import, and nothing lands on
  disk from any of it.
- **Does not say:** that the native chooser journeys work end to end on this build. They were
  executed by GUI automation on `c975bd4` (17/17, `2026-09-15-final-release-readiness.md`) and
  the chooser has since gained a purpose argument and a file variant. That pass is owed on the
  tagged candidate, by a person or by `scripts/verify/gui_chooser.ps1` on a machine where
  nobody is working — it is B5 in `docs/RELEASE_CANDIDATE_READINESS.md`.
