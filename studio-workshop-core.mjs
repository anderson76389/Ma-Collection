/**
 * Ma-Collection · outils indépendants du Studio.
 * Nettoyage ordonné et personnalisations de plusieurs dossiers à la fois.
 * Aucune requête réseau, aucun accès aux comptes, jamais de suppression.
 */
export const WORKSHOP_SHAPES=Object.freeze(['POSTER','LANDSCAPE','SQUARE']);
export const studioFolderKey=(sectionId,folderId)=>JSON.stringify([String(sectionId),String(folderId)]);
const active=(section,folder)=>section?.enabled!==false&&folder?.enabled!==false&&
  Array.isArray(folder?.selectedKeys)&&folder.selectedKeys.length>0;
const list=items=>Array.isArray(items)?items:[];

function sortCopy(items,comparator){
  return items.map((item,index)=>({item,index})).sort((a,b)=>
    comparator(a.item,b.item)||a.index-b.index).map(x=>x.item);
}
export function studioTidy(draft,options={},dryRun=true){
  if(!Array.isArray(draft?.sections))throw Error('Profil incompatible');
  const mode=options.mode||'active-first';
  if(!['active-first','alphabetical'].includes(mode))throw Error('Mode de rangement inconnu');
  const orderSections=options.sections!==false,orderFolders=options.folders!==false;
  const fr=(a,b)=>String(a||'').localeCompare(String(b||''),'fr',{sensitivity:'base',numeric:true});
  const foldersFirst=(section)=>(a,b)=>{
    if(mode==='alphabetical')return fr(a?.label,b?.label);
    return Number(active(section,b))-Number(active(section,a));
  };
  const sectionFirst=(a,b)=>{
    if(mode==='alphabetical')return fr(a?.label,b?.label);
    const on=(s)=>s?.enabled!==false&&list(s.folders).some(f=>active(s,f));
    return Number(on(b))-Number(on(a));
  };
  const current=draft.sections,ordered=orderSections?sortCopy(current,sectionFirst):[...current];
  const countMoves=(before,after)=>before.reduce((n,x,i)=>n+(after[i]!==x?1:0),0);
  let sectionsMoved=countMoves(current,ordered),foldersMoved=0;
  const examples=[];
  for(const section of current){
    const arr=list(section.folders);
    const sorted=orderFolders?sortCopy(arr,foldersFirst(section)):[...arr];
    const moved=countMoves(arr,sorted);
    foldersMoved+=moved;
    if(moved&&examples.length<12)examples.push(String(section.label||'Section')+' : '+moved+' dossier(s) déplacé(s)');
    if(!dryRun&&orderFolders&&Array.isArray(section.folders))section.folders.splice(0,section.folders.length,...sorted);
  }
  if(!dryRun&&orderSections)current.splice(0,current.length,...ordered);
  return {mode,sectionsMoved,foldersMoved,changed:sectionsMoved+foldersMoved,examples};
}

function getTargets(draft,keys){
  if(!Array.isArray(draft?.sections))throw Error('Profil incompatible');
  if(!Array.isArray(keys)||keys.length===0||keys.length>300)throw Error('Sélectionne entre 1 et 300 dossiers.');
  const index=new Map();
  for(const section of draft.sections)for(const folder of list(section.folders)){
    index.set(studioFolderKey(section.id,folder.id),folder);
  }
  const unique=[...new Set(keys)],targets=unique.map(k=>index.get(k)).filter(Boolean);
  if(targets.length!==unique.length)throw Error('Sélection expirée : certains dossiers ne sont plus disponibles.');
  return targets;
}

/**
 * Opérations atomiques sur le brouillon seulement.
 * Aucun visuel copié par défaut : copyArtwork doit être explicitement activé.
 */
export function studioApplyBatch(draft,keys,settings={}){
  const targets=getTargets(draft,keys);
  const patches={};
  if(settings.shape!==undefined){
    if(!WORKSHOP_SHAPES.includes(settings.shape))throw Error('Format non reconnu');
    patches.shape=settings.shape;
  }
  for(const prop of ['hideTitle','focusGlowEnabled','focusGifEnabled']){
    if(settings[prop]!==undefined){
      if(typeof settings[prop]!=='boolean')throw Error('Option d’affichage invalide');
      patches[prop]=settings[prop];
    }
  }
  if(settings.copyFrom!==undefined){
    const srcKey=settings.copyFrom;
    const source=getTargets(draft,[srcKey])[0];
    for(const prop of ['shape','hideTitle','focusGlowEnabled','focusGifEnabled'])patches[prop]=source[prop];
    if(settings.copyArtwork===true){
      const fields=['coverImageUrl','heroBackdropUrl','titleLogoUrl','focusGifUrl'];
      patches.artwork=Object.fromEntries(fields.map(k=>[k,String(source.artwork?.[k]||'')]));
    }
  } else if(settings.copyArtwork===true){
    throw Error('Sélectionne un dossier source avant de copier ses visuels.');
  }
  if(!Object.keys(patches).length)throw Error('Choisis au moins une modification.');
  let changed=0;
  for(const folder of targets){
    let diff=false;
    for(const [key,value] of Object.entries(patches)){
      if(key==='artwork'){
        const current=folder.artwork||{};
        if(Object.keys(value).some(k=>String(current[k]||'')!==value[k])){
          folder.artwork={...current,...value};diff=true;
        }
      }else if(folder[key]!==value){
        folder[key]=value;diff=true;
      }
    }
    if(diff)changed++;
  }
  return {selected:targets.length,changed};
}
