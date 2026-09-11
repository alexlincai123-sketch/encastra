//! Image components.
//!
//! The codec, and every limit on it, lives in `encastra_core::media` — one place, so a file that
//! is too large or claims an impossible size is refused the same way whichever component was
//! asked to handle it.
//!
//! These components read an image and produce a new one in the run's scratch space. Nothing
//! here writes anywhere a person can see; that is [`crate::files::save`]'s job, and it is the
//! step that asks permission.

use std::sync::{Arc, LazyLock};

use encastra_core::journal::{LogLevel, NodeError};
use encastra_core::media::{self, FitMode, OutputFormat};
use encastra_core::runner::{CoreComponent, NodeContext};
use encastra_core::value::{Handle, HandleKind, Value};
use encastra_protocol::manifest::ComponentManifest;

use crate::{Outputs, handle_input, manifest, one, split_name};

/// Reads and decodes the image on a port, with the runtime's limits applied.
fn decoded(
    ctx: &mut NodeContext<'_>,
    port: &str,
) -> Result<(Handle, String, image::DynamicImage), NodeError> {
    let handle = handle_input(ctx, port)?;
    let name = ctx
        .source_name(handle)
        .unwrap_or_else(|| "image".to_owned());
    let bytes = ctx.read(handle)?;
    let image = media::decode(&bytes).map_err(|e| {
        NodeError::new("not-an-image", e.to_string())
            .with_hint("This component needs an image. Check what is connected to it.")
    })?;
    Ok((handle, name, image))
}

/// The format to write back in.
///
/// Keeping the input's format is the least surprising default, but this build writes only PNG,
/// JPEG and WebP. A GIF or TIFF in becomes a PNG out, and the component says so rather than
/// silently producing a file with a misleading extension.
fn output_format(ctx: &mut NodeContext<'_>, source_name: &str) -> OutputFormat {
    let (_, extension) = split_name(source_name);
    match OutputFormat::parse(&extension) {
        Some(format) => format,
        None => {
            if !extension.is_empty() {
                ctx.log(
                    LogLevel::Info,
                    format!("This build cannot write {extension}, so the result is a PNG."),
                );
            }
            OutputFormat::Png
        }
    }
}

/// Writes an encoded image into the run's scratch space and returns its handle.
fn emit(
    ctx: &mut NodeContext<'_>,
    image: &image::DynamicImage,
    format: OutputFormat,
    quality: u8,
    source_name: &str,
) -> Result<Handle, NodeError> {
    let bytes = media::encode(image, format, quality)
        .map_err(|e| NodeError::new("encode-failed", e.to_string()))?;
    let (stem, _) = split_name(source_name);
    let name = format!("{stem}.{}", format.extension());
    let out = ctx.create_output(HandleKind::Image, &name)?;
    ctx.write(out, &bytes)?;
    Ok(out)
}

fn quality_of(ctx: &NodeContext<'_>) -> u8 {
    ctx.config_i64("quality").unwrap_or(85).clamp(1, 100) as u8
}

// ---------------------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------------------

static RESIZE: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.image.resize",
        "version": "1.0.0",
        "name": "Resize Image",
        "description": "Changes an image's size. Leave one side empty to keep the proportions.",
        "category": "media",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "image": { "type": "image", "required": true, "label": "Image" } },
          "outputs": {
            "image":  { "type": "image", "label": "Resized" },
            "width":  { "type": "i64", "label": "Width" },
            "height": { "type": "i64", "label": "Height" }
          }
        },
        "config": {
          "width":   { "type": "i64", "min": 0, "max": 20000, "label": "Width",
                       "doc": "Leave at 0 to work it out from the height." },
          "height":  { "type": "i64", "min": 0, "max": 20000, "label": "Height",
                       "doc": "Leave at 0 to work it out from the width." },
          "mode":    { "type": "string", "choices": ["contain", "cover", "stretch"], "label": "Fit",
                       "doc": "Contain fits inside the box. Cover fills it and crops. Stretch distorts." },
          "quality": { "type": "i64", "min": 1, "max": 100, "label": "JPEG quality" }
        },
        "capabilities": [
          { "kind": "fs.read", "scope": "input-handles",
            "reason": "Reads the image you connect to this node, and nothing else." }
        ],
        "platforms": ["windows", "macos", "linux"],
        "retryable": true
      }"#,
    )
});

