/* Test end-to-end : sauvegarde de tous les profils puis restauration sur un autre navigateur. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const base='http://127.0.0.1:8877/';
async function ready(page) {
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.MaCollectionStudio?.open&&window.collectionData?.length>=16,
    null,{timeout:60000});
  await page.evaluate(()=>window.MaCollectionStudio.open());
  await page.locator('[data-tab=profils]').click();
}
try{
  const first=await browser.newContext({acceptDownloads:true});
  const p=await first.newPage();
  await ready(p);
  await p.locator('[data-profile-name]').fill('Salon de secours');
  await p.locator('[data-profile-name]').press('Tab');
  await p.locator('[data-action=save]').click();
  await p.locator('[data-action=backup-now]').click();
  await p.waitForFunction(()=>document.querySelectorAll('.mc-studio-backup-item').length===1);
  await p.evaluate(()=>localStorage.setItem('test-secret-not-for-export','NEVER_IN_BACKUP_1234'));
  const [file]=await Promise.all([p.waitForEvent('download'),
    p.locator('[data-action=export-all]').click()]);
  assert(file.suggestedFilename().startsWith('ma-collection-sauvegarde-complete-'));
  const binary=await readFile(await file.path());
  const stored=JSON.parse(binary.toString('utf8'));
  assert.equal(stored.schema,1);
  assert.equal(stored.profiles.length,1);
  assert.equal(stored.backups.length,1);
  assert(!binary.toString('utf8').includes('NEVER_IN_BACKUP_1234'));
  await first.close();

  const restored=await browser.newContext({acceptDownloads:true});
  const p2=await restored.newPage();
  await ready(p2);
  assert.equal(await p2.locator('.mc-studio-profile-card').count(),0);
  p2.once('dialog',dialog=>dialog.accept());
  await p2.locator('[data-recovery-file]').setInputFiles({
    name:'ma-collection-sauvegarde-complete.json',mimeType:'application/json',buffer:binary
  });
  await p2.waitForFunction(()=>document.querySelectorAll('.mc-studio-profile-card').length===1);
  assert.equal(await p2.locator('.mc-studio-backup-item').count(),1);
  assert.equal(await p2.locator('[data-profile-name]').inputValue(),'Salon de secours');
  const [reexport]=await Promise.all([
    p2.waitForEvent('download'),p2.locator('[data-action=export-all]').click()
  ]);
  const verify=JSON.parse((await readFile(await reexport.path())).toString('utf8'));
  assert.equal(verify.profiles.length,1);
  assert.equal(verify.backups.length,1);
  await restored.close();
  console.log('STUDIO_REPRISE_COMPLETE_OK profils=1 historique=1 secretsExclus=true');
}finally{await browser.close();}
