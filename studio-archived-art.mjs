// Index-only library; no original upstream URLs or private file bytes.
export const ART_HOSTS=Object.freeze([
  'https://ma-art-images-static.mailpromahe.workers.dev/',
  'https://ma-art.mailpromahe.workers.dev/'
]);
const kinds=new Set(['cover','backdrop','logo','animation']);
const pathPattern=/^media\/[a-z0-9.-]+\/[a-f0-9]{24}\.(?:png|jpe?g|webp|avif|gif|gifv|mp4|webm|svg)$/i;
export const artKey=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const aliases={
 aventure:'adventure',comedie:'comedy',crime:'crime',documentaire:'documentary',
 drame:'drama',famille:'family',fantastique:'fantasy',horreur:'horror',
 histoire:'history',mystere:'mystery',romance:'romance','science fiction':'science fiction',
 western:'western',guerre:'war',musique:'music','cinema francais':'french cinema',
 'cinema japonais':'japanese cinema','cinema coreen':'korean cinema',
 'cinema chinois':'chinese cinema','cinema italien':'italian cinema',
 'nouveaux films':'new movies','nouvelles series':'new series','films tendance':'trending movies',
 'series tendance':'trending tv','pour vous':'for you','meilleurs films':'top movies',
 'meilleures series':'top series',animation:'animation',animes:'anime'
};
export function archivedChoices(inventory,folder,baseline={},kind='cover'){
  const list=(Array.isArray(inventory)?inventory:[]).filter(x=>x&&pathPattern.test(x.path)&&kinds.has(x.kind));
  const keys=new Set();
  for(const title of [folder?.label,folder?.title,baseline?.title]){
    const key=artKey(title);
    if(key){keys.add(key);if(aliases[key])keys.add(aliases[key]);}
  }
  // Match the source's archived path as well as its translated name.
  const paths=new Set();
  for(const val of [...Object.values(folder?.artwork||{}),...Object.values(baseline||{})]){
    if(typeof val!=='string')continue;
    try{const u=new URL(val);const p=u.pathname.replace(/^\/+/,'');if(pathPattern.test(p))paths.add(p);}catch{}
  }
  for(const item of list)if(paths.has(item.path)&&item.key)keys.add(item.key);
  return list.filter(x=>x.kind===kind&&keys.has(x.key)).sort((a,b)=>a.label.localeCompare(b.label,'fr'));
}
export function archivedUrl(path,host=0){
  return pathPattern.test(path)&&ART_HOSTS[host]?ART_HOSTS[host]+path:'';
}
export function isArchivedSelection(url,path){
  return ART_HOSTS.some((_,i)=>archivedUrl(path,i)===url);
}
export function isMotionVideo(path){return /\.(?:mp4|webm|gifv)$/i.test(path);}
