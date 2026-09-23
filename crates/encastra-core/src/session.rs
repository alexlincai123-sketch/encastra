//! Running a workflow that starts by itself.
//!
//! The executor's contract is "validate a directed acyclic graph, run it once, write a
//! journal". A watcher does not fit inside that and should not be made to: it produces values
//! over time, and each value is a *separate run* of the same graph.
//!
//! So a trigger lives here, above the executor. The session polls its triggers, and for every
//! event it calls the ordinary run path with that value seeded in. The executor's semantics —
//! and its tests — are untouched, and a trigger cannot introduce a cycle, a partial run, or any
//! of the states a streaming executor would have to handle.
//!
//! # What keeps this from running away
//!
//! - **One run at a time.** A folder with two hundred files produces two hundred runs, in
//!   order, not two hundred at once.
//! - **A bounded queue.** Beyond the cap, the oldest pending events are dropped and the count
//!   is reported. Silently queueing without limit is how a watcher becomes a memory leak.
//! - **Stop is checked between every run and inside long waits**, so stopping is quick even
//!   when the queue is long.

use std::collections::{BTreeMap, VecDeque};
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use encastra_protocol::manifest::ComponentManifest;

use crate::broker::{Broker, DirEntry};
use crate::graph::{Graph, Node, NodeId, PortRef};
use crate::journal::NodeError;
use crate::registry::ComponentRegistry;
use crate::runner::{
    CoreComponentSet, RunObserver, RunOutcome, RunRequest, execute_request_validated,
};
use crate::validate::{Validation, validate_with_supplied};
use crate::value::{Handle, HandleKind, Value};

/// Beyond this many pending events, the oldest are dropped. A person who drops a thousand files
/// into a watched folder wants them processed, not the application to fall over; a person who
/// points it at a folder that churns constantly wants it to keep up with the present.
pub const MAX_PENDING: usize = 512;

/// One event, and everything it produced.
///
/// A file appearing in a folder yields a handle, a name and an extension — three values that
/// describe *one* file and belong to one run. Queuing them separately would interleave two
/// files' names and handles the moment two arrived together, which is the kind of bug that
/// only shows up under load and looks like corruption.
#[derive(Debug, Clone, Default)]
pub struct Fired {
    pub values: BTreeMap<String, Value>,
}

impl Fired {
    pub fn new(port: impl Into<String>, value: Value) -> Self {
        Fired {
            values: BTreeMap::from([(port.into(), value)]),
        }
    }

    #[must_use]
    pub fn and(mut self, port: impl Into<String>, value: Value) -> Self {
        self.values.insert(port.into(), value);
        self
    }

    pub fn is_empty(&self) -> bool {
        self.values.is_empty()
    }
}

/// Something that produces values over time.
pub trait Trigger: Send {
    /// Whatever has appeared since the last call. An empty result is normal and not an error.
    fn poll(&mut self, ctx: &mut TriggerContext<'_>) -> Result<Vec<Fired>, NodeError>;

    /// How long to wait before asking again.
    fn interval(&self) -> Duration {
        Duration::from_millis(750)
    }
}

/// What a trigger may do. Deliberately narrow: read a folder it was allowed to read, and turn
/// a file it found there into a handle.
pub struct TriggerContext<'a> {
    node: NodeId,
    config: BTreeMap<String, serde_json::Value>,
    broker: &'a mut Broker,
}

impl TriggerContext<'_> {
    pub fn config_str(&self, key: &str) -> Option<&str> {
        self.config.get(key).and_then(|v| v.as_str())
    }

    pub fn config_i64(&self, key: &str) -> Option<i64> {
        self.config.get(key).and_then(|v| v.as_i64())
    }

    pub fn config_bool(&self, key: &str) -> Option<bool> {
        self.config.get(key).and_then(|v| v.as_bool())
    }

    /// Files in a folder the user allowed this node to read. One level, files only.
    pub fn list_dir(&mut self, directory: &Path) -> Result<Vec<DirEntry>, NodeError> {
        self.broker.list_dir(&self.node, directory)
    }

    /// Turns a file the trigger found into a handle, checking the folder grant again.
    pub fn import(&mut self, path: &Path, kind: HandleKind) -> Result<Handle, NodeError> {
        self.broker.import_guarded(&self.node, path, kind)
    }
}

/// Builds a trigger for a component that declares itself one.
pub type TriggerFactory = fn() -> Box<dyn Trigger>;

