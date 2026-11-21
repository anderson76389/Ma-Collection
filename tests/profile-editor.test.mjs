import test from 'node:test';
import assert from 'node:assert/strict';
import {ProfileEditor,validateProfile,profileSummary,repairUpstreamResources,planProfileUpdate,safeProfileImage} from '../profile-editor-core.mjs';
import {ART_STYLES,makeFolderArt,isGeneratedFolderArt} from '../studio-art-generator.mjs';
const source={id:'src',provider:'tmdb',tmdbSourceType:'LIST',tmdbId:123};
const rows=()=>[{id:'custom',title:'Personnelle',privateFutureOption:{notASecret:'kept'},folders:[{id:'f',title:'Mon dossier',sources:[{...source}],futureField:true,coverImageUrl:'https://art.example/own.png'}]},{id:'other',title:'Autre',folders:[]}];
test('complete profile preserves unknown fields and custom folders through moves, export and undo',()=>{
 const input=rows(),before=JSON.stringify(input),editor=new ProfileEditor(input);
 editor.moveFolder('custom','f','other',0);assert.equal(editor.export()[1].folders[0].futureField,true);
 editor.updateFolder('other','f',{title:'Titre changé'});assert.equal(editor.folder('other','f').title,'Titre changé');
 editor.undo();assert.equal(editor.folder('other','f').title,'Mon dossier');editor.undo();assert.equal(JSON.stringify(editor.rows),before);assert.equal(JSON.stringify(input),before);
});
test('duplicate target folder and invalid edits are rejected atomically',()=>{
 const data=rows();data[1].folders=[structuredClone(data[0].folders[0])];const editor=new ProfileEditor(data),before=JSON.stringify(editor.rows);
 assert.throws(()=>editor.moveFolder('custom','f','other',0));assert.equal(JSON.stringify(editor.rows),before);
 assert.throws(()=>editor.updateSection('custom',{title:''}));assert.equal(JSON.stringify(editor.rows),before);
});
test('profile update keeps custom art and folders while proposing fresh source definitions',()=>{
 const input=rows();const baseline=[{id:'custom',title:'Baseline',folders:[{id:'f',title:'Baseline',sources:[{...source,tmdbId:456}],coverImageUrl:'https://art.example/other.png'},{id:'new',title:'Ajout',sources:[source]}]}];
 const plan=planProfileUpdate(input,baseline,{updateSources:true});assert.equal(plan.addedFolders.length,1);assert.equal(plan.updatedSources.length,1);
 assert.equal(plan.rows[0].folders[0].coverImageUrl,input[0].folders[0].coverImageUrl);assert.equal(plan.rows[0].folders[0].title,'Mon dossier');assert.equal(plan.rows[0].folders[0].sources[0].tmdbId,456);assert.equal(plan.rows[1].id,'other');
});
test('upstream images are blocked in previews and exports, then repaired without changing source IDs',()=>{
 const input=rows();input[0].folders[0].coverImageUrl='https://imkaptain.github.io/p.jpg';
 assert.equal(profileSummary(input).kaptainLinks,1);assert.equal(safeProfileImage(input[0].folders[0].coverImageUrl),'');assert.throws(()=>validateProfile(input,{exporting:true}));
 const repaired=repairUpstreamResources(input,rows());assert.equal(repaired.replaced,1);assert.equal(repaired.rows[0].folders[0].sources[0].id,'src');assert.doesNotThrow(()=>validateProfile(repaired.rows,{exporting:true}));
});
test('private credentials and invalid source routes cannot be exported',()=>{
 const input=rows();input[0].folders[0].sources=[{provider:'addon',catalogId:'x'}];assert.throws(()=>validateProfile(input,{exporting:true}));
 input[0].accessToken='secret';assert.throws(()=>validateProfile(input));
});
test('ten offline artwork styles round-trip securely with French accents and escaped titles',()=>{
 for(const s of ART_STYLES){const image=makeFolderArt('Cinéma français <script>',s.id,'POSTER');assert(isGeneratedFolderArt(image));assert.equal(safeProfileImage(image),image);assert.ok(!atob(image.split(',')[1]).includes('<script>'));}
 const malicious='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" data-ma-collection="1" ><script>alert(1)</script></svg>');assert.equal(isGeneratedFolderArt(malicious),false);assert.equal(safeProfileImage(malicious),'');
});

test('update distinguishes added sources from folders and preserves legacy sources when unchanged',()=>{
 const existing=rows();
 const folder=existing[0].folders[0];
 delete folder.sources;
 folder.catalogSources=[{addonId:'my-addon',type:'movie',catalogId:'mine'}];
 const same=structuredClone(existing);
 assert.deepEqual(planProfileUpdate(existing,same).rows,existing);
 same[0].folders[0].catalogSources.push({addonId:'my-addon',type:'movie',catalogId:'more'});
 const update=planProfileUpdate(existing,same);
 assert.equal(update.addedSources.length,1);
 assert.equal(update.addedFolders.length,0);
 assert.equal(update.rows[0].folders[0].sources.length,2);
});
