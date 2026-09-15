//! One vocabulary for everything this application can refuse.
//!
//! A command used to fail with a `String`, and a `String` is an English sentence. The interface
//! ships in six languages, so every one of those sentences reached a Spanish reader in English —
//! which is not a cosmetic problem: a refusal somebody cannot read is a refusal they cannot act
//! on, and the one place an application most needs to be understood is the moment it says no.
//!
//! So a command fails with an [`AppError`], which serialises the way [`ImportError`] already did:
//! internally tagged on `kind`, kebab-case, with the values a sentence needs as named fields.
//! The interface matches on the tag and writes its own sentence, in whatever language the person
//! reads. `apps/desktop/src/errors.ts` holds the other half of that mapping, and
//! `apps/desktop/test/fixtures/error-kinds.json` is the pinned list both sides are checked
//! against — written by the test at the bottom of this file, read by the TypeScript tests.
//!
//! Three rules kept this from becoming a second set of English sentences in disguise:
//!
//! - **A typed error from a crate is nested, never flattened into prose.** `{"kind": "project",
//!   "error": {"kind": "archive", …}}` keeps the crate's own vocabulary reachable, so the sentence
//!   the reader gets is as specific as the one the crate refused with.
//! - **Free text is a parameter, not the message.** An operating-system error and a path the
//!   person chose are values the interface quotes inside a translated sentence. Nothing here
//!   relies on those being read: the sentence stands without them.
//! - **`Display` still says exactly what it used to.** These strings end up in logs, in
//!   `eprintln!`, and in tests that were written against them. The contract added a name; it did
//!   not take a sentence away.

use encastra_core::journal::NodeError;
use encastra_library::LibraryError;
use encastra_project::ProjectError;
use encastra_publish::ImportError;
use encastra_publish::bundle::BundleError;
use serde::Serialize;

/// What the status bar is being told while a workflow runs.
///
/// Not an error — a workflow that drops an event or stops unexpectedly has not failed a command —
/// but the same problem and the same answer. These reached the status bar as English sentences
/// the runtime had built, through `Status::message`, which meant the one line somebody watches
/// while a workflow runs was the one line that never got translated.
///
/// Tagged exactly as [`AppError`] is, and pinned in the same fixture. `errors.ts` maps it and
/// `store.ts` renders it through that mapping rather than printing it.
#[derive(Debug, Clone, thiserror::Error, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum StatusMessage {
    /// A watcher stopped. Reported rather than fatal: a folder that disappears should stop that
    /// watcher, not tear down a workflow that may have other sources.
    ///
    /// The whole [`NodeError`] travels, not just its sentence, because it carries a stable `code`
    /// — so a later build can translate the reason itself without changing this payload again.
    /// Until then the interface quotes `message` verbatim under a translated label, which is the
    /// rule the rest of this module already follows for free text.
    #[error("{node}: {}", error.message)]
    TriggerError { node: String, error: NodeError },
    #[error("{count} event(s) dropped — too many at once.")]
    EventsDropped { count: usize },
    #[error("Nothing ran: {problems} problem(s) to fix first.")]
    NothingRan { problems: usize },
    #[error("This workflow stopped unexpectedly. You can start it again.")]
    WorkflowStopped,
    #[error("Running for {seconds} seconds.")]
    RunningFor { seconds: u64 },
}

impl StatusMessage {
    /// The tag this serialises under. Exhaustive for the reason [`AppError::kind`] is.
    pub fn kind(&self) -> &'static str {
        match self {
            StatusMessage::TriggerError { .. } => "trigger-error",
            StatusMessage::EventsDropped { .. } => "events-dropped",
            StatusMessage::NothingRan { .. } => "nothing-ran",
            StatusMessage::WorkflowStopped => "workflow-stopped",
            StatusMessage::RunningFor { .. } => "running-for",
        }
    }
}

