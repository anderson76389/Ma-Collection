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
      document.body.textContent.includes("Configurer et envoyer à Nuvio")),{timeout:60000});
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
    await page.waitForFunction(()=>document.querySelector("#wizard-overlay")?.classList.contains("open"),{timeout:15000});
    await page.evaluate(()=>window.NuvioWizard.close());
    assert(!(await page.locator("#wizard-overlay").evaluate(n=>n.classList.contains("open"))));
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
