# Sauvegarder Ma-Collection et la restaurer sans Kaptain

## Ce qui est vérifié

Le code, l'interface, les traductions, les données versionnées, les collections et les
instantanés TMDB déjà présents dans ce dépôt sont intégrés à une archive ZIP portable.
Chaque fichier est listé dans `BACKUP-MANIFEST.json` avec sa **taille et son SHA-256**.
Le format ZIP est sans recompression des images ; Python standard suffit, sans
Kaptain, GitHub, Cloudflare, npm ou API pour **vérifier et extraire le fichier**.

**Une archive n'est pas une sauvegarde permanente tant qu'elle n'a pas été
téléchargée hors GitHub** (PC, SSD, NAS ou autre stockage contrôlé).
Les artifacts GitHub Actions expirent ; conserver plusieurs copies indépendantes.

### Génération automatique de l'archive du site

Le workflow **Sauvegarde portable Ma-Collection (sans Kaptain)** s'exécute le
dimanche et peut être lancé dans Actions > Run workflow. Dans l'exécution,
télécharger l'artefact `ma-collection-portable` (conservation temporaire de
30 jours), qui contient `ma-collection-portable.zip`.

Pour créer une archive hors Actions depuis une copie **Git** du projet :

```bash
python3 scripts/portable_backup.py create --project Ma-Collection --output ../ma-collection-portable.zip
python3 scripts/portable_backup.py verify --project Ma-Collection --archive ../ma-collection-portable.zip
```

Le système archive uniquement les fichiers versionnés, exclut les fichiers
de secrets typiques (par exemple `.env`, `account-config.local.js`,
fichiers de clés et d'identifiants) et refuse les liens symboliques.
Il n'inclut pas l'historique `.git` : exporter séparément un `git bundle`
si une sauvegarde de l'historique complet est nécessaire.

### Restaurer sur un PC ou un hébergeur sans dépendance à GitHub

Conserver une copie du script `scripts/portable_backup.py` (disponible aussi
dans l'archive). Depuis un dossier où le script est accessible :

```bash
python3 scripts/portable_backup.py verify --project Ma-Collection --archive ma-collection-portable.zip
python3 scripts/portable_backup.py restore --project Ma-Collection --archive ma-collection-portable.zip --dest ./restauration-ma-collection
python3 -m http.server 8000 --directory ./restauration-ma-collection
```

Ouvrir `http://localhost:8000`. Le service de fichiers et les contenus
locaux fonctionnent sans Kaptain ; les aperçus TMDB, les addons, les comptes
Kovelyx et l'affichage d'images distantes demandent leurs propres services.

### Restaurer les images Ma-Art

Récupérer séparément la **sauvegarde privée Ma-Art** et vérifier son ZIP.
Depuis la copie restaurée de Ma-Art :

```bash
python3 scripts/audit_independence.py
python3 cloudflare-static/build_assets.py --build
```

Le répertoire `cloudflare-static/public/` contient uniquement les médias
dont les fichiers et empreintes ont été vérifiés. Il peut être envoyé
**sur un hébergement HTTPS sous ton contrôle**, en conservant exactement
les chemins `/media/...` et `/collection-cards/...`.
Ce n'est pas un déploiement automatique : il faut disposer des droits sur
les images et vérifier HTTP, MIME, SHA-256 et CORS sur le nouvel hébergeur.

Si le domaine Ma-Art change, sur une **copie restaurée, sans dossier .git**,
réécrire seulement le domaine en conservant les chemins :

```bash
python3 scripts/rehost_ma_art.py --root ./restauration-ma-collection --new-origin https://images.exemple.fr
python3 scripts/rehost_ma_art.py --root ./restauration-ma-collection --new-origin https://images.exemple.fr --apply
```

Le premier appel prévisualise le nombre de références et ne modifie rien.
**Ne pas exécuter en production** sans tester la copie restaurée dans le
navigateur et les exports Kovelyx.

## Non sauvegardé automatiquement

- **Kovelyx Cloudflare / Better Auth / D1 :** les comptes, profils et bases
  distantes ne font pas partie des dépôts. Exporter séparément la base D1
  depuis le compte Cloudflare et conserver la configuration Worker,
  les secrets et les méthodes de restauration dans un coffre chiffré.
  Ne jamais publier une exportation de base ou des jetons dans GitHub.
- **Profil du navigateur :** les personnalisations en `localStorage` et
  `IndexedDB` nécessitent les exports et sauvegardes du Studio, réalisés
  depuis le navigateur concerné, avant d'effacer ses données.
- **Images ajoutées par URL** : si elles n'ont pas été importées et
  sauvegardées dans Ma-Art, leur disponibilité dépend de leur hébergeur.
- **Listes tierces TMDB/Trakt et addons** : les identifiants seuls ne
  garantissent pas leur contenu si leur auteur supprime la liste.
  Le statut actuel `data/catalogue-archives/tmdb/status.json` est
  autoritatif pour la couverture des instantanés TMDB : la dernière
  vérification indiquait 261/262 et une liste invalide. Les références
  Trakt n'ont pas d'archive vérifiée équivalente. Voir l'issue #25.

## Test d'indépendance Kaptain

Les tests CI incluent :
- inventaire des 20 collections et vérification des liens des médias ;
- tests locaux des scripts et polices ;
- simulation Chromium où **tout le réseau externe est bloqué**, puis
  vérification des interactions essentielles, du Studio, des exports et
  de l'affichage mobile ;
- vérification/restauration SHA-256 d'une archive portable de test.

Ce résultat **ne promet pas** l'éternité de GitHub/Cloudflare, des listes ou
des services Internet ; il permet de conserver et restaurer les fichiers
dont tu possèdes une vraie copie.

## Télécharger les trois sauvegardes sur ton ordinateur, avec contrôle

Depuis un PC Windows, Linux ou macOS où Python 3.10+ et GitHub CLI sont
installés, exécuter une fois `gh auth login` (depuis ton PC, **jamais dans
un chat**). Ensuite, depuis la copie locale de Ma-Collection :

```powershell
python scripts/collect-offsite-backups.py --destination "E:\Sauvegardes\Ma-Collection"
```

Remplacer `E:` par le vrai disque ou dossier de sauvegarde voulu.
Le script récupère les derniers artifacts **non expirés et issus d'une
exécution réussie**, dans Ma-Collection, Ma-Art privé et Kovelyx.
Il vérifie les deux ZIP du site et des images, ainsi que le hash
de la sauvegarde D1 chiffrée. Il produit `CONTROLE-SAUVEGARDE.json`
avec les empreintes de tous les fichiers réellement téléchargés.
Il ne déchiffre jamais la D1 (la clé privée reste sur l'ordinateur)
et n'exporte pas les secrets Better Auth ou les profils du navigateur.

**Ma-Art doit avoir été exporté manuellement au moins une fois**, sinon
le script signale son absence plutôt que d'afficher une fausse sauvegarde
complète. Pour récupérer le site et la D1 malgré cette absence,
ajouter `--allow-missing` ; le rapport restera explicitement incomplet.

Ne pas supprimer les anciennes copies hors ligne sans vérification.
Une vraie reprise de compte nécessite aussi la **clé privée D1**,
le **secret Better Auth**, les **exports du Studio** et les fichiers
éventuellement ajoutés par l'utilisateur en dehors des dépôts Git.
