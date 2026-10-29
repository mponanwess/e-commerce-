# La boutique : démo pour les partenaires

Un site statique (HTML, Tailwind, Alpine) qui montre la boutique telle qu’elle
sera : l’accueil en mosaïque, les résultats de recherche, les rayons, la fiche
produit, la pastille et ses panneaux, le paiement, la confirmation et le suivi
de commande.

Il n’y a pas de serveur : le panier et la commande restent dans le navigateur,
aucun paiement n’est fait et le site est caché des moteurs de recherche.

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

Les photos sont dans `img/`, et chaque pièce en liste plusieurs (`photos` dans
`js/data.js`) : la première, détourée en WebP transparent de 640 × 640 px, est
posée sur l’étal ; sur la fiche, les chevrons les font toutes défiler. Pour la
démo, ce sont les photos des maquettes et un détail recadré dedans (`-detail`) ;
les coloris noir et ocre du t-shirt sont teintés depuis le blanc. Pour une
pièce à toi : photo à plat de face, puis de dos, détails, portée… au même
format, listées dans `photos`. La casquette « Ralph » et les baskets
ressemblent à des produits de marque : remplace-les avant de montrer le site
hors du cercle des partenaires.

## Pendant la présentation

- `?vue=pastel` ou `?vue=blanc` choisit l’accueil ; on peut aussi basculer dans
  le panneau Catalogue, en bas : « Accueil de la démo ».
- `#catalogue`, `#panier`, `#recherche` ou `#suivre` à la fin d’une adresse
  ouvre ce panneau.
- `index.html?q=wax` montre les résultats d’une recherche,
  `index.html?rayon=hauts` un rayon (`?rayon=tout`, `?nouveautes=1` aussi).
- Le T-shirt délavé mène à la vue intermédiaire
  (`index.html?modele=tshirt-delave`) : ses trois coloris côte à côte, comme
  sur yeezy.com.
- Le foulard montre l’offre « 3 pour 6 500 FCFA » ; la commande 0427 d’Aïcha
  s’affiche tant qu’aucune commande n’a été passée.

## Mettre en ligne sur GitHub Pages

1. Avant chaque envoi : `docker compose run --rm npm run build` (CSS minifié,
   Alpine et polices à jour).
2. Envoie le dépôt sur GitHub, puis dans Settings → Pages, choisis « Deploy from
   a branch », branche `main`, dossier `/ (root)`.
3. Le site est servi à `https://<ton-compte>.github.io/<nom-du-depot>/`. Tous
   les liens sont relatifs : rien à configurer.

Avec un compte GitHub gratuit, Pages exige un dépôt public.
