/** Audit de performance de la vraie page sur localhost, avec réseau distant coupé. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.MA_COLLECTION_TEST_BASE||'http://127.0.0.1:8877/';
const origin=new URL(base).origin;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const measurements=[];
try{
  for(const viewport of [{width:1440,height:900},{width:390,height:840}]){
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    const problems=[],remotes=[];
    await context.route('**/*',route=>{
      const url=route.request().url();
      if(new URL(url).origin===origin)return route.continue();
      remotes.push(url);
      return route.abort('blockedbyclient');
    });
    page.on('pageerror',e=>problems.push(e.message));
    page.on('response',r=>{
      if(r.url().startsWith(origin)&&r.status()>=400)
        problems.push('HTTP '+r.status()+' '+new URL(r.url()).pathname);
    });
    const start=Date.now();
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>window.collectionData?.length>=16 &&
      typeof window.MaCollectionStudio?.open==='function',
      null,{timeout:60000});
    const startupMS=Date.now()-start;
    const metrics=await page.evaluate(()=>{
      const resources=performance.getEntriesByType('resource').filter(x=>x.name.startsWith(location.origin));
      const nav=performance.getEntriesByType('navigation')[0];
      return {
        localResources:resources.length,
        transferredBytes:resources.reduce((n,x)=>n+(x.transferSize||0),0),
        dclMS:Math.round(nav?.domContentLoadedEventEnd||0),
        domNodes:document.getElementsByTagName('*').length,
        heapBytes:performance.memory?.usedJSHeapSize||null
      };
    });
    const opening=Date.now();
    await page.evaluate(()=>window.MaCollectionStudio.open());
    await page.locator('#mc-studio-root').waitFor({state:'visible',timeout:15000});
    const studioMS=Date.now()-opening;
    assert(metrics.localResources<=90,'Trop de requêtes locales : '+metrics.localResources);
    assert(metrics.transferredBytes<=25_000_000,'Trop de ressources téléchargées : '+metrics.transferredBytes);
    assert(startupMS<=30_000,'Démarrage local trop lent : '+startupMS);
    assert(studioMS<=12_000,'Studio trop lent : '+studioMS);
    assert(metrics.domNodes<=40_000,'DOM trop lourd : '+metrics.domNodes);
    if(metrics.heapBytes!==null)
      assert(metrics.heapBytes<=500_000_000,'Mémoire JS trop élevée : '+metrics.heapBytes);
    assert.deepEqual(problems,[],'Erreurs locales : '+problems.join('; '));
    measurements.push({width:viewport.width,startupMS,studioMS,externalBlocked:remotes.length,...metrics});
    await context.close();
  }
  console.log('MA_COLLECTION_PERFORMANCE_OK '+JSON.stringify(measurements));
}finally{await browser.close();}
