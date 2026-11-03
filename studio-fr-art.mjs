/**
 * Packs d'illustrations FR de Ma-Collection, exclusivement auto-hébergés.
 * Le Studio ne télécharge jamais de manifeste ou d'image chez Kaptain.
 * Le pack contient des URL HTTPS ; aucun fichier de Kaptain n'est redistribué.
 */
import {assetUrl} from './studio-avance-core.mjs';

export const FR_ART_SCHEMA=1;
export const FR_ART_MAX=3000;
const STYLE=/^[a-z][a-z0-9-]{0,35}$/;
const PLAIN=x=>!!x&&typeof x==='object'&&!Array.isArray(x);

function ownArtUrl(input){
  const url=assetUrl(input);
  if(!url)throw Error('Adresse d’illustration française manquante.');
  const u=new URL(url);
  const host=u.hostname.toLowerCase(),path=decodeURIComponent(u.pathname).toLowerCase();
  if(host==='art.kaptain.stream'||host==='kaptain.stream'||host.endsWith('.kaptain.stream')||
     host==='imkaptain.github.io'||
     (['raw.githubusercontent.com','github.com','api.github.com'].includes(host)&&
       /^\/(?:repos\/)?imkaptain(?:\/|$)/.test(path))||
     (host==='cdn.jsdelivr.net'&&/(?:^|\/)imkaptain(?:\/|@|$)/.test(path))){
    throw Error('Pack refusé : les affiches doivent être indépendantes de Kaptain.');
  }
  return url;
}
const assertId=value=>{
  const s=String(value||'');
  if(!s||s.length>120||/[<>\u0000-\u001f]/.test(s))throw Error('Identifiant de catégorie ou dossier incorrect.');
  return s;
};
const frLabel=value=>{
  const s=String(value??'').trim();
  if(s.length>120||/[<>\u0000-\u001f]/.test(s))throw Error('Libellé français incompatible.');
  return s;
};
export function frenchPackTemplate(draft,translate=x=>x){
  if(!Array.isArray(draft?.sections))throw Error('Brouillon de profil introuvable.');
  const entries=[];
  for(const section of draft.sections||[])for(const folder of section.folders||[]){
    entries.push({
      sectionId:assertId(section.id),folderId:assertId(folder.id),
      sectionLabel:frLabel(translate(section.label)),labelFr:frLabel(translate(folder.label)),
      style:'fr-classique',coverImageUrl:'',focusGifUrl:''
    });
  }
  return {
    schema:FR_ART_SCHEMA,language:'fr',
    name:'Mes affiches françaises · Ma-Art',
    styles:[{id:'fr-classique',label:'Classique français'}],entries
  };
}
export function validateFrenchPack(raw,draft){
  if(!PLAIN(raw)||raw.schema!==FR_ART_SCHEMA||raw.language!=='fr'||
     !Array.isArray(raw.styles)||!raw.styles.length||raw.styles.length>24||
     !Array.isArray(raw.entries)||raw.entries.length>FR_ART_MAX)throw Error('Pack français incompatible.');
  const known=new Set();
  for(const s of draft?.sections||[])for(const f of s.folders||[])
    known.add(JSON.stringify([String(s.id),String(f.id)]));
  if(!known.size)throw Error('La collection n’est pas chargée.');
  const styles=[],names=new Set();
  for(const style of raw.styles){
    const id=String(style?.id||''),label=frLabel(style?.label||'');
    if(!STYLE.test(id)||!label||names.has(id))throw Error('Style français invalide ou en double.');
    names.add(id);styles.push({id,label});
  }
  const entries=[],used=new Set();
  for(const e of raw.entries){
    if(!PLAIN(e))throw Error('Entrée de pack invalide.');
    const sectionId=assertId(e.sectionId),folderId=assertId(e.folderId),style=String(e.style||'');
    const key=JSON.stringify([sectionId,folderId]);
    if(!known.has(key))continue; // Nouveaux catalogues : ne rien supprimer.
    if(!names.has(style))throw Error('Style de pack inconnu.');
    const original=String(e.coverImageUrl||'').trim();
    if(!original)continue; // Modèle non rempli : pas de fausse affiche.
    const coverImageUrl=ownArtUrl(original);
    const focusGifUrl=e.focusGifUrl?ownArtUrl(e.focusGifUrl):'';
    const identity=JSON.stringify([key,style]);
    if(used.has(identity))throw Error('Même dossier répété dans un style.');
    used.add(identity);
    entries.push({sectionId,folderId,style,coverImageUrl,focusGifUrl});
  }
  return {schema:FR_ART_SCHEMA,language:'fr',name:frLabel(raw.name||'Pack français'),
    styles,entries};
}
export function planFrenchPack(draft,pack,options={}){
  const style=String(options.style||pack?.styles?.[0]?.id||'');
  if(!pack?.styles?.some(x=>x.id===style))throw Error('Choisis un style du pack français.');
  const section=String(options.sectionId||'all'),activeOnly=options.activeOnly!==false;
  const match=new Map(pack.entries.filter(x=>x.style===style)
    .map(x=>[JSON.stringify([x.sectionId,x.folderId]),x]));
  let eligible=0,available=0,unchanged=0;
  const changes=[],examples=[];
  for(const s of draft?.sections||[]){
    if(section!=='all'&&section!==String(s.id))continue;
    for(const f of s.folders||[]){
      if(activeOnly&&(!s.enabled||!f.enabled||!(f.selectedKeys||[]).length))continue;
      eligible++;
      const item=match.get(JSON.stringify([String(s.id),String(f.id)]));
      if(!item)continue;
      available++;
      if(String(f.artwork?.coverImageUrl||'')===item.coverImageUrl){
        unchanged++;continue;
      }
      changes.push({sectionId:s.id,folderId:f.id,label:f.label,
        before:String(f.artwork?.coverImageUrl||''),after:item.coverImageUrl,
        focusGifUrl:item.focusGifUrl});
      if(examples.length<16)examples.push({label:String(f.label||''),before:String(f.artwork?.coverImageUrl||''),after:item.coverImageUrl});
    }
  }
  return {style,eligible,available,missing:eligible-available,unchanged,changes,examples};
}
export function applyFrenchPack(draft,pack,options={}){
  const plan=planFrenchPack(draft,pack,options);
  const targets=new Map();
  for(const s of draft.sections)for(const f of s.folders||[])
    targets.set(JSON.stringify([s.id,f.id]),f);
  // Tous les éléments sont déjà validés par le plan ; aucune mutation partielle.
  for(const item of plan.changes){
    const f=targets.get(JSON.stringify([item.sectionId,item.folderId]));
    f.artwork ||= {};
    f.artwork.coverImageUrl=item.after;
    if(item.focusGifUrl)f.artwork.focusGifUrl=item.focusGifUrl;
    f.looks ||= [];
    if(item.before&&!f.looks.some(v=>v.url===item.before)&&f.looks.length<24)
      f.looks.push({label:'Affiche avant pack français',url:item.before});
  }
  return {...plan,changed:plan.changes.length};
}