/// Every tag [`StatusMessage`] can serialise under, in the order the variants are declared.
pub const STATUS_KINDS: &[&str] = &[
    "trigger-error",
    "events-dropped",
    "nothing-ran",
    "workflow-stopped",
    "running-for",
];

/// Why one grant in a run was not given.
///
/// Its own enum rather than a sentence inside [`AppError::GrantsRefused`], because a run can be
/// refused for several grants at once and the interface lists them: one line per grant, each
/// naming the node it is about. Flattening them into a single newline-joined string — which is
/// what this used to be — gave the interface one blob it could neither translate nor lay out.
#[derive(Debug, thiserror::Error, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum GrantRefusal {
    #[error("{node}: that folder cannot be used — {reason}.")]
    FolderUnusable { node: String, reason: String },
    #[error("{node}: choose that folder with the Choose button before allowing it.")]
    FolderNotChosen { node: String },
    // `capability` rather than `kind`: the enum is tagged on `kind`, and a field of that name
    // would land on top of the tag saying which refusal this is.
    #[error("{node}: this component does not ask for {capability}.")]
    NotDeclared { node: String, capability: String },
}

/// Every way a command in this application can say no.
#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum AppError {
    // -- the runtime and its locks ----------------------------------------------------------
    #[error("The runtime is busy.")]
    RuntimeBusy,
    #[error("The library is busy. Try that again.")]
    LibraryBusy,
    #[error("An import is being written. The window will close once it has finished.")]
    ImportInFlight,

    // -- choosing a folder ------------------------------------------------------------------
    #[error("The folder chooser did not return.")]
    ChooserDidNotReturn,
    #[error("That is not a folder on this machine.")]
    NotAFolderOnThisMachine,
    #[error("That is not a file on this machine.")]
    NotAFileOnThisMachine,
    #[error("That file cannot be used: {reason}.")]
    FileUnusable { reason: String },
    #[error("That folder cannot be used: {reason}.")]
    FolderUnusable { reason: String },

    // -- projects ---------------------------------------------------------------------------
    #[error("{}", crate::NOT_A_PROJECT)]
    NotAProject,
    /// The project crate's own refusal, kept whole.
    #[error("{error}")]
    Project { error: ProjectError },
    #[error("That version is not in this project.")]
    VersionNotInProject,
    #[error("One of those versions is not in this project.")]
    VersionsNotInProject,

    // -- running ----------------------------------------------------------------------------
    #[error("{}", refusals.iter().map(ToString::to_string).collect::<Vec<_>>().join("\n"))]
    GrantsRefused { refusals: Vec<GrantRefusal> },
    #[error("Could not prepare a working folder: {reason}")]
    WorkingFolder { reason: String },
    #[error("Could not open {path}: {reason}")]
    InputUnreadable { path: String, reason: String },
    #[error("The file for {node}.{port} cannot be used: {reason}. Nothing ran.")]
    InputUnusable {
        node: String,
        port: String,
        reason: String,
    },
    #[error(
        "Choose the file for {node}.{port} with the Choose button before running. Nothing ran."
    )]
    InputNotChosen { node: String, port: String },
    #[error("A workflow is already running. Stop it before starting another.")]
    WorkflowAlreadyRunning,
    #[error("This workflow cannot run yet: {problems} problem(s) to fix.")]
    WorkflowInvalid { problems: usize },
    #[error("Could not start the workflow: {reason}")]
    WorkflowNotStarted { reason: String },

    // -- publishing -------------------------------------------------------------------------
    #[error("That folder is not there. Choose one that exists.")]
    DestinationMissing,
    #[error(
        "That folder is a link to somewhere else, so what was written would land somewhere \
         other than where you chose. Pick the folder itself."
    )]
    DestinationIsALink,
    #[error("That is a file, not a folder. A publication needs a folder.")]
    DestinationIsAFile,
    #[error("Choose the folder to publish into with the Choose button before preparing.")]
    DestinationNotChosen,
    /// The publish crate's own refusal, kept whole.
    #[error("{error}")]
    Bundle { error: BundleError },
    #[error("That publication cannot be written where it was asked to go.")]
    PublicationPathEscapes,
    #[error("{folder} already holds a publication. Delete it or choose another folder.")]
    PublicationAlreadyThere { folder: String },

    // -- the library ------------------------------------------------------------------------
    /// The library crate's own refusal, kept whole.
    #[error("{error}")]
    Library { error: LibraryError },
    #[error(
        "That file is yours, and it stays where it is. Encastra only deletes copies it made \
         itself, which means things you imported."
    )]
    NotOursToDelete,
    #[error("It is out of your library, but the copy could not be deleted: {reason}")]
    CopyNotDeleted { reason: String },

    // -- importing --------------------------------------------------------------------------
    /// The receiving side's own refusal, kept whole — the one vocabulary the interface already
    /// spoke before this module existed, and the reason every other one is shaped like it.
    #[error("{error}")]
    Import { error: ImportError },

    // -- the window -------------------------------------------------------------------------
    #[error("There is no window to close.")]
    NoWindow,
    #[error("The window refused to close.")]
    WindowWouldNotClose,

    // -- this machine -----------------------------------------------------------------------
    #[error("Something on this computer refused the operation ({reason}).")]
    Io { reason: String },
}

