import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {auditRuntimeAssets} from '../scripts/audit-runtime-assets.mjs';
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'ma-collection-assets-'));
 mkdirSync(join(root,'fonts'));
 writeFileSync(join(root,'index.html'),'<link rel="stylesheet" href="style.css"><script src="app.js"></script>');
 writeFileSync(join(root,'app.js'),'window.appReady=true;');
 writeFileSync(join(root,'style.css'),"@import url('fonts/interface.css');");
 writeFileSync(join(root,'fonts/interface.css'),"@font-face{font-family:Inter;src:url('./interface-a1.woff2')}");
 const bytes=Buffer.from('wOF2test');writeFileSync(join(root,'fonts/interface-a1.woff2'),bytes);
 writeFileSync(join(root,'fonts/interface-manifest.json'),JSON.stringify({fonts:[{file:'interface-a1.woff2',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}]}));
 return root;
}
for(const [name,edit,expected] of [
 ['site restaurable sans hébergeur de scripts ou polices',()=>{},null],
 ['feuille distante refusée',r=>writeFileSync(join(r,'style.css'),"@import url('https://fonts.example.test/css');"),/distante/],
 ['police locale manquante refusée',r=>unlinkSync(join(r,'fonts/interface-a1.woff2')),/absente/],
 ['octets de police modifiés refusés',r=>writeFileSync(join(r,'fonts/interface-a1.woff2'),'wOF2bad!'),/altérée/],
])test(name,()=>{const root=fixture();try{edit(root);if(expected)assert.throws(()=>auditRuntimeAssets(root),expected);else assert.equal(auditRuntimeAssets(root).remoteStartupResources,0);}finally{rmSync(root,{recursive:true,force:true});}});
