//! Mutational smoke fuzzing of the parsers that eat files from strangers.
//!
//! The rest of the hostile-input suite asks specific questions: is a zip bomb refused, is a
//! duplicate entry refused. Those tests are only as good as the attacks somebody thought of.
//! This one asks a different and dumber question — *does anything at all make it panic, hang, or
//! allocate without bound* — and asks it of inputs nobody designed.
//!
//! # Why this is a test and not a `cargo fuzz` target
//!
//! It is both. `fuzz/` holds real libFuzzer targets for the same entry points, which is the
//! right tool for finding rare inputs and which needs a nightly toolchain and hours. This repo
//! pins stable 1.98.1, so a coverage-guided fuzzer cannot run in CI here.
//!
//! What runs in CI is this: a fixed seed, a fixed iteration count, a few seconds. It will not
//! find what libFuzzer finds. It will notice the day somebody introduces an input shape that
//! panics on the second byte, which is the failure this catches cheaply and forever.
//!
//! Determinism is the point. The seed is hard-coded, so a failure here reproduces exactly, on
//! every machine, for whoever has to debug it.

use encastra_core::graph::Graph;
use encastra_project::Project;

/// Enough to explore the shapes near a valid file, few enough to stay a few seconds.
const ITERATIONS: usize = 20_000;

/// The whole point is reproducibility; this number is arbitrary and must never change casually.
const SEED: u64 = 0x243F_6A88_85A3_08D3;

/// The budget the whole sweep must fit in.
///
/// Not a benchmark. A parser that suddenly takes a hundred times longer on malformed input has
/// found a quadratic path, and that is a denial of service whether or not it ever returns.
const BUDGET: std::time::Duration = std::time::Duration::from_secs(120);

/// xorshift64*, because the corpus has to be identical on every machine and a dependency for
/// twelve lines of arithmetic is not worth the supply chain.
fn next(state: &mut u64) -> u64 {
    let mut x = *state;
    x ^= x >> 12;
    x ^= x << 25;
    x ^= x >> 27;
    *state = x;
    x.wrapping_mul(0x2545_F491_4F6C_DD1D)
}

fn pick(state: &mut u64, len: usize) -> usize {
    if len == 0 {
        0
    } else {
        (next(state) % len as u64) as usize
    }
}

/// Bends `bytes` somewhere, the way a corrupted or hand-edited file is bent.
fn mutate(bytes: &mut Vec<u8>, state: &mut u64) {
    if bytes.is_empty() {
        bytes.push(next(state) as u8);
        return;
    }
    match next(state) % 6 {
        // Flip a byte: the most productive mutation against a format with headers and lengths.
        0 => {
            let at = pick(state, bytes.len());
            bytes[at] ^= 1 << (next(state) % 8);
        }
        // Replace a byte outright.
        1 => {
            let at = pick(state, bytes.len());
            bytes[at] = next(state) as u8;
        }
        // Truncate: every length field in the file now disagrees with reality.
        2 => {
            let at = pick(state, bytes.len());
            bytes.truncate(at);
        }
        // Splice in a run of bytes.
        3 => {
            let at = pick(state, bytes.len());
            let run = (next(state) % 32) as usize;
            let filler = next(state) as u8;
            bytes.splice(at..at, std::iter::repeat_n(filler, run));
        }
        // Zero a span. Length and offset fields become zero, which parsers often handle worst.
        4 => {
            let at = pick(state, bytes.len());
            let end = (at + (next(state) % 64) as usize).min(bytes.len());
            bytes[at..end].fill(0);
        }
        // Repeat a span, which is how nesting and duplicate structures appear by accident.
        _ => {
            let at = pick(state, bytes.len());
            let end = (at + (next(state) % 128) as usize).min(bytes.len());
            let chunk = bytes[at..end].to_vec();
            bytes.splice(at..at, chunk);
        }
    }
}

fn valid_project() -> Vec<u8> {
    Project::new("fuzz", 1_700_000_000_000)
        .to_bytes()
        .expect("a fresh project always serialises")
}

fn archive_corpus() -> Vec<Vec<u8>> {
    let valid = valid_project();
    vec![
        valid.clone(),
        // A ZIP header and nothing behind it.
        b"PK\x03\x04".to_vec(),
        // The end-of-central-directory record alone.
        b"PK\x05\x06\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
            .to_vec(),
        // Half a real file.
        valid[..valid.len() / 2].to_vec(),
        Vec::new(),
        b"not an archive at all".to_vec(),
    ]
}

#[test]
fn nothing_makes_the_project_parser_panic_hang_or_run_away() {
    let corpus = archive_corpus();
    let mut state = SEED;
    let started = std::time::Instant::now();

    // Counted so the test can tell "every input was refused" — which would be correct but
    // uninteresting — from "the corpus decayed and nothing was ever a project any more".
    let mut opened = 0usize;

    for i in 0..ITERATIONS {
        let mut bytes = corpus[i % corpus.len()].clone();
        for _ in 0..=(next(&mut state) % 4) {
            mutate(&mut bytes, &mut state);
        }

        // The assertion is the absence of a panic: `from_bytes` must answer, whatever it is
        // handed. An unwind here fails the test with the input's own backtrace.
        if Project::from_bytes(&bytes).is_ok() {
            opened += 1;
        }
    }

    let elapsed = started.elapsed();
    assert!(
        elapsed < BUDGET,
        "{ITERATIONS} inputs took {elapsed:?}, which is past the budget of {BUDGET:?} — \
         something has found a path that is far more expensive than parsing should be"
    );

    // A mutation that changes nothing load-bearing still leaves a readable file, so a healthy
    // sweep opens a small fraction of what it tries. Measured at 465 of 20,000 when this was
    // written; the floor is set well under that.
    //
    // This is the canary, not the assertion. A sweep where nothing parses is still green on
    // "did not panic" while having spent its whole run on noise that never reached the parser's
    // interesting paths — which is how a fuzz test quietly stops fuzzing anything.
    assert!(
        opened >= ITERATIONS / 200,
        "only {opened} of {ITERATIONS} mutated inputs parsed — the corpus has drifted away from \
         anything resembling a project, so this sweep is no longer exercising the parser"
    );
}

