// Mesure la vitesse du rendu en chaîne (rendu serveur). Lancer après « npm run build ».
import { renderToString } from '../dist/index.js';

const formulas = [
  'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
  '\\sum_{n=1}^{+\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}',
  '\\int_0^1 x^n \\, dx = \\frac{1}{n+1}',
  'A = \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
  '\\begin{aligned} (a+b)^2 &= a^2 + 2ab + b^2 \\end{aligned}',
  '\\left( \\frac{a}{b} \\right)^2 + \\vec{u} \\cdot \\vec{v}',
  'e^{i\\pi} + 1 = 0',
  '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1',
];

for (let i = 0; i < 500; i++) for (const f of formulas) renderToString(f, { displayMode: true });

const rounds = 3000;
const t0 = performance.now();
for (let i = 0; i < rounds; i++) for (const f of formulas) renderToString(f, { displayMode: true });
const ms = performance.now() - t0;
const per = (ms * 1000) / (rounds * formulas.length);
console.log(`${rounds * formulas.length} formules en ${ms.toFixed(0)} ms : ${per.toFixed(1)} µs par formule (HTML + MathML).`);
