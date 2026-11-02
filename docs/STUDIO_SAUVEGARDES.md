# Historique de sauvegardes du Studio — Ma-Collection

L'onglet **Profils & sauvegardes** du Studio comporte un historique local persistant.

## Fonctionnement

- **Sauvegarder ce brouillon** conserve un instantané des réglages affichés, sans les appliquer.
- Lorsque **Appliquer ce profil à Ma-Collection** est utilisé, le Studio tente de créer une sauvegarde de la configuration précédente avant la modification.
- **Restaurer** charge l'instantané dans le brouillon. Vous pouvez l'inspecter avant de cliquer sur Appliquer.
- **Exporter** crée un fichier JSON compatible avec **Importer un profil (.json)**.
- **Supprimer** efface uniquement l'instantané sélectionné. Le catalogue et les profils déjà appliqués sont inchangés.

Le Studio conserve jusqu'à **8 sauvegardes par navigateur et par origine web** et efface automatiquement les plus anciennes. Ces sauvegardes sont placées dans IndexedDB ; elles ne sont pas envoyées à un serveur. Les images restent référencées par leurs URLs HTTPS, pas copiées dans l'historique.

## Données enregistrées

L'instantané contient uniquement les préréglages reconnus du Studio : identité locale du préréglage, noms, ordres des sections et dossiers, activation des sources, URLs d'affiches/fonds/logos/GIF et préférences de rendu du Studio.

Aucun identifiant de compte, mot de passe, jeton de connexion ou clé API ne doit être stocké dans les instantanés. Les objets sont filtrés par le validateur du schéma de préréglage avant l'écriture.

## Limites importantes

- Ce n'est **pas une synchronisation multiappareil**. Exportez un JSON pour déplacer manuellement un profil d'un appareil à l'autre.
- Si les données du navigateur ou du site sont effacées, les instantanés locaux peuvent disparaître. Exportez vos sauvegardes importantes.
- En navigation privée, l'espace IndexedDB peut être éphémère ou indisponible.
- Si IndexedDB est bloqué, l'application d'un profil reste possible avec son annulation en mémoire pendant la page courante, mais sans garantie d'archive persistante. Un avertissement est affiché.
- Le format des profils est validé selon les catégories et dossiers actuellement chargés ; les identifiants qui n'existent plus dans le catalogue ne peuvent être restaurés à l'identique.
- Les paramètres du lecteur, l'authentification Nuvio, et les clés privées ne sont pas sauvegardés ici.

Pour les fichiers d'images, privilégiez votre propre hébergement Ma-Art. La sauvegarde d'une URL ne préserve pas le fichier source si l'hébergeur est supprimé.
