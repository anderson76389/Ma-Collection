/* Contrôle indépendant des 976 logos servis par Cloudflare Static Assets.
   HEAD sur chacun ; aucune URL, image ou API Kaptain appelée. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../collections/ma-art-logos.js',import.meta.url),'utf8');
const context={window:{}};
runInNewContext(source,context);
const rows=context.window.MA_ART_LOGOS;
const base='https://ma-art-images-static.mailpromahe.workers.dev/';
if(rows.length!==976||new Set(rows.map(x=>x.path)).size!==976)
  throw Error('Inventaire de logos incomplet ou dupliqué');
const failures=[];
let index=0,ok=0;
async function probe(path){
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(base+path,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(12000)});
      if(response.status===200&&/^image\//i.test(response.headers.get('content-type')||''))return true;
      if(response.status===404)return '404 '+path;
      if(attempt===2)return String(response.status)+' '+path+' : '+response.headers.get('content-type');
    }catch(error){if(attempt===2)return path+' : '+error.message;}
    await new Promise(resolve=>setTimeout(resolve,400+attempt*700));
  }
}
async function worker(){
  while(index<rows.length){
    const item=rows[index++];
    const result=await probe(item.path);
    if(result===true){ok++;}
    else failures.push(result);
  }
}
await Promise.all(Array.from({length:12},worker));
console.log('LOGOS_MA_ART_HTTP :',ok,'/',rows.length,'réponses valides ;',failures.length,'échec(s)');
for(const issue of failures.slice(0,30))console.error('LOGO_ABSENT',issue);
if(failures.length)process.exitCode=1;
