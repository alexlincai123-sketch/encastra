# DESKTOP APPLICATION

> `apps/desktop` — a Tauri 2 shell holding a React editor, with the runtime compiled in beside
> it. This describes what the application does today and how to work on it. The reasoning behind
> two of the shell's settings also lives in `apps/desktop/src-tauri/README.md`, because
> `tauri.conf.json` is validated strictly and JSON has no comments.

---

## 1. Architecture

```
┌──────────────────────────────── one process ────────────────────────────────┐
│                                                                             │
│  WebView                          Rust                                      │
│  ┌──────────────────────┐         ┌─────────────────────────────────────┐   │
│  │ React 19 editor      │  invoke │ Tauri commands                      │   │
│  │  · React Flow canvas │ ──────► │  apps/desktop/src-tauri/src/lib.rs  │   │
│  │  · palette           │         └──────────────┬──────────────────────┘   │
│  │  · inspector         │  events                │                          │
│  │  · store (zustand)   │ ◄────── ┌──────────────▼──────────────────────┐   │
│  └──────────────────────┘         │ encastra-core — validate, execute,   │  │
│                                   │ journal, session                     │  │
│                                   └──────────────┬──────────────────────┘   │
│                                   ┌──────────────▼──────────────────────┐   │
│                                   │ capability broker                   │   │
│                                   └──────────────┬──────────────────────┘   │
│                                   ┌──────────────▼──────────────────────┐   │
│                                   │ the operating system                │   │
│                                   └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

Two properties hold this together.

**There is no second runtime.** The editor performs *static* validation from the shared type
table as the user drags an edge, and asks `encastra-core` for everything else. A TypeScript
preview engine would diverge from the real one, and a workflow that behaves differently in
preview than in production is worse than having no preview at all
([ADR-0003](adr/0003-one-runtime-shared-type-table.md)).

**The command layer decides nothing.** Every command in `lib.rs` is a thin translation between
JSON and `encastra-core`. There is no second validator, no second scheduler, and no place where
the editor could come to believe something the engine disagrees with. When a command starts to
look like it is deciding something, that decision belongs in the runtime.

The registry of installed components is built once at start-up and held in Tauri's managed
state. Building it per call would let two calls disagree about what is installed.

---

## 2. The command surface

| Command | What it does |
|---|---|
| `choose_folder` | opens the native folder chooser on the Rust side, resolves and sanity-checks the choice, and records it — the only way a folder becomes grantable, publishable-into or importable-from this session |
| `list_components` | every manifest this build offers, for the palette |
| `type_graph` | the coercion table, served by the runtime that enforces it |
| `validate_graph` | validation for a graph plus the ports the application will supply |
| `run_graph` | one-shot and synchronous: assemble grants, import the picked files, run, return a journal |
| `start_workflow` / `stop_workflow` | the session path — runs on a worker thread and reports progress as events |
| `workflow_status` | a one-line answer about the running session; kept for tooling, not called by the editor, which listens to the events instead |
| `save_project` / `open_project` | the `.encastra` container |
| `restore_version` / `compare_versions` | version history |
| `review_publication` / `prepare_publication` | reads a saved project the way somebody receiving it would, and writes a publication folder — the review runs again inside the second one, and its answer is the one that decides |
| `inspect_publication` | reads a publication folder somebody was given and reports what is in it; writes nothing, runs nothing |
| `import_publication` | copies the bytes that were verified into the library and records them — it does **not** open or run the project |
| `library_list` | every entry, each with whether the file it names is still there and still what it was |
| `library_remove` | forgets an entry, and — only for a copy Encastra made itself — deletes it too |
| `report_dirty` / `close_window` | whether the canvas holds unsaved work, and the close that happens once somebody has said it may go |
| `about` | versions, taken from the build rather than typed anywhere |

A few of these are worth spelling out.

**`report_dirty` exists because a window is closed by the operating system.** A title-bar X,
Alt+F4 or a session ending never passes through the editor, so by the time anything could be
asked of it the work is already gone. The editor pushes the answer to "is there unsaved work
here" whenever it changes; the close handler refuses a close while that answer is yes and asks
the editor to put the question to the person. Refusing is the safe half of the failure — if the
editor never answers, the window stays open with the work still in it.

**`type_graph` looks redundant and is not.** The editor already has the rule table at build
time. Serving it from the runtime as well means a *running* application can be asked which rules
it is actually using — which is the question that matters when a connection is refused and
nobody can see why.

**`run_graph` reports a refused graph and a failed run as different shapes.** The result is a
tagged union: `Invalid { validation }` or `Ran { journal }`. They are different outcomes, and the
UI cannot accidentally render one as the other. It is the simpler path and it stays available,
but the editor no longer reaches it — everything the toolbar starts goes through
`start_workflow`, so a graph with a trigger and a graph without one take the same route and the
interface does not have two shapes of "running" to keep in step.

**Grants arrive per run.** A `GrantSpec` names a node, a capability kind, and either a folder or
a list of hosts. Capabilities declared with an `input-handles` scope are admitted from the
manifest without a dialog, because they grant nothing the user has not already said by drawing
an edge; everything else is in the list because a person answered a question. Nothing is
remembered between runs — "allowed once" and "allowed always" are different promises, and only
the UI knows which one was given.

**Scratch space belongs to the run.** Each run gets a temporary directory, and it is deleted
when the run ends. Anything the user wanted to keep was copied into a folder they allowed, by a
component that asked.

**One workflow at a time.** `start_workflow` refuses if something is already running. Two
workflows writing into the same folders at once is a surprise nobody asked for, and the editor
shows one graph.

**Importing never runs anything.** `import_publication` copies files into the library and adds a
line to a list. It does not open the project, does not resolve a variable, does not follow a link
out of the folder it was given, and grants no permission at all — every run still asks. Opening
what was imported is a separate thing a person presses, and running it is a third. The refusals
are returned as a serialised `ImportError` rather than as a sentence, so the interface branches
on the reason rather than on English.

**Every command that can fail refuses with a tag, not a sentence.** A failing command returns
`Result<T, AppError>`, serialised internally tagged on `kind` in kebab-case with the values a
sentence needs as named fields — the shape import refusals have always had. The editor matches on
the tag and writes the sentence itself, so a refusal reaches a Spanish reader in Spanish rather
than in whatever English the runtime happened to build. Four of the tags nest the refusal of the
crate that raised it (`project`, `library`, `bundle`, `import`), keeping that crate's own
vocabulary reachable instead of flattening it into prose; free text an operating system produced
is a parameter the sentence quotes, never the sentence. `Status::message` — the one line the
status bar shows while a workflow runs, and for that reason the one somebody actually watches — is
tagged the same way. The full inventory — every command, every tag, every key, and the three gates
that stop the two sides drifting — is [`docs/desktop/ERRORS.md`](desktop/ERRORS.md).

**The library only deletes what it made.** `library_remove` forgets an entry by default. Deleting
the copy on disk is a second argument, and the runtime refuses it for anything whose origin is
not `Imported` — a project somebody made is theirs, and this software did not put that file there.
An index it cannot read is never written over either: a file it cannot parse is renamed aside and
reported once, and one from another version is left exactly as it is while every command that
would write says why it will not.

**Every command that takes a project checks the extension.** `open_project`, `save_project`,
`restore_version`, `compare_versions`, `review_publication` and `prepare_publication` all require
a path ending in `.encastra`, case-insensitively, so a path this application will write is one it
will later agree to read. It is not a security check and cannot be one — the path comes from a
dialog the person drove, and `Project::open` is where a file that is not a project is actually
found out.

---

## 3. Events, and why the journal is not one

The journal is the record of a *finished* run, and it is immutable. Progress is a stream. These
are genuinely different things, and conflating them would mean handing the debugger a
half-written journal — at which point its guarantee, that what it shows is what happened, stops
being true.

So the Rust side implements `RunObserver` and emits six channels:

```
encastra://run-started      the run id and the order nodes will run in
encastra://node-started     a node began
encastra://node-finished    a node's complete record
encastra://run-finished     the whole journal
encastra://status           running / watching / runs completed / pending / dropped
encastra://notification     a component asked for a desktop notification
```

Channel names live in one Rust module and one TypeScript map, so there is something to match
against on both sides. `events.ts` subscribes to all of them together and returns a single
teardown function: a half-unsubscribed set would leave the interface updating from a workflow
the user has already closed.

### Notifications

The runtime does not draw a notification. `encastra.system.notify` asks the broker for
permission, records the request, and returns. The side of the application that owns a screen
delivers it — the Rust side watches `node_finished` for that component and emits
`encastra://notification`, the store collects them, and the shell renders them as toasts; the
CLI prints them instead. A runtime that reached for a windowing API would be a runtime that
cannot run headless, and the same code has to serve both.

