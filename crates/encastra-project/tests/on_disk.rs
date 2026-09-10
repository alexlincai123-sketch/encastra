//! The project lifecycle as it actually happens: create, save to a real file, close, reopen,
//! edit, save again, restore an earlier version.
//!
//! The in-crate tests cover serialisation. This covers the path the application takes,
//! including the write-then-rename that keeps a crash from destroying the previous file.

use std::path::PathBuf;

use encastra_core::graph::{Graph, NodeId};
use encastra_project::{Project, Variable};

struct Sandbox(PathBuf);

impl Sandbox {
    fn new(name: &str) -> Self {
        let path =
            std::env::temp_dir().join(format!("encastra-project-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(&path).unwrap();
        Sandbox(path)
    }
    fn file(&self, name: &str) -> PathBuf {
        self.0.join(name)
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn graph(width: i64) -> Graph {
    Graph::parse(
        &serde_json::json!({
            "nodes": {
                "resize": {
                    "component": "encastra.image.resize@1.0.0",
                    "config": { "width": width },
                    "position": { "x": 40, "y": 40 }
                }
            },
            "edges": []
        })
        .to_string(),
    )
    .unwrap()
}

fn width_of(project: &Project) -> i64 {
    project.graph.nodes[&NodeId("resize".into())].config["width"]
        .as_i64()
        .unwrap()
}

#[test]
fn a_project_round_trips_through_a_real_file() {
    let sandbox = Sandbox::new("round-trip");
    let path = sandbox.file("pipeline.encastra");

    let mut project = Project::new("Pipeline", 1_000);
    project.graph = graph(800);
    project.variables.insert(
        "api_token".into(),
        Variable {
            type_: "string".into(),
            secret: true,
            doc: None,
        },
    );
    project
        .history
        .record(&project.graph.clone(), Some("First".into()), None, 1_000);
    project.save(&path).unwrap();

    assert!(path.exists());
    let reopened = Project::open(&path).unwrap();
    assert_eq!(reopened.manifest.name, "Pipeline");
    assert_eq!(width_of(&reopened), 800);
    assert_eq!(reopened.history.len(), 1);
    assert!(reopened.variables["api_token"].secret);
}

#[test]
fn saving_leaves_no_temporary_file_behind() {
    let sandbox = Sandbox::new("no-litter");
    let path = sandbox.file("clean.encastra");
    Project::new("Clean", 1).save(&path).unwrap();

    let leftovers: Vec<String> = std::fs::read_dir(&sandbox.0)
        .unwrap()
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|name| name != "clean.encastra")
        .collect();
    assert!(leftovers.is_empty(), "left behind: {leftovers:?}");
}

#[test]
fn saving_over_an_existing_project_keeps_its_history() {
    let sandbox = Sandbox::new("history");
    let path = sandbox.file("evolving.encastra");

    let mut project = Project::new("Evolving", 1_000);
    project.graph = graph(800);
    project
        .history
        .record(&project.graph.clone(), Some("800 wide".into()), None, 1_000);
    project.save(&path).unwrap();

    // What the application does on a second save: reopen, replace the graph, record, write.
    let mut again = Project::open(&path).unwrap();
    again.graph = graph(1200);
    again
        .history
        .record(&again.graph.clone(), Some("1200 wide".into()), None, 2_000);
    again.save(&path).unwrap();

    let final_state = Project::open(&path).unwrap();
    assert_eq!(
        final_state.history.len(),
        2,
        "the earlier version must still be there"
    );
    assert_eq!(width_of(&final_state), 1200);
}

#[test]
fn restoring_an_earlier_version_is_not_destructive() {
    let sandbox = Sandbox::new("restore");
    let path = sandbox.file("restorable.encastra");

    let mut project = Project::new("Restorable", 1_000);
    project.graph = graph(800);
    let first = project
        .history
        .record(&project.graph.clone(), Some("Original".into()), None, 1_000)
        .unwrap();
    project.graph = graph(1200);
    project
        .history
        .record(&project.graph.clone(), Some("Wider".into()), None, 2_000);
    project.save(&path).unwrap();

    let mut reopened = Project::open(&path).unwrap();
    let restored = reopened
        .history
        .restore(&first, 3_000)
        .expect("the version is in the file");
    reopened.graph = restored;
    reopened.save(&path).unwrap();

    let after = Project::open(&path).unwrap();
    assert_eq!(width_of(&after), 800, "the restore took effect");
    assert_eq!(
        after.history.len(),
        3,
        "restoring adds a version rather than removing one"
    );
    assert!(
        after.history.get(&first).is_some(),
        "the version that was restored is still in the history"
    );

    // And what a person reads about the change is about the graph, not about JSON.
    let ids: Vec<_> = after
        .history
        .snapshots
        .iter()
        .map(|s| s.id.clone())
        .collect();
    let changes = after.history.compare(&ids[1], &ids[2]).unwrap();
    let described: Vec<String> = changes
        .iter()
        .map(encastra_project::Change::describe)
        .collect();
    assert!(
        described
            .iter()
            .any(|c| c.contains("width changed from 1200 to 800")),
        "{described:?}"
    );
}

#[test]
fn a_failed_save_leaves_the_previous_file_intact() {
    let sandbox = Sandbox::new("atomic");
    let path = sandbox.file("precious.encastra");

    let mut good = Project::new("Precious", 1_000);
    good.graph = graph(800);
    good.save(&path).unwrap();
    let original = std::fs::read(&path).unwrap();

    // A save that cannot complete: the destination directory does not exist, so the rename
    // fails after the temporary file is written.
    let unreachable = sandbox.file("nowhere").join("deeper").join("x.encastra");
    assert!(Project::new("Doomed", 2_000).save(&unreachable).is_err());

    assert_eq!(
        std::fs::read(&path).unwrap(),
        original,
        "an unrelated failed save must not have touched this file"
    );
    assert_eq!(width_of(&Project::open(&path).unwrap()), 800);
}

#[test]
fn a_truncated_file_is_refused_rather_than_half_read() {
    let sandbox = Sandbox::new("truncated");
    let path = sandbox.file("broken.encastra");

    let mut project = Project::new("Broken", 1_000);
    project.graph = graph(800);
    project.save(&path).unwrap();

    let bytes = std::fs::read(&path).unwrap();
    std::fs::write(&path, &bytes[..bytes.len() / 2]).unwrap();

    assert!(
        Project::open(&path).is_err(),
        "half a project file must not open as a project"
    );
}

#[test]
fn the_file_is_a_zip_anybody_can_open() {
    // A promise the README inside makes; worth holding the format to it.
    let sandbox = Sandbox::new("inspectable");
    let path = sandbox.file("inspect.encastra");
    Project::new("Inspect", 1).save(&path).unwrap();

    let bytes = std::fs::read(&path).unwrap();
    assert_eq!(&bytes[..2], b"PK", "not a zip archive");

    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes)).unwrap();
    let names: Vec<String> = (0..archive.len())
        .map(|i| archive.by_index(i).unwrap().name().to_owned())
        .collect();
    for expected in [
        "project.json",
        "graph.json",
        "lock.json",
        "variables.json",
        "README.md",
    ] {
        assert!(
            names.contains(&expected.to_string()),
            "missing {expected} in {names:?}"
        );
    }
}
