#!/usr/bin/env python3
"""Inventaire, sauvegarde binaire et préparation de migration des médias Kaptain.

Aucun appel réseau n'est exécuté par 'audit', 'verify', 'stage' ou 'self-test'.
'backup' télécharge les médias à l'identique sur le disque de l'utilisateur.
'stage' génère un fichier séparé : il ne remplace JAMAIS la base active.
Ne publiez des médias tiers que si vous disposez des droits nécessaires.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path, PurePosixPath
import re
import sys
import tempfile
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "collections" / "database.js"
FIELDS = ("coverImageUrl", "heroBackdropUrl", "titleLogoUrl", "focusGifUrl", "backdropImageUrl")
EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".gifv", ".svg", ".avif", ".bmp", ".mp4", ".webm"}


def read_database(path: Path = SOURCE):
    original = path.read_text(encoding="utf-8")
    match = re.fullmatch(r"\s*window\.NUVIO_DATABASE\s*=\s*(\[.*\]);\s*", original, re.DOTALL)
    if not match:
        raise ValueError(f"Base de données JavaScript non reconnue : {path}")
    return original, json.loads(match.group(1))


def path_for_url(url: str) -> str:
    parsed = urlsplit(url)
    if parsed.scheme not in ("https", "http") or not parsed.hostname:
        raise ValueError(f"URL invalide : {url}")
    ext = PurePosixPath(parsed.path).suffix.lower()
    if ext not in EXTENSIONS:
        ext = ".bin"
    # Nom indépendant des noms, query strings et chemins du tiers.
    token = hashlib.sha256(url.encode("utf-8")).hexdigest()[:24]
    safe_host = re.sub(r"[^a-z0-9.-]", "_", parsed.hostname.lower())
    return f"media/{safe_host}/{token}{ext}"


def inventory(path: Path = SOURCE):
    original, database = read_database(path)
    urls = {}
    refs = 0
    for category in database:
        nodes = [(category, category.get("title", ""), "(catégorie)")]
        nodes.extend((folder, category.get("title", ""), folder.get("title", ""))
                     for folder in category.get("folders", []))
        for node, cat, folder in nodes:
            for field in FIELDS:
                value = node.get(field)
                if not isinstance(value, str) or not value.startswith(("https://", "http://")):
                    continue
                refs += 1
                if value not in urls:
                    urls[value] = {"original_url": value, "path": path_for_url(value),
                                   "references": 0, "categories": set(), "fields": set()}
                item = urls[value]
                item["references"] += 1
                item["categories"].add(cat)
                item["fields"].add(field)
    items = []
    for value in sorted(urls):
        row = urls[value]
        items.append({**row, "categories": sorted(row["categories"]), "fields": sorted(row["fields"])})
    return {
        "schema": 1, "source_sha256": hashlib.sha256(original.encode("utf-8")).hexdigest(),
        "source_path": "collections/database.js",
        "categories": len(database),
        "folders": sum(len(c.get("folders", [])) for c in database),
        "total_references": refs,
        "items": items
    }


def dump_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_manifest(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema") != 1 or not isinstance(data.get("items"), list):
        raise ValueError("Manifeste incompatible ou corrompu")
    return data


def audit(args):
    doc = inventory()
    if args.output:
        dump_json(Path(args.output), doc)
    hosts = Counter(urlsplit(i["original_url"]).hostname for i in doc["items"])
    print(f"Catégories : {doc['categories']} | Dossiers : {doc['folders']}")
    print(f"Références médias : {doc['total_references']} | Fichiers distincts : {len(doc['items'])}")
    for host, count in hosts.most_common():
        print(f"  {host}: {count}")
    if args.output:
        print(f"Manifeste écrit : {args.output}")


def sha256_file(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def transfer(item, destination: Path, max_bytes: int):
    path = destination / item["path"]
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file() and path.stat().st_size > 0:
        return {"path": item["path"], "status": "existing",
                "bytes": path.stat().st_size, "sha256": sha256_file(path)}
    last_error = ""
    for attempt in range(3):
        tmp_path = None
        try:
            req = Request(item["original_url"], headers={"User-Agent": "KaptainMediaBackup/1.0"})
            with urlopen(req, timeout=45) as resp:
                if int(resp.headers.get("Content-Length") or 0) > max_bytes:
                    raise ValueError(f"Fichier supérieur à {max_bytes // (1024 * 1024)} Mio")
                if "text/html" in (resp.headers.get("Content-Type") or "").lower():
                    raise ValueError("Réponse HTML, pas une image")
                with tempfile.NamedTemporaryFile(delete=False, dir=path.parent, suffix=".part") as temp:
                    tmp_path = Path(temp.name)
                    digest = hashlib.sha256()
                    size = 0
                    first = b""
                    while True:
                        chunk = resp.read(1024 * 1024)
                        if not chunk:
                            break
                        if not first:
                            first = chunk[:128].lstrip().lower()
                            if first.startswith((b"<!doctype html", b"<html")):
                                raise ValueError("Page HTML reçue à la place du média")
                        size += len(chunk)
                        if size > max_bytes:
                            raise ValueError(f"Fichier supérieur à {max_bytes // (1024 * 1024)} Mio")
                        temp.write(chunk)
                        digest.update(chunk)
                if size <= 0:
                    raise ValueError("Fichier vide")
                os.replace(tmp_path, path)
                return {"path": item["path"], "status": "downloaded", "bytes": size,
                        "sha256": digest.hexdigest()}
        except (HTTPError, URLError, OSError, ValueError) as exc:
            last_error = str(exc)
            if tmp_path and tmp_path.exists():
                tmp_path.unlink()
            # Sans retenter les erreurs définitives et sans masquer les problèmes.
            if isinstance(exc, HTTPError) and 400 <= exc.code < 500 and exc.code != 429:
                break
            if isinstance(exc, ValueError):
                break
    return {"path": item["path"], "status": "failed", "error": last_error}


def backup(args):
    manifest = load_manifest(Path(args.manifest))
    dest = Path(args.dest).resolve()
    selected = manifest["items"][:args.limit] if args.limit else manifest["items"]
    # La publication n'est pas réalisée : uniquement sauvegarde locale des octets.
    print(f"Sauvegarde de {len(selected)} médias dans {dest}")
    results = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        tasks = {pool.submit(transfer, item, dest, args.max_mb * 1024 * 1024): item for item in selected}
        for n, future in enumerate(as_completed(tasks), 1):
            result = future.result()
            results.append(result)
            if n % 100 == 0 or result["status"] == "failed":
                print(f"{n}/{len(selected)} : {result['status']} {result['path']}")
    report = {"source_sha256": manifest["source_sha256"], "files": sorted(results, key=lambda x: x["path"])}
    dump_json(dest / "media-backup-report.json", report)
    counts = Counter(result["status"] for result in results)
    print(f"Bilan : {dict(counts)} | Octets : {sum(x.get('bytes',0) for x in results)}")
    print(f"Rapport : {dest / 'media-backup-report.json'}")
    if counts["failed"]:
        sys.exit(2)


def verified_files(manifest, dest: Path):
    report_path = dest / "media-backup-report.json"
    known = {}
    if report_path.is_file():
        known = {x["path"]: x for x in json.loads(report_path.read_text(encoding="utf-8")).get("files", [])}
    good, missing, wrong = [], [], []
    for item in manifest["items"]:
        rel = item["path"]
        file = dest / rel
        if not file.is_file() or file.stat().st_size == 0:
            missing.append(rel)
        elif known.get(rel, {}).get("sha256") and sha256_file(file) != known[rel]["sha256"]:
            wrong.append(rel)
        else:
            good.append(rel)
    return good, missing, wrong


def verify(args):
    manifest = load_manifest(Path(args.manifest))
    good, missing, wrong = verified_files(manifest, Path(args.dest))
    print(f"Présents : {len(good)} / {len(manifest['items'])} | Manquants : {len(missing)} | Corrompus : {len(wrong)}")
    for rel in (missing + wrong)[:30]:
        print(f"  NON VÉRIFIÉ : {rel}")
    if missing or wrong:
        sys.exit(2)


def stage(args):
    manifest = load_manifest(Path(args.manifest))
    original, _ = read_database()
    if hashlib.sha256(original.encode("utf-8")).hexdigest() != manifest["source_sha256"]:
        raise ValueError("La base a changé depuis l'inventaire : relancez audit")
    verified, missing, wrong = verified_files(manifest, Path(args.dest))
    if missing or wrong:
        raise ValueError(f"Migration bloquée : {len(missing)} médias manquants, {len(wrong)} corrompus")
    if not args.base_url.startswith("https://"):
        raise ValueError("base-url doit commencer par https://")
    base = args.base_url.rstrip("/")
    staged = original
    for item in manifest["items"]:
        source = json.dumps(item["original_url"], ensure_ascii=False)
        target = json.dumps(base + "/" + item["path"], ensure_ascii=False)
        if source not in staged:
            raise ValueError("Référence manquante dans la base : " + item["original_url"])
        staged = staged.replace(source, target)
    # Vérifier que seuls les champs d'URL média ont changé.
    tmp = Path(args.output)
    tmp.parent.mkdir(parents=True, exist_ok=True)
    tmp.write_text(staged, encoding="utf-8")
    _, transformed = read_database(tmp)
    _, initial = read_database()
    reverse = {base + "/" + item["path"]: item["original_url"] for item in manifest["items"]}
    for c in transformed:
        for node in [c, *c.get("folders", [])]:
            for field in FIELDS:
                if isinstance(node.get(field), str):
                    node[field] = reverse.get(node[field], node[field])
    if transformed != initial:
        tmp.unlink(missing_ok=True)
        raise ValueError("Les contenus autres que les URL média ont été modifiés")
    print(f"Fichier de migration PRÉPARATOIRE : {tmp}")
    print(f"{len(verified)} URL redirigées. La base active n'a PAS été modifiée.")
    print("Ne publiez ce fichier qu'après vérification des droits, de l'hébergement et des URL HTTPS.")


def self_test():
    assert path_for_url("https://example.org/cover.png?a=1").endswith(".png")
    assert path_for_url("https://example.org/f.gifv").endswith(".gifv")
    assert path_for_url("https://example.org/f.gif?x=1") != path_for_url("https://example.org/f.gif?x=2")
    doc = inventory()
    assert doc["categories"] >= 16 and doc["folders"] >= 695
    assert doc["total_references"] >= 2500 and len(doc["items"]) >= 2400
    assert len({x["path"] for x in doc["items"]}) == len(doc["items"])
    for item in doc["items"]:
        assert not Path(item["path"]).is_absolute()
        assert ".." not in Path(item["path"]).parts
        assert all(f in FIELDS for f in item["fields"])
    print(f"TESTS OK : {len(doc['items'])} médias inventoriés, zéro écriture de fichiers sources")


def main():
    parser = argparse.ArgumentParser(description="Sauvegarde et migration maîtrisée des médias de Kaptain Collection")
    sub = parser.add_subparsers(dest="command", required=True)
    x = sub.add_parser("audit", help="Inventorier sans télécharger")
    x.add_argument("--output", help="Fichier JSON du manifeste")
    x.set_defaults(func=audit)
    x = sub.add_parser("backup", help="Télécharger les octets originaux dans un dossier local")
    x.add_argument("--manifest", required=True)
    x.add_argument("--dest", required=True)
    x.add_argument("--workers", type=int, default=4, choices=range(1, 9))
    x.add_argument("--max-mb", type=int, default=100)
    x.add_argument("--limit", type=int, default=0, help="Sauvegarde partielle pour essai")
    x.set_defaults(func=backup)
    x = sub.add_parser("verify", help="Vérifier les fichiers téléchargés")
    x.add_argument("--manifest", required=True)
    x.add_argument("--dest", required=True)
    x.set_defaults(func=verify)
    x = sub.add_parser("stage", help="Préparer une copie de la base avec vos propres URL")
    x.add_argument("--manifest", required=True)
    x.add_argument("--dest", required=True)
    x.add_argument("--base-url", required=True, help="Base HTTPS de votre hébergement autorisé")
    x.add_argument("--output", default="collections/database.media-stage.js")
    x.set_defaults(func=stage)
    sub.add_parser("self-test", help="Tester sans télécharger").set_defaults(func=lambda args: self_test())
    args = parser.parse_args()
    try:
        args.func(args)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        parser.exit(2, f"ERREUR : {exc}\n")


if __name__ == "__main__":
    main()
