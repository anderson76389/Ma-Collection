import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,sep} from 'node:path';
import {webcrypto} from 'node:crypto';
import worker from '../services/catalogue-recovery-cloudflare/worker.mjs';
import {prepareAssets} from '../services/catalogue-recovery-cloudflare/prepare-assets.mjs';
import {loadEmergencyInputs,emergencyRecovery} from '../scripts/build-emergency-catalogue.mjs';
import {checkWorkerPublic,MONITORED_ORIGIN} from '../scripts/monitor-ma-collection.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
let directory,assets,recovery;
before(async()=>{
  directory=await mkdtemp(join(tmpdir(),'mc-availability-'));
  assets=join(directory,'assets');
  await prepareAssets(assets);
  const {collections,archives,status}=await loadEmergencyInputs();
  recovery=emergencyRecovery(collections,archives,status);
});
after(async()=>{if(directory)await rm(directory,{recursive:true,force:true})});
function mockWorker(calls=[]){
  return async (url,options={})=>{
    calls.push(url);
    return worker.fetch(new Request(url,options),{ASSETS:{async fetch(request){
      const path=join(assets,new URL(request.url).pathname.slice(1));
      assert(path.startsWith(assets+sep));
      try{return new Response(await readFile(path),{
        status:200,headers:{'content-type':'application/json'}
      })}catch(error){
        if(error.code==='ENOENT')return new Response('Not Found',{status:404});
        throw error;
      }
    }}});
  };
}

test('contrôle quotidien : seulement 4 lectures et aucune API externe',async()=>{
  const calls=[];
  const result=await checkWorkerPublic({fetcher:mockWorker(calls),recovery});
  assert.equal(result.mode,'quick');
  assert.equal(result.available,261);
  assert.deepEqual(result.missing,[8690687]);
  assert.equal(calls.length,4);
  assert(calls.every(url=>url.startsWith(MONITORED_ORIGIN+'/')));
});
test('contrôle hebdomadaire : vérification intégrale des 261 listes',async()=>{
  const calls=[];
  const result=await checkWorkerPublic({fetcher:mockWorker(calls),recovery,deep:true});
  assert.equal(result.verified,261);
  assert(calls.length>=265);
});
test('une ancienne page HTML, un 404 ou une mauvaise origine font échouer le suivi',async()=>{
  await assert.rejects(
    checkWorkerPublic({recovery,origin:'https://evil.test',fetcher:mockWorker()}),
    /URL de publication|origine|Cloudflare/
  );
  await assert.rejects(checkWorkerPublic({recovery,fetcher:async()=>new Response('<html/>',{
    status:200,headers:{'content-type':'text/html'}
  })}),/JSON/);
  await assert.rejects(checkWorkerPublic({recovery,fetcher:async()=>new Response('Not found',{
    status:404,headers:{'content-type':'text/plain'}
  })}),/HTTP 404/);
});
test('un catalogue témoin modifié est détecté sans publication ni écriture',async()=>{
  const fetcher=mockWorker();
  await assert.rejects(checkWorkerPublic({recovery,fetcher:async(url,options)=>{
    const response=await fetcher(url,options);
    if(url.includes('?offset=0&limit=1')){
      const body=await response.json();
      body.source_sha256='0'.repeat(64);
      return new Response(JSON.stringify(body),{
        status:200,headers:{'content-type':'application/json','access-control-allow-origin':'*'}
      });
    }
    return response;
  }}),/Expected values to be strictly equal|source_sha256/);
});
