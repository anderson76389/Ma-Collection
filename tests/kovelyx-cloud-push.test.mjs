import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const source = readFileSync(new URL("../kovelyx-cloud-push.js", import.meta.url), "utf8");
const read = path => readFileSync(new URL("../"+path, import.meta.url), "utf8");

function harness({ready=true, cloudError=null, readbackCorrupt=false, readbackUnavailable=false, chunkErrorStatus=null, manifestErrorStatus=null, posterErrorStatus=null, confirmReplace=true}={}) {
  const elements = new Map();
  const downloads = [], blobs = new Map();
  class Element {
    constructor(tag="div") {
      this.tagName=tag; this.children=[]; this.value="";
      this.disabled=false; this.hidden=true; this.dataset={};
      this.listeners={}; this.textContent="";
    }
    setAttribute(){}
    addEventListener(event, handler){this.listeners[event]=handler;}
    focus(){}
    click(){downloads.push({href:this.href,name:this.download});}
    remove(){}
    replaceChildren(){this.children=[];this.value="";}
    appendChild(child){
      this.children.push(child);
      if(this.tagName==="select" && this.children.length===1) this.value=child.value;
      return child;
    }
  }
  const ids=[
    "mc-kovelyx-cloud-account","mc-kovelyx-cloud-login","mc-kovelyx-cloud-reload",
    "mc-kovelyx-cloud-profile","mc-kovelyx-cloud-mode","mc-kovelyx-cloud-status",
    "mc-kovelyx-cloud-cancel","mc-kovelyx-cloud-send",
    "mc-kovelyx-cloud-poster-provider","mc-kovelyx-cloud-bttr",
    "mc-kovelyx-cloud-bttr-source","mc-kovelyx-cloud-bttr-lang",
    "mc-kovelyx-cloud-bttr-genre","mc-kovelyx-cloud-bttr-rating",
    "mc-kovelyx-cloud-bttr-quality","mc-kovelyx-cloud-bttr-age",
    "mc-kovelyx-cloud-bttr-preview","mc-kovelyx-cloud-bttr-preview-status",
    "mc-kovelyx-cloud-backup", "mc-kovelyx-cloud-compare", "mc-kovelyx-cloud-comparison",
    "mc-kovelyx-cloud-sources"
  ];
  for(const id of ids) elements.set(id,new Element(id.includes("mode")||id.includes("profile")?"select":"div"));
  elements.get("mc-kovelyx-cloud-mode").value="merge";
  elements.get("mc-kovelyx-cloud-poster-provider").value="keep";
  elements.get("mc-kovelyx-cloud-bttr-source").value="Average";
  elements.get("mc-kovelyx-cloud-bttr-lang").value="fr";
  elements.get("mc-kovelyx-cloud-bttr-genre").checked=true;
  elements.get("mc-kovelyx-cloud-bttr-rating").checked=true;
  const document={
    createElement: tag=>new Element(tag),
    getElementById: id=>elements.get(id),
    head:new Element(),body:new Element(),
    addEventListener(){}
  };
  const calls=[],published=[],chunks=new Map();
  let activeHead=null, posterRow=null;
  const profile="11111111-1111-4111-8111-111111111111";
  const initial=[{id:"discover",title:"Découverte",folders:[{id:"trending",title:"Ancien",sources:[{provider:"tmdb",tmdbSourceType:"DISCOVER",mediaType:"movie"}]}]}];
  const exportText=JSON.stringify(initial);
  const account={
    status:()=>({cloudSignedIn:true,cloudEmail:"test@example.test"}),
    async cloudFetch(path,options={}){
      calls.push({path,options});
      if(cloudError && path==="/v1/catalogue-manifest") throw new Error(cloudError);
      if(path==="/v1/profiles")
        return new Response(JSON.stringify({profiles:[{id:profile,displayName:"Principal"}]}),{status:200});
      if(path==="/v1/sync" && options.method==="POST") {
        if(posterErrorStatus) return new Response(JSON.stringify({error:"Préférence refusée"}),{status:posterErrorStatus});
        posterRow={category:"profile_settings",itemKey:options.body.itemKey,deleted:false,revision:1,payload:options.body.payload};
        return new Response(JSON.stringify({revision:1}),{status:201});
      }
      if(path.includes("/v1/sync")) {
        if(readbackUnavailable && activeHead) throw new Error("D1 n'a pas répondu");
        if(path.includes("snapshotKind=collections")) {
          const hash=new URL("https://worker.example"+path).searchParams.get("snapshotHash");
          const rows=hash===activeHead?.sha256?[...chunks.values()].sort((a,b)=>a.index-b.index)
            .map(item=>({payload:readbackCorrupt?{...item,text:"corrompu"}:item})):[];
          return new Response(JSON.stringify({items:rows,nextOffset:null}),{status:200});
        }
        const items=activeHead?[{category:"preferences",itemKey:"catalogue_collections",
          deleted:false,revision:1,payload:{schema:1,sha256:activeHead.sha256,
            parts:activeHead.parts,utf8Bytes:activeHead.utf8Bytes}}]:[];
        if(posterRow) items.push(posterRow);
        return new Response(JSON.stringify({items,nextOffset:null}),{status:200});
      }
      if(path==="/v1/catalogue-manifest") {
        if(manifestErrorStatus) return new Response(JSON.stringify({error:"refus distant"}),{status:manifestErrorStatus,headers:{"content-type":"application/json"}});
        published.push(options.body);
        activeHead=options.body;
        return new Response(JSON.stringify({revision:1}),{status:201});
      }
      if(path==="/v1/catalogue-chunk") {
        if(chunkErrorStatus) return new Response(JSON.stringify({error:"refus distant"}),{status:chunkErrorStatus,headers:{"content-type":"application/json"}});
        chunks.set(options.body.payload.index, options.body.payload);
        return new Response(JSON.stringify({revision:1}),{status:201});
      }
      throw new Error("Unexpected path: "+path);
    }
  };
  const window={
    MaCollectionAccount:account,
    MaCollectionBackendConfig:{current:()=>({url:"https://worker.example"})},
    MaCollectionKovelyx:{buildExport:async()=>exportText},
    confirm:()=>confirmReplace,
  };
  const context={
    window,document,crypto:webcrypto,Blob,
    URL:{createObjectURL:blob=>{blobs.set("blob:test",blob);return "blob:test";},revokeObjectURL:()=>{}},
    TextEncoder,structuredClone,Response,
    fetch:async url=>{
      assert.equal(url,"https://worker.example/ready");
      return new Response(JSON.stringify({status:"ok",catalogueSnapshotSchema:ready?1:undefined}),{status:200});
    }
  };
  vm.runInNewContext(source,context);
  return {downloads,blobs,window,api:window.MaCollectionCloudPush,view:document.body.children[0],elements,calls,published,profile,exportText};
}

