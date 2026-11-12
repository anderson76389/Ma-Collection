#!/usr/bin/env python3
"""Create, verify and safely restore a *portable* Ma-Collection/Ma-Art archive.

Uses only the Python standard library, no npm/network/cloud credentials.
Archives Git-tracked files without recompression (including the private media
bytes in Ma-Art). Explicit secret/credential files are never included.
A ZIP must be downloaded outside GitHub: Actions artifacts expire.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = "BACKUP-MANIFEST.json"
CHUNK = 1024 * 1024
SECRET_BASENAMES = {
    ".env", ".env.local", ".env.production", ".env.development",
    "credentials.json", "secrets.json", "token.json", "tokens.json",
    "account-config.local.js", "id_rsa", "id_ed25519",
}
SECRET_EXTENSIONS = (".pem", ".p12", ".pfx", ".key", ".keystore", ".jks", ".sqlite", ".sqlite3", ".db")


def safe_name(name: str) -> bool:
    """Only plain relative POSIX paths. No traversal or platform ambiguity."""
    if not name or "\\" in name or "\x00" in name or ":" in name:
        return False
    p = PurePosixPath(name)
    return (not p.is_absolute() and str(p) == name and
            all(part not in ("", ".", "..") for part in p.parts) and
            p.parts[0] != ".git" and name != MANIFEST)


def private_name(name: str) -> bool:
    p = PurePosixPath(name)
    base = p.name.lower()
    return (
        base in SECRET_BASENAMES or base.startswith(".env.") or
        base.endswith(SECRET_EXTENSIONS) or
        any(part.lower() in {"node_modules", ".git", ".venv", "__pycache__", "secrets", "private-keys"}
            for part in p.parts)
    )


def git_files(root: Path) -> list[str]:
    names = subprocess.check_output(
        ["git", "-C", str(root), "ls-files", "-z", "--cached", "--full-name"]
    ).decode("utf-8").split("\x00")
    out = []
    for name in names:
        if not name:
            continue
        if not safe_name(name):
            raise ValueError("Chemin Git non sûr : " + repr(name))
        if private_name(name):
            continue
        path = root.joinpath(*PurePosixPath(name).parts)
        if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(root.resolve()):
            raise ValueError("Fichier Git absent, symbolique ou hors dépôt : " + name)
        out.append(name)
    if not out:
        raise ValueError("Aucun fichier versionné à sauvegarder")
    return sorted(set(out))


def copy_with_digest(source, target):
    sha = hashlib.sha256()
    length = 0
    while True:
        block = source.read(CHUNK)
        if not block:
            break
        target.write(block)
        sha.update(block)
        length += len(block)
    return length, sha.hexdigest()


def create(root: Path, output: Path, project: str):
    root = root.resolve()
    output = output.resolve()
    if output.exists():
        raise FileExistsError("Refus d'écraser la sauvegarde : " + str(output))
    files = git_files(root)
    output.parent.mkdir(parents=True, exist_ok=True)
    index = []
    try:
        with zipfile.ZipFile(output, "w", allowZip64=True) as z:
            for name in files:
                source = root.joinpath(*PurePosixPath(name).parts)
                # ZIP_STORED: original bytes, no image/video recompression.
                with source.open("rb") as reader, z.open(name, "w", force_zip64=True) as writer:
                    length, digest = copy_with_digest(reader, writer)
                index.append({"path": name, "bytes": length, "sha256": digest})
            try:
                commit = subprocess.check_output(
                    ["git", "-C", str(root), "rev-parse", "HEAD"], text=True
                ).strip()
            except subprocess.CalledProcessError:
                commit = None
            meta = {
                "schema": 1, "project": project,
                "created_utc": datetime.now(timezone.utc).isoformat(),
                "git_commit": commit, "algorithm": "SHA-256",
                "compression": "none",
                "file_count": len(index),
                "total_bytes": sum(row["bytes"] for row in index),
                "files": index,
                "notice": "Ne contient pas les secrets, comptes, bases D1 distantes ou profils stockés dans le navigateur.",
            }
            z.writestr(MANIFEST, json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
        verify(output, project)
    except BaseException:
        output.unlink(missing_ok=True)
        raise
    print(f"BACKUP_OK project={project} files={len(index)} bytes={meta['total_bytes']} path={output}")
    return meta


def verify(archive: Path, project: str | None = None):
    with zipfile.ZipFile(archive, "r", allowZip64=True) as z:
        members = z.namelist()
        if len(members) != len(set(members)) or MANIFEST not in members:
            raise ValueError("Archive incomplète ou chemins répétés")
        if any(not safe_name(n) and n != MANIFEST for n in members):
            raise ValueError("Archive avec chemin non sûr")
        meta = json.loads(z.read(MANIFEST))
        if meta.get("schema") != 1 or meta.get("algorithm") != "SHA-256":
            raise ValueError("Manifeste incompatible")
        if project and meta.get("project") != project:
            raise ValueError("Projet inattendu : " + str(meta.get("project")))
        rows = meta.get("files")
        if not isinstance(rows, list) or not rows or len(rows) != meta.get("file_count"):
            raise ValueError("Inventaire vide ou erroné")
        expected = {row["path"] for row in rows}
        if len(expected) != len(rows) or expected != set(members) - {MANIFEST}:
            raise ValueError("Fichiers absents ou supplémentaires")
        total = 0
        for row in rows:
            name = row["path"]
            if not safe_name(name) or private_name(name):
                raise ValueError("Fichier privé ou chemin non sûr : " + name)
            with z.open(name) as stream:
                h = hashlib.sha256()
                n = 0
                while True:
                    block = stream.read(CHUNK)
                    if not block:
                        break
                    h.update(block)
                    n += len(block)
            if n != row.get("bytes") or h.hexdigest() != row.get("sha256"):
                raise ValueError("Fichier corrompu : " + name)
            total += n
        if total != meta.get("total_bytes"):
            raise ValueError("Total d'octets incorrect")
        print(f"BACKUP_VERIFIED project={meta['project']} files={len(rows)} bytes={total}")
        return meta


def restore(archive: Path, destination: Path, project: str | None = None):
    meta = verify(archive, project)
    destination = destination.resolve()
    if destination.exists() and any(destination.iterdir()):
        raise FileExistsError("Choisis un dossier de destination vide")
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive, "r") as z:
        for row in meta["files"]:
            name = row["path"]
            target = destination.joinpath(*PurePosixPath(name).parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.resolve().is_relative_to(destination):
                raise ValueError("Extraction hors du dossier : " + name)
            with z.open(name) as source, target.open("xb") as dest:
                copy_with_digest(source, dest)
        (destination / MANIFEST).write_bytes(z.read(MANIFEST))
    print("RESTORE_OK " + str(destination))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    c = sub.add_parser("create")
    c.add_argument("--output", type=Path, required=True)
    c.add_argument("--project", choices=["Ma-Collection", "Ma-Art"], required=True)
    v = sub.add_parser("verify")
    v.add_argument("--archive", type=Path, required=True)
    v.add_argument("--project", choices=["Ma-Collection", "Ma-Art"])
    r = sub.add_parser("restore")
    r.add_argument("--archive", type=Path, required=True)
    r.add_argument("--dest", type=Path, required=True)
    r.add_argument("--project", choices=["Ma-Collection", "Ma-Art"])
    args = parser.parse_args()
    if args.command == "create":
        create(ROOT, args.output, args.project)
    elif args.command == "verify":
        verify(args.archive, args.project)
    else:
        restore(args.archive, args.dest, args.project)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, zipfile.BadZipFile, subprocess.CalledProcessError, KeyError) as error:
        sys.exit("ERREUR SAUVEGARDE : " + str(error))
