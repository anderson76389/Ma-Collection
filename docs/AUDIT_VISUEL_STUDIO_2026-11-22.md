# Audit visuel — alignement de Ma-Collection avec l'archive de référence

**Référence** : archive du propriétaire `kaptain.stream (1)(1).zip`, `studio.html`, `index.html` et styles du 21 novembre 2026. Les styles et scripts d'origine servent seulement à relever des dimensions et dispositions. Ils ne sont pas repris dans l'application. Les textes, routes, contrôles et ressources exécutées restent propres à Ma-Collection.

| Élément | Avant | Disposition maintenant | Vérification |
| --- | --- | --- | --- |
| Studio | Grande barre latérale fixe de 220 à 270 px | Barre principale de 68 px + sous-barre 52 px ; menu de navigation caché, accessible au clic sur ☰ | Test Playwright sur écran 1440 × 900 |
| Sous-navigation | Gros titre et actions occupant deux rangées | Bouton Retour contextuel, titre compact, actions à droite | Test navigateur, bouton Retour et états |
| Tableau de bord | Petits carreaux et menu permanent | Contenu centré à 1 060 px, profil en haut, cartes espacées de 14 px, minimum 188 px, icône de 42 px | Dimensions réelles du navigateur |
| Cartes | Icone et texte sans hiérarchie claire | Icône, titre, résumé et flèche d’ouverture en bas à droite, survol vertical discret | Validation de l’alignement |
| Navigation téléphone | Bande d’onglets très longue | Barre supérieure compacte ; menu latéral replié ouvrable au toucher | Largeurs 320, 360 et 768 px |
| Commandes | Espacements irréguliers selon les écrans | Boutons autour de 40–44 px, champs alignés à 44 px, bordures cohérentes | Tests souris / tactile et clavier |
| Fluidité | Rafraîchissement complet des panneaux sans transition | Transition écran légère (230 ms, transform/opacity), défilement remis en haut seulement lors d'un changement d’écran | Test de mouvement réduit, pas d'animation inutile pendant la modification des champs |
| Accueil | Dock centré, boutons irréguliers, thème flottant | Marque locale à gauche, navigation, thèmes dans le header, héros recentré (580 px), cartes standardisées | Contrôles d’accueil sur PC/mobile |
| Sauvegarde et partage | Fonctionnels | Fonctionnalités et format JSON conservés, aucun changement aux sources métier | Test d’export et indépendance |

## Points non encore identiques

L'équivalence pixel par pixel n'est pas validée : la capture de référence ne garantit pas l'exécution de toutes les données du Studio (notamment les profils et visuels privés). De plus, les créations et illustrations de Kaptain ne peuvent pas servir de dépendances statiques dans Ma-Collection. Il reste à produire les variantes visuelles originales, les vues dédiées aux opérations complexes et à vérifier les comportements dans les clients Kovelyx réellement installés sur chaque appareil.

**Règle d’indépendance :** ne jamais importer de scripts, feuilles CSS, images ou endpoints Kaptain dans les fichiers de Ma-Collection. Les seules connexions externes autorisées sont celles choisies pour les catalogues et le service de compte privé Kovelyx.
