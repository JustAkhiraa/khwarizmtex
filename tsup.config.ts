import { defineConfig } from 'tsup';

// Deux sorties :
// 1. la bibliothèque (ESM + CJS + types), découpée pour le tree-shaking ;
// 2. un fichier autonome pour <script src> (global KhwarizmTeX), utilisé par la démo
//    et par toute page qui s'ouvre d'un double-clic, sans serveur.
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    treeshake: true,
    target: 'es2020',
    minify: false,
  },
  {
    entry: { 'khwarizmtex.global': 'src/global.ts' },
    format: ['iife'],
    globalName: 'KhwarizmTeX',
    outExtension: () => ({ js: '.js' }),
    sourcemap: true,
    clean: false,
    target: 'es2020',
    minify: true,
  },
]);
