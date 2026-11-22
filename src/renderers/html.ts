/**
 * Moteur HTML/CSS.
 *
 * Principes :
 * - un élément par objet mathématique, des classes lisibles préfixées khw- ;
 * - les empilements (fractions, bornes, accents) sont des tableaux CSS à
 *   légende : la ligne de base tombe exactement sur la barre ou sur la base,
 *   dans tous les navigateurs et avec n'importe quelle police ;
 * - les seules valeurs calculées ici (décalage des exposants, hauteur des
 *   délimiteurs) sont écrites en em dans un attribut style ;
 * - au premier niveau, la formule est découpée après les relations et les
 *   opérateurs : le navigateur peut y passer à la ligne sur un petit écran.
 */
import { atomClass, reclassify, spaceBetween } from '../ast/classes';
import type {
  AccentNode,
  ArrayNode,
  AtomClass,
  DelimNode,
  EncloseNode,
  ErrorNode,
  FencedNode,
  FracNode,
  MathNode,
  MathStyle,
  OpNode,
  ScriptsNode,
  SqrtNode,
  SymbolNode,
  TextFont,
  UnderOverNode,
} from '../ast/nodes';
import { isItalicByDefault, toMathAlphabetString } from '../symbols/alphabets';
import { stretchyDelimiter, surd } from './delimiters';
import {
  AXIS,
  LINE_ASCENT,
  LINE_DESCENT,
  RULE,
  SUB_ALONE,
  SUB_DROP,
  SUB_WITH_SUP,
  SUP_CRAMPED,
  SUP_DISPLAY,
  SUP_DROP,
  SUP_TEXT,
  X_HEIGHT,
  italicCorrection,
  textMetrics,
} from './metrics';
import { addClass, cls, el, type VElement, type VNode } from './vnode';
import { equationHref } from '../references';

export interface HtmlOptions {
  display: boolean;
  /** Découpe la formule aux relations et opérateurs pour le retour à la ligne. */
  lineBreaks: boolean;
}

interface Ctx {
  style: MathStyle;
  /** Style « tassé » de TeX (dénominateurs, indices, radicandes) : exposants plus bas. */
  cramped: boolean;
}

interface Box {
  node: VElement;
  /** Hauteur et profondeur estimées, en em de la taille courante. */
  h: number;
  d: number;
  cls: AtomClass | null;
  /** Se termine par une lettre italique. */
  italic?: boolean;
  /** Correction italique (em) : l'exposant s'écarte d'autant de la lettre penchée. */
  ic?: number;
  /** Un seul caractère : TeX place alors les indices plus simplement. */
  isChar?: boolean;
  newline?: boolean;
}

interface Content {
  nodes: VNode[];
  h: number;
  d: number;
  italic: boolean;
  isChar: boolean;
}

const SIZE: Record<MathStyle, number> = { display: 1, text: 1, script: 0.7, scriptscript: 0.5 };
const SCRIPT_OF: Record<MathStyle, MathStyle> = {
  display: 'script',
  text: 'script',
  script: 'scriptscript',
  scriptscript: 'scriptscript',
};
const FRACTION_OF: Record<MathStyle, MathStyle> = {
  display: 'text',
  text: 'script',
  script: 'scriptscript',
  scriptscript: 'scriptscript',
};

const SIZE_CLASSES: [number, string][] = [
  [0.7, 'khw-s70'],
  [0.5, 'khw-s50'],
  [5 / 7, 'khw-s71'],
  [1.4, 'khw-s140'],
  [10 / 7, 'khw-s143'],
  [2, 'khw-s200'],
];

/** Classe de taille pour passer d'un style à un autre (70 %, 50 %...). */
function sizeClass(from: MathStyle, to: MathStyle): string | undefined {
  const ratio = SIZE[to] / SIZE[from];
  if (Math.abs(ratio - 1) < 0.001) return undefined;
  for (const [value, name] of SIZE_CLASSES) if (Math.abs(ratio - value) < 0.001) return name;
  return undefined;
}

function ratio(from: MathStyle, to: MathStyle): number {
  return SIZE[to] / SIZE[from];
}

const SPACE_CLASS = ['', 'khw-thin', 'khw-med', 'khw-thick'];

/** Nombre en em, arrondi au millième, sans zéros inutiles. */
function fmt(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? '0' : String(r);
}

function setStyle(node: VElement, declaration: string): void {
  const current = node.attrs['style'];
  node.attrs['style'] = current ? `${current};${declaration}` : declaration;
}

const TEXT_FONT_CLASS: Record<TextFont, string | undefined> = {
  normal: undefined,
  bold: 'khw-bf',
  italic: 'khw-it',
  monospace: 'khw-tt',
  'sans-serif': 'khw-sf',
};

