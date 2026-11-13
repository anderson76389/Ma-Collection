#!/usr/bin/env python3
"""Vérifie hors connexion l'intégrité d'un lot de secours Ma-Collection/Ma-Art/Kovelyx.

Ne contacte ni GitHub, ni Cloudflare, ni TMDB, ni un fournisseur d'identité.
Le rapport d'empreintes et les archives restent sur le disque choisi.
"""
from __future__ import annotations
import argparse
from datetime import datetime,timezone,timedelta
from pathlib import Path, PurePosixPath
import importlib.util
import json
import re
import sys

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
sys.path.insert(0,str(HERE))
from portable_backup import verify as verify_zip

spec=importlib.util.spec_from_file_location("offsite_collector",HERE/"collect-offsite-backups.py")
collector=importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
TARGETS=collector.TARGETS

def validate_relative(name):
    if not isinstance(name,str) or not name or "\\" in name or ":" in name:
        raise ValueError("Nom de fichier non sûr")
    path=PurePosixPath(name)
    if path.is_absolute() or any(p in ("",".","..") for p in path.parts) or name!=path.as_posix():
        raise ValueError("Chemin de fichier invalide")
    return path

def verify_offsite(folder:Path,*,max_age_days=45,now=None,require_all=True):
    folder=folder.resolve()
    manifest=folder/"CONTROLE-SAUVEGARDE.json"
    if not manifest.is_file() or manifest.is_symlink():
        raise ValueError("Manifeste du secours absent ou non sûr")
    report=json.loads(manifest.read_text(encoding="utf-8"))
    if report.get("schema")!=1 or not isinstance(report.get("projects"),dict):
        raise ValueError("Manifeste du secours incompatible")
    created=datetime.fromisoformat(str(report.get("created_utc","")).replace("Z","+00:00"))
    if created.tzinfo is None:raise ValueError("Horodatage sans fuseau")
    now=now or datetime.now(timezone.utc)
    if created>now+timedelta(minutes=5) or now-created>timedelta(days=max_age_days):
        raise ValueError("Sauvegarde trop ancienne ou datée dans le futur")
    expected=set(TARGETS)
    projects=report["projects"]
    if set(projects)-expected:raise ValueError("Projet inconnu dans le lot")
    missing=expected-set(projects)
    if set(report.get("missing",[]))!=missing:
        raise ValueError("Liste des projets manquants incohérente")
    if bool(report.get("complete"))!=(not missing):
        raise ValueError("État de complétude incohérent")
    if missing and require_all:
        raise ValueError("Sauvegarde incomplète : "+", ".join(sorted(missing)))
    verified={}
    for project in sorted(projects):
        info=projects[project]
        expected_repo,_,expected_filename=TARGETS[project]
        if info.get("repo")!=expected_repo or not isinstance(info.get("files"),list) or not info["files"]:
            raise ValueError("Référence de dépôt ou de fichiers invalide : "+project)
        directory=folder/project
        if directory.is_symlink() or not directory.is_dir():
            raise ValueError("Dossier absent ou lien symbolique : "+project)
        real=directory.resolve()
        listed=set()
        for item in info["files"]:
            name=validate_relative(item.get("name"))
            path=directory.joinpath(*name.parts)
            if name.as_posix() in listed or path.is_symlink() or not path.resolve().is_relative_to(real) or not path.is_file():
                raise ValueError("Fichier manquant ou non sûr : "+project)
            listed.add(name.as_posix())
            digest=item.get("sha256")
            if not isinstance(digest,str) or not re.fullmatch(r"[0-9a-f]{64}",digest) or (
                path.stat().st_size!=item.get("bytes") or collector.sha_file(path)!=digest
            ):
                raise ValueError("Empreinte incorrecte : "+project+"/"+name.as_posix())
        actual={p.relative_to(directory).as_posix() for p in collector.verify_files(directory)}
        if actual!=listed:
            raise ValueError("Fichier inattendu ou disparu : "+project)
        if project=="Kovelyx-D1":
            collector.verify_d1(directory)
        else:
            verify_zip(directory/expected_filename,project)
        verified[project]={"files":len(listed)}
    return {"complete":not missing,"verified_projects":verified,"missing":sorted(missing),
        "created_utc":created.isoformat(),"network_required":False}

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--directory",required=True,type=Path)
    ap.add_argument("--max-age-days",type=int,default=45)
    ap.add_argument("--allow-incomplete",action="store_true")
    args=ap.parse_args()
    if not 1<=args.max_age_days<=3650:ap.error("--max-age-days doit valoir entre 1 et 3650")
    result=verify_offsite(args.directory,max_age_days=args.max_age_days,
                          require_all=not args.allow_incomplete)
    print("SAUVEGARDE_HORS_LIGNE_VERIFIEE "+json.dumps(result,ensure_ascii=False))
if __name__=="__main__":
    try:main()
    except (OSError,ValueError,KeyError,json.JSONDecodeError) as error:
        sys.exit("SAUVEGARDE_HORS_LIGNE_INVALIDE : "+str(error))
