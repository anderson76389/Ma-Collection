# Écart fonctionnel Studio — archive Kaptain du 21 novembre 2026

Comparaison réalisée **par analyse de l'archive utilisateur de 200 fichiers** (`kaptain.stream (1)(1).zip`), notamment `studio/profile-studio`, `canvas`, `canvas-events`, `home-add`, `home-row`, `wardrobe`, `art-vault`, `art-packs`, `updates-addons`, `settings`, `language-mixer`, `studio-tools`, `keys-copy-share`, `avatar-picker`, `backups-tracking` et `hub-poster`. Les intitulés de fonctions relevés dans la capture **ne prouvent pas** que les appels au serveur privé de Kaptain fonctionnent.

Aucun fichier de l'archive Kaptain n'est importé dans le dépôt. Les fonctionnalités sont à recréer avec notre propre code et des contrats API Kovelyx indépendants.

| Fonction de la référence | État Ma-Collection | À compléter et à tester |
|---|---|---|
| Accueil Studio et navigation par outil | Présent, onglets et hub natifs | Organisation et ergonomie multiappareils |
| Charger un vrai profil de compte | Présent dans `profile-editor.js` avec Worker Kovelyx | Vérifier avec une session réelle et tous les types de profil |
| Sections, dossiers, ordre, ajout, retrait | Présent dans l'éditeur de profil et le brouillon | Glisser-déposer avancé et copie entre profils |
| Rangées d'accueil et aperçu TV | Présent pour le brouillon | Lire/écrire séparément l'ordre réel des rangées du client Kovelyx |
| Édition rapide | Présent | Prévisualisation de compte et filtres massifs supplémentaires |
| Affiches (fond, logo, GIF, formes) | Présent | Vraie garde-robe des styles, thèmes de rangée, variantes et comparaison |
| Packs artistiques et bibliothèque | Partiel : galerie, dessins originaux et packs FR importés | Bibliothèque complète autonome Ma-Art, favoris, recherche et packs compatibles |
| Création de dossier personnalisé | Présent pour des sources TMDB | Autres types de sources, import et validation d'un dossier complet |
| Extensions d'un profil | **Nouveau :** inventaire des sources actives et export JSON de manifests | Installation/synchronisation distante dans Kovelyx, contrôle de disponibilité sur chaque appareil |
| Moteur de posters de films | Partiel : choix BetterPosters avant envoi Cloud | Editeur visuel complet et tests du chargement réel avec repli |
| Sauvegarde, restauration et historique | Présent localement, envoi Cloud protégé | Historique et restauration des paramètres de compte |
| Mise à jour du catalogue | Présent : proposition de mise à jour sans écraser les données personnelles | Différences détaillées des rangées, médias et extensions |
| Paramètres lecteur, qualité, performances | À relier aux paramètres Kovelyx | Contrat distant, versioning et conflits ; ne pas afficher de faux succès |
| Langue / visuels par langue | Partiel : textes FR et packs de visuels | Variantes d'art FR indexées, langue par dossier/profil |
| Sous-titres et aperçu | Fonctionnement côté app Kovelyx, pas d'éditeur Web complet | Modèle de synchronisation web-à-app et aperçu |
| Comptes familiaux et partage de profils | Non complet côté web | Permissions, copie validée et protection des profils |
| Historique et suivi Trakt/MDBList | Services séparés dans Kovelyx | Tableau de bord Studio avec OAuth indépendant et autorisations explicites |
| AIO Streams / AIO Metadata | Écrans d'import existants | Gestion des instances propres, sans aucun serveur Kaptain |

## Catégories vides

La collection de dossiers est un catalogue de **sources**, non une archive autonome du contenu des films. La synchro Cloudflare transfère les définitions ; elle ne récupère pas les films de TMDB/Trakt ni des addons. Une connexion MDBList (notes et suivi) ne remplace pas automatiquement TMDB, Trakt ou AIO Metadata. Diagnostiquer chaque dossier par le type de source et le message d'erreur de Kovelyx ; ne pas vider les dossiers si les providers sont indisponibles.

## Limite du fichier ZIP fourni

L'archive du site contient surtout du HTML, JS, CSS et des images : ce n'est ni un export de collection JSON ni un addon Stremio. L'import d'un fichier de manifests ne peut accepter que des **liens HTTPS /manifest.json** pointant vers des serveurs fonctionnels. Aucun code du site de référence n'est installé depuis le ZIP.

## Objectif d'indépendance

Aucune nouvelle dépendance opérationnelle vers Kaptain, ses API, ses images ou son hébergement. Pour être durable : conserver le code, les données propriétaires, les sauvegardes hors GitHub, des alternatives d'hébergement et un test de restauration. Les catalogues/affiches dépendant de TMDB, Trakt, MDBList, de fournisseurs de posters et des extensions externes sont des limites explicites ; une garantie « à vie » n'est pas techniquement absolue.
