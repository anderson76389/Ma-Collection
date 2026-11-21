const LIMIT = 25;
const MAX_OFFSET = 100000;
const profileIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const types = new Map([
  ['library', 'library'], ['watch_progress', 'progress'], ['watched_items', 'watched']
]);
const number = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const text = value => typeof value === 'string' ? value.trim().slice(0, 500) : '';

function normalize(row) {
  const group = types.get(row?.category);
  if (!group || row.deleted !== false || !row.payload || !text(row.itemKey)) return null;
  const p = row.payload;
  const title = text(p.name) || text(p.title);
  const id = text(p.id) || text(p.parentMetaId);
  if (!title && !id) return null;
  const season = number(p.seasonNumber) ?? number(p.season);
  const episode = number(p.episodeNumber) ?? number(p.episode);
  const updatedAt = number(p.markedAtEpochMs ?? p.lastUpdatedEpochMs ?? p.savedAtEpochMs ?? row.updatedAt);
  const item = {title: title || id, id, type: text(p.contentType) || text(p.type), season, episode, updatedAt};
  if (group === 'progress') {
    item.positionMs = number(p.lastPositionMs);
    item.durationMs = number(p.durationMs);
    item.completed = p.isCompleted === true;
  }
  return {group, item};
}

async function readJson(fetchCloud, path) {
  const response = await fetchCloud(path);
  if (!response.ok) throw new Error('Le compte Kovelyx n’a pas pu lire ces données.');
  return response.json();
}

export async function readProfiles(fetchCloud) {
  const data = await readJson(fetchCloud, '/v1/profiles');
  if (!Array.isArray(data?.profiles)) throw new Error('Liste de profils invalide.');
  return data.profiles.filter(p => profileIdPattern.test(p?.id ?? '')).map(p => ({
    id: p.id, name: text(p.displayName) || 'Profil Kovelyx'
  }));
}

export async function readProfileHistory(fetchCloud, profileId) {
  if (!profileIdPattern.test(profileId)) throw new Error('Choisis un profil Kovelyx valide.');
  const lists = {library: [], progress: [], watched: []};
  const seen = new Set();
  for (let offset = 0; offset <= MAX_OFFSET; offset += LIMIT) {
    const data = await readJson(fetchCloud, '/v1/sync?' + new URLSearchParams({
      profileId, offset: String(offset), limit: String(LIMIT)
    }));
    if (!Array.isArray(data?.items) || data.items.length > LIMIT ||
        (data.nextOffset !== null && (data.nextOffset !== offset + LIMIT || data.items.length !== LIMIT))) {
      throw new Error('Le serveur a renvoyé une page de synchronisation invalide.');
    }
    for (const row of data.items) {
      const result = normalize(row);
      if (!result) continue;
      const key = JSON.stringify([row.category, row.itemKey]);
      if (seen.has(key)) continue;
      seen.add(key);
      lists[result.group].push(result.item);
    }
    if (data.nextOffset === null) {
      for (const items of Object.values(lists)) items.sort((a,b) => (b.updatedAt ?? 0)-(a.updatedAt ?? 0));
      return lists;
    }
  }
  throw new Error('La bibliothèque dépasse la limite de lecture du Studio.');
}
