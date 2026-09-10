//! Values that flow along edges.
//!
//! The important one is [`Handle`]. A file, image, video or directory is **never** a path and
//! never a byte buffer on the wire — it is an opaque number the host can resolve and a
//! component cannot (ADR-0004). That is what makes "read `~/.ssh/id_rsa` instead"
//! unrepresentable rather than merely forbidden.

use std::fmt;

use serde::{Deserialize, Serialize};

/// An opaque reference to something the host owns.
///
/// A component receives the `id` and nothing else: no path, no length, no name it could use
/// to guess at a sibling. It resolves only through host calls, only for the run it belongs to,
/// and only if the graph actually wired it to one of that component's ports.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Handle {
    pub id: u64,
    pub kind: HandleKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HandleKind {
    File,
    Dir,
    Bytes,
    Image,
    Video,
    Audio,
}

impl HandleKind {
    /// The name this kind carries in the shared type table.
    pub fn type_name(self) -> &'static str {
        match self {
            HandleKind::File => "file",
            HandleKind::Dir => "dir",
            HandleKind::Bytes => "bytes",
            HandleKind::Image => "image",
            HandleKind::Video => "video",
            HandleKind::Audio => "audio",
        }
    }

    pub fn from_type_name(name: &str) -> Option<Self> {
        Some(match name {
            "file" => HandleKind::File,
            "dir" => HandleKind::Dir,
            "bytes" => HandleKind::Bytes,
            "image" => HandleKind::Image,
            "video" => HandleKind::Video,
            "audio" => HandleKind::Audio,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "t", content = "v", rename_all = "lowercase")]
pub enum Value {
    Bool(bool),
    Int(i64),
    Float(f64),
    Text(String),
    Json(serde_json::Value),
    Handle(Handle),
    List(Vec<Value>),
    /// The empty case of `option<T>`.
    ///
    /// Distinct from every other value on purpose: "there is no value" and "there is an empty
    /// value" are different facts, and collapsing them is how a failure becomes invisible.
    Absent,
}

impl Value {
    /// The type name this value would report, for checking that what arrived matches what a
    /// port promised. Returns `None` for `Absent`, which has no type of its own — it is the
    /// absence of one.
    pub fn type_name(&self) -> Option<String> {
        Some(match self {
            Value::Bool(_) => "bool".into(),
            Value::Int(_) => "i64".into(),
            Value::Float(_) => "f64".into(),
            Value::Text(_) => "string".into(),
            Value::Json(_) => "json".into(),
            Value::Handle(h) => h.kind.type_name().into(),
            Value::List(items) => {
                // An empty list is compatible with any element type, so it reports none.
                let first = items.first()?;
                format!("list<{}>", first.type_name()?)
            }
            Value::Absent => return None,
        })
    }

    pub fn is_absent(&self) -> bool {
        matches!(self, Value::Absent)
    }

    /// A short, non-sensitive description for the debugger and the run journal.
    ///
    /// Deliberately does not include file contents or full text: the journal is written to
    /// disk and shown in a UI, and neither is a place for a user's data to leak into by
    /// default.
    pub fn summary(&self) -> String {
        match self {
            Value::Bool(b) => b.to_string(),
            Value::Int(i) => i.to_string(),
            Value::Float(f) => f.to_string(),
            Value::Text(s) => {
                let chars: Vec<char> = s.chars().collect();
                if chars.len() <= 60 {
                    format!("{s:?}")
                } else {
                    format!(
                        "{:?}… ({} characters)",
                        chars[..60].iter().collect::<String>(),
                        chars.len()
                    )
                }
            }
            Value::Json(v) => format!("json ({})", json_shape(v)),
            Value::Handle(h) => format!("{} #{}", h.kind.type_name(), h.id),
            Value::List(items) => format!("list of {}", items.len()),
            Value::Absent => "absent".into(),
        }
    }
}

fn json_shape(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::Null => "null".into(),
        serde_json::Value::Bool(_) => "boolean".into(),
        serde_json::Value::Number(_) => "number".into(),
        serde_json::Value::String(_) => "string".into(),
        serde_json::Value::Array(a) => format!("{} items", a.len()),
        serde_json::Value::Object(o) => format!("{} fields", o.len()),
    }
}

impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.summary())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handle_kinds_round_trip_through_the_shared_type_names() {
        for kind in [
            HandleKind::File,
            HandleKind::Dir,
            HandleKind::Bytes,
            HandleKind::Image,
            HandleKind::Video,
            HandleKind::Audio,
        ] {
            assert_eq!(HandleKind::from_type_name(kind.type_name()), Some(kind));
            // And the name must actually exist in the type graph, or a handle could carry a
            // type the editor has never heard of.
            assert!(
                encastra_protocol::is_known_type(kind.type_name()),
                "{} is not in the shared type table",
                kind.type_name()
            );
        }
    }

    #[test]
    fn absent_is_not_a_type() {
        assert_eq!(Value::Absent.type_name(), None);
        assert!(Value::Absent.is_absent());
        // An empty list also has no knowable element type; it must not claim one.
        assert_eq!(Value::List(vec![]).type_name(), None);
    }

    #[test]
    fn summaries_do_not_spill_user_data() {
        let secret = Value::Text("a".repeat(500));
        let summary = secret.summary();
        assert!(summary.len() < 120, "summary was {} chars", summary.len());
        assert!(summary.contains("500 characters"));

        // A handle summary reveals the kind and the opaque id, never a path.
        let h = Value::Handle(Handle {
            id: 7,
            kind: HandleKind::Image,
        });
        assert_eq!(h.summary(), "image #7");
    }

    #[test]
    fn nested_lists_report_their_element_type() {
        let v = Value::List(vec![Value::Handle(Handle {
            id: 1,
            kind: HandleKind::Image,
        })]);
        assert_eq!(v.type_name().as_deref(), Some("list<image>"));
    }
}
