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
use encastra_project::{History, LockedComponent, Lockfile, Project, SnapshotId};
use encastra_protocol::manifest::ComponentManifest;
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
    let run_id = format!("run-{}", encastra_core::journal::now_ms());
    let run_dir = std::env::temp_dir().join("encastra").join(&run_id);
    let mut broker = Broker::new(run_dir.clone(), grant_set(&graph, &state.registry, &grants))
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

    // Scratch space belongs to the run. Anything the user wanted to keep was copied into a
    // folder they allowed, by a component that asked.
    let _ = std::fs::remove_dir_all(&run_dir);
    Ok(result)
}

/// Whether a path is one this application will write a project to.
///
/// The destination arrives from the webview as a string. It is supposed to be what a person
/// chose in a save dialog, and this is the part of that claim the runtime can actually check:
/// whatever else it is, it has to be a `.encastra` file. That does not make the path trusted —
/// it is still somewhere the user's account can write — but it takes "write these bytes to any
/// path on the machine" off the table, which is the shape that ends with a file in a startup
/// folder or on top of something that was already there.
fn is_project_path(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("encastra"))
}

/// A hint from the file extension. The runtime verifies content when a component actually
/// decodes it, so a wrong guess fails there rather than being trusted.
fn kind_for(path: &std::path::Path) -> HandleKind {
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
    let target = PathBuf::from(&path);
    if !is_project_path(&target) {
        return Err("A project is saved as a .encastra file.".to_owned());
    }
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
    Ok(describe(project, &path, &state.registry))
}

#[tauri::command]
fn open_project(state: tauri::State<'_, Runtime>, path: String) -> Result<OpenProject, String> {
    let project = Project::open(&PathBuf::from(&path)).map_err(|e| e.to_string())?;
    Ok(describe(project, &path, &state.registry))
}

#[tauri::command]
fn restore_version(
    state: tauri::State<'_, Runtime>,
    path: String,
    snapshot: String,
) -> Result<OpenProject, String> {
    let target = PathBuf::from(&path);
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
    let project = Project::open(&PathBuf::from(path)).map_err(|e| e.to_string())?;
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
/// A refused grant is dropped rather than reported as an error. The component then asks the
/// broker for the capability, is denied, and the denial appears in the journal against the node
/// that wanted it — which is where somebody debugging would look, and is a record the editor
/// cannot edit.
fn grant_set(graph: &Graph, registry: &InMemoryRegistry, grants: &[GrantSpec]) -> GrantSet {
    let mut set = GrantSet::new();
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
            (Some(folder), _) => match resolve_grant_directory(Path::new(folder)) {
                Ok(resolved) => GrantScope::Directory(resolved),
                Err(_) => continue,
            },
            (None, Some(hosts)) => GrantScope::HttpHosts(hosts.clone()),
            (None, None) => GrantScope::Allowed,
        };

        set.grant_declared(&node, manifest, &grant.kind, scope);
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
    let installed = encastra_builtins::install_all();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Runtime {
            registry: installed.registry,
            components: installed.components,
            triggers: installed.triggers,
            running: Mutex::new(None),
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
            about
        ])
        .run(tauri::generate_context!())
        .expect("the application window could not be created");
}
