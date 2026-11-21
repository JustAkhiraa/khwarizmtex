/**
 * Parseur récursif descendant : jetons → arbre syntaxique (AST).
 *
 * Mode de récupération : une erreur ne stoppe pas l'analyse. La partie fautive
 * devient un nœud « error » et le reste de la formule est rendu normalement.
 * Seuls les garde-fous (maxExpand, maxDepth) interrompent tout.
 */
import {
  emptyGroup,
  toNode,
  type ErrorNode,
  type FencedNode,
  type FracNode,
  type MathNode,
  type MathStyle,
  type MathVariant,
  type ScriptsNode,
  type SymbolNode,
  type SymbolRole,
  type TextFont,
} from '../ast/nodes';
import { KhwarizmLimitError, type Diagnostic } from '../errors';
import { tokenize, type Token } from '../lexer/lexer';
import { Expander } from '../macros/expander';
import { isItalicByDefault } from '../symbols/alphabets';
import { lookupChar, lookupDelimiter, lookupOperator, lookupSymbol, type SymbolInfo } from '../symbols/symbols';
import { lookupFunction } from './functions';
import { mergeLetters } from './helpers';
import { parseColor } from './values';
import { equationId } from '../references';

export interface ParserOptions {
  macros?: Record<string, string> | undefined;
  /** Étiquettes déjà connues, utilisées par `\\ref` et `\\eqref`. */
  references?: Readonly<Record<string, string | number>> | undefined;
  trustLinks?: boolean;
  maxExpand: number;
  maxDepth: number;
  /** Taille maximale d'une espace explicite (\hspace, \kern), en em. */
  maxSize: number;
}

/** Condition d'arrêt d'une liste (accolade fermante, &, \\, \end...). */
export type StopTest = (t: Token) => boolean;

/** Commandes qui terminent une liste en cours : jamais prises pour un argument. */
const STOPPERS = new Set(['\\right', '\\middle', '\\end', '\\\\', '\\cr']);

const STYLE_SWITCHES: Record<string, MathStyle> = {
  '\\displaystyle': 'display',
  '\\textstyle': 'text',
  '\\scriptstyle': 'script',
  '\\scriptscriptstyle': 'scriptscript',
};

const FONT_SWITCHES: Record<string, MathVariant> = {
  '\\rm': 'normal',
  '\\bf': 'bold',
  '\\it': 'italic',
  '\\sf': 'sans-serif',
  '\\tt': 'monospace',
  '\\cal': 'script',
  '\\frak': 'fraktur',
  '\\Bbb': 'double-struck',
  '\\bold': 'bold',
};

const PRIMES = ['', '′', '″', '‴', '⁗'];

/** Accents du mode texte : \'e → é. */
const TEXT_ACCENTS: Record<string, string> = {
  "\\'": '́',
  '\\`': '̀',
  '\\^': '̂',
  '\\"': '̈',
  '\\~': '̃',
  '\\c': '̧',
  '\\=': '̄',
  '\\.': '̇',
  '\\u': '̆',
  '\\v': '̌',
};

/** Symboles du mode texte. */
const TEXT_SYMBOLS: Record<string, string> = {
  '\\ ': ' ',
  '\\,': ' ',
  '\\;': ' ',
  '\\:': ' ',
  '\\!': '',
  '\\quad': ' ',
  '\\qquad': '  ',
  '\\enspace': ' ',
  '\\%': '%',
  '\\&': '&',
  '\\$': '$',
  '\\#': '#',
  '\\_': '_',
  '\\{': '{',
  '\\}': '}',
  '\\textbackslash': '\\',
  '\\ldots': '…',
  '\\dots': '…',
  '\\textdegree': '°',
  '\\degree': '°',
  '\\S': '§',
  '\\P': '¶',
  '\\copyright': '©',
  '\\dag': '†',
  '\\ddag': '‡',
  '\\textendash': '–',
  '\\textbullet': '•',
  '\\textasciitilde': '~',
  '\\textasciicircum': '^',
  '\\textless': '<',
  '\\textgreater': '>',
  '\\euro': '€',
  '\\oe': 'œ',
  '\\OE': 'Œ',
  '\\ae': 'æ',
  '\\AE': 'Æ',
  '\\ss': 'ß',
};

