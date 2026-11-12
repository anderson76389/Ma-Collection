import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,sep} from 'node:path';
import {webcrypto} from 'node:crypto';
import worker from '../services/catalogue-recovery-cloudflare/worker.mjs';
import {prepareAssets} from '../services/catalogue-recovery-cloudflare/prepare-assets.mjs';
import {originFromDeployOutput,validatedOrigin,verifyLive} from '../services/catalogue-recovery-cloudflare/verify-live.mjs';
import {loadEmergencyInputs,emergencyRecovery} from '../scripts/build-emergency-catalogue.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const domain='https://ma-collection-catalogues.exemple.workers.dev';
let root,archive,env;
const calls=[];
before(async()=>{
  root=await mkdtemp(join(tmpdir(),'mc-cloud-live-check-'));
  const base=join(root,'assets');
  await prepareAssets(base);
  const {collections,archives,status}=await loadEmergencyInputs();
  archive=emergencyRecovery(collections,archives,status);
  env={ASSETS:{async fetch(request){
    const path=new URL(request.url).pathname;
    const file=join(base,path.slice(1));
    if(!file.startsWith(base+sep))throw Error('Fichier non autorisé');
    try{
      return new Response(await readFile(file),{
        status:200,headers:{'content-type':'application/json'}
      });
    }catch(e){
      if(e.code==='ENOENT')return new Response('Not found',{status:404});
      throw e;
    }
  }}};
});
after(async()=>{if(root)await rm(root,{recursive:true,force:true});});

const localFetch=async(input,options={})=>{
  calls.push(input);
  return worker.fetch(new Request(input,options),env);
};

test('lire uniquement le workers.dev déployé, jamais un lien arbitraire ou un token',()=>{
  const text='⛅ Wrangler deployed\n  '+domain+' \n';
  assert.equal(originFromDeployOutput(text),domain);
  assert.equal(originFromDeployOutput('\u001b[32m'+domain+'\u001b[0m'),domain);
  for(const invalid of [
    'https://evil.example','https://ma-collection-catalogues.attacker.workers.dev.evil.com',
    'https://ma-collection-catalogues.foo.workers.dev/path',
    'https://ma-collection-catalogues.foo.workers.dev?secret=yes',
    'http://ma-collection-catalogues.foo.workers.dev',
    'https://ma-collection-catalogues.foo.workers.dev@evil.com'
  ])assert.throws(()=>validatedOrigin(invalid));
  assert.throws(()=>originFromDeployOutput('Build complete, no live URL'));
  assert.throws(()=>originFromDeployOutput('https://ma-collection-catalogues.foo.workers.dev.evil.example'));
  assert.throws(()=>originFromDeployOutput(domain+' '+ 'https://ma-collection-catalogues.autre.workers.dev'));

});

test('relecture intégrale du déploiement : vrais IDs, ordre, hash et page suivante',async()=>{
  calls.length=0;
  const result=await verifyLive(domain,archive,localFetch);
  assert.equal(result.origin,domain);
  assert.equal(result.verified,261);
  assert.equal(result.expected,262);
  assert.deepEqual(result.missing,[8690687]);
  assert(calls.length>=265);
  assert(calls.every(x=>x.startsWith(domain+'/')));
  if(archive.tmdb_lists.some(x=>x.items.length>100))
    assert(calls.some(x=>x.includes('?offset=100&limit=100')),'Pagination réelle non contrôlée');
});

test('la vérification échoue si un seul catalogue est absent ou falsifié',async()=>{
  const first=archive.tmdb_lists[0].original_list_id;
  const badFetch=async(input,options)=>{
    if(input.includes('/v1/tmdb/lists/'+first+'?'))
      return new Response('{"error":"archive_inconnue"}',{
        status:404,headers:{'Content-Type':'application/json'}
      });
    return localFetch(input,options);
  };
  await assert.rejects(()=>verifyLive(domain,archive,badFetch),/HTTP 404 au lieu de 200/);
});

test('la vérification échoue si les assets sont accessibles directement',async()=>{
  const openFetch=async(input,options)=>{
    if(input.endsWith('/_mc_data/manifest.json'))
      return new Response('{"schema":1}',{
        status:200,headers:{'Content-Type':'application/json'}
      });
    return localFetch(input,options);
  };
  await assert.rejects(()=>verifyLive(domain,archive,openFetch),/HTTP 200 au lieu de 404/);
});
