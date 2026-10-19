/* Sélection explicite Nuvio ou Kovelyx pour l'import des catalogues.
 * Kovelyx conserve son pont local et l'assistant déjà fonctionnels.
 * Nuvio reçoit un JSON (copie/téléchargement) ; aucun compte ni serveur tiers contacté.
 */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const chooser = document.createElement("div");
  chooser.id = "mc-destinations";
  chooser.hidden = true;
  chooser.className = "quick-push-overlay";
  chooser.setAttribute("role", "dialog");
  chooser.setAttribute("aria-modal", "true");
  chooser.setAttribute("aria-labelledby", "mc-destinations-title");
  chooser.innerHTML = `<div class="quick-push-panel mc-destinations-panel">
    <div class="mc-destinations-head">
      <h2 id="mc-destinations-title">Où importer vos catalogues ?</h2>
      <button type="button" id="mc-destinations-close" aria-label="Fermer">×</button>
    </div>
    <p>Votre sélection et votre personnalisation sont conservées. Choisissez l'application destinataire.</p>
    <div class="mc-destinations-grid">
      <button type="button" id="mc-choice-kovelyx" class="mc-destination-card">
        <strong>🟣 Kovelyx</strong>
        <span>Importer sur Kovelyx PC, via le pont local avec confirmation dans l'application.</span>
      </button>
      <button type="button" id="mc-choice-nuvio" class="mc-destination-card">
        <strong>🔵 Nuvio</strong>
        <span>Préparer le fichier JSON compatible, puis le copier ou le télécharger pour l'importer dans Nuvio.</span>
      </button>
    </div>
    <p class="mc-destinations-caption">L'export Nuvio n'envoie aucun identifiant ni clé API vers un serveur distant.</p>
  </div>`;
  document.body.appendChild(chooser);
  const result = document.createElement("div");
  result.id = "mc-nuvio-export";
  result.hidden = true;
  result.className = "quick-push-overlay";
  result.setAttribute("role", "dialog");
  result.setAttribute("aria-modal", "true");
  result.setAttribute("aria-labelledby", "mc-nuvio-export-title");
  result.innerHTML = `<div class="quick-push-panel mc-destinations-panel">
    <div class="mc-destinations-head">
      <h2 id="mc-nuvio-export-title">🔵 Exporter vers Nuvio</h2>
      <button type="button" id="mc-nuvio-close" aria-label="Fermer">×</button>
    </div>
    <p>Le fichier contient vos catégories, sous-catégories, sources et affiches personnalisées.</p>
    <p class="mc-destinations-caption">Nuvio doit proposer l'import JSON sur votre version. L'installation dans le compte et les clés API se configurent dans Nuvio : elles ne sont pas envoyées ni incluses dans ce fichier.</p>
    <div class="mc-nuvio-actions">
      <button type="button" id="mc-nuvio-copy" class="mc-nuvio-primary">Copier le JSON</button>
      <button type="button" id="mc-nuvio-download" class="mc-nuvio-primary">Télécharger le JSON</button>
    </div>
    <p id="mc-nuvio-export-status" role="status" aria-live="polite"></p>
  </div>`;
  document.body.appendChild(result);
  const css=document.createElement("style");
  css.textContent=`
    #mc-destinations[hidden], #mc-nuvio-export[hidden]{display:none!important}
    #mc-destinations, #mc-nuvio-export {z-index:11020}
    .mc-destinations-panel{width:min(680px,calc(100vw - 28px));max-width:680px;padding:24px;text-align:left}
    .mc-destinations-head{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .mc-destinations-head h2{margin:0;font-size:1.4rem;color:var(--text-primary,#f7f7ff)}
    .mc-destinations-head button{border:1px solid #aaa6;border-radius:9px;background:transparent;color:inherit;font-size:1.3rem;cursor:pointer;padding:3px 11px}
    .mc-destinations-panel p{color:var(--text-muted,#c2bfd2);line-height:1.55}
    .mc-destinations-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin:20px 0}
    .mc-destination-card{display:flex;flex-direction:column;gap:13px;text-align:left;min-height:142px;border:1px solid #a78bfa66;
      background:rgba(120,100,190,.10);border-radius:16px;padding:21px 17px;color:inherit;cursor:pointer}
    .mc-destination-card:hover,.mc-destination-card:focus-visible{outline:2px solid #a78bfa;outline-offset:2px;background:rgba(120,100,190,.19)}
    .mc-destination-card strong{font-size:1.25rem}
    .mc-destination-card span{font-size:.92rem;line-height:1.45}
    .mc-destinations-caption{font-size:.84rem}
    .mc-nuvio-actions{display:flex;flex-wrap:wrap;gap:12px;margin:22px 0 12px}
    .mc-nuvio-primary{border:1px solid #a78bfa;background:#7751b8;color:#fff;border-radius:10px;padding:12px 18px;cursor:pointer;font-weight:650}
    .mc-nuvio-primary:disabled{opacity:.55;cursor:wait}
    #mc-nuvio-export-status[data-error="true"]{color:#ffb4b4}
    @media(max-width:560px){.mc-destinations-grid{grid-template-columns:1fr}.mc-destinations-panel{padding:16px}}
    @media(prefers-reduced-motion:reduce){.mc-destination-card{transition:none}}
  `;
  document.head.appendChild(css);

  let lastFocus=null;
  let nuvioSettings=null;
  function closeChoice() {
    chooser.hidden=true;
    if (!result.hidden) return;
    if (lastFocus && lastFocus.isConnected && typeof lastFocus.focus==="function") lastFocus.focus();
  }
  function closeNuvio() {
    result.hidden=true;
    if (lastFocus && lastFocus.isConnected && typeof lastFocus.focus==="function") lastFocus.focus();
  }
  function collectFromEditor() {
    if (byId("simple-editor-overlay")?.classList.contains("open") &&
        typeof window.seGatherSettings==="function") window.seGatherSettings();
  }
  function open() {
    collectFromEditor();
    lastFocus=document.activeElement;
    result.hidden=true;
    chooser.hidden=false;
    byId("mc-choice-kovelyx")?.focus();
  }
  function startKovelyx() {
    chooser.hidden=true;
    // Parcours inchangé : Import Studio -> confirmation via pont local.
    const proceed = settings => {
      window.MaCollectionKovelyx?.configure(settings || {});
      window.MaCollectionKovelyx?.open();
    };
    if (window.MaCollectionImportStudio?.open) window.MaCollectionImportStudio.open("kovelyx",proceed);
    else proceed({});
  }
  function startNuvio() {
    chooser.hidden=true;
    const proceed=settings=>{
      nuvioSettings=settings||{};
      result.hidden=false;
      const status=byId("mc-nuvio-export-status");
      if(status){status.textContent="Votre configuration est prête. Copiez ou téléchargez les catalogues pour les importer dans Nuvio.";status.dataset.error="false";}
      byId("mc-nuvio-copy")?.focus();
    };
    if (window.MaCollectionImportStudio?.open) window.MaCollectionImportStudio.open("nuvio",proceed);
    else proceed({});
  }
  // Génération sans secrets. Les réglages de posters personnalisés sont intégrés
  // aux dossiers ; les clés restent uniquement dans l'assistant (mémoire locale).
  async function buildNuvioJSON() {
    const exporter=window.MaCollectionExport;
    if (!exporter?.assembleFilteredDatabase || !exporter?.applyLocaleToCollection)
      throw Error("Moteur d'export indisponible. Actualisez la page.");
    const selected=structuredClone(exporter.assembleFilteredDatabase());
    if (!Array.isArray(selected) || !selected.length) throw Error("Sélectionnez au moins un dossier.");
    const localized=await exporter.applyLocaleToCollection(selected) || selected;
    const customized=window.MaCollectionImportStudio?.decorateCollections?.(localized) || localized;
    if (!Array.isArray(customized) || !customized.some(c => Array.isArray(c.folders) && c.folders.length))
      throw Error("Aucun dossier à exporter.");
    // Sécurité : aucune clé secrète de l'assistant dans les JSON de catalogues.
    return JSON.stringify(customized,null,2);
  }
  async function copyText(text) {
    if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);return;}catch(_){}}
    const area=document.createElement("textarea");area.value=text;area.readOnly=true;
    area.style.cssText="position:fixed;left:-9999px";
    document.body.appendChild(area);
    try{area.select();if(!document.execCommand("copy"))throw Error("Presse-papiers refusé par le navigateur.");}
    finally{area.remove();}
  }
  async function exportAction(kind) {
    const button=byId(kind==="copy"?"mc-nuvio-copy":"mc-nuvio-download");
    const status=byId("mc-nuvio-export-status");
    if(button)button.disabled=true;
    try{
      const json=await buildNuvioJSON();
      if(kind==="copy"){await copyText(json);if(status)status.textContent="JSON copié. Collez-le dans l'import de collections de Nuvio.";}
      else{
        const url=URL.createObjectURL(new Blob([json],{type:"application/json;charset=utf-8"}));
        const link=document.createElement("a");link.href=url;
        link.download="ma_collection_nuvio_fr_"+new Date().toISOString().slice(0,10)+".json";
        document.body.appendChild(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),30000);
        if(status)status.textContent="JSON téléchargé. Importez ce fichier avec la fonction d'import de Nuvio.";
      }
      if(status)status.dataset.error="false";
    }catch(e){if(status){status.textContent=e.message||"Export impossible.";status.dataset.error="true";}}
    finally{if(button)button.disabled=false;}
  }
  byId("mc-destinations-close").addEventListener("click",closeChoice);
  byId("mc-nuvio-close").addEventListener("click",closeNuvio);
  byId("mc-choice-kovelyx").addEventListener("click",startKovelyx);
  byId("mc-choice-nuvio").addEventListener("click",startNuvio);
  byId("mc-nuvio-copy").addEventListener("click",()=>exportAction("copy"));
  byId("mc-nuvio-download").addEventListener("click",()=>exportAction("download"));
  chooser.addEventListener("click",e=>{if(e.target===chooser)closeChoice();});
  result.addEventListener("click",e=>{if(e.target===result)closeNuvio();});
  document.addEventListener("keydown",e=>{
    if(e.key!=="Escape")return;
    if(!result.hidden){e.stopPropagation();closeNuvio();}
    else if(!chooser.hidden){e.stopPropagation();closeChoice();}
  },true);
  document.getElementById("btn-import-kovelyx")?.addEventListener("click",open);
  window.MaCollectionDestination=Object.freeze({
    open,close(){closeChoice();closeNuvio();},
    chooseKovelyx:startKovelyx,chooseNuvio:startNuvio,buildNuvioJSON
  });
})();