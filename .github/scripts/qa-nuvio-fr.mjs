import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const { isTelevisionSource, updateRollingYearFilters, updateRollingWeekFilters } = require('../../scripts/catalog-utils.js');

const siteTranslations = JSON.parse(readFileSync('locales/site-fr.json', 'utf8'));
const collectionTranslations = JSON.parse(readFileSync('locales/fr.json', 'utf8'));
assert(Object.keys(siteTranslations).length >= 800, 'Translations interface absentes');
assert(Object.keys(collectionTranslations).length >= 1800, 'Traductions des catalogues absentes');
const expectedLabels = {
  'Emerald Fennell (Best Of)': 'Emerald Fennell (films incontournables)',
  'Illumination Blockbusters': 'Blockbusters du studio Illumination',
  'Atmospheric Mystery Slow Burns': 'Mystères à tension progressive',
  'Best Film Editing-Editing Winners 1934-2025': 'Prix du meilleur montage (1934–2025)',
  '00s Movies': 'Films et séries des années 2000',
  '50s Movies': 'Films et séries des années 1950',
  'Networks': 'Chaînes',
  'Studios': 'Studios',
  'For You': 'Pour vous',
  'New Soap Series': 'Nouveaux feuilletons'
};
for (const [source, expected] of Object.entries(expectedLabels)) {
  assert.equal(collectionTranslations[source], expected, 'Traduction incorrecte : ' + source);
}

// Validation exhaustive de toutes les sous-catégories de toutes les plateformes.
const streamingFixtures = JSON.parse(readFileSync('collections/streaming_services.json', 'utf8'));
const streamingPlatforms = streamingFixtures.flatMap(c => c.folders || []);
const streamingSources = streamingPlatforms.flatMap(f => f.sources || []);
const streamingLabels = [...new Set(streamingSources.map(s => s.title))];
assert.equal(streamingPlatforms.length, 22, 'Nombre de plateformes différent de la référence');
assert.equal(streamingSources.length, 743, 'Nombre de sous-catégories différent de la référence');
assert.equal(streamingLabels.length, 55, 'Nombre de libellés distincts différent de la référence');
for (const source of streamingSources) {
  assert(source.id && source.title, 'Source sans identifiant ou libellé');
  assert(Object.hasOwn(collectionTranslations, source.title), 'Traduction manquante : ' + source.title);
  assert(collectionTranslations[source.title].trim() && collectionTranslations[source.title] !== source.title,
    'Sous-catégorie non traduite : ' + source.title);
}
assert.equal(new Set(streamingLabels.map(t => collectionTranslations[t])).size, streamingLabels.length,
  'Deux sous-catégories différentes ont été traduites de la même manière');
assert.equal(collectionTranslations['Anime Movies'], "Films d'animation japonaise");
assert.equal(collectionTranslations['Animation Movies'], "Films d'animation");
assert.equal(collectionTranslations['Western Movies'], 'Westerns');
assert.equal(collectionTranslations['Western Series'], 'Séries de western');


// Vérifier exhaustivement les sources versionnées (sans toucher aux médias ni aux filtres).
const networksFixture = JSON.parse(readFileSync('collections/networks.json', 'utf8'));
const genresFixture = JSON.parse(readFileSync('collections/genres.json', 'utf8'));
// Les films et les séries doivent interroger des API TMDB distinctes.
assert(isTelevisionSource({mediaType:'TV'}));
assert(isTelevisionSource({mediaType:'TV_SHOW'}));
assert(isTelevisionSource({mediaType:'tv'}));
assert(!isTelevisionSource({mediaType:'MOVIE'}));

// Simulation du 1er janvier 2027 et 2028 : pas de modification des décennies historiques.
const rollingFixture = structuredClone(genresFixture);
const originalGenreSources = genresFixture.flatMap(c => c.folders.flatMap(f => f.sources || []));
const rollingGenreSources = rollingFixture.flatMap(c => c.folders.flatMap(f => f.sources || []));
assert.equal(updateRollingYearFilters(rollingFixture, 2026), 0);
assert.equal(updateRollingYearFilters(rollingFixture, 2027), 45);
assert.equal(updateRollingYearFilters(rollingFixture, 2027), 0, 'Renouvellement annuel non idempotent');
assert.equal(updateRollingYearFilters(rollingFixture, 2028), 45);
for (let i=0; i<originalGenreSources.length; i++) {
  const before = originalGenreSources[i], after = rollingGenreSources[i];
  assert.equal(before.id, after.id);
  assert.equal(before.title, after.title);
  assert.equal(before.mediaType, after.mediaType);
  const annual = /^Top of the Year (?:Films|Séries|Movies|Series|TV Shows)$/i.test(before.title);
  if (annual) {
    assert.equal(after.filters.year, 2028);
    assert.equal(after.filters.releaseDateGte, '2028-01-01');
    assert.equal(after.filters.releaseDateLte, '2028-12-31');
  } else {
    assert.deepEqual(after, before, 'Source historique ou non annuelle modifiée');
  }
}
const historicalFixture = JSON.parse(readFileSync('collections/by_decade.json','utf8'));
const historicalCopy = structuredClone(historicalFixture);
assert.equal(updateRollingYearFilters(historicalCopy, 2028), 0);
assert.deepEqual(historicalCopy,historicalFixture);
const trendingFixture = JSON.parse(readFileSync('collections/trending_new.json','utf8'));
const trendingCopy = structuredClone(trendingFixture);
assert(updateRollingWeekFilters(trendingCopy, new Date('2027-01-06T12:00:00Z')) >= 30,
  'Nouveautés hebdomadaires non actualisées');
assert.equal(updateRollingWeekFilters(trendingCopy, new Date('2027-01-06T16:00:00Z')), 0,
  'Actualisation hebdomadaire non idempotente');
assert(readFileSync('index.html','utf8').indexOf('scripts/catalog-utils.js') <
  readFileSync('index.html','utf8').indexOf('app.js'), 'Utilitaires chargés après app.js');

