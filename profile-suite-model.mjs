/**
 * Ma-Collection — Suite Profil. Modèle local indépendant.
 * Les paramètres incompatibles avec l'application installée ne sont jamais
 * présentés comme synchronisés : leur export est explicite.
 */
export const SUITE_SCHEMA=1;
export const SUITE_STORAGE='ma_collection_profile_suite_v1';
export const SUITE_PAGES=Object.freeze([
  ['layout','Écran d’accueil','Organise les rangées et leurs affiches','collection','house'],
  ['quick','Éditeur rapide','Désactive et réorganise tes dossiers','collection','list-check'],
  ['artwork','Affiches','Compare et remplace les illustrations','collection','palette'],
  ['add','Ajouter des rangées et dossiers','Parcours les catégories et crée tes dossiers','collection','layers'],
  ['addons','Extensions','Inspecte les quatre services de ton installation','streaming','boxes'],
  ['streaming','Streaming','Choisis ton service et prépare tes extensions','streaming','play'],
  ['poster','Style des affiches','Configure la provenance et l’aspect des affiches','style','image'],
  ['backups','Sauvegardes et mises à jour','Archive et restaure ton profil local','profile','archive'],
  ['history','Historique de lecture','Ouvre la bibliothèque de ton compte Kovelyx','profile','history'],
  ['performance','Performance des appareils','Prépare les réglages de ton matériel','settings','gauge'],
  ['filters','Filtres de contenu','Pays, langue, popularité et exclusions','settings','sliders'],
  ['language','Langue','Langues des affiches et des catalogues','settings','globe'],
  ['subtitles','Sous-titres','Aperçu et réglage du style et des langues','settings','captions'],
  ['stream-picker','Sélection des flux','Priorités et sélection automatique','streaming','list-video'],
  ['autoplay','Lecture et épisode suivant','Enchaînement, intros et génériques','settings','skip-forward'],
  ['player','Écran du lecteur','Affichage, horloge et pause','settings','monitor'],
  ['presets','Configuration rapide','Applique un ensemble de préférences','settings','zap'],
  ['all-settings','Tous les paramètres','Retrouve les paramètres au même endroit','settings','settings'],
  ['copy','Copier un profil','Duplique tes réglages et tes rangées','profile','copy'],
  ['share','Partager','Transfère un fichier ou un lien sans secrets','profile','link'],
  ['account','Compte et profils','Ouvre ton compte Kovelyx et tes profils','profile','user-round']
]);
export const SUITE_SETTINGS=Object.freeze({
  theme:'dark',playerStyle:'informative',loadingScreen:true,loadingDetails:true,
  pauseScreen:true,playerClock:true,autoplay:true,autoNextAt:98,
  autoNextMode:'percent',autoNextMinutes:2,askStillWatching:true,
  stillWatchingAfter:3,skipIntro:false,skipRecap:false,skipCredits:false,
  skipMovieCredits:false,skipSilence:false,suggestMovie:false,
  streamSelection:'ask',streamMinQuality:'1080p',streamMaxGb:25,
  preferHdr:true,subtitlePreset:'standard',subtitleFontSize:24,
  subtitleColor:'#ffffff',subtitleOutline:true,subtitleBackOpacity:0,
  subtitleVertical:8,subtitleLanguage:'fr',subtitleFallback:'en',
  region:'FR',catalogueLanguage:'fr',artLanguage:'fr',
  onlyOriginalLanguage:false,minVotes:10,qualityFloor:false,
  hideAnime:false,hideAnimation:false,hideBollywood:false,
  hideHorror:false,hideRomance:false,hideKids:false,hideReality:false,
  networkMbps:50,device:'tv-basic',posterMode:'default',posterUrl:'',
  debrid:'',streamPreset:'best',streamFusion:true,comet:true,
  aioMetadata:true,subtitlesAddon:true,notifications:false,
  qualityBadges:false,backdropStyle:'classic',continueSorting:'recent'
});
export const SUITE_PRESETS=Object.freeze([
  {id:'general',name:'Grand public',desc:'Des réglages équilibrés pour tous les jours.',changes:{theme:'dark',autoplay:true,skipIntro:false,skipRecap:false,qualityBadges:true}},
  {id:'cinema',name:'Soirée cinéma',desc:'Image sobre, lecture continue et pas d’enchaînement imposé.',changes:{theme:'dark',playerStyle:'minimal',autoplay:false,skipIntro:false,preferHdr:true}},
  {id:'binge',name:'Marathon de séries',desc:'Épisode suivant et suppression des interruptions.',changes:{autoplay:true,autoNextAt:95,skipIntro:true,skipRecap:true,skipCredits:true}},
  {id:'anime',name:'Fan d’animation japonaise',desc:'Audio japonais et sous-titres français, sans exclure les animés.',changes:{subtitleLanguage:'fr',subtitleFallback:'ja',hideAnime:false,hideAnimation:false}},
  {id:'family',name:'Famille',desc:'Lecture simple, titres familiaux et lecture automatique coupée.',changes:{autoplay:false,hideHorror:true,hideReality:true,playerStyle:'minimal'}},
  {id:'subs',name:'Sous-titres toujours',desc:'Préférences françaises avec repli en anglais.',changes:{subtitleLanguage:'fr',subtitleFallback:'en',subtitlePreset:'readable'}},
  {id:'fast',name:'Simple et rapide',desc:'Peu d’effets et priorité aux flux efficaces.',changes:{playerStyle:'minimal',loadingScreen:false,preferHdr:false,streamSelection:'first',backdropStyle:'none'}}
]);
const safeString=(value,max=90)=>String(value??'').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
const clone=value=>JSON.parse(JSON.stringify(value));
const TYPES=Object.freeze(Object.fromEntries(Object.entries(SUITE_SETTINGS).map(([k,v])=>[k,typeof v])));
const settingLimit=(key,value)=>{
  if(TYPES[key]==='boolean')return typeof value==='boolean'?value:SUITE_SETTINGS[key];
  if(TYPES[key]==='number'){
    const limits={
      autoNextAt:[50,100],autoNextMinutes:[0,30],stillWatchingAfter:[1,10],
      streamMaxGb:[1,150],subtitleFontSize:[12,56],subtitleBackOpacity:[0,100],
      subtitleVertical:[0,30],minVotes:[0,1000],networkMbps:[1,1000]
    };
    const [min,max]=limits[key]||[0,100];
    return Number.isFinite(value)?Math.min(max,Math.max(min,value)):SUITE_SETTINGS[key];
  }
  if(typeof value!=='string')return SUITE_SETTINGS[key];
  return safeString(value,key==='posterUrl'?350:80);
};
export function sanitizeSuiteSettings(value){
  const result=clone(SUITE_SETTINGS);
  if(value&&typeof value==='object'&&!Array.isArray(value))
    for(const key of Object.keys(result))
      if(Object.prototype.hasOwnProperty.call(value,key))result[key]=settingLimit(key,value[key]);
  return result;
}
export function captureSuiteProfile(studioDraft,name='Mon profil'){
  const categories=Array.isArray(studioDraft?.sections)?studioDraft.sections:[];
  const rows=categories.slice(0,120).map(row=>({
    id:safeString(row.id,100),name:safeString(row.label||row.title,85),
    enabled:row.enabled!==false,
    folders:(Array.isArray(row.folders)?row.folders:[]).slice(0,500).map(folder=>({
      id:safeString(folder.id,100),name:safeString(folder.label||folder.title,85),
      enabled:folder.enabled!==false,
      cover:safeString(folder.artwork?.coverImageUrl||folder.coverImageUrl||'',600),
      sourceCount:Array.isArray(folder.selectedKeys)?folder.selectedKeys.length:
        Array.isArray(folder.sources)?folder.sources.length:0
    }))
  }));
  return {
    schema:SUITE_SCHEMA,id:'mcps-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),
    name:safeString(name,60)||'Mon profil',avatar:'',createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),settings:clone(SUITE_SETTINGS),rows
  };
}
export function validateSuiteProfile(input){
  if(!input||typeof input!=='object'||input.schema!==SUITE_SCHEMA)
    throw Error('Ce fichier ne contient pas un profil Ma-Collection compatible.');
  if(!Array.isArray(input.rows)||input.rows.length>120)throw Error('Rangées du profil invalides.');
  const seenRows=new Set(),rows=input.rows.map(row=>{
    const id=safeString(row.id,100);if(!id||seenRows.has(id))throw Error('Identifiant de rangée invalide ou dupliqué.');
    seenRows.add(id);
    if(!Array.isArray(row.folders)||row.folders.length>500)throw Error('Dossiers invalides.');
    const seen=new Set();
    return {
      id,name:safeString(row.name,85)||'Rangée sans titre',enabled:row.enabled!==false,
      folders:row.folders.map(f=>{
        const folderId=safeString(f.id,100);
        if(!folderId||seen.has(folderId))throw Error('Identifiant de dossier invalide ou dupliqué.');
        seen.add(folderId);
        return {id:folderId,name:safeString(f.name,85)||'Dossier',enabled:f.enabled!==false,
          cover:safeString(f.cover,600),sourceCount:Math.max(0,Math.min(1000,Math.trunc(Number(f.sourceCount)||0)))};
      })
    };
  });
  return {
    schema:SUITE_SCHEMA,id:safeString(input.id,90)||'mcps-import-'+Date.now(),
    name:safeString(input.name,60)||'Profil importé',avatar:safeString(input.avatar,600),
    createdAt:safeString(input.createdAt,48)||new Date().toISOString(),
    updatedAt:safeString(input.updatedAt,48)||new Date().toISOString(),
    settings:sanitizeSuiteSettings(input.settings),rows
  };
}
export function profileSuiteStats(profile){
  const rows=profile?.rows||[];
  return {rows:rows.filter(r=>r.enabled).length,
    folders:rows.reduce((n,r)=>n+(r.enabled?r.folders.filter(f=>f.enabled&&f.sourceCount>0).length:0),0),
    available:rows.reduce((n,r)=>n+r.folders.length,0)};
}
export function suiteSettingChanges(a,b){
  const before=sanitizeSuiteSettings(a),after=sanitizeSuiteSettings(b);
  return Object.keys(after).filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]))
    .map(k=>({key:k,from:before[k],to:after[k]}));
}
export function suiteProfileChanges(original,modified){
  const settings=suiteSettingChanges(original?.settings,modified?.settings);
  const oldRows=original?.rows||[],nextRows=modified?.rows||[];
  let layoutChanges=oldRows.map(x=>x.id).join('|')===nextRows.map(x=>x.id).join('|')?0:1;
  const byId=new Map(oldRows.map(r=>[r.id,r]));
  for(const row of nextRows){
    const previous=byId.get(row.id);
    if(!previous){layoutChanges++;continue;}
    if(row.name!==previous.name||row.enabled!==previous.enabled)layoutChanges++;
    if(row.folders.map(x=>x.id).join('|')!==previous.folders.map(x=>x.id).join('|'))layoutChanges++;
    const byFolder=new Map(previous.folders.map(f=>[f.id,f]));
    for(const f of row.folders){
      const old=byFolder.get(f.id);
      if(!old||old.name!==f.name||old.enabled!==f.enabled||old.cover!==f.cover)layoutChanges++;
    }
  }
  return {settings,layoutChanges,count:settings.length+layoutChanges};
}
export function applySuitePreset(settings,id){
  const preset=SUITE_PRESETS.find(p=>p.id===id);
  if(!preset)throw Error('Réglage prédéfini inconnu.');
  return sanitizeSuiteSettings({...settings,...preset.changes});
}
export function suiteSharePayload(profile){
  const safe=validateSuiteProfile(profile);
  // On ne met JAMAIS les rangées, les identifiants d'accès ni les liens de
  // fournisseur dans une URL destinée à circuler librement.
  return {schema:SUITE_SCHEMA,name:safe.name,settings:{
    ...safe.settings,posterUrl:'',debrid:''
  }};
}
export function suiteRestoreShared(payload,base){
  if(!payload||payload.schema!==SUITE_SCHEMA||!payload.settings)throw Error('Lien incompatible.');
  const copyOfBase=clone(base);
  copyOfBase.settings=sanitizeSuiteSettings({...base.settings,...payload.settings});
  copyOfBase.name=safeString(payload.name,60)||base.name;
  return validateSuiteProfile(copyOfBase);
}
export function suiteLocalState(seed){
  return {schema:SUITE_SCHEMA,activeId:seed.id,profiles:[validateSuiteProfile(seed)],backups:[]};
}
export function sanitizeSuiteState(value,seed){
  if(!value||value.schema!==SUITE_SCHEMA||!Array.isArray(value.profiles))return suiteLocalState(seed);
  const profiles=value.profiles.slice(0,12).map(p=>{try{return validateSuiteProfile(p)}catch{return null}}).filter(Boolean);
  if(!profiles.length)return suiteLocalState(seed);
  const backups=(Array.isArray(value.backups)?value.backups:[]).slice(0,8)
    .map(b=>{try{return validateSuiteProfile(b)}catch{return null}}).filter(Boolean);
  return {schema:SUITE_SCHEMA,activeId:profiles.some(p=>p.id===value.activeId)?value.activeId:profiles[0].id,
    profiles,backups};
}
export function moveSuiteItem(items,id,dir){
  const index=items.findIndex(x=>x.id===id),next=index+dir;
  if(index<0||next<0||next>=items.length)return false;
  [items[index],items[next]]=[items[next],items[index]];return true;
}
