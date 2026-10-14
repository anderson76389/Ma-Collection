import test from "node:test";
import assert from "node:assert/strict";
import { parseCountryTsv, selectFranceWeek } from "../scripts/netflix-fr-core.mjs";

function fixture(weeks) {
  const header="country_name\tcountry_iso2\tweek\tcategory\tweekly_rank\tshow_title\tseason_title\tcumulative_weeks_in_top_10";
  const all=[header];
  for (const {week,filmCount=10,tvCount=10,duplicate=false} of weeks) {
    for (const [cat,n] of [["Films",filmCount],["TV",tvCount]]) {
      for (let i=1;i<=n;i++) {
        const rank=duplicate && cat==="Films" && i===10 ? 1 : i;
        all.push(["France","FR",week,cat,rank,cat+" titre "+i,cat==="TV"?"Saison 1":"",1].join("\t"));
      }
    }
  }
  all.push(["Germany","DE","2026-10-11","Films",1,"Hors France","",1].join("\t"));
  return all.join("\n");
}

test("10 films et 10 séries Netflix France, rangés de 1 à 10", () => {
  const result=selectFranceWeek(parseCountryTsv(fixture([{week:"2026-10-11"}])),new Date("2026-10-14T12:00:00Z"));
  assert.equal(result.week,"2026-10-11");
  assert.equal(result.films.length,10);
  assert.equal(result.series.length,10);
  assert.deepEqual(result.films.map(x=>x.rank),[1,2,3,4,5,6,7,8,9,10]);
  assert.equal(result.series[0].season,"Saison 1");
  assert.equal(JSON.stringify(result).includes("Hors France"),false);
});

test("semaine incomplète ignorée au profit de la précédente complète", () => {
  const rows=parseCountryTsv(fixture([{week:"2026-10-04"},{week:"2026-10-11",filmCount:8}]));
  const result=selectFranceWeek(rows,new Date("2026-10-14"));
  assert.equal(result.week,"2026-10-04");
});

test("doublon de rang interdit : pas de publication incomplète", () => {
  const rows=parseCountryTsv(fixture([{week:"2026-10-11",duplicate:true}]));
  assert.throws(()=>selectFranceWeek(rows,new Date("2026-10-14")));
});

test("données trop anciennes : blocage de sécurité",()=>{
  const rows=parseCountryTsv(fixture([{week:"2026-10-11"}]));
  assert.throws(()=>selectFranceWeek(rows,new Date("2026-12-14")));
});

test("format de fichier Netflix invalide : erreur avant écriture",()=>{
  assert.throws(()=>parseCountryTsv("week\tcountry_iso2\n2026-10-11\tFR"));
});