const fixtureNetworks = networksFixture.flatMap(c => c.folders || []);
const fixtureGenres = genresFixture.flatMap(c => c.folders || []);
const fixtureNetworkSources = fixtureNetworks.flatMap(f => f.sources || []);
const fixtureGenreSources = fixtureGenres.flatMap(f => f.sources || []);
assert.equal(fixtureNetworks.length, 68);
assert.equal(fixtureGenres.length, 25);
assert.equal(fixtureNetworkSources.length, 204);
assert.equal(fixtureGenreSources.length, 197);
for (const s of [...fixtureNetworkSources, ...fixtureGenreSources]) {
  assert(s.id && s.title, 'Sous-catégorie sans titre ou identifiant');
  assert(collectionTranslations[s.title], 'Traduction absente du fichier source : ' + s.title);
}
const expectedGenres = [
  'Action','Aventure','Animation','Animés','Comédie','Policier','Documentaire',
  'Drame','Famille','Fantastique','Histoire','Horreur','Dramas coréens',
  'Arts martiaux','Musique et comédies musicales','Mystère','Romance',
  'Comédie romantique','Science-fiction','Sport','Stand-up','Super-héros',
  'Thriller','Guerre','Western'
];
const canonicalNetworkTitles = ['Séries populaires','Séries récentes','Séries les mieux notées'];
const canonicalGenreTitles = [
  'Nouveaux films','Nouvelles séries','Films populaires','Séries populaires',
  'Films les mieux notés de tous les temps','Séries les mieux notées de tous les temps',
  "Films les mieux notés de l'année","Séries les mieux notées de l'année",
  'Comédies musicales populaires','Comédies musicales les mieux notées'
];
for (const v of canonicalNetworkTitles) assert(Object.values(collectionTranslations).includes(v), 'Chaînes : traduction manquante '+v);
for (const v of canonicalGenreTitles) assert(Object.values(collectionTranslations).includes(v), 'Genres : traduction manquante '+v);

// Vérifier tous les titres, dossiers et filtres de « Ambiances et émotions » et « Basé sur ».
const moodFixture = JSON.parse(readFileSync('collections/moods_vibes.json','utf8'));
const basedFixture = JSON.parse(readFileSync('collections/based_on.json','utf8'));
const moodFolderList = moodFixture[0]?.folders || [];
const basedFolderList = basedFixture[0]?.folders || [];
assert.equal(moodFolderList.length, 10);
assert.equal(basedFolderList.length, 10);
assert.equal(moodFolderList.reduce((n,f)=>n+(f.sources||[]).length,0),60);
assert.equal(basedFolderList.reduce((n,f)=>n+(f.sources||[]).length,0),60);
for (const f of moodFolderList) {
  assert(collectionTranslations[f.title]?.trim(), 'Titre ambiance manquant : '+f.title);
  for (const source of f.sources || [])
    assert(collectionTranslations[source.title]?.trim(), 'Sous-catégorie ambiance manquante : '+source.title);
}
for (const f of basedFolderList) {
  if (f.title !== 'Play') assert(collectionTranslations[f.title]?.trim(), 'Dossier basé sur manquant : '+f.title);
  for (const source of f.sources || [])
    assert(collectionTranslations[source.title]?.trim(), 'Sous-catégorie basé sur manquante : '+source.title);
}
assert.equal(collectionTranslations['Play'], 'Jouer', 'Un bouton de lecture a été renommé');
assert.equal(collectionTranslations['Based on'], 'Basé sur');
assert.equal(collectionTranslations['Spooky & Creepy'], 'Frissons et épouvante');
assert.equal(collectionTranslations['Recent Cozy Releases'], 'Sorties récentes pleines de douceur');

// Exhaustive fixtures for the 152 actors and 84 directors.
const actorsFixture = JSON.parse(readFileSync('collections/actors.json','utf8'))[0];
const directorsFixture = JSON.parse(readFileSync('collections/legendary_directors.json','utf8'))[0];
const actorNames=actorsFixture.folders.map(f=>f.title);
const directorNames=directorsFixture.folders.map(f=>f.title);
const actorSources=actorsFixture.folders.flatMap(f=>f.sources||[]);
const directorSources=directorsFixture.folders.flatMap(f=>f.sources||[]);
assert.equal(actorNames.length,152);
assert.equal(directorNames.length,84);
assert.equal(actorSources.length,668);
assert.equal(directorSources.length,168);
for(const name of [...actorNames,...directorNames]) assert.equal(collectionTranslations[name],name,'Nom propre modifié : '+name);
for(const s of [...actorSources,...directorSources]) assert(s.id && collectionTranslations[s.title], 'Sous-catégorie acteur/réalisateur sans traduction : '+s.title);
for(const f of directorsFixture.folders) {
  assert.equal(f.sources.length,2,'Nombre de sous-catégories réalisateur inattendu : '+f.title);
  assert.equal(collectionTranslations[f.title+' (Best Of)'],f.title+' (films incontournables)');
  assert.equal(collectionTranslations[f.title+' (Recent)'],f.title+' (films récents)');
  assert.equal(collectionTranslations[f.title+' (Le meilleur de)'],f.title+' (films incontournables)');
}
assert.equal(collectionTranslations['Actors'],'Acteurs');
assert.equal(collectionTranslations['Legendary Directors'],'Réalisateurs légendaires');

// Vérification exhaustive des 3 collections versionnées, sans modifier leurs fichiers.
const decadeFixture = JSON.parse(readFileSync('collections/by_decade.json','utf8'))[0];
const animeFixture = JSON.parse(readFileSync('collections/anime.json','utf8'))[0];
const awardsFixture = JSON.parse(readFileSync('collections/awards.json','utf8'))[0];
const extraFixtures = [decadeFixture,animeFixture,awardsFixture];
const expectedFolderTotals=[8,6,3], expectedSourceTotals=[112,36,55];
for(let i=0;i<extraFixtures.length;i++){
  const c=extraFixtures[i],sources=c.folders.flatMap(f=>f.sources||[]);
  assert.equal(c.folders.length,expectedFolderTotals[i],'Dossiers manquants : '+c.title);
  assert.equal(sources.length,expectedSourceTotals[i],'Sources manquantes : '+c.title);
  assert(collectionTranslations[c.title], 'Catégorie non traduite : '+c.title);
  for(const f of c.folders){
    assert(collectionTranslations[f.title], 'Dossier non traduit : '+f.title);
    for(const source of f.sources){
      assert(source.id && source.title, 'Données de source invalides dans '+c.title);
      assert(collectionTranslations[source.title]?.trim(), 'Sous-catégorie non traduite : '+source.title);
    }
  }
}
assert.equal(collectionTranslations['By Decade'],'Par décennie');
assert.equal(collectionTranslations['Anime'],'Animés');
assert.equal(collectionTranslations['Awards'],'Récompenses');
assert.equal(collectionTranslations['Bones, WIT & Trigger'],'Bones, WIT Studio et Trigger');
assert.equal(collectionTranslations['Popular 90s Movies'],'Films populaires des années 1990');
assert.equal(collectionTranslations['Most Popular of the Year 2020'],'Films les plus populaires de 2020');
assert.equal(collectionTranslations['Grand Prix Winners 1967-2025'],'Grand Prix : lauréats (1967–2025)');

