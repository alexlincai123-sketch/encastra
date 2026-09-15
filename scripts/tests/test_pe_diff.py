"""pe_diff tells code apart from the bytes a linker writes for the time of day."""

from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import pe_fixture  # noqa: E402

SCRIPT = HERE.parent / "pe_diff.py"


def run(a: bytes, b: bytes, *flags: str) -> tuple[int, dict]:
    with tempfile.TemporaryDirectory() as tmp:
        pa, pb = pathlib.Path(tmp, "a.exe"), pathlib.Path(tmp, "b.exe")
        pa.write_bytes(a)
        pb.write_bytes(b)
        result = subprocess.run(
            [sys.executable, str(SCRIPT), str(pa), str(pb), "--json", *flags],
            capture_output=True,
            text=True,
        )
        report = json.loads(result.stdout) if result.stdout.startswith("{") else {}
        return result.returncode, report


class PeDiffTests(unittest.TestCase):
    def test_identical_files_are_identical(self) -> None:
        image = pe_fixture.build(timestamp=7, guid=b"\x07" * 16)
        code, report = run(image, image)
        self.assertEqual(code, 0)
        self.assertTrue(report["identical"])

    def test_timestamps_and_the_pdb_guid_are_metadata_and_debug(self) -> None:
        # The ENC-NEW-18 shape: same program, different clock and GUID.
        a = pe_fixture.build(timestamp=1, guid=b"\x01" * 16)
        b = pe_fixture.build(timestamp=2, guid=b"\x02" * 16)
        code, report = run(a, b)
        self.assertEqual(code, 1)
        self.assertEqual(report["by_class"]["code"], 0)
        self.assertEqual(report["by_class"]["data"], 0)
        self.assertGreater(report["by_class"]["metadata"], 0)
        self.assertGreater(report["by_class"]["debug"], 0)
        names = {d["in"] for d in report["differences"]}
        self.assertIn("COFF TimeDateStamp", names)
        self.assertIn("CodeView RSDS GUID", names)
        self.assertTrue(report["sections"][".text"]["equal"])

    def test_allowing_metadata_and_debug_passes_the_same_program(self) -> None:
        a = pe_fixture.build(timestamp=1, guid=b"\x01" * 16)
        b = pe_fixture.build(timestamp=2, guid=b"\x02" * 16)
        code, _ = run(a, b, "--allow", "metadata,debug")
        self.assertEqual(code, 0)

    def test_a_code_change_is_never_allowed_away(self) -> None:
        a = pe_fixture.build(code=b"\xc3")
        b = pe_fixture.build(code=b"\x90\xc3")
        code, report = run(a, b, "--allow", "metadata,debug")
        self.assertEqual(code, 1)
        self.assertGreater(report["by_class"]["code"], 0)
        self.assertFalse(report["sections"][".text"]["equal"])

    def test_a_data_change_is_data(self) -> None:
        a = pe_fixture.build(payload=b"encastra-build-commit=" + b"a" * 40 + b";")
        b = pe_fixture.build(payload=b"encastra-build-commit=" + b"b" * 40 + b";")
        code, report = run(a, b, "--allow", "metadata,debug")
        self.assertEqual(code, 1)
        self.assertGreater(report["by_class"]["data"], 0)
        self.assertEqual(report["by_class"]["code"], 0)

    def test_a_file_that_is_not_an_image_is_an_error(self) -> None:
        code, _ = run(b"not a PE at all", pe_fixture.build())
        self.assertEqual(code, 2)

    def test_an_unknown_class_is_a_usage_error(self) -> None:
        code, _ = run(pe_fixture.build(), pe_fixture.build(), "--allow", "timestamps")
        self.assertEqual(code, 2)


if __name__ == "__main__":
    unittest.main()
