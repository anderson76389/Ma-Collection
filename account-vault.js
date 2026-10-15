/**
 * Ma-Collection Vault — optional encrypted auto-save for API keys +
 * collection edit state. Feature-flagged via window.MA_COLLECTION_ACCOUNT.
 *
 * Security: secrets are AES-GCM encrypted client-side with a key derived from
 * the user's vault passphrase (PBKDF2). The passphrase never leaves the device.
 * Cloud sync (optional) stores ciphertext only on the SAME backend as Kovelyx.
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
  let authSession = null;        // { access_token, user_id, email } when cloud signed in
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
    return !!(c.supabaseUrl && c.supabaseAnonKey);
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

  // ---- Cloud (optional Supabase) ----------------------------------------

  function cloudHeaders(token) {
    const c = cfg();
    const h = {
      'Content-Type': 'application/json',
      apikey: c.supabaseAnonKey,
    };
    if (token) h.Authorization = 'Bearer ' + token;
    return h;
  }

  function assertCloudConfigured() {
    if (!cloudConfigured()) throw new Error("Configurez d'abord votre serveur de comptes Kovelyx.");
  }
  async function cloudSignup(email, password) {
    assertCloudConfigured();
    const c = cfg();
    const res = await fetch(c.supabaseUrl + "/auth/v1/signup", {
      method:"POST", mode:"cors", cache:"no-store",
      headers:cloudHeaders(),
      body:JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error_description || data.msg || data.error || ("Inscription refusée (" + res.status + ")"));
    if (!data.access_token) return {
      needsConfirm: true,
      message: "Compte demandé. Confirmez l’e-mail reçu, puis connectez-vous ici et dans Kovelyx."
    };
    storeSession(data, email);
    return { needsConfirm: false, message: "Compte créé : connectez-vous aussi dans Kovelyx avec ces identifiants." };
  }
  function storeSession(data, email) {
    if (!data.access_token || !data.user?.id) throw new Error("Session d'authentification incomplète.");
    authSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || "",
      expires_at: Math.floor(Date.now() / 1000) + Math.max(0, Number(data.expires_in) || 3600),
      user_id: data.user.id, email: data.user.email || email,
      server: cfg().supabaseUrl,
    };
    persistAuthSession();
    return authSession;
  }
  async function cloudLogin(email, password) {
    assertCloudConfigured();
    const c = cfg();
    const res = await fetch(c.supabaseUrl + "/auth/v1/token?grant_type=password", {
      method:"POST", mode:"cors", cache:"no-store", headers:cloudHeaders(),
      body:JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error_description || data.msg || data.error || ("Connexion refusée (" + res.status + ")"));
    return storeSession(data, email);
  }
  function persistAuthSession() {
    try {
      if (authSession) sessionStorage.setItem("ma_collection_account_auth", JSON.stringify(authSession));
      else sessionStorage.removeItem("ma_collection_account_auth");
    } catch (e) { /* session limitée à cet onglet */ }
  }
  function restoreAuthSession() {
    try {
      const raw = sessionStorage.getItem("ma_collection_account_auth");
      const candidate = raw && JSON.parse(raw);
      if (candidate?.server === cfg().supabaseUrl && candidate?.user_id && candidate?.access_token) {
        authSession = candidate;
      } else {
        authSession = null;
        persistAuthSession();
      }
    } catch (e) { authSession = null; }
  }
  async function freshSession() {
    assertCloudConfigured();
    if (!authSession || authSession.server !== cfg().supabaseUrl) {
      signOutCloud();
      throw new Error("Connectez-vous à votre compte Kovelyx.");
    }
    if (!authSession.expires_at || authSession.expires_at > Date.now()/1000 + 90) return authSession;
    if (!authSession.refresh_token) {
      signOutCloud();
      throw new Error("Session expirée, reconnectez-vous.");
    }
    const res = await fetch(cfg().supabaseUrl + "/auth/v1/token?grant_type=refresh_token", {
      method:"POST", mode:"cors", cache:"no-store", headers:cloudHeaders(),
      body:JSON.stringify({ refresh_token:authSession.refresh_token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      signOutCloud();
      throw new Error("Votre session a expiré. Veuillez vous reconnecter.");
    }
    return storeSession(data,authSession.email);
  }

  async function cloudPullEnvelope() {
    if (!authSession || !cloudConfigured()) return null;
    await freshSession();
    const c = cfg();
    const res = await fetch(
      c.supabaseUrl + '/rest/v1/ma_collection_vaults?select=ciphertext,salt,iv&user_id=eq.' + encodeURIComponent(authSession.user_id),
      { headers: cloudHeaders(authSession.access_token) }
    );
    if (!res.ok) throw new Error('Cloud pull failed (' + res.status + ')');
    const rows = await res.json();
    if (!rows || !rows.length) return null;
    return rows[0];
  }

  async function cloudPushEnvelope(envelope) {
    if (!authSession || !cloudConfigured()) return;
    await freshSession();
    const c = cfg();
    const body = {
      user_id: authSession.user_id,
      ciphertext: envelope.ciphertext,
      salt: envelope.salt,
      iv: envelope.iv,
      updated_at: new Date().toISOString(),
    };
    const res = await fetch(c.supabaseUrl + '/rest/v1/ma_collection_vaults', {
      method: 'POST',
      headers: Object.assign({}, cloudHeaders(authSession.access_token), {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // Fallback: PATCH if row exists (some projects lack upsert preference)
      const patch = await fetch(
        c.supabaseUrl + '/rest/v1/ma_collection_vaults?user_id=eq.' + encodeURIComponent(authSession.user_id),
        {
          method: 'PATCH',
          headers: cloudHeaders(authSession.access_token),
          body: JSON.stringify({
            ciphertext: envelope.ciphertext,
            salt: envelope.salt,
            iv: envelope.iv,
            updated_at: body.updated_at,
          }),
        }
      );
      if (!patch.ok) throw new Error('Cloud save failed (' + res.status + '/' + patch.status + ')');
    }
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
    let envelope = null;
    if (authSession && cloudConfigured()) {
      try { envelope = await cloudPullEnvelope(); } catch (e) { /* fall through to local */ }
    }
    if (!envelope) envelope = readLocalEnvelope();
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
    if (authSession && cloudConfigured()) {
      try { await cloudPushEnvelope(envelope); lastSyncError = null; } catch (e) {
        lastSyncError = e.message || "Synchronisation impossible";
        console.warn("[MaCollectionAccount] Enregistrement distant non effectué :", e);
      }
    }
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
    if (authSession && cloudConfigured()) {
      try { await cloudPushEnvelope(envelope); lastSyncError = null; } catch (e) {
        lastSyncError = e.message || "Synchronisation impossible";
        console.warn("[MaCollectionAccount] Enregistrement distant non effectué :", e);
      }
    }
    return true;
  }

  function scheduleSave() {
    if (!isEnabled() || !isUnlocked()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      persistNow().catch((e) => console.warn('[MaCollectionAccount] save failed:', e));
    }, 800);
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
    signOutCloud,
    collectPayload,
    getUnlockedPayload,
  };
})();