// Audit intégral des catalogues originaux (pas de modification des données).
const internationalFixture=JSON.parse(readFileSync('collections/international_cinema.json','utf8'))[0];
const documentariesFixture=JSON.parse(readFileSync('collections/documentaries.json','utf8'))[0];
const realityFixture=JSON.parse(readFileSync('collections/reality_tv.json','utf8'))[0];
const targetOriginals=[internationalFixture,documentariesFixture,realityFixture];
const targetTotals=[[65,383],[7,42],[6,36]];
for(let i=0;i<targetOriginals.length;i++){
  const collection=targetOriginals[i],actualSources=collection.folders.flatMap(f=>f.sources||[]);
  assert.equal(collection.folders.length,targetTotals[i][0],'Dossiers source inattendus : '+collection.title);
  assert.equal(actualSources.length,targetTotals[i][1],'Sources originales inattendues : '+collection.title);
  assert(collectionTranslations[collection.title], 'Catégorie française introuvable : '+collection.title);
  for(const folder of collection.folders){
    assert(collectionTranslations[folder.title], 'Dossier sans traduction : '+folder.title);
    for(const source of folder.sources||[]){
      assert(source.id && collectionTranslations[source.title], 'Source sans traduction : '+source.title);
    }
  }
}
assert.equal(collectionTranslations['International Cinema'],'Cinéma international');
assert.equal(collectionTranslations['Documentaries'],'Documentaires');
assert.equal(collectionTranslations['Reality TV'],'Télé-réalité');
assert.equal(collectionTranslations['Food Network Favorites'],'Émissions incontournables de Food Network');
assert.equal(collectionTranslations['Recent & New French Releases'],'Nouveautés du cinéma français');
assert.equal(collectionTranslations['Recent & New East Asian Releases'],"Nouveautés du cinéma d'Asie de l'Est");
assert.equal(collectionTranslations['Juicy Drama, Dating & Relationship'],'Conflits, rencontres et relations');
assert.equal(collectionTranslations['US Cinéma'],'Cinéma latino-américain');

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
const scriptErrors = [];
const failedLocal = [];

page.on('pageerror', error => scriptErrors.push(error.message));
page.on('response', response => {
  const url = response.url();
  if (url.startsWith('http://127.0.0.1:8877/') && response.status() >= 400) {
    failedLocal.push(response.status() + ' ' + url);
  }
});

