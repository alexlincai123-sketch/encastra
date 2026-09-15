//! Taking in a publication somebody else prepared.
//!
//! A publication folder is the one thing in this product that is made on one machine and read on
//! another, which makes reading one the place where hostile input arrives. These tests are about
//! what happens when it does: a document that lies about the file beside it, a name that is
//! really a path, a title that displays as something it is not, a project whose review the sender
//! could have edited away.
//!
//! Two invariants are asserted everywhere rather than in one place:
//!
//! - **A refusal costs nothing.** Every refusal test runs `import` as well as `inspect` and
//!   proves the library is untouched afterwards. A check that refuses after writing half a
//!   folder is not a check.
//! - **`inspect` and `import` agree.** They are the same decision asked twice, so any folder that
//!   `inspect` refuses must be refused identically by `import`, with the same error.

use std::collections::BTreeMap;
use std::io::Write as _;
use std::path::{Path, PathBuf};

use encastra_core::ComponentRef;
use encastra_core::graph::{Graph, Node, NodeId, Position};
use encastra_core::registry::InMemoryRegistry;
use encastra_project::{
    LockedComponent, Lockfile, PROJECT_SCHEMA, Project, ProjectManifest, Variables,
};
use encastra_protocol::manifest::ComponentManifest;
use encastra_publish::bundle::MAX_PUBLICATION_BYTES;
use encastra_publish::import::{Inspected, MAX_DOCUMENT_BYTES, MAX_TITLE_CHARS, import, inspect};
use encastra_publish::{
    ImportError, Kind, License, Pricing, PublicationBundle, PublicationDraft, Publisher,
};
use serde_json::Value;

/// The runtime asking the question. The fixture project states `>=0.4.0`, so this one runs it.
const RUNTIME: &str = "0.4.0";
const PROJECT_FILE: &str = "thumbnails.encastra";
const LISTING: &str = "dev.alice.thumbnails";
const VERSION: &str = "1.0.0";

// -- the sandbox ------------------------------------------------------------------------------

struct Sandbox(PathBuf);

