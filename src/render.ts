/**
 * Chaîne complète : source → AST → arbre de rendu → chaîne HTML ou DOM.
 * Tout est synchrone : aucun clignotement, utilisable côté serveur.
 */
import { childrenOf, type MathNode, type TagNode } from './ast/nodes';
import { KhwarizmError, KhwarizmLimitError, type Diagnostic } from './errors';
import { equationId } from './references';
import { resolveOptions, type RenderOptions } from './options';
import { Parser } from './parser/parser';
import { renderHTML } from './renderers/html';
import { renderMathML } from './renderers/mathml';
import { accessibleLinks, hideInteractiveLinks } from './renderers/accessible-links';
import { cls, el, toDOM, toHTML, type VElement, type VNode } from './renderers/vnode';

export interface ParseResult {
  ast: MathNode[];
  errors: Diagnostic[];
}

/** Résultat de `renderAll` : une chaîne par formule, dans le même ordre. */
export interface RenderAllResult {
  html: string[];
  /** Index immuable des étiquettes détectées, utilisable dans un rendu ultérieur. */
  references: Readonly<Record<string, string>>;
  /** Diagnostics par formule, dans le même ordre que html. */
  errors: Diagnostic[][];
}

/** Analyse une formule. Les erreurs sont isolées dans l'arbre et listées. */
export function parse(latex: string, options: RenderOptions = {}): ParseResult {
  const o = resolveOptions(options);
  const source = String(latex);
  try {
    if (source.length > o.maxLength) {
      throw new KhwarizmLimitError(`Formule trop longue (plus de ${o.maxLength} caractères).`, 0, source.length);
    }
    const parser = new Parser(source, {
      macros: o.macros,
      references: o.references,
      trustLinks: o.trustLinks,
      maxExpand: o.maxExpand,
      maxDepth: o.maxDepth,
      maxSize: o.maxSize,
    });
    const ast = parser.parse();
    let tagCount = 0;
    // Les exposants répétés peuvent produire un arbre profond sans accolades.
    const pending = ast.map((node) => ({ node, depth: 1 }));
    while (pending.length) {
      const current = pending.pop();
      if (!current) break;
      if (current.depth > o.maxDepth) throw new KhwarizmLimitError('Arbre mathématique trop profond.');
      if (current.node.type === 'tag') tagCount++;
      for (const node of childrenOf(current.node)) pending.push({ node, depth: current.depth + 1 });
    }
    if (tagCount > 1) parser.errors.push({ message: 'Un seul \\tag par formule est pris en charge ; séparer les équations dans renderAll().', start: 0, end: source.length });
    const first = parser.errors[0];
    if (o.throwOnError && first) throw new KhwarizmError(first.message, first.start, first.end);
    return { ast, errors: parser.errors };
  } catch (error) {
    if (!(error instanceof KhwarizmError) || o.throwOnError) throw error;
    // Garde-fou atteint : la formule entière est montrée comme erreur.
    const diagnostic = { message: error.message, start: 0, end: source.length };
    return {
      ast: [{ type: 'error', message: error.message, source, loc: { start: 0, end: source.length } }],
      errors: [diagnostic],
    };
  }
}

interface EquationMetadata {
  labels: string[];
  tag: TagNode | undefined;
  suppress: boolean;
}

/** Les balises peuvent vivre au fond d'un environnement `equation` ou `aligned`. */
function equationMetadata(nodes: MathNode[]): EquationMetadata {
  const labels: string[] = [];
  let tag: TagNode | undefined;
  let suppress = false;
  const visit = (node: MathNode): void => {
    if (node.type === 'label' && node.name) labels.push(node.name);
    if (node.type === 'tag') tag = node;
    if (node.type === 'notag') suppress = true;
    for (const child of childrenOf(node)) visit(child);
  };
  for (const node of nodes) visit(node);
  return { labels, tag, suppress };
}

function tagText(node: MathNode): string {
  switch (node.type) {
    case 'symbol':
    case 'text':
    case 'ref':
      return node.text;
    case 'op':
      return node.name;
    case 'space':
    case 'label':
    case 'newline':
      return '';
    case 'error':
      return node.source;
    case 'tag':
      return tagText(node.body);
    default:
      return childrenOf(node).map(tagText).join('');
  }
}

