/* Ma-Collection : import JSON local dans Kovelyx PC, sans comptes Nuvio. */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const overlay = byId("kovelyx-export-overlay");
  const status = byId("kovelyx-export-status");
  const copy = byId("kovelyx-export-copy");
  const download = byId("kovelyx-export-download");
  const direct = byId("kovelyx-export-direct");
  if (!overlay || !status || !copy || !download) return;
  let pendingSetup = null;
  function configure(v) { pendingSetup = v && typeof v === "object" ? {...v} : null; }

  // Respecte les contrôles de CollectionRepository.validateImportModel (Kovelyx).
  function validateForKovelyx(data) {
    if (!Array.isArray(data) || !data.length) throw Error("Sélectionnez au moins un dossier.");
    const categoryIds = new Set();
    for (const category of data) {
      if (!category || !category.id || !category.title || !Array.isArray(category.folders))
        throw Error("Catégorie manquante ou incomplète.");
      if (categoryIds.has(category.id)) throw Error("Catégorie dupliquée : " + category.id);
      categoryIds.add(category.id);
      const folderIds = new Set();
      for (const folder of category.folders) {
        if (!folder || !folder.id || !folder.title) throw Error("Dossier incomplet.");
        if (folderIds.has(folder.id)) throw Error("Dossier dupliqué : " + folder.id);
        folderIds.add(folder.id);
        const sources = Array.isArray(folder.sources) && folder.sources.length ? folder.sources : (folder.catalogSources || []);
        for (const source of sources) {
          const type = String(source.provider || "addon").toLowerCase();
          if (type === "tmdb" && !source.tmdbSourceType) throw Error("Source TMDB incomplète : " + folder.title);
          if (type === "trakt" && (!Number.isSafeInteger(source.traktListId) || source.traktListId <= 0))
            throw Error("Liste Trakt invalide : " + folder.title);
          if (type !== "tmdb" && type !== "trakt" && (!source.addonId || !source.type || !source.catalogId))
            throw Error("Source d'extension incomplète : " + folder.title);
        }
      }
    }
    return true;
  }

  async function buildExport() {
    const api = window.MaCollectionExport;
    if (!api || !api.assembleFilteredDatabase || !api.applyLocaleToCollection)
      throw Error("Moteur des collections indisponible.");
    const selected = structuredClone(api.assembleFilteredDatabase());
    if (!Array.isArray(selected) || !selected.length) throw Error("Sélectionnez au moins un dossier.");
    const localized = await api.applyLocaleToCollection(selected) || selected;
    validateForKovelyx(localized);
    return JSON.stringify(localized, null, 2);
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.style.color = isError ? "#fca5a5" : "";
    status.setAttribute("data-state", isError ? "error" : "success");
  }
  function open() {
    setStatus("");
    overlay.hidden = false;
    copy.focus();
  }
  function close() { overlay.hidden = true; }

  async function writeClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch (_) { /* Essayer la méthode de secours. */ }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
    document.body.appendChild(textarea);
    try {
      textarea.focus();
      textarea.select();
      if (!document.execCommand("copy")) throw Error("Copie refusée par le navigateur.");
    } finally { textarea.remove(); }
  }

  // No data is uploaded to a third-party service. The JSON is posted directly
  // to the IPv4 loopback bridge while Kovelyx is running. That bridge ALWAYS asks
  // the user to confirm before replacing collections in the active profile.
  async function send() {
    if (!direct || direct.disabled) return;
    open();
    direct.disabled = true;
    setStatus("Préparation de votre collection et connexion à Kovelyx PC…");
    try {
      // Le pont local fonctionne indépendamment de l’association Windows kovelyx://.
      const json = await buildExport();
      const config = pendingSetup || window.MaCollectionImportStudio?.getSettings?.() || {};
      pendingSetup = null; // Ne jamais réutiliser des clés d\u2019un import précédent.
      // Les clés ne sont transmises qu'au pont local privé, jamais dans le JSON exporté.
      const desktopSettings = {
        ...(config.tmdbKey ? {tmdbKey:config.tmdbKey} : {}),
        ...(config.mdblistKey ? {mdblistKey:config.mdblistKey} : {}),
        ...(config.realDebridKey ? {realDebridKey:config.realDebridKey} : {}),
        posterProvider: config.posterProvider === "bttr" ? "bttr" : "none",
        tmdbLanguage: config.tmdbLanguage === "en" ? "en" : "fr",
        importMode: config.importMode === "account" ? "account" : "local",
        importAction: config.importAction === "merge" ? "merge" : "replace",
        ...(config.posterProvider === "bttr" ? {
          posterProvider: "bttr",
          bttrQuality: !!config.bttrQuality, bttrGenre: !!config.bttrGenre,
          bttrRating: !!config.bttrRating, bttrAge: !!config.bttrAge,
          bttrSource: config.bttrSource || "Average",
          bttrLanguage: config.bttrLanguage || "fr"
        } : {}),
        ...(Array.isArray(config.addonManifests) && config.addonManifests.length
          ? { addonManifests:config.addonManifests } : {})
      };
      const hasSettings = Object.keys(desktopSettings).length > 0;
      const payload = hasSettings ? JSON.stringify({collections:JSON.parse(json),settings:desktopSettings}) : json;
      const endpoint = "http://127.0.0.1:38761";
      const request = async (url, options, milliseconds) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), milliseconds);
        try { return await fetch(url, { ...options, mode:"cors", cache:"no-store", signal:controller.signal }); }
        finally { clearTimeout(timeout); }
      };
      // La sonde distingue un service Kovelyx absent d'un vrai refus d'import.
      let health;
      try {
        health = await request(endpoint + "/health", { method:"GET" }, 6000);
      } catch (error) {
        throw Error("Impossible de joindre Kovelyx PC. Vérifiez que l'application est ouverte, puis testez http://127.0.0.1:38761/health dans ce navigateur : la page doit afficher « Kovelyx prêt ». Si elle s'affiche, vérifiez le VPN, le pare-feu et les protections du navigateur. (" +
          (error?.name === "AbortError" ? "délai dépassé" : "connexion bloquée") + ")");
      }
      if (!health.ok || !(await health.text()).includes("Kovelyx prêt")) {
        throw Error("Le pont local Kovelyx n'est pas prêt (HTTP " + health.status + "). Redémarrez Kovelyx PC et réessayez.");
      }
      if (new TextEncoder().encode(payload).byteLength > 16*1024*1024) {
        throw Error("Votre sélection dépasse les 16 Mo acceptés par Kovelyx. Réduisez le nombre de catalogues.");
      }
      let accepted = false;
      let lastError = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await request(endpoint + "/import", {
            method:"POST", headers:{"Content-Type":"application/json"}, body:payload,
          }, 12000);
          if (response.status === 202) { accepted = true; break; }
          if (response.status === 409) {
            throw Error("Un import attend déjà confirmation dans Kovelyx. Acceptez-le ou annulez-le dans l'application.");
          }
          if (response.status === 422) {
            throw Error("Votre version de Kovelyx ne reconnaît pas cette configuration. Installez une version Windows récente ; les données existantes sont conservées.");
          }
          if (response.status === 413) throw Error("La collection est trop volumineuse pour le transfert local.");
          if (response.status === 403) throw Error("Kovelyx refuse l'origine du site. Utilisez l'adresse officielle Ma-Collection sur GitHub Pages.");
          throw Error("Kovelyx a refusé l'import (HTTP " + response.status + "). Aucune collection n'a été remplacée.");
        } catch (error) {
          if (/^(Un import attend|Votre version de Kovelyx|La collection est trop|Kovelyx refuse|Kovelyx a refusé)/.test(error?.message || "")) throw error;
          lastError = error;
        }
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 700));
      }
      if (!accepted) {
        throw Error("Le service Kovelyx répond, mais le transfert JSON ne s'est pas terminé. Vérifiez si une confirmation d'import est déjà ouverte dans Kovelyx. Vous pouvez aussi « Copier le JSON ». (" +
          (lastError?.name === "AbortError" ? "transfert expiré" : "connexion interrompue") + ")");
      }
      setStatus("Sélection envoyée à Kovelyx ! Choisissez votre profil et confirmez l'import dans l'application. Une sauvegarde sera créée avant toute modification.");
    } catch (error) {
      setStatus(error.message || "Envoi direct impossible : utilisez « Copier le JSON ».", true);
    } finally { direct.disabled = false; }
  }
  direct?.addEventListener("click", send);

  copy.addEventListener("click", async () => {
    copy.disabled = true;
    try {
      await writeClipboard(await buildExport());
      setStatus("Copié ! Dans Kovelyx PC : Collections → icône Importer → coller le JSON → confirmer.");
    } catch (error) { setStatus(error.message || "Copie impossible.", true); }
    finally { copy.disabled = false; }
  });
  download.addEventListener("click", async () => {
    download.disabled = true;
    try {
      const json = await buildExport();
      const blobUrl = URL.createObjectURL(new Blob([json], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "kovelyx_collection_fr_" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      setStatus("Fichier JSON téléchargé. Dans Kovelyx PC, utilisez « Copier le JSON » pour l'importer.");
    } catch (error) { setStatus(error.message || "Téléchargement impossible.", true); }
    finally { download.disabled = false; }
  });

  const showImportSetup = () => {
    pendingSetup = null;
    if (window.MaCollectionImportStudio) window.MaCollectionImportStudio.open("kovelyx", () => send());
    else open();
  };
  byId("btn-export-kovelyx")?.addEventListener("click", showImportSetup);
  byId("se-export-kovelyx")?.addEventListener("click", showImportSetup);
  byId("kovelyx-export-close")?.addEventListener("click", close);
  overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !overlay.hidden) close(); });
  window.MaCollectionKovelyx = Object.freeze({ open, configure, send, buildExport, validateForKovelyx });
})();
