#!/usr/bin/env node
/**
 * Moteur hebdomadaire Ma-Collection, autonome vis-a-vis de Kaptain.
 * --check : vérifications locales hors ligne, sans clé.
 * --build : interroge TMDB avec TMDB_API_KEY et construit un addon statique.
 *
 * Aucune écriture dans collections/, aucune utilisation d'ID de liste tiers.
 * Le répertoire catalogue/ expose des réponses compatibles Stremio.
 */
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATEGORY_IDS, CORE_IDS, REGION, isTv, isRollingSource, sourceKey,
  normalizeProviderMap, providersFor, discoverParams, recentEpisodeParams,
  prepareMetas, compareSample, numbers, monday
} from "./catalog-engine-core.mjs";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MODE = process.argv.includes("--build") ? "build" : process.argv.includes("--check") ? "check" : "";
if (!MODE || (process.argv.includes("--build") && process.argv.includes("--check")))
  throw new Error("Utilisation : node scripts/catalog-engine.mjs --check | --build");
const NOW = process.env.CATALOG_ENGINE_DATE
  ? new Date(process.env.CATALOG_ENGINE_DATE + "T12:00:00Z")
  : new Date();
if (!Number.isFinite(NOW.getTime()) || NOW.getUTCFullYear() < 2026)
  throw new Error("Date du moteur invalide");
