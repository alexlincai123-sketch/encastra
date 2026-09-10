//! Version history.
//!
//! Snapshots are immutable, content-addressed, and singly linked by `parent`. They live inside
//! the project file, so history travels with the project — email somebody a `.encastra` and
//! they get its past too.
//!
//! Two properties make this safe to use:
//!
//! **Restore is not destructive.** Restoring version 3 appends a *new* snapshot whose content
//! equals version 3. History is never rewritten, so restoring is itself undoable — which is
//! the property that makes people willing to press the button.
//!
//! **A diff is about the graph, not about text.** "The Resize node's width went from 800 to
//! 1200" is something a person can act on; a line diff of `graph.json` is not, and merging one
//! can produce a syntactically valid, semantically broken graph.

use std::collections::BTreeMap;

use encastra_core::graph::{Graph, NodeId, PortRef};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct SnapshotId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Snapshot {
    pub id: SnapshotId,
    /// The snapshot this one came after. `None` for the first.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent: Option<SnapshotId>,
    pub created_at_ms: u64,
    /// A short name the user gave it, if any.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// `sha256` of the graph at this point.
    pub graph_hash: String,
    /// Set when this snapshot was created by restoring an earlier one, so the history reads as
    /// what happened rather than as a mysterious duplicate.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub restored_from: Option<SnapshotId>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct History {
    /// Oldest first.
    #[serde(default)]
    pub snapshots: Vec<Snapshot>,
    /// The graph at each snapshot. Stored as separate archive entries, not in the index.
    #[serde(skip)]
    bodies: BTreeMap<SnapshotId, Graph>,
}

impl History {
    pub fn len(&self) -> usize {
        self.snapshots.len()
    }

    pub fn is_empty(&self) -> bool {
        self.snapshots.is_empty()
    }

    pub fn latest(&self) -> Option<&Snapshot> {
        self.snapshots.last()
    }

    pub fn get(&self, id: &SnapshotId) -> Option<&Snapshot> {
        self.snapshots.iter().find(|s| &s.id == id)
    }

    pub fn body(&self, id: &SnapshotId) -> Option<&Graph> {
        self.bodies.get(id)
    }

    /// Keeps only the snapshots whose graph actually survived the round trip.
    ///
    /// An index entry with no body would be a version the UI offers and cannot restore, which
    /// is worse than one that is simply not there.
    pub fn attach_bodies(&mut self, bodies: BTreeMap<SnapshotId, Graph>) {
        self.snapshots.retain(|s| bodies.contains_key(&s.id));
        self.bodies = bodies;
    }

    /// Records the graph as a new version.
    ///
    /// Returns `None` when the graph is identical to the most recent snapshot: saving twice
    /// without changing anything should not manufacture history.
    pub fn record(
        &mut self,
        graph: &Graph,
        label: Option<String>,
        message: Option<String>,
        now_ms: u64,
    ) -> Option<SnapshotId> {
        let graph_hash = crate::hash(graph.to_json().as_bytes());
        if self.latest().is_some_and(|s| s.graph_hash == graph_hash) {
            return None;
        }
        Some(self.append(graph, graph_hash, label, message, None, now_ms))
    }

    /// Restores an earlier version by appending a new one with the same content.
    ///
    /// Nothing is rewritten or removed, so the restore can itself be undone by restoring the
    /// version that preceded it.
    pub fn restore(&mut self, id: &SnapshotId, now_ms: u64) -> Option<Graph> {
        let graph = self.bodies.get(id)?.clone();
        let label = self
            .get(id)
            .and_then(|s| s.label.clone())
            .unwrap_or_else(|| short(id));
        let graph_hash = crate::hash(graph.to_json().as_bytes());
        self.append(
            &graph,
            graph_hash,
            Some(format!("Restored {label}")),
            None,
            Some(id.clone()),
            now_ms,
        );
        Some(graph)
    }

    fn append(
        &mut self,
        graph: &Graph,
        graph_hash: String,
        label: Option<String>,
        message: Option<String>,
        restored_from: Option<SnapshotId>,
        now_ms: u64,
    ) -> SnapshotId {
        // Content-addressed, but salted with the position in history: restoring produces the
        // same content as an earlier version, and those must remain two distinct events.
        let id = SnapshotId(
            crate::hash(format!("{graph_hash}:{}:{now_ms}", self.snapshots.len()).as_bytes())[..16]
                .to_owned(),
        );
        let snapshot = Snapshot {
            id: id.clone(),
            parent: self.latest().map(|s| s.id.clone()),
            created_at_ms: now_ms,
            label,
            message,
            graph_hash,
            restored_from,
        };
        self.bodies.insert(id.clone(), graph.clone());
        self.snapshots.push(snapshot);
        id
    }