#[derive(Default, Clone)]
pub struct TriggerSet {
    by_ref: BTreeMap<String, TriggerFactory>,
}

impl TriggerSet {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, id_at_version: &str, factory: TriggerFactory) {
        self.by_ref.insert(id_at_version.to_owned(), factory);
    }

    pub fn build(&self, id_at_version: &str) -> Option<Box<dyn Trigger>> {
        self.by_ref.get(id_at_version).map(|factory| factory())
    }
}

/// What happened on one turn of the loop.
#[derive(Debug, Default)]
pub struct Tick {
    /// Runs that completed on this turn.
    pub runs: Vec<RunOutcome>,
    /// Events dropped because the queue was full.
    pub dropped: usize,
    /// A trigger that failed. Reported rather than fatal: a folder that disappears should stop
    /// that watcher, not tear down a workflow that may have other sources.
    pub trigger_errors: Vec<(NodeId, NodeError)>,
}

struct Mounted {
    node: NodeId,
    trigger: Box<dyn Trigger>,
    next_poll: Instant,
}

pub struct Session {
    graph: Graph,
    /// What [`Session::start`] worked out about this graph, kept rather than re-derived.
    ///
    /// A session owns its graph and nothing can edit it while the session holds it, so the
    /// answer cannot change between one event and the next: the same order, the same
    /// conversions. Re-validating per event did the work of the whole graph — every node, every
    /// edge, every required input, the topological sort — before running one event through it,
    /// which on a large graph costs more than the run itself.
    ///
    /// It is also the *right* answer to keep. `start` validated with every trigger port treated
    /// as supplied; one event supplies a subset of those, so validating per event asks a
    /// narrower question than the one the session already answered when it allowed Start.
    validation: Validation,
    components: CoreComponentSet,
    triggers: Vec<Mounted>,
    pending: VecDeque<(NodeId, Fired)>,
    dropped: usize,
    cancel: Arc<AtomicBool>,
    run_counter: u64,
    id: String,
}

impl Session {
    /// Validates the graph and mounts its triggers.
    ///
    /// Validation happens once, here, rather than per event: a graph that cannot run should say
    /// so when the user presses Start, not on the first file that arrives.
    pub fn start(
        graph: Graph,
        registry: &dyn ComponentRegistry,
        components: CoreComponentSet,
        triggers: &TriggerSet,
        id: impl Into<String>,
    ) -> Result<Self, Validation> {
        Self::start_with_supplied(
            graph,
            registry,
            components,
            triggers,
            id,
            &std::collections::BTreeSet::new(),
        )
    }

    /// The same, for a session whose entry inputs the application fills in.
    ///
    /// A trigger's output is not the only thing that arrives from outside the graph: the file a
    /// person picks in the chooser is too, and `validate_with_supplied` says so in as many words.
    /// `start` only ever counted the triggers, so a graph whose one input comes from the chooser -
    /// the first graph anybody builds, and the one the chooser journeys drive - was refused by the
    /// only button that would have run it, with "this workflow cannot run yet" and a count of
    /// problems the editor had no way to show. `run_graph` accepted the same graph, because it
    /// seeds before it runs; the two disagreed about what a runnable graph is.
    pub fn start_with_supplied(
        graph: Graph,
        registry: &dyn ComponentRegistry,
        components: CoreComponentSet,
        triggers: &TriggerSet,
        id: impl Into<String>,
        supplied_by_app: &std::collections::BTreeSet<PortRef>,
    ) -> Result<Self, Validation> {
        let mut supplied = trigger_ports(&graph, registry);
        supplied.extend(supplied_by_app.iter().cloned());
        let validation = validate_with_supplied(&graph, registry, &supplied);
        if !validation.is_runnable() {
            return Err(validation);
        }

        let mounted = graph
            .nodes
            .iter()
            .filter(|(_, node)| is_trigger(node, registry))
            .filter(|(_, node)| !node.disabled)
            .filter_map(|(id, node)| {
                triggers
                    .build(&node.component.to_string())
                    .map(|trigger| Mounted {
                        node: id.clone(),
                        // Poll immediately on the first turn so a folder that already has files in
                        // it is noticed at once rather than after the first interval.
                        next_poll: Instant::now(),
                        trigger,
                    })
            })
            .collect();

        Ok(Session {
            graph,
            validation,
            components,
            triggers: mounted,
            pending: VecDeque::new(),
            dropped: 0,
            cancel: Arc::new(AtomicBool::new(false)),
            run_counter: 0,
            id: id.into(),
        })
    }

