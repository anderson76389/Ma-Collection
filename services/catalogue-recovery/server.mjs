#!/usr/bin/env node
/**
 * Ma-Collection — service de secours de listes TMDB, 100% LOCAL en lecture.
 *
 * Sert les vrais identifiants et leur ordre depuis les instantanés déjà
 * conservés dans le dépôt, sans contacter Kaptain, TMDB, Trakt ni Cloudflare.
 *
 * Ce n'est PAS un addon Stremio ni une API de métadonnées / images :
 * les titres/affiches ne sont pas présents dans les instantanés. Ne jamais
 * basculer silencieusement le site ou Kovelyx sur ce service sans adaptateur.
 *
 * Usage:
 *   node services/catalogue-recovery/server.mjs --check
 *   node services/catalogue-recovery/server.mjs
 *   HOST=127.0.0.1 PORT=8788 node services/catalogue-recovery/server.mjs
 * Pour exposer sur Internet : utiliser un proxy HTTPS sous son contrôle.
 */
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {loadEmergencyInputs, emergencyRecovery} from '../../scripts/build-emergency-catalogue.mjs';

const positive=n=>Number.isSafeInteger(n)&&n>0;
const sha=items=>createHash('sha256').update(JSON.stringify(items)).digest('hex');

export function buildIndex(recovery){
  if(!recovery||recovery.schema!==1||
    recovery.kind!=='ma-collection-emergency-tmdb-list-recovery'||
    !Array.isArray(recovery.tmdb_lists)||!Array.isArray(recovery.tmdb_blockers))
    throw new Error('Export de récupération non certifié');
  const entries=new Map();
  const blockers=new Map();
  for(const row of recovery.tmdb_lists){
    const id=row.original_list_id;
    if(!positive(id)||entries.has(id)||
       !Array.isArray(row.items)||row.items.length!==row.media_count||
       !row.items.every(x=>(x.media_type==='movie'||x.media_type==='tv')&&positive(x.media_id))||
       new Set(row.items.map(x=>x.media_type+':'+x.media_id)).size!==row.items.length||
       sha(row.items)!==row.source_sha256)throw new Error('Liste de secours invalide');
    entries.set(id,row);
  }
  for(const row of recovery.tmdb_blockers){
    if(!positive(row.list_id)||entries.has(row.list_id)||blockers.has(row.list_id))
      throw new Error('Exception de sauvegarde invalide');
    blockers.set(row.list_id,row);
  }
  if(entries.size+blockers.size!==recovery.coverage.tmdb_unique)
    throw new Error('Couverture TMDB incompatible avec les listes et exceptions');
  return {entries,blockers,recovery};
}

function strictInt(raw,min,max){
  if(typeof raw!=='string'||!(/^(0|[1-9]\d*)$/.test(raw)))return null;
  const n=Number(raw);
  return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null;
}

export function createHandler(index){
  const {entries,blockers,recovery}=index;
  const send=(req,res,status,data)=>{
    const content=JSON.stringify(data)+'\n';
    const bytes=Buffer.byteLength(content);
    res.writeHead(status,{
      'Content-Type':'application/json; charset=utf-8',
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type',
      'Cache-Control':'public, max-age=60',
      'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'none'",
      'Content-Length':bytes,
    });
    if(req.method==='HEAD')res.end();
    else res.end(content);
  };
  return (req,res)=>{
    if(req.method==='OPTIONS'){
      res.writeHead(204,{'Access-Control-Allow-Origin':'*',
        'Access-Control-Allow-Methods':'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers':'Content-Type'});
      return res.end();
    }
    if(req.method!=='GET'&&req.method!=='HEAD')
      return send(req,res,405,{error:'lecture_seule',message:'Aucune écriture disponible'});
    const raw=req.url||'/';
    if(raw.length>2048)return send(req,res,414,{error:'url_trop_longue'});
    let url;
    try {url=new URL(raw,'http://127.0.0.1');}
    catch {return send(req,res,400,{error:'url_invalide'});}
    const path=url.pathname;
    if(path==='/health'||path==='/v1/status')
      return send(req,res,200,{
        schema:1,service:'ma-collection-offline-tmdb-recovery',
        available:entries.size,expected:recovery.coverage.tmdb_unique,
        complete:blockers.size===0,missing:[...blockers.keys()].sort((a,b)=>a-b),
        network_required:false,artwork_available:false,
        third_party_trakt_archived:false,addons_self_hosted:false
      });
    if(path==='/v1/tmdb/lists'){
      return send(req,res,200,{
        schema:1,count:entries.size,
        lists:[...entries.values()].map(x=>({
          list_id:x.original_list_id,media_count:x.media_count,
          sha256:x.source_sha256,usages:x.uses.length
        }))
      });
    }
    if(path==='/v1/dependencies'){
      return send(req,res,200,{
        schema:1,
        tmdb_missing:[...blockers.values()],
        trakt_references:recovery.coverage.trakt_references,
        addon_references:recovery.coverage.addon_references,
        trakt_archived:false,addons_self_hosted:false
      });
    }
    const match=/^\/v1\/tmdb\/lists\/([1-9]\d*)$/.exec(path);
    if(!match)return send(req,res,404,{error:'route_inconnue'});
    const id=strictInt(match[1],1,Number.MAX_SAFE_INTEGER);
    if(id===null)return send(req,res,400,{error:'id_invalide'});
    if(blockers.has(id))
      return send(req,res,503,{error:'archive_tmdb_indisponible',list_id:id,reason:blockers.get(id).reason});
    const list=entries.get(id);
    if(!list)return send(req,res,404,{error:'liste_inconnue',list_id:id});
    const type=url.searchParams.get('type');
    if(type!==null&&!['movie','tv'].includes(type))
      return send(req,res,400,{error:'type_invalide',allowed:['movie','tv']});
    const offset=strictInt(url.searchParams.get('offset')??'0',0,1000000);
    const limit=strictInt(url.searchParams.get('limit')??'50',1,100);
    if(offset===null||limit===null)
      return send(req,res,400,{error:'pagination_invalide',max_limit:100});
    const filtered=type?list.items.filter(x=>x.media_type===type):list.items;
    return send(req,res,200,{
      schema:1,list_id:id,source_sha256:list.source_sha256,
      original_order_preserved:true,filter:type||null,
      total:filtered.length,offset,limit,
      next_offset:offset+limit<filtered.length?offset+limit:null,
      items:filtered.slice(offset,offset+limit)
    });
  };
}

export async function loadRepositoryIndex(){
  const {collections,archives,status}=await loadEmergencyInputs();
  return buildIndex(emergencyRecovery(collections,archives,status));
}

const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  try{
    const index=await loadRepositoryIndex();
    const summary={available:index.entries.size,expected:index.recovery.coverage.tmdb_unique,
      missing:[...index.blockers.keys()].sort((a,b)=>a-b)};
    if(process.argv.includes('--check')){
      console.log('CATALOGUE_RECOVERY_VALID '+JSON.stringify(summary));
    }else{
      const host=process.env.HOST||'127.0.0.1';
      const port=strictInt(process.env.PORT||'8788',1,65535);
      if(port===null)throw new Error('PORT doit être compris entre 1 et 65535');
      createServer(createHandler(index)).listen(port,host,()=>{
        console.log('CATALOGUE_RECOVERY_READY '+JSON.stringify({host,port,...summary}));
      });
    }
  }catch(error){
    console.error('CATALOGUE_RECOVERY_ERROR : '+error.message);
    process.exitCode=1;
  }
}