test("une fusion conserve les collections et dossiers déjà présents",()=>{
  const {api}=harness();
  const previous=[{id:"base",title:"Avant",folders:[{id:"stay",title:"À conserver"},{id:"edit",title:"Avant"}]},{id:"only_remote",title:"Autre",folders:[]}];
  const pushed=[{id:"base",title:"Après",folders:[{id:"edit",title:"Après"},{id:"new",title:"Nouveau"}]}];
  const merged=api.mergeCollections(previous,pushed);
  assert.deepEqual(JSON.parse(JSON.stringify(merged)).map(x=>x.id),["base","only_remote"]);
  assert.equal(merged[0].title,"Après");
  assert.deepEqual(merged[0].folders.map(x=>x.id),["stay","edit","new"]);
  assert.equal(merged[0].folders[1].title,"Après");
  assert.equal(previous[0].folders[1].title,"Avant");
});

test("les blocs n'interrompent jamais une paire UTF-16",()=>{
  const {api}=harness();
  const pieces=api.split("a".repeat(5999)+"😀"+"b".repeat(6100));
  assert.equal(pieces.join(""),"a".repeat(5999)+"😀"+"b".repeat(6100));
  assert.ok(pieces.every(p=>p.length<=6000));
  assert.ok(pieces.length>1);
});

