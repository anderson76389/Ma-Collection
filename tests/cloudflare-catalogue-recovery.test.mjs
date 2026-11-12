import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,sep} from 'node:path';
import {webcrypto} from 'node:crypto';
import cloudWorker,{validManifest} from '../services/catalogue-recovery-cloudflare/worker.mjs';
import {prepareAssets} from '../services/catalogue-recovery-cloudflare/prepare-assets.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
let root,folder,manifest,env;
const req=(path,init)=>new Request('https://catalogues.example'+path,init);
function mockBinding(base){
  const calls=[];
  return {
    calls,
    async fetch(request){
      const path=new URL(request.url).pathname;
      calls.push(path);
      const resolved=join(base,path.slice(1));
      if(!resolved.startsWith(base+sep))throw Error('Traversée de chemin : '+path);
      try{
        const bytes=await readFile(resolved);
        return new Response(bytes,{status:200,headers:{'Content-Type':'application/json'}});
      }catch(e){
        if(e.code==='ENOENT')return new Response('not found',{status:404});
        throw e;
      }
    }
  };
}
before(async()=>{
  root=await mkdtemp(join(tmpdir(),'ma-collection-worker-'));
  folder=join(root,'assets');
  manifest=await prepareAssets(folder);
  env={ASSETS:mockBinding(folder)};
});
after(async()=>{if(root)await rm(root,{recursive:true,force:true});});

test('261 vraies listes préparées sans réseau ni secret, 262 attendues',async()=>{
  assert.equal(manifest.schema,1);
  assert.equal(manifest.lists.length,261);
  assert.equal(manifest.coverage.tmdb_unique,262);
  assert.deepEqual(manifest.missing.map(x=>x.list_id),[8690687]);
  assert.equal((await readdir(join(folder,'_mc_data','lists'))).length,261);
  assert(validManifest(manifest));
  const disk=JSON.parse(await readFile(join(folder,'_mc_data','manifest.json'),'utf8'));
  assert.deepEqual(disk,manifest);
});

test('HTTP Cloudflare natif : santé, listing, pagination, filtre et CORS',async()=>{
  const health=await cloudWorker.fetch(req('/health'),env);
  assert.equal(health.status,200);
  const summary=await health.json();
  assert.equal(summary.available,261);
  assert.equal(summary.expected,262);
  assert.equal(summary.complete,false);
  assert.equal(summary.network_required,false);
  assert.equal(summary.artwork_available,false);

  const index=await cloudWorker.fetch(req('/v1/tmdb/lists'),env);
  assert.equal(index.status,200);
  assert.equal((await index.json()).lists.length,261);
  const id=manifest.lists[0].list_id;
  const data=JSON.parse(await readFile(join(folder,'_mc_data','lists',id+'.json'),'utf8'));
  const page=await cloudWorker.fetch(req('/v1/tmdb/lists/'+id+'?offset=1&limit=2'),env);
  assert.equal(page.status,200);
  assert.equal(page.headers.get('Access-Control-Allow-Origin'),'*');
  const response=await page.json();
  assert.equal(response.list_id,id);
  assert.equal(response.original_order_preserved,true);
  assert.deepEqual(response.items,data.items.slice(1,3));
  assert.equal(response.total,data.items.length);
  const movie=await cloudWorker.fetch(req('/v1/tmdb/lists/'+id+'?type=movie&limit=100'),env);
  const body=await movie.json();
  assert.deepEqual(body.items,data.items.filter(x=>x.media_type==='movie').slice(0,100));
  assert.equal(body.filter,'movie');
  const head=await cloudWorker.fetch(req('/v1/tmdb/lists/'+id,{method:'HEAD'}),env);
  assert.equal(head.status,200);
  assert.equal(await head.text(),'');
  assert.equal((await cloudWorker.fetch(req('/health',{method:'OPTIONS'}),env)).status,204);
});

test('aucune copie Trakt/addons fictive, archive manquante = 503',async()=>{
  const missing=await cloudWorker.fetch(req('/v1/tmdb/lists/8690687'),env);
  assert.equal(missing.status,503);
  assert.equal((await missing.json()).error,'archive_tmdb_indisponible');
  const dependencies=await cloudWorker.fetch(req('/v1/dependencies'),env);
  const doc=await dependencies.json();
  assert.equal(doc.trakt_references,364);
  assert.equal(doc.addon_references,13);
  assert.equal(doc.trakt_archived,false);
  assert.equal(doc.addons_self_hosted,false);
});

test('ne permet ni écriture ni consultation directe des Static Assets',async()=>{
  const prior=env.ASSETS.calls.length;
  assert.equal((await cloudWorker.fetch(req('/_mc_data/manifest.json'),env)).status,404);
  assert.equal((await cloudWorker.fetch(req('/_mc_data/lists/8659010.json'),env)).status,404);
  assert.equal((await cloudWorker.fetch(req('/v1/tmdb/lists/8659010',{method:'POST'}),env)).status,405);
  assert.equal((await cloudWorker.fetch(req('/v1/tmdb/lists/8659010?limit=101'),env)).status,400);
  assert.equal((await cloudWorker.fetch(req('/v1/tmdb/lists/8659010?offset=-1'),env)).status,400);
  assert.equal((await cloudWorker.fetch(req('/v1/tmdb/lists/8659010?type=poster'),env)).status,400);
  assert.equal((await cloudWorker.fetch(req('/v1/tmdb/lists/12345'),env)).status,404);
  assert.equal(env.ASSETS.calls[prior],'/_mc_data/manifest.json');
});

test('les 261 archives sont réellement récupérables avec leurs SHA-256',async()=>{
  for(const row of manifest.lists){
    const response=await cloudWorker.fetch(req('/v1/tmdb/lists/'+row.list_id+'?limit=100'),env);
    assert.equal(response.status,200,'Archive invalide : '+row.list_id);
    const data=await response.json();
    assert.equal(data.total,row.media_count);
    assert.equal(data.source_sha256,row.sha256);
    assert.equal(data.items.length,Math.min(row.media_count,100));
  }
});

test('refuser les archives corrompues et les manifests falsifiés',async()=>{
  const id=manifest.lists[0].list_id;
  const file=join(folder,'_mc_data','lists',id+'.json');
  const original=await readFile(file,'utf8');
  try{
    const changed=JSON.parse(original);
    changed.items[0].media_id+=1;
    await writeFile(file,JSON.stringify(changed),'utf8');
    const response=await cloudWorker.fetch(req('/v1/tmdb/lists/'+id),env);
    assert.equal(response.status,503);
    assert.equal((await response.json()).error,'archive_tmdb_corrompue');
  }finally{
    await writeFile(file,original,'utf8');
  }
  const fake={...manifest,coverage:{...manifest.coverage,tmdb_unique:999}};
  assert.equal(validManifest(fake),false);
  const modified=join(folder,'_mc_data','manifest.json');
  const originalManifest=await readFile(modified,'utf8');
  try{
    await writeFile(modified,JSON.stringify(fake));
    const response=await cloudWorker.fetch(req('/health'),env);
    assert.equal(response.status,503);
    assert.equal((await response.json()).error,'archives_de_secours_indisponibles');
  }finally{
    await writeFile(modified,originalManifest,'utf8');
  }
});
