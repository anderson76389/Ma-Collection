#!/usr/bin/env python3
"""Audit strict du HTML réellement exécuté (les exemples commentés sont ignorés).

Vérifie l'existence des JS/CSS/images locales de la page de production, empêche
les URL javascript:, les raccourcis non HTTPS et les imports directs de Kaptain.
Sans réseau ni navigateur, stdlib uniquement.
"""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit, unquote
import sys

ROOT=Path(__file__).resolve().parents[1]
HOSTILE=("kaptain.stream","imkaptain.github.io","api.nuvio.tv")
RESOURCE_TAGS={"script":"src","img":"src","source":"src"}
LOCAL_REL={"stylesheet","icon","preload","modulepreload","apple-touch-icon"}

class SiteParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.urls=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag in RESOURCE_TAGS and a.get(RESOURCE_TAGS[tag]):
            self.urls.append((tag,a[RESOURCE_TAGS[tag]],True))
        elif tag=="link" and a.get("href"):
            rel=str(a.get("rel") or "").lower().split()
            if any(r in LOCAL_REL for r in rel):
                self.urls.append((tag,a["href"],True))
        elif tag=="a" and a.get("href"):
            self.urls.append((tag,a["href"],False))
    handle_startendtag=handle_starttag

def check(root:Path, html:str):
    root=root.resolve()
    parser=SiteParser()
    parser.feed(html)
    issues=[];local=set();remote=set()
    for tag,raw,resource in parser.urls:
        raw=raw.strip()
        if not raw:continue
        if raw.startswith("#"):continue
        try:u=urlsplit(raw)
        except ValueError:issues.append(f"URL invalide {tag}: {raw[:90]}");continue
        protocol=u.scheme.lower()
        if protocol in {"mailto","tel"} and not resource:continue
        if protocol in {"data","blob"} and tag in {"img","source"}:continue
        if protocol not in {"","https"}:
            issues.append(f"Protocole interdit {tag}: {raw[:90]}");continue
        if raw.startswith("//") or raw.startswith("\\\\"):
            issues.append(f"Origine ambiguë {tag}: {raw[:90]}");continue
        if protocol=="https":
            hostname=(u.hostname or "").lower()
            if not hostname or u.username or u.password:
                issues.append(f"URL externe mal formée {tag}");continue
            if any(hostname==h or hostname.endswith("."+h) for h in HOSTILE):
                issues.append(f"Appel actif à un hébergeur non indépendant : {hostname}")
            remote.add(hostname)
            continue
        path=unquote(u.path)
        if path.startswith("/"):
            issues.append(f"Chemin absolu non portable : {path[:100]}");continue
        parts=PurePosixPath(path).parts
        if any(x in {"..","."} for x in parts) or "\\" in path or "\x00" in path:
            issues.append(f"Chemin local non sûr : {path[:100]}");continue
        if not path:continue
        target=root.joinpath(*parts)
        if resource or (tag=="a" and path.lower().endswith((".html",".md",".pdf"))):
            if not target.is_file() or target.is_symlink() or not target.resolve().is_relative_to(root):
                issues.append(f"Ressource locale manquante : {path}")
            local.add(path)
    if not local:issues.append("Aucune ressource statique locale vérifiée")
    return {"local":len(local),"external_hosts":sorted(remote),"issues":issues}

def main():
    result=check(ROOT,(ROOT/"index.html").read_text(encoding="utf-8"))
    print(f"SITE_LINK_AUDIT local={result['local']} external_hosts={len(result['external_hosts'])} issues={len(result['issues'])}")
    for issue in result["issues"]:print("SITE_LINK_ERROR : "+issue)
    if result["issues"]:sys.exit(1)

if __name__=="__main__":main()
