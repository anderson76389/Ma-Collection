const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('custom-folders.js','utf8');
function session(saved) {
  const data=[{id:'collection-film',title:'Film Collections',folders:[{
    id:'folder-old',title:'Existant',sources:[{id:'src-old',title:'Ancien film'}]
  }]}];
  const values=new Map(saved ? [['ma_collection_custom_folders_v1',JSON.stringify(saved)]] : []);
  let called=0;
  const window={NUVIO_DATABASE:data,initializeDatabase(){called++}};
  const selectedMap={};
  const context={window,localStorage:{
    getItem:key=>values.get(key)||null,setItem:(key,val)=>values.set(key,val)
  },document:{},Math,Date,URL,selectedMap,currentCategoryIdx:0};
  vm.runInNewContext(source,context,{timeout:1200});
  return {api:window.MaCollectionCustomFolders,data,selectedMap,run:()=>window.initializeDatabase(),calls:()=>called};
}
const record=(patch={})=>({
  id:'folder-personal-1234567',title:'Ma saga',categoryId:'collection-film',
  type:'COLLECTION',tmdbId:645,mediaType:'MOVIE',region:'FR',
  coverImageUrl:'',heroBackdropUrl:'',tileShape:'POSTER',...patch
});
test('aucun changement des dossiers et catégories sans configuration',()=>{
  const s=session();s.run();assert.equal(s.calls(),1);assert.equal(s.data.length,1);
  assert.equal(s.data[0].folders.length,1);assert.equal(s.data[0].folders[0].title,'Existant');
});
test('dossier sauvegardé restauré dans la même catégorie, sans écraser la source',()=>{
  const s=session([record()]);s.run();
  assert.equal(s.data[0].folders.length,2);
  const f=s.data[0].folders[1];assert.equal(f.title,'Ma saga');
  assert.equal(f.sources[0].tmdbSourceType,'COLLECTION');
  assert.equal(f.sources[0].tmdbId,645);
  assert.equal(s.data[0].folders[0].title,'Existant');
});
test('réinitialisation du module ne crée aucun doublon',()=>{
  const s=session([record()]);s.run();s.run();
  assert.equal(s.data[0].folders.length,2);
});
test('sécurité des contenus sauvegardés',()=>{
  const s=session([record({coverImageUrl:'https://kaptain.stream/image.jpg'}),record({id:'folder-personal-zzzzzz',title:'Ok'})]);
  s.run();assert.equal(s.data[0].folders.length,2);assert.equal(s.data[0].folders[1].title,'Ok');
  assert.equal(s.api.validateRecord(record({title:'<img src=x onerror=alert(1)>'})),null);
});
test('studio, acteur et réseau restent des catalogues TMDB valides',()=>{
  const s=session();
  assert.equal(s.api.createSource(record({type:'COMPANY'})).tmdbSourceType,'COMPANY');
  assert.equal(s.api.createSource(record({type:'ACTOR'})).filters.withCast,'645');
  assert.equal(s.api.createSource(record({type:'DIRECTOR'})).filters.withCrew,'645');
  assert.equal(s.api.createSource(record({type:'NETWORK'})).filters.withNetworks,'645');
  assert.equal(s.api.createSource(record({type:'STREAMING'})).filters.watchRegion,'FR');
});
