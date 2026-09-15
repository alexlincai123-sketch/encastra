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

use crate::import::{MAX_CHANGELOG_CHARS, MAX_SUMMARY_CHARS, MAX_TITLE_CHARS};
use crate::license::License;
use crate::listing::{Kind, Publisher, is_listing_id};
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
    #[error("the {field} is longer than this build will publish ({max} characters)")]
    TooLong { field: &'static str, max: usize },
    #[error("the {0} holds characters that can hide what it really says")]
    ControlCharacters(&'static str),
    #[error("{size} bytes is larger than this build will publish ({max})")]
    TooLarge { size: u64, max: u64 },
    #[error("this build cannot install a {0:?}, so it will not offer one")]
    NotInstallable(Kind),
    #[error("\"{value}\" is not a usable identifier: {why}")]
    NotAnIdentifier { value: String, why: String },
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
        // Both identifiers go through the product's one identifier grammar — the same one a
        // component id passes — and *before* the namespace test below rather than after.
        //
        // `owns()` compares a prefix, and both sides of that comparison arrive from the same
        // caller — the draft and the publisher are two arguments to the same command. An
        // attacker choosing both chooses the answer: `publisher.id = "x"` with
        // `listing_id = "x./../../evil"` satisfies "starts with x, then a dot, then more".
        //
        // That would not matter if the listing id stayed a name. It does not: `prepare_publication`
        // builds a directory from it, and a `..` in a directory name is a write outside the folder
        // the person chose. Nothing that passes here contains a separator, a `..`, or an empty
        // segment, so the namespace check is left deciding namespaces rather than paths. Two
        // sessions found this hole independently; one grammar is kept, and `is_listing_id` in
        // `listing.rs` is that grammar plus a length ceiling, for the receiving side to share.
        encastra_protocol::manifest::validate_identifier(&draft.listing_id).map_err(|why| {
            BundleError::NotAnIdentifier {
                value: draft.listing_id.clone(),
                why,
            }
        })?;
        if !is_listing_id(&draft.listing_id) {
            return Err(BundleError::NotAnIdentifier {
                value: draft.listing_id.clone(),
                why: format!(
                    "a publication name is at most {} characters",
                    crate::listing::MAX_LISTING_ID_CHARS
                ),
            });
        }
        encastra_protocol::manifest::validate_identifier(&publisher.id).map_err(|why| {
            BundleError::NotAnIdentifier {
                value: publisher.id.clone(),
                why,
            }
        })?;
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

        // The same limits the receiving side applies, applied here so that a publication is not
        // prepared into something nobody can take in. The ceilings live in `import` because that
        // is where they have to hold against a stranger; this is the same rule said early.
        for (field, text, max) in [
            ("title", draft.title.as_str(), MAX_TITLE_CHARS),
            ("summary", draft.summary.as_str(), MAX_SUMMARY_CHARS),
            (
                "changelog",
                draft.changelog.as_deref().unwrap_or_default(),
                MAX_CHANGELOG_CHARS,
            ),
        ] {
            if text.chars().count() > max {
                return Err(BundleError::TooLong { field, max });
            }
            if has_control_characters(text) {
                return Err(BundleError::ControlCharacters(field));
            }
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

/// Whether a piece of text holds characters that make it lie about what it says.
///
/// Three families, all of them invisible and all of them load-bearing in a name somebody reads
/// before deciding to trust it:
///
/// - **C0 and C1 control characters** — Unicode category `Cc`, which is what [`char::is_control`]
///   answers for, so both ranges are covered by that one call. A carriage return rewrites the
///   line somebody is looking at; an escape can move a terminal cursor anywhere on screen. Three
///   of them are ordinary whitespace and are allowed: a line feed, a carriage return and a tab.
///   A changelog with more than one paragraph is the normal shape of a changelog, and a summary
///   written as two sentences on two lines is not hiding anything. Every other control character
///   has no business in text a person reads and is refused.
/// - **Bidirectional overrides.** `U+202E` reverses what follows, so a title can be written to
///   display as something entirely different from what it contains. The isolates `U+2066`–
///   `U+2069` do the same thing more politely.
/// - **Zero-width characters.** Two publications whose names differ only by a `U+200B` look
///   identical and are not, which is the whole trick.
///
/// Nothing is stripped. Removing a character changes what somebody wrote and hands back a title
/// they never chose; the honest answer is to say what is wrong and let them fix it.
pub fn has_control_characters(text: &str) -> bool {
    text.chars().any(|c| {
        (c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
            || matches!(c, '\u{202a}'..='\u{202e}')
            || matches!(c, '\u{2066}'..='\u{2069}')
            || matches!(c, '\u{200b}'..='\u{200f}')
            || c == '\u{feff}'
    })
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
    fn a_listing_id_cannot_be_a_path() {
        // The listing id becomes a directory name in `prepare_publication`. `owns()` is a prefix
        // test, and the publisher and the draft are two arguments to the same command — so an
        // attacker who chooses both chooses the answer, and can satisfy the namespace check with
        // a listing id full of traversal.
        //
        // The publisher here is crafted to make `owns()` return true for each of these, which is
        // the point: the namespace check passes and the identifier check is what refuses.
        for hostile in [
            "x./../../evil",
            "x./..\\..\\evil",
            "x./etc/passwd",
            "x.C:/Windows/evil",
            "x..",
            "x. ",
        ] {
            let publisher = Publisher {
                id: "x".into(),
                ..publisher()
            };
            let mut draft = draft();
            draft.listing_id = hostile.into();

            assert!(
                publisher.owns(hostile),
                "the fixture must satisfy the namespace check, or this proves nothing about it"
            );

            let error = PublicationBundle::prepare(
                draft,
                &publisher,
                b"a project file",
                ">=0.4.0",
                &passed(),
                0,
            )
            .expect_err(&format!("{hostile:?} must not be accepted as a listing id"));

            assert!(
                matches!(error, BundleError::NotAnIdentifier { .. }),
                "{hostile:?} refused for the wrong reason: {error}"
            );
        }
    }

    #[test]
    fn a_publisher_id_cannot_be_a_path_either() {
        // Both sides of the namespace comparison are checked, because both arrive from the same
        // caller and the publisher's id is written into the bundle.
        let publisher = Publisher {
            id: "../..".into(),
            ..publisher()
        };
        let mut draft = draft();
        draft.listing_id = "../...evil".into();

        let error = PublicationBundle::prepare(draft, &publisher, b"x", ">=0.4.0", &passed(), 0)
            .expect_err("a publisher id full of traversal must not be accepted");
        assert!(
            matches!(error, BundleError::NotAnIdentifier { .. }),
            "{error}"
        );
    }

    #[test]
    fn an_ordinary_listing_id_is_still_accepted() {
        // The control. Every refusal above has to be about traversal, and that argument only
        // holds if the shape a real publisher uses still goes through.
        assert!(prepare(draft(), &passed()).is_ok());
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
    fn a_listing_id_that_is_really_a_path_is_refused() {
        // `Publisher::owns` says yes to this one: strip `dev.alice` and what is left starts with
        // a dot. The desktop then uses the id as a folder name, so without this check a
        // publication could be prepared three directories above where somebody chose.
        let mut climbing = draft();
        climbing.listing_id = "dev.alice.../../../x".into();
        assert!(publisher().owns(&climbing.listing_id), "this is the trap");
        assert!(matches!(
            prepare(climbing, &passed()),
            Err(BundleError::NotAnIdentifier { .. })
        ));

        for id in ["dev.alice.a/b", r"dev.alice.a\b", "dev.alice..x", "dev"] {
            let mut bad = draft();
            bad.listing_id = id.into();
            assert!(
                matches!(
                    prepare(bad, &passed()),
                    Err(BundleError::NotAnIdentifier { .. })
                ),
                "{id} should not be a listing id"
            );
        }
    }

    #[test]
    fn text_nobody_could_read_to_the_end_of_is_refused() {
        let mut long = draft();
        long.title = "a".repeat(MAX_TITLE_CHARS + 1);
        assert_eq!(
            prepare(long, &passed()),
            Err(BundleError::TooLong {
                field: "title",
                max: MAX_TITLE_CHARS
            })
        );

        let mut long_summary = draft();
        long_summary.summary = "a".repeat(MAX_SUMMARY_CHARS + 1);
        assert!(matches!(
            prepare(long_summary, &passed()),
            Err(BundleError::TooLong {
                field: "summary",
                ..
            })
        ));

        let mut long_changelog = draft();
        long_changelog.changelog = Some("a".repeat(MAX_CHANGELOG_CHARS + 1));
        assert!(matches!(
            prepare(long_changelog, &passed()),
            Err(BundleError::TooLong {
                field: "changelog",
                ..
            })
        ));
    }

    #[test]
    fn a_title_that_displays_as_something_else_is_refused() {
        // A right-to-left override makes the rest of the string render backwards, so a title can
        // be written to read as one thing and contain another.
        let mut spoofed = draft();
        spoofed.title = "Thumbnails\u{202e}gnp.exe".into();
        assert_eq!(
            prepare(spoofed, &passed()),
            Err(BundleError::ControlCharacters("title"))
        );

        let mut invisible = draft();
        invisible.summary = "Makes a small copy\u{200b} of every picture.".into();
        assert_eq!(
            prepare(invisible, &passed()),
            Err(BundleError::ControlCharacters("summary"))
        );

        // A line break is a C0 control too, and it is the ordinary shape of a changelog. The three
        // whitespace controls are the only carve-out; an escape sequence in the same field is
        // still refused, so the carve-out is three characters and not a category.
        let mut paragraphs = draft();
        paragraphs.changelog = Some("First release.\n\nAnd a second paragraph.\tIndented.".into());
        assert!(prepare(paragraphs, &passed()).is_ok());

        let mut escape = draft();
        escape.changelog = Some("First release.\u{1b}[2J".into());
        assert_eq!(
            prepare(escape, &passed()),
            Err(BundleError::ControlCharacters("changelog"))
        );
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
