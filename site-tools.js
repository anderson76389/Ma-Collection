/** Same-site navigation to independent tools. No upstream pages or scripts are loaded. */
(()=>{
 let modal=null,opener=null;
 const tools=[
  ['Statistiques','Rangées, dossiers et sources du catalogue',()=>showStats()],
  ['Collection','Parcourir et sélectionner les dossiers',()=>window.hideTitleScreen?.()],
  ['Assistant guidé','Collection, compte, profil, préférences et streaming',()=>window.MaCollectionProfileSuite?.open('onboarding')],
  ['Éditeur rapide','Activer les dossiers et les sources',()=>window.openSimpleEditor?.()],
  ['Studio complet','Profils, rangées, affiches, lecture et tous les paramètres',()=>window.MaCollectionProfileSuite?.open('profiles')],
  ['Mon profil Kovelyx','Lire, créer, réordonner et publier un profil complet',()=>window.MaCollectionProfileEditor?.open()],
  ['Bibliothèque et historique','Titres enregistrés, vus et en cours sur Kovelyx',()=>window.MaCollectionProfileHistory?.open()],
  ['Créer un dossier','Saga, liste, studio, réseau, acteur ou réalisateur',()=>window.MaCollectionCustomFolders?.open()],
  ['Importer et synchroniser','Choisir un fichier, le PC ou le compte Kovelyx',()=>window.MaCollectionDestination?.open()],
  ['Auto-hébergement AIO','Exporter une configuration pour ton instance',()=>window.showSelfHostStartChoice?.()],
  ['Affiches des médias','Configurer Bttr, RPDB ou un lien personnel avant envoi',()=>window.MaCollectionImportStudio?.open('kovelyx')],
  ['Aide et dépendances','Comprendre les catégories vides et les mises à jour',()=>window.showUpdateFaqModal?.()],
  ['Garde-robe des affiches','Choisir les variantes visuelles dans le Studio',()=>window.MaCollectionStudio?.open('bibliotheque')],
  ['Extensions du Studio','Préparer les manifests utiles à Kovelyx',()=>window.MaCollectionStudio?.open('extensions')],
  ['Langues et préférences','Personnaliser l’apparence et les aperçus locaux',()=>window.MaCollectionStudio?.open('parametres')],
  ['Partager ma collection','Exporter, sauvegarder et transférer les profils',()=>window.MaCollectionStudio?.open('partage')]
 ];
 function showStats(){
  const rows=window.collectionData||window.NUVIO_DATABASE||[];
  const stats=document.createElement('dialog');
  stats.className='suite-stats';
  stats.setAttribute('aria-labelledby','suite-stats-title');
  stats.innerHTML='<header><h2 id="suite-stats-title">Statistiques de la collection</h2><form method="dialog"><button aria-label="Fermer">×</button></form></header><div class="suite-numbers"></div><h3>Dossiers par catégorie</h3><ul></ul>';
  const folders=rows.flatMap(row=>row.folders||[]);
  for(const [value,label] of [[rows.length,'Rangées'],[folders.length,'Dossiers'],[folders.reduce((n,f)=>n+(f.sources?.length||0),0),'Sources']]){
    const metric=document.createElement('div'),number=document.createElement('strong');
    number.textContent=value.toLocaleString('fr-FR');metric.append(number,label);stats.querySelector('.suite-numbers').append(metric);
  }
  const max=Math.max(1,...rows.map(row=>row.folders.length));
  for(const row of rows){
    const li=document.createElement('li'),meter=document.createElement('meter');
    meter.min=0;meter.max=max;meter.value=row.folders.length;meter.setAttribute('aria-label',row.title);
    li.append(row.title,meter,String(meter.value));stats.querySelector('ul').append(li);
  }
  document.body.append(stats);stats.addEventListener('close',()=>stats.remove(),{once:true});stats.showModal();
 }
 function close(){
  if(!modal||modal.hidden)return;
  modal.hidden=true;
  opener?.setAttribute('aria-expanded','false');
  opener?.focus();opener=null;
 }
 function open(){
   if(!modal){
     modal=document.createElement('div');
     modal.className='mc-profile-overlay';
     modal.id='mc-tools';
     modal.innerHTML='<section class="mc-profile-panel mc-tools-panel" role="dialog" aria-modal="true" aria-labelledby="mc-tools-title">'+
       '<header class="mc-tools-header"><div class="mc-tools-brand">'+
       '<img src="assets/kovelyx-logo.svg" width="36" height="36" alt="">'+
       '<div><small>MA-COLLECTION · OUTILS</small><h2 id="mc-tools-title">Tout personnaliser</h2></div></div>'+
       '<button type="button" class="mc-tools-close" data-tools-close aria-label="Fermer les outils">×</button></header>'+
       '<p class="mc-tools-intro">Retrouve tous les parcours de ta collection. Chaque bouton ouvre un outil Ma-Collection ou ton propre compte Kovelyx.</p>'+
       '<div class="mc-tools-grid"></div>'+
       '<footer class="mc-tools-footer">Studio en français · Ressources du site et visuels indépendants de Kaptain</footer>'+
       '</section>';
     document.body.appendChild(modal);
     modal.querySelector('[data-tools-close]').addEventListener('click',close);
     modal.addEventListener('click',e=>{if(e.target===modal)close();});
     // Les entrées sont regroupées par usage. Toutes les actions existantes
     // restent présentes : aucun raccourci factice ou menu perdu.
     const groups=[
       ['Parcourir et configurer','Collection, assistant et éditeurs',[1,2,3,4]],
       ['Personnaliser le Studio','Créer des dossiers, choisir les affiches et les extensions',[7,12,10,13]],
       ['Profils et synchronisation','Compte Kovelyx, bibliothèque, import et sauvegardes',[5,6,8,15]],
       ['Hébergement et préférences','Services personnels, réglages, statistiques et aide',[9,14,0,11]]
     ];
     const grid=modal.querySelector('.mc-tools-grid');
     for(const [title,subtitle,indices]of groups){
       const section=document.createElement('section');
       section.className='mc-tools-group';
       const header=document.createElement('header');
       const heading=document.createElement('h3'),small=document.createElement('small');
       heading.textContent=title;small.textContent=subtitle;
       header.append(heading,small);section.appendChild(header);
       const choices=document.createElement('div');
       choices.className='mc-tools-options';
       for(const index of indices){
         const [name,description,run]=tools[index];
         const button=document.createElement('button'),strong=document.createElement('strong'),text=document.createElement('span');
         button.type='button';button.className='mc-tools-option';button.dataset.mcTool=String(index);
         strong.textContent=name;text.textContent=description;
         button.append(strong,text);
         button.addEventListener('click',()=>{close();run();});
         choices.appendChild(button);
       }
       section.appendChild(choices);grid.appendChild(section);
     }
   }
   opener=document.activeElement?.closest('.home-dock button');
   modal.classList.toggle('suite-drawer',opener?.id==='suite-menu');
   modal.classList.toggle('mc-tools-dock',opener?.id==='home-tools-menu');
   opener?.setAttribute('aria-expanded','true');
   modal.hidden=false;modal.querySelector('[data-tools-close]').focus();
 }
 function install(){
  const bar=document.getElementById('nv-preview-secondary');
  if(bar&&!bar.querySelector('[data-mc-tools]')){for(const [text,fn]of [['Mon profil Kovelyx',()=>window.MaCollectionProfileEditor?.open()],['Tous les outils',open]]){const b=document.createElement('button');b.type='button';b.className='cat-action-btn';b.dataset.mcTools='';b.textContent=text;b.addEventListener('click',fn);bar.appendChild(b);}}
 }
 let pending=false;
 function refresh(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;install();});}
 function route(){
   const key=location.hash.replace(/^#\/?/,'');
   if(key==='studio'){
     // L'entrée directe /studio.html fonctionne même si les catalogues
     // se chargent après l'initialisation de la navigation.
     let attempts=0;
     const openStudio=()=>{
       if(location.hash.replace(/^#\/?/,'')!=='studio')return;
       if(window.collectionData?.length && window.MaCollectionProfileSuite?.open){
         window.MaCollectionProfileSuite.open('profiles');return;
       }
       if(attempts++<80)setTimeout(openStudio,100);
     };
     openStudio();return;
   }
   if(key==='profil')window.MaCollectionProfileEditor?.open();else if(key==='mise-a-jour')window.MaCollectionProfileEditor?.open({update:true});else if(key==='historique')window.MaCollectionProfileHistory?.open();else if(key==='statistiques')showStats();else if(key==='outils')open();else if(key==='aide')window.showUpdateFaqModal?.();}
 const start=()=>{
  const dock=document.querySelector('.home-dock');
  dock?.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button)return;
    if(button.id==='suite-menu'||button.id==='home-tools-menu')open();
    else if(button.id==='suite-stats')showStats();
    else if(button.dataset.homeTarget==='title-screen-studio')window.MaCollectionProfileSuite?.open('profiles');
    else document.getElementById(button.dataset.homeTarget)?.click();
  });
  document.getElementById('home-edit-profile')?.addEventListener('click',()=>window.MaCollectionProfileEditor?.open({account:true}));
  document.getElementById('home-update-profile')?.addEventListener('click',()=>window.MaCollectionProfileEditor?.open({update:true}));
  const homeShortcuts={
    'title-screen-create-folder':()=>window.MaCollectionCustomFolders?.open(),
    'title-screen-art-library':()=>window.MaCollectionStudio?.open('bibliotheque'),
    'title-screen-manage-addons':()=>window.MaCollectionStudio?.open('extensions'),
    'title-screen-studio-settings':()=>window.MaCollectionStudio?.open('parametres'),
    'title-screen-studio-share':()=>window.MaCollectionStudio?.open('partage'),
  };
  for(const [id,launch] of Object.entries(homeShortcuts)){
    document.getElementById(id)?.addEventListener('click',launch);
  }
  install();new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true});requestAnimationFrame(route);};
 window.addEventListener('hashchange',route);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal&&!modal.hidden)close();});
 window.MaCollectionTools=Object.freeze({open});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
