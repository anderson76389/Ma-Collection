import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../accueil-mosaique.js', import.meta.url), 'utf8');
const mappingSource = readFileSync(new URL('../collections/accueil-ma-art.js', import.meta.url), 'utf8');
const mapped = { window: {} };
runInNewContext(mappingSource, mapped);
const posterMap = mapped.window.MA_ART_HOME_POSTERS;
const knownPosters = Object.keys(posterMap);

function element(tag) {
  return {
    tagName: tag,
    className: '',
    children: [],
    dataset: {},
    style: { setProperty(key, value) { this[key] = value; } },
    classList: { add(...names) { this.names = (this.names || []).concat(names); } },
    setAttribute() {},
    appendChild(child) { this.children.push(child); },
    insertBefore(child) { this.children.unshift(child); },
    querySelector(selector) {
      return selector === '.mc-wall-plane'
        ? this.children.find(child => child.className === 'mc-wall-plane') : null;
    },
    addEventListener() {},
    remove() { this.removed = true; }
  };
}

function render({ online = true, preview = true } = {}) {
  const host = element('host');
  const doc = {
    readyState: 'complete',
    querySelector(selector) {
      return selector === '#title-screen-overlay .suite-wall' ? host : null;
    },
    createElement: element,
    createDocumentFragment: () => element('fragment')
  };
  const groups = {};
  for (let group = 0; group < 10; group++) {
    groups['G' + group] = Array.from(
      { length: 12 }, (_, index) => knownPosters[(index * 10 + group) % 45]
    );
  }
  runInNewContext(source, {
    window: { PREVIEW_POSTERS: preview ? groups : undefined, MA_ART_HOME_POSTERS: posterMap },
    document: doc,
    navigator: { onLine: online }
  });
  const columns = host.children[0].children[0].children;
  const cards = columns.flatMap(column => column.children);
  const imgs = cards.flatMap(card => card.children);
  return { columns, cards, imgs, host };
}

test('cinematic wall uses 45 distinct posters archived on our own Ma-Art CDN', () => {
  const { columns, cards, imgs } = render();
  assert.equal(columns.length, 9);
  assert.equal(cards.length, 45);
  assert.equal(imgs.length, 45);
  assert.equal(new Set(imgs.map(img => img.src)).size, 45);
  assert(imgs.every(img => img.src.startsWith('https://ma-art-images-static.mailpromahe.workers.dev/media/image.tmdb.org/')));
  assert(imgs.every(img => img.loading === 'lazy' && img.decoding === 'async'));
  assert(cards.every(card => card.style['--crop-x'] && card.style['--crop-y']));
  assert(!source.includes('kaptain.stream/'));
  assert(!source.includes('https://image.tmdb.org/t/p/'));
  assert.equal(knownPosters.length, 45);
  assert.equal(new Set(Object.values(posterMap)).size, 45);
});

test('offline and missing preview data retain the independent local poster wall', () => {
  for (const options of [{ online: false }, { preview: false }]) {
    const { cards, imgs, host } = render(options);
    assert.equal(cards.length, 45);
    assert.equal(imgs.length, 0);
    assert(host.classList.names.includes('mc-wall-local-posters'));
    assert(cards.every(card => card.style['--crop-x'] && card.style['--crop-y']));
  }
});
