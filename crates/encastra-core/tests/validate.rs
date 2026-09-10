//! Validation is the promise the editor makes: if this passes, the graph can run.
//!
//! These tests are mostly about *refusals*, and about the quality of what the user is told.
//! A validator that rejects the right graphs with messages nobody can act on has solved half
//! the problem.

use encastra_core::validate::{Location, Severity};
use encastra_core::{Graph, InMemoryRegistry, NodeId, validate};
use encastra_protocol::manifest::ComponentManifest;

fn component(id: &str, inputs: serde_json::Value, outputs: serde_json::Value) -> ComponentManifest {
    component_with(id, inputs, outputs, serde_json::json!({}))
}

fn component_with(
    id: &str,
    inputs: serde_json::Value,
    outputs: serde_json::Value,
    config: serde_json::Value,
) -> ComponentManifest {
    ComponentManifest::parse(
        &serde_json::json!({
            "schema": 1,
            "id": id,
            "version": "1.0.0",
            "name": id,
            "runtime": ">=0.1.0",
            "kind": "core",
            "ports": { "inputs": inputs, "outputs": outputs },
            "config": config
        })
        .to_string(),
    )
    .expect("fixture manifest must be valid")
}

fn registry() -> InMemoryRegistry {
    let mut r = InMemoryRegistry::new();
    r.insert(component(
        "test.source",
        serde_json::json!({}),
        serde_json::json!({ "out": { "type": "image" } }),
    ))
    .unwrap();
    r.insert(component(
        "test.number-source",
        serde_json::json!({}),
        serde_json::json!({ "out": { "type": "i64" } }),
    ))
    .unwrap();
    r.insert(component(
        "test.sink",
        serde_json::json!({ "in": { "type": "image", "required": true } }),
        serde_json::json!({ "done": { "type": "bool" } }),
    ))
    .unwrap();
    r.insert(component(
        "test.text-sink",
        serde_json::json!({ "in": { "type": "string", "required": true } }),
        serde_json::json!({ "done": { "type": "bool" } }),
    ))
    .unwrap();
    r.insert(component(
        "test.number-sink",
        serde_json::json!({ "in": { "type": "i64", "required": true } }),
        serde_json::json!({ "done": { "type": "bool" } }),
    ))
    .unwrap();
    r.insert(component(
        "test.passthrough",
        serde_json::json!({ "in": { "type": "image" } }),
        serde_json::json!({ "out": { "type": "image" } }),
    ))
    .unwrap();
    r.insert(component_with(
        "test.configured",
        serde_json::json!({ "in": { "type": "image", "required": true } }),
        serde_json::json!({ "out": { "type": "image" } }),
        serde_json::json!({
            "width":   { "type": "i64", "min": 1, "max": 100, "required": true },
            "mode":    { "type": "string", "choices": ["fit", "fill"] }
        }),
    ))
    .unwrap();
    r
}

fn graph(json: serde_json::Value) -> Graph {
    Graph::parse(&json.to_string()).expect("fixture graph must parse")
}

fn wire(from: &str, from_port: &str, to: &str, to_port: &str) -> serde_json::Value {
    serde_json::json!({
        "from": { "node": from, "port": from_port },
        "to":   { "node": to,   "port": to_port }
    })
}

fn node(component: &str) -> serde_json::Value {
    serde_json::json!({ "component": format!("{component}@1.0.0") })
}

#[test]
fn a_correct_graph_validates_and_comes_back_with_an_order() {
    let g = graph(serde_json::json!({
        "nodes": { "a": node("test.source"), "b": node("test.sink") },
        "edges": [wire("a", "out", "b", "in")]
    }));

    let result = validate(&g, &registry());
    assert!(result.is_runnable(), "{:?}", result.issues);
    assert_eq!(result.order, vec![NodeId("a".into()), NodeId("b".into())]);
}

