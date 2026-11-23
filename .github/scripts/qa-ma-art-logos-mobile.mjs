/* Ma-Collection : validation tactile et responsive de la bibliothèque Logos Ma-Art. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const base='http://127.0.0.1:8877/';
const screens=[{width:320,height:700},{width:390,height:844},{width:768,height:1024},{width:1440,height:900}];
try{
  for(const viewport of screens){
    const context=await browser.newContext({
      viewport,isMobile:viewport.width<800,hasTouch:viewport.width<800,
      deviceScaleFactor:viewport.width<800?2:1
    });
    const page=await context.newPage();
    const errors=[],forbidden=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(/kaptain[.]stream|imkaptain[.]github[.]io|raw[.]githubusercontent[.]com\/ImKaptain/i.test(r.url()))forbidden.push(r.url());});
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>window.MaCollectionStudio?.open&&window.collectionData?.length>=16&&window.MA_ART_LOGOS?.length===976,
      null,{timeout:60000});
    const before=await page.evaluate(()=>JSON.stringify(window.collectionData));
    await page.evaluate(()=>window.MaCollectionStudio.open('logos-ma-art'));
    const studio=page.locator('#mc-studio-root');
    await studio.locator('.mc-studio-logo-card').first().waitFor();
    assert.equal(await studio.locator('[data-tab="logos-ma-art"]').getAttribute('aria-selected'),'true');
    assert.equal(await studio.locator('.mc-studio-logo-card').count(),72);
    assert.match(await studio.locator('.mc-studio-logos-heading').textContent(),/976 logos/);
    const area=await studio.evaluate(node=>{
      const wrap=node.querySelector('.mc-studio-content');
      const gallery=node.querySelector('.mc-studio-logo-gallery');
      const cards=[...gallery.querySelectorAll('.mc-studio-logo-card')];
      const viewport=innerWidth;
      const boxes=cards.slice(0,10).map(c=>c.getBoundingClientRect());
      return {
        viewport,bodyScrollWidth:document.body.scrollWidth,
        panelWidth:node.querySelector('.mc-studio-panel').getBoundingClientRect().width,
        contentScrollWidth:wrap.scrollWidth,contentClientWidth:wrap.clientWidth,
        galleryWidth:gallery.getBoundingClientRect().width,
        columnCount:getComputedStyle(gallery).gridTemplateColumns.split(' ').length,
        outOfBounds:boxes.some(b=>b.x<-2||b.right>viewport+2),
        minimumTap:cards[0].querySelector('button').getBoundingClientRect().height
      };
    });
    assert(!area.outOfBounds,'Débordement des cartes à '+viewport.width+' : '+JSON.stringify(area));
    assert(area.panelWidth<=viewport.width+1,'Panneau trop large à '+viewport.width);
    assert(area.contentScrollWidth<=area.contentClientWidth+3,'Contenu horizontalement débordant : '+JSON.stringify(area));
    assert(area.minimumTap>=42,'Bouton trop petit pour le tactile');
    if(viewport.width<=768) assert.equal(area.columnCount,2,'Deux colonnes prévues sur mobile/tablette');
    const search=studio.locator('[data-logo-search]');
    await search.fill('ZENDAYA');
    assert((await studio.locator('.mc-studio-logo-card').count())>=1,'Recherche des logos accent-insensible absente');
    assert(await search.evaluate(x=>document.activeElement===x),'Le clavier perd le focus au filtrage');
    const firstButton=studio.locator('[data-action="maart-logo-use"]').first();
    assert(await firstButton.isEnabled(),'Un dossier doit être sélectionné au démarrage');
    await firstButton.click();
    assert((await studio.locator('.mc-studio-status').textContent()).includes('Logo'),'Le bouton doit appliquer le logo');
    assert.equal(await page.evaluate(()=>JSON.stringify(window.collectionData)),before,'La collection ne doit pas être modifiée avant validation');
    await studio.locator('[data-action="maart-logo-undo"]').click();
    assert((await studio.locator('.mc-studio-status').textContent()).includes('restauré'),'Le bouton Annuler doit restaurer le précédent logo');
    await studio.locator('[data-action="studio-menu"]').click();
    await studio.locator('[data-tab="logos-ma-art"]').click();
    assert.equal(await studio.locator('[data-tab="logos-ma-art"]').getAttribute('aria-selected'),'true');
    assert.deepEqual(errors,[],'Erreurs JS '+viewport.width);
    assert.deepEqual(forbidden,[],'Requêtes vers Kaptain '+viewport.width);
    console.log('MA_ART_LOGOS_MOBILE_OK',viewport.width+'x'+viewport.height,JSON.stringify(area));
    if(viewport.width===390) await page.screenshot({path:'/tmp/ma-art-logos-mobile.png',fullPage:false});
    await context.close();
  }
} finally {await browser.close();}
