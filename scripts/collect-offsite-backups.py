#!/usr/bin/env python3
"""Copie locale des trois derniers artifacts GitHub validés (aucun secret à saisir).

Prérequis sur le PC : Python 3.10+, GitHub CLI authentifié avec gh auth login.
La clé privée D1 ne quitte jamais le PC et n'est pas nécessaire pour télécharger.
"""
from __future__ import annotations
import argparse, hashlib, json, os, re, shutil, subprocess, sys
from pathlib import Path
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
TARGETS={
 "Ma-Collection":("anderson76389/Ma-Collection","ma-collection-portable","ma-collection-portable.zip"),
 "Ma-Art":("anderson76389/Ma-Art","ma-art-portable-prive","ma-art-portable.zip"),
 "Kovelyx-D1":("anderson76389/Kovelyx","kovelyx-d1-encrypted-backup-","kovelyx-d1.sql.cms")
}
def gh(*args):
    binary=shutil.which("gh")
    if not binary:
        raise RuntimeError("Installer GitHub CLI puis se connecter via gh auth login.")
    proc=subprocess.run([binary,*map(str,args)],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
    if proc.returncode:
        raise RuntimeError("Accès GitHub impossible. Vérifier gh auth status et les dépôts privés.")
    return proc.stdout

def choose_artifact(artifacts,expected):
    exact=not expected.endswith("-")
    valid=[a for a in artifacts
           if (a.get("name")==expected if exact else
               str(a.get("name","")).startswith(expected))
           and a.get("expired") is False and a.get("workflow_run",{}).get("id")]
    return max(valid,key=lambda a:(a.get("created_at",""),int(a["id"]))) if valid else None

def artifact_for(repo,expected):
    """Retrouver le dernier backup réellement réussi, même si un run plus récent a échoué."""
    for page in range(1,11):
        response=json.loads(gh("api",f"repos/{repo}/actions/artifacts?per_page=100&page={page}"))
        artifacts=response.get("artifacts",[])
        if not isinstance(artifacts,list):raise RuntimeError("Liste d'artefacts invalide.")
        candidates=[a for a in artifacts if choose_artifact([a],expected)]
        candidates.sort(key=lambda a:(a.get("created_at",""),int(a["id"])),reverse=True)
        for selected in candidates:
            run_id=int(selected["workflow_run"]["id"])
            run=json.loads(gh("api",f"repos/{repo}/actions/runs/{run_id}"))
            if run.get("status")=="completed" and run.get("conclusion")=="success":
                return selected
        if len(artifacts)<100:break
    return None

def sha_file(path):
    digest=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""):digest.update(block)
    return digest.hexdigest()

def verify_d1(folder):
    sql=folder/"kovelyx-d1.sql.cms"
    report=folder/"manifest.json"
    if not sql.is_file() or not report.is_file():raise RuntimeError("Archive D1 chiffrée incomplète.")
    meta=json.loads(report.read_text(encoding="utf-8"))
    digest=meta.get("encrypted_sha256")
    if meta.get("validation_status")!="passed" or not re.fullmatch(r"[a-f0-9]{64}",str(digest)):
        raise RuntimeError("Manifest D1 invalide ou non vérifié.")
    if sql.stat().st_size<512 or sha_file(sql)!=digest:
        raise RuntimeError("Archive D1 altérée ou tronquée.")
    if meta.get("better_auth_secret_exported") is not False:
        raise RuntimeError("Manifest D1 ne garantit pas l'absence des secrets.")
    # Le déchiffrement réel nécessite la clé privée du propriétaire.
    return meta

def verify_files(folder):
    root=folder.resolve()
    files=[]
    for p in folder.rglob("*"):
        if p.is_symlink() or not p.resolve().is_relative_to(root):
            raise RuntimeError("Lien symbolique ou chemin hors sauvegarde.")
        if p.is_file():files.append(p)
    if not files:raise RuntimeError("Téléchargement vide.")
    return sorted(files)

def collect(destination, allow_missing):
    destination=destination.resolve()
    if destination==ROOT or destination.is_relative_to(ROOT):
        raise RuntimeError("Conserver les sauvegardes HORS du dépôt Git.")
    destination.mkdir(parents=True,exist_ok=True)
    stamp=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out=destination/("ma-collection-secours-"+stamp)
    out.mkdir(exist_ok=False)
    result={"schema":1,"created_utc":datetime.now(timezone.utc).isoformat(),
            "projects":{},"missing":[]}
    sys.path.insert(0,str(ROOT/"scripts"))
    from portable_backup import verify
    for project,(repo,name,filename) in TARGETS.items():
        candidate=artifact_for(repo,name)
        if candidate is None:
            result["missing"].append(project)
            print("ARTIFACT_ABSENT : "+project)
            continue
        folder=out/project
        folder.mkdir()
        run_id=int(candidate["workflow_run"]["id"])
        gh("run","download",str(run_id),"--repo",repo,"--name",
           candidate["name"],"--dir",str(folder))
        files=verify_files(folder)
        if project=="Kovelyx-D1":verify_d1(folder)
        else:verify(folder/filename,project)
        result["projects"][project]={
          "repo":repo,"run_id":run_id,
          "files":[{"name":f.relative_to(folder).as_posix(),"bytes":f.stat().st_size,
                    "sha256":sha_file(f)} for f in files]}
        print("SAUVEGARDE_OK : "+project)
    result["complete"]=not result["missing"]
    (out/"CONTROLE-SAUVEGARDE.json").write_text(
        json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("REPERTOIRE_DE_SECOURS : "+str(out))
    if result["missing"] and not allow_missing:
        raise RuntimeError("Archives manquantes : "+", ".join(result["missing"])+
                           ". Lancer l'export privé Ma-Art puis relancer.")
    return out

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination",required=True,type=Path)
    parser.add_argument("--allow-missing",action="store_true")
    args=parser.parse_args()
    collect(args.destination,args.allow_missing)
if __name__=="__main__":
    try:main()
    except (OSError,RuntimeError,ValueError,json.JSONDecodeError) as err:
        sys.exit("SAUVEGARDE_INCOMPLÈTE : "+str(err))
