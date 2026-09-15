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

/// The most the runtime will hold in produced values at any one moment during a run.
///
/// **What this is not:** a guarantee against running out of memory. It bounds the runtime's
/// *own accounting* of [`Value`] payloads — the strings, structured data and lists a run holds
/// between a producer and its consumers — using [`Value::approx_bytes`], which is an estimate.
/// It does not see a component's working memory, an image decoder's buffers, allocator
/// fragmentation, or the copies made when a value is delivered along several edges. A
/// component that allocates a gigabyte internally will still exhaust the machine and this
/// budget will not have noticed. Plainly: it refuses a *shape of graph* that is certain to be
/// a problem; it is not an OOM guard.
///
/// **Why an aggregate is needed at all.** The per-item caps each bound one thing — a read is
/// capped at 512 MB, a graph at ten thousand nodes — and none of them can see the sum. Values
/// are released as soon as their last consumer has finished, which bounds a run by the graph's
/// *depth*; nothing bounded its *width*. Five thousand independent Read File nodes feeding one
/// merge step all run before that step, in any topological order, so all five thousand results
/// are resident at once. Each is individually legal. Together they are not.
///
/// **Why a gibibyte.** It is far above any honest workflow: what travels on an edge is text,
/// structured data and handles, and a workflow holding more than a gibibyte of that at one
/// instant is carrying files it should be passing as handles. It is also well below what
/// refusing has to protect — a desktop machine that still has to run the editor while the
/// workflow runs. A run that reaches it has a shape problem, and being told so leaves a
/// journal, which being killed by the OS does not.
///
/// A value fanned out to several consumers is counted **once**, when it is produced. The
/// per-edge copies made at delivery are real memory and are not accounted for here; see the
/// `TODO(ENC-NEW-05b)` at the clone site in `gather_inputs`.
pub const MAX_LIVE_VALUE_BYTES: u64 = 1024 * 1024 * 1024;

/// The most log lines one node may leave in the journal.
///
/// The journal is cloned whole and sent over IPC to the editor, so a component looping over ten
/// thousand items and logging each one turns a debugging aid into an unbounded buffer and a
/// stall in the UI process. Two hundred lines is more than anybody reads and enough to see what
/// a node did; past that the *count* is reported instead of the lines, because that is the part
/// which still carries information.
pub const MAX_LOG_LINES_PER_NODE: usize = 200;

/// The most characters one log line may carry before it is truncated with a marker.
///
/// A component that logs a whole document has turned a log line into a copy of its input —
/// which the journal is not allowed to hold (see `journal.rs`) and which nobody can read in a
/// list of two hundred.
pub const MAX_LOG_LINE_CHARS: usize = 2_000;

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
    /// Lines refused past [`MAX_LOG_LINES_PER_NODE`]. Counted rather than kept: how many were
    /// dropped is information; the lines themselves are the thing being bounded.
    logs_dropped: u64,
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

    /// Records a line for the node inspector, within the caps this module documents.
    ///
    /// Both caps are the component's problem to have caused and the runtime's problem to
    /// contain: a log is a debugging aid that is cloned into the journal and sent over IPC, so
    /// "as much as the component felt like" is not an available size. Past the line cap a line
    /// is counted rather than kept; past the character cap it is cut short and marked.
    pub fn log(&mut self, level: LogLevel, message: impl Into<String>) {
        if self.logs.len() >= MAX_LOG_LINES_PER_NODE {
            self.logs_dropped = self.logs_dropped.saturating_add(1);
            return;
        }

        let message = message.into();
        // Counted in characters, cut on a character boundary: slicing bytes would panic in the
        // middle of anything that is not ASCII, and a component's log line is arbitrary text.
        let message = if message.chars().count() > MAX_LOG_LINE_CHARS {
            let kept: String = message.chars().take(MAX_LOG_LINE_CHARS).collect();
            format!("{kept}... (truncated)")
        } else {
            message
        };

        self.logs.push(LogLine {
            at_ms: now_ms(),
            level,
            message,
        });
    }

    /// The lines this node left, with a final line naming what was dropped.
    ///
    /// The count goes in as a log line rather than a separate field so that every reader of a
    /// journal — the inspector, an export, a bug report — sees it without being taught about
    /// it. A truncated record that does not say it was truncated is worse than a long one.
    fn take_logs(&mut self) -> Vec<LogLine> {
        let mut logs = std::mem::take(&mut self.logs);
        if self.logs_dropped > 0 {
            logs.push(LogLine {
                at_ms: now_ms(),
                level: LogLevel::Warn,
                message: format!("... {} more lines dropped", self.logs_dropped),
            });
        }
        logs
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
    execute_request_within(request, broker, MAX_LIVE_VALUE_BYTES)
}

/// Runs a request against a graph that has **already** been validated.
///
/// A session validates once, when it starts, and then runs the same graph once per event. The
/// graph cannot change while a session holds it, so re-deriving the same answer per event is
/// pure cost — and on a large graph it is the dominant cost of a run that does almost nothing.
///
/// There is no `Result` here: the caller is stating that it has the validation in hand, so
/// "this graph does not validate" is not an outcome this function can reach. Callers that do
/// not have one use [`execute_request`], which computes it.
pub fn execute_request_validated(
    request: RunRequest<'_>,
    broker: &mut Broker,
    validation: &Validation,
) -> RunOutcome {
    make_seed_reachable(&request.seed, broker);
    let RunRequest {
        graph,
        registry,
        components,
        cancel,
        run_id,
        seed,
        observer,
    } = request;
    execute(
        Execution {
            graph,
            registry,
            components,
            cancel,
            validation,
            observer,
            budget: MAX_LIVE_VALUE_BYTES,
        },
        broker,
        run_id,
        seed,
    )
}

