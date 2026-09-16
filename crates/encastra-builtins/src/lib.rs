//! The first-party component set.
//!
//! These are Tier A (ADR-0002): compiled into the host, fast, able to use native crates — and
//! still holding no more authority than their manifests declare, because they reach the OS
//! through the same broker every sandboxed component uses. A component here that forgets to
//! declare `fs.read` cannot read a file, and the test suite proves it.
//!
//! The set is deliberately small. It is part of the trust base, and every component added to it
//! is code that a bug would make dangerous.
//!
//! # What is deliberately absent
//!
//! - **Launch Application.** Process execution has the worst blast radius of any capability and
//!   there is no `process.*` capability in this build — not denied, absent. It is not going in
//!   the set that establishes how permission dialogs read.
//! - **Video Information.** Reading a container's metadata honestly needs a parser this build
//!   does not have, and shelling out to `ffprobe` would need the capability above. A component
//!   that returned guesses would be worse than no component.
//! - **Webhook.** Receiving a request means listening on a port, which is a different security
//!   question from making one. It belongs with the trigger work, not here.

use std::collections::BTreeMap;
use std::sync::Arc;

use encastra_core::journal::{NodeError, NodeErrorCode};
use encastra_core::registry::InMemoryRegistry;
use encastra_core::runner::{CoreComponent, CoreComponentSet, NodeContext};
use encastra_core::session::TriggerSet;
use encastra_core::value::{Handle, Value};
use encastra_protocol::manifest::ComponentManifest;

mod data;
mod files;
mod flow;
mod media;
mod net;
mod system;
mod triggers;

/// How this build reads an address when deciding what a `net.http` grant covers.
///
/// Re-exported on its own, rather than making `net` public, because exactly one thing outside
/// this crate needs it: the conformance test that replays a shared table of addresses through
/// both this parser and the editor's (`apps/desktop/src/url.ts`). The two must agree, and until
/// that test existed nothing checked that they did.
pub use net::permission_authority;

/// The ceilings the CSV reader applies, for the test that drives it end to end.
pub use data::{MAX_CSV_CELLS, MAX_CSV_ROWS};

/// Everything this build offers: the manifests, the code behind them, and the triggers.
pub struct Installed {
    pub registry: InMemoryRegistry,
    pub components: CoreComponentSet,
    pub triggers: TriggerSet,
}

/// Builds the registry and the implementations together, so a manifest can never ship without
/// code or code without a manifest.
pub fn install() -> (InMemoryRegistry, CoreComponentSet) {
    let installed = install_all();
    (installed.registry, installed.components)
}

