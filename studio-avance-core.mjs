/**
 * Ma-Collection Studio — moteur de préréglages indépendant du DOM.
 * Ne change jamais les identifiants, les sources, les filtres ni les API.
 * Les renommages sont réservés aux exports pour préserver les règles de l'application.
 */
export const STUDIO_SCHEMA = 1;
export const STUDIO_LIMIT = 10;
export const STUDIO_FIELDS = Object.freeze([
  'coverImageUrl','heroBackdropUrl','titleLogoUrl','focusGifUrl'
]);
export const STUDIO_SHAPES = Object.freeze(['POSTER','LANDSCAPE','SQUARE']);
// Les URL importées via profils ou packs français peuvent cacher un lien Kaptain
// derrière un CDN, un proxy ou une URL encodée.
const banned = /^api\.nuvio\.tv$/i;
const OWN_ART_HOST = 'ma-art.mailpromahe.workers.dev';
export function isKaptainHostedUrl(input) {
  let url;
  try { url = input instanceof URL ? input : new URL(String(input)); }
  catch { return false; }
  const host = url.hostname.toLowerCase();
  if (host === 'kaptain.stream' || host.endsWith('.kaptain.stream') ||
      host === 'imkaptain.github.io' || host.endsWith('.imkaptain.github.io') ||
      (host === 'api.nuvio.tv' && /kaptain/i.test(url.pathname))) return true;
  // "imkaptain.github.io" dans ce chemin est une étiquette d'archive locale.
  if (host === OWN_ART_HOST) return false;
  let locator = url.pathname + url.search + url.hash;
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(locator);
      if (decoded === locator) break;
      locator = decoded;
    } catch { break; }
  }
  // Couvre notamment GitHub, jsDelivr, GitHack et les proxies d'images.
  const owner = new RegExp('(?:^|[/?&=:@])imkaptain(?:[/?&#=:@.]|$)', 'i');
  const domain = new RegExp('(?:^|[^a-z0-9-])(?:[a-z0-9-]+[.])*kaptain[.]stream(?:[^a-z0-9-]|$)', 'i');
  return owner.test(locator) || domain.test(locator);
}
export function assetUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.length > 1700) throw Error('URL trop longue');
  let url;
  try { url = new URL(raw); } catch { throw Error('Adresse incorrecte'); }
  if (url.protocol !== 'https:' || url.username || url.password || banned.test(url.hostname) || isKaptainHostedUrl(url))
    throw Error('Image HTTPS indépendante requise (pas de lien Kaptain)');
  if (!/\.(?:jpe?g|png|webp|gif|avif|svg)(?:$|[?#])/i.test(url.pathname+url.search+url.hash) &&
      !url.hostname.endsWith('workers.dev'))
    throw Error('Le lien doit pointer vers une image');
  return url.href;
}
export function cleanLabel(value, limit = 85) {
  const text = String(value ?? '').trim().replace(/[\u0000-\u001f<>]/g, '');
  if (!text || text.length > limit) throw Error('Nom vide ou trop long');
  return text;
}
export const folderId = folder => String(folder?.id || folder?.title || '');
export const sourceKey = source => String(source?.title || source?.catalogId || 'Default Source');
const plain = o => o && typeof o === 'object' && !Array.isArray(o);
export const uid = () => 'mc-'+Math.random().toString(36).slice(2,10)+Date.now().toString(36);
const fields = folder => Object.fromEntries(STUDIO_FIELDS.map(k => [k, String(folder?.[k] || '')]));
export function captureDraft(categories, selection, name = 'Mon profil') {
  const selected = plain(selection) ? selection : {};
  return {
    schema: STUDIO_SCHEMA, id: uid(), name: cleanLabel(name,60),
    updatedAt: new Date().toISOString(), avatarUrl: '', syncQuickEditor: false,
    sections: (categories || []).map(cat => ({
      id: String(cat.id || ''),
      label: String(cat.title || ''),
      enabled: (cat.folders || []).some(f=>(f.sources||[]).some(s=>selected[folderId(f)]?.[sourceKey(s)])),
      folders: (cat.folders || []).map(f=>({
        id:folderId(f), label:String(f.title||''),
        enabled:(f.sources||[]).some(s=>selected[folderId(f)]?.[sourceKey(s)]),
        selectedKeys:(f.sources||[]).filter(s=>selected[folderId(f)]?.[sourceKey(s)]).map(sourceKey),
        artwork:fields(f), shape:STUDIO_SHAPES.includes(f.tileShape)?f.tileShape:'LANDSCAPE',
        hideTitle:!!f.hideTitle, focusGlowEnabled:!!f.focusGlowEnabled,
        focusGifEnabled:!!f.focusGifEnabled, looks:[]
      }))
    }))
  };
}
export function validateDraft(input, catalogue) {
  if (!plain(input) || input.schema !== STUDIO_SCHEMA || !Array.isArray(input.sections) ||
      input.sections.length > 100) throw Error('Fichier de profil incompatible');
  const allowedSections = new Map((catalogue||[]).map(cat=>[String(cat.id),cat]));
  const sections=[], seenSections=new Set();
  for (const incoming of input.sections) {
    const id=String(incoming?.id||'');
    if (!allowedSections.has(id) || seenSections.has(id)) continue;
    seenSections.add(id);
    const real=allowedSections.get(id), avail=new Map((real.folders||[]).map(f=>[folderId(f),f]));
    const folders=[], used=new Set();
    for (const row of Array.isArray(incoming.folders)?incoming.folders.slice(0,2000):[]) {
      const fid=String(row?.id||'');
      if (!avail.has(fid) || used.has(fid)) continue;
      used.add(fid);
      const f=avail.get(fid),keys=new Set((f.sources||[]).map(sourceKey));
      const selectedKeys=[...new Set((Array.isArray(row.selectedKeys)?row.selectedKeys:[])
        .filter(k=>typeof k==='string'&&keys.has(k)))];
      const artwork={};
      for(const field of STUDIO_FIELDS) artwork[field]=assetUrl(row.artwork?.[field]||'');
      folders.push({
        id:fid,label:cleanLabel(row.label || f.title),
        enabled:row.enabled !== false,selectedKeys,
        artwork,shape:STUDIO_SHAPES.includes(row.shape)?row.shape:(f.tileShape||'LANDSCAPE'),
        hideTitle:!!row.hideTitle,focusGlowEnabled:!!row.focusGlowEnabled,
        focusGifEnabled:!!row.focusGifEnabled,
        looks:(Array.isArray(row.looks)?row.looks.slice(0,24):[])
          .map(item=>({label:cleanLabel(item?.label||'Image',40),url:assetUrl(item?.url||'')}))
          .filter(item=>item.url)
      });
    }
    sections.push({
      id,label:cleanLabel(incoming.label||real.title),
      enabled:incoming.enabled!==false,folders
    });
  }
  if(!sections.length)throw Error('Aucune section correspondant à Ma-Collection');
  return {
    schema:STUDIO_SCHEMA,
    id:/^mc-[a-z0-9]{8,30}$/.test(String(input.id||''))?input.id:uid(),
    name:cleanLabel(input.name||'Profil importé',60),
    updatedAt:new Date().toISOString(),
    avatarUrl:assetUrl(input.avatarUrl||''),syncQuickEditor:!!input.syncQuickEditor,sections
  };
}
const order = (array, ids, getter) => {
  const m=new Map(array.map(el=>[getter(el),el])),seen=new Set();
  const chosen=[];
  for(const id of ids){if(!m.has(id)||seen.has(id))continue;chosen.push(m.get(id));seen.add(id);}
  for(const el of array){if(!seen.has(getter(el)))chosen.push(el);}
  array.splice(0,array.length,...chosen);
};
export function applyDraft(draft, categories, selection, originals = {}) {
  // Validation avant toute mutation, puis application sans remplacement des objets d'origine.
  const safe=validateDraft(draft,categories);
  const sourceSelection=plain(selection)?selection:{};
  const sectionMap=new Map(safe.sections.map(s=>[s.id,s]));
  order(categories,safe.sections.map(s=>s.id),x=>String(x.id));
  for(const cat of categories){
    const section=sectionMap.get(String(cat.id));
    if(!section)continue;
    const fm=new Map(section.folders.map(f=>[f.id,f]));
    order(cat.folders||[],section.folders.map(f=>f.id),folderId);
    for(const f of cat.folders||[]){
      const p=fm.get(folderId(f));
      if(!p)continue;
      const baseline=originals[folderId(f)]||null;
      for(const field of STUDIO_FIELDS){
        if(baseline && Object.hasOwn(baseline,field)) f[field]=baseline[field];
        if(p.artwork[field]) f[field]=p.artwork[field];
        else if(baseline && !baseline[field]) delete f[field];
      }
      f.tileShape=p.shape;
      f.hideTitle=p.hideTitle;
      f.focusGlowEnabled=p.focusGlowEnabled;
      f.focusGifEnabled=p.focusGifEnabled;
      // Ne remplace jamais l'objet window.selectedMap, déjà partagé avec les éditeurs.
      const target=sourceSelection[folderId(f)] ||= {};
      const keep=new Set(p.selectedKeys);
      for(const src of f.sources||[]) target[sourceKey(src)] = !!section.enabled && !!p.enabled && keep.has(sourceKey(src));
    }
  }
  return safe;
}
export function originalsFor(categories) {
  const result={};
  for(const c of categories||[])for(const f of c.folders||[]){
    result[folderId(f)]={...fields(f),tileShape:f.tileShape,hideTitle:f.hideTitle,focusGlowEnabled:f.focusGlowEnabled,focusGifEnabled:f.focusGifEnabled};
  }
  return result;
}
export function decorateExport(data, draft) {
  if(!Array.isArray(data)||!draft?.sections) return data;
  const sm=new Map(draft.sections.map(c=>[c.id,c]));
  return data.map(cat=>{
    const section=sm.get(String(cat.id));if(!section)return cat;
    const cm=new Map(section.folders.map(f=>[f.id,f]));
    return {...cat,title:section.label,
      folders:(cat.folders||[]).map(f=>{
        const custom=cm.get(folderId(f));if(!custom)return f;
        return {...f,title:custom.label};
      })
    };
  });
}

/**
 * Aperçu indépendant de l'écran d'accueil. Ne modifie jamais les catégories,
 * les sélections ni les objets métier de Ma-Collection.
 */
export function previewLayout(draft, originals = {}, maxPerSection = 24) {
  if (!Array.isArray(draft?.sections)) return [];
  const limit = Number.isFinite(maxPerSection)
    ? Math.max(1, Math.min(60, Math.trunc(maxPerSection))) : 24;
  return draft.sections.filter(s => s?.enabled !== false).map(s => {
    const active = (Array.isArray(s.folders) ? s.folders : [])
      .filter(f => f?.enabled !== false && Array.isArray(f.selectedKeys) && f.selectedKeys.length > 0);
    return {
      id: String(s.id || ''),
      label: String(s.label || ''),
      total: active.length,
      omitted: Math.max(0, active.length - limit),
      folders: active.slice(0, limit).map(f => ({
        id: String(f.id || ''),
        label: String(f.label || ''),
        sourceCount: f.selectedKeys.length,
        coverImageUrl: String(f.artwork?.coverImageUrl || originals?.[f.id]?.coverImageUrl || '')
      }))
    };
  }).filter(s => s.total > 0);
}


/**
 * Recherche globale dans un brouillon, indépendante de l'interface et du réseau.
 * Ne consulte ni Kaptain ni Nuvio. Les résultats sont plafonnés pour le DOM.
 */
export function searchDraft(draft, query, options = {}) {
  const norm = v => String(v ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim();
  const needle = norm(query);
  const limit = Number.isFinite(options.limit)
    ? Math.max(1,Math.min(200,Math.trunc(options.limit))) : 80;
  const activeOnly = !!options.activeOnly;
  const noCoverOnly = !!options.noCoverOnly;
  let total = 0;
  const results = [];
  for(const section of Array.isArray(draft?.sections) ? draft.sections : []){
    for(const folder of Array.isArray(section?.folders) ? section.folders : []){
      const sources = Array.isArray(folder?.selectedKeys) ? folder.selectedKeys : [];
      const active = section.enabled !== false && folder.enabled !== false && sources.length > 0;
      const cover = String(folder?.artwork?.coverImageUrl || '');
      if(activeOnly && !active) continue;
      if(noCoverOnly && cover) continue;
      const haystack = norm([section.label,folder.label,...sources].join(' '));
      if(needle && !haystack.includes(needle)) continue;
      total++;
      if(results.length < limit) results.push({
        sectionId:String(section.id||''),sectionLabel:String(section.label||''),
        folderId:String(folder.id||''),folderLabel:String(folder.label||''),
        active,sourceCount:sources.length,coverImageUrl:cover
      });
    }
  }
  return {total,results,omitted:Math.max(0,total-results.length)};
}

/**
 * Point de restauration temporaire de l'éditeur local. Les tableaux et objets
 * existants conservent leur identité pour les autres modules Ma-Collection.
 * Ne comprend ni les identifiants, ni les mots de passe, ni les clés API.
 */
export function captureStudioUndo(categories, selection) {
  const props=[...STUDIO_FIELDS,'tileShape','hideTitle','focusGlowEnabled','focusGifEnabled'];
  return {
    categoryOrder:[...categories],
    folderOrders:categories.map(c=>[c,Array.isArray(c.folders)?[...c.folders]:null]),
    values:categories.flatMap(c=>(c.folders||[]).map(f=>[
      f,Object.fromEntries(props.map(k=>[k,{present:Object.hasOwn(f,k),value:f[k]}]))
    ])),
    selection:Object.fromEntries(Object.entries(selection||{}).map(([k,v])=>[k,
      plain(v)?{...v}:v
    ]))
  };
}
export function restoreStudioUndo(snapshot, categories, selection) {
  if(!snapshot || !Array.isArray(snapshot.categoryOrder) || !Array.isArray(categories) ||
      !plain(selection)) throw Error('Sauvegarde locale incompatible');
  categories.splice(0,categories.length,...snapshot.categoryOrder);
  for(const [cat,folders] of snapshot.folderOrders){
    if(folders && Array.isArray(cat.folders))cat.folders.splice(0,cat.folders.length,...folders);
  }
  for(const [folder,props] of snapshot.values){
    for(const [key,entry] of Object.entries(props)){
      if(entry.present)folder[key]=entry.value;
      else delete folder[key];
    }
  }
  const previous=snapshot.selection;
  for(const key of Object.keys(selection)){
    if(!Object.hasOwn(previous,key))delete selection[key];
  }
  for(const [key,value] of Object.entries(previous)){
    if(plain(value)){
      if(!plain(selection[key]))selection[key]={};
      for(const k of Object.keys(selection[key]))if(!Object.hasOwn(value,k))delete selection[key][k];
      Object.assign(selection[key],value);
    }else selection[key]=value;
  }
  return true;
}


/**
 * Comparateur de brouillons, sans effet de bord et sans requête réseau.
 * Les sources désactivées par leur dossier/section ne comptent pas comme actives.
 * La liste des exemples est volontairement limitée pour les gros catalogues.
 */
export function compareStudioDrafts(current,next,exampleLimit=12){
  const total={
    sectionOrder:0,folderOrders:0,sectionsEnabled:0,sectionsDisabled:0,
    foldersEnabled:0,foldersDisabled:0,sourcesEnabled:0,sourcesDisabled:0,
    artworks:0,labels:0,presentation:0
  };
  const examples=[];
  const limit=Number.isFinite(exampleLimit)?Math.max(0,Math.min(30,Math.trunc(exampleLimit))):12;
  const note=msg=>{if(examples.length<limit)examples.push(msg);};
  const sectionsA=Array.isArray(current?.sections)?current.sections:[];
  const sectionsB=Array.isArray(next?.sections)?next.sections:[];
  const aSection=new Map(sectionsA.map(c=>[String(c.id),c]));
  const bSection=new Map(sectionsB.map(c=>[String(c.id),c]));
  const commonSections=sectionsA.map(s=>String(s.id)).filter(id=>bSection.has(id));
  const nextSections=sectionsB.map(s=>String(s.id)).filter(id=>aSection.has(id));
  if(commonSections.join('\u0000')!==nextSections.join('\u0000')){
    total.sectionOrder++;
    note('Ordre des sections modifié');
  }
  for(const [id,nextSection] of bSection){
    const oldSection=aSection.get(id);
    if(!oldSection)continue;
    const secName=String(nextSection.label||oldSection.label||id);
    if(!!oldSection.enabled!==!!nextSection.enabled){
      const key=nextSection.enabled?'sectionsEnabled':'sectionsDisabled';
      total[key]++;
      note(secName+' : section '+(nextSection.enabled?'activée':'désactivée'));
    }
    if(String(oldSection.label)!==String(nextSection.label)){
      total.labels++;note(secName+' : nom de section modifié');
    }
    const oldFolders=new Map((oldSection.folders||[]).map(f=>[String(f.id),f]));
    const nextFolders=new Map((nextSection.folders||[]).map(f=>[String(f.id),f]));
    const orderA=(oldSection.folders||[]).map(f=>String(f.id)).filter(fid=>nextFolders.has(fid));
    const orderB=(nextSection.folders||[]).map(f=>String(f.id)).filter(fid=>oldFolders.has(fid));
    if(orderA.join('\u0000')!==orderB.join('\u0000')){
      total.folderOrders++;note(secName+' : ordre des dossiers modifié');
    }
    for(const [fid,newFolder] of nextFolders){
      const old=oldFolders.get(fid);if(!old)continue;
      const name=String(newFolder.label||old.label||fid);
      const oldSelected=new Set(old.selectedKeys||[]);
      const newSelected=new Set(newFolder.selectedKeys||[]);
      const wasActive=!!oldSection.enabled&&!!old.enabled&&oldSelected.size>0;
      const isActive=!!nextSection.enabled&&!!newFolder.enabled&&newSelected.size>0;
      if(wasActive!==isActive){
        total[isActive?'foldersEnabled':'foldersDisabled']++;
        note(name+' : dossier '+(isActive?'activé':'désactivé'));
      }
      const before=wasActive?oldSelected:new Set();
      const after=isActive?newSelected:new Set();
      for(const src of after)if(!before.has(src))total.sourcesEnabled++;
      for(const src of before)if(!after.has(src))total.sourcesDisabled++;
      const oldArtwork=old.artwork||{},newArtwork=newFolder.artwork||{};
      const changedFields=STUDIO_FIELDS.filter(field=>
        String(oldArtwork[field]||'')!==String(newArtwork[field]||''));
      if(changedFields.length){
        total.artworks+=changedFields.length;
        note(name+' : '+changedFields.length+' visuel'+(changedFields.length>1?'s':'')+' modifié'+(changedFields.length>1?'s':''));
      }
      if(String(old.label)!==String(newFolder.label)){
        total.labels++;note(name+' : nom du dossier modifié');
      }
      const presentationFields=['shape','hideTitle','focusGlowEnabled','focusGifEnabled'];
      const changedStyle=presentationFields.filter(field=>String(old[field])!==String(newFolder[field])).length;
      if(changedStyle){
        total.presentation+=changedStyle;
        note(name+' : '+changedStyle+' option'+(changedStyle>1?'s':'')+' d’affichage modifiée'+(changedStyle>1?'s':''));
      }
    }
  }
  const changeCount=Object.values(total).reduce((sum,n)=>sum+n,0);
  return {total,changeCount,examples};
}
