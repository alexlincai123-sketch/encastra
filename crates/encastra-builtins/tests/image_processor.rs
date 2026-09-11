//! The checkpoint.
//!
//! Watch a folder, resize what appears in it, save the result. A real PNG goes into a real
//! folder on disk and a smaller real PNG comes out of another one. If this test fails, the
//! product does not work, whatever the interface looks like.

use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use encastra_core::broker::{Broker, GrantScope, GrantSet};
use encastra_core::graph::{Graph, NodeId};
use encastra_core::journal::{NodeStatus, RunStatus};
use encastra_core::media::{self, OutputFormat};
use encastra_core::registry::ComponentRegistry;
use encastra_core::session::Session;

struct Sandbox(PathBuf);

impl Sandbox {
    fn new(name: &str) -> Self {
        let path =
            std::env::temp_dir().join(format!("encastra-checkpoint-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(path.join("inbox")).unwrap();
        std::fs::create_dir_all(path.join("out")).unwrap();
        Sandbox(path)
    }
    fn inbox(&self) -> PathBuf {
        self.0.join("inbox")
    }
    fn out(&self) -> PathBuf {
        self.0.join("out")
    }
    fn run_dir(&self) -> PathBuf {
        self.0.join("run")
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn png(width: u32, height: u32) -> Vec<u8> {
    let image = image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
        width,
        height,
        image::Rgba([180, 90, 40, 255]),
    ));
    media::encode(&image, OutputFormat::Png, 90).unwrap()
}

/// Watch Folder → Resize Image → Save File
fn image_processor(inbox: &Path, out: &Path) -> Graph {
    Graph::parse(
        &serde_json::json!({
            "nodes": {
                "watch": {
                    "component": "encastra.file.watch@1.0.0",
                    "config": { "folder": inbox.to_string_lossy(), "extensions": "png", "existing": true },
                    "position": { "x": 0, "y": 0 }
                },
                "resize": {
                    "component": "encastra.image.resize@1.0.0",
                    "config": { "width": 200, "height": 0, "mode": "contain" },
                    "position": { "x": 260, "y": 0 }
                },
                "save": {
                    "component": "encastra.file.save@1.0.0",
                    "config": { "folder": out.to_string_lossy(), "suffix": "-small" },
                    "position": { "x": 520, "y": 0 }
                }
            },
            "edges": [
                { "from": { "node": "watch",  "port": "file" },  "to": { "node": "resize", "port": "image" } },
                { "from": { "node": "resize", "port": "image" }, "to": { "node": "save",   "port": "file" } }
            ]
        })
        .to_string(),
    )
    .expect("the demo graph must parse")
}

fn grants(
    graph: &Graph,
    registry: &encastra_core::InMemoryRegistry,
    sandbox: &Sandbox,
) -> GrantSet {
    let mut grants = GrantSet::new();
    for (id, node) in &graph.nodes {
        if let Some(manifest) = registry.get(&node.component) {
            grants.allow_declared_input_handles(id, manifest);
        }
    }
    // The two decisions a person would actually be asked for.
    grants.grant(
        &NodeId("watch".into()),
        "fs.read",
        GrantScope::Directory(sandbox.inbox()),
    );
    grants.grant(
        &NodeId("save".into()),
        "fs.write",
        GrantScope::Directory(sandbox.out()),
    );
    grants
}

/// Turns the session until a run finishes, or the time runs out.
fn drive(
    session: &mut Session,
    registry: &encastra_core::InMemoryRegistry,
    broker: &mut Broker,
    within: Duration,
) -> Vec<encastra_core::RunOutcome> {
    let deadline = Instant::now() + within;
    let mut completed = Vec::new();
    while Instant::now() < deadline {
        let tick = session.tick(registry, broker, None);
        if let Some((node, error)) = tick.trigger_errors.first() {
            panic!("the watcher failed on {node}: {error}");
        }
        completed.extend(tick.runs);
        if !completed.is_empty() {
            return completed;
        }
        std::thread::sleep(Duration::from_millis(30));
    }
    completed
}

#[test]
fn a_folder_is_watched_an_image_is_resized_and_the_result_appears_on_disk() {
    let sandbox = Sandbox::new("happy");
    std::fs::write(sandbox.inbox().join("photo.png"), png(800, 400)).unwrap();

    let installed = encastra_builtins::install_all();
    let graph = image_processor(&sandbox.inbox(), &sandbox.out());
    let mut broker = Broker::new(
        sandbox.run_dir(),
        grants(&graph, &installed.registry, &sandbox),
    )
    .unwrap();

    let mut session = Session::start(
        graph,
        &installed.registry,
        installed.components.clone(),
        &installed.triggers,
        "checkpoint",
    )
    .unwrap_or_else(|v| panic!("the demo graph must validate: {:#?}", v.issues));

    assert!(session.has_triggers(), "this workflow starts by itself");

    let runs = drive(
        &mut session,
        &installed.registry,
        &mut broker,
        Duration::from_secs(20),
    );
    assert_eq!(runs.len(), 1, "one file should produce exactly one run");

    let journal = &runs[0].journal;
    assert_eq!(journal.status, RunStatus::Ok, "{:#?}", journal.nodes);
    for step in ["watch", "resize", "save"] {
        assert_eq!(
            journal.nodes[&NodeId(step.into())].status,
            NodeStatus::Ok,
            "{step}: {:#?}",
            journal.nodes[&NodeId(step.into())]
        );
    }

    // The actual proof: a smaller image, on disk, named after the one that went in.
    let produced = sandbox.out().join("photo-small.png");
    assert!(
        produced.exists(),
        "nothing was written to the output folder"
    );

    let info = media::probe(&std::fs::read(&produced).unwrap()).unwrap();
    assert_eq!(
        (info.width, info.height),
        (200, 100),
        "the image was not resized"
    );
    assert_eq!(info.format, "png");
}

#[test]
fn the_same_file_is_not_processed_twice() {
    let sandbox = Sandbox::new("once");
    std::fs::write(sandbox.inbox().join("photo.png"), png(400, 200)).unwrap();

    let installed = encastra_builtins::install_all();
    let graph = image_processor(&sandbox.inbox(), &sandbox.out());
    let mut broker = Broker::new(
        sandbox.run_dir(),
        grants(&graph, &installed.registry, &sandbox),
    )
    .unwrap();
    let mut session = Session::start(
        graph,
        &installed.registry,
        installed.components.clone(),
        &installed.triggers,
        "once",
    )
    .unwrap();

    let first = drive(
        &mut session,
        &installed.registry,
        &mut broker,
        Duration::from_secs(20),
    );
    assert_eq!(first.len(), 1);

    // Keep turning. A watcher that re-fires on a file it already handled would reprocess a
    // folder forever, which is the failure mode that makes people distrust automation.
    let deadline = Instant::now() + Duration::from_secs(3);
    let mut extra = 0;
    while Instant::now() < deadline {
        extra += session
            .tick(&installed.registry, &mut broker, None)
            .runs
            .len();
        std::thread::sleep(Duration::from_millis(30));
    }
    assert_eq!(extra, 0, "the same file was processed again");
}

#[test]
fn a_file_of_the_wrong_kind_is_ignored_rather_than_failing_the_workflow() {
    let sandbox = Sandbox::new("filter");
    std::fs::write(sandbox.inbox().join("notes.txt"), b"not a picture").unwrap();

    let installed = encastra_builtins::install_all();
    let graph = image_processor(&sandbox.inbox(), &sandbox.out());
    let mut broker = Broker::new(
        sandbox.run_dir(),
        grants(&graph, &installed.registry, &sandbox),
    )
    .unwrap();
    let mut session = Session::start(
        graph,
        &installed.registry,
        installed.components.clone(),
        &installed.triggers,
        "filter",
    )
    .unwrap();

    let runs = drive(
        &mut session,
        &installed.registry,
        &mut broker,
        Duration::from_secs(3),
    );
    assert!(
        runs.is_empty(),
        "the extension filter should have skipped it"
    );
    assert!(!sandbox.out().join("notes.txt").exists());
}

#[test]
fn a_watcher_pointed_at_a_folder_nobody_allowed_is_refused() {
    let sandbox = Sandbox::new("denied");
    std::fs::write(sandbox.inbox().join("photo.png"), png(100, 100)).unwrap();

    let installed = encastra_builtins::install_all();
    let graph = image_processor(&sandbox.inbox(), &sandbox.out());

    // Only the declared input-handle scopes; nobody allowed the folder.
    let mut bare = GrantSet::new();
    for (id, node) in &graph.nodes {
        if let Some(manifest) = installed.registry.get(&node.component) {
            bare.allow_declared_input_handles(id, manifest);
        }
    }
    let mut broker = Broker::new(sandbox.run_dir(), bare).unwrap();

    let mut session = Session::start(
        graph,
        &installed.registry,
        installed.components.clone(),
        &installed.triggers,
        "denied",
    )
    .unwrap();

    let tick = session.tick(&installed.registry, &mut broker, None);
    assert!(
        tick.runs.is_empty(),
        "nothing may run without the folder being allowed"
    );
    assert_eq!(
        tick.trigger_errors.len(),
        1,
        "the refusal must be reported, not silent"
    );
    let (_, error) = &tick.trigger_errors[0];
    assert_eq!(error.code, "denied");
    assert!(
        error.hint.is_some(),
        "a refusal should say what to do about it"
    );
}

#[test]
fn stopping_a_session_ends_it_even_with_work_waiting() {
    let sandbox = Sandbox::new("stop");
    for n in 0..5 {
        std::fs::write(sandbox.inbox().join(format!("photo{n}.png")), png(200, 200)).unwrap();
    }

    let installed = encastra_builtins::install_all();
    let graph = image_processor(&sandbox.inbox(), &sandbox.out());
    let mut broker = Broker::new(
        sandbox.run_dir(),
        grants(&graph, &installed.registry, &sandbox),
    )
    .unwrap();
    let mut session = Session::start(
        graph,
        &installed.registry,
        installed.components.clone(),
        &installed.triggers,
        "stop",
    )
    .unwrap();

    drive(
        &mut session,
        &installed.registry,
        &mut broker,
        Duration::from_secs(20),
    );
    session.stop();

    let after = session.tick(&installed.registry, &mut broker, None);
    assert!(
        after.runs.is_empty(),
        "a stopped session runs nothing further"
    );
    assert!(session.is_stopped());
}
