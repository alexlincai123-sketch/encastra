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
use crate::graph::{Graph, NodeId, PortRef};
use crate::journal::{LogLevel, LogLine, NodeError, NodeRecord, NodeStatus, RunJournal, now_ms};
use crate::registry::ComponentRegistry;
use crate::validate::Validation;
use crate::value::{Handle, HandleKind, Value};

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

pub struct RunOutcome {
    pub journal: RunJournal,
    /// The value each output port produced, for a caller that wants the results rather than
    /// just the record of them.
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
    } = plan;

    let mut journal = RunJournal::new(run_id);
    journal.order = validation.order.clone();
    let mut outputs: BTreeMap<PortRef, Value> = BTreeMap::new();
    // Seeded values live in the same map as produced ones, keyed by the port they arrive at.
    let seeded: BTreeMap<PortRef, Value> = seed;

    let conversions: BTreeMap<(&PortRef, &PortRef), &Vec<String>> = validation
        .conversions
        .iter()
        .map(|plan| ((&plan.from, &plan.to), &plan.ops))
        .collect();

    for node_id in &validation.order {
        let Some(node) = graph.node(node_id) else {
            continue;
        };
        let mut record = NodeRecord::new(node.component.to_string());

        if node.disabled {
            record.status = NodeStatus::Disabled;
            journal.nodes.insert(node_id.clone(), record);
            continue;
        }

        if cancel.load(Ordering::Relaxed) {
            record.status = NodeStatus::Cancelled;
            journal.nodes.insert(node_id.clone(), record);
            continue;
        }

        // If anything upstream did not produce, this node does not run. Saying which node is
        // responsible is the difference between a debuggable run and a mystery.
        if let Some(blocker) = upstream_blocker(graph, node_id, &journal) {
            record.status = NodeStatus::Skipped;
            record.skipped_because = Some(blocker);
            journal.nodes.insert(node_id.clone(), record);
            continue;
        }

        let Some(manifest) = registry.get(&node.component) else {
            record.status = NodeStatus::Failed;
            record.error = Some(NodeError::new(
                "component-missing",
                format!("{} is not installed.", node.component),
            ));
            journal.nodes.insert(node_id.clone(), record);
            continue;
        };

        let inputs = match gather_inputs(
            graph,
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
                journal.nodes.insert(node_id.clone(), record);
                continue;
            }
        };

        for (port, value) in &inputs {
            record.inputs.insert(port.clone(), value.summary());
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
            journal.nodes.insert(node_id.clone(), record);
            continue;
        };

        let started = Instant::now();
        record.started_at_ms = Some(now_ms());
        record.status = NodeStatus::Running;

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
                for (port, value) in &produced {
                    record.outputs.insert(port.clone(), value.summary());
                    outputs.insert(
                        PortRef {
                            node: node_id.clone(),
                            port: port.clone(),
                        },
                        value.clone(),
                    );
                }
                record.status = NodeStatus::Ok;
            }
            Err(error) => {
                record.status = NodeStatus::Failed;
                record.error = Some(error);
            }
        }

        journal.nodes.insert(node_id.clone(), record);
    }

    journal.finish();
    RunOutcome { journal, outputs }
}

/// The nearest upstream node that failed, was skipped, or was cancelled.
fn upstream_blocker(graph: &Graph, node: &NodeId, journal: &RunJournal) -> Option<NodeId> {
    graph
        .incoming(node)
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

fn gather_inputs(
    graph: &Graph,
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

    for edge in graph.incoming(node) {
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
