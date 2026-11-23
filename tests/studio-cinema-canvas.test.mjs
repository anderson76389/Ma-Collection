import test from 'node:test';
import assert from 'node:assert/strict';
import {canvasRows,renderStudioCanvas} from '../studio-cinema-canvas.mjs';

const fixture=()=>({
  name:'Salon',
  sections:[
    {id:'cinema',label:'Cinéma',enabled:true,folders:[
      {id:'a',label:'Action',enabled:true,selectedKeys:['source-a'],
       artwork:{coverImageUrl:'https://ma-art.example.org/action.webp'}},
      {id:'b',label:'Drame',enabled:false,selectedKeys:['source-b'],artwork:{}},
      {id:'c',label:'Aventures',enabled:true,selectedKeys:['source-c'],artwork:{}}
    ]},
    {id:'series',label:'Séries',enabled:false,folders:[
      {id:'d',label:'Horreur',enabled:true,selectedKeys:['source-d'],artwork:{}}
    ]}
  ]
});
test('Le canvas représente le brouillon sans créer ni retirer de sources',()=>{
  const draft=fixture(),before=structuredClone(draft);
  const rows=canvasRows(draft,{limit:2});
  assert.equal(rows.length,2);
  assert.equal(rows[0].activeCount,2);
  assert.equal(rows[0].total,3);
  assert.equal(rows[0].displayed.length,2);
  assert.equal(rows[0].omitted,1);
  assert.equal(rows[1].activeCount,0,'une rangée désactivée ne devient pas active par erreur');
  assert.deepEqual(draft,before);
  const html=renderStudioCanvas(draft);
  assert(html.includes('Organiser mon écran d’accueil'));
  assert(html.includes('data-action="canvas-art"'));
  assert(html.includes('data-action="canvas-folder-up"'));
  assert(html.includes('data-action="canvas-section-down"'));
  assert(!html.includes('kaptain.stream'));
  assert.deepEqual(draft,before);
});
test('Filtrer les dossiers actifs et développer une rangée sans perte',()=>{
  const draft=fixture();
  const filtered=canvasRows(draft,{activeOnly:true,limit:1});
  assert.equal(filtered[0].displayed.length,1);
  assert.equal(filtered[0].omitted,1);
  assert.equal(filtered[0].displayed[0].id,'a');
  const expanded=canvasRows(draft,{activeOnly:true,limit:1,expanded:['cinema']});
  assert.equal(expanded[0].displayed.length,2);
  assert.equal(expanded[0].omitted,0);
  assert.deepEqual(draft.sections[0].folders.map(f=>f.id),['a','b','c']);
});
test('Les intitulés sont échappés et les images Kaptain ou scripts refusés',()=>{
  const draft=fixture();
  draft.sections[0].label='<svg onload=alert(1)>';
  draft.sections[0].folders[0].label='A" <script>alert(1)</script>';
  draft.sections[0].folders[0].artwork.coverImageUrl='https://kaptain.stream/cover.jpg';
  const html=renderStudioCanvas(draft);
  assert(!html.includes('<script>'));
  assert(!html.includes('<svg onload'));
  assert(!html.includes('src="https://kaptain.stream'));
  assert(html.includes('&lt;script&gt;'));
  assert(html.includes('data-action="canvas-open-list"'));
});
test('Rendu limité par rangée même avec un très grand catalogue',()=>{
  const draft=fixture();
  draft.sections[0].folders=Array.from({length:800},(_,i)=>({
    id:'folder-'+i,label:'Dossier '+i,enabled:true,selectedKeys:['x'],artwork:{}
  }));
  const html=renderStudioCanvas(draft);
  assert.equal((html.match(/class="mc-cinema-tile /g)||[]).length,9,
    'Le canvas charge les 8 premières cartes de la grande rangée et une autre rangée');
  assert(html.includes('Afficher les 792 autres dossiers'));
});


test('Le Studio affiche les logos et affiches archivés sur Ma-Art, même si hideTitle est activé',()=>{
  const draft=fixture(),folder=draft.sections[0].folders[0];
  folder.hideTitle=true;
  folder.artwork.coverImageUrl='https://ma-art.mailpromahe.workers.dev/media/imkaptain.github.io/aabbccddeeff001122334455.webp';
  folder.artwork.titleLogoUrl='https://ma-art-images-static.mailpromahe.workers.dev/media/raw.githubusercontent.com/112233445566778899001122.png';
  const rendered=renderStudioCanvas(draft);
  assert(rendered.includes('src="'+folder.artwork.coverImageUrl+'"'));
  assert(rendered.includes('class="mc-cinema-art-logo"'));
  assert(rendered.includes('src="'+folder.artwork.titleLogoUrl+'"'));
  assert(rendered.includes('mc-cinema-art-title'));
  assert.deepEqual(draft.sections[0].folders[0],folder);
});
test('Le Studio refuse un logo issu du vrai domaine Kaptain',()=>{
  const draft=fixture();
  draft.sections[0].folders[0].artwork.titleLogoUrl='https://imkaptain.github.io/TitleLogos/ACTION.png';
  const rendered=renderStudioCanvas(draft);
  assert(!rendered.includes('src="https://imkaptain.github.io/'));
  assert(!rendered.includes('class="mc-cinema-art-logo"'));
});
