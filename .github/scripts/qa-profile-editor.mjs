/** Offline browser regression for complete profile editing, desktop and mobile. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>route.abort());
  await page.goto('http://127.0.0.1:8877/#profil',{waitUntil:'domcontentloaded'});
  const root=page.locator('#mc-profile-editor');await root.waitFor({state:'visible'});
  // Use the local catalogue with its existing export, without external sign-in.
  await root.locator('[data-profile-action="selection"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-profile-summary]')?.textContent.includes('695 dossiers'));
  const title=root.locator('[data-profile-field="title"]');
  const original=await title.inputValue();
  await title.fill('Affiche personnelle FR');await title.press('Tab');
  await root.locator('[data-profile-action="undo"]').click();
  assert.equal(await root.locator('[data-profile-field="title"]').inputValue(),original);
  await root.locator('[data-profile-style]').selectOption('aurore');
  await root.locator('[data-profile-action="art"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-profile-field="coverImageUrl"]')?.value.startsWith('data:image/svg+xml;base64,'));
  const download=page.waitForEvent('download');await root.locator('[data-profile-action="export"]').click();
  assert.equal((await download).suggestedFilename(),'Ma-Collection-Profil-Kovelyx.json');
  const layout=await root.evaluate(el=>({width:el.scrollWidth,view:innerWidth}));
  assert(layout.width<=layout.view+2,'Débordement horizontal du profil à '+width+' px');
  assert.deepEqual(errors,[]);
  console.log('QA_PROFILE_OK '+width+'px import, undo, generated art, export');await page.close();
 }
} finally {await browser.close();}
