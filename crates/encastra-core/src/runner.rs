//! Executing a validated graph.
//!
//! Scheduling is currently **sequential**, in the order validation produced. Running
//! independent branches concurrently is planned and the order already permits it; it is not
//! claimed here until it exists. Preemptive per-node timeouts arrive with the WebAssembly host,
//! where epoch interruption can genuinely stop a running component — a timeout that cannot
//! stop anything would be a progress bar, not a control.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use encastra_protocol::manifest::ComponentManifest;

use crate::broker::Broker;
use crate::convert::apply_ops;
use crate::graph::{Edge, Graph, NodeId, PortRef};
use crate::journal::{LogLevel, LogLine, NodeError, NodeRecord, NodeStatus, RunJournal, now_ms};
use crate::registry::ComponentRegistry;
use crate::validate::Validation;
use crate::value::{Handle, HandleKind, Value};

/// The longest a single run may take before it is stopped.
///
/// Not a per-node timeout — see the module note above for why that has to wait for a host that
/// can actually interrupt a running component. This is the outer bound, checked between nodes,
/// and it exists because duration is the one dimension of a run that validation does not already
/// bound. Cycles are refused, so the step count cannot exceed the node ceiling; but a chain of
/// `Delay` nodes is a legal graph, and ten thousand nodes each waiting an hour is a thread
/// occupied for longer than anybody is watching.
///
/// An hour is far beyond any run this product is for, and a session with a trigger is unaffected:
/// the bound is per run, and a watcher starts a new one per file.
pub const MAX_RUN_DURATION: std::time::Duration = std::time::Duration::from_secs(60 * 60);

/// A first-party component, compiled into the host.
///
/// Being in-process buys speed and native crates; it buys **no** extra authority. Everything
/// here reaches the OS through [`NodeContext`], which reaches it through the broker, with this
/// node's grants (ADR-0002).
pub trait CoreComponent: Send + Sync {
    fn manifest(&self) -> &ComponentManifest;
    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<BTreeMap<String, Value>, NodeError>;
}

#[derive(Default, Clone)]
pub struct CoreComponentSet {
    by_ref: BTreeMap<String, Arc<dyn CoreComponent>>,
}

impl CoreComponentSet {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, component: Arc<dyn CoreComponent>) -> Result<(), String> {
        let manifest = component.manifest();
        let key = format!("{}@{}", manifest.id, manifest.version);
        if self.by_ref.contains_key(&key) {
            return Err(format!("{key} is registered twice"));
        }
        self.by_ref.insert(key, component);
        Ok(())
    }

    pub fn get(&self, id_at_version: &str) -> Option<&Arc<dyn CoreComponent>> {
        self.by_ref.get(id_at_version)
    }

    pub fn manifests(&self) -> impl Iterator<Item = &ComponentManifest> {
        self.by_ref.values().map(|c| c.manifest())
    }
}

/// Everything a component may do, and nothing else.
pub struct NodeContext<'a> {
    node: NodeId,
    pub inputs: BTreeMap<String, Value>,
    pub config: BTreeMap<String, serde_json::Value>,
    broker: &'a mut Broker,
    logs: Vec<LogLine>,
    cancel: &'a AtomicBool,
}

impl<'a> NodeContext<'a> {
    pub fn input(&self, port: &str) -> Option<&Value> {
        self.inputs.get(port)
    }

    /// Reads what the graph connected to this node. Goes through the broker, which checks both
    /// that this component declared `fs.read` and that the graph actually gave it this handle.
    pub fn read(&mut self, handle: Handle) -> Result<Vec<u8>, NodeError> {
        self.broker.open_input(&self.node, handle)
    }

    pub fn read_text(&mut self, handle: Handle) -> Result<String, NodeError> {
        let bytes = self.read(handle)?;
        String::from_utf8(bytes).map_err(|_| {
            NodeError::new("not-text", "This file is not valid UTF-8 text.")
                .with_hint("Connect it to a component that works with bytes instead.")
        })
    }

