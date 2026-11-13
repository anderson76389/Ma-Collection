"""Contrôles hors réseau des sauvegardes à conserver hors GitHub/Cloudflare."""
from datetime import datetime,timezone,timedelta
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

ROOT=Path(__file__).resolve().parents[1]
MODULE=ROOT/"scripts"/"verify-offsite-backups.py"
spec=importlib.util.spec_from_file_location("verify_offsite",MODULE)
app=importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)
DIGEST=lambda b:sha256(b).hexdigest()

def fake_zip(path,project):
    b=b"backup sample contents"
    meta={"schema":1,"project":project,"algorithm":"SHA-256",
        "file_count":1,"total_bytes":len(b),
        "files":[{"path":"index.html","bytes":len(b),"sha256":DIGEST(b)}]}
    with zipfile.ZipFile(path,"w") as z:
        z.writestr("index.html",b)
        z.writestr("BACKUP-MANIFEST.json",json.dumps(meta))

def make_lot(folder,now,include=("Ma-Collection","Ma-Art","Kovelyx-D1")):
    folder.mkdir(parents=True,exist_ok=True)
    info={"schema":1,"created_utc":now.isoformat(),"projects":{},"missing":[],
          "complete":len(include)==3}
    for project in include:
        repo,_,filename=app.TARGETS[project]
        p=folder/project
        p.mkdir()
        if project=="Kovelyx-D1":
            payload=b"x"*1024
            (p/filename).write_bytes(payload)
            (p/"manifest.json").write_text(json.dumps({
                "validation_status":"passed",
                "encrypted_sha256":DIGEST(payload),
                "better_auth_secret_exported":False
            }))
        else:fake_zip(p/filename,project)
        info["projects"][project]={
            "repo":repo,"run_id":9,
            "files":[{"name":f.name,"bytes":f.stat().st_size,
                      "sha256":DIGEST(f.read_bytes())}
                     for f in p.iterdir()]
        }
    info["missing"]=sorted(set(app.TARGETS)-set(include))
    (folder/"CONTROLE-SAUVEGARDE.json").write_text(json.dumps(info),encoding="utf-8")
    return info

class VerifyOffsiteTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.now=datetime(2026,11,13,tzinfo=timezone.utc)
        self.info=make_lot(self.root,self.now)

    def test_full_offline_bundle_is_valid(self):
        result=app.verify_offsite(self.root,now=self.now)
        self.assertTrue(result["complete"])
        self.assertEqual(set(result["verified_projects"]),set(app.TARGETS))
        self.assertEqual(result["network_required"],False)

    def test_truncated_zip_is_rejected_even_when_checksum_is_changed(self):
        path=self.root/"Ma-Collection"/"ma-collection-portable.zip"
        path.write_bytes(b"broken")
        for row in self.info["projects"]["Ma-Collection"]["files"]:
            if row["name"]==path.name:
                row["sha256"]=DIGEST(path.read_bytes())
                row["bytes"]=path.stat().st_size
        (self.root/"CONTROLE-SAUVEGARDE.json").write_text(json.dumps(self.info))
        with self.assertRaises((ValueError,zipfile.BadZipFile)):
            app.verify_offsite(self.root,now=self.now)

    def test_missing_project_and_old_backup_are_refused(self):
        self.info=make_lot(Path(self.temp.name)/"partial",self.now,include=("Ma-Collection",))
        with self.assertRaisesRegex(ValueError,"incomplète"):
            app.verify_offsite(self.root/"partial",now=self.now)
        result=app.verify_offsite(self.root/"partial",now=self.now,require_all=False)
        self.assertEqual(result["missing"],["Kovelyx-D1","Ma-Art"])
        with self.assertRaisesRegex(ValueError,"ancienne"):
            app.verify_offsite(self.root,now=self.now+timedelta(days=46))

    def test_unsafe_path_or_extra_file_is_rejected(self):
        self.info["projects"]["Ma-Art"]["files"][0]["name"]="../leak.json"
        (self.root/"CONTROLE-SAUVEGARDE.json").write_text(json.dumps(self.info))
        with self.assertRaises(ValueError):app.verify_offsite(self.root,now=self.now)
        self.info=make_lot(self.root/"another",self.now)
        (self.root/"another"/"Ma-Art"/"extra.txt").write_text("extra")
        with self.assertRaisesRegex(ValueError,"inattendu"):
            app.verify_offsite(self.root/"another",now=self.now)

if __name__=="__main__":
    unittest.main()
