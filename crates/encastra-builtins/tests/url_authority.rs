//! The runtime's half of the permission-parser conformance table.
//!
//! The editor reads an address to build the prompt a person answers; the runtime reads the same
//! address to decide whether the request is allowed. Two parsers for one string is a deliberate
//! duplication — the editor is a webview and cannot call into the runtime — and the whole safety
//! argument for it is that they agree.
//!
//! Nothing was checking that. This replays
//! `packages/protocol/data/url-authority-cases.json` through the runtime's parser;
//! `apps/desktop/test/url-authority.test.ts` replays the same file through the editor's. A change
//! to either that the other does not follow fails here or there.
//!
//! This is the same shape as the type-coercion conformance gate the protocol already has, for the
//! same reason: the failure mode of two implementations drifting apart is silent.

use std::path::PathBuf;

use encastra_builtins::permission_authority;

fn cases() -> serde_json::Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/protocol/data/url-authority-cases.json");
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| {
        panic!(
            "the shared table must be readable at {}: {e}",
            path.display()
        )
    });
    serde_json::from_str(&text).expect("the shared table must be valid JSON")
}

#[test]
fn the_runtime_reads_every_case_the_way_the_table_says() {
    let table = cases();
    let entries = table["cases"]
        .as_array()
        .expect("the table must have a `cases` array");
    assert!(
        entries.len() >= 20,
        "the table should be worth replaying; found {}",
        entries.len()
    );

    let mut granted = 0;
    let mut refused = 0;

    for case in entries {
        let url = case["url"].as_str().expect("every case names a url");
        let why = case["why"].as_str().unwrap_or("");
        let expected = case["authority"].as_str();

        match (permission_authority(url), expected) {
            (Some(actual), Some(want)) => {
                assert_eq!(actual, want, "{url:?} ({why})");
                granted += 1;
            }
            (None, None) => refused += 1,
            (actual, want) => {
                panic!("{url:?} ({why}): the runtime read {actual:?}, the table says {want:?}")
            }
        }
    }

    // A table that had drifted to all-refusals would otherwise pass every assertion above.
    assert!(granted >= 10, "only {granted} addresses were granted");
    assert!(refused >= 10, "only {refused} addresses were refused");
}

/// xorshift64*, for a corpus that is identical on every machine.
fn next(state: &mut u64) -> u64 {
    let mut x = *state;
    x ^= x >> 12;
    x ^= x << 25;
    x ^= x >> 27;
    *state = x;
    x.wrapping_mul(0x2545_F491_4F6C_DD1D)
}

#[test]
fn no_address_makes_the_parser_panic_or_produce_something_unusable() {
    // The parser is hand-rolled — deliberately, to avoid a URL dependency whose reading might
    // differ from the one making the request — which puts the burden of handling every odd
    // string on this code rather than on a well-worn library. Slicing, `split_once`, bracket
    // matching and an integer parse are each a way to panic on input nobody pictured.
    //
    // The alphabet is chosen for the characters that mean something to this grammar, so the
    // sweep spends its time near the boundaries rather than on random noise.
    const ALPHABET: &[u8] = b"htps:/@[]:.%0189aZ?#\\ \t\n-_";
    const ITERATIONS: usize = 50_000;

    let mut state = 0x9E37_79B9_7F4A_7C15u64;

    for _ in 0..ITERATIONS {
        let length = (next(&mut state) % 48) as usize;
        let address: String = (0..length)
            .map(|_| ALPHABET[(next(&mut state) as usize) % ALPHABET.len()] as char)
            .collect();

        // The assertion is that this returns at all. Anything it does return has to be usable as
        // an allowlist key, so the invariants that make comparison meaningful are checked too.
        if let Some(authority) = permission_authority(&address) {
            assert!(
                !authority.is_empty(),
                "{address:?} produced an empty authority"
            );
            assert_eq!(
                authority,
                authority.to_ascii_lowercase(),
                "{address:?} produced an authority that is not lowercased, so two spellings \
                 of one host would be two different grants"
            );
            assert!(
                !authority.contains('/') && !authority.contains('@') && !authority.contains('?'),
                "{address:?} produced {authority:?}, which carries more than an authority"
            );
        }
    }
}

#[test]
fn a_very_long_address_is_answered_rather_than_chewed_on() {
    // Quadratic behaviour in a parser is a denial of service that looks like a hang. These are
    // far beyond any real address; what matters is that the answer arrives.
    let started = std::time::Instant::now();

    for size in [1_000usize, 100_000, 1_000_000] {
        let _ = permission_authority(&format!("https://{}/x", "a".repeat(size)));
        let _ = permission_authority(&format!("https://{}", ":".repeat(size)));
        let _ = permission_authority(&format!("https://[{}", "0".repeat(size)));
        let _ = permission_authority(&format!("https://example.com:{}", "9".repeat(size)));
    }

    let elapsed = started.elapsed();
    assert!(
        elapsed < std::time::Duration::from_secs(5),
        "parsing long addresses took {elapsed:?}, which suggests a super-linear path"
    );
}