impl Sandbox {
    fn new(name: &str) -> Self {
        let path = std::env::temp_dir()
            .join("encastra-import-tests")
            .join(format!("{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(&path).expect("the sandbox can be created");
        Sandbox(path)
    }

    /// A fresh subdirectory, whatever was there before.
    fn dir(&self, name: &str) -> PathBuf {
        let path = self.0.join(name);
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(&path).expect("the directory can be created");
        path
    }

    fn library(&self) -> PathBuf {
        self.dir("library")
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

// -- fixtures ---------------------------------------------------------------------------------

/// A component that asks for something worth disclosing.
///
/// `net.http` with a real scope rather than `input-handles`, because an `input-handles`
/// capability is not a permission anybody is asked about and so is never listed — and the tests
/// that matter most here are about whether the listed permissions are the true ones.
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
    .expect("the fixture manifest is one the runtime accepts")
}

fn registry() -> InMemoryRegistry {
    let mut registry = InMemoryRegistry::default();
    registry.insert(manifest()).expect("registered once");
    registry
}

fn node(config: BTreeMap<String, Value>, disabled: bool) -> Node {
    Node {
        component: ComponentRef {
            id: "encastra.net.request".into(),
            version: "1.0.0".into(),
        },
        label: None,
        config,
        position: Position::default(),
        disabled,
    }
}

/// A real project: two steps, one of them switched off, pinned to the fixture component.
fn project() -> Project {
    let mut project = Project::new("Thumbnails", 0);
    project.manifest.runtime = ">=0.4.0".into();
    project.manifest.description = Some("Makes a small copy of every picture.".into());

    let mut nodes = BTreeMap::new();
    nodes.insert(NodeId("fetch".into()), node(BTreeMap::new(), false));
    nodes.insert(NodeId("spare".into()), node(BTreeMap::new(), true));
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

fn bytes_of(project: &Project) -> Vec<u8> {
    project.to_bytes().expect("a project always serialises")
}

fn publisher() -> Publisher {
    Publisher {
        id: "dev.alice".into(),
        display_name: "Alice".into(),
        bio: None,
        verified: false,
    }
}

fn draft() -> PublicationDraft {
    PublicationDraft {
        listing_id: LISTING.into(),
        kind: Kind::Project,
        version: VERSION.into(),
        title: "Thumbnails".into(),
        summary: "Makes a small copy of every picture dropped in a folder.".into(),
        categories: vec!["images".into()],
        tags: vec!["batch".into()],
        license: License::Mit,
        pricing: Pricing::Free,
        changelog: Some("First release.".into()),
    }
}

/// The bundle the desktop's `prepare_publication` would write for these bytes.
fn bundle_for(project: &Project, bytes: &[u8]) -> PublicationBundle {
    let review = encastra_publish::review(project, &registry(), &draft().license);
    PublicationBundle::prepare(
        draft(),
        &publisher(),
        bytes,
        &project.manifest.runtime,
        &review,
        1_700_000_000_000,
    )
    .expect("the fixture publication prepares")
}

/// The document as JSON, so a test can change one thing about it and write it back out.
fn document_of(bundle: &PublicationBundle) -> Value {
    serde_json::to_value(bundle).expect("a bundle serialises")
}

/// Lays out a publication folder the way `prepare_publication` does: exactly one document and
/// exactly one project file, nothing else.
fn lay_out(folder: &Path, document: &[u8], project_name: &str, project_bytes: &[u8]) {
    std::fs::create_dir_all(folder).expect("the folder can be created");
    std::fs::write(folder.join("publication.json"), document).expect("the document is written");
    std::fs::write(folder.join(project_name), project_bytes).expect("the project is written");
}

/// The ordinary, well-formed publication folder. Most tests take this and spoil one thing.
fn good_folder(sandbox: &Sandbox, name: &str) -> PathBuf {
    let project = project();
    let bytes = bytes_of(&project);
    let bundle = bundle_for(&project, &bytes);
    let folder = sandbox.dir(name);
    lay_out(
        &folder,
        &serde_json::to_vec_pretty(&bundle).expect("serialises"),
        PROJECT_FILE,
        &bytes,
    );
    folder
}

/// A folder whose document has been altered after the fact — which is exactly the situation the
/// receiving side exists for, since the sender writes the document and the sender is not trusted.
fn folder_with_document(sandbox: &Sandbox, name: &str, spoil: impl FnOnce(&mut Value)) -> PathBuf {
    let project = project();
    let bytes = bytes_of(&project);
    let mut document = document_of(&bundle_for(&project, &bytes));
    spoil(&mut document);

    let folder = sandbox.dir(name);
    lay_out(
        &folder,
        &serde_json::to_vec_pretty(&document).expect("serialises"),
        PROJECT_FILE,
        &bytes,
    );
    folder
}

/// Runs the whole decision on a folder that must be refused, and proves the refusal was free.
///
/// `inspect` and `import` are the same decision asked twice, so they have to give the same
/// answer; and a refusal that has already written something into somebody's library is not a
/// refusal, so the library is checked afterwards rather than assumed.
fn refused(sandbox: &Sandbox, folder: &Path) -> ImportError {
    let library = sandbox.library();
    let from_inspect =
        inspect(folder, &registry(), RUNTIME).expect_err("this folder must be refused");
    let from_import =
        import(folder, &registry(), RUNTIME, &library).expect_err("this folder must be refused");
    assert_eq!(
        from_inspect, from_import,
        "inspect and import must refuse the same folder for the same reason"
    );
    assert!(
        !library.join("imports").exists(),
        "a refusal wrote something into the library"
    );
    from_inspect
}

// -- the happy path -----------------------------------------------------------------------------

#[test]
fn a_well_formed_publication_is_read_measured_and_taken_in() {
    let sandbox = Sandbox::new("happy");
    let folder = good_folder(&sandbox, "publication");
    let source = std::fs::read(folder.join(PROJECT_FILE)).expect("the source is readable");

    let inspected: Inspected = inspect(&folder, &registry(), RUNTIME).expect("this one is fine");
    assert_eq!(inspected.project_file, PROJECT_FILE);
    assert_eq!(inspected.project_name, "Thumbnails");
    assert_eq!(
        inspected.project_description.as_deref(),
        Some("Makes a small copy of every picture.")
    );
    assert_eq!(inspected.steps, 2);
    assert_eq!(inspected.steps_switched_off, 1);
    assert_eq!(inspected.versions, 0);
    assert_eq!(inspected.review.capabilities, vec!["net.http".to_string()]);
    assert!(
        inspected.review.may_publish(),
        "{:#?}",
        inspected.review.findings
    );
    // The two that must never drift, because an interface reading them has no other source.
    assert!(
        !inspected.provenance_verified,
        "there is no signature in this build; a checksum is integrity, not provenance"
    );
    assert!(
        !inspected.publisher_verified,
        "there are no accounts, so there is nobody to have checked"
    );

    let library = sandbox.library();
    let imported = import(&folder, &registry(), RUNTIME, &library).expect("this one is fine");

    assert_eq!(
        imported.folder,
        library.join("imports").join(LISTING).join(VERSION),
        "one folder per version, so a second version cannot land on the first"
    );
    assert_eq!(imported.project_path, imported.folder.join(PROJECT_FILE));

    let landed = std::fs::read(&imported.project_path).expect("the project landed");
    assert_eq!(
        landed, source,
        "the bytes kept must be the bytes that were checked"
    );

    let document: PublicationBundle = serde_json::from_slice(
        &std::fs::read(imported.folder.join("publication.json")).expect("the document landed"),
    )
    .expect("the document written here parses");
    assert_eq!(document, imported.inspected.bundle);

    // Nothing was staged and left behind, and nothing was moved out of the source folder.
    let leftovers: Vec<String> = std::fs::read_dir(library.join("imports").join(LISTING))
        .expect("the shelf is readable")
        .map(|e| e.expect("entry").file_name().to_string_lossy().into_owned())
        .collect();
    assert_eq!(leftovers, vec![VERSION.to_string()]);
    assert!(
        folder.join(PROJECT_FILE).exists(),
        "importing must copy, never move"
    );
}

#[test]
fn the_same_version_is_not_taken_in_twice() {
    let sandbox = Sandbox::new("twice");
    let folder = good_folder(&sandbox, "publication");
    let library = sandbox.library();

    import(&folder, &registry(), RUNTIME, &library).expect("the first one lands");
    let again = import(&folder, &registry(), RUNTIME, &library).expect_err("the second must not");
    assert_eq!(
        again,
        ImportError::AlreadyImported {
            listing: LISTING.into(),
            version: VERSION.into(),
        }
    );

    // And the copy that was already there is untouched, rather than half-rewritten.
    let landed = library.join("imports").join(LISTING).join(VERSION);
    assert!(landed.join(PROJECT_FILE).exists());
    assert!(landed.join("publication.json").exists());
}

// -- the folder ---------------------------------------------------------------------------------

#[test]
fn a_folder_that_is_not_there_is_not_a_folder() {
    let sandbox = Sandbox::new("missing");
    let nowhere = sandbox.0.join("nothing-here");
    assert_eq!(refused(&sandbox, &nowhere), ImportError::NotAFolder);
}

#[test]
fn a_file_offered_as_a_publication_folder_is_refused() {
    let sandbox = Sandbox::new("a-file");
    let file = sandbox.0.join("publication.json");
    std::fs::write(&file, b"{}").expect("written");
    assert_eq!(refused(&sandbox, &file), ImportError::NotAFolder);
}

#[test]
fn a_folder_with_no_document_says_nothing_about_itself() {
    let sandbox = Sandbox::new("no-document");
    let folder = sandbox.dir("publication");
    std::fs::write(folder.join(PROJECT_FILE), bytes_of(&project())).expect("written");
    assert_eq!(refused(&sandbox, &folder), ImportError::NoDocument);
}

#[test]
fn a_folder_with_no_project_holds_nothing_to_install() {
    let sandbox = Sandbox::new("no-project");
    let project = project();
    let bytes = bytes_of(&project);
    let folder = sandbox.dir("publication");
    std::fs::create_dir_all(&folder).expect("created");
    std::fs::write(
        folder.join("publication.json"),
        serde_json::to_vec_pretty(&bundle_for(&project, &bytes)).expect("serialises"),
    )
    .expect("written");
    assert_eq!(refused(&sandbox, &folder), ImportError::NoProject);
}

#[test]
fn a_folder_holding_two_projects_does_not_get_to_choose_for_you() {
    let sandbox = Sandbox::new("two-projects");
    let folder = good_folder(&sandbox, "publication");
    // The document describes one of them. Picking either would mean installing something the
    // document may not describe, and picking by name would mean picking by directory order.
    std::fs::write(folder.join("other.encastra"), b"not even an archive").expect("written");
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::MoreThanOneProject {
            names: vec!["other.encastra".into(), PROJECT_FILE.into()],
        }
    );
}

#[test]
fn anything_else_in_the_folder_means_it_is_not_a_publication_folder() {
    let sandbox = Sandbox::new("extra-file");
    let folder = good_folder(&sandbox, "publication");
    std::fs::write(folder.join("readme.txt"), b"install me").expect("written");
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::UnexpectedEntries {
            names: vec!["readme.txt".into()],
        }
    );
}

#[test]
fn what_a_file_manager_left_behind_is_ignored_and_not_copied() {
    // Opening the folder in Explorer or Finder is not a reason to refuse it. `desktop.ini` and
    // `.DS_Store` are left where they are, never read, and never travel into the library.
    let sandbox = Sandbox::new("os-litter");
    let folder = good_folder(&sandbox, "publication");
    std::fs::write(folder.join("desktop.ini"), b"[.ShellClassInfo]").expect("written");
    std::fs::write(folder.join(".DS_Store"), b"\0\0\0\x01Bud1").expect("written");

    let library = sandbox.library();
    let imported =
        import(&folder, &registry(), RUNTIME, &library).expect("litter is not a refusal");
    let mut landed: Vec<String> = std::fs::read_dir(&imported.folder)
        .expect("the destination exists")
        .map(|e| e.expect("entry").file_name().to_string_lossy().into_owned())
        .collect();
    landed.sort();
    assert_eq!(
        landed,
        vec!["publication.json".to_string(), PROJECT_FILE.to_string()]
    );

    // A folder named like the litter is still a folder, and still unexpected.
    let sandbox = Sandbox::new("os-litter-folder");
    let folder = good_folder(&sandbox, "publication");
    std::fs::create_dir(folder.join("desktop.ini")).expect("created");
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::UnexpectedEntries {
            names: vec!["desktop.ini".into()],
        }
    );
}

#[test]
fn a_changelog_may_have_more_than_one_paragraph_and_still_no_escape_codes() {
    let sandbox = Sandbox::new("changelog-paragraphs");
    let folder = folder_with_document(&sandbox, "publication", |document| {
        document["draft"]["changelog"] =
            Value::String("First release.\n\nSecond paragraph.".into());
    });
    inspect(&folder, &registry(), RUNTIME)
        .expect("paragraphs are the ordinary shape of a changelog");

    let folder = folder_with_document(&sandbox, "escaped", |document| {
        document["draft"]["changelog"] = Value::String("First release.\u{1b}[2J".into());
    });
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::TextHasControlCharacters { field: "changelog" }
    );
}

