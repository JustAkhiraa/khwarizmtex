import { describe, expect, it } from 'vitest';
import { tokenize } from '../src/lexer/lexer';

const kinds = (s: string) => tokenize(s).map((t) => `${t.kind}:${t.text}`);

describe('lexer', () => {
  it('découpe commandes, groupes et indices', () => {
    expect(kinds('\\frac{a}{b}^2_i')).toEqual([
      'command:\\frac',
      'open:{',
      'char:a',
      'close:}',
      'open:{',
      'char:b',
      'close:}',
      'sup:^',
      'char:2',
      'sub:_',
      'char:i',
      'eof:',
    ]);
  });

  it('absorbe les espaces après un mot de contrôle, pas après un symbole de contrôle', () => {
    expect(kinds('\\alpha   x')).toEqual(['command:\\alpha', 'char:x', 'eof:']);
    expect(kinds('\\, x')).toEqual(['command:\\,', 'space: ', 'char:x', 'eof:']);
  });

  it('reconnaît les symboles de contrôle', () => {
    expect(kinds('\\{\\}\\\\\\ ')).toEqual(['command:\\{', 'command:\\}', 'command:\\\\', 'command:\\ ', 'eof:']);
  });

  it('ignore les commentaires jusqu’à la fin de la ligne', () => {
    expect(kinds('a % commentaire\n  b')).toEqual(['char:a', 'space: ', 'char:b', 'eof:']);
  });

  it('garde un caractère hors du plan de base en un seul jeton', () => {
    const tokens = tokenize('𝔸+x');
    expect(tokens[0]).toMatchObject({ kind: 'char', text: '𝔸', start: 0, end: 2 });
    expect(tokens[1]).toMatchObject({ kind: 'char', text: '+', start: 2 });
  });

  it('note les positions de chaque jeton', () => {
    const [frac, open] = tokenize('\\frac{');
    expect(frac).toMatchObject({ start: 0, end: 5 });
    expect(open).toMatchObject({ start: 5, end: 6 });
  });

  it('lit les paramètres de macro', () => {
    expect(kinds('#1#')).toEqual(['param:#1', 'param:#', 'eof:']);
  });

  it('reste linéaire sur une entrée longue', () => {
    const long = '\\alpha '.repeat(20000) + '{'.repeat(5000);
    const t0 = performance.now();
    const tokens = tokenize(long);
    expect(tokens.length).toBe(25001);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
