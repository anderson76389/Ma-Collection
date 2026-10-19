#!/usr/bin/env node
/**
 * Migration sûre TMDB V4 : listes de tiers -> listes du compte autorisé.
 * Jamais de token dans un fichier, une URL, un log ou un commit.
 * plan / copy / verify / publish ; publish prépare une PR, pas une publication directe.
 */
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STORE = join(ROOT, 'data', 'tmdb-own-lists', 'mapping.json');
const API = 'https://api.themoviedb.org/4';
const COLLECTIONS = [
  'actors','anime','awards','based_on','by_decade','discover','documentaries',
  'film_collections','for_you_trending_new','genres','international_cinema',
  'kids_and_family','legendary_directors','moods_vibes','networks','reality_tv',
  'spotlight','streaming_services','studios','trending_new'
];
const args = process.argv.slice(2);
const mode = args.find(x => ['plan','copy','verify','publish'].includes(x.replace(/^--/,'')))?.replace(/^--/,'') || 'plan';
const opt = (name, fallback) => {
  const a = args.find(x => x.startsWith('--'+name+'='));
  return a ? a.slice(name.length+3) : fallback;
};
const scope = opt('scope', 'all');
const limit = Number(opt('limit', '2'));
if (!['all','people'].includes(scope)) throw new Error('scope doit être all ou people');
if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('limit entre 1 et 10');
const token = (process.env.TMDB_V4_USER_ACCESS_TOKEN || '').trim();
const delay = ms => new Promise(r => setTimeout(r,ms));
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const positive = n => Number.isSafeInteger(n) && n > 0;
const validMedia = o => o && ['movie','tv'].includes(o.media_type) && positive(o.media_id);
const label = o => o.media_type + ':' + o.media_id;

