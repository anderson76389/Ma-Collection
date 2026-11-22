/** Icônes vectorielles du Studio, intégrées et hébergées dans Ma-Collection.
 * Aucun paquet, CDN ni dépendance de polices ou du site de référence.
 */
const shapes=Object.freeze({
  accueil:'<path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/>',
  organisation:'<rect x="3" y="4" width="18" height="5" rx="1.5"/><rect x="3" y="11" width="18" height="4" rx="1.5"/><rect x="3" y="17" width="18" height="4" rx="1.5"/>',
  apercu:'<rect x="2.5" y="4.5" width="14" height="10" rx="2"/><path d="M7 18.5h5m-2.5-4v4"/><rect x="17.5" y="8" width="4" height="11.5" rx="1"/>',
  recherche:'<circle cx="10.6" cy="10.6" r="7.1"/><path d="m16 16 5 5"/>',
  affiches:'<rect x="3" y="2.5" width="18" height="19" rx="2"/><path d="m3 16 5.5-5 3.5 3 3-2 6 5"/><circle cx="15.5" cy="7.8" r="1.4"/>',
  bibliotheque:'<rect x="2.5" y="4" width="7" height="16" rx="1.5"/><rect x="11" y="4" width="10.5" height="7" rx="1.5"/><rect x="11" y="12.5" width="10.5" height="7.5" rx="1.5"/>',
  'affiches-fr':'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9.2 7.1 7 12h5M8 10.5h3"/><path d="M14.7 9h3M14.7 12h3M7 16h10"/>',
  outils:'<path d="M3 7h18M3 17h18"/><circle cx="8" cy="7" r="2.5" fill="currentColor" stroke="none"/><circle cx="16" cy="17" r="2.5" fill="currentColor" stroke="none"/>',
  modifications:'<path d="M5 4v16M19 4v16M10 12h4"/><path d="m12 9 3 3-3 3"/><path d="M2.5 4H8M2.5 20H8M16 4h5.5M16 20h5.5"/>',
  extensions:'<path d="M10 2.8h4v5.4h5.2v4H14V19h-4v-6.8H4.8v-4H10z"/><path d="M18 19h3m-1.5-1.5v3"/>',
  'import-collection':'<path d="M12 3v12m-4-4 4 4 4-4"/><path d="M4.5 16v4h15v-4"/>',
  partage:'<circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/>',
  profils:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2.5a8 8 0 0 1 16 0V21"/>',
  parametres:'<circle cx="12" cy="12" r="3.2"/><path d="m10 2 .4 2.2 3.2 0L14 2m5 3 2 2-1.5 1.5 1 3 2.5.5v3l-2.5.4-1 3L21 20l-2 2-2-1.6-3 .7L13.5 23h-3L10 21.1l-3-.7L5 22l-2-2 1.5-1.6-1-3L1 15v-3l2.5-.5 1-3L3 7l2-2 2 1.5 3-.8L10 2"/>'
});
export function studioIcon(id){
  const paths=shapes[id]||shapes.accueil;
  return '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" '+
   'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" '+
   'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';
}
