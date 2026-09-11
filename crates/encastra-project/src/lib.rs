//! The `.encastra` project container.
//!
//! One file holds everything a project is: the graph, a lockfile pinning every component by
//! content hash, the variables it expects, and its version history. It is a ZIP, so anybody
//! can open it and look, and it is written **deterministically** — sorted entries, one fixed
//! timestamp — so saving an unchanged project produces identical bytes.
//!
//! That determinism is not tidiness. It is what makes "did this project change?" answerable by
//! comparing hashes, what keeps version history honest, and what stops a save from appearing as
//! a diff in somebody's repository because the clock moved.
//!
//! # What is never in here
//!
//! Secret values. `variables.json` records that a variable exists, what type it is, and that it
//! is secret — never its value, which is resolved from the OS keystore at the point of use. A
//! `.encastra` file is safe to send to somebody.

use std::collections::BTreeMap;
use std::io::{Cursor, Read, Seek, Write};
use std::path::Path;

use encastra_core::graph::{Graph, NodeId};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub mod history;

pub use history::{Change, History, Snapshot, SnapshotId};

/// The container revision. Additive-only; a higher value is refused rather than guessed at.
pub const PROJECT_SCHEMA: u32 = 1;

const ENTRY_PROJECT: &str = "project.json";
const ENTRY_GRAPH: &str = "graph.json";
const ENTRY_LOCK: &str = "lock.json";
const ENTRY_VARIABLES: &str = "variables.json";
const ENTRY_HISTORY: &str = "versions/index.json";
const HISTORY_PREFIX: &str = "versions/";

#[derive(Debug, thiserror::Error)]
pub enum ProjectError {
    #[error("this build reads project schema {ours}, but the file declares {theirs}")]
    UnsupportedSchema { ours: u32, theirs: u32 },
    #[error("the project file is missing {0}")]
    MissingEntry(String),
    #[error("{entry} is not valid: {reason}")]
    Invalid { entry: String, reason: String },
    #[error("the project file could not be read as an archive: {0}")]
    Archive(String),
    #[error("{entry} unpacks to more than this build will read ({limit} bytes)")]
    TooLarge { entry: String, limit: u64 },
    #[error("input/output error: {0}")]
    Io(String),
}

impl From<std::io::Error> for ProjectError {
    fn from(e: std::io::Error) -> Self {
        // The kind, not the message: an io error message can contain a path from the user's
        // machine, and these surface in logs and in the UI.
        ProjectError::Io(e.kind().to_string())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProjectManifest {
    pub schema: u32,
    /// Stable across renames, so history and shares survive a new name.
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// Semver range of runtimes known to run this project.
    pub runtime: String,
    pub created_at_ms: u64,
    pub modified_at_ms: u64,
}

/// One component, pinned.
///
/// The digest is part of the identity: opening a project resolves *these bytes*, not "whatever
/// is published under that version now".
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LockedComponent {
    pub id: String,
    pub version: String,
    /// `sha256` of the canonical manifest.
    pub manifest_digest: String,
    /// Where it came from. `builtin` for the first-party set.
    pub origin: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct Lockfile {
    #[serde(default)]
    pub components: Vec<LockedComponent>,
}

/// A value the project expects to be supplied, by name.
///
/// `secret: true` means the value lives in the OS keystore and is looked up at the point of
/// use. There is deliberately no field here that could hold one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Variable {
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(default)]
    pub secret: bool,
    #[serde(default)]
    pub doc: Option<String>,
}

pub type Variables = BTreeMap<String, Variable>;

#[derive(Debug, Clone, PartialEq)]
pub struct Project {
    pub manifest: ProjectManifest,
    pub graph: Graph,
    pub lock: Lockfile,
    pub variables: Variables,
    pub history: History,
}

impl Project {
    pub fn new(name: impl Into<String>, now_ms: u64) -> Self {
        let name = name.into();
        Project {
            manifest: ProjectManifest {
                schema: PROJECT_SCHEMA,
                id: identifier(&name, now_ms),
                name,
                description: None,
                runtime: format!(">={}", encastra_core::RUNTIME_VERSION),
                created_at_ms: now_ms,
                modified_at_ms: now_ms,
            },
            graph: Graph::default(),
            lock: Lockfile::default(),
            variables: Variables::new(),
            history: History::default(),
        }
    }