try {
  await page.goto('http://127.0.0.1:8877/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.MaCollectionExport?.assembleFilteredDatabase && document.documentElement.lang === 'fr', { timeout: 60000 });
  await page.waitForFunction(() => document.body.textContent.includes('Configurer et envoyer à Nuvio'), { timeout: 60000 });
  // Intercepter les appels TMDB : aucune requête externe n'est nécessaire pour ce test.
  const previewRequests = [];
  await page.route('https://api.themoviedb.org/3/discover/**', async route => {
    previewRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ results:[{poster_path:'/qa-poster.jpg',backdrop_path:'/qa-backdrop.jpg'}] }) });
  });
  const previewPaths = await page.evaluate(async () => {
    const folder = {tileShape:'POSTER'};
    const base = {provider:'tmdb',tmdbSourceType:'DISCOVER',
      sortBy:'popularity.desc',filters:{year:2027,withGenres:'16'}};
    return {
      tv:await fetchLiveTitles(folder,{...base,mediaType:'TV'}),
      tvShow:await fetchLiveTitles(folder,{...base,mediaType:'TV_SHOW'}),
      film:await fetchLiveTitles(folder,{...base,mediaType:'MOVIE'}),
      annual:window.MaCollectionCatalogUtils?.updateRollingYearFilters(
        structuredClone(window.NUVIO_DATABASE),2027)
    };
  });
  assert.deepEqual(previewPaths.tv,['/qa-poster.jpg']);
  assert.deepEqual(previewPaths.tvShow,['/qa-poster.jpg']);
  assert.deepEqual(previewPaths.film,['/qa-poster.jpg']);
  assert.equal(previewPaths.annual,45,'Filtres de l’année courante non actualisés dans le site');
  const previewEndpoints = previewRequests.map(raw => new URL(raw));
  assert.equal(previewEndpoints.length,3);
  assert(previewEndpoints[0].pathname.endsWith('/discover/tv'));
  assert(previewEndpoints[1].pathname.endsWith('/discover/tv'));
  assert(previewEndpoints[2].pathname.endsWith('/discover/movie'));
  assert.equal(previewEndpoints[0].searchParams.get('first_air_date_year'),'2027');
  assert.equal(previewEndpoints[2].searchParams.get('primary_release_year'),'2027');
  await page.unroute('https://api.themoviedb.org/3/discover/**');

  // Auditer aussi la base réellement chargée par le site, pas seulement le fichier de référence.
  const liveStreaming = await page.evaluate(async () => {
    const db = typeof database !== 'undefined' ? database : (window.database || []);
    const group = db.find(c => c.id === 'collection-ERFS5GWK' || c.title === 'Streaming Services');
    if (!group) return { found: false };
    const dict = await fetch('locales/fr.json').then(r => r.json());
    const titles = (group.folders || []).flatMap(f => (f.sources || []).map(s => s.title));
    const alreadyFrench = new Set(['Nouveaux films', 'Nouvelles séries']);
    const missing = [...new Set(titles.filter(t => !dict[t] || (dict[t] === t && !alreadyFrench.has(t))))];
    const section = document.createElement('section');
    section.id = 'qa-live-streaming-labels';
    for (const title of new Set(titles)) {
      const label = document.createElement('span');
      label.dataset.original = title;
      label.textContent = title;
      section.appendChild(label);
    }
    document.body.appendChild(section);
    return { found: true, folders: group.folders.length, sources: titles.length,
      uniqueLabels: new Set(titles).size, missing };
  });
  assert(liveStreaming.found, 'La catégorie plateformes est absente de la base chargée par le site');
  assert(liveStreaming.folders > 0 && liveStreaming.sources > 0, 'Catégorie streaming vide');
  assert.deepEqual(liveStreaming.missing, [], 'Libellés non traduits dans le catalogue réel');
  await page.waitForFunction(dict => {
    const nodes = [...document.querySelectorAll('#qa-live-streaming-labels span')];
    return nodes.length > 0 && nodes.every(n => n.textContent === dict[n.dataset.original]);
  }, collectionTranslations, { timeout: 15000 });

  const scan = await page.evaluate(() => {
    const db = typeof database !== 'undefined' ? database : (window.database || []);
    return ['Networks','Genres'].map(title => {
      const group = db.find(c => c.title === title || (title === 'Networks' && c.id === '27bda92a-f626-4093-a2ba-0a32dc09437a') || (title === 'Genres' && c.id === 'collection-HFTCV0TA'));
      return { title, present: !!group, folderCount: group?.folders?.length,
        sourceCount: group?.folders?.reduce((n,f) => n+(f.sources?.length||0),0),
        uniqueTitles: [...new Set(group?.folders?.flatMap(f => f.sources?.map(x=>x.title) || [])||[])],
        folderTitles: group?.folders?.map(f => f.title) };
    });
  });
  console.log("QA_LIVE_CATEGORY_NAMES="+JSON.stringify(scan));
  const categoryAudit = await page.evaluate(async () => {
    const loaded = typeof database !== 'undefined' ? database : (window.database || []);
    const network = loaded.find(c => c.id === '27bda92a-f626-4093-a2ba-0a32dc09437a');
    const genre = loaded.find(c => c.id === 'collection-HFTCV0TA');
    if (!network || !genre) return { exists: false };
    const copy = structuredClone([network, genre]);
    const origin = structuredClone(copy);
    await window.MaCollectionExport.applyLocaleToCollection(copy);
    const originalNet = origin[0].folders, translatedNet=copy[0].folders;
    const namesUnchanged = originalNet.every((f,i) => f.title === translatedNet[i].title);
    const originalHistory = originalNet.find(f => f.id === 'folder-I7A4OFK0')?.title;
    const genreNames = copy[1].folders.map(f => f.title);
    const rawGenres = origin[1].folders.map(f => f.title);
    const flat = c => c.folders.flatMap(f => f.sources||[]);
    const actualSources = copy.map(flat).flat();
    const originalSources = origin.map(flat).flat();
    const translation = await fetch('locales/fr.json').then(r=>r.json());
    const badTitles = originalSources.flatMap((s,i)=>
      actualSources[i].title === (translation[s.title] || s.title)
        ? [] : [s.title+' -> '+actualSources[i].title]);
    const withoutLabels = n => Array.isArray(n) ? n.map(withoutLabels)
      : n && typeof n==='object'
        ? Object.fromEntries(Object.entries(n).filter(([k])=>!['title','name','genre'].includes(k)).map(([k,v])=>[k,withoutLabels(v)]))
        : n;
    const metadataIntact=JSON.stringify(withoutLabels(origin))===JSON.stringify(withoutLabels(copy));
    const liveNetworkLabels=[...new Set(flat(origin[0]).map(s=>s.title))];
    const liveGenreLabels=[...new Set(flat(origin[1]).map(s=>s.title))];
    const wrapper=document.createElement('div');
    wrapper.id='qa-network-genre-translations';
    for(const label of [...new Set([...liveNetworkLabels,...liveGenreLabels,...rawGenres])]){
      const el=document.createElement('span');
      el.dataset.label=label;
      el.textContent=label;
      wrapper.append(el);
    }
    document.body.append(wrapper);
    return {
      exists:true,networkFolders:originalNet.length, genreFolders:origin[1].folders.length,
      sources:originalSources.length, networkSourceCount:flat(origin[0]).length,
      genreSourceCount:flat(origin[1]).length, labels:liveNetworkLabels.concat(liveGenreLabels),
      originalHistory, namesUnchanged, genreNames, metadataIntact, badTitles
    };
  });
  assert(categoryAudit.exists, 'Catégories Chaînes ou Genres absentes de la base réelle');
  assert.equal(categoryAudit.networkFolders, 68);
  assert.equal(categoryAudit.genreFolders, 25);
  assert.equal(categoryAudit.networkSourceCount, 204);
  assert.equal(categoryAudit.genreSourceCount, 197);
  assert.equal(categoryAudit.sources, 401);
  assert.equal(categoryAudit.originalHistory, 'History', 'La chaîne History a été traduite par erreur');
  assert(categoryAudit.namesUnchanged, 'Le nom officiel d’une chaîne a été modifié');
  assert(categoryAudit.metadataIntact, 'Filtres, identifiants ou médias modifiés');
  assert.deepEqual(categoryAudit.genreNames, expectedGenres, 'Un genre est incorrect ou non traduit');
  assert.deepEqual(categoryAudit.badTitles, [], 'Intitulés manquants pour les 401 sous-catégories');
  const translatedNetworkLabels = new Set(canonicalNetworkTitles);
  const translatedGenreLabels = new Set(canonicalGenreTitles);
  for(const x of canonicalNetworkTitles) assert(Object.values(collectionTranslations).includes(x));
  for(const x of canonicalGenreTitles) assert(Object.values(collectionTranslations).includes(x));
  await page.waitForFunction(dict => {
    const spans=[...document.querySelectorAll('#qa-network-genre-translations span')];
    return spans.length>=15 && spans.every(n=>n.textContent===(dict[n.dataset.label]||n.dataset.label));
  }, collectionTranslations, {timeout:15000});

  // Diagnostic des deux catégories réellement générées par la base Nuvio.
  const currentMoodsBased = await page.evaluate(() => {
    const db = typeof database !== 'undefined' ? database : (window.database || []);
    return [
      ['Moods & Vibes','collection-3UOL2OFV'],
      ['Based on','collection-BASEDON1']
    ].map(([name,id]) => {
      const cat=db.find(c=>c.id===id);
      return {name,present:!!cat,folders:(cat?.folders||[]).map(f=>({id:f.id,title:f.title,sources:(f.sources||[]).map(s=>s.title)}))};
    });
  });
  console.log('QA_LIVE_MOODS_BASED='+JSON.stringify(currentMoodsBased));
  const moodsAndBasedValidation = await page.evaluate(async () => {
    const db = typeof database !== 'undefined' ? database : (window.database || []);
    const ids = ['collection-3UOL2OFV','collection-BASEDON1'];
    const originals = ids.map(id => db.find(c=>c.id===id));
    if (originals.some(x=>!x)) return {exists:false};
    const translation = await fetch('locales/fr.json').then(r=>r.json());
    const data = structuredClone(originals);
    await window.MaCollectionExport.applyLocaleToCollection(data);
    const sourceCount = x => x.folders.reduce((n,f)=>n+(f.sources||[]).length,0);
    const translatedTitles = (data,origin) => {
      const errors=[];
      for(let i=0;i<origin.folders.length;i++) {
        const f=origin.folders[i], f2=data.folders[i];
        const expected=f.id==='folder-BSPLAY01'?'Pièces de théâtre':translation[f.title]||f.title;
        if(f2.title!==expected) errors.push('Dossier : '+f.title+' -> '+f2.title+' au lieu de '+expected);
        for(let j=0;j<f.sources.length;j++){
          const one=f.sources[j],two=f2.sources[j],expected=translation[one.title]||one.title;
          if(two.title!==expected)errors.push(one.title+' -> '+two.title+' au lieu de '+expected);
        }
      }
      return errors;
    };
    const failures=data.flatMap((x,i)=>translatedTitles(x,originals[i]));
    const stripLabels = obj => Array.isArray(obj) ? obj.map(stripLabels)
      : obj && typeof obj === 'object'
      ? Object.fromEntries(Object.entries(obj).filter(([k])=>!['title','name','genre'].includes(k))
        .map(([k,v])=>[k,stripLabels(v)]))
      : obj;
    const preserved=JSON.stringify(stripLabels(originals))===JSON.stringify(stripLabels(data));
    const theatre=data[1].folders.find(f=>f.id==='folder-BSPLAY01');
    const container=document.createElement('section');
    container.id='qa-moods-and-based-labels';
    const liveText=[...new Set(originals.flatMap(c=>[
      c.title,...c.folders.filter(f=>f.id!=='folder-BSPLAY01').flatMap(f=>[f.title,...(f.sources||[]).map(s=>s.title)])
    ]))];
    for(const v of liveText){
      const e=document.createElement('span');
      e.dataset.source=v;
      e.textContent=v;
      container.appendChild(e);
    }
    document.body.appendChild(container);
    return {
      exists:true,moodFolders:originals[0].folders.length,basedFolders:originals[1].folders.length,
      moodSources:sourceCount(originals[0]),basedSources:sourceCount(originals[1]),
      translationErrors:failures,preserved,theatreTitle:theatre?.title,
      textSamples:liveText.length,
      categoryTitles:data.map(c=>c.title)
    };
  });
  assert(moodsAndBasedValidation.exists,'Ambiances ou Basé sur absente de la base réelle');
  assert.equal(moodsAndBasedValidation.moodFolders,10);
  assert.equal(moodsAndBasedValidation.basedFolders,10);
  assert.equal(moodsAndBasedValidation.moodSources,60);
  assert.equal(moodsAndBasedValidation.basedSources,60);
  assert(moodsAndBasedValidation.preserved,'Identifiants, filtres ou médias modifiés');
  assert.deepEqual(moodsAndBasedValidation.translationErrors,[],'Erreur de traduction en export');
  assert.equal(moodsAndBasedValidation.theatreTitle,'Pièces de théâtre');
  assert.deepEqual(moodsAndBasedValidation.categoryTitles,['Ambiances et émotions','Basé sur']);
  await page.waitForFunction(dict => {
    const nodes=[...document.querySelectorAll('#qa-moods-and-based-labels span')];
    return nodes.length>60 && nodes.every(e=>e.textContent===(dict[e.dataset.source]||e.dataset.source));
  }, collectionTranslations, {timeout:15000});
  // Diagnostic des intitulés chargés réellement par le navigateur.
  const peopleAudit = await page.evaluate(() => {
    const db = typeof database !== 'undefined' ? database : (window.database || []);
    return [['Actors','collection-1IPJJWUO'],['Legendary Directors','collection-13LJW3A6']].map(([category,id]) => {
      const c=db.find(x=>x.id===id);
      return {category,exists:!!c,title:c?.title,
        folders:c?.folders?.length,sourceCount:c?.folders?.reduce((n,f)=>n+(f.sources||[]).length,0),
        folderNames:c?.folders?.map(f=>({id:f.id,title:f.title})).slice(0,25),
        sourceSamples:[...new Set(c?.folders?.flatMap(f=>(f.sources||[]).map(s=>s.title))||[])].slice(0,28)};
    });
  });
  console.log("QA_ACTORS_DIRECTORS_LIVE="+JSON.stringify(peopleAudit));
  const personCollections = await page.evaluate(async () => {
    const db=typeof database !== 'undefined' ? database : (window.database || []);
    const original=['collection-1IPJJWUO','collection-13LJW3A6'].map(id=>db.find(c=>c.id===id));
    if(original.some(c=>!c))return{exists:false};
    const clones=structuredClone(original),translations=await fetch('locales/fr.json').then(r=>r.json());
    await window.MaCollectionExport.applyLocaleToCollection(clones);
    const flatSources=c=>c.folders.flatMap(f=>f.sources||[]);
    const errs=[];
    for(let i=0;i<2;i++){
      for(let j=0;j<original[i].folders.length;j++){
        const before=original[i].folders[j],after=clones[i].folders[j];
        if(before.title!==after.title)errs.push('Nom de personne modifié : '+before.title);
        for(let k=0;k<(before.sources||[]).length;k++){
          const source=before.sources[k],localized=after.sources[k];
          const wanted=translations[source.title];
          if(!wanted||wanted!==localized.title)errs.push('Source non traduite : '+source.title+' / '+localized.title);
        }
      }
    }
    const removeDisplay=x=>Array.isArray(x)?x.map(removeDisplay):
      x && typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([k])=>!['title','name','genre'].includes(k)).map(([k,v])=>[k,removeDisplay(v)])):x;
    const stable=JSON.stringify(removeDisplay(original))===JSON.stringify(removeDisplay(clones));
    const container=document.createElement('section');
    container.id='qa-people-translations';
    const titles=[...new Set(original.flatMap(c=>[c.title,...c.folders.flatMap(f=>[f.title,...(f.sources||[]).map(s=>s.title)])]))];
    for(const title of titles){const element=document.createElement('span');element.dataset.original=title;element.textContent=title;container.appendChild(element);}
    document.body.appendChild(container);
    return {exists:true,actorFolders:original[0].folders.length,directorFolders:original[1].folders.length,
      actorSources:flatSources(original[0]).length,directorSources:flatSources(original[1]).length,
      errors:errs,stable,namesUnchanged:original.every((c,i)=>c.folders.every((f,j)=>f.title===clones[i].folders[j].title)),
      categories:clones.map(c=>c.title),distinctLabels:titles.length};
  });
  assert(personCollections.exists,'Catégories Acteurs ou Réalisateurs absentes');
  assert.equal(personCollections.actorFolders,152);
  assert.equal(personCollections.directorFolders,84);
  assert.equal(personCollections.actorSources,668);
  assert.equal(personCollections.directorSources,168);
  assert.deepEqual(personCollections.errors,[],'Traductions personnes incorrectes');
  assert(personCollections.stable && personCollections.namesUnchanged,'Noms propres, filtres ou médias modifiés');
  assert.deepEqual(personCollections.categories,['Acteurs','Réalisateurs légendaires']);
  await page.waitForFunction(dict=>{
    const nodes=[...document.querySelectorAll('#qa-people-translations span')];
    return nodes.length>300 && nodes.every(n=>n.textContent===(dict[n.dataset.original]||n.dataset.original));
  },collectionTranslations,{timeout:20000});
  const targetAudit = await page.evaluate(() => {
    const db=typeof database !== 'undefined' ? database : (window.database||[]);
    return [['By Decade','collection-Y2HQBZ5I'],['Anime','collection-b530d60c'],['Awards','collection-56d0517f']].map(([title,id])=>{
      const c=db.find(x=>x.id===id);
      return {category:title,found:!!c,title:c?.title,folders:(c?.folders||[]).map(f=>({
        id:f.id,title:f.title,sources:(f.sources||[]).map(s=>s.title)
      }))};
    });
  });
  console.log('QA_DECADE_ANIME_AWARDS_LIVE='+JSON.stringify(targetAudit));
  const decadeAnimeAwardsValidation = await page.evaluate(async () => {
    const db=typeof database!=='undefined'?database:(window.database||[]);
    const expectedIds=['collection-Y2HQBZ5I','collection-b530d60c','collection-56d0517f'];
    const original=expectedIds.map(id=>db.find(c=>c.id===id));
    if(original.some(x=>!x))return {exists:false};
    const clone=structuredClone(original);
    const dictionary=await fetch('locales/fr.json').then(r=>r.json());
    await window.MaCollectionExport.applyLocaleToCollection(clone);
    const wrong=[];
    let checked=0;
    for(let i=0;i<original.length;i++){
      const c=original[i],localized=clone[i];
      if(localized.title!==(dictionary[c.title]||c.title))wrong.push('Catégorie : '+c.title+' => '+localized.title);
      for(let j=0;j<c.folders.length;j++){
        const before=c.folders[j],after=localized.folders[j];
        if(after.title!==(dictionary[before.title]||before.title))wrong.push('Dossier : '+before.title+' => '+after.title);
        for(let k=0;k<before.sources.length;k++){
          const b=before.sources[k],a=after.sources[k];
          if(!dictionary[b.title] || a.title!==dictionary[b.title])wrong.push('Sous-catégorie : '+b.title+' => '+a.title);
          checked++;
        }
      }
    }
    const nonDisplay=x=>Array.isArray(x)?x.map(nonDisplay)
      :x&&typeof x==='object'?Object.fromEntries(Object.entries(x)
        .filter(([k])=>!['title','name','genre'].includes(k))
        .map(([k,v])=>[k,nonDisplay(v)])):x;
    const stable=JSON.stringify(nonDisplay(original))===JSON.stringify(nonDisplay(clone));
    const wrapper=document.createElement('section');
    wrapper.id='qa-decades-anime-awards-translations';
    const labels=[...new Set(original.flatMap(c=>[c.title,...c.folders.flatMap(f=>[f.title,...f.sources.map(s=>s.title)])]))];
    for(const label of labels){
      const el=document.createElement('span');el.dataset.key=label;el.textContent=label;wrapper.appendChild(el);
    }
    document.body.appendChild(wrapper);
    return {exists:true,checked,folderCounts:original.map(c=>c.folders.length),
      sourceCounts:original.map(c=>c.folders.reduce((n,f)=>n+f.sources.length,0)),
      translatedCategories:clone.map(c=>c.title),errors:wrong,stable,distinctLabels:labels.length};
  });
  assert(decadeAnimeAwardsValidation.exists,'Décennies, animés ou récompenses absents de la base réelle');
  assert.deepEqual(decadeAnimeAwardsValidation.folderCounts,[8,6,3]);
  assert.deepEqual(decadeAnimeAwardsValidation.sourceCounts,[112,36,55]);
  assert.equal(decadeAnimeAwardsValidation.checked,203);
  assert.deepEqual(decadeAnimeAwardsValidation.errors,[],'Libellés réels non traduits');
  assert.deepEqual(decadeAnimeAwardsValidation.translatedCategories,['Par décennie','Animés','Récompenses']);
  assert(decadeAnimeAwardsValidation.stable,'Filtres, identifiants ou médias ont été modifiés');
  await page.waitForFunction(dict=>{
    const labels=[...document.querySelectorAll('#qa-decades-anime-awards-translations span')];
    return labels.length>=200 && labels.every(x=>x.textContent===dict[x.dataset.key]);
  },collectionTranslations,{timeout:20000});
  const extraLiveCategoryAudit = await page.evaluate(() => {
    const db=typeof database!=='undefined'?database:(window.database||[]);
    return [['International Cinema','collection-R69FJM5K'],['Documentaries','collection-4XMJ04BX'],['Reality TV','collection-KBP5HRRD']].map(([type,id])=>{
      const c=db.find(x=>x.id===id);
      return {type,found:!!c,title:c?.title,folders:(c?.folders||[]).map(f=>({id:f.id,title:f.title,sources:(f.sources||[]).map(s=>s.title)}))};
    });
  });
  console.log('QA_INTERNATIONAL_DOCS_REALITY_LIVE='+JSON.stringify(extraLiveCategoryAudit));
  const internationalDocsRealityValidation=await page.evaluate(async()=>{
    const db=typeof database!=='undefined'?database:(window.database||[]);
    const ids=['collection-R69FJM5K','collection-4XMJ04BX','collection-KBP5HRRD'];
    const origin=ids.map(id=>db.find(c=>c.id===id));
    if(origin.some(x=>!x))return{exists:false};
    const copy=structuredClone(origin),dict=await fetch('locales/fr.json').then(r=>r.json());
    await window.MaCollectionExport.applyLocaleToCollection(copy);
    const expectedSources=[114,42,36],expectedFolders=[19,7,6];
    const errors=[],statistics=[];
    for(let i=0;i<origin.length;i++){
      const before=origin[i],after=copy[i];
      if(after.title!==dict[before.title])errors.push('Catégorie non traduite : '+before.title);
      const sourceCount=before.folders.reduce((n,f)=>n+(f.sources||[]).length,0);
      statistics.push({folders:before.folders.length,sources:sourceCount});
      if(sourceCount!==expectedSources[i]||before.folders.length!==expectedFolders[i])errors.push('Structure réelle inattendue : '+before.title);
      for(let j=0;j<before.folders.length;j++){
        const folder=before.folders[j],trans=after.folders[j];
        if(!dict[folder.title]||trans.title!==dict[folder.title])errors.push('Dossier non traduit : '+folder.title+' -> '+trans.title);
        for(let k=0;k<(folder.sources||[]).length;k++){
          const raw=folder.sources[k],text=trans.sources[k];
          if(!dict[raw.title]||text.title!==dict[raw.title])errors.push('Source non traduite : '+raw.title+' -> '+text.title);
        }
      }
    }
    const removeNames=x=>Array.isArray(x)?x.map(removeNames):
      x&&typeof x==='object'?Object.fromEntries(Object.entries(x)
        .filter(([k])=>!['title','name','genre'].includes(k))
        .map(([k,v])=>[k,removeNames(v)])):x;
    const mediaAndFiltersPreserved=JSON.stringify(removeNames(origin))===JSON.stringify(removeNames(copy));
    const items=[...new Set(origin.flatMap(c=>[c.title,...c.folders.flatMap(f=>[f.title,...(f.sources||[]).map(s=>s.title)])]))];
    const container=document.createElement('section');
    container.id='qa-international-docs-reality';
    for(const item of items){const label=document.createElement('span');label.dataset.source=item;label.textContent=item;container.appendChild(label);}
    document.body.appendChild(container);
    const regional=origin[0].folders.find(f=>f.id==='folder-DAKK95AS');
    const correct=copy[0].folders.find(f=>f.id==='folder-DAKK95AS');
    return{exists:true,statistics,checked:statistics.reduce((n,v)=>n+v.sources,0),
      errors,mediaAndFiltersPreserved,regionalBefore:regional?.title,regionalAfter:correct?.title,
      distinctLabels:items.length,categories:copy.map(c=>c.title)};
  });
  assert(internationalDocsRealityValidation.exists,'Catégorie manquante dans la base chargée');
  assert.deepEqual(internationalDocsRealityValidation.statistics,[{folders:19,sources:114},{folders:7,sources:42},{folders:6,sources:36}]);
  assert.equal(internationalDocsRealityValidation.checked,192);
  assert.deepEqual(internationalDocsRealityValidation.errors,[],'Traduction affichée ou export incorrect');
  assert(internationalDocsRealityValidation.mediaAndFiltersPreserved,'Filtres, URLs ou images modifiés');
  assert.equal(internationalDocsRealityValidation.regionalBefore,'US Cinéma');
  assert.equal(internationalDocsRealityValidation.regionalAfter,'Cinéma latino-américain');
  assert.deepEqual(internationalDocsRealityValidation.categories,['Cinéma international','Documentaires','Télé-réalité']);
  await page.waitForFunction(dict=>{
    const labels=[...document.querySelectorAll('#qa-international-docs-reality span')];
    return labels.length>=200&&labels.every(el=>el.textContent===dict[el.dataset.source]);
  },collectionTranslations,{timeout:20000});
  const rendered = await page.evaluate(async () => {
    const asset = await fetch('assets/kaptain-logo.png');
    const french = document.body.textContent.includes('Configurer et envoyer à Nuvio');
    const initial = window.MaCollectionExport.assembleFilteredDatabase();
    const raw = initial.length ? initial : (window.database || window.NUVIO_DATABASE || []);
    const cloned = structuredClone(raw);
    await window.MaCollectionExport.applyLocaleToCollection(cloned);
    const withoutDisplay = v => Array.isArray(v) ? v.map(withoutDisplay)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).filter(([k]) => !['title','name','genre'].includes(k)).map(([k,x]) => [k, withoutDisplay(x)]))
        : v;
    const stable = JSON.stringify(withoutDisplay(raw)) === JSON.stringify(withoutDisplay(cloned));
    const englishLabels = raw.flatMap(c => (c.folders || []).flatMap(f => (f.sources || []).map(s => s.title)));
    const frenchLabels = cloned.flatMap(c => (c.folders || []).flatMap(f => (f.sources || []).map(s => s.title)));
    const renamed = englishLabels.filter((x,i) => x !== frenchLabels[i]).length;
    const categoryCount = cloned.length;
    const folderCount = cloned.reduce((n,c) => n+(c.folders || []).length, 0);
    const sourceCount = cloned.reduce((n,c) => n+(c.folders || []).reduce((m,f) => m+(f.sources||[]).length,0),0);
    const marker = document.createElement('span');
    marker.textContent = 'Settings';
    const extraMarker = document.createElement('span');
    extraMarker.id = 'qa-subcategory-marker';
    extraMarker.textContent = 'Illumination Blockbusters';
    document.body.appendChild(extraMarker);
    document.body.appendChild(marker);
    return { assetOk: asset.ok, french, categoryCount, folderCount, sourceCount, renamed, stable, markerId: (marker.id = 'qa-translation-marker'), payload: cloned.slice(0, 1) };
  });
  assert(rendered.assetOk, 'Logo local non accessible');
  assert(rendered.french, 'Accueil non francisé');
  assert(rendered.categoryCount > 0 && rendered.folderCount > 0 && rendered.sourceCount > 0, 'Collections vides');
  assert(rendered.stable, 'La traduction a modifié les identifiants, filtres ou médias');
  assert(rendered.renamed > 0, 'Aucune source traduite pour Nuvio');
  await page.waitForFunction(() => document.querySelector('#qa-translation-marker')?.textContent === 'Paramètres', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#qa-subcategory-marker')?.textContent === 'Blockbusters du studio Illumination', { timeout: 15000 });

  // Le site réel doit convertir correctement les 743 titres avant leur export Nuvio.
  const streamingResult = await page.evaluate(async () => {
    const origin = await fetch('collections/streaming_services.json').then(r => r.json());
    const translated = structuredClone(origin);
    await window.MaCollectionExport.applyLocaleToCollection(translated);
    const dict = await fetch('locales/fr.json').then(r => r.json());
    const originalSources = origin.flatMap(c => c.folders.flatMap(f => f.sources || []));
    const localizedSources = translated.flatMap(c => c.folders.flatMap(f => f.sources || []));
    const problems = originalSources.flatMap((s, i) =>
      localizedSources[i]?.title === dict[s.title] ? [] : [s.title + ' -> ' + localizedSources[i]?.title]);
    const stable = (node) => Array.isArray(node) ? node.map(stable)
      : node && typeof node === 'object'
        ? Object.fromEntries(Object.entries(node).filter(([k]) => !['title','name','genre'].includes(k))
          .map(([k,v]) => [k, stable(v)]))
        : node;
    const mediaAndIdsUnchanged = JSON.stringify(stable(origin)) === JSON.stringify(stable(translated));
    const wrapper = document.createElement('section');
    wrapper.id = 'qa-streaming-labels';
    for (const label of [...new Set(originalSources.map(x => x.title))]) {
      const el = document.createElement('span');
      el.dataset.original = label;
      el.textContent = label;
      wrapper.appendChild(el);
    }
    document.body.appendChild(wrapper);
    return {
      total: originalSources.length,
      translated: localizedSources.length - problems.length,
      problems,
      mediaAndIdsUnchanged,
      platformNamesUnchanged: origin.flatMap(c => c.folders).every((f,i) =>
        f.title === translated.flatMap(c => c.folders)[i].title)
    };
  });
  assert.equal(streamingResult.total, 743, 'Fixture navigateur incomplète');
  assert.equal(streamingResult.translated, 743, 'Certaines sous-catégories ne sont pas traduites lors de l’export');
  assert.deepEqual(streamingResult.problems, [], 'Écart entre dictionnaire et export');
  assert(streamingResult.mediaAndIdsUnchanged, 'Métadonnées, URLs, identifiants ou médias modifiés');
  assert(streamingResult.platformNamesUnchanged, 'Nom officiel d’une plateforme modifié');
  await page.waitForFunction(dict => {
    const labels = [...document.querySelectorAll('#qa-streaming-labels span')];
    return labels.length === 55 && labels.every(n => n.textContent === dict[n.dataset.original]);
  }, collectionTranslations, { timeout: 15000 });

  // La traduction ne doit pas dépendre de l'option de langue choisie
  // précédemment par le navigateur. Le nouveau dépôt est 100 % FR côté Nuvio.
  await page.evaluate(() => {
    if (window.maCollectionCustomize) window.maCollectionCustomize.locale = 'en';
  });
  // Tester le vrai téléchargement JSON sans compte.
  const pendingDownload = page.waitForEvent('download', { timeout: 20000 });
  await page.evaluate(() => window.MaCollectionExport.compileAndDownloadJSON(true));
  const download = await pendingDownload;
  assert(download.suggestedFilename().endsWith('.json'), 'Extension export non JSON');
  const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
  assert(Array.isArray(exported) && exported.length === rendered.categoryCount, 'Export Nuvio incomplet');
  const netflixExport = exported.flatMap(c => c.folders || []).find(f => f.title === 'Netflix');
  assert(netflixExport, 'Netflix absent du JSON envoyé à Nuvio');
  assert((netflixExport.sources || []).some(x => x.title === 'Nouveaux films' && x.name === 'Nouveaux films'),
    'Le JSON conserve des sous-catégories anglaises lorsque la langue précédente est EN');
  assert((netflixExport.sources || []).some(x => x.title === 'Top 10 des films' && x.genre === 'Top 10 des films'),
    'La traduction ne couvre pas tous les champs de sous-catégorie');
  await page.evaluate(() => {
    if (window.maCollectionCustomize) window.maCollectionCustomize.locale = 'fr';
  });
  assert(exported.flatMap(c => c.folders || []).some(f => (f.sources || []).some(s => s.title === 'Nouveaux films')), 'Titres français manquants dans le JSON exporté');
  assert(exported.every(c => c.id && Array.isArray(c.folders)), 'Structure Nuvio incorrecte');

  // Vérification de l'assistant, sans aucune authentification.
  await page.evaluate(() => window.NuvioWizard.open());
  await page.waitForFunction(() => document.querySelector('#wizard-overlay')?.classList.contains('open')
    && document.querySelector('#wizard-panel')?.textContent.includes('Importer votre collection dans Nuvio'), { timeout: 15000 });
  await page.evaluate(() => window.NuvioWizard.close());
  const payload = rendered.payload;

  // Simulation hors ligne d'un envoi RPC Nuvio : aucun compte ni profil réel n'est touché.
  const seen = [];
  await page.route('https://api.nuvio.tv/**', async route => {
    const req = route.request();
    if (req.url().includes('sync_push_collections')) {
      seen.push(JSON.parse(req.postData() || '{}'));
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin':'*', 'access-control-allow-headers':'*' },
      body: '[]'
    });
  });
  await page.evaluate(async value => window.NuvioPush.pushCollections('qa-only-fake-token', 9999, value), payload);
  assert(seen.length === 1, 'Le bouton d’envoi Nuvio ne produit pas une requête RPC');
  assert(seen[0].p_profile_id === 9999, 'Identifiant de profil Nuvio incorrect');
  assert(Array.isArray(seen[0].p_collections_json) && seen[0].p_collections_json.length === 1, 'Collection Nuvio mal sérialisée');

  // Vérifier directement le dernier point de passage : même une collection
  // encore anglaise transmise à pushCollections doit arriver FR dans la RPC.
  const rawEnglish = [{
    id: 'qa-french-category', title: 'Streaming Services',
    folders: [{
      id: 'qa-french-folder', title: 'Netflix',
      sources: [{ id: 'qa-french-source', title: 'New Movies', name: 'New Movies',
        genre: 'New Movies', provider: 'tmdb', mediaType: 'MOVIE',
        filters: { withWatchProviders: '8', watchRegion: 'FR' } }],
      catalogSources: [{ title: 'Popular Movies', name: 'Popular Movies', genre: 'Popular Movies',
        addonId: 'test.addon', catalogId: 'non-localize-id' }]
    }]
  }];
  await page.evaluate(async original => {
    if (window.maCollectionCustomize) window.maCollectionCustomize.locale = 'en';
    await window.NuvioPush.pushCollections('qa-only-fake-token', 9999, original);
    if (window.maCollectionCustomize) window.maCollectionCustomize.locale = 'fr';
  }, rawEnglish);
  assert.equal(rawEnglish[0].folders[0].sources[0].title, 'New Movies',
    'pushCollections a modifié le tableau source');
  assert.equal(seen.length, 2, 'Le second test Nuvio ne passe pas par la RPC');
  const actual = seen[1].p_collections_json[0];
  assert.equal(actual.title, 'Plateformes de streaming');
  assert.equal(actual.folders[0].sources[0].title, 'Nouveaux films');
  assert.equal(actual.folders[0].sources[0].name, 'Nouveaux films');
  assert.equal(actual.folders[0].sources[0].genre, 'Nouveaux films');
  assert.equal(actual.folders[0].catalogSources[0].title, 'Films populaires');
  assert.equal(actual.folders[0].catalogSources[0].name, 'Films populaires');
  assert.equal(actual.folders[0].catalogSources[0].catalogId, 'non-localize-id');
  assert.equal(actual.folders[0].sources[0].filters.withWatchProviders, '8');

  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.lang === 'fr'), 'Français absent sur mobile');
  assert(!scriptErrors.length, 'Erreurs JavaScript : ' + scriptErrors.join('; '));
  assert(!failedLocal.length, 'Ressources locales indisponibles : ' + failedLocal.join('; '));
  console.log(JSON.stringify({
    success: true, siteTranslations: Object.keys(siteTranslations).length,
    collectionTranslations: Object.keys(collectionTranslations).length,
    categories: rendered.categoryCount, folders: rendered.folderCount,
    sources: rendered.sourceCount, sourceTitlesTranslated: rendered.renamed,
    assetOk: rendered.assetOk, stableMetadataAndMedia: rendered.stable,
    streamingPlatformsValidated: streamingPlatforms.length, streamingSubcategoriesValidated: streamingResult.translated, streamingUniqueLabels: streamingLabels.length,
    liveStreamingFolders: liveStreaming.folders, liveStreamingSources: liveStreaming.sources, liveStreamingUniqueLabels: liveStreaming.uniqueLabels,
    networkFoldersValidated: categoryAudit.networkFolders, genresValidated: categoryAudit.genreFolders, networkGenreSubcategoriesValidated: categoryAudit.sources, historyChannelBrandPreserved: categoryAudit.namesUnchanged,
    moodsFoldersValidated:moodsAndBasedValidation.moodFolders, basedOnFoldersValidated:moodsAndBasedValidation.basedFolders, moodsSourcesValidated:moodsAndBasedValidation.moodSources, basedOnSourcesValidated:moodsAndBasedValidation.basedSources,
    actorsValidated:personCollections.actorFolders, directorsValidated:personCollections.directorFolders, actorDirectorSubcategoriesValidated:personCollections.actorSources+personCollections.directorSources, personNamesPreserved:personCollections.namesUnchanged,
    decadeFoldersValidated:decadeAnimeAwardsValidation.folderCounts[0], animeFoldersValidated:decadeAnimeAwardsValidation.folderCounts[1], awardsFoldersValidated:decadeAnimeAwardsValidation.folderCounts[2], decadeAnimeAwardsSubcategoriesValidated:decadeAnimeAwardsValidation.checked,
    internationalDocsRealityCatalogSourcesValidated:461, internationalVisibleFolders:internationalDocsRealityValidation.statistics[0].folders, internationalVisibleSources:internationalDocsRealityValidation.statistics[0].sources, documentariesSourcesValidated:internationalDocsRealityValidation.statistics[1].sources, realitySourcesValidated:internationalDocsRealityValidation.statistics[2].sources,
    dynamicTranslation: true, wizardInFrench: true, actualJsonDownloadValidated: true, mockedNuvioRpc: true, mobileViewport: true,
    javascriptErrors: scriptErrors, missingLocalResources: failedLocal
  }, null, 2));
} finally {
  await browser.close();
}
