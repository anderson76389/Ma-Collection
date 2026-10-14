/* Assistant commun d'import Ma-Collection : Nuvio + Kovelyx.
   Les clés restent en mémoire dans cet onglet. Aucune clé dans les exports JSON de catalogues. */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const STEPS = ["Catalogues", "Affiches", "Métadonnées", "Affiches notées", "Débridage", "Extensions", "Confirmation"];
  const state = {
    destination: "kovelyx", step: 0, selectedFolder: "", onFinish: null,
    artwork: {}, tmdbKey: "", mdblistKey: "", traktToken: "",
    posterProvider: "none", rpdbTheme: "t0-free-rpdb", rpdbKey: "", topPosterKey: "",
    bttrQuality: false, bttrGenre: true, bttrRating: true, bttrAge: false,
    bttrSource: "Average", bttrLanguage: "fr",
    allDebridKey: "", realDebridKey: "", preferredDebridProvider: "alldebrid", addonManifests: "",
    tmdbLanguage: "fr", importMode: "local", importAction: "replace",
  };
  let selected = [];
  const node = document.createElement("div");
  node.id = "mc-import-studio";
  node.className = "quick-push-overlay";
  node.hidden = true;
  node.setAttribute("role","dialog");
  node.setAttribute("aria-modal","true");
  node.setAttribute("aria-labelledby","mc-import-title");
  node.innerHTML = '<div class="quick-push-panel mc-import-panel"><div id="mc-import-inner"></div></div>';
  document.body.appendChild(node);
  const css = document.createElement("style");
  css.textContent = `
    #mc-import-studio[hidden]{display:none!important}
    #mc-import-studio{z-index:11000}
    .mc-import-panel{width:min(740px,calc(100vw - 24px));max-width:740px;max-height:min(92vh,920px);overflow-y:auto;text-align:left;padding:24px}
    .mc-import-head{display:flex;justify-content:space-between;align-items:start;gap:16px}
    .mc-import-head h2{margin:0 0 5px;font-size:1.5rem;color:var(--text-primary,#f7f7ff)}
    .mc-import-head p{margin:0 0 12px;color:var(--text-muted,#9ca3af);font-size:.91rem}
    .mc-import-close{background:transparent;border:1px solid #7776;border-radius:10px;color:inherit;cursor:pointer;font-size:1.4rem;padding:2px 11px}
    .mc-import-progress{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;margin:10px 0 18px}
    .mc-import-progress span{height:5px;background:#aaa3;border-radius:8px}
    .mc-import-progress span.active{background:#a78bfa}
    .mc-import-card{background:rgba(120,120,150,.08);border:1px solid rgba(150,150,180,.21);padding:14px;border-radius:13px;margin:12px 0}
    .mc-import-card p{margin:6px 0;color:var(--text-muted,#b6b5c4);font-size:.91rem;line-height:1.55}
    .mc-import-form{display:grid;gap:13px}
    .mc-import-form label{display:grid;gap:5px;font-weight:600;font-size:.91rem}
    .mc-import-form textarea{box-sizing:border-box;width:100%;min-width:0;padding:12px;border-radius:9px;border:1px solid #aaa5;color:var(--text-primary,#fff);background:var(--bg-secondary,#20202e);font:inherit;resize:vertical}
    .mc-import-form input,.mc-import-form select{box-sizing:border-box;width:100%;min-width:0;padding:12px;border-radius:9px;border:1px solid #aaa5;color:var(--text-primary,#fff);background:var(--bg-secondary,#20202e);font:inherit}
    .mc-import-form input:focus,.mc-import-form select:focus{outline:2px solid #a78bfa;outline-offset:1px}
    .mc-import-form input[type=checkbox]{width:auto}
    .mc-import-form label.mc-inline{display:flex;align-items:center;gap:10px;font-weight:400}
    .mc-import-2col{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .mc-import-image{width:106px;height:152px;object-fit:cover;background:#333;border-radius:10px;border:1px solid #6665;flex-shrink:0}
    .mc-import-art-layout{display:flex;gap:15px;align-items:flex-start}
    .mc-import-actions{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:22px;border-top:1px solid #aaa3;padding-top:15px}
    .mc-import-actions button,.mc-import-action{padding:11px 16px;border-radius:10px;cursor:pointer;font-weight:600}
    .mc-import-actions .primary,.mc-import-action.primary{background:#8052ce;color:white;border:1px solid #9a72d7}
    .mc-import-actions .secondary,.mc-import-action.secondary{background:transparent;color:inherit;border:1px solid #aaa5}
    .mc-import-note{font-size:.85rem;color:var(--text-muted,#aeb0bd);line-height:1.5}
    .mc-import-error{color:#ffaaaa!important}
    @media(max-width:560px){.mc-import-panel{padding:15px}.mc-import-2col{grid-template-columns:1fr}.mc-import-art-layout{flex-direction:column}}
  `;
  document.head.appendChild(css);
  const current = () => byId("mc-import-inner");
  function getSelected() {
    try {
      const items = window.MaCollectionExport?.assembleFilteredDatabase?.() || [];
      return Array.isArray(items) ? items : [];
    } catch (_) { return []; }
  }
  function folders() {
    return selected.flatMap(c => (c.folders || []).map(f => ({
      categoryId:String(c.id || ""), categoryTitle:String(c.title || ""),
      folderId:String(f.id || ""), title:String(f.title || ""), folder:f,
      key: String(c.id || "") + "::" + String(f.id || "")
    })));
  }
  function validUrl(value) {
    if (!value) return "";
    let url;
    try { url = new URL(value); } catch (_) { throw Error("Utilisez une URL complète https:// pour vos affiches."); }
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost","127.0.0.1"].includes(url.hostname)))
      throw Error("Seuls les liens HTTPS (ou locaux pour les tests) sont acceptés.");
    return url.href;
  }
  function decorateCollections(data) {
    if (!Array.isArray(data)) return data;
    return data.map(c => ({
      ...c,
      folders: (c.folders || []).map(f => {
        const custom = state.artwork[String(c.id || "") + "::" + String(f.id || "")];
        if (!custom) return f;
        const result = { ...f };
        for (const field of ["coverImageUrl", "titleLogoUrl", "heroBackdropUrl"]) {
          if (custom[field]) result[field] = custom[field];
        }
        if (custom.tileShape) result.tileShape = custom.tileShape;
        return result;
      }),
    }));
  }
  const settings = () => ({
    tmdbKey:state.tmdbKey.trim(), mdblistKey:state.mdblistKey.trim(),
    tmdbLanguage:state.tmdbLanguage==="en"?"en":"fr",
    importMode:state.importMode==="account"?"account":"local",
    importAction:state.importAction==="merge"?"merge":"replace",
    traktToken:state.traktToken.trim(), posterProvider:state.posterProvider,
    rpdbTheme:state.rpdbTheme, rpdbKey:state.rpdbKey.trim(), topPosterKey:state.topPosterKey.trim(),
    bttrQuality:state.bttrQuality, bttrGenre:state.bttrGenre, bttrRating:state.bttrRating,
    bttrAge:state.bttrAge, bttrSource:state.bttrSource, bttrLanguage:state.bttrLanguage,
    allDebridKey:state.allDebridKey.trim(), realDebridKey:state.realDebridKey.trim(),
    preferredDebridProvider:state.preferredDebridProvider,
    addonManifests:state.addonManifests.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),
  });
  // Le même format de lien BetterPosters est utilisé dans Kovelyx PC.
  function bttrPreviewUrl() {
    let modifiers="";
    if (!state.bttrGenre && !state.bttrRating) modifiers+="n";
    else { if (!state.bttrGenre) modifiers+="r"; if (!state.bttrRating) modifiers+="g"; }
    if (state.bttrQuality) modifiers+="q";
    if (state.bttrAge) modifiers+="a";
    const format=modifiers?"poster-"+modifiers:"poster";
    const params=[];
    if (state.bttrLanguage!=="en") params.push("lang=fr");
    if (state.bttrSource!=="Average") params.push("rs="+encodeURIComponent(state.bttrSource));
    return "https://btttr.cc/"+format+"/imdb/poster-default/tt0137523.jpg"+(params.length?"?"+params.join("&"):"");
  }
  function updateBttrPreview() {
    const image=byId("mc-bttr-preview");
    if (!image || state.posterProvider!=="bttr") return;
    image.src=bttrPreviewUrl();
    const caption=byId("mc-bttr-status");
    if (caption) caption.textContent="Chargement de l’aperçu Bttr…";
  }
  function field(id,label,key,placeholder,type="password") {
    const testable = ["tmdb","mdblist","ad","rd"].includes(id);
    return `<label for="mc-${id}">${label}<input id="mc-${id}" data-key="${key}" type="${type}" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder)}" value="${esc(state[key])}"></label>` +
      (testable ? `<div><button type="button" class="mc-import-action secondary" data-keytest="${id}">Tester la clé</button> <span class="mc-import-note" id="mc-keytest-${id}" role="status"></span></div>` : "");
  }
  function stepHtml() {
    const rows = folders(), currentFolder = rows.find(f => f.key === state.selectedFolder) || rows[0];
    if (state.step === 0) return `
      <div class="mc-import-card"><strong>${selected.length} catégories • ${rows.length} dossiers sélectionnés</strong>
      <p>Les sélections et filtres déjà faits dans Ma-Collection sont conservés. Vous pouvez encore modifier les catalogues avant l'import.</p></div>
      ${state.destination==="kovelyx" ? `<div class="mc-import-card"><strong>1. Choisir votre mode de connexion</strong>
         <p>Vous pouvez utiliser Kovelyx avec ou sans compte. La connexion à un compte se fait dans Kovelyx PC, avec un serveur de comptes que vous avez configuré. Si aucun serveur n'est disponible, choisissez Sans connexion.</p>
         <div class="mc-import-form"><label>Mode d'importation<select data-key="importMode">
           <option value="local" ${state.importMode==="local"?"selected":""}>Sans connexion — importer dans le profil local actif</option>
           <option value="account" ${state.importMode==="account"?"selected":""}>Avec mon compte — charger mes profils synchronisés</option>
         </select></label></div></div>` : "" }
      <button type="button" class="mc-import-action secondary" id="mc-edit-collections">✏️ Modifier les catégories et les sous-catégories</button>
      <p class="mc-import-note">Cette action ouvre la personnalisation guidée existante, puis vous ramène à cette préparation d'import.</p>`;
    if (state.step === 1) {
      const custom = currentFolder ? (state.artwork[currentFolder.key] || {}) : {};
      return `<p class="mc-import-note">Choisissez un dossier et remplacez uniquement les images que vous souhaitez. Toutes les autres images et tous les GIF restent inchangés.</p>
        <div class="mc-import-form">
        <label>Dossier
        <select id="mc-pick-folder">${rows.map(r => `<option value="${esc(r.key)}" ${currentFolder?.key===r.key?"selected":""}>${esc(r.categoryTitle)} / ${esc(r.title)}</option>`).join("")}</select></label>
        ${currentFolder ? `<div class="mc-import-art-layout">
          <img id="mc-art-preview" class="mc-import-image" alt="Aperçu de l'affiche" src="${esc(custom.coverImageUrl || currentFolder.folder.coverImageUrl || "")}">
          <div class="mc-import-form" style="flex:1;min-width:0">
            <label>Affiche du dossier<input type="url" id="mc-art-cover" placeholder="https://…/affiche.jpg" value="${esc(custom.coverImageUrl||"")}"></label>
            <label>Logo du dossier<input type="url" id="mc-art-logo" placeholder="https://…/logo.png" value="${esc(custom.titleLogoUrl||"")}"></label>
            <label>Image de fond<input type="url" id="mc-art-backdrop" placeholder="https://…/fond.jpg" value="${esc(custom.heroBackdropUrl||"")}"></label>
            <label>Format du visuel<select id="mc-art-shape">
              ${[["","Conserver l'original"],["poster","Affiche verticale"],["landscape","Paysage"],["square","Carré"]].map(([v,n])=>`<option value="${v}" ${(custom.tileShape||"")===v?"selected":""}>${n}</option>`).join("")}
            </select></label>
            <button type="button" class="mc-import-action secondary" id="mc-art-reset">Restaurer les images d'origine du dossier</button>
          </div></div>` : "<p>Aucun dossier sélectionné.</p>"}
        </div>`;
    }
    if (state.step === 2) return `
      <p class="mc-import-note">Ces clés sont facultatives et restent dans cet onglet. Pour Kovelyx, TMDB et MDBList peuvent être transférés via le nouveau pont local après votre confirmation. Trakt nécessite une autorisation propre à chaque service.</p>
      <div class="mc-import-form">
        <label>Langue des résumés TMDB<select data-key="tmdbLanguage">
          <option value="fr" ${state.tmdbLanguage==="fr"?"selected":""}>Français (par défaut)</option>
          <option value="en" ${state.tmdbLanguage==="en"?"selected":""}>Anglais</option>
        </select></label>
        ${field("tmdb","Clé API TMDB","tmdbKey","Clé personnelle TMDB")}
        ${field("mdblist","Clé API MDBList","mdblistKey","Clé personnelle MDBList")}
        ${field("trakt","Jeton Trakt AIO Metadata (facultatif)","traktToken","Jeton d'une instance AIO Metadata")}
      </div>
      <p class="mc-import-note">Les jetons Trakt sont liés à l'instance AIO Metadata qui les a délivrés. La connexion Trakt dans l'application se fait séparément via OAuth.</p>`;
    if (state.step === 3) return `<p class="mc-import-note">RPDB : Kovelyx PC applique également le thème choisi aux affiches natives après votre confirmation. Pour Nuvio et pour les fournisseurs Bttr/Top Posters, la prise en charge dépend de la configuration AIO Metadata / AIO Streams.</p>
      <div class="mc-import-form">
        <label>Fournisseur d'affiches notées<select id="mc-poster-provider" data-key="posterProvider">
          ${[["none","Ne rien changer"],["rpdb","RPDB"],["bttr","Bttr Posters"],["top","Top Posters"]].map(([v,n])=>`<option value="${v}" ${state.posterProvider===v?"selected":""}>${n}</option>`).join("")}
        </select></label>
        <div id="mc-poster-rpdb" ${state.posterProvider==="rpdb"?"":"hidden"}>
          <label>Thème RPDB<select id="mc-rpdb-theme" data-key="rpdbTheme">
            ${[["t0-free-rpdb","Gratuit : barre sombre"],["t0-free-rpdb-blocks","Gratuit : blocs"],["t0-free-rpdb-rounded-blocks","Gratuit : blocs arrondis"],["custom","Clé RPDB premium"]].map(([v,n])=>`<option value="${v}" ${state.rpdbTheme===v?"selected":""}>${n}</option>`).join("")}
          </select></label>
          <div id="mc-rpdb-key-wrap" ${state.rpdbTheme==="custom"?"":"hidden"}>${field("rpdb","Clé RPDB premium","rpdbKey","Clé RPDB")}</div>
        </div>
        <div id="mc-poster-top" ${state.posterProvider==="top"?"":"hidden"}>${field("top","Clé Top Posters","topPosterKey","Clé Top Posters")}</div>
        <div id="mc-poster-bttr" ${state.posterProvider==="bttr"?"":"hidden"}>
          <label class="mc-inline"><input type="checkbox" data-check="bttrQuality" ${state.bttrQuality?"checked":""}> Qualité 4K / Dolby Vision</label>
          <label class="mc-inline"><input type="checkbox" data-check="bttrGenre" ${state.bttrGenre?"checked":""}> Genre</label>
          <label class="mc-inline"><input type="checkbox" data-check="bttrRating" ${state.bttrRating?"checked":""}> Note</label>
          <label class="mc-inline"><input type="checkbox" data-check="bttrAge" ${state.bttrAge?"checked":""}> Classification d'âge</label>
          <div class="mc-import-2col">
          <label>Source des notes<select data-key="bttrSource">${["Average","TM","IM","RT","TR"].map(v=>`<option value="${v}" ${state.bttrSource===v?"selected":""}>${v}</option>`).join("")}</select></label>
          <label>Langue<select data-key="bttrLanguage">${[["fr","Français"],["en","Anglais"],["es","Espagnol"],["de","Allemand"]].map(([v,n])=>`<option value="${v}" ${state.bttrLanguage===v?"selected":""}>${n}</option>`).join("")}</select></label>
          </div>
        </div>
      </div>
      ${state.posterProvider==="bttr" ? `<div class="mc-import-card">
        <strong>Aperçu Bttr en direct</strong>
        <div class="mc-import-art-layout" style="margin-top:12px">
          <img id="mc-bttr-preview" class="mc-import-image" src="${esc(bttrPreviewUrl())}" alt="Aperçu BetterPosters" referrerpolicy="no-referrer">
          <p id="mc-bttr-status" class="mc-import-note">Test avec un film connu. Si l'image ne charge pas, le fournisseur Bttr est peut-être indisponible ; Kovelyx conservera son affiche d'origine lorsqu'un chargement échoue.</p>
        </div></div>` : "" }
    if (state.step === 4) return `<p class="mc-import-note">AllDebrid en priorité et Real-Debrid en secours, selon les possibilités de vos extensions. Les clés ne sont jamais intégrées au JSON public des catalogues.</p>
      <div class="mc-import-form">
        ${field("ad","Clé API AllDebrid (prioritaire)","allDebridKey","Clé AllDebrid")}
        ${field("rd","Clé API Real-Debrid (secondaire)","realDebridKey","Clé Real-Debrid")}
        <label>Priorité<select id="mc-debrid-priority" data-key="preferredDebridProvider">
          <option value="alldebrid" ${state.preferredDebridProvider==="alldebrid"?"selected":""}>AllDebrid d'abord</option>
          <option value="realdebrid" ${state.preferredDebridProvider==="realdebrid"?"selected":""}>Real-Debrid d'abord</option>
        </select></label>
      </div><p class="mc-import-note">Kovelyx PC peut enregistrer Real-Debrid via son intégration native ; AllDebrid s'utilise via une extension compatible (Torrentio, etc.) et doit être configuré dans cette extension. Pour Nuvio, l'assistant de connexion poursuit la configuration de ces extensions.</p>`;
    if (state.step === 5) return `<div class="mc-import-card"><strong>Extensions configurées</strong>
        <p>Collez uniquement les URL HTTPS complètes de vos extensions déjà configurées : Torrentio, Comet, MediaFusion ou autres. Une URL générique ne contient pas nécessairement vos réglages.</p></div>
        <div class="mc-import-form"><label>Manifests personnels (un par ligne)
        <textarea id="mc-addon-manifests" data-key="addonManifests" rows="5" spellcheck="false" autocomplete="off" placeholder="https://votre-instance.exemple/config/manifest.json">${esc(state.addonManifests)}</textarea></label></div>
        <p class="mc-import-note">Kovelyx proposera d’installer les extensions dans le profil actif, après confirmation. Un manifest inaccessible doit être corrigé manuellement. Nuvio poursuivra la configuration dans son assistant.</p>`;
    if (state.step === 6 && state.destination === "kovelyx") {
      const count = Object.keys(state.artwork).length;
      return `<div class="mc-import-card"><strong>Destination Kovelyx PC</strong>
        <p>${selected.length} catégories • ${rows.length} dossiers • ${count} affiche(s) personnalisée(s).</p>
        <p>Les réglages seront transmis uniquement à votre application locale ; aucun mot de passe de compte n'est demandé par le site.</p></div>
        <div class="mc-import-form">
          <label>Comment souhaitez-vous importer ?
            <select id="mc-import-mode" data-key="importMode">
              <option value="local" ${state.importMode==="local"?"selected":""}>Sans compte — profil local actif</option>
              <option value="account" ${state.importMode==="account"?"selected":""}>Avec mon compte Kovelyx — choisir un profil synchronisé</option>
            </select>
          </label>
          <p class="mc-import-note">Avec compte : identifiez-vous directement dans Kovelyx, jamais sur ce site. Kovelyx affichera les profils accessibles avant toute modification.</p>
          <label>Que faire des collections existantes ?
            <select id="mc-import-action" data-key="importAction">
              <option value="replace" ${state.importAction==="replace"?"selected":""}>Remplacer toute l'ancienne collection (sauvegarde avant)</option>
              <option value="merge" ${state.importAction==="merge"?"selected":""}>Conserver l'existant et ajouter les nouvelles catégories/dossiers</option>
            </select>
          </label>
          <p class="mc-import-note">Le remplacement n'est exécuté qu'après confirmation explicite dans Kovelyx. Une sauvegarde JSON du profil ciblé sera créée.</p>
        </div>`;
    }
    const nArtwork = Object.keys(state.artwork).length;
    return `<div class="mc-import-card"><strong>Vérification avant import</strong>
      <p>Destination : <strong>${state.destination==="kovelyx"?"Kovelyx PC":"Nuvio"}</strong></p>
      <p>Catalogues : ${selected.length} catégories / ${rows.length} dossiers</p>
      <p>Affiches personnalisées : ${nArtwork} dossier(s)</p>
      <p>TMDB : ${state.tmdbKey?"clé saisie":"non renseignée"} • MDBList : ${state.mdblistKey?"clé saisie":"non renseignée"}</p>
      <p>Affiches notées : ${esc(state.posterProvider==="none"?"désactivées":state.posterProvider.toUpperCase())}</p>
      <p>AllDebrid : ${state.allDebridKey?"clé saisie":"non renseignée"} • Real-Debrid : ${state.realDebridKey?"clé saisie":"non renseignée"}</p>
      <p>Extensions : ${state.addonManifests.split(/\r?\n/).filter(x=>x.trim()).length}</p></div>
      <p class="mc-import-note">${state.destination==="kovelyx"?
        "L'étape suivante transmet les catalogues à Kovelyx PC, puis exige votre confirmation dans l'application. Les clés compatibles ne s'installent qu'avec la nouvelle version de Kovelyx ; le téléchargement JSON n'inclut aucune clé.":
        "L'étape suivante ouvre l'assistant Nuvio : connexion, choix du profil, placement des rangées, configuration des extensions et confirmation."}</p>`;
  }
  function bind() {
    const keyControls = current().querySelectorAll("[data-key]");
    keyControls.forEach(input => {
      const update = () => { state[input.dataset.key] = input.value; if (["posterProvider","rpdbTheme"].includes(input.dataset.key)) draw(); else if (["bttrSource","bttrLanguage"].includes(input.dataset.key)) updateBttrPreview(); };
      input.addEventListener("change", update);
      if (input.tagName === "INPUT" || input.tagName === "TEXTAREA") input.addEventListener("input", update);
    });
    current().querySelectorAll("[data-check]").forEach(input => input.addEventListener("change", () => { state[input.dataset.check] = input.checked; updateBttrPreview(); }));
    const testerNames = {
      tmdb:"testTmdbKeyLive", mdblist:"testMdblistKeyLive",
      ad:"testAllDebridKeyLive", rd:"testRealDebridKeyLive"
    };
    current().querySelectorAll("[data-keytest]").forEach(button => button.addEventListener("click", async () => {
      const id = button.dataset.keytest, value = byId("mc-"+id)?.value.trim();
      const label = byId("mc-keytest-"+id);
      const fn = window.NuvioWizard?.[testerNames[id]];
      if (!label) return;
      if (!value) { label.textContent = "Renseignez une clé."; return; }
      if (typeof fn !== "function") { label.textContent = "Vérification indisponible."; return; }
      button.disabled=true;
      label.textContent="Vérification…";
      try {
        const result = await fn(value);
        label.textContent=result.ok ? "✓ Clé acceptée par le service." :
          result.unreachable ? "Serveur injoignable : résultat indéterminé." : "Clé refusée par le service.";
      } catch (_) { label.textContent="Service injoignable : résultat indéterminé."; }
      finally { button.disabled=false; }
    }));
    byId("mc-bttr-preview")?.addEventListener("load", () => { const label=byId("mc-bttr-status"); if(label) label.textContent="Aperçu reçu depuis BetterPosters."; });
    byId("mc-bttr-preview")?.addEventListener("error", () => { const label=byId("mc-bttr-status"); if(label) label.textContent="Impossible de charger l’aperçu Bttr. Vérifiez la disponibilité du fournisseur. L’import des catalogues reste possible."; });
    byId("mc-edit-collections")?.addEventListener("click", () => {
      close();
      if (typeof window.startCustomize !== "function") return;
      window.__maCollectionAfterCustomize = () => open(state.destination, state.onFinish, false);
      window.startCustomize();
    });
    byId("mc-pick-folder")?.addEventListener("change", e => { state.selectedFolder = e.target.value; draw(); });
    const rows = folders();
    const item = rows.find(r => r.key === state.selectedFolder) || rows[0];
    if (item) {
      const mapping = [["mc-art-cover","coverImageUrl"],["mc-art-logo","titleLogoUrl"],["mc-art-backdrop","heroBackdropUrl"],["mc-art-shape","tileShape"]];
      mapping.forEach(([id,key]) => byId(id)?.addEventListener("change", e => {
        try {
          const custom = { ...(state.artwork[item.key] || {}) };
          custom[key] = key==="tileShape" ? e.target.value : validUrl(e.target.value.trim());
          if (!Object.values(custom).some(Boolean)) delete state.artwork[item.key];
          else state.artwork[item.key] = custom;
          const preview = byId("mc-art-preview");
          if (preview && key==="coverImageUrl") preview.src = custom.coverImageUrl || item.folder.coverImageUrl || "";
          byId("mc-import-error").textContent = "";
        } catch (error) { byId("mc-import-error").textContent=error.message; e.target.focus(); }
      }));
      byId("mc-art-reset")?.addEventListener("click", () => { delete state.artwork[item.key]; draw(); });
    }
  }
  function draw() {
    selected = getSelected();
    const panel = current();
    panel.innerHTML = `<div class="mc-import-head"><div><h2 id="mc-import-title">${state.destination==="kovelyx"?"🟣 Kovelyx":"📺 Nuvio"} — Personnaliser</h2>
      <p>Étape ${state.step+1} sur ${STEPS.length} · ${STEPS[state.step]}</p></div><button type="button" class="mc-import-close" id="mc-import-close" aria-label="Fermer">×</button></div>
      <div class="mc-import-progress" aria-label="Progression">${STEPS.map((_,i)=>`<span class="${i<=state.step?"active":""}"></span>`).join("")}</div>
      ${stepHtml()}
      <p id="mc-import-error" class="mc-import-error" role="alert"></p>
      <div class="mc-import-actions">
        <button class="secondary" id="mc-import-back" type="button">${state.step?"← Retour":"Annuler"}</button>
        <button class="primary" id="mc-import-next" type="button">${state.step===STEPS.length-1?"Continuer vers "+(state.destination==="kovelyx"?"Kovelyx":"Nuvio")+" →":"Continuer →"}</button>
      </div>`;
    byId("mc-import-close").onclick=close;
    byId("mc-import-back").onclick=() => { if (state.step) { state.step--; draw(); } else close(); };
    byId("mc-import-next").onclick=() => {
      if (state.step===1) {
        for (const obj of Object.values(state.artwork)) {
          for (const key of ["coverImageUrl","titleLogoUrl","heroBackdropUrl"]) {
            if (obj[key]) try { validUrl(obj[key]); } catch(e) { byId("mc-import-error").textContent=e.message; return; }
          }
        }
      }
      if (state.step===5) {
        const urls = state.addonManifests.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
        if (urls.length > 15 || urls.some(value => {
          try { const url=new URL(value); return url.protocol!=="https:" || !!url.username || !!url.password ||
            !url.pathname.endsWith("/manifest.json") || value.length>2048; }
          catch (_) { return true; }
        })) {
          byId("mc-import-error").textContent="15 extensions maximum : utilisez des URL HTTPS personnelles se terminant par /manifest.json.";
          return;
        }
      }
      if (state.step<STEPS.length-1) { state.step++; draw(); return; }
      if (!folders().length) { byId("mc-import-error").textContent="Sélectionnez au moins un dossier."; return; }
      const done = state.onFinish, payload = settings();
      close();
      if (typeof done==="function") done(payload);
    };
    bind();
  }
  function open(destination, onFinish, reset=true) {
    state.destination = destination==="nuvio"?"nuvio":"kovelyx";
    state.onFinish = onFinish;
    if (reset) state.step = 0;
    node.hidden = false;
    draw();
    byId("mc-import-close")?.focus();
  }
  function close() { node.hidden = true; }
  node.addEventListener("click", e => { if (e.target===node) close(); });
  document.addEventListener("keydown", e => { if (e.key==="Escape" && !node.hidden) { e.stopPropagation(); close(); } },true);
  window.MaCollectionImportStudio = Object.freeze({ open, close, decorateCollections, getSettings:settings });
})();