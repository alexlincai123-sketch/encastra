//! The ceiling on how much disk the imported copies may take, and what it is counted from.
//!
//! The entry ceiling bounds the index; this one bounds the bytes, and the difference matters
//! because ten thousand entries at the 64 MB an import may be is six hundred gigabytes. What is
//! interesting is not that a number exists but *where the number being compared comes from*: the
//! index is a file, a file can lie, and a ceiling compared against a figure the attacker writes
//! is not a ceiling. So these tests do the lying.
//!
//! The ceiling itself is a parameter of [`encastra_library::room_for`] rather than a constant
//! read from inside, so the refusal runs against a few kilobytes instead of four gibibytes. The
//! shipped value is asserted once, on its own, because a constant nobody checks is a constant
//! that drifts.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

use encastra_core::ComponentRef;
use encastra_core::graph::{Graph, Node, NodeId, Position};
use encastra_core::registry::InMemoryRegistry;
use encastra_library::{
    Library, MAX_LIBRARY_BYTES, Origin, bytes_in_use, entry_for_import, measure_imports, room_for,
};
use encastra_project::{LockedComponent, Lockfile, Project};
use encastra_protocol::manifest::ComponentManifest;
use encastra_publish::{
    ImportError, Kind, License, Pricing, PublicationBundle, PublicationDraft, Publisher,
    import_reserving, sweep_staging,
};

const RUNTIME: &str = "0.4.0";
const PROJECT_FILE: &str = "thumbnails.encastra";

// -- fixtures -----------------------------------------------------------------------------------

struct Sandbox(PathBuf);

