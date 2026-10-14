# Moteur de catalogues France de Ma-Collection

## Statut et périmètre

Ce moteur est **indépendant du dépôt de Kaptain**. Il produit des **catalogues supplémentaires au format Stremio** depuis les API de TMDB, au lieu de remplacer les listes TMDB/Trakt historiques des collections.

Il couvre :
- **Toutes les sources « nouvelles / récentes » TMDB Discover de la collection individuelle** : 377 au dernier audit, dans les plateformes, les chaînes, la télé-réalité, les genres, les animés, documentaires, cinéma international, ambiances et adaptations.
- **22 plateformes préexistantes**, seulement lorsque TMDB confirme leurs fournisseurs de films ou séries **en France**. Les plateformes sans disponibilité FR confirmée sont **ignorées et signalées**, jamais remplacées par les États-Unis.
- **68 chaînes** selon leurs identifiants de réseau TMDB. Ces données concernent la diffusion internationale : elles ne confirment pas forcément l'accès en replay français.
- **Nouveaux épisodes et nouvelles saisons** : les épisodes reposent sur \`air_date\` ; les saisons reposent sur la date \`seasons[].air_date\` de TMDB (séries anciennes également).
- **Services français supplémentaires** détectés automatiquement parmi les fournisseurs de TMDB (TF1+, france.tv, M6+, ARTE, Canal+, OCS, Molotov si disponibles).
- **Netflix France officiel** : ajout facultatif de deux catalogues de Top 10 lorsque l'archive du workflow Netflix contient des identifiants TMDB validés et une semaine récente.

Aucune photographie, GIF, vidéo, liste d'acteurs, réalisateur, récompense, décennie, saga ou liste tierce n'est écrasée.

## Installation et activation (une seule fois)

1. Créer une [clé d'API TMDB](https://www.themoviedb.org/settings/api). Une clé v3 ou un jeton de lecture v4 est accepté.
2. Ouvrir **GitHub → Ma-Collection → Settings → Secrets and variables → Actions → New repository secret**.
3. Créer **\`TMDB_API_KEY\`**, avec la clé en valeur. **Ne jamais placer la clé dans le code, un JSON, le README ou les Issues.**
4. Ouvrir **Actions → Moteur FR Ma-Collection → Run workflow** pour déclencher une première génération (la simple exécution de test lors d'un push n'effectue pas d'appel à TMDB).
5. Attendre le **statut vert** et vérifier **\`data/catalog-engine/etat.json\`**. Ce fichier n'existe pas avant la première génération réussie. En l'absence de clé, le workflow signale clairement que la génération est désactivée et ne publie aucun catalogue trompeur.
6. Dans **Settings → Pages**, activer GitHub Pages à partir de la **branche main, dossier /(root)**. Si Pages est déjà actif, conserver sa configuration actuelle.

Après le premier succès, les points d'entrée prévus sont :

- **Addon « essentiel » (plateformes, chaînes, télé-réalité, animés, saisons et épisodes)** :
  \`https://anderson76389.github.io/Ma-Collection/manifest.json\`
- **Addon « intégral » (toutes les sous-catégories récentes du moteur, beaucoup plus volumineux)** :
  \`https://anderson76389.github.io/Ma-Collection/manifest-complet.json\`

Ces URL n'existent qu'après la première publication. Vous pouvez **essayer de les installer dans Nuvio en tant qu'addon Stremio de catalogues**. **La compatibilité effective de Nuvio Windows/Mobile/TV avec ces URLs statiques n'a pas encore été vérifiée en conditions réelles** ; certaines versions exigent des préfixes d'identifiants ou des catalogues déclarés dans le manifeste. Les aperçus utilisent des IDs de type \`tmdb:12345\` et nécessitent un fournisseur de métadonnées compatible dans Nuvio. Le moteur ne fournit ni vidéos, ni streams.

Si l'édition intégrale surcharge la navigation, installez seulement l'édition essentielle : elle limite les sous-catégories exposées tout en gardant les grandes familles.

## Automatisation

Workflow : [catalog-engine-fr.yml](../.github/workflows/catalog-engine-fr.yml).

- **Lundi 07 h 41 UTC** : mise à jour de toutes les catégories sélectionnées.
- **Manuel** : bouton *Run workflow*.
- **Après modification du moteur** : tests de syntaxe et tests hors ligne, puis génération si la clé TMDB est configurée (aucun catalogue simulé n'est publié).
- **Sans clé TMDB** : aucun nouveau fichier de catalogue, aucune simulation de fausses données.
- **Si TMDB rencontre une panne grave ou si trop de sources échouent** : le processus refuse la publication, préservant le dernier jeu de catalogues validé.

Les sorties versionnées sont :
- \`catalog/movie/*.json\` et \`catalog/series/*.json\` : réponses \`{"metas":[...]}\`.
- \`manifest.json\` et \`manifest-complet.json\` : descriptions de l'addon.
- \`data/catalog-engine/snapshots.json\` : observations précédentes de la disponibilité des plateformes.
- \`data/catalog-engine/etat.json\` : rapport et alertes de la dernière exécution.

## Comprendre les limites pour éviter les faux résultats

1. **Disponibilité française ≠ sortie française récente.** TMDB utilise des informations de disponibilités via JustWatch ; l'actualisation de ces informations peut être retardée. Le filtre de date de sortie TMDB ne renseigne pas la date réelle d'ajout dans Netflix ou Disney+.
2. **Nouveaux repérés ≠ véritables ajouts**. Le moteur compare uniquement **deux pages de résultats populaires** par plateforme et par type. Un titre entrant dans cette sélection peut avoir gagné en popularité sans être nouvellement ajouté au catalogue. La première exécution crée un état initial, **sans annoncer de faux nouveaux titres**.
3. **Une suppression de l'échantillon ≠ retrait confirmé de la plateforme.** Le titre peut simplement avoir perdu des places dans les pages observées.
4. **Épisodes et saisons** : les dates TMDB reflètent les diffusions renseignées dans sa base ; elles ne garantissent ni replay ni diffusion en France.
5. **Top 10** : les classements officiels ne sont jamais inventés. Netflix France n'apparaît dans les catalogues *officiels* que lorsque [le relevé Netflix](NETFLIX_FR_AUTO.md) a produit une archive complète et des identifiants vérifiés. Les autres Top 10 de tiers restent historiquement inchangés.
6. **Exhaustivité** : TMDB et ses accords de données ne publient pas un inventaire parfait de *toutes* les plateformes, chaînes, téléréalités, disponibilités ou nouveautés. Certains services ne sont pas indexés. On peut auditer et signaler les manques, mais pas garantir 100 % de couverture.
7. **Import Nuvio existant** : ce nouvel addon est **séparé** des collections déjà installées. Il ne reconfigure pas silencieusement les profils Nuvio déjà importés.

Les données de disponibilité sont fournies par TMDB et son partenaire **JustWatch** ; attribution nécessaire selon [la documentation TMDB](https://developer.themoviedb.org/reference/tv-series-watch-providers).

## Vérifications techniques

Sans clé TMDB et sans téléchargement :

\`\`\`bash
node --test tests/catalog-engine.test.mjs
node scripts/catalog-engine.mjs --check
\`\`\`

Avec une clé, lancer le workflow GitHub ou localement :

\`\`\`bash
TMDB_API_KEY="VOTRE_CLE" node scripts/catalog-engine.mjs --build
\`\`\`

Les fichiers JSON générés ne contiennent aucune clé. Le moteur n'a pas de dépendance npm supplémentaire. Il utilise Node 22 et les APIs HTTPS officielles de TMDB. Un **test d'intégration hors ligne** reconstruit aussi l'addon entier dans un dossier temporaire avec des réponses simulées, sans jamais publier ces données : `node --test tests/catalog-engine-integration.test.mjs`.
