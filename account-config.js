/** Ma-Collection — compte du backend indépendant Kovelyx Cloudflare. */
(() => {
  "use strict";
  // Ne jamais réutiliser les anciens identifiants Supabase : le protocole a changé.
  // Le stockage historique est laissé intact pour pouvoir restaurer une ancienne version.
  const STORAGE_KEY = "ma_collection_kovelyx_cloud_backend_v1";
  const DEFAULT_CLOUD = "https://kovelyx-cloud.mailpromahe.workers.dev";
  function normalize(value) {
    const u = new URL(String(value || "").trim());
    const local = ["localhost", "127.0.0.1"].includes(u.hostname);
    const host = u.hostname.toLowerCase();
    const upstream = host === "kaptain.stream" || host.endsWith(".kaptain.stream") ||
      host === "imkaptain.github.io" || host === "api.nuvio.tv";
    if (upstream ||
        (u.protocol !== "https:" && !(local && u.protocol === "http:")) ||
        u.username || u.password || u.search || u.hash || !["", "/"].includes(u.pathname)) {
      throw new Error("Indiquez uniquement l'adresse HTTPS de votre Worker Kovelyx Cloudflare.");
    }
    return u.origin;
  }
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) {}
  const userConfig = window.MA_COLLECTION_ACCOUNT || {};
  let cloudUrl = DEFAULT_CLOUD;
  // Une ancienne valeur de stockage incorrecte ou altérée ne doit jamais
  // empêcher le chargement du site, du Studio et du mode local.
  try {
    if (stored && Object.hasOwn(stored, "cloudUrl")) {
      cloudUrl = stored.cloudUrl ? normalize(stored.cloudUrl) : "";
    } else if (userConfig.cloudUrl) {
      cloudUrl = normalize(userConfig.cloudUrl);
    }
  } catch (_) {
    cloudUrl = DEFAULT_CLOUD;
  }
  window.MA_COLLECTION_ACCOUNT = Object.assign({}, userConfig, { enabled: userConfig.enabled !== false, cloudUrl });
  window.MaCollectionBackendConfig = Object.freeze({
    configured() { return !!window.MA_COLLECTION_ACCOUNT.cloudUrl; },
    current() { return { url: window.MA_COLLECTION_ACCOUNT.cloudUrl || "" }; },
    save(url) {
      const cloudUrl = normalize(url);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cloudUrl }));
      window.MA_COLLECTION_ACCOUNT.cloudUrl = cloudUrl;
      return { cloudUrl };
    },
    clear() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cloudUrl: "" }));
      window.MA_COLLECTION_ACCOUNT.cloudUrl = "";
    }
  });
})();