# ADR-0004 — Media crosses the sandbox boundary as a handle, never as bytes or a path

**Status:** accepted · 2026-09-11

## Context

A workflow moves files: images, video, archives. Two obvious designs, both bad.

**Pass a path.** The component receives `"C:/Users/alex/Pictures/a.png"` and opens it. Now the
component can open anything else too, and the security model collapses into string validation
of paths — the exact place path-traversal bugs live. WASI's preopened-directory mechanism is a
better version of this, but it is still the thing that both 2026 `wasmtime` filesystem escapes
needed in order to be exploitable.

**Pass the bytes.** A 4 GB video is copied through the component's linear memory. The cost of
the sandbox boundary now scales with file size, and Wasm's 32-bit memory model makes large
files awkward or impossible.

## Decision

A value of type `file`, `image`, `video`, `audio` or `dir` is an **opaque handle**. The host
owns the underlying path and content. A component receives a handle number and can only:

- `host.open-input(port)` — a stream, if the graph wired something to that port
- `host.create-output(port, hint)` — a stream the host places somewhere it chooses

Handles are scoped to a single run and revoked when it ends. **Components are given no
preopened directory**, so `wasi:filesystem` is not in the default world at all.

## Consequences

**Security.** Path traversal and "read `~/.ssh/id_rsa` instead" are not expressible — not
blocked, *unrepresentable*. A component reaches exactly what the graph wired to its ports.
This is why the two 2026 WASI filesystem CVEs do not reach us: they require a preopened
directory to escape from.

**Performance.** Bulk data never enters linear memory. The boundary cost stops scaling with
file size, which is what makes ADR-0001's sandbox affordable for a media tool.

**Provenance.** The host knows every artifact a run touched and can hash it, which is what
makes the run journal and reproducibility possible.

**Cost.** Every filesystem-shaped operation needs a host call, so the host API surface is
larger than "here is a directory, go". That surface is small, auditable, and in one file —
which is the trade we want. And a component genuinely needing to walk a directory tree must
receive a `dir` handle and use host-mediated enumeration; it is more work for the author than
`std::fs::read_dir`, and that is the point.
