/**
 * Macros intégrées : des raccourcis écrits avec les commandes ordinaires.
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

  // Notations usuelles : probabilités, algèbre, analyse.
  '\\abs': '\\left|#1\\right|',
  '\\norm': '\\left\\|#1\\right\\|',
  '\\set': '\\left\\{#1\\right\\}',
  '\\Set': '\\left\\{#1\\right\\}',
  '\\bra': '\\left\\langle #1\\right|',
  '\\ket': '\\left|#1\\right\\rangle',
  '\\braket': '\\left\\langle #1\\right\\rangle',
  '\\dv': '\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}',
  '\\pdv': '\\frac{\\partial #1}{\\partial #2}',
  '\\dddot': '\\overset{\\ldots}{#1}',
  '\\ddddot': '\\overset{\\ldots.}{#1}',
  '\\prescript': '{}^{#1}_{#2}#3',
  '\\indep': '\\mathrel{\\perp\\!\\!\\!\\perp}',
  '\\independent': '\\mathrel{\\perp\\!\\!\\!\\perp}',
  '\\Var': '\\operatorname{Var}',
  '\\Cov': '\\operatorname{Cov}',
  '\\Vect': '\\operatorname{Vect}',
  '\\Mat': '\\operatorname{Mat}',
  '\\Id': '\\operatorname{Id}',
  '\\card': '\\operatorname{card}',
  '\\rank': '\\operatorname{rank}',
  '\\supp': '\\operatorname{supp}',
  '\\diag': '\\operatorname{diag}',
  '\\Tr': '\\operatorname{Tr}',
  '\\tr': '\\operatorname{tr}',
  '\\rot': '\\operatorname{rot}',
  '\\curl': '\\operatorname{curl}',
  '\\grad': '\\operatorname{grad}',
  '\\divergence': '\\operatorname{div}',
  '\\sign': '\\operatorname{sign}',
  '\\rang': '\\operatorname{rg}',
  '\\Esp': '\\mathbb{E}',
  '\\Prob': '\\mathbb{P}',
  '\\reals': '\\mathbb{R}',
  '\\complexes': '\\mathbb{C}',
  '\\qed': '\\quad\\blacksquare',
  '\\QED': '\\quad\\blacksquare',

  // Divers.
  '\\degree': '^{\\circ}',
  '\\celsius': '\\,{}^{\\circ}\\mathrm{C}',
};
