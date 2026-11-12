#!/usr/bin/env python3
"""Prepare a RESTORED copy of Ma-Collection for a new self-controlled media host.

Only replaces the exact Ma-Art origin, preserving all path suffixes and file
bytes apart from that origin. Requires an explicit --apply; the original Git
working tree is protected. Does not transfer images or publish anything.
"""
from __future__ import annotations
import argparse
from pathlib import Path
from urllib.parse import urlsplit
import os
import sys

OLD = "https://ma-art.mailpromahe.workers.dev"
ALLOWED_SUFFIXES = {".html", ".css", ".js", ".mjs", ".json"}
SKIP_DIRS = {"docs", "tests", "scripts", ".github", ".git", "node_modules", ".venv", "__pycache__"}


def new_origin(raw):
    u = urlsplit(raw)
    host = (u.hostname or "").lower()
    if (u.scheme != "https" or not host or u.username or u.password or
        u.path not in ("", "/") or u.query or u.fragment or
        host == "kaptain.stream" or host.endswith(".kaptain.stream") or
        host == "imkaptain.github.io"):
        raise ValueError("Destination requise : origine HTTPS indépendante, sans chemin ni identifiants")
    return "https://" + u.netloc.lower()


def changes(root, replacement):
    root = root.resolve()
    if not (root / "index.html").is_file() or not (root / "collections" / "database.js").is_file():
        raise ValueError("Dossier Ma-Collection restauré invalide")
    found = []
    for p in root.rglob("*"):
        if not p.is_file() or p.is_symlink():
            continue
        rel = p.relative_to(root)
        if any(part in SKIP_DIRS for part in rel.parts) or p.suffix.lower() not in ALLOWED_SUFFIXES:
            continue
        old = p.read_bytes()
        occurrences = old.count(OLD.encode("utf-8"))
        if occurrences:
            found.append((p, occurrences))
    if not found:
        raise ValueError("Aucune URL Ma-Art à modifier : copie déjà migrée ou incomplète")
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path, help="Dossier restauré, jamais le dépôt de production")
    parser.add_argument("--new-origin", required=True, help="Exemple : https://images.exemple.fr")
    parser.add_argument("--apply", action="store_true", help="Appliquer à la copie; sans ce drapeau, audit en lecture seule")
    args = parser.parse_args()
    root = args.root.resolve()
    origin = new_origin(args.new_origin)
    if (root / ".git").exists() and args.apply:
        raise ValueError("Refus de modifier le dépôt Git de production : utiliser une copie restaurée")
    edits = changes(root, origin)
    total = sum(count for _, count in edits)
    print(f"MA_ART_REHOST_PLAN files={len(edits)} url_references={total} new_origin={origin}")
    if args.apply:
        for p, _ in edits:
            content = p.read_bytes().replace(OLD.encode(), origin.encode())
            tmp = p.with_name(p.name + ".rehost-tmp")
            tmp.write_bytes(content)
            os.replace(tmp, p)
        print("MA_ART_REHOST_OK : les chemins des visuels ont été conservés. Tester le nouvel hébergeur avant publication.")
    else:
        print("MODE LECTURE SEULE : ajouter --apply pour modifier exclusivement la copie restaurée.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        sys.exit("ERREUR REHOST : " + str(error))
