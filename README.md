# La boutique : démo pour les partenaires

Un site statique (HTML, Tailwind, Alpine) qui montre la boutique telle qu’elle
sera : l’accueil en mosaïque, la fiche produit, la pastille et ses panneaux, le
paiement, la confirmation et le suivi de commande. Il n’y a pas de serveur : le
panier et la commande restent dans le navigateur, aucun paiement n’est fait et
le site est caché des moteurs de recherche.

## Le voir sur ta machine

Node n’est pas installé sur la machine : tout passe par Docker.

```sh
docker compose run --rm npm install   # la première fois
docker compose up                     # http://localhost:8080
```

`docker compose up` recompile le CSS à chaque modification d’une page ou d’un
script. Recharge la page pour voir le changement.

## Modifier le contenu

Tout se change dans `js/data.js` : le nom de la boutique, les liens WhatsApp et
Instagram, les pièces (prix, tailles, stock, photo, place de l’étiquette), la
livraison et le paiement.

Les photos sont dans `img/`. Celles d’aujourd’hui sont des dessins provisoires :
remplace-les par tes pièces photographiées à plat, détourées sur fond
transparent (PNG ou WebP, environ 800 × 800 px), puis change le chemin `image`
de la pièce dans `js/data.js`.

## Pendant la présentation

- `?vue=pastel` ou `?vue=blanc` choisit l’accueil ; on peut aussi basculer dans
  le panneau Catalogue, en bas : « Accueil de la démo ».
- `#catalogue`, `#panier`, `#recherche` ou `#suivre` à la fin d’une adresse
  ouvre ce panneau.
- Le T-shirt délavé montre la vue intermédiaire (trois coloris), le foulard
  l’offre « 3 pour 6 500 FCFA », la commande 0427 d’Aïcha s’affiche tant
  qu’aucune commande n’a été passée.

## Mettre en ligne sur GitHub Pages

1. Avant chaque envoi : `docker compose run --rm npm run build` (CSS minifié,
   Alpine et polices à jour).
2. Envoie le dépôt sur GitHub, puis dans Settings → Pages, choisis « Deploy from
   a branch », branche `main`, dossier `/ (root)`.
3. Le site est servi à `https://<ton-compte>.github.io/<nom-du-depot>/`. Tous
   les liens sont relatifs : rien à configurer.

Avec un compte GitHub gratuit, Pages exige un dépôt public.
