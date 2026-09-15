//! The graph a user builds, as data.
//!
//! This is the thing that gets saved, versioned, exported and re-opened on another machine,
//! so it holds no runtime state and no absolute paths — only node identity, component
//! identity, configuration, and wiring.

use std::collections::BTreeMap;
use std::fmt;

use serde::{Deserialize, Serialize};

/// A node's identity within one graph. Stable across saves; the UI never shows it.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct NodeId(pub String);

impl fmt::Display for NodeId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// A component pinned to an exact version.
///
/// There is no version *range* here, deliberately. A project pins exact versions in its
/// lockfile, and a graph that could resolve differently tomorrow is a graph that stops being
/// reproducible — which is the promise the whole project format exists to keep.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ComponentRef {
    pub id: String,
    pub version: String,
}

impl ComponentRef {
    pub fn parse(text: &str) -> Result<Self, String> {
        let (id, version) = text.split_once('@').ok_or_else(|| {
            format!("\"{text}\" must name an exact version, like \"encastra.file.read@1.0.0\"")
        })?;
        if id.is_empty() || version.is_empty() {
            return Err(format!("\"{text}\" is missing an id or a version"));
        }
        Ok(ComponentRef {
            id: id.to_owned(),
            version: version.to_owned(),
        })
    }
}

impl fmt::Display for ComponentRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}@{}", self.id, self.version)
    }
}

impl Serialize for ComponentRef {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for ComponentRef {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let text = String::deserialize(d)?;
        ComponentRef::parse(&text).map_err(serde::de::Error::custom)
    }
}

/// Where a node sits on the canvas. Part of the saved graph, not of its meaning — two graphs
/// that differ only in position compute the same thing.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Node {
    pub component: ComponentRef,
    /// The user's label for this node, if they renamed it. Falls back to the component name.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default)]
    pub config: BTreeMap<String, serde_json::Value>,
    #[serde(default)]
    pub position: Position,
    /// A node the user switched off. It does not run, and neither does anything that depends
    /// only on it.
    #[serde(default)]
    pub disabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PortRef {
    pub node: NodeId,
    pub port: String,
}

impl fmt::Display for PortRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}.{}", self.node, self.port)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Edge {
    pub from: PortRef,
    pub to: PortRef,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct Graph {
    #[serde(default)]
    pub nodes: BTreeMap<NodeId, Node>,
    #[serde(default)]
    pub edges: Vec<Edge>,
}

/// The most nodes a graph may contain.
///
/// A graph is drawn by a person on a canvas, and a workflow with ten thousand steps is not one
/// anybody drew. The limit is not there for them — it is there because a graph arrives inside a
/// project file somebody was sent, and every node is work the validator, the editor and the
/// runner each do. A file declaring a million of them costs all three before anybody sees it.
pub const MAX_NODES: usize = 10_000;

/// The most edges a graph may contain.
///
/// Higher than the node ceiling because a legitimate graph fans out, and low enough that the
/// repeated passes over edges in validation stay cheap.
pub const MAX_EDGES: usize = 40_000;

impl Graph {
    pub fn parse(json: &str) -> Result<Self, serde_json::Error> {
        let graph: Graph = serde_json::from_str(json)?;
        graph.within_limits().map_err(serde::de::Error::custom)?;
        Ok(graph)
    }

    /// Whether this graph is within the sizes this build will work on.
    ///
    /// Public because a graph does not only arrive through [`parse`](Self::parse): the project
    /// container deserialises one straight out of an archive entry, and a limit that guards only
    /// one of the two doors guards neither.
    pub fn within_limits(&self) -> Result<(), String> {
        if self.nodes.len() > MAX_NODES {
            return Err(format!(
                "this graph has {} nodes, and this build works on at most {MAX_NODES}",
                self.nodes.len()
            ));
        }
        if self.edges.len() > MAX_EDGES {
            return Err(format!(
                "this graph has {} connections, and this build works on at most {MAX_EDGES}",
                self.edges.len()
            ));
        }
        Ok(())
    }

