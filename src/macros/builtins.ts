/**
 * Macros intégrées : des raccourcis écrits en LaTeX ordinaire.
 *
 * Elles se redéfinissent librement avec \newcommand (on ne bloque que les
 * commandes primitives comme \frac).
 */
export const BUILTIN_MACROS: Record<string, string> = {
  // Ensembles de nombres, très courants dans les cours.
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\R': '\\mathbb{R}',
  '\\C': '\\mathbb{C}',

  // Implications.
  '\\iff': '\\;\\Longleftrightarrow\\;',
  '\\implies': '\\;\\Longrightarrow\\;',
  '\\impliedby': '\\;\\Longleftarrow\\;',

  // Fractions et coefficients binomiaux à style imposé.
  '\\dfrac': '{\\displaystyle\\frac{#1}{#2}}',
  '\\tfrac': '{\\textstyle\\frac{#1}{#2}}',
  '\\cfrac': '{\\displaystyle\\frac{#1}{#2}}',
  '\\dbinom': '{\\displaystyle\\binom{#1}{#2}}',
  '\\tbinom': '{\\textstyle\\binom{#1}{#2}}',

  // Congruences.
  '\\pmod': '\\quad(\\operatorname{mod}\\ #1)',
  '\\pod': '\\quad(#1)',
  '\\bmod': '\\mathbin{\\mathrm{mod}}',
  '\\mod': '\\quad\\operatorname{mod}\\,\\,#1',

  // Opérateurs nommés.
  '\\argmax': '\\operatorname*{arg\\,max}',
  '\\argmin': '\\operatorname*{arg\\,min}',

  // Points de suspension.
  '\\dots': '\\ldots',
  '\\dotsc': '\\ldots',
  '\\dotso': '\\ldots',
  '\\dotsb': '\\cdots',
  '\\dotsm': '\\cdots',
  '\\dotsi': '\\!\\cdots',
  '\\hdots': '\\ldots',

  // Divers.
  '\\degree': '^{\\circ}',
  '\\celsius': '\\,{}^{\\circ}\\mathrm{C}',
};
