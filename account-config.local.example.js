/** Copier sous account-config.local.js pour tester le Worker dans un navigateur local. */
window.MA_COLLECTION_ACCOUNT = Object.assign({}, window.MA_COLLECTION_ACCOUNT || {}, {
  enabled: true,
  cloudUrl: 'https://kovelyx-cloud.votre-compte.workers.dev',
});
