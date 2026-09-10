//! Replays the compatibility matrix produced by the TypeScript implementation and asserts
//! this crate gives the same answer for every entry.
//!
//! If this test fails, the editor and the runtime disagree about which connections are legal.
//! That is never an acceptable state to ship: fix the divergence, do not update the fixture
//! to match Rust. The fixture is generated from the shared rule table by
//! `packages/protocol/test/conformance-matrix.test.ts`.

use encastra_protocol::{Compatibility, check_compatibility_str};
use serde::Deserialize;

const MATRIX_JSON: &str = include_str!("../../../packages/protocol/data/compat-matrix.json");

#[derive(Debug, Deserialize)]
struct Entry {
    from: String,
    to: String,
    ok: bool,
    kind: Option<String>,
    ops: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct Matrix {
    entries: Vec<Entry>,
}

fn kind_name(kind: encastra_protocol::CoercionKind) -> &'static str {
    match kind {
        encastra_protocol::CoercionKind::Direct => "direct",
        encastra_protocol::CoercionKind::Implicit => "implicit",
        encastra_protocol::CoercionKind::Explicit => "explicit",
    }
}

#[test]
fn rust_agrees_with_typescript_on_every_pair() {
    let matrix: Matrix =
        serde_json::from_str(MATRIX_JSON).expect("compat-matrix.json must be valid JSON");

    assert!(
        matrix.entries.len() > 100,
        "the matrix has {} entries, which is too few to be the generated one",
        matrix.entries.len()
    );

    let mut divergences: Vec<String> = Vec::new();

    for entry in &matrix.entries {
        let actual = check_compatibility_str(&entry.from, &entry.to);
        match (&actual, entry.ok) {
            (Compatibility::No { .. }, true) => divergences.push(format!(
                "{} -> {}: editor allows it ({}), runtime refuses",
                entry.from,
                entry.to,
                entry.kind.as_deref().unwrap_or("?")
            )),
            (Compatibility::Yes(c), false) => divergences.push(format!(
                "{} -> {}: editor refuses it, runtime allows it as {}",
                entry.from,
                entry.to,
                kind_name(c.kind)
            )),
            (Compatibility::Yes(c), true) => {
                let expected_kind = entry.kind.as_deref().unwrap_or("");
                if kind_name(c.kind) != expected_kind {
                    divergences.push(format!(
                        "{} -> {}: editor says {}, runtime says {}",
                        entry.from,
                        entry.to,
                        expected_kind,
                        kind_name(c.kind)
                    ));
                } else if c.ops != entry.ops {
                    divergences.push(format!(
                        "{} -> {}: editor applies {:?}, runtime applies {:?}",
                        entry.from, entry.to, entry.ops, c.ops
                    ));
                }
            }
            (Compatibility::No { .. }, false) => {}
        }
    }

    assert!(
        divergences.is_empty(),
        "the editor and the runtime disagree about {} connection(s):\n  {}",
        divergences.len(),
        divergences.join("\n  ")
    );
}

#[test]
fn every_named_type_in_the_table_is_resolvable_here() {
    // Catches the case where the JSON gains a type the Rust reader silently ignores.
    for name in encastra_protocol::all_type_names() {
        assert!(
            encastra_protocol::type_def(name).is_some(),
            "{name} is in the table but this build cannot resolve it"
        );
        assert!(
            matches!(check_compatibility_str(name, name), Compatibility::Yes(_)),
            "{name} does not connect to itself"
        );
    }
}