The store holds one subscription for the whole application and keeps its teardown, so a hot
reload in development does not leave a second set of listeners writing into the same state. Node
status during a run comes from the event stream (`liveNodes`); the journal replaces it when the
run finishes. The status bar prefers the live map when there is one, so a node shows as running
while it is running rather than only in retrospect.

---

## 4. The editor

`App.tsx` is a shell: a sidebar, one view at a time, a toolbar that changes with the view, and a
status bar that is the same everywhere. There are six places — Home, Builder, Library,
Components, Security, Settings — and no more. Marketplace and Community are not in the sidebar because they
do not exist, and a navigation item that opens an empty "coming soon" page teaches people that
half the application is decoration.

**Home** answers one question, what do I do now: start something, open something, or load one of
the demo graphs. No statistics nobody has earned yet and no activity feed with one entry in it.

**Builder** is the editor, and the only view with a three-panel layout of its own: palette,
canvas, inspector.

**Components** is the library. Every component states what it can reach, in the same words the
permission dialog will use — learning that after a workflow is built is how people end up
clicking through dialogs.

**Security** makes the permission model legible rather than reassuring: what is installed, what
each thing can reach, what has actually been allowed in the open workflow, what is collected
(nothing), and a plain list of what the product does *not* protect against. It says in as many
words that the Wasm sandbox is designed and documented but not built, so third-party components
cannot be installed.

