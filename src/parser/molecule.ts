/**
 * Lecture de \molecule{atomes | liaisons}.
 *
 *   \molecule{C 0 0, C 1 0, O 1.5 -0.87 | 1-2, 2=3}
 *
 * Un atome : symbole (charge + ou - facultative), abscisse, ordonnée vers le bas ;
 * une liaison mesure environ 1. Liaisons : - simple, = double, # triple,
 * > coin plein (vers l'avant), < coin hachuré (vers l'arrière).
 */
import type { MoleculeNode } from '../ast/nodes';

export const MAX_ATOMS = 120;
const MAX_BONDS = 160;
const MAX_COORDINATE = 40;

const VALENCE: Record<string, number> = { C: 4, N: 3, O: 2, S: 2, P: 3, F: 1, Cl: 1, Br: 1, I: 1, B: 3 };
const ORDERS: Record<string, number> = { '-': 1, '=': 2, '#': 3, '>': 1, '<': 1 };

/** Analyse la description ; renvoie un message d'erreur si elle est illisible. */
export function parseMolecule(text: string): MoleculeNode | string {
  const [atomText = '', bondText = '', extra] = text.split('|');
  if (extra !== undefined) return 'un seul « | » sépare atomes et liaisons';
  const items = (s: string): string[] => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  const atoms: MoleculeNode['atoms'] = [];
  for (const item of items(atomText)) {
    const m = /^([A-Z][a-z]?)\s*([+-]?)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)$/.exec(item);
    if (!m) return `atome illisible « ${item.slice(0, 20)} » (exemple : C 0 0)`;
    const x = Number(m[3]);
    const y = Number(m[4]);
    if (Math.abs(x) > MAX_COORDINATE || Math.abs(y) > MAX_COORDINATE) return 'coordonnée trop grande';
    atoms.push({ element: m[1] as string, charge: m[2] === '+' ? 1 : m[2] === '-' ? -1 : 0, x, y, hydrogens: 0, degree: 0 });
    if (atoms.length > MAX_ATOMS) return `plus de ${MAX_ATOMS} atomes`;
  }
  if (atoms.length === 0) return 'aucun atome';
  const bonds: MoleculeNode['bonds'] = [];
  const used = atoms.map(() => 0);
  const seen = new Set<string>();
  for (const item of items(bondText)) {
    const m = /^(\d+)\s*([-=#<>])\s*(\d+)$/.exec(item);
    const from = Number(m?.[1]) - 1;
    const to = Number(m?.[3]) - 1;
    const a = atoms[from];
    const b = atoms[to];
    if (!m || !a || !b || a === b) return `liaison illisible « ${item.slice(0, 20)} » (exemple : 1-2)`;
    const key = Math.min(from, to) + ':' + Math.max(from, to);
    if (seen.has(key)) return `liaison en double entre ${from + 1} et ${to + 1}`;
    seen.add(key);
    if (a.x === b.x && a.y === b.y) return `atomes ${from + 1} et ${to + 1} au même endroit`;
    const kind = m[2] as string;
    const order = ORDERS[kind] ?? 1;
    bonds.push({ from, to, order, wedge: kind === '>' ? 'up' : kind === '<' ? 'down' : null });
    used[from] = (used[from] ?? 0) + order;
    used[to] = (used[to] ?? 0) + order;
    a.degree++;
    b.degree++;
    if (bonds.length > MAX_BONDS) return `plus de ${MAX_BONDS} liaisons`;
  }
  atoms.forEach((atom, i) => {
    const valence = VALENCE[atom.element];
    if (valence === undefined) return;
    const charged = atom.element === 'C' ? valence - Math.abs(atom.charge) : atom.element === 'B' ? valence - atom.charge : valence + atom.charge;
    atom.hydrogens = Math.max(0, charged - (used[i] ?? 0));
  });
  return { type: 'molecule', atoms, bonds };
}

/** Formule brute, ordre de Hill : C, H, puis l'ordre alphabétique. */
export function molecularFormula(node: MoleculeNode): string {
  const count = new Map<string, number>();
  const add = (name: string, n: number): void => {
    if (n > 0) count.set(name, (count.get(name) ?? 0) + n);
  };
  let charge = 0;
  for (const atom of node.atoms) {
    add(atom.element, 1);
    add('H', atom.hydrogens);
    charge += atom.charge;
  }
  const rank = (name: string): string => (count.has('C') ? (name === 'C' ? '0' : name === 'H' ? '1' : name) : name);
  const names = [...count.keys()].sort((a, b) => (rank(a) < rank(b) ? -1 : 1));
  const sign = charge === 0 ? '' : (Math.abs(charge) > 1 ? String(Math.abs(charge)) : '') + (charge > 0 ? '+' : '−');
  return names.map((n) => n + ((count.get(n) ?? 0) > 1 ? String(count.get(n)) : '')).join('') + sign;
}
