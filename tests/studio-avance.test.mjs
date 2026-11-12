import test from 'node:test';
import {frenchPackTemplate,validateFrenchPack,planFrenchPack,applyFrenchPack} from '../studio-fr-art.mjs';
import {listStudioArtworks,searchStudioArtworks,useStudioArtwork} from '../studio-art-library.mjs';
import {studioFolderKey,studioTidy,studioApplyBatch} from '../studio-workshop-core.mjs';
import assert from 'node:assert/strict';
import {
  assetUrl,isKaptainHostedUrl,captureDraft,validateDraft,applyDraft,originalsFor,decorateExport,previewLayout,searchDraft,captureStudioUndo,restoreStudioUndo,compareStudioDrafts,STUDIO_SHAPES
} from '../studio-avance-core.mjs';

function fixture(){
  const data=[
    {id:'section-a',title:'Streaming Services',folders:[
      {id:'folder-a',title:'Netflix',tileShape:'LANDSCAPE',
       coverImageUrl:'https://ma-art.mailpromahe.workers.dev/media/abc.jpg',
       sources:[{title:'Nouveaux films',provider:'tmdb'},{title:'Nouvelles séries',provider:'tmdb'}]},
      {id:'folder-b',title:'Disney+',tileShape:'LANDSCAPE',
       coverImageUrl:'https://ma-art.mailpromahe.workers.dev/media/def.jpg',
       sources:[{title:'Top 10',provider:'tmdb'}]}
    ]},
    {id:'section-b',title:'Genres',folders:[
      {id:'folder-c',title:'Action',tileShape:'POSTER',
       sources:[{title:'Les meilleurs films',provider:'tmdb'}]}
    ]}
  ];
  const sel={
    'folder-a':{'Nouveaux films':true,'Nouvelles séries':true},
    'folder-b':{'Top 10':true},
    'folder-c':{'Les meilleurs films':false}
  };
  return {data,sel};
}
test('La capture de profils n’altère ni les sources ni les URLs originales',()=>{
  const {data,sel}=fixture(),old=structuredClone(data),selection=structuredClone(sel);
  const profile=captureDraft(data,sel,'Ma TV');
  assert.equal(profile.sections.length,2);
  assert.equal(profile.sections[0].folders[0].selectedKeys.length,2);
  assert.deepEqual(data,old);assert.deepEqual(sel,selection);
  assert.equal(validateDraft(profile,data).name,'Ma TV');
});
test('Réorganisation des sections et dossiers et sélection, sans suppression',()=>{
  const {data,sel}=fixture(),old=structuredClone(data);
  const draft=captureDraft(data,sel,'Mes salons');
  draft.sections.reverse();
  const s=draft.sections.find(x=>x.id==='section-a');
  s.folders.reverse();
  s.folders.find(x=>x.id==='folder-a').selectedKeys=['Nouveaux films'];
  const profile=applyDraft(draft,data,sel,originalsFor(data));
  assert.equal(data[0].id,'section-b');
  assert.deepEqual(data[1].folders.map(f=>f.id),['folder-b','folder-a']);
  assert.equal(sel['folder-a']['Nouveaux films'],true);
  assert.equal(sel['folder-a']['Nouvelles séries'],false);
  assert.equal(data[1].folders[1].id,old[0].folders[0].id);
  assert.equal(data[1].folders[1].sources[0].title,'Nouveaux films');
  assert.equal(profile.sections.length,2);
});
test('Affiches et fonds peuvent changer, avec retour aux originaux',()=>{
  const {data,sel}=fixture(),originals=originalsFor(data);
  const draft=captureDraft(data,sel,'Films');
  const f=draft.sections[0].folders[0];
  f.artwork.coverImageUrl='https://image.tmdb.org/t/p/original/test.jpg';
  f.artwork.heroBackdropUrl='https://ma-art.mailpromahe.workers.dev/media/new.webp';
  f.shape='POSTER';f.focusGlowEnabled=true;
  applyDraft(draft,data,sel,originals);
  assert.equal(data[0].folders[0].coverImageUrl,f.artwork.coverImageUrl);
  assert.equal(data[0].folders[0].tileShape,'POSTER');
  assert.equal(data[0].folders[0].focusGlowEnabled,true);
  const originalDraft=captureDraft(data,sel,'Restore');
  const target=originalDraft.sections[0].folders[0];
  target.artwork.coverImageUrl='';
  target.artwork.heroBackdropUrl='';
  target.shape='LANDSCAPE';
  applyDraft(originalDraft,data,sel,originals);
  assert.equal(data[0].folders[0].coverImageUrl,originals['folder-a'].coverImageUrl);
  assert.equal(data[0].folders[0].heroBackdropUrl||'',originals['folder-a'].heroBackdropUrl||'');
});
test('Les noms personnalisés sont réservés aux clones exportés',()=>{
  const {data,sel}=fixture(),original=structuredClone(data),draft=captureDraft(data,sel);
  draft.sections[0].label='Mes plateformes';
  draft.sections[0].folders[0].label='Netflix personnalisé';
  applyDraft(draft,data,sel,originalsFor(data));
  assert.equal(data[0].title,original[0].title);
  assert.equal(data[0].folders[0].title,original[0].folders[0].title);
  const exported=decorateExport(data,draft);
  assert.equal(exported[0].title,'Mes plateformes');
  assert.equal(exported[0].folders[0].title,'Netflix personnalisé');
  assert.equal(data[0].title,'Streaming Services');
});
test('Les nouvelles sections ou dossiers restent présents avec une ancienne sauvegarde',()=>{
  const {data,sel}=fixture(),old=captureDraft(data,sel);
  data[0].folders.push({id:'folder-new',title:'Nouveau',sources:[{title:'New'}]});
  data.push({id:'section-new',title:'Nouveautés',folders:[]});
  applyDraft(old,data,sel,originalsFor(data));
  assert.equal(data.length,3);
  assert(data[0].folders.some(x=>x.id==='folder-new'));
});
test('Fichier importé malveillant refusé et absence de requêtes Kaptain',()=>{
  const {data,sel}=fixture(),p=captureDraft(data,sel);
  assert.throws(()=>assetUrl('javascript:alert(1)'),/indépendante|incorrecte/);
  assert.throws(()=>assetUrl('https://kaptain.stream/a.jpg'),/Kaptain/);
  assert.throws(()=>assetUrl('https://raw.githubusercontent.com/ImKaptain/nuvio-art/main/x.png'),/Kaptain/);
  p.sections[0].folders[0].artwork.coverImageUrl='https://kaptain.stream/x.png';
  assert.throws(()=>validateDraft(p,data),/Kaptain/);
});
test('Le format et le catalogue d’origine ne sont jamais modifiés par l’export seul',()=>{
  const {data,sel}=fixture(),draft=captureDraft(data,sel);
  assert(STUDIO_SHAPES.includes('POSTER'));
  assert.deepEqual(decorateExport(data,null),data);
  assert.deepEqual(sel['folder-a'],{'Nouveaux films':true,'Nouvelles séries':true});
  assert.equal(validateDraft(draft,data).sections.length,2);
});