    pub fn create_output(&mut self, kind: HandleKind, name: &str) -> Result<Handle, NodeError> {
        self.broker.create_output(&self.node, kind, name)
    }

    pub fn write(&mut self, handle: Handle, bytes: &[u8]) -> Result<(), NodeError> {
        self.broker.write_output(&self.node, handle, bytes)
    }

    pub fn save_to(
        &mut self,
        handle: Handle,
        directory: &std::path::Path,
        filename: &str,
    ) -> Result<std::path::PathBuf, NodeError> {
        self.broker.save_to(&self.node, handle, directory, filename)
    }

    pub fn move_to(
        &mut self,
        handle: Handle,
        directory: &std::path::Path,
        filename: &str,
    ) -> Result<std::path::PathBuf, NodeError> {
        self.broker.move_to(&self.node, handle, directory, filename)
    }

    /// The name of the file behind a handle, with no directory.
    ///
    /// Enough to name an output after its input, which a workflow that processes many files
    /// needs; not enough to learn where anything lives.
    pub fn source_name(&self, handle: Handle) -> Option<String> {
        self.broker.display_name(handle).map(str::to_owned)
    }

    pub fn allowed_hosts(&self) -> Vec<String> {
        self.broker.allowed_hosts(&self.node)
    }

    pub fn check_http(&mut self, host: &str) -> Result<(), NodeError> {
        self.broker.check_http(&self.node, host)
    }

    pub fn clipboard_allowed(&self) -> bool {
        self.broker.has_capability(&self.node, "system.clipboard")
    }

    pub fn use_clipboard(&mut self, detail: &str) -> Result<(), NodeError> {
        self.broker.use_clipboard(&self.node, detail)
    }

    pub fn notify(&mut self, title: &str) -> Result<(), NodeError> {
        self.broker.notify(&self.node, title)
    }

    pub fn log(&mut self, level: LogLevel, message: impl Into<String>) {
        self.logs.push(LogLine {
            at_ms: now_ms(),
            level,
            message: message.into(),
        });
    }

    /// Long-running components check this and stop. Cooperative for now — see the module note.
    pub fn is_cancelled(&self) -> bool {
        self.cancel.load(Ordering::Relaxed)
    }

    pub fn config_str(&self, key: &str) -> Option<&str> {
        self.config.get(key).and_then(|v| v.as_str())
    }

    pub fn config_i64(&self, key: &str) -> Option<i64> {
        self.config.get(key).and_then(|v| v.as_i64())
    }

    pub fn config_bool(&self, key: &str) -> Option<bool> {
        self.config.get(key).and_then(|v| v.as_bool())
    }
}

/// Told what is happening while it happens.
///
/// The journal is the record of a finished run and is deliberately immutable; progress is a
/// stream. Conflating them would mean handing out a half-written journal, and the debugger's
/// guarantee — that what it shows is what happened — would stop being true.
///
/// Implementations are called from the thread running the graph. They must not block: a slow
/// observer slows the workflow.
pub trait RunObserver: Send + Sync {
    fn run_started(&self, _run_id: &str, _order: &[NodeId]) {}
    fn node_started(&self, _run_id: &str, _node: &NodeId) {}
    fn node_finished(&self, _run_id: &str, _node: &NodeId, _record: &NodeRecord) {}
    fn run_finished(&self, _journal: &RunJournal) {}
}

/// Everything one execution needs.
pub struct RunRequest<'a> {
    pub graph: &'a Graph,
    pub registry: &'a dyn ComponentRegistry,
    pub components: &'a CoreComponentSet,
    pub cancel: &'a AtomicBool,
    pub run_id: &'a str,
    /// Values the application supplies: the file a person picked, or what a trigger produced.
    pub seed: BTreeMap<PortRef, Value>,
    pub observer: Option<&'a dyn RunObserver>,
}

#[derive(Debug)]
pub struct RunOutcome {
    pub journal: RunJournal,
    /// The values still held when the run ended: what the graph's terminal ports produced, for
    /// a caller that wants the results rather than just the record of them.
    ///
    /// Not every value that was ever produced. A value is dropped the moment its last consumer
    /// has finished with it, so that a run's memory is bounded by the widest point of the graph
    /// rather than by its length — see the note in `execute`. The journal keeps a summary of
    /// every value; this keeps the values nothing downstream was waiting for.
    pub outputs: BTreeMap<PortRef, Value>,
}

