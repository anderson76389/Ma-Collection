/* Ma-Collection — Configuration commune avant import Nuvio / Kovelyx.
   Les clés restent en mémoire pendant la session de configuration :
   aucun localStorage, cookie ni journal pour ces secrets. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[c]);
  let step = 0;
  let destination = "kovelyx";
  let onDone = null;
  let active = false;
  let values = {};
  const steps = ["Métadonnées", "Affiches", "Débridage et extensions", "Vérification"];
  const css = document.createElement("style");
  css.textContent = [
    ".mcis-overlay[hidden]{display:none!important}",
    ".mcis-overlay{position:fixed;inset:0;z-index:40000;background:rgba(6,6,18,.88);display:flex;align-items:center;justify-content:center;padding:15px;overflow-y:auto}",
    ".mcis-box{background:#171523;color:#f7f5ff;width:min(750px,100%);max-height:92vh;overflow-y:auto;border-radius:20px;border:1px solid #65528f;padding:24px;box-shadow:0 25px 85px #000a;font-family:inherit}",
    ".mcis-box h2{margin:0 0 7px;font-size:1.35rem}.mcis-box h3{margin:6px 0 12px;font-size:1.1rem}",
    ".mcis-muted{font-size:.92rem;color:#bdb5d7;line-height:1.5}.mcis-steps{display:flex;gap:5px;flex-wrap:wrap;margin:18px 0}",
    ".mcis-steps span{background:#242138;border-radius:8px;padding:8px;font-size:.78rem;color:#aaa4bd;flex:1;text-align:center;min-width:100px}",
    ".mcis-steps span.mcis-current{color:white;background:#6544af}",
    ".mcis-page[hidden]{display:none!important}.mcis-field{display:block;margin:13px 0;color:#e5e1ee;font-weight:600;font-size:.9rem}",
    ".mcis-field input,.mcis-field select,.mcis-field textarea{display:block;box-sizing:border-box;width:100%;margin-top:6px;background:#242136;color:white;border:1px solid #504469;border-radius:10px;padding:12px;font:inherit;font-weight:400}",
    ".mcis-field input:focus,.mcis-field select:focus,.mcis-field textarea:focus{outline:2px solid #9870fa}",
    ".mcis-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 14px}",
    ".mcis-buttons{display:flex;gap:10px;justify-content:flex-end;margin-top:19px;flex-wrap:wrap}",
    ".mcis-buttons button{cursor:pointer;border:1px solid #75668f;background:#2f2944;color:#fff;padding:11px 17px;border-radius:10px;font:inherit}",
    ".mcis-buttons button.mcis-primary{background:#754cc4;border-color:#754cc4;font-weight:700}",
    ".mcis-preview{min-height:150px;display:flex;align-items:center;gap:18px;margin:12px 0}.mcis-preview img{height:155px;width:104px;object-fit:cover;border-radius:8px;background:#282338}",
    ".mcis-error{color:#ffa7a7;margin-top:10px;min-height:1em}.mcis-tip{border-left:3px solid #7f5ac8;padding:9px 12px;background:#272239;border-radius:6px}",
    ".mcis-overlay input[type=checkbox]{width:auto;display:inline;margin-right:8px}",
    "@media(max-width:500px){.mcis-box{padding:16px}.mcis-steps span{min-width:70px;font-size:.7rem}}"
  ].join("");
  document.head.appendChild(css);
  const overlay = document.createElement("div");
  overlay.className = "mcis-overlay";
  overlay.hidden = true;
  overlay.id = "ma-import-settings-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "mcis-title");
  overlay.innerHTML = [
    '<section class="mcis-box"><h2 id="mcis-title">Personnaliser mon import</h2>',
    '<p class="mcis-muted" id="mcis-subtitle"></p><div class="mcis-steps" id="mcis-steps"></div>',
    '<div class="mcis-page" data-step="0"><h3>Clés et métadonnées</h3>',
    '<p class="mcis-muted">Laissez un champ vide pour conserver sa configuration actuelle. Les clés ne sont pas enregistrées sur le site.</p>',
    '<div class="mcis-grid"><label class="mcis-field">Clé API TMDB<input id="mcis-tmdb" type="password" autocomplete="off" spellcheck="false"></label>',
    '<label class="mcis-field">Clé API MDBList<input id="mcis-mdblist" type="password" autocomplete="off" spellcheck="false"></label></div>',
    '<p class="mcis-muted mcis-tip">Trakt : la connexion au compte se fait par l’autorisation OAuth dans Nuvio ou Kovelyx. Le site ne demande pas votre mot de passe Trakt.</p>',
    '<p class="mcis-muted">Les clés restent facultatives. Les catalogues nécessitant une extension doivent avoir cette extension installée et configurée.</p></div>',
    '<div class="mcis-page" data-step="1" hidden><h3>Personnalisation des affiches</h3>',
    '<label class="mcis-field">Fournisseur d’affiches<select id="mcis-poster">',
    '<option value="keep">Conserver les affiches et réglages existants</option>',
    '<option value="original">Affiches d’origine (TMDB, sans superposition)</option>',
    '<option value="rpdb">RPDB — affiches avec notes</option>',
    '<option value="custom">Adresse d’affiche personnalisée</option></select></label>',
    '<div id="mcis-rpdb-fields" hidden><label class="mcis-field">Thème RPDB<select id="mcis-rpdb-theme">',
    '<option value="t0-free-rpdb">Gratuit — bande sombre</option>',
    '<option value="t0-free-rpdb-blocks">Gratuit — blocs</option>',
    '<option value="t0-free-rpdb-rounded-blocks">Gratuit — blocs arrondis</option>',
    '<option value="custom">Clé RPDB personnelle</option></select></label>',
    '<label class="mcis-field" id="mcis-rpdb-secret-field" hidden>Clé RPDB<input id="mcis-rpdb-key" type="password" autocomplete="off"></label></div>',
    '<label class="mcis-field" id="mcis-custom-field" hidden>URL du modèle d’affiche',
    '<input id="mcis-custom-url" type="text" spellcheck="false" autocomplete="off" placeholder="https://exemple.com/poster/{imdb_id}.jpg"></label>',
    '<p class="mcis-muted">Variables acceptées par Kovelyx : {imdb_id}, {tmdb_id}, {type}, {id}. Si un titre n’a pas d’identifiant compatible, son affiche normale reste utilisée.</p>',
    '<div class="mcis-preview"><img id="mcis-preview-img" alt="Aperçu d’une affiche" referrerpolicy="no-referrer">',
    '<div class="mcis-muted" id="mcis-preview-desc">Sélectionnez un fournisseur pour voir un exemple. L’aperçu nécessite un accès au service choisi.</div></div></div>',
    '<div class="mcis-page" data-step="2" hidden><h3>Débridage et extensions</h3>',
    '<p class="mcis-muted">AllDebrid est prioritaire ; Real-Debrid peut servir d’alternative. Ne renseignez que les comptes que vous utilisez.</p>',
    '<div class="mcis-grid"><label class="mcis-field">Clé AllDebrid<input id="mcis-alldebrid" type="password" autocomplete="off"></label>',
    '<label class="mcis-field">Clé Real-Debrid<input id="mcis-realdebrid" type="password" autocomplete="off"></label></div>',
    '<label class="mcis-field">Service préféré<select id="mcis-debrid-preference">',
    '<option value="alldebrid">1. AllDebrid</option><option value="realdebrid">2. Real-Debrid</option></select></label>',
    '<label class="mcis-field">Extensions déjà configurées (URL de manifest HTTPS, une par ligne)',
    '<textarea id="mcis-addons" rows="3" spellcheck="false" placeholder="https://votre-extension.exemple/configuration/manifest.json"></textarea></label>',
    '<p class="mcis-muted mcis-tip">Une extension non configurée n’obtient pas automatiquement votre clé de débridage. Utilisez son URL personnelle. Dans Kovelyx, les extensions saisies seront ajoutées après validation de l’import ; un serveur inaccessible sera signalé.</p></div>',
    '<div class="mcis-page" data-step="3" hidden><h3>Vérifier et importer</h3>',
    '<div id="mcis-summary" class="mcis-muted"></div>',
    '<p class="mcis-muted mcis-tip" id="mcis-warning"></p></div>',
    '<p class="mcis-error" id="mcis-error" role="alert"></p>',
    '<div class="mcis-buttons"><button id="mcis-cancel" type="button">Annuler</button>',
    '<button id="mcis-back" type="button">Précédent</button>',
    '<button class="mcis-primary" id="mcis-next" type="button">Suivant</button></div></section>'
  ].join("");
  document.body.appendChild(overlay);

  const defaults = () => ({
    tmdbKey:"", mdblistKey:"", allDebridKey:"", realDebridKey:"",
    posterProvider:"keep", rpdbTheme:"t0-free-rpdb", rpdbKey:"",
    customPosterUrl:"", preferredDebridProvider:"alldebrid", addonManifests:[]
  });

  function capture() {
    values = {
      tmdbKey:$("mcis-tmdb").value.trim(),
      mdblistKey:$("mcis-mdblist").value.trim(),
      allDebridKey:$("mcis-alldebrid").value.trim(),
      realDebridKey:$("mcis-realdebrid").value.trim(),
      posterProvider:$("mcis-poster").value,
      rpdbTheme:$("mcis-rpdb-theme").value,
      rpdbKey:$("mcis-rpdb-key").value.trim(),
      customPosterUrl:$("mcis-custom-url").value.trim(),
      preferredDebridProvider:$("mcis-debrid-preference").value,
      addonManifests:$("mcis-addons").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)
    };
  }
  function validate() {
    const v=values;
    if (v.posterProvider === "rpdb" && v.rpdbTheme === "custom" && !v.rpdbKey)
      throw Error("Renseignez votre clé RPDB, ou choisissez un thème gratuit.");
    if (v.posterProvider === "custom" && !isSafeHttps(v.customPosterUrl))
      throw Error("Indiquez une URL HTTPS valide pour les affiches personnalisées.");
    if (v.addonManifests.length > 15 || v.addonManifests.some(x=>!isSafeHttps(x)))
      throw Error("Maximum 15 extensions ; chaque manifest doit avoir une URL HTTPS valide.");
    if (v.addonManifests.some(x=>!/^https:\/\/.+\/manifest\.json(?:[?#].*)?$/i.test(x)))
      throw Error("Chaque extension doit fournir son URL complète se terminant par manifest.json.");
    for (const key of ["tmdbKey","mdblistKey","allDebridKey","realDebridKey","rpdbKey"])
      if (v[key].length > 500) throw Error("La clé saisie est trop longue : " + key);
  }
  function isSafeHttps(value) {
    try { const u=new URL(value); return u.protocol==="https:" && !!u.hostname && !u.username && !u.password; }
    catch(_){ return false; }
  }
  function posterPattern(v) {
    if (v.posterProvider === "original") return "";
    if (v.posterProvider === "custom") return v.customPosterUrl;
    if (v.posterProvider === "rpdb") {
      const theme = v.rpdbTheme === "custom" ? v.rpdbKey : v.rpdbTheme;
      return "https://api.ratingposterdb.com/" + encodeURIComponent(theme) + "/imdb/poster-default/{imdb_id}.jpg";
    }
    return null;
  }
  function updatePosterFields() {
    const mode=$("mcis-poster").value, theme=$("mcis-rpdb-theme").value;
    $("mcis-rpdb-fields").hidden=mode!=="rpdb";
    $("mcis-rpdb-secret-field").hidden=theme!=="custom";
    $("mcis-custom-field").hidden=mode!=="custom";
    const v={posterProvider:mode,rpdbTheme:theme,rpdbKey:$("mcis-rpdb-key").value,
      customPosterUrl:$("mcis-custom-url").value};
    const pattern=posterPattern(v);
    const url=pattern && pattern.replace(/\{imdb_id\}/g,"tt0137523")
      .replace(/\{tmdb_id\}/g,"550").replace(/\{type\}/g,"movie").replace(/\{id\}/g,"tt0137523");
    const img=$("mcis-preview-img");
    img.hidden=!url;
    img.removeAttribute("src");
    if (url && isSafeHttps(url)) img.src=url;
    $("mcis-preview-desc").textContent=url
      ? "Exemple avec Fight Club (1999). L’aperçu dépend de la disponibilité du fournisseur."
      : "Vos affiches actuelles seront " + (mode==="original"?"réinitialisées à la source d’origine.":"conservées.");
  }
  function update() {
    const pages=overlay.querySelectorAll(".mcis-page");
    pages.forEach((p,i)=>p.hidden=i!==step);
    $("mcis-steps").innerHTML=steps.map((s,i)=>'<span class="'+(i===step?"mcis-current":"")+'">'+escapeHtml(s)+'</span>').join("");
    $("mcis-back").hidden=step===0;
    $("mcis-next").textContent=step===3
      ? (destination==="kovelyx" ? "Préparer l’import Kovelyx" : "Continuer vers Nuvio")
      : "Suivant";
    $("mcis-error").textContent="";
    if (step===1) updatePosterFields();
    if (step===3) {
      capture();
      const labels=[
        ["TMDB",!!values.tmdbKey],["MDBList",!!values.mdblistKey],
        ["AllDebrid",!!values.allDebridKey],["Real-Debrid",!!values.realDebridKey]
      ];
      $("mcis-summary").innerHTML=[
        "<p><strong>Destination :</strong> "+escapeHtml(destination==="kovelyx"?"Kovelyx":"Nuvio")+"</p>",
        "<p><strong>Clés fournies :</strong> "+labels.map(x=>escapeHtml(x[0])+(x[1]?" ✓":" — inchangé")).join(", ")+"</p>",
        "<p><strong>Affiches :</strong> "+escapeHtml(values.posterProvider)+"</p>",
        "<p><strong>Extensions supplémentaires :</strong> "+values.addonManifests.length+"</p>"
      ].join("");
      $("mcis-warning").textContent=destination==="kovelyx"
        ? "Kovelyx demandera confirmation avant de remplacer les catalogues du profil actif et d’appliquer ces réglages. Le JSON classique reste téléchargeable, mais seul l’envoi direct transmet aussi les réglages."
        : "Nuvio vous demandera ensuite de choisir un profil et de terminer son assistant. Les réglages saisis seront préremplis ; l’authentification Trakt reste indépendante.";
    }
  }
  function cancel() {
    overlay.hidden=true; active=false; onDone=null; values=defaults();
    for (const id of ["mcis-tmdb","mcis-mdblist","mcis-alldebrid","mcis-realdebrid","mcis-rpdb-key","mcis-custom-url","mcis-addons"])
      $(id).value="";
  }
  function open(target, next) {
    if (active) return;
    destination=target==="nuvio"?"nuvio":"kovelyx";
    onDone=typeof next==="function"?next:null;
    active=true;step=0;values=defaults();
    $("mcis-subtitle").textContent="Étapes communes — "+(destination==="kovelyx"?"Kovelyx PC":"Nuvio")+" • Personnalisez avant d’importer.";
    $("mcis-poster").value="keep";
    $("mcis-rpdb-theme").value="t0-free-rpdb";
    $("mcis-debrid-preference").value="alldebrid";
    overlay.hidden=false;update();$("mcis-tmdb").focus();
  }
  $("mcis-poster").addEventListener("change",updatePosterFields);
  $("mcis-rpdb-theme").addEventListener("change",updatePosterFields);
  $("mcis-rpdb-key").addEventListener("input",updatePosterFields);
  $("mcis-custom-url").addEventListener("input",updatePosterFields);
  $("mcis-cancel").addEventListener("click",cancel);
  $("mcis-back").addEventListener("click",()=>{capture();if(step>0) step--;update();});
  $("mcis-next").addEventListener("click",()=>{
    try {
      capture();validate();
      if (step<3){step++;update();return;}
      const finished=Object.assign({},values,{addonManifests:values.addonManifests.slice(),
        posterPattern:posterPattern(values)});
      const callback=onDone;
      overlay.hidden=true;active=false;onDone=null;values=defaults();
      if(callback) callback(finished);
    }catch(e){$("mcis-error").textContent=e.message||"Paramètres invalides.";}
  });
  overlay.addEventListener("click",e=>{if(e.target===overlay)cancel();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape" && active){e.stopImmediatePropagation();cancel();}});
  window.MaCollectionImportSetup=Object.freeze({open,cancel,isSafeHttps,posterPattern});
})();
