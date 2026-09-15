//! A component manifest, read from arbitrary text.
//!
//! Today every manifest this build loads is compiled into it, so this target is ahead of the
//! threat rather than behind it. That changes the moment third-party components exist: a
//! manifest will then arrive from a registry, and it is the document that says what a component
//! is allowed to ask for. A parser that can be made to panic on one is a crash on installing a
//! component; a parser that can be made to accept a malformed one is worse than that.
//!
//! Running this now means the day manifests become untrusted input, they have already been
//! fuzzed rather than newly exposed.

#![no_main]

use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    if let Ok(text) = std::str::from_utf8(data) {
        let _ = encastra_protocol::manifest::ComponentManifest::parse(text);
    }
});
