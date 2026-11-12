# Plan de reprise indépendant · Ma-Collection / Ma-Art / Kovelyx

## Statut constaté le 12 novembre 2026

Ce plan distingue les **fichiers archivés** des **données sauvegardées** et de
leur **restauration effectivement éprouvée**. Aucune migration de production
n'est déclenchée par la lecture de ce document.

| Élément | Copie actuelle | Restauration et limites |
|---|---|---|
| Ma-Collection (HTML, JavaScript, CSS, 20 collections) | ZIP portable SHA-256, 953 fichiers, premier artifact du 12/11 | Test de restauration + navigateur sans Internet, export Kovelyx |
| Ma-Art (images, GIF, logos, bannières) | 2 768 copies privées / CDN vérifiées le 09/11 | Test de staging statique sans réseau, support des mêmes chemins ; un ancien média historique manque |
| Studio (profils, galerie, historique) | Boutons « Tout sauvegarder » / « Restaurer une archive » | JSON local validé, profils et dossiers personnels non écrasés ; sauvegardes internes limitées à 8 |
| Kovelyx Cloudflare D1 | Export quotidien **chiffré** déjà existant dans Kovelyx | Dernière archive vérifiée du 11/11, restauration SQLite en mémoire dans CI ; vraie clé privée du propriétaire nécessaire |
| Listes TMDB | 261/262 instantanés de listes publiques à la dernière vérification | Ni propriété des listes ni changement des sources actives prouvés |
| Listes Trakt | Références présentes, pas d'archive de tiers autorisée | Réécriture uniquement depuis les listes créées ou exportées légitimement par le propriétaire |
| Addons externes | Références à leurs manifests | Leur disparition peut casser les catalogues : autohébergement ou remplacement explicite selon autorisations |

## Étape 1 : conserver les sauvegardes HORS des fournisseurs

1. Depuis **Actions → Sauvegarde portable Ma-Collection (sans Kaptain)**, télécharger le dernier ZIP après succès.
2. Depuis le dépôt privé **Ma-Art → Actions → Export privé complet Ma-Art**, lancer une archive puis la récupérer (environ 1,38 Go ; workflow manuel et quota GitHub à surveiller).
3. Dans le dépôt Kovelyx, télécharger l'**archive D1 chiffrée** du dernier workflow réussi. Conserver **hors GitHub** sa clé privée de récupération, et le secret Better Auth dans un coffre indépendant : aucun de ces secrets n'est inclus dans le ZIP. Ne jamais les commiter ou les transmettre à ChatGPT.
4. Dans le site Ma-Collection, ouvrir **Studio → Profils & sauvegardes → Tout sauvegarder (.json)**. Conserver le fichier localement. Il rassemble le brouillon, les profils sauvegardés, jusqu'à 8 historiques, les dossiers TMDB personnels, les packs FR et le thème. Aucune clé API ou session n'est incluse.
5. Conserver deux copies indépendantes, dont au moins une hors des comptes GitHub et Cloudflare. Refaire un essai de restauration périodique.

**ATTENTION :** Les mots de passe, clés API et le coffre chiffré du navigateur
ne font pas partie de l'archive Studio : exporter le coffre avec son propre
mécanisme sécurisé, ou conserver les clés exclusivement dans ton gestionnaire
de mots de passe. Ne pas exporter le localStorage en bloc.

## Étape 2 : panne de Kaptain, de GitHub ou de Cloudflare

- Restaurer le ZIP Ma-Collection dans un dossier neuf : voir
  [Sauvegarde et restauration](SAUVEGARDE_RESTAURATION.md).
- Exposer le dossier depuis tout serveur HTTP statique : le HTML, les
  modules JavaScript, CSS, polices et collections ne nécessitent ni Kaptain ni GitHub.
- Restaurer Ma-Art depuis son ZIP privé et exécuter
  `cloudflare-static/build_assets.py --build` ; héberger seulement
  `cloudflare-static/public`, à des chemins identiques à l'origine.
- Si le domaine change, utiliser `scripts/rehost_ma_art.py` sur une **copie**
  restaurée, jamais directement dans la branche de production.
- Vérifier depuis un navigateur que le Studio, les affiches et l'export JSON
  fonctionnent, sans se contenter d'un code HTTP 200.
