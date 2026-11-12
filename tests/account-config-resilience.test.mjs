import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../account-config.js',import.meta.url),'utf8');
function boot(storage, override){
  const entries=new Map(Object.entries(storage));
  const localStorage={
    getItem:k=>entries.get(k)??null,
    setItem:(k,v)=>entries.set(k,String(v)),
    removeItem:k=>entries.delete(k)
  };
  const window={MA_COLLECTION_ACCOUNT:override||{}};
  vm.runInNewContext(source,{window,localStorage,URL});
  return {api:window.MaCollectionBackendConfig,window,entries};
}
test('les anciennes préférences illisibles ne bloquent plus le site ni le Studio',()=>{
  for(const malformed of ['not-json','{"cloudUrl":"javascript:alert(1)"}',
      '{"cloudUrl":"https://user:password@evil.test/"}',
      '{"cloudUrl":"https://cloud.example/extra"}']){
    const {api}=boot({ma_collection_kovelyx_cloud_backend_v1:malformed});
    assert.equal(api.current().url,'https://kovelyx-cloud.mailpromahe.workers.dev');
    assert.equal(api.configured(),true);
  }
});
test('un backend de secours volontaire reste utilisable sans Kaptain',()=>{
  const {api}=boot({});
  const changed=api.save('https://backup.example.org/');
  assert.equal(changed.cloudUrl,'https://backup.example.org');
  assert.equal(api.current().url,'https://backup.example.org');
  api.clear();
  assert.equal(api.configured(),false);
});
test('une URL à identifiants, fragment, chemin ou protocole non sûr est refusée',()=>{
  const {api}=boot({});
  for(const bad of ['javascript:alert(1)','http://evil.example',
    'https://u:p@evil.example','https://evil.example/foo',
    'https://evil.example/?token=private','https://evil.example/#fragment',
    'https://kaptain.stream','https://assets.kaptain.stream',
    'https://api.nuvio.tv']){
    assert.throws(()=>api.save(bad),/HTTPS/);
  }
  assert.equal(api.current().url,'https://kovelyx-cloud.mailpromahe.workers.dev');
});
