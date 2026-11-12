/** Paquet de reprise local Ma-Collection : profils, historiques et thème, jamais les secrets. */
import {validateDraft,STUDIO_LIMIT,uid} from './studio-avance-core.mjs';
import {validateFrenchPack} from './studio-fr-art.mjs';
import {BACKUP_LIMIT} from './studio-backups.mjs';
export const RECOVERY_SCHEMA = 1;
const THEMES = new Set(['dark','light','high-contrast']);
const cleanProfile = (p,c) => validateDraft(p,c);
const safeTime = v => {
  const t = new Date(v);
  if (!Number.isFinite(t.getTime())) throw Error('Date de sauvegarde invalide');
  return t.toISOString();
};
function cleanHistory(input,catalogue) {
  if (!Array.isArray(input) || input.length > BACKUP_LIMIT) throw Error('Trop de sauvegardes Studio');
  const ids=new Set();
  return input.map(row=>{
    if(row?.schema!==1||!['manual','before-apply'].includes(row.kind)||
       typeof row.id!=='string'||!row.id.startsWith('backup-mc-')||ids.has(row.id))
      throw Error('Historique Studio invalide ou en double');
    ids.add(row.id);
    const profile=cleanProfile(row.profile,catalogue);
    return {schema:1,id:row.id,kind:row.kind,name:profile.name,
      createdAt:safeTime(row.createdAt),profile};
  });
}
export function buildRecoveryPackage({draft,profiles=[],backups=[],theme='dark',frPack=null},catalogue,createdAt=new Date()) {
  if(!Array.isArray(profiles)||profiles.length>STUDIO_LIMIT)throw Error('Trop de profils Studio');
  const safeProfiles=profiles.map(p=>cleanProfile(p,catalogue));
  if(new Set(safeProfiles.map(p=>p.id)).size!==safeProfiles.length)throw Error('Profils en double');
  const current=cleanProfile(draft,catalogue);
  const safeBackups=cleanHistory(backups,catalogue);
  const cover=frPack?validateFrenchPack(frPack,current):null;
  const date=safeTime(createdAt);
  return {schema:RECOVERY_SCHEMA,kind:'ma-collection-studio-recovery',
    createdAt:date,theme:THEMES.has(theme)?theme:'dark',
    draft:current,profiles:safeProfiles,backups:safeBackups,frPack:cover,
    notice:'Contient les profils et affiches locales, mais jamais les jetons API, mots de passe, sessions ni le coffre chiffré.'};
}
export function validateRecoveryPackage(input,catalogue) {
  if(!input || input.schema!==RECOVERY_SCHEMA || input.kind!=='ma-collection-studio-recovery')
    throw Error('Archive Studio incompatible');
  if(!THEMES.has(input.theme))throw Error('Thème de sauvegarde invalide');
  return buildRecoveryPackage(input,catalogue,input.createdAt);
}
export function planRecoveryMerge(existing,incoming,max=STUDIO_LIMIT) {
  if(!Array.isArray(existing)||!Array.isArray(incoming))throw Error('Profils manquants');
  const kept=[...existing],ids=new Set(kept.map(x=>x.id));
  const additional=[];
  for(const profile of incoming){
    const originalId=profile.id;
    if(ids.has(originalId)){
      const old=kept.find(x=>x.id===originalId);
      if(JSON.stringify(old)===JSON.stringify(profile))continue;
    }
    if(kept.length+additional.length>=max)throw Error('Capacité atteinte : exporte ou retire un profil avant import, aucune donnée modifiée');
    const fresh={...profile,id:ids.has(originalId)?uid():originalId,
      name:ids.has(originalId)?String(profile.name+' (restauré)').slice(0,60):profile.name};
    while(ids.has(fresh.id))fresh.id=uid();
    ids.add(fresh.id);additional.push(fresh);
  }
  return {profiles:[...kept,...additional],added:additional.length};
}