#[test]
fn a_subfolder_is_as_unexpected_as_a_file() {
    let sandbox = Sandbox::new("extra-folder");
    let folder = good_folder(&sandbox, "publication");
    std::fs::create_dir(folder.join("extras")).expect("created");
    std::fs::write(folder.join("extras").join("payload.bin"), b"x").expect("written");
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::UnexpectedEntries {
            names: vec!["extras".into()],
        }
    );
}

#[test]
fn a_link_where_a_file_should_be_is_never_followed() {
    let sandbox = Sandbox::new("links");
    let outside = sandbox.dir("outside");
    let secret = outside.join("elsewhere.encastra");
    std::fs::write(&secret, b"a file the folder does not hold").expect("written");

    let folder = good_folder(&sandbox, "publication");
    std::fs::remove_file(folder.join(PROJECT_FILE)).expect("removed");
    if link_file(&secret, &folder.join(PROJECT_FILE)).is_err() {
        // Windows needs Developer Mode or an elevated process to make one of these. Saying so is
        // worth more than a test that silently does nothing.
        eprintln!(
            "skipped: this platform would not create a symbolic link, so the link cases were not \
             exercised"
        );
        return;
    }
    assert_eq!(refused(&sandbox, &folder), ImportError::ProjectIsALink);

    // The document, next.
    let other = good_folder(&sandbox, "publication-2");
    let real_document = outside.join("elsewhere.json");
    std::fs::rename(other.join("publication.json"), &real_document).expect("moved");
    link_file(&real_document, &other.join("publication.json")).expect("the link is made");
    assert_eq!(refused(&sandbox, &other), ImportError::DocumentIsALink);
}

