/* Choix explicite de destination. La personnalisation précède l'import Kovelyx. */
(() => {
  "use strict";
  const el = id => document.getElementById(id);
  const overlay = el("destination-overlay");
  if (!overlay) return;
  let pendingNuvio = null;
  let preparingKovelyx = false;

  function close() {
    overlay.hidden = true;
    pendingNuvio = null;
  }

  function open(options = {}) {
    pendingNuvio = typeof options.onNuvio === "function"
      ? options.onNuvio
      : () => window.NuvioWizard?.open(options.nuvioOptions || {});
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
    // Apply quick-editor selections when that editor is currently open.
    if (el("simple-editor-overlay")?.classList.contains("open") &&
        typeof window.seGatherSettings === "function") {
      window.seGatherSettings();
    }

    // Do not skip the guided selection just because the destination is Kovelyx.
    // The five steps affect the catalog selection before JSON generation.
    // The export dialog is opened AFTER customization instead of immediately
    // posting and replacing the active Kovelyx profile.
    if (typeof window.startCustomize === "function" && !preparingKovelyx) {
      preparingKovelyx = true;
      window.__maCollectionAfterCustomize = () => {
        preparingKovelyx = false;
        window.MaCollectionKovelyx?.open();
      };
      try {
        window.startCustomize();
      } catch (error) {
        preparingKovelyx = false;
        window.__maCollectionAfterCustomize = null;
        console.error("Échec de la personnalisation Kovelyx", error);
        window.MaCollectionKovelyx?.open();
      }
    } else {
      window.MaCollectionKovelyx?.open();
    }
  });

  // Canceling Guided Customize must not leave a stale callback that could
  // unexpectedly open the Kovelyx export dialog during a later flow.
  el("customize-close")?.addEventListener("click", () => {
    if (preparingKovelyx) {
      preparingKovelyx = false;
      window.__maCollectionAfterCustomize = null;
    }
  });

  el("destination-cancel")?.addEventListener("click", close);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !overlay.hidden) close();
  });
  window.MaCollectionDestination = Object.freeze({ open, close });
})();
