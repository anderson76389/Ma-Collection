import {studioIcon} from './studio-icons.mjs?v=2';
/**
 * Navigation du Studio Ma-Collection, conçue indépendamment du site de référence.
 * Les identifiants métier (onglets) sont les mêmes que les outils existants.
 */
export const STUDIO_WORKSPACE_GROUPS = Object.freeze([
  {
    title: 'Espace de travail',
    items: [
      ['accueil', 'Vue d’ensemble', '⌂'],
      ['organisation', 'Sections et dossiers', '▤'],
      ['apercu', 'Aperçu TV et mobile', '▣'],
      ['recherche', 'Recherche globale', '⌕'],
    ],
  },
  {
    title: 'Personnalisation',
    items: [
      ['affiches', 'Affiches et sources', '▧'],
      ['bibliotheque', 'Bibliothèque visuelle', '◫'],
      ['logos-ma-art', 'Logos Ma-Art', '◈'],
      ['mes-creations', 'Mes créations', '▥'],
      ['affiches-fr', 'Affiches françaises', '◈'],
      ['outils', 'Modifications en lot', '☷'],
      ['modifications', 'Avant / Après', '⇄'],
    ],
  },
  {
    title: 'Gestion de ma collection',
    items: [
      ['extensions', 'Extensions', '⊞'],
      ['import-collection', 'Importer et diagnostiquer', '⇩'],
      ['partage', 'Partager et transférer', '⇧'],
      ['profils', 'Profils et sauvegardes', '♙'],
      ['parametres', 'Préférences', '⚙'],
    ],
  },
]);
export const STUDIO_WORKSPACE_TITLES = Object.freeze(
  Object.fromEntries(STUDIO_WORKSPACE_GROUPS.flatMap(group =>
    group.items.map(([id, title]) => [id, title]))),
);
export function studioNavigationHtml(){
  return '<nav class="mc-studio-tabs" aria-label="Fonctions du Studio" role="tablist">'+
    '<div class="mc-studio-side-brand" aria-hidden="true"><span class="mc-studio-side-mark">M</span>'+
    '<span><strong>Ma-Collection</strong><small>Studio indépendant</small></span></div>'+
    STUDIO_WORKSPACE_GROUPS.map(group =>
      '<div class="mc-studio-nav-group">'+
      '<div class="mc-studio-nav-caption" aria-hidden="true">'+group.title+'</div>'+
      group.items.map(([id,label,icon])=>
        '<button type="button" role="tab" data-tab="'+id+'" aria-selected="false" '+
        'aria-controls="mc-studio-content" title="'+label+'">'+
        '<span class="mc-studio-nav-icon" aria-hidden="true">'+studioIcon(id)+'</span><span>'+label+'</span></button>'
      ).join('')+'</div>'
    ).join('')+'</nav>';
}
