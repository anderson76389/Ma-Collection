/* Destination commune : configuration complète avant Nuvio et Kovelyx. */
(() => {
  "use strict";
  const el = id => document.getElementById(id);
  const overlay = el("destination-overlay");
  if (!overlay) return;
  let pendingNuvio = null;
  function close() { overlay.hidden = true; pendingNuvio = null; }
  function open(options = {}) {
    pendingNuvio = typeof options.onNuvio === "function" ? options.onNuvio :
      () => window.NuvioWizard?.open(options.nuvioOptions || {});
    overlay.hidden = false;
    el("destination-kovelyx")?.focus();
  }
  function applyQuickEditor() {
    if (el("simple-editor-overlay")?.classList.contains("open") &&
        typeof window.seGatherSettings === "function") window.seGatherSettings();
  }
  el("destination-nuvio")?.addEventListener("click", () => {
    const fallback = pendingNuvio;
    close();
    applyQuickEditor();
    if (window.MaCollectionImportStudio) {
      window.MaCollectionImportStudio.open("nuvio", config => {
        if (window.NuvioWizard?.open) window.NuvioWizard.open({importSetup:config});
        else fallback?.();
      });
    } else fallback?.();
  });
  el("destination-kovelyx")?.addEventListener("click", () => {
    close();
    applyQuickEditor();
    if (window.MaCollectionImportStudio) {
      window.MaCollectionImportStudio.open("kovelyx", () => window.MaCollectionKovelyx?.send());
    } else window.MaCollectionKovelyx?.open();
  });
  el("destination-cancel")?.addEventListener("click", close);
  overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !overlay.hidden) close();
  });
  window.MaCollectionDestination = Object.freeze({open,close});
})();
