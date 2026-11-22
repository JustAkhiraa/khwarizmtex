import { describe, expect, it } from 'vitest';
import type { MathNode } from '../src/ast/nodes';
import { walk } from '../src/ast/nodes';
import { parse } from '../src/render';

const ast = (s: string): MathNode[] => parse(s).ast;
const errorsOf = (s: string) => parse(s).errors.map((e) => e.message);
const noLoc = (nodes: MathNode[]): unknown => JSON.parse(JSON.stringify(nodes, (k, v) => (k === 'loc' ? undefined : v)));

describe('parseur', () => {
  it('lit une fraction', () => {
    expect(ast('\\frac{a}{b}')).toEqual([
      {
        type: 'frac',
        bar: true,
        num: { type: 'group', body: [{ type: 'symbol', role: 'mi', cls: 'ord', text: 'a', loc: { start: 6, end: 7 } }] },
        den: { type: 'group', body: [{ type: 'symbol', role: 'mi', cls: 'ord', text: 'b', loc: { start: 9, end: 10 } }] },
      },
    ]);
  });

  it('prend un seul caractère comme argument, comme la notation classique (\\frac12)', () => {
    const [frac] = ast('\\frac12');
    expect(frac).toMatchObject({ type: 'frac', num: { text: '1' }, den: { text: '2' } });
  });

  it('regroupe les chiffres d’un nombre décimal', () => {
    expect(ast('3.14')).toMatchObject([{ type: 'symbol', role: 'mn', text: '3.14' }]);
  });

  it('ne monte que le premier chiffre dans x^12', () => {
    const nodes = ast('x^12');
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ type: 'scripts', sup: { text: '1' } });
    expect(nodes[1]).toMatchObject({ text: '2' });
  });

  it('attache exposant et indice dans les deux ordres', () => {
    expect(noLoc(ast('x_i^2'))).toEqual(noLoc(ast('x^2_i')));
    expect(ast('x_i^2')[0]).toMatchObject({ type: 'scripts', sub: { text: 'i' }, sup: { text: '2' } });
  });

  it('transforme les primes en exposant', () => {
    expect(ast("f''(x)")[0]).toMatchObject({ type: 'scripts', sup: { type: 'symbol', text: '″' } });
    expect(ast("f'^2")[0]).toMatchObject({ type: 'scripts', sup: { type: 'group' } });
  });

  it('lit les grands opérateurs et \\limits', () => {
    expect(ast('\\sum_{i=1}^n')[0]).toMatchObject({ type: 'scripts', base: { type: 'op', name: '∑', limits: 'auto' } });
    expect(ast('\\int\\limits_0^1')[0]).toMatchObject({ base: { type: 'op', name: '∫', limits: 'limits' } });
    expect(ast('\\int_0^1')[0]).toMatchObject({ base: { limits: 'nolimits' } });
  });

  it('lit \\left ... \\middle ... \\right', () => {
    const [fenced] = ast('\\left\\{ x \\middle| x>0 \\right\\}');
    expect(fenced).toMatchObject({ type: 'fenced', left: '{', right: '}' });
    expect(fenced?.type === 'fenced' && fenced.body.some((n) => n.type === 'middle')).toBe(true);
  });

  it('lit les environnements avec leurs lignes et colonnes', () => {
    const [m] = ast('\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}');
    expect(m).toMatchObject({ type: 'array', kind: 'matrix', left: '(', right: ')', cols: ['c', 'c'] });
    expect(m?.type === 'array' && m.rows.length).toBe(2);
    const [a] = ast('\\begin{array}{c|l} a & b \\\\ \\hline c & d \\end{array}');
    expect(a).toMatchObject({ cols: ['c', 'l'], colLines: [false, true, false], rowLines: [false, true, false] });
  });

  it('ignore le \\\\ final d’un tableau', () => {
    const [m] = ast('\\begin{matrix} a \\\\ b \\\\ \\end{matrix}');
    expect(m?.type === 'array' && m.rows.length).toBe(2);
  });

  it('applique les polices et fusionne les mots en romain', () => {
    expect(ast('\\mathbb{R}')).toMatchObject([{ type: 'group', body: [{ type: 'symbol', text: 'R', variant: 'double-struck' }] }]);
    expect(ast('\\mathrm{max}')).toMatchObject([{ type: 'group', body: [{ text: 'max', variant: 'normal' }] }]);
  });

  it('lit le texte avec ses espaces et un retour aux maths', () => {
    const [t] = ast('\\text{si $x>0$ alors}');
    expect(t?.type).toBe('group');
    const texts: string[] = [];
    if (t) walk(t, (n) => n.type === 'text' && texts.push(n.text));
    expect(texts).toEqual(['si ', ' alors']);
  });

  it('accepte \\over comme en TeX', () => {
    expect(ast('{a \\over b}')[0]).toMatchObject({ type: 'group', body: [{ type: 'frac', bar: true }] });
  });

  it('lit \\not et les couleurs', () => {
    expect(ast('\\not=')[0]).toMatchObject({ text: '≠', cls: 'rel' });
    expect(ast('\\color{red} x')[0]).toMatchObject({ type: 'color', color: 'red' });
    expect(ast('\\textcolor[HTML]{FF8800}{x}')[0]).toMatchObject({ type: 'color', color: '#ff8800' });
  });

  it('lit les dimensions', () => {
    expect(ast('\\hspace{1.5em}')[0]).toEqual({ type: 'space', width: 1.5 });
    expect(ast('\\kern3mu')[0]).toEqual({ type: 'space', width: 3 / 18 });
  });

  it('conserve les étiquettes, tags et références dans l’arbre', () => {
    const nodes = ast('x=1\\tag{A}\\label{eq:x}');
    expect(nodes).toContainEqual({ type: 'tag', body: { type: 'group', body: [{ type: 'symbol', role: 'mi', cls: 'ord', text: 'A', loc: { start: 8, end: 9 } }] }, starred: false });
    expect(nodes.find((node) => node.type === 'label')).toMatchObject({ type: 'label', name: 'eq:x' });
    expect(ast('x\\tag*{A}')[1]).toMatchObject({ type: 'tag', starred: true });
    expect(parse('\\eqref{eq:x}', { references: { 'eq:x': 'A' } }).ast[0]).toMatchObject({ type: 'ref', text: '(A)', target: 'khw-eq-eq%3Ax', resolved: true });
  });
});

