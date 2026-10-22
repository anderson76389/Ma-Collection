# Indépendance de Ma-Collection — audit mis à jour le 22 octobre 2026

Objectif : conserver Ma-Collection et Ma-Art fonctionnels si ImKaptain supprime ses dépôts, ses images et son site. Ce document ne prétend pas supprimer toutes les dépendances Internet (TMDB, GitHub, Cloudflare, Trakt, MDBList ou addons).

## Réalisé et vérifiable

- Ma-Collection et Ma-Art résident dans des dépôts personnels indépendants. Ma-Art reste privé.
- La migration des **21 fichiers** (20 collections + base) a été validée sur GitHub Actions le 15 octobre : **5 282 références converties**, **2 748 URL Cloudflare distinctes**, **0 erreur HTTP/MIME** au contrôle HEAD. Voir [l'exécution](https://github.com/anderson76389/Ma-Collection/actions/runs/38824724424).
- L'ancien endpoint automatique Bingecat du chemin Kaptain n'est plus utilisé par défaut : il n'y a aucun transfert de collection vers cet endpoint. Bingecat peut encore être configuré explicitement, mais n'est plus nécessaire au fonctionnement du site.
- Les libellés « Friends of Kaptain » de l'interface et le lien d'aide vers le compte Kaptain ont été remplacés. Les crédits historiques et les formats/identifiants de compatibilité ne sont pas supprimés par simple recherche de chaîne.
- Une URL de GIF d'aperçu doublement concaténée est corrigée dans deux collections sans changer le visuel choisi.
- CI : scripts/audit-independance.mjs vérifie toutes les 20 collections, interdit les liens directs Kaptain et les nouveaux médias externes non recensés, et surveille les sources dont l'éditeur est tiers.

## Restes à résoudre — **pas de certification 100 %**

- **Visuels des 20 catégories migrés le 22 octobre :** les 23 utilisations de 12 URL tierces (ImgBB/Prism/Discovery) ont été remplacées par des visuels correspondants déjà disponibles sur Ma-Art ; `config/medias-externes-historiques.json` n'autorise plus d'exception. Les dix URL ImgBB ont été remplacées par celles des dossiers équivalents de « Découvrir », les fonds « Top » par leurs couvertures Ma-Art ; l'ancien GIF Discovery inaccessible a été désactivé (couverture statique conservée). Les anciennes créations tierces n'ont pas été copiées ni republiées. Le site web lit les neuf fichiers `.gifv` via des balises vidéo HTML5 ; cela ne prouve pas que toutes les applications clientes prennent en charge ce format.
- Le rapport data/catalogues-dynamiques-status.json recense **1 007 références à des listes TMDB/Trakt tierces** et **13 sources d'addons**. Les historiques sont conservés pour ne pas les casser. La disponibilité de chaque identifiant et son propriétaire restent à auditer, en priorité pour les Top 10 et listes « Nouveautés ». Les limites et dates glissantes TMDB ne sont pas des Top 10 officiels.
- Les workflows hebdomadaires dépendent de GitHub Actions, TMDB/Netflix et des secrets configurés. Leur présence ne prouve pas que chaque mise à jour réelle a été publiée.
- Le contrôle HTTP/MIME des 2 748 liens Cloudflare a été relancé avec succès le 22 octobre. **Il ne vérifie pas le SHA-256 des données réellement téléchargées.** Le manifeste supplémentaire de Ma-Art répertorie à nouveau 249/249 fichiers (avec vérification à la reconstruction), mais les droits des visuels et l'état de facturation Cloudflare restent à vérifier séparément.
- Sauvegarder hors GitHub les dépôts, les fichiers et les paramètres/secrets (sans exposer de jetons), pour éviter une dépendance unique à GitHub.

### Archives Kaptain et préversions retirées (22 octobre 2026)

Les neuf anciens exports `Kaptain_*.json`, les trois bases de prévisualisation `collections/database.beta.js` et `database.mega09*.js`, ainsi que les anciens générateurs qui les utilisaient, ont été retirés de la branche principale. Les codes bêta v0.90 à v0.92 ne sont plus actifs. La collection partenaire **Kaoxt** et ses fichiers restent disponibles.

L'assistant AIO Streams conserve son fonctionnement grâce au fichier `Ma_Collection_AIO_Template.json` (4 764 entrées avec routage), stocké directement sur Ma-Collection ; ses IDs TMDB/Trakt sont inchangés, et le champ descriptif `metadata.author` n'usurpe pas la propriété des listes de tiers. Le fichier historique `collections/nuvio_mega_collection.json` a été migré vers Ma-Art **sans modifier ses 18 catégories, 756 dossiers ni 3 538 sources** : 2 754 liens média ont été remplacés et le GIF Discovery inaccessible a été désactivé.

L'ancien convertisseur de GIF autonome, qui pouvait téléverser des médias vers un dépôt ImKaptain, a aussi été retiré puisqu'il n'était relié à aucune fonctionnalité du site principal. Les fichiers supprimés restent disponibles dans l'historique Git ; cela ne réécrit pas le passé du dépôt. Les crédits des auteurs d'origine restent conservés dans le README.

**Limite :** une référence à une liste TMDB ou Trakt peut encore être sous le contrôle de son créateur, même si son ID est hébergé dans nos propres fichiers. L'absence d'appels aux serveurs Kaptain ne prouve pas la propriété de ces listes.

## Tests de non-régression

Lancer à la racine : `node scripts/audit-independance.mjs` et `node .github/scripts/qa-independance.mjs`. Le workflow **Validation Ma-Collection indépendante - FR et Kovelyx** les exécute également sur chaque demande de modification.

**Statut : autonomie matérielle importante vis-à-vis de Kaptain, mais indépendance fonctionnelle totale non certifiée.**