test("La synchronisation optionnelle du nom/avatar n'est jamais activée par défaut",()=>{
  const {data,sel}=fixture(),d=captureDraft(data,sel,'Salon');
  assert.equal(d.syncQuickEditor,false);
  d.syncQuickEditor=true;
  const normalized=validateDraft(d,data);
  assert.equal(normalized.syncQuickEditor,true);
});


test('Aperçu du profil : seuls les dossiers activés et sélectionnés sont affichés',()=>{
  const {data,sel}=fixture(),old=structuredClone(data),oldSel=structuredClone(sel);
  const draft=captureDraft(data,sel,'Salon');
  draft.sections[0].folders[1].enabled=false;
  draft.sections[1].enabled=false;
  draft.sections[0].folders[0].artwork.coverImageUrl='https://ma-art.mailpromahe.workers.dev/media/custom.webp';
  const rows=previewLayout(draft,originalsFor(data));
  assert.equal(rows.length,1);
  assert.equal(rows[0].total,1);
  assert.equal(rows[0].folders[0].label,'Netflix');
  assert.equal(rows[0].folders[0].sourceCount,2);
  assert.equal(rows[0].folders[0].coverImageUrl,draft.sections[0].folders[0].artwork.coverImageUrl);
  assert.deepEqual(data,old);
  assert.deepEqual(sel,oldSel);
});
test('Aperçu : la limite d’affichage ne supprime aucun dossier du profil',()=>{
  const {data,sel}=fixture(),draft=captureDraft(data,sel);
  const rows=previewLayout(draft,originalsFor(data),1);
  assert.equal(rows[0].total,2);
  assert.equal(rows[0].folders.length,1);
  assert.equal(rows[0].omitted,1);
  assert.equal(draft.sections[0].folders.length,2);
  assert.deepEqual(previewLayout(null),[]);
});


