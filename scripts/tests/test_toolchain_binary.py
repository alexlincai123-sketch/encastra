"""toolchain.py --check-binary refuses an image a second runner could not reproduce.

Two ways a binary gives its build away: the path of the Cargo registry of the machine that built
it, and a Rich header naming the build of the linker that ran. The second is what made two
`windows-latest` images disagree on candidate 35931433246 (link.exe 14.44.35228 against 35229, the
same MSVC 14.44.35207 toolset directory on both).
"""

from __future__ import annotations

import pathlib
import struct
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import pe_fixture  # noqa: E402

SCRIPT = HERE.parent / "verify" / "toolchain.py"
PE_HEADERS = 4 + 20 + 240 + 2 * 40  # signature, COFF, PE32+ optional header, two section headers


def with_rich_header(image: bytes, records: list[tuple[int, int, int]], key: int = 0x1234ABCD) -> bytes:
    """The fixture image with a Rich header between the DOS header and the PE signature."""
    rich = struct.pack("<IIII", 0x536E6144 ^ key, key, key, key)
    for product, build, count in records:
        rich += struct.pack("<II", ((product << 16) | build) ^ key, count ^ key)
    rich += b"Rich" + struct.pack("<I", key)
    rich += b"\0" * (-len(rich) % 16)
    e_lfanew = 0x80 + len(rich)
    dos = bytearray(image[:0x40])
    dos[0x3C:0x40] = struct.pack("<I", e_lfanew)
    headers = bytes(dos) + b"\0" * (0x80 - 0x40) + rich + image[0x40 : 0x40 + PE_HEADERS]
    assert len(headers) <= pe_fixture.FILE_ALIGN * 2
    return headers + b"\0" * (0x400 - len(headers)) + image[0x400:]


def check(image: bytes) -> subprocess.CompletedProcess:
    with tempfile.TemporaryDirectory() as tmp:
        path = pathlib.Path(tmp, "encastra-desktop.exe")
        path.write_bytes(image)
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--check-binary", str(path)],
            capture_output=True,
            text=True,
        )


class CheckBinary(unittest.TestCase):
    def test_an_image_without_a_rich_header_passes(self):
        result = check(pe_fixture.build())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("has no Rich header", result.stdout)

    def test_an_image_with_a_rich_header_is_refused_and_the_linker_build_named(self):
        image = with_rich_header(pe_fixture.build(), [(260, 35207, 13), (258, 35229, 1)])
        result = check(image)
        self.assertEqual(result.returncode, 1)
        self.assertIn("Rich header", result.stderr)
        self.assertIn("product 258 build 35229 x1", result.stderr)

    def test_a_rich_header_whose_records_cannot_be_read_is_still_refused(self):
        image = bytearray(with_rich_header(pe_fixture.build(), [(258, 35228, 1)]))
        dans = image.find(struct.pack("<I", 0x536E6144 ^ 0x1234ABCD))
        image[dans : dans + 4] = b"\0\0\0\0"
        result = check(bytes(image))
        self.assertEqual(result.returncode, 1)
        self.assertIn("undecodable", result.stderr)

    def test_the_rich_header_check_does_not_replace_the_registry_path_check(self):
        image = pe_fixture.build(payload=b"C:\\Users\\someone\\.cargo\\registry\\src\\x.rs\0")
        result = check(image)
        self.assertEqual(result.returncode, 1)
        self.assertIn("names the machine that built it", result.stderr)

    def test_the_string_rich_after_the_pe_signature_is_not_a_rich_header(self):
        result = check(pe_fixture.build(payload=b"Rich text\0"))
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
