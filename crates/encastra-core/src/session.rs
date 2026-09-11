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
use crate::runner::{CoreComponentSet, RunObserver, RunOutcome, RunRequest, execute_request};
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
        let supplied = trigger_ports(&graph, registry);
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

            match execute_request(request, broker) {
                Ok(outcome) => tick.runs.push(outcome),
                // The graph validated when the session started, so this cannot normally
                // happen. If it does, stopping beats looping on the same failure forever.
                Err(_) => self.stop(),
            }
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

    #[test]
    fn stopping_ends_the_session_immediately() {
        let mut session = Session {
            graph: Graph::default(),
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
