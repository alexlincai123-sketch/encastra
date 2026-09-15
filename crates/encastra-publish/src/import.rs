//! The receiving side of a publication.
//!
//! [`crate::review`] is the check somebody runs on their own work before offering it. This is
//! the same check run by the person on the other end, on a folder that arrived from somewhere,
//! and the difference between the two is who is trusted. Nothing here is: the document was
//! written by whoever prepared the publication, the project file was chosen by them too, and
//! both are read as claims to be tested rather than facts to be recorded.
//!
//! **Importing never runs anything.** It does not open a socket, does not execute a graph, does
//! not resolve a variable and does not follow a link out of the folder it was given. It reads
//! two files, decides, and — if it agrees — copies bytes it has already verified into a folder
//! the person owns.
//!
//! Three properties are worth stating because they are the ones a careless version would lose:
//!
//! - **The bytes that are checked are the bytes that are kept.** [`import`] never reads the
//!   source file a second time. Verifying a file and then copying it is two reads of something
//!   somebody else can change in between, and the copy is the one that ends up installed.
//! - **The document has to agree with the project.** A `publication.json` that understates the
//!   permissions, names a different runtime, or claims a namespace it does not own is refused
//!   outright. A disclosure that does not match what it describes is worse than no disclosure,
//!   because somebody read it.
//! - **A checksum is integrity, not provenance.** [`Inspected::provenance_verified`] is always
//!   false in this build. The hash says the bytes did not change on the way; it says nothing
//!   about who made them, and the signature that would is ADR-0008, which does not exist here.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use encastra_core::registry::ComponentRegistry;
use encastra_project::Project;
use serde::Serialize;

use crate::bundle::{MAX_PUBLICATION_BYTES, PublicationBundle, has_control_characters};
use crate::listing::{Kind, Publisher, is_listing_id};
use crate::review::{Finding, Outcome, Review, Severity};

/// The name every publication folder uses for its document. Written by the desktop's
/// `prepare_publication`; looked for by name here, so that nothing else in the folder can
/// present itself as one.
pub const DOCUMENT_FILE: &str = "publication.json";

/// The extension of the one project file a publication folder holds.
pub const PROJECT_EXTENSION: &str = "encastra";

/// The largest `publication.json` this build will read.
///
/// The document is a page of metadata: a title, a summary, a hash, a list of capabilities. A
/// quarter of a megabyte is already generous by two orders of magnitude. It is a ceiling rather
/// than a target because the file arrived from somewhere, and reading an arbitrary number of
/// bytes somebody else chose is the cheapest denial of service there is.
pub const MAX_DOCUMENT_BYTES: u64 = 256 * 1024;

/// The longest a publication's title may be.
pub const MAX_TITLE_CHARS: usize = 120;

/// The longest a publication's summary may be.
pub const MAX_SUMMARY_CHARS: usize = 2000;

/// The longest a publication's changelog may be.
pub const MAX_CHANGELOG_CHARS: usize = 8000;

