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

  const api = { isTelevisionSource, updateRollingYearFilters };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.KaptainCatalogUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