impl From<ProjectError> for AppError {
    fn from(error: ProjectError) -> Self {
        AppError::Project { error }
    }
}

impl From<LibraryError> for AppError {
    fn from(error: LibraryError) -> Self {
        AppError::Library { error }
    }
}

impl From<BundleError> for AppError {
    fn from(error: BundleError) -> Self {
        AppError::Bundle { error }
    }
}

impl From<ImportError> for AppError {
    fn from(error: ImportError) -> Self {
        AppError::Import { error }
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        // The kind, never the message, for the reason `ProjectError` and `LibraryError` give: an
        // io message carries the path it failed on, and these end up in logs and on screen.
        AppError::Io {
            reason: e.kind().to_string(),
        }
    }
}

impl AppError {
    /// The tag this serialises under.
    ///
    /// An exhaustive match rather than a round trip through `serde_json`, and that is the point:
    /// a variant added without a line here does not compile, which is the only mechanism that
    /// keeps [`KINDS`] — and therefore the six translation files — from falling behind.
    pub fn kind(&self) -> &'static str {
        match self {
            AppError::RuntimeBusy => "runtime-busy",
            AppError::LibraryBusy => "library-busy",
            AppError::ImportInFlight => "import-in-flight",
            AppError::ChooserDidNotReturn => "chooser-did-not-return",
            AppError::NotAFolderOnThisMachine => "not-a-folder-on-this-machine",
            AppError::NotAFileOnThisMachine => "not-a-file-on-this-machine",
            AppError::FileUnusable { .. } => "file-unusable",
            AppError::FolderUnusable { .. } => "folder-unusable",
            AppError::NotAProject => "not-a-project",
            AppError::Project { .. } => "project",
            AppError::VersionNotInProject => "version-not-in-project",
            AppError::VersionsNotInProject => "versions-not-in-project",
            AppError::GrantsRefused { .. } => "grants-refused",
            AppError::WorkingFolder { .. } => "working-folder",
            AppError::InputUnreadable { .. } => "input-unreadable",
            AppError::InputUnusable { .. } => "input-unusable",
            AppError::InputNotChosen { .. } => "input-not-chosen",
            AppError::WorkflowAlreadyRunning => "workflow-already-running",
            AppError::WorkflowInvalid { .. } => "workflow-invalid",
            AppError::WorkflowNotStarted { .. } => "workflow-not-started",
            AppError::DestinationMissing => "destination-missing",
            AppError::DestinationIsALink => "destination-is-a-link",
            AppError::DestinationIsAFile => "destination-is-a-file",
            AppError::DestinationNotChosen => "destination-not-chosen",
            AppError::Bundle { .. } => "bundle",
            AppError::PublicationPathEscapes => "publication-path-escapes",
            AppError::PublicationAlreadyThere { .. } => "publication-already-there",
            AppError::Library { .. } => "library",
            AppError::NotOursToDelete => "not-ours-to-delete",
            AppError::CopyNotDeleted { .. } => "copy-not-deleted",
            AppError::Import { .. } => "import",
            AppError::NoWindow => "no-window",
            AppError::WindowWouldNotClose => "window-would-not-close",
            AppError::Io { .. } => "io",
        }
    }
}

