//! Working with structured data.
//!
//! Nothing here touches the filesystem or the network, so nothing here asks for a capability.
//! These components take text in and give structure back, which is what makes them safe to
//! compose freely.

use std::sync::{Arc, LazyLock};

use encastra_core::journal::{LogLevel, NodeError};
use encastra_core::runner::{CoreComponent, NodeContext};
use encastra_core::value::Value;
use encastra_protocol::manifest::ComponentManifest;

use crate::{Outputs, json_input, manifest, one, text_input};

// ---------------------------------------------------------------------------------------
// Parse JSON
// ---------------------------------------------------------------------------------------

static PARSE_JSON: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.data.json",
        "version": "1.0.0",
        "name": "Parse JSON",
        "description": "Turns text into structured data.",
        "category": "data",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "text": { "type": "string", "required": true } },
          "outputs": { "json": { "type": "json" } }
        },
        "platforms": ["windows", "macos", "linux"],
        "retryable": true
      }"#,
    )
});

struct ParseJson;

impl CoreComponent for ParseJson {
    fn manifest(&self) -> &ComponentManifest {
        &PARSE_JSON
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let text = text_input(ctx, "text")?;
        let parsed: serde_json::Value = serde_json::from_str(&text).map_err(|e| {
            NodeError::new("invalid-json", format!("This is not valid JSON: {e}."))
                .with_hint("The message says which line and column the problem is on.")
        })?;
        Ok(one("json", Value::Json(parsed)))
    }
}

pub fn parse_json() -> Arc<dyn CoreComponent> {
    Arc::new(ParseJson)
}

// ---------------------------------------------------------------------------------------
// Write JSON
// ---------------------------------------------------------------------------------------

static WRITE_JSON: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.data.json.write",
        "version": "1.0.0",
        "name": "Write JSON",
        "description": "Turns structured data back into text.",
        "category": "data",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "json": { "type": "json", "required": true } },
          "outputs": { "text": { "type": "string" } }
        },
        "config": {
          "indent": { "type": "bool", "label": "Readable", "default": true,
                      "doc": "Lay it out over several lines instead of one." }
        },
        "platforms": ["windows", "macos", "linux"],
        "retryable": true
      }"#,
    )
});

struct WriteJson;

impl CoreComponent for WriteJson {
    fn manifest(&self) -> &ComponentManifest {
        &WRITE_JSON
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let value = json_input(ctx, "json")?;
        let readable = ctx.config_bool("indent").unwrap_or(true);
        let text = if readable {
            serde_json::to_string_pretty(&value)
        } else {
            serde_json::to_string(&value)
        }
        .map_err(|e| {
            NodeError::new(
                "encode-failed",
                format!("Could not write this as JSON: {e}."),
            )
        })?;
        Ok(one("text", Value::Text(text)))
    }
}

pub fn write_json() -> Arc<dyn CoreComponent> {
    Arc::new(WriteJson)
}

// ---------------------------------------------------------------------------------------
// Read CSV
// ---------------------------------------------------------------------------------------

static READ_CSV: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.data.csv.read",
        "version": "1.0.0",
        "name": "Read CSV",
        "description": "Turns comma-separated text into a list of rows.",
        "category": "data",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "text": { "type": "string", "required": true } },
          "outputs": {
            "rows":  { "type": "json", "label": "Rows" },
            "count": { "type": "i64", "label": "How many" }
          }
        },
        "config": {
          "header":    { "type": "bool", "label": "First row is a header", "default": true },
          "separator": { "type": "string", "label": "Separator",
                         "doc": "One character. Defaults to a comma; use a semicolon or a tab if that is what the file has." }
        },
        "platforms": ["windows", "macos", "linux"],
        "retryable": true
      }"#,
    )
});

struct ReadCsv;

