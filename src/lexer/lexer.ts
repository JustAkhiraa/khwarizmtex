/**
 * Analyse lexicale : la source devient une suite de jetons.
 *
 * Lecture caractère par caractère, sans expression régulière : le temps est
 * linéaire quelle que soit l'entrée. Les caractères hors du plan de base
 * Unicode (𝑥, 𝔸...) restent un seul jeton.
 */

export type TokenKind =
  /** \frac, \alpha, ou symbole de contrôle (\{, \,, \\) */
  | 'command'
  /** tout autre caractère : lettre, chiffre, ponctuation */
  | 'char'
  | 'open' // {
  | 'close' // }
  | 'sup' // ^
  | 'sub' // _
  | 'align' // &
  /** #1 à #9 dans le corps d'une macro (ou # seul, fautif) */
  | 'param'
  /** une suite d'espaces, de tabulations ou de retours à la ligne */
  | 'space'
  /** erreur signalée par l'expanseur de macros, rendue sur place */
  | 'error'
  | 'eof';

export interface Token {
  kind: TokenKind;
  text: string;
  /** Position dans la source (indices de caractères, fin exclue). */
  start: number;
  end: number;
}

const BACKSLASH = 92;
const PERCENT = 37;
const NEWLINE = 10;

function isAsciiLetter(c: number): boolean {
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
}

function isSpace(c: number): boolean {
  return c === 32 || c === 9 || c === 10 || c === 13 || c === 12;
}

/** Longueur (1 ou 2 unités UTF-16) du caractère qui commence en i. */
function charLength(input: string, i: number): number {
  const cp = input.codePointAt(i);
  return cp !== undefined && cp > 0xffff ? 2 : 1;
}

const SINGLE: Partial<Record<string, TokenKind>> = {
  '{': 'open',
  '}': 'close',
  '^': 'sup',
  _: 'sub',
  '&': 'align',
};

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const n = input.length;
  let i = 0;

  while (i < n) {
    const c = input.charCodeAt(i);

    if (isSpace(c)) {
      let j = i + 1;
      while (j < n && isSpace(input.charCodeAt(j))) j++;
      tokens.push({ kind: 'space', text: ' ', start: i, end: j });
      i = j;
      continue;
    }

    if (c === PERCENT) {
      // Commentaire : jusqu'à la fin de la ligne, retour à la ligne compris,
      // puis les espaces du début de la ligne suivante (comme TeX).
      while (i < n && input.charCodeAt(i) !== NEWLINE) i++;
      i++;
      while (i < n && isSpace(input.charCodeAt(i))) i++;
      continue;
    }

    if (c === BACKSLASH) {
      if (i + 1 >= n) {
        tokens.push({ kind: 'command', text: '\\', start: i, end: n });
        i = n;
        continue;
      }
      const d = input.charCodeAt(i + 1);
      if (isAsciiLetter(d)) {
        // Mot de contrôle : \ suivi de lettres ; les espaces qui suivent sont absorbés.
        let j = i + 2;
        while (j < n && isAsciiLetter(input.charCodeAt(j))) j++;
        tokens.push({ kind: 'command', text: input.slice(i, j), start: i, end: j });
        while (j < n && isSpace(input.charCodeAt(j))) j++;
        i = j;
        continue;
      }
      // Symbole de contrôle : \ suivi d'un seul caractère (\{, \,, \\, \ ).
      const len = charLength(input, i + 1);
      const sym = input.slice(i + 1, i + 1 + len);
      tokens.push({
        kind: 'command',
        text: '\\' + (isSpace(d) ? ' ' : sym),
        start: i,
        end: i + 1 + len,
      });
      i += 1 + len;
      continue;
    }

    const ch = input[i] ?? '';
    const single = SINGLE[ch];
    if (single !== undefined) {
      tokens.push({ kind: single, text: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    if (ch === '#') {
      const d = input.charCodeAt(i + 1);
      if (d >= 49 && d <= 57) {
        tokens.push({ kind: 'param', text: input.slice(i, i + 2), start: i, end: i + 2 });
        i += 2;
      } else {
        tokens.push({ kind: 'param', text: '#', start: i, end: i + 1 });
        i++;
      }
      continue;
    }

    const len = charLength(input, i);
    tokens.push({ kind: 'char', text: input.slice(i, i + len), start: i, end: i + len });
    i += len;
  }

  tokens.push({ kind: 'eof', text: '', start: n, end: n });
  return tokens;
}