const WEEK = monday(NOW);
const KEY = (process.env.TMDB_API_KEY || "").trim();
const API = "https://api.themoviedb.org/3";
const pause = (ms) => new Promise(r => setTimeout(r, ms));
let lastCall = 0, calls = 0;
async function apiRequest(endpoint, query = new URLSearchParams()) {
  if (!KEY) throw new Error("TMDB_API_KEY absent : renseigner le secret GitHub Actions");
  if (!endpoint.startsWith("/") || endpoint.includes(".."))
    throw new Error("Chemin TMDB invalide");
  const p = new URLSearchParams(query);
  const headers = { Accept: "application/json", "User-Agent": "Ma-Collection-Catalog-Engine/1.0" };
  if (KEY.startsWith("eyJ")) headers.Authorization = "Bearer " + KEY;
  else p.set("api_key", KEY);
  const url = API + endpoint + "?" + p.toString();
  let err;
  for (let attempt = 0; attempt < 4; attempt++) {
    // Cadence prudente, commune à toutes les requêtes du job.
    await pause(Math.max(0, lastCall + 260 - Date.now()));
    lastCall = Date.now();
    calls++;
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
      if (res.ok) {
        const data = await res.json();
        if (!data || typeof data !== "object") throw new Error("JSON TMDB invalide");
        return data;
      }
      err = new Error("TMDB HTTP " + res.status + " sur " + endpoint);
      if (![429, 500, 502, 503, 504].includes(res.status)) break;
      const wait = Math.min(12000, Number(res.headers.get("retry-after") || 0) * 1000);
      await pause(Math.max(wait, 1000 * (attempt + 1) * (attempt + 1)));
    } catch (e) {
      err = e;
      await pause(900 * (attempt + 1));
    }
  }
  throw err;
}
async function categories() {
  const entries = [];
  const files = (await readdir(join(ROOT, "collections"))).filter(name =>
    name.endsWith(".json") && ![
      "metadata.json", "nuvio_mega_collection.json",
      "kaoxt-aio-catalogs.json", "kaoxt-aio-base-config.json"
    ].includes(name));
  for (const file of files.sort()) {
    const data = JSON.parse(await readFile(join(ROOT, "collections", file), "utf8"));
    if (!Array.isArray(data) || !data.every(c => c && Array.isArray(c.folders))) continue;
    for (const collection of data) {
      for (const folder of collection.folders) {
        for (const [index, source] of (folder.sources || []).entries()) {
          if (isRollingSource(collection, source))
            entries.push({ collection, folder, source, index,
              id: sourceKey({id:collection.id + "/" + file}, folder, source, index), type: isTv(source) ? "series" : "movie" });
        }
      }
    }
  }
  return entries;
}
function titleFor(e) {
  const group = e.collection.title === "Networks" ? "Chaînes" :
    e.collection.title === "Streaming Services" ? "Plateformes" :
    e.collection.title === "Reality TV" ? "Télé-réalité" :
    e.collection.title === "Anime" ? "Animés" : e.collection.title;
  return group + " · " + e.folder.title + " · " + e.source.title;
}
function manifest(catalogs, short = false) {
  return {
    id: short ? "fr.macollection.selection" : "fr.macollection.integrale",
    version: "1.0.0", name: short ? "Ma-Collection · Essentiel FR" : "Ma-Collection · Intégral FR",
    description: "Sélections françaises recalculées automatiquement via TMDB ; disponibilité alimentée par JustWatch. Ni lecture vidéo ni classement officiel.",
    resources: ["catalog"], types: ["movie", "series"], catalogs,
    behaviorHints: { configurable: false }
  };
}
function entry(type, id, name) {
  return { type, id, name };
}
async function previousSnapshot() {
  try {
    const value = JSON.parse(await readFile(join(ROOT, "data/catalog-engine/snapshots.json"), "utf8"));
    if (value?.schema === 1 && value?.region === REGION) return value;
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  return null;
}
async function saveAll(outputs) {
  for (const [path, contents] of outputs) {
    const dest = join(ROOT, path);
    await mkdir(dirname(dest), {recursive: true});
    await writeFile(dest, typeof contents === "string" ? contents : JSON.stringify(contents, null, 2) + "\n", "utf8");
  }
}
function snapshotId(e) { return [e.type, e.folder.title].join(":"); }
function idsOf(data) { return (data.results || []).map(x => Number(x.id)).filter(x => Number.isSafeInteger(x) && x > 0); }

async function main() {
  const sources = await categories();
  const platforms = sources.filter(e => e.collection.id === CATEGORY_IDS.streaming);
  const chains = sources.filter(e => e.collection.id === CATEGORY_IDS.networks);
  if (sources.length < 350 || platforms.length < 40 || chains.length !== 68)
    throw new Error("Couverture inattendue : " + sources.length + " sources, " +
      platforms.length + " plateformes, " + chains.length + " chaînes");
  console.log("Ma-Collection " + MODE + " / " + WEEK + " : " + sources.length + " nouveautés, " +
    platforms.length + " sources plateformes, " + chains.length + " chaînes.");
  if (MODE === "check") return;

  const [movieResponse, tvResponse] = await Promise.all([
    apiRequest("/watch/providers/movie"),
    apiRequest("/watch/providers/tv")
  ]);
  const available = {
    movie: normalizeProviderMap(movieResponse, REGION),
    series: normalizeProviderMap(tvResponse, REGION)
  };
  if (available.movie.size < 15 || available.series.size < 15)
    throw new Error("Référentiel des fournisseurs FR incomplet, aucune publication");
  const providers = new Map();
  const platformCategories = (await readFile(join(ROOT, "collections/streaming_services.json"), "utf8"));
  const platformFolders = JSON.parse(platformCategories)[0].folders;
  for (const folder of platformFolders)
    providers.set(folder.id, providersFor(folder, available.movie, available.series));

  const old = await previousSnapshot();
  const outputs = new Map();
  const catalogs = [], essentials = [], errors = [];
  const skip = [], resultsCache = new Map(), statuses = [];
  let processed = 0;
  function publish(id, type, label, results, isEssential = false) {
    const metas = prepareMetas(results, type);
    if (!metas.length) return false;
    outputs.set("catalog/" + type + "/" + id + ".json", { metas });
    const descriptor = entry(type, id, label);
    catalogs.push(descriptor);
    if (isEssential) essentials.push(descriptor);
    return true;
  }
  async function discover(endpoint, params) {
    const key = endpoint + "?" + params.toString();
    if (!resultsCache.has(key))
      resultsCache.set(key, await apiRequest(endpoint, params));
    const data = resultsCache.get(key);
    if (!Array.isArray(data.results)) throw new Error("Résultats TMDB manquants");
    return data.results;
  }
  for (const e of sources) {
    const core = CORE_IDS.has(e.collection.id);
    const fr = e.collection.id === CATEGORY_IDS.streaming
      ? providers.get(e.folder.id)?.[e.type] || [] : null;
    const options = discoverParams(e.collection, e.source, {
      date: NOW, streamingProviders: fr
    });
    if (options.disabled) {
      skip.push({platforme: e.folder.title, source: e.source.title, raison: options.reason});
      continue;
    }
    try {
      const results = await discover("/discover/" + (e.type === "series" ? "tv" : "movie"), options.params);
      publish(e.id, e.type, titleFor(e), results, core);
      processed++;
    } catch (error) {
      errors.push({catalogue: titleFor(e), erreur: String(error.message).slice(0,120)});
      console.warn("::warning::" + titleFor(e) + ": " + error.message);
    }
  }

  // Reprises, épisodes et saisons. "Saison récente" utilise réellement la date
  // de première diffusion de la saison (pas celle de création de la série).
  let episodeCount = 0, seasonCount = 0;
  const checkedSeries = new Map();
  async function recentSeasons(series, anchor) {
    const fresh = [];
    const cutoff = new Date(NOW);
    cutoff.setUTCDate(cutoff.getUTCDate() - 90);
    for (const show of series.slice(0, 8)) {
      const id = Number(show.id);
      try {
        if (!checkedSeries.has(id)) checkedSeries.set(id, await apiRequest("/tv/" + id));
        const detail = checkedSeries.get(id);
        const seasons = (detail.seasons || []).filter(s => s.season_number > 0 && s.air_date &&
          Date.parse(s.air_date + "T00:00:00Z") >= cutoff.getTime() &&
          Date.parse(s.air_date + "T00:00:00Z") <= NOW.getTime());
        if (seasons.length) fresh.push(show);
      } catch (error) {
        errors.push({catalogue: anchor, erreur: "Saison non vérifiée : " + error.message});
      }
    }
    return fresh;
  }
  const tvFolders = [
    ...JSON.parse(platformCategories)[0].folders.map(f => ({folder:f,group:"streaming"})),
    ...JSON.parse(await readFile(join(ROOT,"collections/networks.json"),"utf8"))[0].folders
      .map(f => ({folder:f,group:"network"}))
  ];
  for (const {folder,group} of tvFolders) {
    let p;
    let regionClaim = false;
    if (group === "streaming") {
      const ids = providers.get(folder.id)?.series || [];
      if (!ids.length) continue;
      p = recentEpisodeParams(null, NOW, ids);
      regionClaim = true;
    } else {
      const network = (folder.sources || []).flatMap(s => numbers(
        s.filters?.withNetworks || s.filters?.with_networks))[0];
      if (!network) continue;
      p = recentEpisodeParams(network, NOW);
    }
    const key = sourceKey({id:group},folder,{title:"episodes"},0);
    try {
      const results = await discover("/discover/tv",p);
      const prefix = regionClaim ? "FR · " : "Diffusion TV · ";
      if (publish(key,"series",prefix + folder.title + " · Épisodes diffusés cette semaine",
        results, true)) episodeCount++;
      if (group === "streaming" && results.length) {
        const fresh = await recentSeasons(results, folder.title);
        if (publish(key + "-seasons","series","FR · " + folder.title + " · Saisons sorties récemment",
          fresh, true)) seasonCount++;
      }
    } catch(error) {
      errors.push({catalogue:folder.title + " / épisodes",erreur:String(error.message).slice(0,120)});
    }
  }

  // Photos de catalogue comparées sur 2 pages par type : relevé partiel,
  // jamais présenté comme inventaire exhaustif ni comme classement officiel.
  const snapshots = {schema:1,region:REGION,week:WEEK,platforms:{}};
  const changes = [];
  for (const folder of platformFolders) {
    const active = providers.get(folder.id);
    for (const type of ["movie","series"]) {
      const ids = active?.[type] || [];
      if (!ids.length) continue;
      const endpoint = "/discover/" + (type === "series" ? "tv" : "movie");
      const base = new URLSearchParams({language:"fr-FR",include_adult:"false",
        sort_by:"popularity.desc",watch_region:REGION,
        with_watch_providers:ids.join("|"),
        with_watch_monetization_types:"flatrate|free|ads"});
      const found = [];
      let successful = true;
      try {
        for (const page of [1,2]) {
          base.set("page",String(page));
          found.push(...await discover(endpoint,base));
        }
      } catch(error) {
        successful = false;
        errors.push({catalogue:folder.title+" / disponibilité "+type,
          erreur: String(error.message).slice(0,120)});
      }
      if (!successful) continue;
      const unique = [...new Set(idsOf({results:found}))];
      const snapshotKey = snapshotId({type,folder});
      snapshots.platforms[snapshotKey] = unique;
      const delta = compareSample(old?.platforms?.[snapshotKey], unique);
      changes.push({plateforme:folder.title,type,taille_echantillon:unique.length,
        premiere_mesure:delta.initialized,
        ajouts_reperes:delta.added.length,retraits_reperes:delta.removed.length});
      if (!delta.initialized && delta.added.length) {
        const addSet = new Set(delta.added);
        publish("mc-newseen-" + sourceKey({id:type},folder,{title:"sample"},0),
          type, "FR · " + folder.title + " · Nouveaux repérés dans l’échantillon",
          found.filter(v => addSet.has(v.id)),true);
      }
    }
  }

  const viable = processed / sources.length;
  if (viable < 0.7 || catalogs.length < 190 || changes.length < 12) {
    throw new Error("Protection anti-catalogues vides : " + processed + "/" + sources.length +
      " sources consultées, " + catalogs.length + " catalogues, " +
      changes.length + " échantillons. Aucun fichier publié.");
  }
  if (errors.length > 40)
    throw new Error("Trop d'erreurs TMDB ("+errors.length+"), abandon pour préserver les anciennes données");
  // Maintenir les anciennes observations si une plateforme échoue temporairement.
  for (const [key,value] of Object.entries(old?.platforms || {})) {
    if (!(key in snapshots.platforms)) snapshots.platforms[key] = value;
  }

  // L'édition essentielle affiche en priorité les chaînes, plateformes et animés.
  // L'édition intégrale expose toutes les nouveautés des sous-catégories.
  // Empêcher deux sous-catégories de partager un même identifiant dans l'addon.
  const catalogKeys = catalogs.map(c => c.type + ":" + c.id);
  if (new Set(catalogKeys).size !== catalogKeys.length)
    throw new Error("Collision d'identifiants de catalogues, publication refusée");
  outputs.set("manifest.json", manifest(essentials,true));
  outputs.set("manifest-complet.json", manifest(catalogs,false));
  outputs.set("data/catalog-engine/snapshots.json", snapshots);
  outputs.set("data/catalog-engine/etat.json", {
    schema:1, semaine_utc:WEEK, region:REGION,
    totaux:{sources_auditees:sources.length,sources_interrogees:processed,
      catalogues_publies:catalogs.length,catalogues_essentiels:essentials.length,
      episodes:episodeCount,saisons:seasonCount,erreurs:errors.length,
      fournisseurs_fr_films:available.movie.size,
      fournisseurs_fr_series:available.series.size,appels_api:calls},
    limitations: [
      "TMDB/JustWatch : disponibilité déclarée, potentiellement différée.",
      "Un nouveau titre dans l'échantillon ne prouve pas une mise en ligne récente.",
      "Top 10 officiels et listes historiques inchangés.",
      "Les chaînes indiquent des diffusions TV internationales, pas le replay français.",
      "Les identifiants tmdb: demandent un fournisseur de métadonnées compatible dans Nuvio."
    ],plateformes_sans_source_fr:skip,comparaisons_echantillons:changes,erreurs:errors
  });
  await saveAll(outputs);
  console.log("Publication réussie : " + catalogs.length + " catalogues, " +
    essentials.length + " essentiels, " + episodeCount + " séries à épisodes récents, " +
    seasonCount + " rangées saisons, " + calls + " appels TMDB, " +
    errors.length + " erreurs non critiques.");
}
main().catch(error => { console.error("::error::" + error.message); process.exitCode = 1; });
