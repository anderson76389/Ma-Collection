/* Ma-Collection : un seul parcours d'import local vers Kovelyx.
 * Aucun appel vers un compte tiers et aucun transfert distant.
 * La confirmation reste obligatoire dans l'application de bureau.
 */
(() => {
  "use strict";
  function open() {
    if (document.getElementById("simple-editor-overlay")?.classList.contains("open") &&
        typeof window.seGatherSettings === "function") {
      window.seGatherSettings();
    }
    const proceed = settings => {
      window.MaCollectionKovelyx?.configure(settings || {});
      window.MaCollectionKovelyx?.open();
    };
    if (window.MaCollectionImportStudio?.open) {
      window.MaCollectionImportStudio.open("kovelyx", proceed);
    } else {
      proceed({});
    }
  }
  // Le bouton principal passe par le même assistant sécurisé que les autres accès.
  document.getElementById("btn-import-kovelyx")?.addEventListener("click", open);
  window.MaCollectionDestination = Object.freeze({
    open,
    close() { window.MaCollectionImportStudio?.close(); }
  });
})();