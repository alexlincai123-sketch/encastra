//! The workflow anybody builds first, run end to end: one Save File step, a folder granted to
//! it, and a file the person picked - no trigger, no second step, nothing connected to anything.
//!
//! It never worked. Save File takes a file on "file" and produces one on "file", and the
//! executor decided which side a supplied value belonged to by looking at the outputs alone -
//! so the file a person had chosen was filed as something the node had already produced, the
//! node ran with an empty input, and the run failed with "Nothing is connected to \"file\"".
//! The interface showed "Fallido" and no reason. The chooser journeys had been failing on this
//! since they were written.
use encastra_core::ComponentRegistry;
use encastra_core::broker::{Broker, GrantScope, GrantSet};
use encastra_core::value::{HandleKind, Value};
use encastra_core::{Graph, NodeId, PortRef, runner::run_seeded};
use std::collections::BTreeMap;

#[test]
fn a_file_the_person_picked_reaches_a_step_whose_input_and_output_share_a_name() {
    let dir = std::env::temp_dir().join(format!("encastra-probe-{}", std::process::id()));
    let grant = dir.join("grant-to-component");
    let input = dir.join("run-input");
    std::fs::create_dir_all(&grant).unwrap();
    std::fs::create_dir_all(&input).unwrap();
    let evidence = input.join("evidence.txt");
    std::fs::write(&evidence, b"evidence for the run-input journey").unwrap();

    let graph: Graph = serde_json::from_value(serde_json::json!({
        "nodes": {
            "save-2": {
                "component": "encastra.file.save@1.0.0",
                "config": { "folder": grant.to_string_lossy(), "filename": null, "suffix": null }
            }
        },
        "edges": []
    }))
    .expect("graph");

    let installed = encastra_builtins::install_all();
    let mut grants = GrantSet::new();
    for (id, node) in &graph.nodes {
        if let Some(manifest) = installed.registry.get(&node.component) {
            grants.allow_declared_input_handles(id, manifest);
        }
    }
    grants.grant(
        &NodeId("save-2".into()),
        "fs.write",
        GrantScope::Directory(grant.clone()),
    );

    let mut broker = Broker::new(dir.join("run"), grants).unwrap();
    let handle = broker.import_file(evidence.clone(), HandleKind::File);
    let mut seed = BTreeMap::new();
    seed.insert(
        PortRef {
            node: NodeId("save-2".into()),
            port: "file".into(),
        },
        Value::Handle(handle),
    );

    let outcome = run_seeded(
        &graph,
        &installed.registry,
        &installed.components,
        &mut broker,
        &std::sync::atomic::AtomicBool::new(false),
        "probe",
        seed,
    )
    .unwrap_or_else(|v| panic!("validation refused it: {:#?}", v.issues));

    let step = &outcome.journal.nodes[&NodeId("save-2".into())];
    assert_eq!(
        step.error, None,
        "the step has to receive the file that was supplied for its input"
    );
    assert_eq!(
        outcome.journal.status,
        encastra_core::journal::RunStatus::Ok
    );
    let written: Vec<_> = std::fs::read_dir(&grant)
        .unwrap()
        .filter_map(|e| e.ok().map(|e| e.file_name().to_string_lossy().into_owned()))
        .collect();
    assert_eq!(
        written,
        vec!["evidence.txt".to_string()],
        "the granted folder holds the file the run was given, under its own name"
    );
    std::fs::remove_dir_all(&dir).ok();
}
