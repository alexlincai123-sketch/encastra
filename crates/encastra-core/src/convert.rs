//! Applying the conversions the type table declared.
//!
//! Validation decided *which* operations an edge performs; this performs them. The two are
//! separate on purpose — the editor can show what will happen before anything runs, and the
//! runtime cannot decide something different at the last moment.
//!
//! Every operation name here comes from `type-graph.json`. [`tests::every_declared_operation_is_accounted_for`]
//! fails the build if the table gains one this module has never heard of, so a rule change
//! cannot quietly produce an edge nobody can execute.

use crate::broker::Broker;
use crate::graph::NodeId;
use crate::journal::NodeError;
use crate::value::{Handle, HandleKind, Value};

/// Operations the table declares that this build cannot yet perform.
///
/// Listed explicitly rather than falling through to a generic "unknown operation", so the gap
/// is visible in one place and the error a user sees can say what is actually missing. Each
/// one needs a media decoder that has not been built yet.
pub const PENDING_OPS: &[&str] = &["decode-image", "probe-video", "probe-audio"];

pub fn apply_ops(
    value: Value,
    ops: &[String],
    node: &NodeId,
    broker: &mut Broker,
) -> Result<Value, NodeError> {
    let mut current = value;
    for (index, op) in ops.iter().enumerate() {
        if op == "map" {
            let rest = &ops[index + 1..];
            let Value::List(items) = current else {
                return Err(NodeError::new(
                    "conversion-failed",
                    "Expected a list to convert, but the value was not one.",
                ));
            };
            let mut converted = Vec::with_capacity(items.len());
            for item in items {
                converted.push(apply_ops(item, rest, node, broker)?);
            }
            return Ok(Value::List(converted));
        }
        current = apply_one(current, op, node, broker)?;
    }
    Ok(current)
}

