/**
 * Ma-Collection Vault — optional encrypted auto-save for API keys +
 * collection edit state. Feature-flagged via window.MA_COLLECTION_ACCOUNT.
 *
 * Security: secrets are AES-GCM encrypted client-side with a key derived from
 * the user's vault passphrase (PBKDF2). The passphrase never leaves the device.
 * The encrypted vault remains LOCAL: Kovelyx Cloud does not offer a vault endpoint.
 */
(function () {
  'use strict';

  const PAYLOAD_VERSION = 1;
  const PBKDF2_ITERS = 310000;
  const LOCAL_CIPHER_KEY = 'ma_collection_vault_cipher_v1';
  const SESSION_META_KEY = 'ma_collection_vault_session_v1';
  const FORCE_UI_KEY = 'ma_collection_account_force';

  let cryptoKey = null;          // CryptoKey in memory while unlocked
  let sessionSaltB64 = null;
  let saveTimer = null;
  let authSession = null;        // Better Auth bearer token, only in this browser tab
  let lastPayload = null;
  let lastSyncError = null;

  function cfg() {
    return window.MA_COLLECTION_ACCOUNT || { enabled: false };
  }

  /** ?account=1 turns the feature on for this browser; ?account=0 turns it off. */
  function applyUrlAccountFlag() {
    try {
      const q = new URLSearchParams(window.location.search || '');
      if (!q.has('account')) return;
      const v = String(q.get('account') || '').toLowerCase();
      if (v === '1' || v === 'true' || v === 'on' || v === 'yes') {
        localStorage.setItem(FORCE_UI_KEY, '1');
      } else if (v === '0' || v === 'false' || v === 'off' || v === 'no') {
        localStorage.removeItem(FORCE_UI_KEY);
      }
    } catch (e) { /* ignore */ }
  }

  function forceUiOn() {
    try {
      return localStorage.getItem(FORCE_UI_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  /** UI may show when force flag or enabled; cloud needs URL+anon. */
  function isEnabled() {
    return forceUiOn() || !!cfg().enabled;
  }

  function cloudConfigured() {
    const c = cfg();
    return !!c.cloudUrl;
  }

  function b64FromBuf(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function bufFromB64(b64) {
    const s = atob(b64);
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes.buffer;
  }

  async function deriveKey(passphrase, saltBuf) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBuf, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptPayload(obj, passphrase, existingSaltB64) {
    const salt = existingSaltB64
      ? new Uint8Array(bufFromB64(existingSaltB64))
      : crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const plain = new TextEncoder().encode(JSON.stringify(obj));
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
    return {
      ciphertext: b64FromBuf(cipherBuf),
      salt: b64FromBuf(salt),
      iv: b64FromBuf(iv),
      key,
    };
  }

  async function decryptEnvelope(envelope, passphrase) {
    const salt = new Uint8Array(bufFromB64(envelope.salt));
    const iv = new Uint8Array(bufFromB64(envelope.iv));
    const key = await deriveKey(passphrase, salt);
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      bufFromB64(envelope.ciphertext)
    );
    const obj = JSON.parse(new TextDecoder().decode(plainBuf));
    return { payload: obj, key, saltB64: envelope.salt };
  }

  // ---- Compte Kovelyx : Better Auth + Workers/D1 (sans Supabase) --------
  function cloudHeaders(token) {
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    return headers;
  }

  function assertCloudConfigured() {
    if (!cloudConfigured()) throw new Error("Configurez l'adresse du Worker Kovelyx Cloudflare.");
  }

  async function apiRequest(path, options = {}) {
    assertCloudConfigured();
    const response = await fetch(cfg().cloudUrl + path, {
      method: options.method || "GET",
      mode: "cors", cache: "no-store", credentials: "omit",
      headers: cloudHeaders(options.token),
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
    });
    if (!response.ok && !options.acceptError) {
      const problem = await response.clone().json().catch(() => ({}));
      const message = problem.error || problem.message ||
        ("Kovelyx Cloudflare a refusé la demande (HTTP " + response.status + ").");
      throw new Error(message + (response.status === 409 ? " (conflit de révision)" : ""));
    }
    return response;
  }

  async function cloudSignup(email, password) {
    if (password.length < 12) throw new Error("Le mot de passe Kovelyx doit contenir au moins 12 caractères.");
    const response = await apiRequest("/api/auth/sign-up/email", {
      method: "POST",
      body: { name: (email.split("@")[0] || "Kovelyx").slice(0, 48), email: email.trim(), password }
    });
    const data = await response.json().catch(() => ({}));
    if (!data.user?.id) throw new Error("Le compte n'a pas été confirmé par Kovelyx Cloudflare.");
    return { needsConfirm: false, message: "Compte créé. Connectez-vous pour choisir votre profil Kovelyx." };
  }

  function storeSession(data, email, token) {
    if (!token || token.length < 16 || !data.user?.id)
      throw new Error("Kovelyx n'a pas renvoyé de session Bearer valide.");
    authSession = {
      provider: "cloudflare-better-auth",
      access_token: token,
      user_id: data.user.id,
      email: data.user.email || email,
      server: cfg().cloudUrl
    };
    persistAuthSession();
    return authSession;
  }

  async function cloudLogin(email, password) {
    const response = await apiRequest("/api/auth/sign-in/email", {
      method: "POST", body: { email: email.trim(), password }
    });
    const data = await response.json().catch(() => ({}));
    const token = response.headers.get("set-auth-token") || data.token;
    return storeSession(data, email, token);
  }

  function persistAuthSession() {
    try {
      if (authSession) sessionStorage.setItem("ma_collection_account_auth", JSON.stringify(authSession));
      else sessionStorage.removeItem("ma_collection_account_auth");
    } catch (_) { /* Une session peut rester seulement en mémoire. */ }
  }

  function restoreAuthSession() {
    try {
      const raw = sessionStorage.getItem("ma_collection_account_auth");
      const candidate = raw && JSON.parse(raw);
      if (candidate?.provider === "cloudflare-better-auth" &&
          candidate.server === cfg().cloudUrl &&
          typeof candidate.user_id === "string" &&
          typeof candidate.access_token === "string" &&
          candidate.access_token.length >= 16) {
        authSession = candidate;
      } else {
        authSession = null;
        persistAuthSession();
      }
    } catch (_) { authSession = null; }
  }

  async function freshSession() {
    assertCloudConfigured();
    if (!authSession || authSession.server !== cfg().cloudUrl) {
      signOutCloud();
      throw new Error("Connectez-vous avec le même compte que sur Kovelyx.");
    }
    const before = authSession;
    const response = await apiRequest("/v1/me", { token: before.access_token, acceptError: true });
    if (response.status === 401 || response.status === 403) {
      if (authSession === before) signOutCloud();
      throw new Error("Session Kovelyx expirée, reconnectez-vous.");
    }
    if (!response.ok) throw new Error("Serveur Kovelyx inaccessible (HTTP " + response.status + ").");
    const me = await response.json();
    if (me.id !== before.user_id || authSession !== before)
      throw new Error("Le compte Kovelyx a changé. Réessayez.");
    return before;
  }

  // Les jetons restent internes au module ; aucun appel vers une URL externe.
  async function cloudFetch(path, options = {}) {
    if (typeof path !== "string" || !path.startsWith("/v1/") || path.includes("://"))
      throw new Error("Route Kovelyx non autorisée.");
    const before = await freshSession();
    const response = await apiRequest(path, {
      method: options.method || "GET", body: options.body,
      token: before.access_token, acceptError: options.acceptError === true
    });
    if (authSession !== before) throw new Error("Compte modifié pendant l'envoi.");
    return response;
  }

  function readLocalEnvelope() {
    try {
      const raw = localStorage.getItem(LOCAL_CIPHER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeLocalEnvelope(envelope) {
    localStorage.setItem(LOCAL_CIPHER_KEY, JSON.stringify({
      ciphertext: envelope.ciphertext,
      salt: envelope.salt,
      iv: envelope.iv,
      updatedAt: new Date().toISOString(),
    }));
  }

  // ---- Session unlock (passphrase stays in memory only; key in sessionStorage as non-extractable isn't possible — we re-prompt each tab unless unlocked this session) ----

  function rememberUnlock(passphrase) {
    // Keep passphrase only in a closure for re-encrypt saves this session.
    // sessionStorage holds a marker, not the passphrase.
    try {
      sessionStorage.setItem(SESSION_META_KEY, JSON.stringify({ unlocked: true, at: Date.now() }));
    } catch (e) { /* ignore */ }
    rememberUnlock._pass = passphrase;
  }

  function clearUnlock() {
    cryptoKey = null;
    sessionSaltB64 = null;
    lastPayload = null;
    rememberUnlock._pass = null;
    try { sessionStorage.removeItem(SESSION_META_KEY); } catch (e) { /* ignore */ }
  }

  function currentPassphrase() {
    return rememberUnlock._pass || null;
  }

  function isUnlocked() {
    return !!cryptoKey && !!currentPassphrase();
  }

  function status() {
    return {
      enabled: isEnabled(),
      cloudConfigured: cloudConfigured(),
      cloudSignedIn: !!(authSession && authSession.access_token),
      cloudEmail: authSession && authSession.email || null,
      lastSyncError,
      vaultCloudAvailable: false,
      unlocked: isUnlocked(),
      hasLocalVault: !!readLocalEnvelope(),
    };
  }

  // ---- Snapshot / apply via bridge --------------------------------------

  function collectPayload() {
    const bridge = window.MaCollectionAccountBridge;
    const fromApp = (bridge && typeof bridge.snapshot === 'function') ? bridge.snapshot() : {};
    return {
      v: PAYLOAD_VERSION,
      savedAt: new Date().toISOString(),
      keys: fromApp.keys || {},
      collection: fromApp.collection || {},
      prefs: fromApp.prefs || {},
    };
  }

  async function applyPayload(payload) {
    lastPayload = payload;
    const bridge = window.MaCollectionAccountBridge;
    if (bridge && typeof bridge.apply === 'function') {
      await bridge.apply(payload);
    }
  }

  async function unlockWithPassphrase(passphrase) {
    // Aucun endpoint de coffre chiffré sur Kovelyx Cloud : on ne simule pas la synchro.
    const envelope = readLocalEnvelope();
    if (!envelope) throw new Error('No saved data found on this device. Turn on Save first.');

    const { payload, key, saltB64 } = await decryptEnvelope(envelope, passphrase);
    cryptoKey = key;
    sessionSaltB64 = saltB64;
    rememberUnlock(passphrase);
    await applyPayload(payload);
    return payload;
  }

  async function createVault(passphrase) {
    if (!passphrase || passphrase.length < 8) {
      throw new Error('Use a save password with at least 8 characters.');
    }
    const payload = collectPayload();
    const enc = await encryptPayload(payload, passphrase, null);
    cryptoKey = enc.key;
    sessionSaltB64 = enc.salt;
    rememberUnlock(passphrase);
    lastPayload = payload;
    const envelope = { ciphertext: enc.ciphertext, salt: enc.salt, iv: enc.iv };
    writeLocalEnvelope(envelope);
    // Coffre chiffré sauvegardé localement uniquement ; aucun faux succès cloud.
    return payload;
  }

  async function persistNow() {
    if (!isUnlocked()) return false;
    const pass = currentPassphrase();
    if (!pass) return false;
    const payload = collectPayload();
    lastPayload = payload;
    const enc = await encryptPayload(payload, pass, sessionSaltB64);
    cryptoKey = enc.key;
    sessionSaltB64 = enc.salt;
    const envelope = { ciphertext: enc.ciphertext, salt: enc.salt, iv: enc.iv };
    writeLocalEnvelope(envelope);
    // Coffre chiffré sauvegardé localement uniquement ; aucun faux succès cloud.
    return true;
  }

  function scheduleSave() {
    if (!isEnabled() || !isUnlocked()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      persistNow().catch((e) => console.warn('[MaCollectionAccount] save failed:', e));
    }, 800);
  }

  async function cloudLogout() {
    const old = authSession;
    signOutCloud();
    if (!old) return;
    try {
      await fetch(old.server + "/api/auth/sign-out", {
        method: "POST", mode: "cors", cache: "no-store", credentials: "omit",
        headers: cloudHeaders(old.access_token), body: "{}"
      });
    } catch (error) {
      console.warn("[Kovelyx] Session locale fermée ; révocation à distance non confirmée :", error);
    }
  }
  function signOutCloud() {
    lastSyncError = null;
    authSession = null;
    persistAuthSession();
  }

  function wipeLocalVault() {
    try { localStorage.removeItem(LOCAL_CIPHER_KEY); } catch (e) { /* ignore */ }
    clearUnlock();
  }

  function lock() {
    clearUnlock();
  }

  function getUnlockedPayload() {
    return lastPayload ? JSON.parse(JSON.stringify(lastPayload)) : null;
  }

  // Boot
  applyUrlAccountFlag();
  restoreAuthSession();

  window.MaCollectionAccount = {
    isEnabled,
    featureActive: isEnabled,
    status,
    scheduleSave,
    persistNow,
    unlockWithPassphrase,
    createVault,
    lock,
    wipeLocalVault,
    cloudConfigured,
    cloudSignup,
    cloudLogin,
    cloudFetch,
    cloudLogout,
    signOutCloud,
    collectPayload,
    getUnlockedPayload,
  };
})();