impl GrantRefusal {
    /// The tag this serialises under. Exhaustive for the reason [`AppError::kind`] is.
    pub fn kind(&self) -> &'static str {
        match self {
            GrantRefusal::FolderUnusable { .. } => "folder-unusable",
            GrantRefusal::FolderNotChosen { .. } => "folder-not-chosen",
            GrantRefusal::NotDeclared { .. } => "not-declared",
        }
    }
}

/// Every tag [`AppError`] can serialise under, in the order the variants are declared.
///
/// Hand-written, and checked against [`AppError::kind`] by the tests below: the list is what the
/// interface is held to, and deriving it from the samples would mean a forgotten sample quietly
/// shrank the contract instead of failing it.
pub const KINDS: &[&str] = &[
    "runtime-busy",
    "library-busy",
    "import-in-flight",
    "chooser-did-not-return",
    "not-a-folder-on-this-machine",
    "not-a-file-on-this-machine",
    "file-unusable",
    "folder-unusable",
    "not-a-project",
    "project",
    "version-not-in-project",
    "versions-not-in-project",
    "grants-refused",
    "working-folder",
    "input-unreadable",
    "input-unusable",
    "input-not-chosen",
    "workflow-already-running",
    "workflow-invalid",
    "workflow-not-started",
    "destination-missing",
    "destination-is-a-link",
    "destination-is-a-file",
    "destination-not-chosen",
    "bundle",
    "publication-path-escapes",
    "publication-already-there",
    "library",
    "not-ours-to-delete",
    "copy-not-deleted",
    "import",
    "no-window",
    "window-would-not-close",
    "io",
];

/// Every tag [`GrantRefusal`] can serialise under.
pub const GRANT_KINDS: &[&str] = &["folder-unusable", "folder-not-chosen", "not-declared"];

#[cfg(test)]
mod tests {
    use super::*;
    use encastra_publish::listing::Kind;
    use std::collections::BTreeSet;

    /// One of every variant, so that the serialised shape of each is actually exercised.
    ///
    /// The values are nonsense on purpose: what is under test is the tag and the field names, and
    /// a plausible-looking fixture invites somebody to assert on the contents instead.
    fn samples() -> Vec<AppError> {
        vec![
            AppError::RuntimeBusy,
            AppError::LibraryBusy,
            AppError::ImportInFlight,
            AppError::ChooserDidNotReturn,
            AppError::NotAFolderOnThisMachine,
            AppError::NotAFileOnThisMachine,
            AppError::FileUnusable {
                reason: "that is not a file".into(),
            },
            AppError::FolderUnusable {
                reason: "that is not a folder".into(),
            },
            AppError::NotAProject,
            AppError::Project {
                error: ProjectError::Archive {
                    reason: "not a zip".into(),
                },
            },
            AppError::VersionNotInProject,
            AppError::VersionsNotInProject,
            AppError::GrantsRefused {
                refusals: grant_samples(),
            },
            AppError::WorkingFolder {
                reason: "permission denied".into(),
            },
            AppError::InputUnreadable {
                path: "a.png".into(),
                reason: "entity not found".into(),
            },
            AppError::InputUnusable {
                node: "read".into(),
                port: "file".into(),
                reason: "that is not a file".into(),
            },
            AppError::InputNotChosen {
                node: "read".into(),
                port: "file".into(),
            },
            AppError::WorkflowAlreadyRunning,
            AppError::WorkflowInvalid { problems: 2 },
            AppError::WorkflowNotStarted {
                reason: "too many threads".into(),
            },
            AppError::DestinationMissing,
            AppError::DestinationIsALink,
            AppError::DestinationIsAFile,
            AppError::DestinationNotChosen,
            AppError::Bundle {
                error: BundleError::NotInstallable {
                    kind: Kind::Component,
                },
            },
            AppError::PublicationPathEscapes,
            AppError::PublicationAlreadyThere {
                folder: "somewhere".into(),
            },
            AppError::Library {
                error: LibraryError::NotOurs,
            },
            AppError::NotOursToDelete,
            AppError::CopyNotDeleted {
                reason: "permission denied".into(),
            },
            AppError::Import {
                error: ImportError::NoDocument,
            },
            AppError::NoWindow,
            AppError::WindowWouldNotClose,
            AppError::Io {
                reason: "permission denied".into(),
            },
        ]
    }