const TEXT_FONT_COMMANDS: Record<string, TextFont> = {
  '\\textbf': 'bold',
  '\\textit': 'italic',
  '\\emph': 'italic',
  '\\textrm': 'normal',
  '\\textnormal': 'normal',
  '\\textup': 'normal',
  '\\textsf': 'sans-serif',
  '\\texttt': 'monospace',
};

function isDigit(ch: string): boolean {
  return ch.length === 1 && ch >= '0' && ch <= '9';
}

function isCommand(t: Token, ...names: string[]): boolean {
  return t.kind === 'command' && names.includes(t.text);
}

/** Vrai si le nom est une commande primitive (non redéfinissable par \newcommand). */
export function isPrimitive(name: string): boolean {
  return (
    lookupFunction(name) !== undefined ||
    lookupSymbol(name) !== undefined ||
    lookupOperator(name) !== undefined ||
    name === '\\begin' ||
    name === '\\end' ||
    name === '\\left' ||
    name === '\\right'
  );
}

export class Parser {
  readonly errors: Diagnostic[] = [];
  private readonly gullet: Expander;
  private depth = 0;
  /** Variante de police courante, posée par \mathbb{...}, \mathrm{...}... */
  private font: MathVariant | null = null;

  constructor(
    readonly input: string,
    readonly options: ParserOptions,
  ) {
    this.gullet = new Expander(tokenize(input), options.macros, options.maxExpand, isPrimitive);
  }

  /** Analyse toute la source. */
  parse(): MathNode[] {
    return this.parseList(() => false);
  }

  // Jetons

  /** Prochain jeton en mode mathématique (espaces ignorés), sans le consommer. */
  peek(): Token {
    for (;;) {
      const t = this.gullet.peek();
      if (t.kind !== 'space') return t;
      this.gullet.next();
    }
  }

  /** Consomme et renvoie le prochain jeton (espaces ignorés). */
  next(): Token {
    this.peek();
    return this.gullet.next();
  }

  pushBack(t: Token): void {
    this.gullet.pushBack(t);
  }

  // Erreurs et garde-fous

  /**
   * Nœud d'erreur sur la plage [start, end[ de la source.
   * `showSource` à false : la source n'est pas affichée (argument manquant :
   * une petite case vide tient sa place).
   */
  error(message: string, start: number, end: number, showSource = true): ErrorNode {
    const s = start < 0 ? this.input.length : start;
    const e = end < s ? s : end;
    this.errors.push({ message, start: s, end: e });
    return { type: 'error', message, source: showSource ? this.input.slice(s, e) : '', loc: { start: s, end: e } };
  }

  enter(t: Token): void {
    this.depth++;
    if (this.depth > this.options.maxDepth) {
      throw new KhwarizmLimitError(
        `Imbrication trop profonde (plus de ${this.options.maxDepth} niveaux).`,
        t.start,
        t.end,
      );
    }
  }

  leave(): void {
    this.depth--;
  }

  /** Exécute `fn` avec une variante de police (\mathbb{...}). */
  withFont<T>(variant: MathVariant | null, fn: () => T): T {
    const saved = this.font;
    this.font = variant;
    try {
      return fn();
    } finally {
      this.font = saved;
    }
  }

  // Listes

