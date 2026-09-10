//! Component manifests: parsing, validation, canonical form, and digest.
//!
//! # Why this lives only in Rust
//!
//! The editor does not read manifests. It receives already-validated component metadata from
//! the runtime, because the runtime is what actually loads components and a second validator
//! in TypeScript would be free to disagree with it — the same drift the type-system
//! conformance gate exists to prevent, but on a surface where the consequence is worse: a
//! manifest the editor accepts and the loader rejects, or vice versa.
//!
//! `packages/protocol/schema/component.schema.json` is published so authors' editors can
//! autocomplete, and it says in its own description that it is documentation, not the
//! authority. This module is the authority.
//!
//! # Why JSON and not TOML
//!
//! Signatures are computed over bytes. One on-disk format means there is no conversion step
//! between the thing that was signed and the thing that is executed.
//!
//! # Why manifests contain no floating-point numbers
//!
//! Canonicalisation has exactly one genuinely hard part: agreeing on how to serialise a
//! float. Rather than implement and depend on that agreement, floats are refused. Nothing a
//! manifest needs to express requires one — a resize width is an integer, a quality setting is
//! an integer, a timeout is milliseconds. A component that wants a float takes it as *config
//! from the user at run time*, which is not part of the signed identity.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{is_known_type, parse_type};

/// Where a component's code comes from, which decides how much authority it can ever have.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ComponentKind {
    /// First-party, compiled into the host. Trusted to be correct, not trusted to be
    /// unconstrained — it calls the same capability broker (ADR-0002).
    Core,
    /// A WebAssembly component. Everything that is not first-party. No ambient authority.
    Wasm,
}

/// A capability a component asks for. Declared here, granted by the user, enforced by the
/// broker — never by the component.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Capability {
    /// e.g. `fs.read`, `fs.write`, `net.http`, `system.notify`, `system.clipboard`.
    pub kind: String,
    /// What the capability is limited to. `input-handles` means "only what the graph wired to
    /// my ports" and is the only scope that needs no further user decision.
    pub scope: String,
    /// Shown verbatim to the user in the consent dialog. A capability without a reason a
    /// person can act on is rejected: an unexplained permission request is not consent.
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Port {
    /// A type expression: `image`, `list<file>`, `option<string>`.
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub doc: Option<String>,
}

/// A configuration field the user fills in on the node.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ConfigField {
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub doc: Option<String>,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub min: Option<i64>,
    #[serde(default)]
    pub max: Option<i64>,
    /// Allowed values, for a choice field.
    #[serde(default)]
    pub choices: Option<Vec<String>>,
    #[serde(default)]
    pub default: Option<serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct Ports {
    #[serde(default)]
    pub inputs: BTreeMap<String, Port>,
    #[serde(default)]
    pub outputs: BTreeMap<String, Port>,
}

