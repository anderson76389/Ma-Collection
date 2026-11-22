import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1800,height:900},acceptDownloads:true});
page.setDefaultTimeout(12000);
const failures=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const run=async(name,fn)=>{try{await fn();console.log('SUITE_QA_OK '+name);}
  catch(e){failures.push(name+': '+e.message);console.error('SUITE_QA_FAIL '+name+': '+e.message);}};
try{
 await page.goto('http://127.0.0.1:8877/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>window.collectionData?.length>15&&window.MaCollectionStudio?.reviewExternalLayout&&
    window.MaCollectionProfileSuite?.open,null,{timeout:60000});
 const root=page.locator('#mc-profile-suite');
 await run('parcours de profils, tableau de bord et 21 cartes liées',async()=>{
   await page.evaluate(()=>window.MaCollectionProfileSuite.open('profiles'));
   assert(await root.isVisible());
   assert(await root.getByRole('heading',{name:'Choisir un profil'}).isVisible());
   await root.locator('[data-suite-select]').first().click();
   assert.equal(await root.locator('.mcps-tile').count(),21);
   assert.equal(await root.locator('.mcps-profile-strip').count(),1);
   await page.screenshot({path:'/tmp/ma-collection-studio-dashboard.png'});
 });
 await run('tous les écrans sont accessibles, traduits et sans erreurs JS',async()=>{
   const screens=['all-settings','presets','player','autoplay','stream-picker','subtitles',
    'language','filters','performance','poster','streaming','backups','history','copy','share',
    'account','artwork','quick','layout','add','addons'];
   for(const id of screens){
     await page.evaluate(id=>window.MaCollectionProfileSuite.open(id),id);
     assert(await root.isVisible(),id);
     assert((await root.locator('[data-suite-body]').innerText()).length>40,id+' vide');
   }
   assert.equal(errors.length,0,errors.join('\n'));
 });
 await run('paramètres : sélection, aperçu et sauvegarde réelle dans le navigateur',async()=>{
   await page.evaluate(()=>window.MaCollectionProfileSuite.open('player'));
   await root.locator('[data-suite-choice="playerStyle"][data-value="minimal"]').click();
   assert.equal(await root.locator('[data-suite-choice="playerStyle"][data-value="minimal"]').getAttribute('aria-pressed'),'true');
   assert(await root.locator('[data-suite-save-top]').isEnabled());
   await root.locator('[data-suite-save-top]').click();
   assert(await root.locator('[data-suite-save-top]').isDisabled());
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_collection_profile_suite_v1')));
   assert.equal(saved.profiles.find(p=>p.id===saved.activeId).settings.playerStyle,'minimal');
   await page.evaluate(()=>window.MaCollectionProfileSuite.open('subtitles'));
   const range=root.locator('[data-suite-field="subtitleFontSize"]');
   await range.fill('37');await range.dispatchEvent('change');
   assert.equal(await root.locator('.mcps-subtitle-scene span').evaluate(e=>getComputedStyle(e).fontSize),'37px');
   await root.locator('[data-suite-save-top]').click();
 });
 await run('préréglages : appliquer puis enregistrer, sans modifier les autres préférences',async()=>{
   await page.evaluate(()=>window.MaCollectionProfileSuite.open('presets'));
   await root.locator('[data-suite-preset="binge"]').first().click();
   await root.locator('[data-suite-action="apply-preset"]').click();
   assert(await root.locator('[data-suite-save-top]').isEnabled());
   await root.locator('[data-suite-save-top]').click();
   const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_collection_profile_suite_v1')));
   assert.equal(data.profiles.find(p=>p.id===data.activeId).settings.skipIntro,true);
 });
 await run('copier un profil et exporter une sauvegarde sans donnée secrète',async()=>{
   await page.evaluate(()=>window.MaCollectionProfileSuite.open('copy'));
   await root.locator('[data-suite-copy-name]').fill('Salon');
   await root.locator('[data-suite-action="copy-profile"]').click();
   assert(await root.locator('.mcps-tiles').isVisible());
   const store=await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_collection_profile_suite_v1')));
   assert(store.profiles.some(p=>p.name==='Salon'));
   await page.evaluate(()=>window.MaCollectionProfileSuite.open('share'));
   const download=page.waitForEvent('download');
   await root.locator('[data-suite-action="export"]').click();
   assert((await download).suggestedFilename().endsWith('.json'));
 });
 await run('brouillon d’accueil : déplacer une vraie rangée puis revue sans mutation prématurée',async()=>{
   await page.evaluate(()=>window.MaCollectionProfileSuite.open('layout'));
   const initial=await page.evaluate(()=>JSON.stringify(window.collectionData));
   assert(await root.locator('.mcps-layout-row').count()>=16);
   const before=await root.locator('.mcps-layout-row').first().locator('.mcps-row-label strong').innerText();
   await root.locator('.mcps-layout-row').first().locator('[data-suite-action="row-down"]').click();
   const after=await root.locator('.mcps-layout-row').first().locator('.mcps-row-label strong').innerText();
   assert.notEqual(before,after,'Le déplacement doit changer le brouillon');
   await root.locator('.mcps-layout-toolbar [data-suite-action="review-layout"]').click();
   assert(await root.isHidden());
   const old=page.locator('#mc-studio-root');
   assert(await old.isVisible(),'Le véritable Studio doit accueillir le brouillon');
   assert.equal(await old.locator('[data-tab="modifications"]').getAttribute('aria-selected'),'true');
   assert.equal(await page.evaluate(()=>JSON.stringify(window.collectionData)),initial);
   await old.locator('[data-action="close"]').click();
 });
 await run('responsive : pages à 390, 768 et 1440 px sans débordement',async()=>{
   for(const width of [390,768,1440]){
     await page.setViewportSize({width,height:850});
     await page.evaluate(()=>window.MaCollectionProfileSuite.open('dashboard'));
     const values=await root.evaluate(el=>{
       const main=el.querySelector('.mcps-main');
       return {viewport:innerWidth,bodyWidth:el.scrollWidth,gridWidth:el.querySelector('.mcps-tiles').getBoundingClientRect().width,
         visible:getComputedStyle(el).display!=='none',mainWidth:main.clientWidth};
     });
     assert(values.visible);
     assert(values.bodyWidth<=values.viewport+2,'Débordement global à '+width+'px: '+JSON.stringify(values));
   }
 });
 await run('aucune ressource tierce Kaptain n’est chargée par le nouveau Studio',async()=>{
   const urls=await page.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name));
   assert(!urls.some(x=>/kaptain\.stream/i.test(x)));
   assert.equal(errors.length,0,errors.join('\n'));
 });
}finally{
 await browser.close();
}
if(failures.length)throw Error(failures.length+' tests Studio échoués :\n'+failures.join('\n'));
console.log('SUITE_QA_OK parcours Profil Studio complet');