struct Resize;

impl CoreComponent for Resize {
    fn manifest(&self) -> &ComponentManifest {
        &RESIZE
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let (_, name, image) = decoded(ctx, "image")?;

        let width = ctx.config_i64("width").unwrap_or(0).clamp(0, 20_000) as u32;
        let height = ctx.config_i64("height").unwrap_or(0).clamp(0, 20_000) as u32;
        if width == 0 && height == 0 {
            return Err(NodeError::new(
                "missing-config",
                "Set a width, a height, or both. Leaving one at 0 keeps the proportions.",
            ));
        }

        let mode = ctx
            .config_str("mode")
            .and_then(FitMode::parse)
            .unwrap_or(FitMode::Contain);

        let before = (image.width(), image.height());
        let resized = media::resize(&image, width, height, mode)
            .map_err(|e| NodeError::new("resize-failed", e.to_string()))?;
        let after = (resized.width(), resized.height());

        let format = output_format(ctx, &name);
        let quality = quality_of(ctx);
        let out = emit(ctx, &resized, format, quality, &name)?;

        ctx.log(
            LogLevel::Info,
            format!("{}×{} to {}×{}.", before.0, before.1, after.0, after.1),
        );

        Ok(Outputs::from([
            ("image".to_owned(), Value::Handle(out)),
            ("width".to_owned(), Value::Int(i64::from(after.0))),
            ("height".to_owned(), Value::Int(i64::from(after.1))),
        ]))
    }
}

pub fn resize() -> Arc<dyn CoreComponent> {
    Arc::new(Resize)
}

// ---------------------------------------------------------------------------------------
// Convert
// ---------------------------------------------------------------------------------------

static CONVERT: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.image.convert",
        "version": "1.0.0",
        "name": "Convert Image",
        "description": "Writes an image in a different format.",
        "category": "media",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "image": { "type": "image", "required": true, "label": "Image" } },
          "outputs": { "image": { "type": "image", "label": "Converted" } }
        },
        "config": {
          "format":  { "type": "string", "required": true, "choices": ["png", "jpeg", "webp"], "label": "Format" },
          "quality": { "type": "i64", "min": 1, "max": 100, "label": "JPEG quality",
                       "doc": "Ignored by PNG and WebP, which are written without loss here." }
        },
        "capabilities": [
          { "kind": "fs.read", "scope": "input-handles",
            "reason": "Reads the image you connect to this node, and nothing else." }
        ],
        "platforms": ["windows", "macos", "linux"],
        "retryable": true
      }"#,
    )
});

struct Convert;

impl CoreComponent for Convert {
    fn manifest(&self) -> &ComponentManifest {
        &CONVERT
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let (_, name, image) = decoded(ctx, "image")?;

        let requested = ctx.config_str("format").unwrap_or("png");
        let format = OutputFormat::parse(requested).ok_or_else(|| {
            NodeError::new(
                "unsupported-format",
                format!("This build cannot write {requested}."),
            )
            .with_hint("Choose PNG, JPEG or WebP.")
        })?;

        let quality = quality_of(ctx);
        let out = emit(ctx, &image, format, quality, &name)?;
        ctx.log(LogLevel::Info, format!("Written as {}.", format.name()));
        Ok(one("image", Value::Handle(out)))
    }
}

pub fn convert() -> Arc<dyn CoreComponent> {
    Arc::new(Convert)
}