test("les clés secrètes et mots de passe ne quittent pas le navigateur",()=>{
  const {api}=harness();
  assert.throws(()=>api.validateContent([{id:"x",password:"private"}]),/secret/i);
  assert.throws(()=>api.validateContent([{api_key:"private"}]),/secret/i);
});

test("publication réelle : profil UUID, blocs, empreinte, manifest validé en dernier",async()=>{
  const h=harness();
  await h.api.open();
  assert.equal(h.elements.get("mc-kovelyx-cloud-profile").value,h.profile);
  await h.api.publish();
  const chunkCalls=h.calls.filter(x=>x.path==="/v1/catalogue-chunk");
  assert.equal(chunkCalls.length,1);
  assert.equal(h.published.length,1);
  const head=h.published[0];
  assert.equal(head.profileId,h.profile);
  assert.equal(head.revision,0);
  assert.equal(head.kind,"collections");
  assert.equal(head.utf8Bytes,new TextEncoder().encode(h.exportText).length);
  assert.equal(chunkCalls[0].options.body.payload.text,h.exportText);
  const hash=Array.from(new Uint8Array(await webcrypto.subtle.digest("SHA-256",new TextEncoder().encode(h.exportText))),
    b=>b.toString(16).padStart(2,"0")).join("");
  assert.equal(head.sha256,hash);
  assert.match(h.elements.get("mc-kovelyx-cloud-status").textContent,/publiés/);
});

test("un accusé HTTP 201 ne suffit pas : tous les blocs doivent être relus et validés",async()=>{
  const h=harness({readbackCorrupt:true});
  await h.api.open();
  await h.api.publish();
  assert.equal(h.published.length,1,"Le Worker a bien enregistré le manifeste");
  assert.equal(h.elements.get("mc-kovelyx-cloud-status").dataset.error,"true");
  assert.match(h.elements.get("mc-kovelyx-cloud-status").textContent,/relecture complète/);
  assert.doesNotMatch(h.elements.get("mc-kovelyx-cloud-status").textContent,/publiés et relus/);
});

test("une relecture momentanément indisponible ne provoque pas un second envoi",async()=>{
  const h=harness({readbackUnavailable:true});
  await h.api.open();
  await h.api.publish();
  assert.equal(h.published.length,1);
  assert.equal(h.elements.get("mc-kovelyx-cloud-status").dataset.error,"true");
  assert.equal(h.calls.filter(x=>x.path==="/v1/catalogue-manifest").length,1);
});

test("Worker ancien : aucun bloc et aucun succès trompeur",async()=>{
  const h=harness({ready:false});
  await h.api.open();
  await h.api.publish();
  assert.equal(h.calls.filter(x=>x.path.includes("catalogue-")).length,0);
  assert.equal(h.published.length,0);
  assert.equal(h.elements.get("mc-kovelyx-cloud-status").dataset.error,"true");
});

test("conflit CAS : l'envoi ne peut pas annoncer un succès",async()=>{
  const h=harness({cloudError:"Conflit de révision"});
  await h.api.open();
  await h.api.publish();
  assert.equal(h.published.length,0);
  assert.match(h.elements.get("mc-kovelyx-cloud-status").textContent,/Conflit/);
  assert.equal(h.elements.get("mc-kovelyx-cloud-status").dataset.error,"true");
});