/// Validates, then runs. A graph that does not validate is never partially executed — there is
/// no state to unwind and no half-written result to explain.
pub fn run(
    graph: &Graph,
    registry: &dyn ComponentRegistry,
    components: &CoreComponentSet,
    broker: &mut Broker,
    cancel: &AtomicBool,
    run_id: &str,
) -> Result<RunOutcome, Validation> {
    run_seeded(
        graph,
        registry,
        components,
        broker,
        cancel,
        run_id,
        BTreeMap::new(),
    )
}

/// Runs a graph whose entry nodes are fed by the application rather than by an edge.
///
/// `seed` supplies values for ports nothing produces: the file a user picked, the event a
/// trigger delivered. The executor treats them exactly like a producer's output, so a
/// component cannot tell the difference and there is no second delivery path to keep in step.
pub fn run_seeded(
    graph: &Graph,
    registry: &dyn ComponentRegistry,
    components: &CoreComponentSet,
    broker: &mut Broker,
    cancel: &AtomicBool,
    run_id: &str,
    seed: BTreeMap<PortRef, Value>,
) -> Result<RunOutcome, Validation> {
    execute_request(
        RunRequest {
            graph,
            registry,
            components,
            cancel,
            run_id,
            seed,
            observer: None,
        },
        broker,
    )
}

/// Validates and runs, reporting progress as it goes.
pub fn execute_request(
    request: RunRequest<'_>,
    broker: &mut Broker,
) -> Result<RunOutcome, Validation> {
    let RunRequest {
        graph,
        registry,
        components,
        cancel,
        run_id,
        seed,
        observer,
    } = request;
    let supplied: std::collections::BTreeSet<PortRef> = seed.keys().cloned().collect();
    let validation = crate::validate::validate_with_supplied(graph, registry, &supplied);
    if !validation.is_runnable() {
        return Err(validation);
    }
    // A seeded handle is reachable by the node it was supplied to, and by nothing else.
    for (port, value) in &seed {
        if let Value::Handle(handle) = value {
            broker.make_reachable(&port.node, *handle);
        }
    }
    Ok(execute(
        Execution {
            graph,
            registry,
            components,
            cancel,
            validation: &validation,
            observer,
        },
        broker,
        run_id,
        seed,
    ))
}

/// Everything the executor needs that does not change while a run proceeds.
///
/// Grouped rather than passed as eight parameters: a call with eight positional arguments of
/// similar shape is one transposition away from a bug the type system cannot catch.
struct Execution<'a> {
    graph: &'a Graph,
    registry: &'a dyn ComponentRegistry,
    components: &'a CoreComponentSet,
    cancel: &'a AtomicBool,
    validation: &'a Validation,
    observer: Option<&'a dyn RunObserver>,
}

