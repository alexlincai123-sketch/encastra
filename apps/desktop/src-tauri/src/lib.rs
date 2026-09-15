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

use encastra_core::broker::{Broker, GrantScope, GrantSet};
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

/// Loaded once at start-up. Building the registry per call would let two calls disagree about
/// what is installed.
struct Runtime {
    registry: InMemoryRegistry,
    components: CoreComponentSet,
    triggers: TriggerSet,
    /// The workflow currently running, if any. One at a time: two workflows writing into the
    /// same folders at once is a surprise nobody asked for, and the editor shows one graph.
    running: Mutex<Option<Running>>,
    /// What this person has, and where it is. Read once at start-up for the same reason the
    /// registry is: two calls that each read the file would disagree about what is in it.
    library: LibraryHandle,
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
    let mut grant_set = GrantSet::new();

    // Input-handle scopes come from the manifest and need no dialog: they grant nothing the
    // user has not already said by drawing an edge.
    for (id, node) in &graph.nodes {
        if let Some(manifest) = state.registry.get(&node.component) {
            grant_set.allow_declared_input_handles(id, manifest);
        }
    }

    // Everything else is here because a person answered a question.
    for grant in &grants {
        let node = NodeId(grant.node.clone());
        let scope = match (&grant.folder, &grant.hosts) {
            (Some(folder), _) => GrantScope::Directory(PathBuf::from(folder)),
            (None, Some(hosts)) => GrantScope::HttpHosts(hosts.clone()),
            (None, None) => GrantScope::Allowed,
        };
        grant_set.grant(&node, &grant.kind, scope);
    }

    let run_id = format!("run-{}", encastra_core::journal::now_ms());
    let run_dir = std::env::temp_dir().join("encastra").join(&run_id);
    let mut broker = Broker::new(run_dir.clone(), grant_set)
        .map_err(|e| format!("Could not prepare a working folder: {e}"))?;

    let mut seed: BTreeMap<PortRef, Value> = BTreeMap::new();
    for input in &inputs {
        let path = PathBuf::from(&input.path);
        let absolute = std::fs::canonicalize(&path)
            .map_err(|e| format!("Could not open {}: {}", path.display(), e.kind()))?;
        let kind = kind_for(&absolute);
        let handle = broker.import_file(absolute, kind);
        seed.insert(input.port_ref(), Value::Handle(handle));
    }

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

    // Scratch space belongs to the run. Anything the user wanted to keep was copied into a
    // folder they allowed, by a component that asked.
    let _ = std::fs::remove_dir_all(&run_dir);
    Ok(result)
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
    project.manifest.modified_at_ms = encastra_core::journal::now_ms();
    project.save(&target).map_err(|e| e.to_string())?;
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
fn grant_set(graph: &Graph, registry: &InMemoryRegistry, grants: &[GrantSpec]) -> GrantSet {
    let mut set = GrantSet::new();
    for (id, node) in &graph.nodes {
        if let Some(manifest) = registry.get(&node.component) {
            set.allow_declared_input_handles(id, manifest);
        }
    }
    for grant in grants {
        let node = NodeId(grant.node.clone());
        let scope = match (&grant.folder, &grant.hosts) {
            (Some(folder), _) => GrantScope::Directory(PathBuf::from(folder)),
            (None, Some(hosts)) => GrantScope::HttpHosts(hosts.clone()),
            (None, None) => GrantScope::Allowed,
        };
        set.grant(&node, &grant.kind, scope);
    }
    set
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

    let run_id = format!("session-{}", encastra_core::journal::now_ms());
    let run_dir = std::env::temp_dir().join("encastra").join(&run_id);
    let mut broker = Broker::new(run_dir.clone(), grant_set(&graph, &registry, &grants))
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

            // Scratch space belongs to the run. Anything worth keeping was copied into a folder
            // the user allowed, by a component that asked.
            let _ = std::fs::remove_dir_all(&run_dir);

            announce(
                &thread_app,
                Status {
                    running: false,
                    watching,
                    runs: session.runs_completed(),
                    pending: 0,
                    dropped: session.backlog().1,
                    message: None,
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

    // One folder per version, named after what is in it, so a second version does not land on
    // top of the first.
    let folder = PathBuf::from(&into).join(format!(
        "{id}-{version}",
        id = bundle.draft.listing_id,
        version = bundle.draft.version
    ));
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
#[tauri::command]
fn inspect_publication(
    state: tauri::State<'_, Runtime>,
    folder: String,
) -> Result<Inspected, ImportError> {
    encastra_publish::import::inspect(
        Path::new(&folder),
        &state.registry,
        encastra_core::RUNTIME_VERSION,
    )
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
    let imported = encastra_publish::import::import(
        Path::new(&folder),
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

#[tauri::command]
fn about() -> serde_json::Value {
    serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "runtime": encastra_core::RUNTIME_VERSION,
        "protocolSchema": encastra_protocol::SCHEMA_VERSION,
        "projectSchema": encastra_project::PROJECT_SCHEMA,
    })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
                library: LibraryHandle::open(library_root),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
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
}