    fn grant_samples() -> Vec<GrantRefusal> {
        vec![
            GrantRefusal::FolderUnusable {
                node: "save".into(),
                reason: "that is not a folder".into(),
            },
            GrantRefusal::FolderNotChosen {
                node: "save".into(),
            },
            GrantRefusal::NotDeclared {
                node: "save".into(),
                capability: "system.clipboard".into(),
            },
        ]
    }

    /// The tag serde actually writes, read back off the serialised value.
    fn serialised_kind<T: Serialize>(value: &T) -> String {
        serde_json::to_value(value).expect("an error serialises")["kind"]
            .as_str()
            .expect("every error is tagged on a string `kind`")
            .to_owned()
    }

    #[test]
    fn every_variant_serialises_under_the_tag_it_claims() {
        // `kind()` is what the list and the translations are built from, and serde is what the
        // interface actually receives. A divergence between the two would mean an error nobody
        // has a sentence for, so they are compared rather than trusted.
        for error in samples() {
            assert_eq!(serialised_kind(&error), error.kind(), "{error:?}");
        }
        for refusal in grant_samples() {
            assert_eq!(serialised_kind(&refusal), refusal.kind(), "{refusal:?}");
        }
        for status in status_samples() {
            assert_eq!(serialised_kind(&status), status.kind(), "{status:?}");
        }
    }

    #[test]
    fn a_stopped_watcher_carries_the_whole_node_error() {
        // The `code` is the part a later build can translate; the `message` is what the interface
        // quotes verbatim until then. Flattening this to a sentence would throw the code away.
        let value = serde_json::to_value(StatusMessage::TriggerError {
            node: "watch".into(),
            error: NodeError::new("missing-config", "no folder is set"),
        })
        .expect("serialises");
        assert_eq!(value["kind"], "trigger-error");
        assert_eq!(value["node"], "watch");
        assert_eq!(value["error"]["code"], "missing-config");
        assert_eq!(value["error"]["message"], "no folder is set");
    }

    #[test]
    fn the_samples_cover_every_kind_exactly_once() {
        // The other half of the compile-time guarantee. `kind()` stops compiling when a variant
        // is added; this stops passing when the sample for it is forgotten, which is what would
        // otherwise let a variant reach the interface with nothing pinned about it.
        let covered: Vec<&str> = samples().iter().map(AppError::kind).collect();
        assert_eq!(covered, KINDS, "one sample per variant, in declared order");
        assert_eq!(
            covered.iter().collect::<BTreeSet<_>>().len(),
            KINDS.len(),
            "no two variants share a tag"
        );

        let grants: Vec<&str> = grant_samples().iter().map(GrantRefusal::kind).collect();
        assert_eq!(grants, GRANT_KINDS);

        let statuses: Vec<&str> = status_samples().iter().map(StatusMessage::kind).collect();
        assert_eq!(statuses, STATUS_KINDS);
    }

