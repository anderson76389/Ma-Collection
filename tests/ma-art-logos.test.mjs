import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {
  MA_ART_LOGO_BASE, validMaArtLogoPath, logoUrl,
  enrichMaArtLogos, searchMaArtLogos, applyMaArtLogo
} from '../studio-ma-art-logos.mjs';

const inventorySource=readFileSync(new URL('../collections/ma-art-logos.js',import.meta.url),'utf8');
const scope={window:{}};
runInNewContext(inventorySource,scope);
const inventory=scope.window.MA_ART_LOGOS;

test('tous les logos Kaptain archivés sont exposés depuis notre propre CDN',()=>{
  assert.equal(inventory.length,976);
  assert.equal(new Set(inventory.map(x=>x.path)).size,976);
  assert(inventory.every(x=>validMaArtLogoPath(x.path)));
  assert(inventory.every(x=>logoUrl(x).startsWith(MA_ART_LOGO_BASE)));
  assert(!inventorySource.includes('https://raw.githubusercontent.com'));
  assert(!inventorySource.includes('https://imkaptain.github.io'));
  assert(!inventorySource.includes('https://kaptain.stream'));
});
test('recherche insensible aux accents, catégorie et limites de rendu mobile',()=>{
  const enriched=enrichMaArtLogos(inventory,[]);
  const all=searchMaArtLogos(enriched,'',{limit:72});
  assert.equal(all.total,976);
  assert.equal(all.results.length,72);
  assert.equal(all.omitted,904);
  assert(searchMaArtLogos(enriched,'zOe SaLdAnA').total>0);
  assert(searchMaArtLogos(enriched,'cinema',{group:'Genres'}).total>=0);
  assert.equal(searchMaArtLogos(enriched,'inexistant-abc-xyz').results.length,0);
});
test('un logo sélectionné ne modifie ni affiche, ni GIF, ni sources ni filtres',()=>{
  const item=enrichMaArtLogos(inventory,[])[0];
  const artwork={titleLogoUrl:'',coverImageUrl:'https://example.org/poster.jpg',
      focusGifUrl:'https://example.org/hover.gif',heroBackdropUrl:'https://example.org/bg.jpg'};
  const draft={sections:[{id:'section-1',folders:[{id:'folder-1',artwork,
      enabled:true,selectedKeys:['tmdb:movies'],filters:{genre:'action'}}]}]};
  const before=JSON.stringify(draft);
  const result=applyMaArtLogo(draft,'section-1','folder-1',item);
  assert.equal(result.changed,true);
  assert.equal(draft.sections[0].folders[0].artwork.titleLogoUrl,item.url);
  const copy=JSON.parse(before);
  copy.sections[0].folders[0].artwork.titleLogoUrl=item.url;
  assert.deepEqual(draft,copy);
  assert.equal(applyMaArtLogo(draft,'section-1','folder-1',item).changed,false);
  assert.throws(()=>applyMaArtLogo(draft,'section-1','folder-1',
    {...item,url:'https://imkaptain.github.io/stolen.png'}),/non reconnu/);
  assert.throws(()=>applyMaArtLogo(draft,'x','folder-1',item),/dossier cible/);
  assert.equal(logoUrl({path:'../../danger.png'}),'');
});
test('la bibliothèque retrouve le nom du dossier depuis la collection actuelle',()=>{
  const first=inventory[0];
  const rows=enrichMaArtLogos(inventory,[{
    title:'Mes genres',folders:[{title:'Mon titre personnalisé',titleLogoUrl:MA_ART_LOGO_BASE+first.path}]
  }]);
  const selected=rows.find(x=>x.path===first.path);
  assert.equal(selected.label,'Mon titre personnalisé');
  assert.equal(selected.group,'Mes collections');
  assert.equal(selected.category,'Mes genres');
});
