/**
 * Commandes à arguments : \frac, \sqrt, \mathbb, \hat, \color, \begin...
 *
 * Chaque commande reçoit le parseur et son propre jeton, lit ses arguments
 * avec les méthodes publiques du parseur, et renvoie un nœud (ou null si
 * elle ne produit rien, comme \label).
 */
import { atomClass } from '../ast/classes';
import type {
  AccentNode,
  ArrayKind,
  ArrayNode,
  AtomClass,
  ColumnAlign,
  MathNode,
  MathVariant,
  TextFont,
} from '../ast/nodes';
import type { Token } from '../lexer/lexer';
import { negate } from '../symbols/symbols';
import { columnSpec, defaultColumns, mergeLetters, plainText } from './helpers';
import type { Parser } from './parser';
import { parseColor, parseDimension } from './values';
import { safeLink } from './links';

export type CommandHandler = (parser: Parser, token: Token) => MathNode | null;

const FUNCTIONS = new Map<string, CommandHandler>();

export function lookupFunction(name: string): CommandHandler | undefined {
  return FUNCTIONS.get(name);
}

/** Ajout par un plugin (remplace une commande existante du même nom). */
export function addFunction(name: string, handler: CommandHandler): void {
  FUNCTIONS.set(name, handler);
}

function define(names: string[], handler: CommandHandler): void {
  for (const name of names) FUNCTIONS.set(name, handler);
}

// Fractions et racines

define(['\\frac'], (p, t) => ({ type: 'frac', num: p.parseArg(t), den: p.parseArg(t), bar: true }));

define(['\\binom'], (p, t) => ({
  type: 'frac',
  num: p.parseArg(t),
  den: p.parseArg(t),
  bar: false,
  left: '(',
  right: ')',
}));

define(['\\sqrt'], (p, t) => {
  const index = p.parseOptionalArg();
  const body = p.parseArg(t);
  return index ? { type: 'sqrt', body, index } : { type: 'sqrt', body };
});

// Polices

const FONTS: Record<string, MathVariant> = {
  '\\mathrm': 'normal',
  '\\mathup': 'normal',
  '\\mathit': 'italic',
  '\\mathbf': 'bold',
  '\\boldsymbol': 'bold-italic',
  '\\bm': 'bold-italic',
  '\\pmb': 'bold-italic',
  '\\mathbfit': 'bold-italic',
  '\\mathbb': 'double-struck',
  '\\mathds': 'double-struck',
  '\\mathcal': 'script',
  '\\mathscr': 'script',
  '\\mathfrak': 'fraktur',
  '\\mathsf': 'sans-serif',
  '\\mathtt': 'monospace',
};

define(Object.keys(FONTS), (p, t) => {
  const arg = p.withFont(FONTS[t.text] ?? null, () => p.parseArg(t));
  if (arg.type === 'group') return { type: 'group', body: mergeLetters(arg.body) };
  return arg;
});

define(['\\mathnormal'], (p, t) => p.withFont(null, () => p.parseArg(t)));

// Texte

const TEXT_FONTS: Record<string, TextFont> = {
  '\\text': 'normal',
  '\\textrm': 'normal',
  '\\textnormal': 'normal',
  '\\textup': 'normal',
  '\\mbox': 'normal',
  '\\hbox': 'normal',
  '\\textbf': 'bold',
  '\\textit': 'italic',
  '\\emph': 'italic',
  '\\textsf': 'sans-serif',
  '\\texttt': 'monospace',
};

define(Object.keys(TEXT_FONTS), (p, t) => p.parseText(t, TEXT_FONTS[t.text] ?? 'normal'));

// Opérateurs nommés et classes d'atomes

define(['\\operatorname', '\\operatornamewithlimits'], (p, t) => {
  let limits: 'auto' | 'nolimits' = t.text === '\\operatornamewithlimits' ? 'auto' : 'nolimits';
  const star = p.peek();
  if (star.kind === 'char' && star.text === '*') {
    p.next();
    limits = 'auto';
  }
  const arg = p.withFont('normal', () => p.parseArg(t));
  if (arg.type === 'error') return arg;
  return { type: 'op', name: plainText(arg), symbol: false, limits };
});

const CLASSES: Record<string, AtomClass> = {
  '\\mathord': 'ord',
  '\\mathop': 'op',
  '\\mathbin': 'bin',
  '\\mathrel': 'rel',
  '\\mathopen': 'open',
  '\\mathclose': 'close',
  '\\mathpunct': 'punct',
  '\\mathinner': 'inner',
};

