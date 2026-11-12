/** Contrôle NON intrusif des sources tierces et des archives TMDB.
 * Ne contacte ni TMDB, ni Trakt, ni Kaptain. Ne copie aucun catalogue Trakt.
 */
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readCollections} from './tmdb-own-lists.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const STORE=join(ROOT,'data/catalogue-archives/tmdb');
const validInt=x=>Number.isSafeInteger(x)&&x>0;
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');

export function auditCatalogSources(collections,snapshots=new Map(),status=null){
  const lists=new Map(),trakt=new Map(),addons=new Map(),issues=[];
  let collectionsCount=0,folders=0,sources=0,tmdbReferences=0,traktReferences=0,addonReferences=0;
  for(const [file,content] of collections){
    for(const category of content){
      collectionsCount++;
      for(const folder of category.folders||[]){
        folders++;
        for(const source of folder.sources||[]){
          sources++;
          if(source.provider==='tmdb'&&source.tmdbSourceType==='LIST'){
            tmdbReferences++;const id=Number(source.tmdbId);
            if(!validInt(id)){issues.push('ID TMDB invalide '+file);continue;}
            if(!lists.has(id))lists.set(id,{id,refs:0});
            lists.get(id).refs++;
          }else if(source.provider==='trakt'){
            traktReferences++;const id=Number(source.traktListId);
            if(!validInt(id)){issues.push('ID Trakt invalide '+file);continue;}
            if(!trakt.has(id))trakt.set(id,{id,refs:0});
            trakt.get(id).refs++;
          }else if(source.provider==='addon'){
            addonReferences++;
            const key=String(source.addonId||'').trim()+'::'+String(source.catalogId||'').trim();
            if(!source.addonId||!source.catalogId)issues.push('Extension sans identifiant '+file);
            if(!addons.has(key))addons.set(key,{addonId:source.addonId,catalogId:source.catalogId,refs:0});
            addons.get(key).refs++;
          }
        }
      }
    }
  }
  const missing=[],verified=[],invalid=[];
  for(const id of lists.keys()){
    const row=snapshots.get(id);
    if(!row){missing.push(id);continue;}
    if(row.schema!==1||row.original_list_id!==id||row.public!==true||
       !Array.isArray(row.items)||!row.items.every(x=>
         validInt(x.media_id)&&['movie','tv'].includes(x.media_type))||
       new Set(row.items.map(x=>x.media_type+':'+x.media_id)).size!==row.items.length||
       row.sha256!==sha(row.items)){
      invalid.push(id);continue;
    }
    verified.push(id);
  }
  if(status){
    const expected=Number(status.expected), current=Number(status.verified_current);
    if(expected!==lists.size||current!==verified.length)
      issues.push('Statut des archives TMDB incohérent avec les fichiers réels');
    const reported=new Set((status.failures||[]).map(x=>Number(x.list_id)));
    const actual=new Set([...missing,...invalid]);
    if(reported.size!==actual.size||[...reported].some(id=>!actual.has(id)))
      issues.push('Exceptions TMDB non concordantes avec les archives');
  }
  if(invalid.length)issues.push(invalid.length+' archive(s) TMDB altérée(s)');
  return {
    schema:1,baseline:{collections:collectionsCount,folders,sources},
    tmdb:{references:tmdbReferences,unique:lists.size,verified:verified.length,missing,invalid,
      ownership:'non-démontrée : un instantané en lecture seule ne prouve pas la propriété'},
    trakt:{references:traktReferences,unique:trakt.size,
      listIds:[...trakt.keys()].sort((a,b)=>a-b),
      status:'sources tierces : inventaire uniquement, aucune copie ou migration automatique'},
    addons:{references:addonReferences,unique:addons.size,
      sources:[...addons.values()].sort((a,b)=>a.addonId.localeCompare(b.addonId)||a.catalogId.localeCompare(b.catalogId)),
      status:'instances externes : restent dépendantes de leur opérateur'},
    risks:issues,
    independenceCertified:lists.size===0&&trakt.size===0&&addons.size===0&&issues.length===0
  };
}
export async function currentCatalogAudit(){
  const contents=await readCollections();
  const ids=await readdir(STORE);
  const archives=new Map();
  for(const filename of ids.filter(x=>/^\d+\.json$/.test(x))){
    const row=JSON.parse(await readFile(join(STORE,filename),'utf8'));
    archives.set(Number(filename.slice(0,-5)),row);
  }
  const status=JSON.parse(await readFile(join(STORE,'status.json'),'utf8'));
  return auditCatalogSources(contents,archives,status);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await currentCatalogAudit();
  const outArg=process.argv.find(x=>x.startsWith('--output='));
  if(outArg)await writeFile(resolve(outArg.slice(9)),JSON.stringify(result,null,2)+'\n','utf8');
  console.log('CATALOGUE_PROVENANCE='+JSON.stringify({
    baseline:result.baseline,
    tmdb:{references:result.tmdb.references,unique:result.tmdb.unique,verified:result.tmdb.verified,missing:result.tmdb.missing,invalid:result.tmdb.invalid},
    trakt:{references:result.trakt.references,unique:result.trakt.unique},
    addons:{references:result.addons.references,unique:result.addons.unique},
    risks:result.risks,independenceCertified:result.independenceCertified
  }));
  if(result.risks.length)process.exitCode=1;
}
