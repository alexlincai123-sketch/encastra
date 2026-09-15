//! What money would have to do, on the day any moves.
//!
//! None moves today. There is no payment provider, no account to charge, no balance and no
//! payout run — `docs/PLATFORM-ARCHITECTURE.md` §3 puts money last, behind an external security
//! review, the sandbox, signing, a licence decision, a registry and a legal review, and §6 says
//! plainly what skipping that order would cost. This module does not move it earlier. It writes
//! down the arithmetic and the states so that the code which one day talks to a provider has
//! something correct to talk to.
//!
//! Three rules are enforced here rather than left to whoever writes that code:
//!
//! - **Amounts are whole minor units.** No floating point touches money anywhere in this crate.
//!   A price is 499 and a currency, never 4.99.
//! - **A split adds up.** The platform's share and the publisher's share sum to the gross,
//!   exactly, for every input — including the ones where a percentage does not divide evenly.
//! - **A state moves one way.** A refunded purchase does not become paid again; an entitlement
//!   that was revoked is not quietly restored by a later write.
//!
//! What is deliberately not here: a commission rate. Nobody has decided one, and a number
//! invented in a source file has a way of becoming a promise.

use serde::{Deserialize, Serialize};

/// An ISO 4217 code. Amounts alongside it are in its minor unit.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct Currency(String);

impl Currency {
    /// Three uppercase letters, or nothing. A currency this software cannot name is not one it
    /// should be holding an amount in.
    pub fn new(code: &str) -> Option<Self> {
        let ok = code.len() == 3 && code.bytes().all(|b| b.is_ascii_uppercase());
        ok.then(|| Self(code.to_owned()))
    }

    pub fn code(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for Currency {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Currency::new(&value).ok_or_else(|| format!("not a currency code: {value}"))
    }
}

impl From<Currency> for String {
    fn from(value: Currency) -> Self {
        value.0
    }
}

/// What a listing costs.
///
/// Two states, because those are the two this product has thought about. Subscriptions, trials,
/// bundles and tiers are not here: each is a product decision nobody has made, and a variant in
/// an enum is a decision that looks made.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Pricing {
    Free,
    Paid {
        /// Whole minor units. 499 GBP is £4.99.
        amount_minor: u64,
        currency: Currency,
    },
}

impl Pricing {
    pub const fn is_free(&self) -> bool {
        matches!(self, Pricing::Free)
    }
}

/// How a payment divides.
///
/// Built by [`Split::of`] so that the arithmetic happens once, in a place with a test, instead
/// of at each call site with a slightly different rounding.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Split {
    pub gross_minor: u64,
    pub platform_minor: u64,
    pub publisher_minor: u64,
    pub currency: Currency,
}

impl Split {
    /// Divides `gross` at `fee_bps` basis points, giving the remainder to the publisher.
    ///
    /// Basis points rather than a percentage because a percentage invites a float. The
    /// publisher's share is what is left over rather than a second multiplication: two
    /// independent roundings are how a ledger ends up a penny short of itself.
    ///
    /// `None` when the rate is not a rate — over 100% would mean the platform taking more than
    /// was paid, which is not a fee.
    pub fn of(gross_minor: u64, fee_bps: u32, currency: Currency) -> Option<Self> {
        if fee_bps > 10_000 {
            return None;
        }
        let platform_minor = (u128::from(gross_minor) * u128::from(fee_bps) / 10_000) as u64;
        Some(Self {
            gross_minor,
            platform_minor,
            publisher_minor: gross_minor - platform_minor,
            currency,
        })
    }
}

/// Where a payment has got to.
///
/// The provider owns this, not the client. Nothing in this software may set a purchase to paid
/// because a browser said so: the state here mirrors what a provider reported, and the
/// transition rules below are what keeps a replayed or forged message from moving it backwards.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PurchaseState {
    Pending,
    Paid,
    Failed,
    Refunded,
}

impl PurchaseState {
    /// Whether a purchase may move from this state to `next`.
    ///
    /// Pending may become anything. Paid may be refunded. Nothing leaves Failed or Refunded:
    /// a purchase that comes back to life is a purchase somebody replayed.
    pub const fn may_become(self, next: Self) -> bool {
        matches!(
            (self, next),
            (PurchaseState::Pending, _) | (PurchaseState::Paid, PurchaseState::Refunded)
        )
    }
}

