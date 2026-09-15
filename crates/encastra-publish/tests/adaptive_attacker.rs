//! An attacker who changes strategy after each refusal.
//!
//! The other suite in this directory asks one question per test. This one asks the question an
//! automated attacker asks: *given a library that already holds one honest publication, what
//! sequence of folders gets a byte written anywhere I choose, a permission hidden, or the honest
//! copy replaced?* Each attempt is a mutation of a well-formed publication, each is tried in turn,
//! and after **every** attempt the whole library is compared, file by file and byte by byte,
//! against what the honest import left. The property under test is not that each attempt is
//! refused — that is the other suite — but that the boundary is the same boundary after twenty
//! attempts as after none, with nothing accumulated in between.
//!
//! What this does not prove: that no strategy exists. It proves that these do not work, that
//! failing does not weaken the next check, and that a refusal leaves no trace. A strategy that
//! should be here and is not is a test somebody should add, not a gap this file hides.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use encastra_core::ComponentRef;
use encastra_core::graph::{Graph, Node, NodeId, Position};
use encastra_core::registry::InMemoryRegistry;
use encastra_project::{LockedComponent, Lockfile, Project};
use encastra_protocol::manifest::ComponentManifest;
use encastra_publish::import::import;
use encastra_publish::{Kind, License, Pricing, PublicationBundle, PublicationDraft, Publisher};
use serde_json::{Value, json};

const RUNTIME: &str = "0.4.0";
const PROJECT_FILE: &str = "thumbnails.encastra";

// -- fixtures ---------------------------------------------------------------------------------

fn manifest() -> ComponentManifest {
    ComponentManifest::parse(
        &json!({
            "schema": 1,
            "id": "encastra.net.request",
            "version": "1.0.0",
            "name": "Fetch",
            "runtime": ">=0.1.0",
            "kind": "core",
            "license": "MIT",
            "ports": { "inputs": {}, "outputs": { "text": { "type": "string", "required": true } } },
            "config": { "url": { "type": "string" }, "apiKey": { "type": "string" } },
            "capabilities": [
                { "kind": "net.http", "scope": "allowed-hosts", "reason": "Fetches the address you configure." }
            ],
            "platforms": ["windows", "macos", "linux"]
        })
        .to_string(),
    )
    .expect("the fixture manifest is one the runtime accepts")
}

fn registry() -> InMemoryRegistry {
    let mut registry = InMemoryRegistry::default();
    registry.insert(manifest()).expect("registered once");
    registry
}

