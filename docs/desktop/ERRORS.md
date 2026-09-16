# Errors the desktop application can show

Every command in `apps/desktop/src-tauri/src/lib.rs` that can fail returns `Result<T, AppError>`.
`AppError` (in `apps/desktop/src-tauri/src/error.rs`) serialises internally tagged on `kind`, in
kebab-case, with the values a sentence needs as named fields — the shape `ImportError` has always
had. The editor matches on the tag and writes the sentence itself, in the reader's language.

Before this, only import refusals worked that way. Everything else failed with a `String`, which
is an English sentence, and `describe()` in `store.ts` printed it — so a Spanish reader got
English at the one moment the application most needs to be understood.

## How the two sides are held together

| Piece | Where |
|---|---|
| The vocabulary | `apps/desktop/src-tauri/src/error.rs` (`AppError`, `GrantRefusal`) |
| The nested vocabularies | `ProjectError`, `LibraryError`, `BundleError`, `ImportError` in their own crates |
| The pinned list of tags | `apps/desktop/test/fixtures/error-kinds.json`, written by a Rust test |
| Tag → key | `apps/desktop/src/errors.ts` (`describeAppError`), `apps/desktop/src/library.ts` (import) |
| The sentences | `apps/desktop/src/i18n/locales/*.ts`, under `errors.*` and `import.errors.*` |

Three gates, each catching a different way this drifts:

- `AppError::kind()` is an exhaustive `match`, so a variant added without a tag does not compile.
- The Rust test `the_committed_list_of_kinds_matches_this_build` fails when the fixture no longer
  matches the enums. Regenerate with `UPDATE_ERROR_KINDS=1 cargo test -p encastra-desktop`.
- `apps/desktop/test/errors.test.ts` replays that fixture: every tag needs a key, every key needs
  a sentence in all six languages, and every non-English sentence has to differ from the English
  one — a key copied across with the English text still in it is not a translation.

The `Record<Kind, string>` maps in `errors.ts` are total over their unions, so TypeScript refuses
to compile a missing tag as well.

## The inventory

22 commands (`apps/desktop/test/ipc-surface.test.ts` pins the number). Six cannot fail. `→ import` and the other nested tags carry the whole refusal of the
crate that raised it, so the sentence a reader gets is as specific as the refusal was.

| Command | Error kinds it can return | i18n key |
|---|---|---|
| `choose_folder` (takes a purpose; a purpose the enum does not spell is refused before the chooser opens, by deserialisation) | `chooser-did-not-return` | `errors.chooserDidNotReturn` |
| | `not-a-folder-on-this-machine` | `errors.notAFolderOnThisMachine` |
| | `folder-unusable` | `errors.folderUnusable` |
| | `runtime-busy` | `errors.runtimeBusy` |
| `choose_file` | `chooser-did-not-return` | `errors.chooserDidNotReturn` |
| | `not-a-file-on-this-machine` | `errors.notAFileOnThisMachine` |
| | `file-unusable` | `errors.fileUnusable` |
| | `runtime-busy` | `errors.runtimeBusy` |
| `list_components` | — | — |
| `type_graph` | — | — |
| `validate_graph` | — | — |
| `run_graph` | `runtime-busy` | `errors.runtimeBusy` |
| | `grants-refused` (list of `GrantRefusal`) | `errors.grantsRefused` + `errors.grant.*` |
| | `working-folder` | `errors.workingFolder` |
| | `input-unreadable` | `errors.inputUnreadable` |
| | `input-not-chosen` (the file was never chosen this session; names node and port, never the path) | `errors.inputNotChosen` |
| | `input-unusable` | `errors.inputUnusable` |
| `save_project` | `not-a-project` | `errors.notAProject` |
| | `project` (nested `ProjectError`) | `errors.project.*` |
| `open_project` | `not-a-project`, `project` | as above |
| `restore_version` | `not-a-project`, `project` | as above |
| | `version-not-in-project` | `errors.versionNotInProject` |
| `compare_versions` | `not-a-project`, `project` | as above |
| | `versions-not-in-project` | `errors.versionsNotInProject` |
| `start_workflow` | `runtime-busy`, `grants-refused`, `working-folder`, `input-unreadable`, `input-not-chosen`, `input-unusable` | as for `run_graph` |
| | `workflow-already-running` | `errors.workflowAlreadyRunning` |
| | `workflow-invalid` | `errors.workflowInvalid` |
| | `workflow-not-started` | `errors.workflowNotStarted` |
| `stop_workflow` | `runtime-busy` | `errors.runtimeBusy` |
| `workflow_status` | — | — |
| `review_publication` | `not-a-project`, `project` | as above |
| `prepare_publication` | `not-a-project`, `project` | as above |
| | `destination-missing` | `errors.destinationMissing` |
| | `destination-is-a-link` | `errors.destinationIsALink` |
| | `destination-is-a-file` | `errors.destinationIsAFile` |
| | `destination-not-chosen` | `errors.destinationNotChosen` |
| | `folder-unusable` | `errors.folderUnusable` |
| | `bundle` (nested `BundleError`) | `errors.bundle.*` |
| | `publication-path-escapes` | `errors.publicationPathEscapes` |
| | `publication-already-there` | `errors.publicationAlreadyThere` |
| | `runtime-busy`, `io` | `errors.runtimeBusy`, `errors.io` |
| `inspect_publication` | `import` (nested `ImportError`) | `import.errors.*` |
| `import_publication` | `import` (nested `ImportError`, including `library-full`) | `import.errors.*` |
| | `library` (nested `LibraryError`), `library-busy` | `errors.library.*`, `errors.libraryBusy` |
| `library_list` | `library`, `library-busy` | `errors.library.*`, `errors.libraryBusy` |
| `library_remove` | `library`, `library-busy` | as above |
| | `not-ours-to-delete` | `errors.notOursToDelete` |
| | `copy-not-deleted` | `errors.copyNotDeleted` |
| `report_dirty` | — | — |
| `close_window` | `import-in-flight` (an import is being written; the flag is set by `import_publication` itself, not by the editor) | `errors.importInFlight` |
| | `no-window` | `errors.noWindow` |
| | `window-would-not-close` | `errors.windowWouldNotClose` |
| `about` | — | — |

