/**
 * Organisateur visuel original Ma-Collection. Aucun asset/code ni API Kaptain.
 * Le canvas travaille sur le brouillon Studio ; il ne touche jamais au compte.
 */
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));
const attrs=value=>escapeHtml(value);
const isUsableImage=url=>typeof url==='string'&&url.length<=8192&&
  (/^https:\/\/[^/\s]+\/[^<>]*$/i.test(url)||/^data:image\/svg\+xml;base64,[\w+/=]+$/.test(url)||
   /^(?:\.?\/)?assets\/[\w.\/-]+$/i.test(url))&&
  !/(?:kaptain\.stream|imkaptain|kaptainscollection)/i.test(url);

export function canvasRows(draft,{activeOnly=false,expanded=[],limit=8}={}){
  const opened=new Set(expanded);
  const perRow=Number.isInteger(limit)&&limit>=1?Math.min(limit,40):8;
  return (draft?.sections||[]).map((section,index,sections)=>{
    const folders=Array.isArray(section.folders)?section.folders:[];
    const active=folders.filter(f=>f.enabled&&Array.isArray(f.selectedKeys)&&f.selectedKeys.length>0);
    const shown=activeOnly?active:folders;
    const full=opened.has(section.id);
    return {
      id:section.id,label:section.label,enabled:!!section.enabled,
      position:index,last:index===sections.length-1,
      activeCount:section.enabled?active.length:0,total:folders.length,
      displayed:full?shown:shown.slice(0,perRow),
      omitted:full?0:Math.max(0,shown.length-perRow),expanded:full,
      canCollapse:shown.length>perRow,filterCount:shown.length
    };
  });
}
export function renderStudioCanvas(draft,{activeOnly=false,expanded=[],resolveImage=url=>url}={}){
  const rows=canvasRows(draft,{activeOnly,expanded});
  const selected=rows.reduce((total,row)=>total+row.activeCount,0);
  const summary='<header class="mc-cinema-head">'+
    '<div><span class="mc-cinema-kicker">STUDIO · VUE VISUELLE</span>'+
    '<h2>Organiser mon écran d’accueil</h2>'+
    '<p>Déplace tes rangées et tes dossiers, active les contenus et modifie les affiches comme sur ton lecteur.</p></div>'+
    '<div class="mc-cinema-overview-actions">'+
    '<button type="button" data-action="canvas-toggle-active" aria-pressed="'+activeOnly+'">'+
      (activeOnly?'Afficher tous les dossiers':'Actifs uniquement')+'</button>'+
    '<button type="button" data-action="canvas-open-preview">Aperçu TV / mobile</button>'+
    '<button type="button" data-action="canvas-open-list">Édition détaillée</button></div></header>'+
    '<div class="mc-cinema-stats" aria-label="Résumé du brouillon">'+
    '<span><strong>'+rows.filter(row=>row.enabled).length+'</strong> rangées actives</span>'+
    '<span><strong>'+selected+'</strong> dossiers actifs</span>'+
    '<span><strong>'+rows.reduce((n,row)=>n+row.total,0)+'</strong> dossiers disponibles</span>'+
    '</div>';
  const panels=rows.map(row=>{
    const rowHeader='<header class="mc-cinema-row-header">'+
      '<div class="mc-cinema-row-label">'+
      '<span class="mc-cinema-drag" aria-hidden="true">⠿</span>'+
      '<div><h3>'+escapeHtml(row.label)+'</h3><small>'+row.activeCount+' actif'+
       (row.activeCount>1?'s':'')+' sur '+row.total+' dossiers</small></div></div>'+
      '<div class="mc-cinema-row-actions">'+
      '<label class="mc-cinema-switch" title="Activer ou désactiver la rangée">'+
       '<input type="checkbox" data-section-toggle="'+attrs(row.id)+'" '+(row.enabled?'checked':'')+
       ' aria-label="Activer '+attrs(row.label)+'"><span>Visible</span></label>'+
      '<button type="button" data-action="canvas-section-up" data-section="'+attrs(row.id)+
       '" aria-label="Monter '+attrs(row.label)+'" '+(row.position===0?'disabled':'')+'>↑</button>'+
      '<button type="button" data-action="canvas-section-down" data-section="'+attrs(row.id)+
       '" aria-label="Descendre '+attrs(row.label)+'" '+(row.last?'disabled':'')+'>↓</button>'+
      '<button type="button" class="mc-cinema-edit-row" data-action="canvas-edit-row" data-section="'+attrs(row.id)+'">Modifier la rangée</button>'+
      '</div></header>';
    const tiles=row.displayed.map((folder,index)=>{
      const active=row.enabled&&folder.enabled&&Array.isArray(folder.selectedKeys)&&folder.selectedKeys.length>0;
      const raw=String(folder.artwork?.coverImageUrl||'');
      const resolved=resolveImage(raw);
      const cover=isUsableImage(resolved)?'<img src="'+attrs(resolved)+'" alt="" loading="lazy" decoding="async">':
        '<span class="mc-cinema-fallback" aria-hidden="true">▣</span>';
      const sourceCount=Array.isArray(folder.selectedKeys)?folder.selectedKeys.length:0;
      return '<article class="mc-cinema-tile '+(active?'is-active':'is-inactive')+'" data-folder-id="'+attrs(folder.id)+'">'+
        '<button type="button" class="mc-cinema-art" data-action="canvas-art" data-section="'+attrs(row.id)+
          '" data-id="'+attrs(folder.id)+'" aria-label="Personnaliser l’affiche de '+attrs(folder.label)+'">'+
          cover+'<span class="mc-cinema-art-scrim"></span><span class="mc-cinema-art-title">'+escapeHtml(folder.label)+'</span>'+
          '</button>'+
        '<div class="mc-cinema-tile-foot"><span title="'+sourceCount+' sources sélectionnées">'+sourceCount+' sources</span>'+
        '<label title="Activer le dossier"><input type="checkbox" data-canvas-folder-toggle="'+attrs(folder.id)+
          '" data-section="'+attrs(row.id)+'" '+(folder.enabled?'checked':'')+
          ' aria-label="Activer '+attrs(folder.label)+'"></label></div>'+
        '<div class="mc-cinema-tile-arrows">'+
        '<button type="button" data-action="canvas-folder-up" data-section="'+attrs(row.id)+'" data-id="'+attrs(folder.id)+
          '" aria-label="Déplacer '+attrs(folder.label)+' à gauche" '+(index===0?'disabled':'')+'>←</button>'+
        '<button type="button" data-action="canvas-folder-down" data-section="'+attrs(row.id)+'" data-id="'+attrs(folder.id)+
          '" aria-label="Déplacer '+attrs(folder.label)+' à droite" '+(index===row.total-1?'disabled':'')+'>→</button>'+
        '</div></article>';
    }).join('');
    const expand=row.canCollapse?'<button type="button" class="mc-cinema-more" data-action="canvas-expand" data-section="'+attrs(row.id)+
      '">'+(row.expanded?'Réduire la rangée':'Afficher les '+row.omitted+' autres dossiers')+'</button>':'';
    return '<section class="mc-cinema-row '+(row.enabled?'':'is-disabled')+'" data-drag-kind="section" data-drag-id="'+attrs(row.id)+'">'+
      rowHeader+'<div class="mc-cinema-strip">'+(tiles||'<p class="mc-cinema-empty">Aucun dossier à afficher.</p>')+'</div>'+expand+'</section>';
  }).join('');
  return '<div class="mc-cinema-organizer">'+summary+panels+
    '<p class="mc-cinema-note">Les changements restent dans ton brouillon. Utilise « Appliquer à ma collection » pour les valider. Pour déplacer des rangées, glisse leur en-tête ou utilise les flèches ; aucun dossier ni aucune source n’est supprimé.</p></div>';
}