describe('récupération après erreur', () => {
  it('isole une commande inconnue et garde la suite', () => {
    const nodes = ast('\\foo + 1');
    expect(nodes[0]).toMatchObject({ type: 'error', source: '\\foo' });
    expect(nodes).toHaveLength(3);
    expect(errorsOf('\\foo')).toEqual(['Commande inconnue : \\foo']);
  });

  it('rend une fraction dont l’accolade n’est jamais fermée', () => {
    const [frac] = ast('\\frac{a}{b');
    expect(frac).toMatchObject({ type: 'frac', den: { type: 'group' } });
    expect(errorsOf('\\frac{a}{b')).toEqual(['Accolade « { » jamais fermée.']);
  });

  it('remplace un argument manquant par une case vide', () => {
    const [frac] = ast('\\frac{a}');
    expect(frac).toMatchObject({ type: 'frac', den: { type: 'error', source: '' } });
  });

  it('signale un exposant vide', () => {
    expect(ast('x^')[0]).toMatchObject({ type: 'scripts', sup: { type: 'error', source: '' } });
  });

  it('signale un double exposant et le rend quand même', () => {
    const [s] = ast('x^2^3');
    expect(s).toMatchObject({ type: 'scripts', base: { type: 'scripts' } });
    expect(errorsOf('x^2^3')[0]).toMatch(/Double exposant/);
  });

  it('referme un \\left sans \\right', () => {
    const [f] = ast('\\left( x');
    expect(f).toMatchObject({ type: 'fenced', left: '(', right: '' });
    expect(errorsOf('\\left( x')[0]).toMatch(/\\left sans \\right/);
  });

  it('signale une accolade fermante en trop', () => {
    expect(ast('a}b')).toMatchObject([{ text: 'a' }, { type: 'error', source: '}' }, { text: 'b' }]);
  });

  it('signale un environnement inconnu et affiche son contenu', () => {
    const nodes = ast('\\begin{foo} a & b \\end{foo}');
    expect(nodes[0]).toMatchObject({ type: 'group', body: [{ type: 'error' }, { type: 'array' }] });
  });

  it('signale un \\end qui ne correspond pas', () => {
    expect(errorsOf('\\begin{matrix} a \\end{pmatrix}')[0]).toMatch(/ne ferme pas/);
  });

  it('donne la position exacte de l’erreur', () => {
    const [e] = parse('x + \\oops').errors;
    expect(e).toEqual({ message: 'Commande inconnue : \\oops', start: 4, end: 9 });
  });

  it('lève une KhwarizmError avec throwOnError', () => {
    expect(() => parse('\\oops', { throwOnError: true })).toThrow(/Commande inconnue/);
  });

  it('signale une référence inconnue sans interrompre le rendu', () => {
    expect(parse('\\ref{absente}').errors[0]?.message).toBe('Référence inconnue : absente.');
  });
});
