import test from 'node:test';
import assert from 'node:assert/strict';
import {STUDIO_WORKSPACE_GROUPS,STUDIO_WORKSPACE_TITLES,studioNavigationHtml} from '../studio-workspace-nav.mjs';
test('tous les onglets du Studio sont accessibles, uniques et traduits',()=>{
  const ids=STUDIO_WORKSPACE_GROUPS.flatMap(g=>g.items.map(it=>it[0]));
  assert.equal(ids.length,14);
  assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(new Set(ids),new Set(Object.keys(STUDIO_WORKSPACE_TITLES)));
  for(const id of ['accueil','organisation','affiches','apercu','recherche','outils','bibliotheque','affiches-fr','import-collection','extensions','profils','modifications','parametres','partage']){
    assert(ids.includes(id),id);
    assert(studioNavigationHtml().includes('data-tab="'+id+'"'));
  }
  assert.equal((studioNavigationHtml().match(/role="tab"/g)||[]).length,14);
  assert(!studioNavigationHtml().includes('kaptain.stream'));
});