define(Object.keys(CLASSES), (p, t) => {
  const arg = p.parseArg(t);
  const cls = CLASSES[t.text] ?? 'ord';
  return { type: 'group', body: arg.type === 'group' ? arg.body : [arg], cls };
});

// Accents

const ACCENTS: Record<string, Omit<AccentNode, 'type' | 'body'>> = {
  '\\hat': { accent: 'hat', stretchy: false, under: false },
  '\\check': { accent: 'check', stretchy: false, under: false },
  '\\tilde': { accent: 'tilde', stretchy: false, under: false },
  '\\acute': { accent: 'acute', stretchy: false, under: false },
  '\\grave': { accent: 'grave', stretchy: false, under: false },
  '\\dot': { accent: 'dot', stretchy: false, under: false },
  '\\ddot': { accent: 'ddot', stretchy: false, under: false },
  '\\breve': { accent: 'breve', stretchy: false, under: false },
  '\\bar': { accent: 'bar', stretchy: false, under: false },
  '\\vec': { accent: 'vec', stretchy: false, under: false },
  '\\mathring': { accent: 'mathring', stretchy: false, under: false },
  '\\widehat': { accent: 'hat', stretchy: true, under: false },
  '\\widetilde': { accent: 'tilde', stretchy: true, under: false },
  '\\widecheck': { accent: 'check', stretchy: true, under: false },
  '\\overarc': { accent: 'arc', stretchy: true, under: false },
  '\\wideparen': { accent: 'arc', stretchy: true, under: false },
  '\\overparen': { accent: 'arc', stretchy: true, under: false },
  '\\overline': { accent: 'overline', stretchy: true, under: false },
  '\\underline': { accent: 'underline', stretchy: true, under: true },
  '\\overrightarrow': { accent: 'rightarrow', stretchy: true, under: false },
  '\\overleftarrow': { accent: 'leftarrow', stretchy: true, under: false },
  '\\overleftrightarrow': { accent: 'leftrightarrow', stretchy: true, under: false },
  '\\underrightarrow': { accent: 'rightarrow', stretchy: true, under: true },
  '\\underleftarrow': { accent: 'leftarrow', stretchy: true, under: true },
  '\\underleftrightarrow': { accent: 'leftrightarrow', stretchy: true, under: true },
  '\\overbrace': { accent: 'overbrace', stretchy: true, under: false },
  '\\underbrace': { accent: 'underbrace', stretchy: true, under: true },
};

define(Object.keys(ACCENTS), (p, t) => {
  const spec = ACCENTS[t.text];
  if (!spec) return null;
  return { type: 'accent', ...spec, body: p.parseArg(t) };
});

// Empilements : \overset, \underset, \stackrel, flèches extensibles

define(['\\overset', '\\stackrel'], (p, t) => {
  const over = p.parseArg(t);
  const base = p.parseArg(t);
  const cls = t.text === '\\stackrel' ? 'rel' : (atomClass(base) ?? 'ord');
  return { type: 'underover', base, over, cls };
});

define(['\\underset'], (p, t) => {
  const under = p.parseArg(t);
  const base = p.parseArg(t);
  return { type: 'underover', base, under, cls: atomClass(base) ?? 'ord' };
});

const X_ARROWS: Record<string, string> = {
  '\\xrightarrow': '→',
  '\\xleftarrow': '←',
  '\\xleftrightarrow': '↔',
  '\\xRightarrow': '⇒',
  '\\xLeftarrow': '⇐',
  '\\xLeftrightarrow': '⇔',
  '\\xmapsto': '↦',
  '\\xhookrightarrow': '↪',
  '\\xhookleftarrow': '↩',
  '\\xrightharpoonup': '⇀',
  '\\xrightleftharpoons': '⇌',
};

define(Object.keys(X_ARROWS), (p, t) => {
  const under = p.parseOptionalArg();
  const over = p.parseArg(t);
  const base: MathNode = { type: 'symbol', role: 'mo', cls: 'rel', text: X_ARROWS[t.text] ?? '→', stretchy: true };
  return under ? { type: 'underover', base, over, under, cls: 'rel' } : { type: 'underover', base, over, cls: 'rel' };
});

// Délimiteurs

define(['\\left'], (p, t) => p.parseLeftRight(t));

const BIG: Record<string, [1 | 2 | 3 | 4, AtomClass]> = {};
for (const [prefix, size] of [
  ['big', 1],
  ['Big', 2],
  ['bigg', 3],
  ['Bigg', 4],
] as const) {
  BIG['\\' + prefix] = [size, 'ord'];
  BIG['\\' + prefix + 'l'] = [size, 'open'];
  BIG['\\' + prefix + 'r'] = [size, 'close'];
  BIG['\\' + prefix + 'm'] = [size, 'rel'];
}

