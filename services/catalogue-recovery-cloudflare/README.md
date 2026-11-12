# Ma-Collection · Secours TMDB 100 % Cloudflare Workers

Ce service fournit les **vrais identifiants films/séries et leur ordre**
à partir des **261 instantanés TMDB** déjà conservés dans Ma-Collection.
Il n'a besoin d'aucun VPS, Docker, D1, KV, R2, appel à Kaptain ni API TMDB.

## Architecture

- Un **Worker Cloudflare natif** (worker.mjs), indépendant du Worker des comptes Kovelyx.
- Un binding **Workers Static Assets**, créé uniquement à partir des archives
  versionnées et validées SHA-256 par prepare-assets.mjs.
- Le Worker s'exécute **avant toutes les ressources** (run_worker_first = true).
  Ainsi, les JSON internes ne sont pas accessibles directement par URL.
- Chaque liste restituée est à nouveau contrôlée avec WebCrypto SHA-256.
- Les requêtes sont en lecture seule : GET, HEAD, OPTIONS. Aucun secret.

## Tests automatiques

Dans la branche principale, le workflow
**Valider le secours TMDB Cloudflare Worker natif** teste :
la génération des 261 fichiers, les sommes SHA-256, les erreurs 404/405/503,
la pagination, la liste manquante, la build Wrangler et le vrai runtime local.

Sur une copie complète de Ma-Collection (Node.js 22+) :

    node --test tests/cloudflare-catalogue-recovery.test.mjs
    node services/catalogue-recovery-cloudflare/prepare-assets.mjs
    npx --yes wrangler@4.156.0 deploy --dry-run --config services/catalogue-recovery-cloudflare/wrangler.toml
    npx --yes wrangler@4.156.0 dev --local --config services/catalogue-recovery-cloudflare/wrangler.toml

## Déployer depuis GitHub dans ton propre compte Cloudflare

Le workflow de déploiement **est manuel**. Rien n'est déployé automatiquement
quand du code est fusionné, pour éviter toute modification involontaire.

1. Ouvre les secrets Actions du dépôt **Ma-Collection** dans GitHub.
   Ajoute CLOUDFLARE_ACCOUNT_ID et CLOUDFLARE_API_TOKEN comme secrets.
   Même si ces secrets existent dans Kovelyx ou Ma-Art, ils ne sont PAS
   partagés automatiquement entre dépôts. Ne les envoie jamais dans un chat.
2. Le jeton Cloudflare doit permettre de créer/mettre à jour les Workers du
   compte choisi ; utilise un jeton à portée restreinte, pas une clé globale.
3. Dans Actions, lance **Déployer manuellement le Worker de secours TMDB sur Cloudflare**
   et coche publish. Le job refait les tests et ne déploie qu'en cas de succès.
4. Consulte dans les logs de Wrangler **l'URL workers.dev réellement attribuée**
   (elle dépend du sous-domaine de ton compte). Vérifie les endpoints ci-dessous.

## Si le déploiement affiche « No access to the specified resource »

L'exécution GitHub du **12 novembre 2026, 22:09 UTC** a réussi les 10 tests
et préparé 261 listes, puis Cloudflare a refusé l'endpoint
`/accounts/{account_id}/workers/scripts/ma-collection-catalogues/assets-upload-session`.
C'est un **refus d'autorisation** : modifier les listes, les images ou le code du
Worker ne peut pas réparer les droits d'un token.

1. Dans Cloudflare, ouvrir le **compte précis** qui devra héberger
   `ma-collection-catalogues` et vérifier son **Account ID**.
   Reporter cet ID dans le secret GitHub `CLOUDFLARE_ACCOUNT_ID` de
   **Ma-Collection** (pas uniquement dans les secrets de Kovelyx).
