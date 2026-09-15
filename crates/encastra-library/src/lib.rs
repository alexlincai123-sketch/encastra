//! What somebody has: the projects they made, the ones they took in, and the ones they prepared
//! to hand on.
//!
//! This is an index, not a store. The projects themselves live wherever the person put them —
//! `.encastra` files on a desktop, in a folder, in a repository — and the one exception is the
//! `imports/` tree, which this software created and is therefore allowed to delete from. Nothing
//! else here may remove a file, and [`remove_imported_copy`] refuses rather than trusting a
//! stored path to be inside a folder it says it is.
//!
//! Three decisions are worth stating because a careless version would make the opposite one:
//!
//! - **A corrupt index is not silently replaced.** [`Library::load`] returns
//!   [`LibraryError::Corrupt`] and lets the caller decide. The convenience that starts over is
//!   [`Library::load_or_quarantine`], and it renames the file it could not read rather than
//!   deleting it — the entries in it are a record of somebody's work, and "it would not parse"
//!   is not a reason to throw that away where nobody can look at it.
//! - **A file is judged by its content, not by its timestamp.** [`status`] hashes what is on
//!   disk, so "this changed since you last opened it" means it changed, rather than meaning a
//!   backup tool touched the modification time.
//! - **Nothing here decides anything about a publication.** The index records what
//!   `encastra-publish` already decided. It cannot make something importable that was refused,
//!   because it is never asked.

use std::path::Path;

use encastra_project::Project;
use encastra_publish::import::Imported;
use serde::{Deserialize, Serialize};

/// The index file, inside whatever root the application chose for its data.
pub const INDEX_FILE: &str = "library.json";

/// The most entries this build will hold.
///
/// Not a limit anybody will reach by using the product: it is the point past which the index has
/// stopped being a list of somebody's projects and started being the output of something writing
/// to it in a loop. Refusing to save is better than growing a file that takes a second to parse
/// every time the application starts.
pub const MAX_ENTRIES: usize = 10_000;

/// The index revision. Additive-only; a value this build does not know is refused rather than
/// guessed at, the way `encastra-project` treats its own.
pub const LIBRARY_SCHEMA: u32 = 1;

/// The most of a file [`status`] will read to decide whether it changed.
///
/// Above this, the answer is [`Status::Present`] without hashing. A project that large is
/// already outside what this build will publish, and reading 64 MB from disk to redraw a list
/// would make opening the application feel broken. The length is still compared, so a file that
/// grew or shrank is still caught.
pub const MAX_BYTES_TO_HASH: u64 = 64 * 1024 * 1024;

/// Where an entry came from, which is the only thing that decides what may be done to it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Origin {
    /// Made here, and living wherever its author put it. Never deleted by this software.
    Created,
    /// Taken in from a publication folder, and living under `imports/`. The one kind this
    /// software may remove, because it is the one kind it created.
    Imported,
    /// A publication folder this person prepared to hand to somebody else.
    Prepared,
}

/// One thing somebody has.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Entry {
    /// Stable for the life of the thing it names, and generated rather than chosen — see
    /// [`entry_for_project`] and [`entry_for_import`] for what each is derived from.
    pub id: String,
    pub origin: Origin,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// The `.encastra` file for something created or imported; the publication folder for
    /// something prepared. Absolute, because a relative path means something different depending
    /// on where the application happened to be started from.
    pub path: String,
    pub added_at_ms: u64,
    #[serde(default)]
    pub last_opened_ms: Option<u64>,
    /// From the project's own manifest where that is known.
    pub modified_at_ms: u64,
    /// `sha256` of the file as it was when this entry was written. Integrity, not provenance:
    /// it answers "is this still what it was", and nothing about who made it.
    #[serde(default)]
    pub checksum: Option<String>,
    #[serde(default)]
    pub size_bytes: Option<u64>,
    pub steps: usize,
    /// The range of runtimes the project states it works with.
    pub runtime: String,
    #[serde(default)]
    pub listing_id: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub publisher: Option<String>,
    /// What it will ask to reach when it runs. Present for an import, where the check that
    /// produced it has already been run against the project itself.
    #[serde(default)]
    pub capabilities: Vec<String>,
}