fn execute(
    plan: Execution<'_>,
    broker: &mut Broker,
    run_id: &str,
    seed: BTreeMap<PortRef, Value>,
) -> RunOutcome {
    let Execution {
        graph,
        registry,
        components,
        cancel,
        validation,
        observer,
    } = plan;

    let mut journal = RunJournal::new(run_id);
    journal.order = validation.order.clone();
    if let Some(observer) = observer {
        observer.run_started(run_id, &journal.order);
    }
    let mut outputs: BTreeMap<PortRef, Value> = BTreeMap::new();

    // A seed names either an input port — the file a person picked — or an output port, which
    // is what a trigger produced. Both are values the application supplied; they differ only in
    // where they enter the graph. Sorting them here means the rest of the executor does not
    // have to know which kind it is looking at.
    let mut seeded: BTreeMap<PortRef, Value> = BTreeMap::new();
    for (port, value) in seed {
        let is_output = graph
            .node(&port.node)
            .and_then(|node| registry.get(&node.component))
            .is_some_and(|manifest| manifest.ports.outputs.contains_key(&port.port));
        if is_output {
            if let Value::Handle(handle) = &value {
                // Only what is wired to *this* port. A watcher emits the file alongside its
                // name and its extension; a node taking only the name has been given no reason
                // to reach the file, and reading the edge's source port is what keeps the grant
                // as narrow as the graph the person actually drew.
                for consumer in graph
                    .outgoing(&port.node)
                    .filter(|edge| edge.from.port == port.port)
                    .map(|edge| &edge.to.node)
                {
                    broker.make_reachable(consumer, *handle);
                }
            }
            outputs.insert(port, value);
        } else {
            seeded.insert(port, value);
        }
    }

    let conversions: BTreeMap<(&PortRef, &PortRef), &Vec<String>> = validation
        .conversions
        .iter()
        .map(|plan| ((&plan.from, &plan.to), &plan.ops))
        .collect();

    // How many edges still have to read each produced value.
    //
    // A produced value used to live in `outputs` until the run ended, which made a run's memory
    // proportional to the *length* of the graph: a chain of ten thousand steps each handing a
    // 50 KB document to the next held ten thousand documents at once — measured at close to
    // four gigabytes for twenty thousand — when at no point did more than one step need one.
    // Every edge out of a port is counted here, and when the last consumer of a port has
    // finished, whatever it produced is dropped. Memory is then bounded by how *wide* the graph
    // is, which is the shape a person drew, rather than by how long it is.
    //
    // A consumer counts as finished whatever happened to it — ran, failed, was skipped, was
    // cancelled, was disabled — because in every one of those cases it is never going to read
    // the value. Validation refuses cycles and orders producers before consumers, so a port's
    // count only ever reaches zero after everything that could have read it has had its turn.
    let mut consumers_left: BTreeMap<&PortRef, usize> = BTreeMap::new();
    // And which edges feed each node, indexed once. `Graph::incoming` walks every edge in the
    // graph to answer for one node, and this loop asked it three times per node — to find a
    // blocker, to gather inputs, to release values — which made a run quadratic in the size of
    // the graph: twenty thousand steps spent more time scanning edges than running components.
    let mut incoming: BTreeMap<&NodeId, Vec<&Edge>> = BTreeMap::new();
    for edge in &graph.edges {
        *consumers_left.entry(&edge.from).or_insert(0) += 1;
        incoming.entry(&edge.to.node).or_default().push(edge);
    }
    const NO_EDGES: &[&Edge] = &[];

    // A run is bounded in wall-clock time as well as in steps.
    //
    // Nothing in a graph can loop — cycles are refused by validation — so the step count is
    // already bounded by the node ceiling. Duration is not: a chain of Delay nodes is a
    // perfectly legitimate shape, and ten thousand nodes each waiting an hour is a graph that
    // occupies a thread until somebody notices. Past the deadline the run is cancelled exactly
    // as if Stop had been pressed, so there is one mechanism for "this run ended early" and one
    // way it appears in the journal.
    let started_at = std::time::Instant::now();

    for node_id in &validation.order {
        let Some(node) = graph.node(node_id) else {
            continue;
        };
        let feeding: &[&Edge] = incoming.get(node_id).map_or(NO_EDGES, Vec::as_slice);

        // One block, one exit per step: however the step ends, the record it leaves is written
        // to the journal below and the values it consumed are released below. The alternative —
        // remembering to release at each of eight early exits — is how one of them is forgotten.
        let record = 'step: {
            let mut record = NodeRecord::new(node.component.to_string());

            let overran = started_at.elapsed() > MAX_RUN_DURATION;
            if overran {
                cancel.store(true, Ordering::Relaxed);
            }

            if node.disabled {
                record.status = NodeStatus::Disabled;
                if let Some(observer) = observer {
                    observer.node_finished(run_id, node_id, &record);
                }
                break 'step record;
            }

            if cancel.load(Ordering::Relaxed) {
                record.status = NodeStatus::Cancelled;
                if overran {
                    // Cancelled by the clock rather than by a person, which is a different thing
                    // to read in a journal six hours later.
                    record.error = Some(NodeError::new(
                        "run-too-long",
                        format!(
                            "This run passed the {} minute limit and was stopped.",
                            MAX_RUN_DURATION.as_secs() / 60
                        ),
                    ));
                }
                if let Some(observer) = observer {
                    observer.node_finished(run_id, node_id, &record);
                }
                break 'step record;
            }

            // If anything upstream did not produce, this node does not run. Saying which node is
            // responsible is the difference between a debuggable run and a mystery.
            if let Some(blocker) = upstream_blocker(feeding, &journal) {
                record.status = NodeStatus::Skipped;
                record.skipped_because = Some(blocker);
                if let Some(observer) = observer {
                    observer.node_finished(run_id, node_id, &record);
                }
                break 'step record;
            }

            let Some(manifest) = registry.get(&node.component) else {
                record.status = NodeStatus::Failed;
                record.error = Some(NodeError::new(
                    "component-missing",
                    format!("{} is not installed.", node.component),
                ));
                break 'step record;
            };

            let inputs = match gather_inputs(
                feeding,
                node_id,
                manifest,
                &outputs,
                &seeded,
                &conversions,
                broker,
            ) {
                Ok(inputs) => inputs,
                Err(error) => {
                    record.status = NodeStatus::Failed;
                    record.error = Some(error);
                    record.capability_calls = broker.take_calls(node_id);
                    break 'step record;
                }
            };

            for (port, value) in &inputs {
                record.inputs.insert(port.clone(), value.summary());
            }

            if manifest.trigger {
                record.status = NodeStatus::Ok;
                record.duration_ms = Some(0);
                record.started_at_ms = Some(now_ms());
                for (port, value) in outputs
                    .iter()
                    .filter(|(reference, _)| reference.node == *node_id)
                {
                    record.outputs.insert(port.port.clone(), value.summary());
                }
                break 'step record;
            }

            let Some(implementation) = components.get(&node.component.to_string()) else {
                record.status = NodeStatus::Failed;
                record.error = Some(
                    NodeError::new(
                        "no-implementation",
                        format!(
                            "{} has a manifest but no code in this build.",
                            node.component
                        ),
                    )
                    .with_hint("Sandboxed components are not executable in this build yet."),
                );
                break 'step record;
            };

            let started = Instant::now();
            record.started_at_ms = Some(now_ms());
            record.status = NodeStatus::Running;
            if let Some(observer) = observer {
                observer.node_started(run_id, node_id);
            }

            let mut ctx = NodeContext {
                node: node_id.clone(),
                inputs,
                config: node.config.clone(),
                broker,
                logs: Vec::new(),
                cancel,
            };
            let result = implementation.run(&mut ctx);
            let logs = std::mem::take(&mut ctx.logs);

            record.duration_ms = Some(started.elapsed().as_millis() as u64);
            record.logs = logs;
            record.capability_calls = broker.take_calls(node_id);

            match result.and_then(|produced| check_outputs(manifest, produced)) {
                Ok(produced) => {
                    // Moved, not cloned: the component handed these over and nothing else holds
                    // them. A copy of every output of every step is a second run's worth of memory.
                    for (port, value) in produced {
                        record.outputs.insert(port.clone(), value.summary());
                        outputs.insert(
                            PortRef {
                                node: node_id.clone(),
                                port,
                            },
                            value,
                        );
                    }
                    record.status = NodeStatus::Ok;
                }
                Err(error) => {
                    record.status = NodeStatus::Failed;
                    record.error = Some(error);
                }
            }

            if let Some(observer) = observer {
                observer.node_finished(run_id, node_id, &record);
            }
            record
        };

        // This step is finished with everything that fed it. Release what nothing else is
        // waiting for — see `consumers_left` above.
        for edge in feeding {
            if let Some(left) = consumers_left.get_mut(&edge.from) {
                *left = left.saturating_sub(1);
                if *left == 0 {
                    outputs.remove(&edge.from);
                }
            }
        }
        journal.nodes.insert(node_id.clone(), record);
    }

    journal.finish();
    if let Some(observer) = observer {
        observer.run_finished(&journal);
    }
    RunOutcome { journal, outputs }
}

