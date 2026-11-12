#!/usr/bin/env node
/**
 * Compile les archives TMDB vérifiées dans un module JavaScript autonome.
 * Pas de Static Assets, R2, KV, D1, secret ni appel réseau à l'exécution.
 * Les listes gardent leurs identifiants, leur ordre et leur SHA-256 d'origine.
 */
import {createHash} from 'node:crypto';
import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULT_ASSETS,prepareAssets} from './prepare-assets.mjs';

export const INLINE_ENTRY=join(dirname(fileURLToPath(import.meta.url)),'dist','archive-inline.mjs');

export async function prepareInline(output=INLINE_ENTRY){
  const manifest=await prepareAssets();
  if(manifest.lists.length!==261||manifest.missing.length!==1||
      manifest.coverage.tmdb_unique!==262)
    throw Error('Inventaire de secours inattendu : publication refusée');
  const files=Object.create(null);
  const root=join(DEFAULT_ASSETS,'_mc_data');
  const manifestText=await readFile(join(root,'manifest.json'),'utf8');
  if(JSON.stringify(JSON.parse(manifestText))!==JSON.stringify(manifest))
    throw Error('Le manifeste généré ne correspond pas aux archives validées');
  files['/_mc_data/manifest.json']=manifestText;
  for(const row of manifest.lists){
    const file=await readFile(join(root,'lists',String(row.list_id)+'.json'),'utf8');
    const body=JSON.parse(file);
    if(body.list_id!==row.list_id||body.sha256!==row.sha256||
        !Array.isArray(body.items)||body.items.length!==row.media_count)
      throw Error('Archive non cohérente : '+row.list_id);
    const hash=createHash('sha256').update(JSON.stringify(body.items)).digest('hex');
    if(hash!==row.sha256)throw Error('Archive corrompue : '+row.list_id);
    files['/_mc_data/lists/'+row.list_id+'.json']=file;
  }
  if(Object.keys(files).length!==manifest.lists.length+1)
    throw Error('Fichiers du module incomplets');
  // JSON.stringify garantit qu'aucun titre de catalogue ne devient du code.
  const source='// Données générées exclusivement à partir des archives Git validées.\n'
    +'export const INLINE_ARCHIVES=Object.freeze('+JSON.stringify(files)+');\n';
  const bytes=Buffer.byteLength(source,'utf8');
  if(bytes>8*1024*1024)
    throw Error('Module trop volumineux pour le budget de sécurité de 8 Mio');
  const destination=resolve(output);
  await mkdir(dirname(destination),{recursive:true});
  const temporary=destination+'.tmp';
  try{
    await writeFile(temporary,source,'utf8');
    await rename(temporary,destination);
  }finally{
    await rm(temporary,{force:true});
  }
  return {files:Object.keys(files).length,lists:manifest.lists.length,
    missing:manifest.missing.map(x=>x.list_id),bytes};
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  prepareInline().then(result=>console.log('CLOUDFLARE_INLINE_ARCHIVES_VERIFIED '+JSON.stringify(result)))
    .catch(error=>{
      console.error('CLOUDFLARE_INLINE_REFUSED : '+error.message);
      process.exitCode=1;
    });
}
