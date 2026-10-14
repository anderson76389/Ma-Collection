/* Configuration de débridage utilisée par Ma-Collection.
 * AllDebrid est prioritaire, Real-Debrid est une alternative.
 * Aucune clé n'est placée dans les fichiers publics : elle est fournie par le visiteur.
 * Le mode natif NuvioTV ne gère pas AllDebrid ; le manifest de l'addon
 * Torrentio est donc configuré avec la clé, pas un réglage Nuvio fictif.
 */
(function(root) {
  "use strict";
  const SERVICES = Object.freeze([
    {id:"alldebrid",name:"AllDebrid",field:"allDebridKey"},
    {id:"realdebrid",name:"Real-Debrid",field:"realDebridKey"}
  ]);
  function select(keys, preferred="alldebrid") {
    const ordered=[...SERVICES].sort((a,b)=>(a.id===preferred?-1:0)-(b.id===preferred?-1:0));
    for(const item of ordered) {
      const key=String(keys?.[item.field]||"").trim();
      if(key) return {id:item.id,name:item.name,key};
    }
    return null;
  }
  function torrentioManifest(config,keys,preferred) {
    const svc=select(keys,preferred);
    if(!svc)return null;
    const cfg=config||{};
    const resolutions=new Set(cfg.resolutions||[]);
    const excluded=[];
    const quality={r2160p:"4k",r1080p:"1080p",r720p:"720p",r480p:"480p",unknown:"unknown"};
    for(const [id,name] of Object.entries(quality))if(!resolutions.has(id))excluded.push(name);
    if(cfg.removeTrash)for(const value of ["cam","scr","threed"])if(!excluded.includes(value))excluded.push(value);
    const parts=["sort="+encodeURIComponent(cfg.sortBy||"qualitysize")];
    if(excluded.length)parts.push("qualityfilter="+excluded.join(","));
    if(Number(cfg.maxSize)>0)parts.push("sizefilter="+Number(cfg.maxSize));
    parts.push("debridoptions=nodownloadlinks,nocatalog");
    parts.push(svc.id+"="+encodeURIComponent(svc.key));
    return {provider:svc.id,name:"Torrentio — "+svc.name,url:"https://torrentio.strem.fun/"+parts.join("|")+"/manifest.json"};
  }
  async function checkKey(id,key) {
    const service=SERVICES.find(s=>s.id===id);
    if(!service||!String(key||"").trim())return {ok:false};
    const endpoint=id==="alldebrid"?"https://api.alldebrid.com/v4/user":"https://api.real-debrid.com/rest/1.0/user";
    try {
      const res=await fetch(endpoint,{method:"GET",headers:{Authorization:"Bearer "+key.trim()},cache:"no-store",signal:AbortSignal.timeout(10000)});
      if(!res.ok)return {ok:false};
      const data=await res.json();
      return {ok:id==="alldebrid"?data.status==="success"&&!!data.data?.user:!!data.username};
    }catch(e){return {ok:false,unreachable:true};}
  }
  const api=Object.freeze({SERVICES,select,torrentioManifest,checkKey});
  root.MaCollectionDebrid=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
