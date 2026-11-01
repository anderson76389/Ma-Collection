import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assetUrl,captureDraft,validateDraft,applyDraft,originalsFor,decorateExport,STUDIO_SHAPES
} from '../studio-avance-core.mjs';

function fixture(){
  const data=[
    {id:'section-a',title:'Streaming Services',folders:[
      {id:'folder-a',title:'Netflix',tileShape:'LANDSCAPE',
       coverImageUrl:'https://ma-art.mailpromahe.workers.dev/media/abc.jpg',
       sources:[{title:'Nouveaux films',provider:'tmdb'},{title:'Nouvelles séries',provider:'tmdb'}]},
      {id:'folder-b',title:'Disney+',tileShape:'LANDSCAPE',
       coverImageUrl:'https://ma-art.mailpromahe.workers.dev/media/def.jpg',
       sources:[{title:'Top 10',provider:'tmdb'}]}
    ]},
    {id:'section-b',title:'Genres',folders:[
      {id:'folder-c',title:'Action',tileShape:'POSTER',
       sources:[{title:'Les meilleurs films',provider:'tmdb'}]}
    ]}
  ];
  const sel={
    'folder-a':{'Nouveaux films':true,'Nouvelles séries':true},
    'folder-b':{'Top 10':true},
    'folder-c':{'Les meilleurs films':false}
  };
  return {data,sel};
}
test('La capture de profils n’altère ni les sources ni les URLs originales',()=>{
  const {data,sel}=fixture(),old=structuredClone(data),selection=structuredClone(sel);
  const profile=captureDraft(data,sel,'Ma TV');
  assert.equal(profile.sections.length,2);
  assert.equal(profile.sections[0].folders[0].selectedKeys.length,2);
  assert.deepEqual(data,old);assert.deepEqual(sel,selection);
  assert.equal(validateDraft(profile,data).name,'Ma TV');
});
test('Réorganisation des sections et dossiers et sélection, sans suppression',()=>{
  const {data,sel}=fixture(),old=structuredClone(data);
  const draft=captureDraft(data,sel,'Mes salons');
  draft.sections.reverse();
  const s=draft.sections.find(x=>x.id==='section-a');
  s.folders.reverse();
  s.folders.find(x=>x.id==='folder-a').selectedKeys=['Nouveaux films'];
  const profile=applyDraft(draft,data,sel,originalsFor(data));
  assert.equal(data[0].id,'section-b');
  assert.deepEqual(data[1].folders.map(f=>f.id),['folder-b','folder-a']);
  assert.equal(sel['folder-a']['Nouveaux films'],true);
  assert.equal(sel['folder-a']['Nouvelles séries'],false);
  assert.equal(data[1].folders[1].id,old[0].folders[0].id);
  assert.equal(data[1].folders[1].sources[0].title,'Nouveaux films');
  assert.equal(profile.sections.length,2);
});
test('Affiches et fonds peuvent changer, avec retour aux originaux',()=>{
  const {data,sel}=fixture(),originals=originalsFor(data);
  const draft=captureDraft(data,sel,'Films');
  const f=draft.sections[0].folders[0];
  f.artwork.coverImageUrl='https://image.tmdb.org/t/p/original/test.jpg';
  f.artwork.heroBackdropUrl='https://ma-art.mailpromahe.workers.dev/media/new.webp';
  f.shape='POSTER';f.focusGlowEnabled=true;
  applyDraft(draft,data,sel,originals);
  assert.equal(data[0].folders[0].coverImageUrl,f.artwork.coverImageUrl);
  assert.equal(data[0].folders[0].tileShape,'POSTER');
  assert.equal(data[0].folders[0].focusGlowEnabled,true);
  const originalDraft=captureDraft(data,sel,'Restore');
  const target=originalDraft.sections[0].folders[0];
  target.artwork.coverImageUrl='';
  target.artwork.heroBackdropUrl='';
  target.shape='LANDSCAPE';
  applyDraft(originalDraft,data,sel,originals);
  assert.equal(data[0].folders[0].coverImageUrl,originals['folder-a'].coverImageUrl);
  assert.equal(data[0].folders[0].heroBackdropUrl||'',originals['folder-a'].heroBackdropUrl||'');
});
test('Les noms personnalisés sont réservés aux clones exportés',()=>{
  const {data,sel}=fixture(),original=structuredClone(data),draft=captureDraft(data,sel);
  draft.sections[0].label='Mes plateformes';
  draft.sections[0].folders[0].label='Netflix personnalisé';
  applyDraft(draft,data,sel,originalsFor(data));
  assert.equal(data[0].title,original[0].title);
  assert.equal(data[0].folders[0].title,original[0].folders[0].title);
  const exported=decorateExport(data,draft);
  assert.equal(exported[0].title,'Mes plateformes');
  assert.equal(exported[0].folders[0].title,'Netflix personnalisé');
  assert.equal(data[0].title,'Streaming Services');
});
test('Les nouvelles sections ou dossiers restent présents avec une ancienne sauvegarde',()=>{
  const {data,sel}=fixture(),old=captureDraft(data,sel);
  data[0].folders.push({id:'folder-new',title:'Nouveau',sources:[{title:'New'}]});
  data.push({id:'section-new',title:'Nouveautés',folders:[]});
  applyDraft(old,data,sel,originalsFor(data));
  assert.equal(data.length,3);
  assert(data[0].folders.some(x=>x.id==='folder-new'));
});
test('Fichier importé malveillant refusé et absence de requêtes Kaptain',()=>{
  const {data,sel}=fixture(),p=captureDraft(data,sel);
  assert.throws(()=>assetUrl('javascript:alert(1)'),/indépendante|incorrecte/);
  assert.throws(()=>assetUrl('https://kaptain.stream/a.jpg'),/Kaptain/);
  assert.throws(()=>assetUrl('https://raw.githubusercontent.com/ImKaptain/nuvio-art/main/x.png'),/Kaptain/);
  p.sections[0].folders[0].artwork.coverImageUrl='https://kaptain.stream/x.png';
  assert.throws(()=>validateDraft(p,data),/Kaptain/);
});
test('Le format et le catalogue d’origine ne sont jamais modifiés par l’export seul',()=>{
  const {data,sel}=fixture(),draft=captureDraft(data,sel);
  assert(STUDIO_SHAPES.includes('POSTER'));
  assert.deepEqual(decorateExport(data,null),data);
  assert.deepEqual(sel['folder-a'],{'Nouveaux films':true,'Nouvelles séries':true});
  assert.equal(validateDraft(draft,data).sections.length,2);
});

test('La synchronisation optionnelle du nom/avatar n'est jamais activée par défaut',()=>{
  const {data,sel}=fixture(),d=captureDraft(data,sel,'Salon');
  assert.equal(d.syncQuickEditor,false);
  d.syncQuickEditor=true;
  const normalized=validateDraft(d,data);
  assert.equal(normalized.syncQuickEditor,true);
});
