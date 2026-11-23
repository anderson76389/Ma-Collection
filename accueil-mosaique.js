/* Mur d'affiches Ma-Collection.
 * Source : catalogues déjà intégrés à Ma-Collection, et non Kaptain.
 * Les affiches viennent des copies Ma-Art sur notre CDN Cloudflare :
 * en cas de réseau absent/erreur, chaque carte garde son fond LOCAL.
 */
(() => {
  'use strict';

  const COLUMNS = 9;
  const ROWS = 5;
  const TOTAL = COLUMNS * ROWS;
  const CROPS = [
    [0,0],[20,0],[40,0],[60,0],[80,0],[100,0],
    [0,48],[25,48],[50,48],[75,48],[100,48],
    [0,100],[20,100],[40,100],[60,100],[80,100],[100,100]
  ];
  const POSTER_PATH = /^\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i;

  const MA_ART_CDN = 'https://ma-art-images-static.mailpromahe.workers.dev/';

  function pickPosters() {
    const catalog = window.PREVIEW_POSTERS;
    if (!catalog || typeof catalog !== 'object') return [];
    const groups = Object.entries(catalog)
      .filter(([, posters]) => Array.isArray(posters) && posters.length)
      .slice(0, 64);
    const unique = new Set();
    const posters = [];

    // Balayage par rangées : évite un mur composé d'un seul genre ou titre.
    for (let rank = 0; rank < 12 && posters.length < TOTAL; rank++) {
      for (let group = 0; group < groups.length && posters.length < TOTAL; group++) {
        const path = groups[group][1][rank];
        if (typeof path !== 'string' || !POSTER_PATH.test(path) || unique.has(path)) continue;
        unique.add(path);
        posters.push(path);
      }
    }
    return posters;
  }

  function init() {
    const host = document.querySelector('#title-screen-overlay .suite-wall');
    if (!host || host.querySelector('.mc-wall-plane')) return;

    const posters = (typeof navigator === 'undefined' || navigator.onLine !== false)
      ? pickPosters() : [];
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

        const path = posters[columnIndex * ROWS + row];
        if (path) {
          const img = document.createElement('img');
          img.className = 'mc-wall-art';
          img.alt = '';
          img.width = 342;
          img.height = 513;
          img.loading = 'lazy';
          img.decoding = 'async';
          img.fetchPriority = 'low';
          img.addEventListener('load', () => card.classList.add('mc-wall-loaded'), { once:true });
          img.addEventListener('error', () => img.remove(), { once:true });
          const archivedPath = window.MA_ART_HOME_POSTERS?.[path];
          if (typeof archivedPath === 'string' &&
              /^media\/image[.]tmdb[.]org\/[a-f0-9]{24}[.](?:jpg|jpeg|png|webp)$/i.test(archivedPath)) {
            img.src = MA_ART_CDN + archivedPath;
            card.appendChild(img);
          }
        }
        column.appendChild(card);
      }
      fragment.appendChild(column);
    }
    plane.appendChild(fragment);
    host.insertBefore(plane, host.firstChild);
    host.classList.add('mc-wall-with-cards', 'mc-wall-local-posters');
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