2. Dans **Manage Account → API Tokens** ou **My Profile → API Tokens**,
   créer un jeton dédié au compte. Le droit minimal de l'endpoint de
   téléversement est **Account → Workers Scripts → Write/Edit**.
   Dans les rôles Workers granulaires, un Worker **à créer** peut nécessiter
   le rôle **Workers Admin au niveau du produit** pour ce compte ; un Worker
   existant peut être déployé avec **Workers Editor** sur ce Worker.
   Ne pas accorder de permissions de zones, D1, R2 ou KV sans besoin réel.
3. Mettre le **nouveau jeton** dans le secret GitHub
   `CLOUDFLARE_API_TOKEN` du dépôt **Ma-Collection**, puis relancer
   l'action manuelle en cochant `publish`. Ne jamais coller le jeton dans
   les logs, les commits ou une conversation.
4. Confirmer le succès **uniquement** si l'action relit bien les
   **261 listes** depuis l'URL `workers.dev` publiée. Si Cloudflare refuse
   encore, examiner le message d'erreur exact avant tout changement.

Voir la [documentation Cloudflare sur les droits Workers](https://developers.cloudflare.com/workers/authorization/workers/)
et [les jetons CI GitHub](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).

Le Worker s'appelle **ma-collection-catalogues**, différent de
**kovelyx-cloud** et du Worker des images Ma-Art. Il n'utilise aucune base D1
et ne modifie aucune image, donnée de compte ou catalogue actif.

## Endpoints de lecture

- /health ou /v1/status : 261 disponibles, 262 attendues, ID absent.
- /v1/tmdb/lists : IDs et empreintes de toutes les listes récupérables.
- /v1/tmdb/lists/8659010?offset=0&limit=50 : films/séries dans l'ordre.
- /v1/tmdb/lists/8659010?type=movie&limit=100 : uniquement les films.
- /v1/dependencies : références Trakt/addons toujours sous contrôle de tiers.

Si une archive a disparu ou a été altérée, le Worker **refuse le contenu**
(HTTP 503). La liste 8690687 n'est toujours pas archivée ; elle n'est pas
remplacée par une sélection approximative.

## Limites et indépendance

Ce Worker ne devient pas automatiquement un addon Kovelyx/Stremio : les
instantanés contiennent des IDs, **pas des titres, affiches, résumés ni
sources vidéo**. L'intégration native et les sources Trakt nécessitent
encore un travail distinct et testé. Le site actuel n'est pas reconfiguré.

Un Worker Cloudflare n'est pas une garantie de fonctionnement éternel :
les règles, quotas et disponibilités du fournisseur peuvent changer.
Conserve le service Docker déjà présent et des ZIP hors de GitHub/Cloudflare
afin de pouvoir migrer vers un autre hébergeur en cas de panne.

## Validation réelle après chaque publication (nouveau)

Le workflow manuel conserve l'URL exacte `workers.dev` que Wrangler vient
de publier. Il la vérifie avant de déclarer la publication réussie :

- `/health` et `/v1/dependencies` doivent correspondre à l'inventaire Git ;
- toutes les 261 listes sont **relues depuis le Worker public**, y compris
  leurs différentes pages, avec comparaison **film/série, identifiant et ordre** ;
- les empreintes annoncées doivent correspondre aux snapshots originaux ;
- la liste 8690687 doit toujours signaler son absence (HTTP 503) ;
- les fichiers internes `/_mc_data/*` doivent rester inaccessibles (HTTP 404) ;
- le domaine doit correspondre exactement au Worker
  `ma-collection-catalogues.*.workers.dev` publié par Wrangler.

Si ces vérifications échouent, **l'action GitHub échoue** : ne pas interpréter
le succès de `wrangler deploy` comme une preuve que les listes sont lisibles.
Un déploiement accepté par Cloudflare peut néanmoins déjà être en ligne ;
l'échec du contrôle n'annule pas automatiquement la publication.
Aucun jeton n'est transmis à la vérification HTTP, et les profils Kovelyx ne
sont jamais lus. Le workflow ne s'exécute toujours qu'avec `publish=true`.

Si aucune exécution du workflow n'apparaît dans GitHub Actions, les fichiers
et le Worker sont seulement **préparés dans le dépôt**, pas déployés en ligne.
