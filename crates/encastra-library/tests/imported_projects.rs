//! What the index records about a publication that was actually taken in.
//!
//! The unit tests in the crate cover the index on its own, with entries made by hand. This one
//! runs the real thing end to end — prepare a publication, import it, record it — because the
//! interesting failures live in the seam: an entry that says "imported" about a path that is not
//! inside `imports/`, or a capability list copied from a document nobody checked.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use encastra_core::ComponentRef;
use encastra_core::graph::{Graph, Node, NodeId, Position};
use encastra_core::registry::InMemoryRegistry;
use encastra_library::{Origin, Status, entry_for_import, remove_imported_copy, status};
use encastra_project::{LockedComponent, Lockfile, Project};
use encastra_protocol::manifest::ComponentManifest;
use encastra_publish::{
    Kind, License, Pricing, PublicationBundle, PublicationDraft, Publisher, import,
};

const RUNTIME: &str = "0.4.0";
const PROJECT_FILE: &str = "thumbnails.encastra";

struct Sandbox(PathBuf);

impl Sandbox {
    fn new(name: &str) -> Self {
        let path = std::env::temp_dir()
            .join("encastra-library-imports")
            .join(format!("{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(&path).expect("the sandbox can be created");
        Sandbox(path)
    }
    fn dir(&self, name: &str) -> PathBuf {
        let path = self.0.join(name);
        std::fs::create_dir_all(&path).expect("created");
        path
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn manifest() -> ComponentManifest {
    ComponentManifest::parse(
        &serde_json::json!({
            "schema": 1,
            "id": "encastra.net.request",
            "version": "1.0.0",
            "name": "Fetch",
            "runtime": ">=0.1.0",
            "kind": "core",
            "license": "MIT",
            "ports": { "inputs": {}, "outputs": { "text": { "type": "string", "required": true } } },
            "config": {},
            "capabilities": [
                { "kind": "net.http", "scope": "allowed-hosts", "reason": "Fetches the address you configure." }
            ],
            "platforms": ["windows", "macos", "linux"]
        })
        .to_string(),
    )
    .expect("a manifest the runtime accepts")
}

fn project() -> Project {
    let mut project = Project::new("Thumbnails", 1_000);
    project.manifest.runtime = ">=0.4.0".into();
    project.manifest.description = Some("Makes a small copy of every picture.".into());

    let mut nodes = BTreeMap::new();
    nodes.insert(
        NodeId("fetch".into()),
        Node {
            component: ComponentRef {
                id: "encastra.net.request".into(),
                version: "1.0.0".into(),
            },
            label: None,
            config: BTreeMap::new(),
            position: Position::default(),
            disabled: false,
        },
    );
    project.graph = Graph {
        nodes,
        edges: Vec::new(),
    };

    let manifest = manifest();
    project.lock = Lockfile {
        components: vec![LockedComponent {
            id: manifest.id.clone(),
            version: manifest.version.clone(),
            manifest_digest: manifest.digest(),
            origin: "builtin".into(),
        }],
    };
    project
}

/// A publication folder, laid out the way the desktop's `prepare_publication` writes one.
fn publication(folder: &Path, registry: &InMemoryRegistry) -> Project {
    let project = project();
    let bytes = project.to_bytes().expect("serialises");
    let draft = PublicationDraft {
        listing_id: "dev.alice.thumbnails".into(),
        kind: Kind::Project,
        version: "1.2.0".into(),
        title: "Thumbnails".into(),
        summary: "Makes a small copy of every picture dropped in a folder.".into(),
        categories: vec!["images".into()],
        tags: Vec::new(),
        license: License::Mit,
        pricing: Pricing::Free,
        changelog: None,
    };
    let publisher = Publisher {
        id: "dev.alice".into(),
        display_name: "Alice".into(),
        bio: None,
        verified: false,
    };
    let review = encastra_publish::review(&project, registry, &draft.license);
    let bundle = PublicationBundle::prepare(
        draft,
        &publisher,
        &bytes,
        &project.manifest.runtime,
        &review,
        1_700_000_000_000,
    )
    .expect("the fixture prepares");

    std::fs::write(
        folder.join("publication.json"),
        serde_json::to_vec_pretty(&bundle).expect("serialises"),
    )
    .expect("written");
    std::fs::write(folder.join(PROJECT_FILE), &bytes).expect("written");
    project
}

#[test]
fn an_imported_publication_is_recorded_as_what_it_is_and_can_be_taken_back_out() {
    let sandbox = Sandbox::new("round-trip");
    let mut registry = InMemoryRegistry::default();
    registry.insert(manifest()).expect("registered once");

    let folder = sandbox.dir("publication");
    publication(&folder, &registry);
    let library_root = sandbox.dir("library");

    let imported = import(&folder, &registry, RUNTIME, &library_root).expect("this one is fine");
    let entry = entry_for_import(&imported, 5_000);

    assert_eq!(entry.origin, Origin::Imported);
    assert_eq!(entry.name, "Thumbnails");
    assert_eq!(
        entry.description.as_deref(),
        Some("Makes a small copy of every picture.")
    );
    assert_eq!(entry.listing_id.as_deref(), Some("dev.alice.thumbnails"));
    assert_eq!(entry.version.as_deref(), Some("1.2.0"));
    assert_eq!(entry.publisher.as_deref(), Some("dev.alice"));
    assert_eq!(entry.steps, 1);
    assert_eq!(entry.runtime, ">=0.4.0");
    assert_eq!(entry.added_at_ms, 5_000);
    assert_eq!(entry.last_opened_ms, None);
    // Taken from the document only because importing refused unless that list was exactly the
    // one the check produced from the components themselves.
    assert_eq!(entry.capabilities, vec!["net.http".to_string()]);
    assert_eq!(entry.id.len(), 16);

    // The path it records is the copy, not the folder somebody was sent — that folder is theirs
    // and may be anywhere, including a memory stick that is about to be unplugged.
    assert_eq!(entry.path, imported.project_path.to_string_lossy());
    assert_eq!(status(&entry), Status::Present);

    // And because it really is inside `imports/`, this is the one kind of thing that may be
    // removed. The whole version folder goes, not just the file.
    remove_imported_copy(&library_root, &entry).expect("this one is ours");
    assert!(!imported.folder.exists());
    assert_eq!(status(&entry), Status::Missing);

    // The source the person was sent is untouched: importing copies, and removing the copy is
    // not removing the original.
    assert!(folder.join(PROJECT_FILE).exists());
}

#[test]
fn the_same_publication_taken_in_again_is_the_same_entry() {
    let sandbox = Sandbox::new("identity");
    let mut registry = InMemoryRegistry::default();
    registry.insert(manifest()).expect("registered once");

    let first = sandbox.dir("publication");
    publication(&first, &registry);
    // The same publication, delivered a second time into a different folder — an email, then a
    // memory stick. It is one thing, so it has to be one entry.
    let second = sandbox.dir("publication-again");
    publication(&second, &registry);

    let one =
        import(&first, &registry, RUNTIME, &sandbox.dir("library-one")).expect("the first lands");
    let two =
        import(&second, &registry, RUNTIME, &sandbox.dir("library-two")).expect("the second lands");

    assert_ne!(one.project_path, two.project_path, "different libraries");
    assert_eq!(
        entry_for_import(&one, 1).id,
        entry_for_import(&two, 2).id,
        "the listing and version are what it is; where it was put is not"
    );
}