/// Why a publication could not be taken in.
///
/// Serialised so the interface can tell one refusal from another rather than matching on
/// English, which changes when somebody improves a sentence. No variant carries a path from the
/// machine the folder came from or the machine reading it: a file **name** inside the folder is
/// as specific as any of these get, because the rest is nobody's business and error text ends
/// up in logs.
#[derive(Debug, thiserror::Error, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum ImportError {
    #[error("that is not a folder")]
    NotAFolder,
    #[error("that folder is a link to somewhere else")]
    FolderIsALink,
    /// The folder did not come from the native chooser this session. The crate itself never
    /// raises this — it has no notion of a chooser — but the desktop application does, and the
    /// refusal belongs in the same vocabulary as every other one so an interface can name it.
    #[error("that folder was not chosen in this session; pick it with the folder chooser")]
    FolderNotChosen,
    #[error("there is no publication.json in that folder, so there is nothing saying what it is")]
    NoDocument,
    #[error("publication.json is a link to another file rather than a file")]
    DocumentIsALink,
    #[error("publication.json is {size} bytes, and this build reads at most {max}")]
    DocumentTooLarge { size: u64, max: u64 },
    #[error("publication.json could not be read: {reason}")]
    DocumentUnreadable { reason: String },
    #[error("there is no project file in that folder")]
    NoProject,
    #[error("a publication is one project, and that folder holds {}", names.join(", "))]
    MoreThanOneProject { names: Vec<String> },
    #[error("the project file is a link to another file rather than a file")]
    ProjectIsALink,
    #[error(
        "a publication folder holds a document and a project and nothing else; this one also \
         holds {}",
        names.join(", ")
    )]
    UnexpectedEntries { names: Vec<String> },
    #[error("the project file is {size} bytes, and this build installs at most {max}")]
    ProjectTooLarge { size: u64, max: u64 },
    #[error("the project file is not the one this publication describes")]
    ChecksumMismatch,
    #[error("the project file could not be read: {reason}")]
    ProjectUnreadable { reason: String },
    #[error("this build cannot install a {kind:?}, so it will not pretend to")]
    NotInstallable {
        // Serialised under another name: the enum is internally tagged on `kind`, and a field
        // called `kind` would land on top of the tag that says which refusal this is.
        #[serde(rename = "publicationKind")]
        kind: Kind,
    },
    #[error("\"{id}\" is not a publication name")]
    NotAListingId { id: String },
    #[error("\"{version}\" is not a version; publications are numbered like 1.2.0")]
    NotAVersion { version: String },
    #[error("\"{listing}\" is not inside {publisher}'s namespace")]
    NotPublishersNamespace { listing: String, publisher: String },
    #[error("the {field} is longer than this build will read ({max} characters)")]
    TextTooLong { field: &'static str, max: usize },
    #[error("the {field} holds characters that can hide what it really says")]
    TextHasControlCharacters { field: &'static str },
    #[error("publication.json and the project disagree about the {about}")]
    DocumentDisagreesWithProject { about: &'static str },
    #[error("this publication is for a runtime {requires}, and this one is {have}")]
    RuntimeIncompatible { requires: String, have: String },
    #[error(
        "the same check its publisher ran refuses it here: {} thing(s) would have to change",
        findings.len()
    )]
    ReviewRefused { findings: Vec<Finding> },
    #[error(
        "publication.json says this asks for {declared:?}, and it actually asks for {actual:?}"
    )]
    CapabilitiesDisagree {
        declared: Vec<String>,
        actual: Vec<String>,
    },
    #[error("{listing} {version} is already here")]
    AlreadyImported { listing: String, version: String },
    /// Something the filesystem refused, as its kind and nothing else — the message would carry
    /// the path it failed on.
    #[error("the folder could not be read ({reason})")]
    Io { reason: String },
}

impl From<std::io::Error> for ImportError {
    fn from(e: std::io::Error) -> Self {
        // The kind, never the message: an io error message on either platform carries the path
        // it failed on, and these end up in logs and on screen.
        ImportError::Io {
            reason: e.kind().to_string(),
        }
    }
}

/// Everything read out of a publication folder, and nothing taken on trust.
///
/// Every field here was either measured from the project itself or copied from a document that
/// has already been checked against it. Holding one of these means the folder passed; it does
/// not mean anything has been written anywhere.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Inspected {
    pub bundle: PublicationBundle,
    /// The file name inside the folder, never a path.
    pub project_file: String,
    pub project_name: String,
    pub project_id: String,
    pub project_description: Option<String>,
    /// Steps in the graph, so somebody can see how big this is before taking it.
    pub steps: usize,
    pub steps_switched_off: usize,
    pub versions: usize,
    /// The findings of the check run on this machine, on these bytes. Nothing blocking survives
    /// to here — a refusal is an error, not a field — so what is left is what is worth reading.
    pub review: Review,
    /// Always false in this build: no signature exists, and the checksum is integrity, not
    /// provenance. It is a field rather than an omission so that an interface has to render
    /// "no" rather than being free to imply "yes" by saying nothing.
    pub provenance_verified: bool,
    /// Always false in this build. There are no accounts, so there is nobody to have checked
    /// that a publisher is who the name says.
    pub publisher_verified: bool,
}

/// A publication that is now on this machine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Imported {
    pub inspected: Inspected,
    /// Where it landed.
    pub folder: PathBuf,
    pub project_path: PathBuf,
}

/// Reads a publication folder and decides, without writing anything or running anything.
///
/// The order is fixed and runs from cheapest to most specific: what the folder is, then whether
/// the bytes are the bytes, then whether the document is coherent, then whether this build could
/// run it, then the review, then whether the document told the truth about permissions. A caller
/// gets the first thing that is wrong rather than a list, because the first thing is usually the
/// only real one and the rest are its consequences.
///
/// `runtime_version` is the runtime doing the asking — `encastra_core::RUNTIME_VERSION` in the
/// application. It is a parameter so that a test can ask the question for a runtime it is not.
pub fn inspect(
    folder: &Path,
    registry: &dyn ComponentRegistry,
    runtime_version: &str,
) -> Result<Inspected, ImportError> {
    read_publication(folder, registry, runtime_version).map(|(inspected, _)| inspected)
}

