import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
test('guided selection recognizes French and renamed categories by stable IDs',()=>{
 const data=[{id:'collection-ERFS5GWK',title:'Mes plateformes',folders:[{id:'netflix',title:'Netflix',sources:[{title:'Films'}]},{id:'disney',title:'Disney+',sources:[{title:'Films'}]}]},{id:'27bda92a-f626-4093-a2ba-0a32dc09437a',title:'Chaînes',folders:[]},{id:'collection-b530d60c',title:'Animés',folders:[{id:'anime',sources:[{title:'Animés'}]}]}];
 const selection={netflix:{Films:true},disney:{Films:true},anime:{Animés:true}};
 const context={window:{collectionData:data,selectedMap:selection,getFolderKey:f=>f.id},document:{getElementById:id=>id==='customize-overlay'?{}:null},selectedMap:selection,getFolderKey:f=>f.id,getSourceKey:s=>s.title,Set,console};
 vm.runInNewContext(fs.readFileSync('customize.js','utf8'),context);const state=context.window.customizeState;
 assert.equal(state.country,'FR');assert(context.window.MaCollectionCustomizeTools.role(data[0],'streaming'));
 state.selectedStreaming=new Set(['Netflix']);state.selectedCategories=new Set(['Animés']);state.excludeAnime=true;context.window.MaCollectionCustomizeTools.applySelection();
 assert.equal(selection.netflix.Films,true);assert.equal(selection.disney.Films,false);assert.equal(selection.anime.Animés,false);
});
