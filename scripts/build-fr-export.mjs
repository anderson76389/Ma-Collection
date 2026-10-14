#!/usr/bin/env node
/**
 * Ma-Collection — export Nuvio complet en français.
 * Lit la collection officielle, n'écrit JAMAIS dans les sources ni les médias.
 *
 * node scripts/build-fr-export.mjs --write : régénérer export/nuvio-collection-fr.json
 * node scripts/build-fr-export.mjs --check : valider la dernière génération
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
// Utiliser la base réellement affichée par le site, et non la variante
// "mega" qui ne contient que 18 catégories dans ce dépôt.
const input=join(root,"collections/database.js");
const target=join(root,"export/nuvio-collection-fr.json");
const mode=process.argv.includes("--write")?"write":process.argv.includes("--check")?"check":null;
if(!mode|| (process.argv.includes("--write") && process.argv.includes("--check")))
  throw new Error("Utilisation : --write OU --check");
const [original,translations]=await Promise.all([
  readFile(input,"utf8"),readFile(join(root,"locales/fr.json"),"utf8")
]);
const match=original.match(/^window\.NUVIO_DATABASE\s*=\s*(\[[\s\S]*\]);\s*$/);
if(!match)throw new Error("Format de collections/database.js inattendu");
const before=JSON.parse(match[1]);
const dict=JSON.parse(translations);
if(!Array.isArray(before) || before.length<19 || Object.keys(dict).length<2300)
  throw new Error("Collection ou dictionnaire français incomplet : catégories="+
    (Array.isArray(before)?before.length:"invalide")+
    ", dictionnaire="+Object.keys(dict).length);
const data=structuredClone(before);
const translated=(s)=>typeof s==="string"&&Object.prototype.hasOwnProperty.call(dict,s)
  ? dict[s] : s;
const clean=s=>typeof s==="string"
  ? s.replace(/\b(Films|Séries)\s*[-–—:]\s*\1\b/gi,"$1")
    .replace(/\b(Films|Séries)\s*\(\s*\1\s*\)/gi,"$1")
    .replace(/\b(Films|Séries)\s+\1\b/gi,"$1").trim():s;
const tr=s=>clean(translated(s));
const stats={categories:0,dossiers:0,sources:0,catalogSources:0,champs_traduits:0,
  intitulés_introuvables:[],langue:"fr",source:"database.js"};
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
if(stats.sources<3700||stats.dossiers<700||stats.champs_traduits<2500)
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
