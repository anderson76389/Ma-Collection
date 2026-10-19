#!/usr/bin/env node
/**
 * Audit complet, hors réseau, de l'indépendance de Ma-Collection vis-à-vis de Kaptain.
 * Parcourt TOUS les fichiers texte suivis par git, y compris archives et catalogues générés.
 * Le chemin /media/imkaptain.github.io/ chez Ma-Art est une étiquette d'archive
 * sur un domaine contrôlé séparément : ce n'est pas une requête à imkaptain.github.io.
 * Aucun secret, aucune mutation des catalogues, aucun appel Internet.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extname, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gitFiles=execFileSync("git",["ls-files","-z"],{cwd:root,encoding:"utf8"})
  .split("\0").filter(Boolean);
const textExtensions=new Set([".json",".js",".mjs",".cjs",".html",".css",".md",".yml",".yaml",".py",".ps1",".txt",".sh",".toml",".xml"]);
const textFiles=gitFiles.filter(p=>textExtensions.has(extname(p).toLowerCase()));
const read=p=>readFileSync(resolve(root,p),"utf8");
const archives=p=>/^Kaptain_.*\.json$/i.test(p)
  || /^collections\/database\.(?:beta|mega\d+)\.js$/i.test(p)
  || /^(?:collections\/nuvio_mega_collection\.json|Kaptain_Mega_Nuvio_Native_.*\.json)$/i.test(p);
const meta=p=>/^(?:README\.md|ROADMAP\.md|docs\/|\.claude\/|\.github\/scripts\/|tests\/|scripts\/audit-|scripts\/media_migration\.py)/i.test(p);
const original=(u)=>{
  let url;
  try{url=new URL(u)}catch{return false;}
  const host=url.hostname.toLowerCase(), pathname=decodeURIComponent(url.pathname).toLowerCase();
  return host==="imkaptain.github.io"
    || /^kaptain[-.]|[-.]kaptain\./.test(host)
    || (["github.com","raw.githubusercontent.com","api.github.com","githubusercontent.com"].includes(host)
       && /(?:^|\/)imkaptain(?:\/|$)/.test(pathname))
    || (host==="api.nuvio.tv" && pathname.includes("kaptain"));
};
const urlPattern=/https?:\/\/[^\s"'<>\\\`)\]}]+/g;
const upstreamActive=[],upstreamArchive=[],upstreamDocs=[],urlCount=new Map();
const suspicious=[];
for(const p of textFiles){
  const body=read(p);
  for(const match of body.matchAll(urlPattern)){
    const raw=match[0].replace(/[.,;]+$/,"");
    let url;
    try{url=new URL(raw)}catch{continue;}
    urlCount.set(url.hostname,(urlCount.get(url.hostname)||0)+1);
    if(!original(raw))continue;
    const occurrence={file:p,host:url.hostname};
    if(archives(p))upstreamArchive.push(occurrence);
    else if(meta(p))upstreamDocs.push(occurrence);
    else upstreamActive.push(occurrence);
  }
  // Ancienne connexion active : elle ne doit pas être chargée par le site.
  if(!meta(p)&&!archives(p)&&/\bNuvioPush\s*\.\s*(?:push|send|import)\s*\(/.test(body))
    suspicious.push({file:p,reason:"ancien appel distant NuvioPush"});
}
const index=read("index.html");
for(const match of index.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)){
  const value=match[1].split("?")[0];
  assert(!value.startsWith("http"),"JavaScript externe chargé par l'accueil : "+value);
  assert(existsSync(resolve(root,value)),"Ressource JavaScript manquante : "+value);
}
const channels=read("collections/test-channels.js");
const localResources=[...channels.matchAll(/\b(?:databaseUrl|templateUrl|aioCatalogsUrl|aioBaseConfigUrl):\s*'([^']+)'/g)]
  .map(m=>m[1]);
for(const p of localResources){
  assert(!p.startsWith("http"),"Canal de test lié à un hébergement externe : "+p);
  assert(existsSync(resolve(root,p)),"Archive du canal de test manquante : "+p);
}
const names=["actors","anime","awards","based_on","by_decade","discover","documentaries",
  "film_collections","for_you_trending_new","genres","international_cinema",
  "kids_and_family","legendary_directors","moods_vibes","networks","reality_tv",
  "spotlight","streaming_services","studios","trending_new"];
const listIds=new Set();
const categories={count:0,folders:0,sources:0,tmdbLists:0,traktLists:0,addons:0,discover:0,specialTmdb:0};
const ownOrigin="ma-art.mailpromahe.workers.dev";
let artOwned=0,externalMedia=0,upstreamMedia=0;
const imgFields=new Set(["coverImageUrl","focusGifUrl","heroBackdropUrl","titleLogoUrl","backdropImageUrl"]);
const walk=(value,fn,k="")=>{
  if(Array.isArray(value)){for(const item of value)walk(item,fn);return;}
  if(!value||typeof value!=="object")return;
  for(const [key,v] of Object.entries(value)){
    if(typeof v==="string")fn(key,v);
    else if(v&&typeof v==="object")walk(v,fn,key);
  }
};
for(const name of names){
  const p="collections/"+name+".json";
  const cats=JSON.parse(read(p));
  assert(Array.isArray(cats)&&cats.length===1,"Catégorie inattendue : "+p);
  categories.count+=cats.length;
  for(const cat of cats)for(const folder of cat.folders||[]){
    categories.folders++;
    walk(folder,(key,value)=>{
      if(!imgFields.has(key) || !/^https?:\/\//.test(value))return;
      const url=new URL(value);
      if(original(value))upstreamMedia++;
      if(url.hostname===ownOrigin)artOwned++;
      else externalMedia++;
    });
    for(const source of folder.sources||[]){
      categories.sources++;
      if(source.provider==="tmdb"&&source.tmdbSourceType==="LIST"){
        categories.tmdbLists++;listIds.add(String(source.tmdbId));
      }else if(source.provider==="trakt")categories.traktLists++;
      else if(source.provider==="addon")categories.addons++;
      else if(source.provider==="tmdb"&&source.tmdbSourceType==="DISCOVER")categories.discover++;
      else if(source.provider==="tmdb"&&["COMPANY","COLLECTION"].includes(source.tmdbSourceType))categories.specialTmdb++;
    }
  }
}
const appDb=read("collections/database.js");
assert(/^\s*window\.NUVIO_DATABASE\s*=\s*\[/.test(appDb),"La base locale de l'accueil a disparu");
assert(index.includes('src="collections/database.js?'),"La page ne charge plus sa base locale");
assert(index.includes('src="collections/test-channels.js?'),"Les canaux locaux ne sont plus chargés");
assert.equal(categories.count,20);
assert.equal(categories.sources,3716);
assert.equal(categories.tmdbLists+categories.traktLists,1007);
assert.equal(categories.addons,13);
assert.equal(categories.discover+categories.specialTmdb+categories.tmdbLists+
  categories.traktLists+categories.addons,categories.sources);
const exceptions=JSON.parse(read("config/medias-externes-historiques.json")).references;
assert.equal(exceptions.length,23,"La liste des exceptions médias a changé; revoir l'audit");
assert.equal(upstreamMedia,0,"Média Kaptain encore actif dans une des 20 collections");
const summary={
  tracked:gitFiles.length,textFiles:textFiles.length,
  scannedChannels:localResources,
  homepageDb:"collections/database.js",
  categories:{...categories,distinctTmdbListIds:listIds.size},
  media:{onMaArt:artOwned,otherProviders:externalMedia,knownExceptions:exceptions.length,fromKaptain:upstreamMedia},
  upstream:{active:upstreamActive.length,optionalHistorical:upstreamArchive.length,creditsAndAudit:upstreamDocs.length,
    activeExamples:upstreamActive.slice(0,12),historicalExamples:upstreamArchive.slice(0,12)},
  otherHosts:[...urlCount.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([host,count])=>({host,count})),
  limitations:[
    "La propriété des 262 listes TMDB et des listes Trakt n'est pas prouvée sans vérifier leurs auteurs avec les API.",
    "Les archives peuvent garder des médias externes; seul le domaine réel de chaque URL compte.",
    "Ce contrôle ne garantit ni la disponibilité future des API ni le contrôle du compte Cloudflare.",
    "Les droits des œuvres et le dépôt de sauvegardes indépendantes ne sont pas couverts."
  ]
};
console.log("AUDIT_KAPTAIN_COMPLET="+JSON.stringify(summary));
if(upstreamActive.length||suspicious.length){
  console.error("DEPENDANCES_ACTIVES_INTERDITES="+JSON.stringify({upstreamActive,suspicious}));
  process.exitCode=1;
}else{
  console.log("AUDIT_KAPTAIN_OK : zéro appel direct aux hébergements Kaptain parmi les fichiers actifs.");
}
