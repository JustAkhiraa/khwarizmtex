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
  EncloseNode,
  MathNode,
  MathVariant,
  TextFont,
} from '../ast/nodes';
import type { Token } from '../lexer/lexer';
import { lookupDelimiter, negate } from '../symbols/symbols';
import { columnSpec, defaultColumns, mergeLetters, plainText, rowWidth } from './helpers';
import type { Parser } from './parser';
import { parseColor, parseDimension } from './values';
import { chemistry, scientificNumber, unitSource } from './science';
import { parseMolecule } from './molecule';
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
  if (arg.type === 'group') return { type: 'group', body: mergeLetters(arg.body), fontMark: true };
  return arg.type === 'symbol' ? { ...arg, fontMark: true } : arg;
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
  '\\underparen': { accent: 'uarc', stretchy: true, under: true },
  '\\overgroup': { accent: 'arc', stretchy: true, under: false },
  '\\undergroup': { accent: 'uarc', stretchy: true, under: true },
  '\\overbracket': { accent: 'bracket', stretchy: true, under: false },
  '\\underbracket': { accent: 'ubracket', stretchy: true, under: true },
  '\\utilde': { accent: 'tilde', stretchy: true, under: true },
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

// Fractions générales

define(['\\cfrac'], (p, t) => {
  const align = p.parseRawOptional();
  const frac: MathNode = { type: 'frac', num: p.parseArg(t), den: p.parseArg(t), bar: true };
  if (align === 'l' || align === 'r') frac.align = align;
  return { type: 'style', style: 'display', body: [frac] };
});

define(['\\genfrac'], (p, t) => {
  const left = p.parseRawArg()?.text ?? '';
  const right = p.parseRawArg()?.text ?? '';
  const rule = p.parseRawArg()?.text ?? '';
  const style = p.parseRawArg()?.text ?? '';
  const frac: MathNode = { type: 'frac', num: p.parseArg(t), den: p.parseArg(t), bar: rule === '' || parseDimension(rule) !== 0 };
  const thickness = rule === '' ? null : parseDimension(rule);
  if (rule !== '' && thickness === null) return p.error('Épaisseur illisible dans \\genfrac (exemple : 1pt).', t.start, t.end);
  if (thickness !== null && thickness > 0) frac.rule = Math.min(thickness, 0.5);
  const l = left === '' ? '' : lookupDelimiter(left);
  const r = right === '' ? '' : lookupDelimiter(right);
  if (l === undefined || r === undefined) return p.error('Délimiteur inconnu dans \\genfrac.', t.start, t.end);
  if (l || r) {
    frac.left = l;
    frac.right = r;
  }
  const named = (['display', 'text', 'script', 'scriptscript'] as const)[Number(style)];
  return style !== '' && named ? { type: 'style', style: named, body: [frac] } : frac;
});

define(['\\root'], (p, t) => {
  const index = p.parseList((x) => x.kind === 'command' && x.text === '\\of');
  const of = p.peek();
  if (of.kind !== 'command' || of.text !== '\\of') return p.error('\\root attend \\of, par exemple \\root 3 \\of x.', t.start, t.end);
  p.next();
  return { type: 'sqrt', index: { type: 'group', body: index }, body: p.parseArg(t) };
});

// Barrés, fonds, décalages

define(['\\sout'], (p, t) => ({ type: 'enclose', notation: 'strike', body: p.parseArg(t) }));
define(['\\longdiv'], (p, t) => ({ type: 'enclose', notation: 'longdiv', body: p.parseArg(t) }));
define(['\\mathclap', '\\mathllap', '\\mathrlap', '\\clap', '\\llap', '\\rlap'], (p, t) => {
  const side = t.text.replace('\\math', '').replace('\\', '');
  return { type: 'enclose', notation: side === 'llap' ? 'llap' : side === 'rlap' ? 'rlap' : 'clap', body: p.parseArg(t) };
});

/** \cancelto{valeur}{x} : x barré, valeur en exposant. */
define(['\\cancelto'], (p, t) => {
  const value = p.parseArg(t);
  return { type: 'scripts', base: { type: 'enclose', notation: 'cancelto', body: p.parseArg(t) }, sup: value };
});

const ENCLOSE_NAMES: Record<string, EncloseNode['notation']> = {
  box: 'box',
  longdiv: 'longdiv',
  horizontalstrike: 'strike',
  updiagonalstrike: 'cancel',
  downdiagonalstrike: 'bcancel',
};
define(['\\enclose'], (p, t) => {
  const raw = p.parseRawArg();
  const notation = raw && Object.prototype.hasOwnProperty.call(ENCLOSE_NAMES, raw.text) ? ENCLOSE_NAMES[raw.text] : undefined;
  if (!notation) return p.error(`Notation inconnue pour \\enclose : « ${raw?.text ?? ''} ».`, t.start, raw?.end ?? t.end);
  return { type: 'enclose', notation, body: p.parseArg(t) };
});

