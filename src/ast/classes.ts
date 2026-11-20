/**
 * Classe d'atome d'un nœud et espacements automatiques (règles de TeX).
 * Partagé par le parseur (\overset, \stackrel) et les deux moteurs de rendu.
 */
import type { AtomClass, MathNode } from './nodes';

/** Classe d'atome d'un nœud ; null pour ce qui n'est pas un atome (espace, retour à la ligne). */
export function atomClass(node: MathNode): AtomClass | null {
  switch (node.type) {
    case 'symbol':
    case 'delim':
    case 'underover':
      return node.cls;
    case 'group':
      if (node.cls) return node.cls;
      return 'ord';
    case 'frac':
    case 'fenced':
      return 'inner';
    case 'scripts':
      return node.base ? (atomClass(node.base) ?? 'ord') : 'ord';
    case 'op':
      return 'op';
    case 'accent':
      return node.accent === 'overbrace' || node.accent === 'underbrace' ? 'op' : 'ord';
    case 'array':
      return node.left || node.right ? 'inner' : 'ord';
    case 'style':
    case 'color': {
      const atoms = node.body.filter((n) => atomClass(n) !== null);
      if (atoms.length === 1 && atoms[0]) return atomClass(atoms[0]);
      return 'ord';
    }
    case 'phantom':
      return atomClass(node.body) ?? 'ord';
    case 'space':
    case 'newline':
      return null;
    default:
      return 'ord';
  }
}

/**
 * Règles 5 et 6 de TeX : un opérateur binaire devient ordinaire quand il
 * n'a pas d'opérande des deux côtés (« −x », « (−1) », « a = −b »).
 */
export function reclassify(classes: (AtomClass | null)[]): (AtomClass | null)[] {
  const out = classes.slice();
  let prev = -1;
  for (let i = 0; i < out.length; i++) {
    const cls = out[i];
    if (cls === null || cls === undefined) continue;
    const before = prev >= 0 ? out[prev] : undefined;
    if (cls === 'bin') {
      if (
        before === undefined ||
        before === 'bin' ||
        before === 'op' ||
        before === 'rel' ||
        before === 'open' ||
        before === 'punct'
      ) {
        out[i] = 'ord';
      }
    } else if ((cls === 'rel' || cls === 'close' || cls === 'punct') && before === 'bin') {
      out[prev] = 'ord';
    }
    prev = i;
  }
  if (prev >= 0 && out[prev] === 'bin') out[prev] = 'ord';
  return out;
}

/** 0 : rien ; 1 : fine (3 mu) ; 2 : moyenne (4 mu) ; 3 : large (5 mu). Négatif : seulement hors indices. */
const TABLE: Record<AtomClass, Record<AtomClass, number>> = {
  ord: { ord: 0, op: 1, bin: -2, rel: -3, open: 0, close: 0, punct: 0, inner: -1 },
  op: { ord: 1, op: 1, bin: 0, rel: -3, open: 0, close: 0, punct: 0, inner: -1 },
  bin: { ord: -2, op: -2, bin: 0, rel: 0, open: -2, close: 0, punct: 0, inner: -2 },
  rel: { ord: -3, op: -3, bin: 0, rel: 0, open: -3, close: 0, punct: 0, inner: -3 },
  open: { ord: 0, op: 0, bin: 0, rel: 0, open: 0, close: 0, punct: 0, inner: 0 },
  close: { ord: 0, op: 1, bin: -2, rel: -3, open: 0, close: 0, punct: 0, inner: -1 },
  punct: { ord: -1, op: -1, bin: 0, rel: -1, open: -1, close: -1, punct: -1, inner: -1 },
  inner: { ord: -1, op: 1, bin: -2, rel: -3, open: -1, close: 0, punct: -1, inner: -1 },
};

export type SpaceSize = 0 | 1 | 2 | 3;

/** Espace entre deux atomes voisins, en style normal ou en indice (script). */
export function spaceBetween(left: AtomClass, right: AtomClass, script: boolean): SpaceSize {
  const v = TABLE[left][right];
  if (v < 0) return script ? 0 : (-v as SpaceSize);
  return v as SpaceSize;
}

/** Largeur des espaces, en em : 3, 4 et 5 mu (1 mu = 1/18 em). */
export const SPACE_EM: Record<SpaceSize, number> = { 0: 0, 1: 3 / 18, 2: 4 / 18, 3: 5 / 18 };
