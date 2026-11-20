/**
 * Rendu automatique : parcourt une page et remplace $...$, $$...$$, \(...\)
 * et \[...\] par des formules.
 *
 * Le découpage du texte (findMath) est une fonction pure, testable sans DOM.
 */
import type { RenderOptions } from '../options';
import { renderToNode } from '../render';
import { enableCopy } from './copy';
import { watchOverflow } from './overflow';

export interface Delimiter {
  left: string;
  right: string;
  display: boolean;
}

export const DEFAULT_DELIMITERS: Delimiter[] = [
  { left: '$$', right: '$$', display: true },
  { left: '\\[', right: '\\]', display: true },
  { left: '\\(', right: '\\)', display: false },
  { left: '$', right: '$', display: false },
];

export type Segment =
  | { type: 'text'; text: string }
  | { type: 'math'; latex: string; display: boolean; raw: string };

function isSpace(ch: string | undefined): boolean {
  return ch === undefined || ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r';
}

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9';
}

/**
 * « $ » simple : il faut un caractère non blanc juste après l'ouvrant, juste
 * avant le fermant, et pas de chiffre juste après le fermant. Ainsi
 * « entre 5 $ et 10 $ » reste du texte.
 */
function findClose(text: string, from: number, d: Delimiter): number {
  let depth = 0;
  // Premier fermant valable, quelle que soit la profondeur d'accolades : sert
  // de repli quand la formule elle-même a une accolade jamais fermée.
  let fallback = -1;
  for (let j = from; j < text.length; ) {
    if (text.startsWith(d.right, j)) {
      const valid = !(d.right === '$' && (isSpace(text[j - 1]) || isDigit(text[j + 1]) || j === from));
      if (valid && depth === 0) return j;
      if (valid && fallback < 0) fallback = j;
      if (!valid) {
        j++;
        continue;
      }
    }
    const c = text[j];
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth = Math.max(0, depth - 1);
    j++;
  }
  return fallback;
}

/** Découpe un texte en morceaux de texte et de formules. */
export function findMath(text: string, delimiters: Delimiter[] = DEFAULT_DELIMITERS): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  let textStart = 0;
  while (i < text.length) {
    if (text[i] === '\\' && text[i + 1] === '$') {
      i += 2;
      continue;
    }
    const d = delimiters.find((x) => text.startsWith(x.left, i));
    if (!d) {
      i++;
      continue;
    }
    const start = i + d.left.length;
    if (d.left === '$' && isSpace(text[start])) {
      i++;
      continue;
    }
    const end = findClose(text, start, d);
    if (end < 0) {
      i += d.left.length;
      continue;
    }
    if (i > textStart) out.push({ type: 'text', text: text.slice(textStart, i) });
    out.push({ type: 'math', latex: text.slice(start, end), display: d.display, raw: text.slice(i, end + d.right.length) });
    i = end + d.right.length;
    textStart = i;
  }
  if (textStart < text.length) out.push({ type: 'text', text: text.slice(textStart) });
  return out;
}

export interface AutoRenderOptions extends RenderOptions {
  delimiters?: Delimiter[];
  /** Balises dont le texte n'est jamais touché. */
  ignoredTags?: string[];
  /** Classes dont le texte n'est jamais touché. */
  ignoredClasses?: string[];
}

const IGNORED_TAGS = ['SCRIPT', 'NOSCRIPT', 'STYLE', 'TEXTAREA', 'PRE', 'CODE', 'OPTION', 'SVG', 'MATH', 'KHWARIZM-MATH'];
const IGNORED_CLASSES = ['khw', 'khw-ignore', 'no-math'];

/** Rend toutes les formules sous `root`. Renvoie le nombre de formules rendues. */
export function autoRender(root: Element, options: AutoRenderOptions = {}): number {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  if (!view) return 0;
  const delimiters = options.delimiters ?? DEFAULT_DELIMITERS;
  const tags = new Set((options.ignoredTags ?? IGNORED_TAGS).map((t) => t.toUpperCase()));
  const classes = options.ignoredClasses ?? IGNORED_CLASSES;

  const ignored = (node: Node): boolean => {
    for (let p = node.parentElement; p; p = p.parentElement) {
      if (tags.has(p.tagName.toUpperCase())) return true;
      if (classes.some((c) => p.classList.contains(c))) return true;
      if (p.isContentEditable) return true;
      if (p === root) break;
    }
    return false;
  };

  const walker = doc.createTreeWalker(root, view.NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n instanceof view.Text && !ignored(n)) textNodes.push(n);
  }

  let count = 0;
  for (const node of textNodes) {
    const segments = findMath(node.data, delimiters);
    if (!segments.some((s) => s.type === 'math')) continue;
    const fragment = doc.createDocumentFragment();
    for (const s of segments) {
      if (s.type === 'text') {
        fragment.appendChild(doc.createTextNode(s.text));
        continue;
      }
      const math = renderToNode(s.latex, doc, { ...options, displayMode: s.display });
      fragment.appendChild(math);
      if (s.display && math instanceof view.Element) watchOverflow(math);
      count++;
    }
    node.replaceWith(fragment);
  }
  enableCopy(doc);
  return count;
}
