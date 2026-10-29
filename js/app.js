/* Ce qui fait vivre la démo sur toutes les pages : les prix, le panier, la
   pastille et ses panneaux, puis le composant de chaque page. Il n’y a pas de
   serveur : le panier et la commande restent dans le navigateur. */

(() => {
  const { boutique, rayons, suggestions, pieces, livraisons, paiements } = window.ETAL;

  // Le navigateur peut refuser le stockage (navigation privée, réglages) :
  // la démo marche alors, sans mémoire d’une page à l’autre.
  const lire = (cle, defaut, ou = 'localStorage') => {
    try {
      const valeur = window[ou].getItem(cle);
      return valeur === null ? defaut : JSON.parse(valeur);
    } catch {
      return defaut;
    }
  };
  const ecrire = (cle, valeur, ou = 'localStorage') => {
    try {
      window[ou].setItem(cle, JSON.stringify(valeur));
    } catch {
      // Sans stockage, la démo oublie, voilà tout.
    }
  };

  // « 10 000 FCFA » : des espaces insécables, pour ne jamais couper un prix.
  const fcfa = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
  const pluriel = (n) => `${n} pièce${n > 1 ? 's' : ''}`;
  const capitale = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  pieces.forEach((p, i) => {
    p.numero = String(i + 1).padStart(2, '0');
    // La première photo est celle de l’étal ; un modèle en plusieurs coloris
    // se montre sous son premier coloris.
    p.variantes?.forEach((v) => (v.image = v.photos[0]));
    p.photos ??= p.variantes[0].photos;
    p.image = p.photos[0];
    p.tailles ??= p.variantes?.[0].tailles;
  });

  const trouver = (slug) => pieces.find((p) => p.slug === slug);
  const rayonNom = (slug) => rayons.find((r) => r.slug === slug)?.nom ?? '';
  // Un coloris prend la photo et les tailles du modèle choisi.
  const decliner = (p, couleur) => {
    const v = p.variantes?.find((x) => x.couleur === couleur) ?? p.variantes?.[0];
    return v ? { ...p, image: v.image, photos: v.photos, tailles: v.tailles, coloris: v } : p;
  };
  const lienPiece = (p, couleur) => `produit.html?p=${p.slug}${couleur ? `&c=${couleur}` : ''}`;
  // Un modèle en plusieurs coloris mène d’abord à ses coloris, côte à côte.
  const lienCase = (p) => (p.coloris ? lienPiece(p, p.coloris.couleur) : p.variantes ? `index.html?modele=${p.slug}` : lienPiece(p));
  const prixEtiquette = (p) => (p.lot ? `${p.lot.quantite} pour ${fcfa(p.lot.prix)}` : fcfa(p.prix));
  // Les chaussures se mesurent en pointure, le reste en taille.
  const mesure = (p, t) => (t === 'TU' ? 'Taille unique' : `${p.rayon === 'chaussures' ? 'Pointure' : 'Taille'} ${t}`);
  // Les tailles encore en stock, tous coloris confondus.
  const taillesDe = (p) => (p.variantes?.flatMap((v) => v.tailles) ?? p.tailles).filter((t) => t.stock).map((t) => t.t);
  const ORDRE_TAILLES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const rangTaille = (t) => {
    const i = ORDRE_TAILLES.indexOf(t);
    if (i >= 0) return i;
    return t === 'TU' ? 999 : 100 + Number(t);
  };
  const TRANCHES = [
    { code: 'moins-5000', nom: 'Moins de 5 000', garde: (prix) => prix < 5000 },
    { code: '5000-10000', nom: '5 000 à 10 000', garde: (prix) => prix >= 5000 && prix <= 10000 },
    { code: 'plus-10000', nom: 'Plus de 10 000', garde: (prix) => prix > 10000 },
  ];
  const TRIS = {
    pertinence: { nom: 'Pertinence', ranger: () => 0 },
    nouveautes: { nom: 'Nouveautés', ranger: (a, b) => b.arrive.localeCompare(a.arrive) },
    'prix-croissant': { nom: 'Prix croissant', ranger: (a, b) => a.prix - b.prix },
    'prix-decroissant': { nom: 'Prix décroissant', ranger: (a, b) => b.prix - a.prix },
  };

  // Chaque mot cherché doit se trouver dans le nom, le rayon, la matière, les
  // coloris ou les mots-clés, sans tenir compte des accents ni du pluriel.
  const normaliser = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const correspond = (p, q) => {
    const texte = normaliser(
      [p.nom, rayonNom(p.rayon), p.infos.matiere, ...p.motsCles, ...(p.variantes ?? []).map((v) => v.nom)].join(' '),
    );
    return normaliser(q)
      .split(/\s+/)
      .filter(Boolean)
      .map((mot) => (mot.length > 3 ? mot.replace(/s$/, '') : mot))
      .every((mot) => texte.includes(mot));
  };

  // Le panier : une ligne par pièce, coloris et taille.
  const cleDe = (l) => [l.slug, l.couleur ?? '', l.taille].join('|');
  const stockDe = (slug, couleur, taille) =>
    decliner(trouver(slug), couleur).tailles.find((t) => t.t === taille)?.stock ?? 0;
  const article = (l) => {
    const p = decliner(trouver(l.slug), l.couleur);
    const detail = [p.coloris?.nom, mesure(p, l.taille)].filter(Boolean).join(' · ');
    return { ...l, cle: cleDe(l), nom: p.nom, image: p.image, prix: p.prix, detail };
  };
  // Une offre de lot (« 3 pour 6 500 FCFA ») s’applique à chaque groupe complet.
  const remiseDe = (lignes) =>
    pieces
      .filter((p) => p.lot)
      .reduce((remise, p) => {
        const n = lignes.filter((l) => l.slug === p.slug).reduce((s, l) => s + l.qte, 0);
        return remise + Math.floor(n / p.lot.quantite) * (p.lot.quantite * p.prix - p.lot.prix);
      }, 0);

  const dire = (date, options) => new Intl.DateTimeFormat('fr-FR', options).format(date);
  const heure = (date) => dire(date, { hour: '2-digit', minute: '2-digit' });
  const jourCourt = (date) => capitale(dire(date, { weekday: 'short', day: 'numeric', month: 'short' }));
  const plusJours = (date, n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  };
  // « dimanche 25 ou lundi 26 octobre »
  const fenetre = (debut, [a, b]) => {
    const d1 = plusJours(debut, a);
    const d2 = plusJours(debut, b);
    const long = { weekday: 'long', day: 'numeric', month: 'long' };
    if (a === b) return dire(d1, long);
    const premier = d1.getMonth() === d2.getMonth() ? { weekday: 'long', day: 'numeric' } : long;
    return `${dire(d1, premier)} ou ${dire(d2, long)}`;
  };

  const chiffres = (s) => s.replace(/\D/g, '').replace(/^237/, '');
  const telValide = (s) => /^6\d{8}$/.test(chiffres(s));
  const masquer = (tel) => `+237 6•• •• •• ${tel.slice(-2)}`;
  const whatsapp = boutique.whatsapp ? `https://wa.me/${boutique.whatsapp}` : '#';

  // La commande d’Aïcha, celle des maquettes : montrée tant qu’aucune
  // commande n’a été passée dans ce navigateur.
  const exemple = () => ({
    numero: '0427',
    date: '2026-10-24T07:41:00',
    nom: 'Aïcha Mbarga',
    tel: '699123442',
    email: '',
    whatsapp: true,
    livraison: { ...livraisons[0], quartier: 'Bonapriso', rue: '', repere: 'portail bleu face à la pharmacie' },
    paiement: { code: 'om', libelle: 'Orange Money' },
    articles: [
      { slug: 'chemise-wax', couleur: null, taille: 'M', qte: 1 },
      { slug: 'baskets', couleur: null, taille: '42', qte: 1 },
    ].map(article),
    sousTotal: 26500,
    remise: 0,
    total: 28000,
  });
  const commande = () => {
    const c = lire('etal:commande', null) ?? exemple();
    c.articles = c.articles.filter((a) => trouver(a.slug)).map((a) => ({ ...a, image: article(a).image }));
    return c;
  };

  const adresseDe = (c) => {
    const l = c.livraison;
    if (l.type === 'atelier') return `${boutique.atelier.nom} · ${boutique.atelier.horaires}`;
    if (l.type === 'agence') return `${l.agence}, ${l.ville}`;
    return [l.quartier, l.rue, l.repere].filter(Boolean).join(', ');
  };

  // Les icônes au trait du design system, sur une grille de 24px.
  const svg = (chemins, classe = '') =>
    `<svg class="trait ${classe}" viewBox="0 0 24 24" aria-hidden="true">${chemins}</svg>`;
  const icone = {
    loupe: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
    sac: svg('<path d="M5.5 8.5h13l-1 11.5h-11z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>'),
    silhouette: svg('<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.6-3.6 3.4-5.6 7-5.6s6.4 2 7 5.6"/>'),
    menu: svg('<path d="M4 7h16M4 12h16M4 17h10"/>'),
    croix: svg('<path d="m6 6 12 12M18 6 6 18"/>'),
    fleche: svg('<path d="M7 17 17 7M9 7h8v8"/>'),
    moins: svg('<path d="M6 12h12"/>'),
    plus: svg('<path d="M12 6v12M6 12h12"/>'),
  };

  // Un panneau : un dialogue sombre, posé juste au-dessus de la pastille.
  const panneau = (nom, titre, contenu) => `
    <section class="panneau sur-sombre" data-panneau="${nom}" role="dialog" aria-modal="true" aria-labelledby="titre-${nom}"
      x-show="$store.ui.panneau === '${nom}'" x-cloak
      x-transition:enter="transition duration-200 ease-out" x-transition:enter-start="opacity-0 translate-y-2"
      x-transition:leave="transition duration-150 ease-in" x-transition:leave-end="opacity-0 translate-y-2">
      <div class="flex items-start justify-between gap-4">
        ${titre}
        <button type="button" class="panneau-fermer" aria-label="Fermer" @click="$store.ui.fermer()">${icone.croix}</button>
      </div>
      ${contenu}
    </section>`;

  const champTelephone = (id, nom, attributs = '') => `
    <div class="relative">
      <span class="pointer-events-none absolute top-1/2 left-[18px] -translate-y-1/2 font-semibold text-encre">+237</span>
      <input id="${id}" name="${nom}" type="tel" inputmode="tel" autocomplete="tel-national" class="champ-sombre pl-[66px]" placeholder="6XX XX XX XX" ${attributs}>
    </div>`;

  const panneaux = [
    panneau(
      'recherche',
      '<h2 id="titre-recherche" class="panneau-titre">Recherche</h2>',
      `<form action="index.html" method="get" role="search" class="mt-5">
        <input name="q" type="search" class="champ-sombre" placeholder="Tu cherches quoi&nbsp;?" aria-label="Tu cherches quoi&nbsp;?"
          autocomplete="off" enterkeyhint="search" data-focus>
      </form>
      <p class="intitule-panneau mt-6">Suggestions</p>
      <nav aria-label="Suggestions">
        ${suggestions.map((s) => `<a class="panneau-lien" href="${s.lien}"><span>${s.libelle}</span>${icone.fleche}</a>`).join('')}
      </nav>`,
    ),
    panneau(
      'panier',
      '<h2 id="titre-panier" class="panneau-titre">Panier</h2>',
      `<p class="mt-5 border-t border-sombre-survol pt-5" x-show="!$store.panier.nombre">Ton panier est vide. Fais un tour de l’étal&nbsp;: les belles pièces partent vite.</p>
      <div x-show="$store.panier.nombre">
        <ul class="mt-5 border-b border-sombre-survol">
          <template x-for="a in $store.panier.articles" :key="a.cle">
            <li class="flex items-center gap-3 border-t border-sombre-survol py-3.5">
              <span class="grid size-13 shrink-0 place-items-center bg-white p-1"><img :src="a.image" alt="" class="size-full object-contain"></span>
              <span class="min-w-0 flex-1">
                <span class="block font-semibold text-encre-claire" x-text="a.nom"></span>
                <span class="block text-[13px]" x-text="$fcfa(a.prix) + ' · ' + a.detail"></span>
              </span>
              <span class="quantite" role="group" :aria-label="'Quantité, ' + a.nom">
                <button type="button" :aria-label="a.qte > 1 ? 'Un de moins' : 'Retirer du panier'" @click="$store.panier.changer(a.cle, -1)">${icone.moins}</button>
                <span class="w-5 text-center font-semibold text-encre-claire" aria-live="polite" x-text="a.qte"></span>
                <button type="button" aria-label="Un de plus" :disabled="!$store.panier.encore(a.cle)" @click="$store.panier.changer(a.cle, 1)">${icone.plus}</button>
              </span>
            </li>
          </template>
        </ul>
        <p class="mt-4 flex items-center justify-between text-sm" x-show="$store.panier.remise">
          <span>Offre de lot</span><span x-text="'−' + $fcfa($store.panier.remise)"></span>
        </p>
        <p class="mt-4 flex items-center justify-between">
          <span class="text-[13px] font-semibold tracking-[0.08em] uppercase">Total</span>
          <span class="font-main text-[28px] leading-none text-encre-claire" x-text="$fcfa($store.panier.total)"></span>
        </p>
        <a href="paiement.html" class="bouton-principal mt-5">Passer au paiement</a>
      </div>`,
    ),
    panneau(
      'suivi',
      '<h2 id="titre-suivi" class="panneau-titre">Ta commande</h2>',
      `<p class="mt-3 text-sm">Pas de compte à créer&nbsp;: ton numéro de commande et ton téléphone suffisent.</p>
      <form action="suivi.html" method="get" class="mt-4 grid gap-3">
        <div>
          <label for="suivi-numero" class="intitule-panneau">Numéro de commande</label>
          <input id="suivi-numero" name="numero" class="champ-sombre" inputmode="numeric" placeholder="Ex. 0427" required data-focus>
        </div>
        <div>
          <label for="suivi-tel" class="intitule-panneau">Téléphone</label>
          ${champTelephone('suivi-tel', 'tel', 'required')}
        </div>
        <button type="submit" class="bouton-principal mt-1">Suivre ma commande</button>
      </form>`,
    ),
    panneau(
      'catalogue',
      '<h2 id="titre-catalogue" class="panneau-titre">Catalogue</h2>',
      `<div x-data="catalogue">
        <div role="group" aria-label="Pour qui" class="mt-4 flex flex-wrap gap-2">
          <template x-for="o in publics" :key="o.code">
            <button type="button" class="puce" :aria-pressed="String(public === o.code)" @click="public = o.code" x-text="o.nom"></button>
          </template>
        </div>
        <nav aria-label="Rayons" class="mt-3">
          <template x-for="l in liens" :key="l.nom">
            <a class="panneau-lien" :href="l.href"><span x-text="l.nom"></span>${icone.fleche}</a>
          </template>
        </nav>
        <!-- Pour la présentation : basculer l’accueil d’une maquette à l’autre. -->
        <p class="intitule-panneau mt-5">Accueil de la démo</p>
        <div role="group" aria-label="Accueil de la démo" class="flex gap-2">
          <button type="button" class="puce" :aria-pressed="String($store.vue.nom === 'blanc')" @click="$store.vue.choisir('blanc')">Blanc</button>
          <button type="button" class="puce" :aria-pressed="String($store.vue.nom === 'pastel')" @click="$store.vue.choisir('pastel')">Pastel</button>
        </div>
      </div>`,
    ),
  ];

  // Les filtres d’un rayon : seulement sur l’étal, dont ils filtrent les pièces.
  if (document.body.dataset.page === 'etal') {
    panneaux.push(
      panneau(
        'filtres',
        '<h2 id="titre-filtres" class="panneau-titre">Filtres</h2>',
        `<p class="intitule-panneau mt-5">Taille</p>
        <div role="group" aria-label="Taille" class="flex flex-wrap gap-2">
          <template x-for="t in taillesDispo" :key="t">
            <button type="button" class="puce" :aria-pressed="String($store.filtres.taille === t)" @click="$store.filtres.basculer('taille', t)" x-text="t"></button>
          </template>
        </div>
        <p class="intitule-panneau mt-5">Prix, en FCFA</p>
        <div role="group" aria-label="Prix" class="flex flex-wrap gap-2">
          <template x-for="t in tranches" :key="t.code">
            <button type="button" class="puce" :aria-pressed="String($store.filtres.prix === t.code)" @click="$store.filtres.basculer('prix', t.code)" x-text="t.nom"></button>
          </template>
        </div>
        <div class="mt-6 grid gap-3">
          <button type="button" class="bouton-principal" @click="$store.ui.fermer()" x-text="pieces.length ? 'Voir ' + pieces.length + (pieces.length > 1 ? ' pièces' : ' pièce') : 'Aucune pièce'"></button>
          <button type="button" class="bouton-secondaire" x-show="$store.filtres.nombre" @click="$store.filtres.effacer()">Tout effacer</button>
        </div>`,
      ),
    );
  }

  const boutonPastille = (nom, etiquette, contenu) => `
    <button type="button" class="pastille-bouton" aria-haspopup="dialog" ${etiquette}
      :aria-expanded="String($store.ui.panneau === '${nom}')" @click="$store.ui.basculer('${nom}', $el)">${contenu}</button>`;

  // La pastille : la seule navigation du site, avec ses quatre boutons.
  const pastille = `
    <div class="voile" x-show="$store.ui.panneau" x-cloak x-transition.opacity.duration.200ms @click="$store.ui.fermer()"></div>
    ${panneaux.join('')}
    <nav class="pastille sur-sombre" :class="$store.ui.panneau && 'est-pleine'" aria-label="Navigation">
      ${boutonPastille('recherche', 'aria-label="Rechercher"', icone.loupe)}
      ${boutonPastille(
        'panier',
        `:aria-label="'Panier, ' + $store.panier.nombre + ($store.panier.nombre > 1 ? ' pièces' : ' pièce')"`,
        `${icone.sac}<span class="compteur" x-show="$store.panier.nombre" x-cloak x-text="$store.panier.nombre"></span>`,
      )}
      ${boutonPastille('suivi', 'aria-label="Suivre ma commande"', icone.silhouette)}
      ${boutonPastille(
        'catalogue',
        'aria-label="Catalogue"',
        `<span class="grid" x-show="$store.ui.panneau !== 'catalogue'">${icone.menu}</span><span class="grid" x-show="$store.ui.panneau === 'catalogue'" x-cloak>${icone.croix}</span>`,
      )}
    </nav>`;

  const pied = `
    <nav aria-label="Pied de page" class="h-full">
      <ul class="flex h-full items-center justify-center gap-6 md:gap-8">
        <li><a class="lien-pied" href="${whatsapp}">Contact</a></li>
        <li><a class="lien-pied" href="#">Aide</a></li>
        <li><a class="lien-pied" href="#">Légal</a></li>
        <li><a class="lien-pied" href="${boutique.instagram || '#'}">Instagram</a></li>
      </ul>
    </nav>`;

  // Le nom de la boutique ne s’écrit qu’une fois, dans js/data.js.
  document.title = document.title.replace('Nom de la boutique', boutique.nom);

  // Posés avant qu’Alpine démarre, pour qu’il les prenne en charge.
  document.getElementById('pastille')?.insertAdjacentHTML('beforeend', pastille);
  document.getElementById('pied')?.insertAdjacentHTML('beforeend', pied);

  /* Le passage animé d’une page à l’autre (voir @view-transition dans le CSS) :
     la photo de la pièce et celle de sa case portent le même nom, « piece » ;
     le navigateur fait glisser l’une vers l’autre. La fiche nomme sa photo
     dans le CSS ; sur l’étal, il faut trouver la case liée à la pièce, qu’on
     y aille ou qu’on en revienne. */
  const cible = (url) => {
    const u = new URL(url, location.href);
    return { slug: u.searchParams.get('p') ?? u.searchParams.get('modele'), couleur: u.searchParams.get('c') };
  };
  // La photo de la case qui mène à cette pièce (ce coloris de préférence), si elle est à l’écran.
  const photoLiee = (url) => {
    const { slug, couleur } = cible(url);
    if (!slug) return null;
    const cases = [...document.querySelectorAll('a.case')].filter((a) => cible(a.href).slug === slug);
    const img = (cases.find((a) => couleur && cible(a.href).couleur === couleur) ?? cases[0])?.querySelector('img');
    const r = img?.getBoundingClientRect();
    return r && r.bottom > 0 && r.top < innerHeight ? img : null;
  };
  const nommer = (img) => {
    document.querySelectorAll('a.case img').forEach((i) => (i.style.viewTransitionName = ''));
    if (img) img.style.viewTransitionName = 'piece';
  };
  // Des deux adresses, celle qui désigne une pièce : l’autre page, sinon celle-ci (les coloris).
  const adressePiece = (autre) => (autre && cible(autre).slug ? autre : location.href);
  // Au départ. Le clic suffit aux navigateurs qui ne disent pas où l’on va.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a.case');
    if (a) nommer(a.querySelector('img'));
  });
  window.addEventListener('pageswap', (e) => {
    if (e.viewTransition && e.activation) nommer(photoLiee(adressePiece(e.activation.entry.url)));
  });
  // À l’arrivée.
  window.addEventListener('pagereveal', (e) => {
    if (!e.viewTransition) return;
    document.documentElement.classList.add('vt-arrivee');
    nommer(photoLiee(adressePiece(window.navigation?.activation?.from?.url ?? document.referrer)));
  });

  // Un chevron de retour revient à la page d’avant quand elle est de ce site
  // (les coloris, un rayon), sinon il suit son lien.
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-retour]') && document.referrer.startsWith(location.origin) && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });

  // Le bouton qui a ouvert le panneau, pour y ramener le clavier à la fermeture.
  let ouvreur = null;

  document.addEventListener('alpine:init', () => {
    const Alpine = window.Alpine;

    Alpine.magic('fcfa', () => fcfa);
    Alpine.store('boutique', boutique);

    // L’accueil de la démo : blanc ou pastel, au choix, et ?vue=pastel dans un lien.
    const demandee = new URLSearchParams(location.search).get('vue');
    if (['blanc', 'pastel'].includes(demandee)) ecrire('etal:vue', demandee);
    Alpine.store('vue', {
      nom: lire('etal:vue', 'blanc'),
      choisir(nom) {
        this.nom = nom;
        ecrire('etal:vue', nom);
      },
    });

    Alpine.store('panier', {
      lignes: lire('etal:panier', []).filter((l) => trouver(l.slug)),
      get articles() {
        return this.lignes.map(article);
      },
      get nombre() {
        return this.lignes.reduce((s, l) => s + l.qte, 0);
      },
      get sousTotal() {
        return this.articles.reduce((s, a) => s + a.prix * a.qte, 0);
      },
      get remise() {
        return remiseDe(this.lignes);
      },
      get total() {
        return this.sousTotal - this.remise;
      },
      // Faux quand tout le stock de cette taille est déjà dans le panier.
      ajouter(slug, couleur, taille) {
        const ligne = this.lignes.find((l) => cleDe(l) === cleDe({ slug, couleur, taille }));
        if ((ligne?.qte ?? 0) >= stockDe(slug, couleur, taille)) return false;
        if (ligne) ligne.qte++;
        else this.lignes.push({ slug, couleur, taille, qte: 1 });
        this.sauver();
        return true;
      },
      retirer(cle) {
        this.lignes = this.lignes.filter((l) => cleDe(l) !== cle);
        this.sauver();
      },
      // Il reste du stock pour en prendre un de plus.
      encore(cle) {
        const l = this.lignes.find((x) => cleDe(x) === cle);
        return Boolean(l) && l.qte < stockDe(l.slug, l.couleur, l.taille);
      },
      // Le « − » à 1 retire la pièce du panier.
      changer(cle, pas) {
        const l = this.lignes.find((x) => cleDe(x) === cle);
        if (!l || (pas > 0 && !this.encore(cle))) return;
        l.qte += pas;
        if (l.qte < 1) this.retirer(cle);
        else this.sauver();
      },
      vider() {
        this.lignes = [];
        this.sauver();
      },
      sauver() {
        ecrire('etal:panier', this.lignes);
      },
    });

    Alpine.store('ui', {
      panneau: null,
      basculer(nom, bouton) {
        if (this.panneau === nom) this.fermer();
        else this.ouvrir(nom, bouton);
      },
      ouvrir(nom, bouton = null) {
        this.panneau = nom;
        ouvreur = bouton;
        Alpine.nextTick(() => {
          const el = document.querySelector(`[data-panneau="${nom}"]`);
          (el?.querySelector('[data-focus]') ?? el?.querySelector('button, a, input'))?.focus();
        });
      },
      fermer() {
        if (!this.panneau) return;
        this.panneau = null;
        ouvreur?.focus();
        ouvreur = null;
      },
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') Alpine.store('ui').fermer();
    });
    // Un lien peut ouvrir un panneau : index.html#catalogue, #panier, #recherche
    // ou #suivre. Pratique pendant une présentation.
    document.addEventListener('alpine:initialized', () => {
      const nom = { '#suivre': 'suivi', '#panier': 'panier', '#catalogue': 'catalogue', '#recherche': 'recherche' }[location.hash];
      if (nom && document.getElementById('pastille')) Alpine.store('ui').ouvrir(nom);
    });
    // Un panier changé dans un autre onglet.
    window.addEventListener('storage', (e) => {
      if (e.key === 'etal:panier') Alpine.store('panier').lignes = lire('etal:panier', []);
    });

    // Les filtres d’un rayon : une taille, une tranche de prix.
    Alpine.store('filtres', {
      taille: '',
      prix: '',
      get nombre() {
        return (this.taille ? 1 : 0) + (this.prix ? 1 : 0);
      },
      basculer(nom, valeur) {
        this[nom] = this[nom] === valeur ? '' : valeur;
      },
      effacer() {
        this.taille = '';
        this.prix = '';
      },
    });

    Alpine.data('catalogue', () => ({
      public: new URLSearchParams(location.search).get('public') ?? '',
      publics: [
        { code: '', nom: 'Tout' },
        { code: 'femme', nom: 'Femme' },
        { code: 'homme', nom: 'Homme' },
      ],
      get liens() {
        const vers = (params) => {
          const u = new URLSearchParams(params);
          if (this.public) u.set('public', this.public);
          const requete = u.toString();
          return requete ? `index.html?${requete}` : 'index.html';
        };
        return [
          { nom: 'Tout voir', href: vers({ rayon: 'tout' }) },
          { nom: 'Nouveautés', href: vers({ nouveautes: '1' }) },
          ...rayons.map((r) => ({ nom: r.nom, href: vers({ rayon: r.slug }) })),
        ];
      },
    }));

    /* L’étal, en quatre modes :
       - accueil : toute la mosaïque, sans en-tête ;
       - recherche (?q=wax) : le champ, les rayons trouvés et le tri ;
       - rayon (?rayon=hauts, ?rayon=tout, ?nouveautes=1) : le titre, Pour qui,
         les onglets des rayons, les filtres et le tri ;
       - modele (?modele=tshirt-delave) : la vue intermédiaire, les coloris
         d’un modèle sur la même mosaïque, une case chacun. */
    Alpine.data('etal', () => ({
      mode: 'accueil',
      q: '',
      rayon: '',
      nouveautes: false,
      public: '',
      // Recherche : le rayon choisi parmi les résultats.
      parmi: '',
      tri: 'pertinence',
      cols: 2,
      modele: null,
      tranches: TRANCHES,
      publics: [
        { code: '', nom: 'Tout' },
        { code: 'femme', nom: 'Femme' },
        { code: 'homme', nom: 'Homme' },
      ],
      init() {
        const u = new URLSearchParams(location.search);
        const modele = trouver(u.get('modele'));
        if (modele?.variantes) {
          this.mode = 'modele';
          this.modele = modele;
        } else if (u.has('q')) {
          this.mode = 'recherche';
          this.q = u.get('q').trim();
        } else if (u.has('rayon') || u.has('nouveautes')) {
          this.mode = 'rayon';
          this.rayon = u.get('rayon') ?? '';
          this.nouveautes = u.has('nouveautes');
          this.public = u.get('public') ?? '';
          this.tri = 'nouveautes';
        }
        // L’adresse suit la recherche et le choix Pour qui : un lien partagé montre la même chose.
        this.$watch('q', () => {
          this.parmi = '';
          this.reecrire({ q: this.q });
        });
        this.$watch('public', () => this.reecrire({ public: this.public }));
        // Le nombre de colonnes décide quelles cases se touchent.
        const tablette = matchMedia('(min-width: 45rem)');
        const ordinateur = matchMedia('(min-width: 67.5rem)');
        const compter = () => {
          this.cols = ordinateur.matches ? 4 : tablette.matches ? 3 : 2;
        };
        compter();
        tablette.addEventListener('change', compter);
        ordinateur.addEventListener('change', compter);
      },
      reecrire(valeurs) {
        const u = new URLSearchParams(location.search);
        Object.entries(valeurs).forEach(([cle, v]) => (v || cle === 'q' ? u.set(cle, v) : u.delete(cle)));
        history.replaceState(null, '', `?${u}${location.hash}`);
      },
      get vue() {
        return this.$store.vue.nom;
      },
      // Avant les choix faits sur la page (rayon trouvé, filtres).
      get trouvees() {
        if (this.mode === 'recherche') return pieces.filter((p) => !this.q || correspond(p, this.q));
        if (this.mode === 'accueil') return pieces;
        return pieces.filter(
          (p) =>
            (this.nouveautes ? p.nouveau : this.rayon === 'tout' || p.rayon === this.rayon) &&
            (!this.public || p.public === this.public || p.public === 'mixte'),
        );
      },
      get pieces() {
        if (this.mode === 'modele') {
          // Chaque coloris dans sa case ; les étiquettes changent de coin d’une case à l’autre.
          return this.modele.variantes.map((v, i) => ({
            ...decliner(this.modele, v.couleur),
            cle: v.couleur,
            etiquette: { place: ['hg', 'hd'][i % 2], incl: [-2, 3, -3][i % 3] },
          }));
        }
        const f = this.$store.filtres;
        const tranche = TRANCHES.find((t) => t.code === f.prix);
        const liste = this.trouvees.filter(
          (p) =>
            (!this.parmi || p.rayon === this.parmi) &&
            (this.mode !== 'rayon' ||
              ((!f.taille || taillesDe(p).includes(f.taille)) && (!tranche || tranche.garde(p.prix)))),
        );
        return [...liste].sort(TRIS[this.tri].ranger);
      },
      get titre() {
        if (this.nouveautes) return 'Nouveautés';
        return this.rayon === 'tout' ? 'Toutes les pièces' : rayonNom(this.rayon);
      },
      get nombre() {
        return pluriel(this.pieces.length);
      },
      // Recherche : « Tout 3 », « Hauts 1 »… seulement les rayons trouvés.
      get rayonsTrouves() {
        return [
          { slug: '', nom: 'Tout', n: this.trouvees.length },
          ...rayons
            .map((r) => ({ ...r, n: this.trouvees.filter((p) => p.rayon === r.slug).length }))
            .filter((r) => r.n),
        ];
      },
      get onglets() {
        const vers = (params) => {
          const u = new URLSearchParams(params);
          if (this.public) u.set('public', this.public);
          return `index.html?${u}`;
        };
        return [
          { nom: 'Tout voir', href: vers({ rayon: 'tout' }), actif: this.rayon === 'tout' },
          { nom: 'Nouveautés', href: vers({ nouveautes: '1' }), actif: this.nouveautes },
          ...rayons.map((r) => ({ nom: r.nom, href: vers({ rayon: r.slug }), actif: this.rayon === r.slug })),
        ];
      },
      get triNom() {
        return TRIS[this.tri].nom;
      },
      get tris() {
        return Object.entries(TRIS)
          .filter(([code]) => code !== 'pertinence' || this.mode === 'recherche')
          .map(([code, t]) => ({ code, nom: t.nom }));
      },
      // Les tailles proposées dans les filtres : celles des pièces du rayon.
      get taillesDispo() {
        return [...new Set(this.trouvees.flatMap(taillesDe))].sort((a, b) => rangTaille(a) - rangTaille(b));
      },
      effacerRecherche() {
        this.q = '';
        this.$refs.champ.focus();
      },
      // Deux cases voisines, côte à côte ou l’une sur l’autre, n’ont jamais la même teinte.
      get teintes() {
        const choix = ['lin', 'argile', 'sauge', 'sable'];
        return this.pieces.reduce((res, _, i) => {
          const gauche = i % this.cols ? res[i - 1] : null;
          const dessus = res[i - this.cols];
          res.push([0, 1, 2, 3].map((k) => choix[(i + k) % 4]).find((t) => t !== gauche && t !== dessus));
          return res;
        }, []);
      },
      teinte(i) {
        return `var(--color-${this.teintes[i]})`;
      },
      lien: lienCase,
      prixEtiquette,
    }));

    Alpine.data('fiche', () => ({
      base: null,
      piece: null,
      taille: null,
      infos: false,
      ajoutee: false,
      message: '',
      ton: 'succes',
      minuteur: null,
      photo: 0,
      depart: null,
      init() {
        const u = new URLSearchParams(location.search);
        this.base = trouver(u.get('p')) ?? null;
        if (!this.base) return;
        this.piece = decliner(this.base, u.get('c'));
        // Une seule taille, disponible (accessoire, pièce unique) : elle est déjà choisie.
        const dispo = this.piece.tailles.filter((t) => t.stock);
        if (this.piece.tailles.length === 1 && dispo.length === 1) this.taille = dispo[0].t;
        document.title = `${this.piece.nom} · ${boutique.nom}`;
      },
      get lignesInfos() {
        const i = this.piece.infos;
        return [
          ['Pièce', i.piece],
          ['État', i.etat],
          ['Matière', i.matiere],
          ['Mesures à plat', i.mesures],
          ['Entretien', i.entretien],
        ];
      },
      // Le carrousel tourne en boucle : après la dernière photo, la première.
      defiler(pas) {
        const n = this.piece.photos.length;
        this.photo = (this.photo + pas + n) % n;
      },
      // Sur un écran tactile, un glissement du doigt fait défiler aussi.
      toucher(e) {
        this.depart = e.changedTouches[0].clientX;
      },
      lacher(e) {
        const dx = e.changedTouches[0].clientX - (this.depart ?? e.changedTouches[0].clientX);
        if (Math.abs(dx) > 40) this.defiler(dx < 0 ? 1 : -1);
        this.depart = null;
      },
      get altPhoto() {
        const sujet = [this.piece.nom, this.piece.coloris?.nom.toLowerCase()].filter(Boolean).join(' ');
        return `${sujet}, photo ${this.photo + 1} sur ${this.piece.photos.length}`;
      },
      lien(v) {
        return lienPiece(this.base, v.couleur);
      },
      prix: prixEtiquette,
      choisir(t) {
        if (!t.stock) return;
        this.taille = t.t;
        this.message = '';
        this.ajoutee = false;
      },
      ajouter() {
        if (!this.taille) {
          this.ton = 'alerte';
          this.message = 'Choisis ta taille d’abord';
          return;
        }
        const stock = this.piece.tailles.find((t) => t.t === this.taille).stock;
        const ok = this.$store.panier.ajouter(this.piece.slug, this.piece.coloris?.couleur ?? null, this.taille);
        this.ton = ok ? 'succes' : 'alerte';
        if (ok) this.message = 'Dans ton panier\u00a0!';
        else this.message = stock > 1 ? 'Tout le stock est déjà dans ton panier.' : 'Déjà dans ton panier\u00a0: c’est la seule.';
        this.ajoutee = ok;
        // La coche redevient un « + » : on peut reprendre un foulard de plus.
        clearTimeout(this.minuteur);
        this.minuteur = setTimeout(() => (this.ajoutee = false), 2500);
      },
    }));

    Alpine.data('paiement', () => ({
      nom: '',
      tel: '',
      email: '',
      whatsapp: true,
      livraison: 'douala',
      quartier: '',
      rue: '',
      repere: '',
      ville: '',
      agence: '',
      moyen: 'om',
      numero: '',
      erreurs: {},
      resume: false,
      reste: 15 * 60,
      livraisons,
      paiements,
      init() {
        // Les pièces sont gardées 15 min depuis l’ouverture du paiement,
        // rechargement compris.
        let fin = lire('etal:garde', 0, 'sessionStorage');
        if (fin < Date.now()) {
          fin = Date.now() + 15 * 60 * 1000;
          ecrire('etal:garde', fin, 'sessionStorage');
        }
        const compter = () => (this.reste = Math.max(0, Math.round((fin - Date.now()) / 1000)));
        compter();
        setInterval(compter, 1000);
        // Un colis envoyé par agence se paie avant le départ.
        this.$watch('livraison', () => {
          if (!this.mode.paiementLivraison && this.moyen === 'livraison') this.moyen = 'om';
        });
      },
      get mode() {
        return livraisons.find((l) => l.code === this.livraison);
      },
      get moyenChoisi() {
        return paiements.find((m) => m.code === this.moyen);
      },
      get total() {
        return this.$store.panier.total + this.mode.prix;
      },
      get chrono() {
        return `${Math.floor(this.reste / 60)}:${String(this.reste % 60).padStart(2, '0')}`;
      },
      get libelleBouton() {
        return this.moyen === 'livraison' ? `Valider ma commande · ${fcfa(this.total)}` : `Payer ${fcfa(this.total)}`;
      },
      autorise(m) {
        return m.code !== 'livraison' || this.mode.paiementLivraison;
      },
      valider() {
        const e = {};
        if (!this.nom.trim()) e.nom = 'Ton nom, pour le livreur.';
        if (!telValide(this.tel)) e.tel = 'Un numéro à 9 chiffres qui commence par 6.';
        if (this.email.trim() && !/^\S+@\S+\.\S+$/.test(this.email.trim())) e.email = 'Cette adresse a l’air incomplète.';
        if (this.mode.type === 'domicile') {
          if (!this.quartier.trim()) e.quartier = 'Ton quartier, pour le livreur.';
          if (!this.repere.trim()) e.repere = 'Un repère, pour te trouver du premier coup.';
        }
        if (this.mode.type === 'agence') {
          if (!this.ville.trim()) e.ville = 'La ville où tu retires ton colis.';
          if (!this.agence.trim()) e.agence = 'L’agence de voyage qui l’emporte.';
        }
        if (this.moyenChoisi.mobile && this.numero.trim() && !telValide(this.numero)) {
          e.numero = 'Un numéro à 9 chiffres qui commence par 6.';
        }
        this.erreurs = e;
        if (Object.keys(e).length) {
          this.$nextTick(() => document.querySelector('[aria-invalid="true"]')?.focus());
          return;
        }

        const panier = this.$store.panier;
        const n = lire('etal:numero', 426) + 1;
        ecrire('etal:numero', n);
        ecrire('etal:commande', {
          numero: String(n).padStart(4, '0'),
          date: new Date().toISOString(),
          nom: this.nom.trim(),
          tel: chiffres(this.tel),
          email: this.email.trim(),
          whatsapp: this.whatsapp,
          livraison: {
            ...this.mode,
            ville: this.mode.type === 'agence' ? this.ville.trim() : this.mode.ville,
            quartier: this.quartier.trim(),
            rue: this.rue.trim(),
            repere: this.repere.trim(),
            agence: this.agence.trim(),
          },
          paiement: { code: this.moyen, libelle: this.moyenChoisi.libelle },
          articles: panier.articles,
          sousTotal: panier.sousTotal,
          remise: panier.remise,
          total: this.total,
        });
        panier.vider();
        try {
          sessionStorage.removeItem('etal:garde');
        } catch {
          // Sans stockage, rien à effacer.
        }
        location.href = 'confirmation.html';
      },
    }));

    Alpine.data('confirmation', () => {
      const c = commande();
      const date = new Date(c.date);
      const l = c.livraison;
      const paye = c.paiement.code !== 'livraison';
      const recu = c.whatsapp
        ? 'Le reçu est sur ton WhatsApp.'
        : c.email
          ? 'Le reçu est dans ta boîte e-mail.'
          : 'Le reçu t’arrive par SMS.';
      const reglement =
        c.paiement.code === 'carte'
          ? `Ta carte a été débitée de ${fcfa(c.total)}.`
          : `${c.paiement.libelle} a confirmé ${fcfa(c.total)}.`;
      const reception = {
        atelier: {
          titre: 'Tes pièces t’attendent à l’atelier',
          texte: `Dès ${dire(plusJours(date, 1), { weekday: 'long', day: 'numeric', month: 'long' })}, ${boutique.atelier.horaires}. On te les garde ${boutique.atelier.gardeJours} jours.`,
        },
        agence: {
          titre: 'On dépose ton colis à l’agence',
          texte: `Sous 48 h chez ${l.agence}, pour ${l.ville}. On t’envoie la photo du reçu de dépôt.`,
        },
        domicile: {
          titre: 'Le livreur t’appelle',
          texte: `${capitale(fenetre(date, l.jours))}, avant de passer à ${l.quartier}.`,
        },
      };
      return {
        c,
        prenom: c.nom.split(/\s+/)[0],
        intro: paye
          ? `Ton paiement est passé et tes pièces sont à toi. On t’a envoyé le récap ${c.whatsapp ? 'sur WhatsApp' : 'par SMS'}.`
          : 'Tes pièces sont mises de côté. On t’appelle pour confirmer ta commande.',
        etapes: [
          paye
            ? { titre: 'Paiement reçu', texte: `${reglement} ${recu}` }
            : {
                titre: 'Commande reçue',
                texte: `On t’appelle pour la confirmer. Tu paieras ${fcfa(c.total)} à la livraison, pièces en main.`,
              },
          { titre: 'On emballe tes pièces', texte: 'Chaque pièce est vérifiée, pliée et glissée dans du papier kraft, aujourd’hui.' },
          reception[l.type],
        ],
        livraison: `${l.libelle} · ${l.prix ? fcfa(l.prix) : 'gratuit'}`,
        adresse: adresseDe(c),
        reglement: paye ? `Payé le ${dire(date, { day: 'numeric', month: 'short' })} à ${heure(date)}` : 'À payer à la livraison',
        whatsapp,
      };
    });

    Alpine.data('suivi', () => {
      const c = commande();
      const date = new Date(c.date);
      const l = c.livraison;
      const paye = c.paiement.code !== 'livraison';
      // Le moment montré : les pièces sont emballées, le colis vient de partir.
      const emballe = new Date(date);
      if (date.getHours() < 13) emballe.setHours(15, 20, 0, 0);
      else emballe.setTime(plusJours(date, 1).setHours(11, 20, 0, 0));
      const depart = new Date(plusJours(emballe, 1).setHours(9, 5, 0, 0));
      const quand = (d) => `${jourCourt(d)} · ${heure(d)}`;
      const ceJour = (d) => (d.toDateString() === new Date().toDateString() ? 'Aujourd’hui' : jourCourt(d));
      const atelier = boutique.atelier;

      const suite = {
        domicile: [
          {
            titre: 'En route',
            quand: quand(depart),
            texte: 'Ton colis est parti de l’atelier. Garde ton téléphone près de toi.',
            livreur: true,
          },
          { titre: 'Livrée', texte: `Prévue ${fenetre(date, l.jours)}.` },
        ],
        atelier: [
          {
            titre: 'Prête à l’atelier',
            quand: quand(depart),
            texte: `Passe la chercher à Akwa, ${atelier.horaires}. On te la garde ${atelier.gardeJours} jours.`,
          },
          { titre: 'Retirée', texte: 'Viens avec ton numéro de commande.' },
        ],
        agence: [
          {
            titre: 'Déposée à l’agence',
            quand: quand(depart),
            texte: `Remis à ${l.agence}, direction ${l.ville}. On t’a envoyé la photo du reçu.`,
          },
          { titre: `Arrivée à ${l.ville}`, texte: `Prévue ${fenetre(date, l.jours)}. Tu la retires avec ta pièce d’identité.` },
        ],
      }[l.type];
      const prevue = {
        domicile: { intitule: 'Livraison prévue', texte: `${ceJour(depart)}, avant 13 h` },
        atelier: { intitule: 'À retirer', texte: `Dès ${ceJour(depart).toLowerCase()}` },
        agence: { intitule: 'Arrivée prévue', texte: jourCourt(plusJours(date, l.jours[1])) },
      }[l.type];
      const nombre = c.articles.reduce((s, a) => s + a.qte, 0);

      return {
        c,
        prevue,
        passee: `Passée le ${dire(date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${pluriel(nombre)}`,
        etapes: [
          {
            titre: paye ? 'Commande reçue' : 'Commande confirmée',
            quand: quand(date),
            texte: paye
              ? `Paiement ${c.paiement.code === 'carte' ? 'par carte' : c.paiement.libelle} confirmé. Tes pièces sont à toi.`
              : 'Confirmée par téléphone. Tu paieras à la livraison, pièces en main.',
            etat: 'fait',
          },
          {
            titre: 'Pièces emballées',
            quand: quand(emballe),
            texte: 'Chaque pièce est vérifiée, pliée et glissée dans du papier kraft.',
            etat: 'fait',
          },
          { ...suite[0], etat: 'encours' },
          { ...suite[1], etat: 'avenir' },
        ],
        destinataire: `${c.nom} · ${masquer(c.tel)}`,
        adresse:
          l.type === 'domicile' ? `${l.quartier}, ${l.ville} · ${[l.rue, l.repere].filter(Boolean).join(', ')}` : adresseDe(c),
        reglement: `${c.paiement.libelle} · ${paye ? 'payé' : 'à la livraison'}`,
        whatsapp,
      };
    });
  });
})();
