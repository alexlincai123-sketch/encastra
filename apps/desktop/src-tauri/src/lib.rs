//! The desktop application's bridge to the runtime.
//!
//! Every command here is a thin translation between JSON and `encastra-core`. There is no
//! logic in this file that the runtime does not already own — no second validator, no second
//! scheduler, no place where the editor could come to believe something the engine disagrees
//! with (ADR-0003). When a command looks like it is starting to decide something, that
//! decision belongs in the runtime.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use encastra_core::broker::{Broker, GrantScope, GrantSet, resolve_grant_directory};
use encastra_core::graph::{Graph, NodeId, PortRef};
use encastra_core::journal::NodeRecord;
use encastra_core::journal::RunJournal;
use encastra_core::registry::{ComponentRegistry, InMemoryRegistry};
use encastra_core::runner::{
    CoreComponentSet, RunObserver, RunRequest, execute_request, run_seeded,
};
use encastra_core::session::{Session, TriggerSet};
use encastra_core::validate::{Validation, validate_with_supplied};
use encastra_core::value::{HandleKind, Value};
// `Status` under another name: this crate already has one, and it answers a different question
// (whether a workflow is running, not whether a file is still where it was).
use encastra_library::{Entry, Library, Origin, Recovered, Status as LibraryStatus};
use encastra_project::{History, LockedComponent, Lockfile, Project, SnapshotId};
use encastra_protocol::manifest::ComponentManifest;
use encastra_publish::import::{ImportError, Inspected};
use encastra_publish::{License, PublicationBundle, PublicationDraft, Publisher, Review};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

/// What a folder was chosen *for*.
///
/// Consent is per question, not per folder. There are exactly four places in this application
/// where somebody picks a folder, and each of them asks something different:
///
/// * [`FolderPurpose::PublishInto`] — "write a publication here" (`prepare_publication`);
/// * [`FolderPurpose::ImportFrom`] — "read a publication out of here"
///   (`inspect_publication`, `import_publication`);
/// * [`FolderPurpose::GrantToComponent`] — "let this step in the workflow reach this folder"
///   (`run_graph`, `start_workflow`);
/// * [`FolderPurpose::ProjectsLocation`] — "this is where I keep my projects", a preference the
///   editor stores and nothing on this side acts on.
///
/// The enum is closed on purpose: a purpose the editor invents does not deserialise, so the
/// command fails before a chooser is ever opened. Adding a variant means adding the flow that
/// needs it, which is the point — the list is the audit.
///
/// `ProjectsLocation` records a choice that gates nothing today. That is deliberate rather than
/// dead: it is the flow that made the old single set wrong, because browsing for a projects
/// folder in Settings used to silently make that folder grantable, publishable-into and
/// importable-from. Recording it under its own name means it answers only its own question, and
/// a future command that acts on that preference has a record to check.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum FolderPurpose {
    PublishInto,
    ImportFrom,
    GrantToComponent,
    ProjectsLocation,
}

impl FolderPurpose {
    /// What to tell somebody who has to go and choose the folder again.
    ///
    /// Named by purpose rather than by path: these sentences end up on screen and in logs, and
    /// the path is somebody's home folder — the same rule [`NOT_A_PROJECT`] follows.
    fn choose_again(self) -> &'static str {
        match self {
            Self::PublishInto => {
                "Choose the folder to publish into with the Choose button before preparing."
            }
            Self::ImportFrom => {
                "Choose the folder to import from with the Choose button before importing."
            }
            Self::GrantToComponent => {
                "Choose that folder with the Choose button before allowing it."
            }
            Self::ProjectsLocation => {
                "Choose your projects folder with the Browse button before using it."
            }
        }
    }
}

/// Why a folder did not pass the consent check.
///
/// A value rather than a sentence, so the tests below assert on the refusal itself and not on
/// English that somebody may improve. The two reasons are genuinely different and must not be
/// collapsed: *unusable* is about the folder (a drive root, a system tree, the startup folder,
/// something that is not a folder at all) and holds no matter who asked; *not chosen* is about
/// the record, and is the whole of what this module adds.
///
/// It renders to a `String` at the command boundary because that is the error shape those
/// commands already have. The import path keeps `ImportError::FolderNotChosen`, which the
/// interface already matches on by `kind`.
#[derive(Debug, Clone, PartialEq, Eq)]
enum ConsentError {
    /// The folder cannot be the scope of anything, whoever chose it.
    NotUsable { reason: String },
    /// Nobody chose this folder, this session, for *this* question.
    NotChosen { purpose: FolderPurpose },
}

impl ConsentError {
    fn message(&self) -> String {
        match self {
            Self::NotUsable { reason } => format!("That folder cannot be used: {reason}."),
            Self::NotChosen { purpose } => purpose.choose_again().to_owned(),
        }
    }
}

/// The one check. Every consuming command goes through this and none of them re-implements it.
///
/// Two steps, in this order and never the other way round:
///
/// 1. the folder is resolved by [`resolve_grant_directory`] — which canonicalises it, so `..`,
///    a trailing separator, a verbatim `\\?\` spelling, a different case on a case-insensitive
///    volume and a junction or symlink all collapse to the one real path — and refused outright
///    if it is a root, a system tree or a startup folder;
/// 2. the resolved path is looked up **paired with the purpose**. A folder chosen to import
///    from is not a folder chosen to publish into, and the editor naming a different purpose
///    than the one the chooser was opened with finds nothing.
///
/// Resolving first is what makes substitution useless: what is compared is never the string
/// that arrived. Chosen `C:\a` and then asked about `C:\a\..\b`, the comparison is against
/// `C:\b`, which nobody chose for anything.
fn folder_chosen_for(
    chosen: &BTreeSet<(FolderPurpose, PathBuf)>,
    purpose: FolderPurpose,
    folder: &Path,
) -> Result<PathBuf, ConsentError> {
    let resolved =
        resolve_grant_directory(folder).map_err(|reason| ConsentError::NotUsable { reason })?;
    if !chosen.contains(&(purpose, resolved.clone())) {
        return Err(ConsentError::NotChosen { purpose });
    }
    Ok(resolved)
}

/// Loaded once at start-up. Building the registry per call would let two calls disagree about
/// what is installed.
struct Runtime {
    registry: InMemoryRegistry,
    components: CoreComponentSet,
    triggers: TriggerSet,
    /// Folders the person actually chose in a native chooser, this session, **and what for**.
    ///
    /// The one piece of state that makes a folder grant mean anything. A grant arrives from the
    /// webview carrying a path, and until this existed the runtime had no way to tell a path a
    /// person picked from a path a project file supplied — and a project file is written by
    /// whoever sent it. The prompt would say the truth about a folder nobody chose.
    ///
    /// The purpose is half of the record because consent is not a property of a folder, it is a
    /// property of a folder *and* a question. This used to be a bare set of paths, so a folder
    /// picked to import a publication *from* also answered "may a component write here" and
    /// "may a publication be written into this" — three different sentences, one of which the
    /// person read. Recording the pair means an answer can only be used for the question it was
    /// an answer to.
    ///
    /// Populated only by [`choose_folder`], which opens the chooser here rather than in the
    /// editor, so the path is known to the privileged side before it is ever a grant. There is
    /// no command that takes a path and adds it: the editor can ask for the chooser and can ask
    /// for a purpose, and neither of those is a path.
    ///
    /// Canonical paths, so what is compared later is what was compared here. Per session, not
    /// persisted: a remembered choice that survived a restart would be a grant nobody made
    /// today, sitting in a file the editor could read. Nothing here is ever written to disk —
    /// `a_fresh_runtime_remembers_nothing` is the test that says so.
    chosen_folders: Mutex<BTreeSet<(FolderPurpose, PathBuf)>>,
    /// The workflow currently running, if any. One at a time: two workflows writing into the
    /// same folders at once is a surprise nobody asked for, and the editor shows one graph.
    running: Mutex<Option<Running>>,
    /// What this person has, and where it is. Read once at start-up for the same reason the
    /// registry is: two calls that each read the file would disagree about what is in it.
    library: LibraryHandle,
    /// Whether the canvas holds work that has not been written to disk.
    ///
    /// The editor's answer, pushed here by `report_dirty` whenever it changes. It lives on this
    /// side because the question is asked on this side: a window is closed by the operating
    /// system — a title-bar X, Alt+F4, a session ending — and the close event has to be answered
    /// before anything can be asked of the webview. Knowing already is the only way to say no.
    dirty: AtomicBool,
    /// Whether a close has already been decided by the person, and is now merely being carried
    /// out. Set by [`close_window`] so that the guard below lets that close through instead of
    /// prompting about the same work forever.
    closing: AtomicBool,
}

/// Should this close be stopped and handed to the editor to ask about?
///
/// A function rather than an expression inline in the handler so that the decision can be tested
/// without a window: the failure that matters here is not "it prompted" but "it prompted again
/// after the person already said yes", which is a window nobody can close.
fn should_prevent_close(dirty: bool, closing: bool) -> bool {
    dirty && !closing
}

struct Running {
    stop: Arc<AtomicBool>,
    started_at_ms: u64,
}

/// A value the application supplies for an input nothing in the graph produces — the file a
/// person picked, or later, a trigger's event.
#[derive(Debug, Deserialize)]
struct InputSpec {
    node: String,
    port: String,
    path: String,
}

impl InputSpec {
    fn port_ref(&self) -> PortRef {
        PortRef {
            node: NodeId(self.node.clone()),
            port: self.port.clone(),
        }
    }
}

/// A decision the user made in the consent dialog. It arrives per run: a grant is not
/// remembered here, because "allowed once" and "allowed always" are different promises and
/// only the UI knows which one was given.
#[derive(Debug, Deserialize)]
struct GrantSpec {
    node: String,
    kind: String,
    #[serde(default)]
    folder: Option<String>,
    #[serde(default)]
    hosts: Option<Vec<String>>,
}

/// What a run attempt produced.
///
/// A refused graph and a failed run are different outcomes and are reported as different
/// shapes, so the UI cannot accidentally render one as the other.
#[derive(Debug, Serialize)]
#[serde(tag = "outcome", rename_all = "lowercase")]
enum RunResult {
    /// The graph never ran; here is what is wrong with it.
    Invalid { validation: Validation },
    /// The graph ran; here is what happened.
    Ran { journal: RunJournal },
}