function automaticTag(value: string): TagNode {
  return {
    type: 'tag',
    body: { type: 'text', text: value, font: 'normal' },
    starred: false,
  };
}

function copyButton(): VElement {
  return el(
    'button',
    { type: 'button', class: 'khw-copy', 'aria-label': 'Copier la formule LaTeX', title: 'Copier la formule LaTeX' },
    [
      el('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' }, [
        el('g', { class: 'khw-copy-icon' }, [
          el('rect', { x: '5.5', y: '5.5', width: '8', height: '8', rx: '1.8' }),
          el('path', { d: 'M10.5 5.5V3.8a1.3 1.3 0 0 0-1.3-1.3H3.8a1.3 1.3 0 0 0-1.3 1.3v5.4a1.3 1.3 0 0 0 1.3 1.3h1.7' }),
        ]),
        el('path', { class: 'khw-copy-done', d: 'M3.5 8.5l3 3 6-7' }),
      ]),
    ],
  );
}

function renderTree(source: string, o: ReturnType<typeof resolveOptions>, parsed: ParseResult, addedTag?: TagNode, labels?: string[]): VElement {
  const { ast, errors } = parsed;
  const metadata = equationMetadata(ast);
  const tag = metadata.tag ?? addedTag;
  // Le tag synthétique doit aussi faire partie du MathML, même s'il n'occupe
  // pas d'espace dans la couche HTML (où il est placé à droite par le conteneur).
  const mathAst = addedTag ? [...ast, addedTag] : ast;
  const children: VNode[] = [];
  if (o.output !== 'mathml') {
    const html = renderHTML(mathAst, { display: o.displayMode, lineBreaks: o.lineBreaks });
    if (o.output === 'html') delete html.attrs['aria-hidden'];
    else hideInteractiveLinks(html);
    children.push(html);
  }
  if (o.output !== 'html') {
    const mathml = renderMathML(mathAst, { display: o.displayMode, source });
    // Le clipping directement sur <math> est ignoré par certains moteurs.
    children.push(o.output === 'mathml' ? mathml : el('span', { class: 'khw-mathml-layer' }, [mathml]));
  }
  if (tag && o.output !== 'mathml') {
    const rendered = renderHTML([tag.body], { display: false, lineBreaks: false });
    if (o.output !== 'html') hideInteractiveLinks(rendered);
    const tagChildren: VNode[] = tag.starred ? rendered.children : ['(', ...rendered.children, ')'];
    children.push(el('span', { class: 'khw-tag', 'aria-hidden': o.output === 'html' ? undefined : 'true' }, tagChildren));
  }
  if (o.copyButton) children.push(copyButton());
  if (o.output !== 'html') children.push(...accessibleLinks(mathAst));
  const anchors = [...new Set(labels ?? metadata.labels)];
  const label = anchors[0];
  for (const alias of anchors.slice(1)) children.push(el('span', { id: equationId(alias), class: 'khw-anchor', 'aria-hidden': 'true' }));
  return el(
    'span',
    {
      class: cls(
        'khw',
        o.displayMode && 'khw-display',
        tag && o.output !== 'mathml' && 'khw-has-tag',
        o.output === 'mathml' && 'khw-mathml-only',
        errors.length > 0 && 'khw-has-error',
        o.className,
      ),
      'data-latex': source,
      'data-khw-copy': o.copyButton ? 'true' : undefined,
      id: label ? equationId(label) : undefined,
    },
    children,
  );
}

/** Arbre de rendu complet (élément racine .khw). */
export function renderToTree(latex: string, options: RenderOptions = {}): VElement {
  const o = resolveOptions(options);
  const source = String(latex);
  return renderTree(source, o, parse(source, o));
}

/** Rendu en chaîne HTML (rendu serveur, génération statique). */
export function renderToString(latex: string, options: RenderOptions = {}): string {
  return toHTML(renderToTree(latex, options));
}

/**
 * Rend plusieurs formules avec un index de références partagé.
 * Les étiquettes sont relevées avant le rendu : une référence peut donc viser
 * une équation déclarée plus loin dans le tableau. Les formules identiques
 * sont sérialisées une seule fois.
 */
