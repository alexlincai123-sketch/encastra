//! Who publishes, what a publication is, and which of its versions people can get.
//!
//! The split is deliberate. A [`Listing`] is the thing with a name, an author and a page; a
//! [`Release`] is one immutable version of it. Everything mutable — the description, the
//! categories, the price — belongs to the listing. Everything a person already installed
//! belongs to the release, and none of it may ever change underneath them: a version is
//! withdrawn, never rewritten (`docs/PLATFORM-ARCHITECTURE.md` §2, "Immutable versions...
//! only yanked").

use serde::{Deserialize, Serialize};

use crate::license::License;
use crate::money::Pricing;

/// What a publication contains.
///
/// These are the four things this product can actually produce today. There is no `Pack`, no
/// `Resource` and no `Collection`, because nothing in the runtime knows how to open one — a
/// category the software cannot honour is a promise made in a dropdown.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Kind {
    /// A finished workflow somebody can open and run.
    Project,
    /// A workflow meant to be taken apart and changed, rather than run as it is.
    Template,
    /// A single component. Nothing can install one yet: third-party components need the
    /// sandbox that ADR-0001 describes and this build does not have.
    Component,
}

impl Kind {
    /// Whether this build could install such a thing at all, sandbox and registry aside.
    ///
    /// A project and a template are graphs, and the runtime already opens graphs. A component
    /// is code, and code from anyone but this binary has nowhere to run: there is no
    /// WebAssembly host. Saying so here keeps the refusal in one place instead of leaving
    /// every caller to remember it.
    pub const fn installable_in_this_build(self) -> bool {
        match self {
            Kind::Project | Kind::Template => true,
            Kind::Component => false,
        }
    }
}

/// The person or organisation behind a listing.
///
/// `verified` is not a badge and not a rank. It records one fact: whether somebody outside this
/// software checked that this publisher is who the name says. Nothing in this crate sets it,
/// because nothing in this crate is in a position to know.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Publisher {
    /// Stable and immutable. Reverse-DNS, and the namespace every listing id must sit under,
    /// so that a listing cannot claim a name in somebody else's namespace.
    pub id: String,
    pub display_name: String,
    #[serde(default)]
    pub bio: Option<String>,
    /// Whether a human being outside this software confirmed the identity. Never set here.
    #[serde(default)]
    pub verified: bool,
}

impl Publisher {
    /// Whether a listing id belongs to this publisher's namespace.
    ///
    /// `dev.alice` owns `dev.alice.thumbnails` and does not own `dev.alicecorp.thumbnails` —
    /// the boundary is the dot, not the prefix, or every publisher would own every name that
    /// happens to start with theirs.
    pub fn owns(&self, listing_id: &str) -> bool {
        listing_id
            .strip_prefix(&self.id)
            .is_some_and(|rest| rest.starts_with('.') && rest.len() > 1)
    }
}

/// Where a listing stands with whoever runs the registry.
///
/// Every state is reachable from outside this software and none of them is inferred. There is
/// no "approved automatically": the absence of a finding is not a review.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Moderation {
    /// Being written. Visible to its publisher and to nobody else.
    Draft,
    /// Submitted, waiting for a person.
    PendingReview,
    /// Visible, installable.
    Published,
    /// A person refused it. The reason belongs with the refusal, not in a status code.
    Rejected,
    /// Was published; is not now. Existing installs keep working; new ones are refused.
    Suspended,
    /// Withdrawn by its publisher. Nothing new can be installed; nothing installed breaks.
    Archived,
}

impl Moderation {
    /// Whether somebody who does not own it may see it.
    pub const fn publicly_visible(self) -> bool {
        matches!(self, Moderation::Published | Moderation::Archived)
    }

    /// Whether a new install may begin.
    ///
    /// Archived is the interesting one: it stays visible so that a workflow which depends on it
    /// can still say what it depends on, but it is not offered again.
    pub const fn installable(self) -> bool {
        matches!(self, Moderation::Published)
    }
}

/// A publication: one name, one publisher, one page, many versions.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Listing {
    /// Reverse-DNS, immutable for life, inside the publisher's namespace.
    pub id: String,
    pub kind: Kind,
    pub publisher: String,
    pub title: String,
    pub summary: String,
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub license: License,
    pub pricing: Pricing,
    pub moderation: Moderation,
}