#[test]
fn a_publication_folder_that_is_a_link_is_never_followed() {
    let sandbox = Sandbox::new("linked-folder");
    let real = good_folder(&sandbox, "publication");
    let linked = sandbox.0.join("linked-publication");

    if link_dir(&real, &linked).is_err() {
        eprintln!(
            "skipped: this platform would create neither a symbolic link nor a junction, so a \
             linked publication folder was not exercised"
        );
        return;
    }
    // Reading through it would mean reading a folder other than the one somebody chose, which
    // is the one thing importing is not allowed to do.
    assert_eq!(refused(&sandbox, &linked), ImportError::FolderIsALink);
}

#[cfg(windows)]
fn link_file(original: &Path, link: &Path) -> std::io::Result<()> {
    std::os::windows::fs::symlink_file(original, link)
}

/// A directory link, by whichever mechanism this machine allows.
///
/// A symbolic link needs Developer Mode or an elevated process on Windows and a junction needs
/// neither, so most machines can make one of the two. Both are reparse points that redirect a
/// directory somewhere else, which is the property under test — so covering the case with a
/// junction where a symlink is refused is a real test rather than a weaker stand-in.
#[cfg(windows)]
fn link_dir(original: &Path, link: &Path) -> std::io::Result<()> {
    if std::os::windows::fs::symlink_dir(original, link).is_ok() {
        return Ok(());
    }
    let made = std::process::Command::new("cmd")
        .arg("/C")
        .arg("mklink")
        .arg("/J")
        .arg(link)
        .arg(original)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()?;
    if made.success() && std::fs::symlink_metadata(link)?.file_type().is_symlink() {
        Ok(())
    } else {
        Err(std::io::Error::other("no directory link could be made"))
    }
}

