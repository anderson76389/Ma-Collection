# Packs d’affiches françaises indépendants — Ma-Collection

## Ce que fait le Studio

Le nouvel onglet **Affiches FR** reproduit le *fonctionnement* des packs linguistiques observé dans l’archive HTML de Profile Studio : sélectionner un style, une catégorie (ou toutes), prévisualiser les changements et appliquer les visuels aux dossiers correspondants.

**Les fichiers sont les tiens, hébergés où tu le souhaites en HTTPS (Ma-Art recommandé).** Le code n’appelle pas Kaptain, ses index linguistiques ou ses dépôts.

Ce n’est **pas** une traduction automatique du texte contenu dans une image anglaise. Pour une véritable affiche française, il faut un **fichier image déjà réalisé en français** : une URL pointant vers une affiche anglaise ne devient pas française en changeant son nom.

## Pourquoi un fichier de pack ?

La sauvegarde Firefox a fourni le moteur JavaScript de Kaptain, **pas l’intégralité de ses illustrations françaises**. Les images appartiennent à leurs auteurs et peuvent nécessiter une autorisation de réutilisation. Ma-Art possède déjà des archives privées d'originaux, mais pas un pack linguistique français complet librement publiable.

Cette approche permet de rester autonome techniquement et de gérer tes propres visuels, sans supposer de droits de publication sur des illustrations tierces.

## Utilisation

1. Dans le Studio de Ma-Collection, ouvre **Affiches FR** puis **Exporter le modèle de mes dossiers**.
2. Le JSON contient chaque `sectionId`, `folderId`, et son libellé. Le code ne modifie pas les identifiants.
3. Remplis les champs `coverImageUrl` avec les URL HTTPS de **tes propres images en français**, hébergées sur Ma-Art ou un autre serveur que tu contrôles. Pour plusieurs styles, ajoute un objet à `styles` et un objet image par style et par dossier.
4. Choisis **Importer un pack français**. Un pack valide est conservé dans le navigateur uniquement.
5. Sélectionne le style, la catégorie et l’option « Uniquement les dossiers actifs ». Le Studio affiche les images originales / françaises et les nombres couverts ou manquants.
6. Clique sur **Utiliser ces affiches françaises**. Cela modifie uniquement le brouillon ; aucune source ne disparaît, les dossiers sans visuel français restent inchangés.
7. Pour valider, clique sur **Appliquer ce profil à Ma-Collection**. La sauvegarde automatique et l’annulation existantes restent utilisables.

### Exemple minimal

```json
{
  "schema": 1,
  "language": "fr",
  "name": "Mes créations françaises",
  "styles": [
    {"id": "classique-fr", "label": "Cinéma français"},
    {"id": "neon-fr", "label": "Néon violet"}
  ],
  "entries": [
    {
      "sectionId": "identifiant-reel-de-la-section",
      "folderId": "identifiant-reel-du-dossier",
      "style": "classique-fr",
      "coverImageUrl": "https://votre-hebergement.exemple/affiches-fr/mon-visuel.webp",
      "focusGifUrl": ""
    }
  ]
}
```

Les valeurs `sectionId` et `folderId` doivent provenir du **modèle réellement exporté** par ton site ; les exemples ci-dessus sont volontairement fictifs. Les URL ne sont pas téléchargeables depuis ce document.

## Règles et limites

- **Aucune requête aux serveurs Kaptain** : les liens `kaptain.stream`, `ImKaptain` et certaines URL CDN associées sont refusés.
- Les images manquantes ne sont jamais remplacées par des URL imaginaires ; le compteur de dossiers non couverts reste visible.
- Chaque pack stocke au maximum 3 000 entrées et 24 styles. La taille du fichier importé est limitée à 1,8 Mo.
- Le manifeste est stocké dans le navigateur : pour le conserver sur d’autres appareils, conserve une copie du JSON.
- Un GIF est remplacé seulement si `focusGifUrl` est explicitement fourni. Les sources et autres visuels restent intacts.
- **Ma-Art** dispose actuellement d’un Worker de consultation des images en lecture seule ; le site ne peut pas y publier un nouveau fichier sans ajout d’un circuit de déploiement propriétaire. Ce module ne prétend pas uploader des images.
- Le format JSON des collections Nuvio n’intègre pas les fichiers d’images, seulement leurs URL HTTPS.
- Pour les **affiches de films/séries individuelles**, TMDB propose une autre méthode indépendante : récupérer les variantes taguées `fr` via les endpoints `movie/{id}/images`, `tv/{id}/images` ou `collection/{id}/images`, lorsque les droits d'usage le permettent. Cela ne fournit pas automatiquement des illustrations traduites de tous les dossiers thématiques.

Ce fichier documente le mécanisme nouvellement disponible. La **création d'une galerie française exhaustive** (tous les dossiers et styles) reste un travail distinct d’illustration et d’hébergement : le Studio ne doit jamais prétendre que ces fichiers existent tant qu’ils ne sont pas effectivement hébergés.
