import {ProfileEditor,validateProfile,profileSummary,profileSources,safeProfileImage,repairUpstreamResources,planProfileUpdate} from './profile-editor-core.mjs';
import {ART_STYLES,makeFolderArt} from './studio-art-generator.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=x=>JSON.parse(JSON.stringify(x));
const catalogue=()=>window.collectionData||[];
let root,editor=new ProfileEditor(),sectionId='',folderId='',query='',notice='',snapshot=null,profiles=[],busy=false,updatePlan=null;
let returnFocus=null,initialized=false,accountOpen=false,updateOpen=false,refreshSources=false;
const current=()=>editor.section(sectionId),folder=()=>editor.folder(sectionId,folderId);
function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function remember(){try{localStorage.setItem('ma_collection_profile_draft_v1',JSON.stringify({schema:1,rows:editor.rows,savedAt:new Date().toISOString()}));}catch{notice='Le navigateur ne peut pas conserver le brouillon. Télécharge le JSON avant de fermer.';}}
function choose(){if(!editor.section(sectionId))sectionId=editor.rows[0]?.id||'';if(!editor.folder(sectionId,folderId))folderId=current()?.folders[0]?.id||'';}
function replace(rows,origin=null){editor=new ProfileEditor(rows);snapshot=origin;sectionId=rows[0]?.id||'';folderId='';choose();updatePlan=null;remember();draw();}
function checkDiscard(){return !editor.changes()||window.confirm('Remplacer le brouillon non publié ? Télécharge-le d’abord si tu veux le conserver.');}
function action(label,key,extra=''){return '<button type="button" data-profile-action="'+key+'" '+extra+'>'+esc(label)+'</button>';}
function opts(rows,selected){return rows.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===selected?'selected':'')+'>'+esc(c.title||c.displayName||'Profil')+'</option>').join('');}
function field(key,label,value,type='text'){return '<label>'+esc(label)+'<input data-profile-field="'+key+'" type="'+type+'" value="'+esc(value||'')+'"></label>';}
function draw(){
 if(!root)return;
 if(updatePlan && updatePlan.base!==editor.rows)updatePlan=null;
 choose();const c=current(),f=folder(),sum=profileSummary(editor.rows);
 root.querySelector('[data-profile-status]').textContent=notice;
 root.querySelector('[data-profile-summary]').textContent=sum.sections+' sections · '+sum.folders+' dossiers · '+sum.sources+' sources'+(sum.kaptainLinks?' · '+sum.kaptainLinks+' liens Kaptain à corriger':'');
 const body=root.querySelector('[data-profile-body]');
 body.innerHTML='<div class="mc-profile-toolbar">'+action('Importer un JSON','file')+action('Charger la sélection Ma-Collection','selection')+action('Restaurer le brouillon local','restore')+action('Télécharger le JSON','export')+action('Annuler','undo',editor.history.length?'':'disabled')+'</div>'+
 '<input type="file" data-profile-file accept=".json,application/json" hidden>'+
 '<details class="mc-profile-account" '+(accountOpen?'open':'')+'><summary>Charger et modifier mon profil Kovelyx</summary><p>Utilise le compte Kovelyx configuré sur ce site. Aucune connexion à Kaptain.</p>'+action('Compte Kovelyx','account')+action('Actualiser les profils','profiles')+
 '<div class="mc-picker-grid">'+profiles.map(p=>action(p.displayName||p.name||'Profil','load','data-id="'+esc(p.id)+'"')).join('')+'</div>'+action('Publier le brouillon sur le profil chargé','publish',snapshot?'':'disabled')+
 '<p>La publication remplace les collections du profil chargé, après confirmation et vérification de sa révision. Elle ne modifie pas les autres profils.</p></details>'+
 '<div class="mc-profile-layout"><aside><h3>Sections du profil</h3>'+action('Nouvelle section','add-section')+
 editor.rows.map((s,i)=>'<div class="mc-profile-section '+(s.id===sectionId?'active':'')+'">'+action(s.title,'section','data-id="'+esc(s.id)+'"')+action('↑','section-up','aria-label="Monter '+esc(s.title)+'" data-id="'+esc(s.id)+'" '+(!i?'disabled':''))+action('↓','section-down','aria-label="Descendre '+esc(s.title)+'" data-id="'+esc(s.id)+'" '+(i===editor.rows.length-1?'disabled':''))+'</div>').join('')+'</aside><div>'+
 (c?'<div class="mc-profile-fields">'+field('section-title','Nom de la section',c.title)+'<label>Disposition<select data-profile-field="viewMode">'+['TABBED_GRID','ROWS','FOLLOW_LAYOUT'].map(v=>'<option '+(c.viewMode===v?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+['pinToTop','showAllTab'].map(k=>'<label><input type="checkbox" data-profile-flag="'+k+'" '+(c[k]?'checked':'')+'>'+({pinToTop:'Épingler la section',showAllTab:'Afficher l’onglet Tous'}[k])+'</label>').join('')+'</div>'+action('Retirer cette section du brouillon','remove-section')+
 '<div class="mc-profile-cards">'+c.folders.map((item,i)=>{const image=safeProfileImage(item.coverImageUrl);return '<div class="mc-profile-tile '+(item.id===folderId?'active':'')+'">'+(image?'<img src="'+esc(image)+'" alt="" loading="lazy">':'<span class="mc-profile-empty">▣</span>')+action(item.title,'folder','data-id="'+esc(item.id)+'"')+'<div>'+action('↑','folder-up','aria-label="Monter '+esc(item.title)+'" data-id="'+esc(item.id)+'" '+(!i?'disabled':''))+action('↓','folder-down','aria-label="Descendre '+esc(item.title)+'" data-id="'+esc(item.id)+'" '+(i===c.folders.length-1?'disabled':''))+'</div></div>';}).join('')+'</div>':'<p>Charge une collection ou crée une section pour commencer.</p>')+
 (f?'<section class="mc-profile-edit"><h3>Personnaliser '+esc(f.title)+'</h3><div class="mc-profile-fields">'+field('title','Nom du dossier',f.title)+['coverImageUrl','heroBackdropUrl','titleLogoUrl','focusGifUrl'].map(k=>field(k,({coverImageUrl:'Affiche',heroBackdropUrl:'Fond',titleLogoUrl:'Logo',focusGifUrl:'GIF'}[k]),f[k])).join('')+
 '<label>Format<select data-profile-field="tileShape">'+['poster','landscape','square'].map(v=>'<option '+(String(f.tileShape).toLowerCase()===v?'selected':'')+'>'+v+'</option>').join('')+'</select></label><label>Déplacer vers<select data-profile-move>'+opts(editor.rows,sectionId)+'</select></label>'+['hideTitle','focusGifEnabled','focusGlowEnabled'].map(k=>'<label><input type="checkbox" data-folder-flag="'+k+'" '+(f[k]?'checked':'')+'>'+({hideTitle:'Masquer le titre',focusGifEnabled:'Animation au focus',focusGlowEnabled:'Lueur de sélection'}[k])+'</label>').join('')+
 '<label>Illustration autonome<select data-profile-style>'+ART_STYLES.map(s=>'<option value="'+s.id+'">'+s.label+'</option>').join('')+'</select></label>'+action('Créer cette affiche','art')+'</div>'+
 '<details><summary>Sources du dossier ('+profileSources(f).length+')</summary><p>Les définitions complètes sont conservées. Modifie le JSON ci-dessous puis valide ; aucune extension n’est installée automatiquement.</p><textarea data-profile-sources rows="8" spellcheck="false">'+esc(JSON.stringify(profileSources(f),null,2))+'</textarea>'+action('Valider les sources','sources')+'</details>'+action('Retirer ce dossier du brouillon','remove-folder')+'</section>':'')+
 '<section class="mc-profile-library"><h3>Ajouter un dossier du catalogue</h3><label>Rechercher<input data-profile-search value="'+esc(query)+'" placeholder="Netflix, acteur, genre…"></label><div class="mc-profile-library-list">'+catalogue().flatMap(cat=>cat.folders.map(f=>({cat,f}))).filter(x=>!query||(x.f.title+' '+x.cat.title).toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))).slice(0,30).map(x=>action(x.f.title+' · '+x.cat.title,'pick','data-cid="'+esc(x.cat.id)+'" data-id="'+esc(x.f.id)+'"')).join('')+'</div><p>30 résultats maximum affichés. Affine la recherche pour trouver un autre dossier.</p></section>'+
 '<details data-profile-update '+(updateOpen?'open':'')+'><summary>Mise à jour et indépendance</summary><p>La mise à jour garde tes sections, dossiers personnels et visuels. Les changements de sources identifiées sont présentés avant application.</p>'+'<label><input type="checkbox" data-profile-refresh-sources '+(refreshSources?'checked':'')+'> Mettre aussi à jour les définitions des sources existantes (sinon : ajouter seulement les éléments manquants)</label>'+action('Préparer la mise à jour du catalogue','update')+action('Remplacer les liens Kaptain par nos ressources','repair')+
 (updatePlan?'<p>'+updatePlan.addedSections.length+' nouvelles sections · '+updatePlan.addedFolders.length+' nouveaux dossiers · '+updatePlan.addedSources.length+' nouvelles sources · '+updatePlan.updatedSources.length+' sources modifiées.</p>'+action('Appliquer cette proposition au brouillon','apply-update'):'')+'</details></div></div>';
 const accountDetails=root.querySelector('.mc-profile-account');
 const updateDetails=root.querySelector('[data-profile-update]');
 accountDetails.addEventListener('toggle',()=>{if(accountDetails.isConnected)accountOpen=accountDetails.open;});
 updateDetails.addEventListener('toggle',()=>{if(updateDetails.isConnected)updateOpen=updateDetails.open;});
 root.querySelectorAll('button, input, select, textarea').forEach(el=>{if(busy)el.disabled=true;});
}
function mount(){
 root=document.createElement('div');root.className='mc-profile-overlay';root.id='mc-profile-editor';root.hidden=true;
 root.innerHTML='<section class="mc-profile-panel" role="dialog" aria-modal="true" aria-labelledby="mc-profile-title"><header><div><span class="mc-studio-overline">MA-COLLECTION · PROFIL COMPLET</span><h2 id="mc-profile-title">Mon profil Kovelyx</h2><p data-profile-summary></p></div>'+action('Fermer','close')+'</header><div data-profile-body></div><p data-profile-status role="status" aria-live="polite"></p></section>';
 document.body.appendChild(root);
 root.addEventListener('keydown',event=>{if(event.key==='Tab'){const nodes=[...root.querySelectorAll('button,input,select,textarea,summary')].filter(el=>!el.disabled&&el.getClientRects().length);const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
 root.addEventListener('click',event=>{const button=event.target.closest('[data-profile-action]');if(button)handle(button);else if(event.target===root)close();});
 root.addEventListener('change',async event=>{
  const el=event.target;try{
   if(el.matches('[data-profile-file]')){const file=el.files[0];if(!file)return;if(file.size>16*1024*1024)throw Error('Fichier supérieur à 16 Mo.');const rows=validateProfile(JSON.parse((await file.text()).replace(/^\uFEFF/,'')));if(checkDiscard()){notice='Fichier chargé dans le brouillon. Les sources et champs inconnus sont conservés.';replace(rows);}return;}
   if(el.matches('[data-profile-refresh-sources]')){
    refreshSources=el.checked;updatePlan=null;draw();return;
   }
   if(el.matches('[data-profile-move]')){const target=el.value;editor.moveFolder(sectionId,folderId,target,editor.section(target).folders.length);sectionId=target;}
   else if(el.dataset.profileField){const k=el.dataset.profileField,v=el.value.trim();if(k==='section-title')editor.updateSection(sectionId,{title:v});else if(k==='viewMode')editor.updateSection(sectionId,{[k]:v});else{if(k.endsWith('Url')&&v&&!safeProfileImage(v))throw Error('Image autonome requise : URL HTTPS d’image ou illustration locale du Studio.');editor.updateFolder(sectionId,folderId,{[k]:v});}}
   else if(el.dataset.profileFlag)editor.updateSection(sectionId,{[el.dataset.profileFlag]:el.checked});
   else if(el.dataset.folderFlag)editor.updateFolder(sectionId,folderId,{[el.dataset.folderFlag]:el.checked});
   else return;
   remember();notice='Brouillon modifié. Aucune donnée distante publiée.';draw();
  }catch(error){notice=error.message;draw();}
 });
 root.addEventListener('input',event=>{if(event.target.matches('[data-profile-search]')){const at=event.target.selectionStart;query=event.target.value;draw();const input=root.querySelector('[data-profile-search]');input.focus();input.setSelectionRange(at,at);}});
 document.addEventListener('keydown',event=>{if(!root.hidden&&event.key==='Escape'){event.preventDefault();close();}});
}
async function handle(button){
 if(busy)return;const action=button.dataset.profileAction,id=button.dataset.id;
 try{
  if(action==='close'){close();return;}
  if(action==='file'){root.querySelector('[data-profile-file]').click();return;}
  if(action==='account'){close();window.MaCollectionAccountUi?.openModal('cloud');return;}
  if(action==='selection'){if(checkDiscard()){const rows=await window.MaCollectionKovelyx.buildExport();notice='Sélection chargée dans le brouillon.';replace(JSON.parse(rows));}return;}
  if(action==='restore'){if(!checkDiscard())return;const draft=JSON.parse(localStorage.getItem('ma_collection_profile_draft_v1')||'null');if(draft?.schema!==1)throw Error('Aucun brouillon local.');notice='Brouillon local restauré. Recharge le profil distant avant de le republier.';replace(draft.rows);return;}
  if(action==='profiles'){profiles=[];busy=true;const response=await window.MaCollectionAccount.cloudFetch('/v1/profiles');if(!response.ok)throw Error('Connexion au compte nécessaire.');const data=await response.json();profiles=data.profiles||[];notice=profiles.length?'Choisis le profil à organiser.':'Aucun profil disponible.';return;}
  if(action==='load'){if(!checkDiscard())return;const profileId=id;if(!profiles.some(p=>p.id===profileId))throw Error('Choisis un profil.');busy=true;const result=await window.MaCollectionCloudPush.readProfile(profileId);notice='Profil chargé et empreinte vérifiée. Les changements restent dans le brouillon.';replace(result.collections,result);return;}
  if(action==='publish'){if(!snapshot)throw Error('Charge d’abord le profil distant.');const rows=editor.export();if(!window.confirm('Remplacer les collections du profil chargé par ce brouillon ? Les autres profils restent conservés.'))return;busy=true;const result=await window.MaCollectionCloudPush.writeProfile(snapshot.profileId,rows,snapshot.head);notice='Profil publié et relu intégralement. Ouvre ce même profil dans Kovelyx pour synchroniser.';replace(result.collections,result);return;}
  if(action==='export'){download('Ma-Collection-Profil-Kovelyx.json',editor.export());notice='JSON exporté, sans identifiants privés.';return;}
  if(action==='section'){sectionId=id;folderId='';}
  else if(action==='folder')folderId=id;
  else if(action==='undo')editor.undo();
  else if(action==='section-up'||action==='section-down')editor.moveSection(id,action==='section-up'?-1:1);
  else if(action==='folder-up'||action==='folder-down'){const i=current().folders.findIndex(f=>f.id===id);editor.moveFolder(sectionId,id,sectionId,i+(action==='folder-up'?-1:1));}
  else if(action==='add-section'){const title=window.prompt('Nom de la nouvelle section');if(!title?.trim())return;sectionId=editor.addSection(title.trim());folderId='';}
  else if(action==='remove-section'){if(window.confirm('Retirer cette section et ses dossiers du brouillon ? Tu peux annuler.'))editor.removeSection(sectionId);}
  else if(action==='remove-folder'){if(window.confirm('Retirer ce dossier du brouillon ? Tu peux annuler.'))editor.removeFolder(sectionId,folderId);}
  else if(action==='pick'){if(!current())throw Error('Crée ou sélectionne une section cible.');const source=catalogue().find(c=>c.id===button.dataset.cid)?.folders.find(f=>f.id===id);if(!source)throw Error('Dossier indisponible.');editor.addFolder(sectionId,source);folderId=source.id;notice='Dossier ajouté avec ses sources et visuels.';}
  else if(action==='art'){const style=root.querySelector('[data-profile-style]').value;editor.updateFolder(sectionId,folderId,{coverImageUrl:makeFolderArt(folder().title,style,String(folder().tileShape).toUpperCase()),hideTitle:true});}
  else if(action==='sources'){const sources=JSON.parse(root.querySelector('[data-profile-sources]').value);if(!Array.isArray(sources))throw Error('Une liste de sources est attendue.');const rows=copy(editor.rows),target=rows.find(c=>c.id===sectionId).folders.find(f=>f.id===folderId);target.sources=sources;delete target.catalogSources;validateProfile(rows,{exporting:true});editor.edit(out=>out.splice(0,out.length,...rows));}
  else if(action==='repair'){const result=repairUpstreamResources(editor.rows,catalogue());editor.edit(out=>out.splice(0,out.length,...result.rows));notice=result.replaced+' liens remplacés par nos ressources ; '+result.removed+' liens sans équivalent retirés. Vérifie l’aperçu.';}
  else if(action==='update'){updateOpen=true;updatePlan={...planProfileUpdate(editor.rows,catalogue(),{updateSources:refreshSources}),base:editor.rows};notice='Proposition prête. Vérifie les compteurs avant de l’appliquer.';}
  else if(action==='apply-update'&&updatePlan?.base===editor.rows){editor.edit(out=>out.splice(0,out.length,...updatePlan.rows));updatePlan=null;notice='Mise à jour appliquée au brouillon. Tu peux annuler avant publication.';}
  remember();
 }catch(error){notice=error.message||'Opération impossible.';}
 finally{busy=false;draw();}
}
function open({account=false,update=false}={}){profiles=[];if(!root)mount();if(!initialized){initialized=true;try{const saved=JSON.parse(localStorage.getItem('ma_collection_profile_draft_v1')||'null');if(saved?.schema===1)editor=new ProfileEditor(saved.rows);}catch{}}returnFocus=document.activeElement;accountOpen=account||update;updateOpen=update;root.hidden=false;notice='Éditeur de profil complet : import local ou lecture de ton compte Kovelyx. Rien n’est publié automatiquement.';draw();root.querySelector('button').focus();if(account&&window.MaCollectionAccount?.status?.().cloudSignedIn)handle(root.querySelector('[data-profile-action=profiles]'));}
function close(){if(busy)return;remember();root.hidden=true;returnFocus?.focus?.();}
window.MaCollectionProfileEditor=Object.freeze({open});
