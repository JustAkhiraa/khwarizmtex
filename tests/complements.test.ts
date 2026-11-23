import { describe, expect, it } from 'vitest';
import { parse, renderToString } from '../src/index';
import { chemistry, scientificNumber, unitSource } from '../src/parser/science';

export const SOURCES = [
  '\\ce{2H2 + O2 -> 2H2O}', '\\ce{SO4^2-}', '\\ce{Na+ + Cl- <=> NaCl(s)}', '\\ce{A ->[\\Delta] B}', '\\ce{CuSO4*5H2O}', '\\ce{^{14}_{6}C}', '\\ce{Fe(OH)3 v}',
  '\\SI{9.81}{m/s^2}', '\\SI{3.0e8}{\\metre\\per\\second}', '\\qty{10}{kΩ}', '\\num{12345}', '\\ang{45}', '\\si{\\kilo\\watt\\hour}',
  '\\genfrac(){0pt}{}{n}{k}', '\\genfrac[]{1pt}{0}{a+b}{c}', '\\sideset{_a^b}{_c^d}\\sum', '\\cancelto{0}{x+1}', '\\DeclareMathOperator{\\foo}{foo} \\foo x',
  '\\DeclareMathOperator*{\\opt}{opt} \\opt_x', '\\begin{pmatrix*}[r] -1 & 2 \\\\ 3 & -40 \\end{pmatrix*}', '\\colorbox{yellow}{$x^2$ ok}', '\\fcolorbox{red}{yellow}{a}',
  '\\rule{2em}{0.1em}', '\\raisebox{0.5em}{haut}', 'a\\mathrlap{/}b', 'a\\mathllap{/}b', 'a\\mathclap{/}b', '\\sout{abc}', '\\longdiv{1234}', '\\enclose{longdiv}{12}',
  '\\root 3 \\of {x+1}', '\\cfrac[l]{1}{2+x}', '\\sfrac{1}{2}', '\\overbracket{a+b}', '\\underbracket{a+b}', '\\overparen{AB}', '\\underparen{AB}', '\\utilde{abc}',
  '\\begin{CD} A @>f>> B \\\\ @VgVV @VVhV \\\\ C @>>k> D \\end{CD}', '\\begin{CD} A @= B \\\\ @| @AAA \\\\ C @<<< D \\end{CD}',
  '\\begin{array}{r|l} 17 & 5 \\\\ \\hline 2 & 3 \\end{array}', '\\idotsint f', '\\varlimsup_n u_n', 'A\\nindep B', '\\curlyeqprec',
];
describe('compléments', () => {
  it.each(SOURCES)('rend %s sans erreur', (source) => {
    expect(parse(source).errors).toEqual([]);
    expect(renderToString(source)).not.toContain('khw-error');
  });
  it('traduit chimie, nombres et unités', () => {
    expect(chemistry('H2O')).toBe('\\mathrm{H}_{2}\\mathrm{O}');
    expect(chemistry('a;b')).toBeNull();
    expect(scientificNumber('3.0e8')).toBe('3{.}0\\times 10^{8}');
    expect(scientificNumber('abc')).toBeNull();
    expect(unitSource('m/s^2')).toBe('\\mathrm{m}/\\mathrm{s}^{2}');
    expect(unitSource('\\constructor')).toBeNull();
  });
  it.each(['\\ce{<script>}', '\\SI{x}{m}', '\\begin{CD} A @>f B \\end{CD}', '\\begin{CD} A', '\\rule{x}{1em}', '\\root 3 x', '\\enclose{constructor}{x}', '\\colorbox{red;x}{a}'])(
    'isole l’erreur de %s', (source) => { expect(parse(source).errors.length).toBeGreaterThan(0); },
  );
  it('borne les dimensions', () => {
    expect(renderToString('\\rule{99999em}{1em}')).not.toContain('width:99999em');
  });
});