/// Takes a publication in, copying the bytes that were verified rather than reading them again.
///
/// It lands in `library_root/imports/<listing id>/<version>/`, which is one folder per version
/// so that taking in 1.1.0 cannot overwrite the 1.0.0 somebody is still using. The whole folder
/// is built beside its destination and moved into place, so an interrupted import leaves a
/// half-written temporary directory rather than a half-written publication that looks complete.
///
/// The document written here is re-serialised from the parsed bundle, not copied. Bytes that
/// parsed once are not necessarily bytes that parse the same way twice — trailing data, a
/// duplicate key, anything a different reader would resolve differently — and what is kept
/// should be what was actually checked.
pub fn import(
    folder: &Path,
    registry: &dyn ComponentRegistry,
    runtime_version: &str,
    library_root: &Path,
) -> Result<Imported, ImportError> {
    let (inspected, project_bytes) = read_publication(folder, registry, runtime_version)?;

    let listing = inspected.bundle.draft.listing_id.clone();
    let version = inspected.bundle.draft.version.clone();

    // Both are already known good — `is_listing_id` refuses empty segments and semver refuses
    // separators — and both are about to become path segments. Checking again costs nothing and
    // means a future change to either rule cannot quietly turn a name into a path.
    if !is_path_segment(&listing) {
        return Err(ImportError::NotAListingId { id: listing });
    }
    if !is_path_segment(&version) {
        return Err(ImportError::NotAVersion { version });
    }
    if !is_path_segment(&inspected.project_file) {
        return Err(ImportError::ProjectUnreadable {
            reason: "the project file is not named like a file".into(),
        });
    }

    let shelf = library_root.join("imports").join(&listing);
    let destination = shelf.join(&version);
    if destination.exists() {
        return Err(ImportError::AlreadyImported { listing, version });
    }

    let staging = shelf.join(format!(".{version}.importing-{}", nonce()));
    std::fs::create_dir_all(&staging)?;

    let write = (|| -> Result<(), ImportError> {
        std::fs::write(staging.join(&inspected.project_file), &project_bytes)?;
        let document = serde_json::to_vec_pretty(&inspected.bundle).map_err(|e| {
            ImportError::DocumentUnreadable {
                reason: e.to_string(),
            }
        })?;
        std::fs::write(staging.join(DOCUMENT_FILE), document)?;
        Ok(())
    })();
    if let Err(e) = write {
        let _ = std::fs::remove_dir_all(&staging);
        return Err(e);
    }

    if let Err(e) = std::fs::rename(&staging, &destination) {
        let _ = std::fs::remove_dir_all(&staging);
        // Somebody else won the race between the check above and here. That is the same
        // situation as finding it already there, and it should read as the same answer.
        return Err(if destination.exists() {
            ImportError::AlreadyImported { listing, version }
        } else {
            e.into()
        });
    }

    let project_path = destination.join(&inspected.project_file);
    Ok(Imported {
        inspected,
        folder: destination,
        project_path,
    })
}

// -- the decision ---------------------------------------------------------------------------

