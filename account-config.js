/**
 * Ma-Collection : configuration facultative de sauvegarde chiffrée.
 *
 * Local encrypted autosave (optional). Visitors can skip it and use the site
 * exactly as before. Cloud sync fields stay empty until a separate free
 * Supabase project is wired up later.
 *
 * Never put service-role keys here. Anon key only, from a SEPARATE
 * Supabase project (ni une plateforme multimédia tierce).
 */
window.MA_COLLECTION_ACCOUNT = Object.assign({
  enabled: true,
  // When enabled without supabaseUrl/anonKey, local encrypted vault still works
  // (passphrase-protected localStorage). Cloud sync needs the fields below.
  supabaseUrl: '',
  supabaseAnonKey: '',
  // Optional force: ?account=1 / ?account=0 (see account-vault.js).
  showUiWhenDisabled: false,
}, window.MA_COLLECTION_ACCOUNT || {});