/// Opens the native folder chooser, and remembers what came back.
///
/// The chooser used to be opened by the editor, through the dialog plugin, and the path went
/// straight into the node's configuration. That made the whole folder-permission story rest on
/// the editor being honest about where a string came from — and the string it hands back is
/// indistinguishable from one a `.encastra` file supplied. A project written by somebody else
/// could put `C:\` in a node's config, the prompt would display it accurately, and a person
/// clicking Allow would grant the drive.
///
/// Opening it here fixes the direction of trust: the privileged side learns the path from the
/// operating system, not from the renderer, and nothing else can add to that record.
///
/// The scope is checked at the moment of choosing rather than at the moment of granting, so a
/// person picking something absurd is told immediately instead of finding out when a run is
/// refused.
///
/// `purpose` says which question the chooser is being opened to answer, and the record is of the
/// pair. It arrives from the editor like everything else, and the editor is free to lie about
/// it — but lying costs it something rather than gaining it something: a folder recorded under
/// the wrong purpose satisfies the wrong check, so the flow the person is actually in refuses.
/// The editor cannot name a purpose the person's own chooser did not serve *and* get the folder
/// past the command that matters, because a purpose it invents fails to deserialise and a
/// purpose it swaps records the folder somewhere the swapped-to flow is the only thing that
/// reads. What it still cannot do at all is put a path into the record without a chooser.
///
/// Async so it runs off the main thread; the chooser is modal and blocking it would hang the
/// window it is modal to.
#[tauri::command]
async fn choose_folder(
    app: tauri::AppHandle,
    state: tauri::State<'_, Runtime>,
    purpose: FolderPurpose,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let handle = app.clone();
    let picked =
        tauri::async_runtime::spawn_blocking(move || handle.dialog().file().blocking_pick_folder())
            .await
            .map_err(|_| "The folder chooser did not return.".to_owned())?;

    let Some(picked) = picked else {
        return Ok(None);
    };

    let path = picked
        .into_path()
        .map_err(|_| "That is not a folder on this machine.".to_owned())?;

    let resolved = resolve_grant_directory(&path)
        .map_err(|why| format!("That folder cannot be used: {why}."))?;

    state
        .chosen_folders
        .lock()
        .map_err(|_| "The runtime is busy.".to_owned())?
        .insert((purpose, resolved.clone()));

    // The resolved path is what is returned — without its verbatim `\\?\` prefix — so the string
    // the editor shows and later sends back as a grant resolves to exactly what this side
    // recorded. Returning what the chooser gave and recording something else would put the
    // comparison back where it started.
    Ok(Some(for_display(&resolved)))
}

#[tauri::command]
fn list_components(state: tauri::State<'_, Runtime>) -> Vec<ComponentManifest> {
    state.registry.list().into_iter().cloned().collect()
}

/// The shared rule table, handed to the editor by the runtime that enforces it.
///
/// The editor also has this file at build time. Serving it from here as well means a running
/// application can be asked which rules it is *actually* using, which is the question that
/// matters when a connection is refused and nobody can see why.
#[tauri::command]
fn type_graph() -> serde_json::Value {
    serde_json::to_value(encastra_protocol::all_coercions().collect::<Vec<_>>())
        .unwrap_or(serde_json::Value::Null)
}

#[tauri::command]
fn validate_graph(
    state: tauri::State<'_, Runtime>,
    graph: Graph,
    inputs: Vec<InputSpec>,
) -> Validation {
    let supplied: BTreeSet<PortRef> = inputs.iter().map(InputSpec::port_ref).collect();
    validate_with_supplied(&graph, &state.registry, &supplied)
}

#[tauri::command]
fn run_graph(
    state: tauri::State<'_, Runtime>,
    graph: Graph,
    inputs: Vec<InputSpec>,
    grants: Vec<GrantSpec>,
) -> Result<RunResult, String> {
    let (allowed, refused) = grant_set(&graph, &state.registry, &grants, &chosen_folders(&state)?);
    // Said before the run rather than discovered during it. A permission the person answered yes
    // to and that did not take effect is the one thing they must not find out about by reading a
    // journal afterwards.
    if !refused.is_empty() {
        return Err(refused.join("\n"));
    }

    let run_id = format!("run-{}", encastra_core::journal::now_ms());
    // A guard, so the folder goes whichever way this function leaves — an early `?`, a
    // panic, or the end. It used to be removed by one line at the bottom, and every `?` above
    // that line was a folder left under %TEMP% per call, for a caller that could make one input
    // fail to resolve. A path that does not exist was enough.
    let scratch = ScratchDir::new(std::env::temp_dir().join("encastra").join(&run_id));
    let mut broker = Broker::new(scratch.path().to_path_buf(), allowed)
        .map_err(|e| format!("Could not prepare a working folder: {e}"))?;

    let seed = seed_for(&mut broker, &inputs)?;

    let result = match run_seeded(
        &graph,
        &state.registry,
        &state.components,
        &mut broker,
        &AtomicBool::new(false),
        &run_id,
        seed,
    ) {
        Ok(outcome) => RunResult::Ran {
            journal: outcome.journal,
        },
        Err(validation) => RunResult::Invalid { validation },
    };

    // Scratch space belongs to the run and goes with `scratch`. Anything the user wanted to
    // keep was copied into a folder they allowed, by a component that asked.
    drop(scratch);
    Ok(result)
}

/// A run's scratch folder, removed when this is dropped.
///
/// Removal on drop rather than by a line at the end of the function, because a function with
/// several `?` in it has several ends, and only one of them used to remove anything. The folder
/// is created by the broker; this only promises that whatever is there when the run is over is
/// gone afterwards, whether the run ended by returning, by failing, or by unwinding.
struct ScratchDir(PathBuf);

impl ScratchDir {
    fn new(path: PathBuf) -> Self {
        ScratchDir(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for ScratchDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Whether a path names an Encastra project — something whose name ends in `.encastra`.
///
/// Case-insensitively, because a person who typed `Thumbnails.Encastra` into a save box meant a
/// project, and every filesystem this ships on agrees with them.
///
/// This is not a security check and cannot be one: a path arrives from a dialog the person drove,
/// and the file behind it is read by `Project::open`, which is where a file that is not a project
/// is actually found out. What it buys is that every command taking a project takes the same
/// thing, so a path this application will write is a path it will later agree to read.
fn is_project_path(path: &Path) -> bool {
    path.extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("encastra"))
}

const NOT_A_PROJECT: &str = "That is not an Encastra project. A project's name ends in .encastra.";

/// A resolved path as a person should read it.
///
/// `std::fs::canonicalize` on Windows returns the verbatim form — `\\?\C:\Users\...`, or
/// `\\?\UNC\server\share\...` — which is the right thing to compare and the wrong thing to show:
/// driving the real chooser through Settings put `\\?\C:\Users\...` into the folder field, and
/// that string then travels into the consent prompt and the saved preferences. The prefix
/// carries no information a person needs (it tells the Win32 layer to skip its own path
/// parsing), so it is removed for display and the plain form goes back through
/// `resolve_grant_directory` on the way in, where canonicalising it yields the verbatim form
/// again. Anything that is not one of the two verbatim shapes is returned as it is.
fn for_display(path: &Path) -> String {
    let text = path.to_string_lossy();
    if let Some(unc) = text.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{unc}");
    }
    if let Some(plain) = text.strip_prefix(r"\\?\") {
        // Only a drive path is safe to strip: `\\?\Volume{...}\` has no non-verbatim spelling.
        let mut chars = plain.chars();
        let drive =
            chars.next().is_some_and(|c| c.is_ascii_alphabetic()) && chars.next() == Some(':');
        if drive {
            return plain.to_owned();
        }
    }
    text.into_owned()
}

/// The one place a project path is turned from a string into something to act on.
fn project_path(path: &str) -> Result<PathBuf, String> {
    let target = PathBuf::from(path);
    if !is_project_path(&target) {
        return Err(NOT_A_PROJECT.to_owned());
    }
    Ok(target)
}

/// A hint from the file extension. The runtime verifies content when a component actually
/// decodes it, so a wrong guess fails there rather than being trusted.
fn kind_for(path: &Path) -> HandleKind {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp") => HandleKind::Image,
        Some("mp4" | "mov" | "mkv" | "webm" | "avi") => HandleKind::Video,
        Some("mp3" | "wav" | "flac" | "ogg" | "m4a") => HandleKind::Audio,
        _ => HandleKind::File,
    }
}

/// What the editor needs to know about an open project.
#[derive(Debug, Serialize)]
struct OpenProject {
    name: String,
    path: String,
    graph: Graph,
    history: History,
    /// Components the file pins that this build does not have. Named rather than silently
    /// ignored: a project that cannot be run as saved should say so before anything runs.
    missing: Vec<String>,
}

/// Pins every component the graph uses, by digest.
///
/// Built at save time from what is actually installed, so a project records the bytes it was
/// built against rather than a version range that could resolve differently tomorrow.
fn lock_for(graph: &Graph, registry: &InMemoryRegistry) -> Lockfile {
    let mut components: Vec<LockedComponent> = graph
        .nodes
        .values()
        .filter_map(|node| {
            registry
                .get(&node.component)
                .map(|manifest| LockedComponent {
                    id: manifest.id.clone(),
                    version: manifest.version.clone(),
                    manifest_digest: manifest.digest(),
                    origin: "builtin".to_owned(),
                })
        })
        .collect();
    components.sort_by(|a, b| (&a.id, &a.version).cmp(&(&b.id, &b.version)));
    components.dedup();
    Lockfile { components }
}

#[tauri::command]
fn save_project(
    state: tauri::State<'_, Runtime>,
    path: String,
    name: String,
    graph: Graph,
    label: Option<String>,
) -> Result<OpenProject, String> {
    let target = project_path(&path)?;
    let now = encastra_core::journal::now_ms();

    // Saving over an existing project keeps its identity and its history. Only its content
    // moves forward.
    let mut project = match Project::open(&target) {
        Ok(existing) => existing,
        Err(_) => Project::new(name.clone(), now),
    };
    project.manifest.name = name;
    project.manifest.modified_at_ms = now;
    project.graph = graph;
    project.lock = lock_for(&project.graph, &state.registry);
    project.history.record(&project.graph, label, None, now);

    project.save(&target).map_err(|e| e.to_string())?;
    remember_project(&state, &project, &target, now);
    Ok(describe(project, &path, &state.registry))
}

#[tauri::command]
fn open_project(state: tauri::State<'_, Runtime>, path: String) -> Result<OpenProject, String> {
    let target = project_path(&path)?;
    let project = Project::open(&target).map_err(|e| e.to_string())?;
    remember_project(&state, &project, &target, encastra_core::journal::now_ms());
    Ok(describe(project, &path, &state.registry))
}

