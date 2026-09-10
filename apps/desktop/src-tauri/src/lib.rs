//! The desktop application's bridge to the runtime.
//!
//! Every command here is a thin translation between JSON and `encastra-core`. There is no
//! logic in this file that the runtime does not already own — no second validator, no second
//! scheduler, no place where the editor could come to believe something the engine disagrees
//! with (ADR-0003). When a command looks like it is starting to decide something, that
//! decision belongs in the runtime.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;

use encastra_core::broker::{Broker, GrantScope, GrantSet};
use encastra_core::graph::{Graph, NodeId, PortRef};
use encastra_core::journal::RunJournal;
use encastra_core::registry::{ComponentRegistry, InMemoryRegistry};
use encastra_core::runner::{CoreComponentSet, run_seeded};
use encastra_core::validate::{Validation, validate_with_supplied};
use encastra_core::value::{HandleKind, Value};
use encastra_project::{History, LockedComponent, Lockfile, Project, SnapshotId};
use encastra_protocol::manifest::ComponentManifest;
use serde::{Deserialize, Serialize};

/// Loaded once at start-up. Building the registry per call would let two calls disagree about
/// what is installed.
struct Runtime {
    registry: InMemoryRegistry,
    components: CoreComponentSet,
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

pub fn run() {
    let (registry, components) = encastra_builtins::install();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Runtime {
            registry,
            components,
        })
        .invoke_handler(tauri::generate_handler![
            list_components,
            type_graph,
            validate_graph,
            run_graph,
            save_project,
            open_project,
            restore_version,
            compare_versions
        ])
        .run(tauri::generate_context!())
        .expect("the application window could not be created");
}
