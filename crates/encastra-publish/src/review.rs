//! What has to be true before something is handed to a stranger.
//!
//! A project is a file somebody made on their own machine, for their own machine. Publishing it
//! turns it into something other people run, and three kinds of thing that were harmless while
//! it was private stop being harmless the moment it is not: a secret typed into a box, a path
//! that names its author, and a component nobody else has.
//!
//! This is the check that runs before a publication exists. It reads the project — it never
//! runs it, never opens a network, and never touches a file outside the one it was handed — and
//! returns findings. Some of them refuse.
//!
//! Two properties matter more than the list of checks, and both are tested:
//!
//! - **A refusal says what would change the answer.** Every finding carries a remedy, because a
//!   publish button that says no and stops is a dead end, and the person on the other side of
//!   it usually has no idea which of forty settings is the problem.
//! - **Price changes nothing.** Nothing in this module can see what a listing costs. A paid
//!   publication is refused by exactly the code that refuses a free one
//!   (`docs/PLATFORM-ARCHITECTURE.md` §3: "Money buys distribution, not permissions").
//!
//! This is not an audit and must never be described as one. It finds the mistakes that are
//! mechanical enough to find. A person still has to look.

use std::collections::BTreeSet;

use encastra_core::ComponentRef;
use encastra_core::registry::ComponentRegistry;
use encastra_project::{PROJECT_SCHEMA, Project};
use encastra_protocol::manifest::SCOPE_INPUT_HANDLES;
use serde::{Deserialize, Serialize};

use crate::license::{License, LicenseVerdict, carried_inside};

/// How much a finding matters.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Severity {
    /// Worth reading before publishing. Does not stop anything.
    Note,
    /// Likely wrong, and only the author can say. Does not stop anything.
    Warning,
    /// Publishing is refused until this changes.
    Blocking,
}

/// One thing found, in the words of the person who has to fix it.
///
/// Serialised on the way to the interface and never read back: a finding is produced here, by
/// this code, from a project. Something arriving from outside claiming to be one would be a
/// review nobody ran.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Finding {
    /// Stable identifier, for tests and for a support conversation. Never shown alone.
    pub code: &'static str,
    pub severity: Severity,
    /// What was found. One sentence, no jargon.
    pub title: String,
    /// Why it matters, said once.
    pub detail: String,
    /// What would change the answer. Always present, always something the author can do.
    pub remedy: String,
    /// Where it is, when there is a where: a step id, a variable name, a component reference.
    #[serde(default)]
    pub at: Option<String>,
}

/// Everything found, and whether that is a refusal.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Outcome {
    /// Nothing blocking. There may still be findings worth reading.
    MayPublish,
    /// At least one blocking finding. The count is here so a caller cannot show "ready to
    /// publish" next to a refusal by forgetting to look.
    Refused { blocking: usize },
}

/// The result of reading a project with publication in mind.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Review {
    pub outcome: Outcome,
    pub findings: Vec<Finding>,
    /// Every capability every component in this project declares, gathered once. This is what a
    /// person would be shown before installing, and it is collected here rather than at install
    /// time so that the author sees exactly what the stranger will see.
    pub capabilities: Vec<String>,
}

impl Review {
    pub fn may_publish(&self) -> bool {
        matches!(self.outcome, Outcome::MayPublish)
    }

    pub fn blocking(&self) -> impl Iterator<Item = &Finding> {
        self.findings
            .iter()
            .filter(|f| f.severity == Severity::Blocking)
    }
}

/// Config keys whose value is a secret by the name alone.
const SECRET_NAMES: &[&str] = &[
    "key",
    "token",
    "secret",
    "password",
    "passwd",
    "auth",
    "bearer",
    "credential",
    "apikey",
];

/// Openings that are a secret whatever they are called.
const SECRET_PREFIXES: &[&str] = &[
    "sk-",
    "ghp_",
    "gho_",
    "github_pat_",
    "xox",
    "AKIA",
    "ASIA",
    "-----BEGIN",
];