    /// The hash of the current graph. Two projects with this hash compute the same thing.
    pub fn graph_hash(&self) -> String {
        hash(self.graph.to_json().as_bytes())
    }

    // -- reading ---------------------------------------------------------------------------

    pub fn open(path: &Path) -> Result<Self, ProjectError> {
        Self::from_bytes(&std::fs::read(path)?)
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, ProjectError> {
        let mut archive = zip::ZipArchive::new(Cursor::new(bytes))
            .map_err(|e| ProjectError::Archive(e.to_string()))?;

        let manifest: ProjectManifest = read_json(&mut archive, ENTRY_PROJECT)?;
        if manifest.schema != PROJECT_SCHEMA {
            return Err(ProjectError::UnsupportedSchema {
                ours: PROJECT_SCHEMA,
                theirs: manifest.schema,
            });
        }

        let graph: Graph = read_json(&mut archive, ENTRY_GRAPH)?;
        let lock: Lockfile = read_json(&mut archive, ENTRY_LOCK)?;
        let variables: Variables = read_json(&mut archive, ENTRY_VARIABLES)?;
        let mut history: History = read_json(&mut archive, ENTRY_HISTORY)?;

        // Snapshot bodies live beside the index. A snapshot whose body is missing is dropped
        // and the rest of the history is kept: losing one old version is survivable, refusing
        // to open the project is not.
        let mut bodies = BTreeMap::new();
        for snapshot in &history.snapshots {
            let entry = format!("{HISTORY_PREFIX}{}.json", snapshot.id.0);
            if let Ok(graph) = read_json::<Graph, _>(&mut archive, &entry) {
                bodies.insert(snapshot.id.clone(), graph);
            }
        }
        history.attach_bodies(bodies);

        Ok(Project {
            manifest,
            graph,
            lock,
            variables,
            history,
        })
    }

    // -- writing ---------------------------------------------------------------------------

    pub fn save(&self, path: &Path) -> Result<(), ProjectError> {
        let bytes = self.to_bytes()?;
        // Written beside the target and moved into place, so a crash mid-write leaves the
        // previous project intact rather than a truncated file where it used to be.
        let temporary = path.with_extension("encastra-writing");
        std::fs::write(&temporary, &bytes)?;
        std::fs::rename(&temporary, path)?;
        Ok(())
    }

    pub fn to_bytes(&self) -> Result<Vec<u8>, ProjectError> {
        let mut buffer = Cursor::new(Vec::new());
        {
            let mut writer = zip::ZipWriter::new(&mut buffer);

            let mut entries: Vec<(String, Vec<u8>)> = vec![
                (ENTRY_PROJECT.into(), to_pretty(&self.manifest)),
                (ENTRY_GRAPH.into(), into_bytes(self.graph.to_json())),
                (ENTRY_LOCK.into(), to_pretty(&self.lock)),
                (ENTRY_VARIABLES.into(), to_pretty(&self.variables)),
                (ENTRY_HISTORY.into(), to_pretty(&self.history)),
                ("README.md".into(), into_bytes(readme(&self.manifest))),
            ];

            for snapshot in &self.history.snapshots {
                if let Some(graph) = self.history.body(&snapshot.id) {
                    entries.push((
                        format!("{HISTORY_PREFIX}{}.json", snapshot.id.0),
                        into_bytes(graph.to_json()),
                    ));
                }
            }

            // Sorted, so the archive's order never depends on a map's iteration order.
            entries.sort_by(|a, b| a.0.cmp(&b.0));

            for (name, content) in entries {
                writer
                    .start_file(&name, deterministic_options())
                    .map_err(|e| ProjectError::Archive(e.to_string()))?;
                writer.write_all(&content)?;
            }

            writer
                .finish()
                .map_err(|e| ProjectError::Archive(e.to_string()))?;
        }
        Ok(buffer.into_inner())
    }
}

/// Every entry gets the same fixed timestamp and no extra metadata.
///
/// A real clock here would make two saves of an unchanged project produce different bytes,
/// which would break hash comparison and fill version control with noise.
fn deterministic_options() -> zip::write::SimpleFileOptions {
    zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .last_modified_time(zip::DateTime::default())
        .unix_permissions(0o644)
}

fn into_bytes(mut text: String) -> Vec<u8> {
    if !text.ends_with('\n') {
        text.push('\n');
    }
    text.into_bytes()
}

fn to_pretty<T: Serialize>(value: &T) -> Vec<u8> {
    into_bytes(serde_json::to_string_pretty(value).expect("project data always serialises"))
}

/// The most any single entry may unpack to.
///
/// A `.encastra` file is a handful of JSON documents. The largest realistic one is the graph of
/// an enormous workflow, which is still kilobytes — so this ceiling is generous by a wide margin
/// and is not there to constrain honest files.
///
/// It is there because a ZIP entry's compressed size says nothing about its uncompressed size.
/// A few kilobytes of zeros expands to gigabytes, and a project file is exactly the kind of
/// thing somebody is sent and opens. Without a ceiling, reading one is an out-of-memory crash
/// that the person who sent it chose. The same reasoning already governs image decoding in
/// `encastra-core::media`, which probes dimensions before it allocates.
pub const MAX_ENTRY_BYTES: u64 = 32 * 1024 * 1024;

fn read_json<T: for<'de> Deserialize<'de>, R: Read + Seek>(
    archive: &mut zip::ZipArchive<R>,
    entry: &str,
) -> Result<T, ProjectError> {
    let file = archive
        .by_name(entry)
        .map_err(|_| ProjectError::MissingEntry(entry.to_owned()))?;

    // Read one byte past the ceiling, so that hitting it exactly is distinguishable from being
    // truncated at it. Without the extra byte a file of exactly the limit would be refused.
    let mut text = String::new();
    file.take(MAX_ENTRY_BYTES + 1).read_to_string(&mut text)?;
    if text.len() as u64 > MAX_ENTRY_BYTES {
        return Err(ProjectError::TooLarge {
            entry: entry.to_owned(),
            limit: MAX_ENTRY_BYTES,
        });
    }

    serde_json::from_str(&text).map_err(|e| ProjectError::Invalid {
        entry: entry.to_owned(),
        reason: e.to_string(),
    })
}

pub fn hash(bytes: &[u8]) -> String {
    use std::fmt::Write as _;
    let digest = Sha256::digest(bytes);
    digest.iter().fold(String::with_capacity(64), |mut acc, b| {
        let _ = write!(acc, "{b:02x}");
        acc
    })
}

fn identifier(name: &str, now_ms: u64) -> String {
    let slug: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    let trimmed: String = slug.trim_matches('-').chars().take(32).collect();
    let base = if trimmed.is_empty() {
        "project"
    } else {
        &trimmed
    };
    format!(
        "{base}-{}",
        &hash(format!("{name}{now_ms}").as_bytes())[..8]
    )
}

fn readme(manifest: &ProjectManifest) -> String {
    format!(
        "# {}\n\nAn Encastra project.\n\nThis file is a ZIP archive; you can open it and look \
         inside. `graph.json` is what runs, `lock.json` pins the exact components it was built \
         against, and `versions/` is its history.\n\nIt contains no secret values. Anything the \
         project needs from a keystore is listed by name in `variables.json` and resolved on \
         the machine that runs it.\n",
        manifest.name
    )
}

/// Node ids mentioned by a graph, for tooling that wants to inspect without a runtime.
pub fn node_ids(graph: &Graph) -> Vec<NodeId> {
    graph.nodes.keys().cloned().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_graph() -> Graph {
        Graph::parse(
            &serde_json::json!({
                "nodes": {
                    "read":  { "component": "encastra.file.read@1.0.0", "position": { "x": 0, "y": 0 } },
                    "parse": { "component": "encastra.data.json@1.0.0", "position": { "x": 260, "y": 0 } }
                },
                "edges": [
                    { "from": { "node": "read", "port": "text" }, "to": { "node": "parse", "port": "text" } }
                ]
            })
            .to_string(),
        )
        .unwrap()
    }

    fn sample() -> Project {
        let mut project = Project::new("Video Processor", 1_700_000_000_000);
        project.graph = sample_graph();
        project.lock.components.push(LockedComponent {
            id: "encastra.file.read".into(),
            version: "1.0.0".into(),
            manifest_digest: "a".repeat(64),
            origin: "builtin".into(),
        });
        project.variables.insert(
            "api_token".into(),
            Variable {
                type_: "string".into(),
                secret: true,
                doc: None,
            },
        );
        project
    }

    #[test]
    fn a_project_survives_a_save_and_an_open_unchanged() {
        let original = sample();
        let reopened = Project::from_bytes(&original.to_bytes().unwrap()).unwrap();
        assert_eq!(original, reopened);
    }

    #[test]
    fn saving_an_unchanged_project_produces_identical_bytes() {
        // The property everything else leans on: hashes are comparable, and a save that
        // changed nothing does not show up as a change.
        let project = sample();
        assert_eq!(project.to_bytes().unwrap(), project.to_bytes().unwrap());

        // And it does not depend on when it was written.
        let reopened = Project::from_bytes(&project.to_bytes().unwrap()).unwrap();
        assert_eq!(project.to_bytes().unwrap(), reopened.to_bytes().unwrap());
    }

    #[test]
    fn a_secret_value_can_never_reach_the_archive() {
        let mut project = sample();
        project.variables.insert(
            "password".into(),
            Variable {
                type_: "string".into(),
                secret: true,
                doc: Some("The database password".into()),
            },
        );
        let reopened = Project::from_bytes(&project.to_bytes().unwrap()).unwrap();
        assert!(reopened.variables["password"].secret);

        // A hand-edited file that tries to smuggle a value in is refused, rather than parsed
        // with the extra field quietly dropped and then written back out somewhere else.
        let smuggled = serde_json::json!({ "type": "string", "secret": true, "value": "hunter2" });
        assert!(serde_json::from_value::<Variable>(smuggled).is_err());
    }

    #[test]
    fn refuses_a_schema_it_does_not_implement() {
        let mut project = sample();
        project.manifest.schema = 99;
        let error = Project::from_bytes(&project.to_bytes().unwrap()).unwrap_err();
        assert!(matches!(error, ProjectError::UnsupportedSchema { .. }));
    }

    #[test]
    fn refuses_a_file_that_is_not_an_archive() {
        let error = Project::from_bytes(b"this is not a zip file at all").unwrap_err();
        assert!(matches!(error, ProjectError::Archive(_)));
    }

    #[test]
    fn an_io_error_never_carries_a_path() {
        let error: ProjectError = std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "C:/Users/someone/private/secret.encastra",
        )
        .into();
        assert!(!error.to_string().contains("someone"), "{error}");
    }

    #[test]
    fn the_identifier_survives_a_rename() {
        let project = sample();
        assert!(project.manifest.id.starts_with("video-processor-"));
        let mut renamed = project.clone();
        renamed.manifest.name = "Something Else".into();
        assert_eq!(
            renamed.manifest.id, project.manifest.id,
            "history must survive a rename"
        );
    }

    #[test]
    fn the_graph_hash_tracks_what_runs_and_nothing_else() {
        let project = sample();
        let before = project.graph_hash();

        let mut renamed = project.clone();
        renamed.manifest.name = "New Name".into();
        assert_eq!(
            renamed.graph_hash(),
            before,
            "a rename does not change what runs"
        );

        let mut edited = project.clone();
        edited.graph.nodes.remove(&NodeId("parse".into()));
        assert_ne!(edited.graph_hash(), before);
    }
}
