/** Offline browser regression for complete profile editing, desktop and mobile. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>route.abort());
  await page.goto('http://127.0.0.1:8877/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(window.MaCollectionProfileEditor));
  await page.locator('#home-edit-profile').click();
  await page.locator('.mc-profile-account[open]').waitFor();
  await page.locator('[data-profile-action="close"]').click();
  await page.locator('#home-update-profile').click();
  const root=page.locator('#mc-profile-editor');await root.waitFor({state:'visible'});
  assert.equal(await root.locator('[data-profile-update]').getAttribute('open'),'');
  // Use the local catalogue with its existing export, without external sign-in.
  await root.locator('[data-profile-action="selection"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-profile-summary]')?.textContent.includes('695 dossiers'));
  const title=root.locator('[data-profile-field="title"]');
  const original=await title.inputValue();
  await title.fill('Affiche personnelle FR');await title.press('Tab');
  await root.locator('[data-profile-action="undo"]').click();
  assert.equal(await root.locator('[data-profile-field="title"]').inputValue(),original);
  await root.locator('[data-profile-action="update"]').click();
  await root.locator('[data-profile-action="apply-update"]').waitFor({state:'visible'});
  await root.locator('[data-profile-style]').selectOption('aurore');
  await root.locator('[data-profile-action="art"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-profile-field="coverImageUrl"]')?.value.startsWith('data:image/svg+xml;base64,'));
  assert.equal(await root.locator('[data-profile-action="apply-update"]').count(),0);
  const download=page.waitForEvent('download');await root.locator('[data-profile-action="export"]').click();
  assert.equal((await download).suggestedFilename(),'Ma-Collection-Profil-Kovelyx.json');
  const layout=await root.evaluate(el=>({width:el.scrollWidth,view:innerWidth}));
  assert(layout.width<=layout.view+2,'Débordement horizontal du profil à '+width+' px');
  await root.locator('[data-profile-action="close"]').click();
  await page.evaluate(() => {
    window.MaCollectionAccount = {
      status: () => ({cloudSignedIn:true,cloudEmail:'qa@example.invalid'}),
      cloudFetch: async path => {
        if (path === '/v1/profiles') return Response.json({profiles:[{id:'11111111-1111-4111-8111-111111111111',displayName:'Test QA'}]});
        if (!path.startsWith('/v1/sync?profileId=11111111-1111-4111-8111-111111111111&')) throw new Error('Requête inattendue');
        return Response.json({items:[{category:'watch_progress',deleted:false,itemKey:'serie',payload:{title:'Étoile',lastPositionMs:50,durationMs:100}}],nextOffset:null});
      }
    };
  });
  await page.locator('#home-profile-history').click();
  const history = page.locator('#mc-profile-history');
  await history.locator('[data-history="profile"]').selectOption({label:'Test QA'});
  await history.locator('[data-history="view"]').selectOption('progress');
  await history.locator('[data-history="search"]').fill('etoile');
  assert.match(await history.locator('[data-history="rows"]').innerText(),/Étoile.*50 %/s);
  const backup=page.waitForEvent('download');
  await history.locator('[data-history="export"]').click();
  assert.equal((await backup).suggestedFilename(),'Kovelyx-bibliotheque-historique.json');
  await page.keyboard.press('Escape');
  assert.equal(await history.isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('QA_PROFILE_OK '+width+'px import, undo, generated art, export');await page.close();
 }
} finally {await browser.close();}
