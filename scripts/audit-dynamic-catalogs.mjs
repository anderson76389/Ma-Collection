#!/usr/bin/env node
/**
 * Ma-Collection - inventaire vérifiable des catalogues.
 *
 * Aucune requête réseau, aucune dépendance npm, aucun secret.
 * Les données de classement officiel ne sont jamais inventées.
 *
 * --check  : lecture seule (contrôle et bilan)
 * --write  : produit data/catalogues-dynamiques-status.json
 * --strict : échoue si une source récente TMDB Discover est périmée
 */
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { isRecentLabel, rollingDays, mondayUtc } = require("./catalog-utils.js");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const filesDir = join(root, "collections");
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const strict = process.argv.includes("--strict");
if (write === check) throw new Error("Utiliser exactement --check ou --write");

const date = process.env.CATALOG_WEEKLY_DATE
  ? new Date(process.env.CATALOG_WEEKLY_DATE + "T12:00:00Z")
  : new Date();
if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 2026 || date.getUTCFullYear() > 2100) {
  throw new Error("Date de contrôle invalide");
}
const monday = mondayUtc(date);
const week = monday.toISOString().slice(0, 10);

const expectedDate = (categoryId, source) => {
  const start = new Date(monday);
  start.setUTCDate(start.getUTCDate() - rollingDays(categoryId, source));
  return start.toISOString().slice(0, 10);
};

function sourceStatus(category, source) {
  const type = String(source?.tmdbSourceType || "").toUpperCase();
  const provider = String(source?.provider || "").toLowerCase();
  if (provider === "tmdb" && type === "DISCOVER") {
    const historical = category.id === "collection-Y2HQBZ5I"
      || Number.isInteger(source.filters?.year)
      || /(?:19|20)\d{2}/.test(String(source.title || ""));
    if (!historical && isRecentLabel(source.title)) return "hebdomadaire";
    return "tmdb_direct";
  }
  if (provider === "tmdb" && type === "LIST") return "liste_tiers";
  if (provider === "trakt") return "liste_tiers";
  if (provider === "addon") return "addon_externe";
  if (provider === "tmdb" && (type === "COMPANY" || type === "COLLECTION")) return "tmdb_special";
  return "autre";
}

async function main() {
  const names = (await readdir(filesDir)).filter((name) =>
    name.endsWith(".json") && ![
      "metadata.json", "nuvio_mega_collection.json",
      "kaoxt-aio-catalogs.json", "kaoxt-aio-base-config.json"
    ].includes(name)).sort();

  const categories = [];
  const errors = [];
  const total = {
    categories: 0, folders: 0, sources: 0,
    hebdomadaire: 0, tmdb_direct: 0,
    liste_tiers: 0, addon_externe: 0, tmdb_special: 0, autre: 0
  };

  for (const name of names) {
    const parsed = JSON.parse(await readFile(join(filesDir, name), "utf8"));
    if (!Array.isArray(parsed) || !parsed.every(c => c && Array.isArray(c.folders))) continue;
    for (const category of parsed) {
      const details = { id: category.id, nom: category.title, fichier: name,
        dossiers: 0, sources: 0, hebdomadaire: 0, tmdb_direct: 0,
        liste_tiers: 0, addon_externe: 0, tmdb_special: 0, autre: 0,
        dossiers_sans_nouveautes: [], dossiers_hebdomadaires: 0 };
      const uniqueFolderIds = new Set();
      for (const folder of category.folders) {
        details.dossiers++;
        total.folders++;
        if (folder.id && uniqueFolderIds.has(folder.id))
          errors.push(name + ": identifiant de dossier dupliqué " + folder.id);
        if (folder.id) uniqueFolderIds.add(folder.id);

        let updates = 0;
        for (const source of folder.sources || []) {
          const status = sourceStatus(category, source);
          details[status]++;
          total[status]++;
          details.sources++;
          total.sources++;
          if (status === "hebdomadaire") {
            updates++;
            const expect = expectedDate(category.id, source);
            if (source.filters?.releaseDateGte !== expect) {
              errors.push(name + " / " + folder.title + " / " + source.title +
                ": date " + (source.filters?.releaseDateGte || "absente") + ", attendue " + expect);
            }
          }
        }
        if (updates > 0) details.dossiers_hebdomadaires++;
        else details.dossiers_sans_nouveautes.push(folder.title);
      }
      total.categories++;
      categories.push(details);
    }
  }
  if (total.categories < 15 || total.sources < 1000) {
    throw new Error("Inventaire incomplet : " + total.categories + " catégories, " + total.sources + " sources");
  }
  const essential = [
    ["collection-ERFS5GWK", 22, 20], // Plateformes
    ["27bda92a-f626-4093-a2ba-0a32dc09437a", 68, 68], // Chaînes
    ["collection-KBP5HRRD", 6, 6] // Télé-réalité
  ];
  for (const [id, minimumFolders, minimumUpdates] of essential) {
    const category = categories.find(c => c.id === id);
    if (!category || category.dossiers < minimumFolders ||
        category.dossiers_hebdomadaires < minimumUpdates) {
      throw new Error("Couverture hebdomadaire insuffisante : " + id);
    }
  }

  const report = {
    schema: 1, semaine_utc: week,
    explication: {
      hebdomadaire: "Bornes temporelles TMDB Discover recalculées chaque lundi ; pas des dates d'ajout vérifiées sur les services.",
      tmdb_direct: "Interrogation TMDB en direct ; les résultats peuvent évoluer sans réécriture hebdomadaire.",
      liste_tiers: "Liste externe TMDB/Trakt conservée, sans garantie de mise à jour par son propriétaire.",
      addon_externe: "Catalogue dépendant d'un addon, actualisation hors du contrôle du dépôt.",
      tmdb_special: "Sources TMDB COMPANY/COLLECTION ; ne gèrent pas les mêmes filtres temporels que Discover."
    },
    totaux: total,
    categories,
    avertissements_dates: errors
  };
  const summary = categories.map(c => c.nom + ": " + c.dossiers +
    " dossiers, " + c.hebdomadaire + " nouveautés hebdomadaires, " +
    c.tmdb_direct + " sources TMDB en direct, " + c.liste_tiers + " listes externes");
  console.log("Semaine UTC " + week + " - " + total.categories + " catégories, " +
    total.folders + " dossiers, " + total.sources + " sources");
  for (const line of summary) console.log("  " + line);
  console.log("Dates de nouveautés à corriger : " + errors.length);
  for (const error of errors.slice(0, 20)) console.warn("::warning::" + error);
  if (strict && errors.length) throw new Error("Audit strict : dates hebdomadaires périmées");
  if (write) {
    const location = join(root, "data", "catalogues-dynamiques-status.json");
    await mkdir(dirname(location), { recursive: true });
    await writeFile(location, JSON.stringify(report, null, 2) + "\n", "utf8");
    console.log("Rapport écrit dans data/catalogues-dynamiques-status.json");
  }
}
main().catch(error => {
  console.error("::error::" + error.message);
  process.exitCode = 1;
});