/// One payment for one listing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Purchase {
    pub id: String,
    pub listing: String,
    pub buyer: String,
    pub split: Split,
    pub state: PurchaseState,
    /// The provider's own reference. Opaque here on purpose: this software does not model
    /// anybody else's payment object, and no card detail has any business existing in it.
    #[serde(default)]
    pub provider_reference: Option<String>,
    pub created_at_ms: u64,
}

impl Purchase {
    /// Records what a provider reported, refusing a move that cannot happen.
    ///
    /// Returns whether the move was taken. A refused move is not an error to show somebody —
    /// it is usually a message arriving twice — but it must never be silently applied.
    pub fn advance(&mut self, next: PurchaseState) -> bool {
        if !self.state.may_become(next) {
            return false;
        }
        self.state = next;
        true
    }
}

/// Why somebody is allowed to have a thing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum EntitlementSource {
    /// The listing is free. Everybody has this, and it is not stored per person.
    Free,
    Purchase {
        id: String,
    },
    /// Given by a person, with their reason recorded — a review copy, a replacement, an
    /// apology. Rare, and never granted by code.
    Grant {
        reason: String,
    },
}

/// Somebody's right to install a listing.
///
/// This is the record a server would keep and a client would be told about. A client may never
/// be the one that decides it: an entitlement asserted by the machine that benefits from it is
/// not an entitlement.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Entitlement {
    pub listing: String,
    pub holder: String,
    pub source: EntitlementSource,
    pub granted_at_ms: u64,
    /// Set when it stops applying, with the reason. Refunds land here.
    #[serde(default)]
    pub revoked: Option<String>,
}

impl Entitlement {
    pub fn allows_install(&self) -> bool {
        self.revoked.is_none()
    }

    /// Revokes once. A second revocation keeps the first reason, because the first is the one
    /// that explains what happened.
    pub fn revoke(&mut self, reason: &str) {
        if self.revoked.is_none() {
            self.revoked = Some(reason.to_owned());
        }
    }
}

/// Whether somebody may install a listing, given what is known about them.
///
/// A free listing needs no entitlement at all. A paid one needs a live entitlement that names
/// the same listing, and a refunded purchase takes the right away — while leaving what was
/// already installed alone, because deleting somebody's files over a refund is not a refund.
pub fn may_install(pricing: &Pricing, held: Option<&Entitlement>, listing: &str) -> bool {
    if pricing.is_free() {
        return true;
    }
    held.is_some_and(|e| e.listing == listing && e.allows_install())
}

/// Money owed to one publisher for one period.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Payout {
    pub publisher: String,
    pub period_start_ms: u64,
    pub period_end_ms: u64,
    pub amount_minor: u64,
    pub currency: Currency,
    pub state: PayoutState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PayoutState {
    /// Accruing. Not owed yet.
    Open,
    /// Closed and owed.
    Due,
    /// Sent to a provider.
    Sent,
    /// Confirmed by the provider.
    Settled,
}

