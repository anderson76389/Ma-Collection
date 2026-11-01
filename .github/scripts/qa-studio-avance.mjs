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
await page.waitForFunction(()=>window.MaCollectionStudio?.open &&
  window.collectionData?.length===20 && window.MaCollectionExport?.assembleFilteredDatabase,
  {timeout:60000});

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
  const art=await page.locator('[data-art]').count();
  assert.equal(art,4);
  await page.locator('[data-flag=focusGlowEnabled]').check();
});
await test('sauvegarde de plusieurs profils sans secret + export JSON',async()=>{
  await page.locator('[data-tab=profils]').click();
  await page.locator('[data-profile-name]').fill('Profil Salon');
  await page.locator('[data-profile-name]').press('Tab');
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
await test('application : export personnalisé sans écraser les titres internes',async()=>{
  await page.locator('[data-action=apply]').click();
  assert(await page.locator('#mc-studio-root').isHidden());
  const report=await page.evaluate(()=>{
    const live=window.collectionData[0],out=window.MaCollectionExport.assembleFilteredDatabase();
    const target=out.find(x=>x.id===live.id);
    return {liveTitle:live.title,exportTitle:target?.title,
      folderIds:live.folders.map(f=>f.id),total:window.collectionData.reduce((n,c)=>n+c.folders.length,0)};
  });
  assert.notEqual(report.liveTitle,'Section personnalisée du Studio');
  assert.equal(report.exportTitle,'Section personnalisée du Studio');
  assert(report.total>=767,'Aucun dossier ne doit disparaître');
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
await test('aucune erreur JavaScript fatale',async()=>{
  assert.deepEqual(errors,[]);
});
await browser.close();
if(fail.length)throw Error(fail.length+' échecs Studio : '+fail.join(' | '));
console.log('STUDIO_BROWSER_QA_OK : '+pass.length+' tests');
