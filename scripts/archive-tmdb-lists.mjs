/** Read-only copies of PUBLIC list contents. Never creates or edits a TMDB list. */
import {readCollections,inventory,itemKeys} from './tmdb-own-lists.mjs';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const STORE=join(ROOT,'data/catalogue-archives/tmdb');
const hash=items=>createHash('sha256').update(JSON.stringify(items)).digest('hex');
const delay=ms=>new Promise(r=>setTimeout(r,ms));

export async function snapshotPublicList(id,get) {
  if(!Number.isSafeInteger(id)||id<=0)throw Error('ID de liste invalide');
  let totalPages=1,expected=0;
  const results=[];
  for(let page=1;page<=totalPages;page++) {
    const data=await get(`/list/${id}?page=${page}&sort_by=original_order.asc`);
    if(data.public!==true&&data.public!==1)throw Error('Liste privée ou visibilité non confirmée : aucune publication');
    const pages=Number(data.total_pages||1),count=Number(data.total_results??data.item_count);
    if(!Number.isSafeInteger(pages)||pages<1||pages>500||!Number.isSafeInteger(count)||count<0)throw Error('Pagination invalide');
    if(page===1){totalPages=pages;expected=count;}
    else if(pages!==totalPages||count!==expected)throw Error('Liste modifiée pendant la pagination');
    if(Number(data.page??page)!==page||!Array.isArray(data.results))throw Error('Page absente');
    results.push(...data.results);
  }
  const items=itemKeys(results);
  if(items.length!==expected)throw Error('Contenu tronqué : instantané refusé');
  return {schema:1,original_list_id:id,public:true,items,sha256:hash(items)};
}

async function main() {
  const lists=inventory(await readCollections()).lists;
  const token=(process.env.TMDB_V4_USER_ACCESS_TOKEN||'').trim();
  if(!token)throw Error('Jeton de lecture TMDB absent ; aucune liste ou collection modifiée');
  await mkdir(STORE,{recursive:true});
  async function get(path) {
    for(let attempt=0;attempt<5;attempt++) {
      const response=await fetch('https://api.themoviedb.org/4'+path,{method:'GET',redirect:'error',
        headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(30000)});
      if(response.status===429||response.status>=500){await delay(Math.min(60,Math.max(2,Number(response.headers.get('retry-after'))||2**attempt))*1000);continue;}
      if(!response.ok)throw Error('TMDB HTTP '+response.status);
      return response.json();
    }
    throw Error('TMDB temporairement indisponible');
  }
  const failures=[];let archived=0,changed=0;
  // Sequential requests respect API capacity and never reveal the bearer token.
  for(const list of lists) {
    try {
      const snapshot=await snapshotPublicList(list.oldId,get);
      const file=join(STORE,list.oldId+'.json');
      const previous=await readFile(file,'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
      if(previous?.sha256!==snapshot.sha256) {
        snapshot.captured_at=new Date().toISOString();
        await writeFile(file+'.tmp',JSON.stringify(snapshot)+'\n');
        await rename(file+'.tmp',file);changed++;
      }
      archived++;
    } catch(error) { failures.push({list_id:list.oldId,reason:String(error.message).slice(0,180)}); }
    await delay(150);
  }
  const status={schema:1,checked_at:new Date().toISOString(),expected:lists.length,verified_current:archived,changed,failures,
    limitation:'Instantanés des listes TMDB publiques uniquement ; les collections actives et les listes Trakt restent inchangées.'};
  await writeFile(join(STORE,'status.json'),JSON.stringify(status,null,2)+'\n');
  console.log(`Archives publiques TMDB vérifiées : ${archived}/${lists.length} ; fichiers actualisés : ${changed}.`);
  if(failures.length)throw Error(`${failures.length} listes indisponibles ou non publiables ; anciennes copies préservées, aucune collection remplacée.`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error('ARCHIVAGE INCOMPLET : '+error.message);process.exitCode=1;});