/// Everything [`inspect`] does, keeping the project bytes it verified so that [`import`] can
/// write those rather than reading the source again and hoping it did not move.
fn read_publication(
    folder: &Path,
    registry: &dyn ComponentRegistry,
    runtime_version: &str,
) -> Result<(Inspected, Vec<u8>), ImportError> {
    let contents = read_folder(folder)?;

    // -- structure ---------------------------------------------------------------------------

    let document = contents.document.ok_or(ImportError::NoDocument)?;
    if document.is_link {
        return Err(ImportError::DocumentIsALink);
    }
    if contents.projects.is_empty() {
        return Err(ImportError::NoProject);
    }
    if contents.projects.len() > 1 {
        return Err(ImportError::MoreThanOneProject {
            names: contents.projects.into_iter().map(|e| e.name).collect(),
        });
    }
    let project_file = &contents.projects[0];
    if project_file.is_link {
        return Err(ImportError::ProjectIsALink);
    }
    if !contents.others.is_empty() {
        return Err(ImportError::UnexpectedEntries {
            names: contents.others,
        });
    }

    if document.size > MAX_DOCUMENT_BYTES {
        return Err(ImportError::DocumentTooLarge {
            size: document.size,
            max: MAX_DOCUMENT_BYTES,
        });
    }
    // Measured before it is read, so an enormous project is refused by its metadata rather than
    // by the memory it would have taken to find out.
    if project_file.size > MAX_PUBLICATION_BYTES {
        return Err(ImportError::ProjectTooLarge {
            size: project_file.size,
            max: MAX_PUBLICATION_BYTES,
        });
    }

    // Bounded reads, not `fs::read`. The sizes above came from metadata a moment ago, and a file
    // can be swapped for a larger one in between; the document could then declare any size it
    // liked and the read would honour it. Reading one byte past the ceiling and refusing is the
    // same rule the project container applies to its own entries.
    let document_bytes = read_at_most(&folder.join(DOCUMENT_FILE), MAX_DOCUMENT_BYTES).ok_or(
        ImportError::DocumentTooLarge {
            size: document.size,
            max: MAX_DOCUMENT_BYTES,
        },
    )??;
    let bundle: PublicationBundle =
        serde_json::from_slice(&document_bytes).map_err(|e| ImportError::DocumentUnreadable {
            reason: e.to_string(),
        })?;

    let project_bytes = read_at_most(&folder.join(&project_file.name), MAX_PUBLICATION_BYTES)
        .ok_or(ImportError::ProjectTooLarge {
            size: project_file.size,
            max: MAX_PUBLICATION_BYTES,
        })??;

    // -- integrity ---------------------------------------------------------------------------

    // Which side is wrong is not knowable from here and guessing would be a lie: the document
    // may describe a different file, or the file may have been changed since. Either way it is
    // not the thing that was described, and there is nothing to do but stop.
    if !bundle.matches(&project_bytes) {
        return Err(ImportError::ChecksumMismatch);
    }

    let project =
        Project::from_bytes(&project_bytes).map_err(|e| ImportError::ProjectUnreadable {
            reason: e.to_string(),
        })?;

    // -- the document ------------------------------------------------------------------------

    if !bundle.draft.kind.installable_in_this_build() {
        return Err(ImportError::NotInstallable {
            kind: bundle.draft.kind,
        });
    }
    if !is_listing_id(&bundle.draft.listing_id) {
        return Err(ImportError::NotAListingId {
            id: bundle.draft.listing_id,
        });
    }
    if semver::Version::parse(&bundle.draft.version).is_err() {
        return Err(ImportError::NotAVersion {
            version: bundle.draft.version,
        });
    }
    // The sender checked this too. The sender is also whoever wrote the document, so the answer
    // has to be recomputed rather than believed.
    let publisher = Publisher {
        id: bundle.publisher.clone(),
        display_name: String::new(),
        bio: None,
        verified: false,
    };
    if !publisher.owns(&bundle.draft.listing_id) {
        return Err(ImportError::NotPublishersNamespace {
            listing: bundle.draft.listing_id,
            publisher: bundle.publisher,
        });
    }
    check_text(&bundle)?;

    // -- compatibility -----------------------------------------------------------------------

    // The document states the runtime range separately from the project, and it is the document
    // somebody reads before deciding. If the two differ, the page is describing something other
    // than the file beside it.
    if bundle.runtime != project.manifest.runtime {
        return Err(ImportError::DocumentDisagreesWithProject { about: "runtime" });
    }
    let compatible = match (
        semver::VersionReq::parse(&bundle.runtime),
        semver::Version::parse(runtime_version),
    ) {
        (Ok(req), Ok(version)) => req.matches(&version),
        // Unreadable on either side is a refusal, never a shrug: treating "I could not read
        // this" as "it is fine" is how something runs against a runtime nobody claimed for it.
        _ => false,
    };
    if !compatible {
        return Err(ImportError::RuntimeIncompatible {
            requires: bundle.runtime,
            have: runtime_version.to_owned(),
        });
    }

    // -- the review --------------------------------------------------------------------------

    // Exactly the check the sender ran, on this machine, against this build's components. The
    // sender's answer is not evidence: a refusal that can be skipped by editing the document is
    // not a refusal. This is what catches a component this build cannot read, a digest that no
    // longer matches, a secret left in a setting, and a path naming its author.
    let review = crate::review(&project, registry, &bundle.draft.license);
    if let Outcome::Refused { .. } = review.outcome {
        return Err(ImportError::ReviewRefused {
            findings: review
                .findings
                .into_iter()
                .filter(|f| f.severity == Severity::Blocking)
                .collect(),
        });
    }

    // -- the disclosure ----------------------------------------------------------------------

    // Understating is the obvious attack and overstating is the subtler one: a document that
    // lists permissions the project does not ask for trains people to skim the list, and the
    // day it matters they will. Both are the same refusal.
    let declared: Vec<String> = bundle
        .capabilities
        .iter()
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    if declared != review.capabilities {
        return Err(ImportError::CapabilitiesDisagree {
            declared,
            actual: review.capabilities,
        });
    }

    let inspected = Inspected {
        bundle,
        project_file: project_file.name.clone(),
        project_name: project.manifest.name.clone(),
        project_id: project.manifest.id.clone(),
        project_description: project.manifest.description.clone(),
        steps: project.graph.nodes.len(),
        steps_switched_off: project.graph.nodes.values().filter(|n| n.disabled).count(),
        versions: project.history.snapshots.len(),
        review,
        provenance_verified: false,
        publisher_verified: false,
    };
    Ok((inspected, project_bytes))
}

