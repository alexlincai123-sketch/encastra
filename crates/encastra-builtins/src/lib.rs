//! The first-party component set.
//!
//! These are Tier A (ADR-0002): compiled into the host, fast, able to use native crates — and
//! still holding no more authority than their manifests declare, because they reach the OS
//! through the same broker every sandboxed component uses. A component here that forgets to
//! declare `fs.read` cannot read a file, and the test suite proves it.
//!
//! The set is deliberately small. It is part of the trust base, and every component added to
//! it is code that a bug would make dangerous.

use std::collections::BTreeMap;
use std::sync::{Arc, LazyLock};

use encastra_core::journal::{LogLevel, NodeError};
use encastra_core::registry::InMemoryRegistry;
use encastra_core::runner::{CoreComponent, CoreComponentSet, NodeContext};
use encastra_core::value::{HandleKind, Value};
use encastra_protocol::manifest::ComponentManifest;

/// Builds the registry and the implementations together, so a manifest can never ship without
/// code or code without a manifest.
pub fn install() -> (InMemoryRegistry, CoreComponentSet) {
    let components: Vec<Arc<dyn CoreComponent>> = vec![
        Arc::new(FileRead),
        Arc::new(ParseJson),
        Arc::new(FileWrite),
        Arc::new(Branch),
        Arc::new(Notify),
    ];

    let mut registry = InMemoryRegistry::new();
    let mut set = CoreComponentSet::new();
    for component in components {
        registry
            .insert(component.manifest().clone())
            .expect("a first-party component is registered twice");
        set.insert(component)
            .expect("a first-party component is registered twice");
    }
    (registry, set)
}

/// Parses through the real validator, so first-party manifests are held to exactly the rules
/// third-party ones are. A typo here fails at start-up rather than at run time.
fn manifest(json: &str) -> ComponentManifest {
    ComponentManifest::parse(json).unwrap_or_else(|e| panic!("built-in manifest is invalid: {e}"))
}

// ---------------------------------------------------------------------------------------
// file.read
// ---------------------------------------------------------------------------------------

static FILE_READ: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.file.read",
        "version": "1.0.0",
        "name": "Read File",
        "description": "Reads the text content of the file connected to it.",
        "category": "file",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "file": { "type": "file", "required": true, "label": "File" } },
          "outputs": { "text": { "type": "string", "label": "Text" } }
        },
        "capabilities": [
          { "kind": "fs.read", "scope": "input-handles",
            "reason": "Reads the file you connect to this node, and nothing else." }
        ],
        "platforms": ["windows", "macos", "linux"],
        "retryable": true
      }"#,
    )
});

struct FileRead;

impl CoreComponent for FileRead {
    fn manifest(&self) -> &ComponentManifest {
        &FILE_READ
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<BTreeMap<String, Value>, NodeError> {
        let Some(Value::Handle(handle)) = ctx.input("file").cloned() else {
            return Err(NodeError::new("missing-input", "No file is connected."));
        };
        let text = ctx.read_text(handle)?;
        ctx.log(
            LogLevel::Info,
            format!("Read {} characters.", text.chars().count()),
        );
        Ok(BTreeMap::from([("text".to_owned(), Value::Text(text))]))
    }
}

// ---------------------------------------------------------------------------------------
// data.json
// ---------------------------------------------------------------------------------------

static PARSE_JSON: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.data.json",
        "version": "1.0.0",
        "name": "Parse JSON",
        "description": "Turns text into structured data.",
        "category": "data",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "text": { "type": "string", "required": true } },
          "outputs": { "json": { "type": "json" } }
        },
        "platforms": ["windows", "macos", "linux"],
        "retryable": true
      }"#,
    )
});

struct ParseJson;

impl CoreComponent for ParseJson {
    fn manifest(&self) -> &ComponentManifest {
        &PARSE_JSON
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<BTreeMap<String, Value>, NodeError> {
        let Some(Value::Text(text)) = ctx.input("text").cloned() else {
            return Err(NodeError::new("missing-input", "No text is connected."));
        };
        let parsed: serde_json::Value = serde_json::from_str(&text).map_err(|e| {
            NodeError::new("invalid-json", format!("This is not valid JSON: {e}."))
                .with_hint("The message says which line and column the problem is on.")
        })?;
        Ok(BTreeMap::from([("json".to_owned(), Value::Json(parsed))]))
    }
}

// ---------------------------------------------------------------------------------------
// file.write
// ---------------------------------------------------------------------------------------

static FILE_WRITE: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.file.write",
        "version": "1.0.0",
        "name": "Write File",
        "description": "Saves text into a file in a folder you choose.",
        "category": "file",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "content": { "type": "string", "required": true } },
          "outputs": { "saved": { "type": "bool" } }
        },
        "config": {
          "folder":   { "type": "string", "required": true, "label": "Folder",
                        "doc": "Where to save. You will be asked to allow this folder before the first run." },
          "filename": { "type": "string", "required": true, "label": "File name" }
        },
        "capabilities": [
          { "kind": "fs.write", "scope": "chosen-folder",
            "reason": "Saves the result into the folder you pick. It cannot write anywhere else." }
        ],
        "platforms": ["windows", "macos", "linux"]
      }"#,
    )
});

struct FileWrite;

