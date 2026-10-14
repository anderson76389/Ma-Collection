/* Sélection explicite de destination, sans altération des catalogues. */
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
  el("destination-nuvio")?.addEventListener("click", () => {
    const action = pendingNuvio;
    close();
    if (action) action();
  });
  el("destination-kovelyx")?.addEventListener("click", () => {
    close();
    if (el("simple-editor-overlay")?.classList.contains("open") &&
        typeof window.seGatherSettings === "function") window.seGatherSettings();
    window.MaCollectionKovelyx?.open();
  });
  el("destination-cancel")?.addEventListener("click", close);
  overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !overlay.hidden) close();
  });
  window.MaCollectionDestination = Object.freeze({ open, close });
})();
