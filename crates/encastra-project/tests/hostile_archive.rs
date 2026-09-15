//! Opening a project file somebody sent you.
//!
//! A `.encastra` file is the one artefact of this product that travels between people. That
//! makes reading one the place where hostile input arrives, and these tests are about what
//! happens when it does — not about whether valid files work, which `on_disk.rs` covers.

use std::io::{Cursor, Write};

use encastra_project::{MAX_ENTRY_BYTES, MAX_FILE_BYTES, MAX_SNAPSHOTS, Project, ProjectError};
use zip::write::SimpleFileOptions;

/// The entries of a project that opens, so a test can change exactly one thing about it.
///
/// These names and shapes are not decoration: a fixture that does not actually open makes every
/// test built on it pass through whichever "malformed" branch it hits first, proving nothing.
/// [`the_fixture_these_tests_are_built_on_actually_opens`] is what keeps that honest.
fn valid_parts() -> Vec<(String, Vec<u8>)> {
    vec![
        (
            "project.json".to_owned(),
            br#"{"schema":1,"id":"p-1","name":"p","runtime":">=0.1.0","created_at_ms":0,"modified_at_ms":0}"#.to_vec(),
        ),
        ("graph.json".to_owned(), br#"{"nodes":{},"edges":[]}"#.to_vec()),
        ("lock.json".to_owned(), br#"{"components":[]}"#.to_vec()),
        ("variables.json".to_owned(), br#"{}"#.to_vec()),
        (
            "versions/index.json".to_owned(),
            br#"{"snapshots":[]}"#.to_vec(),
        ),
    ]
}

/// The fixture above, with some entries replaced or added.
fn project_with(overrides: Vec<(String, Vec<u8>)>) -> Vec<u8> {
    let mut parts = valid_parts();
    for (name, body) in overrides {
        match parts.iter_mut().find(|(existing, _)| *existing == name) {
            Some(slot) => slot.1 = body,
            None => parts.push((name, body)),
        }
    }
    let borrowed: Vec<(&str, &[u8])> = parts
        .iter()
        .map(|(name, body)| (name.as_str(), body.as_slice()))
        .collect();
    archive(&borrowed)
}

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
    //
    // The traversal entries are added to an otherwise *valid* project, deliberately. An earlier
    // version built an archive containing only the malicious names, so `from_bytes` stopped at
    // the first missing required entry and never reached any code that could have mishandled
    // them — it asserted a refusal that had nothing to do with traversal.
    let bytes = project_with(vec![
        ("../../../../evil.json".to_owned(), br#"{"schema":1}"#.to_vec()),
        ("..\\..\\evil.json".to_owned(), br#"{"schema":1}"#.to_vec()),
    ]);

    // It opens: the names are inert. Every lookup this module performs is by a fixed name, so
    // an entry called something else is never resolved, whatever it is called.
    let project = Project::from_bytes(&bytes)
        .expect("traversal entry names are inert, not fatal — the project still opens");
    assert_eq!(project.manifest.name, "p");

    // And nothing was written anywhere, in this directory or above it.
    assert!(!std::path::Path::new("evil.json").exists());
    assert!(!std::path::Path::new("../evil.json").exists());
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
fn the_fixture_these_tests_are_built_on_actually_opens() {
    // Every test below changes one thing about this fixture and asserts the change is refused.
    // That argument only holds if the unchanged fixture is accepted — otherwise a test can pass
    // because of a typo in an entry name rather than because of the thing it claims to check.
    // An earlier version of the file below used entry names this build has never read
    // ("encastra.lock", "history/index.json"), so it proved nothing for as long as it was green.
    let project = Project::from_bytes(&project_with(vec![]))
        .expect("the fixture must open, or nothing built on it means anything");
    assert_eq!(project.manifest.name, "p");
    assert!(project.graph.nodes.is_empty());
}

#[test]
fn a_snapshot_id_cannot_escape_the_history_prefix() {
    // Snapshot bodies are looked up as `versions/{id}.json`, and the id comes out of the file.
    // An id full of traversal cannot reach outside the archive, because the result is still only
    // ever a lookup by name — and a missing body must not be fatal: the entry is dropped and the
    // project still opens.
    let history = br#"{"snapshots":[{"id":"../../../../etc/passwd","created_at_ms":0,"graph_hash":"x"}]}"#;
    let bytes = project_with(vec![("versions/index.json".to_owned(), history.to_vec())]);

    let project = Project::from_bytes(&bytes)
        .expect("a traversal id is an absent body, not a broken project");

    // The lookup found nothing — there is no `versions/../../../../etc/passwd.json` entry in the
    // archive, and a lookup by name cannot leave the archive to go and find one. A snapshot with
    // no body is then dropped from the history, which is the existing rule for a missing body.
    assert!(
        project.history.snapshots.is_empty(),
        "a version whose body cannot be found is not kept"
    );
    assert!(!std::path::Path::new("etc/passwd").exists());
}

#[test]
fn a_history_that_names_more_versions_than_the_build_reads_is_refused() {
    // The index is one entry and respects the per-entry ceiling, but it chooses how many further
    // entries get read. Per-entry × unbounded-count is unbounded.
    let snapshots: Vec<String> = (0..=MAX_SNAPSHOTS)
        .map(|i| format!(r#"{{"id":"s{i}","created_at_ms":0,"graph_hash":"x"}}"#))
        .collect();
    let index = format!(r#"{{"snapshots":[{}]}}"#, snapshots.join(","));
    let bytes = project_with(vec![("versions/index.json".to_owned(), index.into_bytes())]);

    match Project::from_bytes(&bytes) {
        Err(ProjectError::TooManySnapshots { count, limit }) => {
            assert_eq!(limit, MAX_SNAPSHOTS);
            assert!(count > limit);
        }
        other => panic!("an unbounded history must be refused, got {other:?}"),
    }
}

#[test]
fn entries_that_each_respect_the_ceiling_cannot_together_exhaust_memory() {
    // The attack the per-entry ceiling does not stop: nothing here is oversized on its own. Ten
    // bodies of eight megabytes are ten legal reads whose sum is not. All of it is whitespace,
    // so the archive on disk is tiny — the cost is entirely on the machine that opens it.
    const BODIES: usize = 10;
    let mut body = br#"{"nodes":{},"edges":[]}"#.to_vec();
    body.extend(std::iter::repeat_n(b' ', 8 * 1024 * 1024));

    let snapshots: Vec<String> = (0..BODIES)
        .map(|i| format!(r#"{{"id":"s{i}","created_at_ms":0,"graph_hash":"x"}}"#))
        .collect();
    let index = format!(r#"{{"snapshots":[{}]}}"#, snapshots.join(","));

    let mut overrides = vec![("versions/index.json".to_owned(), index.into_bytes())];
    for i in 0..BODIES {
        overrides.push((format!("versions/s{i}.json"), body.clone()));
    }
    let bytes = project_with(overrides);

    assert!(
        bytes.len() < 1024 * 1024,
        "the fixture must be small on disk; that is what makes it a bomb ({} bytes)",
        bytes.len()
    );
    // Every single entry is inside the per-entry ceiling, which is the point.
    assert!((body.len() as u64) < MAX_ENTRY_BYTES);

    match Project::from_bytes(&bytes) {
        Err(ProjectError::TooLargeInTotal { .. }) => {}
        other => panic!("the sum of legal entries must still be bounded, got {other:?}"),
    }
}

#[test]
fn an_archive_that_names_the_same_entry_twice_is_refused() {
    // `by_name` answers with one of them, and which one is a detail of the central directory —
    // not necessarily the one somebody sees when they open the file in an archive viewer. A
    // project that shows one graph and runs another is a file that lies about itself.
    // The writer in this crate refuses to produce a duplicate, which is the right default and
    // also means an honest tool cannot build the fixture. An attacker is not using this writer.
    //
    // So: write a second entry under a placeholder of exactly the same length, then rewrite that
    // name to `graph.json` everywhere it appears — in its local header and in its central
    // directory record. Equal length means every offset in the archive stays valid, and the
    // result is a structurally sound ZIP naming one entry twice, which is what a hand-built
    // hostile file looks like.
    const PLACEHOLDER: &[u8] = b"zzzzz.json";
    const REAL: &[u8] = b"graph.json";
    assert_eq!(PLACEHOLDER.len(), REAL.len(), "offsets must not move");

    let second = br#"{"nodes":{"evil":{"component":"a.b@1.0.0","position":{"x":0,"y":0}}},"edges":[]}"#;
    let mut parts: Vec<(String, Vec<u8>)> = valid_parts();
    parts.push((
        String::from_utf8(PLACEHOLDER.to_vec()).unwrap(),
        second.to_vec(),
    ));
    let borrowed: Vec<(&str, &[u8])> = parts
        .iter()
        .map(|(name, body)| (name.as_str(), body.as_slice()))
        .collect();

    let mut bytes = archive(&borrowed);
    let mut rewritten = 0;
    for i in 0..bytes.len().saturating_sub(PLACEHOLDER.len()) {
        if &bytes[i..i + PLACEHOLDER.len()] == PLACEHOLDER {
            bytes[i..i + REAL.len()].copy_from_slice(REAL);
            rewritten += 1;
        }
    }
    assert_eq!(
        rewritten, 2,
        "the name should appear in the local header and the central directory"
    );

    // Before this was refused, the reader took the *second* `graph.json` — so the project that
    // ran was the one carrying the "evil" node, while the first entry is what an archive viewer
    // would tend to show. That is the whole point of refusing it.
    match Project::from_bytes(&bytes) {
        Err(ProjectError::AmbiguousArchive { declared, distinct }) => {
            assert_eq!(declared, 6);
            assert_eq!(distinct, 5);
        }
        other => panic!("a duplicated entry name must be refused, got {other:?}"),
    }
}

#[test]
fn a_graph_with_more_nodes_than_the_build_works_on_is_refused() {
    // Thirty megabytes of entirely valid JSON is a very large number of nodes, and every one of
    // them is work the validator, the editor and the runner each do before anybody sees the file.
    let nodes: Vec<String> = (0..=encastra_core::graph::MAX_NODES)
        .map(|i| format!(r#""n{i}":{{"component":"a.b@1.0.0","position":{{"x":0,"y":0}}}}"#))
        .collect();
    let graph = format!(r#"{{"nodes":{{{}}},"edges":[]}}"#, nodes.join(","));
    let bytes = project_with(vec![("graph.json".to_owned(), graph.into_bytes())]);

    match Project::from_bytes(&bytes) {
        Err(ProjectError::Invalid { entry, reason }) => {
            assert_eq!(entry, "graph.json");
            assert!(reason.contains("nodes"), "{reason}");
        }
        other => panic!("an enormous graph must be refused, got {other:?}"),
    }
}

#[test]
fn a_file_too_heavy_to_open_is_refused_before_it_is_read() {
    // `from_bytes` needs the whole archive in memory to find the central directory, so every
    // other ceiling in this module applies only after an allocation the size of the file. This
    // is the one check that can happen first, and it had no test.
    //
    // The fixture is a file with a size and no contents: `set_len` moves the end of the file
    // without writing a byte, which is what makes asserting a 256 MB ceiling cheap.
    let dir = std::env::temp_dir().join(format!("encastra-toobig-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("huge.encastra");

    let sized = std::fs::File::create(&path)
        .and_then(|file| file.set_len(MAX_FILE_BYTES + 1))
        .is_ok();
    if !sized {
        let _ = std::fs::remove_dir_all(&dir);
        eprintln!("skipped: this filesystem would not size a file without writing it");
        return;
    }

    match Project::open(&path) {
        Err(ProjectError::FileTooLarge { size, limit }) => {
            assert_eq!(limit, MAX_FILE_BYTES);
            assert_eq!(size, MAX_FILE_BYTES + 1);
        }
        other => {
            let _ = std::fs::remove_dir_all(&dir);
            panic!("an oversized file must be refused before it is read, got {other:?}");
        }
    }

    // And a small file at the same path still opens, so the refusal is about the size.
    std::fs::write(&path, project_with(vec![])).unwrap();
    assert!(Project::open(&path).is_ok());

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn an_ordinary_project_still_opens_from_disk() {
    // The file-size ceiling added in front of `open` must not have changed the ordinary case.
    let dir = std::env::temp_dir().join(format!("encastra-hostile-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("p.encastra");
    std::fs::write(&path, project_with(vec![])).unwrap();

    let project = Project::open(&path).expect("a small, valid project opens");
    assert_eq!(project.manifest.name, "p");
    let _ = std::fs::remove_dir_all(&dir);
}
