/* Ma-Collection -> Kovelyx Cloudflare D1. Aucune API Nuvio/Supabase. */
(() => {
  "use strict";
  const MAX_BYTES = 4_000_000;
  const MAX_PARTS = 700;
  const CHUNK_CHARS = 6000;
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  const sensitiveKey = /^(api[_-]?key|access[_-]?token|refresh[_-]?token|password|client[_-]?secret|private[_-]?key)$/i;
  const $ = id => document.getElementById(id);
  const view = document.createElement("div");
  view.id = "mc-kovelyx-cloud";
  view.hidden = true;
  view.className = "quick-push-overlay";
  view.setAttribute("role", "dialog");
  view.setAttribute("aria-modal", "true");
  view.setAttribute("aria-labelledby", "mc-kovelyx-cloud-title");
  view.innerHTML = [
    '<div class="quick-push-panel" style="max-width:540px;max-height:92vh;overflow:auto;text-align:left">',
    '<h2 id="mc-kovelyx-cloud-title">Synchroniser avec Kovelyx</h2>',
    '<p>Envoyez les catalogues sur votre compte Kovelyx Cloudflare pour les retrouver sur PC, mobile et Android TV, avec le même profil connecté.</p>',
    '<p id="mc-kovelyx-cloud-account"></p>',
    '<div class="quick-push-actions"><button type="button" class="quick-push-btn-secondary" id="mc-kovelyx-cloud-login">Compte Kovelyx</button>',
    '<button type="button" class="quick-push-btn-secondary" id="mc-kovelyx-cloud-reload">Charger les profils</button></div>',
    '<label for="mc-kovelyx-cloud-profile">Profil de destination</label>',
    '<select id="mc-kovelyx-cloud-profile" style="width:100%;padding:12px;margin:7px 0 14px;background:#191628;color:white;border-radius:9px;border:1px solid #8b5cf6"></select>',
    '<label for="mc-kovelyx-cloud-mode">Comment publier ?</label>',
    '<select id="mc-kovelyx-cloud-mode" style="width:100%;padding:12px;margin:7px 0 14px;background:#191628;color:white;border-radius:9px;border:1px solid #8b5cf6">',
    '<option value="merge">Fusionner : conserver les catégories/dossiers existants</option>',
    '<option value="replace">Remplacer les collections du profil (après confirmation)</option>',
    '</select>',
    '<p>Les extensions et clés privées ne sont jamais envoyées. Les extensions nécessaires aux catalogues doivent déjà exister sur les appareils.</p>',
    '<p id="mc-kovelyx-cloud-status" role="status" aria-live="polite"></p>',
    '<div class="quick-push-actions"><button type="button" id="mc-kovelyx-cloud-cancel" class="quick-push-btn-secondary">Fermer</button>',
    '<button type="button" id="mc-kovelyx-cloud-send" class="quick-push-btn-primary">Publier sur ce profil</button></div>',
    '</div>'
  ].join("");
  document.body.appendChild(view);
  const style = document.createElement("style");
  style.textContent = '#mc-kovelyx-cloud[hidden]{display:none!important}#mc-kovelyx-cloud{z-index:11150}#mc-kovelyx-cloud-status[data-error="true"]{color:#fca5a5}';
  document.head.appendChild(style);
  let busy = false;
  let profiles = [];
  const account = () => window.MaCollectionAccount;
  const uuid = value => uuidPattern.test(String(value || ""));
  function status(message, error = false) {
    const el = $("mc-kovelyx-cloud-status");
    if (el) { el.textContent = message; el.dataset.error = String(error); }
  }
  function setBusy(value) {
    busy = value;
    for (const id of ["mc-kovelyx-cloud-reload", "mc-kovelyx-cloud-send", "mc-kovelyx-cloud-profile", "mc-kovelyx-cloud-mode"])
      if ($(id)) $(id).disabled = value;
  }
  function close() { if (!busy) view.hidden = true; }

  function validateContent(value, depth = 0) {
    if (depth > 64) throw new Error("Structure de catalogue trop profonde.");
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(item => validateContent(item, depth + 1));
    for (const [key, item] of Object.entries(value)) {
      if (sensitiveKey.test(key)) throw new Error("Un champ secret ne doit pas être publié dans un catalogue.");
      validateContent(item, depth + 1);
    }
  }

  function mergeCollections(existing, incoming) {
    if (!Array.isArray(existing) || !Array.isArray(incoming)) throw new Error("Format des collections invalide.");
    const output = existing.map(row => structuredClone(row));
    const index = new Map(output.map((row, position) => [row.id, position]));
    for (const category of incoming) {
      if (!category || typeof category.id !== "string" || !Array.isArray(category.folders))
        throw new Error("Catégorie importée invalide.");
      const pos = index.get(category.id);
      if (pos === undefined) { index.set(category.id, output.length); output.push(category); continue; }
      const previous = output[pos];
      const folders = (previous.folders || []).map(row => structuredClone(row));
      const folderIndex = new Map(folders.map((row, i) => [row.id, i]));
      for (const folder of category.folders) {
        const fi = folderIndex.get(folder.id);
        if (fi === undefined) { folderIndex.set(folder.id, folders.length); folders.push(folder); }
        else folders[fi] = { ...folders[fi], ...folder };
      }
      output[pos] = { ...previous, ...category, folders };
    }
    return output;
  }

  async function sha256(bytes) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function split(text) {
    const parts = [];
    for (let start = 0; start < text.length;) {
      let end = Math.min(start + CHUNK_CHARS, text.length);
      if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1]) && /[\uDC00-\uDFFF]/.test(text[end])) end--;
      parts.push(text.slice(start, end));
      start = end;
    }
    if (!parts.length || parts.length > MAX_PARTS) throw new Error("Trop de blocs pour Kovelyx Cloud.");
    return parts;
  }

  async function cloud(path, options) {
    const client = account();
    if (!client?.cloudFetch) throw new Error("Compte Kovelyx Cloudflare indisponible. Rechargez la page.");
    const response = await client.cloudFetch(path, options);
    return response.json();
  }
  async function pagedSync(profileId, kind, hash) {
    const rows = [];
    for (let offset = 0; offset <= 100000; offset += 25) {
      let path = "/v1/sync?profileId=" + encodeURIComponent(profileId) + "&offset=" + offset + "&limit=25";
      if (kind) path += "&snapshotKind=" + kind + "&snapshotHash=" + hash;
      const page = await cloud(path);
      if (!Array.isArray(page.items)) throw new Error("Réponse de synchronisation invalide.");
      rows.push(...page.items);
      if (page.nextOffset == null) return rows;
      if (page.nextOffset !== offset + 25 || page.items.length !== 25)
        throw new Error("Pagination Cloudflare invalide.");
    }
    throw new Error("Trop de données à synchroniser.");
  }

  async function existingHead(profileId) {
    const rows = await pagedSync(profileId);
    const row = rows.find(x => x.category === "preferences" && x.itemKey === "catalogue_collections" && !x.deleted);
    if (!row) return null;
    const head = row.payload || {};
    if (head.schema !== 1 || !/^[a-f0-9]{64}$/.test(head.sha256 || "") ||
        !Number.isSafeInteger(head.parts) || head.parts < 1 || head.parts > MAX_PARTS ||
        !Number.isSafeInteger(head.utf8Bytes) || head.utf8Bytes < 1 || head.utf8Bytes > MAX_BYTES ||
        !Number.isSafeInteger(row.revision) || row.revision < 1)
      throw new Error("Catalogue distant incompatible : aucune donnée modifiée.");
    return { ...head, revision: row.revision };
  }

  async function readCurrent(profileId, head) {
    const rows = await pagedSync(profileId, "collections", head.sha256);
    const chunks = rows.map(row => row.payload).sort((a,b) => a.index - b.index);
    if (chunks.length !== head.parts || chunks.some((chunk,i) => chunk.index !== i || typeof chunk.text !== "string"))
      throw new Error("Catalogue distant incomplet : publication annulée.");
    const raw = chunks.map(item => item.text).join("");
    const bytes = new TextEncoder().encode(raw);
    if (bytes.length !== head.utf8Bytes || await sha256(bytes) !== head.sha256)
      throw new Error("Empreinte du catalogue distant invalide : publication annulée.");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error("Catalogue distant illisible : publication annulée.");
    return data;
  }

  async function loadProfiles() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await cloud("/v1/profiles");
      profiles = (result.profiles || []).filter(row => uuid(row.id));
      const list = $("mc-kovelyx-cloud-profile");
      list.replaceChildren();
      for (const row of profiles) {
        const option = document.createElement("option");
        option.value = row.id;
        option.textContent = row.displayName || "Profil Kovelyx";
        list.appendChild(option);
      }
      const s = account().status();
      $("mc-kovelyx-cloud-account").textContent = "Compte connecté : " + (s.cloudEmail || "Kovelyx");
      status(profiles.length ? "Choisissez le profil à synchroniser." : "Aucun profil. Créez-le dans Kovelyx, puis actualisez.");
    } catch (error) {
      profiles = [];
      $("mc-kovelyx-cloud-profile").replaceChildren();
      status(error.message || "Connexion impossible.", true);
    } finally { setBusy(false); }
  }

  async function open() {
    if (busy) return;
    view.hidden = false;
    const signed = account()?.status()?.cloudSignedIn;
    $("mc-kovelyx-cloud-account").textContent = signed ? "Vérification de la session…" :
      "Connectez-vous au compte Kovelyx Cloudflare utilisé sur vos appareils.";
    status(signed ? "Chargement des profils…" : "Cliquez sur « Compte Kovelyx » pour vous connecter.");
    if (signed) await loadProfiles();
    $("mc-kovelyx-cloud-send").focus();
  }

  async function publish() {
    if (busy) return;
    const profileId = $("mc-kovelyx-cloud-profile").value;
    if (!uuid(profileId) || !profiles.some(p => p.id === profileId))
      return status("Choisissez un profil Kovelyx valide.", true);
    const mode = $("mc-kovelyx-cloud-mode").value;
    if (mode === "replace" && !window.confirm("Remplacer toutes les collections de ce profil sur vos appareils ? Les autres profils ne seront pas touchés."))
      return;
    setBusy(true);
    try {
      // /ready ne contient jamais de données de compte : refus précoce des Workers obsolètes.
      const server = window.MaCollectionBackendConfig.current().url;
      const readyResponse = await fetch(server + "/ready", { mode:"cors",cache:"no-store",credentials:"omit" });
      const ready = await readyResponse.json().catch(() => ({}));
      if (!readyResponse.ok || ready.status !== "ok" || ready.catalogueSnapshotSchema !== 1)
        throw new Error("Votre Worker Kovelyx Cloudflare est trop ancien pour les catalogues. Mettez-le à jour après sauvegarde D1.");
      status("Préparation des catalogues sans identifiants privés…");
      const exporter = window.MaCollectionKovelyx;
      if (!exporter?.buildExport) throw new Error("L'export Kovelyx est indisponible.");
      const incoming = JSON.parse(await exporter.buildExport());
      if (!Array.isArray(incoming) || !incoming.length) throw new Error("Sélectionnez des catalogues avant l'envoi.");
      // Conflits : ne jamais publier avec une révision périmée.
      const old = await existingHead(profileId);
      const merged = mode === "merge" && old ? mergeCollections(await readCurrent(profileId,old), incoming) : incoming;
      validateContent(merged);
      const payload = JSON.stringify(merged);
      const bytes = new TextEncoder().encode(payload);
      if (!bytes.length || bytes.length > MAX_BYTES)
        throw new Error("Sélection supérieure à 4 Mo pour le cloud Kovelyx. Réduisez-la ou utilisez l'import PC.");
      const parts = split(payload);
      const hash = await sha256(bytes);
      if (old?.sha256 === hash) {
        // Une empreinte déclarée n'est pas une preuve que tous les blocs sont lisibles.
        await readCurrent(profileId, old);
        status("Catalogues déjà présents et relus intégralement sur ce profil. Aucun remplacement nécessaire.");
        return;
      }
      for (let i = 0; i < parts.length; i++) {
        await cloud("/v1/catalogue-chunk", {
          method: "POST",
          body: {
            profileId, category: "catalogues",
            itemKey: "snapshot:collections:" + hash + ":" + String(i).padStart(6,"0"),
            revision: 0, deleted: false, payload: {index:i, text:parts[i]}
          }
        });
        if (i === 0 || i % 20 === 0 || i === parts.length - 1)
          status("Envoi sécurisé vers Cloudflare : " + (i + 1) + "/" + parts.length + " blocs.");
      }
      // Commit atomique après réception de TOUS les blocs, CAS contre un autre appareil.
      await cloud("/v1/catalogue-manifest", {
        method: "POST",
        body: {
          profileId, kind:"collections", sha256:hash,
          parts:parts.length, utf8Bytes:bytes.length,
          revision: old?.revision || 0
        }
      });
      // Un HTTP 201 de l'écriture ne prouve pas que le profil relira l'archive
      // (D1, pagination, résolution du hash et blocs peuvent échouer séparément).
      // Vérifier la restitution sans republier ou écraser les données existantes.
      try {
        const saved = await existingHead(profileId);
        if (!saved || saved.sha256 !== hash || saved.parts !== parts.length ||
            saved.utf8Bytes !== bytes.length)
          throw new Error("manifeste distant non confirmé");
        const recovered = await readCurrent(profileId, saved);
        if (JSON.stringify(recovered) !== payload)
          throw new Error("contenu différent après relecture");
      } catch (_) {
        status("Envoi accepté par Kovelyx, mais la relecture complète n'est pas encore vérifiée. Vérifiez la synchronisation du profil avant de réessayer.", true);
        return;
      }
      status("Catalogues publiés et relus intégralement sur ce profil Kovelyx. Sur PC, mobile et TV, ouvrez le même profil pour synchroniser.");
    } catch (error) {
      status(error.message || "Publication impossible ; les catalogues existants sont conservés.",true);
    } finally { setBusy(false); }
  }

  $("mc-kovelyx-cloud-login").addEventListener("click", () => {
    if (busy) return;
    view.hidden = true;
    window.MaCollectionAccountUi?.openModal("cloud");
  });
  $("mc-kovelyx-cloud-reload").addEventListener("click", loadProfiles);
  $("mc-kovelyx-cloud-cancel").addEventListener("click", close);
  $("mc-kovelyx-cloud-send").addEventListener("click", publish);
  view.addEventListener("click", event => { if (event.target === view) close(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !view.hidden) close(); });
  window.MaCollectionCloudPush = Object.freeze({ open, publish, split, mergeCollections, validateContent });
})();
