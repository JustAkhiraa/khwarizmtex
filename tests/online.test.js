import { describe, it, expect } from 'vitest';
import { parseDocument, inlineParts } from '../apps/online/document.js';
import { History, initialState, validateState, loadState, saveState, encodeFormula, decodeFormula } from '../apps/online/model.js';

describe('brouillons Online', () => {
  it('valide les deux modes sans conserver de propriétés supplémentaires', () => {
    const state = initialState();
    expect(validateState({ ...state, injected: true })).toEqual(state);
    expect(() => validateState({ ...state, formula: { source: 'x' } })).toThrow();
    expect(() => validateState({ ...state, mode: 'admin' })).toThrow();
    expect(() => validateState({ ...state, document: { title: 'x', source: 'x'.repeat(50001) } })).toThrow();
  });
  it('préserve une sauvegarde corrompue et signale les quotas', () => {
    const storage = { getItem: () => '{broken', setItem: () => { throw new Error('Quota'); } };
    expect(loadState(storage).warning).not.toBe('');
    expect(saveState(storage, initialState())).toBe(false);
    expect(saveState(undefined, initialState())).toBe(false);
  });
  it('groupe la frappe, annule et coupe la branche rétablie', () => {
    const history = new History({ title: '', source: 'a' });
    history.push({ title: '', source: 'ab' }, true, 1000);
    history.push({ title: '', source: 'abc' }, true, 1100);
    expect(history.move(-1).source).toBe('a');
    expect(history.move(1).source).toBe('abc');
    history.move(-1);
    history.push({ title: '', source: 'nouveau' });
    expect(history.canRedo).toBe(false);
    expect(history.move(-1).source).toBe('a');
  });
  it('borne la mémoire de l’historique', () => {
    const history = new History({ title: '', source: '' });
    for (let i = 0; i < 100; i++) history.push({ title: '', source: String(i) });
    expect(history.items.length).toBe(80);
  });
  it('partage des caractères Unicode sans serveur', () => {
    const formula = '\\text{énergie 🔬} = mc^2';
    expect(decodeFormula('#f=' + encodeFormula(formula))).toBe(formula);
    expect(decodeFormula('#khw-eq-test')).toBe(null);
    expect(() => decodeFormula('#f=***')).toThrow();
    expect(() => encodeFormula('x'.repeat(4001))).toThrow();
  });
});
describe('format Document', () => {
  it('reconnaît les titres, listes et blocs avec offsets', () => {
    const source = '## Titre\n\nTexte $x$.\n\n$$\nx^2\\label{a}\n$$\n\n- Une idée';
    const { blocks, diagnostics } = parseDocument(source);
    expect(blocks.map(b => b.type)).toEqual(['heading', 'paragraph', 'math', 'item']);
    expect(source.slice(blocks[2].start, blocks[2].start + blocks[2].text.length)).toBe('x^2\\label{a}');
    expect(diagnostics).toEqual([]);
  });
  it('conserve un bloc non fermé au lieu de perdre du texte', () => {
    const result = parseDocument('Bonjour\n\n$$\nx^2');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.blocks[1].text).toContain('x^2');
  });
  it('n’interprète pas le HTML et garde les dollars échappés', () => {
    const parts = inlineParts('Prix 5 \\$ ; $x$ <script>alert(1)</script>');
    expect(parts.filter(p => p.type === 'math').map(p => p.text)).toEqual(['x']);
    expect(parts[2].text).toContain('<script>');
  });
});
