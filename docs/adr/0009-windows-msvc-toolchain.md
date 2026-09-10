# ADR-0009 — Windows builds require the MSVC toolchain

**Status:** accepted · 2026-09-11

## Context

Rust on Windows offers `x86_64-pc-windows-msvc` and `x86_64-pc-windows-gnu`. The GNU toolchain
is attractive because MSVC means installing Visual Studio Build Tools — a multi-gigabyte
install that needs elevation, which is a real barrier for a contributor.

## Decision

**MSVC only.** `rust-toolchain.toml` pins `1.98.1` with the default MSVC host.

This is not a preference. Tauri's maintainers state plainly that the GNU toolchain is not
officially supported on Windows, and the issue asking for it — specifically to avoid this
install — was closed as not planned. The concrete breakage is documented: a missing
`WebView2Loader.dll` at runtime, no application icon, and a binary roughly three times larger
(58.8 MB gnu vs 18.5 MB msvc). Nothing in Tauri's CI covers the GNU path, so a build that works
today can break in the next minor release with nobody noticing.

Shipping a desktop app on an unsupported, untested toolchain to save a one-time install would
trade a setup cost for a permanent class of unreproducible bugs.

## Consequence for contributors

The workload's components matter. In `Microsoft.VisualStudio.Workload.VCTools`, both the MSVC
compiler/linker and the Windows SDK are only *Recommended*, not *Required* — so installing the
bare workload yields a toolchain with no `link.exe` and Rust fails to link. Name them:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e `
  --override "--quiet --wait --norestart `
    --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
    --add Microsoft.VisualStudio.Component.Windows11SDK.26100"
```

(`--includeRecommended` also works and is what this repository's setup used; it pulls in CMake,
vcpkg and test tooling that are not needed.)

Roughly 6–7 GB on disk. Microsoft publishes no exact figure; the installer shows the real
number before committing. WebView2 is preinstalled on Windows 11 and on Windows 10 from 1803.

**Verify with a link, not a version string.** `rustc --version` succeeds with no linker
present. In a Git Bash shell the failure is confusing, because GNU coreutils provides a
`link` command that shadows MSVC's `link.exe` and reports `extra operand`. The real check:

```bash
echo 'fn main(){println!("ok");}' > /tmp/t.rs && rustc /tmp/t.rs -o /tmp/t.exe && /tmp/t.exe
```

## Related

macOS and Linux have no equivalent constraint. CI runs all three.
