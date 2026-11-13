# Ma-Collection — finalisation des points 2 à 6 (13 novembre 2026)

**Périmètre volontairement exclu :** aucune migration des catalogues actifs vers
les instantanés TMDB (point 1), aucune réécriture des 20 catégories et aucun
changement du visuel général du site.

## 2. Dernières dépendances externes

L'audit actuel distingue **262 listes TMDB distinctes (261 instantanés valides,
ID 8690687 non archivé)**, les **références Trakt** et les **catalogues d'addons**.
Pour chaque source non contrôlée, le rapport mentionne désormais le fichier, la
catégorie et le dossier concernés, avec un classement par priorité. Le rapport
est consultable dans l'artefact du workflow
**Audit de provenance des catalogues (sans collecte de listes tierces)**,
ou généré sans Internet :

```bash
node scripts/triage-catalogue-dependencies.mjs --output=triage-sources.json
```

Aucune liste communautaire Trakt n'est copiée, aucun identifiant TMDB/Trakt
n'est modifié et aucun addon tiers n'est faussement présenté comme
autohébergé. Une liste TMDB manquante n'est jamais remplacée par un contenu
approximatif. Les remplacements réels exigent droits de réutilisation, données
de référence et contrôle de non-régression.

## 3. Sauvegardes et reprise hors plateformes

- ZIP versionné et testé en CI, sans mots de passe ni sessions, avec
  empreintes SHA-256 ;
- tests de restauration du site sur un port local et simulation de coupure de
  Kaptain, avec préparation de migration des URL Ma-Art ;
- collecte des derniers artefacts Ma-Collection, Ma-Art privé et sauvegarde
  D1 chiffrée via `scripts/collect-offsite-backups.py` sur le PC du propriétaire ;
- **nouveau vérificateur hors ligne** : `scripts/verify-offsite-backups.py`
  refuse archives manquantes, dépassant le seuil de fraîcheur (45 jours par
  défaut), corrompues, dossiers symliens ou chemins hors répertoire.

La collecte finale dans un autre support n'a pas lieu automatiquement :
**GitHub/Cloudflare ne peuvent pas constituer eux-mêmes un emplacement hors
de ces fournisseurs**. L'export JSON intégral du Studio et les clés D1
nécessaires à une restauration privée doivent être conservés séparément.

## 4. Intégration Kovelyx

La publication continue d'utiliser le **compte et le profil explicitement
sélectionnés**, les blocs horodatés par empreinte, le manifeste validé en
dernier, puis une relecture complète. Tests supplémentaires : 409 de
concurrence, refus 503 d'un bloc, annulation du remplacement et profil
non autorisé, sans succès trompeur. Le même export peut être consommé
dans le cadre des synchronisations Windows/Android/TV prévues côté Kovelyx.

Ces tests valident le **contrat web/Cloudflare**. Ils ne remplacent **pas**
un essai sur trois appareils physiques avec le même compte, profil et une
synchronisation activée. Les extensions tierces restent à installer
indépendamment dans les applications.

## 5. Studio et rendu mobile

Les tests navigateur déjà existants couvrent le glisser-déposer,
les modifications de titres/affiches/sources/formats, les profils,
la sauvegarde locale IndexedDB, l'export complet sans secrets,
la restauration dans un navigateur neuf, la galerie et l'annulation.
La suite supplémentaire utilise les largeurs **320, 360 et 768 px**,
vérifie la navigation dans les onglets et le bouton Fermer, et détecte
toute mutation du catalogue pendant de simples interactions.

Il reste à contrôler les médias historiques Ma-Art introuvables à partir
de leurs octets d'origine et les modèles d'Android TV physiques.
Un simple contrôle HTTP 200 ne prouve pas l'intégrité d'une affiche.

## 6. Surveillance et mises à jour

Le workflow **Surveiller Ma-Collection Cloudflare sans clés ni surcharge** :
- lundi à samedi : seulement **4 requêtes** HTTP publiques
  (`health`, dépendances, route interne protégée, et un extrait vérifié) ;
- dimanche : les mêmes contrôles suivis de la vérification **intégrale des
  261 listes**, leurs hashes et leur ordre ;
- en cas d'échec : GitHub Actions affiche un workflow rouge. Aucun token,
  compte, D1 ou clé privée n'est consulté ou transmis.

Le déploiement Cloudflare depuis GitHub Actions reste **manuel**. Le
`wrangler.toml` à la racine et celui du service compilent la **même API**
pour réduire les risques de collision avec Workers Builds. Un déploiement
n'est pas déclaré réussi sans relecture HTTP de 261 listes.

Pour revenir à une version précédente, conserver les archives et les
révisions Git/Cloudflare ; effectuer une restauration d'abord en environnement
isolé. Aucun rollback automatique ne doit écraser les données du compte.

**Limite :** héberger le Worker sur Cloudflare n'est pas une garantie de
disponibilité « à vie ». Le code du Studio et le système de restauration
restent indépendants de Kaptain, mais les fonctions utilisant TMDB, Trakt,
Kovelyx ou un addon tiers restent soumises à leurs propres conditions.
