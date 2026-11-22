/* Ma-Collection : mur d'affiches autonome — une seule image locale.
 * Découpe visuelle de assets/mur-affiches.webp en cartes indépendantes :
 * aucun chargement d'image Kaptain, aucune API et aucune copie de la capture.
 */
(() => {
  'use strict';
  const COLUMNS = 11;
  const ROWS = 6;
  const CROPS = [
    [0, 0], [20, 0], [40, 0], [60, 0], [80, 0], [100, 0],
    [0, 48], [25, 48], [50, 48], [75, 48], [100, 48],
    [0, 100], [20, 100], [40, 100], [60, 100], [80, 100], [100, 100]
  ];
  function init() {
    const host = document.querySelector('#title-screen-overlay .suite-wall');
    if (!host || host.querySelector('.mc-wall-plane')) return;
    const plane = document.createElement('div');
    plane.className = 'mc-wall-plane';
    plane.setAttribute('aria-hidden', 'true');
    const fragment = document.createDocumentFragment();
    for (let columnIndex = 0; columnIndex < COLUMNS; columnIndex++) {
      const column = document.createElement('div');
      column.className = 'mc-wall-column';
      column.style.setProperty('--col-offset', ((columnIndex % 4) - 1.5) * 31 + 'px');
      for (let row = 0; row < ROWS; row++) {
        const card = document.createElement('div');
        const index = (columnIndex * 13 + row * 7 + columnIndex * row * 3) % CROPS.length;
        const [x, y] = CROPS[index];
        card.className = 'mc-wall-card mc-wall-poster';
        card.style.setProperty('--crop-x', x + '%');
        card.style.setProperty('--crop-y', y + '%');
        card.dataset.crop = String(index);
        column.appendChild(card);
      }
      fragment.appendChild(column);
    }
    plane.appendChild(fragment);
    host.insertBefore(plane, host.firstChild);
    host.classList.add('mc-wall-with-cards', 'mc-wall-local-posters');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
