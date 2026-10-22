<a id="haut"></a>
<div align="center">
  <img src="assets/kovelyx-logo.svg" alt="Logo Kovelyx" width="110">
  <h1>🎬 Ma-Collection</h1>
  <h3>Catalogues français pour Kovelyx et Nuvio</h3>
  <p><strong>Créez un accueil qui vous ressemble.</strong><br>
  Parcourez les catalogues, choisissez vos catégories, organisez vos rangées et exportez votre collection depuis une interface en français.</p>
  <p>
    <img alt="Langue : français" src="https://img.shields.io/badge/Langue-Fran%C3%A7ais-2563eb?style=for-the-badge">
    <img alt="Compatible avec Kovelyx" src="https://img.shields.io/badge/Compatible-Kovelyx-7c3aed?style=for-the-badge">
    <img alt="Interface web" src="https://img.shields.io/badge/Interface-Web-0f766e?style=for-the-badge">
  </p>
  <p>
    <a href="https://anderson76389.github.io/Ma-Collection/">🌐 Interface (après activation de GitHub Pages)</a> ·
    <a href="collections/">📁 Explorer les collections</a>
  </p>
</div>

---

> **Indépendance des médias vérifiée (22 octobre 2026) :** les 20 collections renvoient leurs visuels de dossiers vers Ma-Art Cloudflare : aucune des 23 anciennes références ImgBB/Prism/Discovery n'y reste. Les copies existantes sont conservées et le manifeste des 249 médias supplémentaires a été sécurisé. Les listes TMDB/Trakt, addons et services externes restent des dépendances distinctes. Aucun résultat ne garantit une indépendance Internet absolue. Consultez le **[rapport d'audit d'indépendance](docs/INDEPENDANCE.md)** pour les éléments validés et les limites restantes.

## ✨ Le projet

**Ma-Collection** est un éditeur indépendant pour vos collections multimédias. Les données et l’interface sont conservées dans ce dépôt ; le projet inclut du code historique adapté et crédité en fin de document.

Son objectif : rendre la **personnalisation des catalogues et de l'écran d'accueil** plus accessible, sans modifier manuellement des fichiers JSON de plusieurs milliers de lignes.

Vous pouvez sélectionner vos contenus préférés, réorganiser votre accueil et préparer une configuration à importer dans Kovelyx. Les intitulés de l'interface, des catégories et des sous-catégories bénéficient d'une traduction française dédiée.

> **À savoir :** cet outil sert à **organiser et configurer des catalogues**. Il n'héberge pas de films ou de séries et ne fournit pas, à lui seul, de service de lecture vidéo.

## 👤 Compte unique Kovelyx ↔ Ma-Collection (serveur à configurer)

La page web intègre un formulaire **Créer mon compte / Se connecter / Se déconnecter** compatible avec l'authentification de Kovelyx PC. L'inscription ne crée pas de compte fictif : les données sont envoyées à **votre serveur Supabase-compatible**, configuré dans les deux applications.

**Aucun serveur public de comptes Kovelyx n'est fourni par défaut.** Vous devez d'abord déployer/configurer un serveur de comptes commun, puis saisir sa **clé publique publishable/anon** dans le site et dans Kovelyx. Sans ce serveur, le site et l'application restent pleinement utilisables en mode local et par export/import JSON.

Le site possède également un **coffre chiffré optionnel** pour les sélections et les clés API. Un compte partagé n'implique pas la synchronisation automatique des profils si votre serveur n'a pas les tables et services nécessaires.

📖 **[Guide complet pour connecter les comptes du site et de Kovelyx](docs/COMPTE_KOVELYX.md)** · **[Politiques RLS du coffre chiffré](docs/sql/ma_collection_vaults.sql)**

## 🔑 Clés API : liens directs

Dans l'étape « Métadonnées » et « Débridage » de l'assistant, et dans les paramètres avancés, les boutons **Tester** sont accompagnés de **Obtenir ma clé ↗** pointant vers les pages officielles TMDB, MDBList, AllDebrid et Real-Debrid. Les clés ne sont jamais envoyées dans ces liens.

## 🟣 Connexion directe à Kovelyx

Ma-Collection est un éditeur de catalogues autonome, hébergé sur votre GitHub Pages. **Vous n'avez besoin d'aucun compte ni serveur tiers pour construire, traduire ou télécharger vos collections**.

Avec **Kovelyx PC**, sélectionnez vos catalogues et utilisez **Importer la collection**. L'assistant prépare les métadonnées, affiches, services et extensions ; le site transmet la configuration au pont local `127.0.0.1:38761`. **Vous choisissez ensuite votre profil et confirmez dans Kovelyx** avant tout remplacement.

