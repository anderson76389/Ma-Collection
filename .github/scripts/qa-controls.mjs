/**
 * Tests de clics navigateur en complément de qa-nuvio-fr.mjs.
 * Les fonctions réseau externes et connexions privées ne sont jamais activées.
 * Tous les clics ont lieu sur localhost, sans suppression ni modification du compte.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const problems = [];
const results = [];
async function run(label, fn) {
  try { await fn(); results.push(label); console.log("QA_CLICK_OK "+label); }
  catch(error) { problems.push({label, error:error.message}); console.error("QA_CLICK_FAIL "+label+" : "+error.message); }
}
const origin="http://127.0.0.1:8877/";
async function buildPage({width,height}) {
  const page=await browser.newPage({viewport:{width,height},acceptDownloads:true});
  // Limiter les attentes pour distinguer rapidement bouton inactif et lenteur du navigateur.
  page.setDefaultTimeout(7000);
  const jsErrors=[],localErrors=[];
  page.on("pageerror",e=>jsErrors.push(e.message));
  page.on("response",res=>{
    if(res.url().startsWith(origin) && res.status()>=400)
      localErrors.push(res.status()+" "+res.url());
  });
  await page.goto(origin,{waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForFunction(()=>Boolean(window.MaCollectionExport?.assembleFilteredDatabase &&
      document.documentElement.lang === "fr" &&
      document.body.textContent.includes("Configurer ma collection")),{timeout:60000});
  return {page,jsErrors,localErrors};
}
async function toBrowse(page) {
  await page.locator("#title-screen-import-all").click({timeout:15000});
  await page.waitForFunction(()=>document.querySelector("#customize-overlay")?.classList.contains("open"),{timeout:15000});
  await page.locator("#customize-close").click({timeout:15000});
  await page.waitForFunction(()=>!document.querySelector("#customize-overlay")?.classList.contains("open"),{timeout:10000});
  await page.evaluate(()=>{
    // L'accueil dirige vers l'aperçu. Pour exercer les contrôles propres
    // à l'éditeur, basculer vers le même état que le bouton d'édition.
    isPreviewActive = false;
    isGuideActive = false;
    switchCategory(0);
  });
  await page.waitForFunction(()=>document.querySelector(".top-bar")?.classList.contains("mode-browse"),{timeout:15000});
}
try {
  const desktop=await buildPage({width:1440,height:900});
  const page=desktop.page;

  await run("site chargé : catégories et actions essentielles",async()=>{
    assert((await page.locator("#title-screen-overlay").count())===1);
    assert((await page.locator("#title-screen-import-all").count())===1);
    const counts=await page.evaluate(()=>({
      categories:typeof database!=="undefined" ? database.length : (window.NUVIO_DATABASE?.length || 0),
      uniqueButtons:[...document.querySelectorAll("button[id]")].length,
      duplicateButtonIds:[...document.querySelectorAll("button[id]")]
        .map(x=>x.id).filter((v,i,a)=>a.indexOf(v)!==i)
    }));
    assert(counts.categories>=10, "La base du site doit charger des catégories");
    assert(counts.uniqueButtons>=55);
    assert.deepEqual(counts.duplicateButtonIds,[]);
  });
  await run("bouton thème de l'accueil : changement réel",async()=>{
    const theme=()=>page.evaluate(()=>document.documentElement.getAttribute("data-theme"));
    const original=await theme();
    await page.locator("#title-theme-toggle").click();
    assert.notEqual(await theme(),original);
  });
  await run("code de test : ouvrir et fermer",async()=>{
    await page.locator("#title-test-code-toggle").click();
    assert.equal(await page.locator("#title-test-code-panel").evaluate(n=>n.hidden),false);
    await page.locator("#title-test-code-toggle").click();
    assert.equal(await page.locator("#title-test-code-panel").evaluate(n=>n.hidden),true);
  });
  await run("assistant personnaliser : entrée et sortie",async()=>{await toBrowse(page);});
  await run("thème de l'éditeur : bouton actif",async()=>{
    const before=await page.evaluate(()=>document.documentElement.getAttribute("data-theme"));
    await page.locator("#topbar-theme-toggle").click();
    const after=await page.evaluate(()=>document.documentElement.getAttribute("data-theme"));
    assert.notEqual(after,before);
  });
  await run("recherche : taper, vider et restaurer",async()=>{
    await page.locator("#dashboard-search").fill("recherche QA");
    assert(await page.locator("#search-container").evaluate(n=>n.classList.contains("has-value")));
    await page.locator("#search-clear").click();
    assert.equal(await page.locator("#dashboard-search").inputValue(),"");
  });
  await run("réorganisation : activer et désactiver",async()=>{
    await page.locator("#btn-reorder-toggle").click();
    assert(await page.locator("#btn-reorder-toggle").evaluate(n=>n.classList.contains("active")));
    await page.locator("#btn-reorder-toggle").click();
    assert(!(await page.locator("#btn-reorder-toggle").evaluate(n=>n.classList.contains("active"))));
  });
  await run("raccourcis clavier : fenêtre ouvrable et refermable",async()=>{
    await page.locator("#sidebar-toggle").click();
    assert.equal(await page.locator("#sidebar-toggle").getAttribute("aria-expanded"),"true");
    await page.locator("#btn-shortcuts-hint").click();
    assert(await page.locator("#shortcut-overlay").evaluate(n=>n.classList.contains("open")));
    await page.locator("#shortcut-close").click();
    assert(!(await page.locator("#shortcut-overlay").evaluate(n=>n.classList.contains("open"))));
  });
  await run("aide / support : fenêtre ouvrable et refermable",async()=>{
    await page.locator("#btn-sidebar-support").click();
    assert(await page.locator("#support-overlay").evaluate(n=>n.classList.contains("open")));
    await page.locator("#support-close").click();
    assert(!(await page.locator("#support-overlay").evaluate(n=>n.classList.contains("open"))));
    await page.locator("#sidebar-toggle").click();
    assert.equal(await page.locator("#sidebar-toggle").getAttribute("aria-expanded"),"false");
  });
  await run("Nuvio : fenêtre de configuration et fermeture",async()=>{
    await page.locator("#btn-send-to-nuvio").click();
    assert.equal(await page.locator("#destination-overlay").evaluate(n=>n.hidden),false);
    await page.locator("#destination-nuvio").click();
    await page.waitForFunction(()=>document.querySelector("#wizard-overlay")?.classList.contains("open"),{timeout:15000});
    await page.evaluate(()=>window.NuvioWizard.close());
    assert(!(await page.locator("#wizard-overlay").evaluate(n=>n.classList.contains("open"))));
  });
  await run("Kovelyx : envoi local direct, export JSON et fermeture",async()=>{
    const directImports=[];
    await page.evaluate(()=>{ window.__MA_COLLECTION_QA_NO_PROTOCOL=true; });
    await page.route("http://127.0.0.1:38761/import",async route=>{
      const request=route.request();
      const headers={
        "access-control-allow-origin":"http://127.0.0.1:8877",
        "access-control-allow-methods":"POST, OPTIONS",
        "access-control-allow-headers":"Content-Type",
        "access-control-allow-private-network":"true"
      };
      if(request.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
      directImports.push(JSON.parse(request.postData()));
      await route.fulfill({status:202,headers,body:"Import en attente de confirmation"});
    });
    await page.locator("#btn-send-to-nuvio").click();
    await page.locator("#destination-kovelyx").click();
    assert.equal(await page.locator("#destination-overlay").evaluate(n=>n.hidden),true);
    assert.equal(await page.locator("#kovelyx-export-overlay").evaluate(n=>n.hidden),false);
    await page.waitForFunction(()=>document.querySelector("#kovelyx-export-status")?.textContent.includes("Sélection envoyée"),{timeout:15000});
    assert.equal(directImports.length,1,"Un unique transfert local doit être envoyé");
    assert(directImports[0].every(c=>c.id&&c.title&&Array.isArray(c.folders)));
    await page.unroute("http://127.0.0.1:38761/import");
    await page.locator("#kovelyx-export-close").click();
    assert.equal(await page.locator("#btn-export-kovelyx").count(),1);
    await page.locator("#btn-export-kovelyx").click();
    assert.equal(await page.locator("#kovelyx-export-overlay").evaluate(n=>n.hidden),false);
    const payload=JSON.parse(await page.evaluate(()=>window.MaCollectionKovelyx.buildExport()));
    assert(payload.length>=10);
    assert(payload.every(c=>c.id&&c.title&&Array.isArray(c.folders)));
    // Tester un véritable clic et le contenu transmis à l'API Clipboard.
    await page.evaluate(()=>{
      window.__kovelyxClipboardTest=null;
      Object.defineProperty(navigator,"clipboard",{configurable:true,value:{
        writeText:async text=>{window.__kovelyxClipboardTest=text;}
      }});
    });
    await page.locator("#kovelyx-export-copy").click();
    await page.waitForFunction(()=>typeof window.__kovelyxClipboardTest==="string",{timeout:12000});
    assert.deepEqual(JSON.parse(await page.evaluate(()=>window.__kovelyxClipboardTest)),payload);
    assert.equal(await page.locator("#kovelyx-export-status").getAttribute("data-state"),"success");
    const event=page.waitForEvent("download",{timeout:20000});
    await page.locator("#kovelyx-export-download").click();
    const dl=await event;
    assert(/^kovelyx_collection_fr_\d{4}-\d\d-\d\d\.json$/.test(dl.suggestedFilename()));
    const {readFile}=await import("node:fs/promises");
    assert.deepEqual(JSON.parse(await readFile(await dl.path(),"utf8")),payload);
    await page.locator("#kovelyx-export-close").click();
    assert.equal(await page.locator("#kovelyx-export-overlay").evaluate(n=>n.hidden),true);
    assert.equal(await page.locator("#btn-send-to-nuvio").count(),1);
  });
  await run("Clés API : clics Test TMDB, MDBList, AllDebrid et Real-Debrid (réponses simulées)",async()=>{
    const requests=[];
    const routes=[
      {match:"https://api.themoviedb.org/3/movie/550?api_key=*",id:"tmdb"},
      {match:"https://api.mdblist.com/lists/user/?apikey=*",id:"mdblist"},
      {match:"https://api.alldebrid.com/v4/user",id:"alldebrid"},
      {match:"https://api.real-debrid.com/rest/1.0/user",id:"realdebrid"}
    ];
    for(const r of routes)await page.route(r.match,async route=>{
      const req=route.request();
      const url=new URL(req.url());
      const candidate=r.id==="tmdb" ? url.searchParams.get("api_key")
        : r.id==="mdblist" ? url.searchParams.get("apikey")
        : (req.headers().authorization || "").replace(/^Bearer\s+/i,"");
      const good=candidate==="qa-valid-"+r.id;
      requests.push({id:r.id,key:candidate,method:req.method()});
      await route.fulfill({status:good?200:401,contentType:"application/json",
        headers:{"access-control-allow-origin":"*"},
        body:JSON.stringify(good?(r.id==="tmdb"?{id:550,title:"Fiche TMDB de test"}:r.id==="alldebrid"?{status:"success",data:{user:{username:"test"}}}:r.id==="realdebrid"?{username:"test",id:1}:{success:true,name:"Compte de test"}):{success:false,error:"invalid credential"})});
    });
    await page.evaluate(()=>openSimpleEditor());
    if((await page.locator("#se-mode-advanced").getAttribute("aria-pressed"))!=="true"){
      await page.locator("#se-mode-advanced").click();
    }
    const cases=[
      {id:"tmdb",field:"#se-tmdb-key",button:"#se-tmdb-test",fn:"testTmdbKeyLive"},
      {id:"mdblist",field:"#se-mdblist-key",button:"#se-mdblist-test",fn:"testMdblistKeyLive"},
      {id:"alldebrid",field:"#se-alldebrid-key",button:"#se-alldebrid-test",fn:"testAllDebridKeyLive"},
      {id:"realdebrid",field:"#se-realdebrid-key",button:"#se-realdebrid-test",fn:"testRealDebridKeyLive"}
    ];
    assert((await page.locator("#se-tmdb-key").getAttribute("placeholder")).includes("v3"));
    for(const item of cases){
      const count=await page.locator("#toast-container .toast").count();
      await page.locator(item.field).fill("qa-valid-"+item.id);
      await page.locator(item.button).click();
      await page.waitForFunction(before=>document.querySelectorAll("#toast-container .toast").length>before,count,{timeout:10000});
      assert.equal(await page.locator("#toast-container .toast-message").last().textContent(),"✓ That key works.");
      const invalid=await page.evaluate(async ({fn,id})=>window.NuvioWizard[fn]("qa-invalid-"+id),item);
      assert.equal(invalid.ok,false, item.id+" doit refuser une mauvaise clé");
      assert.equal(invalid.unreachable,undefined);
    }
    for(const item of cases){
      const received=requests.filter(x=>x.id===item.id);
      assert.deepEqual(received.map(x=>x.key),["qa-valid-"+item.id,"qa-invalid-"+item.id]);
      assert(received.every(x=>x.method==="GET"));
    }
    await page.evaluate(()=>backToCinematicEditor());
    for(const r of routes) await page.unroute(r.match);
  });
  await run("Extensions : vrai manifest, faux JSON, HTML et HTTP 404",async()=>{
    await page.route("https://qa-addons.invalid/**",async route=>{
      const suffix=new URL(route.request().url()).pathname;
      const common={headers:{"access-control-allow-origin":"*"}};
      if(suffix.includes("/ok/"))
        return route.fulfill({...common,status:200,contentType:"application/json",
          body:JSON.stringify({id:"qa.stremio",version:"1.0.0",name:"QA Extension",resources:["stream"],types:["movie"]})});
      if(suffix.includes("/html/"))
        return route.fulfill({...common,status:200,contentType:"text/html",body:"<html>Not a manifest</html>"});
      if(suffix.includes("/json/"))
        return route.fulfill({...common,status:200,contentType:"application/json",body:JSON.stringify({message:"No addon here"})});
      return route.fulfill({...common,status:404,body:"Not found"});
    });
    const checks=await page.evaluate(async()=>{
      const test=window.NuvioWizard.checkManifestAlive;
      const root="https://qa-addons.invalid";
      return Promise.all(["ok","html","json","missing"].map(async p=>({p,...await test(root+"/"+p+"/manifest.json")})));
    });
    assert.equal(checks[0].ok,true,"Manifest d'extension valide refusé");
    assert.equal(checks[1].ok,false,"Une page HTML ne doit pas passer");
    assert.equal(checks[2].ok,false,"Un JSON sans id d'extension ne doit pas passer");
    assert.equal(checks[3].ok,false,"HTTP 404 ne doit pas passer");
    await page.unroute("https://qa-addons.invalid/**");
  });
  await run("FR : sous-catégories sans parenthèses ni doublons, titres naturels",async()=>{
    const result=await page.evaluate(()=>{
      const rows=[{id:"qa",title:"Test",folders:[{id:"f",title:"Nouvelles séries",
        sources:[{title:"Action Films (Films)",name:"Nouveaux animés (Animés)",genre:"Séries (Films)"},
                 {title:"Films - Films",name:"Séries Séries",genre:"Films (Films) (Films)"},
                 {title:"Films Action",name:"Action Séries",genre:"Prix du jury (1946–2025)"}]}]}];
      return window.MaCollectionExport.applyLocaleDict(rows,{});
    });
    const folder=result[0].folders[0];
    assert.equal(folder.title,"Nouvelles séries");
    assert.equal(folder.sources[0].title,"Films d'action");
    assert.equal(folder.sources[0].name,"Nouveaux animés");
    assert.equal(folder.sources[0].genre,"Séries");
    assert.equal(folder.sources[1].title,"Films");
    assert.equal(folder.sources[1].name,"Séries");
    assert.equal(folder.sources[1].genre,"Films");
    assert.equal(folder.sources[2].title,"Films d'action");
    assert.equal(folder.sources[2].name,"Séries d'action");
    assert.equal(folder.sources[2].genre,"Prix du jury — 1946–2025");
    await page.evaluate(()=>{
      const e=document.createElement("span");
      e.id="qa-fr-no-parentheses";
      e.textContent="Action Films (Films)";
      document.body.appendChild(e);
    });
    await page.waitForFunction(()=>document.querySelector("#qa-fr-no-parentheses")?.textContent==="Films d'action",{timeout:12000});
  });
  await run("export JSON : fichier valide et sources conservées",async()=>{
    const wait=page.waitForEvent("download",{timeout:20000});
    await page.evaluate(()=>window.MaCollectionExport.compileAndDownloadJSON(true));
    const download=await wait;
    assert(download.suggestedFilename().endsWith(".json"));
    const {readFile}=await import("node:fs/promises");
    const payload=JSON.parse(await readFile(await download.path(),"utf8"));
    assert(Array.isArray(payload)&&payload.length>=10, "L'export doit contenir les catégories du site");
    assert(payload.every(c=>c.id&&Array.isArray(c.folders)));
  });
  await run("aucune esperluette dans un libellé ajouté après le chargement",async()=>{
    await page.evaluate(()=>{
      const span=document.createElement("span");
      span.id="qa-text-et-late";
      span.textContent="Test & vérification";
      document.body.append(span);
      const btn=document.createElement("button");
      btn.id="qa-title-et-late";
      btn.setAttribute("title","Rangées & Options");
      document.body.append(btn);
      // Tester aussi un changement d'attribut après l'insertion.
      btn.setAttribute("title","Profil & Catégories");
    });
    await page.waitForFunction(()=>
      document.querySelector("#qa-text-et-late")?.textContent==="Test Et vérification" &&
      document.querySelector("#qa-title-et-late")?.title==="Profil Et Catégories",
      {timeout:12000});
  });
  await run("aucune ressource locale manquante ni exception JS (ordinateur)",async()=>{
    assert.deepEqual(desktop.jsErrors,[]);
    assert.deepEqual(desktop.localErrors,[]);
  });
  await page.close();

  const mobile=await buildPage({width:390,height:844});
  const mp=mobile.page;
  await run("navigation mobile : personnalisation et catégories",async()=>{await toBrowse(mp);});
  await run("mobile : options de navigation",async()=>{
    await mp.locator("#topbar-more-toggle").click();
    assert.equal(await mp.locator("#topbar-more-toggle").getAttribute("aria-expanded"),"true");
    await mp.locator("#topbar-more-toggle").click();
    assert.equal(await mp.locator("#topbar-more-toggle").getAttribute("aria-expanded"),"false");
  });
  await run("mobile : volet menu ouvrable",async()=>{
    await mp.locator("#sidebar-toggle").click();
    assert.equal(await mp.locator("#sidebar-toggle").getAttribute("aria-expanded"),"true");
    await mp.locator("#sidebar-toggle").click();
    assert.equal(await mp.locator("#sidebar-toggle").getAttribute("aria-expanded"),"false");
  });
  await run("mobile : volet d'export ouvrable",async()=>{
    await mp.locator("#control-fab").click();
    assert.equal(await mp.locator("#control-fab").getAttribute("aria-expanded"),"true");
    await mp.locator("#control-fab").click();
    assert.equal(await mp.locator("#control-fab").getAttribute("aria-expanded"),"false");
  });
  await run("aucune ressource locale manquante ni exception JS (mobile)",async()=>{
    assert.deepEqual(mobile.jsErrors,[]);
    assert.deepEqual(mobile.localErrors,[]);
  });
  await mp.close();
} finally {
  await browser.close();
}
console.log(JSON.stringify({successful:results.length,failed:problems.length,failures:problems},null,2));
if(problems.length)process.exitCode=1;
