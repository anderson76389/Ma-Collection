/**
 * Worker natif Cloudflare : API de secours en lecture seule des listes TMDB.
 *
 * Les fichiers Static Assets liés à la version du Worker sont lus uniquement
 * via env.ASSETS.fetch. Aucun fetch Internet, secret, base D1 ni compte requis.
 * Ne fournit PAS les métadonnées, affiches, Trakt, addons ou flux vidéo.
 */
const positive=n=>Number.isSafeInteger(n)&&n>0;
const shaPattern=/^[0-9a-f]{64}$/;
const idPath=/^\/v1\/tmdb\/lists\/([1-9]\d*)$/;

function respond(request,status,object){
  const body=JSON.stringify(object)+'\n';
  const head=request.method==='HEAD';
  return new Response(head?null:body,{
    status,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type',
      'Cache-Control':status===200?'public, max-age=60':'no-store',
      'Content-Security-Policy':"default-src 'none'",
      'X-Content-Type-Options':'nosniff',
      'Content-Length':String(new TextEncoder().encode(body).byteLength),
      ...(status===405?{'Allow':'GET, HEAD, OPTIONS'}:{}),
    }
  });
}
function strictInt(input,min,max){
  if(typeof input!=='string'|| !/^(0|[1-9]\d*)$/.test(input))return null;
  const number=Number(input);
  return Number.isSafeInteger(number)&&number>=min&&number<=max?number:null;
}
async function staticJSON(request,env,path){
  if(!env?.ASSETS||typeof env.ASSETS.fetch!=='function')
    throw Error('liaison ASSETS manquante');
  // Appel INTERNE au binding de la version déployée. Jamais un fetch Internet.
  const asset=await env.ASSETS.fetch(new Request(new URL(path,request.url),{method:'GET'}));
  if(!asset.ok||asset.status!==200)throw Error('asset indisponible');
  return asset.json();
}
export function validManifest(manifest){
  if(!manifest||manifest.schema!==1||
      manifest.kind!=='ma-collection-cloudflare-tmdb-recovery'||
      !Array.isArray(manifest.lists)||!Array.isArray(manifest.missing)||
      !positive(manifest.coverage?.tmdb_unique)||
      !Number.isSafeInteger(manifest.coverage?.trakt_references)||
      !Number.isSafeInteger(manifest.coverage?.addon_references))
    return false;
  const ids=new Set();
  for(const row of manifest.lists){
    if(!positive(row.list_id)||ids.has(row.list_id)||
       !Number.isSafeInteger(row.media_count)||row.media_count<0||
       !Number.isSafeInteger(row.usages)||row.usages<1||
       !shaPattern.test(row.sha256||''))return false;
    ids.add(row.list_id);
  }
  for(const row of manifest.missing){
    if(!positive(row.list_id)||ids.has(row.list_id)||
       !positive(row.references)||typeof row.reason!=='string')return false;
    ids.add(row.list_id);
  }
  return ids.size===manifest.coverage.tmdb_unique;
}
async function verifyItems(body,entry){
  if(!body||body.schema!==1||body.list_id!==entry.list_id||
     body.sha256!==entry.sha256||!Array.isArray(body.items)||
     body.items.length!==entry.media_count)return false;
  const seen=new Set();
  for(const item of body.items){
    if(!item||!['movie','tv'].includes(item.media_type)||!positive(item.media_id))
      return false;
    const key=item.media_type+':'+item.media_id;
    if(seen.has(key))return false;
    seen.add(key);
  }
  const bytes=new TextEncoder().encode(JSON.stringify(body.items));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const check=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  return check===entry.sha256;
}