/// Reads a project the way somebody about to receive it would.
///
/// `registry` supplies the manifests this build knows. A component it cannot supply is not
/// assumed to be fine: what a publication asks for has to be readable before it can be
/// disclosed, and a capability nobody can read is a capability nobody can consent to.
///
/// `license` is what the author intends to publish under. It never affects whether a secret is
/// a secret; it decides only the licence findings.
pub fn review(project: &Project, registry: &dyn ComponentRegistry, license: &License) -> Review {
    let mut findings = Vec::new();
    let mut capabilities = BTreeSet::new();

    if project.manifest.schema != PROJECT_SCHEMA {
        findings.push(Finding {
            code: "schema-unreadable",
            severity: Severity::Blocking,
            title: "This project was written by a different version of Encastra.".into(),
            detail: format!(
                "It says it is schema {theirs}, and this build reads schema {ours}. Publishing \
                 it would offer people a file this build cannot open itself.",
                theirs = project.manifest.schema,
                ours = PROJECT_SCHEMA
            ),
            remedy: "Open it in the version of Encastra that wrote it and save it again.".into(),
            at: None,
        });
    }

    if project.graph.nodes.is_empty() {
        findings.push(Finding {
            code: "nothing-to-run",
            severity: Severity::Blocking,
            title: "This project has no steps.".into(),
            detail: "There is nothing in it for somebody to run or take apart.".into(),
            remedy: "Add at least one step, then publish.".into(),
            at: None,
        });
    } else if project.graph.nodes.values().all(|n| n.disabled) {
        findings.push(Finding {
            code: "everything-switched-off",
            severity: Severity::Warning,
            title: "Every step in this project is switched off.".into(),
            detail: "Somebody who installs it and presses Run will watch nothing happen.".into(),
            remedy: "Switch on the steps that should run, or say in the description why they \
                     start switched off."
                .into(),
            at: None,
        });
    }

    for (node_id, node) in &project.graph.nodes {
        for (key, value) in &node.config {
            let Some(text) = value.as_str() else { continue };
            if text.is_empty() {
                continue;
            }
            if let Some(finding) = secret_in(node_id.0.as_str(), key, text) {
                findings.push(finding);
            }
            if let Some(finding) = personal_path_in(node_id.0.as_str(), key, text) {
                findings.push(finding);
            }
            if let Some(finding) = plain_http_in(node_id.0.as_str(), key, text) {
                findings.push(finding);
            }
        }
    }

    // A variable is the place a secret is supposed to go: the format refuses to carry its
    // value, so a project that uses variables for its secrets is the one doing it right. It is
    // worth saying so, because the person installing has to supply them.
    let secret_variables: Vec<_> = project
        .variables
        .iter()
        .filter(|(_, v)| v.secret)
        .map(|(name, _)| name.clone())
        .collect();
    if !secret_variables.is_empty() {
        findings.push(Finding {
            code: "asks-for-secrets",
            severity: Severity::Note,
            title: format!(
                "Whoever installs this has to supply {count} of their own.",
                count = plural(secret_variables.len(), "secret", "secrets")
            ),
            detail: format!(
                "It asks for {names}. The values are never carried in the file — the format \
                 refuses to hold them — so each person supplies their own.",
                names = secret_variables.join(", ")
            ),
            remedy: "Say in the description what each one is and where to get it.".into(),
            at: None,
        });
    }

    for locked in &project.lock.components {
        let reference = ComponentRef {
            id: locked.id.clone(),
            version: locked.version.clone(),
        };
        let at = format!("{}@{}", locked.id, locked.version);

        let Some(manifest) = registry.get(&reference) else {
            findings.push(Finding {
                code: "component-unknown",
                severity: Severity::Blocking,
                title: format!("{at} is not part of this build."),
                detail: "What it can reach cannot be read, so it cannot be disclosed to anybody \
                         installing this — and a permission nobody can read is one nobody can \
                         agree to."
                    .into(),
                remedy: "Replace it with a component this build has, or publish from the build \
                         that has it."
                    .into(),
                at: Some(at),
            });
            continue;
        };

        // The lockfile pins the manifest by digest. A digest that no longer matches means the
        // component changed under a version that promised not to.
        if manifest.digest() != locked.manifest_digest {
            findings.push(Finding {
                code: "component-changed",
                severity: Severity::Blocking,
                title: format!("{at} is not the one this project was built against."),
                detail: "The project pins it by content, and the content here is different. \
                         Publishing would hand people a workflow pinned to something they \
                         cannot get."
                    .into(),
                remedy: "Open the project, let it record the components it actually uses, save \
                         it, and publish again."
                    .into(),
                at: Some(at),
            });
            continue;
        }

        for capability in &manifest.capabilities {
            if capability.scope != SCOPE_INPUT_HANDLES {
                capabilities.insert(capability.kind.clone());
            }
        }

        if let Some(component_license) = component_license(manifest) {
            let verdict = carried_inside(&component_license, license);
            match verdict {
                LicenseVerdict::Compatible => {}
                LicenseVerdict::Conflict { reason } => findings.push(Finding {
                    code: "licence-conflict",
                    severity: Severity::Blocking,
                    title: format!("{at} cannot be published under these terms."),
                    detail: reason,
                    remedy: "Publish under the same licence as that part, or replace the part."
                        .into(),
                    at: Some(at.clone()),
                }),
                LicenseVerdict::NeedsReview { reason } => findings.push(Finding {
                    code: "licence-unread",
                    severity: Severity::Warning,
                    title: format!("Nobody here can say whether {at} may be passed on."),
                    detail: reason,
                    remedy: "Check the terms of that part yourself before publishing.".into(),
                    at: Some(at.clone()),
                }),
            }
        }
    }

    if !capabilities.is_empty() {
        findings.push(Finding {
            code: "reaches-beyond-itself",
            severity: Severity::Note,
            title: "This asks to reach things outside itself when it runs.".into(),
            detail: format!(
                "It uses {list}. Nobody is granted any of it by installing — each person is \
                 asked, every run, before anything is touched.",
                list = capabilities.iter().cloned().collect::<Vec<_>>().join(", ")
            ),
            remedy: "Say in the description what it does with each one, so the question is not \
                     a surprise."
                .into(),
            at: None,
        });
    }

    let blocking = findings
        .iter()
        .filter(|f| f.severity == Severity::Blocking)
        .count();
    Review {
        outcome: if blocking == 0 {
            Outcome::MayPublish
        } else {
            Outcome::Refused { blocking }
        },
        findings,
        capabilities: capabilities.into_iter().collect(),
    }
}

