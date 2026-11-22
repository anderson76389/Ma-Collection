/**
 * Validation ciblée de l'accueil cinématique, sans compte ni API privée.
 * Captures pour comparaison manuelle avec la capture de référence.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({
  executablePath:process.env.CHROME_PATH,
  headless:true,args:['--no-sandbox']
});
let passed=0;
try{
  for(const width of [2048,1440,768,390]){
    const page=await browser.newPage({viewport:{width,height:width===2048?1031:900}});
    const broken=[],upstream=[];
    page.on('pageerror',e=>broken.push(e.message));
    page.on('request',r=>{
      if(/(^|\.)kaptain\.stream(?:\/|:|$)/i.test(new URL(r.url()).hostname))
        upstream.push(r.url());
    });
    await page.goto('http://127.0.0.1:8877/',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>window.collectionData?.length>10&&
      document.querySelector('#title-screen-overlay')?.classList.contains('active'),{timeout:60000});
    await page.waitForFunction(()=>{
      const cards=[...document.querySelectorAll('.mc-wall-poster')];
      if(cards.length!==45)return false;
      const visible=cards.filter(i=>{const r=i.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;});
      return visible.length>=6&&visible.every(i=>getComputedStyle(i).backgroundImage.includes('assets/mur-affiches.webp'));
    },{timeout:20000});
    const data=await page.evaluate(()=>{
      const get=id=>document.querySelector(id);
      const rect=id=>{
        const r=get(id)?.getBoundingClientRect();
        return r&&{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right};
      };
      const counts=window.collectionData.map(c=>c.folders?.length||0).reduce((a,b)=>a+b,0);
      const wall=get('.suite-wall');
      const primary=get('#title-screen-import-all');
      const home=get('#title-screen-overlay');
      const dock=get('.home-dock');
      return {
        header:rect('.home-dock'),title:rect('#mc-home-title'),
        search:rect('#home-search'),primary:rect('#title-screen-import-all'),
        return:rect('.home-return'),wall:rect('.suite-wall'),
        bg:getComputedStyle(wall,'::before').backgroundImage,
        wallCards:wall.querySelectorAll('.mc-wall-card').length,
        wallColumns:wall.querySelectorAll('.mc-wall-column').length,
        wallReady:wall.classList.contains('mc-wall-with-cards'),
        wallImagesLocal:[...wall.querySelectorAll('.mc-wall-poster')].every(card=>
          getComputedStyle(card).backgroundImage.includes('assets/mur-affiches.webp')),
        wallUniqueArt:new Set([...wall.querySelectorAll('.mc-wall-poster')].map(card=>card.dataset.crop)).size,
        muralRequests:performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.endsWith('/assets/mur-affiches.webp')).length,
        genreRequests:performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.includes('/assets/genres/')).length,
        ctaBg:getComputedStyle(primary).backgroundColor,
        primaryRadius:getComputedStyle(primary).borderRadius,
        dockOverflow:dock.scrollWidth-dock.clientWidth,
        homeOverflow:home.scrollWidth-home.clientWidth,
        dynamicLabel:get('#home-collection-count').textContent.trim(),
        dynamicShown:!get('#home-collection-count').hidden,
        count:counts,nav:!!get('#home-header-search')&&!!get('#home-header-account'),
        themeInNav:!!dock.contains(get('#title-theme-toggle')),
        greeting:get('#mc-home-title').textContent.trim(),
        ctaLabel:primary.textContent.trim()
      };
    });
    assert(data.header.h>=38&&data.header.h<=50,'Nav non conforme '+width+'px : '+JSON.stringify(data.header));
    assert(Math.abs(data.title.x+data.title.w/2-width/2)<8,'Titre non centré '+width+'px');
    assert(Math.abs(data.primary.x+data.primary.w/2-width/2)<8,'CTA non centré '+width+'px');
    assert(data.title.y>data.header.h,'Le titre est caché derrière la navigation');
    for(const k of ['title','search','primary','return']){
      assert(data[k].x>=-3&&data[k].right<=width+3,k+' dépasse à '+width+'px '+JSON.stringify(data[k]));
    }
    assert(data.dockOverflow<=2,'Navigation qui déborde horizontalement '+width+'px');
    assert(data.homeOverflow<=3,'Accueil qui déborde horizontalement '+width+'px');
    assert(data.nav&&data.themeInNav,'Actions de navigation manquantes');
    assert(data.dynamicShown&&data.dynamicLabel.includes(data.count.toLocaleString('fr-FR')),
      'Compteur non relié au catalogue : '+data.dynamicLabel);
    assert(data.wallReady&&data.wallColumns===9&&data.wallCards===45,
      'Le mur de cartes cinéma n’est pas construit : '+JSON.stringify(data));
    assert(data.wallImagesLocal&&data.wallUniqueArt>=16,
      'Les cadrages locaux ne sont pas assez variés : '+JSON.stringify(data));
    assert(data.muralRequests===1,
      'Le fond de secours local doit charger un seul média : '+JSON.stringify(data));
    // Les images de genres utilisées dans les catalogues et les sections
    // situées sous l'accueil ne doivent pas être interdites ici.
    assert(data.bg==='none','L’ancienne image répétée est encore visible');
    assert(data.ctaBg==='rgb(0, 231, 165)','Bouton principal encore violet : '+data.ctaBg);
    assert(data.ctaLabel.includes('Configuration express'));
    assert(!broken.length,'Erreur JS : '+broken.join('; '));
    assert(!upstream.length,'Image ou script Kaptain chargé : '+upstream.join('; '));
    if(width===2048) {
      // Le titre et le CTA doivent reprendre la position de la référence 2048×1031.
      assert(data.title.y>220&&data.title.y<285,'Titre encore trop haut/bas à 2048 : '+data.title.y);
      assert(data.primary.y>560&&data.primary.y<610,'Bouton express décalé de la référence : '+data.primary.y);
      await page.screenshot({path:'/tmp/ma-collection-accueil-desktop.png',fullPage:false});
    }
    if(width===390)await page.screenshot({path:'/tmp/ma-collection-accueil-mobile.png',fullPage:false});
    // Les nouveaux boutons sont connectés aux outils préexistants.
    await page.locator('#home-header-search').click();
    await page.locator('#command-input').waitFor({state:'visible'});
    assert(await page.locator('#command-input').evaluate(e=>document.activeElement===e));
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{
      window.__qaAccountOpened='';
      window.MaCollectionAccountUi.openModal=(key)=>{window.__qaAccountOpened=key};
    });
    await page.locator('#home-header-account').click();
    assert.equal(await page.evaluate(()=>window.__qaAccountOpened),'cloud');
    await page.close();
    passed++;
    console.log('QA_ACCUEIL_OK '+width+'px, posters issus des catalogues et fond local, boutons et actions');
  }
  // La configuration express conserve son vrai parcours existant.
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto('http://127.0.0.1:8877/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.querySelector('#title-screen-overlay')?.classList.contains('active')
    && window.collectionData?.length>10,{timeout:60000});
  await page.locator('#title-screen-import-all').click();
  await page.locator('#customize-overlay.open').waitFor({timeout:15000});
  assert(await page.locator('#customize-overlay.open').isVisible());
  passed++;
  await page.close();
  console.log('QA_ACCUEIL_OK configuration express et parcours de personnalisation');
  const quick=await browser.newPage({viewport:{width:1280,height:800}});
  await quick.goto('http://127.0.0.1:8877/',{waitUntil:'domcontentloaded',timeout:60000});
  await quick.waitForFunction(()=>window.collectionData?.length>10&&
    document.querySelector('#title-screen-overlay')?.classList.contains('active'),{timeout:60000});
  await quick.locator('#home-view-collection').click();
  await quick.waitForFunction(()=>!document.querySelector('#title-screen-overlay')?.classList.contains('active'));
  assert(!await quick.locator('#title-screen-overlay').evaluate(e=>e.classList.contains('active')),
    'Le bouton Voir ma collection doit réellement ouvrir le navigateur');
  passed++;await quick.close();
  console.log('QA_ACCUEIL_OK bouton fixe Voir ma collection');
}finally{await browser.close();}
assert.equal(passed,6);
