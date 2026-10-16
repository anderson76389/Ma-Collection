#!/usr/bin/env node
/**
 * Audit d'indépendance de Ma-Collection face aux hébergements Kaptain.
 * Lecture seule, sans clé/API ni modification des listes historiques.
 * Les liens médias externes historiques sont explicitement répertoriés :
 * tout nouvel ajout externe fait échouer la CI.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = p => readFileSync(resolve(root, p), "utf8");
const own = "https://ma-art.mailpromahe.workers.dev/";
const fields = ["coverImageUrl", "focusGifUrl", "heroBackdropUrl", "titleLogoUrl", "backdropImageUrl"];
const names = [
  "actors", "anime", "awards", "based_on", "by_decade", "discover",
  "documentaries", "film_collections", "for_you_trending_new",
  "genres", "international_cinema", "kids_and_family",
  "legendary_directors", "moods_vibes", "networks", "reality_tv",
  "spotlight", "streaming_services", "studios", "trending_new",
];
const exceptionRows = JSON.parse(read("config/medias-externes-historiques.json")).references;
const signature = (file, folderId, field) => [file, folderId, field].join("::");
const exceptions = new Map(exceptionRows.map(row => [signature(row.file, row.folderId, row.field), row.url]));
assert.equal(exceptions.size, exceptionRows.length, "Doublons dans les exceptions de médias");
const findings = [];
const count = { categories: 0, folders: 0, sources: 0, localMedia: 0, legacyMedia: 0, externalLists: 0, externalAddons: 0, dynamicDiscover: 0 };
const encountered = new Set();
for (const name of names) {
  const file = "collections/" + name + ".json";
  const categories = JSON.parse(read(file));
  assert(Array.isArray(categories) && categories.length, "Collection vide ou mal formée : " + file);
  for (const category of categories) {
    count.categories++;
    for (const folder of category.folders || []) {
      count.folders++;
      for (const field of fields) {
        const url = folder[field];
        if (typeof url !== "string" || !url) continue;
        const key = signature(file, folder.id, field);
        if (!/^https:\/\//.test(url) || /https?:\/\/.+https?:\/\//i.test(url)) {
          findings.push(file + " / " + folder.title + " / " + field + " : URL mal formée");
          continue;
        }
        if (url.startsWith(own)) {
          count.localMedia++;
        } else if (exceptions.get(key) === url) {
          count.legacyMedia++;
          encountered.add(key);
        } else {
          findings.push(file + " / " + folder.title + " / " + field + " : média tiers non autorisé dans l'audit : " + url);
        }
        if (!url.startsWith(own) && /imkaptain\.github\.io|raw\.githubusercontent\.com\/imkaptain\/|github\.com\/imkaptain\//i.test(url)) {
          findings.push("Ancien hébergement Kaptain actif : " + key);
        }
      }
      for (const s of folder.sources || []) {
        count.sources++;
        if (s.provider === "trakt" || (s.provider === "tmdb" && s.tmdbSourceType === "LIST")) count.externalLists++;
        if (s.provider === "addon") count.externalAddons++;
        if (s.provider === "tmdb" && s.tmdbSourceType === "DISCOVER") count.dynamicDiscover++;
      }
    }
  }
}
for (const key of exceptions.keys()) {
  if (!encountered.has(key)) console.warn("Exception historique devenue inutile (à nettoyer) : " + key);
}
const html = read("index.html"), app = read("app.js"), channels = read("collections/test-channels.js");
if (/integrations\/kaptain\/collections/i.test(html + app)) {
  findings.push("Ancien point de publication Kaptain encore actif dans le site");
}
if (/Friends of Kaptain/i.test(app + channels)) {
  findings.push("Ancien branding Kaptain encore visible");
}
console.log("AUDIT_INDEPENDANCE : " + JSON.stringify(count));
console.log("Sources externes : TMDB/Trakt = " + count.externalLists + ", addons = " + count.externalAddons);
console.log("Médias tiers préexistants, non certifiés indépendants = " + count.legacyMedia);
for (const item of findings) console.error("ERREUR INDEPENDANCE : " + item);
if (count.categories !== 20 || count.folders < 700 || count.localMedia < 2500) findings.push("Inventaire incomplet ou migration d'images régressée");
if (findings.length) process.exitCode = 1;
else console.log("AUDIT STRUCTUREL OK : zéro nouveau média externe et zéro hébergement Kaptain actif dans les 20 collections. Les exceptions tierces restent à migrer légalement.");
