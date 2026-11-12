import test from 'node:test';
import assert from 'node:assert/strict';
import {captureDraft} from '../studio-avance-core.mjs';
import {buildRecoveryPackage,validateRecoveryPackage,planRecoveryMerge} from '../studio-recovery-core.mjs';
const catalogue=[{id:'cat-1',title:'Section',folders:[
  {id:'folder-1',title:'Films',coverImageUrl:'https://ma-art.mailpromahe.workers.dev/media/poster.webp',
   sources:[{title:'Source A',provider:'tmdb'}]}
]}];
const selected={'folder-1':{'Source A':true}};
const draft=()=>captureDraft(catalogue,selected,'Salon');
test('Une archive Studio complète conserve les profils et les médias sans aucun secret',()=>{
  const d=draft(),other={...draft(),name:'Mobile'},backup={
    schema:1,id:'backup-mc-123456789',kind:'manual',createdAt:'2026-11-12T00:00:00.000Z',profile:d
  };
  const raw={draft:d,profiles:[other],backups:[backup],theme:'dark',
    apiKey:'PRIVATE_API_SHOULD_NEVER_EXPORT',authorization:'secret',
    frPack:null};
  const result=buildRecoveryPackage(raw,catalogue,new Date('2026-11-12'));
  const encoded=JSON.stringify(result);
  assert(!encoded.includes('PRIVATE_API_SHOULD_NEVER_EXPORT'));
  assert(!encoded.includes('authorization'));
  assert.equal(result.profiles.length,1);
  assert.equal(result.backups.length,1);
  assert.equal(result.draft.sections[0].folders[0].artwork.coverImageUrl,
    'https://ma-art.mailpromahe.workers.dev/media/poster.webp');
  assert.equal(validateRecoveryPackage(JSON.parse(encoded),catalogue).profiles.length,1);
});
test('Les fichiers corrompus ou falsifiés sont refusés',()=>{
  const data=buildRecoveryPackage({draft:draft(),profiles:[],backups:[]},catalogue);
  assert.throws(()=>validateRecoveryPackage({...data,schema:2},catalogue),/incompatible/);
  assert.throws(()=>validateRecoveryPackage({...data,theme:'evil'},catalogue),/Thème/);
  const forged=structuredClone(data);
  forged.draft.sections[0].folders[0].artwork.coverImageUrl='https://kaptain.stream/media/a.webp';
  assert.throws(()=>validateRecoveryPackage(forged,catalogue),/Kaptain|indépendante/);
});
test('Fusion sans perte : préserver les profils existants, rejeter le dépassement',()=>{
  const base=draft(),incoming={...draft(),name:'Salon Modifié',id:base.id};
  const plan=planRecoveryMerge([base],[incoming],10);
  assert.equal(plan.added,1);assert.equal(plan.profiles[0].id,base.id);
  assert.notEqual(plan.profiles[1].id,base.id);
  assert.equal(base.name,'Salon');
  assert.throws(()=>planRecoveryMerge([base],[incoming],1),/Capacité/);
});
test('Historique en double et champs de récupération invalides refusés',()=>{
  const row={schema:1,id:'backup-mc-x',kind:'manual',createdAt:'2026-11-12',profile:draft()};
  assert.throws(()=>buildRecoveryPackage({draft:draft(),backups:[row,row]},catalogue),/double/);
  assert.throws(()=>buildRecoveryPackage({draft:draft(),backups:[{...row,createdAt:'never'}]},catalogue),/Date/);
});
