# Ma-Collection Studio — suivi de parité fonctionnelle (français, autonome)

## Objectif

Reconstituer **les fonctionnalités** du Studio observé dans l'archive HTML/JS fournie par l'utilisateur, en conservant exclusivement **le thème, les couleurs, les contenus et les identifiants métiers de Ma-Collection**. Ne pas intégrer les scripts, serveurs, comptes, images propriétaires ou liens de services Kaptain.

Ce tableau est un inventaire fonctionnel fondé sur les modules disponibles dans la capture du navigateur. La capture ne contient pas l'ensemble des serveurs, API et comportements dynamiques d'origine : une fonction repérée dans le code source sauvegardé n'est pas nécessairement testable en conditions réelles.

### Statuts

- **Présent** : un chemin local existe et est couvert par au moins un test du projet.
- **Partiel** : les gestes de personnalisation sont disponibles, mais pas toutes les options ou la synchronisation de l'autre Studio.
- **À construire** : pas encore de solution indépendante équivalente.
- **Dépendant du backend propre** : impossible à présenter comme fonctionnel tant que la gestion des profils et paramètres du serveur de l'utilisateur n'est pas disponible et vérifiée.

| Fonction observée dans le Studio fourni | Ma-Collection / fichiers | État |
|---|---|---|
| Accueil : réordonner sections et dossiers | `studio-avance.js`, `studio-avance-core.mjs` | Présent |
| Accueil : montrer/masquer sections, dossiers et sources | `studio-avance.js` | Présent |
| Accueil : aperçu TV/mobile | `studio-avance.js` | Présent (simulation, pas TV distante) |
| Accueil : rangement intelligent non destructif | `studio-workshop-core.mjs` | Présent (PR 20) |
| Accueil : création/édition de rangées de compte Nuvio | Aucun backend de profils Nuvio connecté | Dépendant du backend propre |
| Éditeur rapide et sélection des catalogues | `app.js`, `studio-avance.js` et outils du site | Présent |
| Galerie d'affiches d'un dossier, fonds, logos, GIF et variantes personnelles | `studio-avance.js` | Partiel (URLs du propriétaire) |
| Personnalisation de lots de dossiers, effets et formats | `studio-workshop-core.mjs` | Présent (PR 20) |
| Bibliothèque collective de looks, archives, galerie et paquets de styles | Pas de bibliothèque indépendante complète | À construire |
| Dossiers TMDB personnalisés | `custom-folders.js` | Partiel (types TMDB déjà pris en charge) |
| « Mes créations » réutilisables | `custom-folders.js` et stockage local | Partiel |
| Profils enregistrés localement, copier, importer/exporter | `studio-avance.js` | Présent (préréglages locaux) |
| Sauvegardes automatiques/manuelles avant modification, récupération | `studio-backups.mjs` | Présent (local IndexedDB uniquement) |
| Différences Avant/Après et annulation temporaire | `studio-avance-core.mjs`, `studio-avance.js` | Présent |
| Synchronisation des profils sur PC, TV, Android | Backend/contrat API Kovelyx propre | Dépendant du backend propre |
| Extensions : états et installation du compte | `app.js` / interface d'import ; pas de gestion serveur de profils | Partiel |
| Débridage et scrapers pour comptes applicatifs | `debrid-services.js`, `destination-picker.js` | Partiel, aucune activation Nuvio à prétendre |
| Connexion AIO Streams / AIO Metadata et paramètres distants | Pas de contrat de connexion à ces services dans le Studio | À construire |
| Apparence des affiches des médias dans le lecteur | Pas de moteur de rendu média appliqué depuis le Studio | Dépendant de l'app |
| Historique de lecture : export MDBList, Trakt, SIMKL | Pas de données d'historique distantes accessibles au Studio local | Dépendant du backend propre |
| Performance par appareil : résolution, débit, préférences | Aucune preuve d'une API de paramètres distante compatible | Dépendant du backend propre |
| Filtres de contenu, préférences régionales, langue | `customize.js`, catalogues et sélection Ma-Collection | Partiel |
| Langue des visuels de dossiers, variantes traduites | URLs personnelles, pas d'index français exhaustif indépendant | À construire |
| Sous-titres : préférences et aperçu | N'existe pas dans l'export actuel des collections | Dépendant de l'app |
| Sélection automatique du flux, lecture automatique, écran du lecteur | Pas de protocole de mise à jour confirmé | Dépendant de l'app |
| Configuration rapide : thème, langues, lecture | Assistant Ma-Collection existant pour catalogues ; lecture séparée | Partiel |
| Partage vers autre appareil | Fichier JSON local sans clés privées | Présent (manuel) |
| Partage de comptes familiaux et permissions | Pas de backend propre vérifié | Dépendant du backend propre |

## Contrats de qualité

1. Toute modification qui touche les catalogues doit passer par un **brouillon** ou un mécanisme d'annulation avant d'écrire sur les collections.
2. Ne jamais supprimer ni renommer les identifiants des sources, dossiers et catalogues utilisés par le moteur.
3. Les champs de profil sont validés avant stockage, export et application ; aucun identifiant de compte ni clé API dans le JSON.
4. Toute fonction qui réclame un serveur doit annoncer qu'elle est **indisponible** jusqu'à ce que le backend de l'utilisateur soit opérationnel ; ne jamais inventer une réussite distante.
5. Les images restent des URLs HTTPS indépendantes de Kaptain ; préserver les octets d'origine plutôt que recomprimer les médias.
6. Maintenir le thème existant et tester les parcours PC et mobile ; aucune librairie de style externe ajoutée.
7. Ne pas recopier dans le dépôt l'archive de capture du navigateur, potentiellement porteuse d'informations personnelles.

## À faire ensuite

- Bibliothèque d'affiches française autonome sur Ma-Art avec index de variantes par dossier, favoris et prévisualisation des formats.
- Édition des dossiers TMDB plus étendue, sans casser les types déjà supportés.
- Connexion serveur propre Kovelyx/Nuvio : définir auth, profils, autorisations, schéma de synchronisation, conflits et tests interappareils.
- Appels de paramètres de lecture uniquement après validation de l'API d'application (versions PC/TV/Android).
- Historique et service de suivi en option, uniquement après autorisation et authentification de l'utilisateur.
