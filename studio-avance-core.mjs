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
const banned = /(?:^|\.)kaptain\.stream$|^imkaptain\.github\.io$|^api\.nuvio\.tv$/i;
export function assetUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.length > 1700) throw Error('URL trop longue');
  let url;
  try { url = new URL(raw); } catch { throw Error('Adresse incorrecte'); }
  if (url.protocol !== 'https:' || url.username || url.password || banned.test(url.hostname) ||
      (['github.com','raw.githubusercontent.com','api.github.com'].includes(url.hostname.toLowerCase()) &&
        /^\/(?:ImKaptain\/|repos\/ImKaptain\/)/i.test(url.pathname.slice(1) === '' ? '' : url.pathname)))
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
        hideTitle:!!f.hideTitle, focusGlowEnabled:!!f.focusGlowEnabled
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
        hideTitle:!!row.hideTitle,focusGlowEnabled:!!row.focusGlowEnabled
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
    result[folderId(f)]={...fields(f),tileShape:f.tileShape,hideTitle:f.hideTitle,focusGlowEnabled:f.focusGlowEnabled};
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
