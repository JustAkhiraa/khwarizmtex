/**
 * KhwarizmTeX : rendu de formules LaTeX en HTML/CSS et en MathML Core.
 *
 *   import { renderToString } from 'khwarizmtex';
 *   const html = renderToString('\\frac{a}{b}', { displayMode: true });
 *
 * Sans dépendance, synchrone, utilisable côté serveur comme dans le navigateur.
 */
export const version = '0.1.0';

export { parse, renderToElement, renderToNode, renderToString, renderToTree, type ParseResult } from './render';
export type { OutputFormat, RenderOptions } from './options';
export { KhwarizmError, KhwarizmLimitError, type Diagnostic } from './errors';

export { registerPlugin, registeredPlugins, type KhwarizmPlugin, type PluginSymbol } from './plugins/registry';
export {
  autoRender,
  findMath,
  DEFAULT_DELIMITERS,
  type AutoRenderOptions,
  type Delimiter,
  type Segment,
} from './plugins/auto-render';
export { defineElement, ELEMENT_NAME } from './plugins/element';
export { enableCopy } from './plugins/copy';
export { injectStyles } from './plugins/styles';

// Pour les auteurs de plugins : l'arbre syntaxique et le parseur.
export type * from './ast/nodes';
export { walk, childrenOf } from './ast/nodes';
export type { Parser } from './parser/parser';
export type { CommandHandler, EnvironmentSpec } from './parser/functions';
export type { Token, TokenKind } from './lexer/lexer';
export { tokenize } from './lexer/lexer';
export { toHTML, toDOM, type VElement, type VNode } from './renderers/vnode';
