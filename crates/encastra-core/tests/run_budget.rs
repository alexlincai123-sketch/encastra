//! What a run is allowed to hold, and when it lets go.
//!
//! Every other bound in the runtime is a bound on **one** thing: a read is capped at 512 MB, a
//! graph at ten thousand nodes, a run at an hour. None of them can see a sum. Releasing a value
//! when its last consumer finishes bounds a run by the graph's *depth*; nothing bounded its
//! *width*, and width is the cheaper attack — five thousand legal reads, each individually
//! within every cap, all resident at once because a topological order runs every producer
//! before the step they share.
//!
//! So these tests are about the aggregate, and about *timing*. A budget that is merely the sum
//! of everything a run ever produced would refuse workflows that never held more than one value
//! at a time; a release that happens a step too late is invisible until the day it is not. Both
//! are asserted the same way — with a budget tight enough that being wrong is fatal — rather
//! than by exposing the counter, which would make the test a test of an accessor.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;

use encastra_core::broker::{Broker, GrantSet};
use encastra_core::journal::{LogLevel, NodeError, NodeStatus, RunStatus};
use encastra_core::runner::{
    CoreComponent, CoreComponentSet, MAX_LIVE_VALUE_BYTES, MAX_LOG_LINE_CHARS,
    MAX_LOG_LINES_PER_NODE, NodeContext, RunRequest, execute_request_within,
};
use encastra_core::value::Value;
use encastra_core::{Graph, InMemoryRegistry, NodeId, PortRef, RunOutcome};
use encastra_protocol::manifest::ComponentManifest;

// ---------------------------------------------------------------------------------------
// Components, small enough to reason about exactly
// ---------------------------------------------------------------------------------------

fn manifest(id: &str, ports: serde_json::Value, config: serde_json::Value) -> ComponentManifest {
    ComponentManifest::parse(
        &serde_json::json!({
            "schema": 1,
            "id": id,
            "version": "1.0.0",
            "name": id,
            "runtime": ">=0.1.0",
            "kind": "core",
            "ports": ports,
            "config": config
        })
        .to_string(),
    )
    .expect("fixture manifest must be valid")
}

/// Produces a string of exactly the size its config asks for, plus a one-byte `tick`.
///
/// `tick` is how a test orders a later step after an earlier one without making it depend on
/// the big value — which is the only way to ask "was that released yet?" without looking
/// inside the executor.
fn big_manifest() -> ComponentManifest {
    manifest(
        "test.big",
        serde_json::json!({
            "inputs":  { "after": { "type": "bool" } },
            "outputs": { "out": { "type": "string" }, "tick": { "type": "bool" } }
        }),
        serde_json::json!({ "bytes": { "type": "i64" } }),
    )
}

struct Big(ComponentManifest);

impl CoreComponent for Big {
    fn manifest(&self) -> &ComponentManifest {
        &self.0
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<BTreeMap<String, Value>, NodeError> {
        let bytes = ctx.config_i64("bytes").unwrap_or(0).max(0) as usize;
        Ok(BTreeMap::from([
            // ASCII, so one character is one byte and the arithmetic in these tests is exact.
            ("out".to_owned(), Value::Text("a".repeat(bytes))),
            ("tick".to_owned(), Value::Bool(true)),
        ]))
    }
}

struct Sink(ComponentManifest);

impl CoreComponent for Sink {
    fn manifest(&self) -> &ComponentManifest {
        &self.0
    }

    fn run(&self, _ctx: &mut NodeContext<'_>) -> Result<BTreeMap<String, Value>, NodeError> {
        Ok(BTreeMap::from([("done".to_owned(), Value::Bool(true))]))
    }
}

/// Fails, whatever it is given. Used both as a failing *consumer* and as a failing *producer*,
/// because "the value was released" has to hold for both.
struct Fails(ComponentManifest);

impl CoreComponent for Fails {
    fn manifest(&self) -> &ComponentManifest {
        &self.0
    }