/// Every piece of free text in the document, held to a length and to the characters it may use.
///
/// Length first, because a title of a million characters is a denial of service against whatever
/// renders it. Then the characters that make text lie about itself: a right-to-left override
/// turns `dev.alice.sloot.exe` into something that reads as a picture, and a zero-width space
/// makes two different names look identical. They are refused rather than stripped — stripping
/// changes what somebody wrote and hands back a name they never chose.
fn check_text(bundle: &PublicationBundle) -> Result<(), ImportError> {
    let sized: [(&'static str, &str, usize); 3] = [
        ("title", bundle.draft.title.as_str(), MAX_TITLE_CHARS),
        ("summary", bundle.draft.summary.as_str(), MAX_SUMMARY_CHARS),
        (
            "changelog",
            bundle.draft.changelog.as_deref().unwrap_or_default(),
            MAX_CHANGELOG_CHARS,
        ),
    ];
    for (field, text, max) in sized {
        if text.chars().count() > max {
            return Err(ImportError::TextTooLong { field, max });
        }
    }

    let mut checked: Vec<(&'static str, &str)> = vec![
        ("title", bundle.draft.title.as_str()),
        ("summary", bundle.draft.summary.as_str()),
        ("publisher", bundle.publisher.as_str()),
    ];
    if let Some(changelog) = bundle.draft.changelog.as_deref() {
        checked.push(("changelog", changelog));
    }
    for category in &bundle.draft.categories {
        checked.push(("categories", category.as_str()));
    }
    for tag in &bundle.draft.tags {
        checked.push(("tags", tag.as_str()));
    }
    for (field, text) in checked {
        if has_control_characters(text) {
            return Err(ImportError::TextHasControlCharacters { field });
        }
    }
    Ok(())
}

// -- reading the folder ---------------------------------------------------------------------

/// One thing in the folder, as its metadata describes it rather than as following it would.
struct Entry {
    name: String,
    size: u64,
    is_link: bool,
}

/// What a publication folder holds, sorted into the two things that belong there and everything
/// that does not.
struct Contents {
    document: Option<Entry>,
    projects: Vec<Entry>,
    others: Vec<String>,
}

/// Lists a folder without following a single link.
///
/// `symlink_metadata` throughout, on the folder and on every entry, so that a link is seen as a
/// link rather than as whatever it points at. A publication folder that is itself a link, or
/// that holds a link where a file should be, is refused: following one would read a file outside
/// the folder somebody chose, which is the one thing this is not allowed to do.
fn read_folder(folder: &Path) -> Result<Contents, ImportError> {
    match std::fs::symlink_metadata(folder) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Err(ImportError::NotAFolder),
        Err(e) => return Err(e.into()),
        Ok(meta) => {
            // Checked before `is_dir`, because a link to a directory is both, and on Windows a
            // junction reads as a directory while pointing anywhere at all.
            if meta.file_type().is_symlink() {
                return Err(ImportError::FolderIsALink);
            }
            if !meta.is_dir() {
                return Err(ImportError::NotAFolder);
            }
        }
    }

    let mut contents = Contents {
        document: None,
        projects: Vec::new(),
        others: Vec::new(),
    };

    for entry in std::fs::read_dir(folder)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let meta = std::fs::symlink_metadata(entry.path())?;
        let found = Entry {
            size: meta.len(),
            is_link: meta.file_type().is_symlink(),
            name,
        };

        // A name that is not a plain file name cannot have come from a well-formed folder, and
        // is not going to be treated as one of the two things that belong here.
        if !is_path_segment(&found.name) {
            contents.others.push(found.name);
            continue;
        }
        if found.name == DOCUMENT_FILE {
            contents.document = Some(found);
        } else if is_os_litter(&found.name) && !meta.is_dir() {
            // Left where it is and never read. See `is_os_litter`.
            continue;
        } else if has_project_extension(&found.name) && !meta.is_dir() {
            contents.projects.push(found);
        } else {
            contents.others.push(found.name);
        }
    }

    // Sorted so that two runs over the same folder produce the same message, whatever order the
    // filesystem happened to hand them over in.
    contents.projects.sort_by(|a, b| a.name.cmp(&b.name));
    contents.others.sort();
    Ok(contents)
}

