/* Données officielles Netflix : fonctions pures, sans accès réseau. */
export function parseCountryTsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const header = (lines.shift() || "").split("\t");
  const columns = ["country_iso2", "week", "category", "weekly_rank", "show_title", "season_title"];
  for (const col of columns) if (!header.includes(col)) throw new Error(`Colonne Netflix absente : ${col}`);
  const byIndex = Object.fromEntries(columns.map(col => [col, header.indexOf(col)]));
  const rows = [];
  for (const line of lines) {
    if (!line || !line.includes("\tFR\t")) {
      if (!line.startsWith("France\t") && !line.startsWith("FR\t")) continue;
    }
    const cells = line.split("\t");
    if (cells[byIndex.country_iso2] !== "FR") continue;
    const rank = Number(cells[byIndex.weekly_rank]);
    const week = cells[byIndex.week];
    const category = cells[byIndex.category];
    const title = cells[byIndex.show_title]?.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week || "") || !Number.isInteger(rank) || rank < 1 || rank > 10 || !title) continue;
    if (category !== "Films" && category !== "TV") continue;
    rows.push({week, category, rank, title, season: cells[byIndex.season_title]?.trim() || ""});
  }
  if (!rows.length) throw new Error("Aucune ligne française exploitable trouvée dans le TSV Netflix.");
  return rows;
}

export function selectFranceWeek(rows, now = new Date()) {
  const weeks = new Map();
  for (const r of rows) {
    if (!weeks.has(r.week)) weeks.set(r.week, {Films: [], TV: []});
    weeks.get(r.week)[r.category]?.push(r);
  }
  const valid = [...weeks].filter(([week, cats]) => {
    const date = new Date(`${week}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) return false;
    const age = now.getTime() - date.getTime();
    if (age < 0 || age > 28 * 86400000) return false;
    return ["Films", "TV"].every(cat => {
      const selected = cats[cat];
      return selected.length === 10 && new Set(selected.map(x=>x.rank)).size === 10 &&
             selected.every(x => x.rank >= 1 && x.rank <= 10);
    });
  }).sort(([a],[b]) => b.localeCompare(a));
  if (!valid.length) throw new Error("Aucune semaine Netflix France récente et complète (10 films + 10 programmes TV). Aucun fichier modifié.");
  const [week, cats] = valid[0];
  return {
    schema: 1,
    source: "https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv",
    country: "FR",
    week,
    films: cats.Films.sort((a,b)=>a.rank-b.rank).map(({rank,title})=>({rank,title})),
    series: cats.TV.sort((a,b)=>a.rank-b.rank).map(({rank,title,season})=>({rank,title,season}))
  };
}