/// The index itself.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Library {
    pub schema: u32,
    #[serde(default)]
    pub entries: Vec<Entry>,
}

impl Default for Library {
    fn default() -> Self {
        Library {
            schema: LIBRARY_SCHEMA,
            entries: Vec::new(),
        }
    }
}

/// Why the index could not be read, written or acted on.
///
/// `Clone` because the desktop application holds one of these for the life of a session when the
/// index could not be read at all, and hands a copy to every command that would otherwise have
/// written to it. Copying the refusal is what lets each of them say the same specific thing.
#[derive(Debug, Clone, thiserror::Error, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum LibraryError {
    #[error("the library index could not be read: {reason}")]
    Corrupt { reason: String },
    #[error(
        "the library index was written by another version of Encastra (schema {theirs}, this build reads {ours})"
    )]
    WrittenByAnotherVersion { ours: u32, theirs: u32 },
    #[error("a library holds at most {max} things, and this one has {count}")]
    TooManyEntries { count: usize, max: usize },
    #[error("that is not something this software put there, so it is not something it will remove")]
    NotOurs,
    #[error("the library could not be read or written ({reason})")]
    Io { reason: String },
}

impl From<std::io::Error> for LibraryError {
    fn from(e: std::io::Error) -> Self {
        // The kind, never the message: the message carries the path it failed on, and these end
        // up in logs and on screen.
        LibraryError::Io {
            reason: e.kind().to_string(),
        }
    }
}

/// An index that was read, and what had to be done to it first.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Recovered {
    pub library: Library,
    /// The name the unreadable index was moved to, when there was one. A file name rather than a
    /// path, because that is all anybody needs to be told and a path is somebody's home folder.
    pub quarantined_as: Option<String>,
}

impl Library {
    /// Reads the index, or says why it could not.
    ///
    /// A missing file is an empty library: somebody who has never opened this has no projects,
    /// which is not an error. Anything else — unparseable, a schema from elsewhere, more entries
    /// than this build holds — is reported rather than repaired, because each of those has a
    /// different right answer and this is not the place that knows which.
    pub fn load(root: &Path) -> Result<Library, LibraryError> {
        let text = match std::fs::read_to_string(root.join(INDEX_FILE)) {
            Ok(text) => text,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Library::default()),
            Err(e) => return Err(e.into()),
        };

