import {SUITE_PAGES,SUITE_PRESETS,profileSuiteStats,suiteProfileChanges,suiteSettingChanges} from './profile-suite-model.mjs';
const h=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const attr=h;
const settingLabels={
  theme:'Thème',autoplay:'Lecture automatique',autoNextAt:'Épisode suivant',
  skipIntro:'Ignorer les introductions',skipRecap:'Ignorer les résumés',
  skipCredits:'Ignorer les génériques',preferHdr:'Priorité HDR',
  qualityBadges:'Badges de qualité',playerStyle:'Style du lecteur',
  subtitleLanguage:'Langue des sous-titres',subtitleFallback:'Langue de secours',
  subtitlePreset:'Style des sous-titres',hideAnime:'Exclure les animés',
  hideHorror:'Exclure l’horreur',streamSelection:'Sélection des flux',
  backdropStyle:'Décors',loadingScreen:'Écran de chargement'
};
const displayValue=value=>typeof value==='boolean'?(value?'Activé':'Désactivé'):String(value);
const avatarMarkup=p=>'<span class="mcps-profile-mark">'+
    (p.avatar?'<img src="'+attr(p.avatar)+'" alt="">':h(p.name.charAt(0).toUpperCase()))+'</span>';
const path={
  house:'M3 10.5 12 3l9 7.5V21H3V10.5z M9 21v-7h6v7',palette:'M12 3a9 9 0 1 0 0 18c1.7 0 2.5-1.9 1.5-3.2-1-1.2-.3-2.8 1.4-2.8H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9z M8 8h.01 M12 6h.01 M16 8h.01 M7 13h.01',
  'list-check':'M9 6h12 M9 12h12 M9 18h12 M3 6l1.5 1.5L7 4 M3 12l1.5 1.5L7 10 M3 18l1.5 1.5L7 16',
  layers:'M12 2 2 8l10 6 10-6-10-6z M2 12l10 6 10-6 M2 16l10 6 10-6',
  boxes:'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  play:'M8 5l12 7-12 7V5z',image:'M3 3h18v18H3z M7 16l4-4 3 3 3-5 4 5 M8 8h.01',
  archive:'M3 4h18v4H3z M5 8v13h14V8 M9 12h6',history:'M3 12a9 9 0 1 0 2.4-6 M3 3v6h6 M12 7v5l3 2',
  gauge:'M4 18a9 9 0 1 1 16 0 M12 13l5-5 M8 19h8',sliders:'M4 7h16 M4 17h16 M9 4v6 M16 14v6',
  globe:'M3 12h18 M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z M12 3c-6 5-6 13 0 18 M12 3c6 5 6 13 0 18',
  captions:'M3 5h18v14H3z M6 13h5 M13 13h5 M6 16h8',
  'list-video':'M3 6h10 M3 11h10 M3 16h7 M16 8l6 4-6 4V8z',
  'skip-forward':'M4 5l8 7-8 7V5z M12 5l8 7-8 7V5z',
  monitor:'M3 4h18v14H3z M9 22h6 M12 18v4',zap:'M13 2 4 14h7l-1 8 10-12h-7l0-8z',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8z M12 2v3 M12 19v3 M4 4l2 2 M18 18l2 2 M2 12h3 M19 12h3 M4 20l2-2 M18 6l2-2',
  copy:'M8 8h13v13H8z M4 16H3V3h13v2',link:'M10 13a5 5 0 0 0 7 .2l3-3a5 5 0 0 0-7-7l-1 1 M14 11a5 5 0 0 0-7-.2l-3 3a5 5 0 0 0 7 7l1-1',
  'user-round':'M12 12a4 4 0 1 0 0-8 4 4 0 1 0 0 8z M4 21a8 8 0 0 1 16 0',
  check:'M4 12l5 5L20 6',arrow:'M4 12h16 M13 5l7 7-7 7'
};
export const suiteIcon=name=>'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="'+(path[name]||path.layers)+'"/></svg>';
const go=(screen,label,classes='')=>'<button type="button" class="'+classes+'" data-suite-go="'+attr(screen)+'">'+h(label)+'</button>';
const action=(name,label,cls='',extra='')=>'<button type="button" class="'+cls+'" data-suite-action="'+attr(name)+'" '+extra+'>'+h(label)+'</button>';
const field=(key,label,content,desc='')=>'<label class="mcps-field"><span>'+h(label)+'</span>'+content+(desc?'<small>'+h(desc)+'</small>':'')+'</label>';
const select=(key,values,value)=>'<select data-suite-field="'+attr(key)+'">'+values.map(([v,l])=>
  '<option value="'+attr(v)+'" '+(value===v?'selected':'')+'>'+h(l)+'</option>').join('')+'</select>';
const choice=(key,value,label,selected,description='')=>
  '<button type="button" data-suite-choice="'+attr(key)+'" data-value="'+attr(value)+'" aria-pressed="'+(selected===value)+'" class="mcps-choice '+(selected===value?'chosen':'')+'"><strong>'+h(label)+'</strong>'+
  (description?'<small>'+h(description)+'</small>':'')+'</button>';
const toggle=(key,label,checked,desc='',disabled=false)=>'<label class="mcps-toggle"><input type="checkbox" data-suite-field="'+attr(key)+'" '+(checked?'checked':'')+(disabled?' disabled':'')+'><span><b>'+h(label)+'</b>'+
  (desc?'<small>'+h(desc)+'</small>':'')+'</span></label>';