define(['\\colorbox', '\\fcolorbox'], (p, t) => {
  const model = p.parseRawOptional() ?? undefined;
  const border = t.text === '\\fcolorbox' ? parseColor(p.parseRawArg()?.text ?? '', model) : null;
  const raw = p.parseRawArg();
  const color = parseColor(raw?.text ?? '', model);
  const body = p.parseText(t, 'normal');
  if (!color || (t.text === '\\fcolorbox' && !border)) {
    return { type: 'group', body: [p.error('Couleur inconnue.', t.start, raw?.end ?? t.end), body] };
  }
  const node: EncloseNode = { type: 'enclose', notation: 'fill', color, body };
  if (border) node.border = border;
  return node;
});

/** Dimension entre accolades, bornée par maxSize ; null si illisible. */
function dimension(p: Parser): number | null {
  const raw = p.parseDimensionText();
  const value = raw ? parseDimension(raw.text) : null;
  const max = p.options.maxSize;
  return value === null ? null : Math.max(-max, Math.min(max, value));
}

define(['\\rule'], (p, t) => {
  const rise = p.parseRawOptional();
  const width = dimension(p);
  const height = dimension(p);
  const shift = rise === null ? 0 : parseDimension(rise);
  if (width === null || height === null || shift === null) return p.error('Dimension illisible (exemple : \\rule{2em}{0.1em}).', t.start, t.end);
  const max = p.options.maxSize;
  return {
    type: 'enclose', notation: 'rule', body: { type: 'group', body: [] },
    width: Math.max(0, width), height: Math.max(0, height), shift: Math.max(-max, Math.min(max, shift)),
  };
});

define(['\\raisebox'], (p, t) => {
  const shift = dimension(p);
  if (shift === null) return p.error('Dimension illisible (exemple : \\raisebox{0.5em}{x}).', t.start, t.end);
  return { type: 'enclose', notation: 'raise', shift, body: p.parseText(t, 'normal') };
});

/** \sideset{_a^b}{_c^d}\sum : indices des deux côtés d'un grand opérateur. */
define(['\\sideset'], (p, t) => {
  const left = p.parseArg(t);
  const right = p.parseArg(t);
  const op = p.parseArg(t);
  if (op.type === 'op') return { ...op, sides: { left, right } };
  return { type: 'group', body: [left, op, right], cls: 'op' };
});

define(['\\varlimsup', '\\varliminf'], (_p, t) => ({
  type: 'op', name: 'lim', symbol: false, limits: 'auto', mark: t.text === '\\varlimsup' ? 'over' : 'under',
}));

/** \multicolumn{2}{c}{…} : cellule couvrant plusieurs colonnes d'un tableau. */
define(['\\multicolumn'], (p, t) => {
  const raw = p.parseRawArg();
  const columns = Number(raw?.text);
  const spec = columnSpec(p.parseRawArg()?.text ?? '');
  const body = p.parseArg(t);
  if (!Number.isInteger(columns) || columns < 1 || columns > 50 || spec.cols.length !== 1) {
    return p.error('\\multicolumn attend un nombre de colonnes (1 à 50) et un alignement, par exemple \\multicolumn{2}{c}{x}.', t.start, raw?.end ?? t.end);
  }
  return {
    type: 'group', body: [body],
    span: { columns, align: spec.cols[0] ?? 'c', left: spec.lines[0] === true, right: spec.lines[1] === true },
  };
});

// Chimie et unités

define(['\\molecule'], (p, t) => {
  const raw = p.parseRawArg();
  const molecule = parseMolecule(raw?.text ?? '');
  return typeof molecule === 'string' ? p.error(`\\molecule : ${molecule}.`, t.start, raw?.end ?? t.end) : molecule;
});

define(['\\ce'], (p, t) => {
  const raw = p.parseRawArg();
  const source = raw ? chemistry(raw.text) : null;
  if (source === null) return p.error('Formule chimique non comprise par \\ce.', t.start, raw?.end ?? t.end);
  return p.parseSource(source, t);
});

define(['\\num', '\\si', '\\unit', '\\SI', '\\qty', '\\ang'], (p, t) => {
  const first = p.parseRawArg();
  const withNumber = t.text !== '\\si' && t.text !== '\\unit';
  const value = withNumber ? scientificNumber(first?.text ?? '') : '';
  if (value === null) return p.error(`Nombre illisible après ${t.text}.`, t.start, first?.end ?? t.end);
  if (t.text === '\\num') return p.parseSource(value, t);
  if (t.text === '\\ang') return p.parseSource(value + '^{\\circ}', t);
  const second = withNumber ? p.parseRawArg() : first;
  const unit = unitSource(second?.text ?? '');
  if (unit === null) return p.error(`Unité illisible après ${t.text}.`, t.start, second?.end ?? t.end);
  return p.parseSource(withNumber ? value + '\\,' + unit : unit, t);
});

