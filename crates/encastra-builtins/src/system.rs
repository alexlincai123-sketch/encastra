//! Talking to the desktop.
//!
//! Both components here ask for a capability, and both are refused without one — including
//! when the refusal is inconvenient. That is the point: the permission dialog is only honest if
//! the answer "no" actually stops something.

use std::sync::{Arc, LazyLock};

use encastra_core::journal::{LogLevel, NodeError, NodeErrorCode};
use encastra_core::runner::{CoreComponent, NodeContext};
use encastra_core::value::Value;
use encastra_protocol::manifest::ComponentManifest;

use crate::{Outputs, manifest, one, text_input};

// ---------------------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------------------

static NOTIFY: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.system.notify",
        "version": "1.0.0",
        "name": "Notify",
        "description": "Shows a message when this step runs.",
        "category": "system",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "message": { "type": "string", "required": true } },
          "outputs": { "message": { "type": "string", "label": "What was shown" } }
        },
        "config": {
          "title": { "type": "string", "label": "Title" }
        },
        "capabilities": [
          { "kind": "system.notify", "scope": "notifications",
            "reason": "Shows a notification on your desktop when this step runs." }
        ],
        "platforms": ["windows", "macos", "linux"]
      }"#,
    )
});

struct Notify;

impl CoreComponent for Notify {
    fn manifest(&self) -> &ComponentManifest {
        &NOTIFY
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let message = text_input(ctx, "message")?;
        let title = ctx
            .config_str("title")
            .map(str::trim)
            .filter(|t| !t.is_empty())
            .unwrap_or("Encastra")
            .to_owned();

        // Permission first, and the call is recorded whether or not anything is drawn.
        //
        // The runtime does not draw the notification itself: it records the request, and the
        // host that owns a screen delivers it — the desktop application shows it, the CLI
        // prints it. A runtime that reached for a windowing API would be a runtime that
        // cannot run headless, and the same code has to serve both.
        ctx.notify(&title)?;
        ctx.log(LogLevel::Info, format!("{title}: {message}"));

        Ok(one("message", Value::Text(message)))
    }
}

pub fn notify() -> Arc<dyn CoreComponent> {
    Arc::new(Notify)
}

// ---------------------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------------------

static CLIPBOARD: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.system.clipboard",
        "version": "1.0.0",
        "name": "Copy to Clipboard",
        "description": "Puts text on the clipboard, ready to paste.",
        "category": "system",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "text": { "type": "string", "required": true } },
          "outputs": { "text": { "type": "string", "label": "What was copied" } }
        },
        "capabilities": [
          { "kind": "system.clipboard", "scope": "write",
            "reason": "Replaces whatever is currently on your clipboard with this text." }
        ],
        "platforms": ["windows", "macos", "linux"]
      }"#,
    )
});

struct Clipboard;

impl CoreComponent for Clipboard {
    fn manifest(&self) -> &ComponentManifest {
        &CLIPBOARD
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let text = text_input(ctx, "text")?;

        // The detail written to the journal is the size, not the content: a clipboard is
        // exactly the sort of place a password passes through.
        ctx.use_clipboard(&format!("{} characters", text.chars().count()))?;

        let mut clipboard = arboard::Clipboard::new().map_err(|e| {
            NodeError::new(
                NodeErrorCode::ClipboardUnavailable,
                describe_clipboard_error(&e),
            )
            .with_hint(
                "This can happen on a machine with no desktop session, such as a build server.",
            )
        })?;
        clipboard.set_text(text.clone()).map_err(|e| {
            NodeError::new(NodeErrorCode::ClipboardFailed, describe_clipboard_error(&e))
        })?;

        ctx.log(
            LogLevel::Info,
            format!("Copied {} characters.", text.chars().count()),
        );
        Ok(one("text", Value::Text(text)))
    }
}

/// The error kind, never the payload. Clipboard errors from some backends quote the content
/// they were handling, and this runs on text the user may not want in a log file.
fn describe_clipboard_error(error: &arboard::Error) -> String {
    match error {
        arboard::Error::ContentNotAvailable => "There is nothing on the clipboard.".into(),
        arboard::Error::ClipboardNotSupported => {
            "This system does not have a clipboard available.".into()
        }
        arboard::Error::ClipboardOccupied => {
            "Another application is holding the clipboard. Try again.".into()
        }
        arboard::Error::ConversionFailure => "That text could not be put on the clipboard.".into(),
        _ => "The clipboard could not be used.".into(),
    }
}

pub fn clipboard() -> Arc<dyn CoreComponent> {
    Arc::new(Clipboard)
}
