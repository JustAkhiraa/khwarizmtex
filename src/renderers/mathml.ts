/**
 * Moteur MathML Core.
 *
 * Sert de couche d'accessibilité (lecteurs d'écran, copier-coller sémantique)
 * sous le rendu HTML, ou de sortie principale (output: 'mathml').
 * Les variantes de police passent par les alphabets mathématiques Unicode,
 * comme le recommande MathML Core.
 */
import { atomClass, reclassify } from '../ast/classes';
import type { ArrayNode, MathNode, MathStyle, MathVariant, ScriptsNode, SymbolNode } from '../ast/nodes';
import { isItalicByDefault, toMathAlphabetString } from '../symbols/alphabets';
import { el, type VElement, type VNode } from './vnode';

export interface MathMLOptions {
  display: boolean;
  /** Source LaTeX, jointe en annotation (application/x-tex). */
  source: string;
}

const ACCENT_CHARS: Record<string, string> = {
  hat: '^',
  check: 'ˇ',
  tilde: '~',
  acute: '´',
  grave: '`',
  dot: '˙',
  ddot: '¨',
  breve: '˘',
  bar: '¯',
  vec: '→',
  mathring: '˚',
  overline: '‾',
  underline: '_',
  rightarrow: '→',
  leftarrow: '←',
  leftrightarrow: '↔',
  overbrace: '⏞',
  underbrace: '⏟',
};

const NOTATIONS: Record<string, string> = {
  box: 'box',
  cancel: 'updiagonalstrike',
  bcancel: 'downdiagonalstrike',
  xcancel: 'updiagonalstrike downdiagonalstrike',
};

const STYLE_ATTRS: Record<MathStyle, { displaystyle: string; scriptlevel: string }> = {
  display: { displaystyle: 'true', scriptlevel: '0' },
  text: { displaystyle: 'false', scriptlevel: '0' },
  script: { displaystyle: 'false', scriptlevel: '1' },
  scriptscript: { displaystyle: 'false', scriptlevel: '2' },
};

function em(v: number): string {
  return `${Math.round(v * 10000) / 10000}em`;
}

export function renderMathML(body: MathNode[], options: MathMLOptions): VElement {
  const content = list(body, options.display);
  const semantics = el('semantics', {}, [
    row(content),
    el('annotation', { encoding: 'application/x-tex' }, [options.source]),
  ]);
  return el(
    'math',
    {
      xmlns: 'http://www.w3.org/1998/Math/MathML',
      display: options.display ? 'block' : 'inline',
      class: 'khw-mathml',
    },
    [semantics],
  );
}

function row(nodes: VNode[]): VNode {
  if (nodes.length === 1 && nodes[0] !== undefined) return nodes[0];
  return el('mrow', {}, nodes);
}

/** Liste : les binaires sans opérande deviennent ordinaires (pas d'espace autour). */
function list(nodes: MathNode[], display: boolean): VNode[] {
  const classes = reclassify(nodes.map(atomClass));
  const out: VNode[] = [];
  nodes.forEach((node, i) => {
    const reclassified = node.type === 'symbol' && node.cls === 'bin' && classes[i] === 'ord';
    out.push(convert(node, display, reclassified));
    // Application de fonction invisible après sin, log... suivi d'un argument.
    if (node.type === 'op' && !node.symbol) {
      const next = nodes[i + 1];
      if (next && atomClass(next) !== 'rel' && atomClass(next) !== 'bin' && atomClass(next) !== 'punct') {
        out.push(el('mo', {}, ['⁡']));
      }
    }
  });
  return out;
}

function convertArg(node: MathNode, display: boolean): VNode {
  if (node.type === 'group' && !node.cls) return row(list(node.body, display));
  return convert(node, display, false);
}

function symbol(node: SymbolNode, unary: boolean): VElement {
  const variant: MathVariant | undefined = node.variant;
  let text = node.text;
  const attrs: Record<string, string | undefined> = {};
  if (variant && variant !== 'normal' && !(variant === 'italic' && node.role === 'mi')) {
    text = toMathAlphabetString(text, variant);
  }
  if (node.role === 'mi') {
    const single = [...text].length === 1;
    // Une lettre seule est italique d'office en MathML ; on le désactive au besoin.
    if (single && (variant === 'normal' || (variant === undefined && !isItalicByDefault(text)))) attrs['mathvariant'] = 'normal';
    return el('mi', attrs, [text]);
  }
  if (node.role === 'mn') return el('mn', {}, [text]);
  if (node.stretchy) attrs['stretchy'] = 'true';
  // Espacement de TeX : seules relations, binaires et ponctuations sont aérées.
  if (unary || node.cls === 'ord' || node.cls === 'open' || node.cls === 'close' || node.cls === 'inner') {
    attrs['lspace'] = '0';
    attrs['rspace'] = '0';
  }
  if (node.cls === 'open' || node.cls === 'close') attrs['stretchy'] = 'false';
  return el('mo', attrs, [text]);
}

