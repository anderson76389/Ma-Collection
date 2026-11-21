/** Same-site navigation to independent tools. No upstream pages or scripts are loaded. */
(()=>{
 let modal=null,opener=null;
 const tools=[
  ['Statistiques','Rangées, dossiers et sources du catalogue',()=>showStats()],
  ['Collection','Parcourir et sélectionner les dossiers',()=>window.hideTitleScreen?.()],
  ['Assistant guidé','Région, langue, filtres, plateformes et chaînes',()=>window.startCustomize?.()],
  ['Éditeur rapide','Activer les dossiers et les sources',()=>window.openSimpleEditor?.()],
  ['Studio des catalogues','Profils locaux, affiches, styles et sauvegardes',()=>window.MaCollectionStudio?.open('accueil')],
  ['Mon profil Kovelyx','Lire, créer, réordonner et publier un profil complet',()=>window.MaCollectionProfileEditor?.open()],
  ['Bibliothèque et historique','Titres enregistrés, vus et en cours sur Kovelyx',()=>window.MaCollectionProfileHistory?.open()],
  ['Créer un dossier','Saga, liste, studio, réseau, acteur ou réalisateur',()=>window.MaCollectionCustomFolders?.open()],
  ['Importer et synchroniser','Choisir un fichier, le PC ou le compte Kovelyx',()=>window.MaCollectionDestination?.open()],
  ['Auto-hébergement AIO','Exporter une configuration pour ton instance',()=>window.showSelfHostStartChoice?.()],
  ['Affiches des médias','Configurer Bttr, RPDB ou un lien personnel avant envoi',()=>window.MaCollectionImportStudio?.open('kovelyx')],
  ['Aide et dépendances','Comprendre les catégories vides et les mises à jour',()=>window.showUpdateFaqModal?.()]
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
  if(!modal){modal=document.createElement('div');modal.className='mc-profile-overlay';modal.id='mc-tools';modal.innerHTML='<section class="mc-profile-panel" role="dialog" aria-modal="true" aria-labelledby="mc-tools-title"><header><h2 id="mc-tools-title">Outils Ma-Collection</h2><button type="button" data-tools-close>Fermer</button></header><p>Tous les outils utilisent Ma-Collection et tes propres services. Les clés nécessaires se configurent dans leurs écrans respectifs.</p><div class="mc-tools-grid"></div></section>';document.body.appendChild(modal);modal.querySelector('[data-tools-close]').addEventListener('click',close);modal.addEventListener('click',e=>{if(e.target===modal)close();});
   const grid=modal.querySelector('.mc-tools-grid');for(const [name,description,run]of tools){const button=document.createElement('button');const strong=document.createElement('strong'),text=document.createElement('span');strong.textContent=name;text.textContent=description;button.append(strong,text);button.addEventListener('click',()=>{close();run();});grid.appendChild(button);}
  }
  opener=document.activeElement?.closest('.home-dock button');
  modal.classList.toggle('suite-drawer',opener?.id==='suite-menu');
  modal.classList.toggle('mc-tools-dock',opener?.id==='home-tools-menu');
  opener?.setAttribute('aria-expanded','true');
  modal.hidden=false;modal.querySelector('button').focus();
 }
 function install(){
  const bar=document.getElementById('nv-preview-secondary');
  if(bar&&!bar.querySelector('[data-mc-tools]')){for(const [text,fn]of [['Mon profil Kovelyx',()=>window.MaCollectionProfileEditor?.open()],['Tous les outils',open]]){const b=document.createElement('button');b.type='button';b.className='cat-action-btn';b.dataset.mcTools='';b.textContent=text;b.addEventListener('click',fn);bar.appendChild(b);}}
 }
 let pending=false;
 function refresh(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;install();});}
 function route(){const key=location.hash.replace(/^#\/?/,'');if(key==='profil')window.MaCollectionProfileEditor?.open();else if(key==='mise-a-jour')window.MaCollectionProfileEditor?.open({update:true});else if(key==='historique')window.MaCollectionProfileHistory?.open();else if(key==='studio')window.MaCollectionStudio?.open('accueil');else if(key==='statistiques')showStats();else if(key==='outils')open();else if(key==='aide')window.showUpdateFaqModal?.();}
 const start=()=>{
  const dock=document.querySelector('.home-dock');
  dock?.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button)return;
    if(button.id==='suite-menu'||button.id==='home-tools-menu')open();
    else if(button.id==='suite-stats')showStats();
    else document.getElementById(button.dataset.homeTarget)?.click();
  });
  document.getElementById('home-edit-profile')?.addEventListener('click',()=>window.MaCollectionProfileEditor?.open({account:true}));
  document.getElementById('home-update-profile')?.addEventListener('click',()=>window.MaCollectionProfileEditor?.open({update:true}));
  install();new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true});requestAnimationFrame(route);};
 window.addEventListener('hashchange',route);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal&&!modal.hidden)close();});
 window.MaCollectionTools=Object.freeze({open});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
