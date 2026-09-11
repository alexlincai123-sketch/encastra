//! Does a graph actually run?
//!
//! Everything else in the suite checks a part. This checks the product: a graph is built,
//! validated, executed, and the file it promised appears on disk — with the capability checks
//! in the middle genuinely happening rather than being skipped for first-party code.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;

use encastra_core::broker::{Broker, GrantScope, GrantSet};
use encastra_core::journal::{NodeStatus, RunStatus};
use encastra_core::registry::ComponentRegistry;
use encastra_core::runner::run_seeded;
use encastra_core::value::{Handle, HandleKind, Value};
use encastra_core::{Graph, NodeId, PortRef, RunOutcome};

struct Sandbox(PathBuf);

impl Sandbox {
    fn new(name: &str) -> Self {
        let path = std::env::temp_dir().join(format!("encastra-e2e-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(path.join("out")).unwrap();
        Sandbox(path)
    }
    fn path(&self) -> &Path {
        &self.0
    }
    fn out(&self) -> PathBuf {
        self.0.join("out")
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// read → parse JSON → (stringify) → write → (bool to text) → notify
///
/// Two of those arrows are conversions the type table declared: `json → string` is explicit
/// and `bool → string` is implicit, so this exercises both paths as well as the components.
fn pipeline(out_dir: &Path) -> Graph {
    Graph::parse(
        &serde_json::json!({
            "nodes": {
                "read":   { "component": "encastra.file.read@1.0.0" },
                "parse":  { "component": "encastra.data.json@1.0.0" },
                "write":  { "component": "encastra.file.write@1.0.0",
                            "config": { "folder": out_dir.to_string_lossy(), "filename": "result.json" } },
                "notify": { "component": "encastra.system.notify@1.0.0" }
            },
            "edges": [
                { "from": { "node": "read",  "port": "text" },  "to": { "node": "parse",  "port": "text" } },
                { "from": { "node": "parse", "port": "json" },  "to": { "node": "write",  "port": "content" } },
                { "from": { "node": "write", "port": "saved" }, "to": { "node": "notify", "port": "message" } }
            ]
        })
        .to_string(),
    )
    .expect("the demo graph must parse")
}

/// Runs the demo the way the application would: assemble grants, import the file the user
/// picked, seed it into the entry node, execute.
fn run_demo(name: &str, file_contents: &str, grant_write_folder: bool) -> (RunOutcome, Sandbox) {
    let sandbox = Sandbox::new(name);
    let input = sandbox.path().join("input.json");
    std::fs::write(&input, file_contents).unwrap();

    let (registry, components) = encastra_builtins::install();
    let graph = pipeline(&sandbox.out());

    let mut grants = GrantSet::new();
    for (id, node) in &graph.nodes {
        // Input-handle scopes come straight from the manifest: they grant nothing the user has
        // not already said by drawing an edge.
        grants.allow_declared_input_handles(id, registry.get(&node.component).unwrap());
    }
    grants.grant(
        &NodeId("notify".into()),
        "system.notify",
        GrantScope::Allowed,
    );
    if grant_write_folder {
        // This one is a real decision, so it is here only because a user made it.
        grants.grant(
            &NodeId("write".into()),
            "fs.write",
            GrantScope::Directory(sandbox.out()),
        );
    }

    let mut broker = Broker::new(sandbox.path().join("run"), grants).unwrap();
    let handle: Handle = broker.import_file(input, HandleKind::File);

    let seed = BTreeMap::from([(
        PortRef {
            node: NodeId("read".into()),
            port: "file".into(),
        },
        Value::Handle(handle),
    )]);

    let outcome = run_seeded(
        &graph,
        &registry,
        &components,
        &mut broker,
        &AtomicBool::new(false),
        "run-1",
        seed,
    )
    .unwrap_or_else(|v| panic!("the demo graph must validate: {:#?}", v.issues));

    (outcome, sandbox)
}

#[test]
fn the_demo_pipeline_runs_and_produces_the_file_it_promised() {
    let (outcome, sandbox) = run_demo("happy", r#"{"name":"Encastra","parts":3}"#, true);

    assert_eq!(
        outcome.journal.status,
        RunStatus::Ok,
        "{:#?}",
        outcome.journal.nodes
    );

    let written = sandbox.out().join("result.json");
    assert!(
        written.exists(),
        "the file the graph promised was not written"
    );
    assert!(
        std::fs::read_to_string(&written)
            .unwrap()
            .contains("Encastra")
    );

    for id in ["read", "parse", "write", "notify"] {
        let record = &outcome.journal.nodes[&NodeId(id.into())];
        assert_eq!(record.status, NodeStatus::Ok, "{id}: {record:#?}");
        assert!(record.duration_ms.is_some(), "{id} has no duration");
    }
}

#[test]
fn the_journal_records_the_capability_calls_the_debugger_shows() {
    let (outcome, _sandbox) = run_demo("journal", r#"{"a":1}"#, true);

    let read = &outcome.journal.nodes[&NodeId("read".into())];
    assert!(
        read.capability_calls
            .iter()
            .any(|c| c.kind == "fs.read" && c.allowed),
        "the read was not recorded: {:#?}",
        read.capability_calls
    );

    let notify = &outcome.journal.nodes[&NodeId("notify".into())];
    assert!(
        notify
            .capability_calls
            .iter()
            .any(|c| c.kind == "system.notify")
    );

    // The components that need nothing asked for nothing. A component quietly acquiring
    // authority it never declared would show up right here.
    let parse = &outcome.journal.nodes[&NodeId("parse".into())];
    assert!(
        parse.capability_calls.is_empty(),
        "{:#?}",
        parse.capability_calls
    );
}

#[test]
fn a_denied_capability_fails_that_node_and_names_it_as_why_the_rest_stopped() {
    let (outcome, sandbox) = run_demo("denied", r#"{"ok":true}"#, false);

    assert_eq!(outcome.journal.status, RunStatus::Partial);

    let write = &outcome.journal.nodes[&NodeId("write".into())];
    assert_eq!(write.status, NodeStatus::Failed);
    let error = write.error.as_ref().unwrap();
    assert_eq!(error.code, "denied");
    assert!(
        error.hint.is_some(),
        "a refusal should say what to do about it"
    );

    assert!(
        !sandbox.out().join("result.json").exists(),
        "nothing should have been written"
    );

    // The next node did not quietly succeed on nothing: it is skipped, and the journal names
    // the node responsible.
    let notify = &outcome.journal.nodes[&NodeId("notify".into())];
    assert_eq!(notify.status, NodeStatus::Skipped);
    assert_eq!(notify.skipped_because, Some(NodeId("write".into())));
}

#[test]
fn a_component_failure_is_reported_where_it_happened() {
    let (outcome, _sandbox) = run_demo("badjson", "this is not json at all", true);

    let parse = &outcome.journal.nodes[&NodeId("parse".into())];
    assert_eq!(parse.status, NodeStatus::Failed);
    assert_eq!(parse.error.as_ref().unwrap().code, "invalid-json");

    // And the node that did its job says so, rather than being tarred with the same brush.
    assert_eq!(
        outcome.journal.nodes[&NodeId("read".into())].status,
        NodeStatus::Ok
    );
    assert_eq!(outcome.journal.status, RunStatus::Partial);
}

#[test]
fn the_journal_never_contains_the_file_contents() {
    // The journal is written to disk and rendered in a UI. It records shapes and sizes, never
    // the user's data.
    let secret = format!(r#"{{"token":"{}"}}"#, "s3cr3t-".repeat(20));
    let (outcome, _sandbox) = run_demo("nosecrets", &secret, true);

    let serialised = serde_json::to_string(&outcome.journal).unwrap();
    assert!(
        !serialised.contains("s3cr3t"),
        "the journal leaked file contents"
    );
}

#[test]
fn a_graph_that_does_not_validate_never_runs_at_all() {
    let sandbox = Sandbox::new("invalid");
    let (registry, components) = encastra_builtins::install();
    // `read` has a required input and nothing supplies it — no edge, no seed.
    let graph = pipeline(&sandbox.out());
    let mut broker = Broker::new(sandbox.path().join("run"), GrantSet::new()).unwrap();

    let result = run_seeded(
        &graph,
        &registry,
        &components,
        &mut broker,
        &AtomicBool::new(false),
        "run-1",
        BTreeMap::new(),
    );

    let validation = result.unwrap_err();
    assert!(
        validation
            .errors()
            .any(|i| i.message.contains("needs an input"))
    );
    assert!(!sandbox.out().join("result.json").exists());
}
