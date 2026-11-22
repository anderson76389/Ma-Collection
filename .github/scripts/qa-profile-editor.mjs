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
  await page.waitForFunction(()=>document.querySelector('[data-profile-summary]')?.textContent.includes('756 dossiers'));
  // Le Canvas représente les vrais dossiers du brouillon, sans dupliquer les sources.
  const canvas=root.locator('[data-profile-canvas]');
  await canvas.locator('summary').click();
  assert(await canvas.locator('[data-profile-canvas-row]').count()>=16,'Les rangées du compte sont visibles');
  assert(await canvas.locator('[data-profile-canvas-folder]').count()>0,'Les affiches et dossiers sont représentés');
  const countBefore=await root.locator('[data-profile-summary]').innerText();
  await canvas.locator('[data-profile-canvas-folder] [data-profile-action="canvas-select"]').first().click();
  assert(await root.locator('[data-profile-field="title"]').count()===1,'Choisir un dossier du Canvas ouvre son vrai éditeur');
  assert.equal(await root.locator('[data-profile-summary]').innerText(),countBefore,'Le Canvas ne doit pas créer de nouvelles sources');
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
  await page.locator('#home-edit-profile').click();
  await root.getByRole('button',{name:'Test QA',exact:true}).waitFor();
  await root.locator('[data-profile-action="close"]').click();
  await page.locator('#mc-home-more-tools summary').click();
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
  // Copie de profil : le compte source reste intact, une sauvegarde du
  // profil cible est téléchargée AVANT tout changement distant.
  await page.evaluate(async()=>{
    const rows=JSON.parse(await window.MaCollectionKovelyx.buildExport());
    const original=window.MaCollectionCloudPush;
    window.__qaCloudPushOriginal=original;
    window.__qaCloudCopyCalls=[];
    window.MaCollectionCloudPush={
      readProfile:async id=>({
        profileId:id, head:{revision:id.startsWith('222')?4:2,sha256:id.startsWith('222')?'b':'a'},
        collections:id.startsWith('222')?[{id:'ancienne',title:'À sauvegarder',folders:[]}]:rows
      }),
      writeProfile:async(id,collections,head)=>{
        window.__qaCloudCopyCalls.push({id,collections,head});
        return {profileId:id,head:{revision:5},collections};
      }
    };
    window.MaCollectionAccount.cloudFetch=async path=>{
      if(path==='/v1/profiles')return Response.json({profiles:[
        {id:'11111111-1111-4111-8111-111111111111',displayName:'Principal'},
        {id:'22222222-2222-4222-8222-222222222222',displayName:'Secondaire'}
      ]});
      return Response.json({items:[],nextOffset:null});
    };
  });
  await page.locator('#home-edit-profile').click();
  // Un brouillon local modifié doit explicitement être abandonné avant de
  // charger le profil source. Accepter cette confirmation dans le test.
  page.once('dialog',dialog=>dialog.accept());
  await root.getByRole('button',{name:'Principal',exact:true}).click();
  await root.locator('[data-profile-action="copy-profile"]').waitFor({state:'visible'});
  await root.locator('[data-profile-copy-target]').selectOption('22222222-2222-4222-8222-222222222222');
  const backupCopy=page.waitForEvent('download');
  page.once('dialog',dialog=>dialog.accept());
  await root.locator('[data-profile-action="copy-profile"]').click();
  const downloaded=await backupCopy;
  assert(downloaded.suggestedFilename().startsWith('Ma-Collection-Sauvegarde-Avant-Copie-'));
  await page.waitForFunction(()=>window.__qaCloudCopyCalls?.length===1);
  const copyReport=await page.evaluate(()=>window.__qaCloudCopyCalls[0]);
  assert.equal(copyReport.id,'22222222-2222-4222-8222-222222222222');
  assert.equal(copyReport.head.revision,4);
  assert.equal(copyReport.collections.length>0,true);
  const {readFile}=await import('node:fs/promises');
  const backupData=JSON.parse(await readFile(await downloaded.path(),'utf8'));
  assert.equal(backupData[0].id,'ancienne');
  await root.locator('[data-profile-action="close"]').click();
  await page.evaluate(()=>{window.MaCollectionCloudPush=window.__qaCloudPushOriginal;});
  assert.deepEqual(errors,[]);
  console.log('QA_PROFILE_OK '+width+'px import, undo, generated art, export, cross-profile backup');await page.close();
 }
} finally {await browser.close();}
