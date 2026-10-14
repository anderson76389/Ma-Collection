#!/usr/bin/env node
/**
 * Ma-Collection — Top 10 Netflix France (officiel).
 * Par défaut : archivage JSON, sans modifier Nuvio ni TMDB.
 * Synchronisation TMDB v4 seulement si NETFLIX_FR_SYNC_ENABLED=true,
 * avec DEUX listes personnelles vides et un jeton UTILISATEUR TMDB v4.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseCountryTsv, selectFranceWeek } from "./netflix-fr-core.mjs";

const SOURCE = "https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv";
const OUT = resolve("data/netflix-fr-top10.json");
const OVERRIDES = resolve("config/netflix-fr-tmdb-overrides.json");
const API_KEY = process.env.TMDB_API_KEY || "";
const TOKEN = process.env.TMDB_V4_USER_ACCESS_TOKEN || "";
const SYNC = process.env.NETFLIX_FR_SYNC_ENABLED === "true";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function request(url, options = {}) {
  let error;
  for (let i = 0; i < 3; i++) {
    try {
      const resp = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(90000),
        headers: {"User-Agent": "Ma-Collection NetflixFR/1.0", ...(options.headers || {})}
      });
      if (resp.ok) return resp;
      const body = (await resp.text()).slice(0, 180);
      error = new Error("HTTP " + resp.status + " sur " + new URL(url).hostname + " : " + body);
      if (![429, 500, 502, 503, 504].includes(resp.status)) break;
    } catch (e) { error = e; }
    await sleep(1200 * (i+1));
  }
  throw error;
}

function normalize(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .replace(/&/g,"and").replace(/[’‘]/g,"'").toLowerCase()
    .replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
}

async function tmdb(path, options = {}, user = false) {
  const url = "https://api.themoviedb.org/" + (user ? "4/" : "3/") + path.replace(/^\/+/,"");
  const headers = {...(options.headers || {})};
  if (user) {
    if (!TOKEN) throw new Error("Jeton utilisateur TMDB v4 manquant.");
    headers.Authorization = "Bearer " + TOKEN;
  } else if (API_KEY) {
    headers.Authorization = API_KEY.startsWith("eyJ") ? "Bearer " + API_KEY : undefined;
  }
  const target = new URL(url);
  if (!user && !API_KEY.startsWith("eyJ")) target.searchParams.set("api_key", API_KEY);
  if (!headers.Authorization) delete headers.Authorization;
  if (options.body) headers["Content-Type"] = "application/json";
  const res = await request(target.href, {...options,headers});
  return res.json();
}

async function getOverrides() {
  try { return JSON.parse(await readFile(OVERRIDES,"utf8")); }
  catch (e) {
    if (e.code === "ENOENT") return {films: {},series: {}};
    throw e;
  }
}

async function resolveOne(entry, media, overrides) {
  const section = media === "movie" ? "films" : "series";
  const preferred = overrides[section]?.[entry.title];
  if (preferred) {
    if (!Number.isSafeInteger(Number(preferred)) || Number(preferred) <= 0)
      throw new Error("TMDB override invalide : " + entry.title);
    await tmdb(media + "/" + preferred);
    return Number(preferred);
  }
  const found = new Map();
  for (const language of ["en-US","fr-FR"]) {
    const endpoint = media === "movie" ? "search/movie" : "search/tv";
    const url = new URL("https://api.themoviedb.org/3/"+endpoint);
    url.searchParams.set("query",entry.title);
    url.searchParams.set("language",language);
    const data = await tmdb(endpoint + "?" + url.searchParams.toString());
    const key = normalize(entry.title);
    for (const item of (data.results || []).slice(0,20)) {
      const titles = [item.title,item.name,item.original_title,item.original_name];
      if (titles.some(x => normalize(x) === key)) found.set(item.id,item);
    }
    if (found.size === 1) break;
  }
  return found.size === 1 ? [...found.keys()][0] : null;
}

async function enrich(snapshot) {
  const overrides = await getOverrides();
  const resolved = structuredClone(snapshot);
  for (const [cat,type] of [["films","movie"],["series","tv"]]) {
    for (const item of resolved[cat]) {
      item.tmdb_id = await resolveOne(item,type,overrides);
      if (!item.tmdb_id) console.warn("::warning::TMDB sans correspondance certaine : " + cat + " / " + item.title);
      await sleep(180);
    }
  }
  return resolved;
}

function ready(snapshot) {
  return ["films","series"].every(cat => snapshot[cat].every(x => Number.isSafeInteger(x.tmdb_id) && x.tmdb_id>0))
      && new Set(snapshot.films.map(x => x.tmdb_id)).size === 10
      && new Set(snapshot.series.map(x => x.tmdb_id)).size >= 8;
}

async function syncList(listId, expectedName, type, ids) {
  if (!/^[1-9]\d{0,11}$/.test(String(listId))) throw new Error("ID de liste TMDB v4 invalide.");
  if (ids.length < 8 || ids.length > 10) throw new Error("Nombre de titres TMDB non sûr.");
  const path = "list/" + listId;
  const list = await tmdb(path + "?page=1",{},true);
  if (list.name !== expectedName || list.public !== true) {
    throw new Error("Liste TMDB incorrecte : nom ou visibilité différent(e) de "+expectedName);
  }
  if ((list.total_results || 0)>20) throw new Error("Liste TMDB trop remplie : sécurité anti-effacement.");
  const old = (list.results || []).map(x => ({media_type:x.media_type,media_id:x.id}));
  if (old.some(x=>x.media_type!==type)) throw new Error("Liste TMDB contenant un type de média inattendu.");
  const wanted = [...new Set(ids)].map(id=>({media_type:type,media_id:id}));
  const current = new Set(old.map(x=>x.media_id));
  const future = new Set(wanted.map(x=>x.media_id));
  const add = wanted.filter(x=>!current.has(x.media_id));
  const drop = old.filter(x=>!future.has(x.media_id));
  if (add.length) {
    const res = await tmdb(path+"/items",{method:"POST",body:JSON.stringify({items:add})},true);
    if (res.success !== true || (res.results||[]).some(x=>x.success === false))
      throw new Error("Ajout de titres TMDB non confirmé, aucune suppression effectuée.");
  }
  const afterAdd = await tmdb(path+"?page=1",{},true);
  const have = new Set((afterAdd.results||[]).map(x=>x.id));
  if (!wanted.every(x=>have.has(x.media_id))) throw new Error("Ajouts non visibles : arrêt avant suppressions.");
  if (drop.length) {
    const res = await tmdb(path+"/items",{method:"DELETE",body:JSON.stringify({items:drop})},true);
    if (res.success !== true || (res.results||[]).some(x=>x.success === false))
      throw new Error("Suppression TMDB partielle : vérification manuelle requise.");
  }
  const final = await tmdb(path+"?page=1",{},true);
  const actual = new Set((final.results||[]).map(x=>x.id));
  if (actual.size!==future.size || [...future].some(x=>!actual.has(x)))
    throw new Error("Vérification TMDB finale incorrecte.");
  console.log("Liste "+expectedName+" vérifiée : "+future.size+" titres (ordre TMDB non garanti).");
}

async function main() {
  if (SYNC && (!API_KEY || !TOKEN ||
      !process.env.NETFLIX_FR_MOVIES_LIST_ID || !process.env.NETFLIX_FR_SERIES_LIST_ID)) {
    throw new Error("Synchronisation activée sans les 4 secrets TMDB requis.");
  }
  const response = await request(SOURCE);
  const length = Number(response.headers.get("content-length")||0);
  if (length>50000000) throw new Error("Fichier Netflix trop volumineux.");
  const raw = await response.text();
  if (raw.length > 50000000) throw new Error("Fichier Netflix trop volumineux.");
  const selected = selectFranceWeek(parseCountryTsv(raw),new Date());
  let result=selected;
  if (API_KEY) result=await enrich(selected);
  if (SYNC) {
    if (!ready(result)) {
      console.warn("::warning::Mappage TMDB incomplet ou ambigu : listes préservées.");
    } else {
      // Garde les deux listes existantes. Ne touche à aucune liste Kaptain.
      await syncList(process.env.NETFLIX_FR_MOVIES_LIST_ID,
        "Ma-Collection - Netflix France - Films","movie",result.films.map(x=>x.tmdb_id));
      await syncList(process.env.NETFLIX_FR_SERIES_LIST_ID,
        "Ma-Collection - Netflix France - Series","tv",result.series.map(x=>x.tmdb_id));
    }
  } else {
    console.log("Synchronisation TMDB désactivée : aucune liste externe modifiée.");
  }
  await mkdir(dirname(OUT),{recursive:true});
  const data=JSON.stringify(result,null,2)+"\n";
  try {
    if (await readFile(OUT,"utf8")===data) { console.log("Aucun changement dans les données Netflix."); return; }
  } catch {}
  await writeFile(OUT,data);
  console.log("Top 10 Netflix France "+selected.week+" : 10 films et 10 séries archivés.");
}
main().catch(err=>{console.error("::error::"+err.message);process.exitCode=1;});
