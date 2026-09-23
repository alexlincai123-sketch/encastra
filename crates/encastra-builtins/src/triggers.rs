//! Things that start a workflow.
//!
//! A trigger is not a step. It produces values over time, and the session runs the rest of the
//! graph once per value (see `encastra_core::session`).
//!
//! # Why this watcher polls
//!
//! The operating systems each offer a change-notification API, and there is a good Rust crate
//! that wraps all three. This polls instead, and the trade is deliberate:
//!
//! - Polling is the same code on every platform, so the behaviour a person sees on Windows is
//!   the behaviour the tests exercise on Linux.
//! - The awkward part of watching a folder is not being told that something changed; it is
//!   knowing when a file has *finished* being written. A file copied over a network appears
//!   immediately and grows for seconds afterwards, and a change event fires for every chunk.
//!   Either way the answer is to wait until the size stops moving — which polling gives
//!   directly, and an event stream has to be debounced back into.
//! - The cost is latency of up to one interval. For a folder a person drops files into, that is
//!   not a cost anyone notices.
//!
//! The trait boundary is the real point: if latency ever matters, a notification-backed
//! implementation slots in behind the same `Trigger` without anything else changing.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::LazyLock;
use std::time::Duration;

use encastra_core::journal::{NodeError, NodeErrorCode};
use encastra_core::session::{Fired, Trigger, TriggerContext};
use encastra_core::value::{HandleKind, Value};
use encastra_protocol::manifest::ComponentManifest;

use crate::{manifest, split_name};

/// How many consecutive polls a file's size must stay the same before it is considered done.
///
/// One would be enough for a local copy and not enough for a slow one. Two is a compromise
/// that costs one extra interval and avoids handing a half-written file to a workflow.
const STABLE_POLLS: u32 = 2;

// ---------------------------------------------------------------------------------------
// Watch Folder
// ---------------------------------------------------------------------------------------

pub static WATCH: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.file.watch",
        "version": "1.0.0",
        "name": "Watch Folder",
        "description": "Starts the workflow whenever a file appears in a folder.",
        "category": "file",
        "runtime": ">=0.1.0",
        "kind": "core",
        "trigger": true,
        "ports": {
          "outputs": {
            "file": { "type": "file", "label": "The new file" },
            "name": { "type": "string", "label": "Its name" },
            "extension": { "type": "string", "label": "Its extension" }
          }
        },
        "config": {
          "folder":     { "type": "string", "required": true, "label": "Watch this folder",
                          "doc": "Only this folder, not the ones inside it." },
          "extensions": { "type": "string", "label": "Only these kinds",
                          "doc": "A list separated by commas, for example: png, jpg, jpeg. Leave empty for every file." },
          "existing":   { "type": "bool", "label": "Include files already there", "default": false,
                          "doc": "Off by default, so starting a workflow does not immediately process a folder full of old files." }
        },
        "capabilities": [
          { "kind": "fs.read", "scope": "watched-folder",
            "reason": "Watches the folder you pick and reads the files that appear in it." }
        ],
        "platforms": ["windows", "macos", "linux"]
      }"#,
    )
});

#[derive(Default)]
struct Watcher {
    /// What each path looked like last time, and for how many polls it has looked that way.
    observed: BTreeMap<PathBuf, Seen>,
    /// Paths already handed to the workflow. Kept so a file is not processed twice.
    emitted: BTreeMap<PathBuf, u64>,
    primed: bool,
}

struct Seen {
    size: u64,
    modified_ms: u64,
    stable_for: u32,
}