impl Sandbox {
    fn new(name: &str) -> Self {
        let path = std::env::temp_dir()
            .join("encastra-library-bytes")
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

fn registry() -> InMemoryRegistry {
    let mut registry = InMemoryRegistry::default();
    registry.insert(manifest()).expect("registered once");
    registry
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
///
/// The version is a parameter because a library that already holds one import needs a *second*
/// publication to try the ceiling against, and the same version twice is refused for a different
/// reason entirely (`already-imported`) — which would prove nothing about bytes.
fn publication(folder: &Path, registry: &InMemoryRegistry, version: &str) {
    let project = project();
    let bytes = project.to_bytes().expect("serialises");
    let draft = PublicationDraft {
        listing_id: "dev.alice.thumbnails".into(),
        kind: Kind::Project,
        version: version.into(),
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
}

/// One import, made the way the application makes it: measure, reserve, copy, record.
///
/// This is the shape the desktop's `LibraryHandle::import_reserving` has under its lock. Here
/// there is no lock because there is one thread; what is being tested is the arithmetic, and the
/// two-thread version of the same question lives with the lock that answers it, in the desktop
/// crate.
fn take_in(
    library: &mut Library,
    root: &Path,
    folder: &Path,
    registry: &InMemoryRegistry,
    max: u64,
) -> Result<u64, ImportError> {
    let used = bytes_in_use(library, root);
    let imported = import_reserving(folder, registry, RUNTIME, root, &|needed| {
        room_for(used, needed, max)
    })?;
    library.upsert(entry_for_import(&imported, 5_000));
    Ok(used)
}

/// Every file under a folder, so "nothing was left behind" can be asserted rather than hoped.
fn files_under(root: &Path) -> Vec<String> {
    fn walk(root: &Path, dir: &Path, out: &mut Vec<String>) {
        let Ok(entries) = std::fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk(root, &path, out);
            } else {
                out.push(
                    path.strip_prefix(root)
                        .expect("inside the root")
                        .to_string_lossy()
                        .replace('\\', "/"),
                );
            }
        }
    }
    let mut out = Vec::new();
    walk(root, root, &mut out);
    out.sort();
    out
}

// -- the arithmetic -----------------------------------------------------------------------------

#[test]
fn the_shipped_ceiling_is_the_number_the_documentation_says_it_is() {
    // Four gibibytes. Asserted here because a constant nobody checks is a constant that drifts,
    // and `docs/security/LIMITS.md` quotes this number.
    assert_eq!(MAX_LIBRARY_BYTES, 4 * 1024 * 1024 * 1024);
}

#[test]
fn room_is_decided_at_the_boundary_and_cannot_be_wrapped_around() {
    // Exactly full is full enough: the ceiling is what may be held, not what may be exceeded.
    assert!(room_for(900, 100, 1_000).is_ok());
    assert_eq!(
        room_for(900, 101, 1_000),
        Err(ImportError::LibraryFull {
            max: 1_000,
            used: 900,
            needed: 101
        })
    );
    // Nothing held and nothing needed still fits; a single byte over does not.
    assert!(room_for(0, 1_000, 1_000).is_ok());
    assert!(room_for(0, 1_001, 1_000).is_err());
    // The sum saturates rather than wrapping. Without that, a library said to hold almost
    // everything plus an import said to need ten bytes adds up to eight, which is under any
    // ceiling at all — the one arrangement of numbers an attacker would want.
    assert!(room_for(u64::MAX - 1, 10, 1_000).is_err());
    assert!(room_for(u64::MAX, u64::MAX, MAX_LIBRARY_BYTES).is_err());
}

#[test]
fn what_is_held_is_the_larger_of_what_is_claimed_and_what_is_there() {
    let sandbox = Sandbox::new("in-use");
    let root = sandbox.dir("library");
    let registry = registry();
    let folder = sandbox.dir("publication");
    publication(&folder, &registry, "1.0.0");

    let mut library = Library::default();
    assert_eq!(measure_imports(&root), 0, "an empty library weighs nothing");
    assert_eq!(bytes_in_use(&library, &root), 0);

    take_in(&mut library, &root, &folder, &registry, MAX_LIBRARY_BYTES).expect("it fits");

    let measured = measure_imports(&root);
    assert!(measured > 0, "the copy is on disk and has a size");
    // The index records the project file's size; the tree also holds the document beside it, so
    // the measurement is the larger of the two and the one a decision is made on.
    let claimed = library.imported_bytes();
    assert!(
        measured > claimed,
        "measured {measured} should exceed the claimed {claimed}: the document counts too"
    );
    assert_eq!(bytes_in_use(&library, &root), measured);

    // Entries that are not imports are not this ceiling's business: their files live wherever
    // their author put them and this software did not write them.
    let mut mine = library.entries[0].clone();
    mine.id = "somebody-elses".into();
    mine.origin = Origin::Created;
    mine.size_bytes = Some(999_999_999);
    library.upsert(mine);
    assert_eq!(bytes_in_use(&library, &root), measured);
}

#[test]
fn a_tree_too_large_to_finish_counting_is_answered_as_full_rather_than_as_empty() {
    // `measure_imports` stops at MAX_IMPORT_FILES_MEASURED and answers u64::MAX, which every
    // caller reads as "no room". Reaching that with real files would take a hundred thousand of
    // them; what can be checked cheaply is the half that matters — that the answer for a tree it
    // cannot read at all is zero and not a panic, and that u64::MAX refuses everything.
    let sandbox = Sandbox::new("unreadable");
    let root = sandbox.dir("library");
    assert_eq!(measure_imports(&root), 0);
    assert_eq!(
        room_for(u64::MAX, 1, MAX_LIBRARY_BYTES),
        Err(ImportError::LibraryFull {
            max: MAX_LIBRARY_BYTES,
            used: u64::MAX,
            needed: 1
        })
    );
}

// -- the ceiling, against real imports ------------------------------------------------------------

#[test]
fn an_import_that_would_not_fit_is_refused_and_leaves_not_one_byte_behind() {
    let sandbox = Sandbox::new("full");
    let root = sandbox.dir("library");
    let registry = registry();
    let first = sandbox.dir("first");
    let second = sandbox.dir("second");
    publication(&first, &registry, "1.0.0");
    publication(&second, &registry, "2.0.0");

    let mut library = Library::default();
    take_in(&mut library, &root, &first, &registry, MAX_LIBRARY_BYTES).expect("the first fits");
    let after_one = files_under(&root);
    assert_eq!(
        after_one.len(),
        2,
        "a project and a document: {after_one:?}"
    );

    // A ceiling with room for one and not two. The two publications differ only in their version
    // string, so this is a hair over one of them.
    let held = measure_imports(&root);
    let max = held + held / 2;

    let refused = take_in(&mut library, &root, &second, &registry, max)
        .expect_err("there is no room for the second");
    match refused {
        ImportError::LibraryFull {
            max: m,
            used,
            needed,
        } => {
            assert_eq!(m, max);
            assert_eq!(used, held, "what is counted is what is on disk");
            assert!(needed > 0, "the import knows its own size");
            assert!(
                used + needed > max,
                "the refusal has to be arithmetic somebody can check: {used} + {needed} > {max}"
            );
        }
        other => panic!("refused for the wrong reason: {other}"),
    }

    // The property: a refusal is not a partial import. Nothing was staged, nothing was copied,
    // and the version folder the second one would have taken does not exist.
    assert_eq!(files_under(&root), after_one, "the library changed anyway");
    assert!(
        !root
            .join("imports")
            .join("dev.alice.thumbnails")
            .join("2.0.0")
            .exists()
    );
    let staging: Vec<_> = std::fs::read_dir(root.join("imports").join("dev.alice.thumbnails"))
        .expect("the shelf is there")
        .flatten()
        .filter(|e| e.file_name().to_string_lossy().starts_with('.'))
        .collect();
    assert!(staging.is_empty(), "staging was left behind: {staging:?}");

    // And the source folder is untouched. A refusal reads; it does not tidy up after somebody.
    assert!(second.join(PROJECT_FILE).exists());

    // Raise the ceiling and the very same folder goes in: what was refused was the arithmetic,
    // not the publication.
    take_in(&mut library, &root, &second, &registry, MAX_LIBRARY_BYTES)
        .expect("with room, it imports");
    assert_eq!(files_under(&root).len(), 4);
}

#[test]
fn an_index_that_understates_what_it_holds_does_not_widen_the_ceiling() {
    let sandbox = Sandbox::new("lying-index");
    let root = sandbox.dir("library");
    let registry = registry();
    let first = sandbox.dir("first");
    let second = sandbox.dir("second");
    publication(&first, &registry, "1.0.0");
    publication(&second, &registry, "2.0.0");

    let mut library = Library::default();
    take_in(&mut library, &root, &first, &registry, MAX_LIBRARY_BYTES).expect("the first fits");
    let held = measure_imports(&root);
    let max = held + held / 2;

    // The index is a file. Somebody edits it — or a build with a bug writes it — so that every
    // import it lists claims to weigh nothing. If the ceiling believed it, the library would be
    // as large as whoever writes that file wants.
    for entry in &mut library.entries {
        entry.size_bytes = Some(0);
    }
    assert_eq!(library.imported_bytes(), 0, "the index now claims nothing");
    assert_eq!(
        bytes_in_use(&library, &root),
        held,
        "the tree is measured, so the claim buys nothing"
    );

    let refused = take_in(&mut library, &root, &second, &registry, max)
        .expect_err("the lie does not make room");
    assert!(
        matches!(refused, ImportError::LibraryFull { .. }),
        "{refused}"
    );
    assert!(
        !root
            .join("imports")
            .join("dev.alice.thumbnails")
            .join("2.0.0")
            .exists()
    );

    // The overshoot the design accepts, stated as an assertion rather than as prose: because the
    // check happens before the copy, a library can end up holding at most one import's worth
    // more than the ceiling — never a lie's worth more. Here the one that fits does fit.
    let generous = held * 2;
    take_in(&mut library, &root, &second, &registry, generous).expect("this one has room");
    assert!(
        measure_imports(&root) <= generous + held,
        "at most one import's true size past the ceiling, whatever the index said"
    );
}

// -- staging ---------------------------------------------------------------------------------------

#[test]
fn staging_a_crashed_run_left_behind_is_counted_until_it_is_swept_and_then_is_not() {
    let sandbox = Sandbox::new("staging");
    let root = sandbox.dir("library");
    let registry = registry();
    let folder = sandbox.dir("publication");
    publication(&folder, &registry, "1.0.0");

    let mut library = Library::default();
    take_in(&mut library, &root, &folder, &registry, MAX_LIBRARY_BYTES).expect("it fits");
    let honest = measure_imports(&root);

    // What a process that died between the staging write and the rename leaves: a dot-named
    // directory beside the version folders, holding bytes that belong to nothing.
    let shelf = root.join("imports").join("dev.alice.thumbnails");
    let abandoned = shelf.join(".9.9.9.importing-1234-abcd-0");
    std::fs::create_dir_all(&abandoned).expect("created");
    std::fs::write(abandoned.join(PROJECT_FILE), vec![0_u8; 4_096]).expect("written");

    // Counted. Until it is swept it is the only copy of those bytes, and a ceiling that ignored
    // it could be walked past one crash at a time.
    assert_eq!(measure_imports(&root), honest + 4_096);

    // A fresh one is left alone: another copy of this application may be importing right now,
    // and deleting a live staging directory to tidy up is not a trade worth making.
    assert_eq!(sweep_staging(&root, Duration::from_secs(3_600)), 0);
    assert!(abandoned.exists());

    // With no grace at all — which is what an hour later looks like — it goes, and nothing else
    // in the shelf is touched.
    assert_eq!(sweep_staging(&root, Duration::ZERO), 1);
    assert!(!abandoned.exists());
    assert_eq!(measure_imports(&root), honest);
    assert!(shelf.join("1.0.0").join(PROJECT_FILE).exists());

    // Sweeping again finds nothing, and a library that was never written to is not an error.
    assert_eq!(sweep_staging(&root, Duration::ZERO), 0);
    assert_eq!(
        sweep_staging(sandbox.dir("empty").as_path(), Duration::ZERO),
        0
    );
}

#[test]
fn an_import_sweeps_what_an_earlier_one_abandoned_before_it_measures() {
    let sandbox = Sandbox::new("sweep-on-import");
    let root = sandbox.dir("library");
    let registry = registry();
    let first = sandbox.dir("first");
    let second = sandbox.dir("second");
    publication(&first, &registry, "1.0.0");
    publication(&second, &registry, "2.0.0");

    let mut library = Library::default();
    take_in(&mut library, &root, &first, &registry, MAX_LIBRARY_BYTES).expect("the first fits");

    // A leftover large enough to fill the library on its own. Its modification time is now, so
    // the grace period protects it from the import that is about to run — which is the honest
    // behaviour, and means the second import is refused rather than quietly making room for
    // itself by deleting something that might be live.
    let shelf = root.join("imports").join("dev.alice.thumbnails");
    let abandoned = shelf.join(".2.0.0.importing-999-dead-0");
    std::fs::create_dir_all(&abandoned).expect("created");
    std::fs::write(abandoned.join(PROJECT_FILE), vec![0_u8; 64_000]).expect("written");

    let max = measure_imports(&root);
    let refused = take_in(&mut library, &root, &second, &registry, max)
        .expect_err("the leftovers fill the library");
    assert!(
        matches!(refused, ImportError::LibraryFull { .. }),
        "{refused}"
    );
    assert!(
        abandoned.exists(),
        "a fresh staging directory is not deleted"
    );

    // Once it is old enough, the next import sweeps it on its way in and there is room again.
    assert_eq!(sweep_staging(&root, Duration::ZERO), 1);
    take_in(&mut library, &root, &second, &registry, max).expect("the room came back");
    assert!(shelf.join("2.0.0").join(PROJECT_FILE).exists());
}
