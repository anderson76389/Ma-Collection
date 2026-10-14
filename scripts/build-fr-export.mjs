#!/usr/bin/env node
/**
 * Ma-Collection — export Nuvio complet en français.
 * Lit la collection officielle, n'écrit JAMAIS dans les sources ni les médias.
 *
 * node scripts/build-fr-export.mjs --write : régénérer export/nuvio-collection-fr.json
 * node scripts/build-fr-export.mjs --check : valider la dernière génération
 */
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
// Les fichiers individuels sont la source exhaustive des 20 catégories.
// La base web compacte n'en conserve que 16, la variante "mega" 18.
const sourceFolder=join(root,"collections");
const target=join(root,"export/nuvio-collection-fr.json");
const mode=process.argv.includes("--write")?"write":process.argv.includes("--check")?"check":null;
if(!mode|| (process.argv.includes("--write") && process.argv.includes("--check")))
  throw new Error("Utilisation : --write OU --check");
const dict=JSON.parse(await readFile(join(root,"locales/fr.json"),"utf8"));
if(Object.keys(dict).length<2300)throw new Error("Dictionnaire français incomplet");
// Conserver l'ordre de la base du site pour les catégories qui y figurent.
const webDb=await readFile(join(sourceFolder,"database.js"),"utf8");
const webMatch=webDb.match(/^window\.NUVIO_DATABASE\s*=\s*(\[[\s\S]*\]);\s*$/);
if(!webMatch)throw new Error("Base du site invalide");
const webOrder=new Map(JSON.parse(webMatch[1]).map((c,i)=>[c.id,i]));
const ignored=new Set(["metadata.json","nuvio_mega_collection.json",
  "kaoxt-aio-base-config.json","kaoxt-aio-catalogs.json"]);
const files=(await readdir(sourceFolder)).filter(x=>x.endsWith(".json")&&!ignored.has(x)).sort();
const byId=new Map();
let inputCategories=0, deduplicatedFolders=0, deduplicatedSources=0;
for(const file of files) {
  const list=JSON.parse(await readFile(join(sourceFolder,file),"utf8"));
  if(!Array.isArray(list)||!list.every(x=>x&&Array.isArray(x.folders)))continue;
  for(const collection of list){
    inputCategories++;
    // Trois collections originales (Découvrir / Tendances / Pour vous)
    // partagent un même ID Nuvio. Les fusionner sous cet ID plutôt que
    // fabriquer de nouveaux identifiants, ce qui casserait les profils.
    if(!byId.has(collection.id)) {
      byId.set(collection.id,collection);
      continue;
    }
    const target=byId.get(collection.id);
    for(const f of collection.folders) {
      const existing=(target.folders||[]).find(x=>
        (f.id&&x.id===f.id) || x.title===f.title);
      if(!existing) {target.folders.push(f);continue;}
      deduplicatedFolders++;
      for(const key of ["sources","catalogSources"]){
        if(!Array.isArray(existing[key]))existing[key]=[];
        const used=new Set(existing[key].map(x=>
          x.id || x.catalogId || [x.provider,x.title,x.mediaType].join("|")));
        for(const src of f[key]||[]){
          const id=src.id || src.catalogId ||
            [src.provider,src.title,src.mediaType].join("|");
          if(used.has(id)){deduplicatedSources++;continue;}
          existing[key].push(src);used.add(id);
        }
      }
    }
  }
}
const before=[...byId.values()].sort((a,b)=>(webOrder.get(a.id)??1000)-
  (webOrder.get(b.id)??1000)||a.title.localeCompare(b.title,"fr"));
if(inputCategories<20||before.length<18||before.some(c=>!c.id))
  throw new Error("Export incomplet : "+before.length+
    " IDs de catégorie distincts pour "+inputCategories+" sections originales");
