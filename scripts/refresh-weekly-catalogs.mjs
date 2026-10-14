#!/usr/bin/env node
/**
 * Ma-Collection : actualise UNIQUEMENT les bornes temporelles des rangées
 * TMDB Discover explicitement nommées nouvelles/récentes.
 * Les listes TMDB/Trakt, Top 10, anciens millésimes et médias sont intacts.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { updateRollingYearFilters, updateRollingWeekFilters } = require("./catalog-utils.js");

const root = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), "..");
const folder = path.join(root, "collections");
const MAIN = "database.js";
const MEGA = "nuvio_mega_collection.json";
const IGNORE = new Set(["metadata.json", "kaoxt-aio-catalogs.json", "kaoxt-aio-base-config.json"]);
const writeMode = process.argv.includes("--write");
const checkMode = process.argv.includes("--check");
if (writeMode === checkMode) throw new Error("Choisir exactement --check OU --write");
const now = process.env.CATALOG_WEEKLY_DATE
  ? new Date(process.env.CATALOG_WEEKLY_DATE + "T12:00:00Z") : new Date();
if (!Number.isFinite(now.getTime()) || now.getUTCFullYear() < 2026 ||
    now.getUTCFullYear() > 2100) throw new Error("Date UTC invalide");

function parse(text, file) {
  let dataText=text;
  if (file===MAIN) {
    const m=text.match(/^window\.NUVIO_DATABASE\s*=\s*(\[[\s\S]*\]);\s*$/);
    if (!m) throw new Error("Enveloppe JavaScript inattendue : "+file);
    dataText=m[1];
  }
  const data=JSON.parse(dataText);
  if (!Array.isArray(data) || !data.every(c=>c && typeof c==="object" &&
       typeof c.id==="string" && Array.isArray(c.folders))) {
    throw new Error("Structure inattendue dans "+file);
  }
  return data;
}
function stableNonTemporal(data) {
  return JSON.stringify(data.map(c=>({
    ...c,
    folders:c.folders.map(f=>({
      ...f,
      sources:(f.sources || []).map(s=>{
        if (s.provider!=="tmdb" || s.tmdbSourceType!=="DISCOVER") return s;
        if (!s.filters || typeof s.filters!=="object") return s;
        const filtered={...s.filters};
        for (const k of ["year","releaseDateGte","firstAirDateGte",
          "release_date.gte","first_air_date.gte","primary_release_date.gte",
          "releaseDateLte","firstAirDateLte","release_date.lte","first_air_date.lte"])
          delete filtered[k];
        return {...s, filters:filtered};
      })
    }))
  })));
}
async function main() {
  const names=[MAIN,MEGA,...(await readdir(folder))
    .filter(n=>n.endsWith(".json") && n!==MEGA && !IGNORE.has(n))];
  const staged=[], report=[];
  for (const file of names) {
    const filename=path.join(folder,file);
    const original=await readFile(filename,"utf8");
    let data;
    try { data=parse(original,file); }
    catch(e) {
      if (/Structure inattendue/.test(e.message) && file!==MAIN && file!==MEGA) continue;
      throw e;
    }
    const invariant=stableNonTemporal(data);
    const beforeCounts=data.map(c=>[c.id,c.folders.length,
       c.folders.reduce((v,f)=>v+(f.sources?.length||0),0)]);
    const annual=updateRollingYearFilters(data,now.getUTCFullYear());
    const weekly=updateRollingWeekFilters(data,now);
    const afterCounts=data.map(c=>[c.id,c.folders.length,
       c.folders.reduce((v,f)=>v+(f.sources?.length||0),0)]);
    if (invariant!==stableNonTemporal(data) ||
        JSON.stringify(beforeCounts)!==JSON.stringify(afterCounts)) {
      throw new Error("Protection des catalogues déclenchée : "+file);
    }
    let generated=original;
    if (annual || weekly) {
      generated=(file===MAIN ? "window.NUVIO_DATABASE = ":"")+
        JSON.stringify(data,null,2)+(file===MAIN?";\n":"\n");
    }
    const changed=generated!==original;
    report.push({file,annual,weekly,changed});
    if (changed) staged.push({filename,generated});
  }
  // Aucun fichier écrit tant que toutes les structures n'ont pas été vérifiées.
  for (const row of report) console.log(
    row.file+": "+row.weekly+" dates récentes, "+row.annual+
    " années glissantes"+(row.changed?" (modifié)":" (inchangé)"));
  console.log("Fichiers vérifiés : "+report.length+" ; fichiers à actualiser : "+staged.length);
  if (writeMode) {
    for (const {filename,generated} of staged) await writeFile(filename,generated,"utf8");
    console.log("Écriture validée, aucune liste ni média modifié.");
  } else {
    console.log("Mode audit : aucun fichier modifié.");
  }
}
main().catch(err=>{console.error("::error::"+err.message);process.exitCode=1});
