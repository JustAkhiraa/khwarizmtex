// Produit un site statique portable, séparé du paquet de la bibliothèque.
import { cpSync, mkdirSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const output = new URL('build/online/', root);
mkdirSync(output, { recursive: true });
cpSync(new URL('apps/online/', root), output, { recursive: true });
mkdirSync(new URL('engine/', output), { recursive: true });
for (const name of ['khwarizmtex.global.js', 'khwarizm.css', 'khwarizm-fonts.css', 'fonts']) {
  cpSync(new URL('dist/' + name, root), new URL('engine/' + name, output), { recursive: true });
}
console.log('Site statique prêt dans build/online (aucun compte rendu ni PDF de diagnostic inclus).');