// ---------------------------------------------------------------------------------------
// Thumbnail
// ---------------------------------------------------------------------------------------

static THUMBNAIL: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.image.thumbnail",
        "version": "1.0.0",
        "name": "Thumbnail",
        "description": "Makes a small square preview of an image.",
        "category": "media",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "image": { "type": "image", "required": true, "label": "Image" } },
          "outputs": { "image": { "type": "image", "label": "Thumbnail" } }
        },
        "config": {
          "size":    { "type": "i64", "min": 16, "max": 2048, "label": "Size",
                       "doc": "The width and height of the square, in pixels." },
          "quality": { "type": "i64", "min": 1, "max": 100, "label": "JPEG quality" }
        },
        "capabilities": [
          { "kind": "fs.read", "scope": "input-handles",
            "reason": "Reads the image you connect to this node, and nothing else." }
        ],
        "platforms": ["windows", "macos", "linux"],
        "retryable": true
      }"#,
    )
});

struct Thumbnail;

impl CoreComponent for Thumbnail {
    fn manifest(&self) -> &ComponentManifest {
        &THUMBNAIL
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let (_, name, image) = decoded(ctx, "image")?;
        let size = ctx.config_i64("size").unwrap_or(256).clamp(16, 2048) as u32;

        // Cover, not contain: a thumbnail grid with different-shaped gaps looks broken, and
        // cropping is what people expect from the word.
        let small = media::resize(&image, size, size, FitMode::Cover)
            .map_err(|e| NodeError::new("resize-failed", e.to_string()))?;

        let format = output_format(ctx, &name);
        let quality = quality_of(ctx);
        let (stem, _) = split_name(&name);
        let out = emit(ctx, &small, format, quality, &format!("{stem}-thumb"))?;

        ctx.log(LogLevel::Info, format!("{size}×{size} thumbnail."));
        Ok(one("image", Value::Handle(out)))
    }
}

pub fn thumbnail() -> Arc<dyn CoreComponent> {
    Arc::new(Thumbnail)
}

// ---------------------------------------------------------------------------------------
// Image Information
// ---------------------------------------------------------------------------------------

static INFO: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.image.info",
        "version": "1.0.0",
        "name": "Image Info",
        "description": "Reports an image's size and format without changing it.",
        "category": "media",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "image": { "type": "image", "required": true, "label": "Image" } },
          "outputs": {
            "width":  { "type": "i64", "label": "Width" },
            "height": { "type": "i64", "label": "Height" },
            "format": { "type": "string", "label": "Format" },
            "info":   { "type": "json", "label": "All of it" }
          }
        },
        "capabilities": [
          { "kind": "fs.read", "scope": "input-handles",
            "reason": "Reads the image you connect to this node, and nothing else." }
        ],
        "platforms": ["windows", "macos", "linux"],
        "retryable": true
      }"#,
    )
});

struct Info;

impl CoreComponent for Info {
    fn manifest(&self) -> &ComponentManifest {
        &INFO
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let handle = handle_input(ctx, "image")?;
        let bytes = ctx.read(handle)?;

        // The header is enough, and reading only the header means an enormous image can be
        // described without being decoded.
        let info = media::probe(&bytes).map_err(|e| {
            NodeError::new("not-an-image", e.to_string())
                .with_hint("This component needs an image. Check what is connected to it.")
        })?;

        Ok(Outputs::from([
            ("width".to_owned(), Value::Int(i64::from(info.width))),
            ("height".to_owned(), Value::Int(i64::from(info.height))),
            ("format".to_owned(), Value::Text(info.format.to_owned())),
            (
                "info".to_owned(),
                Value::Json(serde_json::json!({
                    "width": info.width,
                    "height": info.height,
                    "format": info.format,
                    "bytes": bytes.len(),
                })),
            ),
        ]))
    }
}

pub fn info() -> Arc<dyn CoreComponent> {
    Arc::new(Info)
}