## The status bar

`Status::message` is the other half of the same problem, and it is not an error: a dropped event
or a watcher that stopped is not a failed command. It reached the interface the same way, though
— as an English sentence the runtime had built, printed verbatim — which made the one line
somebody watches while a workflow runs the one line that was never translated.

It is now `Option<StatusMessage>`, tagged exactly as `AppError` is, pinned in the same fixture,
and rendered by `describeStatusMessage` in `errors.ts`.

| Where it is emitted | Kind | i18n key |
|---|---|---|
| a watcher failed (`session.tick`) | `trigger-error` `{node, error}` | `errors.status.triggerError` |
| events arrived faster than they could be handled | `events-dropped` `{count}` | `errors.status.eventsDropped.{one,other}` |
| a one-shot run was refused by validation | `nothing-ran` `{problems}` | `messages.nothingRanProblems.{one,other}` |
| a node panicked and the run unwound | `workflow-stopped` | `errors.status.workflowStopped` |
| `workflow_status` (tooling; the editor listens to the events instead) | `running-for` `{seconds}` | `errors.status.runningFor.{one,other}` |

Three of those name a plural tree rather than a leaf, because the count is part of the sentence.
`statusMessageKey` picks the leaf through `Intl.PluralRules`, never an `n === 1` check — CLDR
counts zero and one together in French, and a hand-written check gets that wrong.

`trigger-error` carries the whole `NodeError`, not just its sentence, because it holds a stable
`code` — and that `code` is now what the sentence is built from, so the reason is translated too
rather than being an English sentence quoted inside a translated one.

## Why a step failed

A command that is refused and a step that fails are different events, and for a while only the
first was translated. A failed step put the sentence the runtime had built into the run journal,
and the Run panel, the Inspector and the `trigger-error` status line all showed it — which made
the panel somebody reads *while debugging* the last English one in the window.

The codes are a pinned vocabulary, `NodeErrorCode` in `crates/encastra-core/src/journal.rs`.
`NodeError::new` takes a member rather than a string, so a new reason to fail cannot be invented
at a call site; `NodeErrorCode::ALL` is written into the fixture's `node` section by the same Rust
test that writes every other vocabulary, and `errors.ts` maps each code to
`errors.node.<camelCode>`.

`describeNodeError` resolves it. For a code this build knows, the six sentences say both what
happened and what to do, so the runtime's English `hint` is **not** shown beside them. What is
lost is the runtime's free text — a parse position, an operating-system error, the name of the
missing component — which `NodeError` has no named fields to carry as parameters; the Inspector
still shows the `code`, and giving `NodeError` those fields is the next step.

`CoreComponent` is public, so a component this build did not write is entitled to a vocabulary of
its own: `NodeError::from_component` keeps `code` open, and a code with no sentence falls through
to the words the component supplied, `hint` included. That is the same rule as `errors.unknown`,
applied one level down.

### The vocabularies, by size

| Enum | Tags | Where the sentences live |
|---|---|---|
| `AppError` | 34 | `errors.*` |
| `GrantRefusal` | 3 | `errors.grant.*` |
| `StatusMessage` | 5 | `errors.status.*`, `messages.nothingRanProblems` |
| `ProjectError` | 10 | `errors.project.*` |
| `LibraryError` | 5 | `errors.library.*` |
| `BundleError` | 9 | `errors.bundle.*` |
| `ImportError` | 27 | `import.errors.*` |
| `NodeErrorCode` | 33 | `errors.node.*` |

121 tags, each with a sentence in six languages.

## Rules worth keeping

**Free text is a parameter, never the message.** An operating-system error and a path the person
chose are values a translated sentence quotes — `errors.io` is *"Something on this computer
refused the operation ({reason})."* The reason is shown verbatim under a label the reader can
read, and the sentence stands without it.

**No error carries a path the person did not choose.** `ProjectError`, `LibraryError`,
`ImportError` and `AppError` all build their `Io` variant from `std::io::Error::kind()`, never
from its message, because an io message carries the path it failed on and these end up in logs.
The one path any of them names is `input-unreadable`, and that is a file the person picked.

**A refused grant is a list, not a sentence.** A run can be refused over several grants at once,
each naming its own step. They used to be joined with newlines into one `String`; they now arrive
as `GrantRefusal` values, and the editor renders one line each.

**`Display` still says what it used to.** `AppError` keeps the English sentence each refusal had,
because those strings appear in logs and in tests written against them. The contract added a name;
it did not take a sentence away.

**A tag this build has never heard of still reads as a sentence.** `errors.unknown` names the tag
and says nothing was changed, so a runtime newer than the interface cannot produce a blank message
or a piece of raw JSON.
