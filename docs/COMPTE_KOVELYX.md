# Compte unique Ma-Collection et Kovelyx

## Ce qui est disponible

Le site Ma-Collection propose **Compte Kovelyx → Créer mon compte / Se connecter**. Il utilise la même API d'identification compatible Supabase Auth que l'application Kovelyx : e-mail + mot de passe.

**Important : un dépôt GitHub Pages ne peut pas héberger de manière sécurisée un système de comptes à lui seul.** Aucun serveur de comptes public Kovelyx n'est actuellement défini dans le code des applications. Le formulaire reste donc **indisponible tant qu'un serveur n'est pas configuré** : aucun compte fictif n'est créé.

L'application PC propose déjà la connexion, l'inscription et un serveur personnalisé. Pour retrouver **la même identité sur le site et dans l'application**, il faut sélectionner *exactement la même instance de serveur* des deux côtés. Une connexion dans le navigateur ne connecte pas automatiquement l'application : chaque appareil doit ouvrir sa propre session.

## Préparer l'instance de comptes

1. Utilisez une instance Supabase Auth/PostgREST que vous gérez ou un serveur entièrement compatible. L'instance doit être accessible en **HTTPS** depuis les deux appareils.
2. Configurez Auth (inscription par e-mail, confirmation, éventuel SMTP) et les accès réseau/CORS pour l'origine du site `https://anderson76389.github.io`. Sans serveur, la connexion reste désactivée.
3. Pour les **profils et collections synchronisés dans Kovelyx**, déployez également le backend et les tables/endpoints que la version Kovelyx attend. **Une instance Supabase Auth vide ne suffit pas à synchroniser les profils.** N'utilisez pas les serveurs d'autres éditeurs.
4. Pour les **préférences sauvegardées par Ma-Collection** (sélections et clés chiffrées localement), exécutez le fichier [SQL ma_collection_vaults](sql/ma_collection_vaults.sql) dans *votre* base de données. Ce coffre chiffré est distinct des profils de l'application.

## Côté site

1. Ouvrez Ma-Collection et cliquez sur l'icône **Compte**, puis **Compte Kovelyx · Inscription / connexion**.
2. Renseignez l'URL de base HTTPS du serveur (ex. `https://mon-instance.supabase.co`) et sa **clé publique publishable/anon**, puis cliquez **Configurer ce serveur**. La configuration est enregistrée uniquement dans ce navigateur.
3. Cliquez **Créer mon compte** avec une adresse e-mail et un mot de passe personnel. Si la confirmation par e-mail est activée, validez l'e-mail avant de vous connecter.
4. Cliquez **Se connecter** : un retour *Connecté* n'est affiché qu'après une réponse d'authentification du serveur.
5. Dans Kovelyx PC, configurez le même serveur et la même clé publique, puis connectez-vous avec **les mêmes identifiants**.

**Ne saisissez jamais une clé `service_role`, `sb_secret_...` ou votre mot de passe administrateur dans le site**. La clé publique n'est pas un secret ; les autorisations serveur sont contrôlées par les politiques RLS.

## Sauvegarde des données

- Les **catalogues JSON** peuvent toujours être téléchargés et importés sans compte.
- Les clés API TMDB, MDBList ou débridage sont **des secrets**. Ne les publiez pas sur GitHub et ne les mettez pas dans l'URL du navigateur.
- La fonction **Sauvegarde locale** chiffre les préférences du site en AES-GCM avec une **phrase secrète de sauvegarde distincte du mot de passe du compte**.
- Une fois connecté au même serveur, cette sauvegarde chiffrée peut être enregistrée dans `ma_collection_vaults`, sous réserve des politiques RLS. Les données restent illisibles sans la phrase secrète ; la perte de cette phrase empêche leur récupération.
- Le site garde le coffre local en cas d'indisponibilité du cloud : **une sauvegarde locale réussie ne signifie pas automatiquement que la sauvegarde distante a réussi**.
- Les **profils, progression de lecture et collections du compte Kovelyx** sont la responsabilité de son backend et non du coffre web ; ils ne sont pas magiquement copiés par le formulaire d'inscription.

## Pour rendre l'inscription accessible à tout le monde

Il faut déployer un serveur Kovelyx opérationnel (avec son schéma et ses règles de sécurité), définir une URL et une clé publique communes et déployer la configuration dans les applications. **Cette étape exige un serveur réellement provisionné**, non un placeholder dans le code.

La sauvegarde locale et l'importation sans compte restent possibles avant le déploiement.