#[cfg(unix)]
fn link_file(original: &Path, link: &Path) -> std::io::Result<()> {
    std::os::unix::fs::symlink(original, link)
}

#[cfg(unix)]
fn link_dir(original: &Path, link: &Path) -> std::io::Result<()> {
    std::os::unix::fs::symlink(original, link)
}

// -- the document -------------------------------------------------------------------------------

#[test]
fn a_document_too_large_to_be_one_is_refused_by_its_size() {
    let sandbox = Sandbox::new("big-document");
    let folder = good_folder(&sandbox, "publication");
    let padding = vec![b' '; (MAX_DOCUMENT_BYTES + 1) as usize];
    std::fs::write(folder.join("publication.json"), &padding).expect("written");

    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::DocumentTooLarge {
            size: MAX_DOCUMENT_BYTES + 1,
            max: MAX_DOCUMENT_BYTES,
        }
    );
}

#[test]
fn a_document_that_is_not_json_is_not_a_document() {
    let sandbox = Sandbox::new("malformed");
    let folder = good_folder(&sandbox, "publication");
    std::fs::write(folder.join("publication.json"), b"{ not json at all").expect("written");
    assert!(matches!(
        refused(&sandbox, &folder),
        ImportError::DocumentUnreadable { .. }
    ));
}

#[test]
fn a_document_with_a_field_this_build_does_not_know_is_refused() {
    let sandbox = Sandbox::new("unknown-field");
    // `deny_unknown_fields`, and this is why: a field this build ignores is a field a newer one
    // gives meaning to, and ignoring it means agreeing to something nobody here has read.
    let folder = folder_with_document(&sandbox, "publication", |document| {
        document["trustedBy"] = Value::String("everyone".into());
    });
    assert!(matches!(
        refused(&sandbox, &folder),
        ImportError::DocumentUnreadable { .. }
    ));
}

#[test]
fn a_component_is_not_offered_because_nothing_here_could_run_one() {
    let sandbox = Sandbox::new("component");
    // `prepare` refuses this, so it cannot be produced here — which is exactly why the receiving
    // side has to check as well. The document is written by the sender.
    let folder = folder_with_document(&sandbox, "publication", |document| {
        document["draft"]["kind"] = Value::String("component".into());
    });
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::NotInstallable {
            kind: Kind::Component
        }
    );
}

#[test]
fn a_listing_name_that_is_really_a_path_is_refused_on_the_way_in() {
    let sandbox = Sandbox::new("path-name");
    // `Publisher::owns` says yes to this: strip `dev.alice` and what is left begins with a dot.
    // The name then becomes a folder under the library, three levels above where it belongs.
    let folder = folder_with_document(&sandbox, "publication", |document| {
        document["draft"]["listing_id"] = Value::String("dev.alice.../../../x".into());
    });
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::NotAListingId {
            id: "dev.alice.../../../x".into()
        }
    );
}

#[test]
fn a_name_in_somebody_else_s_namespace_is_refused_on_the_way_in() {
    let sandbox = Sandbox::new("namespace");
    let folder = folder_with_document(&sandbox, "publication", |document| {
        document["draft"]["listing_id"] = Value::String("dev.bob.thumbnails".into());
    });
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::NotPublishersNamespace {
            listing: "dev.bob.thumbnails".into(),
            publisher: "dev.alice".into(),
        }
    );
}

#[test]
fn a_version_that_is_not_one_is_refused_on_the_way_in() {
    let sandbox = Sandbox::new("version");
    let folder = folder_with_document(&sandbox, "publication", |document| {
        document["draft"]["version"] = Value::String("latest".into());
    });
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::NotAVersion {
            version: "latest".into()
        }
    );
}

#[test]
fn a_title_that_displays_as_something_else_is_refused() {
    let sandbox = Sandbox::new("spoofed-title");
    // U+202E reverses everything after it, so what is stored and what is read are two different
    // strings. It is refused rather than stripped: removing it would hand back a title nobody
    // wrote, and the honest answer is that this one cannot be shown.
    let folder = folder_with_document(&sandbox, "publication", |document| {
        document["draft"]["title"] = Value::String("Thumbnails\u{202e}gnp.exe".into());
    });
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::TextHasControlCharacters { field: "title" }
    );
}