  /** Suite d'atomes jusqu'à la condition d'arrêt (non consommée) ou la fin. */
  parseList(stop: StopTest): MathNode[] {
    const list: MathNode[] = [];
    let over: { num: MathNode[]; token: Token } | null = null;

    for (;;) {
      const t = this.peek();
      if (t.kind === 'eof' || stop(t)) break;

      if (t.kind === 'close') {
        this.next();
        list.push(this.error('Accolade « } » en trop : aucune accolade ouvrante ne lui correspond.', t.start, t.end));
        continue;
      }

      if (t.kind === 'command') {
        if (t.text === '\\over' || t.text === '\\choose' || t.text === '\\atop') {
          this.next();
          if (over) list.push(this.error(`Un seul ${t.text} par groupe.`, t.start, t.end));
          else over = { num: list.splice(0), token: t };
          continue;
        }
        const switched = this.parseSwitch(t, stop);
        if (switched) {
          list.push(switched);
          break;
        }
      }

      const atom = this.parseAtom();
      if (atom) list.push(atom);
    }

    if (over) {
      const kind = over.token.text;
      const frac: FracNode = { type: 'frac', num: toNode(over.num), den: toNode(list), bar: kind === '\\over' };
      if (kind === '\\choose') {
        frac.left = '(';
        frac.right = ')';
      }
      return [frac];
    }
    return list;
  }

  /** \displaystyle, \rm, \color{...} : s'appliquent jusqu'à la fin du groupe. */
  private parseSwitch(t: Token, stop: StopTest): MathNode | null {
    const style = STYLE_SWITCHES[t.text];
    if (style) {
      this.next();
      this.enter(t);
      const body = this.parseList(stop);
      this.leave();
      return { type: 'style', style, body };
    }
    const font = FONT_SWITCHES[t.text];
    if (font) {
      this.next();
      this.enter(t);
      const body = this.withFont(font, () => this.parseList(stop));
      this.leave();
      return { type: 'group', body: mergeLetters(body) };
    }
    if (t.text === '\\color') {
      this.next();
      const model = this.parseRawOptional();
      const raw = this.parseRawArg();
      const color = raw ? parseColor(raw.text, model ?? undefined) : null;
      this.enter(t);
      const body = this.parseList(stop);
      this.leave();
      if (!color) {
        const err = this.error(`Couleur inconnue : « ${raw?.text ?? ''} ».`, t.start, raw?.end ?? t.end);
        return { type: 'group', body: [err, ...body] };
      }
      return { type: 'color', color, body };
    }
    return null;
  }

  // Atomes

  /** Un élément avec ses exposants et indices éventuels. */
  parseAtom(): MathNode | null {
    const t = this.peek();
    if (t.kind === 'sup' || t.kind === 'sub' || (t.kind === 'char' && t.text === "'")) {
      return this.parseScripts(null);
    }
    const base = this.parsePrimary(false);
    if (base === null) return null;
    return this.parseScripts(base);
  }

  private parseScripts(initial: MathNode | null): MathNode | null {
    let base = initial;
    let sup: MathNode | undefined;
    let sub: MathNode | undefined;

    const restart = (t: Token, what: string): ErrorNode => {
      // Double exposant : on garde ce qui précède comme base et on continue.
      const node: ScriptsNode = { type: 'scripts', base };
      if (sup) node.sup = sup;
      if (sub) node.sub = sub;
      base = node;
      sup = undefined;
      sub = undefined;
      return this.error(`Double ${what} : regrouper avec des accolades, par exemple x^{ab}.`, t.start, t.end);
    };

    for (;;) {
      const t = this.peek();
      if (isCommand(t, '\\limits', '\\nolimits', '\\displaylimits')) {
        this.next();
        if (base && base.type === 'op') {
          base.limits = t.text === '\\limits' ? 'limits' : t.text === '\\nolimits' ? 'nolimits' : 'auto';
        } else {
          return this.combine(base, sup, sub, this.error(`${t.text} doit suivre un opérateur comme \\sum.`, t.start, t.end));
        }
        continue;
      }
      if (t.kind === 'sup' || t.kind === 'sub') {
        this.next();
        const isSup = t.kind === 'sup';
        const err = (isSup ? sup : sub) ? restart(t, isSup ? 'exposant' : 'indice') : null;
        const arg = this.parseScriptArg(t);
        const value: MathNode = err ? { type: 'group', body: [err, arg] } : arg;
        if (isSup) sup = value;
        else sub = value;
        continue;
      }
      if (t.kind === 'char' && t.text === "'") {
        let count = 0;
        const first = t;
        while (this.peek().kind === 'char' && this.peek().text === "'") {
          this.next();
          count++;
        }
        const err = sup ? restart(first, 'exposant') : null;
        const prime: SymbolNode = {
          type: 'symbol',
          role: 'mo',
          cls: 'ord',
          text: PRIMES[count] ?? '′'.repeat(count),
        };
        let value: MathNode = prime;
        if (this.peek().kind === 'sup') {
          const st = this.next();
          value = { type: 'group', body: [prime, this.parseScriptArg(st)] };
        }
        sup = err ? { type: 'group', body: [err, value] } : value;
        continue;
      }
      break;
    }
    return this.combine(base, sup, sub, null);
  }

