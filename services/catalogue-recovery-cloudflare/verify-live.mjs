#!/usr/bin/env node
/**
 * Vérification post-déploiement : NE marque jamais l'action comme réussie avant
 * d'avoir relu les 261 listes depuis le vrai domaine workers.dev publié.
 * Les données attendues viennent des archives Git validées, sans API TMDB.
 * Aucun jeton Cloudflare ne quitte ce processus.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEmergencyInputs,emergencyRecovery} from '../../scripts/build-emergency-catalogue.mjs';

const WORKER='ma-collection';
const ID_PATTERN=/^https:\/\/ma-collection\.[a-z0-9-]+\.workers\.dev(?:\/)?$/i;

export function validatedOrigin(value){
  const url=String(value||'').trim();
  if(!ID_PATTERN.test(url))throw Error('URL de publication Cloudflare non reconnue : refus du contrôle hors compte');
  const parsed=new URL(url);
  if(parsed.username||parsed.password||parsed.search||parsed.hash||!['','/'].includes(parsed.pathname))
    throw Error('URL Cloudflare non sûre');
  return parsed.origin;
}

export function originFromDeployOutput(output){
  const stripped=String(output||'').replace(/\x1b\[[0-9;]*m/g,'');
  const urls=stripped.match(/https:\/\/ma-collection\.[a-z0-9-]+\.workers\.dev(?=$|[\s/),;\]>])/gi)||[];
  if(!urls.length)throw Error('Wrangler n’a pas annoncé d’URL workers.dev : déploiement non vérifié');
  const normalized=[...new Set(urls.map(validatedOrigin))];
  if(normalized.length!==1)throw Error('Plusieurs domaines Workers annoncés : aucun contrôle ambigu');
  return normalized[0];
}

async function requestJSON(fetcher,origin,path,expectedStatus=200){
  const response=await fetcher(origin+path,{
    method:'GET',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)
  });
  assert.equal(response.status,expectedStatus,path+' : HTTP '+response.status+' au lieu de '+expectedStatus);
  assert.match(response.headers.get('content-type')||'',/application\/json/i,path+' : JSON requis');
  assert.equal(response.headers.get('access-control-allow-origin'),'*',path+' : CORS public absent');
  return response.json();
}

export async function verifyLive(origin,recovery,fetcher=fetch){
  origin=validatedOrigin(origin);
  assert.equal(recovery.schema,1);
  assert.equal(recovery.kind,'ma-collection-emergency-tmdb-list-recovery');
  const rows=recovery.tmdb_lists;
  assert(rows.length>0,'Aucune archive à comparer');
  const missing=recovery.tmdb_blockers.map(x=>x.list_id).sort((a,b)=>a-b);
  const health=await requestJSON(fetcher,origin,'/health');
  assert.equal(health.service,'ma-collection-offline-tmdb-recovery');
  assert.equal(health.available,rows.length,'nombre de listes réellement déployées');
  assert.equal(health.expected,recovery.coverage.tmdb_unique);
  assert.deepEqual(health.missing,missing);
  assert.equal(health.complete,missing.length===0);
  assert.equal(health.network_required,false);
  assert.equal(health.artwork_available,false);
  const dependencies=await requestJSON(fetcher,origin,'/v1/dependencies');
  assert.equal(dependencies.trakt_references,recovery.coverage.trakt_references);
  assert.equal(dependencies.addon_references,recovery.coverage.addon_references);
  assert.equal(dependencies.trakt_archived,false);
  assert.equal(dependencies.addons_self_hosted,false);
  const listing=await requestJSON(fetcher,origin,'/v1/tmdb/lists');
  assert.equal(listing.count,rows.length);
  assert.equal(listing.lists.length,rows.length);
  const byId=new Map(listing.lists.map(x=>[x.list_id,x]));
  assert.equal(byId.size,rows.length);
  for(const row of rows){
    const remote=byId.get(row.original_list_id);
    assert(remote,'Liste absente du manifest public : '+row.original_list_id);
    assert.equal(remote.sha256,row.source_sha256);
    assert.equal(remote.media_count,row.items.length);
  }

  // Ne jamais exposer les assets internes bruts, même s'ils sont dans le
  // bundle Cloudflare. Ces chemins doivent être refusés par le Worker.
  const forbidden=await requestJSON(fetcher,origin,'/_mc_data/manifest.json',404);
  assert.equal(forbidden.error,'route_inconnue');
  for(const blocker of recovery.tmdb_blockers){
    const r=await requestJSON(fetcher,origin,'/v1/tmdb/lists/'+blocker.list_id,503);
    assert.equal(r.error,'archive_tmdb_indisponible');
  }
  let verified=0;
  const parallel=8;
  for(let start=0;start<rows.length;start+=parallel){
    await Promise.all(rows.slice(start,start+parallel).map(async row=>{
      const actual=[];
      let offset=0;
      do{
        const path='/v1/tmdb/lists/'+row.original_list_id+'?offset='+offset+'&limit=100';
        const page=await requestJSON(fetcher,origin,path);
        assert.equal(page.list_id,row.original_list_id);
        assert.equal(page.source_sha256,row.source_sha256);
        assert.equal(page.original_order_preserved,true);
        assert.equal(page.total,row.items.length);
        assert.equal(page.offset,offset);
        assert(Array.isArray(page.items));
        actual.push(...page.items);
        const next=page.next_offset;
        if(next===null)break;
        assert(Number.isSafeInteger(next)&&next===offset+100&&next>offset,
          'Pagination corrompue : '+row.original_list_id);
        offset=next;
        assert(offset<1000000,'Pagination hors limite');
      }while(true);
      assert.deepEqual(actual,row.items,'Contenu ou ordre différent : '+row.original_list_id);
      verified++;
    }));
  }
  return {origin,verified,expected:recovery.coverage.tmdb_unique,missing};
}

const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  try{
    const logFile=process.argv.find(x=>x.startsWith('--deploy-log='))?.slice('--deploy-log='.length);
    if(!logFile)throw Error('Indiquer --deploy-log=/chemin/vers/sortie-wrangler');
    const output=await readFile(resolve(logFile),'utf8');
    const origin=originFromDeployOutput(output);
    const {collections,archives,status}=await loadEmergencyInputs();
    const recovery=emergencyRecovery(collections,archives,status);
    let result;
    for(let attempt=0;attempt<6;attempt++){
      try{
        result=await verifyLive(origin,recovery);
        break;
      }catch(error){
        if(attempt===5)throw error;
        await new Promise(resolve=>setTimeout(resolve,2500));
      }
    }
    console.log('CLOUDFLARE_DEPLOY_VERIFIED '+JSON.stringify(result));
  }catch(error){
    console.error('CLOUDFLARE_DEPLOY_NOT_VERIFIED : '+error.message);
    process.exitCode=1;
  }
}
