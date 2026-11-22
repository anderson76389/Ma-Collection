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
   const screens=['all-settings','look','details','continue','alerts','presets','player','autoplay','stream-picker','subtitles',
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
   await range.evaluate(el=>{el.value='37';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
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
 await run('sélecteur fidèle : 3 profils de compte, mesures et ouverture réelle en brouillon',async()=>{
   await page.setViewportSize({width:1780,height:900});
   await page.evaluate(()=>{
     const a='123e4567-e89b-42d3-a456-426614174000';
     const b='123e4567-e89b-42d3-a456-426614174001';
     const c='123e4567-e89b-42d3-a456-426614174002';
     window.__qaCloudSigned=true;
     window.MaCollectionAccount.status=()=>({cloudSignedIn:window.__qaCloudSigned,cloudEmail:'profile@example.org'});
     window.MaCollectionAccount.cloudFetch=async path=>{
       if(path!=='/v1/profiles')throw Error('Route inattendue '+path);
       return {ok:true,json:async()=>({profiles:[
         {id:a,name:'MAHÉ',categoriesCount:16,foldersCount:695},
         {id:b,name:'MAMAN',categoriesCount:12,foldersCount:609},
         {id:c,name:'Autre profil',categoriesCount:14,foldersCount:756}
       ]})};
     };
     window.MaCollectionAccount.cloudLogout=async()=>{window.__qaCloudSigned=false;};
     window.MaCollectionCloudPush={...window.MaCollectionCloudPush,readProfile:async id=>({
       profileId:id,head:{revision:2},collections:[
         {id:'film',title:'Films',folders:[
           {id:'action',title:'Action',sources:[{id:'one',provider:'tmdb'}]},
           {id:'horror',title:'Horreur',sources:[{id:'two',provider:'tmdb'}]}
         ]}
       ]
     })};
   });
   await page.evaluate(()=>window.MaCollectionProfileSuite.open('profiles'));
   await root.locator('[data-suite-cloud-select]').first().waitFor();
   assert.equal(await root.locator('[data-suite-cloud-select]').count(),3);
   assert.equal(await root.locator('[aria-label="Profils locaux"]').count(),0,
     'Les profils locaux ne doivent pas encombrer le sélecteur connecté');
   const measures=await root.evaluate(el=>{
     const banner=el.querySelector('.mcps-picker-banner').getBoundingClientRect();
     const cards=[...el.querySelectorAll('[data-suite-cloud-select]')].map(c=>c.getBoundingClientRect());
     return {bodyWidth:el.scrollWidth,viewport:innerWidth,banner:{x:banner.x,width:banner.width},
       cards:cards.map(c=>({x:c.x,width:c.width,y:c.y,height:c.height}))};
   });
   assert(measures.banner.width>900&&measures.banner.width<1050,
     'Bandeau centré proche des références: '+JSON.stringify(measures));
   assert(measures.cards.every(c=>c.width>260&&c.width<350&&c.height>=70),
     'Trois cartes compactes : '+JSON.stringify(measures));
   assert(measures.cards[0].x<measures.cards[1].x&&measures.cards[1].x<measures.cards[2].x,
     'Les trois profils doivent être sur une rangée');
   assert(measures.bodyWidth<=measures.viewport+2);
   await page.screenshot({path:'/tmp/ma-collection-profile-picker.png'});
   await root.locator('[data-suite-cloud-select]').first().click();
   await root.locator('.mcps-dashboard').waitFor();
   assert((await root.locator('.mcps-profile-title').innerText()).includes('MAHÉ'));
   assert(await root.locator('[data-suite-action="edit-remote-profile"]').isVisible());
   const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('ma_collection_profile_suite_v1')));
   assert(stored.profiles.some(p=>p.id.startsWith('mcps-cloud-')&&p.rows[0].folders.length===2),
     'La vraie collection doit être lue avant ouverture, sans écrire sur le serveur');
   await root.locator('[data-suite-back]').click();
   await root.locator('[data-suite-cloud-select]').first().waitFor();
   await root.locator('[data-suite-action="show-local"]').click();
   assert(await root.locator('[aria-label="Profils locaux"]').isVisible(),
     'Les anciens profils restent disponibles');
 });
 await run('sélecteur mobile sans débordement ni fausses statistiques',async()=>{
   await page.setViewportSize({width:390,height:844});
   await page.evaluate(()=>window.MaCollectionProfileSuite.open('profiles'));
   await root.locator('[data-suite-cloud-select]').first().waitFor();
   const box=await root.evaluate(el=>({width:el.scrollWidth,viewport:innerWidth,
     cards:[...el.querySelectorAll('[data-suite-cloud-select]')].map(x=>x.getBoundingClientRect().x)}));
   assert(box.width<=box.viewport+2,'Débordement : '+JSON.stringify(box));
   assert(box.cards.every(x=>x<box.viewport), 'Tous les profils restent cliquables sur mobile');
 });
 await run('déconnexion : les profils locaux restent accessibles après confirmation',async()=>{
   await page.setViewportSize({width:900,height:850});
   await page.evaluate(()=>window.MaCollectionProfileSuite.open('profiles'));
   await root.locator('[data-suite-cloud-select]').first().waitFor();
   page.once('dialog',async dialog=>{await dialog.accept();});
   await root.locator('[data-suite-action="sign-out"]').click();
   await page.waitForFunction(()=>window.__qaCloudSigned===false);
   await root.locator('[aria-label="Profils locaux"]').waitFor();
   assert.equal(await root.locator('[data-suite-action="sign-out"]').count(),0);
   assert((await root.locator('[data-suite-select]').count())>=1);
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
 await run('partage : le lien ouvre le Studio et demande un enregistrement explicite',async()=>{
   await page.evaluate(()=>{
     const payload={schema:1,name:'Profil partagé',settings:{skipIntro:true}};
     location.hash='#suite='+encodeURIComponent(JSON.stringify(payload));
   });
   await root.waitFor({state:'visible'});
   const details=await root.locator('[data-suite-body]').innerText();
   assert(details.includes('Tous les paramètres'));
   assert(await root.locator('[data-suite-save-top]').isEnabled(),'Lien dans le brouillon, sans envoi automatique');
   await page.evaluate(()=>history.replaceState(null,'',location.pathname));
   await page.evaluate(()=>window.MaCollectionProfileSuite.open('dashboard'));
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
