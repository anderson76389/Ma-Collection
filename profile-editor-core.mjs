/** Editor of complete Kovelyx collection documents, independent of the site catalogue. */
import {isKaptainUrl} from './scripts/kaptain-url-policy.mjs';
import {assetUrl} from './studio-avance-core.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const secret=/^(?:password|passphrase|access_?token|refresh_?token|authorization|api_?key|client_?secret|email)$/i;
export const profileSources=f=>Array.isArray(f.sources)&&f.sources.length?f.sources:(f.catalogSources||[]).map(s=>({...s,provider:'addon'}));
export function validateProfile(input,{exporting=false}={}){
 if(!Array.isArray(input)||input.length>100)throw Error('Format de collection incompatible (100 sections maximum).');
 let folders=0;const ids=new Set();
 function inspect(x,depth=0){
  if(depth>30)throw Error('Structure trop profonde.');
  if(typeof x==='string'&&exporting&&isKaptainUrl(x))throw Error('Des liens Kaptain restent présents. Corrige-les avant l’export.');
  if(Array.isArray(x)){x.forEach(v=>inspect(v,depth+1));return;}
  if(!object(x))return;
  for(const [key,value]of Object.entries(x)){if(secret.test(key))throw Error('Le fichier contient un champ privé : '+key);inspect(value,depth+1);}
 }
 inspect(input);
 for(const c of input){
  if(!object(c)||typeof c.id!=='string'||!c.id.trim()||ids.has(c.id)||typeof c.title!=='string'||!c.title.trim()||!Array.isArray(c.folders))throw Error('Section invalide ou identifiant dupliqué.');
  ids.add(c.id);const used=new Set();
  for(const f of c.folders){
   if(!object(f)||typeof f.id!=='string'||!f.id.trim()||used.has(f.id)||typeof f.title!=='string'||!f.title.trim())throw Error('Dossier invalide ou identifiant dupliqué.');
   used.add(f.id);if(++folders>10000)throw Error('Trop de dossiers.');
   const sources=profileSources(f);if(exporting&&!sources.length)throw Error('Le dossier « '+f.title+' » ne contient aucune source.');
   if(exporting)for(const s of sources){
    const provider=String(s.provider||'addon').toLowerCase();
    if(provider==='tmdb'&&!s.tmdbSourceType)throw Error('Source TMDB incomplète.');
    if(provider==='trakt'&&(!Number.isSafeInteger(s.traktListId)||s.traktListId<1))throw Error('Liste Trakt invalide.');
    if(!['tmdb','trakt'].includes(provider)&&(!s.addonId||!s.type||!s.catalogId))throw Error('Source d’extension incomplète.');
   }
  }
 }
 return clone(input);
}
export function profileSummary(input){
 let folders=0,sources=0,kaptainLinks=0;
 function inspect(x){if(typeof x==='string'&&isKaptainUrl(x))kaptainLinks++;else if(Array.isArray(x))x.forEach(inspect);else if(object(x))Object.values(x).forEach(inspect);}
 inspect(input);for(const c of input){folders+=c.folders.length;for(const f of c.folders)sources+=profileSources(f).length;}
 return {sections:input.length,folders,sources,kaptainLinks};
}
export class ProfileEditor {
 constructor(collections=[]){this.rows=validateProfile(collections);this.baseline=clone(this.rows);this.history=[];}
 edit(change){const next=clone(this.rows);change(next);validateProfile(next);this.history.push(this.rows);if(this.history.length>12)this.history.shift();this.rows=next;return this.rows;}
 undo(){if(this.history.length)this.rows=this.history.pop();return this.rows;}
 reset(){return this.edit(rows=>rows.splice(0,rows.length,...clone(this.baseline)));}
 section(id){return this.rows.find(c=>c.id===id);}
 folder(cid,fid){return this.section(cid)?.folders.find(f=>f.id===fid);}
 updateSection(id,patch){return this.edit(rows=>{const c=rows.find(c=>c.id===id);if(!c)throw Error('Section introuvable.');Object.assign(c,patch,{id:c.id});});}
 updateFolder(cid,fid,patch){return this.edit(rows=>{const f=rows.find(c=>c.id===cid)?.folders.find(f=>f.id===fid);if(!f)throw Error('Dossier introuvable.');Object.assign(f,patch,{id:f.id});});}
 moveSection(id,delta){return this.edit(rows=>{const a=rows.findIndex(c=>c.id===id),b=a+delta;if(a<0||b<0||b>=rows.length)return;[rows[a],rows[b]]=[rows[b],rows[a]];});}
 moveFolder(cid,fid,targetId,index){return this.edit(rows=>{
  const source=rows.find(c=>c.id===cid),target=rows.find(c=>c.id===targetId);if(!source||!target)throw Error('Section introuvable.');
  const pos=source.folders.findIndex(f=>f.id===fid);if(pos<0)throw Error('Dossier introuvable.');
  if(source!==target&&target.folders.some(f=>f.id===fid))throw Error('Ce dossier existe déjà dans la section cible.');
  const [folder]=source.folders.splice(pos,1);target.folders.splice(Math.max(0,Math.min(index,target.folders.length)),0,folder);
 });}
 addSection(title){const id='mc-section-'+crypto.randomUUID();this.edit(rows=>rows.push({id,title,folders:[],viewMode:'TABBED_GRID',showAllTab:true}));return id;}
 addFolder(cid,folder){return this.edit(rows=>{const c=rows.find(c=>c.id===cid);if(!c)throw Error('Section introuvable.');if(c.folders.some(f=>f.id===folder.id))throw Error('Ce dossier existe déjà.');c.folders.push(clone(folder));});}
 removeSection(id){return this.edit(rows=>{const i=rows.findIndex(c=>c.id===id);if(i>=0)rows.splice(i,1);});}
 removeFolder(cid,fid){return this.edit(rows=>{const c=rows.find(c=>c.id===cid);if(c)c.folders=c.folders.filter(f=>f.id!==fid);});}
 export(){return validateProfile(this.rows,{exporting:true});}
 changes(){return JSON.stringify(this.rows)!==JSON.stringify(this.baseline);}
}
/** Remove upstream resources only; matching independent images are preferred. */
export function repairUpstreamResources(rows,catalogue){
 const known=new Map(catalogue.flatMap(c=>c.folders.map(f=>[f.id,f])));let replaced=0,removed=0;
 const output=clone(rows);
 for(const c of output){
  for(const [key,val]of Object.entries(c))if(typeof val==='string'&&isKaptainUrl(val)){c[key]='';removed++;}
  for(const f of c.folders){const own=known.get(f.id);
   for(const [key,val]of Object.entries(f))if(typeof val==='string'&&isKaptainUrl(val)){
    const candidate=own?.[key];if(candidate&&!isKaptainUrl(candidate)){f[key]=candidate;replaced++;}else{f[key]='';removed++;}
   }
  }
 }
 return {rows:output,replaced,removed};
}
/** Explicit update proposal: keep existing rows, custom art and unknown fields. */
export function planProfileUpdate(existing,baseline,{updateSources=false}={}){
 const rows=validateProfile(existing),addedSections=[],addedFolders=[],addedSources=[],updatedSources=[];
 const current=new Map(rows.map(c=>[c.id,c]));
 for(const cat of baseline){const prior=current.get(cat.id);
  if(!prior){rows.push(clone(cat));addedSections.push(cat.title);continue;}
  const folders=new Map(prior.folders.map(f=>[f.id,f]));
  for(const folder of cat.folders){const prev=folders.get(folder.id);
   if(!prev){prior.folders.push(clone(folder));addedFolders.push(folder.title);continue;}
   const old=profileSources(prev),next=profileSources(folder);
   // Stable source IDs can update definitions without touching personal artwork.
   const byId=new Map(next.filter(s=>s.id).map(s=>[s.id,s]));
   const beforeUpdates=updatedSources.length, beforeAdditions=addedSources.length;
   const sources=old.map(s=>{const fresh=s.id?byId.get(s.id):null;if(updateSources&&fresh&&JSON.stringify(s)!==JSON.stringify(fresh)){updatedSources.push(folder.title);return clone(fresh);}return s;});
   const selected=new Set(old.map(s=>s.id||JSON.stringify(s)));
   for(const s of next)if(!selected.has(s.id||JSON.stringify(s))){sources.push(clone(s));addedSources.push(folder.title+' · '+(s.title||s.id||s.provider));}
   if(updatedSources.length!==beforeUpdates||addedSources.length!==beforeAdditions){prev.sources=sources;delete prev.catalogSources;}
  }
 }
 return {rows,addedSections,addedFolders,addedSources,updatedSources};
}
export function safeProfileImage(value){try{return assetUrl(value||'');}catch{return '';}}
