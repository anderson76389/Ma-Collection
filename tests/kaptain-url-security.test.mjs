import test from 'node:test';
import assert from 'node:assert/strict';
import {isKaptainUrl} from '../scripts/kaptain-url-policy.mjs';
import {assetUrl} from '../studio-avance-core.mjs';

test('bloque les serveurs Kaptain et leurs miroirs, sans faux accès direct', () => {
  const forbidden = [
    'https://kaptain.stream/assets/cover.webp',
    'https://art.kaptain.stream/image.jpg',
    'https://imkaptain.github.io/assets/image.png',
    'https://github.com/ImKaptain/Ma-Art/raw/main/cover.png',
    'https://raw.githubusercontent.com/imkaptain/repo/main/cover.png',
    'https://api.github.com/repos/ImKaptain/project/cover.png',
    'https://gist.githubusercontent.com/imkaptain/id/raw/cover.png',
    'https://cdn.jsdelivr.net/gh/ImKaptain/repo@main/cover.webp',
    'https://cdn.statically.io/gh/imkaptain/repo/main/cover.webp',
    'https://raw.githack.com/imkaptain/repo/main/cover.webp',
    'https://images.weserv.nl/?url=https%3A%2F%2Fkaptain.stream%2Fcover.png'
  ];
  for (const url of forbidden) {
    assert.equal(isKaptainUrl(url),true,'Lien non détecté : '+url);
    assert.throws(()=>assetUrl(url),/indépendante|Kaptain/i,'Lien accepté dans le Studio : '+url);
  }
});

test('conserve les copies privées Ma-Art et les URL non liées à Kaptain', () => {
  const permitted = [
    'https://ma-art.mailpromahe.workers.dev/media/imkaptain.github.io/cover.webp',
    'https://ma-art.mailpromahe.workers.dev/media/poster.webp',
    'https://assets.example.org/ma-collection/cover.png'
  ];
  for (const url of permitted) {
    assert.equal(isKaptainUrl(url),false,url);
    assert.equal(assetUrl(url),url);
  }
});

test('refuse les images invalides et les URL non chiffrées',()=>{
  for(const url of ['http://example.org/cover.png','javascript:alert(1)',
    'https://user:password@assets.example.org/cover.png',
    'https://assets.example.org/not-an-image.txt']){
    assert.throws(()=>assetUrl(url));
  }
});
