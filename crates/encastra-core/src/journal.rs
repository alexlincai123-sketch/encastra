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

/// Declares [`NodeErrorCode`] from one list, so the variant, the wire string and the pinned
/// `ALL` cannot disagree with each other.
///
/// Three things are derived from the same line: the variant a call site names, the string that
/// goes on the wire, and the entry in `ALL`. Written by hand, those are three places to forget —
/// and the one that matters is `ALL`, because it is what the fixture the interface is checked
/// against is written from. A code missing from `ALL` is a code with no sentence in six
/// languages, which is exactly the failure this vocabulary exists to stop.
macro_rules! node_error_codes {
    ($($(#[$meta:meta])* $variant:ident => $wire:literal),+ $(,)?) => {
        /// Every reason a step of this build can fail.
        ///
        /// `NodeError::code` used to be whatever `&str` a call site felt like writing, which made
        /// the set unknowable: the interface has to have a sentence in six languages for every
        /// code, and nothing stopped a new call site inventing one more that reached a Spanish
        /// reader in English. Naming them here makes the set *enumerable* — `ALL` is what
        /// `apps/desktop/test/fixtures/error-kinds.json` is written from — and *exhaustive*,
        /// because [`NodeError::new`] takes a member rather than a string.
        ///
        /// The wire format did not change. Each member serialises to exactly the kebab-case
        /// string the call site used to spell out, and `NodeError::code` is still a `String` on
        /// the wire, so a journal written by another build still deserialises and a component
        /// with a vocabulary of its own (see [`NodeError::from_component`]) is still expressible.
        #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
        pub enum NodeErrorCode {
            $($(#[$meta])* $variant,)+
        }

        impl NodeErrorCode {
            /// Every code, in declared order. The list the fixture is written from.
            pub const ALL: &'static [NodeErrorCode] = &[$(NodeErrorCode::$variant,)+];

            /// The exact string that goes on the wire, and the only spelling of it.
            pub const fn as_str(self) -> &'static str {
                match self {
                    $(NodeErrorCode::$variant => $wire,)+
                }
            }
        }
    };
}

node_error_codes! {
    // What was connected, or not.
    MissingInput => "missing-input",
    WrongInput => "wrong-input",
    MissingConfig => "missing-config",
    MissingHandle => "missing-handle",
    NotText => "not-text",
    NotAnImage => "not-an-image",
    // Turning one kind of value into another.
    ConversionFailed => "conversion-failed",
    ConversionUnavailable => "conversion-unavailable",
    // Reading and writing structured data.
    InvalidJson => "invalid-json",
    InvalidCsv => "invalid-csv",
    BadSeparator => "bad-separator",
    CsvTooLarge => "csv-too-large",
    EncodeFailed => "encode-failed",
    // Pictures.
    ResizeFailed => "resize-failed",
    UnsupportedFormat => "unsupported-format",
    // The network.
    BadUrl => "bad-url",
    InsecureUrl => "insecure-url",
    UnsupportedMethod => "unsupported-method",
    RequestFailed => "request-failed",
    ResponseTooLarge => "response-too-large",
    // The broker: what this machine would and would not do.
    Denied => "denied",
    ReadFailed => "read-failed",
    WriteFailed => "write-failed",
    MoveIncomplete => "move-incomplete",
    TooLarge => "too-large",
    // The desktop around it.
    ClipboardUnavailable => "clipboard-unavailable",
    ClipboardFailed => "clipboard-failed",
    // The run itself.
    Cancelled => "cancelled",
    RunTooLong => "run-too-long",
    RunMemoryBudget => "run-memory-budget",
    ComponentMissing => "component-missing",
    NoImplementation => "no-implementation",
    ContractBroken => "contract-broken",
}

impl std::fmt::Display for NodeErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl Serialize for NodeErrorCode {
    /// Through `as_str`, not through a `rename_all` attribute: a derive would be a second place
    /// the wire spelling is decided, and the two could drift.
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NodeError {
    /// Stable and machine-readable, and one of [`NodeErrorCode`] for anything this build refuses.
    ///
    /// Kept as a `String` rather than the enum on purpose. The wire has to stay open in both
    /// directions: a journal written by a newer build, and a component that is not part of this
    /// build, can both carry a code this build has never heard of. The interface has a
    /// passthrough for exactly that case.
    pub code: String,
    /// What happened, for a person.
    pub message: String,
    /// What to do about it, when there is an honest answer.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
    pub retryable: bool,
}

impl NodeError {
    /// A refusal in this build's own vocabulary.
    ///
    /// Takes a [`NodeErrorCode`] rather than a string, which is the whole mechanism: a new reason
    /// to fail cannot reach a person until it has been named in the list above, and naming it
    /// there changes the fixture, which fails the interface's tests until six sentences exist.
    pub fn new(code: NodeErrorCode, message: impl Into<String>) -> Self {
        NodeError {
            code: code.as_str().to_owned(),
            message: message.into(),
            hint: None,
            retryable: false,
        }
    }

    /// A refusal from a component that brings a vocabulary of its own.
    ///
    /// `CoreComponent` is public, and a component this build did not write is entitled to its own
    /// codes — forcing it to pick from a list belonging to the runtime would be a worse lie than
    /// an untranslated sentence. This is the only way into `code` that is not a member, and it is
    /// why the interface keeps a passthrough: an unknown code is shown as the words the component
    /// itself supplied. Nothing in this workspace uses it outside a test component.
    pub fn from_component(code: impl Into<String>, message: impl Into<String>) -> Self {
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

    #[test]
    fn a_code_puts_its_own_spelling_on_the_wire() {
        // `as_str` is what the fixture is written from and what `new` stores, and serde is what
        // the interface actually receives. If those ever disagreed, the interface would be
        // checked against a list of words nobody sends — so they are compared rather than
        // trusted. The same argument `error.rs` makes for `kind()` against serde.
        for &code in NodeErrorCode::ALL {
            assert_eq!(
                serde_json::to_value(code).expect("a code serialises"),
                serde_json::Value::String(code.as_str().to_owned()),
                "{code:?}"
            );
            assert_eq!(NodeError::new(code, "message").code, code.as_str());
        }
    }

    #[test]
    fn no_two_codes_are_the_same_word() {
        // The one mistake the macro cannot catch: two variants given the same literal would look
        // like two reasons to fail and share one sentence, and the fixture would silently be
        // shorter than the enum.
        let mut seen = std::collections::BTreeSet::new();
        for &code in NodeErrorCode::ALL {
            assert!(seen.insert(code.as_str()), "{} is declared twice", code);
        }
        assert_eq!(seen.len(), NodeErrorCode::ALL.len());
    }

    #[test]
    fn every_code_is_spelled_the_way_the_interface_expects() {
        // The interface turns a code into a key by camel-casing it on the hyphens
        // (`apps/desktop/src/errors.ts`). Anything with an underscore, a capital or a space in it
        // would produce a key no locale file has, so the shape is pinned here rather than being
        // discovered by a reader with no sentence in front of them.
        for &code in NodeErrorCode::ALL {
            let wire = code.as_str();
            assert!(!wire.is_empty(), "{code:?} is empty");
            assert!(
                wire.chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'),
                "{wire} is not kebab-case"
            );
            assert!(
                !wire.starts_with('-') && !wire.ends_with('-') && !wire.contains("--"),
                "{wire} has a hyphen with nothing on one side of it"
            );
        }
    }

    #[test]
    fn a_component_may_refuse_in_a_vocabulary_this_build_does_not_own() {
        // The wire stays open on purpose: `CoreComponent` is public, and a component this build
        // did not write is entitled to its own codes. This is the case the interface's
        // passthrough exists for, so it has to remain expressible.
        let error = NodeError::from_component("something-new", "a reason this build never wrote");
        assert_eq!(error.code, "something-new");
        assert!(
            !NodeErrorCode::ALL
                .iter()
                .any(|known| known.as_str() == error.code)
        );
    }
}