define(Object.keys(BIG), (p, t) => {
  const spec = BIG[t.text];
  if (!spec) return null;
  const delim = p.parseDelimiter();
  if (delim === null) return p.error(`Délimiteur attendu après ${t.text}, par exemple ${t.text}(.`, t.start, t.end);
  return { type: 'delim', delim, size: spec[0], cls: spec[1] };
});

// Espaces

const SPACES: Record<string, number> = {
  '\\,': 3 / 18,
  '\\thinspace': 3 / 18,
  '\\:': 4 / 18,
  '\\>': 4 / 18,
  '\\medspace': 4 / 18,
  '\\;': 5 / 18,
  '\\thickspace': 5 / 18,
  '\\!': -3 / 18,
  '\\negthinspace': -3 / 18,
  '\\negmedspace': -4 / 18,
  '\\negthickspace': -5 / 18,
  '\\enspace': 0.5,
  '\\enskip': 0.5,
  '\\quad': 1,
  '\\qquad': 2,
  '\\ ': 1 / 3,
  '\\space': 1 / 3,
  '\\nobreakspace': 1 / 3,
};

define(Object.keys(SPACES), (_p, t) => ({ type: 'space', width: SPACES[t.text] ?? 0 }));

define(['\\hspace', '\\kern', '\\mkern', '\\hskip', '\\mskip', '\\mspace'], (p, t) => {
  if (t.text === '\\hspace') {
    const star = p.peek();
    if (star.kind === 'char' && star.text === '*') p.next();
  }
  const raw = p.parseDimensionText();
  const em = raw ? parseDimension(raw.text) : null;
  if (em === null) return p.error(`Dimension illisible après ${t.text} (exemple : ${t.text}{1em}).`, t.start, raw?.end ?? t.end);
  const max = p.options.maxSize;
  return { type: 'space', width: Math.max(-max, Math.min(max, em)) };
});

// Couleurs

define(['\\textcolor'], (p, t) => {
  const model = p.parseRawOptional();
  const raw = p.parseRawArg();
  const body = p.parseArg(t);
  const color = raw ? parseColor(raw.text, model ?? undefined) : null;
  if (!color) {
    const err = p.error(`Couleur inconnue : « ${raw?.text ?? ''} ».`, t.start, raw?.end ?? t.end);
    return { type: 'group', body: [err, body] };
  }
  return { type: 'color', color, body: [body] };
});

// Encadrements, barrés, fantômes

const ENCLOSE: Record<string, 'box' | 'cancel' | 'bcancel' | 'xcancel'> = {
  '\\boxed': 'box',
  '\\cancel': 'cancel',
  '\\bcancel': 'bcancel',
  '\\xcancel': 'xcancel',
};

define(Object.keys(ENCLOSE), (p, t) => ({ type: 'enclose', notation: ENCLOSE[t.text] ?? 'box', body: p.parseArg(t) }));

define(['\\fbox'], (p, t) => ({ type: 'enclose', notation: 'box', body: p.parseText(t, 'normal') }));

define(['\\phantom', '\\hphantom', '\\vphantom'], (p, t) => ({ type: 'phantom', body: p.parseArg(t) }));

define(['\\smash'], (p, t) => {
  p.parseRawOptional();
  return p.parseArg(t);
});

// Négation

define(['\\not'], (p, t) => {
  const next = p.parsePrimary(true);
  if (next && next.type === 'symbol') {
    return { ...next, text: negate(next.text), role: 'mo', cls: 'rel' };
  }
  const err = p.error('\\not doit précéder une relation, par exemple \\not=.', t.start, t.end);
  return next ? { type: 'group', body: [err, next] } : err;
});

// Numérotation et références d'équations

define(['\\label'], (p, t) => {
  const raw = p.parseRawArg();
  return raw?.text ? { type: 'label', name: raw.text, loc: { start: t.start, end: raw.end } }
    : p.error('Étiquette manquante pour \\label.', t.start, raw?.end ?? t.end);
});

define(['\\tag'], (p, t) => {
  const next = p.peek();
  const starred = next.kind === 'char' && next.text === '*';
  if (starred) p.next();
  return { type: 'tag', body: p.parseArg(t), starred };
});

define(['\\ref', '\\eqref'], (p, t) => {
  const raw = p.parseRawArg();
  if (!raw) return p.error(`Argument manquant pour ${t.text}.`, t.start, t.end, false);
  return p.reference(raw.text, t.text === '\\eqref', t);
});

// Commandes sans effet visuel

