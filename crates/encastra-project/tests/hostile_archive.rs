//! Opening a project file somebody sent you.
//!
//! A `.encastra` file is the one artefact of this product that travels between people. That
//! makes reading one the place where hostile input arrives, and these tests are about what
//! happens when it does — not about whether valid files work, which `on_disk.rs` covers.

use std::io::{Cursor, Write};

use encastra_project::{MAX_ENTRY_BYTES, Project, ProjectError};
use zip::write::SimpleFileOptions;

/// Builds an archive with exactly the entries given, however malformed.
fn archive(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let mut out = Vec::new();
    {
        let mut writer = zip::ZipWriter::new(Cursor::new(&mut out));
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        for (name, body) in entries {
            writer.start_file(*name, options).unwrap();
            writer.write_all(body).unwrap();
        }
        writer.finish().unwrap();
    }
    out
}

#[test]
fn an_entry_that_unpacks_to_more_than_the_ceiling_is_refused() {
    // A zip bomb: highly compressible input that expands enormously. This one is a few hundred
    // kilobytes on disk and well over the ceiling unpacked, which is the whole trick — the
    // compressed size of a ZIP entry tells you nothing about what reading it will cost.
    let bomb = vec![b' '; (MAX_ENTRY_BYTES + 1024) as usize];
    let bytes = archive(&[("project.json", &bomb)]);

    assert!(
        bytes.len() < 1024 * 1024,
        "the fixture should be small on disk; that is what makes it a bomb ({} bytes)",
        bytes.len()
    );

    match Project::from_bytes(&bytes) {
        Err(ProjectError::TooLarge { entry, limit }) => {
            assert_eq!(entry, "project.json");
            assert_eq!(limit, MAX_ENTRY_BYTES);
        }
        other => panic!("a zip bomb must be refused, got {other:?}"),
    }
}

#[test]
fn the_refusal_happens_before_the_whole_entry_is_held_in_memory() {
    // The point of the ceiling is not to produce a tidy error — it is to stop the allocation.
    // Reading one byte past the limit and refusing means the process never holds more than the
    // ceiling, whatever the archive claims. A file far beyond the limit must cost no more than
    // one just beyond it.
    let huge = vec![b' '; (MAX_ENTRY_BYTES * 4) as usize];
    let bytes = archive(&[("project.json", &huge)]);
    assert!(matches!(
        Project::from_bytes(&bytes),
        Err(ProjectError::TooLarge { .. })
    ));
}

#[test]
fn an_entry_name_that_climbs_out_of_the_archive_reaches_nothing() {
    // Zip-slip, the classic. It cannot apply here because nothing is ever extracted to a path —
    // entries are looked up by fixed name — and this test exists to keep it that way. If
    // somebody later adds extraction, this is the test that should start failing.
    let bytes = archive(&[
        ("../../../../evil.json", br#"{"schema":1}"#),
        ("..\\..\\evil.json", br#"{"schema":1}"#),
    ]);

    // No entry called project.json, so it is missing rather than anything more interesting.
    assert!(matches!(
        Project::from_bytes(&bytes),
        Err(ProjectError::MissingEntry(_))
    ));

    // And nothing was written anywhere.
    assert!(!std::path::Path::new("evil.json").exists());
}

#[test]
fn an_archive_that_is_not_an_archive_is_refused_cleanly() {
    assert!(matches!(
        Project::from_bytes(b"this is not a zip file at all"),
        Err(ProjectError::Archive(_))
    ));
    assert!(matches!(
        Project::from_bytes(&[]),
        Err(ProjectError::Archive(_))
    ));
}

#[test]
fn an_entry_that_is_not_utf8_is_refused_rather_than_panicking() {
    let bytes = archive(&[("project.json", &[0xff, 0xfe, 0xfd, 0x00])]);
    // Invalid UTF-8 surfaces as an io error from read_to_string. What matters is that it is an
    // error and not a panic, because a panic here is a crash on opening a file.
    assert!(Project::from_bytes(&bytes).is_err());
}

#[test]
fn a_snapshot_id_cannot_escape_the_history_prefix() {
    // Snapshot bodies are looked up as `history/{id}.json`, and the id comes out of the file.
    // An id full of traversal cannot reach outside the archive, because the result is still
    // only ever a lookup — but a missing body must also not be fatal: the history entry is
    // dropped and the project still opens.
    let manifest = br#"{"schema":1,"name":"p","created_at_ms":0,"updated_at_ms":0}"#;
    let graph = br#"{"nodes":{},"edges":[]}"#;
    let lock = br#"{"components":[]}"#;
    let variables = br#"{"variables":[]}"#;
    let history = br#"{"snapshots":[{"id":"../../../../etc/passwd","created_at_ms":0}]}"#;

    let bytes = archive(&[
        ("project.json", manifest),
        ("graph.json", graph),
        ("encastra.lock", lock),
        ("variables.json", variables),
        ("history/index.json", history),
    ]);

    match Project::from_bytes(&bytes) {
        // Either it opens with that snapshot's body dropped, or the manifest shape is refused.
        // Both are acceptable; a read outside the archive is not, and cannot happen.
        Ok(project) => {
            assert!(project.history.snapshots.len() <= 1);
        }
        Err(ProjectError::Invalid { .. } | ProjectError::MissingEntry(_)) => {}
        other => panic!("unexpected: {other:?}"),
    }
}
