/**
 * Même API de secours et mêmes validations que worker.mjs, mais sans
 * binding Cloudflare Static Assets ni assets-upload-session.
 */
import originalWorker from './worker.mjs';
import {INLINE_ARCHIVES} from './dist/archive-inline.mjs';

const has=Object.prototype.hasOwnProperty;
const localAssets=Object.freeze({
  async fetch(request){
    const path=new URL(request.url).pathname;
    if(!has.call(INLINE_ARCHIVES,path))
      return new Response('Not found',{status:404});
    return new Response(INLINE_ARCHIVES[path],{
      status:200,headers:{'Content-Type':'application/json; charset=utf-8'}
    });
  }
});

export default {
  fetch(request,env,ctx){
    // Aucun appel réseau : ASSETS est une simple lecture des données
    // incluses dans le bundle, et ne peut être appelé de l'extérieur.
    return originalWorker.fetch(request,{...env,ASSETS:localAssets},ctx);
  }
};