Une connexion à votre **propre serveur de comptes Kovelyx** reste facultative pour synchroniser plusieurs profils. Sans serveur, choisissez le mode local.

Si le pont local est inaccessible, **Copier le JSON** ou **Télécharger JSON** permet de poursuivre manuellement. Le fichier JSON exporté ne contient pas vos clés privées et les anciennes collections sont sauvegardées par l'application avant un remplacement confirmé.

**Indépendance :** le site n'utilise aucun service d'authentification ou d'import d'une autre application multimédia. Les sources de catalogues (TMDB, Trakt, MDBList, extensions) et les hébergeurs d'affiches restent des services tiers optionnels, distincts du fonctionnement du site.

## 🔵 Choisir Nuvio ou Kovelyx

Le bouton **Importer la collection** propose désormais **deux destinations** après la sélection des catégories et sous-catégories :

- **Kovelyx PC** : même assistant de personnalisation, puis transfert direct à l'application Windows ouverte via son pont local ; l'import attend votre confirmation dans Kovelyx. Le copier/télécharger JSON reste possible.
- **Nuvio** : même sélection et personnalisation des affiches de dossiers, puis **Copier le JSON** ou **Télécharger le JSON**. L'importation se fait manuellement dans la rubrique **Collections → Importer** de l'application, ou sur [nuvio.tv](https://nuvio.tv/) via **Compte → Collections** si disponible.

**Important :** l'option Nuvio n'est pas un import direct automatique et n'utilise pas votre compte Nuvio. Les clés API, extensions et débrideurs renseignés dans l'assistant ne sont pas intégrés aux JSON exportés ; configurez-les dans l'application destinataire. Les tests du site vérifient le choix, le contenu JSON et le téléchargement, mais ne valident pas la synchronisation sur un compte Nuvio réel.

## 🚀 Fonctionnalités

| | Fonction | Description |
|:--:|---|---|
| 🇫🇷 | **Interface française** | Navigation, menus, catégories et sous-catégories traduits. |
| 🎞️ | **Catalogues thématiques** | Sélections autour des genres, décennies, plateformes, chaînes, acteurs, réalisateurs, animés et bien plus. |
| 🎛️ | **Personnalisation** | Activez les dossiers et sources de votre choix, puis ajustez leur organisation. |
| 📺 | **Aperçu TV et mobile** | Visualisez la disposition de vos rangées avant l'export. |
| 🧭 | **Configuration guidée** | Un assistant facilite les étapes de sélection et de préparation. |
| ⚡ | **Éditeur rapide** | Modifiez votre sélection sans reprendre toute la configuration. |
| 📦 | **Export JSON** | Téléchargez un fichier de configuration réutilisable. |
| 🔗 | **Import Kovelyx** | Transfert local vers l’application ou export JSON manuel. |
| 👤 | **Gestion des profils** | Accédez aux outils d'organisation des profils existants. |

## 🗂️ Explorez les catégories

La bibliothèque couvre notamment :

| 🎬 Films et séries | 🌍 Découvertes | 🎭 Sélections |
|---|---|---|
| Genres | Cinéma international | Ambiances et émotions |
| Décennies | Documentaires | Acteurs |
| Animés | Télé-réalité | Réalisateurs |
| Collections de films | Plateformes de streaming | Récompenses |
| Tendances et nouveautés | Chaînes et studios | Basé sur… |

Les collections proviennent des fichiers du projet : leur présence ou leur disponibilité dans l'interface peut dépendre de la base chargée.

## 🧩 Comment l'utiliser ?

1. **Ouvrez l'interface** depuis le lien en haut de cette page.
2. **Choisissez votre méthode** : assistant de configuration ou éditeur rapide.
3. **Sélectionnez les catégories et sources** que vous souhaitez retrouver dans Kovelyx.
4. **Ajustez l'ordre des rangées** et utilisez l'aperçu TV ou mobile.
5. **Importez directement dans Kovelyx PC** (sans compte en mode local) ou téléchargez votre JSON.

**Aucune connexion n'est nécessaire pour créer, télécharger ou importer dans un profil local.**

## 💻 Lancer le site en local

Le configurateur principal est une interface web. Pour éviter les restrictions du navigateur sur les fichiers locaux, servez le dossier avec un petit serveur HTTP.

~~~bash
git clone https://github.com/anderson76389/Ma-Collection.git
cd Ma-Collection
python -m http.server 8000
~~~

Ouvrez ensuite **http://localhost:8000** dans votre navigateur.

Cette commande nécessite Git et Python installés. Certaines fonctions spécialisées, notamment celles reposant sur **server.py**, peuvent nécessiter leurs propres dépendances : le serveur HTTP ci-dessus sert avant tout à ouvrir l'interface et à tester la sélection des catalogues.

## 🌐 Traduction française

Cette édition améliore particulièrement :

- **Les titres des catalogues**, catégories et sous-catégories.
- **Les traductions contextuelles** : cinéma international, documentaires, télé-réalité, genres, chaînes, plateformes, décennies et autres thématiques.
- **Les intitulés exportés** vers Kovelyx, pour limiter le mélange de français et d'anglais.
- **Les noms propres et marques**, qui restent inchangés lorsqu'une traduction serait incorrecte.

La traduction porte sur les textes. **Les affiches, images, GIF, vidéos, identifiants des catalogues et liens vers les médias ne sont pas retravaillés pour la francisation.**

## 🔐 Connexion et données

- **Composition et export** : utilisables sans connexion à un compte.
- **Import direct** : dialogue exclusif entre votre navigateur et Kovelyx sur votre PC ; confirmation obligatoire dans l'application.
- **Comptes synchronisés** : nécessitent votre propre serveur Kovelyx, configuré séparément. Ils ne sont pas requis pour les profils locaux.
- **Sauvegarde facultative** : les sélections et clés API peuvent être protégées localement par mot de passe dans le navigateur. Le stockage cloud est désactivé sans configuration personnelle.

Vérifiez toujours les URL des extensions que vous ajoutez et ne publiez jamais vos clés API dans le dépôt.

## 🧱 Organisation du dépôt

| Chemin | Rôle |
|---|---|
| [index.html](index.html) | Interface web |
| [app.js](app.js) | Édition et gestion locale des collections |
| [import-studio.js](import-studio.js) | Personnalisation avant import |
| [destination-picker.js](destination-picker.js) | Choix Nuvio / Kovelyx et export JSON Nuvio |
| [kovelyx-export.js](kovelyx-export.js) | Transfert local et secours JSON |
| [debrid-services.js](debrid-services.js) | Validation et configuration des services de débridage |
| [collections/](collections/) | Catalogues et sélections |
| [locales/fr.json](locales/fr.json) | Traductions françaises |
| [site-fr.js](site-fr.js) | Localisation dynamique des textes |
| [assets/](assets/) | Visuels conservés à l'identique |

## ❓ Questions fréquentes

<details>
<summary><strong>Faut-il créer un compte ?</strong></summary>
Non pour choisir, télécharger et importer dans un profil local Kovelyx. Un compte requiert un serveur que vous contrôlez.
</details>

<details>
<summary><strong>Que se passe-t-il si le site ou un service externe disparaît ?</strong></summary>
Le dépôt contient le code de l'interface et les fichiers de collection. Vous pouvez les héberger ailleurs et conserver vos exports JSON. Certaines listes dynamiques, API, affiches ou extensions externes peuvent nécessiter une alternative.
</details>

<details>
<summary><strong>Le site héberge-t-il les films ou les séries ?</strong></summary>
Non. Il organise des catalogues et leurs réglages. Il ne fournit pas les médias.
</details>

<details>
<summary><strong>Pourquoi certains titres restent-ils en anglais ?</strong></summary>
Les noms officiels, marques et titres propres conservent leur graphie. Les labels des catalogues et de l'interface sont francisés.
</details>

## 🤝 Crédits et indépendance

Ce dépôt est une **copie GitHub indépendante** issue d'une adaptation de [ImKaptain/Kaptain-Collection](https://github.com/ImKaptain/Kaptain-Collection). Il ne fait pas partie du réseau de forks GitHub du projet d'origine. Le travail initial de conception, les fonctionnalités historiques et les ressources associées restent attribués à leurs auteurs respectifs.

Cette édition indépendante est développée pour Kovelyx. Le code historique et ses auteurs sont crédités ici, sans liaison technique obligatoire avec un serveur de l'ancien projet.

Aucune licence explicite n'est actuellement déclarée dans ce dépôt : sa visibilité publique ne vaut pas automatiquement autorisation de réutiliser ou redistribuer tous ses éléments.

---

<div align="center">
  <p><strong>🎬 Votre collection. Vos catégories. Votre accueil.</strong></p>
  <p><a href="#haut">Retour en haut ↑</a></p>
</div>


## ✍️ Harmonisation des intitulés français

Tous les titres visibles de la collection sont normalisés : l'esperluette `&` devient **`Et`** dans les catégories, sous-catégories, rangées, descriptions et exports. Les noms reconnus par les traductions françaises continuent à être traduits intégralement : les anciennes formes servent uniquement de clés de compatibilité. Le contrôleur `node scripts/normalize-ampersands.mjs --check` prévient toute régression. Cette transformation **ne touche jamais** aux URLs, requêtes, identifiants TMDB/Trakt, filtres, images, GIF ou vidéos.

## 🇫🇷 Export intégral des collections françaises

**[Récupérer le JSON complet déjà généré](export/nuvio-collection-fr.json)** · [Fichier hébergé par ce dépôt](https://anderson76389.github.io/Ma-Collection/export/nuvio-collection-fr.json)

Les intitulés de catégories, dossiers et sous-catégories sont francisés pour l'export. Les IDs TMDB/Trakt, filtres, ressources, affiches et GIF restent identiques.

Les fichiers de catalogues sont inclus dans le dépôt et la génération hebdomadaire conserve les listes historiques. Pour actualiser une collection déjà importée, vous pouvez réimporter le JSON après avoir vérifié la sélection dans Kovelyx.

Le nom du fichier pré-généré est historique ; il ne déclenche aucune connexion à un serveur externe.

## 🧹 Suppression des anciennes préversions Kaptain

Depuis le **22 octobre 2026**, les exports `Kaptain_*.json` et les bases d'aperçu **v0.90/v0.91/v0.92** ne sont plus servis par ce dépôt. Le modèle utilisé par l'assistant AIO Streams s'appelle désormais [`Ma_Collection_AIO_Template.json`](Ma_Collection_AIO_Template.json) : mêmes catalogues et identifiants externes, sans modification des listes TMDB/Trakt.

Le fichier de compatibilité `collections/nuvio_mega_collection.json` conserve ses **18 catégories, 756 dossiers et 3 538 sources**, mais ses visuels pointent maintenant vers **Ma-Art** (ancien GIF Discovery inaccessible désactivé). L'export français courant, les 20 collections, le site et l'import Kovelyx/Nuvio ne sont pas supprimés. Les collections partenaires, dont **Kaoxt**, sont conservées. Les anciens scripts qui exigeaient les préversions et l'ancien convertisseur GIF relié à un dépôt ImKaptain ont été retirés ; leur code reste consultable dans l'historique Git pour archivage. Les crédits des auteurs d'origine restent maintenus.

## 🔄 Nouveautés et sélections dynamiques

Les rangées **Nouveaux films, Nouvelles séries, sorties récentes et nouveaux animés** utilisent des fenêtres de dates glissantes, recalculées chaque lundi. Un audit des catalogues individuels confirme **377 sources hebdomadaires** couvrant les **22 plateformes**, **68 chaînes**, **6 dossiers de télé-réalité**, ainsi que les genres, films, séries, animés, documentaires et autres nouveautés. **1 708 sources TMDB Discover supplémentaires** récupèrent leurs classements en direct. Les années historiques, récompenses, listes de tiers, affiches et GIF restent préservés. Les classements tiers ne sont pas garantis hebdomadaires et les nouvelles bornes de dates d'une configuration déjà importée dans Kovelyx peuvent nécessiter une réimportation. [Détail, contrôle et limites](docs/CATALOGUES_DYNAMIQUES.md).

## 🇫🇷 Moteur de catalogues FR indépendant

Un **moteur hebdomadaire complémentaire** prépare des catalogues en France à partir de TMDB : plateformes disponibles dans la région FR, chaînes, télé-réalité, animés, sorties récentes, épisodes et saisons. Il surveille également un **échantillon** de disponibilités pour signaler des changements possibles et intègre les **Top 10 Netflix France officiels uniquement lorsqu'ils sont validés**.

**Activation nécessaire :** ajouter votre secret GitHub Actions `TMDB_API_KEY`, puis lancer le workflow `Moteur FR Ma-Collection`. La génération publiera alors des fichiers JSON Stremio distincts des collections historiques ; elle ne réécrit aucune liste fixe, aucun média ni aucun profil Kovelyx. La compatibilité avec votre version de Kovelyx doit être testée après installation de l'addon.

**[Documentation complète, activation et limites du moteur France](docs/MOTEUR_FR.md)**

## 📅 Top 10 Netflix France — actualisation hebdomadaire

Une automatisation fondée sur les [classements hebdomadaires officiels Netflix](https://www.netflix.com/tudum/top10) est préparée pour archiver les Top 10 français. **Les listes historiques ne sont pas modifiées** ; l'affichage automatique dans Kovelyx demande une configuration de deux listes TMDB personnelles. [Voir le guide de configuration et les sécurités](docs/NETFLIX_FR_AUTO.md).

## 📌 Origine et dépendances

Ce dépôt reprend une adaptation de [Kaptain Collection](https://github.com/ImKaptain/Kaptain-Collection). L'attribution au projet d'origine est conservée ; la mise en ligne publique des éléments tiers doit respecter leurs droits d'auteur et leurs licences applicables. Certaines listes TMDB/Trakt, images et ressources visuelles externes peuvent encore dépendre de leurs propriétaires. La migration du dépôt ne garantit donc pas l'autonomie des catalogues.
