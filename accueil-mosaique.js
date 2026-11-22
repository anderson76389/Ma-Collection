/* Ma-Collection : mur d'affiches 100% local, sans CDN, API ni chargement Kaptain.
 * Les cartes prennent leurs images dans assets/genres et restent décoratives.
 */
(() => {
  'use strict';
  const ART = ["assets/genres/017ebef5870c540a113b091f.webp","assets/genres/07cce994fd9c9309944e63c4.webp","assets/genres/0b09702b256e9a97653ee60b.webp","assets/genres/2e3d08c38a972aa4b8c4000a.webp","assets/genres/316f8d66ea137607accb2686.webp","assets/genres/33c782170f89a60d82905fff.webp","assets/genres/37dd08c515790b3e85bd30cf.webp","assets/genres/3ca047520930cca9e6a4087f.webp","assets/genres/49c081d8c4f20a8283620b12.webp","assets/genres/544d17af2289e1bfc607b1b3.webp","assets/genres/5a231a15fd8786008fa00134.webp","assets/genres/61051d345403db3cfd6992de.webp","assets/genres/7638bdf6b721fb1d6e92040a.webp","assets/genres/7744134e235e3ace5bc21615.webp","assets/genres/8a6b119d539d6c17d01f5943.webp","assets/genres/908dfeaa0c89e970abb9b394.webp","assets/genres/b333db419b19d8e83eacd73b.webp","assets/genres/c3d844f7c18deb6f57d81e0c.webp","assets/genres/d20cc0b211a7f6291c218a5c.webp","assets/genres/d4c2f83e3d81de852074cac0.webp","assets/genres/d68bb9d71e9cc87af6b5f5eb.webp","assets/genres/d79f56bac3a8002f5a44d8ee.webp","assets/genres/e0826ba0932e8ca7b99e3c55.webp","assets/genres/fb9b8682fb41f32746aa9ce5.webp","assets/genres/fffe9d9eec02cc44f66d1da8.webp"].slice(0,16);
  const COLUMNS = 11;
  const ROWS = 6;
  function init() {
    const host = document.querySelector('#title-screen-overlay .suite-wall');
    if (!host || host.querySelector('.mc-wall-plane')) return;
    const plane = document.createElement('div');
    plane.className = 'mc-wall-plane';
    plane.setAttribute('aria-hidden', 'true');
    const fragment = document.createDocumentFragment();
    for (let col = 0; col < COLUMNS; col++) {
      const column = document.createElement('div');
      column.className = 'mc-wall-column';
      column.style.setProperty('--col-offset', ((col % 4) - 1.5) * 31 + 'px');
      for (let row = 0; row < ROWS; row++) {
        const card = document.createElement('div');
        card.className = 'mc-wall-card';
        const picture = document.createElement('img');
        picture.src = ART[(col * 7 + row * 11 + col * row * 3) % ART.length];
        picture.alt = '';
        picture.decoding = 'async';
        picture.loading = row < 2 ? 'eager' : 'lazy';
        picture.setAttribute('aria-hidden', 'true');
        card.appendChild(picture);
        column.appendChild(card);
      }
      fragment.appendChild(column);
    }
    plane.appendChild(fragment);
    host.insertBefore(plane, host.firstChild);
    host.classList.add('mc-wall-with-cards');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
