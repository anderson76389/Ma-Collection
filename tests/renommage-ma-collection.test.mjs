import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('l’assistant n’affiche plus l’ancien nom Kaptain',()=>{
  const wizard=read('wizard.js');
  const css=read('style.css');
  const channels=read('collections/test-channels.js');
  assert.doesNotMatch(wizard,/kaptain/i);
  assert.doesNotMatch(css,/kaptain/i);
  assert.doesNotMatch(channels,/kaptain/i);
  assert.match(wizard,/Ma-Collection — Assistant de configuration/);
});

test('les nouveaux profils ont les identifiants de configuration Ma-Collection',()=>{
  const wizard=read('wizard.js');
  assert.match(wizard,/password: 'ma-collection-partners'/);
  assert.match(wizard,/password: 'ma-collection-auto'/);
  assert.match(wizard,/const aioStreamsPassword = \(state\.aioStreamsPassword \|\| ''\)\.trim\(\) \|\| 'MaCollection'/);
  // La valeur choisie ou récupérée dans la session passe avant le nouveau défaut.
  assert.match(wizard,/password: aioStreamsPassword/);
  assert.match(wizard,/state\.aioStreamsPassword = aioStreamsPassword/);
});

test('les anciennes préférences et comptes restent importables sans être effacés',()=>{
  const migration=read('scripts/migrate-storage.js');
  assert.match(migration,/startsWith\('kaptain_'\)/);
  assert.match(migration,/oldKey\.slice\('kaptain_'\.length\)/);
  assert.match(migration,/window\.KAPTAIN_ACCOUNT/);
  assert.match(migration,/storage\.getItem\(newKey\) !== null/);
});

test('aucune URL externe ni réorganisation des scripts',()=>{
  const html=read('index.html');
  assert.match(html,/style\.css\?v=96\.1/);
  assert.match(html,/collections\/test-channels\.js\?v=95\.1/);
  assert.match(html,/wizard\.js\?v=101\.1/);
  assert.match(html,/collections\/database\.js\?v=96\.0/);
  assert.match(html,/src="app\.js\?v=10[67]\.0"/);
});
