import test from 'node:test';
import assert from 'node:assert/strict';
import {triageDependencies} from '../scripts/triage-catalogue-dependencies.mjs';
import {readCollections} from '../scripts/tmdb-own-lists.mjs';
import {currentCatalogAudit} from '../scripts/audit-catalogue-provenance.mjs';

test('les sources externes conservent propriétaires et catégories sans migration',()=>{
  const data=new Map([['test.json',[{id:'cat',folders:[{id:'f1',sources:[
    {provider:'tmdb',tmdbSourceType:'LIST',tmdbId:8690687},
    {provider:'trakt',traktListId:42},
    {provider:'addon',addonId:'my-addon',catalogId:'my-cat'}
  ]}]}]]]);
  const baseline=[...data].map(([name,value])=>[name,JSON.stringify(value)]);
  const audit={tmdb:{missing:[8690687]},trakt:{references:1},addons:{references:1}};
  const report=triageDependencies(data,audit);
  assert.equal(report.totalReferences,3);
  assert.equal(report.issues.length,3);
  assert.equal(report.issues[0].type,'tmdb_absente');
  assert.equal(report.counts.addon_tiers,1);
  assert(report.issues.every(x=>x.automaticallyMigrated===false&&x.ownershipVerified===false));
  assert.deepEqual([...data].map(([name,value])=>[name,JSON.stringify(value)]),baseline);
});
test('une divergence d’inventaire Trakt/addons est une erreur, pas un succès silencieux',()=>{
  const map=new Map([['test',[{id:'cat',folders:[{id:'folder',sources:[
    {provider:'trakt',traktListId:42}
  ]}]}]]]);
  assert.throws(()=>triageDependencies(map,{tmdb:{missing:[]},trakt:{references:0},addons:{references:0}}),/Incohérence/);
});
test('l’inventaire complet recense 100 % des dépendances réelles du dépôt',async()=>{
  const p=await currentCatalogAudit();
  const report=triageDependencies(await readCollections(),p);
  assert.equal(report.counts.trakt_tiers,p.trakt.references);
  assert.equal(report.counts.addon_tiers,p.addons.references);
  assert.equal(report.issues.filter(x=>x.type==='tmdb_absente').length,p.tmdb.missing.length);
  assert(report.issues.some(x=>x.id==='8690687'));
  assert.equal(report.autoMigration,false);
});
