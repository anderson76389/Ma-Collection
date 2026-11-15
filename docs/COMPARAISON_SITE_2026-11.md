# Comparaison fonctionnelle du site — 15 novembre 2026

Périmètre : pages et contrôles publics observés sur le site de référence, inventaire antérieur du Studio et code actuel de Ma-Collection. L'observation d'un intitulé ne certifie pas le comportement d'un écran privé. Aucun script ni service Kaptain n'est chargé par les nouveaux outils.

| Parcours | Ma-Collection | Écart ou limite |
|---|---|---|
| Accueil, visite, aide, éditeur rapide et cinématique | Parcours existants conservés ; accès « Tous les outils » ajouté | L'apparence propre à Ma-Collection est conservée |
| Assistant : région, langue, exclusions, catégories, plateformes et chaînes | Correction des catégories françaises via leurs identifiants stables, France par défaut | L'étape de styles d'affiches du site de référence n'est pas identique : les styles autonomes sont dans les deux éditeurs |
| Studio : sections et dossiers d'une collection existante | Nouvel éditeur « Mon profil Kovelyx », fichier ou compte propre | Connexion réelle au compte de l'utilisateur non exercée dans cette vérification |
| Création, renommage, ordre et déplacement entre sections | Brouillon, ajout depuis le catalogue, retrait et annulation | Les champs inconnus et les dossiers personnels sont conservés |
| Affiches, fonds, logos, GIF, formats et effets | URL indépendante, bibliothèque locale et dix styles vectoriels originaux intégrés au JSON | Les images propriétaires et tous les packs graphiques du site de référence ne sont pas reproduits |
| Dossiers acteur et réalisateur | Types PERSON et DIRECTOR compatibles avec le moteur Kovelyx | Le chargement TMDB réel demande les accès correspondants |
| Mise à jour d'une collection existante | Proposition avec compteurs puis application au brouillon ; préservation des visuels personnels | Remplacement des sources existantes facultatif, à vérifier avant application |
| Sauvegarde et import | Profils locaux, sauvegarde complète du Studio, fichier JSON du profil distant vérifié | Le JSON des collections n'est pas une sauvegarde des paramètres de lecture ou de l'historique |
| Comparaison avant publication | Ajouts, retraits, modifications et changements d'ordre, sans écriture serveur | Photographie du profil au moment de la comparaison ; nouvelle lecture requise après modification |
| Synchronisation Kovelyx PC, mobile et TV | Protocole existant Cloudflare, blocs avec empreinte et contrôle de révision avant remplacement | Tests automatisés du protocole ; validation sur les trois appareils physiques non effectuée |
| Export Nuvio et instances AIO | Parcours existants conservés | Aucune connexion aux comptes ni à l'infrastructure Kaptain |
| Paramètres privés : sous-titres, lecture, alertes, performances et historique | Pas d'équivalent web complet validé dans cette livraison | Écrans de référence derrière connexion ; contrats de paramètres Kovelyx à vérifier séparément |
| Marketplace, Community Hub et partage familial | Non reproduits dans cette livraison | Fonctionnement privé ou verrouillé non vérifié ; pas de fausse interface de réussite |

## Indépendance

Les contrôles statiques interdisent les appels directs aux hébergements Kaptain. Les nouveaux styles sont produits localement et inclus dans les fichiers exportés. Les sources TMDB, Trakt et extensions conservent leurs exigences de configuration et leur disponibilité propre. Les listes hébergées sur un compte tiers ne deviennent pas personnelles parce que leur identifiant figure dans notre JSON : consulter `INDEPENDANCE.md` et les outils de reprise.

## Vérification

Les tests Node couvrent la conservation des données, les éditions atomiques, l'annulation, la migration des images, les styles, les sélections françaises, la lecture/écriture Cloud avec conflit, la comparaison sans écriture et la sauvegarde vérifiée. La CI comprend un parcours navigateur à 1440 et 390 pixels. Les résultats de CI et les limites de connexion doivent être consultés sur la PR avant fusion.
