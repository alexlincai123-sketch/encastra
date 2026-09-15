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

    /// Roughly how much memory this value's payload occupies, for the runtime's own accounting.
    ///
    /// Deliberately an **estimate**, and deliberately cheap: it is called once per value as a
    /// run produces and releases them, so it must not walk anything it does not have to. It
    /// counts the bytes a payload actually holds — a string's length, the sum of a list's
    /// items — and adds a small per-node constant for structured data, which stands in for the
    /// key, tag and allocation overhead `serde_json` carries for every node it keeps.
    ///
    /// A [`Handle`] counts as **nothing**. Its content is a file the host owns; what travels
    /// along the edge is an opaque number. Counting a handle as its file's size would make the
    /// budget refuse a workflow that never held that file in memory at all — which is the whole
    /// point of handles.
    ///
    /// Arithmetic saturates: a value big enough to overflow a `u64` is already far past any
    /// budget, and wrapping round to a small number is the one answer that would be dangerous.
    pub fn approx_bytes(&self) -> u64 {
        match self {
            Value::Bool(_) => 1,
            Value::Int(_) | Value::Float(_) => 8,
            Value::Text(s) => s.len() as u64,
            Value::Json(v) => json_approx_bytes(v),
            // The content is on disk and the host owns it — see the note above.
            Value::Handle(_) => 0,
            Value::List(items) => items.iter().fold(0u64, |total, item| {
                total.saturating_add(item.approx_bytes())
            }),
            Value::Absent => 0,
        }
    }

    /// A description safe to write to disk.
    ///
    /// This is what goes in the run journal, so it contains **no content**: text and
    /// structured data are described by size and shape, never quoted. Scalars are shown
    /// because they are what makes a graph debuggable and they carry no bulk; a secret never
    /// travels as a graph value in the first place, since secrets are resolved from the OS
    /// keystore at the point of use.
    ///
    /// For the live inspector, which shows a person what actually flowed through a node, use
    /// [`preview`](Self::preview) — and do not persist the result.
    pub fn summary(&self) -> String {
        match self {
            Value::Bool(b) => b.to_string(),
            Value::Int(i) => i.to_string(),
            Value::Float(f) => f.to_string(),
            Value::Text(s) => format!("text ({} characters)", s.chars().count()),
            Value::Json(v) => format!("json ({})", json_shape(v)),
            Value::Handle(h) => format!("{} #{}", h.kind.type_name(), h.id),
            Value::List(items) => format!("list of {}", items.len()),
            Value::Absent => "absent".into(),
        }
    }

    /// A short excerpt for the live inspector, including actual content.
    ///
    /// **Never persist this and never send it anywhere.** It exists so that a person
    /// debugging a run can see what flowed through a node; the moment it is written to a file
    /// or a telemetry payload, the journal's no-content guarantee is gone.
    pub fn preview(&self) -> String {
        match self {
            Value::Text(s) => {
                let chars: Vec<char> = s.chars().collect();
                if chars.len() <= 200 {
                    format!("{s:?}")
                } else {
                    format!(
                        "{:?}… ({} characters)",
                        chars[..200].iter().collect::<String>(),
                        chars.len()
                    )
                }
            }
            Value::Json(v) => {
                let rendered = serde_json::to_string_pretty(v).unwrap_or_default();
                rendered.chars().take(2000).collect()
            }
            other => other.summary(),
        }
    }
}

/// The per-node constant in the structured-data estimate.
///
/// Every `serde_json` node costs something even when it holds nothing: the enum itself, the
/// allocation behind an array or a map, the key a field is filed under. Thirty-two bytes is
/// the right order of magnitude and errs on the high side, which is the safe direction for a
/// budget — over-counting refuses a run early, under-counting lets one through.
const JSON_NODE_OVERHEAD: u64 = 32;

fn json_approx_bytes(v: &serde_json::Value) -> u64 {
    let own = match v {
        serde_json::Value::String(s) => s.len() as u64,
        serde_json::Value::Array(a) => a.iter().fold(0u64, |total, item| {
            total.saturating_add(json_approx_bytes(item))
        }),
        serde_json::Value::Object(o) => o.iter().fold(0u64, |total, (key, value)| {
            total
                .saturating_add(key.len() as u64)
                .saturating_add(json_approx_bytes(value))
        }),
        // Null, booleans and numbers carry no payload of their own; the node constant is
        // the whole of their cost.
        _ => 0,
    };
    own.saturating_add(JSON_NODE_OVERHEAD)
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
        // The journal is persisted, so a summary describes text; it never quotes it. Even a
        // short string is somebody's data.
        let secret = Value::Text("hunter2-token".into());
        assert_eq!(secret.summary(), "text (13 characters)");
        assert!(!secret.summary().contains("hunter2"));

        let long = Value::Text("a".repeat(500));
        assert_eq!(long.summary(), "text (500 characters)");

        // Structured data is described by shape, not printed.
        let json = Value::Json(serde_json::json!({ "token": "hunter2" }));
        assert_eq!(json.summary(), "json (1 fields)");
        assert!(!json.summary().contains("hunter2"));

        // The live inspector may show content — it is memory-only, never written down.
        assert!(Value::Text("hunter2".into()).preview().contains("hunter2"));

        // A handle summary reveals the kind and the opaque id, never a path.
        let h = Value::Handle(Handle {
            id: 7,
            kind: HandleKind::Image,
        });
        assert_eq!(h.summary(), "image #7");
    }

    #[test]
    fn a_payloads_size_is_what_the_budget_counts() {
        // Text is counted by the bytes it holds, not by its character count: a run's memory is
        // measured in bytes, and a multi-byte character costs what it costs.
        assert_eq!(Value::Text("a".repeat(1024)).approx_bytes(), 1024);
        assert_eq!(Value::Text("é".into()).approx_bytes(), 2);

        // Scalars are small constants; absence is free.
        assert_eq!(Value::Bool(true).approx_bytes(), 1);
        assert_eq!(Value::Int(9_000).approx_bytes(), 8);
        assert_eq!(Value::Float(1.5).approx_bytes(), 8);
        assert_eq!(Value::Absent.approx_bytes(), 0);

        // A handle is an opaque number. The file behind it is the host's, never in the run's
        // memory, and counting it would refuse workflows that hold nothing at all.
        assert_eq!(
            Value::Handle(Handle {
                id: 1,
                kind: HandleKind::Video,
            })
            .approx_bytes(),
            0
        );

        // A list costs what its items cost.
        let list = Value::List(vec![Value::Text("ab".into()), Value::Text("cde".into())]);
        assert_eq!(list.approx_bytes(), 5);
    }

    #[test]
    fn structured_data_is_counted_all_the_way_down() {
        // A shallow estimate that only looked at the top-level node would see this as one
        // small object, which is exactly how a large payload would slip past a budget.
        let nested = Value::Json(serde_json::json!({
            "outer": { "inner": ["x".repeat(100)] }
        }));
        let flat = Value::Json(serde_json::json!({ "outer": 1 }));
        assert!(
            nested.approx_bytes() > flat.approx_bytes() + 100,
            "nested payloads must be walked: {} vs {}",
            nested.approx_bytes(),
            flat.approx_bytes()
        );
        // And every node carries its overhead, so even an empty structure is not free.
        assert_eq!(
            Value::Json(serde_json::json!({})).approx_bytes(),
            JSON_NODE_OVERHEAD
        );
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
