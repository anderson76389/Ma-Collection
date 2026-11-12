#!/usr/bin/env node
/**
 * Plan de reprise HORS réseau des listes TMDB déjà archivées.
 *
 * Ne télécharge rien depuis TMDB/Trakt/Kaptain, n'écrit dans aucune collection
 * et ne prétend pas rendre les catalogues Trakt/addons autonomes.
 *
 * Sortie : JSON avec identifiants TMDB de films/séries dans l'ordre ORIGINAL,
 * usages exacts des listes dans les dossiers, empreintes et blocages explicites.
 * Cet export n'est PAS un manifest compatible Kovelyx/Stremio ; un serveur de
 * catalogues indépendant doit être testé avant le remplacement des sources.
 */
import {createHash} from 'node:crypto';
import {readFile,writeFile, readdir, mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readCollections} from './tmdb-own-lists.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const STORE=join(ROOT,'data/catalogue-archives/tmdb');
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const positive=x=>Number.isSafeInteger(x)&&x>0;
const key=x=>x.media_type+':'+x.media_id;

export function emergencyRecovery(collections,archiveMap,status){
  if(!(collections instanceof Map)||!(archiveMap instanceof Map))throw Error('Collections/archives invalides');
  const dependencies=new Map(),trakt=[],addons=[];
  let categories=0,folders=0,totalSources=0,tmdbReferences=0;
  for(const [filename,categoriesFile] of collections){
    if(!Array.isArray(categoriesFile))throw Error('Collection mal formée : '+filename);
    for(const category of categoriesFile){
      categories++;
      for(const folder of category.folders||[]){
        folders++;
        for(const source of folder.sources||[]){
          totalSources++;
          const usage={
            file:filename,
            section_id:String(category.id||''),
            folder_id:String(folder.id||''),
            source_id:String(source.id||''),
            media_type:String(source.mediaType||source.type||''),
          };
          if(source.provider==='tmdb'&&source.tmdbSourceType==='LIST'){
            const id=Number(source.tmdbId);
            if(!positive(id))throw Error('Liste TMDB sans identifiant : '+filename);
            if(!dependencies.has(id))dependencies.set(id,[]);
            dependencies.get(id).push(usage);
            tmdbReferences++;
          }else if(source.provider==='trakt'){
            trakt.push({...usage,list_id:source.traktListId??null});
          }else if(source.provider==='addon'){
            addons.push({...usage,addon_id:String(source.addonId||''),catalog_id:String(source.catalogId||'')});
          }
        }
      }
    }
  }
  if(dependencies.size<1)throw Error('Aucune liste TMDB dans les données');
  const tmdb=[],notRecoverable=[];
  for(const [id,usages] of [...dependencies].sort((a,b)=>a[0]-b[0])){
    const snapshot=archiveMap.get(id);
    if(!snapshot){
      notRecoverable.push({list_id:id,references:usages.length,reason:'archive_absente'});
      continue;
    }
    if(snapshot.schema!==1||snapshot.original_list_id!==id||snapshot.public!==true||
      !Array.isArray(snapshot.items)||!snapshot.items.every(x=>
        (x.media_type==='movie'||x.media_type==='tv')&&positive(x.media_id))||
      new Set(snapshot.items.map(key)).size!==snapshot.items.length||
      digest(snapshot.items)!==snapshot.sha256){
      notRecoverable.push({list_id:id,references:usages.length,reason:'archive_invalide'});
      continue;
    }
    tmdb.push({
      original_list_id:id,
      original_order_preserved:true,
      source_sha256:snapshot.sha256,
      media_count:snapshot.items.length,
      uses:usages,
      // Ces IDs existent déjà dans les fichiers du dépôt, ici regroupés pour
      // pouvoir reconstruire le contenu d'une liste supprimée chez son auteur.
      items:snapshot.items.map(x=>({media_type:x.media_type,media_id:x.media_id}))
    });
  }
  const failures=new Set((status?.failures||[]).map(x=>Number(x.list_id)));
  if(status){
    if(status.expected!==dependencies.size||status.verified_current!==tmdb.length||
       failures.size!==notRecoverable.length||
       notRecoverable.some(x=>!failures.has(x.list_id))){
      throw Error('Le rapport des archives ne correspond plus aux vrais contenus : export refusé');
    }
  }
  const coverage={
    categories,folders,sources:totalSources,
    tmdb_unique:dependencies.size,tmdb_references:tmdbReferences,
    tmdb_recoverable:tmdb.length,tmdb_missing_or_invalid:notRecoverable.length,
    trakt_references:trakt.length,addon_references:addons.length,
  };
  return {
    schema:1,kind:'ma-collection-emergency-tmdb-list-recovery',
    generated_from:'archives locales versionnées uniquement, aucun appel réseau',
    coverage,
    tmdb_lists:tmdb,tmdb_blockers:notRecoverable,
    // Métadonnées de provenance seulement : AUCUNE copie de contenu Trakt.
    trakt_unbacked_references:trakt,
    addon_external_references:addons,
    limitations:[
      'Export de secours des ID TMDB existants, sans métadonnées ni affiches de films.',
      'Les listes de tiers ne sont pas devenues propriétaires et aucune URL de catalogue n’a été changée.',
      'La compatibilité de cet export avec Kovelyx/Stremio demande un adaptateur local testé.',
      'Les listes Trakt et les données des addons ne sont pas archivées par cette commande.'
    ],
  };
}

export async function loadEmergencyInputs(){
  const [collections,names,status]=await Promise.all([
    readCollections(),readdir(STORE),readFile(join(STORE,'status.json'),'utf8').then(JSON.parse)
  ]);
  const archives=new Map();
  for(const name of names.filter(x=>/^[1-9]\d*\.json$/.test(x))){
    const id=Number(name.slice(0,-5));
    if(!positive(id))throw Error('Nom de fichier TMDB invalide '+name);
    archives.set(id,JSON.parse(await readFile(join(STORE,name),'utf8')));
  }
  return {collections,archives,status};
}

async function main(){
  const output=process.argv.find(x=>x.startsWith('--output='))?.slice('--output='.length);
  if(!output)throw Error('Indique --output=/chemin/rapport.json, sans écriture dans les collections');
  const {collections,archives,status}=await loadEmergencyInputs();
  const document=emergencyRecovery(collections,archives,status);
  const path=resolve(output);
  // Les artefacts doivent rester hors des collections et du dépôt actif :
  // préférer $RUNNER_TEMP dans CI, pas un fichier de production.
  if(path.startsWith(join(ROOT,'collections')+'/'))throw Error('Écriture dans les collections interdite');
  await mkdir(dirname(path),{recursive:true});
  await writeFile(path,JSON.stringify(document,null,2)+'\n','utf8');
  console.log('TMDB_RECOVERY='+JSON.stringify({
    coverage:document.coverage,blockers:document.tmdb_blockers,
    trakt_archived:false,addons_self_hosted:false,output:path
  }));
  if(document.tmdb_blockers.length!==1)throw Error('Couverture TMDB changée : vérifier le rapport');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{console.error('EXPORT_DE_SECOURS_REFUSÉ : '+error.message);process.exitCode=1});
}