fn apply_one(
    value: Value,
    op: &str,
    node: &NodeId,
    broker: &mut Broker,
) -> Result<Value, NodeError> {
    // Absence survives every conversion except the one whose job is to remove it. Converting
    // "there is no value" into a zero or an empty string is how a missing input becomes an
    // invisible wrong answer.
    if value.is_absent() && op != "unwrap-option" {
        return Ok(Value::Absent);
    }

    Ok(match op {
        "unwrap-option" => match value {
            Value::Absent => {
                return Err(NodeError::new(
                    "conversion-failed",
                    "This input had no value, and the connection requires one.",
                )
                .with_hint(
                    "Connect something that always produces a value, or use a node that supplies a fallback.",
                ));
            }
            other => other,
        },

        "to-text" => Value::Text(match value {
            Value::Int(i) => i.to_string(),
            Value::Float(f) => f.to_string(),
            Value::Bool(b) => b.to_string(),
            Value::Text(t) => t,
            other => return Err(cannot(op, &other)),
        }),

        "int-to-float" => match value {
            Value::Int(i) => {
                // Beyond 2^53 the conversion is not exact. Reporting that beats silently
                // rounding a number the user will later see as wrong.
                if i.unsigned_abs() > (1u64 << 53) {
                    return Err(NodeError::new(
                        "conversion-failed",
                        format!(
                            "{i} is too large to become a decimal number without losing precision."
                        ),
                    ));
                }
                Value::Float(i as f64)
            }
            other => return Err(cannot(op, &other)),
        },

        "bool-to-int" => match value {
            Value::Bool(b) => Value::Int(i64::from(b)),
            other => return Err(cannot(op, &other)),
        },

        "int-to-bool" => match value {
            Value::Int(i) => Value::Bool(i != 0),
            other => return Err(cannot(op, &other)),
        },

        "round" => match value {
            Value::Float(f) => {
                if !f.is_finite() {
                    return Err(NodeError::new(
                        "conversion-failed",
                        "This number is not finite, so it cannot become a whole number.",
                    ));
                }
                let rounded = f.round();
                if rounded > i64::MAX as f64 || rounded < i64::MIN as f64 {
                    return Err(NodeError::new(
                        "conversion-failed",
                        format!("{f} is outside the range of a whole number."),
                    ));
                }
                Value::Int(rounded as i64)
            }
            other => return Err(cannot(op, &other)),
        },

        "parse-int" => match value {
            Value::Text(t) => Value::Int(t.trim().parse::<i64>().map_err(|_| {
                NodeError::new(
                    "conversion-failed",
                    format!("{:?} is not a whole number.", truncate(&t)),
                )
            })?),
            other => return Err(cannot(op, &other)),
        },

        "parse-float" => match value {
            Value::Text(t) => Value::Float(t.trim().parse::<f64>().map_err(|_| {
                NodeError::new(
                    "conversion-failed",
                    format!("{:?} is not a number.", truncate(&t)),
                )
            })?),
            other => return Err(cannot(op, &other)),
        },

        "parse-bool" => match value {
            Value::Text(t) => match t.trim().to_ascii_lowercase().as_str() {
                // A deliberate allowlist. Treating every non-empty string as true is how a
                // workflow ends up branching on the word "false".
                "true" | "yes" | "1" | "on" => Value::Bool(true),
                "false" | "no" | "0" | "off" => Value::Bool(false),
                _ => {
                    return Err(NodeError::new(
                        "conversion-failed",
                        format!("{:?} is not a true/false value.", truncate(&t)),
                    )
                    .with_hint("Accepted: true, false, yes, no, 1, 0, on, off."));
                }
            },
            other => return Err(cannot(op, &other)),
        },

        "parse-json" => match value {
            Value::Text(t) => Value::Json(serde_json::from_str(&t).map_err(|e| {
                NodeError::new(
                    "conversion-failed",
                    format!("This text is not valid JSON: {e}."),
                )
            })?),
            other => return Err(cannot(op, &other)),
        },

        "stringify-json" => match value {
            Value::Json(j) => Value::Text(serde_json::to_string(&j).map_err(|e| {
                NodeError::new(
                    "conversion-failed",
                    format!("Could not write this as JSON: {e}."),
                )
            })?),
            other => return Err(cannot(op, &other)),
        },

        "encode-json" => match value {
            Value::Bool(b) => Value::Json(serde_json::json!(b)),
            Value::Int(i) => Value::Json(serde_json::json!(i)),
            Value::Float(f) => Value::Json(serde_json::json!(f)),
            Value::Text(t) => Value::Json(serde_json::json!(t)),
            other => return Err(cannot(op, &other)),
        },

        "decode-json" => match value {
            Value::Json(j) => match j {
                serde_json::Value::Bool(b) => Value::Bool(b),
                serde_json::Value::String(s) => Value::Text(s),
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        Value::Int(i)
                    } else if let Some(f) = n.as_f64() {
                        Value::Float(f)
                    } else {
                        return Err(NodeError::new(
                            "conversion-failed",
                            "This number cannot be represented.",
                        ));
                    }
                }
                other => {
                    return Err(NodeError::new(
                        "conversion-failed",
                        format!(
                            "Expected a single value, but this JSON is {}.",
                            match other {
                                serde_json::Value::Array(_) => "a list",
                                serde_json::Value::Object(_) => "structured data",
                                _ => "empty",
                            }
                        ),
                    ));
                }
            },
            other => return Err(cannot(op, &other)),
        },

        "read-bytes" => match value {
            Value::Handle(h) => {
                let bytes = broker.open_input(node, h)?;
                let out = broker.create_output(node, HandleKind::Bytes, "content.bin")?;
                broker.write_output(node, out, &bytes)?;
                Value::Handle(out)
            }
            other => return Err(cannot(op, &other)),
        },

        "write-temp" => match value {
            Value::Handle(h) => Value::Handle(Handle {
                id: h.id,
                kind: HandleKind::File,
            }),
            other => return Err(cannot(op, &other)),
        },

        pending if PENDING_OPS.contains(&pending) => {
            return Err(NodeError::new(
                "conversion-unavailable",
                format!("This build cannot yet perform the \"{pending}\" conversion."),
            )
            .with_hint("It needs a media component that has not shipped yet."));
        }

        unknown => {
            return Err(NodeError::new(
                "conversion-failed",
                format!("Unknown conversion \"{unknown}\"."),
            ));
        }
    })
}

fn cannot(op: &str, value: &Value) -> NodeError {
    NodeError::new(
        "conversion-failed",
        format!("Cannot apply \"{op}\" to {}.", value.summary()),
    )
}