/// The separator, as a single byte. Anything longer or non-ASCII is refused rather than
/// silently truncated to its first byte, which would split a multi-byte character.
fn separator(ctx: &NodeContext<'_>) -> Result<u8, NodeError> {
    let configured = ctx.config_str("separator").unwrap_or(",");
    let configured = if configured.is_empty() {
        ","
    } else {
        configured
    };
    match configured.as_bytes() {
        [single] if single.is_ascii() => Ok(*single),
        _ => Err(NodeError::new(
            "bad-separator",
            format!("{configured:?} is not a single character."),
        )
        .with_hint("Use one character, such as , or ; or a tab.")),
    }
}

/// The most rows a CSV may become.
///
/// Not a guess at what is useful: what bounds the memory a `Value::Json` table takes, since each
/// cell costs far more as a JSON node than as text. A million rows of a handful of columns is
/// generous for a tool that hands the result to the next node as one value.
pub const MAX_CSV_ROWS: usize = 1_000_000;

/// The most cells a CSV may become, whatever its shape.
///
/// Rows alone would let a file of ten million one-byte columns through. Ten million cells at
/// roughly a hundred bytes of JSON structure each is the order of a gigabyte, which is where a
/// single node's value should stop.
pub const MAX_CSV_CELLS: usize = 10_000_000;

impl CoreComponent for ReadCsv {
    fn manifest(&self) -> &ComponentManifest {
        &READ_CSV
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let text = text_input(ctx, "text")?;
        let has_header = ctx.config_bool("header").unwrap_or(true);
        let delimiter = separator(ctx)?;

        let mut reader = csv::ReaderBuilder::new()
            .has_headers(has_header)
            .delimiter(delimiter)
            // A row with the wrong number of fields is a fact about the file, not a reason to
            // abandon the run. It is reported in the log and kept.
            .flexible(true)
            .from_reader(text.as_bytes());

        let headers: Vec<String> = if has_header {
            reader
                .headers()
                .map_err(|e| {
                    NodeError::new(
                        "invalid-csv",
                        format!("The header row could not be read: {e}."),
                    )
                })?
                .iter()
                .map(str::to_owned)
                .collect()
        } else {
            Vec::new()
        };

        let mut rows = Vec::new();
        let mut ragged = 0usize;
        let mut cells = 0usize;
        for record in reader.records() {
            let record = record.map_err(|e| {
                NodeError::new("invalid-csv", format!("A row could not be read: {e}."))
            })?;

            // Every cell becomes a heap string inside a map inside an array: fifty to a hundred
            // and fifty bytes of structure per byte of input for a file of one-character cells.
            // The read ceiling bounds the text; without this, nothing bounded what the text
            // becomes. Refused rather than truncated — a table missing its last rows is a
            // different table, and a silently different one.
            cells += record.len();
            if rows.len() >= MAX_CSV_ROWS || cells > MAX_CSV_CELLS {
                return Err(NodeError::new(
                    "csv-too-large",
                    format!(
                        "This file has more than {MAX_CSV_ROWS} rows or {MAX_CSV_CELLS} cells,                          which is more than this build turns into a table."
                    ),
                )
                .with_hint("Split the file, or filter it before this step."));
            }

            if has_header {
                if record.len() != headers.len() {
                    ragged += 1;
                }
                let mut object = serde_json::Map::new();
                for (index, field) in record.iter().enumerate() {
                    let key = headers
                        .get(index)
                        .cloned()
                        .unwrap_or_else(|| format!("column{}", index + 1));
                    object.insert(key, serde_json::Value::String(field.to_owned()));
                }
                rows.push(serde_json::Value::Object(object));
            } else {
                rows.push(serde_json::Value::Array(
                    record
                        .iter()
                        .map(|f| serde_json::Value::String(f.to_owned()))
                        .collect(),
                ));
            }
        }

        if ragged > 0 {
            ctx.log(
                encastra_core::journal::LogLevel::Warn,
                format!("{ragged} row(s) did not have the same number of columns as the header."),
            );
        }
        ctx.log(LogLevel::Info, format!("Read {} rows.", rows.len()));

        let count = rows.len() as i64;
        Ok(Outputs::from([
            (
                "rows".to_owned(),
                Value::Json(serde_json::Value::Array(rows)),
            ),
            ("count".to_owned(), Value::Int(count)),
        ]))
    }
}

