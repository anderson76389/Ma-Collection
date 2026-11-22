# Ma-Collection — reprise intégrale du site de référence en français

Dernier audit : 22 novembre 2026. Source examinée : archive fournie par le propriétaire `kaptain.stream (1)(1).zip` (200 fichiers : index, page Studio, statistiques, scripts du site, extensions du Studio et création de dossiers). Ce fichier sert de **référence comportementale**, jamais de dépendance d'exécution ni de code à republier. Certaines fonctions visibles dans l'archive demandent des services privés absents du ZIP.

## Contrat de reprise

Ma-Collection conserve son identité, ses couleurs, ses 20 grandes catégories et les identifiants stables des sources. Refaire **l'ensemble des parcours utilisateur** du site de référence dans notre propre code, en français, sans code, image, API, SDK ni URL `kaptain.stream` chargé à l'exécution. Les fonctions de compte doivent utiliser uniquement la plateforme privée Kovelyx, avec sauvegarde et contrôle de révision. Les intégrations TMDB, Trakt, MDBList, AIO et d'affiches demeurent des dépendances externes distinctes et doivent être indiquées comme telles. Aucune garantie technique absolue « à vie » ne peut couvrir la disparition de tous les services extérieurs.

## Correspondances fonctionnelles à tester une par une

| Espace du site de référence | Parcours autonome Ma-Collection | État vérifiable / limites |
|---|---|---|
| Accueil et présentation des outils | `index.html`, `accueil.css`, `site-tools.js` | Accès aux outils en français, cartes ajoutées pour création, affiches, extensions, préférences et partage. Tester clavier et mobile |
| Recherche universelle et aides | Palette existante, visite guidée, FAQ | Présent ; exhaustivité des recherches et contenu FAQ à améliorer |
| Assistant express et guidé | `wizard.js`, `customize.js` | Présent pour catégories, langues, région et plateformes ; options spécifiques du poster studio encore partielles |
| Éditeur rapide | `app.js`, écran de sélection | Présent ; conserver les sources et l'ordre dans l'export |
| Éditeur cinématique | `app.js`, réorganisation, tiroir des sources | Présent ; parité d'ergonomie à approfondir |
| Studio : page dédiée et espace de travail | `studio.html` → lien direct, `studio-avance.js`, `studio-workspace-nav.mjs`, `studio-workspace.css` | **Nouveau** : écran plein viewport, navigation latérale en français / onglets tactiles, 14 fonctions, footer d'application |
| Studio : hub, sélection du profil | `studio-avance.js`, `profile-editor.js` | Présent pour profil local et compte Kovelyx ; l'auth réelle exige une session personnelle |
| Écran d'accueil, rangées et dossiers | `studio-avance-core.mjs`, `profile-editor-core.mjs` | Ordre, activation, libellés, déplacement et sauvegarde ; parité du canvas de Kaptain encore partielle |
| Aperçu TV / téléphone | `renderPreview` | Présent, simulation locale ; n'imite pas un client distant connecté |
| Garde-robe / variantes d'affiches | `studio-avance.js`, bibliothèque `studio-art-library.mjs` | Plusieurs variantes, visuels personnels et génération ; index français complet et favoris encore partiels |
| Packs artistiques | `studio-fr-art.mjs`, `Ma-Art` indépendant | Import / application ; catalogue de packs communautaires hébergé chez nous à construire |
| Poster Engine films et séries | Assistant BetterPosters, liens alternatifs | Partiel ; rendu vrai dans Kovelyx et options RPDB/URL à valider par appareil |
| Créer un dossier | `custom-folders.js` | Saga, liste TMDB, studio, réseau, acteur, réalisateur et plateforme avec ID TMDB. Autres types hors TMDB non couverts |
| Recherche et édition en lot | `renderGlobalSearch`, `renderWorkshop` | Présent dans le Studio ; outils avancés du Canvas à étendre |
| Extensions et configurations AIO | `studio-addon-manifests.mjs`, export JSON, modules auto-hébergement | Inventaire et export présents ; connexion/synchronisation des extensions de profils encore partielle |
| Mettre à jour une collection existante | `profile-editor.js`, `profile-editor-core.mjs` | Prévisualisation des ajouts et modifications, préservation des visuels |
| Langues et filtres de contenu | `customize.js`, packs FR, nouvel onglet Préférences | FR, région et préférences du site ; contrôle distant des langues du lecteur à développer |
| Sous-titres, lecture auto, choix des flux | Kovelyx, pas de faux formulaire web | **À développer :** protocole de paramètres Kovelyx versionné, contrôlé et annulable |
| Configuration des comptes et clés | `account-ui.js`, paramètres API existants | Chiffrement et séparations en place ; tests de connexion réelle nécessaires |
| Copies entre profils | `profile-editor.js` | Présent avec sauvegarde avant remplacement et révision avant publication ; partage avec autorisations à développer |
| Sauvegardes, restauration, historique | Studio IndexedDB, export intégral et historique Kovelyx | Présent ; vraie récupération après incident matériel à tester avec les sauvegardes hors ligne |
| Suivi Trakt/MDBList | Fonctions côté Kovelyx et historique web | Partiel ; MDBList ne remplace pas les sources TMDB/Trakt ou AIO |
| Espace communautaire / marketplace | Aucune plateforme indépendante complète | **À développer** avec modération et hébergement propres ; pas de reprise automatique des données communautaires de Kaptain |
| Statistiques du site | `site-tools.js` statistiques locales des catégories | Présent pour les collections ; **pas** de télémétrie fictive sur les visiteurs |
| Site de prise en charge / dons | Aide personnelle Ma-Collection | Pas de copie des comptes ou des programmes de soutien Kaptain |

## Priorités restantes pour la parité intégrale

1. **Réorganisateur d'accueil Kovelyx** : vraie correspondance entre sections du Studio et rangées chargées par le client, y compris ajout et suppression de sources d'extensions.
2. **Canvas avancé** : déplacer des dossiers entre rangées depuis une surface visuelle, garder les médias personnels, prise en charge clavier/touch et annulation.
3. **Visuels autonomes** : index stable de tous les posters locaux/privés, favoris, packs de variantes françaises, comparaison et export transportable.
4. **Réglages du lecteur** : écrire un contrat de lecture/écriture pour les versions Windows, Linux, Android et TV ; ne jamais prétendre synchroniser les sous-titres/lecteur tant que le client ne confirme pas l'application.
5. **Partage et communauté** : propre hébergement des publications, droits et validation des imports, sans dépendre du compte de Kaptain.
6. **Validation complète** : parcours de chaque bouton sur mobile et ordinateur, rupture totale des domaines Kaptain et restauration d'archives réelles.

## Ce que signifie « indépendant »

Les fichiers de Ma-Collection et du Studio doivent fonctionner lorsque `kaptain.stream`, son GitHub et ses API disparaissent. Cela ne signifie pas que les catalogues tiers fournissent leurs films hors ligne : aujourd'hui la synchronisation des collections transmet des **définitions de sources** et pas tous les résultats de TMDB, Trakt ou des addons. Une source externe inactive doit afficher un diagnostic précis, jamais supprimer les dossiers de l'utilisateur.
