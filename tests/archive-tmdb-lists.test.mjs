import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotPublicList} from '../scripts/archive-tmdb-lists.mjs';
test('préserve tous les identifiants et leur ordre sur plusieurs pages',async()=>{
 const calls=[];
 const result=await snapshotPublicList(42,async path=>{calls.push(path);const page=path.includes('page=1&')?1:2;return {public:true,page,total_pages:2,total_results:2,results:[{id:page===1?123:456,media_type:page===1?'movie':'tv'}]};});
 assert.deepEqual(result.items,[{media_type:'movie',media_id:123},{media_type:'tv',media_id:456}]);
 assert.equal(calls.length,2);assert.match(result.sha256,/^[a-f\d]{64}$/);
});
test('ne republie jamais le contenu d’une liste privée',async()=>{
 await assert.rejects(snapshotPublicList(42,async()=>({public:false,total_pages:1,total_results:1,results:[{id:1,media_type:'movie'}]})),/privée/);
});
test('refuse une page tronquée',async()=>{
 await assert.rejects(snapshotPublicList(42,async()=>({public:true,total_pages:1,total_results:2,results:[{id:1,media_type:'movie'}]})),/tronqué/);
});
test('refuse une liste changeant de taille pendant son téléchargement',async()=>{
 let page=0;await assert.rejects(snapshotPublicList(42,async()=>({public:true,page:++page,total_pages:2,total_results:page===1?2:3,results:[{id:page,media_type:'movie'}]})),/modifiée/);
});
