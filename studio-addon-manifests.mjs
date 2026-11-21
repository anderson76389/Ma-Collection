/**
 * Studio Ma-Collection: portable addon manifests for Kovelyx, independent of
 * any third-party site backend. This module NEVER fetches or installs add-ons.
 */
export function addonInventoryFromDraft(draft, catalogues, sourceKey) {
  const categories = new Map((catalogues || []).map(cat => [String(cat.id), cat]));
  const found = new Map();
  for (const section of draft?.sections || []) {
    if (!section.enabled) continue;
    const original = categories.get(String(section.id));
    if (!original) continue;
    const byFolder = new Map((original.folders || []).map(f => [String(f.id), f]));
    for (const folder of section.folders || []) {
      if (!folder.enabled) continue;
      const selectedKeys = new Set(folder.selectedKeys || []);
      if (!selectedKeys.size) continue;
      const originalFolder = byFolder.get(String(folder.id));
      if (!originalFolder) continue;
      for (const source of originalFolder.sources || []) {
        const key = sourceKey(source);
        if (!selectedKeys.has(key) || !source.addonId) continue;
        const id = String(source.addonId).trim();
        if (!id) continue;
        const row = found.get(id) || {id, sources:0, folders:0};
        row.sources++;
        row.folders++;
        found.set(id, row);
      }
    }
  }
  return [...found.values()].sort((a,b)=>a.id.localeCompare(b.id,'fr'));
}

export function validateAddonManifestUrl(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (text.length > 2048) throw Error('Adresse de manifest trop longue.');
  let url;
  try { url = new URL(text); } catch { throw Error('Adresse de manifest invalide.'); }
  if (url.protocol !== 'https:' || url.username || url.password ||
      !url.hostname || !url.pathname.endsWith('/manifest.json') || url.hash)
    throw Error('Utilise une URL HTTPS se terminant par /manifest.json.');
  if (url.hostname === 'kaptain.stream' || url.hostname.endsWith('.kaptain.stream'))
    throw Error('Cette adresse dépend de Kaptain. Fournis ton propre addon indépendant.');
  return text;
}
export function buildAddonManifestFile(inventory, values) {
  if (!Array.isArray(inventory) || inventory.length > 25)
    throw Error('Le fichier contient au maximum 25 extensions.');
  const addons = [];
  const seen = new Set();
  for (const source of inventory) {
    const url = validateAddonManifestUrl(values?.[source.id]);
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    addons.push({manifestUrl:url});
  }
  if (!addons.length)
    throw Error('Indique au moins une adresse de manifest. Aucun fichier vide ne sera créé.');
  return {format:'kovelyx-addon-urls-v1', addons};
}
