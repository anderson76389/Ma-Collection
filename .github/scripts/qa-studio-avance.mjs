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

const initialTotal=await page.evaluate(()=>window.collectionData.reduce((n,c)=>n+c.folders.length,0));

await test('nouvelle carte dans le design original',async()=>{
  assert.equal(await page.locator('#title-screen-studio').count(),1);
  assert.equal(await page.locator('#se-studio').count(),1);
  const oldStyle=await page.locator('#title-screen-start').evaluate(x=>getComputedStyle(x).color);
  const newStyle=await page.locator('#title-screen-studio').evaluate(x=>getComputedStyle(x).color);
  assert.equal(newStyle,oldStyle,'La nouvelle carte doit suivre le thème actuel');
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
  await page.locator('[data-action=batch-open]').click();
  await page.locator('[data-batch-shape]').selectOption('POSTER');
  await page.locator('[data-batch-glow]').check();
  await page.locator('[data-action=batch-apply]').click();
  assert.equal(await page.locator('[data-shape]').inputValue(),'POSTER');
  assert(await page.locator('[data-flag=focusGlowEnabled]').isChecked());
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
await test('sauvegarde de plusieurs profils sans secret + export JSON',async()=>{
  await page.locator('[data-tab=profils]').click();
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
  await page.locator('[data-tab=recherche]').click();
  // Le premier dossier a été renommé dans le brouillon précédent : chercher son nouveau nom.
  const query='Mon dossier Studio';
  await page.locator('[data-global-search]').fill(query);
  assert(await page.locator('.mc-studio-global-item').count()>0);
  await page.locator('.mc-studio-global-item').first().click();
  assert.equal(await page.locator('[data-tab=affiches]').getAttribute('aria-selected'),'true');
  // Ne pas fermer le Studio : le brouillon et ses modifications doivent être appliqués au test suivant.
  await page.locator('[data-tab=profils]').click();
});
await test('onglet Avant / Après : aperçu fiable avant application',async()=>{
  await page.locator('[data-tab=modifications]').click();
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
await test('historique persistant : sauvegarde, rechargement, restauration et export',async()=>{
  const history=await browser.newPage({viewport:{width:1160,height:870},acceptDownloads:true});
  history.setDefaultTimeout(12000);
  try{
    await history.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
    await history.waitForFunction(()=>window.MaCollectionStudio?.open && window.collectionData?.length>=16,
      null,{timeout:60000});
    await history.evaluate(()=>window.MaCollectionStudio.open());
    await history.locator('[data-tab=profils]').click();
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
    await history.locator('[data-tab=profils]').click();
    await history.locator('.mc-studio-backup-item').first().waitFor();
    const [download]=await Promise.all([
      history.waitForEvent('download'),history.locator('[data-action=backup-export]').first().click()
    ]);
    assert(download.suggestedFilename().startsWith('ma-collection-sauvegarde-'));
    history.once('dialog',dlg=>dlg.accept());
    await history.locator('[data-action=backup-load]').first().click();
    assert.equal(await history.locator('[data-tab=organisation]').getAttribute('aria-selected'),'true');
    await history.locator('[data-tab=profils]').click();
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
    await atelier.locator('[data-tab=outils]').click();
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
    await library.locator('[data-tab=bibliotheque]').click();
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
await test('aucune erreur JavaScript fatale',async()=>{
  assert.deepEqual(errors,[]);
});
await browser.close();
if(fail.length)throw Error(fail.length+' échecs Studio : '+fail.join(' | '));
console.log('STUDIO_BROWSER_QA_OK : '+pass.length+' tests');
