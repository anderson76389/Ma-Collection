# Mise à jour hebdomadaire des nouveautés dans Ma-Collection

## Objectif

Chaque lundi, mettre à jour **les limites de dates des rangées de nouveautés/récents**
pour les plateformes, chaînes, télé-réalité, films, séries, animés et autres catégories.

Les listes fixes, catégories d'années/décennies, acteurs, réalisateurs, récompenses,
identifiants TMDB/Trakt, images, GIFs et vidéos ne sont jamais remplacés.

## Ce qui est réellement dynamique

- Les sources TMDB `DISCOVER` interrogent TMDB à chaque lecture Nuvio : les
  catégories « populaires », « tendances » et « mieux notés » bénéficient déjà
  des données TMDB qui évoluent, même sans script.
- Le script fait avancer la période `releaseDateGte` à partir du **lundi UTC**
  (fenêtre mobile). Il ne touche qu'aux titres explicitement « Nouveau »,
  « Nouvelle », « Recent », « New », « Sorties » ou « Cette saison ».
- Les fenêtres restent volontairement larges pour éviter de vider les chaînes
  peu fournies : chaînes et téléréalité 1095 jours, animés de la saison 185 jours,
  autres nouveautés généralement 730 jours.
- Les restrictions existantes de pays (`watchRegion`), fournisseur, langues,
  réseaux, genres, genres exclus, ordre, limites et seuils restent inchangées.
- Les Top 10 **officiels** de plateformes ne sont pas inventés. Un Top 10 TMDB ou
  Trakt historique continue de dépendre du propriétaire de sa liste. L'automatisation
  Netflix France officielle se trouve dans [NETFLIX_FR_AUTO.md](NETFLIX_FR_AUTO.md).

## Où les données sont-elles mises à jour ?

Le workflow [Actualisation hebdomadaire](../.github/workflows/weekly-catalogs.yml)
met à jour la base web `collections/database.js`, les catalogues JSON individuels
et `collections/nuvio_mega_collection.json`. Aucun secret ni clé TMDB n'est requis
pour ce recalcul de dates.

La page web appelle aussi `updateRollingWeekFilters()` au chargement. Un visiteur
voit donc la période courante même entre deux exécutions du workflow.
Le script des aperçus TMDB prend lui aussi ces fenêtres en compte lors de sa
prochaine exécution (elle requiert son secret `TMDB_API_KEY` habituel).

**Limite importante :** un JSON déjà importé dans un profil Nuvio est une copie.
Mettre à jour les fichiers GitHub ne force **pas** Nuvio à remplacer automatiquement
les filtres déjà importés. Les catalogues TMDB Discover existants peuvent toujours
renvoyer de nouveaux résultats, mais de nouvelles bornes de dates nécessitent
une réimportation ou une synchronisation de profil vérifiée séparément.

Ce système n'est pas un relevé d'audiences des plateformes et ne peut pas
garantir qu'un titre a été ajouté au service cette semaine : TMDB connaît
notamment les **dates de sortie des œuvres**, pas nécessairement leur date
d'entrée dans chaque catalogue de streaming.

## Contrôles

`node --test tests/weekly-catalogs.test.cjs`

`node scripts/refresh-weekly-catalogs.mjs --check`

`node scripts/refresh-weekly-catalogs.mjs --write`

La phase `--check` analyse toutes les bases sans les écrire. En mode écriture,
tous les fichiers sont analysés et validés avant la première modification.
La protection vérifie le nombre de sources et que rien d'autre que les
champs de date des sources Discover n'a changé.

GitHub Actions peut être retardé/désactivé. Une évolution du schéma TMDB ou
des sources doit parfois être corrigée : zéro maintenance à vie n'est pas garanti.
