//! The graph document, read from arbitrary text.
//!
//! A graph arrives inside a project file and is also parsed on its own. It is the part of a
//! project that decides what runs, so a parser that can be made to panic here is a crash on
//! opening a file somebody sent, and one that can be made to allocate without bound is worse.
//!
//! `Graph::parse` also applies the node and edge ceilings, so this covers those too: a document
//! that gets past them and into the executor is the thing this target exists to rule out.

#![no_main]

use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    // Invalid UTF-8 is handled before this point in every real caller, so feeding it here would
    // spend the fuzzer's time on a conversion rather than on the parser.
    if let Ok(text) = std::str::from_utf8(data) {
        let _ = encastra_core::graph::Graph::parse(text);
    }
});