fn project_with(config: BTreeMap<String, Value>) -> Project {
    let mut project = Project::new("Thumbnails", 0);
    project.manifest.runtime = ">=0.4.0".into();
    let mut nodes = BTreeMap::new();
    nodes.insert(
        NodeId("fetch".into()),
        Node {
            component: ComponentRef {
                id: "encastra.net.request".into(),
                version: "1.0.0".into(),
            },
            label: None,
            config,
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

fn draft() -> PublicationDraft {
    PublicationDraft {
        listing_id: "dev.alice.thumbnails".into(),
        kind: Kind::Project,
        version: "1.0.0".into(),
        title: "Thumbnails".into(),
        summary: "Makes a small copy of every picture dropped in a folder.".into(),
        categories: Vec::new(),
        tags: Vec::new(),
        license: License::Mit,
        pricing: Pricing::Free,
        changelog: None,
    }
}

fn publisher() -> Publisher {
    Publisher {
        id: "dev.alice".into(),
        display_name: "Alice".into(),
        bio: None,
        verified: false,
    }
}

/// The honest publication: a clean project, a truthful document.
fn honest() -> (Value, Vec<u8>) {
    let project = project_with(BTreeMap::new());
    let bytes = project.to_bytes().expect("serialises");
    let review = encastra_publish::review(&project, &registry(), &License::Mit);
    let bundle = PublicationBundle::prepare(
        draft(),
        &publisher(),
        &bytes,
        &project.manifest.runtime,
        &review,
        1_700_000_000_000,
    )
    .expect("the honest publication prepares");
    (serde_json::to_value(&bundle).expect("serialises"), bytes)
}

/// A document rewritten by the attacker so that its checksum and size describe `bytes` —
/// the attacker controls the document, so integrity is never what stops them.
fn described(mut document: Value, bytes: &[u8]) -> Value {
    document["checksum"] = Value::String(encastra_project::hash(bytes));
    document["sizeBytes"] = Value::from(bytes.len() as u64);
    document
}

struct Sandbox(PathBuf);

impl Sandbox {
    fn new() -> Self {
        let path = std::env::temp_dir()
            .join("encastra-adaptive-attacker")
            .join(std::process::id().to_string());
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(&path).expect("sandbox");
        Sandbox(path)
    }
    fn folder(&self, name: &str) -> PathBuf {
        let path = self.0.join("attempts").join(name);
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(&path).expect("attempt folder");
        path
    }
    fn library(&self) -> PathBuf {
        self.0.join("library")
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn lay_out(folder: &Path, document: &Value, project_name: &str, bytes: &[u8]) {
    std::fs::write(
        folder.join("publication.json"),
        serde_json::to_vec_pretty(document).expect("serialises"),
    )
    .expect("document written");
    std::fs::write(folder.join(project_name), bytes).expect("project written");
}

/// Every file under `root`, with its hash — the shape of the library, byte for byte.
fn snapshot(root: &Path) -> BTreeMap<String, String> {
    fn walk(root: &Path, dir: &Path, out: &mut BTreeMap<String, String>) {
        let Ok(entries) = std::fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk(root, &path, out);
            } else {
                let relative = path
                    .strip_prefix(root)
                    .expect("inside the root")
                    .to_string_lossy()
                    .replace('\\', "/");
                let bytes = std::fs::read(&path).expect("readable");
                out.insert(relative, encastra_project::hash(&bytes));
            }
        }
    }
    let mut out = BTreeMap::new();
    walk(root, root, &mut out);
    out
}

/// One thing the attacker tries: a name for the log, and how to build the folder.
struct Attempt {
    name: &'static str,
    build: Box<dyn Fn(&Path)>,
}

fn attempts() -> Vec<Attempt> {
    let (document, bytes) = honest();
    let mut list: Vec<Attempt> = Vec::new();

    // A helper for the common shape: rewrite the document, keep the honest bytes.
    let with_document = |name: &'static str, edit: fn(&mut Value)| {
        let document = document.clone();
        let bytes = bytes.clone();
        Attempt {
            name,
            build: Box::new(move |folder| {
                let mut document = document.clone();
                edit(&mut document);
                lay_out(folder, &document, PROJECT_FILE, &bytes);
            }),
        }
    };

    // -- 1. Get a byte written somewhere the attacker chooses -----------------------------------
    for (name, id) in [
        ("traversal in the listing id", "dev.alice.../../../escaped"),
        (
            "backslash traversal in the listing id",
            r"dev.alice..\..\..\escaped",
        ),
        ("absolute path as a listing id", "dev.alice./c:/escaped"),
        ("full-width dots in the listing id", "dev．alice．escaped"),
        ("a null byte in the listing id", "dev.alice.esc\0aped"),
    ] {
        let document = document.clone();
        let bytes = bytes.clone();
        list.push(Attempt {
            name,
            build: Box::new(move |folder| {
                let mut document = document.clone();
                document["draft"]["listingId"] = Value::String(id.into());
                lay_out(folder, &document, PROJECT_FILE, &bytes);
            }),
        });
    }
    list.push(with_document("traversal in the version", |d| {
        d["draft"]["version"] = Value::String("1.0.0/../../escaped".into());
    }));
    {
        // The project file's own name is chosen by the attacker too. A name with a separator
        // cannot be created on Windows, so the nearest thing that can: a second extension.
        let document = document.clone();
        let bytes = bytes.clone();
        list.push(Attempt {
            name: "a project file that is also something else",
            build: Box::new(move |folder| {
                lay_out(folder, &document, "thumbnails.encastra.exe", &bytes);
            }),
        });
    }

    // -- 2. Hide a permission, or carry a secret past the check ---------------------------------
    list.push(with_document("permissions understated", |d| {
        d["capabilities"] = json!([]);
    }));
    list.push(with_document(
        "permissions overstated to train skimming",
        |d| {
            d["capabilities"] = json!(["net.http", "fs.read"]);
        },
    ));
    {
        // The attacker rebuilds the project with a secret typed into a setting and a document
        // that truthfully describes the new bytes. Integrity passes; the review must not.
        let document = document.clone();
        list.push(Attempt {
            name: "a secret in a setting, with a truthful checksum",
            build: Box::new(move |folder| {
                let mut config = BTreeMap::new();
                config.insert(
                    "apiKey".to_string(),
                    Value::String("sk-live-9d2f4a7c1b8e6f30aa12".into()),
                );
                let bytes = project_with(config).to_bytes().expect("serialises");
                lay_out(
                    folder,
                    &described(document.clone(), &bytes),
                    PROJECT_FILE,
                    &bytes,
                );
            }),
        });
    }
    {
        // A component pinned to a digest this build does not have: the project claims a
        // different Fetch than the one installed.
        let document = document.clone();
        list.push(Attempt {
            name: "a component whose pinned digest is not this build's",
            build: Box::new(move |folder| {
                let mut project = project_with(BTreeMap::new());
                project.lock.components[0].manifest_digest = "f".repeat(64);
                let bytes = project.to_bytes().expect("serialises");
                lay_out(
                    folder,
                    &described(document.clone(), &bytes),
                    PROJECT_FILE,
                    &bytes,
                );
            }),
        });
    }
    list.push(with_document(
        "a review outcome smuggled into the document",
        |d| {
            d["review"] = json!({ "outcome": "may-publish", "findings": [], "capabilities": [] });
        },
    ));
    list.push(with_document(
        "a signature field this build does not have",
        |d| {
            d["signature"] = Value::String("trust me".into());
        },
    ));
    list.push(with_document("a publisher marked verified", |d| {
        d["publisher"] = Value::String("dev.alice".into());
        d["verified"] = Value::Bool(true);
    }));

    // -- 3. Replace the honest copy -----------------------------------------------------------
    {
        // Same listing, same version, different bytes, truthful checksum: the classic overwrite.
        let document = document.clone();
        list.push(Attempt {
            name: "the same version with different contents",
            build: Box::new(move |folder| {
                let mut project = project_with(BTreeMap::new());
                project.manifest.name = "Thumbnails (really)".into();
                let bytes = project.to_bytes().expect("serialises");
                lay_out(
                    folder,
                    &described(document.clone(), &bytes),
                    PROJECT_FILE,
                    &bytes,
                );
            }),
        });
    }
    list.push(with_document(
        "the runtime range claimed lower than the project's",
        |d| {
            d["runtime"] = Value::String(">=0.0.1".into());
        },
    ));
    list.push(with_document("a component offered as installable", |d| {
        d["draft"]["kind"] = Value::String("component".into());
    }));
    list.push(with_document(
        "a title that displays as something else",
        |d| {
            d["draft"]["title"] = Value::String("Thumbnails\u{202e}exe.gnp".into());
        },
    ));
    list.push(with_document(
        "a namespace the publisher does not own",
        |d| {
            d["publisher"] = Value::String("dev.alic".into());
        },
    ));
    {
        // A directory wearing the project's name, with the real project hidden inside it. A
        // reader that trusted the name would descend; this one does not descend into anything.
        let document = document.clone();
        let bytes = bytes.clone();
        list.push(Attempt {
            name: "a folder wearing the project's name",
            build: Box::new(move |folder| {
                std::fs::write(
                    folder.join("publication.json"),
                    serde_json::to_vec_pretty(&document).expect("serialises"),
                )
                .expect("document written");
                let decoy = folder.join(PROJECT_FILE);
                std::fs::create_dir_all(&decoy).expect("decoy folder");
                std::fs::write(decoy.join(PROJECT_FILE), &bytes).expect("hidden project");
            }),
        });
    }

    list
}

#[test]
fn twenty_strategies_later_the_library_holds_exactly_what_the_honest_import_left() {
    let sandbox = Sandbox::new();
    let library = sandbox.library();
    let registry = registry();

    // The honest import first, so there is something worth replacing.
    let (document, bytes) = honest();
    let first = sandbox.folder("honest");
    lay_out(&first, &document, PROJECT_FILE, &bytes);
    let imported = import(&first, &registry, RUNTIME, &library).expect("the honest folder imports");
    assert!(imported.project_path.starts_with(&library));
    let before = snapshot(&library);
    assert_eq!(before.len(), 2, "one project and one document: {before:#?}");

    let attempts = attempts();
    assert!(
        attempts.len() >= 20,
        "the attacker should have at least twenty strategies"
    );

    let mut refusals: Vec<(&str, String)> = Vec::new();
    for (index, attempt) in attempts.iter().enumerate() {
        let folder = sandbox.folder(&format!("attempt-{index:02}"));
        (attempt.build)(&folder);

        let outcome = import(&folder, &registry, RUNTIME, &library);
        let error = match outcome {
            Ok(taken) => panic!(
                "strategy {index} ({}) was accepted and landed at {}",
                attempt.name,
                taken.folder.display()
            ),
            Err(error) => error,
        };
        refusals.push((attempt.name, error.to_string()));

        // The property: not one byte anywhere in the library moved.
        assert_eq!(
            snapshot(&library),
            before,
            "strategy {index} ({}) changed the library although it was refused",
            attempt.name
        );

        // And nothing was staged and abandoned either — a temporary directory left behind by a
        // refusal is disk somebody else fills up one attempt at a time.
        let shelf = library.join("imports").join("dev.alice.thumbnails");
        let leftovers: Vec<_> = std::fs::read_dir(&shelf)
            .expect("the shelf exists")
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().starts_with('.'))
            .collect();
        assert!(
            leftovers.is_empty(),
            "strategy {index} ({}) left staging behind: {leftovers:?}",
            attempt.name
        );
    }

    // Every strategy was refused for a *specific* reason, not a generic one: the person on the
    // receiving end is told what was wrong, and an attacker learns nothing they did not write.
    for (name, reason) in &refusals {
        assert!(!reason.is_empty(), "{name}: an empty refusal");
        assert!(
            !reason.contains(&sandbox.0.to_string_lossy().to_string()),
            "{name}: the refusal leaked the machine's path: {reason}"
        );
    }
}