test('Recherche globale insensible aux accents, sans modification des données',()=>{
  const {data,sel}=fixture(),old=structuredClone(data),draft=captureDraft(data,sel);
  draft.sections[1].folders[0].label='Science-fiction élégante';
  const found=searchDraft(draft,'ELEGANTE');
  assert.equal(found.total,1);
  assert.equal(found.results[0].folderId,'folder-c');
  assert.equal(searchDraft(draft,'Nouveaux films').results[0].folderId,'folder-a');
  assert.equal(searchDraft(draft,'', {activeOnly:true}).total,2);
  assert.equal(searchDraft(draft,'', {noCoverOnly:true}).total,1);
  assert.deepEqual(data,old);
});
test('Instantané Studio : restauration en place des rangées, sources et visuels',()=>{
  const {data,sel}=fixture(),originals=originalsFor(data);
  const categoriesRef=data,folderRef=data[0].folders,sourceRef=sel['folder-a'];
  const beforeData=structuredClone(data),beforeSel=structuredClone(sel);
  const snap=captureStudioUndo(data,sel);
  const draft=captureDraft(data,sel);
  draft.sections.reverse();
  draft.sections.find(x=>x.id==='section-a').folders.reverse();
  draft.sections.find(x=>x.id==='section-a').folders.find(f=>f.id==='folder-a').artwork.coverImageUrl='https://image.tmdb.org/t/p/original/new.jpg';
  draft.sections.find(x=>x.id==='section-a').folders.find(f=>f.id==='folder-a').selectedKeys=['Nouveaux films'];
  applyDraft(draft,data,sel,originals);
  sel['folder-extra']={Added:true};
  assert.notDeepEqual(data,beforeData);
  assert(restoreStudioUndo(snap,data,sel));
  assert.strictEqual(data,categoriesRef);
  assert.strictEqual(data[0].folders,folderRef);
  assert.strictEqual(sel['folder-a'],sourceRef);
  assert.deepEqual(data,beforeData);
  assert.deepEqual(sel,beforeSel);
});

import {
  makeStudioBackup,recentStudioBackups,BACKUP_LIMIT
} from '../studio-backups.mjs';

test('Historique : sauvegarde strictement limitée au profil validé, sans secret',()=>{
  const {data,sel}=fixture(),profile=captureDraft(data,sel,'Salon');
  profile.privateApiToken='SECRET-NE-PAS-CONSERVER';
  profile.sections[0].folders[0].irrelevantSensitiveKey='SECRET-2';
  const backup=makeStudioBackup(profile,data,'manual',new Date('2026-11-02T12:00:00.000Z'));
  assert.equal(backup.schema,1);
  assert.equal(backup.kind,'manual');
  assert.equal(backup.createdAt,'2026-11-02T12:00:00.000Z');
  assert.equal(backup.name,'Salon');
  assert.equal(backup.profile.sections[0].folders[0].label,'Netflix');
  assert(!JSON.stringify(backup).includes('SECRET-NE-PAS-CONSERVER'));
  assert(!JSON.stringify(backup).includes('SECRET-2'));
  assert.throws(()=>makeStudioBackup(profile,data,'arbitrary'),/incompatible/);
  assert.throws(()=>makeStudioBackup(profile,data,'manual',new Date('Invalid')),/incorrecte/);
});

test('Historique : les huit sauvegardes les plus récentes seulement, sans mutation',()=>{
  const {data,sel}=fixture(),profile=captureDraft(data,sel);
  const entries=Array.from({length:11},(_,i)=>makeStudioBackup(profile,data,'before-apply',
    new Date(2026,10,i+1)));
  const old=entries.slice();
  const recent=recentStudioBackups(entries);
  assert.equal(recent.length,BACKUP_LIMIT);
  assert.equal(recent[0].createdAt,entries[10].createdAt);
  assert.deepEqual(entries,old);
  assert.equal(recentStudioBackups(entries,2).length,2);
  assert.equal(recentStudioBackups(null).length,0);
});


