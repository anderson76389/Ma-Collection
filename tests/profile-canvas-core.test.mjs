import test from 'node:test';
import assert from 'node:assert/strict';
import {ProfileEditor} from '../profile-editor-core.mjs';
import {moveCanvasRow,moveCanvasFolder} from '../profile-canvas-core.mjs';
const rows=()=>[
 {id:'un',title:'Films',folders:[
  {id:'a',title:'A',sources:[{provider:'tmdb',tmdbSourceType:'LIST',tmdbId:18}],coverImageUrl:'https://own.example/a.jpg'},
  {id:'b',title:'B',sources:[{provider:'tmdb',tmdbSourceType:'LIST',tmdbId:19}]},
  {id:'c',title:'C',sources:[{provider:'tmdb',tmdbSourceType:'LIST',tmdbId:20}]},
 ]},
 {id:'deux',title:'Séries',folders:[
  {id:'d',title:'D',sources:[{provider:'tmdb',tmdbSourceType:'LIST',tmdbId:24}]}
 ]},
 {id:'trois',title:'Animation',folders:[]},
];
test('canvas: rangées déplacées en une opération annulable',()=>{
 const editor=new ProfileEditor(rows());
 moveCanvasRow(editor,'trois','un');
 assert.deepEqual(editor.rows.map(r=>r.id),['trois','un','deux']);
 editor.undo();
 assert.deepEqual(editor.rows.map(r=>r.id),['un','deux','trois']);
});
test('canvas: déplacer le dossier avant un autre, sans perdre les sources et l’art',()=>{
 const editor=new ProfileEditor(rows());
 moveCanvasFolder(editor,'un','a','deux','d');
 assert.deepEqual(editor.section('un').folders.map(f=>f.id),['b','c']);
 assert.deepEqual(editor.section('deux').folders.map(f=>f.id),['a','d']);
 assert.equal(editor.section('deux').folders[0].coverImageUrl,'https://own.example/a.jpg');
 assert.equal(editor.section('deux').folders[0].sources[0].tmdbId,18);
 editor.undo();assert.deepEqual(editor.rows,rows());
});
test('canvas: réorganisation interne dans les deux sens et ajout à la fin',()=>{
 const editor=new ProfileEditor(rows());
 moveCanvasFolder(editor,'un','a','un','c');
 assert.deepEqual(editor.section('un').folders.map(f=>f.id),['b','a','c']);
 moveCanvasFolder(editor,'un','c','un','b');
 assert.deepEqual(editor.section('un').folders.map(f=>f.id),['c','b','a']);
 moveCanvasFolder(editor,'un','a','un',null);
 assert.deepEqual(editor.section('un').folders.map(f=>f.id),['c','b','a']);
});
test('canvas: refus d’une collision et annulation atomique',()=>{
 const original=rows();original[1].folders.push({...original[0].folders[0]});
 const editor=new ProfileEditor(original);
 const prev=JSON.stringify(editor.rows);
 assert.throws(()=>moveCanvasFolder(editor,'un','a','deux','d'),/existe/);
 assert.equal(JSON.stringify(editor.rows),prev);
 assert.throws(()=>moveCanvasRow(editor,'un','inconnu'),/introuvable/);
 assert.equal(JSON.stringify(editor.rows),prev);
});
