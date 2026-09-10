//! Resolving a component reference to the thing that can answer for it.

use std::collections::BTreeMap;

use encastra_protocol::manifest::ComponentManifest;

use crate::graph::ComponentRef;

/// Whatever can tell the runtime about a component.
///
/// Lookup is by **exact** `id@version`. There is no resolution step, because resolution is a
/// project-format concern that happens once, when a lockfile is written — not something that
/// can produce a different answer each time a graph runs.
pub trait ComponentRegistry {
    fn get(&self, reference: &ComponentRef) -> Option<&ComponentManifest>;

    /// Every component this registry can supply, for the editor's palette.
    fn list(&self) -> Vec<&ComponentManifest>;
}

/// A registry built from manifests already in memory. Used for the shipped core set and by
/// tests.
#[derive(Debug, Default)]
pub struct InMemoryRegistry {
    by_ref: BTreeMap<String, ComponentManifest>,
}

impl InMemoryRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns an error rather than overwriting: two components claiming the same
    /// `id@version` is a packaging bug, and silently keeping the last one loaded would make
    /// which code runs depend on directory iteration order.
    pub fn insert(&mut self, manifest: ComponentManifest) -> Result<(), String> {
        let key = format!("{}@{}", manifest.id, manifest.version);
        if self.by_ref.contains_key(&key) {
            return Err(format!("{key} is registered twice"));
        }
        self.by_ref.insert(key, manifest);
        Ok(())
    }

    pub fn len(&self) -> usize {
        self.by_ref.len()
    }

    pub fn is_empty(&self) -> bool {
        self.by_ref.is_empty()
    }
}

impl ComponentRegistry for InMemoryRegistry {
    fn get(&self, reference: &ComponentRef) -> Option<&ComponentManifest> {
        self.by_ref.get(&reference.to_string())
    }

    fn list(&self) -> Vec<&ComponentManifest> {
        self.by_ref.values().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manifest(id: &str, version: &str) -> ComponentManifest {
        ComponentManifest::parse(
            &serde_json::json!({
                "schema": 1, "id": id, "version": version, "name": "Test",
                "runtime": ">=0.1.0", "kind": "core",
                "ports": { "outputs": { "out": { "type": "string" } } }
            })
            .to_string(),
        )
        .expect("fixture manifest must be valid")
    }

    #[test]
    fn resolves_only_the_exact_version_asked_for() {
        let mut r = InMemoryRegistry::new();
        r.insert(manifest("test.thing", "1.0.0")).unwrap();
        r.insert(manifest("test.thing", "1.1.0")).unwrap();

        assert!(
            r.get(&ComponentRef::parse("test.thing@1.0.0").unwrap())
                .is_some()
        );
        assert!(
            r.get(&ComponentRef::parse("test.thing@1.1.0").unwrap())
                .is_some()
        );
        // Not "close enough". A pinned graph gets what it pinned or nothing.
        assert!(
            r.get(&ComponentRef::parse("test.thing@1.0.1").unwrap())
                .is_none()
        );
    }

    #[test]
    fn refuses_a_duplicate_rather_than_letting_load_order_decide() {
        let mut r = InMemoryRegistry::new();
        r.insert(manifest("test.thing", "1.0.0")).unwrap();
        assert!(r.insert(manifest("test.thing", "1.0.0")).is_err());
    }
}
