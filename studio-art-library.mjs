/**
 * Ma-Collection · bibliothèque de visuels réutilisables depuis les catalogues
 * et les variantes du navigateur. Aucun téléchargement ni API Kaptain.
 */
import {assetUrl,folderId} from './studio-avance-core.mjs';

const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').trim();
const safeUrl=value=>{
  try{return assetUrl(value);}
  catch{return '';}
};

/**
 * Les URLs sont conservées intégralement : aucune recompression, redimension ou
 * altération des fichiers d'images ou de GIF.
 */
export function listStudioArtworks(draft,originals={}){
  if(!Array.isArray(draft?.sections))return [];
  const entries=[],seen=new Set();
  function add(url,kind,category,folder,fid){
    const safe=safeUrl(url);
    if(!safe)return;
    const key=JSON.stringify([fid,safe]);
    if(seen.has(key))return;
    seen.add(key);
    entries.push({
      id:key,url:safe,kind,
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
      add(folder.artwork?.coverImageUrl,'Affiche actuelle',category,folder,fid);
      const baseline=originals[folderId(folder)]?.coverImageUrl;
      add(baseline,'Affiche d’origine',category,folder,fid);
      for(const variant of Array.isArray(folder.looks)?folder.looks.slice(0,24):[]){
        add(variant?.url,String(variant?.label||'Variante personnelle').slice(0,50),category,folder,fid);
      }
    }
  }
  return entries;
}

export function searchStudioArtworks(entries,query='',options={}){
  const needle=norm(query),section=String(options.sectionId||'all');
  const limit=Number.isFinite(options.limit)?Math.max(1,Math.min(200,Math.trunc(options.limit))):60;
  const filtered=(Array.isArray(entries)?entries:[]).filter(e=>
    (section==='all'||e.sectionId===section)&&
    (!needle||norm([e.sectionLabel,e.folderLabel,e.kind].join(' ')).includes(needle))
  );
  return {total:filtered.length,results:filtered.slice(0,limit),omitted:Math.max(0,filtered.length-limit)};
}

export function useStudioArtwork(draft,sectionId,folderIdValue,entry){
  if(!Array.isArray(draft?.sections))throw Error('Profil incompatible.');
  const section=draft.sections.find(s=>String(s.id)===String(sectionId));
  const folder=section?.folders?.find(f=>String(f.id)===String(folderIdValue));
  if(!folder)throw Error('Dossier cible introuvable.');
  const url=assetUrl(entry?.url||'');
  if(!url)throw Error('Image vide.');
  folder.artwork ||= {};
  const previous=String(folder.artwork.coverImageUrl||'');
  if(previous===url)return {changed:false,url};
  folder.artwork.coverImageUrl=url;
  // La bibliothèque personnelle mémorise les variantes, mais n'écrase jamais
  // un fond, un logo, un GIF, une source ou le format du dossier.
  if(previous && safeUrl(previous)){
    folder.looks ||= [];
    if(!folder.looks.some(v=>v.url===previous))folder.looks.push({label:'Ancienne affiche',url:previous});
  }
  folder.looks ||= [];
  if(!folder.looks.some(v=>v.url===url))folder.looks.push({
    label:String(entry.kind||'Bibliothèque').slice(0,40),url
  });
  return {changed:true,url};
}