function op(name: string, symbolic: boolean, movable: boolean): VElement {
  if (symbolic) return el('mo', { largeop: 'true', movablelimits: movable ? 'true' : 'false' }, [name]);
  return movable ? el('mo', { movablelimits: 'true', lspace: '0', rspace: '0' }, [name]) : el('mi', {}, [name]);
}

function scripts(node: ScriptsNode, display: boolean): VElement {
  const base = node.base;
  let baseNode: VNode = base ? convert(base, display, false) : el('mrow');
  let under = false;
  if (base && base.type === 'op') {
    const limits = base.limits === 'limits' || base.limits === 'auto';
    if (limits) {
      under = true;
      baseNode = op(base.name, base.symbol, base.limits === 'auto');
    }
  }
  if (base && base.type === 'accent' && (base.accent === 'overbrace' || base.accent === 'underbrace')) under = true;
  const sup = node.sup ? convertArg(node.sup, display) : null;
  const sub = node.sub ? convertArg(node.sub, display) : null;
  if (under) {
    if (sup && sub) return el('munderover', {}, [baseNode, sub, sup]);
    if (sup) return el('mover', {}, [baseNode, sup]);
    return el('munder', {}, [baseNode, sub ?? el('mrow')]);
  }
  if (sup && sub) return el('msubsup', {}, [baseNode, sub, sup]);
  if (sup) return el('msup', {}, [baseNode, sup]);
  return el('msub', {}, [baseNode, sub ?? el('mrow')]);
}

function fence(c: string, form: 'prefix' | 'postfix' | 'infix'): VElement | null {
  if (!c) return null;
  return el('mo', { fence: 'true', stretchy: 'true', symmetric: 'true', form }, [c]);
}

function array(node: ArrayNode, display: boolean): VNode {
  const aligned = node.kind === 'aligned' || node.kind === 'gathered';
  const columns = node.rows.reduce((m, r) => Math.max(m, r.length), 0);
  const names: Record<string, string> = { l: 'left', c: 'center', r: 'right' };
  const rows = node.rows.map((cells) =>
    el(
      'mtr',
      {},
      Array.from({ length: columns }, (_, j) => {
        const align = names[node.cols[j] ?? node.cols[node.cols.length - 1] ?? 'c'] ?? 'center';
        return el(
          'mtd',
          align === 'center' ? {} : { columnalign: align, style: `text-align:${align}` },
          [row(list(cells[j] ?? [], display || aligned))],
        );
      }),
    ),
  );
  const attrs: Record<string, string | undefined> = {};
  if (aligned) {
    attrs['displaystyle'] = 'true';
    attrs['rowspacing'] = '0.25em';
    if (node.kind === 'aligned') {
      attrs['columnspacing'] = Array.from({ length: Math.max(0, columns - 1) }, (_, j) => (j % 2 === 0 ? '0em' : '2em')).join(' ') || undefined;
    }
  }
  if (node.kind === 'small') attrs['scriptlevel'] = '1';
  if (node.colLines.some(Boolean)) {
    attrs['columnlines'] = node.colLines.slice(1, columns).map((l) => (l ? 'solid' : 'none')).join(' ') || undefined;
  }
  if (node.rowLines.some(Boolean)) {
    attrs['rowlines'] = node.rowLines.slice(1, node.rows.length).map((l) => (l ? 'solid' : 'none')).join(' ') || undefined;
  }
  const table = el('mtable', attrs, rows);
  if (node.left === undefined && node.right === undefined) return table;
  const children: VNode[] = [];
  const l = fence(node.left ?? '', 'prefix');
  const r = fence(node.right ?? '', 'postfix');
  if (l) children.push(l);
  children.push(table);
  if (r) children.push(r);
  return el('mrow', {}, children);
}

