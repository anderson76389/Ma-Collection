/**
 * Ma-Collection — Sélecteur de visuels indépendants existants.
 * Réutilise seulement les images déjà présentes dans les catalogues locaux et
 * leurs variantes. N'expose PAS les fichiers du dépôt privé Ma-Art.
 * Aucun accès à Kaptain, aucune URL construite vers ses domaines.
 */
import {assetUrl,folderId} from './studio-avance-core.mjs';

export const ARTWORK_KINDS=Object.freeze({
  cover:{label:'Affiches',field:'coverImageUrl',action:'Utiliser comme affiche'},
  backdrop:{label:'Fonds',field:'heroBackdropUrl',action:'Utiliser comme fond'},
  logo:{label:'Logos',field:'titleLogoUrl',action:'Utiliser comme logo'},
  animation:{label:'Animations',field:'focusGifUrl',action:'Utiliser comme animation'}
});
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').trim();
const safeUrl=value=>{try{return assetUrl(value);}catch{return '';}};

/** Relevé des visuels réellement connus du catalogue courant et du brouillon. */
export function listStudioArtworks(draft,originals={}){
  if(!Array.isArray(draft?.sections))return [];
  const entries=[],seen=new Set();
  function add(url,kind,category,folder,fid,origin){
    const safe=safeUrl(url);
    if(!safe || !ARTWORK_KINDS[kind])return;
    const key=JSON.stringify([kind,safe,fid]);
    if(seen.has(key))return;
    seen.add(key);
    entries.push({
      id:key,url:safe,kind,kindLabel:ARTWORK_KINDS[kind].label,origin,
      sectionId:String(category.id||''),
      sectionLabel:String(category.label||''),
      folderId:fid,folderLabel:String(folder.label||''),
      shape:String(folder.shape||'LANDSCAPE')
    });
  }
  for(const category of draft.sections){
    for(const folder of Array.isArray(category.folders)?category.folders:[]){
      const fid=String(folder.id||'');
      if(!fid)continue;
      const base=originals[folderId(folder)]||{};
      for(const [kind,field] of Object.entries(ARTWORK_KINDS).map(([kind,obj])=>[kind,obj.field])){
        add(folder.artwork?.[field],kind,category,folder,fid,'Visuel actuel');
        add(base[field],kind,category,folder,fid,'Visuel d’origine');
      }
      for(const variant of Array.isArray(folder.looks)?folder.looks.slice(0,24):[]){
        add(variant?.url,'cover',category,folder,fid,String(variant?.label||'Variante').slice(0,50));
      }
    }
  }
  return entries;
}

export function searchStudioArtworks(entries,query='',options={}){
  const needle=norm(query),section=String(options.sectionId||'all');
  const kind=String(options.kind||'cover');
  const words=needle.split(/\s+/).filter(Boolean);
  const limit=Number.isFinite(options.limit)?Math.max(1,Math.min(200,Math.trunc(options.limit))):72;
  const filtered=(Array.isArray(entries)?entries:[]).filter(e=>
    (section==='all'||e.sectionId===section)&&
    (kind==='all'||e.kind===kind)&&
    words.every(w=>norm([e.sectionLabel,e.folderLabel,e.kindLabel,e.origin].join(' ')).includes(w))
  );
  return {total:filtered.length,results:filtered.slice(0,limit),omitted:Math.max(0,filtered.length-limit)};
}

/** Change uniquement le champ ciblé; jamais les sources et autres visuels. */
export function useStudioArtwork(draft,sectionId,folderIdValue,entry){
  if(!Array.isArray(draft?.sections))throw Error('Profil incompatible.');
  const section=draft.sections.find(s=>String(s.id)===String(sectionId));
  const folder=section?.folders?.find(f=>String(f.id)===String(folderIdValue));
  if(!folder)throw Error('Dossier cible introuvable.');
  const kind=ARTWORK_KINDS[String(entry?.kind||'')];
  if(!kind)throw Error('Type de visuel inconnu.');
  const url=assetUrl(entry?.url||'');
  if(!url)throw Error('Image vide.');
  folder.artwork ||= {};
  const previous=String(folder.artwork[kind.field]||'');
  if(previous===url)return {changed:false,url,kind:entry.kind};
  folder.artwork[kind.field]=url;
  if(entry.kind==='cover'){
    folder.looks ||= [];
    if(previous&&safeUrl(previous)&&!folder.looks.some(v=>v.url===previous))
      folder.looks.push({label:'Ancienne affiche',url:previous});
    if(!folder.looks.some(v=>v.url===url))
      folder.looks.push({label:String(entry.origin||'Bibliothèque').slice(0,40),url});
  }
  return {changed:true,url,kind:entry.kind};
}
