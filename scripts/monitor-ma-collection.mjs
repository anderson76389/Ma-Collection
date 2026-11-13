#!/usr/bin/env node
/**
 * Contrôle public du Worker de secours Ma-Collection.
 * Aucune clé, aucune écriture, aucun accès au compte Kovelyx ou aux addons.
 * 4 requêtes par contrôle rapide ; contrôle intégral le dimanche.
 */
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEmergencyInputs,emergencyRecovery} from './build-emergency-catalogue.mjs';
import {validatedOrigin,verifyLive} from '../services/catalogue-recovery-cloudflare/verify-live.mjs';

export const MONITORED_ORIGIN='https://ma-collection.mailpromahe.workers.dev';

async function readJSON(fetcher,origin,path,code=200){
  const response=await fetcher(origin+path,{
    method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)
  });
  assert.equal(response.status,code,path+' : HTTP '+response.status+' (attendu '+code+')');
  assert.match(response.headers.get('content-type')||'',/application\/json/i,path+' : réponse JSON exigée');
  assert.equal(response.headers.get('access-control-allow-origin'),'*',path+' : CORS absent');
  return response.json();
}

export async function checkWorkerPublic({fetcher=fetch,origin=MONITORED_ORIGIN,recovery,deep=false}={}){
  origin=validatedOrigin(origin);
  assert.equal(origin,MONITORED_ORIGIN,'origine différente du Worker dédié');
  assert(recovery&&recovery.schema===1&&Array.isArray(recovery.tmdb_lists),'inventaire de sauvegarde manquant');
  const ids=recovery.tmdb_lists;
  const missing=recovery.tmdb_blockers.map(x=>x.list_id).sort((a,b)=>a-b);
  const health=await readJSON(fetcher,origin,'/health');
  assert.equal(health.service,'ma-collection-offline-tmdb-recovery');
  assert.equal(health.available,ids.length);
  assert.equal(health.expected,recovery.coverage.tmdb_unique);
  assert.deepEqual(health.missing,missing);
  assert.equal(health.complete,missing.length===0);
  assert.equal(health.network_required,false);
  assert.equal(health.artwork_available,false);

  const deps=await readJSON(fetcher,origin,'/v1/dependencies');
  assert.equal(deps.trakt_references,recovery.coverage.trakt_references);
  assert.equal(deps.addon_references,recovery.coverage.addon_references);
  assert.equal(deps.trakt_archived,false);
  assert.equal(deps.addons_self_hosted,false);

  // S'assurer qu'un script tiers ou un autre build ne remplace pas l'API.
  const hidden=await readJSON(fetcher,origin,'/_mc_data/manifest.json',404);
  assert.equal(hidden.error,'route_inconnue');
  const sample=ids.find(row=>row.items.length>0);
  assert(sample,'Aucune liste non vide dans le snapshot de référence');
  const sampleData=await readJSON(fetcher,origin,
    '/v1/tmdb/lists/'+sample.original_list_id+'?offset=0&limit=1');
  assert.equal(sampleData.list_id,sample.original_list_id);
  assert.equal(sampleData.source_sha256,sample.source_sha256);
  assert.equal(sampleData.total,sample.items.length);
  assert.equal(sampleData.original_order_preserved,true);
  assert.deepEqual(sampleData.items,sample.items.slice(0,1));

  const outcome={origin,mode:deep?'full':'quick',available:health.available,
    expected:health.expected,missing};
  if(deep){
    const result=await verifyLive(origin,recovery,fetcher);
    assert.equal(result.verified,ids.length);
    outcome.verified=result.verified;
  }
  return outcome;
}

const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  try{
    const deep=process.argv.includes('--full');
    if(process.argv.some(x=>x.startsWith('--')&&!['--quick','--full'].includes(x)))
      throw Error('Option inconnue : --quick ou --full');
    const {collections,archives,status}=await loadEmergencyInputs();
    const recovery=emergencyRecovery(collections,archives,status);
    const result=await checkWorkerPublic({recovery,deep});
    console.log('MA_COLLECTION_LIVE_OK '+JSON.stringify(result));
  }catch(error){
    console.error('MA_COLLECTION_LIVE_FAILED : '+error.message);
    process.exitCode=1;
  }
}
