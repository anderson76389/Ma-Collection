/* Migration non destructive des préférences historiques vers Ma-Collection.
 * Les anciennes clés restent disponibles pour permettre un retour arrière.
 * Copie une seule fois afin qu'une déconnexion ou une suppression de données
 * dans la nouvelle version ne restaure jamais une ancienne session.
 */
(() => {
  'use strict';

  function migrate(storage, marker) {
    try {
      if (storage.getItem(marker) === '1') return;
      const keys = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith('kaptain_')) keys.push(key);
      }
      for (const oldKey of keys) {
        const newKey = 'ma_collection_' + oldKey.slice('kaptain_'.length);
        if (storage.getItem(newKey) !== null) continue;
        const value = storage.getItem(oldKey);
        if (value !== null) storage.setItem(newKey, value);
      }
      storage.setItem(marker, '1');
    } catch (err) {
      console.warn('[Ma-Collection] Migration de stockage différée :', err);
    }
  }

  if (typeof localStorage !== 'undefined') {
    migrate(localStorage, 'ma_collection_local_migrated_v1');
  }
  if (typeof sessionStorage !== 'undefined') {
    migrate(sessionStorage, 'ma_collection_session_migrated_v1');
  }

  // Compatibilité avec une éventuelle configuration locale ancienne.
  if (window.KAPTAIN_ACCOUNT && !window.MA_COLLECTION_ACCOUNT) {
    window.MA_COLLECTION_ACCOUNT = window.KAPTAIN_ACCOUNT;
  }
})();
