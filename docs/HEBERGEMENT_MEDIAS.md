# Sauvegarde et hébergement indépendant des médias

**Statut : préparation uniquement.** Aucun logo, GIF, image ou lien de production n'est modifié.

## Objectif

Le script scripts/media_migration.py identifie les URLs des champs coverImageUrl, titleLogoUrl, heroBackdropUrl, focusGifUrl et backdropImageUrl dans la base active. Il permet de copier leurs octets originaux, vérifier les fichiers et préparer de nouveaux liens HTTPS sans modifier la base utilisée par le site.

## 1. Inventorier

Depuis PowerShell et votre copie du dépôt :

~~~powershell
cd C:\Kaptain-Collection
py .\scripts\media_migration.py self-test
py .\scripts\media_migration.py audit --output "C:\Kaptain-Media-Inventory.json"
~~~

Cette étape ne télécharge rien et crée un manifeste des URLs avec leurs futurs chemins media/.

## 2. Sauvegarder les originaux en local

Tester d'abord dix fichiers :

~~~powershell
py .\scripts\media_migration.py backup --manifest "C:\Kaptain-Media-Inventory.json" --dest "C:\Kaptain-Medias" --limit 10
~~~

Puis sauvegarder l'ensemble des médias que vous êtes autorisé à copier :

~~~powershell
py .\scripts\media_migration.py backup --manifest "C:\Kaptain-Media-Inventory.json" --dest "C:\Kaptain-Medias"
py .\scripts\media_migration.py verify --manifest "C:\Kaptain-Media-Inventory.json" --dest "C:\Kaptain-Medias"
~~~

Les fichiers ne sont pas transformés ni compressés. Un rapport media-backup-report.json contient les tailles et empreintes SHA-256. Les échecs sont signalés ; les fichiers supérieurs à 100 Mio demandent un hébergement adapté.

**Important : les dépôts publics ImKaptain/nuvio-art et ImKaptain/nuvio-assets n'ont pas de licence explicite.** L'accès public ne donne pas automatiquement le droit de republier leurs œuvres. Avant de mettre des copies en ligne, vérifier les droits et obtenir l'autorisation nécessaire, y compris pour les images externes issues d'autres sources.

## 3. Héberger ses copies

Créer après vérification des droits un dépôt distinct, par exemple Kaptain-Medias, ou un stockage d'objets/CDN privé adapté à la taille réelle. Conserver l'arborescence media/ et vérifier que chaque fichier est accessible à son adresse HTTPS.

Le connecteur GitHub du chat ne propose pas la création d'un nouveau dépôt : cette étape se fait dans l'interface de GitHub. Ne pas recopier tout l'historique Git du dépôt tiers, qui représente plusieurs gigaoctets.

## 4. Préparer une migration des adresses

Une fois toutes les copies publiées avec autorisation, utiliser la commande suivante sur une seule ligne :

~~~powershell
py .\scripts\media_migration.py stage --manifest "C:\Kaptain-Media-Inventory.json" --dest "C:\Kaptain-Medias" --base-url "https://raw.githubusercontent.com/anderson76389/Kaptain-Medias/main" --output ".\collections\database.media-stage.js"
~~~

Attention : l'URL Kaptain-Medias est un exemple et ne fonctionne pas avant création et publication des fichiers.

La commande génère seulement database.media-stage.js. Elle refuse un manifeste périmé, une sauvegarde incomplète ou des données altérées en dehors des URL médias. L'actuel database.js, les identifiants, les titres, les filtres et les médias existants sont inchangés. Il faudra ensuite vérifier le rendu et l'export Nuvio puis effectuer la bascule dans une autre modification GitHub testée.

## Exclusions

- Les affiches dynamiques du cache preview_posters.js sont déjà régénérées quotidiennement à partir de TMDB.
- Les vingt bannières de collection-cards du dépôt nuvio-art ne sont pas référencées dans la base des 695 dossiers et ne sont donc pas incluses dans cet inventaire.
- Copier les médias une fois ne reproduit pas l'actualisation artistique de l'auteur. Cela fige les fichiers à la date de la sauvegarde.
- Certains fichiers GIFV correspondent en réalité à des vidéos : vérifier le type MIME après hébergement.