#[test]
fn a_title_nobody_could_read_to_the_end_of_is_refused() {
    let sandbox = Sandbox::new("long-title");
    let folder = folder_with_document(&sandbox, "publication", |document| {
        document["draft"]["title"] = Value::String("a".repeat(MAX_TITLE_CHARS + 1));
    });
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::TextTooLong {
            field: "title",
            max: MAX_TITLE_CHARS,
        }
    );
}

// -- the file the document describes --------------------------------------------------------------

#[test]
fn a_project_larger_than_this_build_installs_is_refused_before_it_is_read() {
    let sandbox = Sandbox::new("big-project");
    let folder = good_folder(&sandbox, "publication");

    // Set by length rather than written: the point is that the refusal comes from the metadata,
    // so the bytes never have to exist, let alone be read into memory.
    let file = std::fs::OpenOptions::new()
        .write(true)
        .truncate(true)
        .open(folder.join(PROJECT_FILE))
        .expect("the project file is writable");
    file.set_len(MAX_PUBLICATION_BYTES + 1)
        .expect("the length can be set");
    drop(file);

    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::ProjectTooLarge {
            size: MAX_PUBLICATION_BYTES + 1,
            max: MAX_PUBLICATION_BYTES,
        }
    );
}

#[test]
fn a_project_that_is_not_the_one_described_is_refused() {
    let sandbox = Sandbox::new("checksum");
    let folder = good_folder(&sandbox, "publication");

    let mut bytes = std::fs::read(folder.join(PROJECT_FILE)).expect("readable");
    let middle = bytes.len() / 2;
    bytes[middle] ^= 0xff;
    std::fs::write(folder.join(PROJECT_FILE), &bytes).expect("written");

    assert_eq!(refused(&sandbox, &folder), ImportError::ChecksumMismatch);
}

#[test]
fn a_project_of_the_wrong_length_is_refused_without_hashing_anything() {
    let sandbox = Sandbox::new("size");
    let folder = good_folder(&sandbox, "publication");

    let mut bytes = std::fs::read(folder.join(PROJECT_FILE)).expect("readable");
    bytes.push(0);
    std::fs::write(folder.join(PROJECT_FILE), &bytes).expect("written");

    // Size and hash are one question with one answer: this is not the file that was described.
    // Reporting them separately would invite somebody to treat one of them as the lesser problem.
    assert_eq!(refused(&sandbox, &folder), ImportError::ChecksumMismatch);
}

#[test]
fn a_project_written_by_a_version_this_build_cannot_read_is_refused() {
    let sandbox = Sandbox::new("schema");
    let project = project();
    let bytes = future_schema_archive(&project, 99);

    // The document is made to match these bytes exactly, so the schema is the only thing wrong.
    let mut document = document_of(&bundle_for(&project, &bytes_of(&project)));
    document["checksum"] = Value::String(encastra_project::hash(&bytes));
    document["size_bytes"] = Value::Number((bytes.len() as u64).into());

    let folder = sandbox.dir("publication");
    lay_out(
        &folder,
        &serde_json::to_vec_pretty(&document).expect("serialises"),
        PROJECT_FILE,
        &bytes,
    );

    match refused(&sandbox, &folder) {
        ImportError::ProjectUnreadable { reason } => {
            assert!(
                reason.contains("99"),
                "the refusal should say which schema it found: {reason}"
            );
            assert!(
                !reason.contains(':') || !reason.contains('\\'),
                "no path from anybody's machine belongs in this message: {reason}"
            );
        }
        other => panic!("a project from the future must be refused, got {other:?}"),
    }
}

/// A `.encastra` archive whose manifest claims a schema this build does not read.
///
/// Built entry by entry rather than through `Project::to_bytes`, which always writes the schema
/// this build understands — which is the right behaviour for it and the reason this has to be
/// assembled by hand.
fn future_schema_archive(project: &Project, schema: u32) -> Vec<u8> {
    let manifest = ProjectManifest {
        schema,
        ..project.manifest.clone()
    };
    let entries: Vec<(&str, Vec<u8>)> = vec![
        (
            "project.json",
            serde_json::to_vec_pretty(&manifest).expect("serialises"),
        ),
        ("graph.json", project.graph.to_json().into_bytes()),
        (
            "lock.json",
            serde_json::to_vec_pretty(&project.lock).expect("serialises"),
        ),
        (
            "variables.json",
            serde_json::to_vec_pretty(&Variables::new()).expect("serialises"),
        ),
        (
            "versions/index.json",
            serde_json::to_vec_pretty(&project.history).expect("serialises"),
        ),
    ];

    let mut out = Vec::new();
    {
        let mut writer = zip::ZipWriter::new(std::io::Cursor::new(&mut out));
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        for (name, body) in entries {
            writer.start_file(name, options).expect("entry started");
            writer.write_all(&body).expect("entry written");
        }
        writer.finish().expect("archive finished");
    }
    assert_ne!(schema, PROJECT_SCHEMA, "this fixture is about the mismatch");
    out
}