    fn run(&self, _ctx: &mut NodeContext<'_>) -> Result<BTreeMap<String, Value>, NodeError> {
        Err(NodeError::new(
            "test-failure",
            "This component always fails.",
        ))
    }
}

struct Noisy(ComponentManifest);

impl CoreComponent for Noisy {
    fn manifest(&self) -> &ComponentManifest {
        &self.0
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<BTreeMap<String, Value>, NodeError> {
        let lines = ctx.config_i64("lines").unwrap_or(0).max(0);
        let chars = ctx.config_i64("chars").unwrap_or(1).max(1) as usize;
        for n in 0..lines {
            ctx.log(LogLevel::Info, format!("{n}:{}", "x".repeat(chars)));
        }
        Ok(BTreeMap::from([("done".to_owned(), Value::Bool(true))]))
    }
}

/// A component with `inputs` string ports, for the many-small-producers shape. One consumer
/// shared by hundreds of producers is the graph the per-item caps cannot see.
fn merge_manifest(inputs: usize) -> ComponentManifest {
    let ports: serde_json::Map<String, serde_json::Value> = (0..inputs)
        .map(|n| (format!("in{n}"), serde_json::json!({ "type": "string" })))
        .collect();
    manifest(
        "test.merge",
        serde_json::json!({
            "inputs": ports,
            "outputs": { "done": { "type": "bool" } }
        }),
        serde_json::json!({}),
    )
}

const MERGE_INPUTS: usize = 200;

fn fixtures() -> (InMemoryRegistry, CoreComponentSet) {
    let parts: Vec<Arc<dyn CoreComponent>> = vec![
        Arc::new(Big(big_manifest())),
        Arc::new(Sink(manifest(
            "test.sink",
            serde_json::json!({
                "inputs":  {
                    "in":   { "type": "string", "required": true },
                    "also": { "type": "string" }
                },
                "outputs": { "done": { "type": "bool" } }
            }),
            serde_json::json!({}),
        ))),
        Arc::new(Fails(manifest(
            "test.fails",
            serde_json::json!({
                "inputs":  { "in": { "type": "string" } },
                "outputs": { "out": { "type": "string" } }
            }),
            serde_json::json!({}),
        ))),
        Arc::new(Noisy(manifest(
            "test.noisy",
            serde_json::json!({
                "inputs":  {},
                "outputs": { "done": { "type": "bool" } }
            }),
            serde_json::json!({ "lines": { "type": "i64" }, "chars": { "type": "i64" } }),
        ))),
        Arc::new(Sink(merge_manifest(MERGE_INPUTS))),
    ];

    let mut registry = InMemoryRegistry::new();
    let mut components = CoreComponentSet::new();
    for part in parts {
        registry.insert(part.manifest().clone()).unwrap();
        components.insert(part).unwrap();
    }
    (registry, components)
}

// ---------------------------------------------------------------------------------------
// Running one
// ---------------------------------------------------------------------------------------

struct Sandbox(PathBuf);

impl Sandbox {
    fn new(name: &str) -> Self {
        let path =
            std::env::temp_dir().join(format!("encastra-budget-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(&path).unwrap();
        Sandbox(path)
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn graph(json: serde_json::Value) -> Graph {
    Graph::parse(&json.to_string()).expect("fixture graph must parse")
}

/// Runs a graph with the live-value budget stated, and returns what happened.
///
/// The budget is named per run rather than left at [`MAX_LIVE_VALUE_BYTES`] for one reason:
/// proving a gibibyte is refused means allocating a gibibyte, and proving a value was released
/// *on time* means a budget tight enough that a late release is fatal. The mechanism under test
/// is identical either way — the ceiling is read once, before the run starts, and the counter
/// itself is a local of the executor that nothing here can reach.
fn run_within(name: &str, graph: &Graph, budget: u64) -> RunOutcome {
    let sandbox = Sandbox::new(name);
    let (registry, components) = fixtures();
    let mut broker = Broker::new(sandbox.0.join("run"), GrantSet::new()).unwrap();

    execute_request_within(
        RunRequest {
            graph,
            registry: &registry,
            components: &components,
            cancel: &AtomicBool::new(false),
            run_id: name,
            seed: BTreeMap::new(),
            observer: None,
        },
        &mut broker,
        budget,
    )
    .unwrap_or_else(|v| panic!("{name}: the fixture graph must validate: {:#?}", v.issues))
}

fn node(outcome: &RunOutcome, id: &str) -> encastra_core::NodeRecord {
    outcome
        .journal
        .nodes
        .get(&NodeId(id.into()))
        .unwrap_or_else(|| panic!("the journal has no record for {id}"))
        .clone()
}

/// A producer of `bytes`, optionally ordered after something.
fn big(bytes: i64) -> serde_json::Value {
    serde_json::json!({ "component": "test.big@1.0.0", "config": { "bytes": bytes } })
}

fn edge(from: (&str, &str), to: (&str, &str)) -> serde_json::Value {
    serde_json::json!({
        "from": { "node": from.0, "port": from.1 },
        "to":   { "node": to.0,   "port": to.1 }
    })
}

// ---------------------------------------------------------------------------------------
// The budget itself
// ---------------------------------------------------------------------------------------

#[test]
fn a_run_that_stays_under_the_budget_is_left_alone() {
    // The budget must be invisible to every workflow that is not the problem it exists for.
    let g = graph(serde_json::json!({
        "nodes": { "a_big": big(100), "b_sink": { "component": "test.sink@1.0.0" } },
        "edges": [edge(("a_big", "out"), ("b_sink", "in"))]
    }));

    let outcome = run_within("under", &g, 1_000);

    assert_eq!(
        outcome.journal.status,
        RunStatus::Ok,
        "{:#?}",
        outcome.journal.nodes
    );
    assert_eq!(node(&outcome, "a_big").status, NodeStatus::Ok);
    assert_eq!(node(&outcome, "b_sink").status, NodeStatus::Ok);
}

#[test]
fn the_budget_is_a_maximum_and_not_a_strict_bound() {
    // `a_big` with bytes=256 produces a 256-byte string and a one-byte tick: 257. `b_sink` then
    // produces its own one-byte `done` before what fed it is released — the accounting is
    // deliberately conservative about the moment a step hands over — so this run's peak is 258
    // exactly. A limit that refused at its own value would be off by one in the direction that
    // refuses work somebody is allowed to do, which is the expensive direction to be wrong in.
    let g = graph(serde_json::json!({
        "nodes": { "a_big": big(256), "b_sink": { "component": "test.sink@1.0.0" } },
        "edges": [edge(("a_big", "out"), ("b_sink", "in"))]
    }));

    let exactly = run_within("exact", &g, 258);
    assert_eq!(node(&exactly, "a_big").status, NodeStatus::Ok);
    assert_eq!(node(&exactly, "b_sink").status, NodeStatus::Ok);
    assert_eq!(exactly.journal.status, RunStatus::Ok);

    // And one byte less is over it, which is what makes the case above a real boundary rather
    // than a number that happened to be large enough.
    let over = run_within("exact-minus-one", &g, 257);
    assert_eq!(over.journal.status, RunStatus::Partial);
    assert_eq!(
        node(&over, "b_sink").error.as_ref().unwrap().code,
        "run-memory-budget"
    );

    // And a producer whose own output alone is past the limit is refused where it is produced.
    let well_over = run_within("exact-producer", &g, 256);
    assert_eq!(node(&well_over, "a_big").status, NodeStatus::Failed);
}

#[test]
fn a_producer_over_the_budget_is_refused_and_the_run_still_finishes() {
    let g = graph(serde_json::json!({
        "nodes": { "a_big": big(1_000), "b_sink": { "component": "test.sink@1.0.0" } },
        "edges": [edge(("a_big", "out"), ("b_sink", "in"))]
    }));

    let outcome = run_within("over", &g, 999);

    let producer = node(&outcome, "a_big");
    assert_eq!(producer.status, NodeStatus::Failed);
    let error = producer.error.as_ref().expect("a refusal must say why");
    assert_eq!(error.code, "run-memory-budget");
    assert!(
        error.message.contains("999"),
        "the refusal must name the budget it hit: {}",
        error.message
    );
    assert!(
        error.hint.is_some(),
        "a refusal a person can act on needs a hint"
    );

    // Downstream stops through the ordinary mechanism and names who is responsible — the same
    // path a denied capability takes, not a second one.
    let consumer = node(&outcome, "b_sink");
    assert_eq!(consumer.status, NodeStatus::Skipped);
    assert_eq!(consumer.skipped_because, Some(NodeId("a_big".into())));

    // The run ended in a journal, not in a panic or a process that vanished: every node in the
    // order has a record, and the run's own status says it failed.
    assert_eq!(outcome.journal.status, RunStatus::Failed);
    assert_eq!(outcome.journal.order.len(), 2);
    for id in &outcome.journal.order {
        assert!(
            outcome.journal.nodes.contains_key(id),
            "{id} is in the order but has no record"
        );
    }
    // And nothing from the refused step is being held.
    assert!(!outcome.outputs.contains_key(&PortRef {
        node: NodeId("a_big".into()),
        port: "out".into()
    }));
}

#[test]
fn many_small_producers_add_up_to_a_refusal_no_per_item_cap_could_see() {
    // This is the shape the per-item caps are blind to. Every one of these values is tiny — far
    // under one percent of the budget, and thousands of times under the 512 MB read cap — and
    // each producer is a legal node in a legal graph. They are all resident at once because
    // every producer runs before the step they share, so the sum is what matters and nothing
    // before this looked at the sum.
    const BUDGET: u64 = 900_000;
    const EACH: i64 = 8_000;
    // Checked when the test is compiled, not when it runs: a runtime assertion on two constants
    // two lines above it could never fail, and read as if it were testing something.
    const _: () = assert!((EACH as u64) < BUDGET / 100);

    let mut nodes = serde_json::Map::new();
    let mut edges = Vec::new();
    for n in 0..MERGE_INPUTS {
        // Zero-padded so the topological order is the numeric order, which keeps the failure
        // reproducible rather than dependent on how names sort.
        let id = format!("p{n:03}");
        nodes.insert(id.clone(), big(EACH));
        edges.push(edge((&id, "out"), ("zmerge", format!("in{n}").as_str())));
    }
    nodes.insert(
        "zmerge".into(),
        serde_json::json!({ "component": "test.merge@1.0.0" }),
    );
    let g = graph(serde_json::json!({ "nodes": nodes, "edges": edges }));

    let outcome = run_within("wide", &g, BUDGET);

    let refused: Vec<_> = outcome
        .journal
        .nodes
        .iter()
        .filter(|(_, r)| {
            r.error
                .as_ref()
                .is_some_and(|e| e.code == "run-memory-budget")
        })
        .map(|(id, _)| id.clone())
        .collect();
    assert!(
        !refused.is_empty(),
        "{} producers of {EACH} bytes each is {} bytes against a {BUDGET} byte budget, and none was refused",
        MERGE_INPUTS,
        MERGE_INPUTS as u64 * EACH as u64
    );
    // The step they all fed never ran on a half-built input set.
    assert_eq!(node(&outcome, "zmerge").status, NodeStatus::Skipped);
    // And the journal is complete: every node that was scheduled has a record.
    assert_eq!(outcome.journal.nodes.len(), MERGE_INPUTS + 1);
}

#[test]
fn a_refused_run_leaves_nothing_behind_for_the_next_one() {
    // The counter is a local of the executor, so a run that hit the budget cannot have left a
    // raised floor for the next one. Asserted by doing the refusal first and then a run that is
    // comfortably inside the same budget: if anything survived, this would be refused too.
    let refusing = graph(serde_json::json!({
        "nodes": { "a_big": big(1_000), "b_sink": { "component": "test.sink@1.0.0" } },
        "edges": [edge(("a_big", "out"), ("b_sink", "in"))]
    }));
    let refused = run_within("leak-first", &refusing, 999);
    assert_eq!(node(&refused, "a_big").status, NodeStatus::Failed);

    let modest = graph(serde_json::json!({
        "nodes": { "a_big": big(100), "b_sink": { "component": "test.sink@1.0.0" } },
        "edges": [edge(("a_big", "out"), ("b_sink", "in"))]
    }));
    let after = run_within("leak-second", &modest, 999);
    assert_eq!(
        after.journal.status,
        RunStatus::Ok,
        "a later run inherited something from the refused one: {:#?}",
        after.journal.nodes
    );
}

#[test]
fn the_budget_measures_what_is_held_at_once_not_what_a_run_produced_in_total() {
    // Two 600-byte values, one after the other, against a 1000-byte budget. Their *sum* is
    // 1200 and would be refused by an accounting that only ever added up; their *peak* is 600
    // and must not be. This is the test that fails if the release path stops decrementing —
    // which is the difference between a live budget and a running total.
    let g = graph(serde_json::json!({
        "nodes": {
            "a_big":   big(600),
            "b_sink":  { "component": "test.sink@1.0.0" },
            "c_big":   big(600),
            "d_sink":  { "component": "test.sink@1.0.0" }
        },
        "edges": [
            edge(("a_big", "out"),   ("b_sink", "in")),
            edge(("b_sink", "done"), ("c_big",  "after")),
            edge(("c_big", "out"),   ("d_sink", "in"))
        ]
    }));

    let outcome = run_within("peak", &g, 1_000);

    assert_eq!(
        outcome.journal.status,
        RunStatus::Ok,
        "the run held at most 600 bytes at a time and was refused anyway: {:#?}",
        outcome.journal.nodes
    );
    for id in ["a_big", "b_sink", "c_big", "d_sink"] {
        assert_eq!(node(&outcome, id).status, NodeStatus::Ok, "{id}");
    }
}

#[test]
fn the_shipped_budget_is_a_gibibyte_and_ordinary_runs_never_meet_it() {
    // The number is part of the contract: raising it to make something pass is a decision, not
    // a tweak, and this is where that decision would have to be made deliberately.
    assert_eq!(MAX_LIVE_VALUE_BYTES, 1024 * 1024 * 1024);

    // And the default path — no budget named — runs a workflow that holds megabytes without
    // noticing, which is the behaviour every existing workflow depends on.
    let g = graph(serde_json::json!({
        "nodes": { "a_big": big(4 * 1024 * 1024), "b_sink": { "component": "test.sink@1.0.0" } },
        "edges": [edge(("a_big", "out"), ("b_sink", "in"))]
    }));
    let sandbox = Sandbox::new("default-budget");
    let (registry, components) = fixtures();
    let mut broker = Broker::new(sandbox.0.join("run"), GrantSet::new()).unwrap();
    let outcome = encastra_core::runner::execute_request(
        RunRequest {
            graph: &g,
            registry: &registry,
            components: &components,
            cancel: &AtomicBool::new(false),
            run_id: "default-budget",
            seed: BTreeMap::new(),
            observer: None,
        },
        &mut broker,
    )
    .expect("the fixture graph must validate");
    assert_eq!(outcome.journal.status, RunStatus::Ok);
}

// ---------------------------------------------------------------------------------------
// When a value is let go
// ---------------------------------------------------------------------------------------
//
// Each of these asserts timing through the budget rather than by reading the executor's state.
// A value released a step late, or never, shows up as a later producer being refused; a value
// released a step early shows up as one that should have been refused succeeding. Nothing here
// needs an accessor into the run, so nothing here can be satisfied by adding one.

#[test]
fn a_value_with_two_consumers_survives_the_first_of_them() {
    // `a_big` (600) feeds both `b_sink` and `d_sink`. Between them runs `c_big`, another 600.
    // If the value were released after its *first* consumer, `c_big` would fit and succeed —
    // so `c_big` being refused is the proof that it was still held.
    let g = graph(serde_json::json!({
        "nodes": {
            "a_big":  big(600),
            "b_sink": { "component": "test.sink@1.0.0" },
            "c_big":  big(600),
            "d_sink": { "component": "test.sink@1.0.0" }
        },
        "edges": [
            edge(("a_big", "out"),  ("b_sink", "in")),
            edge(("a_big", "tick"), ("c_big",  "after")),
            edge(("a_big", "out"),  ("d_sink", "in")),
            edge(("c_big", "out"),  ("d_sink", "also"))
        ]
    }));

    let outcome = run_within("two-consumers", &g, 1_000);

    assert_eq!(node(&outcome, "b_sink").status, NodeStatus::Ok);
    let between = node(&outcome, "c_big");
    assert_eq!(
        between.status,
        NodeStatus::Failed,
        "a value with a consumer still to come was released early"
    );
    assert_eq!(
        between.error.as_ref().unwrap().code,
        "run-memory-budget",
        "{between:#?}"
    );
}

#[test]
fn a_value_is_gone_once_its_last_consumer_has_finished() {
    // The same shape, except the later producer is ordered after *both* consumers. Now the
    // value is genuinely finished with, and the 600 bytes it was occupying must be available
    // again — a run that refuses this is holding values nothing will ever read.
    let g = graph(serde_json::json!({
        "nodes": {
            "a_big":  big(600),
            "b_sink": { "component": "test.sink@1.0.0" },
            "c_sink": { "component": "test.sink@1.0.0" },
            "d_big":  big(600)
        },
        "edges": [
            edge(("a_big", "out"),   ("b_sink", "in")),
            edge(("a_big", "out"),   ("c_sink", "in")),
            edge(("c_sink", "done"), ("d_big",  "after"))
        ]
    }));

    let outcome = run_within("last-consumer", &g, 1_000);

    assert_eq!(
        outcome.journal.status,
        RunStatus::Ok,
        "{:#?}",
        outcome.journal.nodes
    );
    assert_eq!(node(&outcome, "d_big").status, NodeStatus::Ok);
}

#[test]
fn a_value_whose_only_consumer_is_switched_off_is_released() {
    // A disabled node never reads anything, so holding the value for it is holding it forever.
    // `c_big` runs after the disabled step and needs the room back.
    let g = graph(serde_json::json!({
        "nodes": {
            "a_big":  big(600),
            "b_sink": { "component": "test.sink@1.0.0", "disabled": true },
            "c_big":  big(600)
        },
        "edges": [
            edge(("a_big", "out"),  ("b_sink", "in")),
            edge(("a_big", "tick"), ("c_big",  "after"))
        ]
    }));

    let outcome = run_within("disabled-consumer", &g, 1_000);

    assert_eq!(node(&outcome, "b_sink").status, NodeStatus::Disabled);
    assert_eq!(
        node(&outcome, "c_big").status,
        NodeStatus::Ok,
        "the value a switched-off node would have read was never released"
    );
}

#[test]
fn a_value_whose_consumer_failed_is_released() {
    // A consumer that fails has had its turn. Keeping the value for it would mean a single
    // failing step raises a run's memory floor for everything after it.
    let g = graph(serde_json::json!({
        "nodes": {
            "a_big":   big(600),
            "b_fails": { "component": "test.fails@1.0.0" },
            "c_big":   big(600)
        },
        "edges": [
            edge(("a_big", "out"),  ("b_fails", "in")),
            edge(("a_big", "tick"), ("c_big",   "after"))
        ]
    }));

    let outcome = run_within("failed-consumer", &g, 1_000);

    assert_eq!(node(&outcome, "b_fails").status, NodeStatus::Failed);
    assert_eq!(
        node(&outcome, "c_big").status,
        NodeStatus::Ok,
        "a failing consumer left the value it never read in memory"
    );
}

#[test]
fn a_value_whose_consumer_was_skipped_is_released() {
    // `c_sink` is skipped because `a_fails` above it failed, so it never reads `b_big.out`.
    // The skip path is a different branch from the ran-and-finished path, and it has to release
    // too — otherwise one failure upstream pins every value beneath it for the rest of the run.
    let g = graph(serde_json::json!({
        "nodes": {
            "a_fails": { "component": "test.fails@1.0.0" },
            "b_big":   big(600),
            "c_sink":  { "component": "test.sink@1.0.0" },
            "d_big":   big(600)
        },
        "edges": [
            edge(("a_fails", "out"), ("c_sink", "also")),
            edge(("b_big", "out"),   ("c_sink", "in")),
            edge(("b_big", "tick"),  ("d_big",  "after"))
        ]
    }));

    let outcome = run_within("skipped-consumer", &g, 1_000);

    assert_eq!(node(&outcome, "c_sink").status, NodeStatus::Skipped);
    assert_eq!(
        node(&outcome, "d_big").status,
        NodeStatus::Ok,
        "a skipped consumer left the value it never read in memory"
    );
}

// ---------------------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------------------

#[test]
fn a_node_that_logs_without_end_is_cut_off_and_told_so() {
    let g = graph(serde_json::json!({
        "nodes": {
            "a_noisy": {
                "component": "test.noisy@1.0.0",
                "config": { "lines": 5_000, "chars": 4 }
            }
        },
        "edges": []
    }));

    let outcome = run_within("noisy", &g, 1_000_000);
    let logs = node(&outcome, "a_noisy").logs;

    // The cap, plus the one line that says what was dropped. The journal is cloned whole and
    // sent over IPC on every run, so "as many as the component felt like" is not a size.
    assert_eq!(logs.len(), MAX_LOG_LINES_PER_NODE + 1);
    let last = logs.last().unwrap();
    assert_eq!(
        last.message,
        format!("... {} more lines dropped", 5_000 - MAX_LOG_LINES_PER_NODE)
    );
    // Truncation that does not announce itself is worse than a long record: somebody reads the
    // last line and believes it is the last thing that happened.
    assert_eq!(last.level, LogLevel::Warn);
    // What was kept is the beginning, which is where a failure's cause usually is.
    assert!(logs[0].message.starts_with("0:"));
}

#[test]
fn a_log_line_longer_than_the_cap_is_truncated_with_a_marker() {
    let over = MAX_LOG_LINE_CHARS + 500;
    let g = graph(serde_json::json!({
        "nodes": {
            "a_noisy": {
                "component": "test.noisy@1.0.0",
                "config": { "lines": 1, "chars": over }
            }
        },
        "edges": []
    }));

    let outcome = run_within("long-line", &g, 1_000_000);
    let logs = node(&outcome, "a_noisy").logs;

    assert_eq!(logs.len(), 1);
    let message = &logs[0].message;
    assert!(
        message.ends_with("... (truncated)"),
        "a cut-short line must say it was cut short"
    );
    assert_eq!(
        message.chars().count(),
        MAX_LOG_LINE_CHARS + "... (truncated)".chars().count()
    );
}
