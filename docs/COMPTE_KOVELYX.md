# Compte Kovelyx Cloudflare et Ma-Collection

Ma-Collection prend en charge l'API indépendante de Kovelyx : **Cloudflare Workers + D1 + Better Auth**, et non Supabase. Les catalogues sont envoyés directement au profil Kovelyx choisi ; aucune donnée ne transite par un compte Nuvio ou Kaptain.

## Connexion

1. Dans Ma-Collection, ouvrez l'icône **Compte → Compte Kovelyx**.
2. Vérifiez l'URL HTTPS du Worker Kovelyx. Elle peut être remplacée si votre Worker a une autre adresse. **Aucune clé publique Supabase n'est nécessaire.**
3. Connectez-vous avec le même e-mail et mot de passe que dans Kovelyx mobile/TV/PC. L'inscription est souvent désactivée sur le Worker en production ; créez alors le compte depuis votre propre outil de configuration Cloudflare.
4. La session Better Auth est conservée seulement dans l'onglet navigateur ; une session Supabase historique ne sera jamais réutilisée.

Le site est servi depuis https://anderson76389.github.io, autorisé par le CORS du Worker. Une copie du site sur un autre domaine doit disposer d'un CORS explicitement autorisé, sans assouplir la sécurité.

## Publier pour PC + Android + Android TV

1. Sélectionnez les catalogues, catégories et affiches voulus sur Ma-Collection.
2. Cliquez sur **Importer la collection → Kovelyx Cloud** ou **Exporter Kovelyx → Synchroniser sur tous mes appareils**.
3. Connectez-vous, puis choisissez le **profil cible** dans la liste réellement renvoyée par le Worker.
4. Choisissez **Fusionner** (par défaut, conserve catégories et dossiers non sélectionnés) ou **Remplacer** (confirmation supplémentaire).
5. Dans **Affiches sur ce profil**, laissez **Conserver** pour ne toucher à aucun réglage existant, ou choisissez **Activer Bttr Posters** pour sélectionner note, genre, qualité, classification, langue et source avec aperçu avant envoi.
6. Appuyez sur **Publier sur ce profil**. Le site vérifie la route /ready, lit le catalogue distant, valide les données et transmet des blocs de 6 000 caractères, puis publie le manifeste seulement après un transfert complet.
7. Si Bttr est activé, le site publie **après la vérification du catalogue** la préférence Kovelyx `profile_settings/visual_custom_poster_v1` (motif HTTPS public, sans clé) puis relit le réglage. Un échec Better Posters est signalé sans prétendre que toute la publication a échoué. Les clients à jour appliquent cette préférence après leur synchronisation.
6. Dans les apps Kovelyx installées, vérifiez le **même compte et profil** et lancez/attendez la synchronisation.

Les publications concurrentes sont protégées par la révision du manifeste. Le serveur refuse HTTP 409 en cas de conflit ; Ma-Collection ne force pas un écrasement. Le contenu est limité à **4 Mo UTF-8 / 700 blocs** par catalogue ; réduisez la sélection si ce seuil est atteint. Les fichiers JSON de secours et le pont local PC restent disponibles.

L'import des collections ne permet pas d'installer les extensions à distance. Les sources addon doivent déjà être configurées sur vos appareils. Les visuels liés à des URL tierces doivent être accessibles depuis l'appareil.

## Coffre chiffré et données

La sauvegarde des clés et réglages sensibles utilise un coffre **AES-GCM local** et une phrase secrète. **Kovelyx Cloudflare ne propose pas d'API de coffre chiffré** : Ma-Collection ne prétend plus le synchroniser. Les anciennes données chiffrées du navigateur ne sont ni effacées ni converties. Les clés API personnelles ne doivent jamais figurer dans les catalogues envoyés à D1.

La synchronisation des catalogues utilise les routes Kovelyx : POST /api/auth/sign-in/email, GET /v1/me, GET /v1/profiles, GET /v1/sync, POST /v1/catalogue-chunk et POST /v1/catalogue-manifest.

Un test GitHub Pages ou une suite de tests Node ne vaut pas vérification réelle sur les trois appareils. Si /ready n'annonce pas catalogueSnapshotSchema: 1, le **Worker de production doit être mis à jour avec sauvegarde D1 préalable** avant que le Push Cloud soit utilisable. Voir le guide services/kovelyx-cloudflare/README.md du dépôt Kovelyx.

## Indépendance et compatibilité

- **Kovelyx Cloud** : publication directe et synchronisation prévue entre les trois clients ; distinct de Nuvio.
- **Kovelyx PC local** : import via http://127.0.0.1:38761 avec confirmation dans Windows, qui reste disponible sans compte.
- **Nuvio** : uniquement export JSON volontaire pour import manuel sur une application différente.

Aucune migration forcée des comptes ou des données existantes. L'ancien fichier docs/sql/ma_collection_vaults.sql reste conservé uniquement comme référence historique Supabase ; il ne doit pas être appliqué à D1.

## Un catalogue apparaît sur mobile mais reste vide

La synchronisation Cloudflare transfère **les catégories, dossiers, définitions de sources et affiches de dossiers**, pas les films/séries préchargés, ni les identifiants des fournisseurs. Chaque appareil exécute ses propres requêtes :

- **TMDB** : vérifier sur mobile que TMDB est activé et que la clé API de l'appareil fonctionne (ou qu'une clé intégrée à Kovelyx est effectivement opérationnelle). Un catalogue `DISCOVER`, `LIST`, `PERSON`, `COMPANY` ou `COLLECTION` nécessite une réponse de TMDB.
- **Trakt** : contrôler le compte/jeton autorisé, la visibilité de la liste et sa disponibilité.
- **Extensions** : installer et activer le même addon et ses catalogues sur l'appareil. L'export Ma-Collection ne contient pas l'APK ou le manifeste de l'addon.
- **Filtres** : certains critères de dates, région, notes, genres ou services peuvent légitimement retourner zéro résultat.
- **Compte** : vérifier le même compte et **le même profil** (ID de profil Cloudflare), mettre Kovelyx à jour, puis relancer une synchronisation.

Le dialogue Cloud affiche désormais combien de dossiers et de sources TMDB/Trakt/addons seront publiés et refuse des dossiers réellement sans source. Ces contrôles ne prouvent **pas** que chaque API retourne des résultats depuis le téléphone. Pour isoler la panne, essayer d'abord une liste TMDB publique réputée contenir des œuvres, puis contrôler le message d'erreur réseau/API dans Kovelyx. Ne pas republier en mode **Remplacer** juste pour corriger une clé manquante.

Les affiches Bttr nécessitent que **btttr.cc** reste accessible depuis les appareils ; leur réglage est distinct du contenu des catalogues. Si ce service est indisponible, les catalogues et leurs sources ne doivent pas être effacés.
