import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = path => readFileSync(resolve(root,path),"utf8");
const html = read("index.html");
const app = read("app.js");
const destination = read("destination-picker.js");
const local = read("kovelyx-export.js");
const styles = read("style.css");
const withoutComments = html.replace(/<!--[^]*?-->/g,"");

// Aucun bouton, compteur, support ni connexion à l'ancien service de comptes.
// Nuvio est maintenant un choix d'export JSON manuel autorisé par l'utilisateur.
const expectedNuvioTitle = 'title="Choisir Nuvio ou Kovelyx pour importer la sélection"';
assert(withoutComments.includes(expectedNuvioTitle), "Le choix Nuvio / Kovelyx doit rester visible");
assert(!/nuvio/i.test(withoutComments.replace(expectedNuvioTitle,"")),
  "Ancien branding ou intégration Nuvio détecté hors du choix d'export explicite");
assert(!/telemetry-icon|visitor-count|collections-generated-count/i.test(withoutComments), "Compteur toujours visible");
assert(!/countapi\.mileshilliard\.com|MaCollectionTelemetry/.test(app), "Compteur distant encore chargé");
assert(!/NuvioPush|api\.nuvio\.tv/.test(app + destination + local + withoutComments),
  "Ancien moteur d'envoi distant détecté");
assert(!/\.telemetry-icon-btn|\.telemetry-tooltip/.test(styles), "Ancien CSS des statistiques détecté");
assert(withoutComments.includes('id="btn-import-kovelyx"'),"Bouton import Kovelyx manquant");
assert(destination.includes('MaCollectionImportStudio.open("kovelyx"'),
  "La destination principale n'ouvre pas l'assistant Kovelyx");
assert(local.includes('http://127.0.0.1:38761'),"Pont local Kovelyx non configuré");
assert(local.includes('/health') && local.includes('/import'),"Sonde ou POST d'import manquant");
assert(!/nuvio-push\.js|profile-studio\.js/.test(withoutComments),
  "Ancienne connexion aux comptes encore chargée");
for (const match of withoutComments.matchAll(/<script\s+[^>]*src="([^"]+)"/g)) {
  const src=match[1].split("?")[0];
  if (/^https?:/.test(src)) continue;
  assert(existsSync(resolve(root,src)), "Script JS local manquant : " + src);
}
for (const src of ["style.css", "assets/kovelyx-logo.svg", "locales/fr.json", "locales/site-fr.json"]) {
  assert(existsSync(resolve(root,src)), "Ressource essentielle manquante : " + src);
}
// Ne jamais perdre les liens API ou activer une inscription factice.
const importStudio = read("import-studio.js");
const accountConfig = read("account-config.js");
const accountUi = read("account-ui.js");
const accountVault = read("account-vault.js");
for (const url of [
  "https://www.themoviedb.org/settings/api",
  "https://mdblist.com/preferences/",
  "https://alldebrid.com/apikeys/",
  "https://real-debrid.com/apitoken",
]) {
  assert(importStudio.includes(url), "Lien API officiel manquant : " + url);
  assert(app.includes(url), "Lien API avancé manquant : " + url);
}
assert(withoutComments.includes('id="account-view-cloud"'),"Page de compte web manquante");
assert(withoutComments.includes('id="account-cloud-signup"'),"Bouton d'inscription manquant");
assert(withoutComments.includes('id="account-cloud-login"'),"Bouton de connexion manquant");
assert(accountUi.includes("cloudConfigured()"),"Inscription non conditionnée par un serveur réel");
assert(accountConfig.includes('sb_secret_'),"Les clés de serveur secrètes ne sont pas filtrées");
assert(accountVault.includes("/auth/v1/signup") && accountVault.includes("/auth/v1/token"),
  "L'inscription et la connexion doivent utiliser le backend configuré");
assert(accountVault.includes("ma_collection_vaults"),"Coffre cloud protégé introuvable");
assert(existsSync(resolve(root,"docs/sql/ma_collection_vaults.sql")),"Politique RLS du coffre absente");

assert(!/integrations\/kaptain\/collections/i.test(app + withoutComments),
  "Import encore lié à l'ancienne intégration Kaptain");
assert(!/Friends of Kaptain/i.test(app), "Ancien branding visible de Kaptain");
console.log("QA_INDEPENDANCE_OK : import Kovelyx local et export JSON sans suivi ni compte tiers");