        let library: Library = serde_json::from_str(&text).map_err(|e| LibraryError::Corrupt {
            reason: e.to_string(),
        })?;
        if library.schema != LIBRARY_SCHEMA {
            return Err(LibraryError::WrittenByAnotherVersion {
                ours: LIBRARY_SCHEMA,
                theirs: library.schema,
            });
        }
        if library.entries.len() > MAX_ENTRIES {
            return Err(LibraryError::TooManyEntries {
                count: library.entries.len(),
                max: MAX_ENTRIES,
            });
        }
        Ok(library)
    }

    /// Reads the index, and if it cannot be parsed, moves it aside and starts an empty one.
    ///
    /// Only [`LibraryError::Corrupt`] is treated this way. A schema from another version is a
    /// readable file this build has no business renaming, and a file with too many entries is
    /// somebody's record of their work — losing either because starting fresh is convenient is
    /// exactly the behaviour this function exists to keep narrow.
    ///
    /// The file is renamed, never deleted. Something wrote nonsense there and the copy is the
    /// only evidence of what.
    pub fn load_or_quarantine(root: &Path) -> Result<Recovered, LibraryError> {
        match Library::load(root) {
            Ok(library) => Ok(Recovered {
                library,
                quarantined_as: None,
            }),
            Err(LibraryError::Corrupt { .. }) => {
                let name = format!("{INDEX_FILE}.corrupt-{}", now_ms());
                std::fs::rename(root.join(INDEX_FILE), root.join(&name))?;
                Ok(Recovered {
                    library: Library::default(),
                    quarantined_as: Some(name),
                })
            }
            Err(other) => Err(other),
        }
    }

    /// Writes the index, all of it or none of it.
    ///
    /// Written beside the target and moved into place, so an interrupted save leaves the previous
    /// index intact rather than a truncated file where somebody's list of projects used to be.
    /// The same reasoning as `Project::save`, for the same reason.
    pub fn save(&self, root: &Path) -> Result<(), LibraryError> {
        if self.entries.len() > MAX_ENTRIES {
            return Err(LibraryError::TooManyEntries {
                count: self.entries.len(),
                max: MAX_ENTRIES,
            });
        }
        std::fs::create_dir_all(root)?;

        let body = serde_json::to_vec_pretty(self).map_err(|e| LibraryError::Corrupt {
            reason: e.to_string(),
        })?;
        let temporary = root.join(format!("{INDEX_FILE}.tmp"));
        std::fs::write(&temporary, body)?;
        std::fs::rename(&temporary, root.join(INDEX_FILE))?;
        Ok(())
    }

    /// Adds an entry, or replaces the one already there.
    ///
    /// `added_at_ms` survives, because it is when this arrived and that does not change when the
    /// file is opened again. Everything else is taken from the new entry, which was measured
    /// more recently than the old one.
    pub fn upsert(&mut self, entry: Entry) {
        match self.entries.iter_mut().find(|e| e.id == entry.id) {
            Some(existing) => {
                let added_at_ms = existing.added_at_ms;
                *existing = entry;
                existing.added_at_ms = added_at_ms;
            }
            None => self.entries.push(entry),
        }
    }

    /// Forgets an entry. Removes nothing from disk — see [`remove_imported_copy`] for that, which
    /// is a separate act on purpose: taking something out of a list and deleting somebody's file
    /// are different decisions and should not be one call.
    pub fn remove(&mut self, id: &str) -> Option<Entry> {
        let at = self.entries.iter().position(|e| e.id == id)?;
        Some(self.entries.remove(at))
    }

    pub fn find(&self, id: &str) -> Option<&Entry> {
        self.entries.iter().find(|e| e.id == id)
    }

    pub fn find_by_path(&self, path: &str) -> Option<&Entry> {
        self.entries.iter().find(|e| e.path == path)
    }
}

/// Whether what an entry names is still there, and still what it was.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Status {
    Present,
    /// The path names nothing. Somebody moved or deleted it outside this software, which is
    /// their right — the entry is stale, not wrong.
    Missing,
    /// It is there and its content differs from what was recorded.
    Changed,
}

/// Looks at what an entry names and says which of the three it is.
///
/// Computed rather than stored, because a stored answer is out of date the moment somebody
/// touches the file in another program — which they will, since these are ordinary files in
/// ordinary folders.
///
/// Links are followed here, unlike everywhere in `encastra-publish::import`: a person who put
/// their projects behind a link did so deliberately, and the question being answered is "is my
/// project still there", not "is this folder exactly what it claims to be".
pub fn status(entry: &Entry) -> Status {
    let path = Path::new(&entry.path);
    let Ok(meta) = std::fs::metadata(path) else {
        return Status::Missing;
    };

    // A prepared publication is a folder, and a folder has nothing single to hash. That it is
    // still there is the whole of what can be said about it.
    if meta.is_dir() {
        return Status::Present;
    }
    if let Some(size) = entry.size_bytes
        && meta.len() != size
    {
        return Status::Changed;
    }
    let Some(checksum) = entry.checksum.as_deref() else {
        return Status::Present;
    };
    if meta.len() > MAX_BYTES_TO_HASH {
        return Status::Present;
    }
    match std::fs::read(path) {
        Ok(bytes) if encastra_project::hash(&bytes) == checksum => Status::Present,
        Ok(_) => Status::Changed,
        // It was there a moment ago and is not readable now. Saying it is gone is closer to
        // true than saying it is fine.
        Err(_) => Status::Missing,
    }
}

