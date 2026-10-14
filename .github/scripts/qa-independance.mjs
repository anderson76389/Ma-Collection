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
assert(!/nuvio/i.test(withoutComments), "Ancienne mention visible dans index.html");
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
console.log("QA_INDEPENDANCE_OK : import Kovelyx local et export JSON sans suivi ni compte tiers");
