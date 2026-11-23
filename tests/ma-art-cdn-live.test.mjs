/* Contrôle HTTP depuis GitHub Actions des copies publiques de Ma-Art.
 * Vérifie le corps réel (taille et SHA-256), pas seulement une réponse HTTP 200.
 * Toute redirection est rejetée pour éviter un proxy vers les sources d'origine.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const base = 'https://ma-art-images-static.mailpromahe.workers.dev/';
const samples = [
  [
    "media/image.tmdb.org/6672cc9bd8c24eecfa4266a6.jpg",
    30994,
    "e427921b1d4ec335888fb6eec56b98f2a539425eb29be52ebf05d45c89df7aaf"
  ],
  [
    "media/image.tmdb.org/7f9525514ae3e76acb469c5a.jpg",
    23542,
    "be6c89ab92a007d98dc6fbce976c1543efd6df5579a391bc03dda32f4c03e012"
  ],
  [
    "media/image.tmdb.org/8d67b4d02ac76b8810244339.jpg",
    8975,
    "c3d46e889f79372ff566a79864c72f1cd897c5479b8d69d3909693f1ab8fe05c"
  ],
  [
    "media/image.tmdb.org/f8d14b5ee12175cf1a3b5e5d.jpg",
    8005,
    "f2c1be96f6d825595d5b8b179cfb52733f33b52925df70a8563690f6fa3127b3"
  ]
];

test('Cloudflare sert les vraies affiches archivées, sans rediriger vers TMDB', async () => {
  for (const [path, bytes, expectedSha] of samples) {
    const response = await fetch(base + path, {
      redirect: 'manual',
      signal: AbortSignal.timeout(20000)
    });
    assert.equal(response.status, 200, 'Image non accessible : ' + path);
    assert.match(response.headers.get('content-type') || '', /^image\/jpeg/i);
    const data = Buffer.from(await response.arrayBuffer());
    assert.equal(data.length, bytes, 'Taille incorrecte : ' + path);
    assert.equal(createHash('sha256').update(data).digest('hex'), expectedSha,
      'Corps différent de l’archive privée : ' + path);
  }
});
