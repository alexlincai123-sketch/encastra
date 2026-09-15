//! The `.encastra` container, read from arbitrary bytes.
//!
//! This is the highest-value target in the repository: a project file is the one artefact of the
//! product that travels between people, and `from_bytes` is what a victim runs against a
//! stranger's file. Everything it touches — the ZIP reader, five JSON documents, the history
//! index and every snapshot body it names — is reachable from bytes chosen by whoever sent it.
//!
//! The property is the absence of a crash: any input must produce `Ok` or an `Err`, never a
//! panic, never an unbounded allocation, never a hang. The limits in `encastra-project` are what
//! make that true; this is what looks for the input they forgot.

#![no_main]

use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    // The result is deliberately ignored. A refusal is a correct answer and so is a project;
    // what is being tested is that an answer arrives at all.
    let _ = encastra_project::Project::from_bytes(data);
});