function convert(node: MathNode, display: boolean, unary: boolean): VNode {
  switch (node.type) {
    case 'symbol':
      return symbol(node, unary);
    case 'group': {
      const inner = row(list(node.body, display));
      if (!node.cls || node.cls === 'ord') return node.body.length === 1 ? inner : el('mrow', {}, [inner]);
      // \mathbin{...} et consorts : l'espacement suit la classe demandée.
      const spaces: Record<string, [string, string]> = {
        bin: ['0.2222em', '0.2222em'],
        rel: ['0.2778em', '0.2778em'],
        punct: ['0', '0.1667em'],
        op: ['0.1667em', '0.1667em'],
      };
      const sp = spaces[node.cls];
      if (!sp) return el('mrow', {}, [inner]);
      return el('mrow', {}, [el('mspace', { width: sp[0] }), inner, el('mspace', { width: sp[1] })]);
    }
    case 'frac': {
      const frac = el('mfrac', node.bar ? {} : { linethickness: '0' }, [convertArg(node.num, display), convertArg(node.den, display)]);
      if (node.left === undefined && node.right === undefined) return frac;
      const children: VNode[] = [];
      const l = fence(node.left ?? '', 'prefix');
      const r = fence(node.right ?? '', 'postfix');
      if (l) children.push(l);
      children.push(frac);
      if (r) children.push(r);
      return el('mrow', {}, children);
    }
    case 'sqrt':
      return node.index
        ? el('mroot', {}, [convertArg(node.body, display), convertArg(node.index, display)])
        : el('msqrt', {}, [convertArg(node.body, display)]);
    case 'scripts':
      return scripts(node, display);
    case 'op':
      return op(node.name, node.symbol, false);
    case 'fenced': {
      const children: VNode[] = [];
      const l = fence(node.left, 'prefix');
      if (l) children.push(l);
      for (const child of node.body) {
        if (child.type === 'middle') {
          children.push(el('mo', { fence: 'true', stretchy: 'true', symmetric: 'true', lspace: '0.05em', rspace: '0.05em' }, [child.delim]));
        } else children.push(...list([child], display));
      }
      const r = fence(node.right, 'postfix');
      if (r) children.push(r);
      return el('mrow', {}, children);
    }
    case 'middle':
      return el('mo', { stretchy: 'true' }, [node.delim]);
    case 'delim': {
      const size = em([0, 1.2, 1.8, 2.4, 3.0][node.size] ?? 1.2);
      if (!node.delim) return el('mspace', { width: '0.12em' });
      return el('mo', { minsize: size, maxsize: size, stretchy: 'true', symmetric: 'true', lspace: '0', rspace: '0' }, [node.delim]);
    }
    case 'accent': {
      const mark = ACCENT_CHARS[node.accent] ?? '^';
      const mo = el('mo', { stretchy: node.stretchy ? 'true' : 'false' }, [mark]);
      const body = convertArg(node.body, display);
      return node.under
        ? el('munder', { accentunder: 'true' }, [body, mo])
        : el('mover', { accent: 'true' }, [body, mo]);
    }
    case 'underover': {
      const base = convert(node.base, display, false);
      const over = node.over ? convertArg(node.over, display) : null;
      const under = node.under ? convertArg(node.under, display) : null;
      if (over && under) return el('munderover', {}, [base, under, over]);
      if (over) return el('mover', {}, [base, over]);
      return el('munder', {}, [base, under ?? el('mrow')]);
    }
    case 'array':
      return array(node, display);
    case 'text': {
      const variants: Record<string, string> = { bold: 'bold', italic: 'italic', monospace: 'monospace', 'sans-serif': 'sans-serif' };
      const v = variants[node.font];
      return el('mtext', v ? { mathvariant: v } : {}, [node.text]);
    }
    case 'space':
      return el('mspace', { width: em(node.width) });
    case 'style':
      return el('mstyle', STYLE_ATTRS[node.style], [row(list(node.body, node.style === 'display'))]);
    case 'color':
      return el('mstyle', { mathcolor: node.color }, [row(list(node.body, display))]);
    case 'phantom':
      return el('mphantom', {}, [convertArg(node.body, display)]);
    case 'enclose':
      return el('menclose', { notation: NOTATIONS[node.notation] ?? 'box' }, [convertArg(node.body, display)]);
    case 'newline':
      return el('mspace', { linebreak: 'newline' });
    case 'error':
      return el('merror', { title: node.message }, [el('mtext', {}, [node.source || '?'])]);
  }
}
