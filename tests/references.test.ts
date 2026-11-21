import { describe, expect, it } from 'vitest';
import { parse, renderAll, renderToString } from '../src/render';
import { equationId, equationHref } from '../src/references';

describe('références de document', () => {
  it.each(['__proto__', 'constructor', 'toString', 'énergie:1', '\ud800'])('résout le label %s sans collision avec Object', (label) => {
    const result = renderAll(['\\eqref{' + label + '}', 'x\\label{' + label + '}'], { throwOnError: true });
    expect(result.references[label]).toBe('1');
    expect(result.errors).toEqual([[], []]);
    expect(decodeURIComponent(equationHref(equationId(label)).slice(1))).toBe(equationId(label));
  });

  it('ne résout pas une propriété héritée', () => {
    expect(parse('\\ref{constructor}', { references: {} }).errors).toHaveLength(1);
  });

  it('désactive la numérotation et ne consomme pas de numéro', () => {
    const result = renderAll(['x\\label{a}\\notag', 'y\\label{b}\\nonumber', 'z\\label{c}']);
    expect(result.references).toEqual({ c: '1' });
    expect(result.html[0]).not.toContain('khw-has-tag');
    expect(result.html[1]).not.toContain('khw-has-tag');
  });

  it('garde un tag explicite malgré notag et expose toutes les ancres', () => {
    const result = renderAll(['x\\tag{A}\\label{a}\\label{b}\\notag', '\\eqref{b}'], { throwOnError: true });
    expect(result.references).toEqual({ a: 'A', b: 'A' });
    expect(result.html[0]).toContain('id="khw-eq-a"');
    expect(result.html[0]).toContain('id="khw-eq-b"');
  });

  it('signale les doublons et garde la première cible', () => {
    const result = renderAll(['x\\label{a}', 'y\\tag{B}\\label{a}']);
    expect(result.references.a).toBe('1');
    expect(result.errors[1]?.[0]?.message).toMatch(/déjà définie/);
    expect(result.html[1]).not.toContain('id="khw-eq-a"');
    expect(() => renderAll(['x\\label{a}', 'y\\label{a}'], { throwOnError: true })).toThrow(/déjà définie/);
  });

  it('répète aussi les diagnostics pour les formules en cache', () => {
    expect(renderAll(['\\ref{absent}', '\\ref{absent}']).errors.map((e) => e.length)).toEqual([1, 1]);
  });

  it('signale plusieurs tags au lieu de prétendre les gérer par ligne', () => {
    expect(parse('x\\tag{1}\\\\y\\tag{2}').errors[0]?.message).toMatch(/Un seul/);
  });

  it('inclut le numéro automatique dans le MathML sans activer la grille HTML', () => {
    const out = renderAll(['x\\label{a}'], { output: 'mathml', displayMode: true }).html[0];
    expect(out).toContain('<mtext>1</mtext>');
    expect(out).not.toContain('khw-has-tag');
  });

  it('rend le HTML seul accessible', () => {
    expect(renderToString('x', { output: 'html' })).not.toContain('aria-hidden');
  });
});