/// Deletes the copy made when a publication was taken in, and nothing else.
///
/// Two conditions, both of which have to hold, and neither of which is taken from the entry
/// alone: the entry has to say it was imported, and the folder it names has to *actually* be
/// inside this library's `imports/` once every link in both paths has been resolved. Checking
/// the stored string would be checking something a corrupt index can say anything it likes
/// about, and `..` in a path that is never resolved points wherever it wants.
///
/// A created project's file is never removed by this, whatever an entry claims. The person made
/// it; this software did not, and does not get to delete it.
pub fn remove_imported_copy(root: &Path, entry: &Entry) -> Result<(), LibraryError> {
    if entry.origin != Origin::Imported {
        return Err(LibraryError::NotOurs);
    }

    let imports = std::fs::canonicalize(root.join("imports")).map_err(|_| LibraryError::NotOurs)?;
    let Some(folder) = Path::new(&entry.path).parent() else {
        return Err(LibraryError::NotOurs);
    };
    let folder = match std::fs::canonicalize(folder) {
        Ok(folder) => folder,
        // Somebody already removed it by hand. Nothing was deleted here and nothing needs to be,
        // so this is a success rather than a complaint about a tidy filesystem.
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e.into()),
    };

    // `starts_with` on a path compares whole components, so `imports-old` does not start with
    // `imports`. The equality check is the other end of it: the store itself is not one import.
    if folder == imports || !folder.starts_with(&imports) {
        return Err(LibraryError::NotOurs);
    }
    std::fs::remove_dir_all(&folder)?;
    Ok(())
}

/// An entry for a project this person made or opened.
///
/// The identity is derived from the path, because for something created here that is what it is:
/// there is no listing, no publisher and no version, and two files in two places are two
/// projects even if their contents are identical. Renaming the file makes a new entry, which is
/// the honest outcome — this software was not told about the rename and has no way to know.
pub fn entry_for_project(project: &Project, path: &Path, bytes: &[u8], now_ms: u64) -> Entry {
    Entry {
        id: identity_of(&path.to_string_lossy()),
        origin: Origin::Created,
        name: project.manifest.name.clone(),
        description: project.manifest.description.clone(),
        path: path.to_string_lossy().into_owned(),
        added_at_ms: now_ms,
        last_opened_ms: Some(now_ms),
        modified_at_ms: project.manifest.modified_at_ms,
        checksum: Some(encastra_project::hash(bytes)),
        size_bytes: Some(bytes.len() as u64),
        steps: project.graph.nodes.len(),
        runtime: project.manifest.runtime.clone(),
        listing_id: None,
        version: None,
        publisher: None,
        // Left empty rather than guessed at. A capability list is read out of the component
        // manifests, which needs a registry, and this function is not given one — an invented
        // list would be worse than an absent one, because somebody would read it.
        capabilities: Vec::new(),
    }
}

/// An entry for a publication that was taken in.
///
/// The identity is the listing name and version rather than the path, because that is what this
/// is: the same version of the same publication is the same thing wherever it was put, and
/// importing it twice should find the entry that is already there.
pub fn entry_for_import(imported: &Imported, now_ms: u64) -> Entry {
    let inspected = &imported.inspected;
    let bundle = &inspected.bundle;
    Entry {
        id: identity_of(&format!(
            "{}@{}",
            bundle.draft.listing_id, bundle.draft.version
        )),
        origin: Origin::Imported,
        name: inspected.project_name.clone(),
        description: inspected.project_description.clone(),
        path: imported.project_path.to_string_lossy().into_owned(),
        added_at_ms: now_ms,
        last_opened_ms: None,
        // When the publication was prepared. The project's own modification time is not carried
        // in the document, and inventing one from the clock here would say the project was
        // changed at the moment it was imported, which it was not.
        modified_at_ms: bundle.prepared_at_ms,
        checksum: Some(bundle.checksum.clone()),
        size_bytes: Some(bundle.size_bytes),
        steps: inspected.steps,
        runtime: bundle.runtime.clone(),
        listing_id: Some(bundle.draft.listing_id.clone()),
        version: Some(bundle.draft.version.clone()),
        publisher: Some(bundle.publisher.clone()),
        // Safe to take from the document: importing refused unless this list was exactly the one
        // the check produced from the components themselves.
        capabilities: bundle.capabilities.clone(),
    }
}

