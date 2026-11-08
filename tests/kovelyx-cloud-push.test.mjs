import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const source = readFileSync(new URL("../kovelyx-cloud-push.js", import.meta.url), "utf8");
const read = path => readFileSync(new URL("../"+path, import.meta.url), "utf8");

function harness({ready=true, cloudError=null}={}) {
  const elements = new Map();
  class Element {
    constructor(tag="div") {
      this.tagName=tag; this.children=[]; this.value="";
      this.disabled=false; this.hidden=true; this.dataset={};
      this.listeners={}; this.textContent="";
    }
    setAttribute(){}
    addEventListener(event, handler){this.listeners[event]=handler;}
    focus(){}
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
    "mc-kovelyx-cloud-cancel","mc-kovelyx-cloud-send"
  ];
  for(const id of ids) elements.set(id,new Element(id.includes("mode")||id.includes("profile")?"select":"div"));
  elements.get("mc-kovelyx-cloud-mode").value="merge";
  const document={
    createElement: tag=>new Element(tag),
    getElementById: id=>elements.get(id),
    head:new Element(),body:new Element(),
    addEventListener(){}
  };
  const calls=[],published=[];
  const profile="11111111-1111-4111-8111-111111111111";
  const initial=[{id:"discover",title:"Découverte",folders:[{id:"trending",title:"Ancien",sources:[]}]}];
  const exportText=JSON.stringify(initial);
  const account={
    status:()=>({cloudSignedIn:true,cloudEmail:"test@example.test"}),
    async cloudFetch(path,options={}){
      calls.push({path,options});
      if(cloudError && path==="/v1/catalogue-manifest") throw new Error(cloudError);
      if(path==="/v1/profiles")
        return new Response(JSON.stringify({profiles:[{id:profile,displayName:"Principal"}]}),{status:200});
      if(path.includes("/v1/sync"))
        return new Response(JSON.stringify({items:[],nextOffset:null}),{status:200});
      if(path==="/v1/catalogue-manifest") {
        published.push(options.body);
        return new Response(JSON.stringify({revision:1}),{status:201});
      }
      if(path==="/v1/catalogue-chunk")
        return new Response(JSON.stringify({revision:1}),{status:201});
      throw new Error("Unexpected path: "+path);
    }
  };
  const window={
    MaCollectionAccount:account,
    MaCollectionBackendConfig:{current:()=>({url:"https://worker.example"})},
    MaCollectionKovelyx:{buildExport:async()=>exportText},
    confirm:()=>true,
  };
  const context={
    window,document,crypto:webcrypto,
    TextEncoder,structuredClone,Response,
    fetch:async url=>{
      assert.equal(url,"https://worker.example/ready");
      return new Response(JSON.stringify({status:"ok",catalogueSnapshotSchema:ready?1:undefined}),{status:200});
    }
  };
  vm.runInNewContext(source,context);
  return {api:window.MaCollectionCloudPush,view:document.body.children[0],elements,calls,published,profile,exportText};
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