/// A component manifest.
///
/// `deny_unknown_fields` is deliberate. Silently ignoring an unrecognised key is how a signed
/// manifest and an executed manifest drift apart: a future field that grants something would
/// be dropped by an old host that still reports the component as valid. Refusing is the only
/// safe reading of "I do not understand this".
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ComponentManifest {
    /// Protocol revision. Additive-only; a higher value than this build knows is refused.
    pub schema: u32,
    /// Reverse-DNS, immutable for the life of the component.
    pub id: String,
    /// Semver. Immutable once published — the registry refuses different bytes under the
    /// same `id@version`.
    pub version: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub license: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    /// Host versions this component is known to work on, as a semver range.
    pub runtime: String,
    pub kind: ComponentKind,
    #[serde(default)]
    pub ports: Ports,
    #[serde(default)]
    pub config: BTreeMap<String, ConfigField>,
    #[serde(default)]
    pub capabilities: Vec<Capability>,
    #[serde(default)]
    pub platforms: Vec<String>,
    /// Whether a failed run of this component is safe to retry automatically. Defaults to
    /// false: retrying something that is not idempotent is worse than failing once.
    #[serde(default)]
    pub retryable: bool,
    #[serde(default)]
    pub documentation: Option<String>,
    #[serde(default)]
    pub changelog: Option<String>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ManifestError {
    #[error("this build implements protocol schema {ours}, but the manifest declares {theirs}")]
    UnsupportedSchema { ours: u32, theirs: u32 },
    #[error("{0}")]
    Invalid(String),
    #[error("manifest is not valid JSON: {0}")]
    Malformed(String),
}

/// A capability scope that needs no further user decision, because it grants nothing beyond
/// what the graph already wired to the component's ports.
pub const SCOPE_INPUT_HANDLES: &str = "input-handles";

const KNOWN_CAPABILITIES: &[&str] = &[
    "fs.read",
    "fs.write",
    "net.http",
    "system.notify",
    "system.clipboard",
];

const KNOWN_PLATFORMS: &[&str] = &["windows", "macos", "linux"];

impl ComponentManifest {
    /// Parse and fully validate. There is no "parse but do not check" entry point: a manifest
    /// that exists as a value in this program has been validated.
    pub fn parse(json: &str) -> Result<Self, ManifestError> {
        let value: serde_json::Value =
            serde_json::from_str(json).map_err(|e| ManifestError::Malformed(e.to_string()))?;
        // Enforced here rather than assumed: a float could otherwise reach the canonical form
        // through a config `default`, and then two hosts could disagree about the bytes being
        // signed. The restriction is only real if something checks it.
        reject_non_integer_numbers(&value, "manifest")?;
        let manifest: ComponentManifest =
            serde_json::from_value(value).map_err(|e| ManifestError::Malformed(e.to_string()))?;
        manifest.validate()?;
        Ok(manifest)
    }

    fn validate(&self) -> Result<(), ManifestError> {
        if self.schema != crate::SCHEMA_VERSION {
            return Err(ManifestError::UnsupportedSchema {
                ours: crate::SCHEMA_VERSION,
                theirs: self.schema,
            });
        }

        validate_id(&self.id)?;

        semver::Version::parse(&self.version).map_err(|e| {
            ManifestError::Invalid(format!("version \"{}\" is not semver: {e}", self.version))
        })?;
        semver::VersionReq::parse(&self.runtime).map_err(|e| {
            ManifestError::Invalid(format!(
                "runtime \"{}\" is not a semver range: {e}",
                self.runtime
            ))
        })?;

        if self.name.trim().is_empty() {
            return Err(ManifestError::Invalid("name is empty".into()));
        }

        for (side, ports) in [
            ("input", &self.ports.inputs),
            ("output", &self.ports.outputs),
        ] {
            for (port_name, port) in ports {
                validate_port_name(side, port_name)?;
                validate_type_expr(&format!("{side} port \"{port_name}\""), &port.type_)?;
            }
        }

        if self.ports.outputs.is_empty() && self.ports.inputs.is_empty() {
            return Err(ManifestError::Invalid(
                "a component with no ports can neither receive nor produce anything".into(),
            ));
        }

        for (field_name, field) in &self.config {
            validate_type_expr(&format!("config field \"{field_name}\""), &field.type_)?;
            if let (Some(min), Some(max)) = (field.min, field.max)
                && min > max
            {
                return Err(ManifestError::Invalid(format!(
                    "config field \"{field_name}\" has min {min} above max {max}"
                )));
            }
            if let Some(choices) = &field.choices
                && choices.is_empty()
            {
                return Err(ManifestError::Invalid(format!(
                    "config field \"{field_name}\" declares an empty choice list, so no value is valid"
                )));
            }
        }

        let mut seen_capabilities = std::collections::BTreeSet::new();
        for capability in &self.capabilities {
            if !KNOWN_CAPABILITIES.contains(&capability.kind.as_str()) {
                return Err(ManifestError::Invalid(format!(
                    "unknown capability \"{}\". A capability this build cannot enforce must not be granted.",
                    capability.kind
                )));
            }
            if capability.reason.trim().is_empty() {
                return Err(ManifestError::Invalid(format!(
                    "capability \"{}\" has no reason. The reason is what the user is shown when deciding; without it there is nothing to consent to.",
                    capability.kind
                )));
            }
            if capability.scope.trim().is_empty() {
                return Err(ManifestError::Invalid(format!(
                    "capability \"{}\" has no scope. An unscoped capability is an unbounded one.",
                    capability.kind
                )));
            }
            if !seen_capabilities.insert((&capability.kind, &capability.scope)) {
                return Err(ManifestError::Invalid(format!(
                    "capability \"{}\" is declared twice with the same scope, so one of the two reasons shown to the user would be a lie",
                    capability.kind
                )));
            }
        }

        for platform in &self.platforms {
            if !KNOWN_PLATFORMS.contains(&platform.as_str()) {
                return Err(ManifestError::Invalid(format!(
                    "unknown platform \"{platform}\"; expected one of {KNOWN_PLATFORMS:?}"
                )));
            }
        }

        Ok(())
    }

    /// The exact bytes that are hashed and signed.
    ///
    /// `serde_json` with `BTreeMap` fields gives sorted keys and compact separators, and
    /// floats are refused at parse time, so this is stable across platforms and versions
    /// without a full RFC 8785 implementation.
    pub fn canonical_json(&self) -> String {
        serde_json::to_string(self).expect("a validated manifest always serialises")
    }

    /// `sha256(canonical_json)`, lower-case hex. Half of what a publisher signs; the other
    /// half is the artifact hash (ADR-0008).
    pub fn digest(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(self.canonical_json().as_bytes());
        hex(&hasher.finalize())
    }

    /// Does this component need a decision from the user before it may run?
    ///
    /// `input-handles` scopes grant nothing beyond what the graph already wired to the ports,
    /// so they are not worth a dialog. Everything else is.
    pub fn requires_consent(&self) -> bool {
        self.capabilities
            .iter()
            .any(|c| c.scope != SCOPE_INPUT_HANDLES)
    }
}

fn hex(bytes: &[u8]) -> String {
    use std::fmt::Write as _;
    bytes
        .iter()
        .fold(String::with_capacity(bytes.len() * 2), |mut acc, b| {
            let _ = write!(acc, "{b:02x}");
            acc
        })
}

/// Refuses any number that is not an integer, anywhere in the document.
///
/// Canonicalisation has exactly one genuinely hard part — agreeing on how to serialise a
/// float. Refusing floats removes it, and this is what makes the refusal true rather than
/// aspirational.
fn reject_non_integer_numbers(value: &serde_json::Value, path: &str) -> Result<(), ManifestError> {
    match value {
        serde_json::Value::Number(n) => {
            if n.is_i64() || n.is_u64() {
                Ok(())
            } else {
                Err(ManifestError::Invalid(format!(
                    "{path} contains the non-integer number {n}. Manifests hold integers only, so that the bytes that get signed are the same everywhere."
                )))
            }
        }
        serde_json::Value::Array(items) => items
            .iter()
            .enumerate()
            .try_for_each(|(i, v)| reject_non_integer_numbers(v, &format!("{path}[{i}]"))),
        serde_json::Value::Object(fields) => fields
            .iter()
            .try_for_each(|(k, v)| reject_non_integer_numbers(v, &format!("{path}.{k}"))),
        _ => Ok(()),
    }
}

fn validate_id(id: &str) -> Result<(), ManifestError> {
    if id.is_empty() || id.len() > 128 {
        return Err(ManifestError::Invalid(
            "id must be between 1 and 128 characters".into(),
        ));
    }
    let segments: Vec<&str> = id.split('.').collect();
    if segments.len() < 2 {
        return Err(ManifestError::Invalid(format!(
            "id \"{id}\" needs at least a publisher and a name, e.g. \"encastra.image.resize\""
        )));
    }
    for segment in segments {
        if segment.is_empty() {
            return Err(ManifestError::Invalid(format!(
                "id \"{id}\" has an empty segment"
            )));
        }
        if !segment
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_lowercase())
        {
            return Err(ManifestError::Invalid(format!(
                "id segment \"{segment}\" must start with a lower-case letter"
            )));
        }
        if !segment
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        {
            return Err(ManifestError::Invalid(format!(
                "id segment \"{segment}\" may contain only lower-case letters, digits and hyphens"
            )));
        }
    }
    Ok(())
}