/// A short, stable name for something, from whatever identifies it.
///
/// Sixteen hex characters of a sha256. Not a secret and not a checksum of anything: it exists so
/// that an entry can be referred to without passing a path or a name around, and so that two
/// entries for the same thing collide on purpose.
fn identity_of(text: &str) -> String {
    encastra_project::hash(text.as_bytes())[..16].to_owned()
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    struct Sandbox(PathBuf);

    impl Sandbox {
        fn new(name: &str) -> Self {
            let path = std::env::temp_dir()
                .join("encastra-library-tests")
                .join(format!("{}-{name}", std::process::id()));
            let _ = std::fs::remove_dir_all(&path);
            std::fs::create_dir_all(&path).expect("the sandbox can be created");
            Sandbox(path)
        }
        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for Sandbox {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn entry(id: &str, path: &str) -> Entry {
        Entry {
            id: id.into(),
            origin: Origin::Created,
            name: "Thumbnails".into(),
            description: Some("Makes a small copy of every picture.".into()),
            path: path.into(),
            added_at_ms: 1_000,
            last_opened_ms: None,
            modified_at_ms: 2_000,
            checksum: None,
            size_bytes: None,
            steps: 3,
            runtime: ">=0.4.0".into(),
            listing_id: None,
            version: None,
            publisher: None,
            capabilities: Vec::new(),
        }
    }

    #[test]
    fn an_index_survives_a_round_trip_through_the_disk() {
        let sandbox = Sandbox::new("round-trip");
        let mut library = Library::default();
        library.upsert(entry("a", "/projects/one.encastra"));
        library.upsert(entry("b", "/projects/two.encastra"));
        library.save(sandbox.path()).expect("it saves");

        let back = Library::load(sandbox.path()).expect("it loads");
        assert_eq!(back, library);
        assert_eq!(
            back.find("b").map(|e| e.path.as_str()),
            Some("/projects/two.encastra")
        );
        assert_eq!(
            back.find_by_path("/projects/one.encastra")
                .map(|e| e.id.as_str()),
            Some("a")
        );
        assert!(back.find("nothing").is_none());
    }

    #[test]
    fn a_library_nobody_has_written_yet_is_empty_rather_than_broken() {
        let sandbox = Sandbox::new("absent");
        let library = Library::load(sandbox.path()).expect("a missing index is not an error");
        assert_eq!(library, Library::default());
        assert!(library.entries.is_empty());
    }

    #[test]
    fn saving_leaves_nothing_half_written_beside_the_index() {
        let sandbox = Sandbox::new("atomic");
        let mut library = Library::default();
        library.upsert(entry("a", "/projects/one.encastra"));
        library.save(sandbox.path()).expect("it saves");
        library.upsert(entry("b", "/projects/two.encastra"));
        library.save(sandbox.path()).expect("it saves again");

        let names: Vec<String> = std::fs::read_dir(sandbox.path())
            .expect("readable")
            .map(|e| e.expect("entry").file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(
            names,
            vec![INDEX_FILE.to_string()],
            "the staging file has to be gone, not left beside the real one"
        );
    }

    #[test]
    fn re_adding_something_keeps_the_day_it_arrived() {
        let mut library = Library::default();
        library.upsert(entry("a", "/projects/one.encastra"));

        let mut opened_again = entry("a", "/projects/one.encastra");
        opened_again.added_at_ms = 9_999;
        opened_again.last_opened_ms = Some(5_000);
        opened_again.steps = 7;
        library.upsert(opened_again);

        assert_eq!(library.entries.len(), 1);
        let stored = library.find("a").expect("still there");
        // When it arrived does not change because somebody opened it again.
        assert_eq!(stored.added_at_ms, 1_000);
        assert_eq!(stored.last_opened_ms, Some(5_000));
        assert_eq!(stored.steps, 7);
    }

    #[test]
    fn forgetting_an_entry_hands_it_back() {
        let mut library = Library::default();
        library.upsert(entry("a", "/projects/one.encastra"));
        library.upsert(entry("b", "/projects/two.encastra"));

        let gone = library.remove("a").expect("it was there");
        assert_eq!(gone.id, "a");
        assert!(library.find("a").is_none());
        assert_eq!(library.entries.len(), 1);
        assert!(library.remove("a").is_none());
    }

    #[test]
    fn an_index_that_cannot_be_read_is_reported_rather_than_replaced() {
        let sandbox = Sandbox::new("corrupt");
        std::fs::write(sandbox.path().join(INDEX_FILE), b"{ not json").expect("written");

        // Load says what is wrong and changes nothing: the file is still there afterwards,
        // because deciding to start over is not this function's decision to make.
        assert!(matches!(
            Library::load(sandbox.path()),
            Err(LibraryError::Corrupt { .. })
        ));
        assert!(sandbox.path().join(INDEX_FILE).exists());

        let recovered = Library::load_or_quarantine(sandbox.path()).expect("it recovers");
        assert!(recovered.library.entries.is_empty());
        let name = recovered.quarantined_as.expect("it says what it did");
        assert!(name.starts_with("library.json.corrupt-"), "{name}");
        assert!(
            sandbox.path().join(&name).exists(),
            "the unreadable file is moved aside, never deleted"
        );
        assert!(!sandbox.path().join(INDEX_FILE).exists());

        // And the second time there is nothing to quarantine.
        let again = Library::load_or_quarantine(sandbox.path()).expect("it loads");
        assert_eq!(again.quarantined_as, None);
    }

    #[test]
    fn an_index_from_another_version_is_not_quarantined() {
        let sandbox = Sandbox::new("other-schema");
        std::fs::write(
            sandbox.path().join(INDEX_FILE),
            br#"{"schema":99,"entries":[]}"#,
        )
        .expect("written");

        assert_eq!(
            Library::load(sandbox.path()),
            Err(LibraryError::WrittenByAnotherVersion {
                ours: LIBRARY_SCHEMA,
                theirs: 99
            })
        );
        // It parsed. It is somebody's library, written by a build that understood it, and
        // renaming it here would be this build destroying a file it simply cannot read.
        assert!(Library::load_or_quarantine(sandbox.path()).is_err());
        assert!(sandbox.path().join(INDEX_FILE).exists());
    }

    #[test]
    fn a_library_larger_than_this_build_holds_is_refused_rather_than_truncated() {
        let sandbox = Sandbox::new("too-many");
        let mut library = Library::default();
        for n in 0..=MAX_ENTRIES {
            library.upsert(entry(
                &format!("id-{n}"),
                &format!("/projects/{n}.encastra"),
            ));
        }
        assert_eq!(
            library.save(sandbox.path()),
            Err(LibraryError::TooManyEntries {
                count: MAX_ENTRIES + 1,
                max: MAX_ENTRIES,
            })
        );
        assert!(
            !sandbox.path().join(INDEX_FILE).exists(),
            "a refused save must not have written anything"
        );
    }

    #[test]
    fn a_file_is_present_missing_or_changed_by_what_is_in_it() {
        let sandbox = Sandbox::new("status");
        let path = sandbox.path().join("one.encastra");
        let bytes = b"a project file";
        std::fs::write(&path, bytes).expect("written");

        let mut e = entry("a", &path.to_string_lossy());
        e.checksum = Some(encastra_project::hash(bytes));
        e.size_bytes = Some(bytes.len() as u64);
        assert_eq!(status(&e), Status::Present);

        // Same length, different content: this is the case a timestamp or a size would miss.
        std::fs::write(&path, b"a project FILE").expect("written");
        assert_eq!(status(&e), Status::Changed);

        std::fs::remove_file(&path).expect("removed");
        assert_eq!(status(&e), Status::Missing);

        // Nothing recorded to compare against is not evidence of a change.
        let mut unmeasured = entry("b", &path.to_string_lossy());
        std::fs::write(&path, b"anything").expect("written");
        unmeasured.checksum = None;
        unmeasured.size_bytes = None;
        assert_eq!(status(&unmeasured), Status::Present);
    }

    #[test]
    fn a_prepared_folder_counts_as_present_without_being_hashed() {
        let sandbox = Sandbox::new("status-folder");
        let folder = sandbox.path().join("dev.alice.thumbnails-1.0.0");
        std::fs::create_dir_all(&folder).expect("created");

        let mut e = entry("a", &folder.to_string_lossy());
        e.origin = Origin::Prepared;
        e.checksum = Some("0".repeat(64));
        assert_eq!(status(&e), Status::Present);
    }

    #[test]
    fn only_an_imported_copy_is_ever_deleted_and_only_from_inside_imports() {
        let sandbox = Sandbox::new("remove");
        let root = sandbox.path();
        let landed = root
            .join("imports")
            .join("dev.alice.thumbnails")
            .join("1.0.0");
        std::fs::create_dir_all(&landed).expect("created");
        std::fs::write(landed.join("thumbnails.encastra"), b"x").expect("written");

        // Somebody's own project, which this software did not put anywhere.
        let mine = root.join("mine.encastra");
        std::fs::write(&mine, b"my work").expect("written");
        let created = entry("mine", &mine.to_string_lossy());
        assert_eq!(
            remove_imported_copy(root, &created),
            Err(LibraryError::NotOurs)
        );
        assert!(mine.exists(), "a created project is never deleted");

        // An entry that says "imported" and points at it anyway, through `..`, which is the
        // shape a corrupt or hostile index would take.
        let mut climbing = entry(
            "climb",
            &root
                .join("imports")
                .join("..")
                .join("mine.encastra")
                .to_string_lossy(),
        );
        climbing.origin = Origin::Imported;
        assert_eq!(
            remove_imported_copy(root, &climbing),
            Err(LibraryError::NotOurs)
        );
        assert!(mine.exists(), "`..` must be resolved before it is trusted");

        // The store itself is not one import.
        let mut whole_store = entry(
            "store",
            &root.join("imports").join("anything").to_string_lossy(),
        );
        whole_store.origin = Origin::Imported;
        assert_eq!(
            remove_imported_copy(root, &whole_store),
            Err(LibraryError::NotOurs)
        );
        assert!(root.join("imports").exists());

        // And the real one goes.
        let mut imported = entry(
            "real",
            &landed.join("thumbnails.encastra").to_string_lossy(),
        );
        imported.origin = Origin::Imported;
        remove_imported_copy(root, &imported).expect("this one is ours");
        assert!(!landed.exists());

        // Doing it twice is not an error: there is nothing there and nothing was deleted.
        remove_imported_copy(root, &imported).expect("nothing left to remove");
    }

    #[test]
    fn an_entry_for_a_project_is_measured_from_the_project() {
        let mut project = Project::new("Thumbnails", 1_000);
        project.manifest.description = Some("Makes small copies.".into());
        project.manifest.modified_at_ms = 2_000;
        let bytes = project.to_bytes().expect("serialises");

        let path = Path::new("/projects/thumbnails.encastra");
        let e = entry_for_project(&project, path, &bytes, 3_000);

        assert_eq!(e.origin, Origin::Created);
        assert_eq!(e.name, "Thumbnails");
        assert_eq!(e.description.as_deref(), Some("Makes small copies."));
        assert_eq!(e.modified_at_ms, 2_000);
        assert_eq!(e.added_at_ms, 3_000);
        assert_eq!(e.checksum, Some(encastra_project::hash(&bytes)));
        assert_eq!(e.size_bytes, Some(bytes.len() as u64));
        assert_eq!(e.runtime, project.manifest.runtime);
        assert!(
            e.capabilities.is_empty(),
            "nothing here can read a component manifest, so nothing here may claim to know"
        );
        assert_eq!(e.id.len(), 16);
        // The path is the identity, so the same file gives the same entry and a different file
        // gives a different one, whatever is inside them.
        assert_eq!(e.id, entry_for_project(&project, path, &bytes, 9_000).id);
        assert_ne!(
            e.id,
            entry_for_project(
                &project,
                Path::new("/elsewhere/thumbnails.encastra"),
                &bytes,
                3_000
            )
            .id
        );
    }
}