/// The nearest upstream node that failed, was skipped, or was cancelled, among the edges that
/// feed the node in question.
fn upstream_blocker(feeding: &[&Edge], journal: &RunJournal) -> Option<NodeId> {
    feeding
        .iter()
        .map(|edge| &edge.from.node)
        .find(|producer| {
            journal.nodes.get(*producer).is_some_and(|r| {
                matches!(
                    r.status,
                    NodeStatus::Failed | NodeStatus::Skipped | NodeStatus::Cancelled
                )
            })
        })
        .cloned()
}

/// Assembles what a node receives: the values the application supplied for it, then whatever
/// arrived along `feeding` — the edges into this node, already indexed by the caller.
fn gather_inputs(
    feeding: &[&Edge],
    node: &NodeId,
    manifest: &ComponentManifest,
    outputs: &BTreeMap<PortRef, Value>,
    seeded: &BTreeMap<PortRef, Value>,
    conversions: &BTreeMap<(&PortRef, &PortRef), &Vec<String>>,
    broker: &mut Broker,
) -> Result<BTreeMap<String, Value>, NodeError> {
    let mut inputs = BTreeMap::new();

    // Application-supplied values first. An edge into the same port cannot exist: validation
    // already refuses two sources for one input.
    for (port, value) in seeded {
        if &port.node == node {
            inputs.insert(port.port.clone(), value.clone());
        }
    }

    for edge in feeding {
        let Some(produced) = outputs.get(&edge.from) else {
            // Validation guarantees the producer runs first, so this means the producer
            // succeeded without filling this port. Optional outputs are legitimately absent.
            inputs.insert(edge.to.port.clone(), Value::Absent);
            continue;
        };

        let value = match conversions.get(&(&edge.from, &edge.to)) {
            Some(ops) => apply_ops(produced.clone(), ops, node, broker)?,
            None => produced.clone(),
        };

        // Only now does this node become able to open the handle — and only this one.
        if let Value::Handle(handle) = &value {
            broker.make_reachable(node, *handle);
        }
        if let Value::List(items) = &value {
            for item in items {
                if let Value::Handle(handle) = item {
                    broker.make_reachable(node, *handle);
                }
            }
        }

        inputs.insert(edge.to.port.clone(), value);
    }

    // Unconnected optional inputs arrive as absent rather than missing, so a component reads
    // one shape of input map regardless of how the graph was wired.
    for port in manifest.ports.inputs.keys() {
        inputs.entry(port.clone()).or_insert(Value::Absent);
    }

    Ok(inputs)
}

