//! `encastra` — run a graph from a terminal.
//!
//! This is the same runtime the desktop app uses, called differently. It exists so the engine
//! can be exercised, scripted and tested before there is any UI, and so that "it works" is a
//! claim somebody can check rather than a screenshot.
//!
//! Argument parsing is hand-rolled: there are five flags, and a dependency for five flags is
//! the kind of thing that turns into forty. When this grows into the component SDK's command
//! set (`component create` / `dev` / `test` / `publish`), it earns a real parser.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::sync::atomic::AtomicBool;

use encastra_core::broker::{Broker, GrantScope, GrantSet};
use encastra_core::journal::{NodeStatus, RunJournal, RunStatus};
use encastra_core::registry::ComponentRegistry;
use encastra_core::runner::run_seeded;
use encastra_core::validate::{Severity, Validation};
use encastra_core::value::{HandleKind, Value};
use encastra_core::{Graph, NodeId, PortRef};

const USAGE: &str = "\
encastra — run a component graph

USAGE:
    encastra run <graph.json> [OPTIONS]
    encastra components [--json]
    encastra validate <graph.json>

OPTIONS:
    --input <node.port>=<file>   Supply a file to an input nothing else produces.
                                 Repeatable. This is how a run gets its starting material.
    --allow-write <node>=<dir>   Let one node write into one folder. Nothing is writable
                                 without this, including first-party components.
    --allow-notify <node>        Let one node show a desktop notification.
    --json                       Print the run journal as JSON instead of a summary.
    -h, --help                   Show this.

EXAMPLE:
    encastra run pipeline.json \\
      --input read.file=./data.json \\
      --allow-write write=./out
";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.is_empty() || args[0] == "-h" || args[0] == "--help" {
        print!("{USAGE}");
        return ExitCode::SUCCESS;
    }

    let result = match args[0].as_str() {
        "run" => command_run(&args[1..], true),
        "validate" => command_run(&args[1..], false),
        "components" => command_components(args.get(1).map(String::as_str) == Some("--json")),
        other => Err(format!(
            "Unknown command \"{other}\". Try `encastra --help`."
        )),
    };

    match result {
        Ok(code) => code,
        Err(message) => {
            eprintln!("error: {message}");
            ExitCode::FAILURE
        }
    }
}

fn command_components(as_json: bool) -> Result<ExitCode, String> {
    let (registry, _) = encastra_builtins::install();
    let mut manifests = registry.list();
    manifests.sort_by(|a, b| a.id.cmp(&b.id));

    if as_json {
        println!(
            "{}",
            serde_json::to_string_pretty(&manifests).map_err(|e| e.to_string())?
        );
        return Ok(ExitCode::SUCCESS);
    }

    for manifest in manifests {
        println!("{}@{}  {}", manifest.id, manifest.version, manifest.name);
        if let Some(description) = &manifest.description {
            println!("    {description}");
        }
        for (name, port) in &manifest.ports.inputs {
            let required = if port.required { " (required)" } else { "" };
            println!("    in   {name}: {}{required}", port.type_);
        }
        for (name, port) in &manifest.ports.outputs {
            println!("    out  {name}: {}", port.type_);
        }
        for capability in &manifest.capabilities {
            println!("    needs {} — {}", capability.kind, capability.reason);
        }
        println!();
    }
    Ok(ExitCode::SUCCESS)
}

struct Options {
    graph_path: PathBuf,
    inputs: Vec<(PortRef, PathBuf)>,
    writable: Vec<(NodeId, PathBuf)>,
    notifiers: Vec<NodeId>,
    json: bool,
}

fn parse_options(args: &[String]) -> Result<Options, String> {
    let mut graph_path: Option<PathBuf> = None;
    let mut inputs = Vec::new();
    let mut writable = Vec::new();
    let mut notifiers = Vec::new();
    let mut json = false;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--json" => json = true,
            "--input" => {
                let value = next(args, &mut i, "--input")?;
                let (target, path) = split_once(&value, "--input <node.port>=<file>")?;
                let (node, port) = target.split_once('.').ok_or_else(|| {
                    format!("\"{target}\" should look like <node>.<port>, e.g. read.file")
                })?;
                inputs.push((
                    PortRef {
                        node: NodeId(node.to_owned()),
                        port: port.to_owned(),
                    },
                    PathBuf::from(path),
                ));
            }
            "--allow-write" => {
                let value = next(args, &mut i, "--allow-write")?;
                let (node, dir) = split_once(&value, "--allow-write <node>=<dir>")?;
                writable.push((NodeId(node.to_owned()), PathBuf::from(dir)));
            }
            "--allow-notify" => {
                let value = next(args, &mut i, "--allow-notify")?;
                notifiers.push(NodeId(value));
            }
            other if other.starts_with('-') => {
                return Err(format!("Unknown option \"{other}\"."));
            }
            path => {
                if graph_path.is_some() {
                    return Err("Only one graph file can be given.".to_owned());
                }
                graph_path = Some(PathBuf::from(path));
            }
        }
        i += 1;
    }

    Ok(Options {
        graph_path: graph_path.ok_or("No graph file given. Try `encastra --help`.")?,
        inputs,
        writable,
        notifiers,
        json,
    })
}

fn next(args: &[String], i: &mut usize, flag: &str) -> Result<String, String> {
    *i += 1;
    args.get(*i)
        .cloned()
        .ok_or_else(|| format!("{flag} needs a value."))
}

fn split_once(value: &str, shape: &str) -> Result<(String, String), String> {
    value
        .split_once('=')
        .map(|(a, b)| (a.to_owned(), b.to_owned()))
        .ok_or_else(|| format!("Expected {shape}, got \"{value}\"."))
}

