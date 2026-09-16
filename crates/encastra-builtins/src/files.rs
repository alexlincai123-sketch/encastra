//! Reading, writing and moving files.
//!
//! Everything here goes through the broker, so none of it can touch a path the user did not
//! allow. The components that *produce* a file write into the run's scratch space, which needs
//! no permission; the components that put a file somewhere the user will find it are the ones
//! that ask.

use std::sync::{Arc, LazyLock};

use encastra_core::journal::{LogLevel, NodeError, NodeErrorCode};
use encastra_core::runner::{CoreComponent, NodeContext};
use encastra_core::value::{HandleKind, Value};
use encastra_protocol::manifest::ComponentManifest;

use crate::{Outputs, handle_input, manifest, one, required_config, split_name, text_input};

// ---------------------------------------------------------------------------------------
// Read File
// ---------------------------------------------------------------------------------------

static READ: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.file.read",
        "version": "1.0.0",
        "name": "Read File",
        "description": "Reads the text content of the file connected to it.",
        "category": "file",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "file": { "type": "file", "required": true, "label": "File" } },
          "outputs": {
            "text": { "type": "string", "label": "Text" },
            "name": { "type": "string", "label": "File name" }
          }
        },
        "capabilities": [
          { "kind": "fs.read", "scope": "input-handles",
            "reason": "Reads the file you connect to this node, and nothing else." }
        ],
        "platforms": ["windows", "macos", "linux"],
        "retryable": true
      }"#,
    )
});

struct Read;

impl CoreComponent for Read {
    fn manifest(&self) -> &ComponentManifest {
        &READ
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let handle = handle_input(ctx, "file")?;
        let name = ctx.source_name(handle).unwrap_or_default();
        let text = ctx.read_text(handle)?;
        ctx.log(
            LogLevel::Info,
            format!("Read {} characters.", text.chars().count()),
        );
        Ok(Outputs::from([
            ("text".to_owned(), Value::Text(text)),
            ("name".to_owned(), Value::Text(name)),
        ]))
    }
}

pub fn read() -> Arc<dyn CoreComponent> {
    Arc::new(Read)
}

// ---------------------------------------------------------------------------------------
// Write File (text)
// ---------------------------------------------------------------------------------------

static WRITE: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.file.write",
        "version": "1.0.0",
        "name": "Write File",
        "description": "Saves text into a file in a folder you choose.",
        "category": "file",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "content": { "type": "string", "required": true } },
          "outputs": {
            "saved": { "type": "bool", "label": "Saved" },
            "file":  { "type": "file", "label": "Saved file" }
          }
        },
        "config": {
          "folder":   { "type": "string", "required": true, "label": "Folder",
                        "doc": "Where to save. You are asked to allow this folder before the first run." },
          "filename": { "type": "string", "required": true, "label": "File name" }
        },
        "capabilities": [
          { "kind": "fs.write", "scope": "chosen-folder",
            "reason": "Saves the result into the folder you pick. It cannot write anywhere else." }
        ],
        "platforms": ["windows", "macos", "linux"]
      }"#,
    )
});

struct Write;

impl CoreComponent for Write {
    fn manifest(&self) -> &ComponentManifest {
        &WRITE
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let content = text_input(ctx, "content")?;
        let folder = required_config(ctx, "folder")?;
        let filename = required_config(ctx, "filename")?;

        // Staged in the run's scratch space first, then copied out. The broker checks the
        // destination against what the user allowed at the moment of the copy.
        let staged = ctx.create_output(HandleKind::File, &filename)?;
        ctx.write(staged, content.as_bytes())?;
        ctx.save_to(staged, std::path::Path::new(&folder), &filename)?;

        ctx.log(LogLevel::Info, format!("Saved {filename}."));
        // `saved` came first and stays. Removing an output is a breaking change to every graph
        // that connected it; adding one alongside costs nothing.
        Ok(Outputs::from([
            ("saved".to_owned(), Value::Bool(true)),
            ("file".to_owned(), Value::Handle(staged)),
        ]))
    }
}

pub fn write() -> Arc<dyn CoreComponent> {
    Arc::new(Write)
}

// ---------------------------------------------------------------------------------------
// Save File (any file, including images)
// ---------------------------------------------------------------------------------------

static SAVE: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.file.save",
        "version": "1.0.0",
        "name": "Save File",
        "description": "Puts a file into a folder you choose. Keeps the original name unless you give one.",
        "category": "file",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "file": { "type": "file", "required": true, "label": "File" } },
          "outputs": { "file": { "type": "file", "label": "Saved file" } }
        },
        "config": {
          "folder":   { "type": "string", "required": true, "label": "Folder",
                        "doc": "Where to save. You are asked to allow this folder before the first run." },
          "filename": { "type": "string", "label": "File name",
                        "doc": "Leave empty to keep the name the file already has." },
          "suffix":   { "type": "string", "label": "Add to the name",
                        "doc": "Appended before the extension, so photo.png becomes photo-small.png." }
        },
        "capabilities": [
          { "kind": "fs.write", "scope": "chosen-folder",
            "reason": "Saves the file into the folder you pick. It cannot write anywhere else." }
        ],
        "platforms": ["windows", "macos", "linux"]
      }"#,
    )
});

struct Save;