    /// One of every `StatusMessage`, in declared order.
    fn status_samples() -> Vec<StatusMessage> {
        vec![
            StatusMessage::TriggerError {
                node: "watch".into(),
                error: NodeError::new("missing-config", "no folder is set"),
            },
            StatusMessage::EventsDropped { count: 3 },
            StatusMessage::NothingRan { problems: 2 },
            StatusMessage::WorkflowStopped,
            StatusMessage::RunningFor { seconds: 12 },
        ]
    }

    #[test]
    fn a_nested_error_keeps_its_own_vocabulary() {
        // The property that makes nesting worth the extra shape: the interface can be as specific
        // as the crate that refused, rather than being handed "something went wrong with a
        // project". Flattening these into prose is what this module exists to stop.
        let value = serde_json::to_value(AppError::Project {
            error: ProjectError::UnsupportedSchema { ours: 1, theirs: 9 },
        })
        .expect("serialises");
        assert_eq!(value["kind"], "project");
        assert_eq!(value["error"]["kind"], "unsupported-schema");
        assert_eq!(value["error"]["ours"], 1);
        assert_eq!(value["error"]["theirs"], 9);
    }

    #[test]
    fn a_publication_kind_does_not_land_on_top_of_the_tag() {
        // `BundleError::NotInstallable` holds a field that would naturally be called `kind`, and
        // the enum is tagged on `kind`. Renaming it is the only reason the tag survives.
        let value = serde_json::to_value(BundleError::NotInstallable {
            kind: Kind::Component,
        })
        .expect("serialises");
        assert_eq!(value["kind"], "not-installable");
        assert_eq!(value["publicationKind"], "component");
    }

    #[test]
    fn display_still_says_what_it_used_to() {
        // These strings are what a log line shows and what several tests in `lib.rs` assert on.
        // The contract added a name to a refusal; it did not take its sentence away.
        assert_eq!(AppError::RuntimeBusy.to_string(), "The runtime is busy.");
        assert_eq!(AppError::NotAProject.to_string(), crate::NOT_A_PROJECT);
        assert_eq!(
            AppError::GrantsRefused {
                refusals: vec![
                    GrantRefusal::FolderNotChosen { node: "a".into() },
                    GrantRefusal::NotDeclared {
                        node: "b".into(),
                        capability: "fs.write".into()
                    },
                ]
            }
            .to_string(),
            "a: choose that folder with the Choose button before allowing it.\n\
             b: this component does not ask for fs.write."
        );
    }

