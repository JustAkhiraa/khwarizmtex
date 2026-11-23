/**
 * Dessin d'une molécule : des chemins SVG calculés, sans mesure dans la page.
 * Même principe que le tableau blanc : un calcul, une chaîne « d », un tracé.
 */
import type { MoleculeNode } from '../ast/nodes';
import { molecularFormula } from '../parser/molecule';
import { el, type VElement, type VNode } from './vnode';

/** Unités par longueur de liaison, et par em (une liaison fait 1,5 em). */
const BOND = 45;
const EM = 30;

const n = (v: number): string => String(Math.round(v * 100) / 100);

export function drawMolecule(node: MoleculeNode): { node: VElement; width: number; height: number } {
  const points = node.atoms.map((a) => ({ x: a.x * BOND, y: a.y * BOND }));
  const labelled = node.atoms.map((a) => a.element !== 'C' || a.charge !== 0 || a.degree === 0);
  const children: VNode[] = [];
  let solid = '';
  let lines = '';

  for (const bond of node.bonds) {
    const a = points[bond.from];
    const b = points[bond.to];
    if (!a || !b) continue;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / length;
    const uy = (b.y - a.y) / length;
    // La liaison s'arrête avant les lettres, sans jamais s'inverser.
    const room = Math.min(13, length / 3);
    const p = { x: a.x + (labelled[bond.from] ? ux * room : 0), y: a.y + (labelled[bond.from] ? uy * room : 0) };
    const q = { x: b.x - (labelled[bond.to] ? ux * room : 0), y: b.y - (labelled[bond.to] ? uy * room : 0) };
    const line = (shift: number, trim: number): void => {
      const dx = -uy * shift;
      const dy = ux * shift;
      lines += `M${n(p.x + dx + ux * trim)} ${n(p.y + dy + uy * trim)}L${n(q.x + dx - ux * trim)} ${n(q.y + dy - uy * trim)}`;
    };
    if (bond.wedge === 'up') {
      solid += `M${n(p.x)} ${n(p.y)}L${n(q.x - uy * 5)} ${n(q.y + ux * 5)}L${n(q.x + uy * 5)} ${n(q.y - ux * 5)}Z`;
    } else if (bond.wedge === 'down') {
      for (let i = 1; i <= 7; i++) {
        const t = i / 7;
        const x = p.x + (q.x - p.x) * t;
        const y = p.y + (q.y - p.y) * t;
        lines += `M${n(x - uy * 5 * t)} ${n(y + ux * 5 * t)}L${n(x + uy * 5 * t)} ${n(y - ux * 5 * t)}`;
      }
    } else if (bond.order === 1) line(0, 0);
    else if (bond.order === 3) {
      line(0, 0);
      line(5, 3);
      line(-5, 3);
    } else {
      // Le second trait se place du côté des voisins (vers l'intérieur d'un cycle).
      let side = 0;
      for (const other of node.bonds) {
        if (other === bond) continue;
        for (const [here, there] of [[other.from, other.to], [other.to, other.from]] as const) {
          const c = points[there];
          if ((here === bond.from || here === bond.to) && c) {
            side += Math.sign(Math.round(ux * (c.y - a.y) - uy * (c.x - a.x)));
          }
        }
      }
      if (side === 0) {
        line(3, 0);
        line(-3, 0);
      } else {
        line(0, 0);
        line(Math.sign(side) * 6, 5);
      }
    }
  }
  if (lines) children.push(el('path', { d: lines, class: 'khw-mol-line' }));
  if (solid) children.push(el('path', { d: solid, class: 'khw-mol-solid' }));

  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  const reach = (x0: number, x1: number, y: number, half: number): void => {
    left = Math.min(left, x0);
    right = Math.max(right, x1);
    top = Math.min(top, y - half);
    bottom = Math.max(bottom, y + half);
  };
  node.atoms.forEach((atom, i) => {
    const at = points[i];
    if (!at) return;
    reach(at.x - 3, at.x + 3, at.y, 3);
    if (!labelled[i]) return;
    const half = atom.element.length > 1 ? 13 : 9;
    let lean = 0;
    for (const bond of node.bonds) {
      const other = bond.from === i ? points[bond.to] : bond.to === i ? points[bond.from] : undefined;
      if (other) lean += other.x - at.x;
    }
    const text = (x: number, y: number, anchor: string, value: string, small = false): void => {
      children.push(el('text', { x: n(x), y: n(y), 'text-anchor': anchor, class: small ? 'khw-mol-small' : 'khw-mol-text' }, [value]));
    };
    const baseline = at.y + 8;
    text(at.x, baseline, 'middle', atom.element);
    reach(at.x - half, at.x + half, at.y, 13);
    let end = at.x + half;
    if (atom.hydrogens > 0) {
      const count = atom.hydrogens > 1 ? String(atom.hydrogens) : '';
      // Les H vont du côté libre : à gauche quand la liaison part à droite.
      if (lean > 1) {
        const start = at.x - half - (count ? 10 : 0);
        text(start, baseline, 'end', 'H');
        if (count) text(at.x - half, baseline + 6, 'end', count, true);
        reach(start - 18, at.x, at.y, count ? 17 : 13);
      } else {
        text(end, baseline, 'start', 'H');
        end += 18;
        if (count) {
          text(end, baseline + 6, 'start', count, true);
          end += 9;
        }
        reach(at.x, end, at.y, count ? 17 : 13);
      }
    }
    if (atom.charge !== 0) {
      text(end, baseline - 11, 'start', atom.charge > 0 ? '+' : '−', true);
      reach(at.x, end + 11, at.y, 18);
    }
  });
  const pad = 2;
  const w = right - left + 2 * pad;
  const h = bottom - top + 2 * pad;
  return {
    width: w / EM,
    height: h / EM,
    node: el(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        class: 'khw-molecule',
        viewBox: `${n(left - pad)} ${n(top - pad)} ${n(w)} ${n(h)}`,
        style: `width:${n(w / EM)}em;height:${n(h / EM)}em`,
        role: 'img',
        'aria-label': `Molécule ${molecularFormula(node)}`,
        focusable: 'false',
      },
      children,
    ),
  };
}