fn validate_port_name(side: &str, name: &str) -> Result<(), ManifestError> {
    if name.is_empty() {
        return Err(ManifestError::Invalid(format!(
            "an {side} port has no name"
        )));
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    {
        return Err(ManifestError::Invalid(format!(
            "{side} port \"{name}\" may contain only lower-case letters, digits and underscores"
        )));
    }
    Ok(())
}

fn validate_type_expr(what: &str, expr: &str) -> Result<(), ManifestError> {
    let parsed = parse_type(expr)
        .map_err(|e| ManifestError::Invalid(format!("{what} has an unparseable type: {e}")))?;
    for name in named_types(&parsed) {
        if !is_known_type(&name) {
            return Err(ManifestError::Invalid(format!(
                "{what} uses type \"{name}\", which this runtime does not know"
            )));
        }
    }
    Ok(())
}

fn named_types(expr: &crate::TypeExpr) -> Vec<String> {
    match expr {
        crate::TypeExpr::Named(n) => vec![n.clone()],
        crate::TypeExpr::List(i) | crate::TypeExpr::Opt(i) => named_types(i),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_json() -> String {
        serde_json::json!({
            "schema": 1,
            "id": "encastra.image.resize",
            "version": "1.0.0",
            "name": "Image Resize",
            "runtime": ">=0.1.0",
            "kind": "core",
            "ports": {
                "inputs":  { "image": { "type": "image", "required": true } },
                "outputs": { "image": { "type": "image" } }
            },
            "config": { "width": { "type": "i64", "min": 1, "max": 20000 } },
            "capabilities": [
                { "kind": "fs.read", "scope": "input-handles",
                  "reason": "Reads the image you connect to this node." }
            ],
            "platforms": ["windows", "macos", "linux"]
        })
        .to_string()
    }

    fn reject(mutate: impl FnOnce(&mut serde_json::Value)) -> ManifestError {
        let mut v: serde_json::Value = serde_json::from_str(&valid_json()).unwrap();
        mutate(&mut v);
        ComponentManifest::parse(&v.to_string())
            .expect_err("this manifest should have been rejected")
    }

    #[test]
    fn accepts_a_well_formed_manifest() {
        let m = ComponentManifest::parse(&valid_json()).expect("should be valid");
        assert_eq!(m.id, "encastra.image.resize");
        assert_eq!(m.kind, ComponentKind::Core);
        // Only input-handle scopes, so nothing to ask the user about.
        assert!(!m.requires_consent());
    }

    #[test]
    fn refuses_a_schema_it_does_not_implement() {
        let e = reject(|v| v["schema"] = serde_json::json!(999));
        assert!(matches!(e, ManifestError::UnsupportedSchema { .. }));
    }

    #[test]
    fn refuses_unknown_fields_rather_than_ignoring_them() {
        // The dangerous case: a future field that grants something, dropped by an old host
        // that still calls the manifest valid.
        let e = reject(|v| v["grants_everything"] = serde_json::json!(true));
        assert!(matches!(e, ManifestError::Malformed(_)), "got {e:?}");
    }

    #[test]
    fn refuses_a_capability_with_no_reason() {
        let e = reject(|v| v["capabilities"][0]["reason"] = serde_json::json!("   "));
        assert!(e.to_string().contains("consent"), "got {e}");
    }

    #[test]
    fn refuses_a_capability_this_build_cannot_enforce() {
        let e = reject(|v| v["capabilities"][0]["kind"] = serde_json::json!("process.spawn"));
        assert!(e.to_string().contains("cannot enforce"), "got {e}");
    }

    #[test]
    fn refuses_a_duplicate_capability_scope() {
        let e = reject(|v| {
            let dup = v["capabilities"][0].clone();
            v["capabilities"].as_array_mut().unwrap().push(dup);
        });
        assert!(e.to_string().contains("twice"), "got {e}");
    }

    #[test]
    fn refuses_a_port_type_the_runtime_does_not_know() {
        let e = reject(|v| v["ports"]["inputs"]["image"]["type"] = serde_json::json!("hologram"));
        assert!(e.to_string().contains("does not know"), "got {e}");
    }

    #[test]
    fn refuses_malformed_ids_versions_and_ranges() {
        assert!(
            reject(|v| v["id"] = serde_json::json!("resize"))
                .to_string()
                .contains("publisher")
        );
        assert!(
            reject(|v| v["id"] = serde_json::json!("Encastra.Image"))
                .to_string()
                .contains("lower-case")
        );
        assert!(
            reject(|v| v["id"] = serde_json::json!("encastra..resize"))
                .to_string()
                .contains("empty segment")
        );
        assert!(
            reject(|v| v["version"] = serde_json::json!("1.0"))
                .to_string()
                .contains("semver")
        );
        assert!(
            reject(|v| v["runtime"] = serde_json::json!("newest"))
                .to_string()
                .contains("range")
        );
    }

    #[test]
    fn refuses_an_inverted_config_range() {
        let e = reject(|v| v["config"]["width"]["min"] = serde_json::json!(99999));
        assert!(e.to_string().contains("above max"), "got {e}");
    }

    #[test]
    fn refuses_a_component_with_no_ports() {
        let e = reject(|v| v["ports"] = serde_json::json!({}));
        assert!(
            e.to_string().contains("neither receive nor produce"),
            "got {e}"
        );
    }

    #[test]
    fn a_scope_beyond_input_handles_requires_consent() {
        let mut v: serde_json::Value = serde_json::from_str(&valid_json()).unwrap();
        v["capabilities"][0]["kind"] = serde_json::json!("net.http");
        v["capabilities"][0]["scope"] = serde_json::json!("any-host");
        let m = ComponentManifest::parse(&v.to_string()).unwrap();
        assert!(m.requires_consent());
    }

    #[test]
    fn refuses_a_float_anywhere_in_the_document() {
        let e = reject(|v| v["config"]["width"]["default"] = serde_json::json!(1.5));
        assert!(e.to_string().contains("non-integer"), "got {e}");

        let e = reject(|v| v["config"]["width"]["default"] = serde_json::json!([1, 2.5]));
        assert!(e.to_string().contains("non-integer"), "got {e}");

        // Integers still pass, including inside a nested default.
        let mut v: serde_json::Value = serde_json::from_str(&valid_json()).unwrap();
        v["config"]["width"]["default"] = serde_json::json!({ "nested": [1, 2, 3] });
        assert!(ComponentManifest::parse(&v.to_string()).is_ok());
    }

    #[test]
    fn the_digest_is_stable_and_content_dependent() {
        let a = ComponentManifest::parse(&valid_json()).unwrap();
        let b = ComponentManifest::parse(&valid_json()).unwrap();
        assert_eq!(a.digest(), b.digest());
        assert_eq!(a.digest().len(), 64);

        // Key order in the source must not change what gets signed.
        let mut reordered: serde_json::Value = serde_json::from_str(&valid_json()).unwrap();
        let obj = reordered.as_object_mut().unwrap();
        let name = obj.remove("name").unwrap();
        obj.insert("name".into(), name); // moved to the end
        let c = ComponentManifest::parse(&reordered.to_string()).unwrap();
        assert_eq!(
            a.digest(),
            c.digest(),
            "canonical form must not depend on key order"
        );

        let mut changed: serde_json::Value = serde_json::from_str(&valid_json()).unwrap();
        changed["version"] = serde_json::json!("1.0.1");
        let d = ComponentManifest::parse(&changed.to_string()).unwrap();
        assert_ne!(a.digest(), d.digest());
    }
}
