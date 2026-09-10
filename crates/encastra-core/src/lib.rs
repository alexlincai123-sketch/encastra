//! The Encastra runtime.
//!
//! There is one of these. The editor does not have a second, simplified copy for previews —
//! a workflow that behaves differently in preview than in production is worse than having no
//! preview at all (ADR-0003). The editor validates *statically* from the shared type table and
//! asks this crate for everything else.

pub mod broker;
pub mod convert;
pub mod graph;
pub mod journal;
pub mod registry;
pub mod runner;
pub mod validate;
pub mod value;

pub use broker::{Broker, Grant, GrantScope, GrantSet};
pub use graph::{ComponentRef, Edge, Graph, Node, NodeId, PortRef, Position};
pub use journal::{NodeError, NodeRecord, NodeStatus, RunJournal, RunStatus};
pub use registry::{ComponentRegistry, InMemoryRegistry};
pub use runner::{CoreComponent, CoreComponentSet, NodeContext, RunOutcome, run};
pub use validate::{Issue, Location, Severity, Validation, validate};
pub use value::{Handle, HandleKind, Value};

/// The runtime version a manifest's `runtime` range is matched against.
pub const RUNTIME_VERSION: &str = env!("CARGO_PKG_VERSION");
