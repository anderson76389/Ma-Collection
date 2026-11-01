/**
 * Affiches de dossiers — extension additive de Ma-Collection.
 * Aucun visuel n'est remplacé par défaut : tout changement exige un clic
 * explicite, reste local à ce navigateur, et est inclus dans les exports JSON.
 * Aucune requête ni URL vers les hébergements de Kaptain.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'ma_collection_folder_artwork_v1';
  const ART_HOST = 'ma-art.mailpromahe.workers.dev';
  const TMDB_HOST = 'image.tmdb.org';
  const initialArtwork = new Map();
  let selectedFolder = null;
  let modal = null;

  function validArtworkUrl(value) {
    if (value === '') return true;
    if (typeof value !== 'string' || value.length > 1600) return false;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) return false;
      if (url.hostname === ART_HOST) {
        return /^\/(?:media|collection-cards|assets)\//.test(url.pathname);
      }
      if (url.hostname === TMDB_HOST) {
        return /^\/t\/p\/(?:w\d+|original)\/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/.test(url.pathname);
      }
    } catch (_) { /* invalide */ }
    return false;
  }

  function loadOverrides() {
    try {
      const object = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return object && typeof object === 'object' && !Array.isArray(object) ? object : {};
    } catch (_) { return {}; }
  }

  function saveOverrides(object) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(object)); }
    catch (_) { /* export possible même si le stockage est désactivé */ }
  }

  function folders() {
    const data = window.collectionData || window.NUVIO_DATABASE;
    if (!Array.isArray(data)) return [];
    return data.flatMap(category => Array.isArray(category.folders) ? category.folders : []);
  }

  function originalFor(folder) {
    if (!initialArtwork.has(folder.id)) {
      initialArtwork.set(folder.id, {
        coverImageUrl: folder.coverImageUrl || '',
        heroBackdropUrl: folder.heroBackdropUrl || '',
        tileShape: folder.tileShape || 'LANDSCAPE'
      });
    }
    return initialArtwork.get(folder.id);
  }

  function hydrate() {
    const overrides = loadOverrides();
    for (const folder of folders()) {
      if (!folder.id) continue;
      originalFor(folder);
      const choice = overrides[folder.id];
      if (!choice || !validArtworkUrl(choice.coverImageUrl) ||
          !validArtworkUrl(choice.heroBackdropUrl) ||
          !['LANDSCAPE', 'POSTER', 'SQUARE'].includes(choice.tileShape)) continue;
      folder.coverImageUrl = choice.coverImageUrl;
      folder.heroBackdropUrl = choice.heroBackdropUrl;
      folder.tileShape = choice.tileShape;
    }
  }

  function redraw() {
    if (typeof renderFolderGrid === 'function') renderFolderGrid();
    if (typeof renderSidebar === 'function') renderSidebar();
    if (typeof notifyAccountSave === 'function') notifyAccountSave();
  }

  function closeModal() {
    if (!modal) return;
    modal.remove();
    modal = null;
    selectedFolder = null;
    document.removeEventListener('keydown', closeOnEscape, true);
  }

  function closeOnEscape(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeModal();
    }
  }

  function openModal(folder) {
    if (!folder || !folder.id) return;
    closeModal();
    selectedFolder = folder;
    originalFor(folder);

    const root = document.createElement('div');
    root.className = 'mc-art-overlay';
    root.innerHTML = [
      '<section class="mc-art-dialog" role="dialog" aria-modal="true" aria-labelledby="mc-art-heading">',
      '<header class="mc-art-header"><div><div class="mc-art-eyebrow">Personnalisation facultative</div>',
      '<h2 id="mc-art-heading">Affiche du dossier</h2><p class="mc-art-folder-name"></p></div>',
      '<button class="mc-art-close" type="button" aria-label="Fermer">×</button></header>',
      '<div class="mc-art-body"><div class="mc-art-preview"><img class="mc-art-current" alt="Aperçu de l’affiche"><span>Prévisualisation</span></div>',
      '<div class="mc-art-controls"><label for="mc-art-cover">Adresse de la couverture</label>',
      '<input id="mc-art-cover" type="url" spellcheck="false" placeholder="https://ma-art.mailpromahe.workers.dev/media/…">',
      '<label for="mc-art-backdrop">Fond du dossier (facultatif)</label>',
      '<input id="mc-art-backdrop" type="url" spellcheck="false" placeholder="Conserver ou modifier le fond">',
      '<label class="mc-art-checkbox"><input id="mc-art-portrait" type="checkbox"> Format affiche verticale (2:3)</label>',
      '<button class="mc-art-tmdb" type="button" hidden>Afficher des alternatives TMDB</button>',
      '<p class="mc-art-help">Les visuels Ma-Art sont servis depuis ton Cloudflare. Les alternatives TMDB restent hébergées chez TMDB, jamais chez Kaptain.</p>',
      '<p class="mc-art-status" role="status" aria-live="polite"></p></div></div>',
      '<div class="mc-art-gallery" hidden aria-label="Affiches alternatives"></div>',
      '<footer class="mc-art-footer"><button class="mc-art-reset" type="button">Rétablir les visuels d’origine</button>',
      '<button class="mc-art-save" type="button">Enregistrer l’affiche</button></footer></section>'
    ].join('');
    document.body.appendChild(root);
    modal = root;

    const coverInput = root.querySelector('#mc-art-cover');
    const backdropInput = root.querySelector('#mc-art-backdrop');
    const portraitInput = root.querySelector('#mc-art-portrait');
    const preview = root.querySelector('.mc-art-current');
    const status = root.querySelector('.mc-art-status');
    const tmdbButton = root.querySelector('.mc-art-tmdb');
    const gallery = root.querySelector('.mc-art-gallery');

    root.querySelector('.mc-art-folder-name').textContent = folder.title || 'Dossier';
    coverInput.value = folder.coverImageUrl || '';
    backdropInput.value = folder.heroBackdropUrl || '';
    portraitInput.checked = folder.tileShape === 'POSTER';
    preview.src = folder.coverImageUrl || '';
    preview.onerror = () => { status.textContent = 'L’image choisie ne peut pas être chargée.'; };

    function previewChoice() {
      const value = coverInput.value.trim();
      status.textContent = '';
      if (!validArtworkUrl(value) || !value) {
        status.textContent = 'Utilise une image HTTPS Ma-Art ou TMDB valide.';
        return;
      }
      preview.src = value;
    }

    coverInput.addEventListener('change', previewChoice);
    coverInput.addEventListener('blur', previewChoice);
    root.querySelector('.mc-art-close').addEventListener('click', closeModal);
    root.addEventListener('click', event => { if (event.target === root) closeModal(); });
    document.addEventListener('keydown', closeOnEscape, true);

    const collectionSource = (folder.sources || []).length === 1 &&
      (folder.sources || []).find(source =>
        source.provider === 'tmdb' &&
        source.tmdbSourceType === 'COLLECTION' &&
        Number.isSafeInteger(Number(source.tmdbId)) &&
        Number(source.tmdbId) > 0);

    if (collectionSource) {
      tmdbButton.hidden = false;
      tmdbButton.addEventListener('click', async () => {
        const key = typeof LIVE_PREVIEW_TMDB_KEY === 'string' ? LIVE_PREVIEW_TMDB_KEY : '';
        if (!key) { status.textContent = 'Clé TMDB indisponible.'; return; }
        tmdbButton.disabled = true;
        status.textContent = 'Recherche des affiches TMDB…';
        try {
          const id = Number(collectionSource.tmdbId);
          const endpoint = 'https://api.themoviedb.org/3/collection/' + id +
            '/images?api_key=' + encodeURIComponent(key) + '&include_image_language=fr,en,null';
          const response = await fetch(endpoint, { credentials: 'omit' });
          if (!response.ok) throw new Error('TMDB HTTP ' + response.status);
          const result = await response.json();
          gallery.replaceChildren();
          let count = 0;
          const used = new Set();
          for (const poster of result.posters || []) {
            const path = String(poster.file_path || '');
            if (!/^\/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/.test(path) || used.has(path)) continue;
            used.add(path);
            const fullUrl = 'https://' + TMDB_HOST + '/t/p/w500' + path;
            const thumbUrl = 'https://' + TMDB_HOST + '/t/p/w185' + path;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mc-art-choice';
            btn.title = 'Utiliser cette affiche TMDB';
            btn.setAttribute('aria-label', 'Choisir une affiche ' + (poster.iso_639_1 || 'sans langue'));
            const img = document.createElement('img');
            img.src = thumbUrl;
            img.alt = 'Affiche alternative ' + (count + 1);
            img.loading = 'lazy';
            btn.appendChild(img);
            btn.addEventListener('click', () => {
              coverInput.value = fullUrl;
              portraitInput.checked = true;
              previewChoice();
              gallery.querySelectorAll('.mc-art-choice').forEach(node => node.classList.remove('active'));
              btn.classList.add('active');
            });
            gallery.appendChild(btn);
            if (++count === 12) break;
          }
          gallery.hidden = count === 0;
          status.textContent = count ? count + ' affiches disponibles. Choisis-en une puis enregistre.' : 'Aucune affiche alternative trouvée.';
        } catch (error) {
          status.textContent = 'Impossible de charger les alternatives TMDB. La couverture actuelle est conservée.';
        } finally {
          tmdbButton.disabled = false;
        }
      });
    }

    root.querySelector('.mc-art-save').addEventListener('click', () => {
      if (selectedFolder !== folder) return;
      const cover = coverInput.value.trim();
      const backdrop = backdropInput.value.trim();
      if (!cover || !validArtworkUrl(cover) || !validArtworkUrl(backdrop)) {
        status.textContent = 'Adresse invalide : seules les images HTTPS Ma-Art ou TMDB sont acceptées.';
        return;
      }
      const next = {
        coverImageUrl: cover,
        heroBackdropUrl: backdrop,
        tileShape: portraitInput.checked ? 'POSTER' : (originalFor(folder).tileShape || 'LANDSCAPE')
      };
      const overrides = loadOverrides();
      overrides[folder.id] = next;
      saveOverrides(overrides);
      Object.assign(folder, next);
      closeModal();
      redraw();
      if (typeof showToast === 'function') showToast('Affiche enregistrée pour ce navigateur et vos exports.', 'success');
    });

    root.querySelector('.mc-art-reset').addEventListener('click', () => {
      const original = originalFor(folder);
      const overrides = loadOverrides();
      delete overrides[folder.id];
      saveOverrides(overrides);
      Object.assign(folder, original);
      closeModal();
      redraw();
      if (typeof showToast === 'function') showToast('Visuels d’origine restaurés.', 'success');
    });
    coverInput.focus();
  }

  const originalInitialize = window.initializeDatabase;
  if (typeof originalInitialize === 'function') {
    window.initializeDatabase = function () {
      const result = originalInitialize.apply(this, arguments);
      hydrate();
      // Le site affiche la prévisualisation dès le chargement : actualiser
      // celle-ci uniquement si le navigateur possède déjà des préférences.
      if (Object.keys(loadOverrides()).length &&
          typeof renderPreviewCollection === 'function' &&
          typeof isPreviewActive !== 'undefined' && isPreviewActive) {
        renderPreviewCollection();
      }
      return result;
    };
  }

  const originalDrawer = window.openSourceCustomizationDrawer;
  if (typeof originalDrawer === 'function') {
    window.openSourceCustomizationDrawer = function (folder) {
      const result = originalDrawer.apply(this, arguments);
      const actions = document.querySelector('#drawer-overlay .drawer-header-actions');
      if (actions && folder && folder.id) {
        let button = actions.querySelector('#mc-art-open');
        if (!button) {
          button = document.createElement('button');
          button.id = 'mc-art-open';
          button.type = 'button';
          button.className = 'cat-action-btn';
          button.textContent = '🎨 Affiche';
          button.title = 'Changer la couverture sans modifier les sources';
          actions.appendChild(button);
        }
        button.onclick = () => openModal(folder);
      }
      return result;
    };
  }
  if (document.readyState !== 'loading') hydrate();
  window.MaCollectionArtworkEditor = { validArtworkUrl };
})();