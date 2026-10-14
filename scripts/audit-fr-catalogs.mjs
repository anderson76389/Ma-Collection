#!/usr/bin/env node
/**
 * Audit exhaustif des intitulés Nuvio des collections individuelles.
 * On ne traduit ni les marques de plateformes ni les noms officiels des chaînes.
 * Aucune URL, image, animation, identifiant ou filtre n'est modifié.
 */
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const fr=JSON.parse(await readFile(join(root,"locales/fr.json"),"utf8"));
const skipped=new Set(["nuvio_mega_collection.json","kaoxt-aio-base-config.json",
  "kaoxt-aio-catalogs.json","metadata.json"]);
const paths=(await readdir(join(root,"collections"))).filter(x=>x.endsWith(".json")&&!skipped.has(x));
const errors=[],untouchedNames=[];
const stats={files:0,categories:0,folders:0,sources:0,catalogSources:0,
  sourceFieldsVerified:0,officialBrandsPreserved:0,missingTranslations:0};
function verify(label, where, sourceType="name") {
  if(typeof label!=="string"||!label.trim()) return;
  if(label==="None" && sourceType==="genre") return; // sentinelle technique AIO
  if(Object.prototype.hasOwnProperty.call(fr,label)){
    const output=fr[label];
    if(typeof output!=="string" || !output.trim())
      errors.push(where+": traduction vide pour "+label);
    if(sourceType==="source" && /(?:\bMovies\b|\bSeries\b|\bTop Rated\b|\bRecent\b|\bWinners\b)/i.test(output))
      errors.push(where+": mélange anglais/français : "+label+" → "+output);
    stats.sourceFieldsVerified++;
    return;
  }
  if(sourceType==="brand"){stats.officialBrandsPreserved++;untouchedNames.push(label);return;}
  errors.push(where+": entrée absente du dictionnaire : "+label);
  stats.missingTranslations++;
}
for(const file of paths) {
  let raw=JSON.parse(await readFile(join(root,"collections",file),"utf8"));
  if(!Array.isArray(raw)||!raw.every(x=>x&&Array.isArray(x.folders)))continue;
  stats.files++;
  for(const c of raw) {
    stats.categories++;
    verify(c.title,file+" / catégorie","source");
    if(c.name)verify(c.name,file+" / catégorie.name","source");
    for(const f of c.folders) {
      stats.folders++;
      // Seuls les noms propres des chaînes (réseaux TV) peuvent être absents
      // du dictionnaire. Les autres dossiers exigent une traduction.
      const brand=c.title==="Networks"?"brand":"source";
      verify(f.title,file+" / "+f.title,brand);
      if(f.name)verify(f.name,file+" / "+f.title+".name",brand);
      for(const kind of ["sources","catalogSources"]) {
        for(const source of f[kind]||[]) {
          stats[kind]++;
          for(const prop of ["title","name","genre"]) {
            if(source[prop])
              verify(source[prop],file+" / "+f.title+" / "+kind+"."+prop,prop==="genre"?"genre":"source");
          }
        }
      }
    }
  }
}
console.log("AUDIT_FR="+JSON.stringify({...stats,noms_officiels_non_traduits:[...new Set(untouchedNames)].sort(),errors:errors.slice(0,60)},null,2));
if(stats.sources<3700||stats.folders<700||stats.categories<19||stats.sourceFieldsVerified<6000)
  errors.push("Inventaire des catalogues incomplet");
if(errors.length){
  console.error("::error::"+errors.length+" problèmes de traduction Nuvio.");
  process.exitCode=1;
}