test("compte web = Better Auth / Cloudflare, jamais Supabase",()=>{
  const account=read("account-vault.js");
  const config=read("account-config.js");
  assert.match(account,/\/api\/auth\/sign-in\/email/);
  assert.match(account,/\/api\/auth\/sign-up\/email/);
  assert.match(account,/\/v1\/me/);
  assert.match(account,/provider: "cloudflare-better-auth"/);
  assert.doesNotMatch(account,/\/rest\/v1\/|\/auth\/v1\/|supabaseUrl/);
  assert.doesNotMatch(config,/sb_secret_|supabaseUrl/);
  assert.match(read("index.html"),/kovelyx-cloud-push\.js/);
});

test("un échec HTTP de transfert ne valide jamais le manifeste",async()=>{
  const h=harness({chunkErrorStatus:503});
  await h.api.open();
  await h.api.publish();
  assert.equal(h.calls.filter(x=>x.path==="/v1/catalogue-manifest").length,0);
  assert.equal(h.published.length,0);
  assert.equal(h.elements.get("mc-kovelyx-cloud-status").dataset.error,"true");
  assert.match(h.elements.get("mc-kovelyx-cloud-status").textContent,/HTTP 503/);
});

test("un conflit HTTP 409 renvoyé sans exception reste bloquant",async()=>{
  const h=harness({manifestErrorStatus:409});
  await h.api.open();
  await h.api.publish();
  assert.equal(h.published.length,0);
  assert.equal(h.elements.get("mc-kovelyx-cloud-status").dataset.error,"true");
  assert.match(h.elements.get("mc-kovelyx-cloud-status").textContent,/Conflit de révision/);
});

test("le mode Remplacer annulé ne transmet aucune donnée",async()=>{
  const h=harness({confirmReplace:false});
  await h.api.open();
  h.elements.get("mc-kovelyx-cloud-mode").value="replace";
  await h.api.publish();
  assert.equal(h.calls.filter(x=>x.path==="/v1/catalogue-chunk").length,0);
  assert.equal(h.published.length,0);
});

test("le client ne publie jamais vers un profil non retourné par le Worker",async()=>{
  const h=harness();
  await h.api.open();
  h.elements.get("mc-kovelyx-cloud-profile").value="22222222-2222-4222-8222-222222222222";
  await h.api.publish();
  assert.equal(h.published.length,0);
  assert.equal(h.calls.filter(x=>x.path==="/v1/catalogue-chunk").length,0);
  assert.match(h.elements.get("mc-kovelyx-cloud-status").textContent,/profil.*valide/i);
});

test("motif Bttr identique au format accepté par Kovelyx PC (langue, source et options)",()=>{
  const {api}=harness();
  assert.equal(api.bttrPattern({}),"https://btttr.cc/poster/imdb/poster-default/{imdb_id}.jpg?lang=fr");
  assert.equal(api.bttrPattern({genre:false,rating:false,quality:true,age:true,source:"IM",language:"en"}),
    "https://btttr.cc/poster-nqa/imdb/poster-default/{imdb_id}.jpg?rs=IM");
  assert.equal(api.bttrPattern({genre:false,rating:true,source:"TR",language:"fr"}),
    "https://btttr.cc/poster-r/imdb/poster-default/{imdb_id}.jpg?lang=fr&rs=TR");
});

test("la publication reste sans réglage d’affiche si l’utilisateur choisit Conserver",async()=>{
  const h=harness();
  await h.api.open();
  await h.api.publish();
  assert.equal(h.calls.filter(x=>x.path==="/v1/sync" && x.options.method==="POST").length,0);
  assert.equal(h.elements.get("mc-kovelyx-cloud-status").dataset.error,"false");
  assert.match(h.elements.get("mc-kovelyx-cloud-sources").textContent,/1 dossiers sélectionnés.*1 sources TMDB/);
});

