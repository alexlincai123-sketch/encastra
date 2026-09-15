//! The address parser behind a `net.http` grant.
//!
//! Hand-rolled on purpose — a URL crate whose reading might differ from the one making the
//! request would be a way to reach a host nobody allowed — which means every odd string is this
//! code's problem rather than a well-worn library's. Slicing, `split_once`, bracket matching and
//! an integer parse are each a way to panic on input nobody pictured.
//!
//! Beyond not crashing, the output has to be usable as an allowlist key. An authority that is
//! not lowercased would make two spellings of one host into two different grants; one still
//! carrying a path or userinfo would make the comparison mean something other than the host.
//! Those are asserted here, so the fuzzer hunts for a wrong answer and not only for a crash.

#![no_main]

use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    let Ok(address) = std::str::from_utf8(data) else {
        return;
    };

    if let Some(authority) = encastra_builtins::permission_authority(address) {
        assert!(!authority.is_empty(), "{address:?} produced an empty authority");
        assert_eq!(
            authority,
            authority.to_ascii_lowercase(),
            "{address:?} produced an authority that is not lowercased"
        );
        assert!(
            !authority.contains('/') && !authority.contains('@') && !authority.contains('?'),
            "{address:?} produced {authority:?}, which carries more than an authority"
        );
    }
});
