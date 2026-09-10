//! Graph validation.
//!
//! Two rules shape this module.
//!
//! **Report everything, not the first thing.** A validator that stops at the first error makes
//! fixing a graph a game of whack-a-mole. Every issue is collected, each with a location the
//! editor can highlight and a message written for the person reading it rather than for the
//! person who wrote the check.
//!
//! **A graph that passes validation is a graph that can be scheduled.** Success carries the
//! execution order, so there is no second, subtly different traversal at run time that could
//! disagree about what is runnable.

use std::collections::{BTreeMap, BTreeSet, VecDeque};

use encastra_protocol::manifest::{ComponentManifest, ConfigField};
use encastra_protocol::{Compatibility, check_compatibility_str};

use crate::graph::{Graph, NodeId, PortRef};
use crate::registry::ComponentRegistry;

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, serde::Serialize, serde::Deserialize,
)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    /// The graph cannot run.
    Error,
    /// The graph can run, but something is probably not what the user meant.
    Warning,
}

/// What the editor should highlight.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Location {
    Graph,
    Node(NodeId),
    Port(PortRef),
    Edge { from: PortRef, to: PortRef },
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Issue {
    pub severity: Severity,
    pub location: Location,
    /// What is wrong, in the terms the user is working in.
    pub message: String,
    /// What to do about it. Present whenever there is an honest answer; absent rather than
    /// filled with a guess.
    pub hint: Option<String>,
}

impl Issue {
    fn error(location: Location, message: impl Into<String>) -> Self {
        Issue {
            severity: Severity::Error,
            location,
            message: message.into(),
            hint: None,
        }
    }

    fn warning(location: Location, message: impl Into<String>) -> Self {
        Issue {
            severity: Severity::Warning,
            location,
            message: message.into(),
            hint: None,
        }
    }

    fn with_hint(mut self, hint: impl Into<String>) -> Self {
        self.hint = Some(hint.into());
        self
    }
}

/// A conversion the runtime will perform on an edge, decided once here so the editor and the
/// runtime cannot disagree about it later.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct EdgePlan {
    pub from: PortRef,
    pub to: PortRef,
    pub ops: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
pub struct Validation {
    pub issues: Vec<Issue>,
    /// Topological execution order. Empty when there are errors — a graph that does not
    /// validate has no runnable order, and returning a partial one invites someone to use it.
    pub order: Vec<NodeId>,
    /// Conversions to apply per edge, for edges that need any.
    pub conversions: Vec<EdgePlan>,
}

impl Validation {
    pub fn is_runnable(&self) -> bool {
        !self.issues.iter().any(|i| i.severity == Severity::Error)
    }

    pub fn errors(&self) -> impl Iterator<Item = &Issue> {
        self.issues.iter().filter(|i| i.severity == Severity::Error)
    }
}

pub fn validate(graph: &Graph, registry: &dyn ComponentRegistry) -> Validation {
    validate_with_supplied(graph, registry, &BTreeSet::new())
}