test('Comparateur : signale les changements de rangées, sources, visuels et présentations',()=>{
  const {data,sel}=fixture(),before=captureDraft(data,sel);
  // Dans la fixture, la section B est initialement inactive : l'activer pour tester sa désactivation.
  before.sections[1].enabled=true;
  const after=structuredClone(before);
  const snapshot=structuredClone(before);
  after.sections.reverse();
  const section=after.sections.find(s=>s.id==='section-a');
  section.folders.reverse();
  const folder=section.folders.find(f=>f.id==='folder-a');
  folder.label='Mon Netflix';
  folder.selectedKeys=['Nouveaux films'];
  folder.artwork.coverImageUrl='https://ma-art.mailpromahe.workers.dev/media/custom.png';
  folder.shape='POSTER';
  after.sections.find(s=>s.id==='section-b').enabled=false;
  const difference=compareStudioDrafts(before,after);
  assert.equal(difference.total.sectionOrder,1);
  assert.equal(difference.total.folderOrders,1);
  assert.equal(difference.total.sectionsDisabled,1);
  assert.equal(difference.total.labels,1);
  assert.equal(difference.total.artworks,1);
  assert.equal(difference.total.presentation,1);
  assert(difference.total.sourcesDisabled>=1);
  assert(difference.changeCount>=7);
  assert.deepEqual(before,snapshot,'Le comparateur ne doit pas modifier les objets');
  assert.deepEqual(compareStudioDrafts(before,before).changeCount,0);
  assert.equal(compareStudioDrafts(before,after,2).examples.length,2);
});


test('Rangement intelligent: actifs d’abord sans supprimer une section, un dossier ni une source',()=>{
  const {data,sel}=fixture(),draft=captureDraft(data,sel);
  const snapshot=structuredClone(draft);
  draft.sections.reverse();
  draft.sections.find(s=>s.id==='section-a').folders.reverse();
  // Un dossier inactif est volontairement placé avant l'actif.
  draft.sections.find(s=>s.id==='section-a').folders.find(f=>f.id==='folder-b').enabled=false;
  const before=structuredClone(draft);
  const preview=studioTidy(draft,{mode:'active-first'},true);
  assert.deepEqual(draft,before,'La prévision ne modifie rien');
  assert(preview.changed>=2);
  const real=studioTidy(draft,{mode:'active-first'},false);
  assert.equal(real.changed,preview.changed);
  assert.equal(draft.sections[0].id,'section-a');
  assert.equal(draft.sections[0].folders[0].id,'folder-a');
  assert.equal(draft.sections.reduce((n,s)=>n+s.folders.length,0),3);
  assert.deepEqual(data,fixture().data);
  assert.deepEqual(sel,fixture().sel);
  assert(snapshot.sections.length===draft.sections.length);
});

test('Rangement alphabétique FR stable et prévisuel, tous dossiers conservés',()=>{
  const {data,sel}=fixture(),draft=captureDraft(data,sel);
  draft.sections[0].folders[0].label='Émissions';
  draft.sections[0].folders[1].label='Anime';
  assert(studioTidy(draft,{mode:'alphabetical'},true).changed>0);
  studioTidy(draft,{mode:'alphabetical'},false);
  const ordered=draft.sections.find(s=>s.id==='section-a').folders.map(f=>f.label);
  assert.deepEqual(ordered,['Anime','Émissions']);
  assert.throws(()=>studioTidy(draft,{mode:'inconnu'},false),/inconnu/);
});

test('Lot de styles : ne touche ni aux affiches ni aux sources et peut être annulé via copie',()=>{
  const {data,sel}=fixture(),draft=captureDraft(data,sel),before=structuredClone(draft);
  const keys=[studioFolderKey('section-a','folder-a'),studioFolderKey('section-a','folder-b')];
  const result=studioApplyBatch(draft,keys,{shape:'SQUARE',hideTitle:true,focusGlowEnabled:true});
  assert.equal(result.selected,2);assert.equal(result.changed,2);
  assert(draft.sections[0].folders.every(f=>f.shape==='SQUARE'&&f.hideTitle===true));
  assert.deepEqual(draft.sections[0].folders.map(f=>f.artwork),before.sections[0].folders.map(f=>f.artwork));
  assert.deepEqual(draft.sections[0].folders.map(f=>f.selectedKeys),before.sections[0].folders.map(f=>f.selectedKeys));
  assert.deepEqual(data,fixture().data);assert.deepEqual(sel,fixture().sel);
});