/// Puts a project somebody just saved or opened into their library, and never fails the thing
/// they actually asked for.
///
/// The file is read back rather than re-serialised from the project in memory: what the entry's
/// checksum has to describe is the bytes on disk, which is the only thing "has this changed
/// since you last opened it" can sensibly mean. A file that cannot be read back is simply not
/// recorded — there is nothing to say about it, and inventing a hash would make the library
/// report a change the next time somebody looked.
fn remember_project(state: &Runtime, project: &Project, target: &Path, now: u64) {
    let Ok(bytes) = std::fs::read(target) else {
        return;
    };
    state.library.remember(encastra_library::entry_for_project(
        project, target, &bytes, now,
    ));
}

#[tauri::command]
fn restore_version(
    state: tauri::State<'_, Runtime>,
    path: String,
    snapshot: String,
) -> Result<OpenProject, String> {
    let target = project_path(&path)?;
    let mut project = Project::open(&target).map_err(|e| e.to_string())?;
    let id = SnapshotId(snapshot);

    // Restoring appends a new version equal to the old one, so the restore itself can be
    // undone. Nothing in the history is rewritten.
    let graph = project
        .history
        .restore(&id, encastra_core::journal::now_ms())
        .ok_or("That version is not in this project.")?;
    project.graph = graph;
    let now = encastra_core::journal::now_ms();
    project.manifest.modified_at_ms = now;
    project.save(&target).map_err(|e| e.to_string())?;
    // The file just changed under the library's hash of it. Without this the library showed a
    // project as "changed" moments after the application itself rewrote it.
    remember_project(&state, &project, &target, now);
    Ok(describe(project, &path, &state.registry))
}

#[tauri::command]
fn compare_versions(path: String, from: String, to: String) -> Result<Vec<String>, String> {
    let project = Project::open(&project_path(&path)?).map_err(|e| e.to_string())?;
    let changes = project
        .history
        .compare(&SnapshotId(from), &SnapshotId(to))
        .ok_or("One of those versions is not in this project.")?;
    Ok(changes
        .iter()
        .map(encastra_project::Change::describe)
        .collect())
}

fn describe(project: Project, path: &str, registry: &InMemoryRegistry) -> OpenProject {
    let missing = project
        .lock
        .components
        .iter()
        .filter(|locked| {
            let reference = format!("{}@{}", locked.id, locked.version);
            encastra_core::ComponentRef::parse(&reference)
                .ok()
                .and_then(|r| registry.get(&r))
                .is_none()
        })
        .map(|locked| format!("{}@{}", locked.id, locked.version))
        .collect();

    OpenProject {
        name: project.manifest.name,
        path: path.to_owned(),
        graph: project.graph,
        history: project.history,
        missing,
    }
}

// -- live progress ------------------------------------------------------------------------
//
// The journal is the record of a finished run and stays immutable. Progress is a stream, and
// these events are it. Conflating the two would mean handing the debugger a half-written
// journal, and its guarantee — that what it shows is what happened — would stop being true.

/// Event names, in one place so the TypeScript side has something to match against.
mod events {
    pub const RUN_STARTED: &str = "encastra://run-started";
    pub const NODE_STARTED: &str = "encastra://node-started";
    pub const NODE_FINISHED: &str = "encastra://node-finished";
    pub const RUN_FINISHED: &str = "encastra://run-finished";
    pub const STATUS: &str = "encastra://status";
    pub const NOTIFICATION: &str = "encastra://notification";
}

#[derive(Debug, Clone, Serialize)]
struct RunStarted {
    run_id: String,
    order: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
struct NodeEvent {
    run_id: String,
    node: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    record: Option<NodeRecord>,
}

/// What the status bar shows while a workflow is running.
#[derive(Debug, Clone, Serialize)]
struct Status {
    running: bool,
    /// True when the workflow starts itself and keeps going until stopped.
    watching: bool,
    runs: u64,
    pending: usize,
    dropped: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

struct Progress {
    app: tauri::AppHandle,
}

impl RunObserver for Progress {
    fn run_started(&self, run_id: &str, order: &[NodeId]) {
        let _ = self.app.emit(
            events::RUN_STARTED,
            RunStarted {
                run_id: run_id.to_owned(),
                order: order.iter().map(ToString::to_string).collect(),
            },
        );
    }

    fn node_started(&self, run_id: &str, node: &NodeId) {
        let _ = self.app.emit(
            events::NODE_STARTED,
            NodeEvent {
                run_id: run_id.to_owned(),
                node: node.to_string(),
                record: None,
            },
        );
    }

    fn node_finished(&self, run_id: &str, node: &NodeId, record: &NodeRecord) {
        // A component that asked to notify gets its notification here, from the side of the
        // application that owns a screen. The runtime only records the request (see
        // encastra_builtins::system), so the same graph runs headless in the CLI.
        if record.component.starts_with("encastra.system.notify@")
            && let Some(message) = record.outputs.get("message")
        {
            let _ = self.app.emit(events::NOTIFICATION, message.clone());
        }

        let _ = self.app.emit(
            events::NODE_FINISHED,
            NodeEvent {
                run_id: run_id.to_owned(),
                node: node.to_string(),
                record: Some(record.clone()),
            },
        );
    }

    fn run_finished(&self, journal: &RunJournal) {
        let _ = self.app.emit(events::RUN_FINISHED, journal.clone());
    }
}

fn announce(app: &tauri::AppHandle, status: Status) {
    let _ = app.emit(events::STATUS, status);
}

/// Assembles the grants for a run: declared input-handle scopes, plus whatever the user said
/// yes to. A manifest asking for something never grants it.
///
/// The one place grants are built. There used to be a second copy of this inside `run_graph`,
/// which is the way two security checks become one security check and one historical artefact.
///
/// Every grant arriving here came over IPC from the webview, and is treated accordingly:
///
/// * a grant for a node that is not in the graph is nothing;
/// * a grant for a capability the component's manifest never declared is nothing, because the
///   dialog that supposedly produced it is built from that manifest — see
///   [`GrantSet::grant_declared`];
/// * a folder is resolved and sanity-checked before it becomes a scope, so "the user picked a
///   folder" cannot arrive as "the user picked the C drive".
///
/// * a folder is refused unless the person chose it in the native chooser this session **to
///   give to a component**, which is what [`choose_folder`] records under
///   [`FolderPurpose::GrantToComponent`] — a path the editor merely *says* somebody picked is a
///   path a project file could have supplied, and a path picked to answer a different question
///   is an answer to a different question.
///
/// A refused grant is dropped rather than failing the run, and the reason is returned alongside
/// so the caller can say something useful. The component then asks the broker for the capability,
/// is denied, and the denial appears in the journal against the node that wanted it — which is
/// where somebody debugging would look, and is a record the editor cannot edit.
fn grant_set(
    graph: &Graph,
    registry: &InMemoryRegistry,
    grants: &[GrantSpec],
    chosen_folders: &BTreeSet<(FolderPurpose, PathBuf)>,
) -> (GrantSet, Vec<String>) {
    let mut set = GrantSet::new();
    let mut refused: Vec<String> = Vec::new();

    for (id, node) in &graph.nodes {
        if let Some(manifest) = registry.get(&node.component) {
            set.allow_declared_input_handles(id, manifest);
        }
    }

    for grant in grants {
        let node = NodeId(grant.node.clone());

        // The component this grant is about, by way of the graph. No node, no manifest, no
        // grant: there is nothing for it to be a decision about.
        let Some(manifest) = graph
            .nodes
            .get(&node)
            .and_then(|n| registry.get(&n.component))
        else {
            continue;
        };

        let scope = match (&grant.folder, &grant.hosts) {
            (Some(folder), _) => {
                match folder_chosen_for(
                    chosen_folders,
                    FolderPurpose::GrantToComponent,
                    Path::new(folder),
                ) {
                    Ok(resolved) => GrantScope::Directory(resolved),
                    Err(why) => {
                        // The node is named because a run can carry several grants and the
                        // person has to know which row of the dialog this is about. The folder
                        // is not, for the reason every message in this file leaves it out.
                        refused.push(format!("{}: {}", grant.node, why.message()));
                        continue;
                    }
                }
            }
            (None, Some(hosts)) => GrantScope::HttpHosts(hosts.clone()),
            (None, None) => GrantScope::Allowed,
        };

        if !set.grant_declared(&node, manifest, &grant.kind, scope) {
            refused.push(format!(
                "{}: this component does not ask for {}.",
                grant.node, grant.kind
            ));
        }
    }

    (set, refused)
}

/// The folders chosen this session, each tagged with what it was chosen for.
///
/// Purpose-tagged rather than a bare set of paths: every caller of this is about to ask a
/// specific question, and handing them the paths alone would let a folder answer a question
/// nobody put to the person. [`folder_chosen_for`] is what turns this into an answer.
fn chosen_folders(
    state: &tauri::State<'_, Runtime>,
) -> Result<BTreeSet<(FolderPurpose, PathBuf)>, String> {
    state
        .chosen_folders
        .lock()
        .map(|set| set.clone())
        .map_err(|_| "The runtime is busy.".to_owned())
}

fn seed_for(broker: &mut Broker, inputs: &[InputSpec]) -> Result<BTreeMap<PortRef, Value>, String> {
    let mut seed = BTreeMap::new();
    for input in inputs {
        let path = PathBuf::from(&input.path);
        let absolute = std::fs::canonicalize(&path)
            .map_err(|e| format!("Could not open {}: {}", path.display(), e.kind()))?;
        let kind = kind_for(&absolute);
        let handle = broker.import_file(absolute, kind);
        seed.insert(input.port_ref(), Value::Handle(handle));
    }
    Ok(seed)
}

/// Starts a workflow.
///
/// A graph with a trigger keeps going until it is stopped. A graph without one runs once, with
/// whatever the application supplied. Both report progress the same way, so the interface does
/// not have two shapes of "running" to keep in step.
#[tauri::command]
fn start_workflow(
    app: tauri::AppHandle,
    state: tauri::State<'_, Runtime>,
    graph: Graph,
    inputs: Vec<InputSpec>,
    grants: Vec<GrantSpec>,
) -> Result<Status, String> {
    {
        let running = state.running.lock().map_err(|_| "The runtime is busy.")?;
        if running.is_some() {
            return Err("A workflow is already running. Stop it before starting another.".into());
        }
    }

    let registry = state.registry.clone();
    let components = state.components.clone();
    let triggers = state.triggers.clone();

    let (allowed, refused) = grant_set(&graph, &registry, &grants, &chosen_folders(&state)?);
    if !refused.is_empty() {
        return Err(refused.join("\n"));
    }

    let run_id = format!("session-{}", encastra_core::journal::now_ms());
    // The same guard `run_graph` uses, for the same reason: three `?` sit between creating this
    // folder and the thread that used to remove it, and an input path that does not resolve
    // reached the first of them on every press of Run. The guard moves into the thread below,
    // so the folder lives exactly as long as the session does.
    let scratch = ScratchDir::new(std::env::temp_dir().join("encastra").join(&run_id));
    let mut broker = Broker::new(scratch.path().to_path_buf(), allowed)
        .map_err(|e| format!("Could not prepare a working folder: {e}"))?;

    let seed = seed_for(&mut broker, &inputs)?;

    let session = Session::start(
        graph.clone(),
        &registry,
        components.clone(),
        &triggers,
        run_id.clone(),
    )
    .map_err(|validation| {
        // The editor already shows the issues; this is the one-line version for the status bar.
        let errors = validation.errors().count();
        format!("This workflow cannot run yet: {errors} problem(s) to fix.")
    })?;

    let watching = session.has_triggers();
    let stop = session.stop_flag();

    {
        let mut running = state.running.lock().map_err(|_| "The runtime is busy.")?;
        *running = Some(Running {
            stop: Arc::clone(&stop),
            started_at_ms: encastra_core::journal::now_ms(),
        });
    }

    let thread_app = app.clone();
    std::thread::Builder::new()
        .name("encastra-workflow".into())
        .spawn(move || {
            let observer = Progress {
                app: thread_app.clone(),
            };
            let mut session = session;

            // The work is isolated from the bookkeeping that follows it.
            //
            // `panic = "abort"` is deliberately not set (see Cargo.toml), so that a component
            // which panics is a bug in one node rather than the end of the application. That
            // intent was only half true here: the panic unwound this thread, which meant every
            // line *after* this block was skipped — including the one that sets `state.running`
            // back to `None`. The application stayed up and never ran another workflow, because
            // it believed one was still running, until it was restarted.
            //
            // So: catch it, and let the cleanup below run either way. A panicking node now ends
            // the run, says so, and leaves the runtime able to start another one.
            let work = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                if watching {
                    while !session.is_stopped() {
                        let tick = session.tick(&registry, &mut broker, Some(&observer));
                        let (pending, dropped) = session.backlog();

                        let message = tick
                            .trigger_errors
                            .first()
                            .map(|(node, error)| format!("{node}: {error}"))
                            .or_else(|| {
                                (tick.dropped > 0).then(|| {
                                    format!("{} event(s) dropped — too many at once.", tick.dropped)
                                })
                            });

                        announce(
                            &thread_app,
                            Status {
                                running: true,
                                watching: true,
                                runs: session.runs_completed(),
                                pending,
                                dropped,
                                message,
                            },
                        );

                        // Sleeping for the whole interval would make Stop feel slow; a short cap
                        // keeps it immediate without polling the folder any harder.
                        let wait = session.quiet_for().min(Duration::from_millis(200));
                        if !wait.is_zero() {
                            std::thread::sleep(wait);
                        }
                    }
                } else {
                    let request = RunRequest {
                        graph: &graph,
                        registry: &registry,
                        components: &components,
                        cancel: &stop,
                        run_id: &run_id,
                        seed,
                        observer: Some(&observer),
                    };
                    if let Err(validation) = execute_request(request, &mut broker) {
                        announce(
                            &thread_app,
                            Status {
                                running: false,
                                watching: false,
                                runs: 0,
                                pending: 0,
                                dropped: 0,
                                message: Some(format!(
                                    "Nothing ran: {} problem(s) to fix first.",
                                    validation.errors().count()
                                )),
                            },
                        );
                    }
                }
            }));

