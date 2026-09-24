//! Two things the binary has to carry that only the build can know.
//!
//! **Which commit it was built from.** `docs/RELEASE.md` names a commit next to each hash, and
//! until now that name came from `git rev-parse HEAD` at the moment the manifest was written —
//! which is *before* the commit that adds the manifest exists, so the field was one commit
//! behind by construction (ENC-NEW-17). The fix is not to guess better: the binary states the
//! commit it was built from, the manifest reads it out of the binary, and a mismatch between the
//! two is a failure rather than a footnote.
//!
//! **That two builds of the same commit are the same bytes.** The MSVC linker stamps every image
//! with the time of day and gives the PDB record a fresh GUID, so two builds of one commit differed
//! in exactly 24 bytes of metadata and nothing else (ENC-NEW-18) — enough to make "the installer
//! matches the source" unprovable by hash. `/Brepro` makes both deterministic: the timestamps
//! become a hash of the image and the GUID a hash of the PDB contents. It is passed here, as a link
//! argument for this package's binaries, rather than in `RUSTFLAGS` or `.cargo/config.toml`, because
//! an environment variable set by CI overrides both of those silently and the release build is the
//! one place the flag must not be lost.
//!
//! **That two runner images give the same bytes.** The linker also writes a Rich header, a record of
//! the build number of every tool that touched the image — the linker's own included. GitHub services
//! Visual Studio inside the pinned toolset directory, so two `windows-latest` images can both say
//! MSVC 14.44.35207 and still carry `link.exe` 14.44.35228 and 14.44.35229. Candidate 35931433246
//! built on one of each: `.text`, `.data` and `.rsrc` identical, the Rich header one build number
//! apart, and `/Brepro`, which hashes the whole image, carried that into every timestamp and the PDB
//! GUID. `/EMITTOOLVERSIONINFO:NO` leaves the Rich header out. It is undocumented, and a linker that
//! stopped honouring it would keep the header without failing, so `scripts/verify/toolchain.py
//! --check-binary` refuses any image that still has one.

use std::path::{Path, PathBuf};
use std::process::Command;

fn git(root: &Path, args: &[&str]) -> Option<String> {
    let out = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).trim().to_owned())
}

/// The commit the working tree is at, and whether the tree matches it.
///
/// A dirty tree cannot be described by a commit — the bytes that come out were not produced by
/// any commit anybody can check out — so the string says so, and the manifest refuses to describe
/// such a build as a release. Untracked files are ignored: build output and editor state are not
/// source. Without `git` (a source tarball, a checkout with the history removed) the answer is
/// `unknown`, which the manifest also refuses.
fn build_commit(root: &Path) -> String {
    let Some(commit) = git(root, &["rev-parse", "HEAD"]) else {
        return "unknown".to_owned();
    };
    let dirty = git(root, &["status", "--porcelain", "--untracked-files=no"])
        .map(|s| !s.is_empty())
        .unwrap_or(true);
    if dirty {
        format!("{commit}-dirty")
    } else {
        commit
    }
}

/// The files whose change means the commit string above is stale: `HEAD` itself, the ref it
/// points at, and `packed-refs` — resolved through `git`, because in a worktree `.git` is a file
/// and the real directory is elsewhere.
fn rerun_on_git_change(root: &Path) {
    let Some(git_dir) = git(root, &["rev-parse", "--absolute-git-dir"]) else {
        return;
    };
    let git_dir = PathBuf::from(git_dir);
    let mut watch = vec![git_dir.join("HEAD"), git_dir.join("packed-refs")];
    let reference = git(root, &["symbolic-ref", "-q", "HEAD"])
        .and_then(|reference| git(root, &["rev-parse", "--git-path", &reference]));
    if let Some(path) = reference {
        watch.push(PathBuf::from(path));
    }
    for path in watch {
        println!("cargo:rerun-if-changed={}", path.display());
    }
}

fn main() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("cargo sets this"));

    if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
        println!("cargo:rustc-link-arg-bins=/Brepro");
        println!("cargo:rustc-link-arg-bins=/EMITTOOLVERSIONINFO:NO");
    }

    rerun_on_git_change(&manifest_dir);
    println!(
        "cargo:rustc-env=ENCASTRA_BUILD_COMMIT={}",
        build_commit(&manifest_dir)
    );

    tauri_build::build()
}
