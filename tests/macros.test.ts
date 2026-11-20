import { describe, expect, it } from 'vitest';
import { parse } from '../src/render';

const same = (a: string, b: string, macros?: Record<string, string>) =>
  expect(JSON.stringify(stripLoc(parse(a, { macros }).ast))).toBe(JSON.stringify(stripLoc(parse(b).ast)));

function stripLoc(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (k, v) => (k === 'loc' ? undefined : v)));
}

describe('macros', () => {
  it('développe \\newcommand sans paramètre', () => {
    same('\\newcommand{\\E}{\\mathbb{E}} \\E[X]', '\\mathbb{E}[X]');
  });

  it('développe les paramètres #1, #2', () => {
    same('\\newcommand{\\pair}[2]{(#1, #2)} \\pair{a}{b}', '(a, b)');
  });

  it('gère un premier paramètre optionnel', () => {
    same('\\newcommand{\\norm}[2][2]{\\|#2\\|_{#1}} \\norm{x} \\norm[1]{y}', '\\|x\\|_{2} \\|y\\|_{1}');
  });

  it('accepte \\def', () => {
    same('\\def\\carre#1{#1^2} \\carre{x}', 'x^2');
  });

  it('prend les macros des options', () => {
    same('\\vect{u}', '\\overrightarrow{u}', { '\\vect': '\\overrightarrow{#1}' });
    same('\\RR', '\\mathbb{R}', { RR: '\\mathbb{R}' });
  });

  it('fournit \\R, \\N, \\dfrac...', () => {
    same('\\R', '\\mathbb{R}');
    same('\\dfrac{1}{2}', '{\\displaystyle\\frac{1}{2}}');
  });

  it('laisse redéfinir une macro intégrée avec \\newcommand', () => {
    same('\\newcommand{\\R}{\\mathcal{R}} \\R', '\\mathcal{R}');
  });

  it('refuse de redéfinir une primitive avec \\newcommand', () => {
    const { errors } = parse('\\newcommand{\\frac}{x}');
    expect(errors[0]?.message).toMatch(/existe déjà/);
  });

  it('accepte \\renewcommand sur une primitive', () => {
    same('\\renewcommand{\\sqrt}{S} \\sqrt', 'S');
  });

  it('signale un paramètre non déclaré', () => {
    expect(parse('\\newcommand{\\f}{#1}').errors[0]?.message).toMatch(/non déclaré/);
  });

  it('signale un argument manquant', () => {
    expect(parse('\\newcommand{\\f}[2]{#1#2} \\f{a}').errors[0]?.message).toMatch(/Argument 2 manquant/);
  });
});