test('Copie en lot : images uniquement si explicitement demandé ; refus atomique de lot invalide',()=>{
  const {data,sel}=fixture(),draft=captureDraft(data,sel);
  const source=studioFolderKey('section-a','folder-a'),target=studioFolderKey('section-a','folder-b');
  const original=structuredClone(draft);
  assert.throws(()=>studioApplyBatch(draft,[target],{shape:'FAKE'}),/reconnu/);
  assert.throws(()=>studioApplyBatch(draft,[target],{copyArtwork:true}),/source/);
  assert.throws(()=>studioApplyBatch(draft,[target,studioFolderKey('section-a','absent')],{shape:'POSTER'}),/expirée/);
  assert.deepEqual(draft,original,'Rejet sans mutation');
  const src=draft.sections[0].folders[0],dest=draft.sections[0].folders[1];
  src.shape='POSTER';src.hideTitle=true;
  studioApplyBatch(draft,[target],{copyFrom:source});
  assert.equal(dest.shape,'POSTER');
  assert.notEqual(dest.artwork.coverImageUrl,src.artwork.coverImageUrl);
  studioApplyBatch(draft,[target],{copyFrom:source,copyArtwork:true});
  assert.equal(dest.artwork.coverImageUrl,src.artwork.coverImageUrl);
});


test('Bibliothèque de visuels : index local, recherche sans accent, URL intacte',()=>{
  const {data,sel}=fixture(),draft=captureDraft(data,sel),before=structuredClone(draft);
  draft.sections[0].folders[0].looks=[{label:'Édition française',url:'https://ma-art.mailpromahe.workers.dev/media/other.webp'}];
  const library=listStudioArtworks(draft,originalsFor(data));
  assert.equal(library.length,3);
  assert.equal(library[0].url,before.sections[0].folders[0].artwork.coverImageUrl);
  assert.equal(searchStudioArtworks(library,'EDITION FRANCAISE').total,1);
  assert.equal(searchStudioArtworks(library,'Disney').total,1);
  assert.equal(searchStudioArtworks(library,'', {sectionId:'section-b'}).total,0);
  assert.equal(searchStudioArtworks(library,'', {limit:1}).omitted,2);
  assert.deepEqual(data,fixture().data);
  assert.deepEqual(sel,fixture().sel);
});
test('Bibliothèque visuelle : choisir une affiche sans écraser fonds, GIF ou sources',()=>{
  const {data,sel}=fixture(),draft=captureDraft(data,sel);
  const original=structuredClone(draft.sections[0].folders[0]);
  const [current,alternative]=listStudioArtworks(draft,originalsFor(data));
  assert.equal(useStudioArtwork(draft,'section-a','folder-a',current).changed,false);
  const result=useStudioArtwork(draft,'section-a','folder-a',alternative);
  assert.equal(result.changed,true);
  const actual=draft.sections[0].folders[0];
  assert.equal(actual.artwork.coverImageUrl,alternative.url);
  assert.deepEqual(actual.selectedKeys,original.selectedKeys);
  assert.equal(actual.shape,original.shape);
  assert.equal(actual.artwork.heroBackdropUrl,original.artwork.heroBackdropUrl);
  assert(actual.looks.some(v=>v.url===original.artwork.coverImageUrl));
  assert.throws(()=>useStudioArtwork(draft,'section-a','absent',alternative),/introuvable/);
  assert.throws(()=>useStudioArtwork(draft,'section-a','folder-a',{url:'https://kaptain.stream/c.png'}),/Kaptain/);
});


test('Packs FR : modèle complet et identifiants inchangés',()=>{
  const {data,sel}=fixture(),draft=captureDraft(data,sel),before=structuredClone(draft);
  const template=frenchPackTemplate(draft,v=>v.replace('Streaming Services','Plateformes de streaming'));
  assert.equal(template.language,'fr');
  assert.equal(template.entries.length,3);
  assert.equal(template.entries[0].sectionLabel,'Plateformes de streaming');
  assert.equal(template.entries[0].folderId,'folder-a');
  assert.equal(template.entries[0].coverImageUrl,'');
  assert.deepEqual(draft,before);
});

