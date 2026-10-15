/**
 * Optional Save UI: account icon on every screen, simple menu, keys setup.
 * Hidden unless MaCollectionAccount.isEnabled().
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'success');
    else console.log('[MaCollectionAccount]', msg);
  }

  function st() {
    return (window.MaCollectionAccount && window.MaCollectionAccount.status()) || {
      enabled: false, unlocked: false, hasLocalVault: false
    };
  }

  function setMenuOpen(open) {
    const menu = $('account-menu');
    const fab = $('account-fab');
    if (!menu || !fab) return;
    menu.hidden = !open;
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function refreshChrome() {
    const acct = window.MaCollectionAccount;
    const chrome = $('account-chrome');
    const enabled = !!(acct && acct.isEnabled());
    if (chrome) chrome.hidden = !enabled;
    if (!enabled) {
      setMenuOpen(false);
      return;
    }

    const s = st();
    const statusEl = $('account-menu-status');
    if (statusEl) {
      if (s.cloudSignedIn) {
        statusEl.textContent = s.lastSyncError
          ? "Compte connecté, mais sauvegarde cloud en échec : " + s.lastSyncError
          : "Compte Kovelyx connecté : " + (s.cloudEmail || "utilisateur");
      } else if (!s.cloudConfigured) {
        statusEl.textContent = "Mode local disponible. Configurez un serveur pour créer un compte synchronisé.";
      } else {
        statusEl.textContent = "Compte Kovelyx : créez un compte ou connectez-vous.";
      }
    }

    const menu = $('account-menu');
    if (menu) {
      const visibility = {
        setup: !s.hasLocalVault && !s.unlocked,
        unlock: !s.unlocked && s.hasLocalVault,
        keys: s.unlocked,
        save: s.unlocked,
        lock: s.unlocked,
        wipe: s.hasLocalVault,
        privacy: true,
        cloud: true,
      };
      menu.querySelectorAll('[data-account-action]').forEach((el) => {
        const a = el.getAttribute('data-account-action');
        const show = !!visibility[a];
        el.hidden = !show;
        el.style.display = show ? '' : 'none';
      });
    }

    const dot = $('account-fab-dot');
    if (dot) {
      dot.hidden = !s.unlocked;
      dot.style.display = s.unlocked ? '' : 'none';
      dot.title = s.unlocked ? 'Autosave on' : '';
    }
    const fab = $('account-fab');
    if (fab) {
      fab.title = s.unlocked
        ? 'Account · autosave on'
        : (s.hasLocalVault ? 'Account · enter save password' : 'Account · optional autosave');
      fab.classList.toggle('is-unlocked', !!s.unlocked);
    }
  }

  function setTitle(text) {
    const t = $('account-title');
    if (t) t.textContent = text;
  }

  function showView(name) {
    const titles = {
      cloud: 'Compte Kovelyx',
      create: 'Configurer la sauvegarde locale',
      unlock: 'Restore your setup',
      keys: 'API keys & tokens',
      privacy: 'How your keys stay private',
    };
    setTitle(titles[name] || 'Save');
    ['cloud', 'create', 'unlock', 'keys', 'privacy'].forEach((v) => {
      const panel = $('account-view-' + v);
      if (panel) panel.hidden = v !== name;
    });
    const err = $('account-error');
    if (err) { err.hidden = true; err.textContent = ''; }
  }

  function openModal(view) {
    const ov = $('account-overlay');
    if (!ov) return;
    setMenuOpen(false);
    const moreToggle = $('title-more-toggle');
    const morePanel = $('title-more-panel');
    if (moreToggle && morePanel && moreToggle.getAttribute('aria-expanded') === 'true') {
      moreToggle.setAttribute('aria-expanded', 'false');
      morePanel.hidden = true;
      moreToggle.classList.remove('open');
    }
    ov.classList.add('open');
    ov.setAttribute('aria-hidden', 'false');
    const s = st();
    let next = view;
    if (!next) next = 'cloud';
    showView(next);
    if (next === 'keys') fillKeysForm();
    if (next === 'cloud') refreshCloudForm();
  }

  function closeModal() {
    const ov = $('account-overlay');
    if (ov) {
      ov.classList.remove('open');
      ov.setAttribute('aria-hidden', 'true');
    }
    refreshChrome();
  }

  function showError(msg) {
    const err = $('account-error');
    if (!err) return;
    err.textContent = msg;
    err.hidden = !msg;
  }


  function cloudStatus(message, error=false) {
    const statusEl = $('account-cloud-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.style.color = error ? "#fca5a5" : "";
    }
  }
  function refreshCloudForm() {
    const backend = window.MaCollectionBackendConfig;
    const account = window.MaCollectionAccount;
    const cfg = backend?.current() || {url:"",key:""};
    const status = account?.status() || {};
    if ($('account-cloud-url')) $('account-cloud-url').value = cfg.url;
    if ($('account-cloud-key')) $('account-cloud-key').value = cfg.key;
    const ready = !!status.cloudConfigured;
    const signed = !!status.cloudSignedIn;
    const signup = $('account-cloud-signup');
    const login = $('account-cloud-login');
    if (signup) { signup.disabled = !ready || signed; signup.hidden = signed; }
    if (login) { login.disabled = !ready || signed; login.hidden = signed; }
    if ($('account-cloud-logout')) $('account-cloud-logout').hidden = !signed;
    if ($('account-cloud-email')) {
      $('account-cloud-email').disabled = signed;
      if (status.cloudEmail) $('account-cloud-email').value = status.cloudEmail;
    }
    if ($('account-cloud-password')) {
      $('account-cloud-password').disabled = signed;
      $('account-cloud-password').value = "";
    }
    cloudStatus(signed
      ? "Connecté à votre serveur Kovelyx : " + (status.cloudEmail || "compte actif") +
        ". Le compte est utilisable dans Kovelyx si l'application utilise le même serveur."
      : ready ? "Serveur configuré : inscription et connexion disponibles."
      : "Aucun serveur configuré : l'inscription en ligne n'est pas encore disponible. Vous pouvez toujours utiliser Ma-Collection sans compte.");
    refreshChrome();
  }
  function setAuthButtonsBusy(busy) {
    for (const id of ['account-cloud-signup','account-cloud-login','account-cloud-server-save']) {
      const el = $(id);
      if (el) el.disabled = busy;
    }
  }
  async function configureCloud() {
    const backend = window.MaCollectionBackendConfig;
    try {
      if (!backend) throw new Error("La configuration de serveur est indisponible.");
      // Le compte courant appartient au serveur précédent : ne pas le réutiliser.
      window.MaCollectionAccount.signOutCloud();
      backend.save($('account-cloud-url').value, $('account-cloud-key').value);
      refreshCloudForm();
      cloudStatus("Serveur sauvegardé sur ce navigateur. Utilisez le même serveur dans Kovelyx PC ; il reste à vérifier la connexion.");
    } catch (e) {
      cloudStatus(e.message || "Configuration refusée.",true);
    }
  }
  async function runCloudAuth(action) {
    const account = window.MaCollectionAccount;
    const email = ($('account-cloud-email')?.value || "").trim();
    const passwordField = $('account-cloud-password');
    const pass = passwordField?.value || "";
    if (!account?.cloudConfigured()) return cloudStatus("Configurez d'abord le serveur Kovelyx.",true);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return cloudStatus("Renseignez une adresse e-mail valide.",true);
    if (!pass || (action === "signup" && pass.length < 8)) return cloudStatus("Pour l'inscription, choisissez au moins huit caractères.",true);
    setAuthButtonsBusy(true);
    cloudStatus(action === "signup" ? "Inscription en cours…" : "Connexion en cours…");
    try {
      const result = action === "signup"
        ? await account.cloudSignup(email,pass)
        : await account.cloudLogin(email,pass);
      if (passwordField) passwordField.value = "";
      refreshCloudForm();
      cloudStatus(action === "signup"
        ? result.message
        : "Connecté ! Retrouvez ce compte dans Kovelyx PC en utilisant le même serveur et les mêmes identifiants.");
      toast(action === "signup" ? "Inscription envoyée." : "Compte Kovelyx connecté.");
    } catch (e) {
      if (passwordField) passwordField.value = "";
      cloudStatus("Opération impossible : " + (e.message || "serveur indisponible"),true);
    } finally {
      setAuthButtonsBusy(false);
      refreshChrome();
    }
  }
  function fillKeysForm() {
    let keys = {};
    let prefs = {};
    try {
      const snap = window.MaCollectionAccountBridge && window.MaCollectionAccountBridge.snapshot
        ? window.MaCollectionAccountBridge.snapshot()
        : null;
      keys = (snap && snap.keys) || {};
      prefs = (snap && snap.prefs) || {};
    } catch (e) { keys = {}; prefs = {}; }
    const map = {
      'account-key-alldebrid': keys.allDebridKey || '',
      'account-key-realdebrid': keys.realDebridKey || '',
      'account-key-tmdb': keys.tmdbKey || '',
      'account-key-mdblist': keys.mdblistKey || keys.forYouMdblistKey || '',
      'account-key-rpdb': keys.aioRpdbKey || '',
      'account-key-debrid': keys.aioDebridKey || '',
    };
    Object.keys(map).forEach((id) => {
      const el = $(id);
      if (el) el.value = map[id];
    });
  }

  function readKeysForm() {
    return {
      allDebridKey: (($('account-key-alldebrid') || {}).value || '').trim(),
      realDebridKey: (($('account-key-realdebrid') || {}).value || '').trim(),
      tmdbKey: (($('account-key-tmdb') || {}).value || '').trim(),
      mdblistKey: (($('account-key-mdblist') || {}).value || '').trim(),
      forYouMdblistKey: (($('account-key-mdblist') || {}).value || '').trim(),
      aioRpdbKey: (($('account-key-rpdb') || {}).value || '').trim(),
      aioDebridKey: (($('account-key-debrid') || {}).value || '').trim(),
    };
  }

  async function applyKeysAndSave() {
    const keys = readKeysForm();
    const prefs = {};
    if (window.MaCollectionAccountBridge && typeof window.MaCollectionAccountBridge.apply === 'function') {
      await window.MaCollectionAccountBridge.apply({ keys: keys, collection: {}, prefs: prefs });
    } else if (window.MaCollectionServices && typeof window.MaCollectionServices.applyVaultFields === 'function') {
      window.MaCollectionServices.applyVaultFields({ keys: keys, prefs: prefs });
    }
    // Keep Quick Editor fields in sync when present
    try {
      if (typeof window !== 'undefined') {
        const seMap = [
          ['se-alldebrid-key', keys.allDebridKey],
          ['se-realdebrid-key', keys.realDebridKey],
          ['se-tmdb-key', keys.tmdbKey],
          ['se-mdblist-key', keys.mdblistKey],
        ];
        seMap.forEach(([id, val]) => {
          const el = $(id);
          if (el) el.value = val;
        });
      }
    } catch (e) { /* ignore */ }

    const ok = await window.MaCollectionAccount.persistNow();
    if (!ok) throw new Error('Unlock Save first, then try again.');
    return true;
  }

  async function onCreate() {
    const pass = ($('account-pass-create') || {}).value || '';
    const confirm = ($('account-pass-confirm') || {}).value || '';
    if (pass !== confirm) return showError('Those passwords do not match.');
    try {
      await window.MaCollectionAccount.createVault(pass);
      const cloudError=window.MaCollectionAccount.status().lastSyncError;
      toast(cloudError
        ? "Coffre local enregistré ; sauvegarde en ligne indisponible : " + cloudError
        : "Sauvegarde locale activée.",cloudError?"error":"success");
      closeModal();
      refreshChrome();
      openModal('keys');
    } catch (e) {
      showError(e.message || String(e));
    }
  }

  async function onUnlock() {
    const pass = ($('account-pass-unlock') || {}).value || '';
    try {
      await window.MaCollectionAccount.unlockWithPassphrase(pass);
      toast('Restored. Autosave is on again for this session.');
      closeModal();
      refreshChrome();
    } catch (e) {
      showError('Could not restore. Check the save password.');
    }
  }

  async function saveProgress() {
    setMenuOpen(false);
    const s = st();
    if (!s.unlocked) {
      openModal(s.hasLocalVault ? 'unlock' : 'create');
      return;
    }
    try {
      const ok = await window.MaCollectionAccount.persistNow();
      const syncError=window.MaCollectionAccount.status().lastSyncError;
      toast(ok
        ? syncError ? 'Sauvegarde locale effectuée ; synchronisation distante indisponible : ' + syncError : 'Sauvegarde effectuée.'
        : 'Déverrouillez la sauvegarde avec votre phrase secrète.', syncError ? 'error' : 'success');
      refreshChrome();
    } catch (e) {
      toast(e.message || 'Save failed.', 'error');
    }
  }

  function handleAction(action) {
    if (action === 'cloud') { setMenuOpen(false); return openModal('cloud'); }
    if (action === 'save') return saveProgress();
    if (action === 'setup') {
      setMenuOpen(false);
      return openModal('create');
    }
    if (action === 'unlock') {
      setMenuOpen(false);
      return openModal('unlock');
    }
    if (action === 'keys') {
      setMenuOpen(false);
      return openModal('keys');
    }
    if (action === 'privacy') {
      setMenuOpen(false);
      return openModal('privacy');
    }
    if (action === 'lock') {
      setMenuOpen(false);
      window.MaCollectionAccount.lock();
      toast('Locked. Enter your save password again when you come back.');
      refreshChrome();
      return;
    }
    if (action === 'wipe') {
      setMenuOpen(false);
      if (!confirm('Supprimer les clés et les sélections enregistrées dans ce navigateur ? Vous pourrez réactiver la sauvegarde automatique ensuite.')) return;
      window.MaCollectionAccount.wipeLocalVault();
      toast('Saved data removed from this device.');
      refreshChrome();
    }
  }

  function wireTips() {
    document.querySelectorAll('.account-tip[data-tip]').forEach((tip) => {
      if (tip._wired) return;
      tip._wired = true;
      const show = () => {
        let bubble = tip.querySelector('.account-tip-bubble');
        if (!bubble) {
          bubble = document.createElement('span');
          bubble.className = 'account-tip-bubble';
          bubble.textContent = tip.getAttribute('data-tip') || '';
          tip.appendChild(bubble);
        }
        bubble.hidden = false;
      };
      const hide = () => {
        const bubble = tip.querySelector('.account-tip-bubble');
        if (bubble) bubble.hidden = true;
      };
      tip.addEventListener('mouseenter', show);
      tip.addEventListener('mouseleave', hide);
      tip.addEventListener('focus', show);
      tip.addEventListener('blur', hide);
      tip.addEventListener('click', (e) => {
        e.preventDefault();
        const bubble = tip.querySelector('.account-tip-bubble');
        if (bubble && !bubble.hidden) hide();
        else show();
      });
    });
  }

  function wire() {
    if (!window.MaCollectionAccount || !window.MaCollectionAccount.isEnabled()) {
      refreshChrome();
      return;
    }

    refreshChrome();
    wireTips();

    const fab = $('account-fab');
    if (fab) {
      fab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const menu = $('account-menu');
        const open = menu && menu.hidden;
        setMenuOpen(!!open);
        refreshChrome();
      });
    }

    document.addEventListener('click', (e) => {
      const chrome = $('account-chrome');
      if (!chrome || chrome.hidden) return;
      if (!chrome.contains(e.target)) setMenuOpen(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        const ov = $('account-overlay');
        if (ov && ov.classList.contains('open')) closeModal();
      }
    });

    document.querySelectorAll('[data-account-action]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const action = el.getAttribute('data-account-action');
        if (!action) return;
        // In-panel privacy link should not double-toggle menu
        if (el.classList.contains('account-text-link')) e.preventDefault();
        handleAction(action);
      });
    });

    $('account-close')?.addEventListener('click', closeModal);
    $('account-overlay')?.addEventListener('click', (e) => {
      if (e.target === $('account-overlay')) closeModal();
    });
    document.querySelectorAll('.account-goto-close').forEach((b) => {
      b.addEventListener('click', closeModal);
    });

    $('account-cloud-server-save')?.addEventListener('click', configureCloud);
    $('account-cloud-server-clear')?.addEventListener('click', () => {
      window.MaCollectionAccount.signOutCloud();
      window.MaCollectionBackendConfig?.clear();
      refreshCloudForm();
      cloudStatus("Serveur dissocié de ce navigateur. Vos sauvegardes locales n'ont pas été effacées.");
    });
    $('account-cloud-signup')?.addEventListener('click', () => runCloudAuth('signup'));
    $('account-cloud-login')?.addEventListener('click', () => runCloudAuth('login'));
    $('account-cloud-logout')?.addEventListener('click', () => {
      window.MaCollectionAccount.signOutCloud();
      refreshCloudForm();
      cloudStatus("Déconnecté sur le site. Pour fermer aussi la session Windows, déconnectez-vous dans Kovelyx.");
    });
    $('account-btn-create')?.addEventListener('click', onCreate);
    $('account-btn-unlock')?.addEventListener('click', onUnlock);
    $('account-goto-create')?.addEventListener('click', () => showView('create'));
    $('account-goto-unlock')?.addEventListener('click', () => showView('unlock'));
    $('account-btn-keys-save')?.addEventListener('click', async () => {
      try {
        await applyKeysAndSave();
        const cloudError=window.MaCollectionAccount.status().lastSyncError;
        toast(cloudError
          ? "Clés chiffrées enregistrées localement, mais pas synchronisées : "+cloudError
          : "Clés enregistrées.", cloudError?"error":"success");
        closeModal();
        refreshChrome();
      } catch (e) {
        showError(e.message || String(e));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  window.MaCollectionAccountUi = {
    openModal,
    closeModal,
    refreshChrome,
    saveProgress,
  };
})();
