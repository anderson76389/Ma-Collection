#!/usr/bin/env node
/**
 * Vérifie le routage workers.dev du seul Worker ma-collection.
 * Une écriture Cloudflare n'est faite que si la route est désactivée.
 * Les secrets ne sont jamais affichés ni envoyés à une autre origine.
 */
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const WORKER_NAME='ma-collection';
export async function ensureWorkersDev({account,token,fetcher=fetch}){
  if(!/^[0-9a-f]{32}$/i.test(account||''))throw Error('Account ID Cloudflare absent ou invalide');
  if(!token)throw Error('API token Cloudflare absent');
  const url='https://api.cloudflare.com/client/v4/accounts/'+account+
    '/workers/scripts/'+WORKER_NAME+'/subdomain';
  const headers={Authorization:'Bearer '+token,Accept:'application/json'};
  async function query(method,body){
    const response=await fetcher(url,{
      method,headers:body?{...headers,'Content-Type':'application/json'}:headers,
      ...(body?{body:JSON.stringify(body)}:{}),
      signal:AbortSignal.timeout(15000)
    });
    const result=await response.json().catch(()=>null);
    if(!response.ok||result?.success!==true)
      throw Error('Cloudflare refused '+method+' workers.dev configuration (HTTP '+response.status+')');
    if(typeof result.result?.enabled!=='boolean')
      throw Error('Cloudflare workers.dev response has no enabled state');
    return result.result;
  }
  const initial=await query('GET');
  if(initial.enabled)return {worker:WORKER_NAME,enabled:true,changed:false};
  await query('POST',{enabled:true,previews_enabled:false});
  const after=await query('GET');
  if(!after.enabled)throw Error('workers.dev route still disabled after activation');
  return {worker:WORKER_NAME,enabled:true,changed:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  ensureWorkersDev({
    account:process.env.CLOUDFLARE_ACCOUNT_ID,
    token:process.env.CLOUDFLARE_API_TOKEN
  }).then(result=>console.log('WORKERS_DEV_ROUTE_VERIFIED '+JSON.stringify(result)))
    .catch(error=>{
      console.error('WORKERS_DEV_ROUTE_NOT_VERIFIED : '+error.message);
      process.exitCode=1;
    });
}
