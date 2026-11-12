import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {emergencyRecovery} from '../scripts/build-emergency-catalogue.mjs';

const items=[{media_type:'movie',media_id:21},{media_type:'tv',media_id:99}];
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const collections=new Map([['actors',[
  {id:'section-a',folders:[{id:'folder-b',sources:[
    {id:'source-1',provider:'tmdb',tmdbSourceType:'LIST',tmdbId:42,mediaType:'MOVIE'},
    {id:'source-2',provider:'tmdb',tmdbSourceType:'LIST',tmdbId:42,mediaType:'TV'},
    {id:'source-3',provider:'tmdb',tmdbSourceType:'LIST',tmdbId:48},
    {id:'source-4',provider:'trakt',traktListId:25},
    {id:'source-5',provider:'addon',addonId:'aio-metadata',catalogId:'trakt.watchlist.movies'}
  ]}]}]]]);
const snapshot={schema:1,original_list_id:42,public:true,items,sha256:hash(items)};
const archives=new Map([[42,snapshot]]);
const status={expected:2,verified_current:1,failures:[{list_id:48,reason:'archive absente'}]};

test('export de secours en lecture seule préserve l’ordre, les sources et les IDs',()=>{
  const before=structuredClone([...collections]),archive=structuredClone([...archives]);
  const result=emergencyRecovery(collections,archives,status);
  assert.deepEqual(result.coverage,{categories:1,folders:1,sources:5,
    tmdb_unique:2,tmdb_references:3,tmdb_recoverable:1,
    tmdb_missing_or_invalid:1,trakt_references:1,addon_references:1});
  assert.deepEqual(result.tmdb_lists[0].items,items);
  assert.deepEqual(result.tmdb_lists[0].uses.map(x=>x.source_id),['source-1','source-2']);
  assert.deepEqual(result.tmdb_blockers,[{list_id:48,references:1,reason:'archive_absente'}]);
  assert.equal(result.trakt_unbacked_references[0].list_id,25);
  assert.equal(result.addon_external_references[0].catalog_id,'trakt.watchlist.movies');
  assert.deepEqual([...collections],before);
  assert.deepEqual([...archives],archive);
});

test('refuse toute archive TMDB avec hash cassé, duplicata ou ID invalide',()=>{
  for(const bad of [
    {...snapshot,sha256:'0'.repeat(64)},
    {...snapshot,items:[...items,items[0]]},
    {...snapshot,items:[{media_type:'movie',media_id:0}]},
  ]){
    const results=emergencyRecovery(collections,new Map([[42,bad]]),
      {expected:2,verified_current:0,failures:[{list_id:42},{list_id:48}]});
    assert.equal(results.tmdb_lists.length,0);
    assert.equal(results.tmdb_blockers.length,2);
  }
});

test('refuse un rapport mensonger annonçant toutes les archives disponibles',()=>{
  assert.throws(()=>emergencyRecovery(collections,archives,
    {expected:2,verified_current:2,failures:[]}),/correspond/);
});