/// Why a version is no longer offered.
///
/// A withdrawal is additive: the version stays in the record, with a reason attached, because
/// somebody has it installed and deserves to be told what happened rather than finding a gap.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Withdrawal {
    pub reason: String,
    /// Whether an installed copy should stop being used, not merely stop being offered. This
    /// is the difference between "we found a better way" and "this one does harm".
    pub advises_removal: bool,
}

/// One immutable version of a listing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Release {
    pub listing: String,
    /// Semver. Immutable once published, as the id is for life.
    pub version: String,
    /// `sha256` of the bundle, lowercase hex.
    ///
    /// This is integrity, not provenance: it proves the bytes did not change on the way here,
    /// and proves nothing at all about who made them. Provenance needs the signature ADR-0008
    /// describes and this build does not have, and the two must never be spoken of as if they
    /// were the same thing.
    pub checksum: String,
    pub size_bytes: u64,
    /// Semver range of runtimes this release states it works with.
    pub runtime: String,
    /// Every capability every component in it declares, gathered so that a person can read them
    /// before installing rather than after.
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub changelog: Option<String>,
    #[serde(default)]
    pub withdrawn: Option<Withdrawal>,
    pub published_at_ms: u64,
}

impl Release {
    /// Whether this release may be installed now.
    pub fn offered(&self) -> bool {
        self.withdrawn.is_none()
    }

    /// Whether this release states it runs on the given runtime version.
    ///
    /// A release that does not parse as a range, or a runtime that does not parse as a version,
    /// is not compatible. The alternative — treating "I could not read this" as "it is fine" —
    /// is how a graph ends up running against a runtime that was never claimed to support it.
    pub fn runs_on(&self, runtime_version: &str) -> bool {
        let (Ok(req), Ok(version)) = (
            semver::VersionReq::parse(&self.runtime),
            semver::Version::parse(runtime_version),
        ) else {
            return false;
        };
        req.matches(&version)
    }
}

/// The longest listing id this build will accept.
///
/// Reverse-DNS names are short in practice. The ceiling is here because the id becomes a folder
/// name when a publication is imported, and a name nobody would ever type on purpose is a name
/// somebody generated to see what would break.
pub const MAX_LISTING_ID_CHARS: usize = 200;

/// Whether `text` is a listing id at all: `dev.alice.thumbnails`, and nothing else.
///
/// The shape is `[a-z][a-z0-9-]*` followed by one or more `.`-separated segments of
/// `[a-z0-9-]+`. Lowercase only, because two ids differing in case would be two listings
/// everywhere except on a filesystem that folds case, where one would quietly land on top of
/// the other.
///
/// This exists rather than being left to [`Publisher::owns`] because `owns` answers a question
/// about namespaces and is content with anything after the dot. `dev.alice.../../../x` sits
/// inside `dev.alice`'s namespace by that reading, and a listing id becomes a path segment the
/// moment a publication is written to disk. Empty segments are refused here, which is what makes
/// `..` unrepresentable.
pub fn is_listing_id(text: &str) -> bool {
    // The product has one identifier grammar — a component id and a listing id are the same
    // shape — and it lives in the protocol crate. A second grammar here would drift from it, and
    // two sessions once wrote two. This adds only the ceiling.
    text.chars().count() <= MAX_LISTING_ID_CHARS
        && encastra_protocol::manifest::validate_identifier(text).is_ok()
}