            // Scratch space belongs to the run. Anything worth keeping was copied into a folder
            // the user allowed, by a component that asked. Dropping the guard removes it.
            drop(scratch);

            announce(
                &thread_app,
                Status {
                    running: false,
                    watching,
                    runs: session.runs_completed(),
                    pending: 0,
                    dropped: session.backlog().1,
                    // A panic is not an ordinary component failure, and saying "finished" would
                    // be a lie. The panic itself has already been printed by the default hook.
                    message: work.is_err().then(|| {
                        "This workflow stopped unexpectedly. You can start it again.".to_owned()
                    }),
                },
            );

            if let Some(state) = thread_app.try_state::<Runtime>()
                && let Ok(mut running) = state.running.lock()
            {
                *running = None;
            }
        })
        .map_err(|e| format!("Could not start the workflow: {e}"))?;

    Ok(Status {
        running: true,
        watching,
        runs: 0,
        pending: 0,
        dropped: 0,
        message: None,
    })
}

#[tauri::command]
fn stop_workflow(state: tauri::State<'_, Runtime>) -> Result<(), String> {
    let running = state.running.lock().map_err(|_| "The runtime is busy.")?;
    if let Some(running) = running.as_ref() {
        running.stop.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
fn workflow_status(state: tauri::State<'_, Runtime>) -> Status {
    let running = state.running.lock().ok().and_then(|r| {
        r.as_ref().map(|running| Status {
            running: true,
            watching: false,
            runs: 0,
            pending: 0,
            dropped: 0,
            message: Some(format!(
                "Running for {} seconds.",
                (encastra_core::journal::now_ms().saturating_sub(running.started_at_ms)) / 1000
            )),
        })
    });

    running.unwrap_or(Status {
        running: false,
        watching: false,
        runs: 0,
        pending: 0,
        dropped: 0,
        message: None,
    })
}

/// The version shown in Settings, taken from the build rather than typed anywhere.
/// What a prepared publication left on disk.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Prepared {
    bundle: PublicationBundle,
    /// The folder holding both files, so the interface can tell somebody where to look.
    folder: String,
}

/// Reads a saved project the way somebody receiving it would, and reports what it finds.
///
/// The project is read from disk rather than from the editor's canvas on purpose: what gets
/// published is the file, and the file is the only thing worth checking. An unsaved change is
/// not in it.
#[tauri::command]
fn review_publication(
    state: tauri::State<'_, Runtime>,
    path: String,
    license: License,
) -> Result<Review, String> {
    let project = Project::open(&project_path(&path)?).map_err(|e| e.to_string())?;
    Ok(encastra_publish::review(
        &project,
        &state.registry,
        &license,
    ))
}

/// Prepares a publication into a folder of its own, or refuses with the reason.
///
/// The review runs again here, and its result is the one that decides. The interface shows
/// somebody the findings first, but nothing it shows is what authorises this: a front end that
/// has been through a debugger, or simply a stale one, must not be able to publish something
/// this check refuses (`docs/THREAT-MODEL.md` T2 — the client is not a trust boundary).
///
/// Nothing is uploaded. There is no registry, so what this produces is a folder: the project
/// file and the document that would travel with it, both of which stay on this machine until
/// somewhere exists to send them.
#[tauri::command]
fn prepare_publication(
    state: tauri::State<'_, Runtime>,
    path: String,
    draft: PublicationDraft,
    publisher: Publisher,
    into: String,
) -> Result<Prepared, String> {
    let source = project_path(&path)?;
    // The folder is looked at without following it. A junction on Windows reads as a directory
    // while pointing anywhere at all, so a publication prepared "into" one would be written
    // somewhere other than where the person was told it went.
    match std::fs::symlink_metadata(&into) {
        Err(_) => return Err("That folder is not there. Choose one that exists.".to_owned()),
        Ok(meta) if meta.file_type().is_symlink() => {
            return Err(
                "That folder is a link to somewhere else, so what was written would land \
                 somewhere other than where you chose. Pick the folder itself."
                    .to_owned(),
            );
        }
        Ok(meta) if !meta.is_dir() => {
            return Err("That is a file, not a folder. A publication needs a folder.".to_owned());
        }
        Ok(_) => {}
    }

    let project = Project::open(&source).map_err(|e| e.to_string())?;
    let bytes = std::fs::read(&source).map_err(|e| e.to_string())?;

    let review = encastra_publish::review(&project, &state.registry, &draft.license);
    let runtime = project.manifest.runtime.clone();
    let bundle = PublicationBundle::prepare(
        draft,
        &publisher,
        &bytes,
        &runtime,
        &review,
        encastra_core::journal::now_ms(),
    )
    .map_err(|e| e.to_string())?;

    // The destination is resolved and has to be a folder the person chose in the native chooser
    // *to publish into*, for the same reason a folder grant does: `into` arrives as a string from
    // the webview, and a string from the webview is not evidence that anybody picked anything.
    // The Publish panel already opens the chooser with this purpose, so this costs a legitimate
    // flow nothing — and a folder somebody picked to import a publication *from* does not become
    // somewhere this command may write, which it used to.
    let destination = folder_chosen_for(
        &chosen_folders(&state)?,
        FolderPurpose::PublishInto,
        Path::new(&into),
    )
    .map_err(|why| why.message())?;

    // One folder per version, named after what is in it, so a second version does not land on
    // top of the first.
    //
    // Built from the resolved destination, and from a listing id that `PublicationBundle::prepare`
    // has already checked against the identifier grammar — so it holds no separator and no `..`.
    // The assertion below is the second half of that: a name is only safe as a path component if
    // the result actually stays under the folder it was joined to.
    let folder = destination.join(format!(
        "{id}-{version}",
        id = bundle.draft.listing_id,
        version = bundle.draft.version
    ));
    if !folder.starts_with(&destination) {
        return Err("That publication cannot be written where it was asked to go.".to_owned());
    }
    let document = folder.join("publication.json");
    if document.exists() {
        return Err(format!(
            "{} already holds a publication. Delete it or choose another folder.",
            folder.display()
        ));
    }
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;

    // The project is copied rather than moved: publishing must never be able to take somebody's
    // only copy of their own work.
    let name = source
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "project.encastra".to_string());
    std::fs::write(folder.join(&name), &bytes).map_err(|e| e.to_string())?;
    std::fs::write(
        &document,
        serde_json::to_vec_pretty(&bundle).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    let folder = folder.to_string_lossy().to_string();

    // A prepared publication is a folder somebody chose, not a file this software owns, so the
    // entry records where it is and nothing about deleting it. The checksum and size describe
    // the project inside; `status` never reads either for a folder — being there is the whole of
    // what can be said about one — but they are what this publication is, and worth keeping.
    state.library.remember(Entry {
        id: library_id(&folder),
        origin: Origin::Prepared,
        name: bundle.draft.title.clone(),
        description: Some(bundle.draft.summary.clone()),
        path: folder.clone(),
        added_at_ms: bundle.prepared_at_ms,
        last_opened_ms: None,
        modified_at_ms: bundle.prepared_at_ms,
        checksum: Some(bundle.checksum.clone()),
        size_bytes: Some(bundle.size_bytes),
        steps: project.graph.nodes.len(),
        runtime: bundle.runtime.clone(),
        listing_id: Some(bundle.draft.listing_id.clone()),
        version: Some(bundle.draft.version.clone()),
        publisher: Some(bundle.publisher.clone()),
        capabilities: bundle.capabilities.clone(),
    });

    Ok(Prepared { bundle, folder })
}

// -- the library ---------------------------------------------------------------------------
//
// An index of what somebody has: the projects they made, the ones they took in, and the ones
// they prepared to hand on. Three rules hold this end of it together.
//
// **Importing never opens or runs anything.** `import_publication` copies verified bytes into a
// folder this software owns and adds a line to a list. What happens next is a separate decision
// somebody makes by pressing Open, and then Run.
//
// **An index that could not be read is never written over.** A file this build cannot parse is
// moved aside by the crate and said so once. A file from another version, or one larger than
// this build holds, is left exactly as it is and every command that would write says why it
// will not — those are somebody's record of their own work, and "start fresh" would destroy it.
//
// **Only the copies this software made may be deleted.** A created project's file belongs to
// the person who made it. Removing it from the list is forgetting; it is not deleting, and the
// two are never the same call.

/// The index, and whether it may be written to.
struct LibraryHandle {
    /// Created on demand rather than at start-up: somebody who never imports anything should
    /// not find an empty folder they did not ask for.
    root: PathBuf,
    /// `Err` holds the sentence to show instead of doing anything. See the note above.
    index: Mutex<Result<Library, String>>,
    /// The name the unreadable index was moved to, if there was one. Reported once and then
    /// forgotten: it is news the first time the list is drawn and noise every time after.
    quarantined: Mutex<Option<String>>,
}

/// One entry with the answer to "is it still there, and still what it was", computed now.
///
/// Computed rather than stored, because a stored answer is out of date the moment somebody
/// touches the file in another program — which they will, since these are ordinary files.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct EntryWithStatus {
    entry: Entry,
    status: LibraryStatus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LibraryListing {
    entries: Vec<EntryWithStatus>,
    /// Set once, on the first listing after an unreadable index was moved aside.
    quarantined: Option<String>,
}

/// What to say when a lock is held by a thread that panicked while holding it.
const LIBRARY_BUSY: &str = "The library is busy. Try that again.";

impl LibraryHandle {
    fn open(root: PathBuf) -> LibraryHandle {
        match Library::load_or_quarantine(&root) {
            Ok(Recovered {
                library,
                quarantined_as,
            }) => LibraryHandle {
                root,
                index: Mutex::new(Ok(library)),
                quarantined: Mutex::new(quarantined_as),
            },
            // Readable but not by this build, or too large to hold. Neither is a reason to
            // replace it, so the handle carries the refusal instead of a library.
            Err(reason) => LibraryHandle {
                root,
                index: Mutex::new(Err(reason.to_string())),
                quarantined: Mutex::new(None),
            },
        }
    }

    fn read<T>(&self, of: impl FnOnce(&Library) -> T) -> Result<T, String> {
        let guard = self.index.lock().map_err(|_| LIBRARY_BUSY.to_owned())?;
        match guard.as_ref() {
            Ok(library) => Ok(of(library)),
            Err(reason) => Err(reason.clone()),
        }
    }

    /// Changes the index and writes it, or changes nothing at all.
    ///
    /// The change is applied to a copy and the copy is saved first. Memory moves forward only
    /// once the disk has: otherwise a failed save would leave the running application believing
    /// in an entry that the next successful save would write out as fact.
    fn edit<T>(&self, change: impl FnOnce(&mut Library) -> Result<T, String>) -> Result<T, String> {
        let mut guard = self.index.lock().map_err(|_| LIBRARY_BUSY.to_owned())?;
        let library = guard.as_mut().map_err(|reason| reason.clone())?;
        let mut candidate = library.clone();
        let outcome = change(&mut candidate)?;
        candidate.save(&self.root).map_err(|e| e.to_string())?;
        *library = candidate;
        Ok(outcome)
    }

    /// Records something that was just saved, opened or prepared.
    ///
    /// Failure is reported to the log and swallowed: somebody who pressed Save wanted their
    /// file written, and it was. An index that did not keep up is a worse session, not a lost
    /// one, and turning it into a failed save would be the tail wagging the dog.
    fn remember(&self, entry: Entry) {
        if let Err(reason) = self.edit(|library| {
            library.upsert(entry);
            Ok(())
        }) {
            eprintln!("[library] the index was not updated: {reason}");
        }
    }
}

/// A short, stable name for something that has no listing and no version to be named after.
///
/// Sixteen hex characters of a sha256 of the path, which is exactly what
/// `encastra_library::entry_for_project` derives its own identity from — the two have to agree,
/// or the same thing saved and then prepared would appear twice under two names.
fn library_id(text: &str) -> String {
    encastra_project::hash(text.as_bytes())[..16].to_owned()
}

/// Reads a publication folder and reports what is in it. Writes nothing; runs nothing.
///
/// The folder is handed to the crate as it was chosen. Whether it is a folder at all, whether
/// it is a link to somewhere else, and whether it holds what a publication holds are the
/// crate's questions to answer, and it refuses each of them by name rather than by a message
/// this file would have to keep in step.
/// The source folder of a publication has to be one the person picked in the native chooser
/// this session **to import from** — the same rule a folder grant follows, for the same reason:
/// `folder` arrives from the webview as a string, and a string is not a decision. A folder
/// picked to publish into, or browsed for in Settings, is not an answer to "read a publication
/// out of here" and no longer counts as one. The crate then refuses links, non-folders and
/// everything else about the folder's contents on its own.
fn chosen_publication_folder(
    state: &tauri::State<'_, Runtime>,
    folder: &str,
) -> Result<PathBuf, ImportError> {
    let chosen = chosen_folders(state).map_err(|reason| ImportError::Io { reason })?;
    folder_chosen_for(&chosen, FolderPurpose::ImportFrom, Path::new(folder)).map_err(|why| {
        match why {
            // `NotAFolder` rather than the reason: this is the vocabulary the interface already
            // matches on, and the reasons `resolve_grant_directory` gives — a root, a system
            // tree — are all true of a path that is not a publication folder.
            ConsentError::NotUsable { .. } => ImportError::NotAFolder,
            ConsentError::NotChosen { .. } => ImportError::FolderNotChosen,
        }
    })
}

#[tauri::command]
fn inspect_publication(
    state: tauri::State<'_, Runtime>,
    folder: String,
) -> Result<Inspected, ImportError> {
    let folder = chosen_publication_folder(&state, &folder)?;
    encastra_publish::import::inspect(&folder, &state.registry, encastra_core::RUNTIME_VERSION)
}

/// Takes a publication in, and does nothing else with it.
///
/// Nothing is opened and nothing is run. The bytes that were checked are the bytes that are
/// kept — the crate copies what it verified rather than reading the source a second time — and
/// what comes back is the entry, so the interface can decide whether to offer to open it.
#[tauri::command]
fn import_publication(
    state: tauri::State<'_, Runtime>,
    folder: String,
) -> Result<Entry, ImportError> {
    let folder = chosen_publication_folder(&state, &folder)?;
    let imported = encastra_publish::import::import(
        &folder,
        &state.registry,
        encastra_core::RUNTIME_VERSION,
        &state.library.root,
    )?;

    let entry = encastra_library::entry_for_import(&imported, encastra_core::journal::now_ms());
    if let Err(reason) = state.library.edit(|library| {
        library.upsert(entry.clone());
        Ok(())
    }) {
        // The copy landed and the index does not know about it. A folder nothing in the
        // application can see, open or account for is worse than no import at all, so it goes
        // back — through the crate's own check that it is inside `imports/`, never a bare
        // delete of a path that came out of a file.
        let _ = encastra_library::remove_imported_copy(&state.library.root, &entry);
        return Err(ImportError::Io { reason });
    }
    Ok(entry)
}

/// Everything in the index, each with the answer to whether it is still there.
#[tauri::command]
fn library_list(state: tauri::State<'_, Runtime>) -> Result<LibraryListing, String> {
    let entries = state.library.read(|library| {
        library
            .entries
            .iter()
            .map(|entry| EntryWithStatus {
                status: encastra_library::status(entry),
                entry: entry.clone(),
            })
            .collect::<Vec<_>>()
    })?;

    let quarantined = state
        .library
        .quarantined
        .lock()
        .map_err(|_| LIBRARY_BUSY.to_owned())?
        .take();

    Ok(LibraryListing {
        entries,
        quarantined,
    })
}

/// Forgets an entry, and — only for a copy this software made — deletes it too.
///
/// The two are separate decisions and the caller says which it means. A project somebody made
/// is refused outright: this software did not put that file there and does not get to remove
/// it, whatever an index that can be edited by hand happens to claim about it.
#[tauri::command]
fn library_remove(
    state: tauri::State<'_, Runtime>,
    id: String,
    delete_copy: bool,
) -> Result<(), String> {
    let found = state.library.read(|library| library.find(&id).cloned())?;
    let Some(entry) = found else {
        // Already not there. That is the state that was asked for, so it is not a complaint.
        return Ok(());
    };

    // Checked before anything is removed from the index, so a refusal leaves the library
    // exactly as it was rather than half-done.
    if delete_copy && entry.origin != Origin::Imported {
        return Err(
            "That file is yours, and it stays where it is. Encastra only deletes copies it \
             made itself, which means things you imported."
                .to_owned(),
        );
    }

    state.library.edit(|library| {
        library.remove(&id);
        Ok(())
    })?;

    if delete_copy {
        // The index is already saved. If the folder will not go, the entry is still forgotten —
        // which is what was asked — and saying so is better than pretending the files are gone.
        encastra_library::remove_imported_copy(&state.library.root, &entry).map_err(|e| {
            format!("It is out of your library, but the copy could not be deleted: {e}")
        })?;
    }
    Ok(())
}

/// The editor telling this side whether there is unsaved work in the window.
///
/// Called on every transition, not on every edit: `dirty` changes twice in a session where
/// somebody saves once, and a message per keystroke would be a great deal of traffic for a
/// boolean.
#[tauri::command]
fn report_dirty(state: tauri::State<'_, Runtime>, dirty: bool) {
    state.dirty.store(dirty, Ordering::Relaxed);
}

/// Closes the window, after the person has said the unsaved work may go.
///
/// The flag is set before the close is asked for, so [`should_prevent_close`] lets this one
/// through. It is never cleared: the window is going, and the only thing that could read it
/// afterwards is a second close of a window that no longer exists.
#[tauri::command]
fn close_window(app: tauri::AppHandle, state: tauri::State<'_, Runtime>) -> Result<(), String> {
    state.closing.store(true, Ordering::Relaxed);
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "There is no window to close.".to_owned())?;
    window
        .close()
        .map_err(|_| "The window refused to close.".to_owned())
}

