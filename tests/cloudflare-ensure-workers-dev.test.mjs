import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureWorkersDev} from '../services/catalogue-recovery-cloudflare/ensure-workers-dev.mjs';
const account='a'.repeat(32);
const token='test-secret-do-not-print';
const expected='https://api.cloudflare.com/client/v4/accounts/'+account+
  '/workers/scripts/ma-collection/subdomain';
const ok=enabled=>({ok:true,status:200,json:async()=>({
  success:true,result:{enabled,previews_enabled:false}
})});

test('la route publique existante reste intacte, aucun appel en écriture',async()=>{
  const calls=[];
  const result=await ensureWorkersDev({account,token,fetcher:async(url,options)=>{
    calls.push({url,method:options.method,token:options.headers.Authorization});
    return ok(true);
  }});
  assert.deepEqual(result,{worker:'ma-collection',enabled:true,changed:false});
  assert.deepEqual(calls,[{url:expected,method:'GET',token:'Bearer '+token}]);
});

test('nactive que la route publique de ma-collection lorsquelle est désactivée',async()=>{
  const requests=[];
  let enabled=false;
  const result=await ensureWorkersDev({account,token,fetcher:async(url,options)=>{
    assert.equal(url,expected);
    requests.push(options.method);
    if(options.method==='POST'){
      assert.deepEqual(JSON.parse(options.body),{enabled:true,previews_enabled:false});
      enabled=true;
    }
    return ok(enabled);
  }});
  assert.deepEqual(result,{worker:'ma-collection',enabled:true,changed:true});
  assert.deepEqual(requests,['GET','POST','GET']);
});

test('un refus Cloudflare bloque le déploiement sans contournement',async()=>{
  await assert.rejects(()=>ensureWorkersDev({account,token,fetcher:async()=>({
    ok:false,status:403,json:async()=>({success:false,errors:[{code:10000}]})
  })}),/HTTP 403/);
  await assert.rejects(()=>ensureWorkersDev({account:'invalid',token}),/Account ID/);
});