    /// The list the interface is checked against, written where the TypeScript tests read it.
    ///
    /// The same arrangement `packages/protocol/data/compat-matrix.json` uses, and for the same
    /// reason: two implementations of one contract drift silently, so one side writes the file
    /// down and the other replays it. Here the runtime owns the vocabulary and the editor has to
    /// have a sentence for every word in it — so the runtime writes, and
    /// `apps/desktop/test/errors.test.ts` fails if a word has no sentence in some language.
    ///
    /// To regenerate after adding a variant:  UPDATE_ERROR_KINDS=1 cargo test -p encastra-desktop
    #[test]
    fn the_committed_list_of_kinds_matches_this_build() {
        use std::path::PathBuf;

        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../test/fixtures/error-kinds.json")
            .canonicalize()
            .unwrap_or_else(|_| {
                PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/fixtures/error-kinds.json")
            });

        let current = serde_json::json!({
            "comment": "Written by apps/desktop/src-tauri/src/error.rs. \
                        Regenerate with UPDATE_ERROR_KINDS=1 cargo test -p encastra-desktop.",
            "app": KINDS,
            "grant": GRANT_KINDS,
            "status": STATUS_KINDS,
            "project": project_kinds(),
            "library": library_kinds(),
            "bundle": bundle_kinds(),
            "import": import_kinds(),
        });
        let text = format!(
            "{}\n",
            serde_json::to_string_pretty(&current).expect("the list serialises")
        );

        if std::env::var_os("UPDATE_ERROR_KINDS").is_some() {
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent).expect("the fixture folder");
            }
            std::fs::write(&path, &text).expect("the fixture is written");
            return;
        }

        let committed = std::fs::read_to_string(&path).unwrap_or_else(|e| {
            panic!(
                "{}: {e}. Run with UPDATE_ERROR_KINDS=1 to write it.",
                path.display()
            )
        });
        // Compared as values rather than as bytes: the file lives under the repository's
        // formatter, which is entitled to lay it out however it likes. What has to match is the
        // vocabulary, and comparing text would turn a reformat into a failing build.
        let committed: serde_json::Value = serde_json::from_str(&committed)
            .unwrap_or_else(|e| panic!("{} is not JSON: {e}", path.display()));
        assert_eq!(
            committed, current,
            "the committed error kinds no longer match this build — \
             run UPDATE_ERROR_KINDS=1 cargo test -p encastra-desktop, then write the six \
             translations for whatever is new"
        );
    }

    // The vocabularies owned by the crates. Hand-written lists rather than derived ones, and
    // checked below by serialising one of each: a list that built itself from the samples would
    // shrink silently when somebody forgot a sample.

    fn project_kinds() -> Vec<&'static str> {
        vec![
            "unsupported-schema",
            "missing-entry",
            "invalid",
            "archive",
            "too-large",
            "too-large-in-total",
            "too-many-snapshots",
            "file-too-large",
            "ambiguous-archive",
            "io",
        ]
    }

    fn library_kinds() -> Vec<&'static str> {
        vec![
            "corrupt",
            "written-by-another-version",
            "too-many-entries",
            "not-ours",
            "io",
        ]
    }

    fn bundle_kinds() -> Vec<&'static str> {
        vec![
            "review-refused",
            "not-a-version",
            "not-your-namespace",
            "missing",
            "too-long",
            "control-characters",
            "too-large",
            "not-installable",
            "not-an-identifier",
        ]
    }

    fn import_kinds() -> Vec<&'static str> {
        vec![
            "not-a-folder",
            "folder-is-a-link",
            "folder-not-chosen",
            "no-document",
            "document-is-a-link",
            "document-too-large",
            "document-unreadable",
            "no-project",
            "more-than-one-project",
            "project-is-a-link",
            "unexpected-entries",
            "too-many-entries",
            "project-too-large",
            "checksum-mismatch",
            "project-unreadable",
            "not-installable",
            "not-a-listing-id",
            "not-a-version",
            "not-publishers-namespace",
            "text-too-long",
            "text-has-control-characters",
            "document-disagrees-with-project",
            "runtime-incompatible",
            "review-refused",
            "capabilities-disagree",
            "already-imported",
            "library-full",
            "io",
        ]
    }

    #[test]
    fn the_nested_vocabularies_are_the_ones_those_crates_actually_serialise() {
        // One of every variant of each nested enum, matched against the hand-written list above.
        // An exhaustive `match` on somebody else's enum is not available here, so this is the
        // guarantee instead: a variant added in a crate and not listed here fails this test the
        // moment its sample is written, and a variant renamed fails it immediately.
        let project = vec![
            ProjectError::UnsupportedSchema { ours: 1, theirs: 2 },
            ProjectError::MissingEntry {
                entry: "graph.json".into(),
            },
            ProjectError::Invalid {
                entry: "graph.json".into(),
                reason: "no".into(),
            },
            ProjectError::Archive {
                reason: "no".into(),
            },
            ProjectError::TooLarge {
                entry: "graph.json".into(),
                limit: 1,
            },
            ProjectError::TooLargeInTotal { limit: 1 },
            ProjectError::TooManySnapshots { count: 2, limit: 1 },
            ProjectError::FileTooLarge { size: 2, limit: 1 },
            ProjectError::AmbiguousArchive {
                declared: 2,
                distinct: 1,
            },
            ProjectError::Io {
                reason: "no".into(),
            },
        ];
        assert_eq!(
            project.iter().map(serialised_kind).collect::<Vec<_>>(),
            project_kinds()
        );

        let library = [
            LibraryError::Corrupt {
                reason: "no".into(),
            },
            LibraryError::WrittenByAnotherVersion { ours: 1, theirs: 2 },
            LibraryError::TooManyEntries { count: 2, max: 1 },
            LibraryError::NotOurs,
            LibraryError::Io {
                reason: "no".into(),
            },
        ];
        assert_eq!(
            library.iter().map(serialised_kind).collect::<Vec<_>>(),
            library_kinds()
        );

        let bundle = vec![
            BundleError::ReviewRefused { blocking: 1 },
            BundleError::NotAVersion {
                version: "latest".into(),
            },
            BundleError::NotYourNamespace {
                listing: "a".into(),
                publisher: "b".into(),
            },
            BundleError::Missing { field: "title" },
            BundleError::TooLong {
                field: "title",
                max: 1,
            },
            BundleError::ControlCharacters { field: "title" },
            BundleError::TooLarge { size: 2, max: 1 },
            BundleError::NotInstallable {
                kind: Kind::Component,
            },
            BundleError::NotAnIdentifier {
                value: "a".into(),
                why: "no".into(),
            },
        ];
        assert_eq!(
            bundle.iter().map(serialised_kind).collect::<Vec<_>>(),
            bundle_kinds()
        );

        assert_eq!(
            import_samples()
                .iter()
                .map(serialised_kind)
                .collect::<Vec<_>>(),
            import_kinds()
        );
    }

    /// One of every `ImportError`, in declared order.
    ///
    /// The oldest of these vocabularies, and the one the interface already had sentences for
    /// before this module existed. It is pinned all the same: `library.ts` maps it, and a variant
    /// added over there without a sentence is the failure this list exists to cause.
    fn import_samples() -> Vec<ImportError> {
        use encastra_publish::review::{Finding, Severity};
        vec![
            ImportError::NotAFolder,
            ImportError::FolderIsALink,
            ImportError::FolderNotChosen,
            ImportError::NoDocument,
            ImportError::DocumentIsALink,
            ImportError::DocumentTooLarge { size: 2, max: 1 },
            ImportError::DocumentUnreadable {
                reason: "no".into(),
            },
            ImportError::NoProject,
            ImportError::MoreThanOneProject {
                names: vec!["a.encastra".into()],
            },
            ImportError::ProjectIsALink,
            ImportError::UnexpectedEntries {
                names: vec!["notes.txt".into()],
            },
            ImportError::TooManyEntries { max: 64 },
            ImportError::ProjectTooLarge { size: 2, max: 1 },
            ImportError::ChecksumMismatch,
            ImportError::ProjectUnreadable {
                reason: "no".into(),
            },
            ImportError::NotInstallable {
                kind: Kind::Component,
            },
            ImportError::NotAListingId { id: "a b".into() },
            ImportError::NotAVersion {
                version: "latest".into(),
            },
            ImportError::NotPublishersNamespace {
                listing: "a".into(),
                publisher: "b".into(),
            },
            ImportError::TextTooLong {
                field: "title",
                max: 1,
            },
            ImportError::TextHasControlCharacters { field: "title" },
            ImportError::DocumentDisagreesWithProject { about: "runtime" },
            ImportError::RuntimeIncompatible {
                requires: ">=9".into(),
                have: "0.5.0".into(),
            },
            ImportError::ReviewRefused {
                findings: vec![Finding {
                    code: "TEST",
                    severity: Severity::Blocking,
                    title: "t".into(),
                    detail: "d".into(),
                    remedy: "r".into(),
                    at: None,
                }],
            },
            ImportError::CapabilitiesDisagree {
                declared: vec!["fs.read".into()],
                actual: vec!["fs.write".into()],
            },
            ImportError::AlreadyImported {
                listing: "a".into(),
                version: "1.0.0".into(),
            },
            ImportError::LibraryFull {
                max: 3,
                used: 2,
                needed: 2,
            },
            ImportError::Io {
                reason: "no".into(),
            },
        ]
    }
}
