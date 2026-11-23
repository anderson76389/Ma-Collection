/* Régression : les logos archivés ne doivent plus être cachés par hideTitle.
 * Vérifier le VRAI aperçu utilisé par la page, le héros, les détails et Studio.
 */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const cases=[{width:320,height:700},{width:390,height:844},{width:768,height:1024},{width:1440,height:900}];
try {
  for (const size of cases) {
    const context=await browser.newContext({viewport:size,isMobile:size.width<=800,hasTouch:size.width<=800});
    const page=await context.newPage();
    const failures=[],forbidden=[];
    page.on('pageerror',e=>failures.push(e.message));
    page.on('request',req=>{
      const url=new URL(req.url()),host=url.hostname;
      if(host==='kaptain.stream'||host.endsWith('.kaptain.stream')||
         host==='imkaptain.github.io'||
         (host==='raw.githubusercontent.com'&&/^\/ImKaptain\//i.test(url.pathname)))
         forbidden.push(req.url());
    });
    await page.goto('http://127.0.0.1:8877/',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>window.collectionData?.length>=16 &&
      document.querySelectorAll('.nv-card').length>20 && window.MaCollectionStudio?.open,
      null,{timeout:60000});
    const facts=await page.evaluate(()=>{
      const cards=[...document.querySelectorAll('.nv-card')];
      const expected=cards.filter(c=>c.__folder?.titleLogoUrl);
      const logos=cards.filter(c=>c.querySelector('img.nv-card-logo'));
      const visible=logos.filter(c=>{
        const el=c.querySelector('.nv-card-logo'),style=getComputedStyle(el);
        return style.display!=='none'&&style.visibility!=='hidden'&&parseFloat(style.opacity)>0;
      });
      const hero=document.querySelector('#nv-hero-logo');
      return {
        total:cards.length,expected:expected.length,rendered:logos.length,cssVisible:visible.length,
        allOwn:logos.every(c=>c.querySelector('img.nv-card-logo').src.startsWith('https://ma-art-images-static.mailpromahe.workers.dev/')),
        firstHiddenTitle:expected[0]?.__folder?.hideTitle===true,
        firstAlt:expected[0]?.querySelector('.nv-card-title')?.textContent||'',
        heroSrc:hero?.getAttribute('src')||'',heroDisplay:hero?.style.display,
        viewport:document.querySelector('.nv-emulator')?.className
      };
    });
    assert(facts.expected>300,'Les catalogues et leurs logos devraient être chargés');
    assert.equal(facts.rendered,facts.expected,'Tous les dossiers dotés de logos doivent les afficher');
    assert.equal(facts.cssVisible,facts.expected,'Un CSS ne doit pas masquer les logos');
    assert(facts.allOwn,'Les URL affichées doivent utiliser le CDN Ma-Art');
    assert(facts.firstHiddenTitle,'Tester un dossier avec hideTitle activé');
    assert(facts.heroSrc.includes('ma-art-images-static.mailpromahe.workers.dev'),
      'Le héros doit afficher un logo indépendamment de hideTitle');
    assert.notEqual(facts.heroDisplay,'none');
    assert(facts.viewport.includes(size.width<=800?'device-mobile':'device-tv'),
      'L’aperçu doit être responsive par défaut : '+facts.viewport);
    // Vérifier les véritables dimensions d'un logo une fois la carte chargée.
    await page.evaluate(()=>{window.hideTitleScreen?.();document.querySelector('.nv-card-logo')?.scrollIntoView({block:'nearest',inline:'nearest'});});
    await page.waitForFunction(()=>{
      const el=document.querySelector('.nv-card-logo');
      return !!el&&(el.naturalWidth>0||el.complete);
    },null,{timeout:18000});
    const image=await page.locator('.nv-card-logo').first().evaluate(el=>({
      complete:el.complete,naturalWidth:el.naturalWidth,display:getComputedStyle(el).display,
      box:el.getBoundingClientRect().width
    }));
    assert(image.naturalWidth>0,'Premier logo PNG non chargé sur le navigateur');
    assert(image.box>12,'Logo trop petit ou invisible sur téléphone : '+JSON.stringify(image));
    // Détails : la même image doit y figurer, avec alt informatif.
    await page.evaluate(()=>{
      const card=document.querySelector('.nv-card');
      window.openPreviewDetail(card.__folder,card.__category);
    });
    assert(await page.locator('#preview-detail .nv-detail-logo').count()>0,
      'Le volet détail doit afficher le logo malgré hideTitle');
    await page.evaluate(()=>document.querySelector('#preview-detail .nv-detail-close')?.click());
    // Le vrai Studio doit afficher les images historiques archivées, même si
    // le chemin interne rappelle l’ancien nom d’hôte de Kaptain.
    await page.evaluate(()=>window.MaCollectionStudio.open('accueil'));
    await page.locator('#mc-studio-root [data-action="canvas-open"]').first().click();
    assert(await page.locator('#mc-studio-root .mc-cinema-art-logo').count()>0,
      'L’organisateur visuel du Studio doit afficher les logos');
    await page.evaluate(()=>window.MaCollectionStudio.open('apercu'));
    assert(await page.locator('#mc-studio-root .mc-studio-preview-logo').count()>0,
      'L’aperçu TV/mobile du Studio doit afficher les logos');
    assert.deepEqual(forbidden,[],'Aucun appel à Kaptain');
    assert.deepEqual(failures,[],'Aucune erreur JavaScript');
    console.log('DOSSIER_LOGOS_VISIBLE_OK',size.width+'x'+size.height,JSON.stringify(facts),JSON.stringify(image));
    await context.close();
  }
} finally {await browser.close();}