/// Whether `candidate` is a newer version than `current`, both semver.
///
/// Used to decide whether to tell somebody an update exists. Never used to install one: an
/// update that arrives without being asked for is an update that overwrites somebody's work.
pub fn is_newer(candidate: &str, current: &str) -> bool {
    match (
        semver::Version::parse(candidate),
        semver::Version::parse(current),
    ) {
        (Ok(a), Ok(b)) => a > b,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(version: &str, runtime: &str) -> Release {
        Release {
            listing: "dev.alice.thumbnails".into(),
            version: version.into(),
            checksum: "0".repeat(64),
            size_bytes: 1,
            runtime: runtime.into(),
            capabilities: Vec::new(),
            changelog: None,
            withdrawn: None,
            published_at_ms: 0,
        }
    }

    #[test]
    fn a_publisher_owns_only_their_own_namespace() {
        let alice = Publisher {
            id: "dev.alice".into(),
            display_name: "Alice".into(),
            bio: None,
            verified: false,
        };
        assert!(alice.owns("dev.alice.thumbnails"));
        // The boundary is the dot. Without it, registering `dev.alice` would hand over every
        // name that merely starts with those characters.
        assert!(!alice.owns("dev.alicecorp.thumbnails"));
        assert!(!alice.owns("dev.bob.thumbnails"));
        // The namespace itself is not a listing in it.
        assert!(!alice.owns("dev.alice"));
        assert!(!alice.owns("dev.alice."));
    }

    #[test]
    fn a_withdrawn_release_is_not_offered() {
        let mut r = release("1.0.0", ">=0.4.0");
        assert!(r.offered());
        r.withdrawn = Some(Withdrawal {
            reason: "Writes outside the folder it asks for.".into(),
            advises_removal: true,
        });
        assert!(!r.offered());
    }

    #[test]
    fn a_runtime_range_that_cannot_be_read_is_not_a_match() {
        assert!(release("1.0.0", ">=0.4.0").runs_on("0.4.0"));
        assert!(!release("1.0.0", ">=0.5.0").runs_on("0.4.0"));
        // Unreadable on either side is a refusal, never a shrug.
        assert!(!release("1.0.0", "whenever").runs_on("0.4.0"));
        assert!(!release("1.0.0", ">=0.4.0").runs_on("sometime"));
    }

    #[test]
    fn a_component_cannot_be_installed_by_this_build() {
        // Not a policy this crate invents — there is no WebAssembly host to run one in.
        assert!(Kind::Project.installable_in_this_build());
        assert!(Kind::Template.installable_in_this_build());
        assert!(!Kind::Component.installable_in_this_build());
    }

    #[test]
    fn archived_stays_visible_and_stops_being_offered() {
        assert!(Moderation::Archived.publicly_visible());
        assert!(!Moderation::Archived.installable());
        assert!(Moderation::Published.installable());
        // A draft is not a public page, and a suspended listing is not a page either.
        assert!(!Moderation::Draft.publicly_visible());
        assert!(!Moderation::PendingReview.publicly_visible());
        assert!(!Moderation::Suspended.publicly_visible());
        assert!(!Moderation::Rejected.publicly_visible());
    }

    #[test]
    fn a_listing_id_is_reverse_dns_and_cannot_be_a_path() {
        assert!(is_listing_id("dev.alice.thumbnails"));
        assert!(is_listing_id("dev.alice.photo-tools.v2"));
        assert!(is_listing_id("a.b"));

        // The ones that matter: every shape that would mean something to a filesystem.
        assert!(!is_listing_id("dev.alice.../../../x"));
        assert!(!is_listing_id("dev.alice..thumbnails"));
        assert!(!is_listing_id("dev.alice./x"));
        assert!(!is_listing_id(r"dev.alice.\x"));
        assert!(!is_listing_id("dev.alice.thumbnails."));
        assert!(!is_listing_id(".dev.alice"));

        // And the ordinary refusals.
        assert!(!is_listing_id(""));
        assert!(!is_listing_id("dev"), "a namespace is not a name in one");
        assert!(!is_listing_id("1dev.alice"), "it starts with a letter");
        assert!(!is_listing_id("Dev.Alice"), "lowercase only");
        assert!(!is_listing_id("dev.alice thumbnails"));
        assert!(!is_listing_id("dev.alice.thumbnails\u{202e}"));
        assert!(!is_listing_id(&format!(
            "dev.{}",
            "a".repeat(MAX_LISTING_ID_CHARS)
        )));
    }

    #[test]
    fn newer_means_newer_and_unreadable_means_no() {
        assert!(is_newer("1.3.0", "1.2.0"));
        assert!(!is_newer("1.2.0", "1.3.0"));
        assert!(!is_newer("1.2.0", "1.2.0"));
        assert!(!is_newer("latest", "1.2.0"));
    }
}
