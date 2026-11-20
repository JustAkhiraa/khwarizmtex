// Fabrique la feuille de style minifiée (dist/khwarizm.css) et sa copie en
// module (src/styles/stylesheet.ts), qu'utilise injectStyles() pour les pages
// qui chargent seulement le script.
//
// Minification prudente : commentaires retirés, blancs réduits. Les espaces
// autour de + et - sont gardés (calc() en a besoin).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/styles/khwarizm.css'), 'utf8');

export function minify(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};>,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

const min = minify(source);
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/khwarizm.css'), min + '\n');
writeFileSync(
  join(root, 'src/styles/stylesheet.ts'),
  '// Fichier fabriqué par scripts/build-css.mjs à partir de khwarizm.css : ne pas le modifier.\n' +
    `export const STYLESHEET = ${JSON.stringify(min)};\n`,
);
console.log(`khwarizm.css : ${source.length} → ${min.length} octets`);
