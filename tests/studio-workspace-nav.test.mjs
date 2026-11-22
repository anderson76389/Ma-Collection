import test from 'node:test';
import assert from 'node:assert/strict';
import {studioIcon} from '../studio-icons.mjs';
import {STUDIO_WORKSPACE_GROUPS,STUDIO_WORKSPACE_TITLES,studioNavigationHtml} from '../studio-workspace-nav.mjs';
test('tous les onglets du Studio sont accessibles, uniques et traduits',()=>{
  const ids=STUDIO_WORKSPACE_GROUPS.flatMap(g=>g.items.map(it=>it[0]));
  assert.equal(ids.length,15);
  assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(new Set(ids),new Set(Object.keys(STUDIO_WORKSPACE_TITLES)));
  for(const id of ['accueil','organisation','affiches','mes-creations','apercu','recherche','outils','bibliotheque','affiches-fr','import-collection','extensions','profils','modifications','parametres','partage']){
    assert(ids.includes(id),id);
    assert(studioNavigationHtml().includes('data-tab="'+id+'"'));
  }
  assert.equal((studioNavigationHtml().match(/role="tab"/g)||[]).length,15);
  assert(!studioNavigationHtml().includes('kaptain.stream'));
});

test('pictogrammes du Studio : 15 icônes locales accessibles sans fournisseur externe',()=>{
  const html=studioNavigationHtml();
  assert.equal((html.match(/<svg /g)||[]).length,15);
  for(const row of STUDIO_WORKSPACE_GROUPS)
    for(const [key] of row.items){
      const icon=studioIcon(key);
      assert(icon.includes('viewBox="0 0 24 24"'));
      assert(icon.includes('aria-hidden="true"'));
      assert(!/(?:<image|<use|\shref=|\ssrc=|\sxlink:href=)/i.test(icon),'Aucune ressource distante ne doit être chargée par une icône');
      assert(icon.includes('<path')||icon.includes('<rect')||icon.includes('<circle'));
    }
});
