import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, readFile, copyFile, rm, stat } from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
const exec=promisify(execFile);

test("le moteur construit tous les catalogues sans internet, sans toucher aux listes historiques",{
  timeout:90000
},async()=>{
  const temporary=await mkdtemp(join(tmpdir(),"ma-collection-fixture-"));
  const target=join(temporary,"scripts");
  try {
    await mkdir(target,{recursive:true});
    await mkdir(join(temporary,"collections"),{recursive:true});
    await mkdir(join(temporary,"locales"),{recursive:true});
    await copyFile(resolve("locales/fr.json"),join(temporary,"locales/fr.json"));
    for(const file of ["catalog-engine.mjs","catalog-engine-core.mjs","catalog-utils.js"])
      await copyFile(resolve("scripts",file),join(target,file));
    for(const file of (await readdir("collections")).filter(x=>x.endsWith(".json")))
      await copyFile(resolve("collections",file),join(temporary,"collections",file));
    await copyFile(resolve("tests/mock-tmdb.mjs"),join(temporary,"mock-tmdb.mjs"));
    const before=await readFile(join(temporary,"collections/streaming_services.json"),"utf8");
    const {stdout,stderr}=await exec(process.execPath,[
      "--import",join(temporary,"mock-tmdb.mjs"),"scripts/catalog-engine.mjs","--build"
    ],{cwd:temporary,
      timeout:70000,maxBuffer:3000000,
      env:{...process.env,TMDB_API_KEY:"fixture",
        MA_COLLECTION_ENGINE_TEST:"1",CATALOG_ENGINE_DATE:"2026-10-14"}});
    assert.match(stdout,/Publication réussie/);
    assert.equal(stderr.includes("::error::"),false,stderr);
    const essential=JSON.parse(await readFile(join(temporary,"manifest.json"),"utf8"));
    const complete=JSON.parse(await readFile(join(temporary,"manifest-complet.json"),"utf8"));
    const report=JSON.parse(await readFile(join(temporary,"data/catalog-engine/etat.json"),"utf8"));
    const snap=JSON.parse(await readFile(join(temporary,"data/catalog-engine/snapshots.json"),"utf8"));
    assert.ok(complete.catalogs.length>=350, "Catégories intégrales manquantes");
    assert(complete.catalogs.some(x=>x.name.includes("Nouveaux films") ||
      x.name.includes("Nouvelles séries")),
      "L'addon exposé à Nuvio doit avoir ses sous-catégories françaises");
    assert(complete.catalogs.every(x=>!/(?:New Movies|New Series|Recent Series|Popular Movies)/.test(x.name)),
      "Le manifeste expose des intitulés anglais");
    assert(complete.catalogs.every(x=>!x.name.includes("&")), "Un catalogue régénéré contient encore &");
    assert.ok(essential.catalogs.length>=85, "Plateformes, chaînes ou téléréalités absentes");
    assert.ok(report.totaux.saisons>0,"Nouvelles saisons non détectées");
    assert.ok(report.totaux.episodes>0,"Épisodes non détectés");
    assert.ok(report.totaux.episodes_animes_et_telerrealite>0);
    assert.ok(report.totaux.catalogues_services_fr_supplementaires>0);
    assert.equal(report.totaux.tops_netflix_officiels,0,
      "Ne jamais inventer le classement officiel si l'archive est absente");
    assert.equal(snap.region,"FR");
    assert.ok(Object.keys(snap.platforms).length>=12);
    const unique=new Set(complete.catalogs.map(c=>c.type+"/"+c.id));
    assert.equal(unique.size,complete.catalogs.length,"Catalogues dupliqués");
    for(const c of complete.catalogs){
      const destination=join(temporary,"catalog",c.type,c.id+".json");
      assert.ok((await stat(destination)).size>0);
      const data=JSON.parse(await readFile(destination,"utf8"));
      assert.ok(Array.isArray(data.metas));
      for(const meta of data.metas)assert.match(meta.id,/^tmdb:\d+$/);
    }
    assert.equal(await readFile(join(temporary,"collections/streaming_services.json"),"utf8"),before,
      "Les collections originales ne doivent jamais être réécrites");
  } finally {
    await rm(temporary,{recursive:true,force:true});
  }
});