/// Adds up what a publisher is owed from a set of purchases.
///
/// Only paid purchases count, and only ones in the payout's currency: adding two currencies
/// together produces a number that is wrong in both. Refunded and pending purchases are not
/// owed, which is the whole reason this is a function and not a sum.
pub fn owed(purchases: &[Purchase], currency: &Currency) -> u64 {
    purchases
        .iter()
        .filter(|p| p.state == PurchaseState::Paid && &p.split.currency == currency)
        .map(|p| p.split.publisher_minor)
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gbp() -> Currency {
        Currency::new("GBP").expect("GBP is a currency code")
    }

    fn purchase(id: &str, gross: u64, state: PurchaseState) -> Purchase {
        Purchase {
            id: id.into(),
            listing: "dev.alice.thumbnails".into(),
            buyer: "person".into(),
            split: Split::of(gross, 1_500, gbp()).expect("a rate under 100%"),
            state,
            provider_reference: None,
            created_at_ms: 0,
        }
    }

    #[test]
    fn a_split_adds_up_at_every_amount() {
        // The interesting ones are the amounts a percentage does not divide evenly. If the
        // publisher's share were a second multiplication rather than the remainder, these are
        // exactly the cases that would lose or invent a penny.
        for gross in [0_u64, 1, 7, 99, 100, 499, 1_000, 33_333, 999_999] {
            for bps in [0_u32, 1, 250, 1_500, 3_000, 10_000] {
                let split = Split::of(gross, bps, gbp()).expect("a rate under 100%");
                assert_eq!(
                    split.platform_minor + split.publisher_minor,
                    gross,
                    "{gross} at {bps}bps did not add up"
                );
                assert!(split.platform_minor <= gross);
            }
        }
    }

    #[test]
    fn a_fee_over_everything_is_not_a_fee() {
        assert!(Split::of(1_000, 10_001, gbp()).is_none());
        // Exactly everything is arithmetically fine, and is somebody else's decision to refuse.
        let all = Split::of(1_000, 10_000, gbp()).expect("100% divides");
        assert_eq!(all.publisher_minor, 0);
    }

    #[test]
    fn a_refunded_purchase_does_not_come_back_to_life() {
        let mut p = purchase("p1", 499, PurchaseState::Paid);
        assert!(p.advance(PurchaseState::Refunded));
        // A provider message arriving twice, or a forged one, must not undo a refund.
        assert!(!p.advance(PurchaseState::Paid));
        assert_eq!(p.state, PurchaseState::Refunded);

        let mut failed = purchase("p2", 499, PurchaseState::Failed);
        assert!(!failed.advance(PurchaseState::Paid));
    }

    #[test]
    fn a_free_listing_needs_nothing_and_a_paid_one_needs_a_live_entitlement() {
        let paid = Pricing::Paid {
            amount_minor: 499,
            currency: gbp(),
        };
        assert!(may_install(&Pricing::Free, None, "dev.alice.thumbnails"));
        assert!(!may_install(&paid, None, "dev.alice.thumbnails"));

        let mut held = Entitlement {
            listing: "dev.alice.thumbnails".into(),
            holder: "person".into(),
            source: EntitlementSource::Purchase { id: "p1".into() },
            granted_at_ms: 0,
            revoked: None,
        };
        assert!(may_install(&paid, Some(&held), "dev.alice.thumbnails"));

        // An entitlement for one listing is not an entitlement for another. Without this check
        // any purchase at all would be a key to everything paid.
        assert!(!may_install(&paid, Some(&held), "dev.bob.organiser"));

        held.revoke("Refunded.");
        assert!(!may_install(&paid, Some(&held), "dev.alice.thumbnails"));
        // The first reason is the one that explains what happened.
        held.revoke("Something else.");
        assert_eq!(held.revoked.as_deref(), Some("Refunded."));
    }

    #[test]
    fn only_paid_purchases_in_the_right_currency_are_owed() {
        let usd = Currency::new("USD").expect("USD is a currency code");
        let mut in_dollars = purchase("p4", 10_000, PurchaseState::Paid);
        in_dollars.split = Split::of(10_000, 1_500, usd).expect("a rate under 100%");

        let purchases = [
            purchase("p1", 1_000, PurchaseState::Paid),
            purchase("p2", 1_000, PurchaseState::Pending),
            purchase("p3", 1_000, PurchaseState::Refunded),
            in_dollars,
        ];
        // 1000 at 15% leaves 850 to the publisher. Only the one paid purchase in pounds counts.
        assert_eq!(owed(&purchases, &gbp()), 850);
    }

    #[test]
    fn a_currency_is_three_letters_or_it_is_not_one() {
        assert!(Currency::new("GBP").is_some());
        assert!(Currency::new("gbp").is_none());
        assert!(Currency::new("GB").is_none());
        assert!(Currency::new("GBPX").is_none());
        assert!(Currency::new("").is_none());
        // And it refuses to arrive over the wire either.
        assert!(serde_json::from_str::<Currency>("\"gbp\"").is_err());
    }

    #[test]
    fn a_price_is_whole_minor_units_on_the_wire() {
        let json = serde_json::to_string(&Pricing::Paid {
            amount_minor: 499,
            currency: gbp(),
        })
        .expect("serialises");
        assert_eq!(
            json,
            r#"{"kind":"paid","amount_minor":499,"currency":"GBP"}"#
        );
        // A price written as a decimal is a price that has been through a float somewhere.
        assert!(!json.contains('.'));
    }
}
