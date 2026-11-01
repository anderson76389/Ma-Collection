const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('poster-editor.js', 'utf8');
const makeSession = (stored) => {
  const folder = {
    id: 'folder-film-1',
    title: 'Test',
    coverImageUrl: 'https://ma-art.mailpromahe.workers.dev/media/original.jpg',
    heroBackdropUrl: 'https://ma-art.mailpromahe.workers.dev/media/background.webp',
    tileShape: 'LANDSCAPE',
    sources: [{provider:'tmdb',tmdbSourceType:'COLLECTION',tmdbId:645}]
  };
  const storage = new Map(Object.entries(stored || {}));
  const window = {NUVIO_DATABASE:[{id:'cat-1',folders:[folder]}]};
  let renders = 0, initialized = 0;
  window.initializeDatabase = () => { initialized++; window.collectionData = window.NUVIO_DATABASE; };
  window.openSourceCustomizationDrawer = () => {};
  const context = {
    window,
    document: {readyState:'loading'},
    localStorage:{
      getItem: key => storage.get(key) ?? null,
      setItem:(key,val) => storage.set(key,val)
    },
    renderPreviewCollection: () => {renders++;},
    isPreviewActive:true,
    URL,
    console,
  };
  vm.runInNewContext(source, context, {timeout:1500});
  return {folder, window, storage, init:()=>window.initializeDatabase(), renders:()=>renders, initialized:()=>initialized};
};

test('the editor changes nothing for an uncustomized visitor', () => {
  const session = makeSession();
  session.init();
  assert.equal(session.initialized(), 1);
  assert.equal(session.renders(), 0);
  assert.equal(session.folder.coverImageUrl, 'https://ma-art.mailpromahe.workers.dev/media/original.jpg');
  assert.equal(session.folder.tileShape, 'LANDSCAPE');
});

test('saved changes are applied by stable folder ID', () => {
  const saved = JSON.stringify({'folder-film-1': {
    coverImageUrl:'https://image.tmdb.org/t/p/w500/poster.jpg',
    heroBackdropUrl:'https://ma-art.mailpromahe.workers.dev/media/background.webp',
    tileShape:'POSTER'
  }});
  const session = makeSession({ma_collection_folder_artwork_v1:saved});
  session.init();
  assert.equal(session.folder.coverImageUrl,'https://image.tmdb.org/t/p/w500/poster.jpg');
  assert.equal(session.folder.tileShape,'POSTER');
  assert.equal(session.renders(),1);
});

test('external Kaptain and arbitrary hosts are never accepted', () => {
  const valid = makeSession().window.MaCollectionArtworkEditor.validArtworkUrl;
  assert.equal(valid('https://ma-art.mailpromahe.workers.dev/media/image.jpg'),true);
  assert.equal(valid('https://image.tmdb.org/t/p/w500/image.jpg'),true);
  assert.equal(valid('https://raw.githubusercontent.com/ImKaptain/nuvio-assets/main/a.jpg'),false);
  assert.equal(valid('https://kaptain.stream/image.jpg'),false);
  assert.equal(valid('javascript:alert(1)'),false);
  assert.equal(valid('http://image.tmdb.org/t/p/w500/image.jpg'),false);
  assert.equal(valid('https://evil.example/image.jpg'),false);
});

test('invalid stored images never overwrite the originals', () => {
  const saved = JSON.stringify({'folder-film-1':{
    coverImageUrl:'https://kaptain.stream/image.jpg',
    heroBackdropUrl:'',
    tileShape:'POSTER'
  }});
  const session=makeSession({ma_collection_folder_artwork_v1:saved});
  session.init();
  assert.equal(session.folder.coverImageUrl,'https://ma-art.mailpromahe.workers.dev/media/original.jpg');
});