test("Bttr est publié comme préférence de profil après relecture complète des catalogues",async()=>{
  const h=harness();
  await h.api.open();
  h.elements.get("mc-kovelyx-cloud-poster-provider").value="bttr";
  h.elements.get("mc-kovelyx-cloud-bttr-source").value="TM";
  h.elements.get("mc-kovelyx-cloud-bttr-quality").checked=true;
  await h.api.publish();
  const poster=h.calls.filter(x=>x.path==="/v1/sync" && x.options.method==="POST");
  assert.equal(poster.length,1);
  assert.equal(poster[0].options.body.profileId,h.profile);
  assert.equal(poster[0].options.body.category,"profile_settings");
  assert.equal(poster[0].options.body.itemKey,"visual_custom_poster_v1");
  assert.equal(poster[0].options.body.payload.pattern,"https://btttr.cc/poster-q/imdb/poster-default/{imdb_id}.jpg?lang=fr&rs=TM");
  assert.equal(poster[0].options.body.payload.allScreens,true);
  assert.ok(h.calls.findIndex(x=>x.path==="/v1/sync" && x.options.method==="POST") >
    h.calls.findIndex(x=>x.path==="/v1/catalogue-manifest"),"La préférence doit suivre le manifeste confirmé");
  assert.equal(h.elements.get("mc-kovelyx-cloud-status").dataset.error,"false");
  assert.match(h.elements.get("mc-kovelyx-cloud-status").textContent,/Better Posters est aussi synchronisé/);
});

test("une nouvelle option Bttr est envoyée même si les catalogues étaient déjà à jour",async()=>{
  const h=harness();
  await h.api.open();
  await h.api.publish();
  h.elements.get("mc-kovelyx-cloud-poster-provider").value="bttr";
  await h.api.publish();
  assert.equal(h.calls.filter(x=>x.path==="/v1/catalogue-manifest").length,1);
  assert.equal(h.calls.filter(x=>x.path==="/v1/sync" && x.options.method==="POST").length,1);
  assert.equal(h.elements.get("mc-kovelyx-cloud-status").dataset.error,"false");
});

test("un conflit de préférence n’est jamais annoncé comme un succès Better Posters",async()=>{
  const h=harness({posterErrorStatus:409});
  await h.api.open();
  h.elements.get("mc-kovelyx-cloud-poster-provider").value="bttr";
  await h.api.publish();
  assert.equal(h.published.length,1,"Les catalogues restent publiés");
  assert.equal(h.elements.get("mc-kovelyx-cloud-status").dataset.error,"true");
  assert.match(h.elements.get("mc-kovelyx-cloud-status").textContent,/n’a PAS été synchronisé/);
});

test("l’audit local signale les dossiers sans sources sans inventer leurs contenus",()=>{
  const {api}=harness();
  const count=api.sourceSummary([{folders:[{sources:[]},{sources:[{provider:"trakt"},{provider:"addon"}]}]}]);
  assert.equal(count.folders,2);
  assert.equal(count.missing,1);
  assert.equal(count.trakt,1);
  assert.equal(count.addons,1);
});


test("Bttr choisi avant le compte est reporté sans transférer les clés sensibles",async()=>{
  const h=harness();
  const chosen={
    posterProvider:"bttr", bttrGenre:false, bttrRating:true,
    bttrQuality:true, bttrAge:false, bttrSource:"IM", bttrLanguage:"en",
    tmdbKey:"SECRET-TMDB-NE-PAS-ENVOYER", realDebridKey:"SECRET-DEBRID"
  };
  assert.equal(h.api.configurePoster(chosen),true);
  assert.equal(h.elements.get("mc-kovelyx-cloud-poster-provider").value,"bttr");
  assert.equal(h.elements.get("mc-kovelyx-cloud-bttr").hidden,false);
  assert.equal(h.elements.get("mc-kovelyx-cloud-bttr-genre").checked,false);
  assert.equal(h.elements.get("mc-kovelyx-cloud-bttr-quality").checked,true);
  assert.equal(h.elements.get("mc-kovelyx-cloud-bttr-source").value,"IM");
  assert.equal(h.elements.get("mc-kovelyx-cloud-bttr-lang").value,"en");
  assert.equal(h.calls.length,0,"La configuration seule ne doit effectuer aucun envoi");
  await h.api.open();
  await h.api.publish();
  const preference=h.calls.find(row=>row.path==="/v1/sync" && row.options.method==="POST");
  assert.equal(preference.options.body.payload.pattern,
    "https://btttr.cc/poster-rq/imdb/poster-default/{imdb_id}.jpg?rs=IM");
  assert.doesNotMatch(JSON.stringify(h.calls),/SECRET-TMDB|SECRET-DEBRID/);
});

