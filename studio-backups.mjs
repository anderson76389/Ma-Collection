/**
 * Sauvegardes locales du Studio Ma-Collection.
 * IndexedDB uniquement : aucun service de compte externe ni secret n'est stocké.
 * Un instantané contient seulement les champs autorisés par validateDraft().
 */
import {validateDraft,uid} from './studio-avance-core.mjs';

export const BACKUP_SCHEMA=1;
export const BACKUP_LIMIT=8;
const DB_NAME='ma_collection_studio_history_v1';
const STORE='snapshots';

export function makeStudioBackup(draft,catalogue,kind='manual',now=new Date()){
  const profile=validateDraft(draft,catalogue);
  if(!['manual','before-apply'].includes(kind))throw Error('Type de sauvegarde incompatible');
  const instant=now instanceof Date?now:new Date(now);
  if(!Number.isFinite(instant.getTime()))throw Error('Date de sauvegarde incorrecte');
  return {
    schema:BACKUP_SCHEMA,
    id:'backup-'+uid(),
    kind,
    name:profile.name,
    createdAt:instant.toISOString(),
    profile
  };
}

export function recentStudioBackups(entries,limit=BACKUP_LIMIT){
  const max=Number.isFinite(limit)?Math.max(0,Math.min(30,Math.trunc(limit))):BACKUP_LIMIT;
  return (Array.isArray(entries)?entries:[])
    .filter(e=>e?.schema===BACKUP_SCHEMA && typeof e.id==='string' && e.profile?.schema===1)
    .sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id))
    .slice(0,max);
}

export function createStudioBackupStore(factory=globalThis.indexedDB){
  async function transaction(mode,operation){
    if(!factory)throw Error('Sauvegardes persistantes non disponibles dans ce navigateur.');
    const db=await new Promise((resolve,reject)=>{
      const request=factory.open(DB_NAME,1);
      request.onupgradeneeded=()=>{
        if(!request.result.objectStoreNames.contains(STORE)){
          request.result.createObjectStore(STORE,{keyPath:'id'});
        }
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||Error('Ouverture du stockage impossible.'));
      request.onblocked=()=>reject(Error('Stockage verrouillé dans un autre onglet.'));
    });
    return new Promise((resolve,reject)=>{
      let result,ended=false;
      const end=(error,value)=>{
        if(ended)return;ended=true;db.close();
        if(error)reject(error);else resolve(value);
      };
      let tx;
      try{
        tx=db.transaction(STORE,mode);
        tx.oncomplete=()=>end(null,result);
        tx.onerror=()=>end(tx.error||Error('Stockage inaccessible.'));
        tx.onabort=()=>end(tx.error||Error('Opération annulée.'));
        operation(tx.objectStore(STORE),value=>{result=value;});
      }catch(error){end(error);}
    });
  }

  return {
    async list(){
      const rows=await transaction('readonly',(store,set)=>{
        const req=store.getAll();
        req.onsuccess=()=>set(req.result||[]);
      });
      return recentStudioBackups(rows);
    },
    async save(entry){
      if(entry?.schema!==BACKUP_SCHEMA||typeof entry.id!=='string'||
         !entry.id.startsWith('backup-mc-')||!entry.profile?.sections){
        throw Error('Sauvegarde refusée : format invalide.');
      }
      await transaction('readwrite',store=>{
        const request=store.getAll();
        request.onsuccess=()=>{
          const existing=(request.result||[]).filter(x=>x.id!==entry.id);
          const keep=recentStudioBackups([...existing,entry],BACKUP_LIMIT);
          const ids=new Set(keep.map(x=>x.id));
          for(const old of existing)if(!ids.has(old.id))store.delete(old.id);
          store.put(entry);
        };
      });
      return entry.id;
    },
    async remove(id){
      if(typeof id!=='string'||!id.startsWith('backup-mc-'))throw Error('Identifiant de sauvegarde invalide.');
      await transaction('readwrite',store=>{store.delete(id);});
    }
  };
}
