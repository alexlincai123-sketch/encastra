//! Deciding what happens next.
//!
//! The branch not taken produces `Absent`, not an empty value. Absence survives every
//! conversion, so a path that was not chosen cannot quietly turn into a zero or an empty string
//! somewhere downstream — and a node whose required input is absent is skipped rather than run
//! on nothing.

use std::sync::{Arc, LazyLock};
use std::time::{Duration, Instant};

use encastra_core::journal::{LogLevel, NodeError, NodeErrorCode};
use encastra_core::runner::{CoreComponent, NodeContext};
use encastra_core::value::Value;
use encastra_protocol::manifest::ComponentManifest;

use crate::{Outputs, bool_input, manifest};

// ---------------------------------------------------------------------------------------
// If
// ---------------------------------------------------------------------------------------

static IF: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.flow.if",
        "version": "1.0.0",
        "name": "If",
        "description": "Sends the value one way or the other depending on a condition.",
        "category": "flow",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  {
            "condition": { "type": "bool", "required": true },
            "value":     { "type": "json", "required": true }
          },
          "outputs": {
            "then": { "type": "option<json>", "label": "If true" },
            "else": { "type": "option<json>", "label": "If false" }
          }
        },
        "platforms": ["windows", "macos", "linux"],
        "retryable": true
      }"#,
    )
});

struct If;

impl CoreComponent for If {
    fn manifest(&self) -> &ComponentManifest {
        &IF
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let condition = bool_input(ctx, "condition")?;
        let value = ctx.input("value").cloned().unwrap_or(Value::Absent);

        Ok(if condition {
            Outputs::from([
                ("then".to_owned(), value),
                ("else".to_owned(), Value::Absent),
            ])
        } else {
            Outputs::from([
                ("then".to_owned(), Value::Absent),
                ("else".to_owned(), value),
            ])
        })
    }
}

pub fn branch() -> Arc<dyn CoreComponent> {
    Arc::new(If)
}

// ---------------------------------------------------------------------------------------
// Switch
// ---------------------------------------------------------------------------------------

static SWITCH: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.flow.switch",
        "version": "1.0.0",
        "name": "Switch",
        "description": "Sends the value down one of several routes depending on a word.",
        "category": "flow",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  {
            "match": { "type": "string", "required": true, "label": "Compare this",
                       "doc": "Matched against each route's list, ignoring capitals." },
            "value": { "type": "json", "required": true, "label": "Send this" }
          },
          "outputs": {
            "a":     { "type": "option<json>", "label": "Route A" },
            "b":     { "type": "option<json>", "label": "Route B" },
            "c":     { "type": "option<json>", "label": "Route C" },
            "other": { "type": "option<json>", "label": "Anything else" }
          }
        },
        "config": {
          "case_a": { "type": "string", "label": "Route A matches",
                      "doc": "A list separated by commas, for example: png, jpg, jpeg, webp" },
          "case_b": { "type": "string", "label": "Route B matches" },
          "case_c": { "type": "string", "label": "Route C matches" }
        },
        "platforms": ["windows", "macos", "linux"],
        "retryable": true
      }"#,
    )
});

struct Switch;

fn matches(ctx: &NodeContext<'_>, key: &str, needle: &str) -> bool {
    ctx.config_str(key)
        .unwrap_or("")
        .split(',')
        .map(|option| option.trim())
        .filter(|option| !option.is_empty())
        .any(|option| option.eq_ignore_ascii_case(needle))
}

impl CoreComponent for Switch {
    fn manifest(&self) -> &ComponentManifest {
        &SWITCH
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let needle = match ctx.input("match") {
            Some(Value::Text(t)) => t.trim().to_owned(),
            Some(Value::Absent) | None => {
                return Err(NodeError::new(
                    NodeErrorCode::MissingInput,
                    "Nothing is connected to \"match\".",
                ));
            }
            Some(other) => {
                return Err(NodeError::new(
                    NodeErrorCode::WrongInput,
                    format!("\"match\" expected text but received {}.", other.summary()),
                ));
            }
        };
        let value = ctx.input("value").cloned().unwrap_or(Value::Absent);

        // First route wins. Overlapping lists are a configuration mistake rather than a reason
        // to send the same value down two paths, which would run the rest of the graph twice.
        let chosen = if matches(ctx, "case_a", &needle) {
            "a"
        } else if matches(ctx, "case_b", &needle) {
            "b"
        } else if matches(ctx, "case_c", &needle) {
            "c"
        } else {
            "other"
        };

        ctx.log(
            LogLevel::Info,
            format!("{needle:?} went to route {chosen}."),
        );

        Ok(["a", "b", "c", "other"]
            .into_iter()
            .map(|route| {
                let content = if route == chosen {
                    value.clone()
                } else {
                    Value::Absent
                };
                (route.to_owned(), content)
            })
            .collect())
    }
}

pub fn switch() -> Arc<dyn CoreComponent> {
    Arc::new(Switch)
}

// ---------------------------------------------------------------------------------------
// Delay
// ---------------------------------------------------------------------------------------

static DELAY: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.flow.delay",
        "version": "1.0.0",
        "name": "Delay",
        "description": "Waits, then passes the value on unchanged.",
        "category": "flow",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "value": { "type": "json", "required": true } },
          "outputs": { "value": { "type": "json" } }
        },
        "config": {
          "seconds": { "type": "i64", "required": true, "min": 0, "max": 3600, "label": "Wait for",
                       "doc": "In seconds. Stopping the run interrupts the wait." }
        },
        "platforms": ["windows", "macos", "linux"],
        "retryable": true
      }"#,
    )
});

struct Delay;

impl CoreComponent for Delay {
    fn manifest(&self) -> &ComponentManifest {
        &DELAY
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let seconds = ctx.config_i64("seconds").unwrap_or(1).clamp(0, 3600);
        let deadline = Instant::now() + Duration::from_secs(seconds as u64);

        // Woken often enough that Stop feels immediate. Sleeping for the whole duration would
        // make a one-hour delay unstoppable, which is the sort of thing that makes people
        // close an application rather than trust it.
        while Instant::now() < deadline {
            if ctx.is_cancelled() {
                return Err(NodeError::new(
                    NodeErrorCode::Cancelled,
                    "The wait was stopped.",
                ));
            }
            std::thread::sleep(Duration::from_millis(50));
        }

        let value = ctx.input("value").cloned().unwrap_or(Value::Absent);
        Ok(Outputs::from([("value".to_owned(), value)]))
    }
}

pub fn delay() -> Arc<dyn CoreComponent> {
    Arc::new(Delay)
}