    /// What changed between two versions.
    pub fn compare(&self, from: &SnapshotId, to: &SnapshotId) -> Option<Vec<Change>> {
        Some(compare_graphs(self.bodies.get(from)?, self.bodies.get(to)?))
    }
}

fn short(id: &SnapshotId) -> String {
    id.0.chars().take(7).collect()
}

/// A difference a person can act on.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Change {
    NodeAdded {
        node: NodeId,
        component: String,
    },
    NodeRemoved {
        node: NodeId,
        component: String,
    },
    ComponentChanged {
        node: NodeId,
        from: String,
        to: String,
    },
    SettingChanged {
        node: NodeId,
        key: String,
        from: Option<String>,
        to: Option<String>,
    },
    NodeSwitchedOff {
        node: NodeId,
    },
    NodeSwitchedOn {
        node: NodeId,
    },
    NodeMoved {
        node: NodeId,
    },
    ConnectionAdded {
        from: PortRef,
        to: PortRef,
    },
    ConnectionRemoved {
        from: PortRef,
        to: PortRef,
    },
}

impl Change {
    /// Whether this change alters what the project does.
    ///
    /// Moving a node does not. Keeping the distinction lets the UI answer "did anything
    /// actually change?" without a person having to read past a list of nudges.
    pub fn changes_behaviour(&self) -> bool {
        !matches!(self, Change::NodeMoved { .. })
    }

    /// One line, written for the person reading the history.
    pub fn describe(&self) -> String {
        match self {
            Change::NodeAdded { node, component } => format!("Added {node} ({component})"),
            Change::NodeRemoved { node, component } => format!("Removed {node} ({component})"),
            Change::ComponentChanged { node, from, to } => {
                format!("{node} changed from {from} to {to}")
            }
            Change::SettingChanged {
                node,
                key,
                from,
                to,
            } => match (from, to) {
                (Some(a), Some(b)) => format!("{node}: {key} changed from {a} to {b}"),
                (None, Some(b)) => format!("{node}: {key} set to {b}"),
                (Some(a), None) => format!("{node}: {key} cleared (was {a})"),
                (None, None) => format!("{node}: {key} changed"),
            },
            Change::NodeSwitchedOff { node } => format!("{node} switched off"),
            Change::NodeSwitchedOn { node } => format!("{node} switched on"),
            Change::NodeMoved { node } => format!("{node} moved"),
            Change::ConnectionAdded { from, to } => format!("Connected {from} to {to}"),
            Change::ConnectionRemoved { from, to } => format!("Disconnected {from} from {to}"),
        }
    }
}

/// Compares two graphs at the level a user thinks in.
pub fn compare_graphs(from: &Graph, to: &Graph) -> Vec<Change> {
    let mut changes = Vec::new();

    for (id, before) in &from.nodes {
        match to.nodes.get(id) {
            None => changes.push(Change::NodeRemoved {
                node: id.clone(),
                component: before.component.to_string(),
            }),
            Some(after) => {
                if before.component != after.component {
                    changes.push(Change::ComponentChanged {
                        node: id.clone(),
                        from: before.component.to_string(),
                        to: after.component.to_string(),
                    });
                }
                if before.disabled != after.disabled {
                    changes.push(if after.disabled {
                        Change::NodeSwitchedOff { node: id.clone() }
                    } else {
                        Change::NodeSwitchedOn { node: id.clone() }
                    });
                }
                if before.position != after.position {
                    changes.push(Change::NodeMoved { node: id.clone() });
                }

                let keys: std::collections::BTreeSet<&String> =
                    before.config.keys().chain(after.config.keys()).collect();
                for key in keys {
                    let a = before.config.get(key);
                    let b = after.config.get(key);
                    if a != b {
                        changes.push(Change::SettingChanged {
                            node: id.clone(),
                            key: key.clone(),
                            from: a.map(render),
                            to: b.map(render),
                        });
                    }
                }
            }
        }
    }

    for (id, after) in &to.nodes {
        if !from.nodes.contains_key(id) {
            changes.push(Change::NodeAdded {
                node: id.clone(),
                component: after.component.to_string(),
            });
        }
    }

    for edge in &from.edges {
        if !to.edges.contains(edge) {
            changes.push(Change::ConnectionRemoved {
                from: edge.from.clone(),
                to: edge.to.clone(),
            });
        }
    }
    for edge in &to.edges {
        if !from.edges.contains(edge) {
            changes.push(Change::ConnectionAdded {
                from: edge.from.clone(),
                to: edge.to.clone(),
            });
        }
    }

    changes
}