/// The licence a component states, where it states one this software can name.
fn component_license(manifest: &encastra_protocol::manifest::ComponentManifest) -> Option<License> {
    let stated = manifest.license.as_deref()?;
    Some(match stated {
        "MIT" => License::Mit,
        "Apache-2.0" => License::Apache2,
        "GPL-3.0-only" | "GPL-3.0" => License::Gpl3,
        "UNLICENSED" => License::Proprietary,
        other => License::Custom {
            name: other.to_owned(),
        },
    })
}

/// A value that should not leave the machine it was typed on.
fn secret_in(node_id: &str, key: &str, value: &str) -> Option<Finding> {
    let lowered = key.to_ascii_lowercase();
    let named_secret = SECRET_NAMES.iter().any(|name| lowered.contains(name));
    let looks_secret = SECRET_PREFIXES
        .iter()
        .any(|prefix| value.starts_with(prefix));

    if !named_secret && !looks_secret {
        return None;
    }
    // A setting called "key" holding the word "name" is somebody sorting by a column, not a
    // credential. Length is a poor signal on its own, which is why it is only used to rule
    // things out after the name already raised the question.
    if named_secret && !looks_secret && value.len() < 16 {
        return None;
    }

    Some(Finding {
        code: "secret-in-settings",
        severity: Severity::Blocking,
        title: format!("The setting “{key}” looks like a secret."),
        detail: "Everything typed into a setting is saved in the project file, and publishing \
                 hands that file to everybody who installs it."
            .into(),
        remedy: "Clear the setting and declare it as a secret variable instead: the format \
                 refuses to carry a variable's value, so each person supplies their own."
            .into(),
        at: Some(node_id.to_owned()),
    })
}

/// A path that names its author, or names a place nobody else has.
fn personal_path_in(node_id: &str, key: &str, value: &str) -> Option<Finding> {
    let home = home_prefix(value)?;
    Some(Finding {
        code: "path-names-its-author",
        severity: Severity::Blocking,
        title: format!("The setting “{key}” points inside somebody's home folder."),
        detail: format!(
            "It is set to a path under {home}, which names the person who made this and does \
             not exist on anybody else's machine."
        ),
        remedy: "Point it at a folder chosen when the workflow runs, or clear it and let \
                 whoever installs this choose."
            .into(),
        at: Some(node_id.to_owned()),
    })
}