    /// Whether this workflow starts by itself, or needs somebody to press Run.
    pub fn has_triggers(&self) -> bool {
        !self.triggers.is_empty()
    }

    /// A flag the application can set from another thread to stop the session.
    pub fn stop_flag(&self) -> Arc<AtomicBool> {
        Arc::clone(&self.cancel)
    }

    pub fn stop(&self) {
        self.cancel.store(true, Ordering::Relaxed);
    }

    pub fn is_stopped(&self) -> bool {
        self.cancel.load(Ordering::Relaxed)
    }

    /// How long the caller may sleep before the next poll is due.
    pub fn quiet_for(&self) -> Duration {
        if !self.pending.is_empty() {
            return Duration::ZERO;
        }
        let now = Instant::now();
        self.triggers
            .iter()
            .map(|m| m.next_poll.saturating_duration_since(now))
            .min()
            .unwrap_or(Duration::from_millis(250))
    }

    /// One turn: poll whatever is due, then run at most one queued event.
    pub fn tick(
        &mut self,
        registry: &dyn ComponentRegistry,
        broker: &mut Broker,
        observer: Option<&dyn RunObserver>,
    ) -> Tick {
        let mut tick = Tick::default();
        if self.is_stopped() {
            return tick;
        }

        let now = Instant::now();
        for mounted in &mut self.triggers {
            if mounted.next_poll > now {
                continue;
            }
            let config = self
                .graph
                .node(&mounted.node)
                .map(|n| n.config.clone())
                .unwrap_or_default();
            let mut ctx = TriggerContext {
                node: mounted.node.clone(),
                config,
                broker,
            };

            let outcome = mounted.trigger.poll(&mut ctx);
            // Scheduled after polling, not before: a trigger may only learn its period once it
            // has read its own settings, and asking first would lock in the default forever.
            mounted.next_poll = Instant::now() + mounted.trigger.interval();

            match outcome {
                Ok(fired) => {
                    for event in fired.into_iter().filter(|e: &Fired| !e.is_empty()) {
                        if self.pending.len() >= MAX_PENDING {
                            self.pending.pop_front();
                            self.dropped += 1;
                            tick.dropped += 1;
                        }
                        self.pending.push_back((mounted.node.clone(), event));
                    }
                }
                Err(error) => tick.trigger_errors.push((mounted.node.clone(), error)),
            }
        }

        // One run per turn. The caller stays responsive, Stop is checked between runs, and a
        // backlog drains in order rather than all at once.
        if let Some((node, event)) = self.pending.pop_front() {
            self.run_counter += 1;
            let run_id = format!("{}-{}", self.id, self.run_counter);
            let seed: BTreeMap<PortRef, Value> = event
                .values
                .into_iter()
                .map(|(port, value)| {
                    (
                        PortRef {
                            node: node.clone(),
                            port,
                        },
                        value,
                    )
                })
                .collect();

            let request = RunRequest {
                graph: &self.graph,
                registry,
                components: &self.components,
                cancel: &self.cancel,
                run_id: &run_id,
                seed,
                observer,
            };

            // With the validation from `start`, rather than working it out again per event —
            // see the field. There is no "it did not validate" branch here any more, because
            // the session could not have started if it did not.
            tick.runs
                .push(execute_request_validated(request, broker, &self.validation));
        }

        tick
    }

    /// How many events are waiting, and how many have been dropped in total.
    pub fn backlog(&self) -> (usize, usize) {
        (self.pending.len(), self.dropped)
    }

    pub fn runs_completed(&self) -> u64 {
        self.run_counter
    }
}

fn is_trigger(node: &Node, registry: &dyn ComponentRegistry) -> bool {
    registry
        .get(&node.component)
        .is_some_and(|manifest| manifest.trigger)
}

