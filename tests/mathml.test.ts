import { describe, expect, it } from 'vitest';
import { renderToString } from '../src/render';

const mathml = (s: string, display = false) => renderToString(s, { output: 'mathml', displayMode: display });

describe('rendu MathML', () => {
  it('produit du MathML Core avec la source en annotation', () => {
    expect(mathml('x^2')).toMatchInlineSnapshot(
      `"<span class="khw khw-mathml-only" data-latex="x^2"><math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" class="khw-mathml"><semantics><msup><mi>x</mi><mn>2</mn></msup><annotation encoding="application/x-tex">x^2</annotation></semantics></math></span>"`,
    );
  });

  it('balise fractions, racines et indices', () => {
    const out = mathml('\\frac{a}{\\sqrt[3]{b}} + x_i^2');
    expect(out).toContain('<mfrac><mi>a</mi><mroot><mi>b</mi><mn>3</mn></mroot></mfrac>');
    expect(out).toContain('<msubsup><mi>x</mi><mi>i</mi><mn>2</mn></msubsup>');
  });

  it('utilise les alphabets mathématiques Unicode', () => {
    expect(mathml('\\mathbb{R}')).toContain('<mi>ℝ</mi>');
    expect(mathml('\\mathbf{x}')).toContain('<mi>𝐱</mi>');
    expect(mathml('\\Gamma')).toContain('<mi mathvariant="normal">Γ</mi>');
  });

  it('met les bornes dessus-dessous avec movablelimits', () => {
    expect(mathml('\\sum_{i=1}^n', true)).toContain('<munderover><mo largeop="true" movablelimits="true">∑</mo>');
    expect(mathml('\\int_0^1')).toContain('<msubsup><mo largeop="true" movablelimits="false">∫</mo>');
  });

  it('ajoute l’application de fonction après sin', () => {
    expect(mathml('\\sin x')).toContain('<mi>sin</mi><mo>\u2061</mo><mi>x</mi>');
  });

  it('rend les délimiteurs extensibles', () => {
    expect(mathml('\\left( x \\right)')).toContain('<mo fence="true" stretchy="true" symmetric="true" form="prefix">(</mo>');
  });

  it('rend les tableaux alignés', () => {
    const out = mathml('\\begin{aligned} a &= b \\end{aligned}');
    expect(out).toContain('<mtable displaystyle="true"');
    expect(out).toContain('columnalign="right"');
  });

  it('enveloppe les erreurs dans merror', () => {
    expect(mathml('\\foo')).toContain('<merror title="Commande inconnue : \\foo"><mtext>\\foo</mtext></merror>');
  });

  it('enlève l’espace d’un moins unaire', () => {
    expect(mathml('-x')).toContain('<mo lspace="0" rspace="0">−</mo>');
    expect(mathml('a-x')).toContain('<mo>−</mo>');
  });

  it('accompagne le HTML par défaut, caché à l’œil', () => {
    const both = renderToString('x');
    expect(both).toContain('<span class="khw-html" aria-hidden="true">');
    expect(both).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" class="khw-mathml">');
  });

  it('conserve le tag dans la représentation sémantique', () => {
    expect(mathml('x\\tag{1}')).toContain('<mo fence="true" stretchy="false">(</mo><mn>1</mn><mo fence="true" stretchy="false">)</mo>');
    expect(mathml('x\\tag*{A}')).toContain('<mi>A</mi>');
  });
});