  private combine(
    base: MathNode | null,
    sup: MathNode | undefined,
    sub: MathNode | undefined,
    trailing: ErrorNode | null,
  ): MathNode | null {
    let node: MathNode | null = base;
    if (sup || sub) {
      const s: ScriptsNode = { type: 'scripts', base };
      if (sup) s.sup = sup;
      if (sub) s.sub = sub;
      node = s;
    }
    if (trailing) return node ? { type: 'group', body: [node, trailing] } : trailing;
    return node;
  }

  /** Argument d'un ^ ou d'un _ : un seul élément ou un groupe. */
  private parseScriptArg(op: Token): MathNode {
    const t = this.peek();
    if (
      t.kind === 'eof' ||
      t.kind === 'close' ||
      t.kind === 'align' ||
      t.kind === 'sup' ||
      t.kind === 'sub' ||
      (t.kind === 'command' && STOPPERS.has(t.text))
    ) {
      const what = op.kind === 'sup' ? 'Exposant vide après « ^ ».' : 'Indice vide après « _ ».';
      return this.error(what, op.start, op.end, false);
    }
    this.enter(t);
    const node = this.parsePrimary(true) ?? emptyGroup();
    this.leave();
    return node;
  }

  /**
   * Un élément sans ses exposants : caractère, groupe, commande.
   * `single` : un seul caractère (pas de regroupement de chiffres), comme
   * l'argument de x^12 (seul le 1 monte, comme en LaTeX).
   */
  parsePrimary(single: boolean): MathNode | null {
    const t = this.next();
    switch (t.kind) {
      case 'open':
        return this.parseGroupAfterOpen(t);
      case 'char':
        return this.parseCharacter(t, single);
      case 'command':
        return this.parseCommand(t);
      case 'error':
        this.errors.push({ message: t.text, start: t.start, end: t.end });
        return { type: 'error', message: t.text, source: this.input.slice(t.start, t.end), loc: { start: t.start, end: t.end } };
      case 'close':
        return this.error('Accolade « } » en trop : aucune accolade ouvrante ne lui correspond.', t.start, t.end);
      case 'align':
        return this.error('« & » ne sert que dans un tableau (matrix, aligned, cases...).', t.start, t.end);
      case 'param':
        return this.error('« # » ne sert que dans une définition de macro.', t.start, t.end);
      case 'sup':
      case 'sub':
        return this.error(`« ${t.text} » inattendu.`, t.start, t.end);
      default:
        return null;
    }
  }

  /** Après « { » : le groupe jusqu'à « } ». */
  private parseGroupAfterOpen(open: Token): MathNode {
    this.enter(open);
    const body = this.parseList((t) => t.kind === 'close');
    if (this.peek().kind === 'close') this.next();
    else body.unshift(this.error('Accolade « { » jamais fermée.', open.start, open.end));
    this.leave();
    return { type: 'group', body };
  }