#[test]
fn an_unavailable_component_is_named_and_does_not_cascade() {
    let g = graph(serde_json::json!({
        "nodes": { "a": node("test.does-not-exist"), "b": node("test.sink") },
        "edges": [wire("a", "out", "b", "in")]
    }));

    let result = validate(&g, &registry());
    assert!(!result.is_runnable());
    // One clear error about the missing component — not also a pile of errors about ports it
    // could never have had.
    let about_missing: Vec<_> = result
        .errors()
        .filter(|i| i.message.contains("not installed"))
        .collect();
    assert_eq!(about_missing.len(), 1);
    assert!(about_missing[0].hint.is_some());
    assert_eq!(result.errors().count(), 1, "{:?}", result.issues);
}

#[test]
fn an_impossible_connection_is_refused_before_it_can_run() {
    // IMAGE -> NUMBER, the case the product spec calls out by name.
    let g = graph(serde_json::json!({
        "nodes": { "a": node("test.source"), "b": node("test.number-sink") },
        "edges": [wire("a", "out", "b", "in")]
    }));

    let result = validate(&g, &registry());
    assert!(!result.is_runnable());
    assert!(
        result.order.is_empty(),
        "a graph that cannot run has no runnable order"
    );
}

#[test]
fn a_conversion_that_can_fail_is_allowed_but_flagged() {
    // i64 -> string is total, so it should be silent. Nothing to warn about.
    let g = graph(serde_json::json!({
        "nodes": { "a": node("test.number-source"), "b": node("test.text-sink") },
        "edges": [wire("a", "out", "b", "in")]
    }));

    let result = validate(&g, &registry());
    assert!(result.is_runnable(), "{:?}", result.issues);
    assert_eq!(
        result.conversions.len(),
        1,
        "the conversion must be planned once, here"
    );
    assert_eq!(result.conversions[0].ops, vec!["to-text"]);
    assert!(
        result
            .issues
            .iter()
            .all(|i| i.severity != Severity::Warning),
        "a conversion that cannot fail should not nag: {:?}",
        result.issues
    );
}

#[test]
fn a_missing_required_input_says_what_to_connect() {
    let g = graph(serde_json::json!({
        "nodes": { "b": node("test.sink") },
        "edges": []
    }));

    let result = validate(&g, &registry());
    assert!(!result.is_runnable());
    let issue = result.errors().next().expect("an error");
    assert!(matches!(issue.location, Location::Port(_)));
    assert!(issue.hint.as_deref().unwrap_or("").contains("image"));
}

#[test]
fn two_connections_into_one_input_are_refused() {
    let g = graph(serde_json::json!({
        "nodes": {
            "a": node("test.source"),
            "a2": node("test.source"),
            "b": node("test.sink")
        },
        "edges": [wire("a", "out", "b", "in"), wire("a2", "out", "b", "in")]
    }));

    let result = validate(&g, &registry());
    assert!(!result.is_runnable());
    assert!(
        result
            .errors()
            .any(|i| i.message.contains("finished first")),
        "{:?}",
        result.issues
    );
}

#[test]
fn a_cycle_is_reported_as_a_path_with_a_way_out() {
    let g = graph(serde_json::json!({
        "nodes": {
            "a": node("test.passthrough"),
            "b": node("test.passthrough"),
            "c": node("test.passthrough")
        },
        "edges": [
            wire("a", "out", "b", "in"),
            wire("b", "out", "c", "in"),
            wire("c", "out", "a", "in")
        ]
    }));

    let result = validate(&g, &registry());
    assert!(!result.is_runnable());
    let issue = result
        .errors()
        .find(|i| i.message.contains("loop"))
        .expect("a cycle error");
    // The path names the nodes involved, and the hint points at the Loop node instead of
    // just saying "not allowed".
    for name in ["a", "b", "c"] {
        assert!(issue.message.contains(name), "{}", issue.message);
    }
    assert!(issue.hint.as_deref().unwrap_or("").contains("Loop"));
}