define(['\\nonumber', '\\notag'], () => ({ type: 'notag' }));
define(['\\displaybreak', '\\allowbreak', '\\relax'], () => null);

define(['\\href', '\\url'], (p, t) => {
  const raw = p.parseRawArg();
  const body: MathNode = t.text === '\\href' ? p.parseArg(t)
    : { type: 'text', text: raw?.text.replace(/\\([%#&_])/g, '$1') ?? '', font: 'normal' };
  const href = raw ? safeLink(raw.text) : null;
  if (!p.options.trustLinks || !href) {
    const error = p.error(!p.options.trustLinks
      ? 'Liens désactivés : activer trustLinks pour une source de confiance.'
      : 'Lien refusé : seuls HTTP(S), mailto et les fragments locaux sont autorisés.', t.start, raw?.end ?? t.end, false);
    return { type: 'group', body: [body, error] };
  }
  return { type: 'link', href, body };
});

// Environnements

interface EnvironmentSpec {
  kind: ArrayKind;
  left?: string;
  right?: string;
  /** L'environnement lit une spécification de colonnes : \begin{array}{c|c}. */
  columnSpec?: boolean;
}

const ENVIRONMENTS: Record<string, EnvironmentSpec> = {
  matrix: { kind: 'matrix' },
  pmatrix: { kind: 'matrix', left: '(', right: ')' },
  bmatrix: { kind: 'matrix', left: '[', right: ']' },
  Bmatrix: { kind: 'matrix', left: '{', right: '}' },
  vmatrix: { kind: 'matrix', left: '|', right: '|' },
  Vmatrix: { kind: 'matrix', left: '‖', right: '‖' },
  smallmatrix: { kind: 'small' },
  cases: { kind: 'cases', left: '{', right: '' },
  dcases: { kind: 'cases', left: '{', right: '' },
  rcases: { kind: 'cases', left: '', right: '}' },
  array: { kind: 'array', columnSpec: true },
  subarray: { kind: 'small', columnSpec: true },
  aligned: { kind: 'aligned' },
  align: { kind: 'aligned' },
  'align*': { kind: 'aligned' },
  split: { kind: 'aligned' },
  alignat: { kind: 'aligned' },
  'alignat*': { kind: 'aligned' },
  alignedat: { kind: 'aligned' },
  eqnarray: { kind: 'aligned' },
  'eqnarray*': { kind: 'aligned' },
  gathered: { kind: 'gathered' },
  gather: { kind: 'gathered' },
  'gather*': { kind: 'gathered' },
  equation: { kind: 'gathered' },
  'equation*': { kind: 'gathered' },
  multline: { kind: 'gathered' },
  'multline*': { kind: 'gathered' },
};

/** Ajout par un plugin. */
export function addEnvironment(name: string, spec: EnvironmentSpec): void {
  ENVIRONMENTS[name] = spec;
}

export type { EnvironmentSpec };

define(['\\begin'], (p, t) => {
  const raw = p.parseRawArg();
  const name = raw?.text ?? '';
  const spec = ENVIRONMENTS[name];
  const errors: MathNode[] = [];
  if (!spec) {
    errors.push(p.error(`Environnement inconnu : ${name || '(sans nom)'}.`, t.start, raw?.end ?? t.end));
  }
  const kind = spec?.kind ?? 'matrix';

  let cols: ColumnAlign[] = [];
  let colLines: boolean[] = [];
  if (spec?.columnSpec) {
    const colsRaw = p.parseRawArg();
    const parsed = columnSpec(colsRaw?.text ?? '');
    cols = parsed.cols;
    colLines = parsed.lines;
  }
  if (name === 'alignat' || name === 'alignat*' || name === 'alignedat') p.parseRawArg();

  const { rows, rowLines } = p.parseRows(t, name);
  const columns = rows.reduce((m, r) => Math.max(m, r.length), 0);
  if (cols.length === 0) cols = defaultColumns(kind, columns);
  while (colLines.length < cols.length + 1) colLines.push(false);

  const node: ArrayNode = { type: 'array', kind, rows, cols, colLines, rowLines };
  if (spec?.left !== undefined) node.left = spec.left;
  if (spec?.right !== undefined) node.right = spec.right;
  if (errors.length) return { type: 'group', body: [...errors, node] };
  return node;
});

define(['\\substack'], (p, t) => {
  const open = p.peek();
  if (open.kind !== 'open') return p.error('\\substack attend un argument entre accolades.', t.start, t.end, false);
  p.next();
  const { rows, rowLines } = p.parseRows(open, null);
  return { type: 'array', kind: 'small', rows, cols: ['c'], colLines: [false, false], rowLines };
});
