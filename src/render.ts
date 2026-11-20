/**
 * Chaîne complète : source → AST → arbre de rendu → chaîne HTML ou DOM.
 * Tout est synchrone : aucun clignotement, utilisable côté serveur.
 */
import type { MathNode } from './ast/nodes';
import { KhwarizmError, type Diagnostic } from './errors';
import { resolveOptions, type RenderOptions } from './options';
import { Parser } from './parser/parser';
import { renderHTML } from './renderers/html';
import { renderMathML } from './renderers/mathml';
import { cls, el, toDOM, toHTML, type VElement, type VNode } from './renderers/vnode';

export interface ParseResult {
  ast: MathNode[];
  errors: Diagnostic[];
}

/** Analyse une formule. Les erreurs sont isolées dans l'arbre et listées. */
export function parse(latex: string, options: RenderOptions = {}): ParseResult {
  const o = resolveOptions(options);
  const source = String(latex);
  const parser = new Parser(source, {
    macros: o.macros,
    maxExpand: o.maxExpand,
    maxDepth: o.maxDepth,
    maxSize: o.maxSize,
  });
  let ast: MathNode[];
  try {
    ast = parser.parse();
  } catch (error) {
    if (!(error instanceof KhwarizmError) || o.throwOnError) throw error;
    // Garde-fou atteint : la formule entière est montrée comme erreur.
    const diagnostic = { message: error.message, start: 0, end: source.length };
    return {
      ast: [{ type: 'error', message: error.message, source, loc: { start: 0, end: source.length } }],
      errors: [diagnostic],
    };
  }
  const first = parser.errors[0];
  if (o.throwOnError && first) throw new KhwarizmError(first.message, first.start, first.end);
  return { ast, errors: parser.errors };
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

/** Arbre de rendu complet (élément racine .khw). */
export function renderToTree(latex: string, options: RenderOptions = {}): VElement {
  const o = resolveOptions(options);
  const source = String(latex);
  const { ast, errors } = parse(source, o);
  const children: VNode[] = [];
  if (o.output !== 'mathml') children.push(renderHTML(ast, { display: o.displayMode, lineBreaks: o.lineBreaks }));
  if (o.output !== 'html') children.push(renderMathML(ast, { display: o.displayMode, source }));
  if (o.copyButton) children.push(copyButton());
  return el(
    'span',
    {
      class: cls(
        'khw',
        o.displayMode && 'khw-display',
        o.output === 'mathml' && 'khw-mathml-only',
        errors.length > 0 && 'khw-has-error',
        o.className,
      ),
      'data-latex': source,
      'data-khw-copy': o.copyButton ? 'true' : undefined,
    },
    children,
  );
}

/** Rendu en chaîne HTML (rendu serveur, génération statique). */
export function renderToString(latex: string, options: RenderOptions = {}): string {
  return toHTML(renderToTree(latex, options));
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
