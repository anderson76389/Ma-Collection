"""Rehosting a restored copy must never alter the original project or media bytes."""
import tempfile
import unittest
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from rehost_ma_art import OLD, changes, new_origin


class RehostTests(unittest.TestCase):
    def test_strict_https_origin(self):
        self.assertEqual(new_origin("https://assets.example.org/"), "https://assets.example.org")
        for item in ("http://assets.example.org", "https://kaptain.stream", "https://art.kaptain.stream",
                     "https://user:pass@assets.example.org", "https://assets.example.org/path",
                     "https://assets.example.org/?q=1"):
            with self.subTest(item=item), self.assertRaises(ValueError):
                new_origin(item)

    def test_recovered_copy_preserves_relative_media_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root/"collections").mkdir()
            (root/"index.html").write_text('<img src="'+OLD+'/media/a.webp">')
            (root/"collections/database.js").write_text(
                'window.NUVIO_DATABASE=[{"image":"'+OLD+'/media/source.gifv"}];')
            (root/"collections/logo.png").write_bytes(b"\x00\xffPRIVATE-MEDIA-UNCHANGED")
            found = changes(root, "https://images.example.org")
            self.assertEqual(sum(n for _, n in found), 2)
            for path, _ in found:
                path.write_bytes(path.read_bytes().replace(OLD.encode(), b"https://images.example.org"))
            self.assertIn("/media/source.gifv", (root/"collections/database.js").read_text())
            self.assertNotIn(OLD, (root/"index.html").read_text())
            self.assertEqual((root/"collections/logo.png").read_bytes(),
                             b"\x00\xffPRIVATE-MEDIA-UNCHANGED")


if __name__ == "__main__":
    unittest.main()
