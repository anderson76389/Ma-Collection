/* QA Playwright : le Studio agit uniquement dans le navigateur local, sans compte distant. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const fail=[],pass=[];
async function test(name,fn){
  try{await fn();console.log('STUDIO_QA_OK '+name);pass.push(name);}
  catch(e){console.error('STUDIO_QA_FAIL '+name+': '+e.message);fail.push(name+': '+e.message);}
}
const base='http://127.0.0.1:8877/';
const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
page.setDefaultTimeout(9000);
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
try {
  await page.waitForFunction(()=>window.MaCollectionStudio?.open &&
    window.collectionData?.length>=16 && window.MaCollectionExport?.assembleFilteredDatabase,
    null,{timeout:60000});
} catch (error) {
  const diag=await page.evaluate(()=>({
    studio:typeof window.MaCollectionStudio,
    categories:window.collectionData?.length,
    exports:typeof window.MaCollectionExport,
    moduleScripts:[...document.querySelectorAll('script[type="module"]')].map(x=>x.src)
  }));
  throw Error('Studio indisponible : '+JSON.stringify(diag)+' | erreurs JS '+JSON.stringify(errors)+' | '+error.message);
}

async function switchStudioTab(where, tab){
  const menu=where.locator('[data-action=studio-menu]');
  if(await menu.getAttribute('aria-expanded')!=='true') await menu.click();
  await where.locator('[data-tab="'+tab+'"]').click();
}
const initialTotal=await page.evaluate(()=>window.collectionData.reduce((n,c)=>n+c.folders.length,0));

await test('nouvelle carte dans le design original',async()=>{
  assert.equal(await page.locator('#title-screen-studio').count(),1);
  assert.equal(await page.locator('#se-studio').count(),1);
  const oldStyle=await page.locator('#title-screen-start').evaluate(x=>getComputedStyle(x).color);
  const newStyle=await page.locator('#title-screen-studio').evaluate(x=>getComputedStyle(x).color);
  assert.equal(newStyle,oldStyle,'La nouvelle carte doit suivre le thème actuel');
});
await test('Accueil FR : raccourcis vers les outils du Studio complet',async()=>{
  await page.locator('#mc-home-more-tools summary').click();
  for(const [id,tab] of [
    ['title-screen-art-library','bibliotheque'],
    ['title-screen-manage-addons','extensions'],
    ['title-screen-studio-settings','parametres'],
    ['title-screen-studio-share','partage'],
  ]){
    await page.locator('#'+id).click();
    const studio=page.locator('#mc-studio-root');
    assert(await studio.isVisible(),'Outil inaccessible : '+id);
    assert.equal(await studio.locator('[data-tab="'+tab+'"]').getAttribute('aria-selected'),'true');
    await studio.locator('[data-action=close]').click();
  }
});
await test('Studio plein écran : menu latéral français, préférences réelles et partage',async()=>{
  await page.evaluate(()=>window.MaCollectionStudio.open('accueil'));
  const studio=page.locator('#mc-studio-root');
  assert(await studio.isVisible());
  assert.equal(await studio.locator('[data-tab]').count(),15);
  const geometry=await studio.locator('.mc-studio-panel').evaluate(el=>{
    const r=el.getBoundingClientRect();
    return {width:r.width,height:r.height,screenWidth:innerWidth,screenHeight:innerHeight};
  });
  assert(Math.abs(geometry.width-geometry.screenWidth)<3,'Le Studio ne remplit pas l’écran');
  assert(Math.abs(geometry.height-geometry.screenHeight)<3,'Le Studio ne remplit pas la hauteur');
  assert(await studio.locator('.mc-studio-side-brand').isHidden(),'Le menu ne doit pas encombrer le Studio');
  assert(await studio.locator('.mc-studio-top-links').isVisible(),'La navigation supérieure doit être visible');
  await studio.locator('[data-action=studio-menu]').click();
  await studio.locator('.mc-studio-side-brand').waitFor({state:'visible',timeout:2500});
  assert.equal(await studio.locator('[data-action=studio-menu]').getAttribute('aria-expanded'),'true');
  await studio.locator('[data-action=studio-menu]').click();
  await switchStudioTab(studio,'parametres');
  await studio.locator('[data-action=studio-theme][data-theme-value=light]').click();
  assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('data-theme')),'light');
  await studio.locator('[data-action=studio-theme][data-theme-value=dark]').click();
  assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('data-theme')),null);
  await studio.locator('[data-action=studio-preview-device][data-device-value=mobile]').click();
  assert.equal(await studio.locator('[data-action=studio-preview-device][data-device-value=mobile]').getAttribute('aria-pressed'),'true');
  await switchStudioTab(studio,'partage');
  const file=page.waitForEvent('download');
  await studio.locator('[data-action=export]').click();
  assert((await file).suggestedFilename().endsWith('.json'));
  await studio.locator('[data-action=close]').click();
});
await test('Studio clavier : flèches, début/fin, sélection et confinement du focus',async()=>{
  await page.evaluate(()=>window.MaCollectionStudio.open('organisation'));
  const studio=page.locator('#mc-studio-root'),menu=studio.locator('[data-action=studio-menu]');
  try {
  await menu.click();
  await studio.locator('.mc-studio-side-brand').waitFor({state:'visible'});
  await studio.locator('[data-tab=organisation]').focus();
  assert(await studio.locator('[data-tab=organisation]').evaluate(el=>document.activeElement===el),
    'Un onglet visible doit recevoir le focus avant le raccourci');
  await page.keyboard.press('ArrowDown');
  assert(await studio.locator('[data-tab=apercu]').evaluate(el=>document.activeElement===el),
    'Flèche bas : onglet suivant au focus');
  assert.equal(await studio.locator('[data-tab=organisation]').getAttribute('aria-selected'),'true',
    'Les flèches ne doivent pas appliquer une nouvelle rubrique');
  await page.keyboard.press('End');
  assert(await studio.locator('[data-tab=parametres]').evaluate(el=>document.activeElement===el));
  await page.keyboard.press('Home');
  assert(await studio.locator('[data-tab=accueil]').evaluate(el=>document.activeElement===el));
  await page.keyboard.press('Enter');
  assert.equal(await studio.locator('[data-tab=accueil]').getAttribute('aria-selected'),'true');
  assert.equal(await menu.getAttribute('aria-expanded'),'false');
  await studio.locator('.mc-studio-tabs').waitFor({state:'hidden'});
  await menu.focus();
  await page.keyboard.press('Shift+Tab');
  const focusInside=await studio.evaluate(el=>el.contains(document.activeElement));
  assert(focusInside,'Maj+Tab doit rester dans le Studio, pas retourner à l’accueil');
  await page.keyboard.press('Tab');
  assert(await menu.evaluate(el=>document.activeElement===el),
    'Tab doit revenir au premier bouton du Studio');
  await menu.click();
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'),'false');
  assert(await studio.isVisible(),'Échap ferme d’abord le menu, pas le Studio');
  await page.keyboard.press('Escape');
  assert(await studio.isHidden(),'Échap ferme ensuite le Studio');
  } finally {
    if(await studio.isVisible()) await studio.locator('[data-action=close]').click({force:true});
  }
});
await test('vue cinéma : vraies affiches, rangées déplaçables et brouillon intact',async()=>{
  await page.evaluate(()=>window.MaCollectionStudio.open('accueil'));
  const studio=page.locator('#mc-studio-root');
  try{
    const initial=await page.evaluate(()=>JSON.stringify(window.collectionData));
    await studio.locator('.suite-tiles [data-action="canvas-open"]').first().click();
    assert(await studio.locator('.mc-cinema-organizer').isVisible());
    assert(await studio.locator('.mc-cinema-row').count()>=16,
      'Toutes les rangées disponibles du profil doivent rester accessibles');
    assert(await studio.locator('.mc-cinema-tile').count()>20);
    const firstRow=await studio.locator('.mc-cinema-row').first().getAttribute('data-drag-id');
    await studio.locator('.mc-cinema-row').first().locator('[data-action=canvas-section-down]').click();
    assert.notEqual(await studio.locator('.mc-cinema-row').first().getAttribute('data-drag-id'),firstRow,
      'Monter ou descendre doit réellement modifier l’ordre du brouillon');
    await studio.locator('[data-action=canvas-toggle-active]').click();
    assert.equal(await studio.locator('[data-action=canvas-toggle-active]').getAttribute('aria-pressed'),'true');
    const firstWithFolder=studio.locator('.mc-cinema-row .mc-cinema-tile').first();
    const folderId=await firstWithFolder.getAttribute('data-folder-id');
    const rowId=await firstWithFolder.locator('xpath=ancestor::section[contains(@class,"mc-cinema-row")]').getAttribute('data-drag-id');
    await firstWithFolder.locator('[data-action=canvas-art]').click();
    assert.equal(await studio.locator('[data-tab=affiches]').getAttribute('aria-selected'),'true');
    assert(await studio.locator('.mc-studio-theater').isVisible(),
      'Une affiche doit ouvrir le véritable éditeur du dossier');
    assert.equal(await page.evaluate(()=>JSON.stringify(window.collectionData)),initial,
      'Changer le brouillon visuel ne doit pas modifier les catalogues actifs avant application');
    await switchStudioTab(studio,'organisation');
    await studio.locator('[data-action=canvas-open-list]').click();
    assert(await studio.locator('.mc-studio-columns').isVisible());
    assert(folderId&&rowId);
  }finally{
    if(await studio.isVisible())await studio.locator('[data-action=close]').click();
  }
});
await test('géométrie fidèle : double barre, cartes et menu non permanent',async()=>{
  await page.evaluate(()=>window.MaCollectionStudio.open('accueil'));
  const studio=page.locator('#mc-studio-root');
  await studio.locator('.mc-studio-tabs').waitFor({state:'hidden'});
  const metrics=await studio.evaluate(el=>{
    const size=sel=>{const r=el.querySelector(sel).getBoundingClientRect();
      return {x:r.x,y:r.y,width:r.width,height:r.height};};
    const nav=el.querySelector('.mc-studio-tabs');
    return {header:size('.mc-studio-header'),sub:size('.mc-studio-context'),
      profile:size('.suite-profile'),card:size('.suite-tiles button'),
      menuVisible:getComputedStyle(nav).visibility!=='hidden',width:innerWidth};
  });
  assert(metrics.header.height>=54&&metrics.header.height<=58,JSON.stringify(metrics.header));
  assert(metrics.sub.height>=45&&metrics.sub.height<=60,JSON.stringify(metrics.sub));
  assert(metrics.profile.y>metrics.sub.y+metrics.sub.height-1);
  assert(metrics.card.width>=235&&metrics.card.width<=360,JSON.stringify(metrics.card));
  assert.equal(metrics.menuVisible,false,'Le menu ne doit pas occuper de place en permanence');
  await studio.locator('[data-action=studio-menu]').click();
  assert.equal(await studio.locator('[data-action=studio-menu]').getAttribute('aria-expanded'),'true');
  await studio.locator('.mc-studio-nav-scrim').click({position:{x:1000,y:300}});
  assert.equal(await studio.locator('[data-action=studio-menu]').getAttribute('aria-expanded'),'false');
  await studio.locator('[data-action=close]').click();
});
await test('Studio : ordre des cartes et vrai bouton Créer un dossier',async()=>{
  await page.evaluate(()=>window.MaCollectionStudio.open('accueil'));
  const studio=page.locator('#mc-studio-root');
  const titles=await studio.locator('.suite-tiles button strong').allTextContents();
  assert.equal(titles.length,19,'Les outils doivent être organisés selon les parcours du Studio de référence');
  assert.deepEqual(titles.slice(0,6),[
    'Écran d’accueil','Éditeur rapide','Affiches','Ajouter des rangées et dossiers',
    'Créer un dossier','Mes créations'
  ]);
  await studio.locator('.suite-tiles [data-action=create-folder]').first().click();
  assert(await page.locator('.mc-folder-dialog').isVisible(),
    'Le bouton Créer un dossier doit ouvrir un véritable formulaire indépendant');
  await page.locator('.mc-folder-close').click();
  await page.evaluate(()=>window.MaCollectionStudio.open('accueil'));
  await page.locator('#mc-studio-root [data-action=close]').click();
});
await test('Studio : Mes créations affiche les vrais dossiers et ouvre leur gestionnaire',async()=>{
  await page.evaluate(()=>window.MaCollectionStudio.open('mes-creations'));
  const root=page.locator('#mc-studio-root');
  assert(await root.locator('.mc-studio-curations').isVisible());
  const listed=await page.evaluate(()=>window.MaCollectionCustomFolders?.readRecords?.().length||0);
  assert.equal(await root.locator('.mc-studio-curation-card').count(),listed);
  await root.locator('.mc-studio-curations [data-action=create-folder]').click();
  assert(await page.locator('.mc-folder-dialog').isVisible());
  await page.locator('.mc-folder-close').click();
  await page.evaluate(()=>window.MaCollectionStudio.open('accueil'));
  await root.locator('[data-action=close]').click();
});
await test('réduction du mouvement respectée par le Studio',async()=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>window.MaCollectionStudio.open('accueil'));
  await switchStudioTab(page,'profils');
  const count=await page.locator('.mc-studio-content').evaluate(el=>el.getAnimations().length);
  assert.equal(count,0,'Le Studio ne doit pas déclencher de transition en mouvement réduit');
  await page.locator('[data-action=close]').click();
  await page.emulateMedia({reducedMotion:'no-preference'});
});
await test('aucune mutation sans application explicite',async()=>{
  const before=await page.evaluate(()=>({
    first:window.collectionData[0].title,
    total:window.collectionData.reduce((n,c)=>n+c.folders.length,0)
  }));
  await page.evaluate(()=>window.MaCollectionStudio.open());
  assert(await page.locator('#mc-studio-root').isVisible());
  assert(await page.locator('[data-tab=organisation]').getAttribute('aria-selected')==='true');
  const input=page.locator('[data-section-label]');
  await input.fill('Section personnalisée du Studio');
  await input.press('Tab');
  const current=await page.evaluate(()=>({
    first:window.collectionData[0].title,
    total:window.collectionData.reduce((n,c)=>n+c.folders.length,0)
  }));
  assert.deepEqual(current,before,'Éditer le brouillon ne doit pas changer les catégories réelles');
});
await test('affiches, sources, format et titre personnalisables',async()=>{
  await page.locator('[data-action=goto-art]').click();
  assert(await page.locator('[data-tab=affiches]').getAttribute('aria-selected')==='true');
  const name=page.locator('[data-folder-label]');
  await name.fill('Mon dossier Studio');
  await name.press('Tab');
  await page.locator('[data-shape]').selectOption('POSTER');
  const count=await page.locator('[data-source]').count();
  assert(count>0,'Des sources éditables doivent apparaître');
  await page.locator('[data-source]').first().uncheck();
  const rest=await page.locator('[data-source]:checked').count();
  assert.equal(rest,count-1);
  // Rétablir la source après avoir testé le bouton ; sinon Spotlight peut
  // disparaître de l'export lorsqu'il n'a qu'une seule source.
  await page.locator('[data-source]').first().check();
  const art=await page.locator('[data-art]').count();
  assert.equal(art,4);
  assert(await page.locator('.mc-studio-theater').isVisible(),'La galerie d’affiches doit être visible');
  assert(await page.locator('[data-art-section] option').count()>1);
  assert(await page.locator('.mc-studio-gallery-pips [aria-label="Choisir Décor du dossier"]').count() === 1);
  await page.locator('[data-action=batch-open]').click();
  await page.locator('[data-batch-shape]').selectOption('POSTER');
  await page.locator('[data-batch-glow]').check();
  await page.locator('[data-action=batch-apply]').click();
  assert.equal(await page.locator('[data-shape]').inputValue(),'POSTER');
  assert(await page.locator('[data-flag=focusGlowEnabled]').isChecked());
  await page.locator('.mc-studio-gallery-pips [aria-label="Choisir Écho"]').click();
  assert.equal(await page.locator('.mc-look.current span').textContent(),'Écho');
  assert(await page.locator('[data-action=art-row-style]').isVisible());
  await page.locator('[data-action=art-use]').click();
  assert.match(await page.locator('[data-art=coverImageUrl]').inputValue(),/^data:image\/svg/);
  const alt=await page.evaluate(()=>{
    const current=window.collectionData[0]?.folders[0]?.coverImageUrl;
    return window.collectionData.flatMap(c=>c.folders||[]).map(f=>f.coverImageUrl)
      .find(u=>u&&u!==current&&u.startsWith('https://ma-art.mailpromahe.workers.dev/'));
  });
  assert(alt,'Une deuxième image hébergée sur Ma-Art doit exister');
  page.once('dialog',dialog=>dialog.accept(alt));
  await page.locator('[data-action=art-add]').click();
  assert(await page.locator('[data-action=art-select]').count()>=2,'Deux visuels doivent être disponibles');
  await page.locator('[data-action=art-use]').click();
  assert.equal(await page.locator('[data-art=coverImageUrl]').inputValue(),alt);
  await page.locator('[data-flag=focusGlowEnabled]').check();
});
await test('Studio : onglet Extensions et fichier de manifests pour Kovelyx',async()=>{
  await switchStudioTab(page,'extensions');
  assert((await page.locator('#mc-studio-root').innerText()).includes('Mes extensions Kovelyx'));
  const fields=page.locator('[data-addon-manifest]');
  if(await fields.count()){
    await fields.first().fill('https://addons.example.org/config/manifest.json');
    await fields.first().press('Tab');
    const download=page.waitForEvent('download');
    await page.locator('[data-action=addon-export]').click();
    const file=await download;
    const {readFile}=await import('node:fs/promises');
    const payload=JSON.parse(await readFile(await file.path(),'utf8'));
    assert.equal(payload.format,'kovelyx-addon-urls-v1');
    assert(payload.addons.some(x=>x.manifestUrl==='https://addons.example.org/config/manifest.json'));
    assert(!JSON.stringify(payload).includes('kaptain.stream'));
  } else {
    assert((await page.locator('#mc-studio-root').innerText()).includes('Aucune source d’extension sélectionnée'));
  }
});
await test('sauvegarde de plusieurs profils sans secret + export JSON',async()=>{
  await switchStudioTab(page,'profils');
  await page.locator('[data-profile-name]').fill('Profil Salon');
  await page.locator('[data-profile-name]').press('Tab');
  await page.locator('[data-sync-quick]').check();
  await page.locator('[data-action=save]').click();
  const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_collection_studio_profiles_v1')||'[]'));
  assert.equal(data.length,1);
  assert.equal(data[0].name,'Profil Salon');
  assert.equal(JSON.stringify(data).includes('secret_access_token'),false);
  const [download]=await Promise.all([
    page.waitForEvent('download'),page.locator('[data-action=export]').click()
  ]);
  assert(download.suggestedFilename().startsWith('ma-collection-profil-'));
});
await test('recherche globale : retrouver et ouvrir un dossier du brouillon',async()=>{
  // Le brouillon édité précédemment doit rester ouvert pour le test d'application.
  assert(await page.locator('#mc-studio-root').isVisible());
  await switchStudioTab(page,'recherche');
  // Le premier dossier a été renommé dans le brouillon précédent : chercher son nouveau nom.
  const query='Mon dossier Studio';
  const search=page.locator('[data-global-search]');
  await search.fill(query);
  assert(await page.locator('.mc-studio-global-item').count()>0);
  await search.evaluate(el=>el.setSelectionRange(3,3));
  await search.press('x');
  const cursorState=await search.evaluate(el=>({
    before:3,after:el.selectionStart,value:el.value,
    focused:document.activeElement===el,
    activeTag:document.activeElement?.tagName,
    sameNode:el.isConnected,query:window.MaCollectionStudio?'ready':'missing'
  }));
  console.log('STUDIO_CURSOR_DIAGNOSTIC',JSON.stringify(cursorState));
  assert.equal(cursorState.after,4,'La saisie doit conserver le curseur');
  await search.press('Backspace');
  assert.equal(await search.inputValue(),query,'Le résultat ne doit pas perdre la requête lors du rerendu');
  assert(await page.locator('.mc-studio-global-item').count()>0);
  await page.locator('.mc-studio-global-item').first().click();
  assert.equal(await page.locator('[data-tab=affiches]').getAttribute('aria-selected'),'true');
  // Ne pas fermer le Studio : le brouillon et ses modifications doivent être appliqués au test suivant.
  await switchStudioTab(page,'profils');
});
await test('onglet Avant / Après : aperçu fiable avant application',async()=>{
  await switchStudioTab(page,'modifications');
  assert.equal(await page.locator('[data-tab=modifications]').getAttribute('aria-selected'),'true');
  assert(await page.locator('.mc-studio-diff-stats').isVisible());
  const changed=await page.locator('.mc-studio-diff-stat.is-changed').count();
  assert(changed>0,'Les modifications du brouillon doivent être détectées');
  await page.locator('[data-action=diff-organisation]').click();
  assert.equal(await page.locator('[data-tab=organisation]').getAttribute('aria-selected'),'true');
});
await test('application : export personnalisé sans écraser les titres internes',async()=>{
  await page.locator('[data-action=apply]').click();
  // L'application attend une sauvegarde IndexedDB : contrôler l'état final.
  await page.locator('#mc-studio-root').waitFor({state:'hidden',timeout:15000});
  const report=await page.evaluate(()=>{
    const live=window.collectionData[0],out=window.MaCollectionExport.assembleFilteredDatabase();
    const target=out.find(x=>x.id===live.id);
    return {liveTitle:live.title,exportTitle:target?.title,
      folderIds:live.folders.map(f=>f.id),total:window.collectionData.reduce((n,c)=>n+c.folders.length,0)};
  });
  assert.notEqual(report.liveTitle,'Section personnalisée du Studio');
  assert.equal(report.exportTitle,'Section personnalisée du Studio');
  assert.equal(await page.evaluate(()=>seSettings.profileName),'Profil Salon');
  assert.equal(report.total,initialTotal,'Aucun dossier ne doit disparaître');
});
await test('annuler la dernière application : restaurer les références et l’ordre sans perdre de dossiers',async()=>{
  await page.evaluate(()=>window.MaCollectionStudio.open());
  assert(await page.locator('[data-action=undo-apply]').isVisible());
  const countBefore=await page.evaluate(()=>window.collectionData.reduce((n,c)=>n+c.folders.length,0));
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-action=undo-apply]').click();
  assert(await page.locator('[data-action=undo-apply]').isHidden());
  const countAfter=await page.evaluate(()=>window.collectionData.reduce((n,c)=>n+c.folders.length,0));
  assert.equal(countAfter,countBefore);
  await page.locator('[data-action=close]').click();
});
await test('accès disponible dans l’éditeur rapide',async()=>{
  await page.evaluate(()=>openSimpleEditor());
  assert.equal(await page.locator('#preview-detail').count(),0,
    'L’ouverture de l’éditeur rapide doit fermer toute fiche d’aperçu encore affichée');
  await page.locator('#se-studio').click();
  assert(await page.locator('#mc-studio-root').isVisible());
  await page.locator('[data-action=close]').click();
});
await test('responsive mobile : Studio à l’intérieur du viewport',async()=>{
  await page.setViewportSize({width:390,height:830});
  await page.evaluate(()=>window.MaCollectionStudio.open());
  const report=await page.locator('.mc-studio-panel').evaluate(el=>{
    const r=el.getBoundingClientRect();
    return {left:r.left,right:r.right,width:window.innerWidth};
  });
  assert(report.left>=0 && report.right<=report.width+1,'Studio dépasse la largeur du téléphone');
  await page.locator('[data-action=close]').click();
});
await test('petits écrans : onglets Studio utilisables en 320, 360 et 768 px',async()=>{
  const mobile=await browser.newPage({viewport:{width:360,height:740},acceptDownloads:true});
  mobile.setDefaultTimeout(14000);
  const jsErrors=[];
  mobile.on('pageerror',error=>jsErrors.push(error.message));
  try{
    await mobile.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
    await mobile.waitForFunction(()=>window.MaCollectionStudio?.open&&window.collectionData?.length>=16,
      null,{timeout:60000});
    const before=await mobile.evaluate(()=>JSON.stringify(window.collectionData));
    for(const width of [320,360,768]){
      await mobile.setViewportSize({width,height:740});
      await mobile.evaluate(()=>window.MaCollectionStudio.open());
      const geometry=await mobile.locator('.mc-studio-panel').evaluate(el=>{
        const r=el.getBoundingClientRect();
        return {left:r.left,right:r.right,viewport:window.innerWidth};
      });
      assert(geometry.left>=-1&&geometry.right<=geometry.viewport+1,
        'Studio déborde à '+width+'px : '+JSON.stringify(geometry));
      for(const tab of ['organisation','affiches','profils','outils','bibliotheque','affiches-fr']){
        const button=mobile.locator('[data-tab="'+tab+'"]');
        await mobile.locator('[data-action=studio-menu]').click();
        await button.click();
        assert.equal(await button.getAttribute('aria-selected'),'true',
          'Onglet non sélectionnable : '+tab+' à '+width+'px');
      }
      assert(await mobile.locator('[data-action=close]').isVisible(),
        'Fermeture du Studio inaccessible à '+width+'px');
      await mobile.locator('[data-action=close]').click();
      assert(await mobile.locator('#mc-studio-root').isHidden());
    }
    assert.equal(await mobile.evaluate(()=>JSON.stringify(window.collectionData)),before,
      'La navigation mobile du Studio ne doit modifier aucune collection');
    assert.deepEqual(jsErrors,[]);
  }finally{await mobile.close();}
});
await test('historique persistant : sauvegarde, rechargement, restauration et export',async()=>{
  const history=await browser.newPage({viewport:{width:1160,height:870},acceptDownloads:true});
  history.setDefaultTimeout(12000);
  try{
    await history.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
    await history.waitForFunction(()=>window.MaCollectionStudio?.open && window.collectionData?.length>=16,
      null,{timeout:60000});
    await history.evaluate(()=>window.MaCollectionStudio.open());
    await switchStudioTab(history,'profils');
    await history.locator('[data-action=backup-now]').click();
    await history.waitForFunction(()=>document.querySelectorAll('.mc-studio-backup-item').length===1);
    const raw=await history.evaluate(async()=>{
      return await new Promise((resolve,reject)=>{
        const req=indexedDB.open('ma_collection_studio_history_v1');
        req.onsuccess=()=>{
          const tx=req.result.transaction('snapshots','readonly');
          const all=tx.objectStore('snapshots').getAll();
          all.onsuccess=()=>resolve(all.result);
          all.onerror=()=>reject(all.error);
        };
        req.onerror=()=>reject(req.error);
      });
    });
    assert.equal(raw.length,1);
    assert.equal(raw[0].kind,'manual');
    assert.equal(JSON.stringify(raw).includes('secret_access_token'),false);
    await history.reload({waitUntil:'domcontentloaded'});
    await history.waitForFunction(()=>window.MaCollectionStudio?.open && window.collectionData?.length>=16,
      null,{timeout:60000});
    await history.evaluate(()=>window.MaCollectionStudio.open());
    await switchStudioTab(history,'profils');
    await history.locator('.mc-studio-backup-item').first().waitFor();
    const [download]=await Promise.all([
      history.waitForEvent('download'),history.locator('[data-action=backup-export]').first().click()
    ]);
    assert(download.suggestedFilename().startsWith('ma-collection-sauvegarde-'));
    history.once('dialog',dlg=>dlg.accept());
    await history.locator('[data-action=backup-load]').first().click();
    assert.equal(await history.locator('[data-tab=organisation]').getAttribute('aria-selected'),'true');
    await switchStudioTab(history,'profils');
    history.once('dialog',dlg=>dlg.accept());
    await history.locator('[data-action=backup-delete]').first().click();
    await history.waitForFunction(()=>document.querySelectorAll('.mc-studio-backup-item').length===0);
  }finally{await history.close();}
});
await test('outils d’accueil : rangement et styles en lot dans un brouillon non destructif',async()=>{
  const atelier=await browser.newPage({viewport:{width:1180,height:870}});
  atelier.setDefaultTimeout(12000);
  try{
    await atelier.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
    await atelier.waitForFunction(()=>window.MaCollectionStudio?.open && window.collectionData?.length>=16,
      null,{timeout:60000});
    const before=await atelier.evaluate(()=>JSON.stringify(window.collectionData));
    await atelier.evaluate(()=>window.MaCollectionStudio.open());
    await switchStudioTab(atelier,'outils');
    assert(await atelier.locator('.mc-studio-workshop-list').isVisible());
    await atelier.locator('[data-workshop-section]').selectOption({index:1});
    await atelier.locator('[data-action=workshop-select-visible]').click();
    assert(await atelier.locator('[data-workshop-target]:checked').count()>0);
    await atelier.locator('[data-workshop-shape]').selectOption('SQUARE');
    await atelier.locator('[data-workshop-hide]').selectOption('true');
    await atelier.locator('[data-action=workshop-apply]').click();
    assert((await atelier.locator('.mc-studio-status').textContent()).includes('dossier(s) modifié(s)'));
    assert.equal(await atelier.evaluate(()=>JSON.stringify(window.collectionData)),before,
      'Les réglages de lot doivent rester dans le brouillon');
    await atelier.locator('[data-action=workshop-undo]').click();
    assert((await atelier.locator('.mc-studio-status').textContent()).includes('annulée'));
    await atelier.locator('[data-workshop-mode]').selectOption('alphabetical');
    assert(await atelier.locator('.mc-studio-workshop-preview').isVisible());
    if(await atelier.locator('[data-action=workshop-tidy]').isEnabled()){
      await atelier.locator('[data-action=workshop-tidy]').click();
      assert.equal(await atelier.evaluate(()=>JSON.stringify(window.collectionData)),before);
    }
    await atelier.locator('[data-action=close]').click();
  }finally{await atelier.close();}
});
await test('bibliothèque autonome : recherche et choix visuel non destructif',async()=>{
  const library=await browser.newPage({viewport:{width:1180,height:870}});
  library.setDefaultTimeout(14000);
  try{
    await library.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
    await library.waitForFunction(()=>window.MaCollectionStudio?.open && window.collectionData?.length>=16,
      null,{timeout:60000});
    const before=await library.evaluate(()=>JSON.stringify(window.collectionData));
    await library.evaluate(()=>window.MaCollectionStudio.open());
    await switchStudioTab(library,'bibliotheque');
    assert(await library.locator('.mc-studio-library-gallery').isVisible());
    assert(await library.locator('.mc-studio-library-card').count()>0);
    await library.locator('[data-library-search]').fill('Netflix');
    assert(await library.locator('.mc-studio-library-card').count()>0);
    await library.locator('[data-action=library-use]').first().click();
    assert.equal(await library.evaluate(()=>JSON.stringify(window.collectionData)),before);
    assert(await library.locator('.mc-studio-library-target').isVisible());
    await library.locator('[data-action=library-target]').click();
    assert.equal(await library.locator('[data-tab=affiches]').getAttribute('aria-selected'),'true');
  }finally{await library.close();}
});
await test('packs FR : modèle, import local, aperçu et application sans mutation du catalogue',async()=>{
  const french=await browser.newPage({viewport:{width:1200,height:870},acceptDownloads:true});
  french.setDefaultTimeout(12000);
  try{
    await french.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
    await french.waitForFunction(()=>window.MaCollectionStudio?.open&&window.collectionData?.length>=16,
      null,{timeout:60000});
    const before=await french.evaluate(()=>JSON.stringify(window.collectionData));
    await french.evaluate(()=>window.MaCollectionStudio.open());
    await switchStudioTab(french,'affiches-fr');
    assert(await french.locator('text=Aucun pack français indépendant importé').isVisible());
    const [download]=await Promise.all([
      french.waitForEvent('download'),french.locator('[data-action=fr-template]').click()
    ]);
    assert.equal(download.suggestedFilename(),'ma-collection-affiches-fr-modele.json');
    const pack=await french.evaluate(()=>{
      const section=window.collectionData[0],folder=section.folders[0];
      return {
        schema:1,language:'fr',name:'Ma galerie française',
        styles:[{id:'fr-test',label:'Style français'}],
        entries:[{sectionId:String(section.id),folderId:String(folder.id),style:'fr-test',
          coverImageUrl:'https://ma-art.mailpromahe.workers.dev/media/mon-affiche-fr.png'}]
      };
    });
    await french.locator('[data-fr-file]').setInputFiles({
      name:'pack-fr.json',mimeType:'application/json',
      buffer:Buffer.from(JSON.stringify(pack),'utf8')
    });
    await french.waitForFunction(()=>document.querySelector('.mc-studio-fr-count')?.textContent?.includes('1 affiche(s)'));
    await french.locator('[data-fr-active]').uncheck();
    assert(await french.locator('[data-action=fr-apply]').isEnabled());
    await french.locator('[data-action=fr-apply]').click();
    assert((await french.locator('.mc-studio-status').textContent()).includes('affiche(s) françaises'));
    assert.equal(await french.evaluate(()=>JSON.stringify(window.collectionData)),before,
      'Le pack ne modifie pas la collection réelle avant validation');
    await french.locator('[data-action=fr-undo]').click();
    assert((await french.locator('.mc-studio-status').textContent()).includes('annulé'));
  }finally{await french.close();}
});
await test('aucune erreur JavaScript fatale',async()=>{
  assert.deepEqual(errors,[]);
});
await browser.close();
if(fail.length)throw Error(fail.length+' échecs Studio : '+fail.join(' | '));
console.log('STUDIO_BROWSER_QA_OK : '+pass.length+' tests');
