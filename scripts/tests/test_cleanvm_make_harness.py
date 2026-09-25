"""scripts/cleanvm/make_harness.py: the parts that decide which bytes a disc is allowed to carry."""

from __future__ import annotations

import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "cleanvm"))
import make_harness  # noqa: E402

SETUP = "Encastra_0.5.0-rc.6_x64-setup.exe"


class SumsTests(unittest.TestCase):
    def read(self, text: str) -> dict:
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "SHA256SUMS"
            path.write_text(text)
            return make_harness.read_sums(path)

    def test_both_forms_sha256sum_writes_are_read(self) -> None:
        # release.yml publishes text mode ("  "), candidate.yml writes binary mode (" *"). The rc.6
        # candidate's own SHA256SUMS was refused by the old parser, which only knew the first.
        self.assertEqual(self.read(f"{'a' * 64}  {SETUP}\n"), {SETUP: "a" * 64})
        self.assertEqual(self.read(f"{'b' * 64} *{SETUP}\n"), {SETUP: "b" * 64})

    def test_a_line_in_neither_form_names_nothing(self) -> None:
        for line in (f"{'a' * 63}  {SETUP}", f"{'a' * 64}{SETUP}", f"{'A' * 64}  {SETUP}", f"{SETUP}  {'a' * 64}", ""):
            with self.subTest(line=line):
                self.assertEqual(self.read(line + "\n"), {})


class MarkerTests(unittest.TestCase):
    def test_the_installed_copy_differs_by_the_three_marker_bytes(self) -> None:
        exe = b"MZ" + b"\0" * 10 + make_harness.MARKER_UNK + b"\0" * 10
        out = make_harness.installed_exe_bytes(exe)
        self.assertEqual(sum(1 for x, y in zip(exe, out) if x != y), 3)

    def test_a_marker_that_is_missing_or_doubled_is_refused(self) -> None:
        for exe in (b"MZ" + b"\0" * 20, b"MZ" + make_harness.MARKER_UNK * 2):
            with self.subTest(n=exe.count(make_harness.MARKER_UNK)), self.assertRaises(make_harness.Refused):
                make_harness.installed_exe_bytes(exe)


if __name__ == "__main__":
    unittest.main()
