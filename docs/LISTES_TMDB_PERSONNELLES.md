# Ma-Collection : reprendre la propriété des listes TMDB

## Objectif et garanties

Le dépôt contient **262 listes TMDB distinctes utilisées 643 fois** :
- 152 listes d'acteurs (431 références).
- 84 listes de réalisateurs (168 références).
- 26 autres listes (44 références).

Cette migration recopie les contenus des listes publiques sur **ton compte TMDB**, puis remplace uniquement les valeurs tmdbId des sources de type TMDB LIST. Les affiches Ma-Art, sources Trakt, noms, ordre des dossiers, filtres et tris ne changent pas. Les fonctionnalités « Pour toi » sont laissées en place.

L'outil ne déclare **jamais une copie comme réussie** avant d'avoir relu la liste de ton compte et comparé tous les identifiants de films et séries **dans le même ordre**. Il vérifie également que la nouvelle liste est publique, afin d'être accessible aux applications avec leur propre clé TMDB.

La copie est un **instantané** des listes originales à la date de migration : elle ne garantit pas que leur propriétaire aurait ultérieurement ajouté les mêmes œuvres. Les mises à jour futures depuis une source propre constituent une étape distincte.

## 1. Autoriser ton compte TMDB (une seule fois)

Tu as besoin :
- d'un compte gratuit sur https://www.themoviedb.org/ ;
- de son **API Read Access Token**, accessible après création/activation de l'accès API depuis https://www.themoviedb.org/settings/api ;
- de Node.js 22 ou plus récent ;
- de GitHub CLI, connecté à **ton** GitHub.

Sur Windows, dans PowerShell :

    winget install --id GitHub.cli -e
    gh auth login

Si Node.js n'est pas présent, installer Node.js LTS et rouvrir PowerShell.

Clone puis ouvre ce dépôt (ou mets à jour ta copie existante) :

    git clone https://github.com/anderson76389/Ma-Collection.git
    cd Ma-Collection

Entre ton **API Read Access Token** uniquement dans PowerShell quand il est demandé (ne l'envoie jamais dans une conversation ou une Issue) :

    $env:TMDB_V4_READ_TOKEN = Read-Host "API Read Access Token TMDB"
    node scripts/tmdb-authorize.mjs
    Remove-Item Env:TMDB_V4_READ_TOKEN

Le script affichera le lien officiel TMDB te permettant d'autoriser ton compte. Une fois approuvé dans le navigateur, reviens dans PowerShell et appuie sur Entrée. Le script utilise GitHub CLI pour enregistrer automatiquement le jeton d'utilisateur dans **Settings > Secrets and variables > Actions**, sous le nom :

    TMDB_V4_USER_ACCESS_TOKEN

Le jeton de ton compte n'est jamais commité ni affiché dans les logs GitHub Actions.

**Important** : ne confonds pas ton API Read Access Token (application) avec le jeton utilisateur autorisé (écriture). TMDB exige ce deuxième jeton pour créer des listes sur ton compte.

## 2. Vérifier le plan sans aucune modification

Dans le dépôt, sous **Actions**, ouvre « TMDB - Copier les listes vers mon compte » puis **Run workflow** :
- operation = plan
- scope = all

Cela affiche les 262 listes sources ainsi que le nombre déjà copiées.

## 3. Copier les listes progressivement, sans casser l'existant

Dans le même workflow :
- operation = copy
- scope = all
- max_lists = 3 (valeur prudente, 1 à 10 autorisées)

Chaque copie :
1. lit intégralement la liste originale, pages comprises ;
2. crée une liste **publique sur ton compte** (pas sur celui de Kaptain) ;
3. ajoute les films/séries en conservant leur ordre ;
4. contrôle strictement le nombre et l'ordre des éléments ;
5. inscrit seulement l'ancien ID, ton nouvel ID, le nombre d'éléments et l'empreinte de vérification dans le fichier de progression.

**Aucun JSON public n'est modifié** pendant cette étape. Si TMDB refuse temporairement une création (limitation anti-spam ou API), le processus s'arrête et conserve les copies déjà validées. Ne relance pas agressivement les créations.

Une exécution automatique est également prévue chaque jour tant que le compte TMDB est autorisé. Elle n'implique pas que 262 listes peuvent être créées instantanément : TMDB peut imposer des limites ou des restrictions de publication.

La progression est enregistrée dans : data/tmdb-own-lists/mapping.json

## 4. Remplacer les listes originales uniquement après validation

Une fois le plan à 262/262 :
- operation = publish
- scope = all

Le script relit les 262 listes de ton compte, vérifie les empreintes, modifie **uniquement** les IDs TMDB LIST, puis crée une **Pull Request**. Le site actuel ne change pas tant que cette PR n'est pas validée et fusionnée. Toutes les listes Trakt restent intactes : elles devront faire l'objet d'un audit séparé si elles appartiennent elles aussi à Kaptain.

## Précautions

- Une liste créée par ton compte TMDB n'est pas hébergée sur ton GitHub. **Elle ne dépend plus du compte Kaptain, mais dépend encore du service TMDB.**
- Les listes utilisées par Kovelyx doivent être **publiques** ; elles seront visibles sur TMDB.
- Le script évite les changements irréversibles : il ne supprime ni tes copies, ni les listes originales, ni tes catégories existantes.
- Des noms de listes très similaires peuvent être filtrés par TMDB comme spam. Si TMDB bloque l'automatisation, ne pas chercher à contourner ces limitations.
- Le moteur existant de catalogues TMDB Discover est conservé.
- Les droits et conditions d'utilisation de TMDB restent applicables.

Références TMDB : https://developer.themoviedb.org/v4/docs/authentication-user ; https://developer.themoviedb.org/v4/reference/list-create ; https://developer.themoviedb.org/v4/reference/list-add-items
