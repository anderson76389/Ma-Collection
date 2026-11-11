# Audit d'indépendance — 16 octobre 2026

Objectif : Ma-Collection reste utilisable si ImKaptain/Kaptain disparaît.

## Ce qui est vérifié automatiquement

Le script `node .github/scripts/audit-upstream-independence.mjs` inspecte les 20 collections principales (sans modifier les données) et imprime un rapport JSON contenant :
- toutes les URL d'images utilisées, en distinguant `ma-art.mailpromahe.workers.dev` des hébergeurs externes ;
- les sources TMDB de type LIST, Trakt et les sources addons, qui restent dépendantes de fournisseurs ou d'auteurs tiers ;
- les références à des anciens services dans les fichiers de l'interface.

Le workflow `Audit de l'independance Ma-Collection` tourne chaque lundi et sur les PR. Son rapport JSON est disponible dans les **Artifacts** de l'exécution. Il bloque si des images de catalogues principaux pointent directement vers un hébergement Kaptain. Il **ne prétend pas** que tous les services externes sont autonomes lorsque le contrôle passe.

## Limites et points à résoudre

La vérification du 16 octobre a identifié **2 794 références d'images, dont 23 externes** dans les 20 fichiers des catégories principales. Une URL externe peut être légitime et une simple mention du nom de Kaptain peut être un commentaire ou une compatibilité historique. Ces éléments sont signalés, pas supprimés automatiquement.

Les listes gérées par une autre personne peuvent cesser d'être mises à jour après une suppression ; elles doivent être distinguées des filtres TMDB dynamiques autonomes et des classements historiques que l'on souhaite conserver fixes.

Les images archivée dans Ma-Art ne peuvent pas être rendues publiques automatiquement sans vérifier les droits de diffusion. La validation HTTP précédente des URL Cloudflare ne constitue pas, à elle seule, une vérification du SHA-256 de tous les contenus diffusés.

## Avant de certifier l'indépendance complète

1. Examiner les 23 références externes et leur disponibilité. Corriger toute URL mal formée **sans inventer un autre visuel** ; migrer uniquement les images dont les droits sont établis.
2. Identifier précisément les propriétaires des listes TMDB/Trakt et des addons. Remplacer uniquement les sources critiques dont les données ne sont ni figées ni sous notre contrôle.
3. Contrôler le plan et les options de facturation de Cloudflare dans le tableau de bord. Le script ne peut pas confirmer le plan réel du compte.
4. Tester le site et Kovelyx dans un navigateur réel en bloquant les domaines de Kaptain.
5. Exporter puis réimporter toutes les catégories ; confirmer les images, les nouveautés, la traduction et les profils existants.
6. Sauvegarder séparément les dépôts et les assets pour ne pas dépendre uniquement de GitHub ou de Cloudflare.

Ne jamais détruire ou renommer les anciens fichiers JSON sans migration et tests de régression.