/// Validation where some inputs are filled in by the application rather than by an edge.
///
/// This is what a trigger is, and what "the file the user picked" is. Without it, an entry
/// node's required input looks unconnected and a perfectly runnable graph is refused — the
/// first graph anyone builds starts with something the canvas did not produce.
pub fn validate_with_supplied(
    graph: &Graph,
    registry: &dyn ComponentRegistry,
    supplied: &BTreeSet<PortRef>,
) -> Validation {
    let mut issues = Vec::new();
    let mut conversions = Vec::new();

    // Resolve every node first. Everything downstream needs the manifests, and a node whose
    // component is missing is excluded from the later checks rather than causing a cascade of
    // confusing follow-on errors about ports that could never have been known.
    let mut manifests: BTreeMap<&NodeId, &ComponentManifest> = BTreeMap::new();
    for (id, node) in &graph.nodes {
        match registry.get(&node.component) {
            Some(manifest) => {
                manifests.insert(id, manifest);
            }
            None => issues.push(
                Issue::error(
                    Location::Node(id.clone()),
                    format!("Component {} is not installed.", node.component),
                )
                .with_hint("Install it from the registry, or open the project read-only to see what it needs."),
            ),
        }
    }

    check_edges(graph, &manifests, &mut issues, &mut conversions);
    check_fan_in(graph, &mut issues);
    check_required_inputs(graph, &manifests, supplied, &mut issues);
    check_config(graph, &manifests, &mut issues);
    check_disabled_dependencies(graph, &mut issues);

    let order = match topological_order(graph) {
        Ok(order) => order,
        Err(cycle) => {
            issues.push(
                Issue::error(
                    Location::Graph,
                    format!(
                        "These nodes depend on each other in a loop: {}.",
                        cycle
                            .iter()
                            .map(|n| n.to_string())
                            .collect::<Vec<_>>()
                            .join(" → ")
                    ),
                )
                .with_hint(
                    "A workflow runs forwards. To repeat work, use a Loop node, which has a bound on how many times it runs, rather than wiring an output back to an earlier input.",
                ),
            );
            Vec::new()
        }
    };

    let runnable = !issues.iter().any(|i| i.severity == Severity::Error);
    Validation {
        issues,
        order: if runnable { order } else { Vec::new() },
        conversions: if runnable { conversions } else { Vec::new() },
    }
}

fn check_edges(
    graph: &Graph,
    manifests: &BTreeMap<&NodeId, &ComponentManifest>,
    issues: &mut Vec<Issue>,
    conversions: &mut Vec<EdgePlan>,
) {
    for edge in &graph.edges {
        let location = Location::Edge {
            from: edge.from.clone(),
            to: edge.to.clone(),
        };

        let (Some(source), Some(target)) =
            (manifests.get(&edge.from.node), manifests.get(&edge.to.node))
        else {
            // A missing component was already reported; do not pile on.
            if !graph.nodes.contains_key(&edge.from.node) {
                issues.push(Issue::error(
                    location.clone(),
                    format!(
                        "This connection starts at \"{}\", which is not in the graph.",
                        edge.from.node
                    ),
                ));
            }
            if !graph.nodes.contains_key(&edge.to.node) {
                issues.push(Issue::error(
                    location,
                    format!(
                        "This connection ends at \"{}\", which is not in the graph.",
                        edge.to.node
                    ),
                ));
            }
            continue;
        };

        let Some(out_port) = source.ports.outputs.get(&edge.from.port) else {
            issues.push(
                Issue::error(
                    location,
                    format!(
                        "{} has no output called \"{}\".",
                        source.name, edge.from.port
                    ),
                )
                .with_hint(available(
                    &source.ports.outputs.keys().collect::<Vec<_>>(),
                    "outputs",
                )),
            );
            continue;
        };

        let Some(in_port) = target.ports.inputs.get(&edge.to.port) else {
            issues.push(
                Issue::error(
                    location,
                    format!("{} has no input called \"{}\".", target.name, edge.to.port),
                )
                .with_hint(available(
                    &target.ports.inputs.keys().collect::<Vec<_>>(),
                    "inputs",
                )),
            );
            continue;
        };

        match check_compatibility_str(&out_port.type_, &in_port.type_) {
            Compatibility::No { reason, bridges } => {
                let issue = Issue::error(location, reason);
                issues.push(if bridges.is_empty() {
                    issue
                } else {
                    issue.with_hint(format!(
                        "You could convert through {} first.",
                        bridges.join(" or ")
                    ))
                });
            }
            Compatibility::Yes(c) if !c.ops.is_empty() => {
                conversions.push(EdgePlan {
                    from: edge.from.clone(),
                    to: edge.to.clone(),
                    ops: c.ops.clone(),
                });
                if c.kind == encastra_protocol::CoercionKind::Explicit {
                    let mut issue = Issue::warning(
                        location,
                        format!(
                            "This connection converts {} to {}, which can fail at run time.",
                            out_port.type_, in_port.type_
                        ),
                    );
                    if let Some(note) = c.note {
                        issue = issue.with_hint(note);
                    }
                    issues.push(issue);
                }
            }
            Compatibility::Yes(_) => {}
        }
    }
}