const range=(key,label,value,min,max,step=1,suffix='')=>'<label class="mcps-range"><span>'+h(label)+' <b data-suite-range-label="'+attr(key)+'">'+h(value)+h(suffix)+'</b></span><input type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+h(value)+'" data-suite-field="'+attr(key)+'"></label>';
const row=(heading,content,more='')=>'<section class="mcps-card"><h3>'+h(heading)+'</h3>'+content+more+'</section>';
const title=(heading,description='',wide=false)=>'<header class="mcps-title '+(wide?'wide':'')+'"><h1>'+h(heading)+'</h1>'+(description?'<p>'+h(description)+'</p>':'')+'</header>';
const appStatus=(ctx,mode='settings')=>{
  const changes=suiteProfileChanges(ctx.saved,ctx.draft);
  return '<aside class="mcps-card mcps-apply"><h3>Ce qui va changer</h3>'+
    '<p>'+(!changes.count?'Aucune modification pour le moment.':changes.settings.length+' préférences et '+changes.layoutChanges+' modifications de mise en page en attente.')+'</p>'+
    '<div class="mcps-apply-stat">'+changes.count+' modification'+(changes.count>1?'s':'')+'</div>'+
    (changes.settings.length?'<ul class="mcps-changes-list">'+changes.settings.slice(0,4).map(x=>
      '<li><b>'+h(settingLabels[x.key]||x.key)+'</b> : '+h(displayValue(x.from))+' → '+h(displayValue(x.to))+'</li>').join('')+
      (changes.settings.length>4?'<li>… et '+(changes.settings.length-4)+' autre(s)</li>':'')+'</ul>':'')+
    action('save','Enregistrer les modifications','mcps-primary',changes.count?'':'disabled')+
    (mode==='layout'?action('review-layout','Vérifier et appliquer au site','mcps-small'):'')+
    '<small class="mcps-safety">Sauvegarde locale. Rien n’est envoyé à Kovelyx sans action explicite.</small></aside>';
};
export function renderSuiteDashboard(ctx){
  const s=profileSuiteStats(ctx.draft);
  return '<section class="mcps-dashboard"><div class="mcps-profile-strip">'+
    avatarMarkup(ctx.draft)+
    '<div class="mcps-profile-title"><strong>'+h(ctx.draft.name)+'</strong><span>'+s.rows+' rangées · '+s.folders+' dossiers actifs</span>'+
    (ctx.draft.id.startsWith('mcps-cloud-')?'<small>Copie locale du profil Kovelyx · publication distincte</small>':'')+'</div>'+
    (ctx.draft.id.startsWith('mcps-cloud-')?action('edit-remote-profile','Ouvrir l’éditeur Kovelyx','mcps-small'):'')+
    go('profiles','Changer de profil','mcps-small')+'</div>'+
    '<div class="mcps-tiles">'+SUITE_PAGES.map(([key,name,desc,group,icon])=>
      '<button type="button" class="mcps-tile" data-suite-go="'+attr(key)+'"><span class="mcps-icon">'+suiteIcon(icon)+'</span>'+
      '<strong>'+h(name)+'</strong><small>'+h(desc)+'</small><span class="mcps-tile-arrow">'+suiteIcon('arrow')+'</span></button>'
    ).join('')+'</div>'+
    '<footer class="mcps-dashboard-footer">Profil personnel indépendant · Aucune connexion à Kaptain</footer></section>';
}
export function renderSuiteProfiles(ctx){
  const account=ctx.account||{},signed=!!account.signedIn,cloud=ctx.cloudProfiles||[];
  const cloudIds=new Set(cloud.map(p=>'mcps-cloud-'+p.id));
  const local=ctx.profiles.filter(p=>!signed||!cloudIds.has(p.id));
  const localVisible=!signed||cloud.length===0||!!ctx.showLocalProfiles;
  const avatar=p=>p.avatar?'<span class="mcps-picker-avatar"><img src="'+attr(p.avatar)+'" alt="" loading="lazy"></span>':
    '<span class="mcps-picker-avatar mcps-picker-initial" aria-hidden="true">'+h(p.name.charAt(0).toUpperCase())+'</span>';
  const profileCard=(p,kind)=>{
    const stats=kind==='cloud'?p:{rows:p.rows.length,folders:profileSuiteStats(p).available};
    const counts=(stats.rows===null||stats.rows===undefined||stats.folders===null||stats.folders===undefined)?
      'Collections à charger':stats.rows+' catégories · '+stats.folders+' dossiers';
    return '<button type="button" class="mcps-picker-card" '+
      (kind==='cloud'?'data-suite-cloud-select="'+attr(p.id)+'"':'data-suite-select="'+attr(p.id)+'"')+
      ' aria-label="Choisir le profil '+attr(p.name)+'">'+
      avatar(p)+'<span class="mcps-picker-card-details"><strong>'+h(p.name)+'</strong>'+
      '<small>'+h(counts)+'</small></span>'+
      '<span class="mcps-picker-card-select">Choisir <span aria-hidden="true">›</span></span></button>';
  };
  const cloudStatus=account.loading?
    '<p class="mcps-picker-status" role="status">Chargement des profils de ton compte Kovelyx…</p>':
    account.error?'<p class="mcps-picker-status is-error" role="alert">'+h(account.error)+'</p>':
    signed&&cloud.length===0?'<p class="mcps-picker-status">Aucun profil distant disponible sur ce compte.</p>':'';
  return '<section class="mcps-profile-picker"><div class="mcps-picker-inner">'+
    '<div class="mcps-picker-banner"><div><h1>Choisir un profil à organiser</h1>'+
    '<p>Choisis le profil que tu souhaites personnaliser ou réorganiser.</p></div></div>'+
    '<section class="mcps-picker-account"><div><h2>Plusieurs comptes Kovelyx ?</h2>'+
    '<p>'+(signed?
      'Tu es connecté à ton propre compte Kovelyx. Les profils sont chargés depuis ton serveur ; aucune modification n’est publiée automatiquement.':
      'Connecte ton compte Kovelyx pour retrouver ses profils sur tes appareils. Sans connexion, tes profils locaux restent disponibles.')+
    '</p></div><div class="mcps-picker-account-actions">'+
      action('open-account',signed?'Gérer mon compte':'Se connecter à Kovelyx','mcps-small')+
      (signed?action('refresh-cloud','Actualiser','mcps-small'):'')+
      (signed&&cloud.length?action('show-local',localVisible?'Masquer les profils locaux':'Profils locaux','mcps-small'):'')+
    '</div></section>'+
    (signed?'<div class="mcps-picker-section-title mcps-picker-cloud-heading"><strong>Profils de mon compte</strong>'+
      '<span>'+cloud.length+' profil'+(cloud.length>1?'s':'')+'</span></div>'+
      cloudStatus+
      '<div class="mcps-picker-grid" aria-label="Profils Kovelyx">'+cloud.map(p=>profileCard(p,'cloud')).join('')+'</div>':'')+
    (localVisible?'<div class="mcps-picker-section-title"><strong>'+(signed?'Profils sur cet appareil':'Mes profils locaux')+'</strong>'+
      '<span>'+local.length+' profil'+(local.length>1?'s':'')+'</span></div>'+
      '<div class="mcps-picker-grid" aria-label="Profils locaux">'+local.map(p=>profileCard(p,'local')).join('')+'</div>'+
      '<div class="mcps-picker-secondary">'+
        action('new-profile','Créer un profil local','mcps-small')+
        action('import','Importer une sauvegarde JSON','mcps-small')+'</div>':'')+
    '<footer class="mcps-picker-footer">'+
      action('open-account','Utiliser un autre compte','mcps-text-button')+
      (signed?action('sign-out','Se déconnecter de '+(account.email||'Kovelyx'),'mcps-text-button'):'')+
    '</footer></div></section>';
}
export function renderSuiteLayout(ctx){
  const stats=profileSuiteStats(ctx.draft);
  const rows=ctx.draft.rows;
  const cover=(f)=>{
    const url=ctx.coverFor(f.cover);
    return url?'<img src="'+attr(url)+'" alt="" loading="lazy" decoding="async">':'<span class="mcps-cover-placeholder">'+h(f.name)+'</span>';
  };
  return '<section class="mcps-layout">'+
    '<header class="mcps-layout-banner"><div><h1>Organisation de l’écran d’accueil</h1>'+
    '<p>Déplace les rangées, ajuste les titres et ouvre les dossiers pour modifier leurs affiches.</p></div>'+
    '<div class="mcps-layout-metrics"><span><b>'+stats.rows+'</b> rangées</span><span><b>'+stats.folders+'</b> dossiers actifs</span></div></header>'+
    '<div class="mcps-layout-toolbar">'+field('artLanguage','Langue des affiches',select('artLanguage',[['fr','Français'],['en','Anglais']],ctx.draft.settings.artLanguage))+
      action('open-original-studio','Atelier d’affiches','mcps-small')+
      action('tidy-layout','Trier les rangées','mcps-small')+
      action('review-layout','Vérifier et appliquer','mcps-primary')+'</div>'+
    rows.map((r,i)=>{
      const short=r.folders.slice(0,9);
      return '<article class="mcps-layout-row '+(r.enabled?'':'dimmed')+'">'+
      '<div class="mcps-row-step"><span>⠿</span>'+action('row-up','↑','mcps-tiny','data-id="'+attr(r.id)+'" '+(i===0?'disabled':''))+
      action('row-down','↓','mcps-tiny','data-id="'+attr(r.id)+'" '+(i===rows.length-1?'disabled':''))+
      '<small>#'+String(i+1).padStart(2,'0')+'</small></div>'+
      '<div class="mcps-row-content"><div class="mcps-row-top"><div class="mcps-row-label"><strong>'+h(r.name)+'</strong>'+
      '<small>· '+r.folders.length+' dossiers</small></div><div class="mcps-row-actions">'+
      action('row-enable',r.enabled?'Masquer':'Afficher','mcps-small','data-id="'+attr(r.id)+'"')+
      action('row-rename','Renommer','mcps-small','data-id="'+attr(r.id)+'"')+
      action('row-open','Ouvrir la rangée ›','mcps-outline','data-id="'+attr(r.id)+'"')+
      '</div></div><div class="mcps-poster-strip">'+short.map(f=>
        '<button type="button" class="mcps-poster" data-suite-folder="'+attr(r.id)+'|'+attr(f.id)+'" title="'+attr(f.name)+'">'+
        cover(f)+'</button>').join('')+(r.folders.length>short.length?'<span class="mcps-strip-more">+'+(r.folders.length-short.length)+'</span>':'')+'</div></div></article>';
    }).join('')+'</section>';
}
export function renderSuiteQuick(ctx){
  const query=ctx.search.toLocaleLowerCase('fr');
  const rows=ctx.draft.rows.filter(r=>(r.name+' '+r.folders.map(f=>f.name).join(' ')).toLocaleLowerCase('fr').includes(query));
  return title('Éditeur rapide','Coche les rangées et dossiers à conserver. Aucun changement n’est envoyé avant confirmation.')+
    '<div class="mcps-quick-toolbar"><input type="search" data-suite-search placeholder="Rechercher une rangée ou un dossier…" value="'+attr(ctx.search)+'">'+
    action('all-on','Tout sélectionner','mcps-small')+action('all-off','Tout désactiver','mcps-small')+'</div>'+
    '<div class="mcps-quick-results">'+rows.map(r=>{
      const active=r.folders.filter(f=>f.enabled&&f.sourceCount).length;
      return '<section class="mcps-quick-group"><div class="mcps-quick-heading">'+
      '<strong>'+h(r.name)+'</strong><small>'+active+'/'+r.folders.length+' dossiers</small>'+
      action('row-enable',r.enabled?'Masquer':'Afficher','mcps-small','data-id="'+attr(r.id)+'"')+
      action('row-up','↑','mcps-tiny','data-id="'+attr(r.id)+'"')+
      action('row-down','↓','mcps-tiny','data-id="'+attr(r.id)+'"')+'</div>'+
      r.folders.filter(f=>!query||f.name.toLowerCase().includes(query)||r.name.toLowerCase().includes(query)).map(f=>
      '<label class="mcps-quick-folder"><input type="checkbox" data-suite-folder-check="'+attr(r.id)+'|'+attr(f.id)+'" '+(f.enabled?'checked':'')+'>'+
      '<span>'+h(f.name)+'</span><small>'+f.sourceCount+' sources</small>'+
      '<button type="button" data-suite-folder-up="'+attr(r.id)+'|'+attr(f.id)+'" aria-label="Monter le dossier '+attr(f.name)+'">↑</button>'+
      '<button type="button" data-suite-folder-down="'+attr(r.id)+'|'+attr(f.id)+'" aria-label="Descendre le dossier '+attr(f.name)+'">↓</button></label>'
      ).join('')+'</section>';
    }).join('')+'</div><div class="mcps-sticky-actions">'+
    '<span>'+suiteProfileChanges(ctx.saved,ctx.draft).layoutChanges+' modifications d’organisation</span>'+
    action('review-layout','Vérifier et enregistrer','mcps-primary')+'</div>';
}
export function renderSuiteArtwork(ctx){
  const images=ctx.artVariants||[];
  const item=images[ctx.artIndex]||images[0]||{};
  const peek=(offset,layer)=>{
    if(images.length<2)return '';
    const candidate=images[(ctx.artIndex+offset+images.length)%images.length];
    const url=ctx.coverFor(candidate?.url||'');
    if(!url)return '';
    return '<div class="mcps-art-peek mcps-art-peek-'+layer+'" aria-hidden="true">'+
      '<img src="'+attr(url)+'" alt=""><small>'+h(candidate.label||'Variante')+'</small></div>';
  };
  return '<section class="mcps-artwork">'+
    '<div class="mcps-art-tools">'+
    '<input type="search" data-suite-art-search placeholder="Trouver un dossier…" value="'+attr(ctx.artSearch)+'">'+
    select('artFilter',ctx.draft.rows.map(r=>[r.id,r.name]),ctx.artRowId)+
    action('art-prev-folder','‹ Dossier','mcps-small')+action('art-next-folder','Dossier ›','mcps-small')+
    go('layout','Voir les rangées','mcps-small')+'</div>'+
    '<div class="mcps-art-stage"><div class="mcps-art-heading"><h1>'+h(ctx.artFolder?.name||'Affiches')+'</h1>'+
    '<p>'+h(ctx.artRow?.name||'')+' · Variante '+(ctx.artIndex+1)+' sur '+images.length+' · '+h(item.label||'')+'</p></div>'+
    '<div class="mcps-art-theatre">'+action('art-prev','‹','mcps-art-arrow')+
    peek(2,'far')+peek(1,'next')+
    '<div class="mcps-art-main">'+(item.url?'<img src="'+attr(ctx.coverFor(item.url))+'" alt="Aperçu de '+attr(ctx.artFolder?.name)+'">':
    '<div class="mcps-art-missing">Choisis une image</div>')+'</div>'+
    action('art-next','›','mcps-art-arrow')+'</div>'+
    '<div class="mcps-art-dots">'+images.map((x,i)=>'<button type="button" data-suite-art-index="'+i+'" class="'+(i===ctx.artIndex?'active':'')+'" aria-label="Voir le style '+attr(x.label)+'"></button>').join('')+'</div>'+
    '<div class="mcps-art-buttons">'+action('art-own','Utiliser mon image','mcps-small')+
    action('art-apply-row','Appliquer à toute la rangée','mcps-small')+
    action('art-use','Utiliser cette affiche','mcps-primary')+'</div></div>'+
    '<div class="mcps-sticky-actions"><span>Les affiches choisies sont ajoutées au brouillon local.</span>'+
    action('review-layout','Vérifier et appliquer au site','mcps-primary')+'</div></section>';
}
export function renderSuitePresets(ctx){
  return title('Configuration rapide','Choisis le profil de lecture qui te correspond. Tu verras précisément les réglages avant de les enregistrer.')+
    '<div class="mcps-presets">'+SUITE_PRESETS.map(p=>
    '<button type="button" class="mcps-choice mcps-preset '+(ctx.preset===p.id?'chosen':'')+'" data-suite-preset="'+attr(p.id)+'">'+
    '<span class="mcps-icon">'+suiteIcon('zap')+'</span><strong>'+h(p.name)+'</strong><p>'+h(p.desc)+'</p>'+
    '<small>Voir tous les paramètres</small></button>').join('')+'</div>'+
    '<div class="mcps-card mcps-preset-summary"><h3>Réglages du profil sélectionné</h3>'+
    (ctx.preset?Object.entries(SUITE_PRESETS.find(x=>x.id===ctx.preset)?.changes||{}).map(([k,v])=>
      '<p><b>'+h(settingLabels[k]||k)+'</b> · '+h(displayValue(v))+'</p>').join(''):'<p>Sélectionne un profil pour afficher ses modifications.</p>')+
    action('apply-preset','Utiliser cette configuration','mcps-primary',ctx.preset?'':'disabled')+'</div>';
}
export function renderSuiteAllSettings(ctx){
  const entries=[
    ['Style et apparence','Thème, décors, badges et mode d’affichage','look','palette'],
    ['Lecture','Enchaînement et écrans du lecteur','player','play'],
    ['Son et sous-titres','Langues et apparence des sous-titres','subtitles','captions'],
    ['Écran d’accueil','Rangées et collections','layout','house'],
    ['Fiches des médias','Bandes-annonces, épisodes et acteurs','details','image'],
    ['Reprise de lecture','Ordre de reprise et progression','continue','skip-forward'],
    ['Alertes','Notifications des nouveaux épisodes','alerts','history'],
    ['Services connectés','Extensions et compte Kovelyx','streaming','link']
  ];
  return title('Tous les paramètres','Tout est regroupé par usage, avec des modifications annulables.')+
    '<div class="mcps-setting-tiles">'+entries.map(([name,description,id,icon])=>
      '<button type="button" class="mcps-setting-tile" data-suite-go="'+attr(id)+'">'+
      '<span class="mcps-icon">'+suiteIcon(icon)+'</span><b>'+h(name)+'</b>'+
      '<small>'+h(description)+'</small><span class="mcps-tile-arrow">'+suiteIcon('arrow')+'</span></button>'
    ).join('')+'</div>';
}
export function renderSuiteLook(ctx){
  const s=ctx.draft.settings;
  return title('Apparence','Personnalise la présentation générale et les informations affichées sur les affiches.')+
    '<div class="mcps-columns-3">'+
    row('1. Thème','<div class="mcps-choices">'+
      choice('theme','dark','Sombre',s.theme,'Interface sombre, accent vert menthe.')+
      choice('theme','light','Clair',s.theme,'Présentation lumineuse.')+
      choice('theme','contrast','Contraste élevé',s.theme,'Éléments plus contrastés.')+'</div>')+
    row('2. Décors et affiches',
      field('backdropStyle','Arrière-plan',select('backdropStyle',[
        ['classic','Classique'],['blur','Flou doux'],['none','Sans décor']
      ],s.backdropStyle))+
      toggle('qualityBadges','Afficher la qualité',s.qualityBadges,
        'Badges de qualité quand cette option est prise en charge.'))+
    appStatus(ctx)+'</div>';
}
export function renderSuiteDetails(ctx){
  const s=ctx.draft.settings;
  return title('Fiche des films et séries','Choisis les détails à afficher lorsque tu ouvres un titre.')+
    '<div class="mcps-columns-2">'+
    row('Films et séries',
      toggle('showTrailers','Bandes-annonces',s.showTrailers,'Afficher les trailers quand ils sont disponibles.')+
      toggle('showOverview','Résumé et description',s.showOverview)+
      toggle('showCast','Acteurs et distribution',s.showCast))+
    row('Épisodes',
      toggle('showEpisodeImages','Illustrations des épisodes',s.showEpisodeImages)+
      '<p class="mcps-muted">Ces préférences peuvent être exportées dans ton profil. Kovelyx doit les prendre en charge pour les appliquer aux fiches réelles.</p>')+
    '</div><div class="mcps-inline-save">'+appStatus(ctx)+'</div>';
}
export function renderSuiteContinue(ctx){
  const s=ctx.draft.settings;
  return title('Reprise de lecture','Définis comment les séries et films en cours s’affichent sur ta page d’accueil.')+
    '<div class="mcps-columns-2">'+
    row('1. Ordre de tri',
      '<div class="mcps-radio-stack">'+
      choice('continueSorting','recent','Dernière lecture',s.continueSorting)+
      choice('continueSorting','remaining','Temps restant',s.continueSorting)+
      choice('continueSorting','alphabetical','Ordre alphabétique',s.continueSorting)+'</div>')+
    row('2. Présentation',
      toggle('continueShowProgress','Afficher la progression',s.continueShowProgress)+
      toggle('continueHideCompleted','Masquer les titres terminés',s.continueHideCompleted)+
      '<p class="mcps-muted">Les titres réels de ta liste sont conservés dans ton compte Kovelyx.</p>')+
    '</div><div class="mcps-inline-save">'+appStatus(ctx)+'</div>';
}
export function renderSuiteAlerts(ctx){
  const s=ctx.draft.settings;
  return title('Alertes','Prépare les alertes sur les nouveaux épisodes et les changements de ton catalogue.')+
    '<div class="mcps-columns-2">'+
    row('Notifications',
      toggle('notifications','Alertes pour les nouveaux épisodes',s.notifications,
        'Une notification nécessite la prise en charge et l’autorisation de Kovelyx.')+
      '<p class="mcps-muted">Aucune alerte distante ne sera activée sans l’application cliente. Ce bouton modifie uniquement tes préférences de profil.</p>')+
    appStatus(ctx)+'</div>';
}
export function renderSuitePlayer(ctx){
  const s=ctx.draft.settings;
  return title('Écran du lecteur','Choisis si l’écran doit rester minimal ou afficher davantage d’informations.')+
    '<div class="mcps-two-stage">'+row('1. Choisir un style','<div class="mcps-choices">'+
      choice('playerStyle','minimal','Minimaliste',s.playerStyle,'Image nette, sans horloge ni détails de chargement.')+
      choice('playerStyle','informative','Informatif',s.playerStyle,'Chargement, pause et horloge visibles.')+'</div>')+
    '<div class="mcps-column-pair">'+row('2. Ou personnaliser chaque option',
      toggle('loadingScreen','Écran de chargement',s.loadingScreen,'Pendant la recherche du flux.')+
      toggle('loadingDetails','Détails du chargement',s.loadingDetails,'Explications courtes lors de la recherche.')+
      toggle('pauseScreen','Écran de pause',s.pauseScreen,'Titre et informations pendant la pause.')+
      toggle('playerClock','Horloge sur le lecteur',s.playerClock,'Selon la prise en charge de ton appareil.'))+
    appStatus(ctx)+'</div></div>';
}
export function renderSuiteAutoplay(ctx){
  const s=ctx.draft.settings;
  return title('Lecture automatique et épisode suivant','Gère la fin d’un épisode, la lecture automatique et les passages à ignorer.')+
    '<div class="mcps-columns-3">'+row('1. Épisode suivant',
      toggle('autoplay','Lire automatiquement le suivant',s.autoplay)+
      field('autoNextMode','Déclencher',select('autoNextMode',[['percent','À la fin (en %)'],['minutes','Minutes avant la fin']],s.autoNextMode))+
      (s.autoNextMode==='percent'?range('autoNextAt','Après visionnage de',s.autoNextAt,50,100,1,'%'):
        range('autoNextMinutes','Minutes avant la fin',s.autoNextMinutes,0,30,1,' min'))+
      toggle('askStillWatching','Demander si je regarde encore',s.askStillWatching)+
      range('stillWatchingAfter','Après',s.stillWatchingAfter,1,10,1,' épisodes'))+
    row('2. Films et passages',
      toggle('suggestMovie','Proposer un autre film',s.suggestMovie)+
      toggle('skipIntro','Ignorer les introductions',s.skipIntro)+
      toggle('skipRecap','Ignorer les résumés',s.skipRecap)+
      toggle('skipCredits','Ignorer les génériques des épisodes',s.skipCredits)+
      toggle('skipMovieCredits','Ignorer les génériques de films',s.skipMovieCredits)+
      toggle('skipSilence','Réduire les passages silencieux',s.skipSilence))+
    appStatus(ctx)+'</div>';
}
export function renderSuiteStreamPicker(ctx){
  const s=ctx.draft.settings;
  return title('Sélection des flux','Définis la priorité des sources et teste une règle sur une liste de noms de flux fictifs.')+
    '<div class="mcps-columns-3">'+row('1. Comment choisir le flux ?',
      '<div class="mcps-choices">'+choice('streamSelection','ask','Me demander',s.streamSelection)+
      choice('streamSelection','first','Premier flux',s.streamSelection)+
      choice('streamSelection','quality','Meilleure qualité',s.streamSelection)+'</div>')+
      row('2. Qualité et taille',
      field('streamMinQuality','Qualité souhaitée',select('streamMinQuality',[['720p','720p'],['1080p','1080p'],['2160p','4K / 2160p']],s.streamMinQuality))+
      range('streamMaxGb','Taille maximale indicative',s.streamMaxGb,1,150,1,' Go')+
      toggle('preferHdr','Priorité au HDR',s.preferHdr))+
    appStatus(ctx)+'</div>'+
    row('3. Tester une règle sur des exemples','<p class="mcps-muted">Ce test compare des intitulés localement, sans recherche de vrais fichiers ou connexions.</p>'+
      '<textarea data-suite-stream-samples rows="3" placeholder="Film 1080p 4 Go&#10;Film 2160p HDR 18 Go">'+h(ctx.streamSamples)+'</textarea>'+
      action('test-streams','Tester la sélection','mcps-primary')+
      '<p class="mcps-feedback">'+h(ctx.streamTestResult||'')+'</p>') ;
}
export function renderSuiteSubtitles(ctx){
  const s=ctx.draft.settings,styles={
    fontSize:Number(s.subtitleFontSize)+'px',
    color:s.subtitleColor,
    textShadow:s.subtitleOutline?'0 1px 2px #000, 0 0 3px #000':'none',
    bottom:Number(s.subtitleVertical)*2+'px',
    background:'rgba(0,0,0,'+(Number(s.subtitleBackOpacity)/100)+')'
  };
  const css=Object.entries(styles).map(([k,v])=>k.replace(/[A-Z]/g, x=>'-'+x.toLowerCase())+':'+v).join(';');
  return title('Sous-titres','Choisis un rendu, ajuste-le puis sélectionne tes langues. L’aperçu s’actualise immédiatement.')+
    '<div class="mcps-subtitle-preview"><div class="mcps-subtitle-scene">'+
    '<span style="'+attr(css)+'">Reste concentré sur la route, tout ira bien.</span></div>'+
    '<div class="mcps-choice-row">'+choice('subtitlePreset','standard','Standard',s.subtitlePreset)+
    choice('subtitlePreset','readable','Facile à lire',s.subtitlePreset)+
    choice('subtitlePreset','contrast','Contraste élevé',s.subtitlePreset)+
    choice('subtitlePreset','cinema','Cinéma',s.subtitlePreset)+
    choice('subtitlePreset','minimal','Minimal',s.subtitlePreset)+'</div></div>'+
    '<div class="mcps-columns-3">'+row('1. Affiner le style',
      range('subtitleFontSize','Taille',s.subtitleFontSize,12,56,1,' px')+
      toggle('subtitleOutline','Contour du texte',s.subtitleOutline)+
      range('subtitleBackOpacity','Opacité du fond',s.subtitleBackOpacity,0,100,5,'%')+
      range('subtitleVertical','Position verticale',s.subtitleVertical,0,30,1,''))+
    row('2. Langues',
      field('subtitleLanguage','Langue principale',select('subtitleLanguage',[['fr','Français'],['en','Anglais'],['ja','Japonais'],['es','Espagnol'],['de','Allemand']],s.subtitleLanguage))+
      field('subtitleFallback','Langue de secours',select('subtitleFallback',[['en','Anglais'],['fr','Français'],['ja','Japonais'],['es','Espagnol']],s.subtitleFallback))+
      field('subtitleColor','Couleur du texte','<input type="color" data-suite-field="subtitleColor" value="'+attr(s.subtitleColor)+'">'))+
    appStatus(ctx)+'</div>';
}
export function renderSuiteLanguage(ctx){
  const s=ctx.draft.settings;
  return title('Langue','Les affiches, la langue des médias et les rangées de découverte se configurent séparément.')+
    '<div class="mcps-columns-3">'+row('Affiches des dossiers',
      field('artLanguage','Afficher les titres en',select('artLanguage',[['fr','Français'],['en','Anglais']],s.artLanguage))+
      '<p class="mcps-muted">Les visuels français doivent exister dans ta galerie ou ton pack indépendant.</p>'+
      action('open-french-art','Gérer les affiches françaises','mcps-primary'))+
    row('Langue de Kovelyx',
      field('catalogueLanguage','Langue des informations',select('catalogueLanguage',[['fr','Français'],['en','Anglais'],['es','Espagnol']],s.catalogueLanguage))+
      '<p class="mcps-muted">La préférence est enregistrée ici ; sa synchronisation dépend de Kovelyx.</p>')+
    row('Découverte',
      field('region','Pays',select('region',[['FR','France'],['BE','Belgique'],['CH','Suisse'],['CA','Canada'],['US','États-Unis'],['GB','Royaume-Uni']],s.region))+
      toggle('onlyOriginalLanguage','Uniquement la langue d’origine',s.onlyOriginalLanguage)+
      appStatus(ctx))+'</div>';
}
export function renderSuiteFilters(ctx){
  const s=ctx.draft.settings;
  return title('Filtres de contenu','Choisis les critères à appliquer aux catalogues TMDB lors de la création ou de l’export compatible.')+
    '<div class="mcps-columns-3">'+row('Popularité',
      range('minVotes','Votes minimum',s.minVotes,0,1000,10,'')+
      toggle('qualityFloor','Exiger une meilleure note',s.qualityFloor))+
    row('Région et langue',
      field('region','Pays de streaming',select('region',[['FR','France'],['BE','Belgique'],['CH','Suisse'],['CA','Canada'],['US','États-Unis']],s.region))+
      toggle('onlyOriginalLanguage','Uniquement la langue d’origine',s.onlyOriginalLanguage)+
      field('catalogueLanguage','Langue',select('catalogueLanguage',[['fr','Français'],['en','Anglais']],s.catalogueLanguage)))+
    row('Exclure',
      toggle('hideAnime','Animés japonais',s.hideAnime)+toggle('hideAnimation','Animation',s.hideAnimation)+
      toggle('hideBollywood','Cinéma indien',s.hideBollywood)+toggle('hideHorror','Horreur',s.hideHorror)+
      toggle('hideRomance','Romance',s.hideRomance)+toggle('hideKids','Jeunesse et famille',s.hideKids)+
      toggle('hideReality','Téléréalité',s.hideReality))+'</div>'+
    '<div class="mcps-inline-save">'+appStatus(ctx)+action('open-guided','Ouvrir les filtres du catalogue réel','mcps-small')+'</div>';
}
export function renderSuitePerformance(ctx){
  const s=ctx.draft.settings;
  const hardware=[['tv-basic','Android TV léger'],['tv-high','TV 4K haut de gamme'],['phone','Téléphone / tablette'],['desktop','PC Windows / Linux'],['stick','Clé TV / appareil limité']];
  return title('Performance des appareils','Adapte le profil aux capacités de ton appareil et à ton débit disponible.')+
    '<div class="mcps-columns-2">'+row('1. Choisir l’appareil',
      '<div class="mcps-radio-stack">'+hardware.map(([id,label])=>
        choice('device',id,label,s.device)).join('')+'</div>'+
      range('networkMbps','Débit disponible',s.networkMbps,1,500,1,' Mbit/s')+
      '<p class="mcps-muted">La valeur est indicative : elle ne mesure pas ta connexion internet.</p>')+
    row('2. Réglages recommandés',
      '<p>Appareil sélectionné : <strong>'+h(hardware.find(x=>x[0]===s.device)?.[1]||'')+'</strong></p>'+
      '<p>Débit déclaré : <strong>'+s.networkMbps+' Mbit/s</strong></p>'+
      '<p>Les conseils modifient le brouillon, jamais directement le lecteur.</p>'+
      action('optimize-device','Appliquer les conseils','mcps-primary')+
      appStatus(ctx))+'</div>';
}
export function renderSuitePoster(ctx){
  const s=ctx.draft.settings;
  return title('Style des affiches','Configure le fournisseur de tes affiches et vérifie le résultat avant transfert.')+
    '<div class="mcps-poster-current"><div><small>CHOIX ACTUEL</small><h3>'+h(s.posterMode==='default'?'Affiches des extensions':s.posterMode==='custom'?'Adresse personnalisée':'Affiches de Ma-Collection')+'</h3></div>'+
    appStatus(ctx)+'</div>'+
    '<div class="mcps-choice-row">'+choice('posterMode','self','Affiches Ma-Collection',s.posterMode)+
    choice('posterMode','custom','Ma propre adresse',s.posterMode)+
    choice('posterMode','default','Affiches par défaut',s.posterMode)+'</div>'+
    '<div class="mcps-card">'+(s.posterMode==='custom'?
      field('posterUrl','Adresse HTTPS des affiches','<input data-suite-field="posterUrl" type="url" value="'+attr(s.posterUrl)+'" placeholder="https://mon-domaine.example/affiches">'):
      '<p>'+(s.posterMode==='self'?'Utilise tes affiches existantes et les packs français hébergés par toi.':'Chaque extension conserve ses propres affiches et ses limites.')+'</p>')+
    action('open-poster-import','Préparer le transfert des affiches','mcps-primary')+'</div>';
}
export function renderSuiteStreaming(ctx){
  const s=ctx.draft.settings;
  return title('Configuration streaming','Prépare tes quatre extensions privées et les préférences d’un fournisseur de débridage, sans enregistrer de clé secrète.')+
    '<div class="mcps-card"><h3>1. Service de débridage (facultatif)</h3><p>Un service sélectionné n’est pas une connexion automatique.</p>'+
    '<div class="mcps-choice-row">'+[['','Aucun'],['torbox','TorBox'],['premiumize','Premiumize'],['realdebrid','Real-Debrid'],['alldebrid','AllDebrid']].map(([id,n])=>
      choice('debrid',id,n,s.debrid)).join('')+'</div></div>'+
    '<div class="mcps-card"><h3>2. Profil de recherche</h3><div class="mcps-choices">'+
      choice('streamPreset','best','Meilleure qualité',s.streamPreset,'Priorité à 4K/1080p si disponibles.')+
      choice('streamPreset','fast','Le plus rapide',s.streamPreset,'Préférer les réponses rapides et les flux légers.')+
      choice('streamPreset','coverage','Couverture maximale',s.streamPreset,'Conserver davantage d’options de recherche.')+'</div></div>'+
    '<div class="mcps-card"><h3>3. Mes quatre extensions</h3>'+
      '<div class="mcps-addon-grid">'+[
        ['streamFusion','StreamFusion'],['comet','Comet'],['aioMetadata','AIOMetadata'],['subtitlesAddon','Sous-titres']
      ].map(([k,n])=>toggle(k,n,s[k])).join('')+'</div>'+
      '<p class="mcps-muted">Les configurations publiques ne sont pas réinstallées automatiquement : connecte tes propres instances dans le gestionnaire d’extensions.</p>'+
      action('open-addon-manifests','Configurer les manifests','mcps-primary')+'</div>'+
    '<div class="mcps-inline-save">'+appStatus(ctx)+'</div>';
}
export function renderSuiteBackups(ctx){
  return title('Sauvegardes et mises à jour','Les sauvegardes restent dans ce navigateur. Tu peux les exporter, les importer et restaurer une ancienne version.')+
    '<div class="mcps-actions-line">'+action('backup','Créer une sauvegarde locale','mcps-primary')+
    action('export','Télécharger le profil JSON','mcps-small')+
    action('import','Importer un profil JSON','mcps-small')+
    action('open-update','Ouvrir la mise à jour du catalogue','mcps-small')+'</div>'+
    '<div class="mcps-backup-list">'+(ctx.backups.length?ctx.backups.map((b,i)=>
      '<div class="mcps-backup-item"><div><strong>'+h(b.name)+'</strong><small>'+h(new Date(b.updatedAt).toLocaleString('fr-FR'))+'</small></div>'+
      action('restore-backup','Restaurer','mcps-small','data-id="'+i+'"')+
      action('export-backup','Exporter','mcps-small','data-id="'+i+'"')+'</div>').join(''):
    '<div class="mcps-card mcps-empty">Aucune sauvegarde enregistrée sur cet appareil.</div>')+'</div>';
}
export function renderSuiteHistory(){
  return title('Historique de lecture','Consulte et exporte les films, épisodes et séries de ton compte Kovelyx.')+
    row('Copier mon historique','<p>La synchronisation est assurée par ton compte Kovelyx lorsque tu y es connecté. Aucune information de lecture n’est inventée dans Ma-Collection.</p>'+
    action('open-history','Ouvrir la bibliothèque Kovelyx','mcps-primary')+
    action('open-account','Gérer mon compte','mcps-small'));
}
export function renderSuiteCopy(ctx){
  return title('Copier un profil','Choisis une destination et vérifie les changements avant d’enregistrer.')+
    '<div class="mcps-copy-targets">'+
      '<button type="button" class="mcps-choice '+(ctx.copyTarget==='new'?'chosen':'')+'" data-suite-copy-target="new"><strong>Nouveau profil</strong><small>Créer une copie locale indépendante.</small></button>'+
      ctx.profiles.filter(p=>p.id!==ctx.draft.id).map(p=>
        '<button type="button" class="mcps-choice '+(ctx.copyTarget===p.id?'chosen':'')+'" data-suite-copy-target="'+attr(p.id)+'"><strong>'+h(p.name)+'</strong><small>Remplacer après confirmation.</small></button>').join('')+'</div>'+
      '<label class="mcps-field mcps-copy-name"><span>Nom du profil copié</span><input type="text" data-suite-copy-name value="'+attr(ctx.copyName)+'" maxlength="60"></label>'+
    '<div class="mcps-copy-footer">'+action('copy-profile','Créer cette copie','mcps-primary')+'</div>';
}
export function renderSuiteShare(ctx){
  return title('Partager ma configuration','Transfère tes réglages sans mot de passe ni clé API.')+
    '<div class="mcps-share-cards">'+row('Partager un lien sans secrets',
      '<p>Le lien contient le nom et les préférences, sans les rangées, les clés ou les URLs privées. Il ne nécessite aucun serveur externe.</p>'+
      action('share-link','Générer et copier le lien','mcps-primary'))+
    row('Copie complète du profil',
      '<p>Télécharge un fichier JSON contenant l’ordre des rangées et leurs choix visuels. Tu pourras le restaurer sur un autre appareil.</p>'+
      action('export','Télécharger la sauvegarde','mcps-primary'))+'</div>';
}
export function renderSuiteAccount(ctx){
  return title('Compte et profils','Utilise ton propre système de compte Kovelyx pour la connexion et le suivi des appareils.')+
    row('Compte Kovelyx','<p>La gestion des comptes est indépendante de Kaptain et de Nuvio. Les champs de connexion officiels restent dans l’interface de ton propre compte.</p>'+
    action('open-account','Ouvrir le compte Kovelyx','mcps-primary')+
    action('open-profile-editor','Éditeur complet de profils','mcps-small')+
    go('profiles','Mes profils locaux','mcps-small'));
}
export function renderSuiteWizard(ctx){
  const step=ctx.wizardStep||0;
  const steps=['Collection','Compte','Profil','Configuration','Streaming'];
  const explanations=[
    'Choisis si tu préfères utiliser ta collection actuelle ou la personnaliser.',
    'Un compte Kovelyx est facultatif pour utiliser la collection locale.',
    'Choisis le nom de ton profil et garde tes données sur ton appareil.',
    'Sélectionne des préférences de lecture simples.',
    'Prépare les extensions privées que tu souhaites utiliser.'
  ];
  const parts=[
    '<div class="mcps-choice-row">'+action('wizard-current','Utiliser ma collection actuelle','mcps-primary')+
      action('wizard-customize','Personnaliser la collection','mcps-small')+'</div>',
    '<p>Tu peux continuer sans compte. Pour synchroniser tes profils, utilise ton propre compte Kovelyx.</p>'+
       action('open-account','Ouvrir la connexion Kovelyx','mcps-small'),
    field('profile-name','Nom du profil','<input data-suite-profile-name type="text" maxlength="60" value="'+attr(ctx.draft.name)+'">'),
    '<div class="mcps-presets compact">'+SUITE_PRESETS.slice(0,4).map(p=>
      '<button type="button" data-suite-preset="'+attr(p.id)+'" class="mcps-choice '+(ctx.preset===p.id?'chosen':'')+'"><strong>'+h(p.name)+'</strong><small>'+h(p.desc)+'</small></button>').join('')+'</div>'+
      action('apply-preset','Préparer le préréglage','mcps-small',ctx.preset?'':'disabled'),
    '<div class="mcps-addon-grid">'+[['streamFusion','StreamFusion'],['comet','Comet'],['aioMetadata','AIOMetadata'],['subtitlesAddon','Sous-titres']].map(([k,n])=>
      toggle(k,n,ctx.draft.settings[k])).join('')+'</div>'
  ];
  return '<section class="mcps-wizard"><aside><h1>Configurer ma collection</h1><p>Un parcours guidé, sans compte externe obligatoire.</p>'+
    '<ol>'+steps.map((x,i)=>'<li class="'+(i===step?'current':i<step?'done':'')+'">'+h(x)+'</li>').join('')+'</ol></aside>'+
    '<div class="mcps-wizard-page"><h2>'+h(steps[step])+'</h2><p>'+h(explanations[step])+'</p>'+
    '<div class="mcps-card">'+parts[step]+'</div>'+
    '<div class="mcps-actions-line">'+action('wizard-back','Retour','mcps-small',step===0?'disabled':'')+
    action(step===4?'wizard-finish':'wizard-next',step===4?'Terminer':'Continuer','mcps-primary')+'</div></div></section>';
}
export function renderSuiteScreen(screen,ctx){
  if(screen==='profiles')return renderSuiteProfiles(ctx);
  if(screen==='dashboard')return renderSuiteDashboard(ctx);
  if(screen==='layout')return renderSuiteLayout(ctx);
  if(screen==='quick')return renderSuiteQuick(ctx);
  if(screen==='artwork')return renderSuiteArtwork(ctx);
  if(screen==='presets')return renderSuitePresets(ctx);
  if(screen==='all-settings')return renderSuiteAllSettings(ctx);
  if(screen==='look')return renderSuiteLook(ctx);
  if(screen==='details')return renderSuiteDetails(ctx);
  if(screen==='continue')return renderSuiteContinue(ctx);
  if(screen==='alerts')return renderSuiteAlerts(ctx);
  if(screen==='player')return renderSuitePlayer(ctx);
  if(screen==='autoplay')return renderSuiteAutoplay(ctx);
  if(screen==='stream-picker')return renderSuiteStreamPicker(ctx);
  if(screen==='subtitles')return renderSuiteSubtitles(ctx);
  if(screen==='language')return renderSuiteLanguage(ctx);
  if(screen==='filters')return renderSuiteFilters(ctx);
  if(screen==='performance')return renderSuitePerformance(ctx);
  if(screen==='poster')return renderSuitePoster(ctx);
  if(screen==='streaming'||screen==='addons')return renderSuiteStreaming(ctx);
  if(screen==='backups')return renderSuiteBackups(ctx);
  if(screen==='history')return renderSuiteHistory(ctx);
  if(screen==='copy')return renderSuiteCopy(ctx);
  if(screen==='share')return renderSuiteShare(ctx);
  if(screen==='account')return renderSuiteAccount(ctx);
  if(screen==='onboarding')return renderSuiteWizard(ctx);
  if(screen==='add')return title('Ajouter des rangées et dossiers','Utilise les outils indépendants de Ma-Collection pour ajouter des contenus, des sagas ou des dossiers personnels.')+
    '<div class="mcps-actions-line">'+action('open-original-studio','Parcourir le catalogue','mcps-primary')+
    action('open-create-folder','Créer un dossier','mcps-small')+
    action('open-guided','Assistant de personnalisation','mcps-small')+'</div>';
  return renderSuiteDashboard(ctx);
}
