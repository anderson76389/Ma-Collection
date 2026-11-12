import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {auditCatalogSources} from '../scripts/audit-catalogue-provenance.mjs';
const snap=(id,items)=>({schema:1,original_list_id:id,public:true,items,
  sha256:createHash('sha256').update(JSON.stringify(items)).digest('hex')});
const content=new Map([['sample',[{id:'category',folders:[{id:'folder',sources:[
  {provider:'tmdb',tmdbSourceType:'LIST',tmdbId:42},
  {provider:'trakt',traktListId:1234},
  {provider:'addon',addonId:'my-addon',catalogId:'my-list'},
  {provider:'tmdb',tmdbSourceType:'LIST',tmdbId:42}
]}]}]]]);
test('l’inventaire conserve les sources en place, sans collecte sur Internet',()=>{
  const before=structuredClone([...content]);
  const archives=new Map([[42,snap(42,[{media_type:'movie',media_id:98}])]]);
  const result=auditCatalogSources(content,archives,{expected:1,verified_current:1,failures:[]});
  assert.equal(result.tmdb.references,2);assert.equal(result.tmdb.verified,1);
  assert.equal(result.trakt.references,1);assert.equal(result.trakt.unique,1);
  assert.equal(result.addons.references,1);assert.equal(result.independenceCertified,false);
  assert.deepEqual([...content],before);
  assert.deepEqual(result.risks,[]);
});
test('le SHA-256, doublons et les copies manquantes échouent',()=>{
  const original=snap(42,[{media_type:'tv',media_id:101}]);
  const broken={...original,sha256:'0'.repeat(64)};
  const report=auditCatalogSources(content,new Map([[42,broken]]),{expected:1,verified_current:0,failures:[{list_id:42}]});
  assert.deepEqual(report.tmdb.invalid,[42]);assert(report.risks.length>0);
  const missing=auditCatalogSources(content,new Map(),{expected:1,verified_current:0,failures:[{list_id:42}]});
  assert.deepEqual(missing.tmdb.missing,[42]);
  assert.deepEqual(missing.risks,[]);
});
test('le statut rapporté ne peut pas cacher une archive absente',()=>{
  const result=auditCatalogSources(content,new Map(),{expected:1,verified_current:1,failures:[]});
  assert(result.risks.length>0);
});
