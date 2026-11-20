import { describe, expect, it } from 'vitest';
import { renderToString } from '../src/render';

const html = (s: string, display = false) => renderToString(s, { output: 'html', displayMode: display });

describe('rendu HTML', () => {
  it('produit un DOM lisible, sans style pour les cas simples', () => {
    expect(html('\\frac{a}{b}')).toMatchInlineSnapshot(
      `"<span class="khw" data-latex="\\frac{a}{b}"><span class="khw-html" aria-hidden="true"><span class="khw-frac"><span class="khw-num khw-s70"><var>a</var></span><span class="khw-den khw-s70"><var>b</var></span></span></span></span>"`,
    );
  });

  it('applique les espaces de TeX : relation large, binaire moyen', () => {
    const out = html('a=b+c');
    expect(out).toContain('<var class="khw-thick">a</var>');
    expect(out).toContain('<span class="khw-mo khw-thick">=</span>');
    expect(out).toContain('<var class="khw-med">b</var>');
  });

  it('ne met pas d’espace autour d’un moins unaire', () => {
    const out = html('-x');
    expect(out).toContain('<span class="khw-mo">−</span><var>x</var>');
    expect(html('(-1)')).not.toContain('khw-med');
  });

  it('coupe la ligne après les relations et les opérateurs du premier niveau', () => {
    const out = html('a = b + c');
    expect(out).toContain('khw-wrap');
    expect(out.match(/<wbr>/g)).toHaveLength(2);
    // Rien à couper dans une fraction.
    expect(html('\\frac{a+b}{c}')).not.toContain('<wbr>');
  });

  it('ne coupe pas quand lineBreaks est faux', () => {
    expect(renderToString('a = b', { output: 'html', lineBreaks: false })).not.toContain('<wbr>');
  });

  it('agrandit les grands opérateurs en display et met les bornes dessus-dessous', () => {
    const out = html('\\sum_{i=1}^n i', true);
    expect(out).toContain('khw-bigop khw-bigop-d');
    expect(out).toContain('khw-stack khw-limits');
    expect(out).toContain('<span class="khw-over khw-s70">');
  });

  it('met les bornes en indice dans le texte', () => {
    const out = html('\\sum_{i=1}^n i');
    expect(out).toContain('khw-msubsup');
    expect(out).not.toContain('khw-limits');
  });

  it('dessine les délimiteurs étirés seulement quand le contenu est haut', () => {
    expect(html('\\left( x \\right)')).not.toContain('khw-fenced');
    const tall = html('\\left( \\frac{a}{b} \\right)', true);
    expect(tall).toContain('khw-fenced');
    expect(tall).toContain('khw-delim khw-delim-paren');
    expect(html('\\left[ \\frac{a}{b} \\right]', true)).toContain('khw-delim-lbrack');
  });

  it('rend une erreur discrète avec son explication', () => {
    expect(html('\\foo')).toContain('<span class="khw-error" data-khw-error="Commande inconnue : \\foo">\\foo</span>');
    expect(html('\\frac{a}')).toContain('khw-error khw-hole');
  });

  it('convertit les alphabets que le CSS ne sait pas produire', () => {
    expect(html('\\mathbb{R}\\mathcal{F}\\mathfrak{g}')).toContain('ℝ');
    expect(html('\\mathcal{F}')).toContain('ℱ');
    expect(html('\\mathfrak{g}')).toContain('𝔤');
  });

  it('ajoute le bouton copier sur demande', () => {
    const out = renderToString('x', { copyButton: true });
    expect(out).toContain('data-khw-copy="true"');
    expect(out).toContain('<button type="button" class="khw-copy"');
  });

  it('pose la classe display et garde la source', () => {
    const out = renderToString('x^2', { displayMode: true });
    expect(out.startsWith('<span class="khw khw-display" data-latex="x^2">')).toBe(true);
  });

  it('rend sans rien lever toute une série de formules courantes', () => {
    const formulas = [
      '\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt\\pi}{2}',
      '\\begin{cases} 1 & x>0 \\\\ 0 & \\text{sinon} \\end{cases}',
      '\\begin{aligned} a &= b \\\\ &= c \\end{aligned}',
      '\\overbrace{a+b}^{2} \\underbrace{c}_{1}',
      'A \\xrightarrow[b]{a} B',
      '\\binom{n}{k} \\sqrt[3]{x} \\vec{u} \\widehat{xyz} \\overline{AB}',
      '\\big( \\Big[ \\bigg\\{ \\Bigg\\langle',
      '\\boxed{x} \\cancel{y} \\phantom{z}',
    ];
    for (const f of formulas) {
      const out = renderToString(f, { displayMode: true });
      expect(out).not.toContain('khw-error');
    }
  });
});
