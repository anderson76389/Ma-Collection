const test = require('node:test');
const assert = require('node:assert/strict');
const {updateRollingWeekFilters,updateRollingYearFilters}=require('../scripts/catalog-utils.js');
const date=new Date('2026-10-14T12:00:00Z');

function make(title, options={}) {
  return {id:options.id||'source-1',title,provider:options.provider||'tmdb',
    tmdbSourceType:options.type||'DISCOVER',mediaType:options.media||'TV',
    sortBy:options.sort||'first_air_date.desc',
    filters:{withNetworks:'42',withGenres:'10764',watchRegion:'FR',
      releaseDateGte:'2023-01-01',...options.filters}};
}
function pack(id,sources) {
  return [{id,title:'Catégorie',folders:[{id:'folder-X',title:'Sous-catégorie',
    coverImageUrl:'https://images.test/example.gif',sources}]}];
}

test('TV : actualise la fenêtre de nouvelles séries sans changer leur réseau',()=>{
  const d=pack('27bda92a-f626-4093-a2ba-0a32dc09437a', [make('Recent Séries')]);
  assert.equal(updateRollingWeekFilters(d,date),1);
  assert.equal(d[0].folders[0].sources[0].filters.releaseDateGte,'2023-10-13');
  assert.equal(d[0].folders[0].sources[0].filters.withNetworks,'42');
  assert.equal(d[0].folders[0].coverImageUrl,'https://images.test/example.gif');
  assert.equal(updateRollingWeekFilters(d,date),0);
  assert.equal(updateRollingWeekFilters(d,new Date('2026-10-16')),0);
  assert.equal(updateRollingWeekFilters(d,new Date('2026-10-19')),1);
});

test('Plateformes : nouvelles séries/films se renouvellent, Top 10 historiques préservés',()=>{
  const old=make('Top 10 Movies',{type:'LIST',media:'MOVIE',filters:{}});
  const a=pack('collection-ERFS5GWK',
    [make('Nouveaux films',{media:'MOVIE'}),make('Nouvelles séries'),old]);
  const before=JSON.stringify(old);
  assert.equal(updateRollingWeekFilters(a,date),2);
  assert.equal(JSON.stringify(old),before);
});

test('Genres, télé-réalité, animés : dates dynamiques sans toucher aux genres',()=>{
  const a=pack('collection-KBP5HRRD',[make('New Reality Releases')]);
  const b=pack('collection-b530d60c',[make('New This Season')]);
  assert.equal(updateRollingWeekFilters(a,date),1);
  assert.equal(updateRollingWeekFilters(b,date),1);
  assert.equal(a[0].folders[0].sources[0].filters.releaseDateGte,'2023-10-13');
  assert.equal(b[0].folders[0].sources[0].filters.releaseDateGte,'2026-04-10');
  assert.equal(a[0].folders[0].sources[0].filters.withGenres,'10764');
});

test('Listes historiques / années explicites / filtres annuels conservés',()=>{
  const fixed=pack('collection-Y2HQBZ5I',[make('New Films 2024',{filters:{year:2024}})]);
  const decade=pack('collection-Y2HQBZ5I',[make('Recent Series')]);
  const year=pack('collection-UGED6TEZ',[make('New Movies',{media:'MOVIE',filters:{year:2026}})]);
  assert.equal(updateRollingWeekFilters(fixed,date),0);
  assert.equal(updateRollingWeekFilters(decade,date),0);
  assert.equal(updateRollingWeekFilters(year,date),1);
  assert.equal(year[0].folders[0].sources[0].filters.year,undefined);
  assert.equal(year[0].folders[0].sources[0].filters.releaseDateGte,'2024-10-12');
  const rolling=pack('collection-HFTCV0TA',[make('Top of the Year Movies',{media:'MOVIE',filters:{year:2026}})]);
  assert.equal(updateRollingYearFilters(rolling,2027),1);
  assert.equal(rolling[0].folders[0].sources[0].filters.year,2027);
});

test('Popular et Top Rated : TMDB live déjà dynamique, aucune date changée',()=>{
  const a=pack('collection-ERFS5GWK',[make('Popular Movies',{media:'MOVIE'}),
    make('Top Rated Series')]);
  const snap=JSON.stringify(a);
  assert.equal(updateRollingWeekFilters(a,date),0);
  assert.equal(JSON.stringify(a),snap);
});

test('Non-Discover, non-TMDB et champs de médias restent intacts',()=>{
  const a=pack('x',[make('New Movies',{provider:'trakt'}),make('Recent Anime',{type:'LIST'})]);
  const snap=JSON.stringify(a);
  assert.equal(updateRollingWeekFilters(a,date),0);
  assert.equal(JSON.stringify(a),snap);
});

test('Date rejetée si invalide',()=>{
  assert.throws(()=>updateRollingWeekFilters(pack('x',[make('New Films')]),new Date('invalid')));
});