/** Signes des accents étroits. */
const ACCENT_MARKS: Record<string, string> = {
  hat: 'ˆ',
  check: 'ˇ',
  tilde: '˜',
  acute: '´',
  grave: '`',
  dot: '˙',
  ddot: '¨',
  breve: '˘',
  bar: 'ˉ',
  mathring: '˚',
};

/** Tracés des accents larges (viewBox 0 0 1000 300, étirés à la largeur). */
const WIDE_ACCENTS: Record<string, string> = {
  hat: 'M0 270L500 30L1000 270',
  check: 'M0 30L500 270L1000 30',
  tilde: 'M0 230C120 40 300 30 500 150S880 260 1000 70',
};

const ARROW_KIND: Record<string, string> = {
  rightarrow: 'r',
  leftarrow: 'l',
  leftrightarrow: 'lr',
  '→': 'r',
  '←': 'l',
  '↔': 'lr',
  '⇒': 'r khw-harrow-double',
  '⇐': 'l khw-harrow-double',
  '⇔': 'lr khw-harrow-double',
};

const INTEGRALS = new Set(['∫', '∬', '∭', '∮', '∯', '∰', '⨌']);

const BREAK_AFTER = new Set<AtomClass>(['rel', 'bin', 'punct']);
const NO_BREAK_BEFORE = new Set<AtomClass>(['rel', 'punct', 'close']);

export function renderHTML(body: MathNode[], options: HtmlOptions): VElement {
  return new HtmlRenderer().root(body, options);
}

class HtmlRenderer {
  root(body: MathNode[], options: HtmlOptions): VElement {
    const ctx: Ctx = { style: options.display ? 'display' : 'text', cramped: false };
    const boxes = this.list(body, ctx);
    if (!options.lineBreaks) {
      return el(
        'span',
        { class: 'khw-html', 'aria-hidden': 'true' },
        boxes.map((b) => b.node),
      );
    }
    const { children, wraps } = this.chunks(boxes);
    return el('span', { class: cls('khw-html', wraps && 'khw-wrap'), 'aria-hidden': 'true' }, children);
  }

