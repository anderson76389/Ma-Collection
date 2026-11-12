#!/usr/bin/env node
/**
 * Prépare un bundle Static Assets Cloudflare depuis les archives VERSIONNÉES.
 * Aucun téléchargement, token ou contenu Trakt n'est utilisé.
 * L'API Worker ne reçoit pas les profils ni les clés de l'utilisateur.
 */
import {mkdtemp,mkdir,rename,rm,writeFile} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEmergencyInputs,emergencyRecovery} from '../../scripts/build-emergency-catalogue.mjs';

export const DEFAULT_ASSETS=join(dirname(fileURLToPath(import.meta.url)),'dist','assets');
export async function prepareAssets(target=DEFAULT_ASSETS){
  const destination=resolve(target);
  await mkdir(dirname(destination),{recursive:true});
  const staging=await mkdtemp(join(dirname(destination),'.recovery-build-'));
  try{
    const {collections,archives,status}=await loadEmergencyInputs();
    const data=emergencyRecovery(collections,archives,status);
    if(data.schema!==1||data.kind!=='ma-collection-emergency-tmdb-list-recovery'||
        !Array.isArray(data.tmdb_lists)||!Array.isArray(data.tmdb_blockers)||
        data.tmdb_lists.length+data.tmdb_blockers.length!==data.coverage.tmdb_unique)
      throw Error('Archives TMDB non validées : rien ne sera déployé');
    const assetRoot=join(staging,'_mc_data');
    const listsDir=join(assetRoot,'lists');
    await mkdir(listsDir,{recursive:true});
    const manifest={
      schema:1,kind:'ma-collection-cloudflare-tmdb-recovery',
      provenance:'snapshots TMDB versionnés et vérifiés, sans appel réseau',
      coverage:data.coverage,
      lists:data.tmdb_lists.map(row=>({
        list_id:row.original_list_id,
        media_count:row.media_count,
        sha256:row.source_sha256,
        usages:row.uses.length,
      })),
      missing:data.tmdb_blockers.map(row=>({
        list_id:row.list_id,references:row.references,reason:row.reason,
      })),
    };
    for(const row of data.tmdb_lists){
      const body={
        schema:1,list_id:row.original_list_id,
        sha256:row.source_sha256,items:row.items,
      };
      await writeFile(join(listsDir,String(row.original_list_id)+'.json'),
        JSON.stringify(body)+'\n','utf8');
    }
    await writeFile(join(assetRoot,'manifest.json'),JSON.stringify(manifest)+'\n','utf8');
    await rm(destination,{recursive:true,force:true});
    await rename(staging,destination);
    return manifest;
  }finally{
    await rm(staging,{recursive:true,force:true});
  }
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  prepareAssets().then(m=>{
    console.log('CLOUDFLARE_ASSETS_VERIFIED '+JSON.stringify({
      lists:m.lists.length,expected:m.coverage.tmdb_unique,
      missing:m.missing.map(x=>x.list_id),
      trakt_backed_up:false,addons_self_hosted:false,
    }));
  }).catch(e=>{
    console.error('CLOUDFLARE_ASSETS_REFUSED : '+e.message);
    process.exitCode=1;
  });
}
