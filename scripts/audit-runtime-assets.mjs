/** Check the complete local startup resource graph without contacting any server. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve,extname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');

export function auditRuntimeAssets(root=ROOT) {
  const visited=new Set(), queue=['index.html'];
  function include(raw,from) {
    if (/^data:/i.test(raw)||raw.startsWith('#')) return;
    assert(!/^(?:https?:)?\/\//i.test(raw),'Ressource de démarrage distante : '+from);
    assert(!/^[a-z][a-z\d+.-]*:/i.test(raw),'Protocole externe : '+from);
    const clean=decodeURIComponent(raw.split(/[?#]/)[0]);
    const target=resolve(dirname(resolve(root,from)),clean);
    assert(target.startsWith(resolve(root)+sep),'Ressource hors du site : '+from);
    const path=relative(root,target);
    assert(existsSync(target),'Ressource locale absente : '+path);
    if (!visited.has(path)) queue.push(path);
  }
  while(queue.length) {
    const path=queue.pop(); if(visited.has(path))continue; visited.add(path);
    if(!['.html','.css'].includes(extname(path)))continue;
    const text=readFileSync(resolve(root,path),'utf8').replace(/\/\*[^]*?\*\//g,'').replace(/<!--[^]*?-->/g,'');
    if(path.endsWith('.html')) {
      for(const tag of text.matchAll(/<(script|link)\b[^>]*>/gi)) {
        const value=(name)=>tag[0].match(new RegExp('\\b'+name+'=["\\\']([^"\\\']+)["\\\']','i'))?.[1];
        if(tag[1].toLowerCase()==='script') {const src=value('src');if(src)include(src,path);}
        else if(/(?:stylesheet|icon|preload)/i.test(value('rel')||'')) {const href=value('href');if(href)include(href,path);}
      }
    } else {
      for(const match of text.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/gi)) include(match[1],path);
      for(const match of text.matchAll(/@import\s+['"]([^'"]+)['"]/gi)) include(match[1],path);
    }
  }
  const manifest=JSON.parse(readFileSync(resolve(root,'fonts/interface-manifest.json'),'utf8'));
  for(const row of manifest.fonts) {
    assert(/^interface-[a-f\d]+\.woff2?$/.test(row.file),'Nom de police invalide');
    const bytes=readFileSync(resolve(root,'fonts',row.file));
    assert.equal(bytes.length,row.bytes,'Taille de police différente');
    assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256,'Police altérée');
    assert(visited.has('fonts/'+row.file),'Police originale non utilisée par la feuille locale');
  }
  return {localStartupResources:visited.size,verifiedOriginalFonts:manifest.fonts.length,remoteStartupResources:0};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  console.log('RESSOURCES_AUTONOMES_OK : '+JSON.stringify(auditRuntimeAssets()));
