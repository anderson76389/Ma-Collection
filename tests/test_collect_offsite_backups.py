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

    def test_fallback_to_last_successful_artifact(self):
        entries=[
            {"id":3,"name":"ma-art-portable-prive","expired":False,
             "workflow_run":{"id":30},"created_at":"2026-11-12T12:00:00Z"},
            {"id":2,"name":"ma-art-portable-prive","expired":False,
             "workflow_run":{"id":20},"created_at":"2026-11-11T12:00:00Z"},
            {"id":1,"name":"ma-art-portable-prive","expired":True,
             "workflow_run":{"id":10},"created_at":"2026-11-10T12:00:00Z"}
        ]
        original=app.gh
        called=[]
        def fake_gh(*args):
            called.append(args[-1])
            if "/actions/artifacts?" in args[-1]:
                return json.dumps({"artifacts":entries}).encode()
            if args[-1].endswith("/30"):
                return json.dumps({"status":"completed","conclusion":"failure"}).encode()
            if args[-1].endswith("/20"):
                return json.dumps({"status":"completed","conclusion":"success"}).encode()
            raise AssertionError("Unexpected network request")
        try:
            app.gh=fake_gh
            result=app.artifact_for("owner/private","ma-art-portable-prive")
            self.assertEqual(result["id"],2)
            self.assertEqual(len(called),3)
        finally:
            app.gh=original

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