impl Trigger for Watcher {
    fn poll(&mut self, ctx: &mut TriggerContext<'_>) -> Result<Vec<Fired>, NodeError> {
        let folder = ctx
            .config_str("folder")
            .map(str::trim)
            .filter(|f| !f.is_empty())
            .ok_or_else(|| {
                NodeError::new(
                    NodeErrorCode::MissingConfig,
                    "No folder is set on this watcher.",
                )
                .with_hint("Choose the folder to watch.")
            })?
            .to_owned();

        let wanted: Vec<String> = ctx
            .config_str("extensions")
            .unwrap_or("")
            .split(',')
            .map(|e| e.trim().trim_start_matches('.').to_ascii_lowercase())
            .filter(|e| !e.is_empty())
            .collect();

        let include_existing = ctx.config_bool("existing").unwrap_or(false);
        let entries = ctx.list_dir(std::path::Path::new(&folder))?;

        // The first poll establishes what "already there" means. Without this, switching a
        // workflow on would process every file in the folder — which is occasionally what
        // somebody wants, and is a setting, not a default.
        if !self.primed {
            self.primed = true;
            if !include_existing {
                for entry in &entries {
                    self.emitted.insert(entry.path.clone(), entry.modified_ms);
                }
            }
        }

        let present: Vec<_> = entries
            .into_iter()
            .filter(|entry| {
                if wanted.is_empty() {
                    return true;
                }
                let (_, extension) = split_name(&entry.name);
                wanted.contains(&extension.to_ascii_lowercase())
            })
            .collect();

        // A file that has gone is forgotten, so putting the same name back starts it again.
        // A set, not a Vec: `retain` asks "is it still here" once per remembered path, and a
        // linear search for each made every poll quadratic in the folder's size. At the listing
        // ceiling that is over two billion comparisons every six hundred milliseconds — from a
        // folder whose contents are chosen by whoever can write into it.
        let still_here: std::collections::BTreeSet<&PathBuf> =
            present.iter().map(|e| &e.path).collect();
        self.observed.retain(|path, _| still_here.contains(path));
        self.emitted.retain(|path, _| still_here.contains(path));

        let mut fired = Vec::new();

        for entry in present {
            // A file that changed since it was handed over is a new event: this is what makes
            // "save over the top" work the way people expect.
            if let Some(previous) = self.emitted.get(&entry.path) {
                if *previous == entry.modified_ms {
                    continue;
                }
                self.emitted.remove(&entry.path);
            }

            let seen = self.observed.entry(entry.path.clone()).or_insert(Seen {
                size: entry.size,
                modified_ms: entry.modified_ms,
                stable_for: 0,
            });

            if seen.size == entry.size && seen.modified_ms == entry.modified_ms {
                seen.stable_for += 1;
            } else {
                seen.size = entry.size;
                seen.modified_ms = entry.modified_ms;
                seen.stable_for = 0;
            }

            // Still being written. Waiting costs an interval; not waiting hands a workflow half
            // a file, which fails in a way that looks like the workflow's fault.
            if seen.stable_for < STABLE_POLLS {
                continue;
            }

            let handle = ctx.import(&entry.path, kind_for(&entry.name))?;
            self.emitted.insert(entry.path.clone(), entry.modified_ms);
            self.observed.remove(&entry.path);

            let (_, extension) = split_name(&entry.name);
            // One file, one event, carrying everything that describes it.
            fired.push(
                Fired::new("file", Value::Handle(handle))
                    .and("name", Value::Text(entry.name.clone()))
                    .and("extension", Value::Text(extension.to_ascii_lowercase())),
            );
        }

        Ok(fired)
    }

    fn interval(&self) -> Duration {
        Duration::from_millis(600)
    }
}

/// A hint from the extension, so an image arrives on an `image` port without a conversion node.
/// The runtime verifies content when something actually decodes it, so a wrong guess fails
/// there rather than being trusted.
fn kind_for(name: &str) -> HandleKind {
    let (_, extension) = split_name(name);
    match extension.to_ascii_lowercase().as_str() {
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "tiff" | "tif" => HandleKind::Image,
        "mp4" | "mov" | "mkv" | "webm" | "avi" => HandleKind::Video,
        "mp3" | "wav" | "flac" | "ogg" | "m4a" => HandleKind::Audio,
        _ => HandleKind::File,
    }
}

pub fn watcher() -> Box<dyn Trigger> {
    Box::new(Watcher::default())
}

// ---------------------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------------------

pub static TIMER: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.system.timer",
        "version": "1.0.0",
        "name": "Timer",
        "description": "Starts the workflow again and again, on a schedule.",
        "category": "system",
        "runtime": ">=0.1.0",
        "kind": "core",
        "trigger": true,
        "ports": {
          "outputs": {
            "count": { "type": "i64", "label": "How many times so far" }
          }
        },
        "config": {
          "seconds": { "type": "i64", "required": true, "min": 1, "max": 86400, "label": "Every",
                       "doc": "In seconds. The first run happens straight away." }
        },
        "platforms": ["windows", "macos", "linux"]
      }"#,
    )
});

#[derive(Default)]
struct Timer {
    count: i64,
    period: Option<Duration>,
}

impl Trigger for Timer {
    fn poll(&mut self, ctx: &mut TriggerContext<'_>) -> Result<Vec<Fired>, NodeError> {
        // Read here rather than in `interval`, which has no access to the node's settings.
        // The session asks for the interval *after* polling, so this takes effect from the
        // first tick onwards.
        let seconds = ctx.config_i64("seconds").unwrap_or(60).clamp(1, 86_400);
        self.period = Some(Duration::from_secs(seconds as u64));

        self.count += 1;
        Ok(vec![Fired::new("count", Value::Int(self.count))])
    }

    fn interval(&self) -> Duration {
        // Before the first poll the period is unknown, and a short wait is the safe guess: it
        // gets the first run going promptly and is immediately replaced by the real one.
        self.period.unwrap_or(Duration::from_millis(250))
    }
}

pub fn timer() -> Box<dyn Trigger> {
    Box::new(Timer::default())
}
