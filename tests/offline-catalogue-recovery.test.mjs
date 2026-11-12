import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {buildIndex,createHandler,loadRepositoryIndex} from '../services/catalogue-recovery/server.mjs';

const items=[
  {media_type:'movie',media_id:705861},
  {media_type:'tv',media_id:123},
  {media_type:'movie',media_id:1075794},
  {media_type:'tv',media_id:42},
];
const sha=arr=>createHash('sha256').update(JSON.stringify(arr)).digest('hex');
function fixture(){
  return {
    schema:1,kind:'ma-collection-emergency-tmdb-list-recovery',
    coverage:{tmdb_unique:2,tmdb_references:3,trakt_references:4,addon_references:2},
    tmdb_lists:[{
      original_list_id:8659010,media_count:items.length,
      source_sha256:sha(items),uses:[{source_id:'src-1'}],
      items
    }],
    tmdb_blockers:[{list_id:8690687,references:2,reason:'archive_absente'}]
  };
}

async function start(index){
  const server=createServer(createHandler(index));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server,base:'http://127.0.0.1:'+server.address().port};
}

test('la réponse expose les vrais IDs dans le même ordre et la bonne pagination',async()=>{
  const {server,base}=await start(buildIndex(fixture()));
  try{
    const health=await fetch(base+'/health').then(x=>x.json());
    assert.deepEqual(health.missing,[8690687]);
    assert.equal(health.complete,false);
    assert.equal(health.network_required,false);
    assert.equal(health.artwork_available,false);

    const index=await fetch(base+'/v1/tmdb/lists').then(x=>x.json());
    assert.equal(index.count,1);
    assert.equal(index.lists[0].sha256,sha(items));

    const first=await fetch(base+'/v1/tmdb/lists/8659010?offset=1&limit=2').then(x=>x.json());
    assert.deepEqual(first.items,items.slice(1,3));
    assert.equal(first.total,4);
    assert.equal(first.next_offset,3);
    assert.equal(first.original_order_preserved,true);

    const filtered=await fetch(base+'/v1/tmdb/lists/8659010?type=movie&limit=10').then(x=>x.json());
    assert.deepEqual(filtered.items,[items[0],items[2]]);
    assert.equal(filtered.total,2);
    assert.equal(filtered.next_offset,null);

    const head=await fetch(base+'/v1/tmdb/lists/8659010',{method:'HEAD'});
    assert.equal(head.status,200);
    assert.equal(await head.text(),'');
    assert.equal(head.headers.get('Access-Control-Allow-Origin'),'*');
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('liste manquante != liste vide : erreur 503 documentée et non 404',async()=>{
  const {server,base}=await start(buildIndex(fixture()));
  try{
    const missing=await fetch(base+'/v1/tmdb/lists/8690687');
    assert.equal(missing.status,503);
    assert.equal((await missing.json()).error,'archive_tmdb_indisponible');
    assert.equal((await fetch(base+'/v1/tmdb/lists/42')).status,404);
    assert.equal((await fetch(base+'/v1/tmdb/lists/8659010?limit=-1')).status,400);
    assert.equal((await fetch(base+'/v1/tmdb/lists/8659010?type=secret')).status,400);
    assert.equal((await fetch(base+'/v1/tmdb/lists/8659010',{method:'POST'})).status,405);
    assert.equal((await fetch(base+'/../../.git/config')).status,404);
    const dep=await fetch(base+'/v1/dependencies').then(x=>x.json());
    assert.equal(dep.trakt_references,4);
    assert.equal(dep.trakt_archived,false);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('les inventaires falsifiés, IDs répétés et SHA-256 erronés sont refusés',()=>{
  const bad=fixture();bad.tmdb_lists[0].source_sha256='0'.repeat(64);
  assert.throws(()=>buildIndex(bad),/invalide/);
  const repeated=fixture();repeated.tmdb_lists[0].items=[...items,items[0]];
  repeated.tmdb_lists[0].media_count=repeated.tmdb_lists[0].items.length;
  repeated.tmdb_lists[0].source_sha256=sha(repeated.tmdb_lists[0].items);
  assert.throws(()=>buildIndex(repeated),/invalide/);
  const fake=fixture();fake.coverage.tmdb_unique=12;
  assert.throws(()=>buildIndex(fake),/Couverture/);
});

test('vraie archive versionnée: les 261 listes et leurs empreintes sont disponibles hors réseau',async()=>{
  const index=await loadRepositoryIndex();
  assert.equal(index.entries.size,261);
  assert.equal(index.recovery.coverage.tmdb_unique,262);
  assert.deepEqual([...index.blockers.keys()],[8690687]);
  assert.equal(index.recovery.coverage.sources,3716);
  assert.equal(index.recovery.coverage.trakt_references,364);
});
