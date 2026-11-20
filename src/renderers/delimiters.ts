/**
 * Délimiteurs extensibles et signe radical.
 *
 * Les crochets, barres, planchers et plafonds sont de simples bordures CSS.
 * Parenthèses, accolades, chevrons et radical sont des tracés SVG calculés
 * pour la hauteur prévue : courbes et pointes gardent leurs proportions. Le
 * CSS étire ensuite le dessin à la hauteur réelle du contenu ; l'écart avec
 * la prévision est faible, la déformation invisible.
 */
import { el, type VElement } from './vnode';

/** Coordonnées en em, écrites en millièmes d'em dans le viewBox. */
function n(v: number): string {
  return String(Math.round(v * 1000));
}

function svg(width: number, height: number, paths: { d: string; className?: string }[]): VElement {
  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      class: 'khw-svg',
      viewBox: `0 0 ${n(width)} ${n(height)}`,
      preserveAspectRatio: 'none',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    paths.map((p) => el('path', { d: p.d, class: p.className })),
  );
}

/** Miroir horizontal d'un tracé (liste de points x,y alternés après chaque commande). */
function mirror(points: number[][], width: number): number[][] {
  return points.map((pt) => pt.map((v, i) => (i % 2 === 0 ? width - v : v)));
}

/** Tracé SVG à partir de segments [commande, x1, y1, ...]. */
function pathOf(commands: string[], points: number[][]): string {
  let d = '';
  for (let i = 0; i < commands.length; i++) {
    d += (commands[i] ?? '') + (points[i] ?? []).map(n).join(' ');
  }
  return d + 'Z';
}

/** Parenthèse pleine : plus épaisse au milieu, effilée aux pointes. */
function paren(height: number, left: boolean): VElement {
  const grow = Math.min(3, Math.max(0, height - 1));
  const t = 0.062 + 0.012 * grow; // épaisseur au milieu
  const depth = 0.2 + 0.05 * grow; // creux de la courbe
  const x0 = 0.07;
  const x1 = x0 + depth;
  const tip = 0.022;
  const width = x1 + tip + 0.07;
  const L = Math.min(height / 2, 0.75);
  const h = height;
  const d1 = depth * 0.5;
  const xi = x0 + t;
  const xt = x1 + tip;
  const dIn = (xt - xi) * 0.5;
  const cmds = ['M', 'C', 'L', 'C', 'L', 'C', 'L', 'C'];
  let pts: number[][] = [
    [x1, 0],
    [x1 - d1, 0.25 * L, x0, 0.55 * L, x0, L],
    [x0, h - L],
    [x0, h - 0.55 * L, x1 - d1, h - 0.25 * L, x1, h],
    [xt, h],
    [xt - dIn, h - 0.25 * L, xi, h - 0.55 * L, xi, h - L],
    [xi, L],
    [xi, 0.55 * L, xt - dIn, 0.25 * L, xt, 0],
  ];
  if (!left) pts = mirror(pts, width);
  return delimSpan('paren', width, svg(width, h, [{ d: pathOf(cmds, pts), className: 'khw-fill' }]));
}

/** Accolade : deux crosses et une pointe au milieu (trait d'épaisseur constante). */
function brace(height: number, left: boolean): VElement {
  const h = height;
  const width = 0.5;
  const s = 0.03;
  const xs = 0.25;
  const xr = 0.43;
  const xl = 0.07;
  const r = Math.min(0.2, h / 6);
  const m = h / 2;
  let pts: number[][] = [
    [xr, s],
    [xs, s, xs, s + r],
    [xs, m - r],
    [xs, m, xl, m],
    [xs, m, xs, m + r],
    [xs, h - s - r],
    [xs, h - s, xr, h - s],
  ];
  if (!left) pts = mirror(pts, width);
  const cmds = ['M', 'Q', 'L', 'Q', 'Q', 'L', 'Q'];
  const d = pathOf(cmds, pts).slice(0, -1); // tracé ouvert
  return delimSpan('brace', width, svg(width, h, [{ d }]));
}

/** Chevron ⟨ ⟩ et barres obliques / \. */
function lines(kind: string, height: number, points: number[][], width: number): VElement {
  const d = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.map(n).join(' ')).join('');
  return delimSpan(kind, width, svg(width, height, [{ d }]));
}

function angle(height: number, left: boolean): VElement {
  const width = 0.34 + 0.07 * Math.min(3, Math.max(0, height - 1));
  const s = 0.03;
  const a = 0.06;
  const pts = left
    ? [
        [width - a, s],
        [a, height / 2],
        [width - a, height - s],
      ]
    : [
        [a, s],
        [width - a, height / 2],
        [a, height - s],
      ];
  return lines('angle', height, pts, width);
}

function slash(height: number, back: boolean): VElement {
  const width = 0.3 + 0.18 * Math.min(3, Math.max(0, height - 1));
  const s = 0.03;
  const pts = back
    ? [
        [0.05, s],
        [width - 0.05, height - s],
      ]
    : [
        [width - 0.05, s],
        [0.05, height - s],
      ];
  return lines('slash', height, pts, width);
}

function delimSpan(kind: string, width: number, content?: VElement): VElement {
  return el('span', { class: `khw-delim khw-delim-${kind}`, style: `width:${(Math.round(width * 1000) / 1000).toString()}em` }, content ? [content] : []);
}

/** Délimiteurs dessinés par des bordures CSS (aucune géométrie à calculer). */
const BORDERED: Record<string, string> = {
  '[': 'lbrack',
  ']': 'rbrack',
  '⌊': 'lfloor',
  '⌋': 'rfloor',
  '⌈': 'lceil',
  '⌉': 'rceil',
  '|': 'vert',
  '‖': 'dvert',
  '⟦': 'ldbrack',
  '⟧': 'rdbrack',
};

/**
 * Délimiteur extensible de hauteur `height` (em). Renvoie null quand aucun
 * dessin n'existe : l'appelant affiche alors le caractère tel quel.
 */
export function stretchyDelimiter(char: string, height: number): VElement | null {
  const h = Math.max(1, height);
  if (char === '') return el('span', { class: 'khw-delim khw-delim-null' });
  const bordered = BORDERED[char];
  if (bordered) return el('span', { class: `khw-delim khw-delim-${bordered}` });
  switch (char) {
    case '(':
      return paren(h, true);
    case ')':
      return paren(h, false);
    case '{':
      return brace(h, true);
    case '}':
      return brace(h, false);
    case '⟨':
      return angle(h, true);
    case '⟩':
      return angle(h, false);
    case '/':
      return slash(h, false);
    case '\\':
      return slash(h, true);
    default:
      return null;
  }
}

/** Signe radical pour une racine de hauteur totale `height` (em). */
export function surd(height: number): VElement {
  const h = Math.max(1, height);
  const width = 0.6 + 0.07 * Math.min(4, Math.max(0, h - 1.3));
  const p0 = [0.03, h - 0.36];
  const p1 = [0.15, h - 0.43];
  const p2 = [0.33, h - 0.03];
  const p3 = [width, 0.025];
  const thin = `M${p0.map(n).join(' ')}L${p1.map(n).join(' ')}M${p2.map(n).join(' ')}L${p3.map(n).join(' ')}`;
  const heavy = `M${p1.map(n).join(' ')}L${p2.map(n).join(' ')}`;
  return el(
    'span',
    { class: 'khw-surd', style: `width:${(Math.round(width * 1000) / 1000).toString()}em` },
    [svg(width, h, [{ d: thin }, { d: heavy, className: 'khw-heavy' }])],
  );
}
