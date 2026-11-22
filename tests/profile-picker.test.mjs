import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeKovelyxProfiles,makeKovelyxLocalCopy,accountDisplayName
} from '../profile-picker-core.mjs';
import {renderSuiteProfiles} from '../profile-suite-view.mjs';
import {captureSuiteProfile} from '../profile-suite-model.mjs';
const id='123e4567-e89b-42d3-a456-426614174000';
const id2='123e4567-e89b-42d3-a456-426614174001';
const fakeRows=[{
  id:'films',title:'Films',folders:[
    {id:'action',title:'Action',sources:[{provider:'tmdb',id:'one'},{provider:'tmdb',id:'two'}],coverImageUrl:'https://assets.example.org/action.webp'},
    {id:'other',title:'Autres',sources:[{provider:'tmdb',id:'three'}],hidden:true}
  ]
}];
const local=()=>captureSuiteProfile({
  sections:[{id:'local',label:'Ma collection',enabled:true,folders:[
    {id:'f',label:'Films',enabled:true,selectedKeys:['k'],artwork:{}}
  ]}]
},'Ma collection');
const viewContext=(overrides={})=>({
  draft:local(),profiles:[local()],cloudProfiles:[],
  account:{signedIn:false,loading:false,error:'',email:'Compte connecté'},
  showLocalProfiles:false,...overrides
});
test('Les profils cloud viennent des données reçues, jamais de noms fictifs',()=>{
  const list=normalizeKovelyxProfiles({profiles:[
    {id,displayName:'MAHÉ',categoriesCount:16,foldersCount:695},
    {id:id2,name:'MAMAN'},
    {id,displayName:'Doublon'},
    {id:'non-uuid',displayName:'Invalide'}
  ]});
  assert.equal(list.length,2);
  assert.equal(list[0].name,'MAHÉ');
  assert.equal(list[0].rows,16);
  assert.equal(list[0].folders,695);
  assert.equal(list[1].folders,null);
  assert.throws(()=>normalizeKovelyxProfiles({}),/invalide/);
});
test('Sélection d’un profil Kovelyx : copie de travail locale, sources intactes côté serveur',()=>{
  const meta=normalizeKovelyxProfiles({profiles:[{id,name:'MAHÉ'}]})[0];
  const snapshot={profileId:id,collections:structuredClone(fakeRows),head:{revision:4}};
  const before=structuredClone(snapshot);
  const profile=makeKovelyxLocalCopy(meta,snapshot);
  assert.equal(profile.id,'mcps-cloud-'+id);
  assert.equal(profile.rows.length,1);
  assert.equal(profile.rows[0].folders[0].sourceCount,2);
  assert.equal(profile.rows[0].folders[1].enabled,false);
  assert.deepEqual(snapshot,before);
  assert(!JSON.stringify(profile).includes('revision'));
  assert.throws(()=>makeKovelyxLocalCopy({id:'bad'},snapshot),/invalide/);
});
test('Sélecteur visuel : profil réel en premier et profils locaux masqués à la demande',()=>{
  const cloud=normalizeKovelyxProfiles({profiles:[{id,name:'MAHÉ',categoriesCount:16,foldersCount:695}]});
  const base=viewContext({cloudProfiles:cloud,account:{signedIn:true,email:'Compte connecté'}});
  const html=renderSuiteProfiles(base);
  assert(html.includes('Choisir un profil à organiser'));
  assert(html.includes('data-suite-cloud-select="'+id+'"'));
  assert(html.includes('16 catégories · 695 dossiers'));
  assert(!html.includes('aria-label="Profils locaux"'));
  assert(html.includes('data-suite-action="show-local"'));
  assert(html.includes('data-suite-action="sign-out"'));
  const expanded=renderSuiteProfiles({...base,showLocalProfiles:true});
  assert(expanded.includes('aria-label="Profils locaux"'));
  const offline=renderSuiteProfiles(viewContext());
  assert(offline.includes('data-suite-action="open-account"'));
  assert(!offline.includes('data-suite-action="sign-out"'));
  assert(offline.includes('aria-label="Profils locaux"'));
});
test('Ne divulgue pas les champs de sessions et ne recrée pas les profils Kaptain',()=>{
  const profiles=normalizeKovelyxProfiles({profiles:[{
    id,name:'Moi',avatarUrl:'https://kaptain.stream/avatar.png',
    access_token:'SECRET',password:'PASSWORD'
  }]});
  const html=renderSuiteProfiles(viewContext({cloudProfiles:profiles,account:{signedIn:true,email:'Compte connecté'}}));
  assert(!html.includes('SECRET'));
  assert(!html.includes('PASSWORD'));
  assert(!html.includes('https://kaptain.stream'));
  assert.equal(accountDisplayName('pas-un-email'),'Compte connecté');
});
