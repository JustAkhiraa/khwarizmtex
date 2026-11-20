/**
 * Expansion des macros (\newcommand, \def, macros fournies en option).
 *
 * L'expanseur se place entre l'analyse lexicale et le parseur : il lui fournit
 * les jetons un par un, en remplaçant chaque macro par son corps.
 *
 * Garde-fous :
 * - maxExpand : nombre total d'expansions par formule. Une macro récursive
 *   (\def\a{\a}) ou une croissance exponentielle s'arrête là, net.
 * - MAX_STACK : nombre de jetons en attente, pour borner la mémoire.
 */
import { KhwarizmLimitError } from '../errors';
import { tokenize, type Token } from '../lexer/lexer';
import { BUILTIN_MACROS } from './builtins';

export interface MacroDefinition {
  /** Nombre de paramètres (#1 à #9). */
  params: number;
  /** Valeur par défaut du premier paramètre, s'il est optionnel ([...]). */
  optional?: Token[];
  body: Token[];
}

/** Macro donnée sous forme de texte : « \mathbb{R} » ou « \frac{#1}{#2} ». */
export type MacroSource = string;

const MAX_STACK = 200_000;
const DEFINERS = new Set(['\\newcommand', '\\renewcommand', '\\providecommand', '\\def', '\\gdef']);

/** Nombre de paramètres d'un corps de macro : le plus grand #n rencontré. */
function countParams(body: Token[]): number {
  let max = 0;
  for (const t of body) {
    if (t.kind === 'param' && t.text.length === 2) max = Math.max(max, Number(t.text[1]));
  }
  return max;
}

function definitionFromSource(source: MacroSource): MacroDefinition {
  const body = tokenize(source);
  body.pop(); // eof
  return { params: countParams(body), body };
}

const builtinCache = new Map<string, MacroDefinition>();

function builtin(name: string): MacroDefinition | undefined {
  const cached = builtinCache.get(name);
  if (cached) return cached;
  const source = BUILTIN_MACROS[name];
  if (source === undefined) return undefined;
  const def = definitionFromSource(source);
  builtinCache.set(name, def);
  return def;
}

/** Macros ajoutées par les plugins (communes à tous les rendus). */
const pluginMacros = new Map<string, MacroDefinition>();

export function addGlobalMacro(name: string, source: MacroSource): void {
  pluginMacros.set(name, definitionFromSource(source));
}

export class Expander {
  /** Jetons à lire, le prochain en dernier (pile). */
  private stack: Token[];
  private expansions = 0;
  private readonly local = new Map<string, MacroDefinition>();

  constructor(
    tokens: Token[],
    userMacros: Record<string, MacroSource> | undefined,
    private readonly maxExpand: number,
    /** Vrai si le nom est une commande primitive (\frac...), non redéfinissable par \newcommand. */
    private readonly isPrimitive: (name: string) => boolean,
  ) {
    this.stack = tokens.slice().reverse();
    if (userMacros) {
      for (const [name, source] of Object.entries(userMacros)) {
        const key = name.startsWith('\\') ? name : '\\' + name;
        this.local.set(key, definitionFromSource(source));
      }
    }
  }

  /** Définition courante d'une macro (formule, puis options, plugins, intégrées). */
  lookup(name: string): MacroDefinition | undefined {
    return this.local.get(name) ?? pluginMacros.get(name) ?? builtin(name);
  }

  isMacro(name: string): boolean {
    return this.lookup(name) !== undefined;
  }

  // Lecture brute (sans expansion)

  nextRaw(): Token {
    return this.stack.pop() ?? this.eof();
  }

  peekRaw(): Token {
    return this.stack[this.stack.length - 1] ?? this.eof();
  }

  pushBack(token: Token): void {
    this.stack.push(token);
  }

  private pushTokens(tokens: Token[]): void {
    for (let i = tokens.length - 1; i >= 0; i--) this.stack.push(tokens[i] as Token);
    if (this.stack.length > MAX_STACK) {
      throw new KhwarizmLimitError('Formule trop longue après expansion des macros.');
    }
  }

  private eof(): Token {
    return { kind: 'eof', text: '', start: -1, end: -1 };
  }

  // Lecture avec expansion

  /** Prochain jeton, macros développées et définitions traitées. */
  next(): Token {
    for (;;) {
      const token = this.nextRaw();
      if (token.kind !== 'command') return token;
      if (DEFINERS.has(token.text)) {
        const error = this.define(token);
        if (error) return error;
        continue;
      }
      const def = this.lookup(token.text);
      if (!def) return token;
      const error = this.expand(token, def);
      if (error) return error;
    }
  }

  peek(): Token {
    const token = this.next();
    this.stack.push(token);
    return token;
  }

  // Expansion

  private expand(call: Token, def: MacroDefinition): Token | null {
    this.expansions++;
    if (this.expansions > this.maxExpand) {
      throw new KhwarizmLimitError(
        `Trop d'expansions de macros (plus de ${this.maxExpand}) : une macro s'appelle sans doute elle-même.`,
        call.start,
        call.end,
      );
    }
    const args: Token[][] = [];
    let end = call.end;
    let first = 0;
    if (def.optional) {
      this.skipSpaces();
      const t = this.peekRaw();
      if (t.kind === 'char' && t.text === '[') {
        this.nextRaw();
        const read = this.readUntilBracket();
        args.push(read.tokens);
        end = read.end;
      } else {
        args.push(def.optional);
      }
      first = 1;
    }
    for (let i = first; i < def.params; i++) {
      const read = this.readArgument();
      if (!read) {
        return {
          kind: 'error',
          text: `Argument ${i + 1} manquant pour ${call.text}.`,
          start: call.start,
          end: call.end,
        };
      }
      args.push(read.tokens);
      end = read.end;
    }
    // Les jetons du corps prennent la position de l'appel : une erreur dans le
    // corps se signale sur l'appel, seul visible dans la source.
    const out: Token[] = [];
    for (const t of def.body) {
      if (t.kind === 'param' && t.text.length === 2) {
        const arg = args[Number(t.text[1]) - 1];
        if (arg) out.push(...arg);
      } else {
        out.push({ kind: t.kind, text: t.text, start: call.start, end });
      }
    }
    this.pushTokens(out);
    return null;
  }

