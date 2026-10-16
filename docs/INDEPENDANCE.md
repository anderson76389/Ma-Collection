# Indépendance de Ma-Collection — audit du 16 octobre 2026

Objectif : conserver Ma-Collection et Ma-Art fonctionnels si ImKaptain supprime ses dépôts, ses images et son site. Ce document ne prétend pas supprimer toutes les dépendances Internet (TMDB, GitHub, Cloudflare, Trakt, MDBList ou addons).

## Réalisé et vérifiable

- Ma-Collection et Ma-Art résident dans des dépôts personnels indépendants. Ma-Art reste privé.
- La migration des **21 fichiers** (20 collections + base) a été validée sur GitHub Actions le 15 octobre : **5 282 références converties**, **2 748 URL Cloudflare distinctes**, **0 erreur HTTP/MIME** au contrôle HEAD. Voir [l'exécution](https://github.com/anderson76389/Ma-Collection/actions/runs/38824724424).
- L'ancien endpoint automatique Bingecat du chemin Kaptain n'est plus utilisé par défaut : il n'y a aucun transfert de collection vers cet endpoint. Bingecat peut encore être configuré explicitement, mais n'est plus nécessaire au fonctionnement du site.
- Les libellés « Friends of Kaptain » de l'interface et le lien d'aide vers le compte Kaptain ont été remplacés. Les crédits historiques et les formats/identifiants de compatibilité ne sont pas supprimés par simple recherche de chaîne.
- Une URL de GIF d'aperçu doublement concaténée est corrigée dans deux collections sans changer le visuel choisi.
- CI : scripts/audit-independance.mjs vérifie toutes les 20 collections, interdit les liens directs Kaptain et les nouveaux médias externes non recensés, et surveille les sources dont l'éditeur est tiers.

## Restes à résoudre — **pas de certification 100 %**

- **23 références de médias externes historiques** (moins de fichiers uniques) sont conservées dans quatre JSON : i.ibb.co, bramst0ne/prism-wallpapers et un GIF sur max-streams.gleeze.com. Liste détaillée : config/medias-externes-historiques.json. Elles ne sont pas incluses dans le miroir actuel Ma-Art ; les remplacer arbitrairement supprimerait les affiches et animations. Le GIF Discovery était déjà signalé indisponible dans Ma-Art. Ne migrer que les médias dont les droits de diffusion sont établis.
- Le rapport data/catalogues-dynamiques-status.json recense **1 007 références à des listes TMDB/Trakt tierces** et **13 sources d'addons**. Les historiques sont conservés pour ne pas les casser. La disponibilité de chaque identifiant et son propriétaire restent à auditer, en priorité pour les Top 10 et listes « Nouveautés ». Les limites et dates glissantes TMDB ne sont pas des Top 10 officiels.
- Les workflows hebdomadaires dépendent de GitHub Actions, TMDB/Netflix et des secrets configurés. Leur présence ne prouve pas que chaque mise à jour réelle a été publiée.
- Le test Cloudflare du 15 octobre contrôle le code HTTP et le type MIME des images, **pas leur hash SHA-256 après publication**. Vérifier l'intégrité de la diffusion réelle et la présence des facturations/produits dans le tableau de bord Cloudflare.
- Sauvegarder hors GitHub les dépôts, les fichiers et les paramètres/secrets (sans exposer de jetons), pour éviter une dépendance unique à GitHub.

## Tests de non-régression

Lancer à la racine : `node scripts/audit-independance.mjs` et `node .github/scripts/qa-independance.mjs`. Le workflow **Validation Ma-Collection indépendante - FR et Kovelyx** les exécute également sur chaque demande de modification.

**Statut : autonomie matérielle importante vis-à-vis de Kaptain, mais indépendance fonctionnelle totale non certifiée.**
