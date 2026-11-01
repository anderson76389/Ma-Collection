import {
  STUDIO_LIMIT, STUDIO_FIELDS, STUDIO_SHAPES, assetUrl, cleanLabel,
  folderId, sourceKey, captureDraft, validateDraft, applyDraft,
  originalsFor, decorateExport, uid
} from './studio-avance-core.mjs';

/* Atelier indépendant : thème existant conservé, aucune connexion à Kaptain. */
(() => {
  'use strict';
  const STORE='ma_collection_studio_profiles_v1';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const data=()=>Array.isArray(window.collectionData)?window.collectionData:[];
  const selections=()=>window.selectedMap||{};
  let profiles=[],draft=null,applied=null,originals=null,root=null;
  let tab='organisation',selectedSection='',selectedFolder='',query='',message='';
  const findCategory=id=>data().find(c=>String(c.id)===String(id));
  const findFolder=(cid,fid)=>findCategory(cid)?.folders?.find(f=>folderId(f)===String(fid));
  const section=()=>draft?.sections.find(c=>c.id===selectedSection);
  const folder=()=>section()?.folders.find(f=>f.id===selectedFolder);
  const html=()=>root?.querySelector('.mc-studio-content');
  const button=(label,action,extra='')=>'<button type="button" data-action="'+action+'" '+extra+'>'+esc(label)+'</button>';
  const badge=n=>'<span class="mc-studio-muted">'+esc(n)+'</span>';
  function load(){
    try{
      const stored=JSON.parse(localStorage.getItem(STORE)||'[]');
      const arr=Array.isArray(stored)?stored:[];
      profiles=arr.slice(0,STUDIO_LIMIT).map(x=>{try{return validateDraft(x,data())}catch{return null}}).filter(Boolean);
    }catch{profiles=[];}
  }
  function persist(){
    try{localStorage.setItem(STORE,JSON.stringify(profiles));return true;}
    catch{return false;}
  }
  function copy(value){return JSON.parse(JSON.stringify(value));}
  function getBase(){return captureDraft(data(),selections(),'Ma configuration actuelle');}
  function pickSection(id){
    selectedSection=id||draft?.sections[0]?.id||'';
    selectedFolder=section()?.folders[0]?.id||'';
  }
  function saveCurrent(){
    try{
      const safe=validateDraft(draft,data());
      const old=profiles.findIndex(x=>x.id===safe.id);
      if(old<0 && profiles.length>=STUDIO_LIMIT)throw Error('Maximum : '+STUDIO_LIMIT+' profils sauvegardés.');
      if(old<0)profiles.push(safe);else profiles[old]=safe;
      if(!persist())throw Error('Stockage local plein ou désactivé. Exporte une copie JSON.');
      draft=copy(safe);message='Profil sauvegardé localement.';return true;
    }catch(e){message=e.message;return false;}
  }
  function create(){
    draft=getBase();draft.name='Nouveau profil';
    draft.id=uid();message='Nouveau profil basé sur ta sélection actuelle.';
    pickSection();tab='organisation';draw();
  }
  function duplicate(){
    if(!draft)return;
    draft=copy(draft);draft.id=uid();draft.name=(draft.name+' (copie)').slice(0,60);
    message='Copie créée. Enregistre-la pour la conserver.';draw();
  }
  function remove(){
    if(!draft||!profiles.some(x=>x.id===draft.id))return;
    if(!window.confirm('Supprimer ce profil sauvegardé ? Les collections du site ne seront pas effacées.'))return;
    profiles=profiles.filter(x=>x.id!==draft.id);
    if(!persist()){message='Impossible de supprimer : stockage inaccessible.';return draw();}
    draft=getBase();pickSection();message='Profil supprimé. Ta collection actuelle reste inchangée.';draw();
  }
  function reset(){
    if(!window.confirm('Réinitialiser uniquement ce brouillon ? Aucun catalogue du site ne sera effacé.'))return;
    const name=draft.name,id=draft.id;
    draft=getBase();draft.name=name;draft.id=id;
    pickSection();message='Brouillon réinitialisé à la collection actuelle.';draw();
  }
  function move(items,id,delta){
    const i=items.findIndex(x=>x.id===id),j=i+delta;
    if(i<0||j<0||j>=items.length)return;
    [items[i],items[j]]=[items[j],items[i]];
    message='Ordre mis à jour. Applique le profil pour voir le résultat.';draw();
  }
  function setCategoryEnabled(section,enabled){
    section.enabled=enabled;
    if(enabled){
      for(const f of section.folders){
        if(!f.enabled)continue;
        if(!f.selectedKeys.length){
          f.selectedKeys=(findFolder(section.id,f.id)?.sources||[]).map(sourceKey);
        }
      }
    }
    draw();
  }
  function download(name,raw){
    const blob=new Blob([raw],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }
  function exportProfile(){
    try{
      const safe=validateDraft(draft,data());
      const slug=(safe.name||'profil').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').slice(0,50);
      download('ma-collection-profil-'+slug+'.json',JSON.stringify(safe,null,2));
      message='Fichier de préréglage téléchargé (sans clé API ni mot de passe).';draw();
    }catch(e){message=e.message;draw();}
  }
  async function importProfile(file){
    if(!file)return;
    try{
      if(file.size>1500000)throw Error('Profil trop volumineux (limite 1,5 Mo).');
      const parsed=JSON.parse(await file.text()), safe=validateDraft(parsed,data());
      safe.id=uid();
      safe.name=cleanLabel(safe.name+' (importé)',60);
      draft=safe;pickSection();tab='organisation';
      message='Profil importé dans le brouillon : vérifie-le avant d’appliquer.';draw();
    }catch(e){message='Import refusé : '+e.message;draw();}
  }
  function apply(){
    try{
      const safe=validateDraft(draft,data());
      if(!originals)originals=originalsFor(data());
      // Validation terminée avant mutation. Retour au site avec les mêmes identifiants.
      applied=applyDraft(safe,data(),selections(),originals);
      if(typeof window.onCollectionEdited==='function')window.onCollectionEdited();
      if(typeof window.switchCategory==='function')window.switchCategory(-2);
      if(typeof window.hideTitleScreen==='function')window.hideTitleScreen();
      close();
      if(typeof window.showToast==='function')window.showToast('Profil appliqué. Tes exportations utiliseront ces réglages.','success');
    }catch(e){message='Application annulée : '+e.message;draw();}
  }
  function choose(id){
    const found=profiles.find(x=>x.id===id);
    if(!found)return;
    draft=copy(found);pickSection();message='Profil chargé dans le Studio. Ta collection ne change pas avant « Appliquer ».';
    tab='organisation';draw();
  }
  function close(){if(!root)return;root.hidden=true;document.removeEventListener('keydown',onEscape,true);}
  function onEscape(e){if(e.key==='Escape'&&!root.hidden){e.stopPropagation();close();}}
  function open(){
    if(!data().length){if(typeof window.showToast==='function')window.showToast('Collections non chargées. Réessaie.','error');return;}
    if(!originals)originals=originalsFor(data());
    load();draft=getBase();pickSection();tab='organisation';query='';message='';
    if(!root)mount();
    root.hidden=false;draw();document.addEventListener('keydown',onEscape,true);
    root.querySelector('.mc-studio-close')?.focus();
  }
  function renderSections(){
    const s=section();
    const sections=draft.sections.map((c,i)=>{
      const total=c.folders.length,checked=c.folders.filter(f=>f.enabled&&f.selectedKeys.length).length;
      return '<div class="mc-studio-entry '+(c.id===selectedSection?'selected':'')+'">'+
        '<button type="button" class="mc-studio-item" data-action="section" data-id="'+esc(c.id)+'">'+
        '<strong>'+esc(c.label)+'</strong><small>'+checked+'/'+total+' dossiers</small></button>'+
        '<label class="mc-studio-tick" title="Activer cette section"><input type="checkbox" data-section-toggle="'+esc(c.id)+'" '+(c.enabled?'checked':'')+' aria-label="Activer '+esc(c.label)+'"></label>'+
        '<div class="mc-studio-arrows">'+button('↑','section-up','data-id="'+esc(c.id)+'" aria-label="Monter la section" '+(i===0?'disabled':''))+
        button('↓','section-down','data-id="'+esc(c.id)+'" aria-label="Descendre la section" '+(i===draft.sections.length-1?'disabled':''))+'</div></div>';
    }).join('');
    const cat=findCategory(selectedSection);
    const shown=(s?.folders||[]).filter(f=>!query||f.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    const folders=shown.map(f=>{
      const i=s.folders.findIndex(x=>x.id===f.id);
      const count=f.selectedKeys.length;
      const cover=f.artwork.coverImageUrl||'';
      return '<div class="mc-studio-entry mc-studio-folder-entry '+(f.id===selectedFolder?'selected':'')+'">'+
        '<button type="button" class="mc-studio-item" data-action="folder" data-id="'+esc(f.id)+'">'+
        (cover?'<img loading="lazy" src="'+esc(cover)+'" alt="">':'<span class="mc-studio-empty-cover">▣</span>')+
        '<span><strong>'+esc(f.label)+'</strong><small>'+count+' source'+(count===1?'':'s')+'</small></span></button>'+
        '<label class="mc-studio-tick" title="Activer le dossier"><input type="checkbox" data-folder-toggle="'+esc(f.id)+'" '+(f.enabled?'checked':'')+' aria-label="Activer '+esc(f.label)+'"></label>'+
        '<div class="mc-studio-arrows">'+button('↑','folder-up','data-id="'+esc(f.id)+'" aria-label="Monter le dossier" '+(i===0?'disabled':''))+
        button('↓','folder-down','data-id="'+esc(f.id)+'" aria-label="Descendre le dossier" '+(i===s.folders.length-1?'disabled':''))+'</div></div>';
    }).join('');
    return '<div class="mc-studio-columns">'+
      '<div class="mc-studio-column"><div class="mc-studio-heading"><strong>Sections</strong>'+badge(draft.sections.length)+'</div>'+
      '<div class="mc-studio-scroll">'+sections+'</div></div>'+
      '<div class="mc-studio-column"><div class="mc-studio-heading"><strong>Dossiers de '+esc(s?.label||'')+'</strong>'+badge(s?.folders.length||0)+'</div>'+
      '<label class="mc-studio-field">Nom de section dans les exports<input type="text" maxlength="85" data-section-label value="'+esc(s?.label||'')+'" placeholder="Nom de section"></label>'+
      '<input type="search" class="mc-studio-search" data-search placeholder="Rechercher un dossier…" value="'+esc(query)+'" aria-label="Rechercher un dossier">'+
      '<div class="mc-studio-scroll">'+(folders||'<p class="mc-studio-muted">Aucun dossier trouvé.</p>')+'</div>'+
      '<p class="mc-studio-hint">La sélection et le tri n’effacent aucune source. Le nom exporté est séparé du nom technique utilisé par le site.</p>'+
      (cat?button('Personnaliser l’affiche du dossier choisi','goto-art'):'')+
      '</div></div>';
  }
  function renderArtwork(){
    const s=section(),f=folder(),orig=findFolder(s?.id,f?.id);
    if(!f||!orig)return '<p class="mc-studio-hint">Sélectionne d’abord un dossier dans Organisation.</p>';
    const sources=(orig.sources||[]).map(src=>{
      const key=sourceKey(src);
      return '<label class="mc-studio-source"><input type="checkbox" data-source="'+esc(key)+'" '+(f.selectedKeys.includes(key)?'checked':'')+'>'+
        '<span>'+esc(src.title||src.name||key)+'</span><small>'+esc(src.provider||'TMDB')+'</small></label>';
    }).join('');
    const artfields=[
      ['coverImageUrl','Affiche / couverture','Affiche principale du dossier'],
      ['heroBackdropUrl','Fond cinématique','Arrière-plan du dossier'],
      ['titleLogoUrl','Logo du titre','Logo transparent facultatif'],
      ['focusGifUrl','GIF au survol','Animation facultative']
    ].map(([key,label,tip])=>'<label class="mc-studio-field">'+esc(label)+
       '<input type="url" data-art="'+key+'" value="'+esc(f.artwork[key]||'')+'" placeholder="https://ma-art.mailpromahe.workers.dev/media/...">'+
       '<small>'+esc(tip)+'</small></label>').join('');
    return '<div class="mc-studio-art-layout"><div class="mc-studio-art-preview">'+
      (f.artwork.heroBackdropUrl?'<img class="mc-studio-hero" src="'+esc(f.artwork.heroBackdropUrl)+'" alt="Fond du dossier">':'')+
      (f.artwork.coverImageUrl?'<img class="mc-studio-cover" src="'+esc(f.artwork.coverImageUrl)+'" alt="Couverture du dossier">':'<div class="mc-studio-no-cover">Aucune affiche</div>')+
      '<strong>'+esc(f.label)+'</strong><small>Prévisualisation des fichiers choisis</small>'+
      button('Restaurer les visuels d’origine','original-art')+'</div>'+
      '<div class="mc-studio-art-form"><div class="mc-studio-heading"><strong>Personnaliser '+esc(f.label)+'</strong></div>'+
      '<label class="mc-studio-field">Titre du dossier dans les exports<input type="text" maxlength="85" data-folder-label value="'+esc(f.label)+'"></label>'+
      '<div class="mc-studio-art-grid">'+artfields+'</div>'+
      '<div class="mc-studio-art-options"><label class="mc-studio-field">Format<select data-shape>'+
      STUDIO_SHAPES.map(v=>'<option value="'+v+'" '+(f.shape===v?'selected':'')+'>'+({POSTER:'Affiche verticale',LANDSCAPE:'Paysage',SQUARE:'Carré'}[v])+'</option>').join('')+
      '</select></label><label class="mc-studio-check"><input type="checkbox" data-flag="hideTitle" '+(f.hideTitle?'checked':'')+'> Masquer le titre</label>'+
      '<label class="mc-studio-check"><input type="checkbox" data-flag="focusGlowEnabled" '+(f.focusGlowEnabled?'checked':'')+'> Lueur de sélection</label></div>'+
      '<div class="mc-studio-heading"><strong>Sources de ce dossier</strong>'+badge(f.selectedKeys.length+'/'+(orig.sources||[]).length)+'</div>'+
      '<div class="mc-studio-sources">'+sources+'</div>'+
      '<p class="mc-studio-hint">Seules les URL HTTPS d’images sont acceptées. Pour rester autonome, privilégie tes propres images Ma-Art. Les changements restent dans ce brouillon jusqu’à « Appliquer ».</p>'+
      '</div></div>';
  }
  function renderProfiles(){
    const p=profiles.map(x=>'<div class="mc-studio-saved"><div><strong>'+esc(x.name)+'</strong><small>'+esc(x.sections.length)+' sections · '+esc((x.updatedAt||'').slice(0,10))+'</small></div>'+
      button('Charger','load-profile','data-id="'+esc(x.id)+'"')+'</div>').join('');
    const name=esc(draft?.name||''),avatar=esc(draft?.avatarUrl||'');
    return '<div class="mc-studio-profile-layout"><div class="mc-studio-column"><div class="mc-studio-heading"><strong>Profil en cours</strong></div>'+
      '<label class="mc-studio-field">Nom du profil<input type="text" data-profile-name maxlength="60" value="'+name+'"></label>'+
      '<label class="mc-studio-field">Avatar du profil (facultatif)<input type="url" data-avatar value="'+avatar+'" placeholder="URL HTTPS de l’avatar"></label>'+
      (avatar?'<img class="mc-studio-avatar" src="'+avatar+'" alt="Avatar du profil">':'')+
      '<div class="mc-studio-actions-grid">'+button('Nouveau profil','new')+button('Dupliquer','duplicate')+button('Enregistrer','save')+
      button('Supprimer le profil','delete')+button('Annuler le brouillon','reset')+'</div>'+
      '<p class="mc-studio-hint">Maximum '+STUDIO_LIMIT+' profils dans ce navigateur. Aucun identifiant Nuvio, secret ou clé API n’est conservé dans ces préréglages.</p></div>'+
      '<div class="mc-studio-column"><div class="mc-studio-heading"><strong>Mes profils sauvegardés</strong>'+badge(profiles.length+'/'+STUDIO_LIMIT)+'</div>'+
      '<div class="mc-studio-scroll">'+(p||'<p class="mc-studio-muted">Aucun profil sauvegardé.</p>')+'</div>'+
      '<div class="mc-studio-actions-grid">'+button('Exporter ce profil (.json)','export')+
      button('Importer un profil (.json)','import')+'</div>'+
      '<input data-file type="file" accept="application/json,.json" hidden>'+
      '<p class="mc-studio-hint">L’export et l’import transportent tes préférences vers un autre appareil. Ils ne modifient pas les comptes des applications.</p></div></div>';
  }
  function draw(){
    if(!root||!draft)return;
    const body=html();if(!body)return;
    root.querySelector('.mc-studio-title').textContent=draft.name;
    root.querySelectorAll('[data-tab]').forEach(x=>{x.classList.toggle('active',x.dataset.tab===tab);x.setAttribute('aria-selected',String(x.dataset.tab===tab));});
    body.innerHTML=(tab==='organisation'?renderSections():tab==='affiches'?renderArtwork():renderProfiles());
    const status=root.querySelector('.mc-studio-status');if(status)status.textContent=message;
  }
  function change(e){
    if(!draft)return;
    const el=e.target;
    try{
      if(el.matches('[data-search]')){query=el.value;draw();root.querySelector('[data-search]')?.focus();return;}
      if(el.matches('[data-section-toggle]')){const item=draft.sections.find(x=>x.id===el.dataset.sectionToggle);if(item)setCategoryEnabled(item,el.checked);return;}
      if(el.matches('[data-folder-toggle]')){const f=section()?.folders.find(x=>x.id===el.dataset.folderToggle);if(f){f.enabled=el.checked;if(f.enabled&&!f.selectedKeys.length)f.selectedKeys=(findFolder(section().id,f.id)?.sources||[]).map(sourceKey);}draw();return;}
      if(el.matches('[data-section-label]')){section().label=cleanLabel(el.value);draw();return;}
      if(el.matches('[data-folder-label]')){folder().label=cleanLabel(el.value);draw();return;}
      if(el.matches('[data-profile-name]')){draft.name=cleanLabel(el.value,60);draw();return;}
      if(el.matches('[data-avatar]')){draft.avatarUrl=assetUrl(el.value);draw();return;}
      if(el.matches('[data-art]')){folder().artwork[el.dataset.art]=assetUrl(el.value);draw();return;}
      if(el.matches('[data-shape]')){if(STUDIO_SHAPES.includes(el.value))folder().shape=el.value;draw();return;}
      if(el.matches('[data-flag]')){folder()[el.dataset.flag]=el.checked;draw();return;}
      if(el.matches('[data-source]')){
        const f=folder(),key=el.dataset.source,set=new Set(f.selectedKeys);
        if(el.checked)set.add(key);else set.delete(key);
        f.selectedKeys=[...set];f.enabled=set.size>0;draw();return;
      }
      if(el.matches('[data-file]')){importProfile(el.files[0]);el.value='';}
    }catch(error){message=error.message;draw();}
  }
  function click(e){
    const btn=e.target.closest('[data-action]');if(!btn)return;
    const a=btn.dataset.action,id=btn.dataset.id;
    if(a==='section'){pickSection(id);query='';draw();}
    else if(a==='folder'){selectedFolder=id;tab='affiches';draw();}
    else if(a==='goto-art'){tab='affiches';draw();}
    else if(a==='section-up'||a==='section-down')move(draft.sections,id,a==='section-up'?-1:1);
    else if(a==='folder-up'||a==='folder-down')move(section().folders,id,a==='folder-up'?-1:1);
    else if(a==='original-art'){
      const f=folder(),real=findFolder(selectedSection,selectedFolder);
      for(const k of STUDIO_FIELDS)f.artwork[k]=String(originals?.[f.id]?.[k]||real?.[k]||'');
      f.shape=originals?.[f.id]?.tileShape||real?.tileShape||'LANDSCAPE';draw();
    }
    else if(a==='new')create();
    else if(a==='duplicate')duplicate();
    else if(a==='save'){saveCurrent();draw();}
    else if(a==='delete')remove();
    else if(a==='reset')reset();
    else if(a==='load-profile')choose(id);
    else if(a==='export')exportProfile();
    else if(a==='import')root.querySelector('[data-file]')?.click();
    else if(a==='apply')apply();
    else if(a==='close')close();
  }
  function mount(){
    root=document.createElement('div');
    root.id='mc-studio-root';root.className='mc-studio-overlay';root.hidden=true;
    root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
    root.setAttribute('aria-labelledby','mc-studio-heading');
    root.innerHTML='<div class="mc-studio-panel">'+
      '<header class="mc-studio-header"><div><span class="mc-studio-overline">MA-COLLECTION · ATELIER AVANCÉ</span>'+
      '<h2 id="mc-studio-heading">Studio des profils</h2><p class="mc-studio-title"></p></div>'+
      '<button class="mc-studio-close" type="button" data-action="close" aria-label="Fermer">×</button></header>'+
      '<nav class="mc-studio-tabs" aria-label="Outils du Studio" role="tablist">'+
      '<button role="tab" data-tab="organisation">Sections & dossiers</button>'+
      '<button role="tab" data-tab="affiches">Affiches & sources</button>'+
      '<button role="tab" data-tab="profils">Profils & sauvegardes</button></nav>'+
      '<main class="mc-studio-content"></main>'+
      '<div class="mc-studio-status" role="status" aria-live="polite"></div>'+
      '<footer class="mc-studio-footer"><span>Modifications facultatives · Rien ne change avant validation</span>'+
      '<button type="button" class="mc-studio-apply" data-action="apply">Appliquer ce profil à Ma-Collection</button></footer></div>';
    document.body.appendChild(root);
    root.addEventListener('click',e=>{if(e.target===root)close();else click(e);});
    root.addEventListener('change',change);
    root.addEventListener('input',e=>{if(e.target.matches('[data-search]'))change(e);});
    root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
      tab=b.dataset.tab;if(tab==='affiches'&&!selectedFolder)selectedFolder=section()?.folders[0]?.id;message='';draw();
    }));
  }
  function insertCard(){
    const anchor=document.getElementById('title-screen-start');
    if(!anchor||document.getElementById('title-screen-studio'))return;
    const card=document.createElement('div');
    card.className='portfolio-card card-custom';card.id='title-screen-studio';
    card.setAttribute('role','button');card.setAttribute('tabindex','0');
    card.innerHTML='<div class="port-card-inner"><div class="port-card-meta">'+
      '<div class="port-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="M7 8h10M7 12h7M7 16h5"></path></svg></div>'+
      '<span class="port-pill">Nouveau · avancé</span></div>'+
      '<div class="port-card-content"><h4 class="port-card-title">Studio des profils</h4>'+
      '<p class="port-card-desc">Sauvegardez plusieurs profils, classez vos sections, choisissez chaque affiche et personnalisez les sources.</p></div>'+
      '<div class="port-card-action"><span class="port-link">Ouvrir le Studio <span class="arrow" aria-hidden="true">→</span></span></div></div>';
    anchor.insertAdjacentElement('afterend',card);
    card.addEventListener('click',open);
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
  }
  function bootstrap(){insertCard();window.MaCollectionStudio={open,decorateExport(collections){return applied?decorateExport(collections,applied):collections}};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});else bootstrap();
})();
