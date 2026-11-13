#!/usr/bin/env node
/**
 * Inventaire exploitable des sources externes, entièrement hors réseau.
 * Aucune liste Trakt copiée, aucune configuration de collection modifiée.
 * Le rapport sert à prioriser les vérifications de propriété et d'instances.
 */
import {readCollections} from './tmdb-own-lists.mjs';
import {currentCatalogAudit} from './audit-catalogue-provenance.mjs';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const valid=n=>Number.isSafeInteger(n)&&n>0;
export function triageDependencies(collections,provenance){
  const missing=new Set(provenance.tmdb.missing);
  const groups=new Map();
  let total=0;
  for(const [file,categories] of collections){
    for(const category of categories){
      for(const folder of category.folders||[]){
        for(const source of folder.sources||[]){
          let kind=null,id=null,priority=null,why=null;
          if(source.provider==='tmdb'&&source.tmdbSourceType==='LIST'){
            const parsed=Number(source.tmdbId);
            if(!valid(parsed)||!missing.has(parsed))continue;
            kind='tmdb_absente';id=String(parsed);priority=1;
            why='archive manquante : contrôler la liste originale ; ne pas inventer de titres';
          }else if(source.provider==='trakt'){
            kind='trakt_tiers';id=String(source.traktListId);priority=2;
            why='vérifier le propriétaire ; une liste communautaire ne peut pas être recopiée automatiquement';
          }else if(source.provider==='addon'){
            kind='addon_tiers';id=String(source.addonId||'')+'::'+String(source.catalogId||'');
            priority=2;
            why='vérifier les licences, la disponibilité et une instance propriétaire sans migrer à l’aveugle';
          }else continue;
          total++;
          const key=kind+':'+id;
          if(!groups.has(key))groups.set(key,{
            type:kind,id,priority,reason:why,references:0,locations:[],
            automaticallyMigrated:false,ownershipVerified:false
          });
          const row=groups.get(key);
          row.references++;
          row.locations.push({file,categoryId:String(category.id||''),folderId:String(folder.id||'')});
        }
      }
    }
  }
  const issues=[...groups.values()].sort((a,b)=>a.priority-b.priority||
    b.references-a.references||a.type.localeCompare(b.type)||a.id.localeCompare(b.id));
  const actual=issues.reduce((v,x)=>v+x.references,0);
  if(actual!==total)throw Error('Inventaire incomplet');
  const summed=Object.fromEntries(['tmdb_absente','trakt_tiers','addon_tiers'].map(type=>
    [type,issues.filter(x=>x.type===type).reduce((sum,x)=>sum+x.references,0)]));
  if(summed.trakt_tiers!==provenance.trakt.references||
     summed.addon_tiers!==provenance.addons.references)
    throw Error('Incohérence entre sources tierces et inventaire provenance');
  if(new Set(issues.filter(x=>x.type==='tmdb_absente').map(x=>Number(x.id))).size!==
    provenance.tmdb.missing.length)throw Error('Archive absente non recensée');
  return {schema:1,mode:'audit_read_only_no_migration',totalReferences:total,
    counts:summed,issues,autoMigration:false,
    notes:[
      'Les listes Trakt communautaires ne sont pas archivées automatiquement.',
      'Les addons n’ont pas de garantie d’autohébergement tant que les instances ne sont pas contrôlées.',
      'Aucune collection active ni aucun identifiant n’est modifié.'
    ]};
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  try{
    const report=triageDependencies(await readCollections(),await currentCatalogAudit());
    const dest=process.argv.find(x=>x.startsWith('--output='))?.slice(9);
    if(dest)await writeFile(resolve(dest),JSON.stringify(report,null,2)+'\n');
    console.log('SOURCES_EXTERNES_AUDITEES '+JSON.stringify({
      total:report.totalReferences,types:report.counts,distinct:report.issues.length,
      unchanged:true,output:!!dest
    }));
  }catch(error){
    console.error('SOURCES_EXTERNES_AUDIT_FAILED '+error.message);
    process.exitCode=1;
  }
}
