//! What it would mean to publish something made with Encastra.
//!
//! None of this ships a registry, a marketplace, an account or a payment. There is no server
//! here and this crate never opens a socket. What it does is give the ideas in
//! `docs/PLATFORM-ARCHITECTURE.md` §2–§4 a shape the compiler can check and the tests can hold
//! to a promise, so that the day a registry exists it is built against something that already
//! knows what a listing is, what a release carries, who is allowed to hold one, and what money
//! would have to do to itself if any ever moved.
//!
//! Two rules from that document are load-bearing here and are enforced rather than described:
//!
//! - **Money buys distribution, not permissions.** [`Listing::pricing`] and the capabilities a
//!   release declares are kept apart on purpose, and nothing in this crate lets a price change
//!   a capability, a decision, or a review outcome. A paid publication is reviewed by exactly
//!   the same code as a free one.
//! - **A publication is refused before it exists, not withdrawn afterwards.** [`review`] runs
//!   over the project itself and returns findings; a finding that blocks is a refusal with a
//!   reason and something to do about it, never a warning somebody can click past.
//!
//! What is deliberately absent: signatures ([`Release::checksum`] is a content hash, which is
//! integrity, not provenance — ADR-0008 describes the signing that does not exist yet), any
//! network client, any payment provider, and any notion of trust that is not stated as an
//! explicit, reviewable state.

pub mod bundle;
pub mod license;
pub mod listing;
pub mod money;
pub mod review;

pub use bundle::{BundleError, PublicationBundle, PublicationDraft};
pub use license::{License, LicenseVerdict};
pub use listing::{Kind, Listing, Moderation, Publisher, Release, Withdrawal};
pub use money::{Currency, Entitlement, EntitlementSource, Payout, Pricing, Purchase, Split};
pub use review::{Finding, Outcome, Review, Severity, review};
