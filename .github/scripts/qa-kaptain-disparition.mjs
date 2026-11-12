/* Simule la disparition de Kaptain et l'indisponibilité de tout autre réseau
 * distant, sans dégrader les vrais profils ni toucher aux catalogues en dépôt.
 * Les images hébergées sur Ma-Art sont vérifiées séparément par leur workflow.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {isKaptainUrl} from '../../scripts/kaptain-url-policy.mjs';

const base='http://127.0.0.1:8877/';
const origin=new URL(base).origin;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1360,height:900},acceptDownloads:true});
const remote=[],upstream=[],errors=[];
await context.route('**/*',async route=>{
  const address=route.request().url();
  let url;
  try { url=new URL(address); } catch { return route.continue(); }
  if(url.origin===origin)return route.continue();
  remote.push(address);
  if(isKaptainUrl(address))upstream.push(address);
  // Panne totale des hébergements extérieurs pendant le test du moteur local.
  // L'interface reste servie depuis son propre serveur HTTP de test.
  return route.abort('blockedbyclient');
});
const page=await context.newPage();
page.setDefaultTimeout(12000);
page.on('pageerror',error=>errors.push(error.message));

try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>
    window.collectionData?.length>=16 &&
    window.MaCollectionStudio?.open &&
    window.MaCollectionExport?.assembleFilteredDatabase,
    null,{timeout:60000});

  const baseline=await page.evaluate(()=>({
    categories:window.collectionData.length,
    folders:window.collectionData.reduce((sum,cat)=>sum+(cat.folders||[]).length,0),
    sources:window.collectionData.reduce((sum,cat)=>sum+(cat.folders||[]).reduce(
      (n,folder)=>n+(folder.sources||[]).length,0),0)
  }));
  assert(baseline.categories>=16 && baseline.folders>=690 && baseline.sources>=3100,
    'Base locale incomplète sans Kaptain');

  await page.evaluate(()=>window.MaCollectionStudio.open());
  assert(await page.locator('#mc-studio-root').isVisible(),'Studio non disponible');
  const sectionLabel=page.locator('[data-section-label]').first();
  await sectionLabel.fill('Ma section sans Kaptain');
  await sectionLabel.press('Tab');

  await page.locator('[data-tab=affiches]').click();
  assert(await page.locator('.mc-studio-theater').isVisible(),'Galerie locale absente');
  assert.equal(await page.locator('[data-art]').count(),4,'Éditeur d’images incomplet');
  assert(await page.locator('[data-art-section] option').count()>1,
    'Catégories d’images indisponibles');
  const folderLabel=page.locator('[data-folder-label]').first();
  await folderLabel.fill('Mon dossier autonome');
  await folderLabel.press('Tab');

  await page.locator('[data-tab=profils]').click();
  await page.locator('[data-profile-name]').fill('Profil indépendant');
  await page.locator('[data-profile-name]').press('Tab');
  await page.locator('[data-action=save]').click();
  const [download]=await Promise.all([
    page.waitForEvent('download',{timeout:15000}),
    page.locator('[data-action=export]').click()
  ]);
  const exported=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(exported.schema,1,'Format du profil modifié');
  assert(exported.sections?.length>=16,'Le profil exporté perd des sections');
  assert(!JSON.stringify(exported).includes('secret_access_token'),
    'Le profil exporté contient une clé privée');

  await page.locator('[data-action=apply]').click();
  await page.locator('#mc-studio-root').waitFor({state:'hidden',timeout:15000});
  const after=await page.evaluate(()=>({
    categories:window.collectionData.length,
    folders:window.collectionData.reduce((sum,cat)=>sum+(cat.folders||[]).length,0),
    sources:window.collectionData.reduce((sum,cat)=>sum+(cat.folders||[]).reduce(
      (n,folder)=>n+(folder.sources||[]).length,0),0),
    exported:window.MaCollectionExport.assembleFilteredDatabase()?.length
  }));
  assert.deepEqual(
    [after.categories,after.folders,after.sources],
    [baseline.categories,baseline.folders,baseline.sources],
    'Une section, un dossier ou une source a disparu après application');
  assert(after.exported>0,'Export Kovelyx indisponible sans accès distant');

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>
    window.collectionData?.length>=16 && window.MaCollectionStudio?.open,
    null,{timeout:60000});
  await page.evaluate(()=>window.MaCollectionStudio.open());
  await page.locator('#mc-studio-root').waitFor({state:'visible',timeout:12000});
  await page.locator('[data-action=close]').click();

  await page.setViewportSize({width:390,height:830});
  await page.evaluate(()=>window.MaCollectionStudio.open());
  const bounds=await page.locator('.mc-studio-panel').evaluate(el=>{
    const rect=el.getBoundingClientRect();
    return {left:rect.left,right:rect.right,viewport:innerWidth};
  });
  assert(bounds.left>=0 && bounds.right<=bounds.viewport+1,
    'Studio mobile hors écran en absence de Kaptain');
  assert.deepEqual(upstream,[],'Appel réseau persistant vers Kaptain');
  assert.deepEqual(errors,[],'Erreurs JS sans dépendances distantes: '+errors.join(' | '));
  console.log('KAPTAIN_DISPARITION_OK '+JSON.stringify({
    ...baseline,requestsExternesBloquees:remote.length,
    requetesKaptain:upstream.length,exportJSON:true,studioMobile:true
  }));
}finally{
  await browser.close();
}