  /**
   * Découpe en morceaux insécables, avec une possibilité de coupure (<wbr>)
   * après chaque relation, opérateur binaire ou virgule du premier niveau.
   */
  private chunks(boxes: Box[]): { children: VNode[]; wraps: boolean } {
    const out: VNode[] = [];
    let current: VNode[] = [];
    let wraps = false;
    const flush = (): void => {
      if (current.length) out.push(el('span', { class: 'khw-chunk' }, current));
      current = [];
    };
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i] as Box;
      if (box.newline) {
        flush();
        out.push(el('br'));
        wraps = true;
        continue;
      }
      current.push(box.node);
      if (box.cls && BREAK_AFTER.has(box.cls)) {
        let next: Box | undefined;
        for (let j = i + 1; j < boxes.length; j++) {
          if ((boxes[j] as Box).cls !== null || (boxes[j] as Box).newline) {
            next = boxes[j];
            break;
          }
        }
        if (next && !next.newline && next.cls && !NO_BREAK_BEFORE.has(next.cls)) {
          flush();
          out.push(el('wbr'));
          wraps = true;
        }
      }
    }
    if (!wraps) return { children: current, wraps: false };
    flush();
    return { children: out, wraps };
  }

  /** Liste d'atomes : rendu de chacun, puis espaces automatiques entre voisins. */
  private list(nodes: MathNode[], ctx: Ctx): Box[] {
    const classes = reclassify(nodes.map(atomClass));
    const script = ctx.style === 'script' || ctx.style === 'scriptscript';
    const boxes: Box[] = [];
    let prev: Box | null = null;
    for (let i = 0; i < nodes.length; i++) {
      const box = this.node(nodes[i] as MathNode, ctx);
      const c = classes[i] ?? null;
      box.cls = c;
      if (c !== null) {
        if (prev && prev.cls) {
          const space = spaceBetween(prev.cls, c, script);
          if (space) addClass(prev.node, SPACE_CLASS[space] as string);
        }
        prev = box;
      }
      boxes.push(box);
    }
    return boxes;
  }

  /** Contenu d'un argument (sans élément englobant inutile). */
  private content(node: MathNode, ctx: Ctx): Content {
    const list = node.type === 'group' && !node.cls ? node.body : [node];
    const boxes = this.list(list, ctx).filter((b) => !b.newline);
    let h = 0;
    let d = 0;
    for (const b of boxes) {
      h = Math.max(h, b.h);
      d = Math.max(d, b.d);
    }
    const last = boxes[boxes.length - 1];
    return {
      nodes: boxes.map((b) => b.node),
      h,
      d,
      italic: last?.italic === true,
      isChar: boxes.length === 1 && boxes[0]?.isChar === true,
    };
  }

  private node(node: MathNode, ctx: Ctx): Box {
    switch (node.type) {
      case 'symbol':
        return this.symbol(node);
      case 'group': {
        const boxes = this.list(node.body, ctx);
        const only = boxes[0];
        if (boxes.length === 1 && only && !only.newline) return only;
        return this.row(boxes, 'khw-mrow');
      }
      case 'frac':
        return this.frac(node, ctx);
      case 'sqrt':
        return this.sqrt(node, ctx);
      case 'scripts':
        return this.scripts(node, ctx);
      case 'op':
        return this.op(node, ctx);
      case 'fenced':
        return this.fenced(node, ctx);
      case 'middle':
        return { node: el('span', { class: 'khw-mo' }, [node.delim]), h: 0.74, d: 0.2, cls: null };
      case 'delim':
        return this.fixedDelim(node);
      case 'accent':
        return this.accent(node, ctx, null);
      case 'underover':
        return this.underover(node, ctx);
      case 'array':
        return this.array(node, ctx);
      case 'text': {
        const [h, d] = textMetrics(node.text, node.font === 'italic');
        return { node: el('span', { class: cls('khw-text', TEXT_FONT_CLASS[node.font]) }, [node.text]), h, d, cls: null };
      }
      case 'space':
        return this.space(node.width);
      case 'style':
        return this.style(node.style, node.body, ctx);
      case 'color': {
        const row = this.row(this.list(node.body, ctx), 'khw-color');
        setStyle(row.node, `color:${node.color}`);
        return row;
      }
      case 'phantom': {
        const c = this.content(node.body, ctx);
        return { node: el('span', { class: 'khw-phantom' }, c.nodes), h: c.h, d: c.d, cls: null };
      }
      case 'enclose':
        return this.enclose(node, ctx);
      case 'link': {
        const body = this.content(node.body, ctx);
        return { node: el('a', { class: 'khw-link', href: node.href, rel: 'noopener noreferrer' }, body.nodes), h: body.h, d: body.d, cls: null };
      }
      case 'ref': {
        const [h, d] = textMetrics(node.text, false);
        return {
          node: node.resolved
            ? el('a', { class: 'khw-ref', href: equationHref(node.target ?? '') }, [node.text])
            : el('span', { class: 'khw-ref khw-ref-missing', title: 'Référence inconnue' }, [node.text]),
          h,
          d,
          cls: null,
        };
      }
      // Les labels et tags sont traités à la racine par renderToTree : ils ne
      // doivent pas prendre de place lorsqu'ils apparaissent dans un tableau.
      case 'label':
      case 'tag':
      case 'notag':
        return { node: el('span', { class: 'khw-meta', 'aria-hidden': 'true' }), h: 0, d: 0, cls: null };
      case 'newline':
        return { node: el('br'), h: 0, d: 0, cls: null, newline: true };
      case 'error':
        return this.error(node);
    }
  }

  private row(boxes: Box[], className: string): Box {
    let h = 0;
    let d = 0;
    for (const b of boxes) {
      h = Math.max(h, b.h);
      d = Math.max(d, b.d);
    }
    const last = boxes[boxes.length - 1];
    return {
      node: el('span', { class: className }, boxes.filter((b) => !b.newline).map((b) => b.node)),
      h,
      d,
      cls: null,
      italic: last?.italic === true,
      ic: last?.ic ?? 0,
    };
  }

  // Symboles

  private symbol(node: SymbolNode): Box {
    let text = node.text;
    const classes: string[] = [];
    let italic = false;
    let tag = 'span';
    if (node.role === 'mo') {
      classes.push('khw-mo');
    } else {
      tag = node.role === 'mi' ? 'var' : 'span';
      if (node.role === 'mn') classes.push('khw-mn');
      const variant = node.variant;
      switch (variant) {
        case undefined:
          if (node.role === 'mi') {
            if ([...text].length === 1 && isItalicByDefault(text)) italic = true;
            else classes.push('khw-rm');
          }
          break;
        case 'normal':
          if (node.role === 'mi') classes.push('khw-rm');
          break;
        case 'italic':
          italic = true;
          if (node.role === 'mn') classes.push('khw-it');
          break;
        case 'bold':
          classes.push('khw-bf');
          break;
        case 'bold-italic':
          italic = true;
          classes.push('khw-bi');
          break;
        case 'double-struck':
        case 'script':
        case 'fraktur':
          text = toMathAlphabetString(text, variant);
          if (node.role === 'mi') classes.push('khw-rm');
          break;
        case 'sans-serif':
          classes.push('khw-sf');
          break;
        case 'monospace':
          classes.push('khw-tt');
          break;
      }
    }
    const [h, d] = textMetrics(text, italic);
    return {
      node: el(tag, { class: cls(...classes) }, [text]),
      h,
      d,
      cls: null,
      italic,
      ic: italic ? italicCorrection([...text].pop() ?? '') : 0,
      isChar: [...text].length === 1,
    };
  }

  private space(width: number): Box {
    const index = [0, 3 / 18, 4 / 18, 5 / 18].findIndex((w) => Math.abs(w - width) < 1e-6);
    if (index > 0) return { node: el('span', { class: SPACE_CLASS[index] }), h: 0, d: 0, cls: null };
    return { node: el('span', { class: 'khw-space', style: `margin-right:${fmt(width)}em` }), h: 0, d: 0, cls: null };
  }

  private style(target: MathStyle, body: MathNode[], ctx: Ctx): Box {
    const size = sizeClass(ctx.style, target);
    const r = ratio(ctx.style, target);
    const boxes = this.list(body, { style: target, cramped: ctx.cramped });
    const only = boxes[0];
    if (!size && boxes.length === 1 && only) return only;
    const row = this.row(boxes, cls('khw-mrow', size));
    row.h *= r;
    row.d *= r;
    return row;
  }

  // Fractions

  private frac(node: FracNode, ctx: Ctx): Box {
    const inner = FRACTION_OF[ctx.style];
    const size = sizeClass(ctx.style, inner);
    const r = ratio(ctx.style, inner);
    const num = this.content(node.num, { style: inner, cramped: ctx.cramped });
    const den = this.content(node.den, { style: inner, cramped: true });
    const display = ctx.style === 'display';
    const fenced = node.left !== undefined || node.right !== undefined;
    const gap = display ? 0.14 : 0.05; // --khw-frac-gap
    const frac = el(
      'span',
      { class: cls('khw-frac', display && 'khw-frac-d', !node.bar && 'khw-frac-nobar', fenced && 'khw-frac-fenced') },
      [el('span', { class: cls('khw-num', size) }, num.nodes), el('span', { class: cls('khw-den', size) }, den.nodes)],
    );
    const numHeight = (Math.max(LINE_ASCENT, num.h) + Math.max(LINE_DESCENT, num.d)) * r + gap;
    const denHeight = (Math.max(LINE_ASCENT, den.h) + Math.max(LINE_DESCENT, den.d)) * r + gap;
    const h = AXIS + RULE / 2 + numHeight;
    const d = denHeight + RULE / 2 - AXIS;
    if (fenced) return this.fence(node.left ?? '', node.right ?? '', [{ nodes: [frac], h, d }], [], true);
    return { node: frac, h, d, cls: null };
  }

  // Racines

  private sqrt(node: SqrtNode, ctx: Ctx): Box {
    const body = this.content(node.body, { style: ctx.style, cramped: true });
    const display = ctx.style === 'display';
    const gap = display ? 0.16 : 0.1; // padding-top de .khw-radicand
    const h = Math.max(LINE_ASCENT, body.h) + gap + RULE;
    const d = Math.max(LINE_DESCENT, body.d);
    const children: VNode[] = [];
    if (node.index) {
      const style: MathStyle = 'scriptscript';
      const r = ratio(ctx.style, style);
      const index = this.content(node.index, { style, cramped: false });
      children.push(
        el('span', { class: cls('khw-root', sizeClass(ctx.style, style)), style: `margin-bottom:${fmt((0.5 * (h + d)) / r)}em` }, index.nodes),
      );
    }
    children.push(surd(h + d));
    children.push(el('span', { class: cls('khw-radicand', display && 'khw-radicand-d') }, body.nodes));
    return { node: el('span', { class: 'khw-sqrt' }, children), h, d, cls: null };
  }

  // Exposants et indices

  private scripts(node: ScriptsNode, ctx: Ctx): Box {
    const base = node.base;
    if (base && base.type === 'op' && (base.limits === 'limits' || (base.limits === 'auto' && ctx.style === 'display'))) {
      return this.limits(this.op(base, ctx), node.sup, node.sub, ctx);
    }
    if (base && base.type === 'accent') {
      if (base.accent === 'overbrace' && node.sup && !node.sub) return this.accent(base, ctx, node.sup);
      if (base.accent === 'underbrace' && node.sub && !node.sup) return this.accent(base, ctx, node.sub);
    }
    const baseBox = base ? this.node(base, ctx) : { node: el('span', { class: 'khw-mrow' }), h: 0, d: 0, cls: null };
    const integral = base?.type === 'op' && base.symbol && INTEGRALS.has(base.name);
    return this.attachScripts(baseBox, node.sup, node.sub, ctx, integral);
  }

  private attachScripts(
    baseBox: Box,
    supNode: MathNode | undefined,
    subNode: MathNode | undefined,
    ctx: Ctx,
    integral: boolean,
  ): Box {
    const style = SCRIPT_OF[ctx.style];
    const size = sizeClass(ctx.style, style);
    const r = ratio(ctx.style, style);
    const sup = supNode ? this.content(supNode, { style, cramped: ctx.cramped }) : null;
    const sub = subNode ? this.content(subNode, { style, cramped: true }) : null;

    // Règle 18 de TeX : décalages minimaux, puis selon la base.
    let u = baseBox.isChar ? 0 : baseBox.h - SUP_DROP * r;
    let v = baseBox.isChar ? 0 : baseBox.d + SUB_DROP * r;
    let h = baseBox.h;
    let d = baseBox.d;
    const children: VNode[] = [baseBox.node];

    if (sup) {
      const minimum = ctx.cramped ? SUP_CRAMPED : ctx.style === 'display' ? SUP_DISPLAY : SUP_TEXT;
      u = Math.max(u, minimum, sup.d * r + X_HEIGHT / 4);
      h = Math.max(h, u + sup.h * r);
    }

    if (sup && !sub) {
      const kern = baseBox.ic ? `;margin-left:${fmt(baseBox.ic / r)}em` : '';
      children.push(el('sup', { class: size, style: `vertical-align:${fmt(u / r)}em${kern}` }, sup.nodes));
    } else if (sub && !sup) {
      v = Math.max(v, SUB_ALONE, sub.h * r - 0.8 * X_HEIGHT);
      d = Math.max(d, v + sub.d * r);
      children.push(el('sub', { class: cls(size, integral && 'khw-int-sub'), style: `vertical-align:${fmt(-v / r)}em` }, sub.nodes));
    } else if (sup && sub) {
      v = Math.max(v, SUB_WITH_SUP);
      const gap = u - sup.d * r - (sub.h * r - v);
      if (gap < 4 * RULE) v += 4 * RULE - gap;
      d = Math.max(d, v + sub.d * r);
      // Les deux sont empilés ; seul l'écart entre leurs lignes de base est à régler.
      const natural = Math.max(LINE_DESCENT, sup.d) + Math.max(LINE_ASCENT, sub.h);
      const margin = (u + v) / r - natural;
      children.push(
        el('span', { class: cls('khw-scripts', size), style: `vertical-align:${fmt(u / r)}em` }, [
          el('sup', { style: baseBox.ic ? `margin-left:${fmt(baseBox.ic / r)}em` : undefined }, sup.nodes),
          el('sub', { class: cls(integral && 'khw-int-sub'), style: `margin-top:${fmt(margin)}em` }, sub.nodes),
        ]),
      );
    }
    const kind = sup && sub ? 'khw-msubsup' : sup ? 'khw-msup' : 'khw-msub';
    return { node: el('span', { class: kind }, children), h, d, cls: null };
  }

  // Grands opérateurs et bornes

  private op(node: OpNode, ctx: Ctx): Box {
    if (node.symbol) {
      const display = ctx.style === 'display';
      const integral = INTEGRALS.has(node.name);
      const className = cls('khw-bigop', display && (integral ? 'khw-bigop-int' : 'khw-bigop-d'));
      let h = integral ? 0.73 : 0.78;
      let d = integral ? 0.23 : 0.25;
      if (display) {
        const scale = integral ? 2 : 1.4;
        const half = ((h + d) * scale) / 2;
        h = AXIS + half;
        d = half - AXIS;
      }
      return { node: el('span', { class: className }, [node.name]), h, d, cls: null };
    }
    const [h, d] = textMetrics(node.name, false);
    return { node: el('span', { class: 'khw-op' }, [node.name]), h, d, cls: null };
  }

  /** Bornes dessus-dessous (∑ en style display, lim, \overset...). */
  private limits(base: Box, supNode: MathNode | undefined, subNode: MathNode | undefined, ctx: Ctx): Box {
    const style = SCRIPT_OF[ctx.style];
    const size = sizeClass(ctx.style, style);
    const r = ratio(ctx.style, style);
    const over = supNode ? this.content(supNode, { style, cramped: ctx.cramped }) : null;
    const under = subNode ? this.content(subNode, { style, cramped: true }) : null;
    return this.stack(
      'khw-limits',
      base,
      over ? { node: el('span', { class: cls('khw-over', size) }, over.nodes), height: (Math.max(LINE_ASCENT, over.h) + Math.max(LINE_DESCENT, over.d)) * r + 0.1 } : null,
      under ? { node: el('span', { class: cls('khw-under', size) }, under.nodes), height: (Math.max(LINE_ASCENT, under.h) + Math.max(LINE_DESCENT, under.d)) * r + 0.12 } : null,
    );
  }

  /** Tableau à légendes : la base dans la cellule, le reste au-dessus et au-dessous. */
  private stack(
    className: string,
    base: Box,
    over: { node: VElement; height: number } | null,
    under: { node: VElement; height: number } | null,
  ): Box {
    const children: VNode[] = [];
    if (over) children.push(over.node);
    children.push(el('span', { class: 'khw-base' }, [base.node]));
    if (under) children.push(under.node);
    const top = Math.max(LINE_ASCENT, base.h);
    const bottom = Math.max(LINE_DESCENT, base.d);
    return {
      node: el('span', { class: cls('khw-stack', className) }, children),
      h: over ? top + over.height : base.h,
      d: under ? bottom + under.height : base.d,
      cls: null,
    };
  }

  // Délimiteurs

  private fenced(node: FencedNode, ctx: Ctx): Box {
    const segments: { nodes: VNode[]; h: number; d: number }[] = [];
    const middles: string[] = [];
    let current: MathNode[] = [];
    const close = (): void => {
      const boxes = this.list(current, ctx);
      let h = 0;
      let d = 0;
      for (const b of boxes) {
        h = Math.max(h, b.h);
        d = Math.max(d, b.d);
      }
      segments.push({ nodes: boxes.filter((b) => !b.newline).map((b) => b.node), h, d });
      current = [];
    };
    for (const child of node.body) {
      if (child.type === 'middle') {
        close();
        middles.push(child.delim);
      } else current.push(child);
    }
    close();
    return this.fence(node.left, node.right, segments, middles, false, true);
  }

  /**
   * Contenu entouré de délimiteurs. Contenu de hauteur ordinaire : simples
   * caractères. Contenu haut : délimiteurs étirés, symétriques autour de l'axe.
   */
  private fence(
    left: string,
    right: string,
    segments: { nodes: VNode[]; h: number; d: number }[],
    middles: string[],
    forceStretch: boolean,
    /** \left…\right : chaque segment reçoit .khw-lr, repère neutre pour les outils. */
    lr = false,
  ): Box {
    let h = 0;
    let d = 0;
    for (const s of segments) {
      h = Math.max(h, s.h);
      d = Math.max(d, s.d);
    }
    const small = !forceStretch && h <= 0.82 && d <= 0.3;
    const children: VNode[] = [];

    if (small) {
      const glyph = (c: string): void => {
        if (c) children.push(el('span', { class: 'khw-mo' }, [c]));
      };
      glyph(left);
      segments.forEach((s, i) => {
        if (lr) children.push(el('span', { class: 'khw-lr' }, s.nodes));
        else children.push(...s.nodes);
        if (i < middles.length) glyph(middles[i] ?? '');
      });
      glyph(right);
      return { node: el('span', { class: 'khw-mrow' }, children), h: Math.max(h, 0.74), d: Math.max(d, 0.2), cls: null };
    }

    const half = Math.max(h - AXIS, d + AXIS);
    const total = 2 * half + 0.1;
    const delim = (c: string): VNode => stretchyDelimiter(c, total) ?? el('span', { class: 'khw-delim khw-delim-glyph' }, [c]);
    children.push(delim(left));
    segments.forEach((s, i) => {
      const body = el('span', { class: cls('khw-fenced-body', lr && 'khw-lr') }, s.nodes);
      // Symétrie autour de l'axe : on complète le côté le plus court.
      const padTop = half - (s.h - AXIS);
      const padBottom = half - (s.d + AXIS);
      const pads: string[] = [];
      if (padTop > 0.03) pads.push(`padding-top:${fmt(padTop)}em`);
      if (padBottom > 0.03) pads.push(`padding-bottom:${fmt(padBottom)}em`);
      if (pads.length) body.attrs['style'] = pads.join(';');
      children.push(body);
      if (i < middles.length) children.push(delim(middles[i] ?? ''));
    });
    children.push(delim(right));
    return { node: el('span', { class: 'khw-fenced' }, children), h: AXIS + half + 0.05, d: half - AXIS + 0.05, cls: null };
  }

  /** \big( et consorts : hauteur fixe, centrée sur l'axe. */
  private fixedDelim(node: DelimNode): Box {
    const height = [0, 1.2, 1.8, 2.4, 3.0][node.size] ?? 1.2;
    const drawn = stretchyDelimiter(node.delim, height);
    if (!drawn) {
      return { node: el('span', { class: 'khw-mo' }, [node.delim]), h: 0.74, d: 0.2, cls: null };
    }
    addClass(drawn, 'khw-delim-fixed');
    setStyle(drawn, `height:${fmt(height)}em;vertical-align:${fmt(AXIS - height / 2)}em`);
    return { node: drawn, h: AXIS + height / 2, d: height / 2 - AXIS, cls: null };
  }

  // Accents et empilements

  private accent(node: AccentNode, ctx: Ctx, label: MathNode | null): Box {
    const body = this.content(node.body, { style: ctx.style, cramped: true });
    const baseBox: Box = {
      node: body.nodes.length === 1 && typeof body.nodes[0] !== 'string' ? (body.nodes[0] as VElement) : el('span', { class: 'khw-mrow' }, body.nodes),
      h: body.h,
      d: body.d,
      cls: null,
    };
    const top = Math.max(LINE_ASCENT, body.h);

    if (node.accent === 'overline' || node.accent === 'underline') {
      // Filet à 0,12 em de l'encre de la base (et non de sa boîte de ligne).
      const gap = 0.12;
      if (node.accent === 'overline') {
        const caption = el('span', { class: 'khw-over khw-mark', style: `margin-bottom:${fmt(Math.max(body.h, X_HEIGHT) + gap - top)}em` }, [
          el('span', { class: 'khw-rule-over' }),
        ]);
        const stacked = this.stack('khw-accent', baseBox, { node: caption, height: 0 }, null);
        stacked.h = Math.max(body.h, X_HEIGHT) + gap + RULE;
        return stacked;
      }
      const bottom = Math.max(LINE_DESCENT, body.d);
      const caption = el('span', { class: 'khw-under khw-mark', style: `margin-top:${fmt(body.d + gap - bottom)}em` }, [
        el('span', { class: 'khw-rule-under' }),
      ]);
      const stacked = this.stack('khw-accent', baseBox, null, { node: caption, height: 0 });
      stacked.d = body.d + gap + RULE;
      return stacked;
    }

    if (node.accent === 'overbrace' || node.accent === 'underbrace') {
      const over = node.accent === 'overbrace';
      const brace = el('span', { class: cls('khw-hbrace', over ? 'khw-hbrace-over' : 'khw-hbrace-under') }, [
        el('span'),
        el('span'),
        el('span'),
        el('span'),
      ]);
      const parts: VNode[] = [];
      let height = 0.35;
      if (label) {
        const style = SCRIPT_OF[ctx.style];
        const r = ratio(ctx.style, style);
        const c = this.content(label, { style, cramped: !over });
        const labelNode = el('span', { class: cls('khw-brace-label', sizeClass(ctx.style, style)) }, c.nodes);
        height += (Math.max(LINE_ASCENT, c.h) + Math.max(LINE_DESCENT, c.d)) * r;
        if (over) parts.push(labelNode, brace);
        else parts.push(brace, labelNode);
      } else parts.push(brace);
      const caption = el('span', { class: over ? 'khw-over' : 'khw-under' }, parts);
      return this.stack('khw-braced', baseBox, over ? { node: caption, height } : null, over ? null : { node: caption, height });
    }

    const arrow = ARROW_KIND[node.accent];
    if (arrow) {
      const mark = el('span', { class: `khw-harrow khw-harrow-${arrow}` });
      if (node.under) {
        return this.stack('khw-accent', baseBox, null, { node: el('span', { class: 'khw-under khw-mark' }, [mark]), height: 0.4 });
      }
      const caption = el('span', { class: 'khw-over khw-mark', style: `margin-bottom:${fmt(Math.max(body.h, X_HEIGHT) + 0.06 - top)}em` }, [mark]);
      return this.stack('khw-accent', baseBox, { node: caption, height: 0.4 }, null);
    }

    if (node.stretchy) {
      const d = WIDE_ACCENTS[node.accent] ?? WIDE_ACCENTS['hat'] ?? '';
      const svg = el(
        'svg',
        { xmlns: 'http://www.w3.org/2000/svg', class: 'khw-svg', viewBox: '0 0 1000 300', preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' },
        [el('path', { d })],
      );
      const caption = el('span', { class: 'khw-over khw-mark', style: `margin-bottom:${fmt(Math.max(body.h, X_HEIGHT) + 0.05 - top)}em` }, [
        el('span', { class: 'khw-wide' }, [svg]),
      ]);
      return this.stack('khw-accent', baseBox, { node: caption, height: 0.35 }, null);
    }

    if (node.accent === 'vec') {
      const caption = el('span', { class: cls('khw-over khw-mark', body.isChar && body.italic && 'khw-skew'), style: `margin-bottom:${fmt(Math.max(body.h, X_HEIGHT) + 0.07 - top)}em` }, [
        el('span', { class: 'khw-harrow khw-harrow-r khw-vec' }),
      ]);
      return this.stack('khw-accent', baseBox, { node: caption, height: 0.3 }, null);
    }

    // Accent étroit : le signe est dessiné pour se poser au-dessus d'une minuscule ;
    // on le remonte d'autant que la base dépasse la hauteur d'x.
    const raise = Math.max(0, body.h - X_HEIGHT);
    const mark = ACCENT_MARKS[node.accent] ?? '^';
    const caption = el(
      'span',
      { class: cls('khw-over khw-mark', body.isChar && body.italic && 'khw-skew'), style: `margin-bottom:${fmt(raise - top - LINE_DESCENT)}em` },
      [mark],
    );
    const stacked = this.stack('khw-accent', baseBox, { node: caption, height: 0 }, null);
    stacked.h = Math.max(body.h, raise + 0.68);
    return stacked;
  }

  private underover(node: UnderOverNode, ctx: Ctx): Box {
    const style = SCRIPT_OF[ctx.style];
    const size = sizeClass(ctx.style, style);
    const r = ratio(ctx.style, style);
    const over = node.over ? this.content(node.over, { style, cramped: ctx.cramped }) : null;
    const under = node.under ? this.content(node.under, { style, cramped: true }) : null;
    const base = node.base;
    const arrow = base.type === 'symbol' && base.stretchy ? ARROW_KIND[base.text] : undefined;
    const baseBox: Box = arrow
      ? { node: el('span', { class: `khw-harrow khw-harrow-${arrow} khw-xarrow` }), h: 0.5, d: 0, cls: null }
      : this.node(base, ctx);
    const caption = (c: Content, kind: 'khw-over' | 'khw-under'): { node: VElement; height: number } => ({
      node: el('span', { class: cls(kind, size, arrow && 'khw-xlabel') }, c.nodes),
      height: (Math.max(LINE_ASCENT, c.h) + Math.max(LINE_DESCENT, c.d)) * r + 0.1,
    });
    return this.stack(
      arrow ? 'khw-xstack' : 'khw-limits',
      baseBox,
      over ? caption(over, 'khw-over') : null,
      under ? caption(under, 'khw-under') : null,
    );
  }

  // Tableaux

  private array(node: ArrayNode, ctx: Ctx): Box {
    const cellStyle: MathStyle =
      node.kind === 'aligned' || node.kind === 'gathered'
        ? 'display'
        : node.kind === 'small'
          ? 'script'
          : ctx.style === 'display'
            ? 'text'
            : ctx.style;
    const size = sizeClass(ctx.style, cellStyle);
    const r = ratio(ctx.style, cellStyle);
    const columns = node.rows.reduce((m, row) => Math.max(m, row.length), 0);
    const rowGap = node.kind === 'aligned' || node.kind === 'gathered' ? 0.5 : node.kind === 'small' ? 0.1 : 0.2;
    let total = 0;

    const rows = node.rows.map((row, i) => {
      let rh = LINE_ASCENT;
      let rd = LINE_DESCENT;
      const cells: VNode[] = [];
      for (let j = 0; j < columns; j++) {
        let list = row[j] ?? [];
        // aligned : « &= » garde l'espace de la relation (comme le {} de TeX).
        if (node.kind === 'aligned' && j % 2 === 1 && list[0]) {
          const first = atomClass(list[0]);
          if (first === 'rel' || first === 'bin') list = [{ type: 'group', body: [] }, ...list];
        }
        const boxes = this.list(list, { style: cellStyle, cramped: false }).filter((b) => !b.newline);
        for (const b of boxes) {
          rh = Math.max(rh, b.h);
          rd = Math.max(rd, b.d);
        }
        const align = node.cols[j] ?? node.cols[node.cols.length - 1] ?? 'c';
        cells.push(
          el(
            'span',
            {
              class: cls(
                'khw-mtd',
                align === 'l' && 'khw-al',
                align === 'r' && 'khw-ar',
                node.colLines[j] === true && 'khw-vl',
                j === columns - 1 && node.colLines[columns] === true && 'khw-vr',
              ),
            },
            boxes.map((b) => b.node),
          ),
        );
      }
      total += (rh + rd + rowGap) * r;
      return el(
        'span',
        {
          class: cls(
            'khw-mtr',
            node.rowLines[i] === true && 'khw-hl',
            i === node.rows.length - 1 && node.rowLines[node.rows.length] === true && 'khw-hl-after',
          ),
        },
        cells,
      );
    });

    const table = el('span', { class: cls('khw-mtable', `khw-${node.kind}`, size) }, rows);
    const middle = X_HEIGHT / 2;
    const h = total / 2 + middle;
    const d = total / 2 - middle;
    if (node.left !== undefined || node.right !== undefined) {
      return this.fence(node.left ?? '', node.right ?? '', [{ nodes: [table], h, d }], [], true);
    }
    return { node: table, h, d, cls: null };
  }

  // Encadrements et erreurs

  private enclose(node: EncloseNode, ctx: Ctx): Box {
    const body = this.content(node.body, ctx);
    if (node.notation === 'box') {
      return { node: el('span', { class: 'khw-boxed' }, body.nodes), h: Math.max(LINE_ASCENT, body.h) + 0.3, d: Math.max(LINE_DESCENT, body.d) + 0.3, cls: null };
    }
    return { node: el('span', { class: `khw-${node.notation}` }, body.nodes), h: body.h, d: body.d, cls: null };
  }

  private error(node: ErrorNode): Box {
    if (node.source === '') {
      return { node: el('span', { class: 'khw-error khw-hole', 'data-khw-error': node.message }), h: 0.7, d: 0.1, cls: null };
    }
    return { node: el('span', { class: 'khw-error', 'data-khw-error': node.message }, [node.source]), h: 0.7, d: 0.2, cls: null };
  }
}
