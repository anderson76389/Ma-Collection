import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { updateRollingWeekFilters, isRecentLabel, rollingDays, mondayUtc } =
  require("../scripts/catalog-utils.js");
const directory = resolve(dirname(fileURLToPath(import.meta.url)), "../collections");

async function loadIndividualCategories() {
  const data = [];
  const files = (await readdir(directory)).filter(name =>
    name.endsWith(".json") && ![
      "metadata.json", "nuvio_mega_collection.json",
      "kaoxt-aio-catalogs.json", "kaoxt-aio-base-config.json"
    ].includes(name));
  for (const filename of files) {
    const parsed = JSON.parse(await readFile(join(directory, filename), "utf8"));
    if (Array.isArray(parsed) && parsed.every(c => Array.isArray(c.folders))) data.push(...parsed);
  }
  return data;
}

test("toutes les plateformes, chaînes et sous-catégories de télé-réalité ont une source de nouveautés", async () => {
  const data = await loadIndividualCategories();
  const required = [
    ["collection-ERFS5GWK", 22],
    ["27bda92a-f626-4093-a2ba-0a32dc09437a", 68],
    ["collection-KBP5HRRD", 6]
  ];
  for (const [id, min] of required) {
    const c = data.find(x => x.id === id);
    assert.ok(c, "Catégorie absente : " + id);
    assert.ok(c.folders.length >= min, "Dossiers manquants : " + id);
    for (const folder of c.folders) {
      const recent = (folder.sources || []).some(s => s.provider === "tmdb" &&
        s.tmdbSourceType === "DISCOVER" && isRecentLabel(s.title));
      assert.ok(recent, "Nouveautés absentes : " + c.title + " / " + folder.title);
    }
  }
});

test("plus de 350 sources récentes bougent d'une semaine, les listes et médias restent figés", async () => {
  const data = await loadIndividualCategories();
  const original = structuredClone(data);
  updateRollingWeekFilters(data, new Date("2026-10-21T12:00:00Z"));
  const changes = updateRollingWeekFilters(data, new Date("2026-10-28T12:00:00Z"));
  assert.ok(changes >= 350, "Couverture temporelle insuffisante : " + changes);
  assert.equal(updateRollingWeekFilters(data, new Date("2026-10-28T15:00:00Z")), 0);
  for (let ci = 0; ci < data.length; ci++) {
    const now = data[ci], before = original[ci];
    assert.equal(now.id, before.id);
    assert.equal(now.folders.length, before.folders.length);
    for (let fi = 0; fi < now.folders.length; fi++) {
      const folder = now.folders[fi], old = before.folders[fi];
      assert.equal(folder.id, old.id);
      assert.equal(folder.title, old.title);
      assert.equal(folder.coverImageUrl, old.coverImageUrl);
      assert.equal(folder.focusGifUrl, old.focusGifUrl);
      assert.equal(folder.heroBackdropUrl, old.heroBackdropUrl);
      assert.equal(folder.sources.length, old.sources.length);
      for (let si = 0; si < folder.sources.length; si++) {
        const s = folder.sources[si], b = old.sources[si];
        assert.equal(s.id, b.id);
        assert.equal(s.title, b.title);
        assert.equal(s.provider, b.provider);
        assert.equal(s.tmdbSourceType, b.tmdbSourceType);
        if (s.provider !== "tmdb" || s.tmdbSourceType !== "DISCOVER" ||
            now.id === "collection-Y2HQBZ5I") assert.deepEqual(s, b);
      }
    }
  }
});

test("les fenêtres saisonnières sont cohérentes et les périodes historiques protégées", () => {
  assert.equal(mondayUtc(new Date("2026-10-14T12:00:00Z")).toISOString().slice(0,10), "2026-10-12");
  assert.equal(rollingDays("collection-b530d60c", { title: "New This Season" }), 185);
  assert.equal(rollingDays("collection-KBP5HRRD", { title: "New Reality Releases" }), 1095);
  assert.equal(isRecentLabel("Nouvelles séries"), true);
  assert.equal(isRecentLabel("Récentes sorties animées"), true);
  assert.equal(isRecentLabel("New Movies 2024"), false);
  assert.equal(isRecentLabel("Top 10 des films"), false);
});