pub fn install_all() -> Installed {
    let components: Vec<Arc<dyn CoreComponent>> = vec![
        files::read(),
        files::write(),
        files::save(),
        files::move_file(),
        files::rename(),
        media::resize(),
        media::convert(),
        media::thumbnail(),
        media::info(),
        data::parse_json(),
        data::write_json(),
        data::read_csv(),
        data::write_csv(),
        flow::branch(),
        flow::switch(),
        flow::delay(),
        system::notify(),
        system::clipboard(),
        net::http(),
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

    // Triggers have manifests too, so the editor lists them beside everything else — but no
    // implementation in the component set, because they do not run as a step.
    let mut trigger_set = TriggerSet::new();
    for (manifest, factory) in [
        (
            &*triggers::WATCH,
            triggers::watcher as encastra_core::session::TriggerFactory,
        ),
        (
            &*triggers::TIMER,
            triggers::timer as encastra_core::session::TriggerFactory,
        ),
    ] {
        let reference = format!("{}@{}", manifest.id, manifest.version);
        registry
            .insert(manifest.clone())
            .expect("a first-party trigger is registered twice");
        trigger_set.insert(&reference, factory);
    }

    Installed {
        registry,
        components: set,
        triggers: trigger_set,
    }
}

/// Parses through the real validator, so first-party manifests are held to exactly the rules
/// third-party ones are. A typo here fails at start-up rather than at run time.
pub(crate) fn manifest(json: &str) -> ComponentManifest {
    ComponentManifest::parse(json).unwrap_or_else(|e| panic!("built-in manifest is invalid: {e}"))
}

pub(crate) type Outputs = BTreeMap<String, Value>;

pub(crate) fn one(port: &str, value: Value) -> Outputs {
    BTreeMap::from([(port.to_owned(), value)])
}

// -- reading inputs -------------------------------------------------------------------------
//
// A component asking for an input it declared as required and not finding one is a runtime
// invariant failure, not a user error — validation should have caught it. These helpers make
// that distinction visible instead of every component writing its own `else` branch.

pub(crate) fn handle_input(ctx: &NodeContext<'_>, port: &str) -> Result<Handle, NodeError> {
    match ctx.input(port) {
        Some(Value::Handle(h)) => Ok(*h),
        Some(Value::Absent) | None => Err(missing(port)),
        Some(other) => Err(wrong_kind(port, "a file", other)),
    }
}

pub(crate) fn text_input(ctx: &NodeContext<'_>, port: &str) -> Result<String, NodeError> {
    match ctx.input(port) {
        Some(Value::Text(t)) => Ok(t.clone()),
        Some(Value::Absent) | None => Err(missing(port)),
        Some(other) => Err(wrong_kind(port, "text", other)),
    }
}

pub(crate) fn bool_input(ctx: &NodeContext<'_>, port: &str) -> Result<bool, NodeError> {
    match ctx.input(port) {
        Some(Value::Bool(b)) => Ok(*b),
        Some(Value::Absent) | None => Err(missing(port)),
        Some(other) => Err(wrong_kind(port, "a true/false value", other)),
    }
}

pub(crate) fn json_input(
    ctx: &NodeContext<'_>,
    port: &str,
) -> Result<serde_json::Value, NodeError> {
    match ctx.input(port) {
        Some(Value::Json(j)) => Ok(j.clone()),
        Some(Value::Absent) | None => Err(missing(port)),
        Some(other) => Err(wrong_kind(port, "structured data", other)),
    }
}

fn missing(port: &str) -> NodeError {
    NodeError::new(
        NodeErrorCode::MissingInput,
        format!("Nothing is connected to \"{port}\"."),
    )
}

fn wrong_kind(port: &str, expected: &str, got: &Value) -> NodeError {
    NodeError::new(
        NodeErrorCode::WrongInput,
        format!(
            "\"{port}\" expected {expected} but received {}.",
            got.summary()
        ),
    )
}

pub(crate) fn required_config(ctx: &NodeContext<'_>, key: &str) -> Result<String, NodeError> {
    ctx.config_str(key)
        .filter(|s| !s.trim().is_empty())
        .map(str::to_owned)
        .ok_or_else(|| {
            NodeError::new(
                NodeErrorCode::MissingConfig,
                format!("\"{key}\" is not set on this node."),
            )
        })
}

/// Splits `photo.png` into `("photo", "png")`.
pub(crate) fn split_name(name: &str) -> (String, String) {
    match name.rsplit_once('.') {
        Some((stem, extension)) if !stem.is_empty() => (stem.to_owned(), extension.to_owned()),
        _ => (name.to_owned(), String::new()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use encastra_core::registry::ComponentRegistry;

    #[test]
    fn every_built_in_has_a_valid_manifest_and_an_implementation() {
        let installed = install_all();
        let registry = &installed.registry;
        assert!(
            registry.len() >= 15,
            "the beta promises 15 or more: {}",
            registry.len()
        );

        // Every manifest is either a step with code or a trigger with a factory. Neither may
        // appear in the palette without something behind it.
        for manifest in registry.list() {
            let reference = format!("{}@{}", manifest.id, manifest.version);
            let runnable = installed.components.get(&reference).is_some();
            let startable = installed.triggers.build(&reference).is_some();
            assert!(
                runnable != startable,
                "{} is {}",
                manifest.id,
                if runnable {
                    "both a step and a trigger"
                } else {
                    "in the palette with nothing behind it"
                }
            );
            assert_eq!(
                manifest.trigger, startable,
                "{} disagrees about being a trigger",
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
                // person can weigh, not the word "required".
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

    /// The list is written out deliberately so that widening a component's reach is a visible
    /// change to this file rather than a line buried in a manifest.
    #[test]
    fn nothing_first_party_quietly_asks_for_more_than_it_needs() {
        let expected: BTreeMap<&str, &[&str]> = BTreeMap::from([
            ("encastra.file.read", &["fs.read"][..]),
            ("encastra.file.write", &["fs.write"][..]),
            ("encastra.file.save", &["fs.write"][..]),
            ("encastra.file.move", &["fs.write"][..]),
            ("encastra.file.rename", &["fs.write"][..]),
            ("encastra.image.resize", &["fs.read"][..]),
            ("encastra.image.convert", &["fs.read"][..]),
            ("encastra.image.thumbnail", &["fs.read"][..]),
            ("encastra.image.info", &["fs.read"][..]),
            ("encastra.data.json", &[][..]),
            ("encastra.data.json.write", &[][..]),
            ("encastra.data.csv.read", &[][..]),
            ("encastra.data.csv.write", &[][..]),
            ("encastra.flow.if", &[][..]),
            ("encastra.flow.switch", &[][..]),
            ("encastra.flow.delay", &[][..]),
            ("encastra.system.notify", &["system.notify"][..]),
            ("encastra.system.clipboard", &["system.clipboard"][..]),
            ("encastra.net.http", &["net.http"][..]),
            ("encastra.file.watch", &["fs.read"][..]),
            ("encastra.system.timer", &[][..]),
        ]);

        for manifest in install_all().registry.list() {
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
        assert_eq!(
            expected.len(),
            install_all().registry.len(),
            "the list is stale"
        );
    }

    #[test]
    fn no_component_asks_for_a_capability_this_build_cannot_enforce() {
        // Process execution has no capability at all here. If one ever appears in a manifest,
        // this fails before it can reach a permission dialog.
        let (_, set) = install();
        for manifest in set.manifests() {
            for capability in &manifest.capabilities {
                assert!(
                    !capability.kind.starts_with("process"),
                    "{} asks for {}",
                    manifest.id,
                    capability.kind
                );
            }
        }
    }

    #[test]
    fn splitting_a_filename_handles_the_awkward_cases() {
        assert_eq!(split_name("photo.png"), ("photo".into(), "png".into()));
        assert_eq!(
            split_name("archive.tar.gz"),
            ("archive.tar".into(), "gz".into())
        );
        assert_eq!(split_name("README"), ("README".into(), String::new()));
        assert_eq!(
            split_name(".gitignore"),
            (".gitignore".into(), String::new())
        );
    }
}
