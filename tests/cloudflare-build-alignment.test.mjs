import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=await readFile(new URL('../wrangler.toml',import.meta.url),'utf8');
const inline=await readFile(new URL('../services/catalogue-recovery-cloudflare/wrangler.inline.toml',import.meta.url),'utf8');

test('Workers Builds racine et déploiement manuel ciblent le même Worker existant',()=>{
  for(const config of [root,inline]){
    assert.match(config,/^name\s*=\s*"ma-collection"\s*$/m);
    assert.match(config,/^workers_dev\s*=\s*true\s*$/m);
    assert.doesNotMatch(config,/^\[assets\]$/m);
    assert.doesNotMatch(config,/^name\s*=\s*"ma-collection-catalogues"$/m);
  }
  assert.match(root,/^main\s*=\s*"\.\/services\/catalogue-recovery-cloudflare\/worker-inline\.mjs"\s*$/m);
  assert.match(inline,/^main\s*=\s*"\.\/worker-inline\.mjs"\s*$/m);
  assert.match(root,/^command\s*=\s*"node services\/catalogue-recovery-cloudflare\/prepare-inline\.mjs"\s*$/m);
});
