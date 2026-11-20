/**
 * Erreurs du moteur.
 *
 * Par défaut, une erreur ne lève rien : elle devient un nœud « error » rendu
 * discrètement à sa place. `KhwarizmError` n'est levée qu'avec `throwOnError`.
 */

export interface Diagnostic {
  message: string;
  /** Position dans la source (indices de caractères, fin exclue). */
  start: number;
  end: number;
}

export class KhwarizmError extends Error {
  readonly start: number;
  readonly end: number;

  constructor(message: string, start = -1, end = -1) {
    super(message);
    this.name = 'KhwarizmError';
    this.start = start;
    this.end = end;
  }
}

/**
 * Garde-fou dépassé (maxExpand, maxDepth) : l'analyse s'arrête net,
 * car continuer pourrait ne jamais finir.
 */
export class KhwarizmLimitError extends KhwarizmError {
  constructor(message: string, start = -1, end = -1) {
    super(message, start, end);
    this.name = 'KhwarizmLimitError';
  }
}
