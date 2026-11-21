import test from 'node:test';
import assert from 'node:assert/strict';
import {readProfiles, readProfileHistory} from '../profile-history.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const row = (category,itemKey,payload,deleted=false) => ({category,itemKey,payload,deleted});

test('profiles are read from the Kovelyx account and limited to valid identifiers',async()=>{
  const profiles = await readProfiles(async path => {
    assert.equal(path,'/v1/profiles');
    return Response.json({profiles:[{id,displayName:'Salon'},{id:'invalid',displayName:'Ignoré'}]});
  });
  assert.deepEqual(profiles,[{id,name:'Salon'}]);
});

test('reads paginated history, sorts it, and drops settings, deleted items and private fields',async()=>{
  const first = [
    row('library','old',{id:'tt1',name:'Titre ancien',savedAtEpochMs:1}),
    row('library','gone',{id:'tt2',name:'Titre supprimé'},true),
    row('watch_progress','episode',{title:'Série',parentMetaId:'tt3',seasonNumber:1,episodeNumber:2,lastPositionMs:20,durationMs:100,addonBaseUrl:'https://example.invalid/private'}),
    row('addons','secret',{name:'Ne doit pas apparaître',apiKey:'SECRET'}),
    ...Array.from({length:21},(_,i)=>row('profile_settings',String(i),{}))
  ];
  const offsets = [];
  const result = await readProfileHistory(async path => {
    const url = new URL(path,'https://example.invalid');
    assert.equal(url.pathname,'/v1/sync');
    assert.equal(url.searchParams.get('profileId'),id);
    const offset = Number(url.searchParams.get('offset')); offsets.push(offset);
    return Response.json(offset === 0 ? {items:first,nextOffset:25} : {items:[
      row('library','new',{id:'tt4',name:'Titre récent',savedAtEpochMs:2}),
      row('library','old',{id:'tt1',name:'Titre ancien',savedAtEpochMs:1}),
      row('watched_items','movie',{id:'tt5',name:'Film vu',markedAtEpochMs:3})
    ],nextOffset:null});
  },id);
  assert.deepEqual(offsets,[0,25]);
  assert.deepEqual(result.library.map(x=>x.title),['Titre récent','Titre ancien']);
  assert.equal(result.watched[0].title,'Film vu');
  assert.deepEqual(result.progress[0],{title:'Série',id:'tt3',type:'',season:1,episode:2,updatedAt:null,positionMs:20,durationMs:100,completed:false});
  assert.doesNotMatch(JSON.stringify(result),/SECRET|private|supprimé/);
});

test('rejects a malformed cursor and a refused profile without returning partial results',async()=>{
  await assert.rejects(readProfileHistory(async()=>Response.json({items:[],nextOffset:1}),id),/invalide/);
  await assert.rejects(readProfileHistory(async()=>new Response(null,{status:404}),id),/pas pu lire/);
  await assert.rejects(readProfileHistory(async()=>assert.fail('unexpected request'),'wrong'),/profil Kovelyx valide/);
});