test("le choix Conserver dans l'assistant Cloud ne publie pas de préférence Bttr",async()=>{
  const h=harness();
  h.api.configurePoster({posterProvider:"bttr",bttrSource:"RT"});
  h.api.configurePoster({posterProvider:"none"});
  assert.equal(h.elements.get("mc-kovelyx-cloud-poster-provider").value,"keep");
  await h.api.open();
  await h.api.publish();
  assert.equal(h.calls.filter(row=>row.path==="/v1/sync" && row.options.method==="POST").length,0);
});

test("le résumé des catalogues indique les extensions requises mais ne fabrique pas de résultats",()=>{
  const h=harness();
  const count=h.api.sourceSummary([{folders:[{sources:[
    {provider:"tmdb",tmdbSourceType:"LIST",tmdbId:"123"},
    {provider:"addon",addonId:"aio-metadata",catalogId:"x"},
    {provider:"addon",addonId:"comet",catalogId:"y"},
    {provider:"addon",addonId:"aio-metadata",catalogId:"z"}]}]}]);
  assert.deepEqual(Array.from(count.addonIds),["aio-metadata","comet"]);
  assert.equal(count.addons,3);
  assert.equal(count.tmdb,1);
  assert.equal(count.missing,0);
});

test("les deux entrées Cloud passent par la personnalisation avant l'ouverture du compte",()=>{
  const destination=read("destination-picker.js");
  const elements=new Map();
  const make=()=>({hidden:true,addEventListener(){},appendChild(){},setAttribute(){},focus(){},classList:{contains:()=>false}});
  const document={
    createElement:make, getElementById:id=>{
      if(!elements.has(id))elements.set(id,make());
      return elements.get(id);
    },head:make(),body:make(),addEventListener(){},activeElement:make()
  };
  const actions=[];
  let finish=null;
  const window={
    MaCollectionImportStudio:{open:(destination,cb)=>{actions.push("wizard:"+destination);finish=cb;}},
    MaCollectionCloudPush:{
      configurePoster:config=>actions.push("poster:"+config.posterProvider),
      open:()=>actions.push("cloud:open")
    }
  };
  vm.runInNewContext(destination,{window,document});
  window.MaCollectionDestination.chooseCloud();
  assert.deepEqual(actions,["wizard:cloud"]);
  finish({posterProvider:"bttr",bttrLanguage:"fr"});
  assert.deepEqual(actions,["wizard:cloud","poster:bttr","cloud:open"]);
  assert.match(destination,/mc-choice-kovelyx-cloud"\)\.addEventListener\("click",startCloud\)/);
  assert.match(read("kovelyx-export.js"),/MaCollectionDestination\?\.chooseCloud/);
});

test('éditeur complet : lecture et écriture vérifiées avec protection contre une révision périmée',async()=>{
 const h=harness();await h.api.open();await h.api.publish();const snapshot=await h.api.readProfile(h.profile);
 assert.equal(JSON.stringify(snapshot.collections),h.exportText);
 const changed=JSON.parse(h.exportText);changed[0].title='Profil organisé';
 const saved=await h.api.writeProfile(h.profile,changed,snapshot.head);assert.equal(saved.collections[0].title,'Profil organisé');
 await assert.rejects(()=>h.api.writeProfile(h.profile,changed,null),/changé/);
});

test("comparaison : suppressions, modifications, ordre et paramètres de catégorie",()=>{
  const {api}=harness();
  const previous=[{id:"a",title:"Avant",folders:[{id:"x",title:"X"},{id:"y"},{id:"z"}]},{id:"b",folders:[{id:"old"}]}];
  const next=[{id:"c",folders:[{id:"new"}]},{id:"a",title:"Après",folders:[{id:"y"},{id:"x",title:"Modifié"},{id:"added"}]}];
  assert.deepEqual(JSON.parse(JSON.stringify(api.compareCollections(previous,next))),{
    addedCategories:1,removedCategories:1,changedCategories:1,addedFolders:2,removedFolders:2,changedFolders:1,reorderedCategories:0,reorderedFolders:1
  });
  assert.equal(api.compareCollections(previous,[previous[1],previous[0]]).reorderedCategories,1);
});

test("comparaison : ordre des clés JSON sans faux changement, identifiants dupliqués refusés",()=>{
  const {api}=harness();
  const previous=[{id:"a",title:"A",folders:[{id:"x",sources:[{provider:"tmdb",filters:{year:2025,language:"fr"}}]}]}];
  const next=[{folders:[{sources:[{filters:{language:"fr",year:2025},provider:"tmdb"}],id:"x"}],title:"A",id:"a"}];
  assert.equal(Object.values(api.compareCollections(previous,next)).every(x=>x===0),true);
  assert.throws(()=>api.compareCollections(previous,[...next,...next]),/double/);
  assert.throws(()=>api.compareCollections([],[{id:"x",folders:[{id:"y"},{id:"y"}]}]),/double/);
});

test("comparer le profil ne transmet aucune écriture, même en mode remplacement",async()=>{
  const h=harness();await h.api.open();await h.api.publish();h.calls.length=0;
  h.window.MaCollectionKovelyx.buildExport=async()=>JSON.stringify([{id:"new",folders:[{id:"added"}]}]);
  h.elements.get("mc-kovelyx-cloud-mode").value="replace";
  const result=await h.api.compareProfile();
  assert.equal(result.removedCategories,1);assert.equal(result.removedFolders,1);
  assert.equal(result.addedFolders,1);
  assert.equal(h.calls.every(c=>!c.options.method||c.options.method==="GET"),true);
  assert.match(h.elements.get("mc-kovelyx-cloud-comparison").textContent,/Remplacement/);
  assert.equal(h.elements.get("mc-kovelyx-cloud-compare").disabled,false);
});

test("sauvegarde : le JSON est identique au profil relu sans aucune publication",async()=>{
  const h=harness();await h.api.open();await h.api.publish();h.calls.length=0;
  await h.api.backupProfile();
  assert.equal(h.downloads.length,1);
  assert.deepEqual(JSON.parse(await h.blobs.get("blob:test").text()),JSON.parse(h.exportText));
  assert.equal(h.calls.every(c=>!c.options.method||c.options.method==="GET"),true);
});

test("sauvegarde : refus d'un profil non autorisé ou d'un instantané corrompu",async()=>{
  const h=harness({readbackCorrupt:true});await h.api.open();await h.api.publish();
  await h.api.backupProfile();
  assert.equal(h.downloads.length,0);
  assert.match(h.elements.get("mc-kovelyx-cloud-status").textContent,/Empreinte/);
  await assert.rejects(()=>h.api.readProfile("invalid"),/Profil invalide/);
});

test("profil vide : la comparaison fonctionne et la sauvegarde n'invente aucun fichier",async()=>{
  const h=harness();await h.api.open();
  assert.equal((await h.api.compareProfile()).addedCategories,1);
  await h.api.backupProfile();assert.equal(h.downloads.length,0);
  assert.match(h.elements.get("mc-kovelyx-cloud-status").textContent,/aucune collection/);
});