fn command_run(args: &[String], execute: bool) -> Result<ExitCode, String> {
    let options = parse_options(args)?;
    let source = std::fs::read_to_string(&options.graph_path).map_err(|e| {
        format!(
            "Could not read {}: {}",
            options.graph_path.display(),
            e.kind()
        )
    })?;
    let graph = Graph::parse(&source).map_err(|e| format!("That is not a valid graph: {e}"))?;

    let (registry, components) = encastra_builtins::install();

    let mut grants = GrantSet::new();
    for (id, node) in &graph.nodes {
        if let Some(manifest) = registry.get(&node.component) {
            grants.allow_declared_input_handles(id, manifest);
        }
    }
    for (node, dir) in &options.writable {
        grants.grant(node, "fs.write", GrantScope::Directory(dir.clone()));
    }
    for node in &options.notifiers {
        grants.grant(node, "system.notify", GrantScope::Allowed);
    }

    let run_dir = std::env::temp_dir().join(format!("encastra-run-{}", std::process::id()));
    let mut broker = Broker::new(run_dir.clone(), grants)
        .map_err(|e| format!("Could not prepare a working directory: {e}"))?;

    let mut seed: BTreeMap<PortRef, Value> = BTreeMap::new();
    for (port, path) in &options.inputs {
        let absolute = std::fs::canonicalize(path)
            .map_err(|e| format!("Could not open {}: {}", path.display(), e.kind()))?;
        let handle = broker.import_file(absolute, kind_for(path));
        seed.insert(port.clone(), Value::Handle(handle));
    }

    if !execute {
        let supplied = seed.keys().cloned().collect();
        let validation =
            encastra_core::validate::validate_with_supplied(&graph, &registry, &supplied);
        report_validation(&validation);
        return Ok(if validation.is_runnable() {
            ExitCode::SUCCESS
        } else {
            ExitCode::FAILURE
        });
    }

    let cancel = AtomicBool::new(false);
    let outcome = match run_seeded(
        &graph,
        &registry,
        &components,
        &mut broker,
        &cancel,
        "cli",
        seed,
    ) {
        Ok(outcome) => outcome,
        Err(validation) => {
            report_validation(&validation);
            return Ok(ExitCode::FAILURE);
        }
    };

    let _ = std::fs::remove_dir_all(&run_dir);

    if options.json {
        println!(
            "{}",
            serde_json::to_string_pretty(&outcome.journal).map_err(|e| e.to_string())?
        );
    } else {
        report_run(&outcome.journal);
    }

    Ok(match outcome.journal.status {
        RunStatus::Ok => ExitCode::SUCCESS,
        _ => ExitCode::FAILURE,
    })
}

/// Guesses a handle kind from the extension, so that a `.png` connected to an image port is
/// not refused for want of a flag. Only a hint: the runtime verifies content when a component
/// actually decodes it, and a wrong guess fails there rather than being trusted.
fn kind_for(path: &Path) -> HandleKind {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp") => HandleKind::Image,
        Some("mp4" | "mov" | "mkv" | "webm" | "avi") => HandleKind::Video,
        Some("mp3" | "wav" | "flac" | "ogg" | "m4a") => HandleKind::Audio,
        _ => HandleKind::File,
    }
}

fn report_validation(validation: &Validation) {
    if validation.issues.is_empty() {
        println!("This graph is ready to run.");
        return;
    }
    for issue in &validation.issues {
        let marker = match issue.severity {
            Severity::Error => "x",
            Severity::Warning => "!",
        };
        println!("{marker} {}", issue.message);
        if let Some(hint) = &issue.hint {
            println!("    {hint}");
        }
    }
    if validation.is_runnable() {
        println!("\nThis graph can run.");
    }
}

fn report_run(journal: &RunJournal) {
    for (id, record) in journal.in_order() {
        let marker = match record.status {
            NodeStatus::Ok => "ok  ",
            NodeStatus::Failed => "FAIL",
            NodeStatus::Skipped => "skip",
            NodeStatus::Cancelled => "stop",
            NodeStatus::Disabled => "off ",
            NodeStatus::Pending | NodeStatus::Running => "??  ",
        };
        let timing = record
            .duration_ms
            .map(|ms| format!(" {ms}ms"))
            .unwrap_or_default();
        println!("{marker} {id}  ({}){timing}", record.component);

        if let Some(reason) = &record.skipped_because {
            println!("       because \"{reason}\" did not finish");
        }
        if let Some(error) = &record.error {
            println!("       {}: {}", error.code, error.message);
            if let Some(hint) = &error.hint {
                println!("       {hint}");
            }
        }
        for (port, summary) in &record.outputs {
            println!("       -> {port}: {summary}");
        }
        let denied = record
            .capability_calls
            .iter()
            .filter(|c| !c.allowed)
            .count();
        if denied > 0 {
            println!("       {denied} capability call(s) refused");
        }
    }

    let duration = journal
        .duration_ms()
        .map(|ms| format!(" in {ms}ms"))
        .unwrap_or_default();
    println!(
        "\n{}{duration}",
        match journal.status {
            RunStatus::Ok => "Finished.".to_owned(),
            RunStatus::Partial => format!(
                "Finished with {} failure(s). The rest of the graph still ran.",
                journal.failed_nodes().count()
            ),
            RunStatus::Failed => "Failed.".to_owned(),
            RunStatus::Cancelled => "Stopped.".to_owned(),
            RunStatus::Running => "Still running.".to_owned(),
        }
    );
}
