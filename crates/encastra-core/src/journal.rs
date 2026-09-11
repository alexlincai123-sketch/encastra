//! The run journal.
//!
//! This is not logging that was added afterwards — it is the debugger's data source, and the
//! only record of what a run actually did. Everything the node inspector shows (input, output,
//! error, duration, capabilities used, logs, timestamp) comes from here.
//!
//! It holds **summaries, never contents**. Today a journal only ever lives in memory and on
//! screen, but the rule is written for where it is going rather than for where it is: a journal
//! is the obvious thing to persist, to export, or to paste into a bug report, and a format that
//! holds file contents cannot be given any of those abilities later without a migration nobody
//! will notice is needed. Keeping contents out now is what keeps that door open.

use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::graph::NodeId;

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        // A clock before 1970 is not worth crashing a run over.
        .unwrap_or(0)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RunStatus {
    Running,
    /// Every node that was meant to run did, successfully.
    Ok,
    /// Something failed, but other branches completed. Distinct from `Ok` on purpose: a run
    /// that half-worked must never be reported as a run that worked.
    Partial,
    /// Nothing useful completed.
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum NodeStatus {
    Pending,
    Running,
    Ok,
    Failed,
    /// Not run because something it depended on failed or was cancelled. The journal records
    /// *which* node, so the user is not left guessing why a node never started.
    Skipped,
    Cancelled,
    /// Switched off by the user.
    Disabled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NodeError {
    /// Stable, machine-readable: `timed-out`, `denied`, `conversion-failed`, `component-failed`.
    pub code: String,
    /// What happened, for a person.
    pub message: String,
    /// What to do about it, when there is an honest answer.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
    pub retryable: bool,
}

impl NodeError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        NodeError {
            code: code.into(),
            message: message.into(),
            hint: None,
            retryable: false,
        }
    }

    pub fn with_hint(mut self, hint: impl Into<String>) -> Self {
        self.hint = Some(hint.into());
        self
    }

    pub fn retryable(mut self) -> Self {
        self.retryable = true;
        self
    }
}

impl std::fmt::Display for NodeError {
    /// What a person would need to read: the message, then what to do about it.
    ///
    /// The code is machine-readable and deliberately left out — it is in the journal for
    /// tooling, and putting it in front of somebody adds noise to the part that matters.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)?;
        if let Some(hint) = &self.hint {
            write!(f, " {hint}")?;
        }
        Ok(())
    }
}

impl std::error::Error for NodeError {}

