#!/usr/bin/env python3
"""Says exactly how two Windows executables differ, in the vocabulary of the PE format.

Two builds of one commit are supposed to be the same bytes. When they are not, "the hashes
differ" is not a finding — it says nothing about whether code changed, data changed, or the
linker wrote the time of day into a header. This reads both files as PE images and reports every
differing byte by the structure it lives in:

    code      a byte inside an executable section
    data      a byte inside a non-executable section (initialised data, resources, ...)
    debug     the debug directory, or the CodeView (RSDS) record it points at: PDB GUID, age, path
    metadata  the COFF timestamp, the optional header's checksum, or another header field
    header    anything else in the headers or between sections

It exits 0 when the files are identical, 1 when they differ, 2 when a file is not a PE image.
`--allow metadata,debug` exits 0 as long as every difference is in the named classes — for a
build system that has not yet been made deterministic, that is the check that the *program*
is the same even when the *file* is not. Nothing here rewrites a file.

Usage:
    python scripts/pe_diff.py A.exe B.exe
    python scripts/pe_diff.py A.exe B.exe --allow metadata,debug
    python scripts/pe_diff.py A.exe B.exe --json

No third-party module: what is needed of the format fits in a page, and a check of the release
should not itself pull in a dependency at release time.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import struct
import sys

CODE = "code"
DATA = "data"
DEBUG = "debug"
METADATA = "metadata"
HEADER = "header"
CLASSES = (CODE, DATA, DEBUG, METADATA, HEADER)

IMAGE_SCN_CNT_CODE = 0x00000020
IMAGE_SCN_MEM_EXECUTE = 0x20000000
IMAGE_DEBUG_TYPE_CODEVIEW = 2
DEBUG_ENTRY_SIZE = 28
DATA_DIRECTORY_DEBUG = 6


class NotPE(ValueError):
    pass


class Region:
    """A span of the file with a name and a class, so a differing offset can be described."""

    __slots__ = ("start", "end", "name", "kind")

    def __init__(self, start: int, end: int, name: str, kind: str) -> None:
        self.start, self.end, self.name, self.kind = start, end, name, kind

    def __contains__(self, offset: int) -> bool:
        return self.start <= offset < self.end


class Image:
    """The parts of a PE image this tool needs, read from bytes and never written back."""

    def __init__(self, raw: bytes, label: str) -> None:
        self.raw = raw
        self.label = label
        if len(raw) < 0x40 or raw[:2] != b"MZ":
            raise NotPE(f"{label}: no MZ header")
        (pe_offset,) = struct.unpack_from("<I", raw, 0x3C)
        if raw[pe_offset : pe_offset + 4] != b"PE\0\0":
            raise NotPE(f"{label}: no PE signature at {pe_offset:#x}")
        self.pe = pe_offset
        coff = pe_offset + 4
        (
            self.machine,
            self.section_count,
            self.timestamp,
            _symtab,
            _nsyms,
            self.optional_size,
            _chars,
        ) = struct.unpack_from("<HHIIIHH", raw, coff)
        self.optional = coff + 20
        (magic,) = struct.unpack_from("<H", raw, self.optional)
        self.plus = magic == 0x20B
        if magic not in (0x10B, 0x20B):
            raise NotPE(f"{label}: optional header magic {magic:#x}")
        # CheckSum is at the same offset in PE32 and PE32+; the data directories are not.
        self.checksum_offset = self.optional + 64
        directories = self.optional + (112 if self.plus else 96)
        self.debug_rva, self.debug_size = struct.unpack_from(
            "<II", raw, directories + DATA_DIRECTORY_DEBUG * 8
        )
        self.sections: list[tuple[str, int, int, int, int, int]] = []
        table = self.optional + self.optional_size
        for i in range(self.section_count):
            entry = table + i * 40
            name = raw[entry : entry + 8].rstrip(b"\0").decode("latin-1")
            vsize, va, rsize, rptr, _, _, _, _, chars = struct.unpack_from("<IIIIIIHHI", raw, entry + 8)
            self.sections.append((name, va, vsize, rptr, rsize, chars))
        self.section_table_end = table + self.section_count * 40

    def rva_to_offset(self, rva: int) -> int | None:
        for _name, va, vsize, rptr, rsize, _ in self.sections:
            if va <= rva < va + max(vsize, rsize):
                return rptr + (rva - va)
        return None

    def regions(self) -> list[Region]:
        """Every span this tool can name, most specific first, so lookup takes the first hit."""
        found: list[Region] = []
        coff = self.pe + 4
        found.append(Region(coff + 4, coff + 8, "COFF TimeDateStamp", METADATA))
        found.append(Region(self.checksum_offset, self.checksum_offset + 4, "OptionalHeader.CheckSum", METADATA))

        if self.debug_size and (start := self.rva_to_offset(self.debug_rva)) is not None:
            count = self.debug_size // DEBUG_ENTRY_SIZE
            for i in range(count):
                entry = start + i * DEBUG_ENTRY_SIZE
                _, ts, _, _, kind, size, _, ptr = struct.unpack_from("<IIHHIIII", self.raw, entry)
                found.append(Region(entry + 4, entry + 8, f"DebugDirectory[{i}].TimeDateStamp (type {kind})", DEBUG))
                found.append(Region(entry, entry + DEBUG_ENTRY_SIZE, f"DebugDirectory[{i}] (type {kind})", DEBUG))
                if kind == IMAGE_DEBUG_TYPE_CODEVIEW and ptr and self.raw[ptr : ptr + 4] == b"RSDS":
                    found.append(Region(ptr + 4, ptr + 20, "CodeView RSDS GUID", DEBUG))
                    found.append(Region(ptr + 20, ptr + 24, "CodeView RSDS age", DEBUG))
                    found.append(Region(ptr + 24, ptr + size, "CodeView RSDS PDB path", DEBUG))
                elif ptr:
                    found.append(Region(ptr, ptr + size, f"DebugDirectory[{i}] payload (type {kind})", DEBUG))

        for name, _va, _vsize, rptr, rsize, chars in self.sections:
            executable = bool(chars & (IMAGE_SCN_CNT_CODE | IMAGE_SCN_MEM_EXECUTE))
            found.append(Region(rptr, rptr + rsize, f"section {name}", CODE if executable else DATA))

        found.append(Region(0, self.section_table_end, "headers", HEADER))
        return found

    def section_hashes(self) -> dict[str, str]:
        return {
            name: hashlib.sha256(self.raw[rptr : rptr + rsize]).hexdigest()
            for name, _va, _vsize, rptr, rsize, _ in self.sections
        }


def classify(image: Image, offset: int) -> tuple[str, str]:
    for region in image.regions():
        if offset in region:
            return region.name, region.kind
    return "outside every section (overlay)", HEADER


def runs(a: bytes, b: bytes) -> list[tuple[int, int]]:
    """Maximal runs of differing offsets over the common length, as (start, end)."""
    out: list[tuple[int, int]] = []
    limit = min(len(a), len(b))
    i = 0
    while i < limit:
        if a[i] == b[i]:
            i += 1
            continue
        start = i
        while i < limit and a[i] != b[i]:
            i += 1
        out.append((start, i))
    if len(a) != len(b):
        out.append((limit, max(len(a), len(b))))
    return out


def compare(path_a: pathlib.Path, path_b: pathlib.Path) -> dict:
    raw_a, raw_b = path_a.read_bytes(), path_b.read_bytes()
    image_a = Image(raw_a, str(path_a))
    image_b = Image(raw_b, str(path_b))

    differences = []
    for start, end in runs(raw_a, raw_b):
        name, kind = classify(image_a, start)
        differences.append(
            {
                "offset": start,
                "length": end - start,
                "in": name,
                "class": kind,
                "a": raw_a[start:end][:32].hex(),
                "b": raw_b[start:end][:32].hex(),
            }
        )

    by_class = {kind: sum(d["length"] for d in differences if d["class"] == kind) for kind in CLASSES}
    hashes_a, hashes_b = image_a.section_hashes(), image_b.section_hashes()
    return {
        "a": {"path": str(path_a), "size": len(raw_a), "sha256": hashlib.sha256(raw_a).hexdigest(),
              "timestamp": image_a.timestamp},
        "b": {"path": str(path_b), "size": len(raw_b), "sha256": hashlib.sha256(raw_b).hexdigest(),
              "timestamp": image_b.timestamp},
        "identical": raw_a == raw_b,
        "sections": {
            name: {"a": hashes_a.get(name), "b": hashes_b.get(name), "equal": hashes_a.get(name) == hashes_b.get(name)}
            for name in dict.fromkeys([*hashes_a, *hashes_b])
        },
        "differing_bytes": sum(d["length"] for d in differences),
        "by_class": by_class,
        "differences": differences,
    }


def render(report: dict) -> str:
    lines = [
        f"A: {report['a']['path']}  {report['a']['size']} bytes  sha256 {report['a']['sha256']}",
        f"B: {report['b']['path']}  {report['b']['size']} bytes  sha256 {report['b']['sha256']}",
    ]
    if report["identical"]:
        lines.append("Identical.")
        return "\n".join(lines)
    lines.append(f"Differing bytes: {report['differing_bytes']} in {len(report['differences'])} run(s)")
    lines.append("By class: " + ", ".join(f"{k} {v}" for k, v in report["by_class"].items() if v))
    lines.append("")
    lines.append("Sections:")
    for name, entry in report["sections"].items():
        lines.append(f"  {name:<10} {'same' if entry['equal'] else 'DIFFERENT'}")
    lines.append("")
    lines.append("Runs:")
    for d in report["differences"]:
        lines.append(
            f"  {d['offset']:#010x} +{d['length']:<6} {d['class']:<9} {d['in']}"
            f"\n      A {d['a']}\n      B {d['b']}"
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("a", type=pathlib.Path)
    parser.add_argument("b", type=pathlib.Path)
    parser.add_argument(
        "--allow",
        default="",
        help="comma-separated classes whose differences do not fail the check (e.g. metadata,debug)",
    )
    parser.add_argument("--json", action="store_true", help="print the full report as JSON")
    args = parser.parse_args()

    allowed = {kind.strip() for kind in args.allow.split(",") if kind.strip()}
    unknown = allowed - set(CLASSES)
    if unknown:
        print(f"unknown class in --allow: {', '.join(sorted(unknown))}; choose from {', '.join(CLASSES)}", file=sys.stderr)
        return 2

    try:
        report = compare(args.a, args.b)
    except NotPE as error:
        print(str(error), file=sys.stderr)
        return 2

    print(json.dumps(report, indent=2) if args.json else render(report))
    if report["identical"]:
        return 0
    disallowed = {kind for kind, n in report["by_class"].items() if n and kind not in allowed}
    return 1 if disallowed else 0


if __name__ == "__main__":
    raise SystemExit(main())
