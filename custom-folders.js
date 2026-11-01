/**
 * Ma-Collection — dossiers TMDB personnalisés.
 * Module facultatif : n'altère pas les 20 catégories ni les dossiers fournis.
 * Les nouveaux dossiers sont locaux, exportables, et jamais téléchargés de Kaptain.
 */
(() => {
  'use strict';
  const KEY = 'ma_collection_custom_folders_v1';
  const MAX = 100;
  const TYPES = Object.freeze({
    COLLECTION: {label:'Saga / collection de films',mediaType:'MOVIE'},
    LIST: {label:'Liste TMDB',mediaType:'MOVIE'},
    COMPANY: {label:'Studio de cinéma',mediaType:'MOVIE'},
    NETWORK: {label:'Chaîne TV',mediaType:'TV'},
    ACTOR: {label:'Acteur / actrice',mediaType:'MOVIE'},
    DIRECTOR: {label:'Réalisateur / réalisatrice',mediaType:'MOVIE'},
    STREAMING: {label:'Service de streaming',mediaType:'MOVIE'}
  });
  let panel = null;

  function validateArtwork(value) {
    if (!value) return true;
    if (typeof value !== 'string' || value.length > 1700) return false;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) return false;
      if (url.hostname === 'ma-art.mailpromahe.workers.dev') {
        return /^\/(?:media|collection-cards)\//.test(url.pathname);
      }
      if (url.hostname === 'image.tmdb.org') {
        return /^\/t\/p\/(?:w\d+|original)\/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/.test(url.pathname);
      }
    } catch (_) {}
    return false;
  }
  function validateRecord(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id=String(raw.id||'');
    const title=String(raw.title||'').trim();
    const tmdbId=Number(raw.tmdbId);
    const categoryId=String(raw.categoryId||'');
    const type=String(raw.type||'');
    const mediaType=String(raw.mediaType||'');
    const region=String(raw.region||'FR').trim().toUpperCase();
    const coverImageUrl=String(raw.coverImageUrl||'').trim();
    const heroBackdropUrl=String(raw.heroBackdropUrl||'').trim();
    const tileShape=String(raw.tileShape||'POSTER');
    if (!/^folder-personal-[a-z0-9-]{5,70}$/.test(id) ||
        !title || title.length>100 || /[<>]/.test(title) ||
        !/^[\w-]{3,85}$/.test(categoryId) || !TYPES[type] ||
        !Number.isSafeInteger(tmdbId) || tmdbId<1 || tmdbId>999999999 ||
        !['MOVIE','TV'].includes(mediaType) ||
        !/^[A-Z]{2}$/.test(region) ||
        !['POSTER','LANDSCAPE','SQUARE'].includes(tileShape) ||
        !validateArtwork(coverImageUrl) || !validateArtwork(heroBackdropUrl)) return null;
    return {id,title,categoryId,type,tmdbId,mediaType,region,coverImageUrl,heroBackdropUrl,tileShape};
  }

  function readRecords() {
    try {
      const a=JSON.parse(localStorage.getItem(KEY)||'[]');
      return Array.isArray(a) ? a.slice(0,MAX).map(validateRecord).filter(Boolean) : [];
    } catch (_) { return []; }
  }
  function writeRecords(records) {
    try { localStorage.setItem(KEY,JSON.stringify(records)); return true; }
    catch (_) { return false; }
  }
  function dataset() {
    const data=window.NUVIO_DATABASE || window.collectionData;
    return Array.isArray(data)?data:[];
  }
  function createSource(record) {
    const id='src-personal-'+record.id.slice('folder-personal-'.length);
    const base={
      id,title:record.title,name:record.title,genre:record.title,
      provider:'tmdb',mediaType:record.mediaType,sortBy:'popularity.desc',filters:{}
    };
    const n=String(record.tmdbId);
    switch(record.type) {
      case 'COLLECTION':
        return {...base,mediaType:'MOVIE',tmdbSourceType:'COLLECTION',tmdbId:record.tmdbId,sortBy:'original'};
      case 'LIST':
        return {...base,tmdbSourceType:'LIST',tmdbId:record.tmdbId,sortBy:'original'};
      case 'COMPANY':
        return {...base,mediaType:'MOVIE',tmdbSourceType:'COMPANY',tmdbId:record.tmdbId};
      case 'NETWORK':
        return {...base,mediaType:'TV',tmdbSourceType:'DISCOVER',tmdbId:null,filters:{withNetworks:n}};
      case 'ACTOR':
        return {...base,mediaType:'MOVIE',tmdbSourceType:'DISCOVER',tmdbId:null,filters:{withCast:n}};
      case 'DIRECTOR':
        return {...base,mediaType:'MOVIE',tmdbSourceType:'DISCOVER',tmdbId:null,filters:{withCrew:n}};
      case 'STREAMING':
        return {...base,tmdbSourceType:'DISCOVER',tmdbId:null,filters:{
          withWatchProviders:n,with_watch_providers:n,
          watchRegion:record.region,watch_region:record.region
        }};
      default: return null;
    }
  }
  function createFolder(record) {
    const source=createSource(record);
    return {
      id:record.id,title:record.title,hideTitle:false,
      tileShape:record.tileShape,coverImageUrl:record.coverImageUrl,
      heroBackdropUrl:record.heroBackdropUrl,titleLogoUrl:'',
      focusGifEnabled:false,focusGlowEnabled:false,sources:source?[source]:[]
    };
  }
  function insertSavedFolders() {
    const data=dataset();
    if (!data.length) return;
    const seen=new Set(data.flatMap(c=>(c.folders||[]).map(f=>f.id)));
    for (const record of readRecords()) {
      if (seen.has(record.id)) continue;
      const category=data.find(c=>c.id===record.categoryId);
      if (!category || !Array.isArray(category.folders)) continue;
      category.folders.push(createFolder(record));
      seen.add(record.id);
    }
  }
  function refresh() {
    if (typeof syncEditorViews==='function') syncEditorViews();
    else {
      if (typeof renderSidebar==='function') renderSidebar();
      if (typeof renderFolderGrid==='function') renderFolderGrid();
      if (typeof renderPreviewCollection==='function') renderPreviewCollection();
    }
    if (typeof updateControlCenterStats==='function') updateControlCenterStats();
  }
  function createRecord(input) {
    const categories=dataset();
    if (readRecords().length>=MAX) return {ok:false,message:'Limite de 100 dossiers personnalisés atteinte.'};
    const id='folder-personal-'+Math.random().toString(36).slice(2,12)+Date.now().toString(36);
    const item=validateRecord({...input,id});
    if (!item) return {ok:false,message:'Vérifie les champs, l’identifiant TMDB et les adresses d’image.'};
    const category=categories.find(c=>c.id===item.categoryId);
    if (!category || !Array.isArray(category.folders)) return {ok:false,message:'Catégorie indisponible.'};
    if (category.folders.some(f=>String(f.title||'').toLowerCase()===item.title.toLowerCase())) {
      return {ok:false,message:'Un dossier porte déjà ce nom dans cette catégorie.'};
    }
    const records=readRecords();
    if (!writeRecords([...records,item])) return {ok:false,message:'Stockage local indisponible. Rien n’a été modifié.'};
    const folder=createFolder(item);
    category.folders.push(folder);
    if (typeof selectedMap!=='undefined') {
      const key=typeof getSourceKey==='function'?getSourceKey(folder.sources[0]):item.title;
      selectedMap[folder.id]={[key]:true};
    }
    refresh();
    return {ok:true,folder};
  }
  function deleteRecord(id) {
    const records=readRecords();
    if (!records.some(r=>r.id===id)) return false;
    if (!writeRecords(records.filter(r=>r.id!==id))) return false;
    for (const c of dataset()) {
      if (!Array.isArray(c.folders)) continue;
      const i=c.folders.findIndex(f=>f.id===id);
      if (i>=0) c.folders.splice(i,1);
    }
    if (typeof selectedMap!=='undefined') delete selectedMap[id];
    refresh();
    return true;
  }

  function close() {
    if (!panel) return;
    panel.remove();
    panel=null;
    document.removeEventListener('keydown',esc,true);
  }
  function esc(e) { if (e.key==='Escape') {e.preventDefault();close();} }
  function open() {
    close();
    const root=document.createElement('div');
    root.className='mc-folder-overlay';
    root.innerHTML=[
      '<section class="mc-folder-dialog" role="dialog" aria-modal="true" aria-labelledby="mc-folder-heading">',
      '<header class="mc-folder-head"><div><span class="mc-folder-overline">Personnalisation indépendante</span>',
      '<h2 id="mc-folder-heading">Créer un dossier</h2><p>Ajoute tes propres catalogues TMDB sans modifier les dossiers existants.</p></div>',
      '<button class="mc-folder-close" type="button" aria-label="Fermer">×</button></header>',
      '<form class="mc-folder-form"><div class="mc-folder-fields">',
      '<label>Nom du dossier<input name="title" type="text" maxlength="100" required placeholder="Ex. : Mes films favoris"></label>',
      '<label>Catégorie de destination<select name="categoryId" required></select></label>',
      '<label>Type de catalogue<select name="type" required></select></label>',
      '<label>Identifiant TMDB<input name="tmdbId" type="number" min="1" max="999999999" step="1" required placeholder="Identifiant numérique"></label>',
      '<label>Films ou séries<select name="mediaType"><option value="MOVIE">Films</option><option value="TV">Séries TV</option></select></label>',
      '<label class="mc-folder-region" hidden>Pays du streaming<input name="region" type="text" pattern="[A-Za-z]{2}" maxlength="2" value="FR"></label>',
      '<label>Couverture (facultatif)<input name="coverImageUrl" type="url" placeholder="URL HTTPS Ma-Art ou TMDB"></label>',
      '<label>Fond (facultatif)<input name="heroBackdropUrl" type="url" placeholder="URL HTTPS Ma-Art ou TMDB"></label>',
      '<label>Format<select name="tileShape"><option value="POSTER">Affiche verticale</option><option value="LANDSCAPE">Paysage</option><option value="SQUARE">Carré</option></select></label>',
      '</div><p class="mc-folder-note">Les images existantes ne sont jamais modifiées. Pour rester indépendant de Kaptain, utilise Ma-Art. Une image TMDB dépend de TMDB.</p>',
      '<p class="mc-folder-message" role="status" aria-live="polite"></p>',
      '<footer class="mc-folder-actions"><button type="button" class="mc-folder-cancel">Annuler</button>',
      '<button type="submit" class="mc-folder-create">Créer mon dossier</button></footer></form>',
      '<section class="mc-folder-existing"><h3>Mes dossiers personnalisés</h3>',
      '<div class="mc-folder-items"></div></section></section>'
    ].join('');
    document.body.appendChild(root);
    panel=root;
    const form=root.querySelector('form');
    const cats=form.elements.categoryId;
    for(const c of dataset()) {
      if(!c.id || !Array.isArray(c.folders))continue;
      const o=document.createElement('option');
      o.value=c.id;o.textContent=c.title;cats.appendChild(o);
    }
    const current=typeof currentCategoryIdx==='number'?dataset()[currentCategoryIdx]:null;
    if(current && current.id)cats.value=current.id;
    const types=form.elements.type;
    for(const [type,meta] of Object.entries(TYPES)){
      const o=document.createElement('option');
      o.value=type;o.textContent=meta.label;types.appendChild(o);
    }
    const media=form.elements.mediaType;
    const region=form.querySelector('.mc-folder-region');
    function syncType(){
      const type=types.value;
      const fixed=TYPES[type]?.mediaType;
      media.disabled=type!=='LIST' && type!=='STREAMING';
      if(media.disabled)media.value=fixed||'MOVIE';
      region.hidden=type!=='STREAMING';
    }
    types.addEventListener('change',syncType);
    syncType();
    const status=root.querySelector('.mc-folder-message');
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const f=form.elements;
      const choice={
        title:f.title.value,categoryId:f.categoryId.value,type:f.type.value,
        tmdbId:f.tmdbId.value,mediaType:f.mediaType.value,region:f.region.value,
        coverImageUrl:f.coverImageUrl.value,heroBackdropUrl:f.heroBackdropUrl.value,
        tileShape:f.tileShape.value
      };
      const result=createRecord(choice);
      if(!result.ok){status.textContent=result.message;return;}
      close();
      if(typeof showToast==='function')showToast('Dossier personnalisé ajouté à la collection et aux exports.','success');
    });
    function renderExisting(){
      const list=root.querySelector('.mc-folder-items');
      list.replaceChildren();
      const records=readRecords();
      if(!records.length){
        const p=document.createElement('p');p.textContent='Aucun dossier créé pour le moment.';list.appendChild(p);return;
      }
      for(const item of records){
        const row=document.createElement('div');
        row.className='mc-folder-item';
        const name=document.createElement('span');
        name.textContent=item.title;
        const remove=document.createElement('button');
        remove.type='button';remove.textContent='Supprimer';
        remove.setAttribute('aria-label','Supprimer '+item.title);
        remove.addEventListener('click',()=>{
          if(!window.confirm('Supprimer uniquement ton dossier « '+item.title+' » ?'))return;
          if(deleteRecord(item.id))renderExisting();
          else status.textContent='La suppression a échoué.';
        });
        row.append(name,remove);list.appendChild(row);
      }
    }
    renderExisting();
    root.querySelector('.mc-folder-close').addEventListener('click',close);
    root.querySelector('.mc-folder-cancel').addEventListener('click',close);
    root.addEventListener('click',e=>{if(e.target===root)close();});
    document.addEventListener('keydown',esc,true);
    form.elements.title.focus();
  }

  // Au démarrage, insérer avant que Ma-Collection initialise ses sélection et exports.
  const originalInit=window.initializeDatabase;
  if(typeof originalInit==='function'){
    window.initializeDatabase=function(){
      insertSavedFolders();
      return originalInit.apply(this,arguments);
    };
  }

  function addBtn(container,id){
    if(!container || container.querySelector('#'+id))return;
    const btn=document.createElement('button');
    btn.type='button';btn.id=id;btn.className='cat-action-btn mc-folder-trigger';
    btn.textContent='+ Dossier';
    btn.title='Créer un dossier personnalisé à partir de TMDB';
    btn.addEventListener('click',open);
    container.appendChild(btn);
  }
  const categoryRender=window.renderCategoryActions;
  if(typeof categoryRender==='function'){
    window.renderCategoryActions=function(){
      const result=categoryRender.apply(this,arguments);
      addBtn(document.getElementById('category-actions-group'),'mc-folder-add-browse');
      return result;
    };
  }
  const previewRender=window.renderPreviewCollection;
  if(typeof previewRender==='function'){
    window.renderPreviewCollection=function(){
      const result=previewRender.apply(this,arguments);
      addBtn(document.querySelector('#nv-preview-secondary'),'mc-folder-add-preview');
      return result;
    };
  }
  window.MaCollectionCustomFolders={
    validateRecord,createSource,createFolder,createRecord,deleteRecord,readRecords,insertSavedFolders,open
  };
})();