**Settings** is short on purpose: theme, and About. No toggle writes a preference nothing reads.

**The canvas** uses `@xyflow/react` as a *substrate* — pan, zoom, selection, marquee, minimap,
edge routing, viewport virtualisation. It provides no pixels the user sees: node rendering, port
rendering, edge rendering, the execution-state overlay and the entire visual language are ours,
and connection validation is driven by the shared type table.
[ADR-0005](adr/0005-react-flow-canvas-substrate.md) records why the library is not visible in the
result, and why building a viewport from scratch would spend months to arrive at the same
interaction model, worse, without changing how the product looks by a single pixel.

**The inspector** is both the settings panel and the debugger. Its Permissions section lists
every capability whose scope is not `input-handles` and shows the manifest's `reason` verbatim —
that string is what the person is consenting to. For `fs.write` it offers "Allow this folder",
using the node's own folder setting and refusing to grant anything until one is chosen, because
a grant with no scope is an unbounded grant. Its run section shows a node's inputs and outputs,
duration, logs, error, and every capability call the broker saw, with refusals marked.

> **Gap.** The panel only knows how to *scope* `fs.write`. Anything else produces a bare allow,
> which the broker reads as no permitted hosts and no readable directories — so HTTP Request and
> Watch Folder cannot currently be granted what they need from the editor. The runtime supports
> both grant shapes; the UI does not yet express them. See [SECURITY](SECURITY.md) §9.7.

**The toolbar reads the graph.** If any node is a trigger, the primary button says "Start
watching" rather than "Run", and while a session is live it becomes Stop with a pulse beside it.
That is the whole difference: both go through `start_workflow`, and the status bar reports runs
completed and events waiting for the watching case.

**Keyboard.** The shell owns Ctrl/Cmd+Enter (start), Ctrl/Cmd+S (save, Shift for Save As) and
Ctrl/Cmd+O (open). Editing shortcuts — undo, redo, copy, paste, duplicate, select all, delete —
are owned by the Builder rather than by the window, so they belong to the canvas and do not fire
while somebody is typing a folder name three panels away. The Builder's handler ignores a
keystroke whose target is an input, textarea, select, or anything contenteditable.

---

## 5. Content Security Policy

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: asset: http://asset.localhost; font-src 'self';
connect-src 'self' ipc: http://ipc.localhost; object-src 'none';
base-uri 'none'; frame-ancestors 'none'
```

No `unsafe-eval`, no remote origins, no wildcards. The editor is a local application and
everything it needs is bundled; there is no case where it should fetch code or styles from the
network. `style-src` allows inline styles because the canvas positions nodes with them.
`asset:` and `ipc:` are Tauri's own schemes for local assets and for the command bridge.

**Loosening any of this is a security decision, not a build convenience.** If a library needs
`unsafe-eval`, the answer is a different library.

This matters more than it looks. The Tauri commands accept a graph, an input list and a grant
list from the WebView and act on them — which is the correct trust relationship, because the
WebView is first-party, but it means the CSP is what stands between foreign code and a forged
grant.

---

## 6. Windows installer: NSIS, not MSI

`bundle.targets` is `["nsis"]` deliberately; `"all"` would produce both.

- NSIS installs per-user without elevation, so a first run does not need an administrator.
- One installer covers every language. MSI needs one per language.
- The updater supports NSIS's quiet and passive modes properly. MSI cannot elevate quietly.
- **An MSI-to-NSIS migration works; the reverse does not.** Choosing MSI first would be a
  one-way door.

The known cost is that NSIS installers draw more SmartScreen and antivirus false positives than
MSI. That is a code-signing problem rather than a packaging one, and it is solved by signing
rather than by switching format.

Windows builds require the MSVC toolchain, and the GNU toolchain is not a supported alternative
— Tauri does not test it, and the concrete breakage (a missing `WebView2Loader.dll` at runtime,
no application icon, a binary roughly three times larger) is documented in
[ADR-0009](adr/0009-windows-msvc-toolchain.md) along with the exact Build Tools components to
install and how to verify the linker actually works.

---

## 7. The browser preview

`npm run dev --workspace @encastra/desktop` serves the editor at `http://localhost:5173` in an
ordinary browser, with no Tauri behind it. This exists so the interface can be built and looked
at without a Rust build, and so the visual work can be reviewed in a browser's devtools.

