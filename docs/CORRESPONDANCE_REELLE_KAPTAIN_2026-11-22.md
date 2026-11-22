# Correspondance des écrans avec l'archive Kaptain (21 novembre 2026)

Référence inspectée : archive utilisateur `kaptain.stream (1)(1).zip`, en particulier `kaptain.stream/index.html`, `kaptain.stream/studio.html`, `css/studio-overhaul.v_477a37f2.css`, `studio/hub-poster.v_540e292f.js` et `studio/profile-studio.v_727fe088.js`. Le code d'origine n'est **ni intégré ni chargé** dans Ma-Collection ; seules la structure visuelle et la liste des parcours servent de référence.

## Écarts réels relevés

| Écran | Référence observée | Version précédente | Correction |
| --- | --- | --- | --- |
| Accueil, barre principale | Bandeau 56 px, hamburger à gauche, navigation centrée autour du logo/outils, compte/actions à droite | Grand bandeau ~66 px, marque à gauche, outils déportés à droite | Cockpit centré 56 px avec logo Kovelyx hébergé localement |
| Accueil, rubriques principales | 3 rubriques dans l'ordre : Aide, Studio de personnalisation, Extensions et hébergement | 5 rubriques affichées, dont Création et Profils entre les rubriques d'origine | Les trois rubriques principales reprennent le même ordre ; les deux rubriques nouvelles sont dépliables, sans supprimer leurs boutons |
| Studio, en-tête | Barre 56 px, logo et raccourcis au centre, puis sous-barre 48 px avec profil à gauche, contexte au centre et fermeture à droite | Barre 68 px, puis 52 px, marque à gauche et fermeture tout en haut | Deux bandes de 56 et 48 px, en-tête à cockpit centré, badge du profil et fermeture en sous-barre |
| Studio, corps | Bord intérieur 32 px sur PC et 14 px sur mobile, contenu sur la largeur disponible | Max 1060 px, contenu étroit | Contenu pleine largeur et padding 32/14 px |
| Studio, cartes | Grille `auto-fill / minmax(310px, 1fr)`, espace 20 px, carte min 165 px, padding 24/22/20 px, icône 44 px | Cartes min 250 px, espace 14 px et hauteur min 188 px | Géométrie de carte, icônes, légendes et libellé « Ouvrir » recalés |
| Studio, Mes créations | Écran distinct « My curations » listant les dossiers créés | Carte « Mes créations » redirigeant vers le formulaire de création | Nouvel écran « Mes créations » avec liste réelle depuis le stockage local et accès au gestionnaire |
| Studio, navigation | Menu replié via hamburger, carte/écran ouvert au clic | Menu replié mais interfaces internes trop génériques | Le menu reste disponible, les commandes sont réorganisées en deux barres distinctes |

## Ce qui ne peut pas encore être déclaré identique

La version Kaptain possède davantage d'écrans de réglages lecteur, sous-titres, services de streaming, langues, AIO, etc. L'édition locale et les sauvegardes de Ma-Collection restent indépendantes mais ne disposent pas encore de tous les contrats de synchronisation correspondants côté Kovelyx. Aucune de ces fonctions manquantes n'est annoncée comme créée simplement parce qu'un bouton de navigation serait affiché.

Les images de couverture des catégories ne peuvent pas dépendre de `kaptain.stream` : elles doivent être originales, sous licence adaptée ou conservées sur Ma-Art. L'archive contient principalement des sources frontend ; elle ne fournit pas le catalogue complet des originaux graphiques.

## Tests

Validation GitHub Actions : géométrie du Studio, ouverture/fermeture du menu, 15 onglets, galerie des créations, flux des trois rubriques, saisie et focus, affiches, exports JSON, contrôle sans réseau Kaptain et tests mobile 320/360/768 px. Le test navigateur ne remplace pas une validation pixel par pixel sur tous les écrans et tous les appareils de l'utilisateur.
