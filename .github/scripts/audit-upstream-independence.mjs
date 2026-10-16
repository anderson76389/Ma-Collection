#!/usr/bin/env node
// Audit non destructif : aucune clé, aucun accès réseau, aucune modification de catalogue.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const rootDir=resolve(root,'collections');
const names=['actors','anime','awards','based_on','by_decade','discover','documentaries','film_collections','for_you_trending_new','genres','international_cinema','kids_and_family','legendary_directors','moods_vibes','networks','reality_tv','spotlight','streaming_services','studios','trending_new'];
const visualFields=new Set(['coverImageUrl','heroBackdropUrl','titleLogoUrl','focusGifUrl','backdropImageUrl']);
const allowHost='ma-art.mailpromahe.workers.dev';
const external=[], sourceCounts={tmdb_lists:0,trakt:0,addons:0,other:0}, distinct=new Set();
let mediaCount=0,ownMediaCount=0,folderCount=0,sourceCount=0;
for(const name of names) {
 const file='collections/'+name+'.json';
 const data=JSON.parse(readFileSync(resolve(root,file),'utf8'));
 function walk(obj,parents=[]) {
  if(Array.isArray(obj)){obj.forEach((x,i)=>walk(x,[...parents,i]));return;}
  if(!obj || typeof obj!=='object') return;
  for(const [k,v] of Object.entries(obj)){
   if(visualFields.has(k) && typeof v==='string' && v.trim()){
    mediaCount++;
    try {
     const parsed=new URL(v);
     if(parsed.protocol!=='https:') throw new Error('HTTPS attendu');
     if(parsed.hostname===allowHost){ownMediaCount++;distinct.add(parsed.href);}
     else external.push({file,path:[...parents,k].join('.'),host:parsed.hostname,url:v});
    } catch { external.push({file,path:[...parents,k].join('.'),host:'URL_INVALIDE',url:v}); }
   }
   if(k==='folders'&&Array.isArray(v))folderCount+=v.length;
   if(k==='sources'&&Array.isArray(v))for(const src of v){
    sourceCount++;
    const provider=String(src?.provider||'').toLowerCase(),type=String(src?.tmdbSourceType||'').toUpperCase();
    if(provider==='trakt')sourceCounts.trakt++;
    else if(provider==='addon')sourceCounts.addons++;
    else if(provider==='tmdb'&&type==='LIST')sourceCounts.tmdb_lists++;
    else sourceCounts.other++;
   }
   walk(v,[...parents,k]);
  }
 }
 walk(data);
}
const files=['index.html','app.js','wizard.js','import-studio.js','destination-picker.js'];
const obsolete=[];
const patterns=[/https?:\/\/[^\s\"'<>]*imkaptain[^\s\"'<>]*/gi,/api\.nuvio\.tv/gi,/NuvioPush/gi,/bingecat\.com\/integrations\/kaptain/gi];
for(const file of files){try{const s=readFileSync(resolve(root,file),'utf8');for(const p of patterns){for(const m of s.matchAll(p))obsolete.push({file,match:m[0].slice(0,180)});}}catch{}}
const kaptainMedia=external.filter(x=>/imkaptain|kaptain/i.test(x.host));
const report={date:new Date().toISOString(),collections:names.length,folders:folderCount,sources:sourceCount,sourceCounts,visuals:{total:mediaCount,own:ownMediaCount,uniqueOwnUrls:distinct.size,externalCount:external.length,external},obsolete,verdict:{upstreamKaptainMedia:kaptainMedia.length,obsoleteIntegration:obsolete.length,fullyIndependent:external.length===0 && obsolete.length===0 && sourceCounts.trakt===0 && sourceCounts.tmdb_lists===0 && sourceCounts.addons===0}};
console.log(JSON.stringify(report,null,2));
console.error('AUDIT: '+names.length+' collections, '+mediaCount+' URLs médias, '+external.length+' externes, '+obsolete.length+' intégrations anciennes.');
if(kaptainMedia.length) { console.error('BLOCAGE : médias encore chargés depuis un domaine Kaptain'); process.exitCode=1; }
if(obsolete.length) console.error('AVERTISSEMENT : références historiques ou intégrations à examiner dans le rapport, sans suppression automatique.');