**It is not a second runtime, and it does not simulate one.** `ipc.ts` has two implementations
selected by whether `__TAURI_INTERNALS__` is present on `window`. The browser one:

- serves `src/fixtures/components.json` for `listComponents` — a recording of what the real
  runtime reports;
- throws `PreviewOnlyError` for *everything* else: validating, running, choosing a file,
  opening or saving a project, restoring a version, starting a workflow. The message says what
  is missing and that the desktop app is where to do it;
- reports `live: false`, which the topbar renders as a **preview** badge;
- reports its version as `"preview"` and its runtime as `"not attached"`, rather than inventing
  a build.

Instead of a fake run it offers **recordings**: `src/fixtures/example-run.json` and
`example-run-denied.json` are journals the real engine produced, captured with
`encastra run --json`, and the second one is a run where a folder was not allowed. They are
labelled as recordings wherever they are shown, and the status bar carries a `recording` badge
while one is displayed.

A UI harness that quietly simulated the engine would be the most dangerous kind of drift: it
would look right, and it would be lying about the one thing this product sells.

Event subscription in the browser succeeds and nothing ever arrives, which is the honest
behaviour for a preview that does not run anything.

---

## 8. Development

```bash
npm install

npm run tauri:dev        # Vite + the Rust shell, hot reload on the frontend
npm run tauri:build      # a production build and an NSIS installer on Windows
npm run dev --workspace @encastra/desktop     # browser preview only, no Rust
npm run check            # lint + typecheck + tests before you push
```

Two things about the Vite configuration are deliberate.

**`@encastra/protocol` is aliased to its source**, not to its build output. An edit to the type
rules is visible in the editor immediately, with no build step in between — which matters,
because those rules are the one thing the editor and the runtime must agree on, and a stale
compiled copy is exactly the failure
[ADR-0003](adr/0003-one-runtime-shared-type-table.md) exists to prevent.

**`strictPort: true` on 5173.** Tauri points at that exact port; failing loudly beats silently
serving on another one and leaving the window blank.

The build targets `esnext` with sourcemaps — the desktop app ships its own runtime and never
runs in an old browser, so there is no reason to ship downlevelled output — and `envPrefix` is
restricted to `VITE_` and `TAURI_` so build paths do not leak into the bundle.

The Rust side is split into a library (`encastra_desktop_lib`) plus a thin binary, which is how
Tauri 2 wants it: the same code can be reached from mobile targets and from integration tests.

Icons in `src-tauri/icons/` are generated by `scripts/make_brand.py`. Do not hand-edit them —
regenerate.

The release profile optimises for size (`opt-level = "z"`, LTO, one codegen unit, stripped). It
deliberately does **not** set `panic = "abort"`: a first-party component that panics would
otherwise take the whole application down, and the runtime already treats a component failure as
an ordinary, recoverable outcome. The binary is a little larger; the editor survives a bug in one
node.

---

## 9. What the desktop application does not do yet

- **Remember a grant.** Permissions are answered per session and discarded when the application
  closes. The Security view lists what has been allowed in the open workflow; nothing is written
  down, and there is no distinction between "allowed once" and "allowed always".
- **Resolve a secret.** `variables.json` records names and types; nothing reads them and there
  is no keystore integration. See [PROJECT-FORMAT](PROJECT-FORMAT.md) §5.
- **Install a component.** The palette shows what is compiled in. There is no registry, no
  install flow, and no way to run a third-party component at all — see
  [COMPONENT-SDK](COMPONENT-SDK.md). Importing a *publication* is a different thing and does
  exist: a publication is a project and the document describing it, it arrives as a folder
  somebody handed over rather than from anywhere online, and taking it in copies files and
  nothing else. Nothing runs until the project is opened and Run is pressed.
- **Update itself.** [ADR-0008](adr/0008-signing-and-revocation.md) specifies the updater's
  verification rules; there is no updater.
- **Show a run's history.** A journal lives as long as the window holds it. Nothing is written to
  disk, so closing the application forgets every run that ever happened.