/// Checks that what a component produced is what its manifest promised.
///
/// The manifest is what the editor type-checked the graph against and what the user consented
/// to. A component that returns something else has broken the contract, and the run must say
/// so rather than pass an unexpected value downstream where it becomes a confusing failure
/// somewhere else.
fn check_outputs(
    manifest: &ComponentManifest,
    produced: BTreeMap<String, Value>,
) -> Result<BTreeMap<String, Value>, NodeError> {
    for (port, value) in &produced {
        let Some(declared) = manifest.ports.outputs.get(port) else {
            return Err(NodeError::new(
                "contract-broken",
                format!(
                    "{} produced an output called \"{port}\", which it does not declare.",
                    manifest.name
                ),
            ));
        };

        if value.is_absent() {
            continue;
        }

        let Some(actual) = value.type_name() else {
            continue;
        };
        let compatible = matches!(
            encastra_protocol::check_compatibility_str(&actual, &declared.type_),
            encastra_protocol::Compatibility::Yes(ref c)
                if c.kind == encastra_protocol::CoercionKind::Direct
        );
        if !compatible {
            return Err(NodeError::new(
                "contract-broken",
                format!(
                    "{} declares \"{port}\" as {}, but produced {actual}.",
                    manifest.name, declared.type_
                ),
            ));
        }
    }
    Ok(produced)
}
