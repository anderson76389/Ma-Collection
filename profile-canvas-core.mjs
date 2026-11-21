/** Reorganisation du canvas Kovelyx sans modifier les sources ni les visuels. */
export function moveCanvasRow(editor, sourceId, beforeId){
  if(sourceId===beforeId) return editor.rows;
  return editor.edit(rows=>{
    const src=rows.findIndex(r=>r.id===sourceId);
    if(src<0||!rows.some(r=>r.id===beforeId)) throw Error('Rangée introuvable.');
    const [row]=rows.splice(src,1);
    rows.splice(rows.findIndex(r=>r.id===beforeId),0,row);
  });
}
export function moveCanvasFolder(editor, sourceSectionId, folderId, targetSectionId, beforeFolderId=null){
  const source=editor.section(sourceSectionId),target=editor.section(targetSectionId);
  if(!source||!target) throw Error('Section introuvable.');
  const sourceIndex=source.folders.findIndex(f=>f.id===folderId);
  if(sourceIndex<0) throw Error('Dossier introuvable.');
  if(beforeFolderId===folderId&&source===target) return editor.rows;
  const rawIndex=beforeFolderId===null
    ? target.folders.length
    : target.folders.findIndex(f=>f.id===beforeFolderId);
  if(rawIndex<0) throw Error('Dossier cible introuvable.');
  const adjusted=source===target&&sourceIndex<rawIndex?rawIndex-1:rawIndex;
  return editor.moveFolder(sourceSectionId,folderId,targetSectionId,adjusted);
}
