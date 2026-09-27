"""scripts/third_party.py: the licence texts the shipped packages carry are copied, not named."""

from __future__ import annotations

import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import third_party  # noqa: E402


class LicenceTextTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.tmp.name)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def package(self, name: str, files: dict[str, str]) -> pathlib.Path:
        directory = self.root / name
        directory.mkdir()
        (directory / "Cargo.toml").write_text("[package]\n")
        for file, text in files.items():
            (directory / file).write_bytes(text.encode("utf-8"))
        return directory

    def test_licence_files_are_read_with_their_indentation_and_nothing_else(self) -> None:
        directory = self.package("a", {"LICENSE-APACHE": "\n                 Apache License\r\n   Version 2.0\n\n", "README.md": "not a licence"})
        self.assertEqual(third_party.licence_texts(directory), [("LICENSE-APACHE", "                 Apache License\n   Version 2.0")])

    def test_a_text_several_packages_carry_appears_once_with_all_of_them(self) -> None:
        a = self.package("a", {"LICENSE": "MIT text"})
        b = self.package("b", {"LICENSE-MIT": "MIT text"})
        crates = [
            {"name": "a", "version": "1.0.0", "license": "MIT", "manifest_path": str(a / "Cargo.toml")},
            {"name": "b", "version": "2.0.0", "license": "MIT", "manifest_path": str(b / "Cargo.toml")},
        ]
        out = third_party.render_texts(crates, [])
        self.assertEqual(out.count("MIT text"), 1)
        self.assertIn("a 1.0.0 (crate, MIT); b 2.0.0 (crate, MIT)", out)

    def test_a_package_without_a_licence_file_is_listed_not_silently_dropped(self) -> None:
        bare = self.package("bare", {})
        crates = [{"name": "bare", "version": "0.1.0", "license": "MIT", "manifest_path": str(bare / "Cargo.toml")}]
        real = third_party.SUPPLEMENT
        third_party.SUPPLEMENT = self.root / "no-supplement"
        try:
            out = third_party.render_texts(crates, [])
        finally:
            third_party.SUPPLEMENT = real
        self.assertIn("Packages that ship no licence file (1)", out)
        self.assertIn("- bare 0.1.0 (crate, MIT)", out)

    def test_the_upstream_supplement_fills_the_gap_and_says_where_it_came_from(self) -> None:
        bare = self.package("bare", {})
        supplement = self.root / "supplement" / "bare"
        supplement.mkdir(parents=True)
        (supplement / "LICENSE").write_text("Copyright (c) someone")
        (supplement / "SOURCE.txt").write_text("from upstream")
        crates = [{"name": "bare", "version": "0.1.0", "license": "MIT", "manifest_path": str(bare / "Cargo.toml")}]
        real = third_party.SUPPLEMENT
        third_party.SUPPLEMENT = self.root / "supplement"
        try:
            out = third_party.render_texts(crates, [])
        finally:
            third_party.SUPPLEMENT = real
        self.assertIn("Copyright (c) someone", out)
        self.assertNotIn("from upstream\n~~~~", out)
        self.assertIn("text from upstream: docs/third-party-licences/bare/SOURCE.txt", out)
        self.assertNotIn("ship no licence file", out)


if __name__ == "__main__":
    unittest.main()
