import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";

const src = name => readFileSync(new URL("../"+name,import.meta.url),"utf8");
function store() {
  const values=new Map();
  return {
    getItem:k=>values.has(k)?values.get(k):null,
    setItem:(k,v)=>values.set(k,String(v)),
    removeItem:k=>values.delete(k),
  };
}
test("le compte web se connecte au véritable protocole Better Auth et la session reste par onglet",async()=>{
  const calls=[];
  const localStorage=store(), sessionStorage=store();
  const base="https://worker.example";
  const bearer="better-auth-token-test-1234567890";
  const fetch=async(url,options)=>{
    calls.push({url,options});
    if(url===base+"/api/auth/sign-in/email") {
      assert.equal(options.method,"POST");
      assert.deepEqual(JSON.parse(options.body),{email:"test@example.fr",password:"mot-de-passe-assez-long"});
      return new Response(JSON.stringify({user:{id:"alice",email:"test@example.fr"}}),{
        status:200,headers:{"set-auth-token":bearer}
      });
    }
    if(url===base+"/v1/me") {
      assert.equal(options.headers.Authorization,"Bearer "+bearer);
      return new Response(JSON.stringify({id:"alice",email:"test@example.fr"}),{status:200});
    }
    if(url===base+"/v1/profiles") {
      assert.equal(options.headers.Authorization,"Bearer "+bearer);
      return new Response(JSON.stringify({profiles:[]}),{status:200});
    }
    if(url===base+"/api/auth/sign-out")return new Response("{}",{status:200});
    throw new Error("Route inattendue : "+url);
  };
  const window={location:{search:""},MA_COLLECTION_ACCOUNT:{cloudUrl:base,enabled:true}};
  const context={window,fetch,localStorage,sessionStorage,URL,URLSearchParams,Response,TextEncoder,TextDecoder,crypto:webcrypto,console};
  vm.runInNewContext(src("account-config.js"),context);
  vm.runInNewContext(src("account-vault.js"),context);
  assert.equal(window.MaCollectionBackendConfig.current().url,base);
  await window.MaCollectionAccount.cloudLogin("test@example.fr","mot-de-passe-assez-long");
  assert.equal(window.MaCollectionAccount.status().cloudSignedIn,true);
  const saved=JSON.parse(sessionStorage.getItem("ma_collection_account_auth"));
  assert.equal(saved.provider,"cloudflare-better-auth");
  assert.equal(saved.server,base);
  await window.MaCollectionAccount.cloudFetch("/v1/profiles");
  await window.MaCollectionAccount.cloudFetch("/v1/profiles");
  assert.equal(calls.filter(c=>c.url.endsWith("/v1/me")).length,1,
    "Ne pas doubler toutes les écritures sur /v1/me");
  await assert.rejects(window.MaCollectionAccount.cloudFetch("https://evil.example/collect"),/Route Kovelyx/);
  await window.MaCollectionAccount.cloudLogout();
  assert.equal(sessionStorage.getItem("ma_collection_account_auth"),null);
  assert.equal(window.MaCollectionAccount.status().cloudSignedIn,false);
  assert.equal(calls.filter(c=>c.url.endsWith("/rest/v1/")).length,0);
});
