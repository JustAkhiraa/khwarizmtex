/**
 * Petites fonctions partagées par le parseur et la table des commandes.
 */
import type { ArrayKind, ColumnAlign, MathNode } from '../ast/nodes';

/** Fusionne les lettres voisines d'une même police (\mathrm{max} → un seul mot). */
export function mergeLetters(list: MathNode[]): MathNode[] {
  const out: MathNode[] = [];
  for (const node of list) {
    const prev = out[out.length - 1];
    if (
      node.type === 'symbol' &&
      node.role === 'mi' &&
      node.variant !== undefined &&
      node.variant !== 'italic' &&
      prev &&
      prev.type === 'symbol' &&
      prev.role === 'mi' &&
      prev.variant === node.variant &&
      /^\p{L}+$/u.test(prev.text + node.text)
    ) {
      out[out.length - 1] = {
        ...prev,
        text: prev.text + node.text,
        loc: { start: prev.loc?.start ?? 0, end: node.loc?.end ?? 0 },
      };
      continue;
    }
    out.push(node);
  }
  return out;
}

/** Texte simple d'un nœud (\operatorname{arg\,max} → « arg max »). */
export function plainText(node: MathNode): string {
  switch (node.type) {
    case 'symbol':
    case 'text':
      return node.text;
    case 'space':
      return node.width > 0 ? ' ' : '';
    case 'group':
      return node.body.map(plainText).join('');
    default:
      return '';
  }
}

/** Lecture d'une spécification de colonnes : « c|cc », « lr ». */
export function columnSpec(spec: string): { cols: ColumnAlign[]; lines: boolean[] } {
  const cols: ColumnAlign[] = [];
  const lines: boolean[] = [false];
  for (const ch of spec) {
    if (ch === '|') lines[cols.length] = true;
    else if (ch === 'l' || ch === 'c' || ch === 'r') {
      cols.push(ch);
      lines.push(false);
    } else if (ch === 'p' || ch === 'm' || ch === 'b') {
      cols.push('l');
      lines.push(false);
    }
  }
  return { cols, lines };
}

/** Alignement par défaut des colonnes d'un environnement. */
export function defaultColumns(kind: ArrayKind, columns: number): ColumnAlign[] {
  if (kind === 'aligned') return Array.from({ length: columns }, (_, i) => (i % 2 === 0 ? 'r' : 'l'));
  if (kind === 'cases') return ['l', 'l'];
  return Array.from({ length: columns }, () => 'c');
}
