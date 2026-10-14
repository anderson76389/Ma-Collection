/* Assistant d'import commun à Kovelyx et Nuvio. Clés gardées en mémoire de session. */
(() => {
  "use strict";
  let overlay, box, step=0, dest="kovelyx", action=null;
  const labels=["Métadonnées","Affiches","Débridage","Extensions","Récapitulatif"];
  const fresh=()=>({tmdbKey:"",mdblistKey:"",poster:"rpdb",theme:"t0-free-rpdb",
    rpdbKey:"",topKey:"",bttrQuality:true,bttrGenre:true,bttrRating:true,
    bttrLanguage:"fr",allDebridKey:"",realDebridKey:"",preferred:"alldebrid",
    torrentio:true,addonLines:"",aio:false});
  let state=fresh();
  const html=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const field=(label,k,placeholder)=>'<label class="wiz-label">'+label+'<input class="wiz-input" type="password" data-field="'+k+'" autocomplete="off" spellcheck="false" placeholder="'+html(placeholder)+'" value="'+html(state[k])+'"></label>';
  const select=(label,k,items)=>'<label class="wiz-label">'+label+'<select data-field="'+k+'" class="wiz-input">'+
    items.map(item=>'<option value="'+html(item[0])+'" '+(state[k]===item[0]?'selected':'')+'>'+html(item[1])+'</option>').join('')+'</select></label>';
  const checkbox=(label,k)=>'<label class="wiz-label"><input type="checkbox" data-field="'+k+'" '+(state[k]?'checked':'')+'> '+label+'</label>';
  const manifestList=()=>[...new Set(state.addonLines.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];
  function posterPattern(){
    if(state.poster==="none")return "";
    if(state.poster==="rpdb"){
      const name=state.theme==="custom"?state.rpdbKey.trim():state.theme;
      return name?"https://api.ratingposterdb.com/"+encodeURIComponent(name)+"/imdb/poster-default/{imdb_id}.jpg":"";
    }
    if(state.poster==="top")return state.topKey.trim()?"https://api.top-posters.com/"+encodeURIComponent(state.topKey.trim())+"/imdb/poster/{imdb_id}.jpg":"";
    const flags=[state.bttrQuality?"quality":"",state.bttrGenre?"genre":"",state.bttrRating?"rating":""].filter(Boolean);
    return "https://btttr.cc/poster"+(flags.length?"-"+flags.join("-"):"")+"/imdb/poster-default/{imdb_id}.jpg";
  }
  function setup(){
    const db=window.MaCollectionDebrid;
    const chosen=db?.select(state,state.preferred);
    const torrentio=chosen&&state.torrentio?db.torrentioManifest({
      resolutions:["r2160p","r1080p","r720p"],removeTrash:true
    },state,state.preferred):null;
    return {
      version:1,tmdbKey:state.tmdbKey.trim(),mdblistKey:state.mdblistKey.trim(),
      poster:{provider:state.poster,pattern:posterPattern(),theme:state.theme,rpdbKey:state.rpdbKey.trim(),
        topKey:state.topKey.trim(),bttrQuality:state.bttrQuality,bttrGenre:state.bttrGenre,
        bttrRating:state.bttrRating,language:state.bttrLanguage},
      debrid:{allDebridKey:state.allDebridKey.trim(),realDebridKey:state.realDebridKey.trim(),preferred:state.preferred},
      addons:[...(torrentio?[{name:torrentio.name,url:torrentio.url}]:[]),...manifestList().map(url=>({name:"Extension personnalisée",url}))],
      aioStreams:state.aio
    };
  }
  function ensureUi(){
    if(overlay)return;
    overlay=document.createElement("div");
    overlay.id="ma-import-wizard";
    overlay.className="quick-push-overlay";
    overlay.hidden=true;
    overlay.setAttribute("role","dialog");
    overlay.setAttribute("aria-modal","true");
    overlay.innerHTML='<div class="quick-push-panel" style="width:min(94vw,650px);max-width:650px;max-height:92vh;overflow-y:auto;text-align:left"><h3 class="quick-push-title" id="ma-import-heading">Personnaliser la collection</h3><div id="ma-import-body"></div></div>';
    overlay.setAttribute("aria-labelledby","ma-import-heading");
    document.body.appendChild(overlay);
    box=document.getElementById("ma-import-body");
    overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
  }
  function close(){if(overlay)overlay.hidden=true;}
  function open(options={}){
    ensureUi();dest=options.destination==="nuvio"?"nuvio":"kovelyx";
    action=typeof options.onNuvio==="function"?options.onNuvio:null;
    state=fresh();
    const fromVault=window.NuvioWizard?.peekVaultFields?.()?.keys||{};
    const fromAccount=window.MaCollectionAccountBridge?.snapshot?.()?.keys||{};
    for(const k of ["tmdbKey","mdblistKey","allDebridKey","realDebridKey"])
      state[k]=fromAccount[k]||fromVault[k]||"";
    step=0;overlay.hidden=false;render();
  }
  function render(){
    let body="";
    if(step===0)body='<p>Renseignez vos clés facultatives. Trakt utilise son autorisation OAuth dans l’application ou AIO Metadata ; aucun faux jeton ne sera ajouté.</p>'+
      field("TMDB — catalogue et affiches","tmdbKey","Clé TMDB v3")+
      field("MDBList — notes et recommandations","mdblistKey","Clé MDBList");
    if(step===1){
      body='<p>Choisissez votre fournisseur d’affiches. Ces réglages peuvent être appliqués au système d’affiches personnalisées de Kovelyx ou à AIO Streams dans Nuvio.</p>'+
        select("Fournisseur","poster",[["none","Affiches classiques"],["rpdb","RPDB"],["bttr","Bttr Posters"],["top","Top Posters"]]);
      if(state.poster==="rpdb")body+=select("Thème RPDB","theme",[
        ["t0-free-rpdb","Gratuit — barre sombre"],["t0-free-rpdb-blocks","Gratuit — blocs"],
        ["t0-free-rpdb-rounded-blocks","Gratuit — blocs arrondis"],["custom","Clé RPDB Premium"]])+
        (state.theme==="custom"?field("Clé Premium RPDB","rpdbKey","Clé RPDB"):"");
      if(state.poster==="top")body+=field("Clé Top Posters","topKey","Clé Top Posters");
      if(state.poster==="bttr")body+=checkbox("Afficher la qualité","bttrQuality")+checkbox("Afficher les genres","bttrGenre")+
        checkbox("Afficher les notes","bttrRating")+select("Langue","bttrLanguage",[["fr","Français"],["en","Anglais"]]);
      const pattern=posterPattern();
      body+=pattern?'<div style="display:flex;gap:14px;align-items:center"><img src="'+html(pattern.replace("{imdb_id}","tt0137523"))+'" alt="Aperçu" style="width:95px;aspect-ratio:2/3;object-fit:cover;border-radius:8px"><p class="wiz-note">Aperçu dépendant du fournisseur.</p></div>':
        '<p class="wiz-note">Les affiches d’origine seront conservées.</p>';
    }
    if(step===2)body='<p>AllDebrid est prioritaire et Real-Debrid est le second choix. Le débridage fonctionne par extension configurée.</p>'+
      field("1. AllDebrid — prioritaire","allDebridKey","Clé API AllDebrid")+
      field("2. Real-Debrid — alternative","realDebridKey","Clé API Real-Debrid")+
      select("Fournisseur pour Torrentio","preferred",[
        ["alldebrid","AllDebrid, sinon Real-Debrid"],["realdebrid","Real-Debrid, sinon AllDebrid"]]);
    if(step===3)body='<p>Les extensions sélectionnées seront installées dans Kovelyx après confirmation, ou proposées dans le parcours Nuvio.</p>'+
      checkbox("Installer Torrentio configuré avec mon service de débridage","torrentio")+
      '<label class="wiz-label">Autres manifests (une URL HTTPS par ligne)<textarea data-field="addonLines" rows="4" class="wiz-input" placeholder="https://exemple.org/manifest.json">'+html(state.addonLines)+'</textarea></label>'+
      checkbox("Parcours avancé AIO Streams dans Nuvio","aio")+
      '<p class="wiz-note">Comet ou MediaFusion nécessitent leur propre manifest déjà configuré. Vos clés ne sont pas publiées dans les fichiers du site.</p>';
    if(step===4){
      const cfg=setup();
      body='<p><strong>Destination :</strong> '+(dest==="kovelyx"?"Kovelyx PC":"Nuvio")+'</p>'+
        '<p><strong>Affiches :</strong> '+html(state.poster.toUpperCase())+'</p>'+
        '<p><strong>Clés :</strong> TMDB '+(state.tmdbKey?"renseignée":"vide")+', MDBList '+(state.mdblistKey?"renseignée":"vide")+'</p>'+
        '<p><strong>Débridage :</strong> '+html(state.preferred)+'</p>'+
        '<p><strong>Extensions :</strong> '+cfg.addons.length+'</p>'+
        '<p class="wiz-note">'+(dest==="kovelyx"?
          "Kovelyx doit être à jour pour importer le paquet de réglages. L’application demandera confirmation avant toute modification.":
          "L’assistant Nuvio poursuivra les étapes de compte, profil, Trakt, affiches, extensions et AIO Streams.")+'</p>';
    }
    box.innerHTML='<p class="wiz-note">Étape '+(step+1)+' sur 5 — '+labels[step]+' · '+(dest==="kovelyx"?"Kovelyx":"Nuvio")+'</p>'+
      '<div style="display:flex;gap:5px;margin:10px 0 18px">'+labels.map((_,i)=>'<span style="height:4px;flex:1;border-radius:4px;background:'+(i<=step?'var(--accent,#8b5cf6)':'#666')+'"></span>').join('')+'</div>'+
      '<div style="min-height:190px">'+body+'</div><p id="ma-import-error" role="alert" style="color:#fda4af;display:none"></p>'+
      '<div class="quick-push-actions" style="display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px">'+
      '<button type="button" class="quick-push-btn-secondary" id="ma-import-cancel">Annuler</button>'+
      (step?'<button type="button" class="quick-push-btn-secondary" id="ma-import-back">← Retour</button>':'')+
      '<button type="button" class="quick-push-btn-primary" id="ma-import-next">'+(step===4?'Importer':'Continuer →')+'</button></div>';
    box.querySelector("#ma-import-cancel").addEventListener("click",close);
    box.querySelector("#ma-import-back")?.addEventListener("click",()=>{step--;render()});
    box.querySelectorAll("[data-field]").forEach(el=>{
      const update=()=>{
        state[el.dataset.field]=el.type==="checkbox"?el.checked:el.value;
        if(["poster","theme"].includes(el.dataset.field))render();
      };
      el.addEventListener("change",update);
      if(el.tagName!=="SELECT"&&el.type!=="checkbox")el.addEventListener("input",update);
    });
    box.querySelector("#ma-import-next").addEventListener("click",next);
  }
  async function next(){
    const err=box.querySelector("#ma-import-error");
    if(step===1&&state.poster==="rpdb"&&state.theme==="custom"&&!state.rpdbKey.trim()){
      err.textContent="Saisissez une clé RPDB Premium ou choisissez un thème gratuit.";err.style.display="";return;
    }
    if(step===1&&state.poster==="top"&&!state.topKey.trim()){
      err.textContent="Saisissez une clé Top Posters.";err.style.display="";return;
    }
    if(step===3){
      for(const url of manifestList()){
        try{const u=new URL(url);if(u.protocol!=="https:"||!u.pathname.endsWith("manifest.json"))throw Error();}
        catch(_){err.textContent="Chaque extension doit être une URL HTTPS de manifest.json.";err.style.display="";return;}
      }
      if(state.torrentio&&!window.MaCollectionDebrid?.select(state,state.preferred)){
        err.textContent="Pour Torrentio, renseignez une clé AllDebrid ou Real-Debrid, ou décochez Torrentio.";err.style.display="";return;
      }
    }
    if(step!==4){step++;render();return;}
    const cfg=setup();close();
    if(dest==="kovelyx"){window.MaCollectionKovelyx?.send(cfg);return;}
    const wizard=window.NuvioWizard;
    if(!wizard){alert("Assistant Nuvio indisponible.");return;}
    wizard.applyVaultFields?.({keys:{
      tmdbKey:cfg.tmdbKey,mdblistKey:cfg.mdblistKey,
      allDebridKey:cfg.debrid.allDebridKey,realDebridKey:cfg.debrid.realDebridKey,
      aioDebridType:cfg.debrid.preferred,
      aioDebridKey:cfg.debrid[cfg.debrid.preferred==="realdebrid"?"realDebridKey":"allDebridKey"],
      aioRpdbKey:cfg.poster.rpdbKey
    }});
    wizard.applyImportSetup?.(cfg);
    (action||(()=>wizard.open({skipChoose:true})))();
  }
  window.MaCollectionImportWizard=Object.freeze({open,close,setup,posterPattern});
})();
