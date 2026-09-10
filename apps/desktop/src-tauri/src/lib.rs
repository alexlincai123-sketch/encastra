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
            run_graph
        ])
        .run(tauri::generate_context!())
        .expect("the application window could not be created");
}