  private parseCharacter(t: Token, single: boolean): MathNode {
    const ch = t.text;
    if (isDigit(ch)) {
      let text = ch;
      let end = t.end;
      if (!single) {
        for (;;) {
          const n1 = this.gullet.peek();
          if (n1.kind === 'char' && isDigit(n1.text)) {
            this.gullet.next();
            text += n1.text;
            end = n1.end;
            continue;
          }
          if (n1.kind === 'char' && n1.text === '.') {
            this.gullet.next();
            const n2 = this.gullet.peek();
            if (n2.kind === 'char' && isDigit(n2.text)) {
              text += '.';
              continue;
            }
            this.gullet.pushBack(n1);
          }
          break;
        }
      }
      return this.makeSymbol('mn', 'ord', text, t.start, end);
    }
    if (ch === '~') return { type: 'space', width: 1 / 3 };
    if (ch === '$') {
      return this.error('« $ » inattendu : la formule est déjà en mode mathématique.', t.start, t.end);
    }
    const info = lookupChar(ch);
    if (info) return this.fromInfo(info, t);
    // Lettre (latine, accentuée, d'un autre alphabet) ou symbole inconnu des tables.
    if (/^\p{L}$/u.test(ch)) return this.makeSymbol('mi', 'ord', ch, t.start, t.end);
    return this.makeSymbol('mo', 'ord', ch, t.start, t.end);
  }

  private fromInfo(info: SymbolInfo, t: Token): SymbolNode {
    return this.makeSymbol(info.role, info.cls, info.char, t.start, t.end, info.variant);
  }

  /** Crée un symbole en appliquant la police courante aux lettres et aux chiffres. */
  makeSymbol(
    role: SymbolRole,
    cls: SymbolNode['cls'],
    text: string,
    start: number,
    end: number,
    variant?: MathVariant,
  ): SymbolNode {
    const node: SymbolNode = { type: 'symbol', role, cls, text, loc: { start, end } };
    const font = this.font;
    if (font && role !== 'mo') {
      node.variant = fontFor(font, text, variant);
    } else if (variant) {
      node.variant = variant;
    }
    return node;
  }

  /** Résout une référence d'équation sans jamais faire confiance à son libellé pour générer du HTML. */
  reference(name: string, eqref: boolean, token: Token): MathNode {
    const refs = this.options.references;
    const value = refs && Object.prototype.hasOwnProperty.call(refs, name) ? refs[name] : undefined;
    if (value === undefined) {
      this.errors.push({ message: `Référence inconnue : ${name || '(vide)'}.`, start: token.start, end: token.end });
      return { type: 'ref', text: '??', resolved: false };
    }
    const text = String(value);
    return {
      type: 'ref',
      text: eqref ? `(${text})` : text,
      target: equationId(name),
      resolved: true,
    };
  }

  private parseCommand(t: Token): MathNode | null {
    const fn = lookupFunction(t.text);
    if (fn) {
      this.enter(t);
      try { return fn(this, t); } finally { this.leave(); }
    }

    const op = lookupOperator(t.text);
    if (op) return { type: 'op', name: op.name, symbol: op.symbol, limits: op.limits ? 'auto' : 'nolimits' };

    const sym = lookupSymbol(t.text);
    if (sym) return this.fromInfo(sym, t);

    if (t.text === '\\\\' || t.text === '\\cr' || t.text === '\\newline') return { type: 'newline' };

    if (t.text === '\\right' || t.text === '\\middle') {
      const d = this.next();
      const known = (d.kind === 'char' || d.kind === 'command') && lookupDelimiter(d.text) !== undefined;
      if (!known) this.pushBack(d);
      return this.error(`${t.text} sans \\left correspondant.`, t.start, known ? d.end : t.end);
    }
    if (t.text === '\\end') {
      const name = this.parseRawArg();
      return this.error(`\\end{${name?.text ?? ''}} sans \\begin correspondant.`, t.start, name?.end ?? t.end);
    }
    return this.error(`Commande inconnue : ${t.text}`, t.start, t.end);
  }

