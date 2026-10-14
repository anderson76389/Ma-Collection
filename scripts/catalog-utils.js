/* Utilitaires communs au navigateur et au générateur d'aperçus.
 * N'altèrent ni les identifiants, ni les titres, ni les ressources graphiques.
 */
(function (root) {
  'use strict';

  // Les catalogues Nuvio codent les séries par "TV"; certains canaux utilisent "TV_SHOW".
  function isTelevisionSource(source) {
    const mediaType = String(source?.mediaType || '').toUpperCase();
    return mediaType === 'TV' || mediaType === 'TV_SHOW';
  }

  // Les sélections annuelles suivent l'année UTC courante sans toucher aux décennies
  // historiques, aux dates de palmarès ni aux années explicites dans les titres.
  // Fonction idempotente : la rappeler la même année ne change rien.
  function updateRollingYearFilters(catalogues, year = new Date().getUTCFullYear()) {
    if (!Array.isArray(catalogues) || !Number.isInteger(year) || year < 2026) return 0;
    let updated = 0;

    for (const category of catalogues) {
      const isAnnualGenres = category?.id === 'collection-HFTCV0TA';
      const isTrendingNew = category?.id === 'collection-UGED6TEZ';
      if (!isAnnualGenres && !isTrendingNew) continue;

      for (const folder of category.folders || []) {
        for (const source of folder.sources || []) {
          const title = String(source?.title || '');
          const isRollingLabel = isAnnualGenres
            ? /^Top of the Year (?:Films|Séries|Movies|Series|TV Shows)$/i.test(title)
            : /^New (?!.*\b\d{4}\b)/i.test(title);
          const filters = source?.filters;
          if (!isRollingLabel || !filters || !Number.isInteger(filters.year)
              || filters.year < 2026 || filters.year >= year) continue;

          const prior = String(filters.year);
          // Conserver toute borne de date non liée à l'année glissante.
          for (const key of ['releaseDateGte', 'firstAirDateGte', 'release_date.gte', 'first_air_date.gte']) {
            if (filters[key] === prior + '-01-01') filters[key] = year + '-01-01';
          }
          for (const key of ['releaseDateLte', 'firstAirDateLte', 'release_date.lte', 'first_air_date.lte']) {
            if (filters[key] === prior + '-12-31') filters[key] = year + '-12-31';
          }
          filters.year = year;
          updated++;
        }
      }
    }
    return updated;
  }


  // Fenêtre hebdomadaire pour les sélections explicitement récentes.
  // Les autres rangées TMDB (populaires, mieux notées...) sont déjà interrogées
  // en direct et NE nécessitent PAS de réécriture de leurs filtres.
  // Aucun top 10 officiel n'est simulé par cette fonction.
  function mondayUtc(date) {
    const value = new Date(date);
    if (!Number.isFinite(value.getTime())) throw new Error('Date invalide');
    value.setUTCHours(0, 0, 0, 0);
    value.setUTCDate(value.getUTCDate() - (value.getUTCDay() + 6) % 7);
    return value;
  }

  function isRecentLabel(title) {
    const text = String(title || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase();
    // Interdit tout millésime explicite, même pour une « nouveauté » historique.
    if (/(?:19|20)\d{2}/.test(text)) return false;
    return /(?:^|[^a-z])(?:new|recent|latest|nouveaux?|nouvelles?|nouveautes?|recents?|recentes?|dernieres?|sorties?)(?:[^a-z]|$)|(?:this season|cette saison)/.test(text);
  }

  function rollingDays(categoryId, source) {
    const title = String(source.title || '').toLowerCase();
    const tv = isTelevisionSource(source);
    if (categoryId === 'collection-KBP5HRRD') return 1095; // Télé-réalité peu fournie
    if (categoryId === '27bda92a-f626-4093-a2ba-0a32dc09437a') return 1095; // Chaînes régionales
    if (categoryId === 'collection-b530d60c') {
      return /this season|cette saison/i.test(title) ? 185 : 730;
    }
    if (categoryId === 'collection-R69FJM5K') return 1095;
    return tv ? 730 : 730; // Évite de vider les genres peu fournis
  }

  function updateRollingWeekFilters(catalogues, now = new Date()) {
    if (!Array.isArray(catalogues)) return 0;
    const monday = mondayUtc(now);
    let updated = 0;
    for (const category of catalogues) {
      if (!category || category.id === 'collection-Y2HQBZ5I') continue;
      for (const folder of category.folders || []) {
        for (const source of folder.sources || []) {
          if (!source || source.provider !== 'tmdb' ||
              source.tmdbSourceType !== 'DISCOVER' ||
              !isRecentLabel(source.title)) continue;
          const filters = source.filters;
          if (!filters || typeof filters !== 'object' || Array.isArray(filters)) continue;
          // Un millésime numérique est intentionnel ; conserver l'année historique,
          // et laisser updateRollingYearFilters traiter « Top of the Year ».
          if (Number.isInteger(filters.year)) {
            // Les « New Movies / New Series » de Découvrir/Tendances ont hérité
            // d'une restriction à une seule année. Une vraie fenêtre de nouveautés
            // doit continuer à couvrir les derniers mois lors du passage d'année.
            // Seule cette catégorie sans millésime explicite peut perdre « year ».
            if (category.id === 'collection-UGED6TEZ' &&
                filters.year >= 2026 && filters.year <= 2100) {
              delete filters.year;
            } else continue;
          }
          const start = new Date(monday);
          start.setUTCDate(start.getUTCDate() - rollingDays(category.id, source));
          const value = start.toISOString().slice(0, 10);
          // Respecter le style camelCase et les alias snake_case s'ils existent.
          let changed = false;
          if (filters.releaseDateGte !== value) {
            filters.releaseDateGte = value;
            changed = true;
          }
          for (const alias of ['release_date.gte', 'first_air_date.gte', 'primary_release_date.gte']) {
            if (Object.prototype.hasOwnProperty.call(filters, alias) &&
                filters[alias] !== value) {
              filters[alias] = value;
              changed = true;
            }
          }
          // Garder le tri, le fournisseur, les genres, les IDs, les médias,
          // les restrictions régionales et tous les champs de date supérieure.
          if (changed) updated++;
        }
      }
    }
    return updated;
  }

  const api = { isTelevisionSource, updateRollingYearFilters, updateRollingWeekFilters };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MaCollectionCatalogUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