// -- compatibility ---------------------------------------------------------------------------------

#[test]
fn a_document_that_names_a_different_runtime_than_the_project_is_refused() {
    let sandbox = Sandbox::new("runtime-disagreement");
    // The page somebody reads before deciding would be describing something other than the file
    // beside it.
    let folder = folder_with_document(&sandbox, "publication", |document| {
        document["runtime"] = Value::String(">=0.5.0".into());
    });
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::DocumentDisagreesWithProject { about: "runtime" }
    );
}

#[test]
fn a_publication_for_a_runtime_this_is_not_is_refused() {
    let sandbox = Sandbox::new("runtime-too-new");
    let folder = folder_for_runtime(&sandbox, "publication", ">=99.0.0");
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::RuntimeIncompatible {
            requires: ">=99.0.0".into(),
            have: RUNTIME.into(),
        }
    );
}

#[test]
fn a_runtime_range_nobody_can_read_is_a_refusal_rather_than_a_shrug() {
    let sandbox = Sandbox::new("runtime-unreadable");
    let folder = folder_for_runtime(&sandbox, "publication", "whenever");
    // Treating "I could not read this" as "it is fine" is how something ends up running against
    // a runtime nobody ever claimed it worked with.
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::RuntimeIncompatible {
            requires: "whenever".into(),
            have: RUNTIME.into(),
        }
    );
}

/// A publication where the project and its document agree on a runtime range that is not ours.
fn folder_for_runtime(sandbox: &Sandbox, name: &str, runtime: &str) -> PathBuf {
    let mut project = project();
    project.manifest.runtime = runtime.into();
    let bytes = bytes_of(&project);
    let bundle = bundle_for(&project, &bytes);

    let folder = sandbox.dir(name);
    lay_out(
        &folder,
        &serde_json::to_vec_pretty(&bundle).expect("serialises"),
        PROJECT_FILE,
        &bytes,
    );
    folder
}

// -- the review, run again ---------------------------------------------------------------------

#[test]
fn a_secret_left_in_a_setting_is_found_by_the_receiver_too() {
    let sandbox = Sandbox::new("secret");
    let clean = project();
    // The sender could not have prepared this — `prepare` refuses a refused review — so the
    // document is taken from the clean project and pointed at the spoiled one. That is the whole
    // point: the document is not evidence of anything.
    let mut document = document_of(&bundle_for(&clean, &bytes_of(&clean)));

    let mut spoiled = clean;
    let mut config = BTreeMap::new();
    config.insert(
        "apiKey".to_string(),
        Value::String("sk-live-9d2f4a7c1b8e6f30".into()),
    );
    spoiled
        .graph
        .nodes
        .insert(NodeId("fetch".into()), node(config, false));

    let bytes = bytes_of(&spoiled);
    document["checksum"] = Value::String(encastra_project::hash(&bytes));
    document["size_bytes"] = Value::Number((bytes.len() as u64).into());

    let folder = sandbox.dir("publication");
    lay_out(
        &folder,
        &serde_json::to_vec_pretty(&document).expect("serialises"),
        PROJECT_FILE,
        &bytes,
    );

    match refused(&sandbox, &folder) {
        ImportError::ReviewRefused { findings } => {
            assert!(
                findings.iter().any(|f| f.code == "secret-in-settings"),
                "{findings:#?}"
            );
            assert!(
                findings.iter().all(|f| !f.remedy.trim().is_empty()),
                "every finding has to say what would change the answer"
            );
        }
        other => panic!("a secret in a setting must refuse the import, got {other:?}"),
    }
}

#[test]
fn a_component_this_build_does_not_have_refuses_the_import() {
    let sandbox = Sandbox::new("unknown-component");
    let folder = good_folder(&sandbox, "publication");
    let library = sandbox.library();
    // An empty registry is the honest model of receiving something built elsewhere: what it can
    // reach cannot be read, so it cannot be disclosed, so nobody can agree to it.
    let empty = InMemoryRegistry::default();

    match inspect(&folder, &empty, RUNTIME).expect_err("must be refused") {
        ImportError::ReviewRefused { findings } => {
            assert!(
                findings.iter().any(|f| f.code == "component-unknown"),
                "{findings:#?}"
            );
        }
        other => panic!("an unreadable component must refuse the import, got {other:?}"),
    }
    assert!(import(&folder, &empty, RUNTIME, &library).is_err());
    assert!(!library.join("imports").exists());
}