export default {
  async fetch(request,env){
    // Contrôler le chemin AVANT le préflight : ne pas annoncer le CORS
    // sur les fichiers internes ou toute route inexistante.
    if(request.url.length>2048)
      return respond(request,414,{error:'url_trop_longue'});
    const url=new URL(request.url);
    // Même pour les fichiers qui existent dans Static Assets, le Worker est
    // invoqué en premier. Ne jamais exposer directement _mc_data/*.json.
    const path=url.pathname;
    const route=path==='/health'||path==='/v1/status'||
      path==='/v1/dependencies'||path==='/v1/tmdb/lists'||idPath.test(path);
    if(request.method==='OPTIONS'){
      if(!route)return respond(request,404,{error:'route_inconnue'});
      return new Response(null,{
        status:204,headers:{
          'Access-Control-Allow-Origin':'*',
          'Access-Control-Allow-Methods':'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers':'Content-Type'
        }
      });
    }
    if(!['GET','HEAD'].includes(request.method))
      return respond(request,405,{error:'lecture_seule'});
    if(!route)return respond(request,404,{error:'route_inconnue'});

    let manifest;
    try{
      manifest=await staticJSON(request,env,'/_mc_data/manifest.json');
      if(!validManifest(manifest))throw Error('manifest invalide');
    }catch(_){
      return respond(request,503,{error:'archives_de_secours_indisponibles'});
    }

    if(path==='/health'||path==='/v1/status')
      return respond(request,200,{
        schema:1,service:'ma-collection-offline-tmdb-recovery',
        available:manifest.lists.length,expected:manifest.coverage.tmdb_unique,
        complete:manifest.missing.length===0,
        missing:manifest.missing.map(x=>x.list_id).sort((a,b)=>a-b),
        network_required:false,artwork_available:false,
        third_party_trakt_archived:false,addons_self_hosted:false,
      });
    if(path==='/v1/tmdb/lists')
      return respond(request,200,{schema:1,count:manifest.lists.length,
        lists:manifest.lists.map(x=>({
          list_id:x.list_id,media_count:x.media_count,sha256:x.sha256,usages:x.usages
        }))
      });
    if(path==='/v1/dependencies')
      return respond(request,200,{schema:1,
        tmdb_missing:manifest.missing,
        trakt_references:manifest.coverage.trakt_references,
        addon_references:manifest.coverage.addon_references,
        trakt_archived:false,addons_self_hosted:false
      });

    const match=idPath.exec(path);
    const id=match&&strictInt(match[1],1,Number.MAX_SAFE_INTEGER);
    if(id===null)return respond(request,400,{error:'id_invalide'});
    const missing=manifest.missing.find(x=>x.list_id===id);
    if(missing)return respond(request,503,{
      error:'archive_tmdb_indisponible',list_id:id,reason:missing.reason
    });
    const entry=manifest.lists.find(x=>x.list_id===id);
    if(!entry)return respond(request,404,{error:'liste_inconnue',list_id:id});

    const type=url.searchParams.get('type');
    if(type!==null&&!['movie','tv'].includes(type))
      return respond(request,400,{error:'type_invalide',allowed:['movie','tv']});
    const offset=strictInt(url.searchParams.get('offset')??'0',0,1_000_000);
    const limit=strictInt(url.searchParams.get('limit')??'50',1,100);
    if(offset===null||limit===null)
      return respond(request,400,{error:'pagination_invalide',max_limit:100});

    let snapshot;
    try{
      snapshot=await staticJSON(request,env,
        '/_mc_data/lists/'+id+'.json');
      if(!(await verifyItems(snapshot,entry)))throw Error('archive modifiée');
    }catch(_){
      return respond(request,503,{error:'archive_tmdb_corrompue',list_id:id});
    }
    const filtered=type?snapshot.items.filter(x=>x.media_type===type):snapshot.items;
    return respond(request,200,{
      schema:1,list_id:id,source_sha256:entry.sha256,
      original_order_preserved:true,filter:type||null,
      total:filtered.length,offset,limit,
      next_offset:offset+limit<filtered.length?offset+limit:null,
      items:filtered.slice(offset,offset+limit)
    });
  }
};
