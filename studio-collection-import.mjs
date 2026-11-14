/** Offline inspection and explicit migration of collection backups to our own catalogue. */
import {isKaptainUrl} from './scripts/kaptain-url-policy.mjs';
import {captureDraft,sourceKey,folderId,STUDIO_FIELDS,assetUrl,validateDraft,applyDraft,originalsFor,decorateExport} from './studio-avance-core.mjs';
export const MAX_BACKUP_BYTES=16*1024*1024;
const arr=x=>Array.isArray(x)?x:[];
const sources=f=>arr(f.sources).length?f.sources:arr(f.catalogSources).map(s=>({...s,provider:'addon'}));
export function inspectCollectionBackup(input){
  if(!Array.isArray(input)||!input.length||input.length>100)throw Error('Une liste de 1 à 100 catégories est attendue.');
  const report={categories:input.length,folders:0,addonSources:0,tmdbSources:0,traktSources:0,otherSources:0,kaptainImages:0,emptyFolders:0,addonInstances:0};
  const addons=new Set(),ids=new Set();
  for(const c of input){
    if(!c||typeof c.id!=='string'||!c.id.trim()||ids.has(c.id)||!Array.isArray(c.folders))throw Error('Catégorie invalide ou identifiant en double.');
    ids.add(c.id);const folderIds=new Set();
    for(const f of c.folders){
      if(!f||typeof f.id!=='string'||!f.id.trim()||folderIds.has(f.id))throw Error('Dossier invalide ou identifiant en double.');
      folderIds.add(f.id);report.folders++;
      if(report.folders>10000)throw Error('Maximum 10 000 dossiers.');
      const list=sources(f);
      if(!list.length)report.emptyFolders++;
      for(const field of STUDIO_FIELDS)if(isKaptainUrl(f[field]))report.kaptainImages++;
      for(const s of list){
        if(s.provider==='tmdb')report.tmdbSources++;
        else if(s.provider==='trakt')report.traktSources++;
        else if(!s.provider||s.provider==='addon'){report.addonSources++;if(s.addonId)addons.add(s.addonId);}
        else report.otherSources++;
      }
    }
  }
  report.addonInstances=addons.size;
  return report;
}
/**
 * Re-select matching sources in our catalogue, keeping our own source definitions
 * and images. This is a migration, never a silent round-trip of a foreign backup.
 * Stable source IDs are preferred; titles are accepted only when unique.
 */
export function collectionBackupToDraft(input,catalogue){
  const report=inspectCollectionBackup(input);
  const draft=captureDraft(catalogue,{},'Collection importée');
  const sections=new Map(draft.sections.map(s=>[s.id,s]));
  const originals=new Map(catalogue.map(c=>[String(c.id),c]));
  const ordered=[],seen=new Set();
  Object.assign(report,{matchedFolders:0,unmatchedFolders:0,matchedSources:0,unmatchedSources:0,replacedKaptainImages:0});
  for(const c of input){
    const section=sections.get(c.id),original=originals.get(c.id);
    if(!section){report.unmatchedFolders+=c.folders.length;report.unmatchedSources+=c.folders.reduce((n,f)=>n+sources(f).length,0);continue;}
    seen.add(c.id);ordered.push(section);section.label=String(c.title||section.label);
    const folders=new Map(section.folders.map(f=>[f.id,f]));
    const originalFolders=new Map(original.folders.map(f=>[folderId(f),f]));
    const chosen=[],seenFolders=new Set();
    for(const f of c.folders){
      const target=folders.get(f.id),originalFolder=originalFolders.get(f.id);
      if(!target){report.unmatchedFolders++;report.unmatchedSources+=sources(f).length;continue;}
      report.matchedFolders++;seenFolders.add(f.id);chosen.push(target);
      target.label=String(f.title||target.label);target.enabled=true;
      const available=arr(originalFolder.sources);
      const keys=new Set();
      for(const incoming of sources(f)){
        const matches=available.filter(s=>incoming.id&&s.id===incoming.id);
        let match=matches.length===1?matches[0]:null;
        if(!match){
          const byTitle=available.filter(s=>sourceKey(s)===sourceKey(incoming));
          if(byTitle.length===1)match=byTitle[0];
        }
        if(match){keys.add(sourceKey(match));report.matchedSources++;}
        else report.unmatchedSources++;
      }
      target.selectedKeys=[...keys];
      target.shape=String(f.tileShape||target.shape).toUpperCase();
      for(const key of ['hideTitle','focusGifEnabled','focusGlowEnabled'])if(typeof f[key]==='boolean')target[key]=f[key];
      for(const field of STUDIO_FIELDS){
        if(isKaptainUrl(f[field])){report.replacedKaptainImages++;continue;}
        if(f[field]){try{target.artwork[field]=assetUrl(f[field]);}catch{/* retain our independent image */}}
      }
    }
    section.folders=[...chosen,...section.folders.filter(f=>!seenFolders.has(f.id))];
    section.enabled=chosen.some(f=>f.selectedKeys.length);
  }
  draft.sections=[...ordered,...draft.sections.filter(s=>!seen.has(s.id))];
  if(!report.matchedFolders)throw Error('Aucun dossier correspondant au catalogue local. Le fichier reste utilisable dans Kovelyx.');
  const safe=validateDraft(draft,catalogue);
  return {draft:safe,report,collection:exportMigratedCollection(safe,catalogue,input)};
}

/** Export only the selected rows and local source definitions, retaining no stale addon routes. */
export function exportMigratedCollection(draft,catalogue,backup=[]){
  const copy=JSON.parse(JSON.stringify(catalogue)),selected={};
  applyDraft(draft,copy,selected,originalsFor(copy));
  const incoming=new Map(backup.map(c=>[c.id,c]));
  const enabled=new Map(draft.sections.filter(s=>s.enabled).map(s=>[s.id,s]));
  return decorateExport(copy,draft).filter(c=>enabled.has(c.id)).map(c=>{
    const original=incoming.get(c.id);
    const result={...c,folders:c.folders.filter(f=>Object.values(selected[folderId(f)]||{}).some(Boolean)).map(f=>{
      const {catalogSources,...rest}=f;
      return {...rest,sources:arr(f.sources).filter(s=>selected[folderId(f)]?.[sourceKey(s)])};
    })};
    for(const key of ['pinToTop','showAllTab'])if(typeof original?.[key]==='boolean')result[key]=original[key];
    if(['TABBED_GRID','FOLLOW_LAYOUT','ROWS'].includes(original?.viewMode))result.viewMode=original.viewMode;
    return result;
  });
}
