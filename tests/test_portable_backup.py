"""Offline regression tests for portable backup, integrity and restoration."""
import tempfile
import unittest
from pathlib import Path
import subprocess
import sys
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from portable_backup import create, verify, restore


class PortableBackupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "repo"
        self.root.mkdir()
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        (self.root / "src").mkdir()
        (self.root / "src" / "app.js").write_text("window.hello='bonjour';\n")
        (self.root / "media").mkdir()
        (self.root / "media" / "cover.webp").write_bytes(b"\x00\x01\xffTEST-WEBP-ORIGINAL")
        (self.root / ".env").write_text("API_TOKEN=never-export-me\n")
        (self.root / "secrets.json").write_text('{"secret":"not-in-backup"}')
        (self.root / "key.pem").write_text("PRIVATE KEY")
        subprocess.run(["git", "-C", str(self.root), "add", "-A"], check=True)
        self.archive = Path(self.tmp.name) / "portable.zip"

    def tearDown(self):
        self.tmp.cleanup()

    def test_roundtrip_preserves_media_and_excludes_credentials(self):
        manifest = create(self.root, self.archive, "Ma-Art")
        self.assertEqual(manifest["file_count"], 2)
        self.assertEqual(verify(self.archive, "Ma-Art")["file_count"], 2)
        with zipfile.ZipFile(self.archive) as z:
            self.assertEqual(set(z.namelist()), {
                "BACKUP-MANIFEST.json", "src/app.js", "media/cover.webp"
            })
            self.assertNotIn(b"never-export-me", z.read("BACKUP-MANIFEST.json"))
        out = Path(self.tmp.name) / "restored"
        restore(self.archive, out, "Ma-Art")
        self.assertEqual((out / "media" / "cover.webp").read_bytes(),
                         (self.root / "media" / "cover.webp").read_bytes())
        self.assertEqual((out / "src" / "app.js").read_text(),
                         (self.root / "src" / "app.js").read_text())

    def test_tampering_or_duplicate_entry_is_rejected(self):
        create(self.root, self.archive, "Ma-Collection")
        with zipfile.ZipFile(self.archive, "a") as z:
            z.writestr("src/app.js", "malicious modification")
        with self.assertRaises(ValueError):
            verify(self.archive, "Ma-Collection")

    def test_does_not_overwrite_existing_destination_or_archive(self):
        create(self.root, self.archive, "Ma-Collection")
        with self.assertRaises(FileExistsError):
            create(self.root, self.archive, "Ma-Collection")
        out = Path(self.tmp.name) / "notempty"
        out.mkdir()
        (out / "existing.txt").write_text("preserve")
        with self.assertRaises(FileExistsError):
            restore(self.archive, out, "Ma-Collection")
        self.assertEqual((out / "existing.txt").read_text(), "preserve")

    def test_rejects_wrong_project(self):
        create(self.root, self.archive, "Ma-Art")
        with self.assertRaises(ValueError):
            verify(self.archive, "Ma-Collection")


if __name__ == "__main__":
    unittest.main()