fn available(names: &[&String], kind: &str) -> String {
    if names.is_empty() {
        format!("This component has no {kind}.")
    } else {
        format!(
            "Available {kind}: {}.",
            names
                .iter()
                .map(|n| n.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        )
    }
}

/// An input takes one value. Two edges arriving at the same input would mean the result
/// depends on which finished last.
fn check_fan_in(graph: &Graph, issues: &mut Vec<Issue>) {
    let mut arrivals: BTreeMap<&PortRef, usize> = BTreeMap::new();
    for edge in &graph.edges {
        *arrivals.entry(&edge.to).or_default() += 1;
    }
    for (port, count) in arrivals {
        if count > 1 {
            issues.push(
                Issue::error(
                    Location::Port(port.clone()),
                    format!("{count} connections arrive at {port}, so which value it receives would depend on which finished first."),
                )
                .with_hint("Remove all but one, or combine them with a node that takes several inputs."),
            );
        }
    }
}

fn check_required_inputs(
    graph: &Graph,
    manifests: &BTreeMap<&NodeId, &ComponentManifest>,
    supplied: &BTreeSet<PortRef>,
    issues: &mut Vec<Issue>,
) {
    let connected: BTreeSet<&PortRef> = graph.edges.iter().map(|e| &e.to).collect();

    for (id, node) in &graph.nodes {
        if node.disabled {
            continue;
        }
        let Some(manifest) = manifests.get(id) else {
            continue;
        };
        for (port_name, port) in &manifest.ports.inputs {
            if !port.required {
                continue;
            }
            let reference = PortRef {
                node: id.clone(),
                port: port_name.clone(),
            };
            if !connected.contains(&reference) && !supplied.contains(&reference) {
                issues.push(
                    Issue::error(
                        Location::Port(reference),
                        format!(
                            "{} needs an input on \"{}\" and nothing is connected to it.",
                            manifest.name, port_name
                        ),
                    )
                    .with_hint(format!("Connect something that produces {}.", port.type_)),
                );
            }
        }
    }
}

fn check_config(
    graph: &Graph,
    manifests: &BTreeMap<&NodeId, &ComponentManifest>,
    issues: &mut Vec<Issue>,
) {
    for (id, node) in &graph.nodes {
        let Some(manifest) = manifests.get(id) else {
            continue;
        };

        for (key, value) in &node.config {
            let Some(field) = manifest.config.get(key) else {
                issues.push(
                    Issue::warning(
                        Location::Node(id.clone()),
                        format!(
                            "\"{key}\" is set on this node but {} does not use it.",
                            manifest.name
                        ),
                    )
                    .with_hint("It is probably left over from an older version of the component."),
                );
                continue;
            };
            if let Some(problem) = config_problem(field, value) {
                issues.push(Issue::error(
                    Location::Node(id.clone()),
                    format!("\"{key}\" {problem}"),
                ));
            }
        }

        for (key, field) in &manifest.config {
            if field.required && !node.config.contains_key(key) && field.default.is_none() {
                issues.push(Issue::error(
                    Location::Node(id.clone()),
                    format!("{} needs \"{key}\" to be set.", manifest.name),
                ));
            }
        }
    }
}

fn config_problem(field: &ConfigField, value: &serde_json::Value) -> Option<String> {
    let matches_type = match field.type_.as_str() {
        "bool" => value.is_boolean(),
        "i64" => value.is_i64() || value.is_u64(),
        "f64" => value.is_number(),
        "string" => value.is_string(),
        "json" => true,
        // Handles are produced by the graph, never typed into a form.
        _ => {
            return Some(format!(
                "cannot be configured; {} values come from a connection.",
                field.type_
            ));
        }
    };
    if !matches_type {
        return Some(format!(
            "should be {}, but is {}.",
            field.type_,
            json_kind(value)
        ));
    }

    if let Some(n) = value.as_i64() {
        if let Some(min) = field.min
            && n < min
        {
            return Some(format!("must be at least {min}."));
        }
        if let Some(max) = field.max
            && n > max
        {
            return Some(format!("must be at most {max}."));
        }
    }

    if let (Some(choices), Some(text)) = (&field.choices, value.as_str())
        && !choices.iter().any(|c| c == text)
    {
        return Some(format!("must be one of: {}.", choices.join(", ")));
    }

    None
}

fn json_kind(v: &serde_json::Value) -> &'static str {
    match v {
        serde_json::Value::Null => "empty",
        serde_json::Value::Bool(_) => "a true/false value",
        serde_json::Value::Number(_) => "a number",
        serde_json::Value::String(_) => "text",
        serde_json::Value::Array(_) => "a list",
        serde_json::Value::Object(_) => "structured data",
    }
}

