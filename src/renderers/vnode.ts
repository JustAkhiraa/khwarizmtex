/**
 * Nœuds virtuels : les moteurs de rendu produisent un petit arbre neutre,
 * ensuite sérialisé en chaîne (rendu serveur) ou construit en DOM.
 *
 * Côté navigateur, aucune chaîne HTML n'est jamais réinjectée : le DOM est
 * construit élément par élément (createElement, setAttribute, createTextNode).
 */

export interface VElement {
  tag: string;
  attrs: Record<string, string>;
  children: VNode[];
}

export type VNode = VElement | string;

const SVG_NS = 'http://www.w3.org/2000/svg';
const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';
const VOID = new Set(['br', 'wbr']);

/** Noms d'attributs admis à la sérialisation (garde-fou, ils sont tous écrits par le moteur). */
const SAFE_ATTRIBUTE = /^[a-zA-Z][a-zA-Z0-9:-]*$/;

/** Crée un élément ; les attributs undefined, false ou '' sont omis. */
export function el(
  tag: string,
  attrs: Record<string, string | undefined | false | null> = {},
  children: VNode[] = [],
): VElement {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'string' && value !== '') clean[key] = value;
  }
  return { tag, attrs: clean, children };
}

/** Assemble des noms de classes en ignorant les valeurs vides. */
export function cls(...names: (string | undefined | false | null)[]): string {
  return names.filter((n): n is string => typeof n === 'string' && n !== '').join(' ');
}

/** Ajoute une classe à un élément (sans doublon). */
export function addClass(node: VElement, name: string): void {
  const current = node.attrs['class'];
  if (!current) {
    node.attrs['class'] = name;
    return;
  }
  if (!current.split(' ').includes(name)) node.attrs['class'] = current + ' ' + name;
}

const TEXT_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const ATTR_ESCAPES: Record<string, string> = { ...TEXT_ESCAPES, '"': '&quot;', "'": '&#39;' };

export function escapeText(s: string): string {
  return s.replace(/[&<>]/g, (c) => TEXT_ESCAPES[c] ?? c);
}

export function escapeAttribute(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ATTR_ESCAPES[c] ?? c);
}

/** Sérialise en HTML (texte et attributs échappés). */
export function toHTML(node: VNode): string {
  if (typeof node === 'string') return escapeText(node);
  let out = '<' + node.tag;
  for (const [key, value] of Object.entries(node.attrs)) {
    if (SAFE_ATTRIBUTE.test(key)) out += ' ' + key + '="' + escapeAttribute(value) + '"';
  }
  out += '>';
  if (VOID.has(node.tag)) return out;
  for (const child of node.children) out += toHTML(child);
  return out + '</' + node.tag + '>';
}

/** Construit le DOM réel, dans le bon espace de noms (HTML, SVG, balisage natif). */
export function toDOM(node: VNode, doc: Document, ns: string | null = null): Node {
  if (typeof node === 'string') return doc.createTextNode(node);
  const childNs = node.tag === 'svg' ? SVG_NS : node.tag === 'math' ? MATHML_NS : ns;
  const element = childNs ? doc.createElementNS(childNs, node.tag) : doc.createElement(node.tag);
  for (const [key, value] of Object.entries(node.attrs)) {
    if (key !== 'xmlns' && SAFE_ATTRIBUTE.test(key)) element.setAttribute(key, value);
  }
  for (const child of node.children) element.appendChild(toDOM(child, doc, childNs));
  return element;
}

/** Texte brut d'un arbre (pour les tests et l'accessibilité). */
export function textContent(node: VNode): string {
  if (typeof node === 'string') return node;
  return node.children.map(textContent).join('');
}
