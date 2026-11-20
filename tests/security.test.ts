import { describe, expect, it } from 'vitest';
import { parse, renderToString } from '../src/render';

describe('garde-fous', () => {
  it('arrête une macro récursive (maxExpand)', () => {
    const t0 = performance.now();
    const { ast, errors } = parse('\\def\\a{\\a}\\a');
    expect(performance.now() - t0).toBeLessThan(200);
    expect(ast).toMatchObject([{ type: 'error' }]);
    expect(errors[0]?.message).toMatch(/Trop d'expansions/);
  });

  it('arrête une croissance exponentielle', () => {
    const src = '\\def\\a{xx}\\def\\b{\\a\\a\\a\\a}\\def\\c{\\b\\b\\b\\b}\\def\\d{\\c\\c\\c\\c}\\def\\e{\\d\\d\\d\\d}\\def\\f{\\e\\e\\e\\e}\\f\\f\\f\\f\\f';
    const t0 = performance.now();
    const { errors } = parse(src, { maxExpand: 500 });
    expect(performance.now() - t0).toBeLessThan(300);
    expect(errors[0]?.message).toMatch(/Trop d'expansions/);
  });

  it('respecte un maxExpand réglé', () => {
    const src = '\\def\\x{y}' + '\\x'.repeat(20);
    expect(parse(src, { maxExpand: 10 }).errors[0]?.message).toMatch(/plus de 10/);
    expect(parse(src, { maxExpand: 50 }).errors).toEqual([]);
  });

  it('arrête une imbrication excessive (maxDepth) sans dépasser la pile', () => {
    const deep = '{'.repeat(100000) + 'x' + '}'.repeat(100000);
    const { ast, errors } = parse(deep);
    expect(ast).toMatchObject([{ type: 'error' }]);
    expect(errors[0]?.message).toMatch(/Imbrication trop profonde/);
    const fracs = '\\frac{'.repeat(5000) + '1' + '}{2}'.repeat(5000);
    expect(parse(fracs).errors[0]?.message).toMatch(/Imbrication trop profonde/);
  });

  it('lève la limite comme erreur avec throwOnError', () => {
    expect(() => parse('\\def\\a{\\a}\\a', { throwOnError: true })).toThrow(/Trop d'expansions/);
  });

  it('échappe le texte : aucune balise ne passe', () => {
    const html = renderToString('\\text{<script>alert(1)</script>} <img src=x onerror=alert(1)>');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).toContain('&lt;script&gt;');
  });

  it('échappe la source dans data-latex et dans l’annotation', () => {
    const html = renderToString('x" onmouseover="alert(1)');
    // Valeurs entre guillemets retirées, aucune balise ne doit porter d'attribut onmouseover.
    const tags = (html.match(/<[^>]+>/g) ?? []).map((tag) => tag.replace(/="[^"]*"/g, ''));
    expect(tags.some((tag) => tag.includes('onmouseover'))).toBe(false);
    expect(html).toContain('data-latex="x&quot; onmouseover=&quot;alert(1)"');
  });

  it('refuse une couleur qui tenterait une injection CSS', () => {
    for (const color of ['red;background:url(x)', 'expression(alert(1))', '#12345g', 'javascript:alert(1)']) {
      const html = renderToString(`\\textcolor{${color}}{x}`);
      expect(html).not.toMatch(/style="color:[^"]*(url|expression|javascript|;)/);
      expect(parse(`\\textcolor{${color}}{x}`).errors[0]?.message).toMatch(/Couleur inconnue/);
    }
  });

  it('borne les espaces géantes (maxSize)', () => {
    expect(parse('\\hspace{100000em}').ast[0]).toEqual({ type: 'space', width: 20 });
    expect(parse('\\kern-9999em', { maxSize: 5 }).ast[0]).toEqual({ type: 'space', width: -5 });
  });

  it('n’offre aucune commande de lien ou de code', () => {
    for (const cmd of ['\\href{javascript:alert(1)}{x}', '\\url{javascript:x}', '\\htmlClass{x}{y}', '\\includegraphics{x}']) {
      expect(parse(cmd).errors[0]?.message).toMatch(/Commande inconnue/);
    }
  });

  it('ne plante sur aucune entrée bizarre', () => {
    const weird = ['', '\\', '{', '}', '^', '_', '&', '#', '$', '\\left', '\\right)', '\\begin', '\\end{x}', '\\frac', '\\sqrt[', "'''", '\\\\', '%', '\u0000', '😀', '\\color', '\\not', '\\big'];
    for (const w of weird) expect(() => renderToString(w)).not.toThrow();
  });
});