/// A setting rendered for a history line. Long values are described, not printed: a history
/// entry is stored and displayed, and a setting can hold something a user pasted.
fn render(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(s) if s.chars().count() > 40 => {
            format!("text ({} characters)", s.chars().count())
        }
        serde_json::Value::String(s) => format!("\"{s}\""),
        serde_json::Value::Array(a) => format!("{} items", a.len()),
        serde_json::Value::Object(o) => format!("{} fields", o.len()),
        other => other.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn graph_with(width: i64, nodes: &[&str]) -> Graph {
        let mut json = serde_json::json!({ "nodes": {}, "edges": [] });
        for node in nodes {
            json["nodes"][*node] = serde_json::json!({
                "component": "encastra.image.resize@1.0.0",
                "config": { "width": width },
                "position": { "x": 0, "y": 0 }
            });
        }
        Graph::parse(&json.to_string()).unwrap()
    }

    #[test]
    fn recording_the_same_graph_twice_does_not_manufacture_history() {
        let mut history = History::default();
        let graph = graph_with(800, &["resize"]);
        assert!(history.record(&graph, None, None, 1).is_some());
        assert!(history.record(&graph, None, None, 2).is_none());
        assert_eq!(history.len(), 1);
    }

    #[test]
    fn restore_appends_rather_than_rewrites_so_it_can_itself_be_undone() {
        let mut history = History::default();
        let first = history
            .record(
                &graph_with(800, &["resize"]),
                Some("Original".into()),
                None,
                1,
            )
            .unwrap();
        history
            .record(&graph_with(1200, &["resize"]), None, None, 2)
            .unwrap();
        assert_eq!(history.len(), 2);

        let restored = history.restore(&first, 3).expect("the version exists");
        assert_eq!(
            history.len(),
            3,
            "restoring adds a version; it does not remove one"
        );
        assert_eq!(
            restored.nodes[&NodeId("resize".into())].config["width"],
            serde_json::json!(800)
        );

        // The new snapshot says where it came from, and the old ones are untouched.
        let newest = history.latest().unwrap();
        assert_eq!(newest.restored_from.as_ref(), Some(&first));
        assert!(newest.label.as_deref().unwrap().contains("Original"));
        assert!(history.get(&first).is_some());

        // And the restore is undoable: the version before it is still there to go back to.
        let second = &history.snapshots[1].id.clone();
        assert!(history.restore(second, 4).is_some());
        assert_eq!(history.len(), 4);
    }

    #[test]
    fn restoring_identical_content_still_produces_a_distinct_version() {
        // Two events with the same content are still two events, so the ids must differ.
        let mut history = History::default();
        let first = history
            .record(&graph_with(800, &["resize"]), None, None, 1)
            .unwrap();
        history.restore(&first, 2);
        assert_ne!(history.latest().unwrap().id, first);
    }

    #[test]
    fn a_diff_names_what_a_person_changed() {
        let before = graph_with(800, &["resize"]);
        let after = graph_with(1200, &["resize", "watermark"]);

        let changes = compare_graphs(&before, &after);
        let described: Vec<String> = changes.iter().map(Change::describe).collect();

        assert!(
            described
                .iter()
                .any(|c| c.contains("width changed from 800 to 1200")),
            "{described:?}"
        );
        assert!(
            described.iter().any(|c| c.starts_with("Added watermark")),
            "{described:?}"
        );
    }

    #[test]
    fn moving_a_node_is_reported_but_not_as_a_change_in_behaviour() {
        let before = graph_with(800, &["resize"]);
        let mut after = before.clone();
        after
            .nodes
            .get_mut(&NodeId("resize".into()))
            .unwrap()
            .position = encastra_core::Position { x: 500.0, y: 20.0 };

        let changes = compare_graphs(&before, &after);
        assert_eq!(changes.len(), 1);
        assert!(!changes[0].changes_behaviour());
        assert!(
            changes.iter().all(|c| !c.changes_behaviour()),
            "nothing here changes what runs"
        );
    }

    #[test]
    fn a_long_setting_is_described_rather_than_printed_into_the_history() {
        let before = graph_with(800, &["resize"]);
        let mut after = before.clone();
        after
            .nodes
            .get_mut(&NodeId("resize".into()))
            .unwrap()
            .config
            .insert("token".into(), serde_json::json!("s3cr3t-".repeat(20)));

        let described = compare_graphs(&before, &after)[0].describe();
        assert!(!described.contains("s3cr3t"), "{described}");
        assert!(described.contains("characters"), "{described}");
    }

    #[test]
    fn an_index_entry_with_no_body_is_dropped_rather_than_offered() {
        let mut history = History::default();
        let kept = history
            .record(&graph_with(800, &["a"]), None, None, 1)
            .unwrap();
        history
            .record(&graph_with(900, &["a"]), None, None, 2)
            .unwrap();

        // Simulates a project file whose second body did not survive.
        let only_one: BTreeMap<SnapshotId, Graph> =
            BTreeMap::from([(kept.clone(), graph_with(800, &["a"]))]);
        history.attach_bodies(only_one);

        assert_eq!(history.len(), 1);
        assert_eq!(history.latest().unwrap().id, kept);
    }
}