/// One capability the broker was asked for, and what it answered.
///
/// Every call is recorded, allowed or denied. A denial is the interesting case and must never
/// be the one that goes unlogged.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CapabilityCall {
    pub at_ms: u64,
    pub kind: String,
    /// What it was asked for, already made safe to display — a handle number, a directory
    /// name, a host. Never a full path from the user's machine and never a secret.
    pub detail: String,
    pub allowed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub denied_because: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LogLine {
    pub at_ms: u64,
    pub level: LogLevel,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NodeRecord {
    pub component: String,
    pub status: NodeStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    /// Port name to a short, non-sensitive summary of what arrived.
    pub inputs: BTreeMap<String, String>,
    pub outputs: BTreeMap<String, String>,
    pub capability_calls: Vec<CapabilityCall>,
    pub logs: Vec<LogLine>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<NodeError>,
    /// For a skipped node: the node whose failure caused it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped_because: Option<NodeId>,
}

impl NodeRecord {
    pub fn new(component: String) -> Self {
        NodeRecord {
            component,
            status: NodeStatus::Pending,
            started_at_ms: None,
            duration_ms: None,
            inputs: BTreeMap::new(),
            outputs: BTreeMap::new(),
            capability_calls: Vec::new(),
            logs: Vec::new(),
            error: None,
            skipped_because: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RunJournal {
    pub run_id: String,
    pub started_at_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at_ms: Option<u64>,
    pub status: RunStatus,
    pub nodes: BTreeMap<NodeId, NodeRecord>,
    /// The order nodes were scheduled in.
    ///
    /// `nodes` is keyed for lookup, so iterating it gives alphabetical order — which is not
    /// what happened. A debugger showing a run as a sequence needs the sequence.
    pub order: Vec<NodeId>,
}

impl RunJournal {
    pub fn new(run_id: impl Into<String>) -> Self {
        RunJournal {
            run_id: run_id.into(),
            started_at_ms: now_ms(),
            finished_at_ms: None,
            status: RunStatus::Running,
            nodes: BTreeMap::new(),
            order: Vec::new(),
        }
    }

    pub fn record_mut(&mut self, node: &NodeId) -> Option<&mut NodeRecord> {
        self.nodes.get_mut(node)
    }

    /// Records in the order they ran.
    pub fn in_order(&self) -> impl Iterator<Item = (&NodeId, &NodeRecord)> {
        self.order
            .iter()
            .filter_map(|id| self.nodes.get(id).map(|record| (id, record)))
    }

    /// Decides the overall outcome from what the nodes actually did.
    ///
    /// The distinction that matters: a run where something failed is never `Ok`, even if every
    /// other branch succeeded. "Partly worked" is its own answer.
    pub fn finish(&mut self) {
        self.finished_at_ms = Some(now_ms());
        let any_failed = self.nodes.values().any(|n| n.status == NodeStatus::Failed);
        let any_cancelled = self
            .nodes
            .values()
            .any(|n| n.status == NodeStatus::Cancelled);
        let any_succeeded = self.nodes.values().any(|n| n.status == NodeStatus::Ok);

        self.status = if any_cancelled {
            RunStatus::Cancelled
        } else if any_failed && any_succeeded {
            RunStatus::Partial
        } else if any_failed {
            RunStatus::Failed
        } else {
            RunStatus::Ok
        };
    }

    pub fn failed_nodes(&self) -> impl Iterator<Item = (&NodeId, &NodeRecord)> {
        self.nodes
            .iter()
            .filter(|(_, r)| r.status == NodeStatus::Failed)
    }

    pub fn duration_ms(&self) -> Option<u64> {
        self.finished_at_ms
            .map(|end| end.saturating_sub(self.started_at_ms))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn journal_with(statuses: &[NodeStatus]) -> RunJournal {
        let mut j = RunJournal::new("test");
        for (i, status) in statuses.iter().enumerate() {
            let mut record = NodeRecord::new("test.thing@1.0.0".into());
            record.status = *status;
            j.nodes.insert(NodeId(format!("n{i}")), record);
        }
        j.finish();
        j
    }

    #[test]
    fn a_run_where_something_failed_is_never_reported_as_ok() {
        assert_eq!(
            journal_with(&[NodeStatus::Ok, NodeStatus::Failed]).status,
            RunStatus::Partial
        );
        assert_eq!(
            journal_with(&[NodeStatus::Failed, NodeStatus::Skipped]).status,
            RunStatus::Failed
        );
        assert_eq!(
            journal_with(&[NodeStatus::Ok, NodeStatus::Ok]).status,
            RunStatus::Ok
        );
    }

    #[test]
    fn cancellation_outranks_everything() {
        // A user who pressed Stop should not be told the run failed.
        assert_eq!(
            journal_with(&[NodeStatus::Ok, NodeStatus::Failed, NodeStatus::Cancelled]).status,
            RunStatus::Cancelled
        );
    }

    #[test]
    fn a_run_with_nothing_in_it_is_ok_not_failed() {
        assert_eq!(journal_with(&[]).status, RunStatus::Ok);
    }

    #[test]
    fn disabled_nodes_do_not_make_a_run_look_broken() {
        assert_eq!(
            journal_with(&[NodeStatus::Ok, NodeStatus::Disabled]).status,
            RunStatus::Ok
        );
    }
}
