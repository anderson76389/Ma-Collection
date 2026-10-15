/**
 * Ma-Collection — configuration du même serveur de comptes que Kovelyx.
 * Supabase URL + publishable / anon key are PUBLIC configuration (never the
 * service_role or sb_secret key). No backend is silently assumed to exist.
 */
(() => {
  "use strict";
  const STORAGE_KEY = "ma_collection_kovelyx_backend_v1";
  const defaults = {
    enabled: true, // Le bouton du compte/sauvegarde est visible sans activer le cloud.
    supabaseUrl: "",
    supabaseAnonKey: "",
    showUiWhenDisabled: false,
  };
  const base = Object.assign({}, defaults, window.MA_COLLECTION_ACCOUNT || {});
  function normalize(url, key) {
    const u = new URL(String(url || "").trim());
    const local = ["localhost", "127.0.0.1"].includes(u.hostname);
    if ((u.protocol !== "https:" && !(local && u.protocol === "http:")) ||
        u.username || u.password || u.search || u.hash || !["", "/"].includes(u.pathname)) {
      throw new Error("Indiquez l'adresse HTTPS de votre serveur Kovelyx (sans chemin, identifiants ou paramètres).");
    }
    const publicKey = String(key || "").trim();
    if (!publicKey || publicKey.length > 4096 || /\s/.test(publicKey) ||
        publicKey.startsWith("sb_secret_")) {
      throw new Error("Une clé publishable/anon publique est requise. N'utilisez jamais une clé secrète !");
    }
    // Un JWT service_role ne doit jamais être envoyé dans du JavaScript public.
    if (publicKey.includes(".")) {
      try {
        const json = JSON.parse(atob(publicKey.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));
        if (json.role === "service_role") throw new Error("Une clé service_role n'est jamais autorisée sur ce site.");
      } catch (e) {
        if (/service_role/.test(e.message || "")) throw e;
      }
    }
    return { supabaseUrl: u.origin, supabaseAnonKey: publicKey };
  }
  function load() {
    try {
      const record = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (record && record.supabaseUrl && record.supabaseAnonKey) {
        return normalize(record.supabaseUrl, record.supabaseAnonKey);
      }
    } catch (e) { console.warn("[Kovelyx] Configuration serveur personnelle ignorée :", e.message); }
    return null;
  }
  const saved = load();
  window.MA_COLLECTION_ACCOUNT = Object.assign(base, saved || {});
  window.MaCollectionBackendConfig = Object.freeze({
    configured() {
      const c = window.MA_COLLECTION_ACCOUNT;
      return !!(c.supabaseUrl && c.supabaseAnonKey);
    },
    current() {
      const c = window.MA_COLLECTION_ACCOUNT;
      return { url: c.supabaseUrl || "", key: c.supabaseAnonKey || "" };
    },
    save(url, key) {
      const record = normalize(url, key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      Object.assign(window.MA_COLLECTION_ACCOUNT, record);
      return record;
    },
    clear() {
      localStorage.removeItem(STORAGE_KEY);
      Object.assign(window.MA_COLLECTION_ACCOUNT, {supabaseUrl:"",supabaseAnonKey:""});
    },
  });
})();