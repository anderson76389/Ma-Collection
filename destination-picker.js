/* Sélection de destination puis configuration complète, sans double écran guidé. */
(() => {
  "use strict";
  const el=id=>document.getElementById(id);
  const overlay=el("destination-overlay");
  if(!overlay)return;
  let pendingNuvio=null;
  function close(){overlay.hidden=true;pendingNuvio=null;}
  function open(options={}){
    pendingNuvio=typeof options.onNuvio==="function"
      ?options.onNuvio
      :()=>window.NuvioWizard?.open(options.nuvioOptions||{});
    overlay.hidden=false;
    el("destination-kovelyx")?.focus();
  }
  function start(target) {
    const onNuvio=pendingNuvio;
    close();
    if(el("simple-editor-overlay")?.classList.contains("open") &&
      typeof window.seGatherSettings==="function")window.seGatherSettings();
    const proceed=settings=>{
      if(target==="nuvio"){
        // Read once by NuvioWizard.open, after its defaults and encrypted vault.
        window.__maCollectionPendingImportSettings=settings;
        if(onNuvio)onNuvio();
        else window.NuvioWizard?.open({skipChoose:true});
      } else {
        window.MaCollectionKovelyx?.configure(settings);
        window.MaCollectionKovelyx?.open();
      }
    };
    if(window.MaCollectionImportStudio?.open)window.MaCollectionImportStudio.open(target,proceed);
    else proceed({});
  }
  el("destination-nuvio")?.addEventListener("click",()=>start("nuvio"));
  el("destination-kovelyx")?.addEventListener("click",()=>start("kovelyx"));
  el("destination-cancel")?.addEventListener("click",close);
  overlay.addEventListener("click",e=>{if(e.target===overlay)close();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!overlay.hidden)close();});
  window.MaCollectionDestination=Object.freeze({open,close});
})();