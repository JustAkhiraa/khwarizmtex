import { describe, expect, it } from 'vitest';
import { findMath } from '../src/plugins/auto-render';
import { registerPlugin, registeredPlugins } from '../src/plugins/registry';
import { parse, renderToString } from '../src/render';
import { STYLESHEET } from '../src/styles/stylesheet';

describe('repérage des formules dans un texte', () => {
  it('trouve $...$, $$...$$, \\(...\\) et \\[...\\]', () => {
    expect(findMath('a $x$ b $$y$$ c \\(z\\) d \\[w\\]')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'math', latex: 'x', display: false, raw: '$x$' },
      { type: 'text', text: ' b ' },
      { type: 'math', latex: 'y', display: true, raw: '$$y$$' },
      { type: 'text', text: ' c ' },
      { type: 'math', latex: 'z', display: false, raw: '\\(z\\)' },
      { type: 'text', text: ' d ' },
      { type: 'math', latex: 'w', display: true, raw: '\\[w\\]' },
    ]);
  });

  it('laisse les prix en dollars tranquilles', () => {
    expect(findMath('entre 5 $ et 10 $ par mois')).toEqual([{ type: 'text', text: 'entre 5 $ et 10 $ par mois' }]);
    expect(findMath('coûte $5 et $10')).toEqual([{ type: 'text', text: 'coûte $5 et $10' }]);
  });

  it('ignore un \\$ échappé', () => {
    expect(findMath('prix : \\$5, formule $x$')).toEqual([
      { type: 'text', text: 'prix : \\$5, formule ' },
      { type: 'math', latex: 'x', display: false, raw: '$x$' },
    ]);
  });

  it('respecte les accolades ($ dans \\text)', () => {
    expect(findMath('$\\text{a $b$ c}$')).toEqual([
      { type: 'math', latex: '\\text{a $b$ c}', display: false, raw: '$\\text{a $b$ c}$' },
    ]);
  });

  it('trouve quand même la fin d’une formule à l’accolade jamais fermée', () => {
    expect(findMath('voir $\\frac{1}{x$ ici')).toEqual([
      { type: 'text', text: 'voir ' },
      { type: 'math', latex: '\\frac{1}{x', display: false, raw: '$\\frac{1}{x$' },
      { type: 'text', text: ' ici' },
    ]);
  });
});

describe('plugins', () => {
  it('ajoute macros et symboles', () => {
    registerPlugin({
      name: 'essai',
      macros: { '\\vect': '\\overrightarrow{#1}' },
      symbols: { '\\copie': { char: '⧉', class: 'rel', role: 'mo' } },
    });
    expect(registeredPlugins()).toContain('essai');
    expect(parse('\\vect{u}').ast[0]).toMatchObject({ type: 'accent', accent: 'rightarrow' });
    expect(parse('a \\copie b').ast[1]).toMatchObject({ type: 'symbol', text: '⧉', cls: 'rel' });
  });

  it('ajoute une commande à arguments', () => {
    registerPlugin({
      name: 'abs',
      functions: {
        '\\abs': (p, t) => ({ type: 'fenced', left: '|', right: '|', body: [p.parseArg(t)] }),
      },
    });
    expect(parse('\\abs{x}').ast[0]).toMatchObject({ type: 'fenced', left: '|', right: '|' });
  });

  it('refuse un nom de commande invalide', () => {
    expect(() => registerPlugin({ name: 'x', macros: { 'pas une commande': 'x' } })).toThrow(/nom de commande invalide/);
    expect(() => registerPlugin({ name: '' })).toThrow(/nom/);
  });
});

describe('feuille de style', () => {
  it('est préfixée : aucune règle ne vise la page hors des formules', () => {
    const selectors = STYLESHEET.replace(/@media[^{]*\{/g, '')
      .split('}')
      .map((rule) => rule.split('{')[0]?.trim() ?? '')
      .filter((s) => s && !s.startsWith('@'));
    for (const group of selectors) {
      for (const selector of group.split(',')) {
        expect(selector.trim()).toMatch(/^(\.khw|khwarizm-math)/);
      }
    }
  });

  it('n’appelle aucune ressource externe', () => {
    expect(STYLESHEET).not.toMatch(/url\(|@import|https?:/);
  });

  it('est embarquée dans le module de rendu', () => {
    expect(renderToString('x')).toContain('khw-html');
    expect(STYLESHEET.length).toBeGreaterThan(1000);
  });
});