    /// Stable JSON: sorted keys, so saving an unchanged graph produces identical bytes and a
    /// version diff shows only what a person actually changed.
    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).expect("a graph always serialises")
    }

    pub fn node(&self, id: &NodeId) -> Option<&Node> {
        self.nodes.get(id)
    }

    /// Every edge arriving at `node`.
    pub fn incoming(&self, node: &NodeId) -> impl Iterator<Item = &Edge> {
        self.edges.iter().filter(move |e| &e.to.node == node)
    }

    /// Every edge leaving `node`.
    pub fn outgoing(&self, node: &NodeId) -> impl Iterator<Item = &Edge> {
        self.edges.iter().filter(move |e| &e.from.node == node)
    }

    /// Nodes reachable downstream of `start`, not including `start`.
    ///
    /// Used when a node fails: everything that depended on it is marked skipped rather than
    /// left looking as though it might still succeed.
    pub fn descendants(&self, start: &NodeId) -> std::collections::BTreeSet<NodeId> {
        let mut seen = std::collections::BTreeSet::new();
        let mut stack = vec![start.clone()];
        while let Some(current) = stack.pop() {
            for edge in self.outgoing(&current) {
                if seen.insert(edge.to.node.clone()) {
                    stack.push(edge.to.node.clone());
                }
            }
        }
        seen
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn graph_json() -> &'static str {
        r#"{
          "nodes": {
            "read":  { "component": "encastra.file.read@1.0.0",  "config": {} },
            "parse": { "component": "encastra.data.json@1.0.0",  "config": {} },
            "write": { "component": "encastra.file.write@1.0.0", "config": {} }
          },
          "edges": [
            { "from": { "node": "read",  "port": "text" }, "to": { "node": "parse", "port": "text" } },
            { "from": { "node": "parse", "port": "json" }, "to": { "node": "write", "port": "content" } }
          ]
        }"#
    }

    #[test]
    fn round_trips_without_losing_anything() {
        let g = Graph::parse(graph_json()).expect("valid graph");
        let again = Graph::parse(&g.to_json()).expect("re-parses");
        assert_eq!(g, again, "a save/load cycle must not change the graph");
    }

    #[test]
    fn a_component_reference_must_pin_an_exact_version() {
        assert!(ComponentRef::parse("encastra.file.read@1.0.0").is_ok());
        // A range would make the graph resolve differently tomorrow.
        assert!(ComponentRef::parse("encastra.file.read").is_err());
        assert!(ComponentRef::parse("encastra.file.read@").is_err());
        assert!(ComponentRef::parse("@1.0.0").is_err());
    }

    #[test]
    fn refuses_unknown_fields_so_a_newer_file_is_not_silently_downgraded() {
        let json = r#"{ "nodes": {}, "edges": [], "triggers": [] }"#;
        assert!(Graph::parse(json).is_err());
    }

    #[test]
    fn finds_everything_downstream_of_a_node() {
        let g = Graph::parse(graph_json()).unwrap();
        let downstream = g.descendants(&NodeId("read".into()));
        assert_eq!(downstream.len(), 2);
        assert!(downstream.contains(&NodeId("write".into())));
        assert!(g.descendants(&NodeId("write".into())).is_empty());
    }

    #[test]
    fn descendants_terminates_even_if_the_graph_has_a_cycle() {
        // Validation rejects cycles, but this helper must not hang on one that reached it —
        // a traversal that can loop forever is a hang in whatever called it.
        let json = r#"{
          "nodes": {
            "a": { "component": "x.y@1.0.0" },
            "b": { "component": "x.y@1.0.0" }
          },
          "edges": [
            { "from": { "node": "a", "port": "o" }, "to": { "node": "b", "port": "i" } },
            { "from": { "node": "b", "port": "o" }, "to": { "node": "a", "port": "i" } }
          ]
        }"#;
        let g = Graph::parse(json).unwrap();
        let d = g.descendants(&NodeId("a".into()));
        assert_eq!(d.len(), 2);
    }

    fn an_edge() -> Edge {
        Edge {
            from: PortRef {
                node: NodeId("a".into()),
                port: "out".into(),
            },
            to: PortRef {
                node: NodeId("b".into()),
                port: "in".into(),
            },
        }
    }

    fn a_node() -> Node {
        Node {
            component: crate::ComponentRef::parse("a.b@1.0.0").unwrap(),
            label: None,
            config: BTreeMap::new(),
            position: Position { x: 0.0, y: 0.0 },
            disabled: false,
        }
    }

    #[test]
    fn a_graph_is_bounded_in_both_nodes_and_edges() {
        // Both ceilings, at the boundary. `MAX_NODES` is exercised end-to-end through the
        // project container; `MAX_EDGES` had no test at all, and a limit nothing checks is a
        // comment. Asserted here on `within_limits` because that is the one gate both doors
        // into a graph — `parse` and the archive reader — are required to call.
        let mut graph = Graph::default();

        for i in 0..MAX_NODES {
            graph.nodes.insert(NodeId(format!("n{i}")), a_node());
        }
        assert!(
            graph.within_limits().is_ok(),
            "exactly the ceiling is allowed; it is a maximum, not a strict bound"
        );

        graph.nodes.insert(NodeId("one-too-many".into()), a_node());
        let refused = graph.within_limits().unwrap_err();
        assert!(refused.contains("nodes"), "{refused}");

        let mut graph = Graph {
            nodes: BTreeMap::new(),
            edges: vec![an_edge(); MAX_EDGES],
        };
        assert!(graph.within_limits().is_ok());

        graph.edges.push(an_edge());
        let refused = graph.within_limits().unwrap_err();
        assert!(refused.contains("connections"), "{refused}");
    }

    #[test]
    fn parsing_applies_the_same_ceilings() {
        // `within_limits` being right is no use if the door does not call it.
        let graph = Graph {
            nodes: BTreeMap::new(),
            edges: vec![an_edge(); MAX_EDGES + 1],
        };

        let error = Graph::parse(&graph.to_json())
            .expect_err("a graph past the edge ceiling must not parse");
        assert!(error.to_string().contains("connections"), "{error}");
    }
}