export async function readCollections() {
  const contents = new Map();
  for (const name of COLLECTIONS)
    contents.set(name, JSON.parse(await readFile(join(ROOT,'collections',name+'.json'),'utf8')));
  return contents;
}
export function inventory(contents, select = 'all') {
  const lookup = new Map();
  let references = 0;
  for (const [file, data] of contents) {
    if (select === 'people' && !['actors','legendary_directors'].includes(file)) continue;
    for (const group of data) for (const folder of group.folders || [])
      for (const source of folder.sources || []) {
        if (source.provider !== 'tmdb' || source.tmdbSourceType !== 'LIST') continue;
        const id = Number(source.tmdbId);
        if (!positive(id)) throw Error('ID TMDB incorrect dans '+file+'/'+folder.title);
        if (!lookup.has(id)) lookup.set(id,{oldId:id,name:String(folder.title || 'Collection').trim(),usages:[]});
        lookup.get(id).usages.push({file,folder:String(folder.title),source:String(source.title)});
        references++;
      }
  }
  const lists = [...lookup.values()];
  lists.sort((a,b) => {
    const weight = o => o.usages.some(u => ['actors','legendary_directors'].includes(u.file)) ? 0 : 1;
    return weight(a)-weight(b) || a.oldId-b.oldId;
  });
  return {lists,references};
}
export function itemKeys(response) {
  if (!Array.isArray(response)) throw Error('Résultats TMDB invalides');
  const keys = response.map(x => ({media_type:x.media_type,media_id:x.id}));
  if (!keys.every(validMedia)) throw Error('ID ou type de média invalide');
  const unique = new Set(keys.map(label));
  if (unique.size !== keys.length) throw Error('Doublon inattendu dans une liste TMDB');
  return keys;
}
export function equalItems(a,b) {
  return a.length === b.length && a.every((x,i) => label(x) === label(b[i]));
}
export function replaceListIds(contents, mapping, selection='all') {
  const output=new Map();
  let changes=0;
  for (const [file,data] of contents) {
    const cloned=structuredClone(data);
    if (selection==='people' && !['actors','legendary_directors'].includes(file)) {
      output.set(file,cloned);
      continue;
    }
    for (const category of cloned) for (const folder of category.folders||[])
      for (const source of folder.sources||[]) {
        if (source.provider!=='tmdb'||source.tmdbSourceType!=='LIST') continue;
        const old=String(source.tmdbId);
        const row=mapping[old];
        if (!row || row.state!=='verified' || !positive(row.targetId) || row.targetPublic!==true)
          throw Error('Copie personnelle non certifiée pour la liste '+old);
        source.tmdbId=row.targetId;
        changes++;
      }
    output.set(file,cloned);
  }
  return {output,changes};
}
async function saveMap(map) {
  await mkdir(dirname(STORE),{recursive:true});
  const temp=STORE+'.tmp';
  await writeFile(temp,JSON.stringify(map,null,2)+'\n','utf8');
  await rename(temp,STORE);
}
async function loadMap() {
  try { const m=JSON.parse(await readFile(STORE,'utf8')); if(m.schema!==1||!m.lists)throw Error('Mapping incompatible');return m; }
  catch(e) { if(e.code==='ENOENT')return {schema:1,lists:{}};throw e; }
}
async function request(method,path,body) {
  if (!token) throw Error('Secret TMDB_V4_USER_ACCESS_TOKEN absent. Aucune liste créée.');
  const url=API+path;
  let last;
  for(let attempt=0;attempt<5;attempt++) {
    try {
      const res=await fetch(url,{
        method,
        headers:{'Authorization':'Bearer '+token,'Accept':'application/json','Content-Type':'application/json'},
        body:body===undefined?undefined:JSON.stringify(body),
        signal:AbortSignal.timeout(30000)
      });
      const data=await res.json().catch(()=>({}));
      if (res.status===429 || res.status>=500) {
        const after=Math.min(60,Math.max(2,Number(res.headers.get('retry-after'))||2**attempt));
        console.error('TMDB temporairement indisponible ('+res.status+'), nouvelle tentative.');
        await delay(after*1000);continue;
      }
      if(res.status===401 && Number(data.status_code)===36) {
        throw Error("TMDB 401 (36): le jeton GitHub est reconnu mais n'a PAS le droit d'écriture. Réautorisez Ma-Collection sur TMDB avec l'accès lecture ET écriture, puis remplacez le secret TMDB_V4_USER_ACCESS_TOKEN. Aucun catalogue n'a été modifié.");
      }
      if(!res.ok||data.success===false) throw Error('TMDB '+res.status+' ('+(data.status_code||'')+'): '+String(data.status_message||data.errors?.join('; ')||'appel rejeté').slice(0,140));
      return data;
    } catch(e) {
      last=e;
      if (/TMDB \d+/.test(e.message))throw e;
      if(attempt===4)break;
      await delay(1000*(attempt+1));
    }
  }
  throw last || Error('TMDB ne répond pas');
}
async function fetchItems(id) {
  const media=[];
  let meta=null;
  let totalPages=1;
  for (let page=1;page<=totalPages;page++) {
    const data=await request('GET','/list/'+id+'?page='+page+'&sort_by=original_order.asc');
    if(page===1) {
      meta=data;
      totalPages=Number(data.total_pages||1);
      if(!Number.isInteger(totalPages)||totalPages<1||totalPages>500)throw Error('Pagination excessive/invalide : '+id);
    }
    if(!Array.isArray(data.results))throw Error('Résultats absents dans '+id+'/'+page);
    media.push(...data.results);
  }
  const keys=itemKeys(media);
  const count=Number(meta.total_results ?? meta.item_count ?? keys.length);
  if(count!==keys.length)throw Error('Page manquante sur liste '+id+': '+keys.length+'/'+count);
  return {meta,items:keys};
}
async function verifyRow(row) {
  const target=await fetchItems(row.targetId);
  const digest=sha(target.items);
  if(target.items.length!==row.itemCount || digest!==row.sourceHash)
    throw Error('Contenu ou ordre différent pour '+row.oldId+' -> '+row.targetId);
  if(target.meta.public!==true && target.meta.public!==1)
    throw Error('Liste personnelle privée (inaccessible à Kovelyx) : '+row.targetId);
  return true;
}
async function cloneOne(desc,map) {
  const id=String(desc.oldId);
  const original=await fetchItems(desc.oldId);
  const digest=sha(original.items);
  let row=map.lists[id];
  if (row && row.sourceHash!==digest)
    throw Error('La liste originale a changé depuis le début de sa copie : '+id+'. Réconciliation manuelle nécessaire.');
  if(!row) {
    const name=('Ma-Collection · '+desc.name).slice(0,95);
    // TMDB accepte l'entier 1 pour une liste publique. Ne pas utiliser false/true sur create.
    const result=await request('POST','/list',{
      name,iso_639_1:'fr',iso_3166_1:'FR',public:1,sort_by:'original_order.asc',
      description:'Copie personnelle des contenus de la liste '+id+' pour Ma-Collection'
    });
    const newId=Number(result.id);
    if (!positive(newId))throw Error('TMDB n’a pas retourné de nouvel ID pour '+id);
    row={oldId:desc.oldId,targetId:newId,name,itemCount:original.items.length,
      sourceHash:digest,targetPublic:false,state:'created',createdAt:new Date().toISOString()};
    map.lists[id]=row;
    await saveMap(map);
    console.log('Liste créée '+id+' -> '+newId+' (contenu en cours de validation)');
  }
  const existing=(await fetchItems(row.targetId)).items;
  const existSet=new Set(existing.map(label));
  const missing=original.items.filter(x=>!existSet.has(label(x)));
  for(let i=0;i<missing.length;i+=25) {
    const batch=missing.slice(i,i+25);
    const response=await request('POST','/list/'+row.targetId+'/items',{items:batch});
    if (Array.isArray(response.results) && response.results.some(x=>x.success===false)) {
      // Une réponse partielle nécessite une relecture stricte, jamais un succès supposé.
      console.error('Ajout partiel signalé pour la liste '+row.targetId);
    }
    await delay(350);
  }
  await verifyRow({...row,targetPublic:true});
  row.targetPublic=true;
  row.state='verified';
  row.verifiedAt=new Date().toISOString();
  await saveMap(map);
  console.log('Copie validée '+id+' -> '+row.targetId+' : '+row.itemCount+' éléments.');
}
async function main() {
  const contents=await readCollections();
  const {lists,references}=inventory(contents,scope);
  console.log('Périmètre : '+scope+' ; '+lists.length+' listes distinctes ; '+references+' références.');
  if(mode==='plan') {
    const map=await loadMap();
    const done=lists.filter(x=>map.lists[String(x.oldId)]?.state==='verified').length;
    console.log('Listes validées : '+done+'/'+lists.length+'. Aucune écriture.');
    console.log(JSON.stringify({lists:lists.map(x=>({id:x.oldId,name:x.name,usages:x.usages.length,files:[...new Set(x.usages.map(y=>y.file))]}))},null,2));
    return;
  }
  if (!token) throw Error('Ajouter TMDB_V4_USER_ACCESS_TOKEN aux secrets GitHub Actions avant '+mode+'.');
  const map=await loadMap();
  if(mode==='copy') {
    let copied=0;
    for(const entry of lists) {
      if(map.lists[String(entry.oldId)]?.state==='verified')continue;
      if(copied>=limit)break;
      await cloneOne(entry,map);
      copied++;
      await delay(1500);
    }
    console.log('Ce lot : '+copied+' liste(s). Copies validées : '+lists.filter(x=>map.lists[String(x.oldId)]?.state==='verified').length+'/'+lists.length+'.');
    return;
  }
  const unfinished=lists.filter(x=>map.lists[String(x.oldId)]?.state!=='verified');
  if(unfinished.length)throw Error('Migration incomplète : '+unfinished.length+' listes restent à copier. Aucune publication.');
  for(const list of lists) {
    await verifyRow(map.lists[String(list.oldId)]);
    await delay(120);
  }
  console.log('Vérification réseau OK pour les '+lists.length+' listes du compte personnel.');
  if(mode==='verify')return;
  if(mode!=='publish')throw Error('Mode inconnu : '+mode);
  const {output,changes}=replaceListIds(contents,map.lists,scope);
  if(changes!==references)throw Error('Nombre de remplacements incohérent. Rien n’est publié.');
  const changedFiles=[...output].filter(([file])=> scope==='all'||['actors','legendary_directors'].includes(file));
  // Tous les fichiers sont vérifiés en mémoire avant d’écrire quoi que ce soit.
  for(const [file,data] of changedFiles) {
    const before=contents.get(file);
    const altered=structuredClone(data);
    const untouched=structuredClone(before);
    const strip=o=>{
      if(Array.isArray(o)){o.forEach(strip);return;}
      if(o&&typeof o==='object'){
        if(o.provider==='tmdb'&&o.tmdbSourceType==='LIST')o.tmdbId=0;
        Object.values(o).forEach(strip);
      }
    };
    strip(untouched);strip(altered);
    if(JSON.stringify(untouched)!==JSON.stringify(altered))
      throw Error('Données autres que les IDs altérées dans '+file);
  }
  for(const [file,data] of changedFiles)
    await writeFile(join(ROOT,'collections',file+'.json'),JSON.stringify(data,null,2)+'\n','utf8');
  console.log('PRÊT POUR PR : '+changes+' références remplacées dans '+changedFiles.length+' fichiers. Pas de publication automatique.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(e=>{console.error('ERREUR MIGRATION : '+e.message);process.exitCode=1;});
