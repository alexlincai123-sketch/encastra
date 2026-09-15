//! The document that would travel with a publication.
//!
//! A `.encastra` file is already a complete, portable project — that part of publishing is
//! solved. What a registry needs alongside it is everything the file does not say about itself:
//! who is offering it, under what name, under what licence, at what price, and what it will ask
//! of whoever installs it.
//!
//! [`PublicationBundle::prepare`] is the only way to make one, and it refuses more often than it
//! agrees. It cannot be built from a project that failed [`crate::review`], from a listing id
//! outside the publisher's namespace, or from bytes nobody measured. That is deliberate: the
//! checks are on the path, not beside it, so there is no version of this that skips them.
//!
//! Nothing here uploads anything. There is no registry to upload to.

use serde::{Deserialize, Serialize};

use crate::license::License;
use crate::listing::{Kind, Publisher};
use crate::money::Pricing;
use crate::review::{Outcome, Review};

/// The largest publication this build will prepare.
///
/// A ceiling, not a target. The project container already refuses an entry over 32 MB; this is
/// the whole file, which may hold several. Anything larger is almost always a mistake — a video
/// somebody dropped in a folder the project watches — and finding out at upload time is worse
/// than finding out now.
pub const MAX_PUBLICATION_BYTES: u64 = 64 * 1024 * 1024;

/// What an author fills in.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PublicationDraft {
    /// Reverse-DNS, inside the publisher's namespace, immutable for the life of the listing.
    pub listing_id: String,
    pub kind: Kind,
    pub version: String,
    pub title: String,
    pub summary: String,
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub license: License,
    pub pricing: Pricing,
    #[serde(default)]
    pub changelog: Option<String>,
}

/// Why a publication could not be prepared.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum BundleError {
    #[error("the review found {blocking} thing(s) that have to change first")]
    ReviewRefused { blocking: usize },
    #[error("\"{0}\" is not a version; publications are numbered like 1.2.0")]
    NotAVersion(String),
    #[error("\"{listing}\" is not inside {publisher}'s namespace")]
    NotYourNamespace { listing: String, publisher: String },
    #[error("a publication needs a {0}")]
    Missing(&'static str),
    #[error("{size} bytes is larger than this build will publish ({max})")]
    TooLarge { size: u64, max: u64 },
    #[error("this build cannot install a {0:?}, so it will not offer one")]
    NotInstallable(Kind),
}

/// A prepared publication: the draft, plus everything measured rather than claimed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PublicationBundle {
    pub draft: PublicationDraft,
    pub publisher: String,
    /// `sha256` of the `.encastra` file, lowercase hex. Integrity, not provenance: it says the
    /// bytes did not change on the way, and says nothing about who made them. The signature
    /// that would say that is ADR-0008, and it does not exist in this build.
    pub checksum: String,
    pub size_bytes: u64,
    /// Gathered from the components, not typed by the author. Nobody discloses their own
    /// permissions accurately from memory.
    pub capabilities: Vec<String>,
    /// The runtime range the project itself states.
    pub runtime: String,
    pub prepared_at_ms: u64,
}

impl PublicationBundle {
    /// Prepares a publication, or explains why it cannot be.
    ///
    /// The review is taken as an argument rather than run here so that the person publishing
    /// sees the same findings the check produced, in the same order, rather than a second
    /// opinion that might differ. It is checked, though: a refused review cannot be walked past
    /// by calling this directly.
    #[allow(clippy::too_many_arguments)]
    pub fn prepare(
        draft: PublicationDraft,
        publisher: &Publisher,
        project_bytes: &[u8],
        runtime: &str,
        review: &Review,
        prepared_at_ms: u64,
    ) -> Result<Self, BundleError> {
        if let Outcome::Refused { blocking } = review.outcome {
            return Err(BundleError::ReviewRefused { blocking });
        }
        if !draft.kind.installable_in_this_build() {
            return Err(BundleError::NotInstallable(draft.kind));
        }
        if !publisher.owns(&draft.listing_id) {
            return Err(BundleError::NotYourNamespace {
                listing: draft.listing_id,
                publisher: publisher.id.clone(),
            });
        }
        if semver::Version::parse(&draft.version).is_err() {
            return Err(BundleError::NotAVersion(draft.version));
        }
        if draft.title.trim().is_empty() {
            return Err(BundleError::Missing("title"));
        }
        if draft.summary.trim().is_empty() {
            return Err(BundleError::Missing("summary"));
        }

        let size_bytes = project_bytes.len() as u64;
        if size_bytes == 0 {
            return Err(BundleError::Missing("project"));
        }
        if size_bytes > MAX_PUBLICATION_BYTES {
            return Err(BundleError::TooLarge {
                size: size_bytes,
                max: MAX_PUBLICATION_BYTES,
            });
        }

        Ok(Self {
            draft,
            publisher: publisher.id.clone(),
            checksum: encastra_project::hash(project_bytes),
            size_bytes,
            capabilities: review.capabilities.clone(),
            runtime: runtime.to_owned(),
            prepared_at_ms,
        })
    }