/// The home-folder prefix of a path, if it has one.
///
/// Windows, macOS and Linux write it three different ways, and all three carry a username.
fn home_prefix(value: &str) -> Option<String> {
    let normalised = value.replace('\\', "/");
    for root in ["C:/Users/", "c:/Users/", "/home/", "/Users/"] {
        if let Some(rest) = normalised.strip_prefix(root) {
            let user = rest.split('/').next().unwrap_or_default();
            if !user.is_empty() {
                return Some(format!("{root}{user}"));
            }
        }
    }
    None
}

/// An address that would be fetched without protection.
fn plain_http_in(node_id: &str, key: &str, value: &str) -> Option<Finding> {
    if !value.starts_with("http://") {
        return None;
    }
    Some(Finding {
        code: "address-without-protection",
        severity: Severity::Warning,
        title: format!("The setting “{key}” is a plain http address."),
        detail: "Anything sent to or from it travels in the open, and anybody between the two \
                 machines can change it on the way."
            .into(),
        remedy: "Use the https address if the same server offers one.".into(),
        at: Some(node_id.to_owned()),
    })
}

fn plural(count: usize, one: &str, many: &str) -> String {
    if count == 1 {
        format!("{count} {one}")
    } else {
        format!("{count} {many}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use encastra_core::graph::{Graph, Node, NodeId, Position};
    use encastra_core::registry::InMemoryRegistry;
    use encastra_project::{Lockfile, ProjectManifest, Variable, Variables};
    use encastra_protocol::manifest::ComponentManifest;
    use std::collections::BTreeMap;

    const MANIFEST: &str = r#"{
      "schema": 1,
      "id": "encastra.file.read",
      "version": "1.0.0",
      "name": "Read File",
      "runtime": ">=0.1.0",
      "kind": "core",
      "ports": { "inputs": {}, "outputs": { "text": { "type": "string", "required": true } } },
      "config": {},
      "capabilities": [
        { "kind": "fs.read", "scope": "input-handles", "reason": "Reads the file connected to it." }
      ],
      "platforms": ["windows", "macos", "linux"]
    }"#;

    fn manifest_with(capabilities: &str, license: Option<&str>) -> ComponentManifest {
        let mut value: serde_json::Value = serde_json::from_str(MANIFEST).expect("valid fixture");
        value["capabilities"] = serde_json::from_str(capabilities).expect("valid capabilities");
        if let Some(license) = license {
            value["license"] = serde_json::Value::String(license.to_owned());
        }
        ComponentManifest::parse(&value.to_string()).expect("a manifest the runtime accepts")
    }

    fn registry_of(manifests: Vec<ComponentManifest>) -> InMemoryRegistry {
        let mut registry = InMemoryRegistry::default();
        for manifest in manifests {
            registry
                .insert(manifest)
                .expect("the fixture registers once");
        }
        registry
    }

    fn project_with(nodes: BTreeMap<NodeId, Node>, manifest: &ComponentManifest) -> Project {
        Project {
            manifest: ProjectManifest {
                schema: PROJECT_SCHEMA,
                id: "p1".into(),
                name: "Thumbnails".into(),
                description: None,
                runtime: ">=0.4.0".into(),
                created_at_ms: 0,
                modified_at_ms: 0,
            },
            graph: Graph {
                nodes,
                edges: Vec::new(),
            },
            lock: Lockfile {
                components: vec![encastra_project::LockedComponent {
                    id: manifest.id.clone(),
                    version: manifest.version.clone(),
                    manifest_digest: manifest.digest(),
                    origin: "builtin".into(),
                }],
            },
            variables: Variables::new(),
            history: Default::default(),
        }
    }

    fn node_with(config: BTreeMap<String, serde_json::Value>) -> BTreeMap<NodeId, Node> {
        let mut nodes = BTreeMap::new();
        nodes.insert(
            NodeId("read-1".to_string()),
            Node {
                component: ComponentRef {
                    id: "encastra.file.read".into(),
                    version: "1.0.0".into(),
                },
                label: None,
                config,
                position: Position::default(),
                disabled: false,
            },
        );
        nodes
    }

    fn setting(key: &str, value: &str) -> BTreeMap<String, serde_json::Value> {
        let mut config = BTreeMap::new();
        config.insert(key.to_string(), serde_json::Value::String(value.into()));
        config
    }

    fn found<'a>(review: &'a Review, code: &str) -> Option<&'a Finding> {
        review.findings.iter().find(|f| f.code == code)
    }

    #[test]
    fn a_clean_project_may_be_published() {
        let manifest = manifest_with(
            r#"[{"kind":"fs.read","scope":"input-handles","reason":"Reads the file connected to it."}]"#,
            Some("MIT"),
        );
        let project = project_with(node_with(setting("pattern", "*.png")), &manifest);
        let review = review(&project, &registry_of(vec![manifest]), &License::Mit);
        assert!(review.may_publish(), "{:#?}", review.findings);
        // An input-handles capability is not a permission anybody is asked about, so it is not
        // listed as one: the disclosure has to mean something.
        assert!(review.capabilities.is_empty());
    }

    #[test]
    fn a_secret_typed_into_a_setting_refuses_the_publication() {
        let manifest = manifest_with(
            r#"[{"kind":"net.http","scope":"allowed-hosts","reason":"Sends the result to the address you configure."}]"#,
            Some("MIT"),
        );
        let project = project_with(
            node_with(setting("apiKey", "sk-live-9d2f4a7c1b8e6f30")),
            &manifest,
        );
        let review = review(&project, &registry_of(vec![manifest]), &License::Mit);

        assert!(!review.may_publish());
        let finding = found(&review, "secret-in-settings").expect("the secret is found");
        assert_eq!(finding.severity, Severity::Blocking);
        assert_eq!(finding.at.as_deref(), Some("read-1"));
        // And the capability is still disclosed, because the two are separate questions.
        assert_eq!(review.capabilities, vec!["net.http".to_string()]);
    }

    #[test]
    fn a_short_value_in_a_field_merely_named_key_is_not_a_secret() {
        let manifest = manifest_with(
            r#"[{"kind":"fs.read","scope":"input-handles","reason":"Reads the file connected to it."}]"#,
            Some("MIT"),
        );
        // "sortKey" holding "name" is somebody choosing a column. Refusing it would train
        // people to ignore the refusal, which costs more than the check is worth.
        let project = project_with(node_with(setting("sortKey", "name")), &manifest);
        let review = review(&project, &registry_of(vec![manifest]), &License::Mit);
        assert!(review.may_publish(), "{:#?}", review.findings);
    }

    #[test]
    fn a_private_key_is_a_secret_whatever_the_setting_is_called() {
        let manifest = manifest_with(
            r#"[{"kind":"fs.read","scope":"input-handles","reason":"Reads the file connected to it."}]"#,
            Some("MIT"),
        );
        let project = project_with(
            node_with(setting("notes", "-----BEGIN OPENSSH PRIVATE KEY-----")),
            &manifest,
        );
        let review = review(&project, &registry_of(vec![manifest]), &License::Mit);
        assert!(!review.may_publish());
        assert!(found(&review, "secret-in-settings").is_some());
    }

    #[test]
    fn a_path_through_somebody_s_home_folder_refuses_the_publication() {
        let manifest = manifest_with(
            r#"[{"kind":"fs.read","scope":"input-handles","reason":"Reads the file connected to it."}]"#,
            Some("MIT"),
        );
        for path in [
            r"C:\Users\alex\Pictures\holiday",
            "/home/alex/pictures",
            "/Users/alex/Pictures",
        ] {
            let project = project_with(node_with(setting("folder", path)), &manifest);
            let review = review(
                &project,
                &registry_of(vec![manifest.clone()]),
                &License::Mit,
            );
            assert!(!review.may_publish(), "{path} should be refused");
            let finding = found(&review, "path-names-its-author").expect("the path is found");
            // The name is the point: publishing it tells everybody who made this what they are
            // called on their own computer.
            assert!(finding.detail.contains("alex"));
        }
    }

    #[test]
    fn a_component_this_build_does_not_have_refuses_the_publication() {
        let manifest = manifest_with(
            r#"[{"kind":"fs.read","scope":"input-handles","reason":"Reads the file connected to it."}]"#,
            Some("MIT"),
        );
        let project = project_with(node_with(setting("pattern", "*.png")), &manifest);
        // Nothing in the registry: what this project asks for cannot be read, so it cannot be
        // disclosed to anybody installing it.
        let review = review(&project, &registry_of(Vec::new()), &License::Mit);
        assert!(!review.may_publish());
        assert!(found(&review, "component-unknown").is_some());
    }

    #[test]
    fn a_component_whose_content_no_longer_matches_its_pin_refuses_the_publication() {
        let manifest = manifest_with(
            r#"[{"kind":"fs.read","scope":"input-handles","reason":"Reads the file connected to it."}]"#,
            Some("MIT"),
        );
        let mut project = project_with(node_with(setting("pattern", "*.png")), &manifest);
        project.lock.components[0].manifest_digest = "0".repeat(64);
        let review = review(&project, &registry_of(vec![manifest]), &License::Mit);
        assert!(!review.may_publish());
        assert!(found(&review, "component-changed").is_some());
    }

    #[test]
    fn copyleft_inside_other_terms_refuses_the_publication() {
        let manifest = manifest_with(
            r#"[{"kind":"fs.read","scope":"input-handles","reason":"Reads the file connected to it."}]"#,
            Some("GPL-3.0-only"),
        );
        let project = project_with(node_with(setting("pattern", "*.png")), &manifest);
        let under_other_terms = review(
            &project,
            &registry_of(vec![manifest.clone()]),
            &License::Mit,
        );
        assert!(!under_other_terms.may_publish());
        assert!(found(&under_other_terms, "licence-conflict").is_some());

        // Under the same terms it is simply fine — the refusal is about the mismatch, not the
        // licence.
        let under_the_same_terms = review(&project, &registry_of(vec![manifest]), &License::Gpl3);
        assert!(
            under_the_same_terms.may_publish(),
            "{:#?}",
            under_the_same_terms.findings
        );
    }

    #[test]
    fn an_empty_project_has_nothing_to_publish() {
        let manifest = manifest_with(
            r#"[{"kind":"fs.read","scope":"input-handles","reason":"Reads the file connected to it."}]"#,
            Some("MIT"),
        );
        let mut project = project_with(BTreeMap::new(), &manifest);
        project.lock.components.clear();
        let review = review(&project, &registry_of(vec![manifest]), &License::Mit);
        assert!(!review.may_publish());
        assert!(found(&review, "nothing-to-run").is_some());
    }

    #[test]
    fn secret_variables_are_told_about_rather_than_refused() {
        let manifest = manifest_with(
            r#"[{"kind":"net.http","scope":"allowed-hosts","reason":"Sends the result to the address you configure."}]"#,
            Some("MIT"),
        );
        let mut project = project_with(node_with(setting("pattern", "*.png")), &manifest);
        project.variables.insert(
            "API_TOKEN".into(),
            Variable {
                type_: "text".into(),
                secret: true,
                doc: None,
            },
        );
        let review = review(&project, &registry_of(vec![manifest]), &License::Mit);
        // This is the shape that does it right: the value cannot be in the file at all.
        assert!(review.may_publish(), "{:#?}", review.findings);
        let finding = found(&review, "asks-for-secrets").expect("it is mentioned");
        assert_eq!(finding.severity, Severity::Note);
        assert!(finding.detail.contains("API_TOKEN"));
    }

    #[test]
    fn every_finding_says_what_would_change_the_answer() {
        // The property that makes a refusal usable. A publish screen that says no and stops
        // leaves somebody guessing which of forty settings is the problem.
        let manifest = manifest_with(
            r#"[{"kind":"net.http","scope":"allowed-hosts","reason":"Sends the result to the address you configure."}]"#,
            Some("GPL-3.0-only"),
        );
        let mut config = setting("apiKey", "sk-live-9d2f4a7c1b8e6f30");
        config.insert(
            "folder".into(),
            serde_json::Value::String("/home/alex/pictures".into()),
        );
        config.insert(
            "endpoint".into(),
            serde_json::Value::String("http://example.com/upload".into()),
        );
        let project = project_with(node_with(config), &manifest);
        let review = review(&project, &registry_of(vec![manifest]), &License::Mit);

        assert!(review.findings.len() >= 4, "{:#?}", review.findings);
        for finding in &review.findings {
            assert!(!finding.remedy.is_empty(), "{} has no remedy", finding.code);
            assert!(
                finding.remedy.ends_with('.'),
                "{} does not finish its sentence",
                finding.code
            );
            assert!(!finding.title.is_empty());
            assert!(!finding.detail.is_empty());
        }
        let Outcome::Refused { blocking } = review.outcome else {
            panic!("this should be refused")
        };
        assert_eq!(blocking, review.blocking().count());
    }
}
