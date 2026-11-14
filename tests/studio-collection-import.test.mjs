import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCollectionBackup,collectionBackupToDraft} from '../studio-collection-import.mjs';
const catalogue=()=>[{id:'c',title:'Section locale',folders:[{id:'f',title:'Mon dossier',tileShape:'POSTER',coverImageUrl:'https://my-art.example/cover.webp',sources:[{id:'stable',title:'Films',provider:'tmdb',tmdbSourceType:'LIST',tmdbId:123,mediaType:'MOVIE'}]},{id:'other',title:'Autre',sources:[{title:'Autre',provider:'tmdb'}]}]}];
const backup=()=>[{id:'c',title:'Ma section',viewMode:'ROWS',pinToTop:true,folders:[{id:'f',title:'Favoris',tileShape:'square',coverImageUrl:'https://imkaptain.github.io/art/cover.jpg',sources:[{id:'stable',title:'Films renommés',provider:'addon',addonId:'private-instance',type:'movie',catalogId:'aiometa-old.tmdb.list.123'}]}]}];
test('migrates stable IDs using independent local definitions, preserving order and preferences',()=>{
 const data=catalogue(),input=backup(),before=JSON.stringify([data,input]);
 const {draft,report,collection}=collectionBackupToDraft(input,data);
 assert.equal(report.matchedSources,1);assert.equal(report.unmatchedSources,0);assert.equal(report.kaptainImages,1);
 assert.equal(draft.sections[0].folders[0].shape,'SQUARE');
 assert.equal(collection[0].title,'Ma section');assert.equal(collection[0].viewMode,'ROWS');assert.equal(collection[0].pinToTop,true);
 assert.equal(collection[0].folders.length,1);assert.equal(collection[0].folders[0].title,'Favoris');
 assert.equal(collection[0].folders[0].sources[0].provider,'tmdb');
 assert.equal(collection[0].folders[0].coverImageUrl,'https://my-art.example/cover.webp');
 assert.ok(!JSON.stringify(collection).includes('private-instance'));assert.ok(!JSON.stringify(collection).includes('imkaptain'));
 assert.equal(JSON.stringify([data,input]),before);
});
test('reports unmatched rows and never selects unrelated sources',()=>{
 const input=backup();input[0].folders.push({id:'missing',title:'Absent',sources:[{provider:'addon'}]});input[0].folders[0].sources[0].id='unknown';input[0].folders[0].sources[0].title='No match';
 const {report,collection}=collectionBackupToDraft(input,catalogue());
 assert.equal(report.unmatchedFolders,1);assert.equal(report.unmatchedSources,2);assert.equal(collection.length,0);
});
test('uses legacy catalogSources only when sources is empty',()=>{
 const input=backup();const f=input[0].folders[0];f.catalogSources=f.sources;f.sources=[];
 assert.equal(inspectCollectionBackup(input).addonSources,1);
 assert.equal(collectionBackupToDraft(input,catalogue()).report.matchedSources,1);
});
test('rejects invalid JSON shapes and duplicate IDs before mutation',()=>{
 for(const input of [{},[],[...backup(),...backup()],[{id:'c',folders:[{id:'same'},{id:'same'}]}]])assert.throws(()=>inspectCollectionBackup(input));
});
test('accepts independent custom artwork, rejects scripts, and falls back to local images',()=>{
 const input=backup();input[0].folders[0].coverImageUrl='https://my-art.example/custom.png';
 assert.equal(collectionBackupToDraft(input,catalogue()).collection[0].folders[0].coverImageUrl,input[0].folders[0].coverImageUrl);
 input[0].folders[0].coverImageUrl='javascript:alert(1)';
 assert.equal(collectionBackupToDraft(input,catalogue()).collection[0].folders[0].coverImageUrl,'https://my-art.example/cover.webp');
});
