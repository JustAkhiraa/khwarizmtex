import { describe, expect, it } from 'vitest';
import { parse, renderToString } from '../src/index';

describe('notations de probabilités et d’usage courant', () => {
  it.each([
    '\\overline{A\\cup B}', 'P(A\\mid B)', 'A\\indep B', '\\mathds{1}_A', '\\Var(X)', '\\Cov(X,Y)',
    '\\pgcd(a,b)', '\\abs{x}', '\\norm{u}', '\\set{1,2}', '\\dv{f}{x}', '\\pdv{f}{x}', '\\overarc{AB}',
    '\\dddot{x}', '\\prescript{14}{6}{C}', '\\Alpha', '\\braket{u|v}', '\\mathbfit{x}',
  ])('accepte %s', (source) => {
    expect(parse(source).errors).toEqual([]);
    expect(renderToString(source)).toContain('khw');
  });
  it('laisse redéfinir une notation fournie', () => {
    expect(parse('\\newcommand{\\norm}[1]{N(#1)}\\norm{x}').errors).toEqual([]);
  });
});
