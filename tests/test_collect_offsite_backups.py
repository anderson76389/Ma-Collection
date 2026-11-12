"""Offline safety tests. No GitHub calls, keys, credentials or real user data."""
import importlib.util
import json
import tempfile
from hashlib import sha256
from pathlib import Path
import unittest

MODULE=Path(__file__).resolve().parents[1]/"scripts"/"collect-offsite-backups.py"
spec=importlib.util.spec_from_file_location("collect_offsite",MODULE)
app=importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

class OfflineBackupTest(unittest.TestCase):
    def test_select_ignores_expired_and_only_matches_correct_name(self):
        entries=[
            {"id":1,"name":"ma-collection-portable","expired":True,
             "created_at":"2026-11-12T00:00:00Z","workflow_run":{"id":9}},
            {"id":2,"name":"ma-collection-portable","expired":False,
             "created_at":"2026-11-11T00:00:00Z","workflow_run":{"id":10}},
            {"id":3,"name":"ma-collection-portable-malicious","expired":False,
             "created_at":"2026-11-13T00:00:00Z","workflow_run":{"id":11}},
        ]
        self.assertEqual(app.choose_artifact(entries,"ma-collection-portable")["id"],2)
        self.assertIsNone(app.choose_artifact(entries,"ma-art-portable-prive"))
        self.assertIsNotNone(app.choose_artifact([
            {"name":"kovelyx-d1-encrypted-backup-123","expired":False,
             "workflow_run":{"id":88},"id":4,"created_at":"2026-11-11"}
        ],"kovelyx-d1-encrypted-backup-"))

    def test_ciphertext_must_match_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            d=Path(tmp);sql=b"x"*1024
            (d/"kovelyx-d1.sql.cms").write_bytes(sql)
            (d/"manifest.json").write_text(json.dumps({
                "validation_status":"passed",
                "encrypted_sha256":sha256(sql).hexdigest(),
                "better_auth_secret_exported":False
            }))
            app.verify_d1(d)
            (d/"kovelyx-d1.sql.cms").write_bytes(b"x"*512+b"y"*512)
            with self.assertRaises(RuntimeError):app.verify_d1(d)

    def test_rejects_secret_export_in_d1_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            d=Path(tmp);cipher=b"x"*1024
            (d/"kovelyx-d1.sql.cms").write_bytes(cipher)
            (d/"manifest.json").write_text(json.dumps({
                "validation_status":"passed","encrypted_sha256":sha256(cipher).hexdigest(),
                "better_auth_secret_exported":True
            }))
            with self.assertRaises(RuntimeError):app.verify_d1(d)

if __name__=="__main__":unittest.main()
