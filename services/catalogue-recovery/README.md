# Service de secours autonome des listes TMDB — Ma-Collection

Ce mini-serveur **lecture seule**, sans dépendance npm, permet de récupérer
les identifiants de films et séries des **261 listes TMDB archivées**,
dans l'ordre original. Il n'appelle ni Kaptain, ni TMDB, ni Trakt, ni Cloudflare.

## Démarrage local (PC, Windows, VPS)

Depuis une copie restaurée de Ma-Collection, avec Node.js 22+ :

    node services/catalogue-recovery/server.mjs --check
    node services/catalogue-recovery/server.mjs

Adresses :
- http://127.0.0.1:8788/health : nombre de listes disponibles et manquantes
- http://127.0.0.1:8788/v1/tmdb/lists : inventaire et SHA-256
- http://127.0.0.1:8788/v1/tmdb/lists/8659010?limit=50&offset=0 : éléments dans l'ordre
- http://127.0.0.1:8788/v1/tmdb/lists/8659010?type=movie&limit=100 : filtrer et paginer
- http://127.0.0.1:8788/v1/dependencies : références Trakt et addons non sauvegardées

Une liste manquante renvoie **HTTP 503** (et non un faux catalogue vide).
Les listes et leurs empreintes sont validées avant la mise en service.
Aucun appel réseau sortant ni aucune écriture sur les collections d'origine.

Par défaut, le serveur écoute uniquement sur 127.0.0.1. Pour le rendre
accessible depuis un réseau privé, définir HOST=0.0.0.0 et PORT=8788 dans
l'environnement, et utiliser un pare-feu. Si exposé publiquement, prévoir
un reverse proxy HTTPS sous ton contrôle. L'API expose uniquement des
identifiants de médias de listes publiques, aucun profil personnel ni secret.

## Limites réelles et précautions

- **Pas encore un addon Stremio/Kovelyx installable** : un adaptateur compatible
  avec chaque application sera nécessaire avant de modifier les sources actives.
- Les instantanés ne contiennent **ni titres, ni affiches, ni résumés, ni flux**.
  Le serveur ne fabrique pas de métadonnées, il restitue les IDs existants.
- La liste TMDB 8690687, référencée deux fois, reste non archivée ;
  elle est déclarée indisponible sans remplacement approximatif.
- Les 153 listes Trakt et les addons externes restent sous contrôle de tiers.
- Les listes sont des instantanés : elles ne se mettent pas automatiquement
  à jour selon le propriétaire historique.

## Tests sans serveur distant ni jeton

    node --test tests/offline-catalogue-recovery.test.mjs
    node services/catalogue-recovery/server.mjs --check

Les tests sont intégrés à la CI. Garder également les sauvegardes Ma-Collection
et Ma-Art ainsi que D1 chiffré hors GitHub/Cloudflare : ce serveur ne remplace
pas les sauvegardes des profils et des comptes.