    /// Whether these bytes are the ones this publication was prepared from.
    ///
    /// What an install would ask before opening anything. A mismatch is not a warning to click
    /// past: the file is not the file, and the only honest answer is to stop.
    pub fn matches(&self, project_bytes: &[u8]) -> bool {
        self.size_bytes == project_bytes.len() as u64
            && self.checksum == encastra_project::hash(project_bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::review::Outcome;

    fn publisher() -> Publisher {
        Publisher {
            id: "dev.alice".into(),
            display_name: "Alice".into(),
            bio: None,
            verified: false,
        }
    }

    fn passed() -> Review {
        Review {
            outcome: Outcome::MayPublish,
            findings: Vec::new(),
            capabilities: vec!["fs.write".into()],
        }
    }

    fn draft() -> PublicationDraft {
        PublicationDraft {
            listing_id: "dev.alice.thumbnails".into(),
            kind: Kind::Project,
            version: "1.0.0".into(),
            title: "Thumbnails".into(),
            summary: "Makes a small copy of every picture dropped in a folder.".into(),
            categories: vec!["images".into()],
            tags: Vec::new(),
            license: License::Mit,
            pricing: Pricing::Free,
            changelog: None,
        }
    }

    fn prepare(draft: PublicationDraft, review: &Review) -> Result<PublicationBundle, BundleError> {
        PublicationBundle::prepare(draft, &publisher(), b"a project file", ">=0.4.0", review, 0)
    }

    #[test]
    fn a_reviewed_project_prepares_and_measures_itself() {
        let bundle = prepare(draft(), &passed()).expect("this one is fine");
        assert_eq!(bundle.size_bytes, 14);
        assert_eq!(bundle.checksum, encastra_project::hash(b"a project file"));
        // Capabilities come from the review, never from the draft: nobody discloses their own
        // permissions accurately from memory.
        assert_eq!(bundle.capabilities, vec!["fs.write".to_string()]);
        assert!(bundle.matches(b"a project file"));
        assert!(!bundle.matches(b"a different file"));
    }

    #[test]
    fn a_refused_review_cannot_be_walked_past() {
        let refused = Review {
            outcome: Outcome::Refused { blocking: 2 },
            findings: Vec::new(),
            capabilities: Vec::new(),
        };
        assert_eq!(
            prepare(draft(), &refused),
            Err(BundleError::ReviewRefused { blocking: 2 })
        );
    }

    #[test]
    fn a_name_in_somebody_else_s_namespace_is_refused() {
        let mut theirs = draft();
        theirs.listing_id = "dev.bob.thumbnails".into();
        assert!(matches!(
            prepare(theirs, &passed()),
            Err(BundleError::NotYourNamespace { .. })
        ));
    }

    #[test]
    fn a_version_has_to_be_one() {
        let mut latest = draft();
        latest.version = "latest".into();
        assert_eq!(
            prepare(latest, &passed()),
            Err(BundleError::NotAVersion("latest".into()))
        );
    }

    #[test]
    fn a_title_or_summary_of_spaces_is_not_one() {
        let mut blank = draft();
        blank.title = "   ".into();
        assert_eq!(
            prepare(blank, &passed()),
            Err(BundleError::Missing("title"))
        );

        let mut no_summary = draft();
        no_summary.summary = String::new();
        assert_eq!(
            prepare(no_summary, &passed()),
            Err(BundleError::Missing("summary"))
        );
    }

    #[test]
    fn nothing_is_offered_that_this_build_could_not_install() {
        let mut component = draft();
        component.kind = Kind::Component;
        // There is no WebAssembly host. Offering a component would be offering something
        // nobody could use, which is a promise the product has not earned.
        assert_eq!(
            prepare(component, &passed()),
            Err(BundleError::NotInstallable(Kind::Component))
        );
    }

    #[test]
    fn an_empty_or_enormous_project_is_refused() {
        let empty = PublicationBundle::prepare(draft(), &publisher(), b"", ">=0.4.0", &passed(), 0);
        assert_eq!(empty, Err(BundleError::Missing("project")));

        let huge = vec![0_u8; (MAX_PUBLICATION_BYTES + 1) as usize];
        let result =
            PublicationBundle::prepare(draft(), &publisher(), &huge, ">=0.4.0", &passed(), 0);
        assert!(matches!(result, Err(BundleError::TooLarge { .. })));
    }

    #[test]
    fn a_bundle_survives_a_round_trip_through_the_wire() {
        let bundle = prepare(draft(), &passed()).expect("this one is fine");
        let json = serde_json::to_string(&bundle).expect("serialises");
        let back: PublicationBundle = serde_json::from_str(&json).expect("parses");
        assert_eq!(bundle, back);
    }
}