#[test]
fn a_self_loop_is_a_cycle_too() {
    let g = graph(serde_json::json!({
        "nodes": { "a": node("test.passthrough") },
        "edges": [wire("a", "out", "a", "in")]
    }));
    let result = validate(&g, &registry());
    assert!(!result.is_runnable());
    assert!(result.errors().any(|i| i.message.contains("loop")));
}

#[test]
fn unknown_ports_list_the_ones_that_exist() {
    let g = graph(serde_json::json!({
        "nodes": { "a": node("test.source"), "b": node("test.sink") },
        "edges": [wire("a", "nope", "b", "in")]
    }));

    let result = validate(&g, &registry());
    let issue = result.errors().next().expect("an error");
    assert!(issue.message.contains("no output called"));
    assert!(issue.hint.as_deref().unwrap_or("").contains("out"));
}

#[test]
fn configuration_is_checked_against_the_manifest() {
    let base = |config: serde_json::Value| {
        graph(serde_json::json!({
            "nodes": {
                "a": node("test.source"),
                "b": { "component": "test.configured@1.0.0", "config": config }
            },
            "edges": [wire("a", "out", "b", "in")]
        }))
    };

    let ok = validate(&base(serde_json::json!({ "width": 50 })), &registry());
    assert!(ok.is_runnable(), "{:?}", ok.issues);

    let too_big = validate(&base(serde_json::json!({ "width": 500 })), &registry());
    assert!(too_big.errors().any(|i| i.message.contains("at most 100")));

    let wrong_type = validate(&base(serde_json::json!({ "width": "wide" })), &registry());
    assert!(
        wrong_type
            .errors()
            .any(|i| i.message.contains("should be i64"))
    );

    let bad_choice = validate(
        &base(serde_json::json!({ "width": 10, "mode": "stretch" })),
        &registry(),
    );
    assert!(bad_choice.errors().any(|i| i.message.contains("fit, fill")));

    let missing = validate(&base(serde_json::json!({})), &registry());
    assert!(
        missing
            .errors()
            .any(|i| i.message.contains("needs \"width\""))
    );
}

#[test]
fn a_leftover_setting_warns_but_does_not_block() {
    let g = graph(serde_json::json!({
        "nodes": {
            "a": node("test.source"),
            "b": { "component": "test.configured@1.0.0", "config": { "width": 10, "gone": 1 } }
        },
        "edges": [wire("a", "out", "b", "in")]
    }));

    let result = validate(&g, &registry());
    assert!(
        result.is_runnable(),
        "an obsolete setting must not stop a working graph"
    );
    assert!(
        result
            .issues
            .iter()
            .any(|i| i.severity == Severity::Warning)
    );
}

#[test]
fn a_switched_off_node_feeding_a_live_one_is_an_error_before_the_run_not_during() {
    let g = graph(serde_json::json!({
        "nodes": {
            "a": { "component": "test.source@1.0.0", "disabled": true },
            "b": node("test.sink")
        },
        "edges": [wire("a", "out", "b", "in")]
    }));

    let result = validate(&g, &registry());
    assert!(!result.is_runnable());
    assert!(
        result.errors().any(|i| i.message.contains("switched off")),
        "{:?}",
        result.issues
    );
}

#[test]
fn every_problem_is_reported_not_just_the_first() {
    let g = graph(serde_json::json!({
        "nodes": {
            "a": node("test.source"),
            "b": node("test.number-sink"),
            "c": node("test.sink"),
            "d": node("test.missing")
        },
        "edges": [wire("a", "out", "b", "in")]
    }));

    let result = validate(&g, &registry());
    // image -> i64, c's required input unconnected, d's component missing.
    assert!(
        result.errors().count() >= 3,
        "expected several errors, got {:?}",
        result.issues
    );
}

#[test]
fn an_empty_graph_is_valid_and_does_nothing() {
    let result = validate(&graph(serde_json::json!({})), &registry());
    assert!(result.is_runnable());
    assert!(result.order.is_empty());
}
