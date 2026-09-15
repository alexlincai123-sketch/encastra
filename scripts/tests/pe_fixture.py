"""A minimal PE32+ image, built byte by byte, for tests that need a real executable layout.

Two sections (`.text`, executable; `.rdata`, data), one debug directory entry carrying a
CodeView RSDS record, and a payload string in `.rdata`. Small enough to reason about, complete
enough that Windows' own `Get-AuthenticodeSignature` answers `NotSigned` for it rather than
`UnknownError` — which is what it says for a file that is not an image at all.
"""

from __future__ import annotations

import struct

FILE_ALIGN = 0x200
SECTION_ALIGN = 0x1000


def _pad(data: bytes, size: int) -> bytes:
    return data + b"\0" * (size - len(data))


def build(
    *,
    timestamp: int = 0,
    guid: bytes = b"\x00" * 16,
    code: bytes = b"\xc3",
    payload: bytes = b"",
    pdb: bytes = b"fixture.pdb",
) -> bytes:
    """Returns the bytes of an image whose named fields are as given."""
    assert len(guid) == 16
    text_rva, rdata_rva = 0x1000, 0x2000
    text_raw, rdata_raw = 0x400, 0x600

    # .rdata: debug directory entry at its start, RSDS record after it, then the payload.
    rsds = b"RSDS" + guid + struct.pack("<I", 1) + pdb + b"\0"
    debug_entry = struct.pack(
        "<IIHHIIII",
        0,  # Characteristics
        timestamp,  # TimeDateStamp
        0,
        0,  # major/minor
        2,  # IMAGE_DEBUG_TYPE_CODEVIEW
        len(rsds),
        rdata_rva + 28,  # AddressOfRawData
        rdata_raw + 28,  # PointerToRawData
    )
    rdata = debug_entry + rsds + payload
    text = code

    dos = b"MZ" + b"\0" * 58 + struct.pack("<I", 0x40)
    coff = struct.pack(
        "<HHIIIHH",
        0x8664,  # AMD64
        2,  # sections
        timestamp,
        0,
        0,
        240,  # PE32+ optional header size
        0x0022,  # EXECUTABLE_IMAGE | LARGE_ADDRESS_AWARE
    )
    optional = struct.pack(
        "<HBBIIIIIQIIHHHHHHIIIIHHQQQQII",
        0x20B,  # PE32+
        14,
        0,  # linker version
        FILE_ALIGN,  # SizeOfCode
        FILE_ALIGN,  # SizeOfInitializedData
        0,
        text_rva,  # AddressOfEntryPoint
        text_rva,  # BaseOfCode
        0x140000000,  # ImageBase
        SECTION_ALIGN,
        FILE_ALIGN,
        6,
        0,  # OS version
        0,
        0,  # image version
        6,
        0,  # subsystem version
        0,  # Win32VersionValue
        rdata_rva + SECTION_ALIGN,  # SizeOfImage
        FILE_ALIGN,  # SizeOfHeaders
        0,  # CheckSum
        3,  # subsystem: console
        0x8160,  # DllCharacteristics
        0x100000,
        0x1000,
        0x100000,
        0x1000,
        0,
        16,  # NumberOfRvaAndSizes
    )
    directories = [(0, 0)] * 16
    directories[6] = (rdata_rva, 28)  # debug directory
    optional += b"".join(struct.pack("<II", rva, size) for rva, size in directories)
    assert len(optional) == 240

    def section(name: bytes, rva: int, raw: int, data: bytes, chars: int) -> bytes:
        return _pad(name, 8) + struct.pack(
            "<IIIIIIHHI", len(data), rva, FILE_ALIGN, raw, 0, 0, 0, 0, chars
        )

    table = section(b".text", text_rva, text_raw, text, 0x60000020) + section(
        b".rdata", rdata_rva, rdata_raw, rdata, 0x40000040
    )
    headers = _pad(dos + b"PE\0\0" + coff + optional + table, text_raw)
    return headers + _pad(text, FILE_ALIGN) + _pad(rdata, FILE_ALIGN)