// Diagrammes commutatifs

/** \begin{CD} A @>f>> B \\ @VVgV @VVhV \\ C @>>k> D \end{CD} */
function parseDiagram(p: Parser, t: Token): MathNode {
  const isChar = (x: Token, text: string): boolean => x.kind === 'char' && x.text === text;
  const isCmd = (x: Token, text: string): boolean => x.kind === 'command' && x.text === text;
  const halt = (x: Token): boolean => isCmd(x, '\\\\') || isCmd(x, '\\end') || isChar(x, '@');
  const rows: MathNode[][][] = [[[]]];
  const symbol = (text: string): MathNode => ({ type: 'symbol', role: 'mo', cls: 'ord', text });
  const small = (body: MathNode[]): MathNode => ({ type: 'style', style: 'script', body });
  let vertical = 0;
  p.enter(t);
  for (;;) {
    const row = rows[rows.length - 1] as MathNode[][];
    const cell = p.parseList(halt);
    if (cell.length) row[row.length - 1]?.push(...cell);
    const x = p.next();
    if (isCmd(x, '\\\\')) {
      rows.push([[]]);
      vertical = 0;
    } else if (isChar(x, '@')) {
      const kind = p.next();
      const c = kind.kind === 'char' ? kind.text : '';
      const labels: MathNode[][] = [];
      if ('><VA'.includes(c) && c !== '') {
        for (let i = 0; i < 2; i++) {
          labels.push(p.parseList((y) => isChar(y, c) || isCmd(y, '\\\\') || isCmd(y, '\\end')));
          if (!isChar(p.peek(), c)) {
            p.leave();
            return p.error('Flèche incomplète dans le diagramme CD.', kind.start, kind.end);
          }
          p.next();
        }
      }
      if (c === '>' || c === '<' || c === '=') {
        const arrow: MathNode =
          c === '='
            ? symbol('=')
            : {
                type: 'underover',
                cls: 'rel',
                base: { type: 'symbol', role: 'mo', cls: 'rel', text: c === '>' ? '→' : '←', stretchy: true },
                over: { type: 'group', body: [{ type: 'space', width: 0.8 }, ...(labels[0] ?? []), { type: 'space', width: 0.8 }] },
                ...(labels[1]?.length ? { under: { type: 'group', body: labels[1] } as MathNode } : {}),
              };
        row.push([arrow], []);
      } else if (c === 'V' || c === 'A' || c === '|' || c === '.') {
        while (row.length < vertical * 2 + 1) row.push([]);
        const left = labels[0] ?? [];
        const right = labels[1] ?? [];
        // Les deux étiquettes pèsent zéro : la flèche reste au milieu de sa colonne.
        if (c !== '.') {
          row[vertical * 2] = [
            { type: 'enclose', notation: 'llap', body: { type: 'group', body: [small(left), { type: 'space', width: 0.15 }] } },
            { type: 'delim', delim: c === 'V' ? '↓' : c === 'A' ? '↑' : '‖', size: 2, cls: 'ord' },
            { type: 'enclose', notation: 'rlap', body: { type: 'group', body: [{ type: 'space', width: 0.15 }, small(right)] } },
          ];
        }
        vertical++;
      } else {
        p.leave();
        return p.error('Flèche inconnue dans le diagramme CD.', x.start, kind.end);
      }
    } else if (isCmd(x, '\\end')) {
      const name = p.parseRawArg();
      p.leave();
      if (name?.text !== 'CD') return p.error('\\begin{CD} sans \\end{CD}.', t.start, name?.end ?? t.end);
      break;
    } else {
      p.leave();
      return p.error('\\begin{CD} sans \\end{CD}.', t.start, t.end);
    }
  }
  const last = rows[rows.length - 1];
  if (rows.length > 1 && last?.every((cell) => cell.length === 0)) rows.pop();
  const columns = rows.reduce((m, r) => Math.max(m, r.length), 1);
  return {
    type: 'array', kind: 'matrix', rows,
    cols: Array.from({ length: columns }, () => 'c' as const),
    colLines: Array.from({ length: columns + 1 }, () => false),
    rowLines: Array.from({ length: rows.length + 1 }, () => false),
  };
}

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
  if (name === 'CD') return parseDiagram(p, t);
  // pmatrix*, bmatrix*… : même matrice, avec un alignement de colonnes facultatif.
  const starred = /^[pbBvV]?matrix\*$/.test(name);
  const spec = ENVIRONMENTS[starred ? name.slice(0, -1) : name];
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
  if (starred) {
    const align = columnSpec(p.parseRawOptional() ?? 'c').cols[0];
    if (align) cols = [align];
  }
  if (name === 'alignat' || name === 'alignat*' || name === 'alignedat') p.parseRawArg();

  const { rows, rowLines } = p.parseRows(t, name);
  const columns = rows.reduce((m, r) => Math.max(m, rowWidth(r)), 0);
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
