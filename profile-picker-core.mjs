/**
 * Sélecteur de profils Ma-Collection : données réelles du compte Kovelyx.
 * Aucun profil fictif, aucune image Kaptain et aucune clé de session stockée.
 */
import {captureSuiteProfile,validateSuiteProfile} from './profile-suite-model.mjs';
import {validateProfile,safeProfileImage,profileSources} from './profile-editor-core.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const text=(s,max=80)=>String(s??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
const number=(...values)=>{
  const x=values.find(v=>Number.isSafeInteger(v)&&v>=0);
  return x===undefined?null:x;
};
export function normalizeKovelyxProfiles(payload){
  if(!payload||!Array.isArray(payload.profiles))throw Error('Liste de profils Kovelyx invalide.');
  const found=new Set();
  return payload.profiles.slice(0,100).flatMap(raw=>{
    const id=String(raw?.id||'');
    if(!UUID.test(id)||found.has(id))return [];
    found.add(id);
    return [{
      id,
      name:text(raw.displayName||raw.name||raw.title,60)||'Profil Kovelyx',
      avatar:safeProfileImage(raw.avatarUrl||raw.avatar||raw.imageUrl||''),
      rows:number(raw.categoriesCount,raw.rowCount,raw.rowsCount,raw.categories),
      folders:number(raw.foldersCount,raw.folderCount,raw.totalFolders),
      kind:'cloud'
    }];
  });
}
export function makeKovelyxLocalCopy(meta,snapshot){
  if(!meta||!UUID.test(meta.id))throw Error('Identifiant Kovelyx invalide.');
  const collections=validateProfile(snapshot?.collections);
  const sections=collections.map(row=>({
    id:row.id,label:row.title,enabled:row.enabled!==false&&row.hidden!==true,
    folders:row.folders.map(folder=>({
      id:folder.id,label:folder.title,
      enabled:folder.enabled!==false&&folder.hidden!==true,
      selectedKeys:profileSources(folder).map((_,i)=>String(i)),
      artwork:{coverImageUrl:folder.coverImageUrl||''}
    }))
  }));
  const profile=captureSuiteProfile({sections},meta.name);
  profile.id='mcps-cloud-'+meta.id;
  profile.name=meta.name;
  profile.avatar=meta.avatar||'';
  // Cette copie est une prévisualisation locale. Le cloud est publié exclusivement
  // depuis l'éditeur Kovelyx qui vérifie ses révisions et relit les collections.
  return validateSuiteProfile(profile);
}
export function accountDisplayName(email){
  const value=text(email,160);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?value:'Compte connecté';
}