/// Reads a file, or stops the moment it turns out to be larger than `max`.
///
/// `None` means the ceiling was passed; `Some(Err)` is an ordinary read failure. The extra byte
/// is what distinguishes a file of exactly `max` bytes, which is fine, from one that kept going.
fn read_at_most(path: &Path, max: u64) -> Option<Result<Vec<u8>, ImportError>> {
    use std::io::Read as _;
    let file = match std::fs::File::open(path) {
        Ok(file) => file,
        Err(e) => return Some(Err(e.into())),
    };
    let mut bytes = Vec::new();
    if let Err(e) = file.take(max + 1).read_to_end(&mut bytes) {
        return Some(Err(e.into()));
    }
    if bytes.len() as u64 > max {
        return None;
    }
    Some(Ok(bytes))
}

/// Files an operating system drops into folders on its own, and which nothing here reads.
///
/// Windows Explorer writes `desktop.ini` and, on older versions, `Thumbs.db` into any folder a
/// person so much as looks at; macOS Finder writes `.DS_Store`. Refusing a publication because
/// the person opened its folder in a file manager would be refusing it for having been looked
/// at. These names are ignored — never read, never copied — and everything else unexpected is
/// still refused by name.
fn is_os_litter(name: &str) -> bool {
    ["desktop.ini", "thumbs.db", ".ds_store"]
        .iter()
        .any(|litter| name.eq_ignore_ascii_case(litter))
}

fn has_project_extension(name: &str) -> bool {
    Path::new(name)
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case(PROJECT_EXTENSION))
}

/// Whether a string is one ordinary path segment: something that can be joined onto a directory
/// and land inside it.
fn is_path_segment(text: &str) -> bool {
    !text.is_empty()
        && text != "."
        && text != ".."
        && !text.contains('/')
        && !text.contains('\\')
        && !text.contains('\0')
}

/// Something different every time, to name a staging directory.
///
/// Not a secret and not unpredictable — it only has to stop two imports running at once from
/// staging into the same directory and interleaving their files.
fn nonce() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);

    let ticks = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or_default();
    format!(
        "{}-{ticks:x}-{:x}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_name_that_is_not_one_segment_is_not_treated_as_a_file_name() {
        assert!(is_path_segment("thumbnails.encastra"));
        assert!(is_path_segment("publication.json"));
        assert!(!is_path_segment(""));
        assert!(!is_path_segment("."));
        assert!(!is_path_segment(".."));
        assert!(!is_path_segment("../escape"));
        assert!(!is_path_segment(r"..\escape"));
        assert!(!is_path_segment("sub/thing.encastra"));
    }

    #[test]
    fn what_a_file_manager_leaves_behind_is_ignored_and_nothing_else_is() {
        assert!(is_os_litter("desktop.ini"));
        assert!(is_os_litter("Desktop.INI"));
        assert!(is_os_litter("Thumbs.db"));
        assert!(is_os_litter(".DS_Store"));
        assert!(!is_os_litter("desktop.ini.txt"));
        assert!(!is_os_litter("notes.txt"));
        assert!(!is_os_litter("publication.json"));
    }

    #[test]
    fn a_project_is_recognised_by_its_extension_whatever_its_case() {
        assert!(has_project_extension("thumbnails.encastra"));
        assert!(has_project_extension("Thumbnails.ENCASTRA"));
        assert!(!has_project_extension("thumbnails.encastra.txt"));
        assert!(!has_project_extension("encastra"));
        assert!(!has_project_extension("notes.txt"));
    }

    #[test]
    fn every_staging_name_differs_from_the_last() {
        let names: BTreeSet<String> = (0..64).map(|_| nonce()).collect();
        assert_eq!(names.len(), 64, "two imports would stage into one folder");
    }
}