/// [`execute_request`] with the live-value budget stated explicitly.
///
/// The seam exists so the budget's behaviour can be tested at a size a test can actually build:
/// proving that a run is refused at a gibibyte requires allocating a gibibyte, and proving that
/// a value was released *on time* requires a budget tight enough that a late release is fatal.
/// It sets the ceiling once, before the run; it is not a way to reach the counter. Nothing a
/// component can call appears here, and the counter itself lives only in `execute`'s locals.
#[doc(hidden)]
pub fn execute_request_within(
    request: RunRequest<'_>,
    broker: &mut Broker,
    budget: u64,
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
    make_seed_reachable(&seed, broker);
    Ok(execute(
        Execution {
            graph,
            registry,
            components,
            cancel,
            validation: &validation,
            observer,
            budget,
        },
        broker,
        run_id,
        seed,
    ))
}

/// A seeded handle is reachable by the node it was supplied to, and by nothing else.
fn make_seed_reachable(seed: &BTreeMap<PortRef, Value>, broker: &mut Broker) {
    for (port, value) in seed {
        if let Value::Handle(handle) = value {
            broker.make_reachable(&port.node, *handle);
        }
    }
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
    /// The ceiling on values held at once — [`MAX_LIVE_VALUE_BYTES`] for every caller except
    /// the tests, which state a size they can build.
    budget: u64,
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
        budget,
    } = plan;

    // How many bytes of produced values this run is holding right now.
    //
    // This local is the whole of the mechanism, and its being a local is the point: there is no
    // field, no cell and no handle through which a component could reach it. A component
    // returns values and that is all; the accounting happens here, on the other side of the
    // call, where nothing it can do participates. It rises when a value enters `outputs` and
    // falls when one is released — so it measures what is held *at once*, not what a run has
    // produced in total. See `MAX_LIVE_VALUE_BYTES` for what that bound is and is not.
    let mut live_bytes: u64 = 0;

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
            // Counted like anything else in `outputs`: a trigger's event is a value the run is
            // holding, and a budget that ignored where a value came from is the only kind that
            // cannot be walked around.
            live_bytes = live_bytes.saturating_add(value.approx_bytes());
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
                logs_dropped: 0,
                cancel,
            };
            let result = implementation.run(&mut ctx);
            let logs = ctx.take_logs();

            record.duration_ms = Some(started.elapsed().as_millis() as u64);
            record.logs = logs;
            record.capability_calls = broker.take_calls(node_id);

            match result.and_then(|produced| check_outputs(manifest, produced)) {
                Ok(produced) => {
                    // What this step would add to what the run is already holding. Weighed as a
                    // whole rather than value by value, so a node either lands or does not: half
                    // a node's outputs in `outputs` and half refused is a state nothing
                    // downstream could read sensibly.
                    let produces = produced.values().fold(0u64, |total, value| {
                        total.saturating_add(value.approx_bytes())
                    });

                    if live_bytes.saturating_add(produces) > budget {
                        // Refused, not aborted. The run continues, everything downstream is
                        // skipped through the ordinary mechanism and names this node as the
                        // reason, and the journal is complete — which is what makes a workflow
                        // that is too wide a thing someone can see and fix, rather than a
                        // process that vanished.
                        record.status = NodeStatus::Failed;
                        record.error = Some(
                            NodeError::new(
                                "run-memory-budget",
                                format!(
                                    "This step would take the run past its limit of {budget} bytes of values held at once; it is already holding {live_bytes} and this step adds {produces}."
                                ),
                            )
                            .with_hint(
                                "Too many steps are holding large values at the same time. Work through files one at a time — a Watch Folder or Timer trigger runs the workflow once per item — or pass files along as they are instead of reading them into text.",
                            ),
                        );
                    } else {
                        // Moved, not cloned: the component handed these over and nothing else holds
                        // them. A copy of every output of every step is a second run's worth of memory.
                        for (port, value) in produced {
                            record.outputs.insert(port.clone(), value.summary());
                            live_bytes = live_bytes.saturating_add(value.approx_bytes());
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
        //
        // After the step, not before it, so the accounting is conservative in the safe
        // direction: for the moment a component is running, both what it was given and what it
        // produced are counted. That is also the truth — a component holds its inputs while it
        // builds its outputs — and the alternative, crediting the release first, would let a
        // run peak above the budget without the budget noticing.
        for edge in feeding {
            if let Some(left) = consumers_left.get_mut(&edge.from) {
                *left = left.saturating_sub(1);
                if *left == 0
                    && let Some(released) = outputs.remove(&edge.from)
                {
                    // The counter falls here and only here, which is what makes it a measure of
                    // what is held rather than of what has been produced: the bytes a released
                    // value was occupying become available to a later step in the same run.
                    live_bytes = live_bytes.saturating_sub(released.approx_bytes());
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

        // TODO(ENC-NEW-05b): a value delivered to N consumers is cloned N times, and the live
        // budget counts it once — it is charged where it was produced, not per edge. So a 400 MB
        // string fanned out to ten steps is accounted as 400 MB while ten copies exist. The fix
        // is to carry the payload behind an `Arc<str>` / `Arc<[u8]>` so delivery shares it
        // instead of copying it, at which point counting once becomes the truth rather than an
        // approximation. That is a change to `Value` itself and to every component that
        // constructs one, and is deliberately not made here.
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
