/**
 * Options de rendu et leurs valeurs par défaut.
 */

export type OutputFormat = 'html' | 'mathml' | 'htmlAndMathml';

export interface RenderOptions {
  /** Formule centrée sur sa propre ligne (false : dans le texte). */
  displayMode?: boolean;
  /**
   * 'htmlAndMathml' (défaut) : rendu HTML visible + MathML caché pour les
   * lecteurs d'écran. 'html' : HTML seul. 'mathml' : MathML natif seul.
   */
  output?: OutputFormat;
  /** Lever une KhwarizmError à la première erreur au lieu de l'isoler (false). */
  throwOnError?: boolean;
  /** Macros supplémentaires : { '\\R': '\\mathbb{R}', '\\vect': '\\vec{#1}' }. */
  macros?: Record<string, string>;
  /** Nombre maximal d'expansions de macros par formule (1000). */
  maxExpand?: number;
  /** Profondeur maximale d'imbrication (128). */
  maxDepth?: number;
  /** Taille maximale d'une espace explicite, en em (20). */
  maxSize?: number;
  /** Possibilités de retour à la ligne après =, +, −, virgule (true). */
  lineBreaks?: boolean;
  /** Petit bouton « copier le LaTeX » au survol (false). */
  copyButton?: boolean;
  /** Classe supplémentaire sur l'élément racine. */
  className?: string;
}

export interface ResolvedOptions {
  displayMode: boolean;
  output: OutputFormat;
  throwOnError: boolean;
  macros: Record<string, string> | undefined;
  maxExpand: number;
  maxDepth: number;
  maxSize: number;
  lineBreaks: boolean;
  copyButton: boolean;
  className: string | undefined;
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function resolveOptions(options: RenderOptions = {}): ResolvedOptions {
  const output = options.output === 'html' || options.output === 'mathml' ? options.output : 'htmlAndMathml';
  return {
    displayMode: options.displayMode === true,
    output,
    throwOnError: options.throwOnError === true,
    macros: options.macros,
    maxExpand: positive(options.maxExpand, 1000),
    maxDepth: positive(options.maxDepth, 128),
    maxSize: typeof options.maxSize === 'number' && options.maxSize >= 0 ? options.maxSize : 20,
    lineBreaks: options.lineBreaks !== false,
    copyButton: options.copyButton === true,
    className: options.className,
  };
}
