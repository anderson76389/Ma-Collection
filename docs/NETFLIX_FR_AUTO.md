# Top 10 Netflix France — automatisation hebdomadaire

**Cette automatisation ne touche à aucun catalogue historique** : acteurs, réalisateurs, années, récompenses, autres plateformes, affiches et GIFs restent inchangés.

## Archivage automatique sans clé ni abonnement

Le workflow [Actualiser les Top 10 Netflix France](../.github/workflows/netflix-fr-weekly.yml) est planifié le **mercredi à 18 h 25 UTC**, et peut être lancé dans GitHub Actions avec **Run workflow**.

Il télécharge [le fichier officiel Netflix pour les pays](https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv), filtre les lignes `FR`, conserve la dernière semaine récente **complète** (10 films et 10 programmes TV, rangs 1 à 10), puis écrit `data/netflix-fr-top10.json`. En cas d'échec, les anciennes données restent intactes. Aucun abonnement ni paquet npm requis.

**Important :** ce JSON est une archive des vrais classements. Il ne constitue pas encore à lui seul un catalogue Nuvio. Les sources Netflix historiques restent en place jusqu'à ce que les listes personnelles soient configurées et reliées à Nuvio.

## Synchronisation facultative avec vos propres listes TMDB

Pour avoir des mises à jour visibles dans Nuvio sans réinstaller la collection, créer sur votre propre compte TMDB **deux listes v4 publiques**, nommées exactement :

- Ma-Collection - Netflix France - Films
- Ma-Collection - Netflix France - Series

Il faut un **jeton utilisateur TMDB v4 autorisé à modifier ces listes**, et pas seulement la clé API de lecture. Voir [l'authentification utilisateur TMDB](https://developer.themoviedb.org/v4/docs/authentication-user).

Dans **GitHub → Ma-Collection → Settings → Secrets and variables → Actions**, ajouter :

| Secret GitHub Actions | Valeur |
|---|---|
| `TMDB_API_KEY` | Clé API TMDB du compte, pour identifier les titres |
| `TMDB_V4_USER_ACCESS_TOKEN` | Jeton utilisateur v4 autorisé à écrire |
| `NETFLIX_FR_MOVIES_LIST_ID` | Identifiant de la nouvelle liste Films |
| `NETFLIX_FR_SERIES_LIST_ID` | Identifiant de la nouvelle liste Series |

**Ne pas publier les clés dans les fichiers, README ou messages GitHub.**

Avant l'activation, vérifier que les deux listes sont vides, tester leur lecture dans Nuvio, puis remplacer uniquement les deux identifiants Netflix historiques dans la configuration Nuvio par ceux de vos listes personnelles. Le présent workflow **ne remplace pas automatiquement les identifiants dans les catalogues**, afin de ne pas casser les configurations existantes.

Après ces vérifications, définir la **variable de dépôt** (pas un secret) `NETFLIX_FR_SYNC_ENABLED` à `true` dans GitHub Actions. Tant que cette variable n'est pas définie, aucune liste TMDB n'est modifiée.

## Sécurités et limites

- Correspondance stricte entre le titre Netflix et le film / la série TMDB : si un nom est ambigu ou manquant, la synchronisation des listes est bloquée sans supprimer de titres existants.
- Des corrections manuelles de noms peuvent être placées dans [config/netflix-fr-tmdb-overrides.json](../config/netflix-fr-tmdb-overrides.json), sous le titre Netflix exact. Les identifiants y sont vérifiés via l'API TMDB.
- Les listes cibles doivent être **publiques**, porter exactement les noms ci-dessus et ne pas contenir plus de 20 titres avant l'opération.
- Le synchroniseur ajoute d'abord les nouveaux titres, vérifie leur présence puis retire les anciens, sans jamais vider toute la liste.
- Une saison Netflix n'a pas toujours d'équivalent séparé dans une liste TMDB : deux saisons peuvent y apparaître comme une seule série.
- **La présence des titres Top 10 peut être synchronisée, mais pas nécessairement leur ordre de classement dans Nuvio.**
- La source Netflix peut changer de format ; le workflow échouera sans effacer la dernière archive si le format est invalide.
- GitHub Actions peut retarder ou interrompre une tâche planifiée. L'absence totale de maintenance ne peut être garantie.
- Aucun accès réel au téléchargement Netflix ni aucune écriture dans un compte TMDB n'a été vérifié au moment de cette installation.

## Tests

Depuis la racine du dépôt, lancer : `node --test tests/netflix-fr.test.mjs`.
Le workflow exécute également ces tests avant chaque téléchargement.