pub fn read_csv() -> Arc<dyn CoreComponent> {
    Arc::new(ReadCsv)
}

// ---------------------------------------------------------------------------------------
// Write CSV
// ---------------------------------------------------------------------------------------

static WRITE_CSV: LazyLock<ComponentManifest> = LazyLock::new(|| {
    manifest(
        r#"{
        "schema": 1,
        "id": "encastra.data.csv.write",
        "version": "1.0.0",
        "name": "Write CSV",
        "description": "Turns a list of rows into comma-separated text.",
        "category": "data",
        "runtime": ">=0.1.0",
        "kind": "core",
        "ports": {
          "inputs":  { "rows": { "type": "json", "required": true, "label": "Rows" } },
          "outputs": { "text": { "type": "string" } }
        },
        "config": {
          "header":    { "type": "bool", "label": "Write a header row", "default": true },
          "separator": { "type": "string", "label": "Separator" }
        },
        "platforms": ["windows", "macos", "linux"],
        "retryable": true
      }"#,
    )
});

struct WriteCsv;

impl CoreComponent for WriteCsv {
    fn manifest(&self) -> &ComponentManifest {
        &WRITE_CSV
    }

    fn run(&self, ctx: &mut NodeContext<'_>) -> Result<Outputs, NodeError> {
        let value = json_input(ctx, "rows")?;
        let serde_json::Value::Array(rows) = value else {
            return Err(NodeError::new(
                "wrong-input",
                "This needs a list of rows, and it received something else.",
            )
            .with_hint("Connect the output of Read CSV, or anything that produces a list."));
        };

        let delimiter = separator(ctx)?;
        let write_header = ctx.config_bool("header").unwrap_or(true);

        // Column order comes from the first row and is then held fixed. Letting each row decide
        // its own order would produce a file whose columns do not line up.
        let columns: Vec<String> = match rows.first() {
            Some(serde_json::Value::Object(first)) => first.keys().cloned().collect(),
            _ => Vec::new(),
        };

        let mut writer = csv::WriterBuilder::new()
            .delimiter(delimiter)
            .from_writer(Vec::new());

        if write_header && !columns.is_empty() {
            writer
                .write_record(&columns)
                .map_err(|e| NodeError::new("encode-failed", e.to_string()))?;
        }

        for row in &rows {
            let record: Vec<String> = match row {
                serde_json::Value::Object(fields) if !columns.is_empty() => columns
                    .iter()
                    .map(|column| cell(fields.get(column)))
                    .collect(),
                serde_json::Value::Array(items) => items.iter().map(|v| cell(Some(v))).collect(),
                other => vec![cell(Some(other))],
            };
            writer
                .write_record(&record)
                .map_err(|e| NodeError::new("encode-failed", e.to_string()))?;
        }

        let bytes = writer
            .into_inner()
            .map_err(|e| NodeError::new("encode-failed", e.to_string()))?;
        let text = String::from_utf8(bytes)
            .map_err(|_| NodeError::new("encode-failed", "The result was not valid text."))?;

        ctx.log(LogLevel::Info, format!("Wrote {} rows.", rows.len()));
        Ok(one("text", Value::Text(text)))
    }
}

/// One cell. Structure inside a cell is written as JSON rather than as Rust's debug form,
/// because the result is a file somebody opens in a spreadsheet.
fn cell(value: Option<&serde_json::Value>) -> String {
    match value {
        None | Some(serde_json::Value::Null) => String::new(),
        Some(serde_json::Value::String(s)) => s.clone(),
        Some(serde_json::Value::Bool(b)) => b.to_string(),
        Some(serde_json::Value::Number(n)) => n.to_string(),
        Some(other) => serde_json::to_string(other).unwrap_or_default(),
    }
}

pub fn write_csv() -> Arc<dyn CoreComponent> {
    Arc::new(WriteCsv)
}
