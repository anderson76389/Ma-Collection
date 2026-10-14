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
    setStatus("Ouverture de Kovelyx et préparation de votre collection…");
    try {
      // Must run synchronously during the click gesture, before await.
      // Windows registers this protocol per-user when Kovelyx is first started.
      if (!window.__MA_COLLECTION_QA_NO_PROTOCOL) window.location.href = "kovelyx://import";
      const json = await buildExport();
      let accepted = false;
      let lastError = null;
      for (let attempt = 0; attempt < 48; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 1800);
          let response;
          try {
            response = await fetch("http://127.0.0.1:38761/import", {
              method: "POST",
              mode: "cors",
              headers: { "Content-Type": "application/json" },
              body: json,
              signal: controller.signal,
              cache: "no-store",
            });
          } finally { clearTimeout(timeout); }
          if (response.status === 202) {
            accepted = true;
            break;
          }
          if (response.status === 409) {
            throw Error("Un import attend déjà une confirmation dans Kovelyx. Validez ou annulez-le avant de recommencer.");
          }
          throw Error("Kovelyx a refusé l'envoi (HTTP " + response.status + "). Vous pouvez utiliser « Copier le JSON ».");
        } catch (error) {
          if (error && /^Kovelyx a refusé|^Un import attend/.test(error.message || "")) throw error;
          lastError = error;
        }
        await new Promise(resolve => setTimeout(resolve, 550));
      }
      if (!accepted) {
        throw Error("Kovelyx ne répond pas. Ouvrez la nouvelle version de Kovelyx sur votre PC, puis réessayez. Si votre navigateur bloque la connexion locale, utilisez « Copier le JSON »." +
          (lastError && lastError.name === "AbortError" ? " (connexion expirée)" : ""));
      }
      setStatus("Sélection envoyée à Kovelyx ! Confirmez l'import dans la fenêtre de l'application. Une sauvegarde locale sera créée avant le remplacement.");
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

  byId("btn-export-kovelyx")?.addEventListener("click", open);
  byId("se-export-kovelyx")?.addEventListener("click", open);
  byId("kovelyx-export-close")?.addEventListener("click", close);
  overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !overlay.hidden) close(); });
  window.MaCollectionKovelyx = Object.freeze({ open, send, buildExport, validateForKovelyx });
})();
