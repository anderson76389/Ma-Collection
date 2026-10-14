import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  CATEGORY_IDS, isRollingSource, numbers, providersFor, normalizeProviderMap,
  discoverParams, recentEpisodeParams, prepareMetas, compareSample, sourceKey
} from "../scripts/catalog-engine-core.mjs";

const streaming = {id:CATEGORY_IDS.streaming,title:"Streaming Services"};
const network = {id:CATEGORY_IDS.networks,title:"Networks"};
function source(title="New Series", type="TV") {
  return {title,provider:"tmdb",tmdbSourceType:"DISCOVER",mediaType:type,
    filters:{withNetworks:"2552",withGenres:"18",
      withWatchProviders:"8|1796",watchRegion:"US",
      releaseDateGte:"2020-01-01"}};
}

test("les catalogues historiques, classements et millésimes explicites restent fixes",()=>{
  assert.equal(isRollingSource(streaming,source("Top 10 Movies","MOVIE")),false);
  assert.equal(isRollingSource(streaming,{...source(),tmdbSourceType:"LIST"}),false);
  assert.equal(isRollingSource(streaming,source("New Movies 2024","MOVIE")),false);
  assert.equal(isRollingSource({id:"collection-Y2HQBZ5I"},source()),false);
  assert.equal(isRollingSource(streaming,{...source(),filters:{year:2026}}),false);
  assert.equal(isRollingSource(streaming,source()),true);
});

test("FR confirmé par les fournisseurs, jamais transformé en États-Unis",()=>{
  const movie=normalizeProviderMap({results:[
    {provider_id:8,display_priorities:{FR:4,US:1}},
    {provider_id:15,display_priorities:{US:1}}
  ]});
  const tv=normalizeProviderMap({results:[
    {provider_id:8,display_priorities:{FR:1}},
    {provider_id:15,display_priorities:{US:1}}
  ]});
  const folder={sources:[source("New Movies","MOVIE"),
    {...source("New Series"),filters:{withNetworks:"2552"}}]};
  assert.deepEqual(providersFor(folder,movie,tv),{movie:[8],series:[8]});
  assert.deepEqual(numbers("8|1796,8,bogus,-2"),[8,1796]);
  const enabled=discoverParams(streaming,source(),{
    date:new Date("2026-10-14T12:00:00Z"),streamingProviders:[8]
  });
  assert.equal(enabled.disabled,false);
  assert.equal(enabled.params.get("watch_region"),"FR");
  assert.equal(enabled.params.get("with_watch_providers"),"8");
  assert.equal(enabled.params.get("with_networks"),null);
  assert.equal(enabled.params.get("first_air_date.gte"),"2024-10-12");
  assert.equal(enabled.params.get("sort_by"),"first_air_date.desc");
  assert.equal(discoverParams(streaming,source(),{
    date:new Date("2026-10-14"),streamingProviders:[]
  }).disabled,true);
});

test("les 68 chaînes restent filtrées sur leur réseau TV",()=>{
  const q=discoverParams(network,source("Recent Series"),{
    date:new Date("2026-10-14T12:00:00Z")});
  assert.equal(q.params.get("with_networks"),"2552");
  assert.equal(q.params.get("first_air_date.gte"),"2023-10-13");
  assert.equal(q.params.get("watch_region"),null);
});
test("nouvelles saisons et épisodes utilisent une date de diffusion distincte",()=>{
  const p=recentEpisodeParams("2552",new Date("2026-10-14T12:00:00Z"));
  assert.equal(p.get("air_date.gte"),"2026-10-05");
  assert.equal(p.get("air_date.lte"),"2026-10-14");
  assert.equal(p.get("with_networks"),"2552");
  const fr=recentEpisodeParams(null,new Date("2026-10-14"),[8]);
  assert.equal(fr.get("watch_region"),"FR");
  assert.equal(fr.get("with_watch_providers"),"8");
});
test("différences calculées sans transformer l'initialisation en faux ajouts",()=>{
  assert.deepEqual(compareSample(null,[1,2]),{initialized:true,added:[],removed:[],retained:2});
  assert.deepEqual(compareSample([1,2],[2,3]),{initialized:false,added:[3],removed:[1],retained:1});
});
test("aperçus compatibles catalogue, sans doublons ni images tierces réécrites",()=>{
  const out=prepareMetas([{id:42,name:"Série",poster_path:"/poster.jpg",first_air_date:"2026-01-01"},
    {id:42,name:"Duplication"},{id:43,name:"Suite"}],"series");
  assert.equal(out.length,2);
  assert.equal(out[0].id,"tmdb:42");
  assert.equal(out[0].poster,"https://image.tmdb.org/t/p/w500/poster.jpg");
  assert.equal(out[0].releaseInfo,"2026");
  const e={id:"collection-test"};
  assert.equal(sourceKey(e,{id:"f"},source(),0),sourceKey(e,{id:"f"},source(),0));
});

test("l'inventaire comprend la totalité des nouveautés déjà recensées",async()=>{
  const {readdir}=await import("node:fs/promises");
  const names=(await readdir("collections")).filter(x=>x.endsWith(".json")&&
    !["metadata.json","nuvio_mega_collection.json","kaoxt-aio-catalogs.json","kaoxt-aio-base-config.json"].includes(x));
  let recent=0,networks=0,platforms=0;
  for (const name of names) {
    const data=JSON.parse(await readFile("collections/"+name,"utf8"));
    if (!Array.isArray(data) || !data.every(c=>Array.isArray(c.folders)))continue;
    for(const c of data)for(const f of c.folders)for(const s of f.sources||[]) {
      if(!isRollingSource(c,s))continue;
      recent++;
      if(c.id===CATEGORY_IDS.networks)networks++;
      if(c.id===CATEGORY_IDS.streaming)platforms++;
    }
  }
  assert.ok(recent>=370);
  assert.equal(networks,68);
  assert.ok(platforms>=40);
});