  // Arguments (utilisés par les commandes, y compris celles des plugins)

  /** Argument obligatoire : un groupe {...} ou un seul élément. */
  parseArg(cmd: Token): MathNode {
    const t = this.peek();
    if (
      t.kind === 'eof' ||
      t.kind === 'close' ||
      t.kind === 'align' ||
      (t.kind === 'command' && STOPPERS.has(t.text))
    ) {
      return this.error(`Argument manquant pour ${cmd.text}.`, cmd.start, cmd.end, false);
    }
    this.enter(t);
    const node = this.parsePrimary(true) ?? emptyGroup();
    this.leave();
    return node;
  }

  /** Argument optionnel [...] en mode mathématique, ou null s'il est absent. */
  parseOptionalArg(): MathNode | null {
    const t = this.peek();
    if (!(t.kind === 'char' && t.text === '[')) return null;
    this.next();
    this.enter(t);
    const body = this.parseList((x) => x.kind === 'char' && x.text === ']');
    const close = this.peek();
    if (close.kind === 'char' && close.text === ']') this.next();
    else body.unshift(this.error('Crochet « [ » jamais fermé.', t.start, t.end));
    this.leave();
    return toNode(body);
  }

  /** Texte brut entre accolades, sans expansion : nom d'environnement, couleur, dimension. */
  parseRawArg(): { text: string; start: number; end: number } | null {
    const open = this.peek();
    if (open.kind === 'char') {
      this.next();
      return { text: open.text, start: open.start, end: open.end };
    }
    if (open.kind !== 'open') return null;
    this.next();
    let text = '';
    let depth = 1;
    for (;;) {
      const t = this.gullet.nextRaw();
      if (t.kind === 'eof') {
        this.error('Accolade « { » jamais fermée.', open.start, open.end);
        return { text, start: open.start, end: this.input.length };
      }
      if (t.kind === 'open') depth++;
      if (t.kind === 'close' && --depth === 0) return { text: text.trim(), start: open.start, end: t.end };
      text += t.kind === 'space' ? ' ' : t.text;
    }
  }

  /** Argument optionnel brut [...] (modèle de couleur), ou null. */
  parseRawOptional(): string | null {
    const t = this.peek();
    if (!(t.kind === 'char' && t.text === '[')) return null;
    this.next();
    let text = '';
    for (;;) {
      const x = this.gullet.nextRaw();
      if (x.kind === 'eof') return text;
      if (x.kind === 'char' && x.text === ']') return text.trim();
      text += x.kind === 'space' ? ' ' : x.text;
    }
  }

  /** Dimension après \kern, \hspace... : {1em} ou 1em. Texte brut, ou null. */
  parseDimensionText(): { text: string; end: number } | null {
    const t = this.peek();
    if (t.kind === 'open') {
      const raw = this.parseRawArg();
      return raw ? { text: raw.text, end: raw.end } : null;
    }
    let text = '';
    let end = t.end;
    // Signe et nombre.
    for (;;) {
      const x = this.gullet.peek();
      if (x.kind === 'char' && /^[-+0-9.,]$/.test(x.text)) {
        this.gullet.next();
        text += x.text;
        end = x.end;
      } else break;
    }
    while (this.gullet.peek().kind === 'space') this.gullet.next();
    // Unité : deux lettres.
    for (let i = 0; i < 2; i++) {
      const x = this.gullet.peek();
      if (x.kind === 'char' && /^[a-zA-Z]$/.test(x.text)) {
        this.gullet.next();
        text += x.text;
        end = x.end;
      } else break;
    }
    return text ? { text, end } : null;
  }