test('Packs FR : sélection du style, sections ciblées, aucune image inventée',()=>{
  const {data,sel}=fixture(),draft=captureDraft(data,sel);
  const raw=frenchPackTemplate(draft);
  raw.styles.push({id:'neon-fr',label:'Néon français'});
  raw.entries[0].coverImageUrl='https://ma-art.mailpromahe.workers.dev/media/affiche-fr.jpg';
  raw.entries.push({...raw.entries[0],style:'neon-fr',coverImageUrl:'https://ma-art.mailpromahe.workers.dev/media/affiche-fr-neon.webp'});
  const pack=validateFrenchPack(raw,draft);
  assert.equal(pack.entries.length,2);
  const original=structuredClone(draft),plan=planFrenchPack(draft,pack,{style:'fr-classique',activeOnly:false});
  assert.equal(plan.available,1);
  assert.equal(plan.missing,2);
  assert.equal(plan.changes.length,1);
  assert.deepEqual(draft,original);
  const result=applyFrenchPack(draft,pack,{style:'neon-fr',sectionId:'section-a',activeOnly:false});
  assert.equal(result.changed,1);
  assert.equal(draft.sections[0].folders[0].artwork.coverImageUrl,'https://ma-art.mailpromahe.workers.dev/media/affiche-fr-neon.webp');
  assert.deepEqual(draft.sections[0].folders[0].selectedKeys,original.sections[0].folders[0].selectedKeys);
  assert.equal(draft.sections[0].folders[1].artwork.coverImageUrl,original.sections[0].folders[1].artwork.coverImageUrl);
  assert.deepEqual(data,fixture().data);
  assert.deepEqual(sel,fixture().sel);
});

test('Packs FR : refus des URL Kaptain et des styles malformés',()=>{
  const {data,sel}=fixture(),draft=captureDraft(data,sel),raw=frenchPackTemplate(draft);
  raw.entries[0].coverImageUrl='https://art.kaptain.stream/genres/abc/cover.png';
  assert.throws(()=>validateFrenchPack(raw,draft),/Kaptain/);
  raw.entries[0].coverImageUrl='https://cdn.jsdelivr.net/gh/ImKaptain/art-fr@main/genres/a.png';
  assert.throws(()=>validateFrenchPack(raw,draft),/Kaptain/);
  raw.entries[0].coverImageUrl='https://ma-art.mailpromahe.workers.dev/media/owned.png';
  raw.styles[0].id='../../path';
  assert.throws(()=>validateFrenchPack(raw,draft),/Style/);
  raw.styles[0].id='fr-classique';
  raw.entries.push({...raw.entries[0]});
  assert.throws(()=>validateFrenchPack(raw,draft),/répété/);
});

test('Packs FR : dossier absent ignoré, et GIF inchangé si non fourni',()=>{
  const {data,sel}=fixture(),draft=captureDraft(data,sel),raw=frenchPackTemplate(draft);
  raw.entries[0].coverImageUrl='https://ma-art.mailpromahe.workers.dev/media/a-fr.png';
  raw.entries.push({...raw.entries[0],sectionId:'ancien-absent',folderId:'ancien-dossier'});
  const pack=validateFrenchPack(raw,draft);
  const original=structuredClone(draft.sections[0].folders[0]);
  const x=applyFrenchPack(draft,pack,{style:'fr-classique',activeOnly:true});
  assert.equal(x.changed,1);
  assert.equal(draft.sections[0].folders[0].artwork.focusGifUrl,original.artwork.focusGifUrl);
  assert.equal(draft.sections[0].folders[0].shape,original.shape);
});

test('Indépendance : le Studio refuse les CDN et proxies renvoyant vers Kaptain',()=>{
  const denied=[
    'https://kaptain.stream/poster.jpg',
    'https://art.kaptain.stream/poster.jpg',
    'https://imkaptain.github.io/images/poster.png',
    'https://raw.githubusercontent.com/ImKaptain/Kaptain-Collection/main/poster.png',
    'https://api.github.com/repos/ImKaptain/Kaptain-Collection/contents/poster.png',
    'https://cdn.jsdelivr.net/gh/ImKaptain/Kaptain-Collection@main/poster.png',
    'https://cdn.jsdelivr.net/gh/%49mKaptain/Kaptain-Collection/poster.webp',
    'https://raw.githack.com/ImKaptain/Kaptain-Collection/main/poster.webp',
    'https://images.weserv.nl/?url=https%3A%2F%2Fkaptain.stream%2Fposter.jpg',
    'https://images.weserv.nl/?url=https%253A%252F%252Fimkaptain.github.io%252Fposter.jpg'
  ];
  for(const link of denied){
    assert.equal(isKaptainHostedUrl(link),true,link);
    assert.throws(()=>assetUrl(link),/Kaptain/,link);
  }
  const allowed=[
    'https://ma-art.mailpromahe.workers.dev/media/imkaptain.github.io/poster.webp',
    'https://image.tmdb.org/t/p/original/poster.jpg',
    'https://raw.githubusercontent.com/anderson76389/Ma-Collection/main/assets/poster.png'
  ];
  for(const link of allowed){
    assert.equal(isKaptainHostedUrl(link),false,link);
    assert.equal(assetUrl(link),link);
  }
});
