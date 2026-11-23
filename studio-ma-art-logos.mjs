/** Bibliothèque de logos Ma-Art — aucune dépendance à un service tiers. */
export const MA_ART_LOGO_BASE = 'https://ma-art-images-static.mailpromahe.workers.dev/';
const ARCHIVE_PATH = /^media\/[a-z0-9.-]+\/[a-f0-9]{24}\.(?:png|jpe?g|webp|avif|svg)$/i;
const unaccent = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
export function validMaArtLogoPath(path) {
  return typeof path === 'string' && ARCHIVE_PATH.test(path) && !path.includes('..');
}
export function logoUrl(item) {
  if (!validMaArtLogoPath(item?.path)) return '';
  return MA_ART_LOGO_BASE + item.path;
}
/** Récupère les vrais titres français depuis les collections sans exposer les sources Kaptain. */
export function enrichMaArtLogos(inventory, collections = []) {
  const titles = new Map();
  for (const section of collections) {
    for (const folder of section?.folders || []) {
      const source = String(folder?.titleLogoUrl ?? '');
      let path = '';
      try { path = new URL(source).pathname.replace(/^\//,''); } catch { /* ignore */ }
      if (validMaArtLogoPath(path) && !titles.has(path)) {
        titles.set(path, { label: String(folder.title || 'Logo'), category: String(section.title || 'Collection') });
      }
    }
  }
  const visited = new Set();
  const rows = [];
  for (const item of Array.isArray(inventory) ? inventory : []) {
    if (!validMaArtLogoPath(item?.path) || visited.has(item.path)) continue;
    visited.add(item.path);
    const match = titles.get(item.path);
    rows.push({
      label: match?.label || String(item.label || 'Logo').slice(0,110),
      group: match ? 'Mes collections' : String(item.group || 'Autres logos'),
      category: match?.category || String(item.group || 'Autres logos'),
      path: item.path,
      url: logoUrl(item)
    });
  }
  return rows.sort((a,b)=>a.group.localeCompare(b.group,'fr')||a.label.localeCompare(b.label,'fr'));
}
export function searchMaArtLogos(rows, query='', options={}) {
  const group = String(options.group||'all');
  const text = unaccent(query).trim().split(/\s+/).filter(Boolean);
  const limit = Math.min(120, Math.max(1, Number(options.limit)||72));
  const matches = (Array.isArray(rows) ? rows : []).filter(row =>
    (group==='all' || row.group===group) &&
    text.every(t=>unaccent(row.label+' '+row.category+' '+row.group).includes(t))
  );
  return { total: matches.length, results: matches.slice(0,limit), omitted: Math.max(0,matches.length-limit) };
}
export function applyMaArtLogo(draft, sectionId, folderId, selected) {
  if (!draft || !validMaArtLogoPath(selected?.path) || selected.url !== logoUrl(selected))
    throw new Error('Logo Ma-Art non reconnu');
  const target = draft.sections?.find(s=>s.id===sectionId)?.folders?.find(f=>f.id===folderId);
  if (!target || !target.artwork) throw new Error('Sélectionne un dossier cible dans « Affiches »');
  const previous = String(target.artwork.titleLogoUrl||'');
  if (previous === selected.url) return { changed:false, previous };
  target.artwork.titleLogoUrl = selected.url;
  return { changed:true, previous };
}