impl CoreComponent for Save {
    fn manifest(&self) -> &ComponentManifest {
        &SAVE
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let handle = handle_input(ctx, "file")?;
        let folder = required_config(ctx, "folder")?;
        let filename = target_name(ctx, handle)?;

        ctx.save_to(handle, std::path::Path::new(&folder), &filename)?;
        ctx.log(LogLevel::Info, format!("Saved {filename}."));
        Ok(one("file", Value::Handle(handle)))
    }
}

/// The name to write under: an explicit one, or the file's own, plus any suffix.
///
/// A workflow that processes a folder cannot be asked for a filename per file, so keeping the
/// original is the default rather than something to configure.
fn target_name(
    ctx: &NodeContext<'_>,
    handle: encastra_core::value::Handle,
) -> Result<String, NodeError> {
    let explicit = ctx
        .config_str("filename")
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let base = match explicit {
        Some(name) => name.to_owned(),
        None => ctx.source_name(handle).ok_or_else(|| {
            NodeError::new(
                NodeErrorCode::MissingConfig,
                "This file has no name, so one has to be set.",
            )
            .with_hint("Set a file name on this node.")
        })?,
    };

    let suffix = ctx
        .config_str("suffix")
        .map(str::trim)
        .filter(|s| !s.is_empty());
    Ok(match suffix {
        None => base,
        Some(suffix) => {
            let (stem, extension) = split_name(&base);
            if extension.is_empty() {
                format!("{stem}{suffix}")
            } else {
                format!("{stem}{suffix}.{extension}")
            }
        }
    })
}

pub fn save() -> Arc<dyn CoreComponent> {
    Arc::new(Save)
}

// ---------------------------------------------------------------------------------------
// Move File
// ---------------------------------------------------------------------------------------

static MOVE: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.file.move",
        "version": "1.0.0",
        "name": "Move File",
        "description": "Moves a file into another folder. The original is removed.",
        "category": "file",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "file": { "type": "file", "required": true, "label": "File" } },
          "outputs": { "file": { "type": "file", "label": "Moved file" } }
        },
        "config": {
          "folder":   { "type": "string", "required": true, "label": "Move into",
                        "doc": "Both this folder and the one the file comes from must be allowed, because a move deletes the original." },
          "filename": { "type": "string", "label": "New name",
                        "doc": "Leave empty to keep the name it already has." }
        },
        "capabilities": [
          { "kind": "fs.write", "scope": "chosen-folder",
            "reason": "Moves the file, which means writing it to the new folder and deleting it from the old one." }
        ],
        "platforms": ["windows", "macos", "linux"]
      }"#,
    )
});

struct Move;

impl CoreComponent for Move {
    fn manifest(&self) -> &ComponentManifest {
        &MOVE
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let handle = handle_input(ctx, "file")?;
        let folder = required_config(ctx, "folder")?;
        let filename = target_name(ctx, handle)?;

        ctx.move_to(handle, std::path::Path::new(&folder), &filename)?;
        ctx.log(LogLevel::Info, format!("Moved {filename}."));
        Ok(one("file", Value::Handle(handle)))
    }
}

pub fn move_file() -> Arc<dyn CoreComponent> {
    Arc::new(Move)
}

// ---------------------------------------------------------------------------------------
// Rename File
// ---------------------------------------------------------------------------------------

static RENAME: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.file.rename",
        "version": "1.0.0",
        "name": "Rename File",
        "description": "Gives a file a new name, leaving it where it is.",
        "category": "file",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  {
            "file": { "type": "file", "required": true, "label": "File" },
            "name": { "type": "string", "label": "New name",
                      "doc": "Overrides the pattern below when connected." }
          },
          "outputs": { "file": { "type": "file", "label": "Renamed file" } }
        },
        "config": {
          "folder":  { "type": "string", "required": true, "label": "Folder",
                       "doc": "The folder the file is in. It must be allowed, because renaming removes the old name." },
          "pattern": { "type": "string", "label": "Name pattern",
                       "doc": "Use {name} for the current name without its extension and {ext} for the extension." }
        },
        "capabilities": [
          { "kind": "fs.write", "scope": "chosen-folder",
            "reason": "Renames a file in the folder you pick, which means writing the new name and removing the old one." }
        ],
        "platforms": ["windows", "macos", "linux"]
      }"#,
    )
});

struct Rename;

impl CoreComponent for Rename {
    fn manifest(&self) -> &ComponentManifest {
        &RENAME
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let handle = handle_input(ctx, "file")?;
        let folder = required_config(ctx, "folder")?;
        let current = ctx.source_name(handle).unwrap_or_default();
        let (stem, extension) = split_name(&current);

        let connected = match ctx.input("name") {
            Some(Value::Text(t)) if !t.trim().is_empty() => Some(t.trim().to_owned()),
            _ => None,
        };

        let new_name = match connected {
            Some(name) => name,
            None => {
                let pattern = ctx
                    .config_str("pattern")
                    .map(str::trim)
                    .filter(|s| !s.is_empty());
                match pattern {
                    Some(pattern) => pattern
                        .replace("{name}", &stem)
                        .replace("{ext}", &extension),
                    None => {
                        return Err(NodeError::new(
                            NodeErrorCode::MissingConfig,
                            "This node needs either a name pattern or something connected to \"name\".",
                        ));
                    }
                }
            }
        };

        ctx.move_to(handle, std::path::Path::new(&folder), &new_name)?;
        ctx.log(LogLevel::Info, format!("Renamed to {new_name}."));
        Ok(one("file", Value::Handle(handle)))
    }
}

pub fn rename() -> Arc<dyn CoreComponent> {
    Arc::new(Rename)
}