/// The commit this binary was built from, as one string the release manifest can find in the
/// built file.
///
/// `build.rs` sets `ENCASTRA_BUILD_COMMIT` to the commit the tree was at — `<hash>-dirty` if the
/// tree did not match it, `unknown` without git. It is embedded between fixed markers so that
/// `scripts/release_manifest.py` can read it back out of `encastra-desktop.exe` rather than ask
/// git at manifest time, which named the wrong commit by construction (ENC-NEW-17): the commit
/// that publishes a manifest is always one after the commit whose bytes the manifest describes.
pub const BUILD_STAMP: &str = concat!("encastra-build-commit=", env!("ENCASTRA_BUILD_COMMIT"), ";");

/// `BUILD_STAMP` without its markers: what Settings shows.
pub fn build_commit() -> &'static str {
    BUILD_STAMP
        .strip_prefix("encastra-build-commit=")
        .and_then(|rest| rest.strip_suffix(';'))
        .unwrap_or(BUILD_STAMP)
}

#[tauri::command]
fn about() -> serde_json::Value {
    serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "buildCommit": build_commit(),
        "runtime": encastra_core::RUNTIME_VERSION,
        "protocolSchema": encastra_protocol::SCHEMA_VERSION,
        "projectSchema": encastra_project::PROJECT_SCHEMA,
    })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // A window closed with unsaved work in it takes the work with it, and nothing about a
        // title-bar X passes through the editor on its way. So the close is refused here, where
        // the answer is already known, and the editor is told to ask — it closes the window
        // itself, through `close_window`, once somebody has said the work may go.
        //
        // Refusing is safe in a way that asking would not be: if the editor never answers, the
        // window stays open with the work still in it. The opposite arrangement — let it close
        // and hope the question is answered in time — has exactly one failure mode, and it is
        // the one this exists to prevent.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Before `setup` has run there is no state, and nothing has been edited either:
                // a close that early carries no work with it and may simply happen.
                let Some(state) = window.try_state::<Runtime>() else {
                    return;
                };
                if should_prevent_close(
                    state.dirty.load(Ordering::Relaxed),
                    state.closing.load(Ordering::Relaxed),
                ) {
                    api.prevent_close();
                    // If this never arrives the window stays open, which is the safe half of
                    // the failure: nothing is lost, and the person can try again.
                    let _ = window.emit("encastra://close-requested", ());
                }
            }
        })
        // The managed state is built here rather than before the builder because the library
        // needs to know where this application's own data lives, and only an app handle knows.
        .setup(|app| {
            let installed = encastra_builtins::install_all();

            // Beside the application's data, not beside anybody's projects: this is an index
            // this software owns and may rewrite, and the projects it names are not. The folder
            // is not created here — nothing is written until there is something to write.
            let library_root = app.path().app_data_dir()?.join("library");

            app.manage(Runtime {
                registry: installed.registry,
                components: installed.components,
                triggers: installed.triggers,
                running: Mutex::new(None),
                chosen_folders: Mutex::new(BTreeSet::new()),
                library: LibraryHandle::open(library_root),
                // Nothing has been edited yet, and nobody has decided to close anything.
                dirty: AtomicBool::new(false),
                closing: AtomicBool::new(false),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            choose_folder,
            list_components,
            type_graph,
            validate_graph,
            run_graph,
            save_project,
            open_project,
            restore_version,
            compare_versions,
            start_workflow,
            stop_workflow,
            workflow_status,
            review_publication,
            prepare_publication,
            inspect_publication,
            import_publication,
            library_list,
            library_remove,
            report_dirty,
            close_window,
            about
        ])
        .run(tauri::generate_context!())
        .expect("the application window could not be created");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_project_is_recognised_by_its_extension_whatever_its_case() {
        assert!(is_project_path(Path::new("thumbnails.encastra")));
        assert!(is_project_path(Path::new("Thumbnails.ENCASTRA")));
        assert!(is_project_path(Path::new(r"C:\work\my project.Encastra")));
        assert!(is_project_path(Path::new("/home/alice/notes.encastra")));
    }

    #[test]
    fn nothing_else_is_a_project() {
        // A name that merely contains the word, a name with the extension in the middle, and a
        // folder that happens to be called one. Each of these reached `Project::open` before.
        assert!(!is_project_path(Path::new("thumbnails.encastra.txt")));
        assert!(!is_project_path(Path::new("encastra")));
        assert!(!is_project_path(Path::new("notes.txt")));
        assert!(!is_project_path(Path::new("")));
        assert!(!is_project_path(Path::new("my-encastra-backups")));
    }

    #[test]
    fn the_guard_says_what_is_wrong_rather_than_where() {
        // The message names the rule, never the path: these end up in logs and on screen, and
        // the path is somebody's home folder.
        let refused = project_path("notes.txt").expect_err("a .txt is not a project");
        assert_eq!(refused, NOT_A_PROJECT);
        assert!(!refused.contains("notes.txt"));
        assert!(project_path("thumbnails.encastra").is_ok());
    }

    #[test]
    fn a_close_is_stopped_only_while_there_is_unsaved_work_nobody_has_decided_about() {
        // The ordinary close of a saved window: nothing to ask about, so nothing is asked.
        assert!(!should_prevent_close(false, false));
        // Work in the window, and no decision yet: this is the one the feature exists for.
        assert!(should_prevent_close(true, false));
        // The person said the work may go, and the editor is now closing the window itself.
        // Stopping this one would mean a window that cannot be closed at all — the failure
        // that turns a safeguard into a trap.
        assert!(!should_prevent_close(true, true));
        assert!(!should_prevent_close(false, true));
    }

    #[test]
    fn a_handle_kind_is_guessed_from_the_extension_and_nothing_else() {
        assert_eq!(kind_for(Path::new("a.png")), HandleKind::Image);
        assert_eq!(kind_for(Path::new("a.JPEG")), HandleKind::Image);
        assert_eq!(kind_for(Path::new("a.mp4")), HandleKind::Video);
        assert_eq!(kind_for(Path::new("a.flac")), HandleKind::Audio);
        // Anything unrecognised is a file, which is the honest answer: the guess is a hint, and
        // the component that decodes it is where a wrong one is actually found out.
        assert_eq!(kind_for(Path::new("a.csv")), HandleKind::File);
        assert_eq!(kind_for(Path::new("a")), HandleKind::File);
        assert_eq!(kind_for(Path::new("a.png.txt")), HandleKind::File);
    }

    #[test]
    fn a_prepared_folders_identity_matches_how_the_library_names_a_path() {
        // The two have to agree, or the same thing saved and then prepared would appear twice
        // under two different names. This is `encastra_library`'s own `identity_of`.
        let path = r"C:\work\dev.alice.thumbnails-1.0.0";
        assert_eq!(
            library_id(path),
            encastra_project::hash(path.as_bytes())[..16]
        );
        assert_eq!(library_id(path).len(), 16);
        assert_ne!(library_id(path), library_id(&format!("{path}.encastra")));
    }

    /// A component that reads and writes files, so a grant for either is something it declares.
    fn manifest() -> ComponentManifest {
        ComponentManifest::parse(
            &serde_json::json!({
                "schema": 1, "id": "test.saver", "version": "1.0.0", "name": "Saver",
                "runtime": ">=0.1.0", "kind": "core",
                "ports": {
                    "inputs": { "in": { "type": "file" } },
                    "outputs": { "out": { "type": "file" } }
                },
                "capabilities": [
                    { "kind": "fs.read", "scope": "input-handles", "reason": "It reads what you connect." },
                    { "kind": "fs.write", "scope": "folder", "reason": "It saves the result where you say." }
                ]
            })
            .to_string(),
        )
        .expect("the fixture manifest must be valid, or nothing below means anything")
    }

    fn fixture() -> (Graph, InMemoryRegistry) {
        let mut registry = InMemoryRegistry::new();
        registry.insert(manifest()).expect("one component");

        let graph = Graph::parse(
            &serde_json::json!({
                "nodes": {
                    "save": { "component": "test.saver@1.0.0", "position": { "x": 0, "y": 0 } }
                },
                "edges": []
            })
            .to_string(),
        )
        .expect("the fixture graph must parse");

        (graph, registry)
    }

    fn folder_grant(path: &Path) -> GrantSpec {
        GrantSpec {
            node: "save".into(),
            kind: "fs.write".into(),
            folder: Some(path.to_string_lossy().into_owned()),
            hosts: None,
        }
    }

    /// A temporary directory that cleans up after itself.
    fn temp_dir(tag: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("encastra-lib-{}-{tag}", std::process::id()));
        std::fs::create_dir_all(&path).expect("temp dir");
        path
    }

    /// The record [`choose_folder`] would have left after somebody picked `dir` for `purpose`.
    ///
    /// Built the same way the command builds it — resolved, then paired — so a test that passes
    /// here is a test about the real record and not about a shape only the tests use.
    fn chosen_for(purpose: FolderPurpose, dir: &Path) -> BTreeSet<(FolderPurpose, PathBuf)> {
        BTreeSet::from([(
            purpose,
            resolve_grant_directory(dir).expect("the fixture folder must be usable"),
        )])
    }

    #[test]
    fn the_fixture_grants_when_the_folder_was_actually_chosen() {
        // The control. Every refusal below has to be about the thing it names, and that argument
        // only holds if the same shapes are admitted when the condition is met.
        let dir = temp_dir("chosen");
        let (graph, registry) = fixture();
        let chosen = chosen_for(FolderPurpose::GrantToComponent, &dir);

        let (set, refused) = grant_set(&graph, &registry, &[folder_grant(&dir)], &chosen);

        assert!(refused.is_empty(), "{refused:?}");
        assert!(set.has(&NodeId("save".into()), "fs.write"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_folder_the_person_never_chose_is_not_granted_however_it_arrived() {
        // The finding this closes. A `.encastra` file written by somebody else supplies the
        // string in a node's config; the editor shows it accurately and sends it back when a
        // person clicks Allow. Nothing in that chain tells the runtime whether anybody ever
        // picked it — so the runtime keeps its own record, and this is what that record is for.
        let dir = temp_dir("unchosen");
        let (graph, registry) = fixture();

        let (set, refused) = grant_set(&graph, &registry, &[folder_grant(&dir)], &BTreeSet::new());

        assert!(!set.has(&NodeId("save".into()), "fs.write"));
        assert_eq!(refused.len(), 1);
        assert!(refused[0].contains("Choose"), "{}", refused[0]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn choosing_one_folder_does_not_grant_a_different_one() {
        // The record is of specific folders, not of the act of having chosen at all.
        let chosen_dir = temp_dir("a");
        let other_dir = temp_dir("b");
        let (graph, registry) = fixture();
        let chosen = chosen_for(FolderPurpose::GrantToComponent, &chosen_dir);

        let (set, refused) = grant_set(&graph, &registry, &[folder_grant(&other_dir)], &chosen);

        assert!(!set.has(&NodeId("save".into()), "fs.write"));
        assert_eq!(refused.len(), 1);
        let _ = std::fs::remove_dir_all(&chosen_dir);
        let _ = std::fs::remove_dir_all(&other_dir);
    }

    // --- consent is per purpose ---------------------------------------------------------
    //
    // The record used to be a bare set of paths, so "I picked this folder to import a
    // publication from" also answered "may this component write here" and "may a publication be
    // written into this". Three sentences, one of which the person read. Everything below is
    // about the pair, and each test names the substitution it refuses.

    #[test]
    fn a_folder_chosen_for_one_purpose_answers_only_that_purpose() {
        // The matrix, written out rather than argued about: for every purpose, the folder
        // recorded under it passes that one check and fails the other three.
        let dir = temp_dir("purpose-matrix");
        let all = [
            FolderPurpose::PublishInto,
            FolderPurpose::ImportFrom,
            FolderPurpose::GrantToComponent,
            FolderPurpose::ProjectsLocation,
        ];

        for recorded in all {
            let chosen = chosen_for(recorded, &dir);
            for asked in all {
                let outcome = folder_chosen_for(&chosen, asked, &dir);
                if asked == recorded {
                    assert!(
                        outcome.is_ok(),
                        "{recorded:?} must answer its own question, and did not"
                    );
                } else {
                    assert_eq!(
                        outcome,
                        Err(ConsentError::NotChosen { purpose: asked }),
                        "a folder chosen for {recorded:?} must not answer {asked:?}"
                    );
                }
            }
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_folder_chosen_to_import_from_is_not_a_folder_a_component_may_write_into() {
        // The finding, in the shape it actually takes: Import opens the chooser, the person
        // picks a folder to read a publication out of, and the graph on the canvas has a Save
        // step configured — by a project file somebody sent — with that same folder in it.
        // Under one shared set, clicking Allow granted it.
        let dir = temp_dir("import-not-grant");
        let (graph, registry) = fixture();
        let chosen = chosen_for(FolderPurpose::ImportFrom, &dir);

        let (set, refused) = grant_set(&graph, &registry, &[folder_grant(&dir)], &chosen);

        assert!(!set.has(&NodeId("save".into()), "fs.write"));
        assert_eq!(refused.len(), 1);
        assert!(refused[0].contains("Choose"), "{}", refused[0]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_folder_chosen_to_publish_into_is_not_a_folder_to_import_from() {
        // The other direction, and the one that reaches a different command: Publish records a
        // destination, and `inspect_publication`/`import_publication` must not read from it on
        // the strength of that. The typed refusal is what the interface matches on.
        let dir = temp_dir("publish-not-import");
        let chosen = chosen_for(FolderPurpose::PublishInto, &dir);

        assert_eq!(
            folder_chosen_for(&chosen, FolderPurpose::ImportFrom, &dir),
            Err(ConsentError::NotChosen {
                purpose: FolderPurpose::ImportFrom
            })
        );
        // And the shape the command turns that into — `folder-not-chosen` on the wire, which
        // `library.ts` already has a sentence for in six languages.
        assert_eq!(
            match folder_chosen_for(&chosen, FolderPurpose::ImportFrom, &dir) {
                Err(ConsentError::NotChosen { .. }) => ImportError::FolderNotChosen,
                other => panic!("expected a refusal about the record, got {other:?}"),
            },
            ImportError::FolderNotChosen
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_purpose_the_editor_invents_for_itself_finds_nothing() {
        // The forged-purpose case. The editor is the one that names the purpose, so it can
        // name one the chooser was never opened with — and that is the whole of what it gains:
        // a lookup that finds nothing. Naming a purpose is not the same as having an entry
        // under it, and there is no command that puts one there.
        let dir = temp_dir("forged-purpose");
        // Nothing was ever chosen. Every purpose the editor could name fails alike.
        let empty: BTreeSet<(FolderPurpose, PathBuf)> = BTreeSet::new();
        for asked in [
            FolderPurpose::PublishInto,
            FolderPurpose::ImportFrom,
            FolderPurpose::GrantToComponent,
            FolderPurpose::ProjectsLocation,
        ] {
            assert_eq!(
                folder_chosen_for(&empty, asked, &dir),
                Err(ConsentError::NotChosen { purpose: asked })
            );
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_purpose_this_build_does_not_have_is_not_a_purpose() {
        // The wire names, pinned. The editor sends one of these four strings; anything else
        // fails to deserialise before a chooser is opened, which is why the enum is closed.
        // `apps/desktop/test/consent.test.ts` asserts the TypeScript union matches this list.
        for (wire, purpose) in [
            ("publish-into", FolderPurpose::PublishInto),
            ("import-from", FolderPurpose::ImportFrom),
            ("grant-to-component", FolderPurpose::GrantToComponent),
            ("projects-location", FolderPurpose::ProjectsLocation),
        ] {
            let json = format!("\"{wire}\"");
            assert_eq!(
                serde_json::from_str::<FolderPurpose>(&json).expect("a purpose this build has"),
                purpose
            );
            assert_eq!(serde_json::to_string(&purpose).unwrap(), json);
        }
        assert!(serde_json::from_str::<FolderPurpose>("\"anything\"").is_err());
        assert!(serde_json::from_str::<FolderPurpose>("\"PublishInto\"").is_err());
    }

    // --- the path that arrives is never the path that is compared ----------------------------

    #[test]
    fn a_path_that_walks_out_of_the_chosen_folder_is_refused() {
        // `..` is the cheapest substitution there is, and it costs nothing to try: the editor
        // sends the folder it was told about with a tail on it. What is compared is the
        // canonical path, so the comparison is against the folder it walks *to*.
        let base = temp_dir("traversal");
        let chosen_dir = base.join("chosen");
        let elsewhere = base.join("elsewhere");
        std::fs::create_dir_all(&chosen_dir).unwrap();
        std::fs::create_dir_all(&elsewhere).unwrap();
        let chosen = chosen_for(FolderPurpose::GrantToComponent, &chosen_dir);

        let sideways = chosen_dir.join("..").join("elsewhere");
        assert_eq!(
            folder_chosen_for(&chosen, FolderPurpose::GrantToComponent, &sideways),
            Err(ConsentError::NotChosen {
                purpose: FolderPurpose::GrantToComponent
            })
        );

        // And the loop that comes back to where it started is the folder that was chosen, so
        // the rule is about where a path resolves and not about how it is spelled.
        let circular = chosen_dir.join("..").join("chosen");
        assert!(folder_chosen_for(&chosen, FolderPurpose::GrantToComponent, &circular).is_ok());

        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn a_folder_spelled_differently_is_still_the_same_folder() {
        // Trailing separator, `.` in the middle, and — on Windows — a different case and the
        // verbatim `\\?\` form. Every one of these resolves to the folder that was chosen, so
        // every one of them is admitted. Refusing them would be a chooser somebody used and a
        // flow that still said no.
        let dir = temp_dir("spellings");
        let chosen = chosen_for(FolderPurpose::PublishInto, &dir);
        let text = dir.to_string_lossy().into_owned();

        let mut spellings = vec![
            format!("{text}{}", std::path::MAIN_SEPARATOR),
            format!("{text}{}.", std::path::MAIN_SEPARATOR),
        ];
        if cfg!(windows) {
            // NTFS and ReFS are case-insensitive, so this *is* the same folder and the
            // canonical form proves it. On a case-sensitive volume it would be a different
            // folder, and refusing it would be correct — which is why this is behind the cfg.
            spellings.push(text.to_uppercase());
            spellings.push(
                resolve_grant_directory(&dir)
                    .unwrap()
                    .to_string_lossy()
                    .into_owned(),
            );
        }

        for spelling in spellings {
            assert!(
                folder_chosen_for(&chosen, FolderPurpose::PublishInto, Path::new(&spelling))
                    .is_ok(),
                "{spelling} is the folder that was chosen, spelled differently"
            );
        }

        // A sibling whose name merely starts the same way is not it. Prefix matching would
        // have admitted this one.
        let sibling = PathBuf::from(format!("{text}-2"));
        std::fs::create_dir_all(&sibling).unwrap();
        assert_eq!(
            folder_chosen_for(&chosen, FolderPurpose::PublishInto, &sibling),
            Err(ConsentError::NotChosen {
                purpose: FolderPurpose::PublishInto
            })
        );

        let _ = std::fs::remove_dir_all(&sibling);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// A directory junction, by whichever means this machine allows.
    ///
    /// `symlink_dir` needs `SeCreateSymbolicLinkPrivilege` or Developer Mode; `mklink /J`
    /// makes a junction, which an ordinary account may create. Returns whether one exists at
    /// `link` afterwards, so the caller can say plainly that it could not build the fixture
    /// rather than passing on having tested nothing.
    #[cfg(windows)]
    fn make_directory_link(target: &Path, link: &Path) -> bool {
        if std::os::windows::fs::symlink_dir(target, link).is_ok() {
            return true;
        }
        let _ = std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(link)
            .arg(target)
            .output();
        std::fs::symlink_metadata(link).is_ok()
    }

    #[cfg(windows)]
    #[test]
    fn a_junction_is_whatever_it_points_at_and_nothing_else() {
        // A junction reads as a directory and points anywhere at all. The two halves of the
        // property: one pointing somewhere else is not the chosen folder however it is spelled,
        // and one pointing at the chosen folder *is* the chosen folder, because what is
        // compared is what the path resolves to.
        let base = temp_dir("junction");
        let chosen_dir = base.join("chosen");
        let elsewhere = base.join("elsewhere");
        std::fs::create_dir_all(&chosen_dir).unwrap();
        std::fs::create_dir_all(&elsewhere).unwrap();

        let decoy = base.join("decoy-link");
        if !make_directory_link(&elsewhere, &decoy) {
            // Neither a symlink nor a junction could be created here. The property still holds;
            // this run cannot build the fixture that demonstrates it, and says so rather than
            // reporting a pass it did not earn.
            eprintln!("skipped: this machine would not create a directory link");
            let _ = std::fs::remove_dir_all(&base);
            return;
        }

        let chosen = chosen_for(FolderPurpose::GrantToComponent, &chosen_dir);
        assert_eq!(
            folder_chosen_for(&chosen, FolderPurpose::GrantToComponent, &decoy),
            Err(ConsentError::NotChosen {
                purpose: FolderPurpose::GrantToComponent
            }),
            "a link to somewhere else is not the folder that was chosen"
        );

        // And through the grant builder, which is the path a run actually takes.
        let (graph, registry) = fixture();
        let (set, refused) = grant_set(&graph, &registry, &[folder_grant(&decoy)], &chosen);
        assert!(!set.has(&NodeId("save".into()), "fs.write"));
        assert_eq!(refused.len(), 1);

        let honest = base.join("honest-link");
        if make_directory_link(&chosen_dir, &honest) {
            assert!(
                folder_chosen_for(&chosen, FolderPurpose::GrantToComponent, &honest).is_ok(),
                "a link to the chosen folder resolves to the chosen folder"
            );
        }

        let _ = std::fs::remove_dir_all(&base);
    }

    // --- nothing survives the process --------------------------------------------------------

    /// A `Runtime` built the way `setup` builds one, minus the app handle.
    fn fresh_runtime(library_root: PathBuf) -> Runtime {
        let installed = encastra_builtins::install_all();
        Runtime {
            registry: installed.registry,
            components: installed.components,
            triggers: installed.triggers,
            running: Mutex::new(None),
            chosen_folders: Mutex::new(BTreeSet::new()),
            library: LibraryHandle::open(library_root),
            dirty: AtomicBool::new(false),
            closing: AtomicBool::new(false),
        }
    }

    #[test]
    fn a_fresh_runtime_has_chosen_nothing_and_a_restart_forgets_what_the_last_one_chose() {
        // A remembered choice that survived a restart would be a grant nobody made today,
        // sitting somewhere the editor can read. The record is a `Mutex` in memory and there is
        // no code that writes it anywhere — this is the test that says so, and it would fail
        // the moment somebody added persistence without also deciding it was a good idea.
        let base = temp_dir("session");
        let library_root = base.join("library");
        let picked = base.join("picked");
        std::fs::create_dir_all(&picked).unwrap();
        let resolved = resolve_grant_directory(&picked).unwrap();

        let first = fresh_runtime(library_root.clone());
        assert!(
            first.chosen_folders.lock().unwrap().is_empty(),
            "a runtime that has just started has been asked nothing"
        );
        first
            .chosen_folders
            .lock()
            .unwrap()
            .insert((FolderPurpose::GrantToComponent, resolved.clone()));
        assert_eq!(first.chosen_folders.lock().unwrap().len(), 1);
        drop(first);

        let second = fresh_runtime(library_root.clone());
        assert!(
            second.chosen_folders.lock().unwrap().is_empty(),
            "the next run of the application starts from nothing"
        );

        // And the choice is not sitting in this application's own data either — the library
        // index is the only file it writes, and a folder somebody picked has no business in it.
        let needle = resolved.to_string_lossy().to_lowercase();
        let mut looked_at = 0usize;
        if let Ok(entries) = std::fs::read_dir(&library_root) {
            for entry in entries.flatten() {
                if let Ok(text) = std::fs::read_to_string(entry.path()) {
                    looked_at += 1;
                    assert!(
                        !text.to_lowercase().contains(&needle),
                        "{} names a folder that was only ever chosen in memory",
                        entry.path().display()
                    );
                }
            }
        }
        // Nothing was written at all, which is the stronger answer and the one expected here.
        assert_eq!(looked_at, 0, "no file is written by choosing a folder");

        let _ = std::fs::remove_dir_all(&base);
    }

    // --- calling the commands' checks with a path nobody chose -------------------------------

    #[test]
    fn a_never_chosen_path_is_refused_by_every_gate_there_is() {
        // The IPC bypass, which needs no bug to attempt: the editor calls the command with a
        // path string it made up. Each gate is asked in turn about a folder that exists, is
        // perfectly ordinary, and was never in front of anybody in a chooser.
        let dir = temp_dir("never-chosen");
        let nothing: BTreeSet<(FolderPurpose, PathBuf)> = BTreeSet::new();

        // Publish into — what `prepare_publication` consults before it writes anything.
        assert_eq!(
            folder_chosen_for(&nothing, FolderPurpose::PublishInto, &dir),
            Err(ConsentError::NotChosen {
                purpose: FolderPurpose::PublishInto
            })
        );
        // Import from — what `inspect_publication` and `import_publication` consult before they
        // read anything, and the refusal the interface names.
        assert_eq!(
            folder_chosen_for(&nothing, FolderPurpose::ImportFrom, &dir),
            Err(ConsentError::NotChosen {
                purpose: FolderPurpose::ImportFrom
            })
        );
        // Grant — what `run_graph` and `start_workflow` consult before a component is given
        // anything, through the builder rather than the helper, because that is the real path.
        let (graph, registry) = fixture();
        let (set, refused) = grant_set(&graph, &registry, &[folder_grant(&dir)], &nothing);
        assert!(!set.has(&NodeId("save".into()), "fs.write"));
        assert_eq!(refused.len(), 1);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_drive_root_is_refused_even_if_it_somehow_got_into_the_record() {
        // Two independent checks, and the order matters: the scope is refused for being a root
        // before the record is consulted, so a bug that let something into the record cannot
        // turn into a grant for the whole drive.
        let root = PathBuf::from(if cfg!(windows) { "C:\\" } else { "/" });
        let (graph, registry) = fixture();
        let chosen = BTreeSet::from([(
            FolderPurpose::GrantToComponent,
            std::fs::canonicalize(&root).unwrap_or(root.clone()),
        )]);

        let (set, refused) = grant_set(&graph, &registry, &[folder_grant(&root)], &chosen);

        assert!(!set.has(&NodeId("save".into()), "fs.write"));
        assert_eq!(refused.len(), 1);
        assert!(refused[0].contains("cannot be used"), "{}", refused[0]);
    }

    #[test]
    fn a_capability_the_component_never_declared_is_refused_and_named() {
        let (graph, registry) = fixture();
        let grant = GrantSpec {
            node: "save".into(),
            kind: "system.clipboard".into(),
            folder: None,
            hosts: None,
        };

        let (set, refused) = grant_set(&graph, &registry, &[grant], &BTreeSet::new());

        assert!(!set.has(&NodeId("save".into()), "system.clipboard"));
        assert_eq!(refused.len(), 1);
        assert!(refused[0].contains("does not ask for"), "{}", refused[0]);
    }

    #[test]
    fn a_grant_for_a_node_that_is_not_in_the_graph_is_nothing() {
        let (graph, registry) = fixture();
        let grant = GrantSpec {
            node: "ghost".into(),
            kind: "fs.write".into(),
            folder: None,
            hosts: None,
        };

        let (set, refused) = grant_set(&graph, &registry, &[grant], &BTreeSet::new());

        assert!(!set.has(&NodeId("ghost".into()), "fs.write"));
        // Silent: there is no node for it to be a decision about, so there is nothing to tell
        // the person that they would recognise.
        assert!(refused.is_empty(), "{refused:?}");
    }

    #[test]
    fn a_scratch_folder_is_gone_however_the_run_left() {
        let base = temp_dir("scratch");

        // The ordinary way out.
        let path = base.join("a");
        {
            let scratch = ScratchDir::new(path.clone());
            std::fs::create_dir_all(scratch.path()).unwrap();
            std::fs::write(scratch.path().join("out.bin"), b"x").unwrap();
            assert!(path.exists());
        }
        assert!(!path.exists(), "removed when the guard is dropped");

        // The way out that used to leak: an early error. A `?` in run_graph drops the guard
        // exactly as this block does.
        let path = base.join("b");
        fn leaves_early(path: PathBuf) -> Result<(), String> {
            let scratch = ScratchDir::new(path);
            std::fs::create_dir_all(scratch.path()).unwrap();
            Err("an input did not resolve".into())
        }
        assert!(leaves_early(path.clone()).is_err());
        assert!(!path.exists(), "removed on an early return");

        // And the way out nobody plans for.
        let path = base.join("c");
        let unwound = std::panic::catch_unwind(|| {
            let scratch = ScratchDir::new(path.clone());
            std::fs::create_dir_all(scratch.path()).unwrap();
            panic!("a component bug");
        });
        assert!(unwound.is_err());
        assert!(!path.exists(), "removed during unwinding");

        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn a_project_is_saved_only_as_a_project() {
        assert!(is_project_path(Path::new("C:/work/report.encastra")));
        assert!(is_project_path(Path::new("C:/work/report.ENCASTRA")));
        assert!(!is_project_path(Path::new(
            "C:/Users/me/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/x.bat"
        )));
        assert!(!is_project_path(Path::new("C:/work/report")));
        assert!(!is_project_path(Path::new("C:/work/report.encastra.exe")));
    }

    #[test]
    fn a_verbatim_path_is_shown_without_its_prefix() {
        assert_eq!(
            for_display(Path::new(r"\\?\C:\Users\a b\ñ 日本語")),
            r"C:\Users\a b\ñ 日本語"
        );
        assert_eq!(
            for_display(Path::new(r"\\?\UNC\server\share\x")),
            r"\\server\share\x"
        );
        // Shapes with no plain spelling, and paths that were never verbatim, are left alone.
        assert_eq!(
            for_display(Path::new(r"\\?\Volume{1234}\x")),
            r"\\?\Volume{1234}\x"
        );
        assert_eq!(for_display(Path::new(r"C:\Users\a")), r"C:\Users\a");
        assert_eq!(for_display(Path::new("/home/alice")), "/home/alice");
    }

    #[cfg(windows)]
    #[test]
    fn what_the_chooser_returns_resolves_back_to_what_was_recorded() {
        // The round trip the grant depends on: the display form sent back by the editor must
        // canonicalise to the same PathBuf the chooser recorded.
        let dir = temp_dir("chooser ñ 日本語");
        std::fs::create_dir_all(&dir).unwrap();
        let recorded = resolve_grant_directory(&dir).unwrap();
        let shown = for_display(&recorded);
        assert!(!shown.starts_with(r"\\?\"), "{shown}");
        assert_eq!(
            resolve_grant_directory(Path::new(&shown)).unwrap(),
            recorded
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_binary_states_the_commit_it_was_built_from() {
        // What the manifest greps for in the built file, and what Settings shows. A test binary
        // is built from the same tree as the release binary, so the stamp here is the stamp there.
        assert!(BUILD_STAMP.starts_with("encastra-build-commit="));
        assert!(BUILD_STAMP.ends_with(';'));
        let commit = build_commit();
        let hex = commit.trim_end_matches("-dirty");
        let is_hash = hex.len() == 40 && hex.bytes().all(|b| b.is_ascii_hexdigit());
        assert!(
            is_hash || commit == "unknown",
            "the stamp is a full commit hash, `-dirty` if the tree did not match, or `unknown`; got {commit:?}"
        );
    }
}
