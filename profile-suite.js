import {
  SUITE_STORAGE,SUITE_SETTINGS,SUITE_SCHEMA,captureSuiteProfile,validateSuiteProfile,
  sanitizeSuiteState,suiteLocalState,migrateLegacyStudioProfiles,suiteSharePayload,suiteRestoreShared,
  moveSuiteItem,profileSuiteStats,applySuitePreset,suiteProfileChanges
} from './profile-suite-model.mjs';
import {renderSuiteScreen} from './profile-suite-view.mjs';
import {captureDraft} from './studio-avance-core.mjs';
import {makeFolderArt,ART_STYLES,isGeneratedFolderArt} from './studio-art-generator.mjs';
import {normalizeKovelyxProfiles,makeKovelyxLocalCopy,accountDisplayName} from './profile-picker-core.mjs';

/* Espace de travail indépendant. Les paramètres du lecteur non pris en charge
   sont enregistrés localement et exportables, jamais faussement synchronisés. */
(()=>{
  'use strict';
  const copy=v=>JSON.parse(JSON.stringify(v));
  const keySet=new Set(Object.keys(SUITE_SETTINGS));
  let root=null,store=null,draft=null,saved=null,dirty=false,opener=null;
  let screen='profiles',stack=[],notice='',search='',preset='',artSearch='',artRowId='',artFolderId='',artIndex=0;
  let copyName='',copyTarget='new',wizardStep=0,streamSamples='Film 1080p 4 Go\nFilm 2160p HDR 18 Go',streamTestResult='';
  let cloudProfiles=[],cloudLoading=false,cloudError='',cloudRequest=0,showLocalProfiles=false;
  const generated=new Map();
  const rows=()=>draft?.rows||[];
  const currentRow=()=>rows().find(r=>r.id===artRowId)||rows()[0]||null;
  const currentFolder=()=>currentRow()?.folders.find(f=>f.id===artFolderId)||currentRow()?.folders[0]||null;
  const live=()=>Array.isArray(window.collectionData)?window.collectionData:[];
  function seed(){
    let base;
    try{base=captureDraft(live(),window.selectedMap||{},'Ma collection');}
    catch{base={sections:live().map(c=>({id:c.id,label:c.title,enabled:true,
      folders:(c.folders||[]).map(f=>({id:String(f.id),label:f.title,enabled:true,
        selectedKeys:(f.sources||[]).map((x,i)=>String(x.id||i)),artwork:{coverImageUrl:f.coverImageUrl||''}}))}))};}
    return captureSuiteProfile(base,'Ma collection');
  }
  function load(){
    const start=seed();
    let raw=null;
    try{raw=localStorage.getItem(SUITE_STORAGE);
      store=sanitizeSuiteState(raw?JSON.parse(raw):null,start);}
    catch{store=suiteLocalState(start);}
    if(!raw){
      // Les profils de l'ancien Studio sont conservés et convertis UNE fois,
      // uniquement lorsqu'aucune suite locale n'a encore été sauvegardée.
      try{
        const previous=JSON.parse(localStorage.getItem('ma_collection_studio_profiles_v1')||'[]');
        const legacy=migrateLegacyStudioProfiles(previous);
        for(const p of legacy.slice(0,11))store.profiles.push(p);
        if(legacy.length)store.activeId=legacy[0].id;
      }catch{/* Le profil par défaut reste utilisable sans ancien stockage. */}
    }
    saved=copy(store.profiles.find(p=>p.id===store.activeId)||store.profiles[0]);
    draft=copy(saved);copyName=draft.name+' (copie)';
  }
  function persist(){
    try{localStorage.setItem(SUITE_STORAGE,JSON.stringify(store));return true;}
    catch(e){notice='Stockage local indisponible ou plein. Exporte le profil JSON. ('+(e.name||'Erreur')+')';return false;}
  }
  function save(){
    try{
      const next=validateSuiteProfile(draft);
      const i=store.profiles.findIndex(p=>p.id===next.id);
      if(i<0&&store.profiles.length>=12)throw Error('Limite de douze profils atteinte.');
      if(i>=0&&suiteProfileChanges(store.profiles[i],next).count){
        store.backups.unshift(copy(store.profiles[i]));store.backups=store.backups.slice(0,8);
      }
      next.updatedAt=new Date().toISOString();
      if(i>=0)store.profiles[i]=next;else store.profiles.push(next);
      store.activeId=next.id;
      if(!persist())return false;
      saved=copy(next);draft=copy(next);dirty=false;
      notice='Profil sauvegardé localement. Aucun envoi distant effectué.';return true;
    }catch(e){notice=e.message;return false;}
  }
  function coverFor(value){
    const s=String(value||'').trim();
    if(!s||s.length>8192||/kaptain\.stream|imkaptain|kaptainscollection/i.test(s))return '';
    if(s.startsWith('data:'))return isGeneratedFolderArt(s)?s:'';
    if(/^(?:\.\/)?assets\/[a-z0-9_./-]+$/i.test(s)&&!s.includes('..'))return s;
    if(/^https:\/\//i.test(s)&&!/[<>"'\s]/.test(s)&&!s.includes(String.fromCharCode(96)))return s;
    return '';
  }
  function makeCover(name,style){
    const id=style+'|'+name;
    if(generated.has(id))return generated.get(id);
    let url='';
    try{url=makeFolderArt(name,style,'LANDSCAPE');}catch{}
    if(generated.size>120)generated.clear();
    generated.set(id,url);return url;
  }
  function looks(){
    const f=currentFolder();if(!f)return [];
    const choices=[];
    if(coverFor(f.cover))choices.push({url:f.cover,label:'Affiche actuelle',style:''});
    for(const style of ART_STYLES){
      const url=makeCover(f.name,style.id);
      if(url)choices.push({url,label:style.label,style:style.id});
    }
    return choices;
  }
  function context(){
    const row=currentRow(),folder=currentFolder();
    const account=window.MaCollectionAccount;
    const status=account?.status?.()||{};
    return {draft,saved,profiles:store.profiles,backups:store.backups,dirty,search,preset,
      cloudProfiles,showLocalProfiles,account:{signedIn:!!status.cloudSignedIn,loading:cloudLoading,
      error:cloudError,email:accountDisplayName(status.cloudEmail)},
      artSearch,artIndex,artRowId:row?.id||'',artRow:row,artFolder:folder,
      artVariants:looks(),coverFor,copyName,copyTarget,wizardStep,streamSamples,streamTestResult};
  }
  async function refreshCloudProfiles(){
    const account=window.MaCollectionAccount;
    if(!account?.status?.().cloudSignedIn){
      cloudProfiles=[];cloudError='';cloudLoading=false;cloudRequest++;
      if(root&&!root.hidden&&screen==='profiles')render();
      return;
    }
    const request=++cloudRequest;
    cloudLoading=true;cloudError='';
    if(root&&!root.hidden&&screen==='profiles')render();
    try{
      if(typeof account.cloudFetch!=='function')throw Error('Connexion Kovelyx indisponible.');
      const response=await account.cloudFetch('/v1/profiles');
      if(!response?.ok)throw Error('Impossible de charger les profils Kovelyx (HTTP '+(response?.status||'?')+').');
      const result=normalizeKovelyxProfiles(await response.json());
      if(request!==cloudRequest)return;
      cloudProfiles=result;
    }catch(e){
      if(request!==cloudRequest)return;
      cloudProfiles=[];
      cloudError=e?.message||'Chargement des profils impossible.';
    }finally{
      if(request===cloudRequest){
        cloudLoading=false;
        if(root&&!root.hidden&&screen==='profiles')render();
      }
    }
  }
  async function selectCloudProfile(id){
    if(cloudLoading)return;
    const meta=cloudProfiles.find(p=>p.id===id);
    if(!meta)return flash('Profil distant introuvable. Actualise la liste.');
    if(dirty&&!confirm('Ignorer les modifications locales non enregistrées ?'))return;
    if(typeof window.MaCollectionCloudPush?.readProfile!=='function')
      return flash('Lecteur de profils Kovelyx indisponible. Utilise l’éditeur de profil complet.');
    cloudLoading=true;cloudError='';render();
    try{
      const snapshot=await window.MaCollectionCloudPush.readProfile(id);
      const next=makeKovelyxLocalCopy(meta,snapshot);
      const i=store.profiles.findIndex(p=>p.id===next.id);
      if(i>=0&&JSON.stringify(store.profiles[i].rows)!==JSON.stringify(next.rows)){
        if(!confirm('Actualiser la copie locale depuis Kovelyx ? Exporte-la d’abord si tu as des changements à conserver.'))return;
      }
      if(i<0&&store.profiles.length>=12)
        throw Error('Douze profils locaux maximum. Exporte un ancien profil avant d’en ajouter.');
      const original=copy(store),beforeSaved=copy(saved),beforeDraft=copy(draft);
      if(i<0)store.profiles.push(next);else store.profiles[i]=next;
      store.activeId=next.id;
      if(!persist()){
        store=original;saved=beforeSaved;draft=beforeDraft;
        throw Error('Copie de travail trop volumineuse pour le navigateur. Aucune donnée distante modifiée.');
      }
      saved=copy(next);draft=copy(next);dirty=false;copyName=next.name+' (copie)';
      navigate('dashboard',true);
      notice='Profil Kovelyx chargé comme copie de travail. Les modifications sont locales tant qu’elles ne sont pas publiées par l’éditeur complet.';
    }catch(e){cloudError=e?.message||'Chargement du profil impossible.';notice=cloudError;}
    finally{cloudLoading=false;render();}
  }
  function mount(){
    root=document.createElement('div');root.id='mc-profile-suite';
    root.className='mcps-overlay';root.hidden=true;
    root.innerHTML='<div class="mcps-shell" role="dialog" aria-modal="true" aria-label="Studio Ma-Collection">'+
      '<header class="mcps-top"><div class="mcps-top-start"><button type="button" data-suite-back>← Retour</button>'+
      '<span data-suite-active-profile></span></div><strong data-suite-title>Studio</strong>'+
      '<div class="mcps-top-actions"><button type="button" data-suite-action="save" data-suite-save-top class="mcps-primary">Enregistrer</button>'+
      '<button type="button" data-suite-close class="mcps-close" aria-label="Fermer">×</button></div></header>'+
      '<div class="mcps-notice" data-suite-status role="status" hidden></div>'+
      '<main class="mcps-main" data-suite-body></main>'+
      '<input data-suite-upload type="file" accept=".json,application/json" hidden></div>';
    document.body.append(root);
    root.addEventListener('click',click);
    root.addEventListener('change',change);
    root.addEventListener('input',onInput);
  }
  function render(){
    if(!root||!draft)return;
    root.querySelector('[data-suite-active-profile]').textContent=draft.name;
    root.querySelector('[data-suite-title]').textContent=screen==='dashboard'?'Outils et personnalisation':
      screen==='profiles'?'Choisir un profil':screen==='onboarding'?'Assistant guidé':draft.name;
    root.querySelector('[data-suite-back]').hidden=screen==='profiles';
    root.querySelector('[data-suite-back]').textContent=screen==='dashboard'?'← Profils':'← Retour';
    const saveTop=root.querySelector('[data-suite-save-top]');
    saveTop.hidden=['profiles','dashboard'].includes(screen);saveTop.disabled=!dirty;
    root.querySelector('[data-suite-body]').innerHTML=renderSuiteScreen(screen,context());
    root.querySelector('[data-suite-status]').hidden=!notice;
    root.querySelector('[data-suite-status]').textContent=notice;
    root.classList.toggle('mcps-wide',['dashboard','layout','quick','artwork'].includes(screen));
    root.classList.toggle('mcps-artwork-active',screen==='artwork');
  }
  function navigate(next,clear=false){
    if(clear)stack=[];else if(screen!==next)stack.push(screen);
    screen=next;notice='';search='';artSearch='';
    root.querySelector('[data-suite-body]').scrollTop=0;
    render();
  }
  function goBack(){
    if(screen==='profiles')return close();
    if(screen==='dashboard'){navigate('profiles',true);void refreshCloudProfiles();return;}
    if(screen==='onboarding'&&wizardStep>0){wizardStep--;render();return;}
    navigate(stack.pop()||'dashboard',true);
  }
  function selectProfile(id){
    const p=store.profiles.find(x=>x.id===id);if(!p)return;
    if(dirty&&!confirm('Ignorer les changements non enregistrés ?'))return;
    store.activeId=id;persist();saved=copy(p);draft=copy(p);
    dirty=false;copyName=p.name+' (copie)';navigate('dashboard',true);
  }
  function open(page='profiles'){
    if(!store)load();if(!root)mount();
    opener=document.activeElement;root.hidden=false;screen='profiles';stack=[];notice='';showLocalProfiles=false;
    navigate(page,true);
    if(page==='profiles')void refreshCloudProfiles();
    document.addEventListener('keydown',keydown,true);
    root.querySelector('[data-suite-close]').focus();
    if(location.hash.startsWith('#suite=')){
      try{
        draft=suiteRestoreShared(JSON.parse(decodeURIComponent(location.hash.slice(7))),draft);
        dirty=true;navigate('all-settings',true);
        notice='Préférences partagées chargées. Vérifie et enregistre pour confirmer.';render();
      }catch{notice='Lien partagé incompatible.';render();}
    }
  }
  function close(){
    if(!root||root.hidden)return;
    if(dirty&&!confirm('Quitter sans enregistrer les changements ?'))return;
    root.hidden=true;document.removeEventListener('keydown',keydown,true);
    opener?.focus?.();opener=null;
  }
  function keydown(e){
    if(root?.hidden)return;
    if(e.key==='Escape'&&!e.defaultPrevented){e.preventDefault();e.stopPropagation();close();return;}
    if(e.key!=='Tab')return;
    const all=[...root.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')]
      .filter(x=>x.getClientRects().length&&!x.closest('[hidden]'));
    if(!all.length)return;
    const index=all.indexOf(document.activeElement);
    const next=index<0?(e.shiftKey?all.length-1:0):
      (index+(e.shiftKey?-1:1)+all.length)%all.length;
    e.preventDefault();all[next].focus();
  }
  function flash(text){notice=text;render();}
  function setting(key,value){
    if(!keySet.has(key))return;
    const kind=typeof SUITE_SETTINGS[key];
    const v=kind==='boolean'?!!value:kind==='number'?Number(value):String(value).slice(0,key==='posterUrl'?350:80);
    if(kind==='number'&&!Number.isFinite(v))return;
    if(key==='posterUrl'&&v&&!(/^https:\/\/[^<>"'\s]+$/i.test(v)&&!/kaptain\.stream/i.test(v))){
      flash('Utilise une adresse HTTPS autorisée et indépendante de Kaptain.');return;
    }
    if(key==='subtitleColor'&&!/^#[0-9a-f]{6}$/i.test(v))return;
    draft.settings[key]=v;dirty=true;
    if(key==='playerStyle'){
      draft.settings.loadingDetails=v!=='minimal';draft.settings.pauseScreen=v!=='minimal';
      draft.settings.playerClock=v!=='minimal';
    }
    if(key==='subtitlePreset'){
      draft.settings.subtitleFontSize={standard:24,readable:30,contrast:30,cinema:21,minimal:19}[v]||24;
      draft.settings.subtitleOutline=v!=='minimal';
      draft.settings.subtitleBackOpacity=v==='contrast'?75:0;
    }
    if(key==='streamPreset')draft.settings.streamSelection=v==='fast'?'first':v==='best'?'quality':'ask';
  }
  function download(name,profile){
    const blob=new Blob([JSON.stringify(profile,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name.replace(/[^a-z0-9_.-]/gi,'-');document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  function loadFile(file){
    if(!file)return;
    if(file.size>2*1024*1024)return flash('Import refusé : 2 Mo maximum.');
    file.text().then(data=>{
      const p=validateSuiteProfile(JSON.parse(data));p.id='mcps-import-'+Date.now().toString(36);
      if(store.profiles.length>=12)throw Error('Douze profils maximum.');
      store.profiles.push(p);store.activeId=p.id;
      if(!persist()){store.profiles.pop();return;}
      saved=copy(p);draft=copy(p);dirty=false;navigate('dashboard',true);
      notice='Profil importé et conservé localement.';render();
    }).catch(e=>flash('Import refusé : '+e.message));
  }
  function openExternal(mode){
    root.hidden=true;document.removeEventListener('keydown',keydown,true);
    if(mode==='studio')window.MaCollectionStudio?.open('organisation');
    else if(mode==='art-fr')window.MaCollectionStudio?.open('affiches-fr');
    else if(mode==='addons')window.MaCollectionStudio?.open('extensions');
    else if(mode==='history')window.MaCollectionProfileHistory?.open();
    else if(mode==='account')window.MaCollectionAccountUi?.openModal?.('cloud');
    else if(mode==='profile'){
      const cloudId=draft?.id?.startsWith('mcps-cloud-')?draft.id.slice('mcps-cloud-'.length):undefined;
      window.MaCollectionProfileEditor?.open({account:true,profileId:cloudId});
    }
    else if(mode==='update')window.MaCollectionProfileEditor?.open({update:true});
    else if(mode==='folder')window.MaCollectionCustomFolders?.open();
    else if(mode==='wizard')window.startCustomize?.();
    else if(mode==='posters')window.MaCollectionImportStudio?.open('kovelyx');
  }
  function review(){
    if(typeof window.MaCollectionStudio?.reviewExternalLayout!=='function')
      return flash('Le pont vers les rangées réelles est indisponible. Exporte un JSON.');
    if(dirty&&!save())return;
    const changes=copy(rows());
    root.hidden=true;document.removeEventListener('keydown',keydown,true);
    window.MaCollectionStudio.reviewExternalLayout({rows:changes});
  }
  function pickFolder(key){
    const split=key.indexOf('|');
    if(split<0)return;
    const rowId=key.slice(0,split),folderId=key.slice(split+1);
    if(!rows().some(r=>r.id===rowId&&r.folders.some(f=>f.id===folderId)))return;
    artRowId=rowId;artFolderId=folderId;artIndex=0;navigate('artwork');
  }
  async function click(e){
    const button=e.target.closest('button');
    if(!button||!root.contains(button))return;
    if(button.hasAttribute('data-suite-close'))return close();
    if(button.hasAttribute('data-suite-back'))return goBack();
    if(button.dataset.suiteGo)return navigate(button.dataset.suiteGo);
    if(button.dataset.suiteSelect)return selectProfile(button.dataset.suiteSelect);
    if(button.hasAttribute('data-suite-cloud-select')){
      void selectCloudProfile(button.dataset.suiteCloudSelect);return;
    }
    if(button.dataset.suiteFolder)return pickFolder(button.dataset.suiteFolder);
    if(button.dataset.suiteFolderUp||button.dataset.suiteFolderDown){
      const raw=button.dataset.suiteFolderUp||button.dataset.suiteFolderDown;
      const pos=raw.indexOf('|'),row=rows().find(r=>r.id===raw.slice(0,pos));
      if(row&&moveSuiteItem(row.folders,raw.slice(pos+1),button.dataset.suiteFolderUp?-1:1)){dirty=true;render();}
      return;
    }
    if(button.dataset.suiteChoice){
      setting(button.dataset.suiteChoice,button.dataset.value);render();return;
    }
    if(button.dataset.suitePreset){preset=button.dataset.suitePreset;render();return;}
    if(button.dataset.suiteArtIndex){artIndex=Number(button.dataset.suiteArtIndex)||0;render();return;}
    if(button.dataset.suiteCopyTarget){
      copyTarget=button.dataset.suiteCopyTarget;
      root.querySelectorAll('[data-suite-copy-target]').forEach(b=>b.classList.toggle('chosen',b===button));
      return;
    }
    const action=button.dataset.suiteAction,id=button.dataset.id||'';
    if(!action)return;
    switch(action){
      case 'save':save();break;
      case 'new-profile':{
        if(dirty&&!confirm('Abandonner les modifications ?'))return;
        if(store.profiles.length>=12)return flash('Douze profils maximum.');
        const p=seed();p.name='Nouveau profil';store.profiles.push(p);store.activeId=p.id;
        if(!persist()){store.profiles.pop();return;}
        saved=copy(p);draft=copy(p);dirty=false;navigate('dashboard',true);return;
      }
      case 'backup':
        store.backups.unshift(copy(draft));store.backups=store.backups.slice(0,8);
        if(!persist())return;notice='Sauvegarde locale créée.';break;
      case 'export':download('ma-collection-profil-'+Date.now()+'.json',validateSuiteProfile(draft));break;
      case 'export-backup':
        if(store.backups[Number(id)])download('ma-collection-sauvegarde-'+id+'.json',store.backups[Number(id)]);break;
      case 'restore-backup':{
        const b=store.backups[Number(id)];
        if(!b||!confirm('Charger cette sauvegarde dans le brouillon ?'))return;
        draft=copy(b);draft.id=saved.id;dirty=true;notice='Sauvegarde chargée. Enregistre pour confirmer.';break;
      }
      case 'import':root.querySelector('[data-suite-upload]').click();break;
      case 'refresh-cloud':void refreshCloudProfiles();return;
      case 'show-local':showLocalProfiles=!showLocalProfiles;render();return;
      case 'sign-out':{
        if(!confirm('Déconnecter ce navigateur de ton compte Kovelyx ? Les profils locaux seront conservés.'))return;
        const account=window.MaCollectionAccount;
        if(!account?.cloudLogout)return flash('Déconnexion indisponible.');
        cloudLoading=true;render();
        try{await account.cloudLogout();}catch(e){notice='Déconnexion locale effectuée, révocation distante non confirmée.';}
        void refreshCloudProfiles();
        return;
      }
      case 'edit-remote-profile':return openExternal('profile');
      case 'row-enable':{
        const r=rows().find(x=>x.id===id);if(r){r.enabled=!r.enabled;dirty=true;}break;
      }
      case 'row-up':case 'row-down':if(moveSuiteItem(rows(),id,action==='row-up'?-1:1))dirty=true;break;
      case 'row-rename':{
        const r=rows().find(x=>x.id===id);if(!r)return;
        const name=prompt('Nom de la rangée',r.name);
        if(name?.trim()){r.name=name.trim().slice(0,85);dirty=true;}break;
      }
      case 'row-open':
        artRowId=id;artFolderId=rows().find(r=>r.id===id)?.folders[0]?.id||'';artIndex=0;
        return navigate('artwork');
      case 'tidy-layout':rows().sort((a,b)=>Number(b.enabled)-Number(a.enabled));dirty=true;break;
      case 'all-on':case 'all-off':
        for(const r of rows()){r.enabled=action==='all-on';for(const f of r.folders)f.enabled=r.enabled;}
        dirty=true;break;
      case 'art-prev-folder':case 'art-next-folder':{
        const r=currentRow(),i=r?.folders.findIndex(f=>f.id===currentFolder()?.id)??-1;
        if(!r?.folders.length)return;
        artFolderId=r.folders[(i+(action==='art-prev-folder'?-1:1)+r.folders.length)%r.folders.length].id;
        artIndex=0;break;
      }
      case 'art-prev':case 'art-next':{
        const len=looks().length;if(len)artIndex=(artIndex+(action==='art-prev'?-1:1)+len)%len;break;
      }
      case 'art-use':{
        const f=currentFolder(),v=looks()[artIndex];
        if(f&&v?.url){f.cover=v.url;dirty=true;notice='Affiche ajoutée au brouillon.';}break;
      }
      case 'art-own':{
        const url=prompt('Adresse HTTPS personnelle de l’affiche :','https://');
        if(url===null)return;
        const candidate=coverFor(url);if(!candidate)return flash('Adresse non autorisée ou invalide.');
        const f=currentFolder();if(f){f.cover=candidate;artIndex=0;dirty=true;}break;
      }
      case 'art-apply-row':{
        const v=looks()[artIndex],r=currentRow();
        if(!v?.style||!r)return flash('Choisis un style Ma-Collection pour cette action.');
        if(!confirm('Appliquer ce style aux '+r.folders.length+' dossiers ?'))return;
        for(const f of r.folders)f.cover=makeCover(f.name,v.style);
        dirty=true;break;
      }
      case 'review-layout':return review();
      case 'apply-preset':
        try{draft.settings=applySuitePreset(draft.settings,preset);dirty=true;
          notice='Réglages du préréglage appliqués au brouillon.';}
        catch(e){notice=e.message;}break;
      case 'copy-profile':{
        const name=copyName.trim().slice(0,60);if(!name)return flash('Nom de copie requis.');
        if(copyTarget==='new'&&store.profiles.length>=12)return flash('Douze profils maximum.');
        if(copyTarget!=='new'&&!confirm('Remplacer ce profil ? Une sauvegarde sera créée.'))return;
        const next=copy(draft);next.id=copyTarget==='new'?'mcps-copy-'+Date.now().toString(36):copyTarget;
        next.name=name;next.updatedAt=new Date().toISOString();
        const i=store.profiles.findIndex(x=>x.id===next.id);
        if(i<0)store.profiles.push(next);
        else {store.backups.unshift(copy(store.profiles[i]));store.profiles[i]=next;}
        store.backups=store.backups.slice(0,8);store.activeId=next.id;
        if(!persist())return;
        saved=copy(next);draft=copy(next);dirty=false;copyName=name+' (copie)';
        navigate('dashboard',true);notice='Copie créée sur cet appareil.';break;
      }
      case 'share-link':{
        const payload=encodeURIComponent(JSON.stringify(suiteSharePayload(draft)));
        const link=location.origin+location.pathname+'#suite='+payload;
        if(link.length>6000)return flash('Lien trop long : utilise le fichier JSON.');
        if(navigator.clipboard?.writeText)navigator.clipboard.writeText(link)
          .then(()=>flash('Lien copié, sans secrets.')).catch(()=>prompt('Copie ce lien',link));
        else prompt('Copie ce lien',link);
        return;
      }
      case 'optimize-device':{
        const s=draft.settings;
        if(['tv-basic','stick'].includes(s.device)){
          s.playerStyle='minimal';s.loadingDetails=false;s.qualityBadges=false;
          s.preferHdr=false;s.streamMaxGb=s.networkMbps<25?5:15;
        }else if(['tv-high','desktop'].includes(s.device)){
          s.playerStyle='informative';s.streamMaxGb=s.networkMbps>=50?60:25;s.preferHdr=true;
        }else{s.playerStyle='minimal';s.streamMaxGb=15;}
        dirty=true;notice='Réglages préparés localement pour cet appareil.';break;
      }
      case 'test-streams':{
        const all=streamSamples.split('\n').map(x=>x.trim()).filter(Boolean);
        if(!all.length)return flash('Entre au moins un exemple de flux.');
        const score=x=>(/2160p|4k/i.test(x)?3:/1080p/i.test(x)?2:/720p/i.test(x)?1:0)+(/HDR/i.test(x)?0.2:0);
        const best=draft.settings.streamSelection==='quality'?[...all].sort((a,b)=>score(b)-score(a))[0]:all[0];
        streamTestResult=draft.settings.streamSelection==='ask'?
          'Sélection manuelle : '+all.length+' exemples disponibles.':'Exemple retenu : '+best;
        break;
      }
      case 'open-original-studio':return openExternal('studio');
      case 'open-french-art':return openExternal('art-fr');
      case 'open-guided':return openExternal('wizard');
      case 'open-addon-manifests':return openExternal('addons');
      case 'open-poster-import':return openExternal('posters');
      case 'open-create-folder':return openExternal('folder');
      case 'open-account':return openExternal('account');
      case 'open-profile-editor':return openExternal('profile');
      case 'open-history':return openExternal('history');
      case 'open-update':return openExternal('update');
      case 'wizard-current':wizardStep=1;break;
      case 'wizard-customize':return openExternal('wizard');
      case 'wizard-back':wizardStep=Math.max(0,wizardStep-1);break;
      case 'wizard-next':wizardStep=Math.min(4,wizardStep+1);break;
      case 'wizard-finish':
        if(dirty&&!save())return;
        navigate('dashboard',true);notice='Configuration locale sauvegardée.';break;
      default:return;
    }
    render();
  }
  function change(e){
    const el=e.target;
    if(el.matches('[data-suite-upload]')){loadFile(el.files?.[0]);el.value='';return;}
    if(el.matches('[data-suite-field="artFilter"]')){
      artRowId=el.value;artFolderId=currentRow()?.folders[0]?.id||'';artIndex=0;render();return;
    }
    if(el.matches('[data-suite-field]')){
      setting(el.dataset.suiteField,el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value);
      render();return;
    }
    if(el.matches('[data-suite-folder-check]')){
      const [rid,fid]=el.dataset.suiteFolderCheck.split('|');
      const f=rows().find(r=>r.id===rid)?.folders.find(x=>x.id===fid);
      if(f){f.enabled=el.checked;dirty=true;render();}
    }
  }
  function updateInput(el,selector){
    const pos=el.selectionStart,main=root.querySelector('[data-suite-body]'),top=main.scrollTop;
    render();const newEl=root.querySelector(selector);
    if(newEl){newEl.replaceWith(el);el.focus({preventScroll:true});if(pos!==null)el.setSelectionRange(pos,pos);}
    main.scrollTop=top;
  }
  function onInput(e){
    const el=e.target;
    if(el.matches('[data-suite-search]')){search=el.value;updateInput(el,'[data-suite-search]');return;}
    if(el.matches('[data-suite-art-search]')){
      artSearch=el.value;
      const f=currentRow()?.folders.find(x=>x.name.toLowerCase().includes(artSearch.toLowerCase()));
      if(f){artFolderId=f.id;artIndex=0;}
      updateInput(el,'[data-suite-art-search]');return;
    }
    if(el.matches('[data-suite-copy-name]')){copyName=el.value;return;}
    if(el.matches('[data-suite-profile-name]')){draft.name=el.value.slice(0,60);dirty=true;return;}
    if(el.matches('[data-suite-stream-samples]')){streamSamples=el.value.slice(0,1200);return;}
    if(el.matches('[data-suite-field]')&&el.type==='range'){
      setting(el.dataset.suiteField,Number(el.value));
      const label=root.querySelector('[data-suite-range-label="'+el.dataset.suiteField+'"]');
      if(label)label.textContent=el.value;
      const sub=root.querySelector('.mcps-subtitle-scene span');
      if(sub){sub.style.fontSize=draft.settings.subtitleFontSize+'px';sub.style.bottom=draft.settings.subtitleVertical*2+'px';
        sub.style.backgroundColor='rgba(0,0,0,'+draft.settings.subtitleBackOpacity/100+')';}
      root.querySelector('[data-suite-save-top]').disabled=false;
    }
  }
  window.MaCollectionProfileSuite=Object.freeze({
    open,close,isOpen:()=>!!root&&!root.hidden,
    stats:()=>draft?profileSuiteStats(draft):null,
    saved:()=>saved?copy(saved):null
  });
})();
