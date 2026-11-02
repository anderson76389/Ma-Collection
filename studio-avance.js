import {
  STUDIO_LIMIT, STUDIO_FIELDS, STUDIO_SHAPES, assetUrl, cleanLabel,
  folderId, sourceKey, captureDraft, validateDraft, applyDraft,
  originalsFor, decorateExport, previewLayout, searchDraft,
  captureStudioUndo, restoreStudioUndo, compareStudioDrafts, uid
} from './studio-avance-core.mjs';
import {createStudioBackupStore,makeStudioBackup} from './studio-backups.mjs';
import {studioFolderKey,studioTidy,studioApplyBatch} from './studio-workshop-core.mjs';

/* Atelier indépendant : thème existant conservé, aucune connexion à Kaptain. */
(() => {
  'use strict';
  const STORE='ma_collection_studio_profiles_v1';
  const backupStore=createStudioBackupStore();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const data=()=>Array.isArray(window.collectionData)?window.collectionData:[];
  const selections=()=>window.selectedMap||{};
  let profiles=[],draft=null,applied=null,originals=null,root=null;
  let tab='organisation',selectedSection='',selectedFolder='',query='',message='';
  let dragging=null;
  let previewDevice='tv',globalQuery='',globalActiveOnly=false,globalNoCover=false,undoLast=null;
  let backups=[],backupError='',applying=false;
  let workshopSearch='',workshopSection='all',workshopSelected=new Set(),workshopMode='active-first';
  let workshopSortSections=true,workshopSortFolders=true,workshopUndo=null;
  let artLookIndex=0, artSearch='', artMoreOnly=false, artNeedsAttention=false, showBatch=false;
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
  function getAppliedSnapshot(){
    // La carte des sources reflète l'état actuel, même modifié par l'éditeur rapide.
    const current=getBase();
    if(applied?.sections){
      const sections=new Map(applied.sections.map(s=>[s.id,s]));
      for(const sec of current.sections){
        const prior=sections.get(sec.id);
        if(!prior)continue;
        sec.label=prior.label;
        const folders=new Map(prior.folders.map(f=>[f.id,f]));
        for(const f of sec.folders){
          const old=folders.get(f.id);
          if(old){f.label=old.label;f.looks=copy(old.looks||[]);}
        }
      }
      current.name=applied.name;
      current.avatarUrl=applied.avatarUrl;
      current.syncQuickEditor=applied.syncQuickEditor;
    }
    return current;
  }
  async function refreshBackups(){
    try{backups=await backupStore.list();backupError='';}
    catch(error){backups=[];backupError=error.message||'Sauvegardes indisponibles.';}
    if(root&&!root.hidden&&tab==='profils')draw();
  }
  async function saveManualBackup(){
    try{
      const entry=makeStudioBackup(draft,data(),'manual');
      await backupStore.save(entry);
      await refreshBackups();
      message='Sauvegarde conservée dans ce navigateur. Tu peux la restaurer ou exporter en JSON.';
    }catch(error){message='Sauvegarde impossible : '+error.message;}
    draw();
  }
  function getBackup(id){return backups.find(b=>b.id===id);}
  function loadBackup(id){
    const entry=getBackup(id);if(!entry)return;
    if(!window.confirm('Charger cette sauvegarde dans le brouillon ? Les modifications non enregistrées du brouillon seront remplacées. Rien ne sera appliqué sans ta confirmation.'))return;
    try{
      draft=validateDraft(entry.profile,data());
      draft.id=uid();draft.updatedAt=new Date().toISOString();
      pickSection();tab='organisation';
      message='Sauvegarde chargée dans le brouillon. Vérifie-la, puis clique sur « Appliquer » si elle te convient.';
      draw();
    }catch(error){message='Restauration impossible : '+error.message;draw();}
  }
  async function deleteBackup(id){
    const entry=getBackup(id);if(!entry)return;
    if(!window.confirm('Supprimer cette sauvegarde locale ? Le profil et la collection actuels ne seront pas modifiés.'))return;
    try{
      await backupStore.remove(id);
      await refreshBackups();message='Sauvegarde supprimée. Le Studio reste inchangé.';
    }catch(error){message='Suppression impossible : '+error.message;}
    draw();
  }
  function exportBackup(id){
    const entry=getBackup(id);if(!entry)return;
    try{
      const safe=validateDraft(entry.profile,data());
      download('ma-collection-sauvegarde-'+entry.createdAt.slice(0,10)+'.json',JSON.stringify(safe,null,2));
      message='Sauvegarde exportée en JSON, sans clés privées ni identifiants.';
    }catch(error){message='Export impossible : '+error.message;}
    draw();
  }
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
  async function apply(){
    if(applying)return;
    applying=true;
    const applyButton=root?.querySelector('[data-action="apply"]');
    if(applyButton)applyButton.disabled=true;
    try{
      const safe=validateDraft(draft,data());
      if(!originals)originals=originalsFor(data());
      let warning='';
      // Écriture terminée avant toute mutation de l'accueil.
      // Si IndexedDB est désactivé, l'application et l'annulation en mémoire
      // restent utilisables, avec un avertissement explicite.
      try{
        await backupStore.save(makeStudioBackup(getAppliedSnapshot(),data(),'before-apply'));
        await refreshBackups();
      }catch(error){warning=' (sauvegarde automatique indisponible : '+error.message+')';}
      const before=captureStudioUndo(data(),selections());
      const previousApplied=applied;
      try{
        applied=applyDraft(safe,data(),selections(),originals);
      }catch(error){
        restoreStudioUndo(before,data(),selections());
        applied=previousApplied;
        throw error;
      }
      undoLast={before,previousApplied};
      if(safe.syncQuickEditor) window.MaCollectionStudioAdapter?.applySettings?.(safe.name,safe.avatarUrl);
      if(typeof window.onCollectionEdited==='function')window.onCollectionEdited();
      if(typeof window.switchCategory==='function')window.switchCategory(-2);
      if(typeof window.hideTitleScreen==='function')window.hideTitleScreen();
      close();
      if(typeof window.showToast==='function')window.showToast('Profil appliqué.'+warning,warning?'warning':'success');
    }catch(error){message='Application annulée : '+error.message;draw();}
    finally{applying=false;if(applyButton)applyButton.disabled=false;}
  }
  function undoApplication(){
    if(!undoLast)return;
    if(!window.confirm('Annuler la dernière application dans Ma-Collection ? Cela rétablit l’ordre, les affiches et les sources d’avant. Les éventuels réglages de nom/avatar de l’éditeur rapide ne sont pas concernés.'))return;
    try{
      restoreStudioUndo(undoLast.before,data(),selections());
      applied=undoLast.previousApplied;
      undoLast=null;
      if(typeof window.onCollectionEdited==='function')window.onCollectionEdited();
      draft=getBase();pickSection();tab='organisation';
      message='Dernière application annulée : ordre, sources et visuels rétablis.';
      draw();
    }catch(error){message='Restauration impossible : '+error.message;draw();}
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
    artLookIndex=0;artSearch='';artMoreOnly=false;artNeedsAttention=false;showBatch=false;previewDevice='tv';globalQuery='';globalActiveOnly=false;globalNoCover=false;
    workshopSelected=new Set();workshopUndo=null;workshopSearch='';workshopSection='all';
    if(!root)mount();
    root.hidden=false;draw();refreshBackups();document.addEventListener('keydown',onEscape,true);
    root.querySelector('.mc-studio-close')?.focus();
  }
  function renderSections(){
    const s=section();
    const sections=draft.sections.map((c,i)=>{
      const total=c.folders.length,checked=c.folders.filter(f=>f.enabled&&f.selectedKeys.length).length;
      return '<div class="mc-studio-entry '+(c.id===selectedSection?'selected':'')+'" draggable="true" data-drag-kind="section" data-drag-id="'+esc(c.id)+'">'+
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
      return '<div class="mc-studio-entry mc-studio-folder-entry '+(f.id===selectedFolder?'selected':'')+'" draggable="true" data-drag-kind="folder" data-drag-id="'+esc(f.id)+'">'+
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
      button('+ Créer un dossier TMDB','create-folder')+
      '</div></div>';
  }

  function availableLooks(custom, real) {
    const items=[],seen=new Set();
    function add(url,label) {
      if(!url || seen.has(url))return;
      seen.add(url);items.push({url,label});
    }
    add(custom?.artwork?.coverImageUrl,'Affiche sélectionnée');
    add(originals?.[custom?.id]?.coverImageUrl || real?.coverImageUrl,'Affiche d’origine');
    for(const entry of custom?.looks||[])add(entry.url,entry.label||'Variante personnelle');
    return items;
  }
  function artRowFolders() {
    let rows=section()?.folders||[];
    if(artSearch)rows=rows.filter(f=>f.label.toLocaleLowerCase().includes(artSearch.toLocaleLowerCase()));
    if(artMoreOnly)rows=rows.filter(f=>availableLooks(f,findFolder(selectedSection,f.id)).length>1);
    if(artNeedsAttention)rows=rows.filter(f=>!f.artwork.coverImageUrl);
    return rows;
  }
  function artTheater(f,real) {
    const choices=availableLooks(f,real);
    artLookIndex=Math.min(Math.max(artLookIndex,0),Math.max(choices.length-1,0));
    const current=choices[artLookIndex],rows=artRowFolders();
    const count=section()?.folders.length||0;
    const toolbar='<div class="mc-studio-art-toolbar">'+
      '<label class="mc-studio-field">Section<select data-art-section>'+
      draft.sections.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===selectedSection?'selected':'')+'>'+esc(c.label)+'</option>').join('')+
      '</select></label>'+
      '<label class="mc-studio-field">Trouver un dossier<input type="search" data-art-search placeholder="Netflix, saga, studio…" value="'+esc(artSearch)+'"></label>'+
      '<label class="mc-studio-check"><input data-art-other type="checkbox" '+(artMoreOnly?'checked':'')+'> Autres affiches</label>'+
      '<label class="mc-studio-check"><input data-art-needs type="checkbox" '+(artNeedsAttention?'checked':'')+'> À compléter</label>'+
      button('Style de toute la section ('+count+')','batch-open')+
      '</div>';
    const searchResults='<div class="mc-studio-art-nav" aria-label="Dossiers de la section">'+
       rows.slice(0,130).map(row=>button(row.label,'art-folder','data-id="'+esc(row.id)+'" class="'+(row.id===selectedFolder?'active':'')+'"')).join('')+
       (rows.length>130?'<span class="mc-studio-muted">Affinez la recherche pour voir les autres dossiers.</span>':'')+
       '</div>';
    const theater='<div class="mc-studio-theater">'+
      '<div class="mc-studio-theater-title"><div><strong>'+esc(f.label)+'</strong><small>'+esc(section()?.label||'')+
      ' · Visuel '+(choices.length?artLookIndex+1:0)+' sur '+choices.length+'</small></div>'+
      '<label class="mc-studio-check"><input type="checkbox" data-flag="focusGifEnabled" '+(f.focusGifEnabled?'checked':'')+'> Animations</label></div>'+
      '<div class="mc-studio-stage">'+
      button('‹','art-prev','aria-label="Affiche précédente" '+(choices.length<2?'disabled':''))+
      (current?'<img src="'+esc(current.url)+'" alt="Affiche '+esc(current.label)+'" class="mc-studio-stage-image" loading="lazy">':
         '<div class="mc-studio-stage-empty">Aucune affiche disponible</div>')+
      button('›','art-next','aria-label="Affiche suivante" '+(choices.length<2?'disabled':''))+
      '</div>'+
      '<div class="mc-studio-gallery-pips">'+choices.map((item,i)=>'<button type="button" data-action="art-select" data-id="'+i+
      '" aria-label="Choisir '+esc(item.label)+'" class="'+(i===artLookIndex?'active':'')+'"></button>').join('')+'</div>'+
      '<div class="mc-studio-gallery-actions">'+
      button('🔗 Ajouter mon image','art-add')+
      button('Utiliser cette affiche','art-use',''+(!current?'disabled':''))+
      button('Retirer la variante ajoutée','art-remove',''+(!current||!(f.looks||[]).some(x=>x.url===current.url)?'disabled':''))+
      '</div>'+
      '<p class="mc-studio-hint">Les variantes sont de vrais fichiers Ma-Art ou des URL HTTPS ajoutées par toi. La sélection sera exportée vers Kovelyx/Nuvio après application du profil. Aucun lien vers Kaptain.</p>'+
      '</div>';
    const batch=showBatch?'<div class="mc-studio-batch"><strong>Appliquer des réglages à toute la section : '+esc(section()?.label||'')+'</strong>'+
      '<p class="mc-studio-hint">Les '+count+' dossiers gardent chacun leur propre affiche et leurs sources. Seuls les réglages ci-dessous changent.</p>'+
      '<div class="mc-studio-batch-options"><label class="mc-studio-field">Format<select data-batch-shape>'+
      STUDIO_SHAPES.map(k=>'<option value="'+k+'">'+esc(k)+'</option>').join('')+'</select></label>'+
      '<label class="mc-studio-check"><input type="checkbox" data-batch-title> Masquer les titres</label>'+
      '<label class="mc-studio-check"><input type="checkbox" data-batch-glow> Lueur au focus</label>'+
      '<label class="mc-studio-check"><input type="checkbox" data-batch-motion> Activer les animations déjà présentes</label>'+
      '</div>'+button('Appliquer les réglages de la section','batch-apply')+button('Annuler','batch-close')+'</div>':'';
    return toolbar+searchResults+theater+batch;
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
    return '<div class="mc-studio-artwork-screen">'+artTheater(f,orig)+'<div class="mc-studio-art-layout"><div class="mc-studio-art-preview">'+
      (f.artwork.heroBackdropUrl?'<img class="mc-studio-hero" src="'+esc(f.artwork.heroBackdropUrl)+'" alt="Fond du dossier">':'')+
      (f.artwork.coverImageUrl?'<img class="mc-studio-cover" src="'+esc(f.artwork.coverImageUrl)+'" alt="Couverture du dossier">':'<div class="mc-studio-no-cover">Aucune affiche</div>')+
      (f.artwork.titleLogoUrl?'<img class="mc-studio-title-logo" src="'+esc(f.artwork.titleLogoUrl)+'" alt="Logo du titre">':'')+
      '<strong>'+esc(f.label)+'</strong><small>Prévisualisation des fichiers choisis</small>'+
      button('Restaurer les visuels d’origine','original-art')+'</div>'+
      '<div class="mc-studio-art-form"><div class="mc-studio-heading"><strong>Personnaliser '+esc(f.label)+'</strong></div>'+
      '<label class="mc-studio-field">Titre du dossier dans les exports<input type="text" maxlength="85" data-folder-label value="'+esc(f.label)+'"></label>'+
      '<div class="mc-studio-art-grid">'+artfields+'</div>'+
      '<div class="mc-studio-art-options"><label class="mc-studio-field">Format<select data-shape>'+
      STUDIO_SHAPES.map(v=>'<option value="'+v+'" '+(f.shape===v?'selected':'')+'>'+({POSTER:'Affiche verticale',LANDSCAPE:'Paysage',SQUARE:'Carré'}[v])+'</option>').join('')+
      '</select></label><label class="mc-studio-check"><input type="checkbox" data-flag="hideTitle" '+(f.hideTitle?'checked':'')+'> Masquer le titre</label>'+
      '<label class="mc-studio-check"><input type="checkbox" data-flag="focusGlowEnabled" '+(f.focusGlowEnabled?'checked':'')+'> Lueur de sélection</label>'+
      '<label class="mc-studio-check"><input type="checkbox" data-flag="focusGifEnabled" '+(f.focusGifEnabled?'checked':'')+'> Activer le GIF existant</label></div>'+
      '<div class="mc-studio-heading"><strong>Sources de ce dossier</strong>'+badge(f.selectedKeys.length+'/'+(orig.sources||[]).length)+'</div>'+
      '<div class="mc-studio-sources">'+sources+'</div>'+
      '<p class="mc-studio-hint">Seules les URL HTTPS d’images sont acceptées. Pour rester autonome, privilégie tes propres images Ma-Art. Les changements restent dans ce brouillon jusqu’à « Appliquer ».</p>'+
      '</div></div></div>';
  }
  function renderPreview(){
    const rows=previewLayout(draft,originals||{},24);
    const rowCount=rows.length;
    const folderCount=rows.reduce((sum,s)=>sum+s.total,0);
    const controls='<div class="mc-studio-preview-toolbar"><div><strong>Aperçu de ton écran d’accueil</strong>'+
      '<p class="mc-studio-hint">Prévisualisation du brouillon : seules les rangées et les sources actives apparaissent. Aucun changement n’est envoyé à Nuvio ou Kovelyx.</p></div>'+
      '<div class="mc-studio-preview-devices" role="group" aria-label="Format de prévisualisation">'+
      button('Télévision','preview-device','data-id="tv" aria-pressed="'+(previewDevice==='tv')+'" class="'+(previewDevice==='tv'?'active':'')+'"')+
      button('Mobile','preview-device','data-id="mobile" aria-pressed="'+(previewDevice==='mobile')+'" class="'+(previewDevice==='mobile'?'active':'')+'"')+'</div></div>';
    if(!rowCount) return '<div class="mc-studio-preview">'+controls+
      '<p class="mc-studio-hint">Aucune rangée active. Active une section, un dossier et au moins une de ses sources dans « Sections & dossiers ».</p></div>';
    const sections=rows.map(s=>'<section class="mc-studio-preview-section" aria-label="'+esc(s.label)+'">'+
      '<header class="mc-studio-preview-section-head"><div><h3>'+esc(s.label)+'</h3>'+
      '<small>'+s.total+' dossier'+(s.total>1?'s':'')+' actif'+(s.total>1?'s':'')+'</small></div>'+
      button('Modifier','preview-edit','data-section="'+esc(s.id)+'"')+'</header>'+
      '<div class="mc-studio-preview-row">'+s.folders.map(f=>
        '<button type="button" class="mc-studio-preview-tile" data-action="preview-edit" data-section="'+esc(s.id)+'" data-id="'+esc(f.id)+'" title="Personnaliser '+esc(f.label)+'">'+
        (f.coverImageUrl?'<img src="'+esc(f.coverImageUrl)+'" loading="lazy" alt="">':
          '<span class="mc-studio-preview-placeholder" aria-hidden="true">▣</span>')+
        '<strong>'+esc(f.label)+'</strong><small>'+f.sourceCount+' source'+(f.sourceCount>1?'s':'')+'</small></button>'
      ).join('')+
      (s.omitted?'<div class="mc-studio-preview-more">+'+s.omitted+' dossiers actifs non affichés dans cet aperçu</div>':'')+
      '</div></section>').join('');
    return '<div class="mc-studio-preview '+(previewDevice==='mobile'?'mc-studio-preview-mobile':'')+'">'+controls+
      '<p class="mc-studio-preview-summary">'+rowCount+' rangée'+(rowCount>1?'s':'')+' · '+folderCount+' dossiers activés</p>'+
      '<div class="mc-studio-preview-rows">'+sections+'</div>'+
      '<p class="mc-studio-hint">L’aperçu limite l’affichage à 24 dossiers par rangée pour préserver les performances. Les autres restent dans le profil et dans l’export.</p></div>';
  }
  function renderChanges(){
    const before=getAppliedSnapshot();
    const diff=compareStudioDrafts(before,draft,15);
    const labels=[
      ['Ordre des sections',diff.total.sectionOrder],
      ['Ordre des dossiers',diff.total.folderOrders],
      ['Sections activées',diff.total.sectionsEnabled],
      ['Sections désactivées',diff.total.sectionsDisabled],
      ['Dossiers activés',diff.total.foldersEnabled],
      ['Dossiers désactivés',diff.total.foldersDisabled],
      ['Sources activées',diff.total.sourcesEnabled],
      ['Sources désactivées',diff.total.sourcesDisabled],
      ['Affiches / fonds / logos / GIF',diff.total.artworks],
      ['Noms de sections / dossiers',diff.total.labels],
      ['Options de présentation',diff.total.presentation]
    ];
    return '<div class="mc-studio-diff">'+
      '<div class="mc-studio-diff-intro"><div><h3>Avant d’appliquer ce profil</h3>'+
      '<p class="mc-studio-hint">Comparaison entre ta collection actuellement chargée et ce brouillon. Le calcul est local et ne change ni source ni image.</p></div>'+
      '<span class="mc-studio-diff-total">'+diff.changeCount+' modification'+(diff.changeCount>1?'s':'')+'</span></div>'+
      '<div class="mc-studio-diff-stats">'+labels.map(([label,count])=>
        '<div class="mc-studio-diff-stat '+(count?'is-changed':'')+'"><strong>'+count+'</strong><span>'+esc(label)+'</span></div>').join('')+'</div>'+
      (diff.examples.length?'<div class="mc-studio-diff-examples"><h4>Exemples des changements</h4>'+
        '<ul>'+diff.examples.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul>'+
        '<p class="mc-studio-hint">Cette liste est un échantillon. Les compteurs portent sur tous les dossiers chargés.</p></div>':
        '<p class="mc-studio-hint">Aucune différence détectée par rapport à la configuration actuellement chargée.</p>')+
      '<div class="mc-studio-actions-grid">'+button('Revenir à l’organisation','diff-organisation')+
      button('Vérifier les affiches','diff-artworks')+'</div>'+
      '<p class="mc-studio-hint">Si tu appliques le brouillon, une sauvegarde automatique de la configuration précédente est tentée. Les changements restent annulables pendant cette session.</p>'+
      '</div>';
  }
  function workshopFolders(){
    const needle=workshopSearch.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').trim();
    const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
    return (draft?.sections||[]).flatMap(sec=>
      (sec.folders||[]).filter(f=>(workshopSection==='all'||workshopSection===sec.id)&&
        (!needle||normalize(sec.label+' '+f.label).includes(needle)))
      .map(f=>({section:sec,folder:f,key:studioFolderKey(sec.id,f.id)}))
    );
  }
  function renderWorkshop(){
    const all=workshopFolders(),shown=all.slice(0,100);
    const keys=new Set(all.map(x=>x.key));
    const selected=[...workshopSelected].filter(k=>keys.has(k)).length;
    const preview=studioTidy(draft,{mode:workshopMode,sections:workshopSortSections,folders:workshopSortFolders},true);
    const options='<option value="all">Toutes les sections</option>'+
      draft.sections.map(sec=>'<option value="'+esc(sec.id)+'" '+(workshopSection===sec.id?'selected':'')+'>'+esc(sec.label)+'</option>').join('');
    const names=shown.map(({section:sec,folder:f,key})=>'<label class="mc-studio-workshop-item">'+
      '<input type="checkbox" data-workshop-target="'+esc(key)+'" '+(workshopSelected.has(key)?'checked':'')+'>'+
      (f.artwork?.coverImageUrl?'<img src="'+esc(f.artwork.coverImageUrl)+'" loading="lazy" alt="">':
      '<span class="mc-studio-workshop-placeholder" aria-hidden="true">▣</span>')+
      '<span><strong>'+esc(f.label)+'</strong><small>'+esc(sec.label)+' · '+(f.selectedKeys||[]).length+' source(s)</small></span></label>').join('');
    const field=(label,attr,items)=>'<label class="mc-studio-field">'+esc(label)+'<select '+attr+'>'+
      items.map(([value,text])=>'<option value="'+esc(value)+'">'+esc(text)+'</option>').join('')+'</select></label>';
    const switches=[['','Ne pas modifier'],['true','Activer'],['false','Désactiver']];
    return '<div class="mc-studio-workshop">'+
      '<div><h3>Outils d’accueil et d’affiches</h3><p class="mc-studio-hint">Organise des centaines de dossiers ou applique les mêmes options à plusieurs affiches. Tout reste dans le brouillon jusqu’à « Appliquer ce profil ».</p></div>'+
      '<section class="mc-studio-workshop-panel"><h4>Rangement intelligent de l’accueil</h4>'+
      '<p class="mc-studio-hint">Réorganise les dossiers sans en supprimer un seul. L’ordre d’origine est préservé entre éléments de même priorité.</p>'+
      '<div class="mc-studio-workshop-grid">'+'<label class="mc-studio-field">Méthode<select data-workshop-mode><option value="active-first" '+(workshopMode==='active-first'?'selected':'')+'>Actifs en premier</option><option value="alphabetical" '+(workshopMode==='alphabetical'?'selected':'')+'>Ordre alphabétique français</option></select></label>'+
      '<label class="mc-studio-check"><input type="checkbox" data-workshop-sortsections '+(workshopSortSections?'checked':'')+'> Trier les sections</label>'+
      '<label class="mc-studio-check"><input type="checkbox" data-workshop-sortfolders '+(workshopSortFolders?'checked':'')+'> Trier les dossiers</label></div>'+
      '<p class="mc-studio-workshop-preview">Prévision : '+preview.sectionsMoved+' section(s) et '+preview.foldersMoved+' dossier(s) changeraient de position.</p>'+
      '<div class="mc-studio-actions-grid">'+button('Ranger ce brouillon','workshop-tidy',preview.changed?'':'disabled')+
      (workshopUndo?button('↶ Annuler le dernier lot','workshop-undo'):'')+'</div></section>'+
      '<section class="mc-studio-workshop-panel"><h4>Personnalisation de plusieurs dossiers</h4>'+
      '<div class="mc-studio-workshop-grid">'+
      '<label class="mc-studio-field">Chercher dans les dossiers<input type="search" data-workshop-search value="'+esc(workshopSearch)+'" placeholder="Nom du dossier…" autocomplete="off"></label>'+
      '<label class="mc-studio-field">Catégorie<select data-workshop-section>'+options+'</select></label></div>'+
      '<div class="mc-studio-actions-grid">'+button('Tout sélectionner dans la liste','workshop-select-visible')+
      button('Effacer la sélection','workshop-clear')+'</div>'+
      '<p class="mc-studio-hint">'+all.length+' dossier(s) trouvés · '+workshopSelected.size+' sélectionné(s). Affichage limité aux 100 premiers ; précise la recherche pour les autres.</p>'+
      '<div class="mc-studio-workshop-list">'+(names||'<p class="mc-studio-muted">Aucun dossier correspondant.</p>')+'</div>'+
      '<div class="mc-studio-workshop-grid">'+
      field('Format','data-workshop-shape',[['','Ne pas modifier'],['POSTER','Affiche verticale'],['LANDSCAPE','Paysage'],['SQUARE','Carré']])+
      field('Titres','data-workshop-hide',[['','Ne pas modifier'],['true','Masquer'],['false','Afficher']])+
      field('Lueur de sélection','data-workshop-glow',switches)+
      field('Animation GIF','data-workshop-gif',switches)+'</div>'+
      '<div class="mc-studio-actions-grid">'+button('Appliquer aux dossiers sélectionnés','workshop-apply',workshopSelected.size?'':'disabled')+'</div>'+
      '<div class="mc-studio-workshop-copy"><strong>Copier depuis le dossier actuellement ouvert dans « Affiches & sources »</strong>'+
      '<p class="mc-studio-hint">Copie uniquement le format et les effets visuels par défaut, sans remplacer les images de chaque dossier.</p>'+
      '<label class="mc-studio-check"><input type="checkbox" data-workshop-copy-art> Copier également les images, fonds, logos et GIF (option explicite)</label>'+
      button('Copier le style du dossier courant','workshop-copy',workshopSelected.size?'':'disabled')+'</div>'+
      '</section></div>';
  }
  function renderGlobalSearch(){
    const hasInput=!!globalQuery.trim()||globalActiveOnly||globalNoCover;
    const found=hasInput?searchDraft(draft,globalQuery,{activeOnly:globalActiveOnly,noCoverOnly:globalNoCover,limit:100}):
      {total:0,results:[],omitted:0};
    const items=found.results.map(item=>'<button type="button" class="mc-studio-global-item" data-action="global-edit" '+
      'data-section="'+esc(item.sectionId)+'" data-id="'+esc(item.folderId)+'">'+
      (item.coverImageUrl?'<img src="'+esc(item.coverImageUrl)+'" loading="lazy" alt="">':
        '<span class="mc-studio-global-empty" aria-hidden="true">▣</span>')+
      '<span class="mc-studio-global-details"><strong>'+esc(item.folderLabel)+'</strong>'+
      '<small>'+esc(item.sectionLabel)+' · '+item.sourceCount+' source'+(item.sourceCount>1?'s':'')+'</small></span>'+
      '<span class="mc-studio-global-status">'+(item.active?'Actif':'Inactif')+'</span>'+
      '<span aria-hidden="true">›</span></button>').join('');
    return '<div class="mc-studio-global-search">'+
      '<h3>Retrouver un dossier</h3><p class="mc-studio-hint">Recherche dans toutes les sections, noms de dossiers et sources sélectionnées. Les accents ne changent pas les résultats.</p>'+
      '<label class="mc-studio-field">Nom de dossier, section ou source'+
      '<input type="search" data-global-search placeholder="Ex. Netflix, Science-fiction, Films…" value="'+esc(globalQuery)+'" autocomplete="off"></label>'+
      '<div class="mc-studio-global-filters"><label class="mc-studio-check"><input type="checkbox" data-global-active '+(globalActiveOnly?'checked':'')+'> Uniquement les dossiers actifs</label>'+
      '<label class="mc-studio-check"><input type="checkbox" data-global-no-cover '+(globalNoCover?'checked':'')+'> Dossiers sans affiche</label></div>'+
      '<p class="mc-studio-global-count">'+(hasInput?found.total+' résultat'+(found.total>1?'s':''):'Entre une recherche ou active un filtre pour afficher les dossiers.')+'</p>'+
      '<div class="mc-studio-global-results">'+(items||'<p class="mc-studio-hint">Aucun dossier correspondant.</p>')+'</div>'+
      (found.omitted?'<p class="mc-studio-hint">+'+found.omitted+' résultats supplémentaires : précise ta recherche.</p>':'')+
      '</div>';
  }
  function renderProfiles(){
    const p=profiles.map(x=>{
      const total=x.sections.reduce((n,c)=>n+c.folders.length,0);
      const active=x.sections.filter(c=>c.enabled).length;
      return '<div class="mc-studio-saved mc-studio-profile-card">'+
        (x.avatarUrl?'<img src="'+esc(x.avatarUrl)+'" alt="" class="mc-studio-profile-picture">':
         '<span class="mc-studio-profile-initial">'+esc(x.name[0]?.toUpperCase()||'P')+'</span>')+
        '<div><strong>'+esc(x.name)+'</strong><small>'+active+' sections actives · '+total+' dossiers</small>'+
        '<small>Préréglage local · '+esc((x.updatedAt||'').slice(0,10))+'</small></div>'+
        button('Choisir →','load-profile','data-id="'+esc(x.id)+'"')+
        '</div>';
    }).join('');
    const name=esc(draft?.name||''),avatar=esc(draft?.avatarUrl||'');
    const cards=backups.map(b=>{
      const time=new Date(b.createdAt);
      const when=Number.isFinite(time.getTime())?
        time.toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}):b.createdAt.slice(0,16);
      return '<div class="mc-studio-backup-item">'+
        '<span class="mc-studio-backup-symbol" aria-hidden="true">↶</span>'+
        '<div class="mc-studio-backup-info"><strong>'+esc(b.name)+'</strong>'+
        '<small>'+esc(when)+' · '+(b.kind==='before-apply'?'Automatique avant application':'Manuelle')+'</small></div>'+
        '<div class="mc-studio-backup-actions">'+
        button('Restaurer','backup-load','data-id="'+esc(b.id)+'"')+
        button('Exporter','backup-export','data-id="'+esc(b.id)+'"')+
        button('Supprimer','backup-delete','data-id="'+esc(b.id)+'"')+
        '</div></div>';
    }).join('');
    const backupsHtml='<section class="mc-studio-backups" aria-label="Historique de sauvegardes">'+
      '<div class="mc-studio-backups-head"><div><h3>Historique de sauvegardes</h3>'+
      '<p class="mc-studio-hint">Jusqu’à 8 sauvegardes dans ce navigateur, même après fermeture. '+
      'Une copie est créée automatiquement avant chaque application. Aucun compte tiers n’est nécessaire.</p></div>'+
      button('Sauvegarder ce brouillon','backup-now')+'</div>'+
      (backupError?'<p class="mc-studio-backup-error" role="alert">'+esc(backupError)+'</p>':'')+
      '<div class="mc-studio-backups-list">'+(cards||'<p class="mc-studio-hint">Aucune sauvegarde pour le moment.</p>')+'</div>'+
      '<p class="mc-studio-hint">« Restaurer » charge un brouillon sans modifier immédiatement ta collection. '+
      'Pour copier une sauvegarde vers un autre appareil, utilise « Exporter » puis « Importer un profil ».</p></section>';
    return '<div class="mc-studio-profile-layout"><div class="mc-studio-column"><div class="mc-studio-heading"><strong>Profil en cours</strong></div>'+
      '<label class="mc-studio-field">Nom du profil<input type="text" data-profile-name maxlength="60" value="'+name+'"></label>'+
      '<label class="mc-studio-field">Avatar du profil (facultatif)<input type="url" data-avatar value="'+avatar+'" placeholder="URL HTTPS de l’avatar"></label>'+
      '<label class="mc-studio-check"><input type="checkbox" data-sync-quick '+(draft.syncQuickEditor?'checked':'')+'> Reporter le nom et l’avatar dans les réglages de l’éditeur rapide lors de l’application</label>'+
      (avatar?'<img class="mc-studio-avatar" src="'+avatar+'" alt="Avatar du profil">':'')+
      '<div class="mc-studio-actions-grid">'+button('Nouveau profil','new')+button('Dupliquer','duplicate')+button('Enregistrer','save')+
      button('Supprimer le profil','delete')+button('Annuler le brouillon','reset')+'</div>'+
      '<p class="mc-studio-hint">Maximum '+STUDIO_LIMIT+' profils dans ce navigateur. Aucun identifiant Nuvio, secret ou clé API n’est conservé dans ces préréglages.</p></div>'+
      '<div class="mc-studio-column"><div class="mc-studio-heading"><strong>Mes profils sauvegardés</strong>'+badge(profiles.length+'/'+STUDIO_LIMIT)+'</div>'+
      '<div class="mc-studio-scroll">'+(p||'<p class="mc-studio-muted">Aucun profil sauvegardé.</p>')+'</div>'+
      '<div class="mc-studio-actions-grid">'+button('Exporter ce profil (.json)','export')+
      button('Importer un profil (.json)','import')+'</div>'+
      '<input data-file type="file" accept="application/json,.json" hidden>'+
      '<p class="mc-studio-hint">L’export et l’import transportent tes préférences vers un autre appareil. Ils ne modifient pas les comptes des applications.</p></div></div>'+backupsHtml;
  }
  function draw(){
    if(!root||!draft)return;
    const body=html();if(!body)return;
    root.querySelector('.mc-studio-title').textContent=draft.name;
    root.querySelectorAll('[data-tab]').forEach(x=>{x.classList.toggle('active',x.dataset.tab===tab);x.setAttribute('aria-selected',String(x.dataset.tab===tab));});
    body.innerHTML=(tab==='organisation'?renderSections():tab==='affiches'?renderArtwork():tab==='apercu'?renderPreview():tab==='recherche'?renderGlobalSearch():tab==='modifications'?renderChanges():tab==='outils'?renderWorkshop():renderProfiles());
    const undo=root.querySelector('[data-action="undo-apply"]');if(undo)undo.hidden=!undoLast;
    const status=root.querySelector('.mc-studio-status');if(status)status.textContent=message;
  }
  function change(e){
    if(!draft)return;
    const el=e.target;
    try{
      if(el.matches('[data-search]')){query=el.value;draw();root.querySelector('[data-search]')?.focus();return;}
      if(el.matches('[data-global-search]')){const caret=el.selectionStart;globalQuery=el.value;draw();const input=root.querySelector('[data-global-search]');input?.focus();if(caret!==null)input?.setSelectionRange(caret,caret);return;}
      if(el.matches('[data-global-active]')){globalActiveOnly=el.checked;draw();return;}
      if(el.matches('[data-global-no-cover]')){globalNoCover=el.checked;draw();return;}
      if(el.matches('[data-workshop-search]')){const caret=el.selectionStart;workshopSearch=el.value;draw();const input=root.querySelector('[data-workshop-search]');input?.focus();if(caret!==null)input?.setSelectionRange(caret,caret);return;}
      if(el.matches('[data-workshop-section]')){workshopSection=el.value;draw();return;}
      if(el.matches('[data-workshop-target]')){const k=el.dataset.workshopTarget;if(el.checked)workshopSelected.add(k);else workshopSelected.delete(k);draw();return;}
      if(el.matches('[data-workshop-mode]')){workshopMode=el.value;draw();return;}
      if(el.matches('[data-workshop-sortsections]')){workshopSortSections=el.checked;draw();return;}
      if(el.matches('[data-workshop-sortfolders]')){workshopSortFolders=el.checked;draw();return;}
      if(el.matches('[data-art-section]')){
        pickSection(el.value);artLookIndex=0;artSearch='';showBatch=false;draw();return;
      }
      if(el.matches('[data-art-search]')){
        artSearch=el.value;draw();root.querySelector('[data-art-search]')?.focus();return;
      }
      if(el.matches('[data-art-other]')){artMoreOnly=el.checked;draw();return;}
      if(el.matches('[data-art-needs]')){artNeedsAttention=el.checked;draw();return;}
      if(el.matches('[data-section-toggle]')){const item=draft.sections.find(x=>x.id===el.dataset.sectionToggle);if(item)setCategoryEnabled(item,el.checked);return;}
      if(el.matches('[data-folder-toggle]')){const f=section()?.folders.find(x=>x.id===el.dataset.folderToggle);if(f){f.enabled=el.checked;if(f.enabled&&!f.selectedKeys.length)f.selectedKeys=(findFolder(section().id,f.id)?.sources||[]).map(sourceKey);}draw();return;}
      if(el.matches('[data-section-label]')){section().label=cleanLabel(el.value);draw();return;}
      if(el.matches('[data-folder-label]')){folder().label=cleanLabel(el.value);draw();return;}
      if(el.matches('[data-profile-name]')){draft.name=cleanLabel(el.value,60);draw();return;}
      if(el.matches('[data-avatar]')){draft.avatarUrl=assetUrl(el.value);draw();return;}
      if(el.matches('[data-sync-quick]')){draft.syncQuickEditor=el.checked;draw();return;}
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
    else if(a==='art-folder'){
      if(section()?.folders.some(f=>f.id===id)){selectedFolder=id;artLookIndex=0;draw();}
    }
    else if(a==='art-prev'||a==='art-next'){
      const looks=availableLooks(folder(),findFolder(selectedSection,selectedFolder));
      if(looks.length>1)artLookIndex=(artLookIndex+(a==='art-next'?1:-1)+looks.length)%looks.length;
      draw();
    }
    else if(a==='art-select'){
      const i=Number(id),looks=availableLooks(folder(),findFolder(selectedSection,selectedFolder));
      if(Number.isInteger(i)&&i>=0&&i<looks.length){artLookIndex=i;draw();}
    }
    else if(a==='art-add'){
      const f=folder();if(!f)return;
      const input=window.prompt('Adresse HTTPS de ta nouvelle affiche (Ma-Art recommandé) :','https://ma-art.mailpromahe.workers.dev/media/');
      if(input===null)return;
      try{
        const url=assetUrl(input);
        if(!url)throw Error('Adresse vide.');
        f.looks ||= [];
        if(!f.looks.some(x=>x.url===url))f.looks.push({label:'Image personnelle '+(f.looks.length+1),url});
        const look=availableLooks(f,findFolder(selectedSection,selectedFolder));
        artLookIndex=look.findIndex(x=>x.url===url);
        message='Image ajoutée au brouillon. Utilise « Utiliser cette affiche » pour la sélectionner.';
      }catch(e){message='Lien refusé : '+e.message;}
      draw();
    }
    else if(a==='art-use'){
      const f=folder(),items=availableLooks(f,findFolder(selectedSection,selectedFolder));
      if(!f||!items[artLookIndex])return;
      f.artwork.coverImageUrl=items[artLookIndex].url;
      artLookIndex=0;
      message='Affiche choisie. Applique ensuite le profil pour l’utiliser dans l’export.';
      draw();
    }
    else if(a==='art-remove'){
      const f=folder(),items=availableLooks(f,findFolder(selectedSection,selectedFolder));
      if(!f||!items[artLookIndex])return;
      f.looks=(f.looks||[]).filter(x=>x.url!==items[artLookIndex].url);
      artLookIndex=0;message='Variante retirée de ce profil, sans supprimer le fichier original.';draw();
    }
    else if(a==='global-edit'){
      if(btn.dataset.section)pickSection(btn.dataset.section);
      if(id && section()?.folders.some(f=>f.id===id)){selectedFolder=id;tab='affiches';}
      else tab='organisation';
      draw();
    }
    else if(a==='undo-apply')undoApplication();
    else if(a==='preview-device'){if(id==='tv'||id==='mobile'){previewDevice=id;draw();}}
    else if(a==='preview-edit'){
      if(btn.dataset.section)pickSection(btn.dataset.section);
      if(id&&section()?.folders.some(f=>f.id===id)){selectedFolder=id;tab='affiches';}
      else tab='organisation';
      draw();
    }
    else if(a==='workshop-select-visible'){
      for(const x of workshopFolders().slice(0,100))workshopSelected.add(x.key);
      message='Dossiers affichés ajoutés à la sélection.';draw();
    }
    else if(a==='workshop-clear'){workshopSelected.clear();message='Sélection effacée.';draw();}
    else if(a==='workshop-undo'){
      if(workshopUndo){draft=workshopUndo;workshopUndo=null;message='Dernière opération de l’atelier annulée dans le brouillon.';draw();}
    }
    else if(a==='workshop-tidy'){
      try{
        const opts={mode:workshopMode,sections:workshopSortSections,folders:workshopSortFolders};
        const plan=studioTidy(draft,opts,true);
        if(!plan.changed)return;
        workshopUndo=copy(draft);
        const result=studioTidy(draft,opts,false);
        message='Rangement appliqué uniquement au brouillon : '+result.sectionsMoved+' sections et '+result.foldersMoved+' dossiers déplacés.';
        draw();
      }catch(error){message='Rangement refusé : '+error.message;draw();}
    }
    else if(a==='workshop-apply'||a==='workshop-copy'){
      try{
        const keys=[...workshopSelected],opts={};
        if(a==='workshop-copy'){
          if(!section()?.folders.some(f=>f.id===selectedFolder))throw Error('Sélectionne d’abord le dossier source dans « Affiches & sources ».');
          opts.copyFrom=studioFolderKey(selectedSection,selectedFolder);
          opts.copyArtwork=!!root.querySelector('[data-workshop-copy-art]')?.checked;
          if(opts.copyArtwork&&!window.confirm('Remplacer volontairement les affiches, fonds, logos et GIF de tous les dossiers sélectionnés par ceux du dossier source ?'))return;
        }else{
          const shape=root.querySelector('[data-workshop-shape]')?.value||'';
          if(shape)opts.shape=shape;
          for(const [field,prop] of [['hideTitle','hide'],['focusGlowEnabled','glow'],['focusGifEnabled','gif']]){
            const value=root.querySelector('[data-workshop-'+prop+']')?.value;
            if(value==='true'||value==='false')opts[field]=value==='true';
          }
        }
        const before=copy(draft),result=studioApplyBatch(draft,keys,opts);
        workshopUndo=before;
        message=result.changed+' dossier(s) modifié(s) sur '+result.selected+' sélectionnés. Aucune source supprimée. Clique sur Appliquer le profil pour exporter.';
        draw();
      }catch(error){message='Modification en lot refusée : '+error.message;draw();}
    }
    else if(a==='batch-open'){showBatch=true;draw();}
    else if(a==='batch-close'){showBatch=false;draw();}
    else if(a==='batch-apply'){
      const sec=section();if(!sec)return;
      const shape=root.querySelector('[data-batch-shape]')?.value;
      if(!STUDIO_SHAPES.includes(shape))return;
      const hide=!!root.querySelector('[data-batch-title]')?.checked;
      const glow=!!root.querySelector('[data-batch-glow]')?.checked;
      const motion=!!root.querySelector('[data-batch-motion]')?.checked;
      for(const folder of sec.folders){
        folder.shape=shape;
        folder.hideTitle=hide;
        folder.focusGlowEnabled=glow;
        folder.focusGifEnabled=motion && !!folder.artwork.focusGifUrl;
      }
      showBatch=false;
      message='Réglages appliqués aux '+sec.folders.length+' dossiers du brouillon. Chaque affiche est préservée.';
      draw();
    }
    else if(a==='section-up'||a==='section-down')move(draft.sections,id,a==='section-up'?-1:1);
    else if(a==='folder-up'||a==='folder-down')move(section().folders,id,a==='folder-up'?-1:1);
    else if(a==='original-art'){
      const f=folder(),real=findFolder(selectedSection,selectedFolder);
      for(const k of STUDIO_FIELDS)f.artwork[k]=String(originals?.[f.id]?.[k]||real?.[k]||'');
      f.shape=originals?.[f.id]?.tileShape||real?.tileShape||'LANDSCAPE';draw();
    }
    else if(a==='diff-organisation'){tab='organisation';draw();}
    else if(a==='diff-artworks'){tab='affiches';draw();}
    else if(a==='backup-now')saveManualBackup();
    else if(a==='backup-load')loadBackup(id);
    else if(a==='backup-export')exportBackup(id);
    else if(a==='backup-delete')deleteBackup(id);
    else if(a==='new')create();
    else if(a==='duplicate')duplicate();
    else if(a==='save'){saveCurrent();draw();}
    else if(a==='delete')remove();
    else if(a==='reset')reset();
    else if(a==='load-profile')choose(id);
    else if(a==='export')exportProfile();
    else if(a==='import')root.querySelector('[data-file]')?.click();
    else if(a==='create-folder'){
      if(window.MaCollectionCustomFolders?.open){
        close();
        window.MaCollectionCustomFolders.open();
      }else{
        message='La création de dossiers est indisponible. Recharge la page.';
        draw();
      }
    }
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
      '<button role="tab" data-tab="apercu">Aperçu accueil</button>'+
      '<button role="tab" data-tab="recherche">Recherche globale</button>'+
      '<button role="tab" data-tab="modifications">Avant / Après</button>'+
      '<button role="tab" data-tab="outils">Outils d’accueil</button>'+
      '<button role="tab" data-tab="profils">Profils & sauvegardes</button></nav>'+
      '<main class="mc-studio-content"></main>'+
      '<div class="mc-studio-status" role="status" aria-live="polite"></div>'+
      '<footer class="mc-studio-footer"><span>Modifications facultatives · Rien ne change avant validation</span>'+
      '<button type="button" class="mc-studio-undo" data-action="undo-apply" hidden>↶ Annuler la dernière application</button>'+
      '<button type="button" class="mc-studio-apply" data-action="apply">Appliquer ce profil à Ma-Collection</button></footer></div>';
    document.body.appendChild(root);
    root.addEventListener('click',e=>{if(e.target===root)close();else click(e);});
    root.addEventListener('dragstart',e=>{
      const el=e.target.closest('[data-drag-kind]');
      if(!el)return;
      dragging={kind:el.dataset.dragKind,id:el.dataset.dragId};
      if(e.dataTransfer){
        e.dataTransfer.effectAllowed='move';
        e.dataTransfer.setData('text/plain',el.dataset.dragId);
      }
    });
    root.addEventListener('dragover',e=>{
      const el=e.target.closest('[data-drag-kind]');
      if(el&&dragging?.kind===el.dataset.dragKind)e.preventDefault();
    });
    root.addEventListener('drop',e=>{
      const el=e.target.closest('[data-drag-kind]');
      if(!el||!dragging||el.dataset.dragKind!==dragging.kind)return;
      e.preventDefault();
      const arr=dragging.kind==='section'?draft?.sections:section()?.folders;
      if(!arr)return;
      const i=arr.findIndex(x=>x.id===dragging.id);
      const j=arr.findIndex(x=>x.id===el.dataset.dragId);
      if(i>=0&&j>=0&&i!==j){
        const [item]=arr.splice(i,1);
        arr.splice(j,0,item);
        message='Ordre modifié dans le brouillon (glisser-déposer).';
        draw();
      }
      dragging=null;
    });
    root.addEventListener('dragend',()=>{dragging=null;});
    root.addEventListener('change',change);
    root.addEventListener('input',e=>{if(e.target.matches('[data-search],[data-global-search],[data-workshop-search]'))change(e);});
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
  function bootstrap(){
    insertCard();
    document.getElementById('se-studio')?.addEventListener('click',open);
    // Le bandeau cinématique est reconstruit à chaque navigation : délégation stable.
    document.addEventListener('click',e=>{
      if(e.target.closest('#preview-studio'))open();
    });
    window.MaCollectionStudio={
      open,
      decorateExport(collections){return applied?decorateExport(collections,applied):collections}
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});else bootstrap();
})();