// -- the disclosure -------------------------------------------------------------------------------

#[test]
fn a_document_that_understates_what_it_asks_for_is_refused() {
    let sandbox = Sandbox::new("understated");
    let folder = folder_with_document(&sandbox, "publication", |document| {
        document["capabilities"] = Value::Array(Vec::new());
    });
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::CapabilitiesDisagree {
            declared: Vec::new(),
            actual: vec!["net.http".into()],
        }
    );
}

#[test]
fn a_document_that_overstates_what_it_asks_for_is_refused_just_as_hard() {
    let sandbox = Sandbox::new("overstated");
    // The subtler one. A list longer than the truth teaches people that the list is noise, and
    // the day one of the entries matters they will already have learnt to skim it.
    let folder = folder_with_document(&sandbox, "publication", |document| {
        document["capabilities"] = Value::Array(vec![
            Value::String("fs.write".into()),
            Value::String("net.http".into()),
        ]);
    });
    assert_eq!(
        refused(&sandbox, &folder),
        ImportError::CapabilitiesDisagree {
            declared: vec!["fs.write".into(), "net.http".into()],
            actual: vec!["net.http".into()],
        }
    );
}

// -- the property ----------------------------------------------------------------------------------

#[test]
fn no_single_byte_of_the_document_can_change_what_is_decided() {
    let sandbox = Sandbox::new("mutations");
    let folder = good_folder(&sandbox, "publication");
    let original = std::fs::read(folder.join("publication.json")).expect("readable");
    let truth: PublicationBundle = serde_json::from_slice(&original).expect("parses");

    let mut rng = Lcg::seeded(0x5eed_1234_abcd_0001);
    let mut refusals = 0_usize;

    for _ in 0..200 {
        let mut mutated = original.clone();
        let at = (rng.next() % mutated.len() as u64) as usize;
        let was = mutated[at];
        // Any byte but the one that was there. Wrapping keeps it a single-byte change rather
        // than occasionally being no change at all.
        mutated[at] = was.wrapping_add(1 + (rng.next() % 254) as u8);
        std::fs::write(folder.join("publication.json"), &mutated).expect("written");

        match inspect(&folder, &registry(), RUNTIME) {
            Err(_) => refusals += 1,
            Ok(accepted) => {
                // Four fields in this document are not claims: each is checked against the
                // project file beside it, so no single byte can move one of them and still be
                // accepted. If one of these ever differs, a check stopped firing.
                let b = &accepted.bundle;
                assert_eq!(b.checksum, truth.checksum, "at byte {at}");
                assert_eq!(b.size_bytes, truth.size_bytes, "at byte {at}");
                assert_eq!(b.capabilities, truth.capabilities, "at byte {at}");
                assert_eq!(b.runtime, truth.runtime, "at byte {at}");

                // The rest — the title, the summary, the tags, the listing name, the version —
                // *can* move, and this is the honest place to say why: nothing in the folder
                // contradicts them. A checksum ties the document to the file; it does not tie
                // the document to whoever wrote it, and the signature that would is ADR-0008,
                // which this build does not have. What can still be insisted on is that
                // whatever the name has become, it is a name and not a path, and it is inside
                // the namespace the document also claims.
                assert!(
                    encastra_publish::is_listing_id(&b.draft.listing_id),
                    "at byte {at}: {}",
                    b.draft.listing_id
                );
                assert!(
                    b.draft.listing_id.starts_with(&format!("{}.", b.publisher)),
                    "at byte {at}: {} is outside {}",
                    b.draft.listing_id,
                    b.publisher
                );
                assert!(
                    semver::Version::parse(&b.draft.version).is_ok(),
                    "at byte {at}: {}",
                    b.draft.version
                );
            }
        }
    }

    // Most of a document this small is structure, so most mutations have to be refusals. The
    // number is here so that a version which started accepting everything would fail rather than
    // pass quietly with two hundred vacuous iterations.
    assert!(
        refusals > 150,
        "only {refusals} of 200 single-byte changes were refused"
    );
}

/// A linear congruential generator, seeded, so that a failure is reproducible.
///
/// Not random enough for anything that matters and does not need to be: it decides which byte to
/// spoil, and the only property required of it is that the same seed spoils the same bytes on
/// every machine that runs this.
struct Lcg(u64);

impl Lcg {
    fn seeded(seed: u64) -> Self {
        Lcg(seed)
    }
    fn next(&mut self) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        self.0 >> 17
    }
}