fn truncate(text: &str) -> String {
    text.chars().take(40).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::broker::GrantSet;

    fn broker() -> Broker {
        let dir = std::env::temp_dir().join(format!("encastra-convert-{}", std::process::id()));
        Broker::new(dir, GrantSet::new()).unwrap()
    }

    fn apply(value: Value, ops: &[&str]) -> Result<Value, NodeError> {
        let ops: Vec<String> = ops.iter().map(|s| (*s).to_owned()).collect();
        apply_ops(value, &ops, &NodeId("n".into()), &mut broker())
    }

    /// The anti-drift check for this module: the shared rule table may not declare an
    /// operation nobody can execute.
    #[test]
    fn every_declared_operation_is_accounted_for() {
        let declared: Vec<&str> = encastra_protocol::all_coercions()
            .map(|c| c.op.as_str())
            .collect();
        assert!(
            !declared.is_empty(),
            "the table should declare some operations"
        );

        for op in declared {
            if PENDING_OPS.contains(&op) {
                continue;
            }
            let result = apply(Value::Int(1), &[op]);
            // Any answer but "Unknown conversion" means this module knows the operation. A
            // type mismatch is fine — we are not checking that Int is a valid input for it.
            if let Err(e) = result {
                assert!(
                    !e.message.starts_with("Unknown conversion"),
                    "the type table declares \"{op}\" but nothing implements it"
                );
            }
        }

        // And every pending operation must still be declared, or the list is stale.
        let all: Vec<&str> = encastra_protocol::all_coercions()
            .map(|c| c.op.as_str())
            .collect();
        for pending in PENDING_OPS {
            assert!(
                all.contains(pending),
                "\"{pending}\" is listed as pending but the table no longer declares it"
            );
        }
    }

    #[test]
    fn absence_survives_conversion_instead_of_becoming_a_zero() {
        // The failure this prevents: a missing input silently becoming 0 or "" downstream.
        assert_eq!(apply(Value::Absent, &["to-text"]).unwrap(), Value::Absent);
        assert_eq!(apply(Value::Absent, &["parse-int"]).unwrap(), Value::Absent);

        let err = apply(Value::Absent, &["unwrap-option"]).unwrap_err();
        assert!(err.message.contains("no value"));
        assert!(err.hint.is_some());
    }

    #[test]
    fn total_conversions_do_what_they_say() {
        assert_eq!(
            apply(Value::Int(42), &["to-text"]).unwrap(),
            Value::Text("42".into())
        );
        assert_eq!(
            apply(Value::Bool(true), &["bool-to-int"]).unwrap(),
            Value::Int(1)
        );
        assert_eq!(
            apply(Value::Int(3), &["int-to-float"]).unwrap(),
            Value::Float(3.0)
        );
    }

    #[test]
    fn fallible_conversions_fail_with_something_readable() {
        let err = apply(Value::Text("twelve".into()), &["parse-int"]).unwrap_err();
        assert_eq!(err.code, "conversion-failed");
        assert!(err.message.contains("twelve"));

        let err = apply(Value::Text("maybe".into()), &["parse-bool"]).unwrap_err();
        assert!(err.hint.as_deref().unwrap().contains("yes, no"));
    }

    #[test]
    fn parse_bool_uses_an_allowlist_not_truthiness() {
        assert_eq!(
            apply(Value::Text("false".into()), &["parse-bool"]).unwrap(),
            Value::Bool(false)
        );
        assert_eq!(
            apply(Value::Text("OFF".into()), &["parse-bool"]).unwrap(),
            Value::Bool(false)
        );
        // The bug this avoids: a workflow branching on the *word* "false" being truthy.
        assert!(apply(Value::Text("nope".into()), &["parse-bool"]).is_err());
    }

    #[test]
    fn precision_loss_is_reported_rather_than_rounded_away() {
        let big = (1i64 << 53) + 1;
        let err = apply(Value::Int(big), &["int-to-float"]).unwrap_err();
        assert!(err.message.contains("precision"), "{}", err.message);
    }

    #[test]
    fn rounding_refuses_values_it_cannot_represent() {
        assert_eq!(apply(Value::Float(2.6), &["round"]).unwrap(), Value::Int(3));
        assert!(apply(Value::Float(f64::NAN), &["round"]).is_err());
        assert!(apply(Value::Float(1e30), &["round"]).is_err());
    }

    #[test]
    fn map_applies_the_rest_of_the_chain_to_each_element() {
        let list = Value::List(vec![Value::Int(1), Value::Int(2)]);
        let out = apply(list, &["map", "to-text"]).unwrap();
        assert_eq!(
            out,
            Value::List(vec![Value::Text("1".into()), Value::Text("2".into())])
        );
    }

    #[test]
    fn one_bad_element_fails_the_whole_list_rather_than_dropping_it() {
        let list = Value::List(vec![Value::Text("1".into()), Value::Text("x".into())]);
        assert!(apply(list, &["map", "parse-int"]).is_err());
    }

    #[test]
    fn a_pending_conversion_says_what_is_missing() {
        let handle = Value::Handle(Handle {
            id: 1,
            kind: HandleKind::File,
        });
        let err = apply(handle, &["decode-image"]).unwrap_err();
        assert_eq!(err.code, "conversion-unavailable");
        assert!(err.hint.is_some());
    }
}
