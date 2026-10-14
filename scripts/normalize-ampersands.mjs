#!/usr/bin/env node
/**
 * Normalisation visible : "&" devient "Et".
 * Aucune modification de src/href/URL, ID, catalogId, filter, artwork, CSS ou JS.
 * Maintient les anciennes clés des dictionnaires pour la rétrocompatibilité.
 * --write : applique ; --check : refuse toute chaîne visible contenant "&".
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const write=process.argv.includes("--write");
if(write===process.argv.includes("--check"))throw new Error("Préciser --write OU --check");
const displayFields=new Set(["title","name","genre","label","subtitle","description","displayName","sectionTitle"]);
const entity=/&(?:amp;)?/g;
const toEt=(s)=>s.replace(entity," Et ").replace(/[\t ]{2,}/g," ").trim();
const stat={files:0,labels:0,aliases:0,unresolved:[],unsafe:[]};
function normalize(obj, file, here="root"){
  if(!obj||typeof obj!=="object")return;
  if(Array.isArray(obj)){
    for(let i=0;i<obj.length;i++)normalize(obj[i],file,here+"["+i+"]");
    return;
  }
  for(const [k,v] of Object.entries(obj)){
    if(typeof v==="string" && displayFields.has(k) && entity.test(v)){
      entity.lastIndex=0;
      if(/^https?:\/\//.test(v)){
        stat.unsafe.push(file+" "+here+"."+k);
        continue;
      }
      const next=toEt(v);
      if(next!==v){
        obj[k]=next;stat.labels++;
      }
    }else if(v&&typeof v==="object")normalize(v,file,here+"."+k);
    entity.lastIndex=0;
  }
}
function checkDisplay(obj,file,here="root"){
  if(!obj||typeof obj!=="object")return;
  if(Array.isArray(obj)){obj.forEach((v,i)=>checkDisplay(v,file,here+"["+i+"]"));return;}
  for(const [k,v] of Object.entries(obj)){
    if(typeof v==="string"&&displayFields.has(k)&&entity.test(v))
      stat.unresolved.push(file+" "+here+"."+k+": "+v.slice(0,100));
    else if(v&&typeof v==="object")checkDisplay(v,file,here+"."+k);
    entity.lastIndex=0;
  }
}
const localePaths=["locales/fr.json","locales/site-fr.json"];
for(const file of localePaths){
  const path=join(root,file);
  const obj=JSON.parse(await readFile(path,"utf8"));
  const source={...obj};
  for(const [key,value]of Object.entries(source)){
    if(typeof value!=="string")continue;
    const out=toEt(value);
    if(out!==value)stat.labels++;
    obj[key]=out;
    const keyAlias=toEt(key);
    if(keyAlias!==key&&!Object.hasOwn(obj,keyAlias)){
      obj[keyAlias]=out;stat.aliases++;
    }
    if(!write && out.includes("&"))stat.unresolved.push(file+" : "+key);
  }
  const encoded=JSON.stringify(obj,null,2)+"\n";
  const original=await readFile(path,"utf8");
  if(write&&stat.labels>beforeLabels&&encoded!==original){await writeFile(path,encoded,"utf8");stat.files++;}
  if(!write&&JSON.stringify(obj)!==JSON.stringify(JSON.parse(original)))
    stat.unresolved.push(file+" : dictionnaire non normalisé");
}
const dir=join(root,"collections");
const files=(await readdir(dir)).filter(x=>x.endsWith(".json")).sort();
for(const file of [...files.map(name=>"collections/"+name),
                   "collections/database.js","manifest.json","manifest-complet.json",
                   "export/nuvio-collection-fr.json"]){
  const path=join(root,file);
  let original;
  try{original=await readFile(path,"utf8");}
  catch(e){if(e.code==="ENOENT")continue;throw e;}
  let prefix="",suffix="",body=original;
  if(file.endsWith("database.js")){
    const m=original.match(/^(window\.NUVIO_DATABASE\s*=\s*)(\[[\s\S]*\])(\s*;\s*)$/);
    if(!m)throw Error("Enveloppe JS inattendue : "+file);
    [prefix,body,suffix]=[m[1],m[2],m[3]];
  }
  let obj;
  try{obj=JSON.parse(body);}
  catch(e){
    if(file.startsWith("collections/"))continue;
    throw new Error("JSON invalide : "+file+" : "+e.message);
  }
  if(file==="collections/metadata.json" || (file.startsWith("collections/")&&!Array.isArray(obj)))continue;
  const beforeLabels=stat.labels;
  if(write)normalize(obj,file);
  else checkDisplay(obj,file);
  const encoded=(prefix?prefix:"")+JSON.stringify(obj,null,2)+(suffix?suffix:"\n");
  if(write&&encoded!==original){await writeFile(path,encoded,"utf8");stat.files++;}
}
if(stat.unsafe.length)throw new Error("Chaînes URL inattendues : "+stat.unsafe.join(", "));
console.log("NORMALISATION_ET="+JSON.stringify(stat));
if(!write&&stat.unresolved.length)throw new Error("Il reste "+stat.unresolved.length+" & visibles : "+stat.unresolved.slice(0,12).join(" | "));