impl CoreComponent for FileWrite {
    fn manifest(&self) -> &ComponentManifest {
        &FILE_WRITE
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<BTreeMap<String, Value>, NodeError> {
        let Some(Value::Text(content)) = ctx.input("content").cloned() else {
            return Err(NodeError::new(
                "missing-input",
                "Nothing is connected to save.",
            ));
        };
        let folder = ctx
            .config_str("folder")
            .ok_or_else(|| NodeError::new("missing-config", "No folder is set on this node."))?
            .to_owned();
        let filename = ctx
            .config_str("filename")
            .ok_or_else(|| NodeError::new("missing-config", "No file name is set on this node."))?
            .to_owned();

        // Staged in the run's scratch space first, then copied out. The broker checks the
        // destination against what the user allowed at the moment of the copy.
        let staged = ctx.create_output(HandleKind::File, &filename)?;
        ctx.write(staged, content.as_bytes())?;
        ctx.save_to(staged, std::path::Path::new(&folder), &filename)?;

        ctx.log(LogLevel::Info, format!("Saved {filename}."));
        Ok(BTreeMap::from([("saved".to_owned(), Value::Bool(true))]))
    }
}

// ---------------------------------------------------------------------------------------
// flow.if
// ---------------------------------------------------------------------------------------

static BRANCH: LazyLock<ComponentManifest> = LazyLock::new(|| {
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

struct Branch;

impl CoreComponent for Branch {
    fn manifest(&self) -> &ComponentManifest {
        &BRANCH
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<BTreeMap<String, Value>, NodeError> {
        let Some(Value::Bool(condition)) = ctx.input("condition").cloned() else {
            return Err(NodeError::new(
                "missing-input",
                "No true/false value is connected to the condition.",
            ));
        };
        let value = ctx.input("value").cloned().unwrap_or(Value::Absent);

        // The branch not taken is *absent*, not empty. Downstream, absence stays absent
        // through every conversion, so an untaken branch cannot quietly become a zero.
        Ok(if condition {
            BTreeMap::from([
                ("then".to_owned(), value),
                ("else".to_owned(), Value::Absent),
            ])
        } else {
            BTreeMap::from([
                ("then".to_owned(), Value::Absent),
                ("else".to_owned(), value),
            ])
        })
    }
}

// ---------------------------------------------------------------------------------------
// system.notify
// ---------------------------------------------------------------------------------------

static NOTIFY: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.system.notify",
        "version": "1.0.0",
        "name": "Notify",
        "description": "Shows a desktop notification.",
        "category": "system",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "message": { "type": "string", "required": true } },
          "outputs": { "shown": { "type": "bool" } }
        },
        "capabilities": [
          { "kind": "system.notify", "scope": "notifications",
            "reason": "Shows a notification when this step runs." }
        ],
        "platforms": ["windows", "macos", "linux"]
      }"#,
    )
});

struct Notify;

impl CoreComponent for Notify {
    fn manifest(&self) -> &ComponentManifest {
        &NOTIFY
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<BTreeMap<String, Value>, NodeError> {
        let Some(Value::Text(message)) = ctx.input("message").cloned() else {
            return Err(NodeError::new("missing-input", "No message is connected."));
        };
        // The permission check happens whether or not a notification is actually drawn, so
        // the journal and the consent dialog agree even before the platform code exists.
        ctx.notify(&message)?;
        ctx.log(LogLevel::Info, "Notification requested.");
        Ok(BTreeMap::from([("shown".to_owned(), Value::Bool(true))]))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use encastra_core::registry::ComponentRegistry;

    #[test]
    fn every_built_in_has_a_valid_manifest_and_an_implementation() {
        let (registry, set) = install();
        assert_eq!(registry.len(), set.manifests().count());
        assert!(registry.len() >= 5);

        for manifest in set.manifests() {
            assert!(
                registry
                    .get(
                        &encastra_core::ComponentRef::parse(&format!(
                            "{}@{}",
                            manifest.id, manifest.version
                        ))
                        .unwrap()
                    )
                    .is_some(),
                "{} has code but is not in the registry",
                manifest.id
            );
        }
    }

    #[test]
    fn every_capability_explains_itself_to_the_person_deciding() {
        let (_, set) = install();
        for manifest in set.manifests() {
            for capability in &manifest.capabilities {
                // Validation already refuses an empty reason. This asks for more: something a
                // person can actually weigh, not the word "required".
                assert!(
                    capability.reason.split_whitespace().count() >= 5,
                    "{}: the reason for {} is too thin to consent to: {:?}",
                    manifest.id,
                    capability.kind,
                    capability.reason
                );
                assert!(
                    capability.reason.ends_with('.'),
                    "{}: reasons are shown as sentences",
                    manifest.id
                );
            }
        }
    }

    #[test]
    fn nothing_first_party_quietly_asks_for_more_than_it_needs() {
        let (_, set) = install();
        let expected: BTreeMap<&str, &[&str]> = BTreeMap::from([
            ("encastra.file.read", &["fs.read"][..]),
            ("encastra.data.json", &[][..]),
            ("encastra.file.write", &["fs.write"][..]),
            ("encastra.flow.if", &[][..]),
            ("encastra.system.notify", &["system.notify"][..]),
        ]);

        for manifest in set.manifests() {
            let declared: Vec<&str> = manifest
                .capabilities
                .iter()
                .map(|c| c.kind.as_str())
                .collect();
            let allowed = expected.get(manifest.id.as_str()).unwrap_or_else(|| {
                panic!("{} is new: add it to this list deliberately", manifest.id)
            });
            assert_eq!(
                declared, *allowed,
                "{} changed which capabilities it asks for",
                manifest.id
            );
        }
    }
}
