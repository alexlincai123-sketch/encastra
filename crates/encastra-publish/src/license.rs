//! What somebody is allowed to do with what they downloaded.
//!
//! This is a small, deliberately timid module. It knows four licences by name and refuses to
//! guess about anything else, because a licence is a legal instrument and a piece of software
//! that cheerfully announces "compatible" is giving legal advice it is in no position to give.
//!
//! The one thing it will say out loud is **no**. A copyleft component carried into a work that
//! is not offered under the same terms is a known conflict, and saying so early — while
//! somebody is still choosing — is worth more than a clean-looking screen.

use serde::{Deserialize, Serialize};

/// The licences this software can name.
///
/// `Custom` exists because most licences are not on this list, not because custom licences are
/// unusual. Anything in it is treated as unknown, which is the truth.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "id", rename_all = "kebab-case")]
pub enum License {
    /// All rights reserved. The default state of anything nobody licensed.
    Proprietary,
    Mit,
    #[serde(rename = "apache-2.0")]
    Apache2,
    #[serde(rename = "gpl-3.0-only")]
    Gpl3,
    Custom {
        /// Whatever the publisher calls it. Never parsed, never interpreted.
        name: String,
    },
}

impl License {
    /// The SPDX identifier, where one exists.
    pub fn spdx(&self) -> Option<&'static str> {
        match self {
            License::Proprietary => None,
            License::Mit => Some("MIT"),
            License::Apache2 => Some("Apache-2.0"),
            License::Gpl3 => Some("GPL-3.0-only"),
            License::Custom { .. } => None,
        }
    }

    /// Whether the licence itself permits somebody else to pass the work on.
    ///
    /// Proprietary and custom terms may well permit it — they simply do not say so here, and
    /// "it did not say no" is not permission.
    pub fn permits_redistribution(&self) -> bool {
        matches!(self, License::Mit | License::Apache2 | License::Gpl3)
    }
}

/// What can honestly be said about carrying one licensed thing inside another.
///
/// There is no `Compatible` for the hard cases on purpose. Two of these verdicts are facts
/// about text this software can read; the third is an admission.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LicenseVerdict {
    /// The two licences are the same, or the inner one is permissive and places no condition on
    /// the terms of the work around it. This is the only case stated as an allowance.
    Compatible,
    /// A conflict this software can name: copyleft terms inside a work not offered under them.
    /// The reason is written for the person who has to decide, not for a lawyer.
    Conflict { reason: String },
    /// Not something this software can answer. Most of the world lands here.
    NeedsReview { reason: String },
}

impl LicenseVerdict {
    /// Whether publishing should be stopped over this.
    ///
    /// Only a named conflict stops anything. "I do not know" is not a refusal — it is a thing
    /// to tell somebody, and then let them decide, because they know their own agreements and
    /// this software does not.
    pub fn blocks(&self) -> bool {
        matches!(self, LicenseVerdict::Conflict { .. })
    }
}

/// Whether `inner` can be carried inside a work published under `outer`.
///
/// Read it as: a project licensed `outer` contains a component licensed `inner`.
pub fn carried_inside(inner: &License, outer: &License) -> LicenseVerdict {
    if let License::Custom { name } = inner {
        return LicenseVerdict::NeedsReview {
            reason: format!(
                "The terms called “{name}” are not ones this software can read. Whether they \
                 allow this has to be checked by somebody who can."
            ),
        };
    }
    if let License::Custom { name } = outer {
        return LicenseVerdict::NeedsReview {
            reason: format!(
                "Publishing under terms called “{name}” is not something this software can \
                 check against what this work contains."
            ),
        };
    }

    if inner == outer {
        return LicenseVerdict::Compatible;
    }

    match (inner, outer) {
        // Copyleft is the one rule here written as a refusal. Carrying GPL-3.0 work into
        // something offered under other terms is the conflict people meet most often and
        // discover latest, usually after publishing.
        (License::Gpl3, _) => LicenseVerdict::Conflict {
            reason: "This carries a part licensed GPL-3.0-only, which requires the whole work \
                     to be offered under GPL-3.0-only as well. Either publish under that \
                     licence or replace the part."
                .into(),
        },
        // Permissive inside anything: MIT and Apache-2.0 place conditions on attribution, not
        // on the terms of the surrounding work.
        (License::Mit | License::Apache2, _) => LicenseVerdict::Compatible,
        (License::Proprietary, _) => LicenseVerdict::NeedsReview {
            reason: "This carries a part whose licence reserves all rights. Passing it on needs \
                     permission from whoever holds them, which is not something this software \
                     can see."
                .into(),
        },
        (License::Custom { .. }, _) => unreachable!("custom is answered above"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_same_licence_on_both_sides_is_the_simple_case() {
        assert_eq!(
            carried_inside(&License::Mit, &License::Mit),
            LicenseVerdict::Compatible
        );
        assert_eq!(
            carried_inside(&License::Gpl3, &License::Gpl3),
            LicenseVerdict::Compatible
        );
        assert_eq!(
            carried_inside(&License::Proprietary, &License::Proprietary),
            LicenseVerdict::Compatible
        );
    }

    #[test]
    fn copyleft_inside_other_terms_is_named_as_a_conflict() {
        for outer in [License::Mit, License::Apache2, License::Proprietary] {
            let verdict = carried_inside(&License::Gpl3, &outer);
            assert!(verdict.blocks(), "GPL inside {outer:?} should block");
            // The refusal has to say what would change the answer, not merely that it is one.
            let LicenseVerdict::Conflict { reason } = verdict else {
                unreachable!()
            };
            assert!(reason.contains("GPL-3.0-only"));
            assert!(reason.ends_with('.'));
        }
    }

    #[test]
    fn permissive_inside_anything_is_the_only_allowance_granted() {
        assert_eq!(
            carried_inside(&License::Mit, &License::Proprietary),
            LicenseVerdict::Compatible
        );
        assert_eq!(
            carried_inside(&License::Apache2, &License::Gpl3),
            LicenseVerdict::Compatible
        );
    }

    #[test]
    fn anything_custom_is_answered_with_an_admission_and_never_a_blessing() {
        let custom = License::Custom {
            name: "Alice Studio Terms".into(),
        };
        for verdict in [
            carried_inside(&custom, &License::Mit),
            carried_inside(&License::Mit, &custom),
            carried_inside(&custom, &custom),
        ] {
            assert!(
                matches!(verdict, LicenseVerdict::NeedsReview { .. }),
                "custom terms must never be answered with a verdict, got {verdict:?}"
            );
            // Unknown is not a refusal: it is told to somebody, who then decides.
            assert!(!verdict.blocks());
        }
    }

    #[test]
    fn reserved_rights_are_not_read_as_permission() {
        assert!(!License::Proprietary.permits_redistribution());
        assert!(
            !License::Custom {
                name: "whatever".into()
            }
            .permits_redistribution()
        );
        assert!(License::Mit.permits_redistribution());
    }

    #[test]
    fn a_licence_survives_a_round_trip_through_the_wire() {
        for licence in [
            License::Proprietary,
            License::Mit,
            License::Apache2,
            License::Gpl3,
            License::Custom {
                name: "Alice Studio Terms".into(),
            },
        ] {
            let json = serde_json::to_string(&licence).expect("serialises");
            let back: License = serde_json::from_str(&json).expect("parses");
            assert_eq!(licence, back);
        }
        // The identifier people actually write is the one on the wire.
        assert_eq!(
            serde_json::to_string(&License::Apache2).unwrap(),
            r#"{"id":"apache-2.0"}"#
        );
    }
}