/// A node that is switched off produces nothing, so anything requiring its output cannot run.
/// Saying so here is better than letting the run fail halfway with an empty input.
fn check_disabled_dependencies(graph: &Graph, issues: &mut Vec<Issue>) {
    for edge in &graph.edges {
        let Some(source) = graph.node(&edge.from.node) else {
            continue;
        };
        let Some(target) = graph.node(&edge.to.node) else {
            continue;
        };
        if source.disabled && !target.disabled {
            issues.push(
                Issue::error(
                    Location::Edge {
                        from: edge.from.clone(),
                        to: edge.to.clone(),
                    },
                    format!(
                        "\"{}\" is switched off, so \"{}\" will never receive anything on \"{}\".",
                        edge.from.node, edge.to.node, edge.to.port
                    ),
                )
                .with_hint("Switch it back on, or switch off the nodes that depend on it too."),
            );
        }
    }
}

/// Kahn's algorithm. On failure, returns one cycle as a readable path.
fn topological_order(graph: &Graph) -> Result<Vec<NodeId>, Vec<NodeId>> {
    let mut in_degree: BTreeMap<&NodeId, usize> = graph.nodes.keys().map(|n| (n, 0)).collect();
    for edge in &graph.edges {
        if graph.nodes.contains_key(&edge.to.node) && graph.nodes.contains_key(&edge.from.node) {
            *in_degree.entry(&edge.to.node).or_default() += 1;
        }
    }

    let mut ready: VecDeque<&NodeId> = in_degree
        .iter()
        .filter(|(_, degree)| **degree == 0)
        .map(|(node, _)| *node)
        .collect();

    let mut order = Vec::with_capacity(graph.nodes.len());
    while let Some(node) = ready.pop_front() {
        order.push(node.clone());
        for edge in graph.outgoing(node) {
            if let Some(degree) = in_degree.get_mut(&edge.to.node) {
                *degree -= 1;
                if *degree == 0 {
                    ready.push_back(&edge.to.node);
                }
            }
        }
    }

    if order.len() == graph.nodes.len() {
        Ok(order)
    } else {
        let remaining: BTreeSet<&NodeId> =
            graph.nodes.keys().filter(|n| !order.contains(n)).collect();
        Err(find_cycle(graph, &remaining))
    }
}

/// Walks forward from a node that must be in a cycle until it revisits one, then returns the
/// loop itself — not the tail that led into it, which is not part of the problem.
fn find_cycle(graph: &Graph, candidates: &BTreeSet<&NodeId>) -> Vec<NodeId> {
    let Some(start) = candidates.iter().next() else {
        return Vec::new();
    };
    let mut path: Vec<NodeId> = Vec::new();
    let mut seen: BTreeSet<NodeId> = BTreeSet::new();
    let mut current = (*start).clone();

    loop {
        if seen.contains(&current) {
            let at = path.iter().position(|n| n == &current).unwrap_or(0);
            let mut cycle = path[at..].to_vec();
            cycle.push(current);
            return cycle;
        }
        seen.insert(current.clone());
        path.push(current.clone());

        let next = graph
            .outgoing(&current)
            .map(|e| &e.to.node)
            .find(|n| candidates.contains(n))
            .cloned();
        match next {
            Some(n) => current = n,
            // Cannot happen for a node genuinely inside a cycle, but returning what we have
            // beats an unwrap that turns a reporting bug into a crash.
            None => return path,
        }
    }
}