console.log("Fusion saine des doublons Nuvio : "+inputCategories+" sections → "+
  before.length+" IDs uniques, "+deduplicatedFolders+" dossiers et "+
  deduplicatedSources+" sources identiques regroupés.");
const data=structuredClone(before);
const translated=(s)=>typeof s==="string"&&Object.prototype.hasOwnProperty.call(dict,s)
  ? dict[s] : s;
const clean=s=>typeof s==="string"
  ? s.replace(/\b(Films|Séries)\s*[-–—:]\s*\1\b/gi,"$1")
    .replace(/\b(Films|Séries)\s*\(\s*\1\s*\)/gi,"$1")
    .replace(/\b(Films|Séries)\s+\1\b/gi,"$1").trim():s;
const tr=s=>clean(typeof translated(s)==="string" ? translated(s)
  .replace(/&(?:amp;)?/g," Et ").replace(/ {2,}/g," ") : translated(s));
const stats={categories:0,dossiers:0,sources:0,catalogSources:0,champs_traduits:0,
  intitulés_introuvables:[],langue:"fr",source:"collections individuelles (20 catégories)"};
function label(obj,key,forced=null){
  if(!obj||typeof obj[key]!=="string"||!obj[key].trim())return;
  const prev=obj[key],next=forced ?? tr(prev);
  if(next!==prev)stats.champs_traduits++;
  obj[key]=next;
}
for(const c of data){
  const rawCategory=before.find(x=>x.id===c.id)?.title||c.title;
  const genre=c.id==="collection-HFTCV0TA"||rawCategory==="Genres";
  const networks=c.id==="27bda92a-f626-4093-a2ba-0a32dc09437a"||rawCategory==="Networks";
  const based=c.id==="collection-BASEDON1"||rawCategory==="Based on";
  stats.categories++;
  label(c,"title");label(c,"name");
  for(const f of c.folders||[]){
    stats.dossiers++;
    let fixed=null;
    if(genre&&f.id==="folder-LCRKWAHO")fixed="Histoire";
    if(networks&&f.id==="folder-I7A4OFK0")fixed="History";
    if(based&&f.id==="folder-BSPLAY01")fixed="Pièces de théâtre";
    label(f,"title",fixed);label(f,"name",fixed);
    for(const key of ["sources","catalogSources"]){
      for(const s of f[key]||[]){
        stats[key]++;
        for(const prop of ["title","name","genre"]){
          if(s[prop]==="None"&&prop==="genre")continue;
          if(typeof s[prop]==="string" && !Object.hasOwn(dict,s[prop]) &&
            !/^https?:/.test(s[prop]) && !stats.intitulés_introuvables.includes(s[prop])){
            stats.intitulés_introuvables.push(s[prop]);
          }
          label(s,prop);
        }
      }
    }
  }
}
function withoutLabels(value){
  if(Array.isArray(value))return value.map(withoutLabels);
  if(value&&typeof value==="object")
    return Object.fromEntries(Object.entries(value)
      .filter(([k])=>!["title","name","genre"].includes(k))
      .map(([k,v])=>[k,withoutLabels(v)]));
  return value;
}
if(JSON.stringify(withoutLabels(data))!==JSON.stringify(withoutLabels(before)))
  throw new Error("Un champ technique, une image, une liste ou un identifiant a été modifié");
if(stats.sources<3500||stats.dossiers<700||stats.champs_traduits<2500)
  throw new Error("Traduction partielle : "+JSON.stringify(stats));
const encoded=JSON.stringify(data,null,2)+"\n";
if(mode==="write"){
  await mkdir(dirname(target),{recursive:true});
  await writeFile(target,encoded,"utf8");
} else {
  const current=await readFile(target,"utf8");
  if(current!==encoded)throw new Error("Export Nuvio FR obsolète : relancer --write");
}
console.log("EXPORT_FR="+JSON.stringify({...stats,intitulés_introuvables:stats.intitulés_introuvables.slice(0,65),taille_o:encoded.length},null,2));