/// The output ports of every trigger in the graph.
///
/// Validation treats these as supplied, because they are: the session produces them. Without
/// this, every trigger-driven graph would fail validation for an input nothing appears to fill.
fn trigger_ports(
    graph: &Graph,
    registry: &dyn ComponentRegistry,
) -> std::collections::BTreeSet<PortRef> {
    graph
        .nodes
        .iter()
        .filter_map(|(id, node)| {
            registry
                .get(&node.component)
                .filter(|manifest| manifest.trigger)
                .map(|manifest: &ComponentManifest| (id, manifest))
        })
        .flat_map(|(id, manifest)| {
            manifest.ports.outputs.keys().map(move |port| PortRef {
                node: id.clone(),
                port: port.clone(),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::broker::GrantSet;

    /// A trigger that reports a burst of events on every poll.
    ///
    /// A burst is the case that matters: one event per poll can never outrun a loop that
    /// consumes one per turn, so it would not exercise the bound at all. A folder someone has
    /// just copied a thousand files into arrives exactly like this.
    struct Burst {
        per_poll: usize,
        polls_left: usize,
    }

    impl Trigger for Burst {
        fn poll(&mut self, _ctx: &mut TriggerContext<'_>) -> Result<Vec<Fired>, NodeError> {
            if self.polls_left == 0 {
                return Ok(Vec::new());
            }
            self.polls_left -= 1;
            Ok((0..self.per_poll)
                .map(|n| Fired::new("value", Value::Int(n as i64)))
                .collect())
        }

        fn interval(&self) -> Duration {
            Duration::ZERO
        }
    }

    fn broker() -> Broker {
        let dir = std::env::temp_dir().join(format!("encastra-session-{}", std::process::id()));
        Broker::new(dir, GrantSet::new()).unwrap()
    }

    #[test]
    fn the_queue_is_bounded_and_says_what_it_dropped() {
        // A watcher pointed at a churning folder must not grow without limit.
        let mut session = Session {
            graph: Graph::default(),
            // These tests drive the queue, not the executor: an empty graph has nothing to
            // validate and nothing to run.
            validation: Validation::default(),
            components: CoreComponentSet::new(),
            triggers: vec![Mounted {
                node: NodeId("t".into()),
                trigger: Box::new(Burst {
                    per_poll: MAX_PENDING + 64,
                    polls_left: 3,
                }),
                next_poll: Instant::now(),
            }],
            pending: VecDeque::new(),
            dropped: 0,
            cancel: Arc::new(AtomicBool::new(false)),
            run_counter: 0,
            id: "test".into(),
        };

        let registry = crate::registry::InMemoryRegistry::new();
        let mut broker = broker();
        let mut reported = 0usize;
        for _ in 0..5 {
            reported += session.tick(&registry, &mut broker, None).dropped;
        }

        let (pending, dropped) = session.backlog();
        assert!(pending <= MAX_PENDING, "queue grew to {pending}");
        assert!(dropped > 0, "the queue overflowed but recorded nothing");
        assert_eq!(reported, dropped, "each turn must report what it dropped");
    }

    /// Counts what the runtime asks of a registry.
    ///
    /// Validation resolves every node's manifest exactly once, and so does execution, so the
    /// number of lookups a turn makes says plainly whether the graph was validated again. A
    /// timing test would say the same thing less reliably and only on a fast enough machine.
    struct Counting<'a> {
        inner: &'a crate::registry::InMemoryRegistry,
        gets: std::cell::Cell<usize>,
    }

    impl ComponentRegistry for Counting<'_> {
        fn get(&self, reference: &crate::graph::ComponentRef) -> Option<&ComponentManifest> {
            self.gets.set(self.gets.get() + 1);
            self.inner.get(reference)
        }

        fn list(&self) -> Vec<&ComponentManifest> {
            self.inner.list()
        }
    }

    fn manifest(id: &str, trigger: bool) -> ComponentManifest {
        ComponentManifest::parse(
            &serde_json::json!({
                "schema": 1, "id": id, "version": "1.0.0", "name": id,
                "runtime": ">=0.1.0", "kind": "core", "trigger": trigger,
                "ports": { "outputs": { "value": { "type": "i64" } } }
            })
            .to_string(),
        )
        .expect("fixture manifest must be valid")
    }

    #[test]
    fn a_graph_whose_one_input_the_person_picked_is_runnable() {
        // The workflow anybody builds first: one step, no trigger, and its input is the file
        // chosen in the chooser. `start` validated as though nothing had been chosen, so Run
        // refused it - "this workflow cannot run yet" with a count of problems and no way to see
        // them - while the editor's own check, which counts what was supplied, said it was fine.
        let mut inner = crate::registry::InMemoryRegistry::new();
        inner
            .insert(
                ComponentManifest::parse(
                    &serde_json::json!({
                        "schema": 1, "id": "test.sink", "version": "1.0.0", "name": "sink",
                        "runtime": ">=0.1.0", "kind": "core",
                        "ports": { "inputs": { "file": { "type": "i64", "required": true } } }
                    })
                    .to_string(),
                )
                .expect("fixture manifest must be valid"),
            )
            .unwrap();
        let graph = Graph::parse(
            &serde_json::json!({
                "nodes": { "save-1": { "component": "test.sink@1.0.0" } }, "edges": []
            })
            .to_string(),
        )
        .unwrap();
        let triggers = TriggerSet::new();

        let refused = Session::start(
            graph.clone(),
            &inner,
            CoreComponentSet::default(),
            &triggers,
            "run-1",
        );
        let validation = refused
            .err()
            .expect("unsupplied: still refused, and rightly");
        assert_eq!(validation.errors().count(), 1, "the unconnected input");

        let supplied = std::collections::BTreeSet::from([PortRef {
            node: NodeId("save-1".into()),
            port: "file".into(),
        }]);
        assert!(
            Session::start_with_supplied(
                graph,
                &inner,
                CoreComponentSet::default(),
                &triggers,
                "run-2",
                &supplied,
            )
            .is_ok(),
            "a file the person picked feeds that input as surely as a trigger's output does"
        );
    }

    #[test]
    fn a_session_validates_its_graph_once_and_not_once_per_event() {
        // A session runs the same graph for every event a trigger produces. The graph cannot
        // change while the session holds it, so re-deriving the order, the conversions and
        // every required input per event is work with an answer already in hand — and on a
        // graph of any size it is more work than the run it precedes.
        const NODES: usize = 12;

        let mut inner = crate::registry::InMemoryRegistry::new();
        inner.insert(manifest("test.trigger", true)).unwrap();
        inner.insert(manifest("test.step", false)).unwrap();

        let mut nodes = serde_json::Map::new();
        nodes.insert(
            "t".into(),
            serde_json::json!({ "component": "test.trigger@1.0.0" }),
        );
        for n in 1..NODES {
            nodes.insert(
                format!("n{n}"),
                serde_json::json!({ "component": "test.step@1.0.0" }),
            );
        }
        let graph =
            Graph::parse(&serde_json::json!({ "nodes": nodes, "edges": [] }).to_string()).unwrap();

        let registry = Counting {
            inner: &inner,
            gets: std::cell::Cell::new(0),
        };
        let mut triggers = TriggerSet::new();
        triggers.insert("test.trigger@1.0.0", || {
            Box::new(Burst {
                per_poll: 1,
                polls_left: 100,
            })
        });

        let mut session = Session::start(
            graph,
            &registry,
            CoreComponentSet::new(),
            &triggers,
            "validation-once",
        )
        .expect("the fixture graph must validate");

        let mut broker = broker();
        let runs = 4usize;
        registry.gets.set(0);
        for _ in 0..runs {
            session.tick(&registry, &mut broker, None);
        }
        let per_run = registry.gets.get() / runs;

        assert_eq!(
            session.runs_completed(),
            runs as u64,
            "each turn must have run one event"
        );
        // Executing resolves each node once, plus once for the event the trigger seeded.
        // Validating again would roughly double that: every node resolved a second time, for an
        // answer the session worked out when it started.
        assert!(
            per_run <= NODES + 2,
            "each run resolved {per_run} components for a {NODES} node graph, which is the \
             graph being validated all over again"
        );
    }

    #[test]
    fn stopping_ends_the_session_immediately() {
        let mut session = Session {
            graph: Graph::default(),
            // These tests drive the queue, not the executor: an empty graph has nothing to
            // validate and nothing to run.
            validation: Validation::default(),
            components: CoreComponentSet::new(),
            triggers: vec![Mounted {
                node: NodeId("t".into()),
                trigger: Box::new(Burst {
                    per_poll: 10,
                    polls_left: 100,
                }),
                next_poll: Instant::now(),
            }],
            pending: VecDeque::new(),
            dropped: 0,
            cancel: Arc::new(AtomicBool::new(false)),
            run_counter: 0,
            id: "test".into(),
        };

        let registry = crate::registry::InMemoryRegistry::new();
        let mut broker = broker();
        session.stop();
        let tick = session.tick(&registry, &mut broker, None);

        assert!(tick.runs.is_empty());
        assert_eq!(session.backlog().0, 0, "a stopped session polls nothing");
    }
}