function renderBatch<T>(latex: readonly string[], options: RenderOptions, serialize: (tree: VElement) => T): { results: T[]; references: Readonly<Record<string, string>>; errors: Diagnostic[][] } {
  const o = resolveOptions(options);
  const sources = latex.map(String);
  // Première passe de collecte : une référence peut précéder son label, donc
  // ses diagnostics provisoires ne doivent pas déclencher throwOnError.
  const parseCache = new Map<string, ParseResult>();
  const parsed = sources.map((source) => {
    let result = parseCache.get(source);
    if (!result) { result = parse(source, { ...o, throwOnError: false }); parseCache.set(source, result); }
    return result;
  });
  const references: Record<string, string> = Object.create(null);
  for (const [label, value] of Object.entries(o.references ?? {})) references[label] = String(value);
  const autoTags: (TagNode | undefined)[] = [];
  const labels: string[][] = [];
  const errors: Diagnostic[][] = sources.map(() => []);
  let nextNumber = 1;

  parsed.forEach((result, index) => {
    const metadata = equationMetadata(result.ast);
    const explicit = metadata.tag ? tagText(metadata.tag.body) : undefined;
    const value = explicit ?? (!metadata.suppress && metadata.labels.length ? String(nextNumber++) : undefined);
    autoTags[index] = metadata.tag ? undefined : value ? automaticTag(value) : undefined;
    const accepted: string[] = [];
    if (value !== undefined) for (const label of metadata.labels) {
      if (Object.prototype.hasOwnProperty.call(references, label)) {
        errors[index]?.push({ message: `Étiquette déjà définie : ${label}.`, start: 0, end: sources[index]?.length ?? 0 });
      } else {
        references[label] = value;
        accepted.push(label);
      }
    }
    labels[index] = accepted;
  });

  const cache = new Map<string, T>();
  const resolvedCache = new Map<string, ParseResult>();
  const results = sources.map((source, index) => {
    const tag = autoTags[index];
    const key = JSON.stringify([source, tag ? tagText(tag.body) : null, labels[index]]);
    const cached = cache.get(key);
    let result = resolvedCache.get(source);
    if (!result) { result = parse(source, { ...o, references }); resolvedCache.set(source, result); }
    const diagnostics = errors[index] ?? [];
    diagnostics.push(...result.errors);
    if (o.throwOnError && diagnostics[0]) throw new KhwarizmError(diagnostics[0].message, diagnostics[0].start, diagnostics[0].end);
    if (cached !== undefined && diagnostics.length === 0) return cached;
    const value = serialize(renderTree(source, { ...o, references }, { ast: result.ast, errors: diagnostics }, tag, labels[index]));
    cache.set(key, value);
    return value;
  });
  return { results, references: Object.freeze({ ...references }), errors };
}

export function renderAll(latex: readonly string[], options: RenderOptions = {}): RenderAllResult {
  const { results: html, references, errors } = renderBatch(latex, options, toHTML);
  return { html, references, errors };
}

/** Rendu groupé DOM pour les documents dynamiques, sans interprétation de HTML.
 * Chaque nœud est indépendant, même pour des formules identiques mises en cache.
 * Rappeler cette fonction après insertion/suppression recalcule les références.
 */
export function renderAllToNodes(latex: readonly string[], doc: Document, options: RenderOptions = {}): { nodes: Node[]; references: Readonly<Record<string, string>>; errors: Diagnostic[][] } {
  const { results, references, errors } = renderBatch(latex, options, (tree) => tree);
  return { nodes: results.map((tree) => toDOM(tree, doc)), references, errors };
}

/**
 * Rendu dans un élément du DOM, construit nœud par nœud (aucun innerHTML).
 * Le contenu précédent de l'élément est remplacé.
 */
export function renderToElement(latex: string, element: Element, options: RenderOptions = {}): void {
  const doc = element.ownerDocument;
  const node = toDOM(renderToTree(latex, options), doc);
  element.replaceChildren(node);
}

/** Construit l'élément .khw sans l'insérer nulle part. */
export function renderToNode(latex: string, doc: Document, options: RenderOptions = {}): Node {
  return toDOM(renderToTree(latex, options), doc);
}
