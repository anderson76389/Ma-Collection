#!/usr/bin/env python3
"""Vérifie la migration des visuels Ma-Art avant fusion de la PR.

Ne touche pas au site en production et ne lit aucune clé privée.
Contrôle toutes les différences de médias et vérifie les URL sur Cloudflare.
"""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import re
import subprocess
import time
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

BASE = "https://ma-art.mailpromahe.workers.dev"
FIELDS = {"coverImageUrl", "heroBackdropUrl", "titleLogoUrl", "focusGifUrl", "backdropImageUrl"}
EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".gifv", ".svg", ".avif", ".bmp", ".mp4", ".webm"}
COLLECTIONS = (
    "actors", "anime", "awards", "based_on", "by_decade", "discover", "documentaries",
    "film_collections", "for_you_trending_new", "genres", "international_cinema",
    "kids_and_family", "legendary_directors", "moods_vibes", "networks", "reality_tv",
    "spotlight", "streaming_services", "studios", "trending_new",
)
ROOT = Path(__file__).resolve().parents[1]

def expected_url(original):
    parsed = urlsplit(original)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError("Ancienne URL media inattendue : " + original)
    suffix = PurePosixPath(parsed.path).suffix.lower()
    if suffix not in EXTENSIONS:
        suffix = ".bin"
    digest = hashlib.sha256(original.encode("utf-8")).hexdigest()[:24]
    host = re.sub(r"[^a-z0-9.-]", "_", parsed.hostname.lower())
    return f"{BASE}/media/{host}/{digest}{suffix}"

def read_previous(path):
    return subprocess.check_output(["git", "show", f"origin/main:{path}"], text=True, encoding="utf-8")

def load(path, text):
    if path.endswith(".js"):
        head = "window.NUVIO_DATABASE = "
        if not text.startswith(head) or not text.rstrip().endswith(";"):
            raise ValueError("Structure database.js modifiée")
        text = text[len(head):].rstrip().removesuffix(";")
    return json.loads(text)

replaced = []
def compare(old, new, location="", field=None):
    if old == new:
        return
    if isinstance(old, dict) and isinstance(new, dict):
        if old.keys() != new.keys():
            raise ValueError("Clés JSON modifiées : " + location)
        for k in old:
            compare(old[k], new[k], location + "." + k, k)
        return
    if isinstance(old, list) and isinstance(new, list):
        if len(old) != len(new):
            raise ValueError("Nombre d'éléments modifié : " + location)
        for i, (a, b) in enumerate(zip(old, new)):
            compare(a, b, location + f"[{i}]", field)
        return
    if field in FIELDS and isinstance(old, str) and isinstance(new, str):
        if expected_url(old) != new:
            raise ValueError("Mauvaise correspondance URL : " + location)
        replaced.append(new)
        return
    raise ValueError("Une donnée non média a changé : " + location)

def probe(url):
    for attempt in range(3):
        try:
            req = Request(url, method="HEAD", headers={"User-Agent": "Ma-Collection-URL-Check/1.0"})
            with urlopen(req, timeout=25) as resp:
                if resp.status != 200:
                    return (url, "HTTP " + str(resp.status))
                kind = resp.headers.get("Content-Type", "").lower()
                if not (kind.startswith("image/") or kind.startswith("video/") or kind.startswith("application/octet-stream")):
                    return (url, "Type MIME inattendu: " + kind)
                return None
        except Exception as ex:
            if attempt == 2:
                return (url, str(ex)[:150])
            time.sleep(1 + attempt)
    return (url, "Échec inattendu")

def main():
    paths = [f"collections/{name}.json" for name in COLLECTIONS] + ["collections/database.js"]
    for path in paths:
        old = load(path, read_previous(path))
        new = load(path, (ROOT/path).read_text(encoding="utf8"))
        compare(old, new, path)
    urls = sorted(set(replaced))
    print(f"Validation JSON OK : {len(paths)} fichiers, {len(replaced)} liens remplacés, {len(urls)} URL distinctes.", flush=True)
    if len(replaced) < 2500:
        raise ValueError("Trop peu de liens convertis, migration peut-être incomplète")
    errors = []
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = {pool.submit(probe, u):u for u in urls}
        for i, future in enumerate(as_completed(futures), 1):
            issue = future.result()
            if issue:
                errors.append(issue)
            if i % 250 == 0:
                print(f"Vérifications Cloudflare : {i}/{len(urls)}, erreurs : {len(errors)}", flush=True)
    for url, reason in errors[:40]:
        print("IMAGE NON VALIDÉE", url, reason, flush=True)
    if errors:
        raise SystemExit(f"ÉCHEC : {len(errors)} images non accessibles ou mal servies. Ne pas fusionner.")
    print("SUCCÈS : toutes les URL publiques et toutes les données JSON sont validées.", flush=True)

if __name__ == "__main__":
    main()