- Pour le backend Kovelyx, consulter
  [la restauration chiffrée de Cloudflare D1](https://github.com/anderson76389/Kovelyx/blob/main/docs/RESTAURATION_CLOUDFLARE_ET_CONFIDENTIALITE.md).
  **Ne jamais importer un SQL dans la D1 de production sans essai isolé.**

Les tests automatisés du dépôt restaurent la véritable archive ZIP dans un
dossier temporaire, servent ce dossier et bloquent les accès réseau externes
en simulant la disparition de Kaptain. Le rebasage d'URL Ma-Art est vérifié
sur cette même copie, sans toucher aux données originales.

## Étape 3 : provenance des listes

Exécuter en lecture seule :

```bash
node --test tests/catalogue-provenance.test.mjs
node scripts/audit-catalogue-provenance.mjs --output=/tmp/provenance-ma-collection.json
```

Le rapport inventorie chaque ID de liste TMDB/Trakt et chaque addon actif,
recalcule le SHA-256 des **vrais** instantanés TMDB et vérifie que les
exceptions déclarées correspondent aux fichiers. Il ne fait **aucune requête
réseau**, ne copie pas de listes Trakt et ne remplace pas les catégories.

**Verrous encore ouverts :**

- TMDB : une liste (ID **8690687**) reste non vérifiée. Les 261 autres
  archives ne prouvent pas que le compte utilisateur contrôle leurs listes.
- L'action de copie TMDB en écriture a échoué avec **HTTP 401 / code 36**.
  Il faut réautoriser le jeton *utilisateur TMDB* avec les permissions
  nécessaires dans son propre compte, sans divulguer le secret, puis valider
  chaque copie avant de migrer les IDs actifs.
- Trakt : l'[API Use Policy officielle](https://developer.trakt.tv/docs/api-use-policy)
  autorise l'export/migration des **listes de son propre compte**, mais
  interdit de constituer un miroir de masse des listes de la communauté.
  Les références externes restent identifiées comme dépendances. Un
  remplacement n'est possible que pour des listes possédées ou des
  catalogues recréés indépendamment et vérifiés titre par titre.
- Les addons tiers peuvent être remplacés seulement avec des instances
  contrôlées par le propriétaire et des tests de compatibilité.

**Ne jamais** remplacer une liste indisponible par un tri approximatif
qui ferait perdre silencieusement des films/séries. Les 20 catégories,
767 dossiers et 3 716 sources versionnées sont un inventaire de contrôle,
pas une preuve d'autonomie absolue.

## CI de sécurité

- `qa-ma-collection.yml` : tests boutons, Studio, récupération complète
  sur un nouveau navigateur, syntaxe, rupture réseau, copie ZIP réinstallée.
- `catalogue-provenance.yml` : audit des sources et des SHA-256, et rapport
  téléchargeable sans secret.
- `Kovelyx/.github/workflows/cloudflare-backup-health.yml` : contrôle
  de fraîcheur de l'export D1 chiffré et présence de l'artefact, sans lire
  les données ni la clé privée.

Le terme **« indépendant à vie » n'est pas une garantie technique possible** :
les copies restaurables, les droits d'utilisation et les clés personnelles
doivent rester disponibles et être régulièrement vérifiés.

## Export de secours TMDB regroupé (nouveau)

Le workflow **Audit de provenance des catalogues** génère maintenant aussi
l'artefact `ma-collection-recovery.json` avec les 261 listes TMDB archivées :
pour chacune, il contient les IDs TMDB films/séries **dans leur ordre original**,
les dossiers et sources qui l'utilisent, et une empreinte SHA-256 vérifiée.
Il indique explicitement toute archive absente, et conserve un inventaire des
références Trakt et addons **non archivées**.

Génération hors connexion depuis une copie du dépôt :

```bash
node --test tests/emergency-catalogue.test.mjs
node scripts/build-emergency-catalogue.mjs --output=/tmp/ma-collection-recovery.json
```

Ce fichier est utile pour reconstruire un catalogue dont la liste TMDB
d'origine a disparu. **Il ne remplace pas une API de catalogue** : Kovelyx
ne doit pas basculer vers cet export avant l'existence d'un service local
compatible, avec validation du contenu, de l'ordre et des identifiants.
En particulier, l'export n'inclut pas les contenus des listes Trakt
ou des addons tiers. Il ne transforme pas 261 copies en 262 copies.