#[test]
fn nothing_makes_the_graph_parser_panic() {
    // The graph arrives as text inside the archive, and is also parsed on its own. Text
    // mutations reach different code than byte mutations on a container.
    let corpus: Vec<Vec<u8>> = vec![
        br#"{"nodes":{},"edges":[]}"#.to_vec(),
        br#"{"nodes":{"a":{"component":"x.y@1.0.0","position":{"x":0,"y":0}}},"edges":[]}"#.to_vec(),
        br#"{"nodes":{},"edges":[{"from":{"node":"a","port":"o"},"to":{"node":"b","port":"i"}}]}"#
            .to_vec(),
        b"{".to_vec(),
        b"[[[[[[[[[[".to_vec(),
        Vec::new(),
    ];

    let mut state = SEED ^ 0xA5A5_A5A5_A5A5_A5A5;
    let started = std::time::Instant::now();

    for i in 0..ITERATIONS {
        let mut bytes = corpus[i % corpus.len()].clone();
        for _ in 0..=(next(&mut state) % 4) {
            mutate(&mut bytes, &mut state);
        }
        // Invalid UTF-8 is a legitimate thing to be handed; it must be refused, not unwrapped.
        if let Ok(text) = std::str::from_utf8(&bytes) {
            let _ = Graph::parse(text);
        }
    }

    let elapsed = started.elapsed();
    assert!(elapsed < BUDGET, "graph parsing took {elapsed:?}");
}

#[test]
fn the_fuzz_corpus_is_seeded_with_inputs_that_are_actually_projects() {
    // libFuzzer starts from a corpus. Seeded with nothing, it spends its first hours
    // rediscovering that a ZIP begins with "PK" — so the seeds are the difference between a
    // fuzzer that explores the parser and one that explores the first four bytes.
    //
    // Committed rather than generated at run time, so that what the fuzzer starts from is the
    // same on every machine and is visible in review. Regenerate with:
    //
    //     UPDATE_FUZZ_CORPUS=1 cargo test -p encastra-project --test fuzz_smoke
    //
    // Same shape as the protocol's `UPDATE_MATRIX` gate, and for the same reason: a generated
    // artefact that is committed needs a command that regenerates it and a test that notices
    // when it is stale.
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../fuzz/corpus/project_from_bytes");

    if std::env::var_os("UPDATE_FUZZ_CORPUS").is_some() {
        std::fs::create_dir_all(&dir).expect("the corpus directory must be creatable");
        for (name, bytes) in [
            ("valid.encastra", valid_project()),
            ("empty.bin", Vec::new()),
            ("header-only.bin", b"PK\x03\x04".to_vec()),
            ("not-an-archive.bin", b"not an archive at all".to_vec()),
        ] {
            std::fs::write(dir.join(name), bytes).expect("seed written");
        }
        let half = valid_project();
        std::fs::write(dir.join("truncated.bin"), &half[..half.len() / 2]).expect("seed written");
    }

    let seeds: Vec<_> = std::fs::read_dir(&dir)
        .unwrap_or_else(|e| panic!("the fuzz corpus must exist at {}: {e}", dir.display()))
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_ok_and(|t| t.is_file()))
        .collect();

    assert!(
        seeds.len() >= 4,
        "the corpus has {} seeds; regenerate it with UPDATE_FUZZ_CORPUS=1",
        seeds.len()
    );

    // At least one seed has to be a project that opens. A corpus of only malformed inputs is a
    // corpus the fuzzer cannot mutate its way out of.
    let valid = seeds.iter().any(|entry| {
        std::fs::read(entry.path())
            .ok()
            .is_some_and(|bytes| Project::from_bytes(&bytes).is_ok())
    });
    assert!(
        valid,
        "no seed in the corpus is a readable project, so the fuzzer would start from noise"
    );
}

#[test]
fn deeply_nested_json_is_refused_rather_than_overflowing_the_stack() {
    // Not a mutation — a shape. Recursive-descent parsers die on depth, and a stack overflow is
    // the one failure `catch_unwind` cannot contain: it aborts the process. serde_json caps
    // recursion at 128 by default, and this is the test that says so out loud, so that a future
    // `disable_recursion_limit()` has something to break.
    for depth in [64usize, 200, 5_000, 100_000] {
        let text = format!(
            "{{\"nodes\":{},\"edges\":[]}}",
            format_args!("{}{}", "[".repeat(depth), "]".repeat(depth))
        );
        assert!(
            Graph::parse(&text).is_err(),
            "a graph nested {depth} deep is not a graph"
        );
    }
}