  /** Délimiteur après \left, \right, \big... : caractère ('' pour « . »), ou null. */
  parseDelimiter(): string | null {
    const t = this.next();
    if (t.kind === 'char' || t.kind === 'command') {
      const d = lookupDelimiter(t.text);
      if (d !== undefined) return d;
    }
    this.pushBack(t);
    return null;
  }

  /** \left( ... \middle| ... \right). */
  parseLeftRight(cmd: Token): MathNode {
    const left = this.parseDelimiter();
    const nodes: MathNode[] = [];
    if (left === null) {
      nodes.push(this.error('Délimiteur attendu après \\left, par exemple \\left(.', cmd.start, cmd.end));
    }
    this.enter(cmd);
    const body: MathNode[] = [];
    let right = '';
    for (;;) {
      body.push(...this.parseList((t) => isCommand(t, '\\right', '\\middle')));
      const t = this.peek();
      if (isCommand(t, '\\middle')) {
        this.next();
        const d = this.parseDelimiter();
        body.push(d === null ? this.error('Délimiteur attendu après \\middle.', t.start, t.end) : { type: 'middle', delim: d });
        continue;
      }
      if (isCommand(t, '\\right')) {
        this.next();
        const d = this.parseDelimiter();
        if (d === null) body.push(this.error('Délimiteur attendu après \\right, par exemple \\right).', t.start, t.end));
        right = d ?? '';
        break;
      }
      body.push(this.error('\\left sans \\right : la parenthèse n\'est jamais refermée.', cmd.start, cmd.end));
      break;
    }
    this.leave();
    const fenced: FencedNode = { type: 'fenced', left: left ?? '', right, body };
    if (nodes.length === 0) return fenced;
    return { type: 'group', body: [...nodes, fenced] };
  }

  // Mode texte

  /** \text{...} : texte, avec $...$ pour revenir aux mathématiques. */
  parseText(cmd: Token, font: TextFont): MathNode {
    const parts: MathNode[] = [];
    let buf = '';
    const flush = (): void => {
      if (buf) parts.push({ type: 'text', text: buf.normalize('NFC'), font });
      buf = '';
    };

    const open = this.peek();
    if (open.kind !== 'open') {
      // \text a : un seul jeton.
      const t = this.next();
      if (t.kind === 'char') return { type: 'text', text: t.text, font };
      this.pushBack(t);
      return this.error(`Argument manquant pour ${cmd.text}.`, cmd.start, cmd.end, false);
    }
    this.next();
    this.enter(open);
    let depth = 1;
    for (;;) {
      const t = this.gullet.next();
      if (t.kind === 'eof') {
        flush();
        parts.unshift(this.error(`Accolade de ${cmd.text}{ jamais fermée.`, open.start, open.end));
        break;
      }
      if (t.kind === 'open') {
        depth++;
        continue;
      }
      if (t.kind === 'close') {
        if (--depth === 0) break;
        continue;
      }
      if (t.kind === 'space') {
        buf += ' ';
        continue;
      }
      if (t.kind === 'char') {
        if (t.text === '$') {
          flush();
          const math = this.parseList((x) => x.kind === 'char' && x.text === '$');
          const close = this.peek();
          if (close.kind === 'char' && close.text === '$') this.next();
          else math.unshift(this.error('« $ » jamais refermé dans le texte.', t.start, t.end));
          parts.push({ type: 'group', body: math });
        } else {
          buf += t.text === '~' ? ' ' : t.text;
        }
        continue;
      }
      if (t.kind === 'command') {
        const sym = TEXT_SYMBOLS[t.text];
        if (sym !== undefined) {
          buf += sym;
          continue;
        }
        const accent = TEXT_ACCENTS[t.text];
        if (accent !== undefined) {
          const base = this.gullet.next();
          if (base.kind === 'open') {
            const inner = this.gullet.next();
            if (this.gullet.peek().kind === 'close') this.gullet.next();
            buf += (inner.kind === 'char' ? inner.text : '') + accent;
          } else {
            buf += (base.kind === 'char' ? base.text : '') + accent;
          }
          continue;
        }
        const nested = TEXT_FONT_COMMANDS[t.text];
        if (nested) {
          flush();
          parts.push(this.parseText(t, nested));
          continue;
        }
        const mathSym = lookupSymbol(t.text);
        if (mathSym) {
          buf += mathSym.char;
          continue;
        }
        flush();
        parts.push(this.error(`Commande inconnue dans le texte : ${t.text}`, t.start, t.end));
        continue;
      }
      if (t.kind === 'error') {
        flush();
        this.errors.push({ message: t.text, start: t.start, end: t.end });
        parts.push({ type: 'error', message: t.text, source: this.input.slice(t.start, t.end), loc: { start: t.start, end: t.end } });
        continue;
      }
      // ^, _, &, # : gardés tels quels dans le texte.
      buf += t.text;
    }
    flush();
    this.leave();
    if (parts.length === 1 && parts[0]) return parts[0];
    return { type: 'group', body: parts };
  }

