import test from 'node:test';
import assert from 'node:assert/strict';
import {addonInventoryFromDraft,validateAddonManifestUrl,buildAddonManifestFile} from '../studio-addon-manifests.mjs';

const draft={sections:[{id:'a',enabled:true,folders:[{id:'f',enabled:true,selectedKeys:['x','y','z']}]}]};
const catalogues=[{id:'a',folders:[{id:'f',sources:[
  {id:'x',addonId:'aio-metadata'},
  {id:'y',addonId:'aio-metadata'},
  {id:'z',provider:'tmdb'}
]}]}];

test('inventaire: uniquement les extensions présentes dans les sources activées',()=>{
  assert.deepEqual(addonInventoryFromDraft(draft,catalogues,s=>s.id),[{id:'aio-metadata',sources:2,folders:2}]);
  assert.deepEqual(addonInventoryFromDraft({sections:[{...draft.sections[0],enabled:false}]},catalogues,s=>s.id),[]);
});

test('export: fichier de manifests Kovelyx portable',()=>{
 const out=buildAddonManifestFile([{id:'aio-metadata'}],{'aio-metadata':'https://mon-serveur.example/config/manifest.json'});
 assert.deepEqual(out,{format:'kovelyx-addon-urls-v1',addons:[{manifestUrl:'https://mon-serveur.example/config/manifest.json'}]});
});

test('sécurité: secrets dans les URL, ZIP et dépendances Kaptain jamais acceptés',()=>{
 for(const u of [
  'http://example.org/manifest.json',
  'https://user:pass@example.org/manifest.json',
  'https://kaptain.stream/manifest.json',
  'https://art.kaptain.stream/manifest.json',
  'https://example.org/manifest.json#fragment',
  'https://example.org/index.html'
 ])assert.throws(()=>validateAddonManifestUrl(u));
 assert.throws(()=>buildAddonManifestFile([{id:'x'}],{}),/au moins/);
});