  private skipSpaces(): void {
    while (this.peekRaw().kind === 'space') this.nextRaw();
  }

  /** Argument d'une macro : un groupe {...} (sans ses accolades) ou un seul jeton. */
  private readArgument(): { tokens: Token[]; end: number } | null {
    this.skipSpaces();
    const t = this.nextRaw();
    if (t.kind === 'eof' || t.kind === 'close') {
      if (t.kind === 'close') this.pushBack(t);
      return null;
    }
    if (t.kind !== 'open') return { tokens: [t], end: t.end };
    return this.readBalanced();
  }

  /** Après une accolade ouvrante : tout jusqu'à l'accolade fermante correspondante. */
  private readBalanced(): { tokens: Token[]; end: number } {
    const tokens: Token[] = [];
    let depth = 1;
    for (;;) {
      const t = this.nextRaw();
      if (t.kind === 'eof') return { tokens, end: tokens[tokens.length - 1]?.end ?? -1 };
      if (t.kind === 'open') depth++;
      if (t.kind === 'close') {
        depth--;
        if (depth === 0) return { tokens, end: t.end };
      }
      tokens.push(t);
    }
  }

  /** Après « [ » : tout jusqu'au « ] » de même niveau d'accolades. */
  private readUntilBracket(): { tokens: Token[]; end: number } {
    const tokens: Token[] = [];
    let depth = 0;
    for (;;) {
      const t = this.nextRaw();
      if (t.kind === 'eof') return { tokens, end: -1 };
      if (t.kind === 'open') depth++;
      if (t.kind === 'close') depth--;
      if (depth === 0 && t.kind === 'char' && t.text === ']') return { tokens, end: t.end };
      tokens.push(t);
    }
  }

  // Définitions

  /** Traite \newcommand et consorts. Renvoie un jeton d'erreur, ou null. */
  private define(cmd: Token): Token | null {
    const fail = (message: string, end = cmd.end): Token => ({
      kind: 'error',
      text: message,
      start: cmd.start,
      end,
    });

    if (cmd.text === '\\def' || cmd.text === '\\gdef') {
      const name = this.nextRaw();
      if (name.kind !== 'command') return fail(`${cmd.text} attend un nom de commande.`, name.end);
      // Paramètres non délimités seulement : \def\f#1#2{...}
      let params = 0;
      while (this.peekRaw().kind === 'param') {
        this.nextRaw();
        params++;
      }
      this.skipSpaces();
      const open = this.nextRaw();
      if (open.kind !== 'open') return fail(`Corps entre accolades attendu pour ${name.text}.`, open.end);
      const body = this.readBalanced();
      this.local.set(name.text, { params: Math.max(params, countParams(body.tokens)), body: body.tokens });
      return null;
    }

    // \newcommand{\nom}[n][défaut]{corps}, étoile facultative.
    this.skipSpaces();
    if (this.peekRaw().kind === 'char' && this.peekRaw().text === '*') this.nextRaw();
    this.skipSpaces();
    let nameToken = this.nextRaw();
    if (nameToken.kind === 'open') {
      const inner = this.readBalanced();
      const first = inner.tokens.find((t) => t.kind !== 'space');
      if (!first || first.kind !== 'command') return fail(`${cmd.text} attend un nom de commande.`, inner.end);
      nameToken = first;
    }
    if (nameToken.kind !== 'command') return fail(`${cmd.text} attend un nom de commande.`, nameToken.end);
    const name = nameToken.text;

    let params = 0;
    let optional: Token[] | undefined;
    this.skipSpaces();
    if (this.peekRaw().kind === 'char' && this.peekRaw().text === '[') {
      this.nextRaw();
      const read = this.readUntilBracket();
      const digits = read.tokens.map((t) => t.text).join('').trim();
      params = Number(digits);
      if (!Number.isInteger(params) || params < 0 || params > 9) {
        return fail(`Nombre de paramètres invalide pour ${name} (de 0 à 9).`, read.end);
      }
      this.skipSpaces();
      if (this.peekRaw().kind === 'char' && this.peekRaw().text === '[') {
        this.nextRaw();
        optional = this.readUntilBracket().tokens;
      }
    }
    const body = this.readArgument();
    if (!body) return fail(`Corps manquant pour ${name}.`);

    const exists = this.isMacro(name) || this.isPrimitive(name);
    if (cmd.text === '\\providecommand' && exists) return null;
    if (cmd.text === '\\newcommand' && this.isPrimitive(name) && !this.isMacro(name)) {
      return fail(`${name} existe déjà : utiliser \\renewcommand pour le redéfinir.`, body.end);
    }
    if (countParams(body.tokens) > params) {
      return fail(`Le corps de ${name} utilise un paramètre non déclaré.`, body.end);
    }
    const def: MacroDefinition = optional ? { params, optional, body: body.tokens } : { params, body: body.tokens };
    this.local.set(name, def);
    return null;
  }
}
