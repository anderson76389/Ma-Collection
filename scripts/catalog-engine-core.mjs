/**
 * Ma-Collection : logique pure du moteur FR, testable sans accès réseau.
 * Aucune source historique ni média de collections/ n'est modifié.
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { isRecentLabel, rollingDays, mondayUtc } = require("./catalog-utils.js");

export const REGION = "FR";
export const CATEGORY_IDS = Object.freeze({
  streaming: "collection-ERFS5GWK",
  networks: "27bda92a-f626-4093-a2ba-0a32dc09437a",
  reality: "collection-KBP5HRRD",
  anime: "collection-b530d60c"
});
export const CORE_IDS = new Set(Object.values(CATEGORY_IDS));
export const MAX_CATALOG_ITEMS = 20;
const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export function numbers(value) {
  return [...new Set(String(value || "").split(/[|,]/).map(x => Number(x.trim()))
    .filter(x => Number.isSafeInteger(x) && x > 0))];
}
export function isTv(s) {
  return ["TV", "TV_SHOW", "SERIES"].includes(String(s?.mediaType || "").toUpperCase());
}
export function isRollingSource(category, source) {
  if (!source || source.provider !== "tmdb" || source.tmdbSourceType !== "DISCOVER")
    return false;
  if (category.id === "collection-Y2HQBZ5I" || Number.isInteger(source.filters?.year))
    return false;
  return isRecentLabel(source.title);
}
export function monday(date) {
  return mondayUtc(date).toISOString().slice(0, 10);
}
export function startDate(category, source, date) {
  const d = mondayUtc(date);
  d.setUTCDate(d.getUTCDate() - rollingDays(category.id, source));
  return d.toISOString().slice(0, 10);
}
export function sourceKey(collection, folder, source, index) {
  const raw = [collection.id, folder.id || folder.title, source.id || source.title, index].join("/");
  return "mc-fr-" + createHash("sha256").update(raw).digest("hex").slice(0, 14);
}
export function normalizeProviderMap(providers, region = REGION) {
  const ids = new Set();
  for (const p of providers?.results || []) {
    // JustWatch/TMDB fournit la priorité par pays; ne jamais inventer une présence FR.
    if (p && Number.isSafeInteger(p.provider_id) &&
      p.display_priorities && Number.isFinite(p.display_priorities[region]))
      ids.add(p.provider_id);
  }
  return ids;
}
export function providersFor(folder, movieIds, tvIds) {
  const pools = { movie: new Set(), series: new Set() };
  for (const src of folder.sources || []) {
    const f = src.filters || {};
    for (const id of numbers(f.withWatchProviders || f.with_watch_providers)) {
      if (isTv(src)) pools.series.add(id);
      else pools.movie.add(id);
    }
  }
  // Une plateforme (ex. Apple TV+) peut définir un fournisseur uniquement
  // sur les films et filtrer les séries par réseau : réutiliser le même ID
  // fournisseur si TMDB confirme explicitement sa présence en France pour la TV.
  const all = new Set([...pools.movie, ...pools.series]);
  return {
    movie: [...all].filter(id => movieIds.has(id)),
    series: [...all].filter(id => tvIds.has(id))
  };
}

const MOVIE_FILTERS = Object.freeze({
  withGenres: "with_genres", withoutGenres: "without_genres",
  withKeywords: "with_keywords", withoutKeywords: "without_keywords",
  withOriginalLanguage: "with_original_language",
  voteCountGte: "vote_count.gte", voteAverageGte: "vote_average.gte",
  withCompanies: "with_companies"
});
const TV_FILTERS = Object.freeze({
  ...MOVIE_FILTERS, withNetworks: "with_networks"
});
export function discoverParams(collection, source, {date, streamingProviders} = {}) {
  if (!isRollingSource(collection, source)) throw new Error("Source non glissante");
  const tv = isTv(source);
  const type = tv ? "series" : "movie";
  const params = new URLSearchParams({
    language: "fr-FR", include_adult: "false", page: "1",
    sort_by: tv ? "first_air_date.desc" : "primary_release_date.desc"
  });
  const f = source.filters || {};
  const allowed = tv ? TV_FILTERS : MOVIE_FILTERS;
  for (const [key, target] of Object.entries(allowed)) {
    if (f[key] !== undefined && f[key] !== null && String(f[key]) !== "")
      params.set(target, String(f[key]));
  }
  if (collection.id === CATEGORY_IDS.streaming) {
    if (!streamingProviders || !streamingProviders.length)
      return { disabled: true, reason: "Aucun fournisseur confirmé pour la France", type };
    params.set("with_watch_providers", streamingProviders.join("|"));
    params.set("watch_region", REGION);
    params.set("with_watch_monetization_types", "flatrate|free|ads");
    // Les filtres réseau US hérités ne doivent pas annuler le filtrage fournisseur FR.
    params.delete("with_networks");
  }
  const dateValue = startDate(collection, source, date || new Date());
  params.set(tv ? "first_air_date.gte" : "primary_release_date.gte", dateValue);
  return { disabled: false, params, type };
}
export function recentEpisodeParams(network, date, providerIds = null) {
  const start = mondayUtc(date);
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(date);
  if (!Number.isFinite(end.getTime())) throw new Error("Date de diffusion invalide");
  end.setUTCHours(0,0,0,0);
  const p = new URLSearchParams({
    language: "fr-FR", include_adult: "false", page: "1",
    sort_by: "popularity.desc",
    "air_date.gte": start.toISOString().slice(0,10),
    "air_date.lte": end.toISOString().slice(0,10)
  });
  if (network) p.set("with_networks", String(network));
  if (providerIds?.length) {
    p.set("watch_region", REGION);
    p.set("with_watch_providers", providerIds.join("|"));
    p.set("with_watch_monetization_types", "flatrate|free|ads");
  }
  return p;
}
export function prepareMetas(results, mediaType) {
  const seen = new Set();
  const out = [];
  for (const x of results || []) {
    const id = Number(x.id);
    if (!Number.isSafeInteger(id) || id < 1 || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id: "tmdb:" + id, type: mediaType, name: x.title || x.name || x.original_title || x.original_name || ("TMDB " + id),
      ...(x.poster_path ? { poster: "https://image.tmdb.org/t/p/w500" + x.poster_path } : {}),
      ...(x.backdrop_path ? { background: "https://image.tmdb.org/t/p/w780" + x.backdrop_path } : {}),
      ...(x.overview ? { description: x.overview } : {}),
      ...(x.release_date || x.first_air_date ? { releaseInfo: String(x.release_date || x.first_air_date).slice(0,4) } : {})
    });
    if (out.length >= MAX_CATALOG_ITEMS) break;
  }
  return out;
}
export function compareSample(previous, current) {
  if (!previous) return { initialized: true, added: [], removed: [], retained: current.length };
  const old = new Set(previous);
  const next = new Set(current);
  return {
    initialized: false,
    added: [...next].filter(x => !old.has(x)),
    removed: [...old].filter(x => !next.has(x)),
    retained: [...next].filter(x => old.has(x)).length
  };
}
export function safeDate(value) {
  return typeof value === "string" && DATE_RE.test(value) && Number.isFinite(Date.parse(value + "T00:00:00Z"));
}
