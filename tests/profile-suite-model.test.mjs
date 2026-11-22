import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUITE_SCHEMA,SUITE_SETTINGS,SUITE_PAGES,SUITE_PRESETS,
  captureSuiteProfile,validateSuiteProfile,profileSuiteStats,
  suiteProfileChanges,applySuitePreset,suiteSharePayload,
  suiteLocalState,sanitizeSuiteState,suiteRestoreShared,moveSuiteItem,migrateLegacyStudioProfiles
} from '../profile-suite-model.mjs';
import {renderSuiteScreen,renderSuiteDashboard} from '../profile-suite-view.mjs';

const fixture=()=>captureSuiteProfile({
  sections:[
    {id:'films',label:'Films',enabled:true,folders:[
      {id:'action',label:'Action',enabled:true,selectedKeys:['a'],artwork:{coverImageUrl:'https://ma-art.example/fr.webp'}},
      {id:'horror',label:'Horreur',enabled:false,selectedKeys:['h'],artwork:{coverImageUrl:'https://kaptain.stream/hidden.webp'}}
    ]},
    {id:'series',label:'Séries',enabled:true,folders:[
      {id:'drama',label:'Drames',enabled:true,selectedKeys:['d'],artwork:{}}
    ]}
  ]
},'Ma collection');

const context=()=>{
  const draft=fixture();
  return {draft,saved:structuredClone(draft),profiles:[draft],backups:[],
    search:'',artSearch:'',artRowId:draft.rows[0].id,
    artRow:draft.rows[0],artFolder:draft.rows[0].folders[0],artIndex:0,
    artVariants:[{url:draft.rows[0].folders[0].cover,label:'Actuel'}],
    coverFor:u=>u,preset:'',copyName:'Copie',copyTarget:'new',
    wizardStep:0,streamSamples:'1080p',streamTestResult:''};
};
test('capture strictement les profils locaux et bloque les images dépendantes du site de référence',()=>{
  const profile=fixture();
  assert.equal(profile.schema,SUITE_SCHEMA);
  assert.equal(profile.rows.length,2);
  assert.equal(profile.rows[0].folders[1].cover,'');
  assert.equal(profileSuiteStats(profile).rows,2);
  assert.equal(profileSuiteStats(profile).folders,2);
  assert.equal(profileSuiteStats(profile).available,3);
  assert.equal(validateSuiteProfile(profile).rows[0].folders.length,2);
});
test('contrôle le nombre de profils et le format importable',()=>{
  const good=fixture();const state=suiteLocalState(good);
  assert.equal(sanitizeSuiteState(state,good).profiles.length,1);
  assert.throws(()=>validateSuiteProfile({...good,schema:99}),/compatible/);
  assert.throws(()=>validateSuiteProfile({...good,rows:[good.rows[0],good.rows[0]]}),/dupliqué/);
  const bad=structuredClone(good);bad.rows[0].folders.push(structuredClone(bad.rows[0].folders[0]));
  assert.throws(()=>validateSuiteProfile(bad),/dupliqué/);
});
test('presets et changements détectés, sans remplacer les autres réglages',()=>{
  const a=fixture(),b=structuredClone(a);
  b.settings=applySuitePreset(b.settings,'binge');
  assert.equal(b.settings.skipIntro,true);
  assert.equal(b.settings.skipCredits,true);
  assert.equal(b.settings.subtitleLanguage,SUITE_SETTINGS.subtitleLanguage);
  b.rows.reverse();
  assert(suiteProfileChanges(a,b).count>2);
  assert.throws(()=>applySuitePreset(a.settings,'inconnu'),/inconnu/);
});
test('partage sans lien privé, mot de passe, rangées ni service de débridage',()=>{
  const profile=fixture();profile.settings.posterUrl='https://personal.example/secrets.webp';
  profile.settings.debrid='realdebrid';
  const payload=suiteSharePayload(profile);
  assert.equal(payload.settings.posterUrl,'');
  assert.equal(payload.settings.debrid,'');
  assert(!('rows' in payload));
  const restored=suiteRestoreShared(payload,fixture());
  assert.equal(restored.rows.length,2);
  assert.equal(restored.settings.posterUrl,'');
});
test('ordre des rangées et dossiers : swaps bornés, sans perte',()=>{
  const draft=fixture(),names=draft.rows.map(x=>x.id);
  assert(moveSuiteItem(draft.rows,names[0],1));
  assert.deepEqual(draft.rows.map(x=>x.id),[names[1],names[0]]);
  assert.equal(moveSuiteItem(draft.rows,names[1],-1),false);
});
test('tous les écrans sont rendus, en français, avec de vraies actions',()=>{
  const ctx=context();
  assert.equal(SUITE_PAGES.length,21);
  for(const [id] of SUITE_PAGES){
    const html=renderSuiteScreen(id,ctx);
    assert(html.length>100,id+' vide');
    assert(!html.includes('https://kaptain.stream'),id+' dépendant');
    assert(!html.includes('onclick='),id+' gestionnaire non délégué');
  }
  for(const page of ['profiles','dashboard','onboarding','look','details','continue','alerts']){
    assert(renderSuiteScreen(page,ctx).length>150);
  }
  const hub=renderSuiteDashboard(ctx);
  assert.equal((hub.match(/class="mcps-tile"/g)||[]).length,SUITE_PAGES.length);
  assert(hub.includes('Écran d’accueil'));
});
test('injection de texte escapée dans le tableau des dossiers',()=>{
  const ctx=context();
  ctx.draft.rows[0].name='<svg onload=alert(1)>';
  ctx.draft.rows[0].folders[0].name='<img src=x onerror=alert(1)>';
  const html=renderSuiteScreen('layout',ctx);
  assert(!html.includes('<svg onload'));
  assert(!html.includes('<img src=x onerror'));
  assert(html.includes('&lt;img'));
});
test('les fonctions du lecteur et les styles ont leurs commandes de sauvegarde',()=>{
  const ctx=context();
  for(const id of ['autoplay','player','stream-picker','subtitles','language','filters','performance','streaming']){
    const html=renderSuiteScreen(id,ctx);
    assert(html.includes('data-suite-field')||html.includes('data-suite-choice'),id);
    assert(html.includes('data-suite-action="save"')||html.includes('data-suite-action="open-french-art"')||
      html.includes('data-suite-action="open-addon-manifests"'),id);
  }
});

test('retrouve les anciens profils enregistrés sans réutiliser les clés ni images Kaptain',()=>{
  const older=[
    {id:'local-mahe',name:'MAHÉ',updatedAt:'2026-11-21T10:10:00.000Z',
     secret:'cle-inutile',sections:[
      {id:'films',label:'Films',enabled:true,folders:[
        {id:'action',label:'Action',enabled:true,selectedKeys:['a'],artwork:{
          coverImageUrl:'https://kaptain.stream/cover.webp'
        }}
      ]}
    ]},
    {id:'local-maman',name:'MAMAN',updatedAt:'2026-11-20T10:10:00.000Z',sections:[
      {id:'series',label:'Séries',enabled:true,folders:[]}
    ]}
  ];
  const migrated=migrateLegacyStudioProfiles(older);
  assert.deepEqual(migrated.map(x=>x.name),['MAHÉ','MAMAN']);
  assert.equal(migrated[0].rows[0].folders[0].cover,'');
  assert(!JSON.stringify(migrated).includes('cle-inutile'));
  assert(migrated.every(p=>p.id.startsWith('mcps-ancien-')));
  assert.deepEqual(migrateLegacyStudioProfiles([null,{}]),[]);
});