  // Tableaux

  /**
   * Lignes d'un tableau jusqu'à \end{name} (ou « } » pour \substack).
   * Renvoie les lignes et les filets horizontaux (\hline).
   */
  parseRows(
    begin: Token,
    name: string | null,
  ): { rows: MathNode[][][]; rowLines: boolean[] } {
    const rows: MathNode[][][] = [];
    const rowLines: boolean[] = [false];
    let row: MathNode[][] = [];
    const endsCell = (t: Token): boolean =>
      t.kind === 'align' || isCommand(t, '\\\\', '\\cr', '\\end') || (name === null && t.kind === 'close');

    this.enter(begin);
    for (;;) {
      if (row.length === 0) {
        while (isCommand(this.peek(), '\\hline', '\\hdashline')) {
          this.next();
          rowLines[rows.length] = true;
        }
      }
      row.push(this.parseList(endsCell));
      const t = this.peek();
      if (t.kind === 'align') {
        this.next();
        continue;
      }
      if (isCommand(t, '\\\\', '\\cr')) {
        this.next();
        const bracket = this.peek();
        if (bracket.kind === 'char' && bracket.text === '[') this.parseRawOptional();
        rows.push(row);
        row = [];
        rowLines.push(false);
        continue;
      }
      if (name === null && t.kind === 'close') {
        this.next();
        break;
      }
      if (isCommand(t, '\\end')) {
        this.next();
        const end = this.parseRawArg();
        if (name !== null && end?.text !== name) {
          row.push([
            this.error(`\\end{${end?.text ?? ''}} ne ferme pas \\begin{${name}}.`, t.start, end?.end ?? t.end),
          ]);
        }
        break;
      }
      // Fin de la source sans \end.
      row.push([
        this.error(
          name === null ? 'Accolade jamais fermée.' : `\\begin{${name}} sans \\end{${name}}.`,
          begin.start,
          begin.end,
        ),
      ]);
      break;
    }
    // Un \\ final crée une ligne vide : on l'ignore.
    const last = row;
    const empty = last.length === 1 && (last[0]?.length ?? 0) === 0;
    if (!empty || rows.length === 0) rows.push(last);
    while (rowLines.length < rows.length + 1) rowLines.push(false);
    this.leave();
    return { rows, rowLines: rowLines.slice(0, rows.length + 1) };
  }
}

/** Variante d'un symbole dans la police demandée. */
function fontFor(font: MathVariant, text: string, own?: MathVariant): MathVariant {
  if (font === 'bold-italic') {
    // \boldsymbol : italique gras pour les lettres, gras droit pour le reste.
    return isItalicByDefault(text) && own !== 'normal' ? 'bold-italic' : 'bold';
  }
  return font;
}
