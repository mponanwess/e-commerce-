// GitHub Pages garde la feuille de style et les scripts 10 minutes en cache :
// sans rien d’autre, une mise en ligne n’apparaît pas tout de suite. Chaque lien
// vers css/, js/ ou vendor/ reçoit donc l’empreinte de son fichier (?v=…), qui
// change dès que le fichier change.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const empreinte = (fichier) => createHash('sha256').update(readFileSync(fichier)).digest('hex').slice(0, 8);
const LIEN = /(href|src)="((?:css|js|vendor)\/[^"?]+)(?:\?v=[0-9a-f]+)?"/g;

for (const page of readdirSync('.').filter((f) => f.endsWith('.html'))) {
  const avant = readFileSync(page, 'utf8');
  const apres = avant.replace(LIEN, (_, attribut, chemin) => `${attribut}="${chemin}?v=${empreinte(chemin)}"`);
  if (apres !== avant) writeFileSync(page, apres);
}
