import test from 'node:test';
import assert from 'node:assert/strict';
import {readCollections,inventory,itemKeys,equalItems,replaceListIds} from '../scripts/tmdb-own-lists.mjs';

const originals=await readCollections();
const all=inventory(originals,'all');
const people=inventory(originals,'people');

test('inventaire exact des listes Kaptain (sans requête réseau)',()=>{
  assert.equal(all.lists.length,262);
  assert.equal(all.references,643);
  assert.equal(people.lists.length,236);
  assert.equal(people.references,599);
  assert.equal(new Set(all.lists.map(x=>x.oldId)).size,262);
});

test('identifiants d’acteurs et de réalisateurs conservés jusqu’à la publication',()=>{
  const first=originals.get('actors')[0].folders[0].sources.find(x=>x.tmdbSourceType==='LIST');
  assert.equal(first.tmdbId,8659010);
  assert.equal(first.provider,'tmdb');
});

test('vérification stricte des contenus et de leur ordre',()=>{
  const rows=[{id:111,media_type:'movie'},{id:222,media_type:'tv'}];
  assert.deepEqual(itemKeys(rows),[{media_type:'movie',media_id:111},{media_type:'tv',media_id:222}]);
  assert.equal(equalItems(itemKeys(rows),[{media_type:'movie',media_id:111},{media_type:'tv',media_id:222}]),true);
  assert.equal(equalItems(itemKeys(rows),[{media_type:'tv',media_id:222},{media_type:'movie',media_id:111}]),false);
  assert.throws(()=>itemKeys([...rows,rows[0]]),/Doublon/);
  assert.throws(()=>itemKeys([{id:1,media_type:'person'}]),/invalide/);
});

test('aucun changement partiel si une seule liste manque',()=>{
  assert.throws(()=>replaceListIds(originals,{}),/non certifiée/);
});

test('seuls les IDs TMDB LIST changent ; catégories, images, Trakt restent identiques',()=>{
  const mapping={};
  for(const list of all.lists)mapping[String(list.oldId)]={state:'verified',targetId:list.oldId+90000000,targetPublic:true};
  const {output,changes}=replaceListIds(originals,mapping);
  assert.equal(changes,643);
  for(const [file,base] of originals){
    const modified=output.get(file);
    assert.equal(base.length,modified.length);
    for(let i=0;i<base.length;i++){
      const a=base[i],b=modified[i];
      assert.equal(a.id,b.id);
      for(let j=0;j<(a.folders||[]).length;j++){
        const fa=a.folders[j],fb=b.folders[j];
        assert.equal(fa.title,fb.title);
        assert.equal(fa.coverImageUrl,fb.coverImageUrl);
        assert.equal(fa.focusGifUrl,fb.focusGifUrl);
        assert.equal(fa.heroBackdropUrl,fb.heroBackdropUrl);
        for(let k=0;k<(fa.sources||[]).length;k++){
          const sa=fa.sources[k],sb=fb.sources[k];
          if(sa.provider==='tmdb'&&sa.tmdbSourceType==='LIST')assert.equal(sb.tmdbId,Number(sa.tmdbId)+90000000);
          else assert.deepEqual(sb,sa);
        }
      }
    }
  }
});
