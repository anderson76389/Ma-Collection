// Fausse API TMDB utilisée UNIQUEMENT par le test de génération hors ligne.
// Aucun identifiant n'est une donnée réelle, ne pas publier les résultats simulés.
import { readFileSync } from "node:fs";
const folders = JSON.parse(readFileSync("collections/streaming_services.json","utf8"))[0].folders;
const ids = new Set();
for(const folder of folders)for(const source of folder.sources||[]) {
  const filters=source.filters||{};
  for(const id of String(filters.withWatchProviders||filters.with_watch_providers||"")
    .split(/[|,]/).map(Number).filter(x=>Number.isSafeInteger(x)&&x>0)) ids.add(id);
}
for(let i=1;i<=30;i++)ids.add(i);
ids.add(800001);
const providerData=[...ids].map(id=>({
  provider_id:id,provider_name:id===800001?"TF1+":"Plateforme Test "+id,
  display_priorities:{FR:1,US:2}
}));
const results=Array.from({length:12},(_,n)=>({
  id:100+n,name:"Série test "+n,title:"Film test "+n,
  poster_path:"/test.jpg",backdrop_path:"/test-background.jpg",
  first_air_date:"2026-10-10",release_date:"2026-10-10",overview:"Réponse de test"
}));
globalThis.fetch=async input=>{
  const target=new URL(String(input));
  if(target.pathname.endsWith("/watch/providers/movie") ||
     target.pathname.endsWith("/watch/providers/tv"))
    return {ok:true,json:async()=>({results:providerData})};
  if(/^\/3\/tv\/[0-9]+$/.test(target.pathname))
    return {ok:true,json:async()=>({
      id:Number(target.pathname.split("/").at(-1)),
      seasons:[{season_number:1,air_date:"2024-01-01"},
               {season_number:2,air_date:"2026-10-10"}]})};
  if(/^\/3\/(discover\/movie|discover\/tv|movie\/[0-9]+)$/.test(target.pathname))
    return {ok:true,json:async()=>({results,total_pages:20})};
  throw new Error("URL TMDB non simulée : "+target.pathname);
};
