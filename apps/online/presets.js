export const INITIAL_FORMULA =
  "\\int_{-\\infty}^{+\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}";
export const INITIAL_DOCUMENT =
  "## Une idée qui fait son chemin\n\nUne formule peut raconter beaucoup. Considérons un polynôme du second degré $ax^2 + bx + c = 0$.\n\n## Trouver les racines\n\nSon discriminant est $\\Delta = b^2 - 4ac$. Lorsque $\\Delta \\geq 0$, ses solutions sont :\n\n$$\nx_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}\\label{racines}\n$$\n\nL’équation $\\eqref{racines}$ nous donne les deux racines.\n\n- Si le discriminant est positif, les racines sont distinctes.\n- S’il est nul, les deux racines sont égales.\n\n## À vous de jouer\n\nModifiez une formule : son aperçu et ses références se mettent à jour.";

export const STRUCTURES = [
  { label: "Fraction", icon: "a⁄b", source: "\\frac{□}{□}" },
  { label: "Puissance", icon: "x²", source: "□^{□}" },
  { label: "Indice", icon: "xₙ", source: "□_{□}" },
  { label: "Racine", icon: "√", source: "\\sqrt{□}" },
  { label: "Somme", icon: "∑", source: "\\sum_{n=1}^{□} □" },
  { label: "Intégrale", icon: "∫", source: "\\int_{0}^{1} □\\,dx" },
  {
    label: "Matrice",
    icon: "(⁙)",
    source: "\\begin{pmatrix} □ & 0 \\\\ 0 & 1 \\end{pmatrix}",
  },
  { label: "Parenthèses", icon: "( )", source: "\\left( □ \\right)" },
  { label: "Pi", icon: "π", source: "\\pi" },
  { label: "Infini", icon: "∞", source: "\\infty" },
];
export const COMMANDS = [
  ["frac", "\\frac{□}{□}", "Fraction"],
  ["sqrt", "\\sqrt{□}", "Racine"],
  ["sum", "\\sum_{n=1}^{□} □", "Somme"],
  ["int", "\\int_{0}^{1} □\\,dx", "Intégrale"],
  ["lim", "\\lim_{x\\to 0} □", "Limite"],
  ["alpha", "\\alpha", "Alpha"],
  ["beta", "\\beta", "Bêta"],
  ["gamma", "\\gamma", "Gamma"],
  ["Delta", "\\Delta", "Delta"],
  ["theta", "\\theta", "Thêta"],
  ["pi", "\\pi", "Pi"],
  ["infty", "\\infty", "Infini"],
  ["text", "\\text{□}", "Texte"],
  ["mathbf", "\\mathbf{□}", "Gras"],
  ["mathbb", "\\mathbb{□}", "Ensembles"],
  ["vec", "\\vec{□}", "Vecteur"],
  ["label", "\\label{□}", "Étiquette"],
  ["eqref", "\\eqref{□}", "Référence"],
  ["boxed", "\\boxed{□}", "Encadrer"],
  ["begin", "\\begin{aligned} □ &= 0 \\end{aligned}", "Alignement"],
];
export const EXAMPLES = [
  {
    title: "L’intégrale de Gauss",
    category: "Analyse",
    source: INITIAL_FORMULA,
    symbol: "∫",
  },
  {
    title: "Les racines du second degré",
    category: "Algèbre",
    source: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
    symbol: "√",
  },
  {
    title: "L’identité d’Euler",
    category: "Nombres complexes",
    source: "e^{i\\pi} + 1 = 0",
    symbol: "e",
  },
  {
    title: "Une somme infinie",
    category: "Analyse",
    source: "\\sum_{n=1}^{\\infty}\\frac{1}{n^2} = \\frac{\\pi^2}{6}",
    symbol: "∑",
  },
  {
    title: "Une matrice",
    category: "Algèbre linéaire",
    source: "A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}",
    symbol: "A",
  },
  {
    title: "La formule du binôme",
    category: "Algèbre",
    source: "(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k}a^k b^{n-k}",
    symbol: "Σ",
  },
  {
    title: "Une limite remarquable",
    category: "Analyse",
    source: "\\lim_{x\\to 0}\\frac{\\sin x}{x} = 1",
    symbol: "ℓ",
  },
  {
    title: "Le théorème de Pythagore",
    category: "Géométrie",
    source: "a^2 + b^2 = c^2",
    symbol: "△",
  },
  {
    title: "Un système par cas",
    category: "Fonctions",
    source:
      "|x| = \\begin{cases}x & \\text{si }x\\geq 0 \\\\ -x & \\text{sinon}\\end{cases}",
    symbol: "{",
  },
  {
    title: "Un calcul aligné",
    category: "Algèbre",
    source:
      "\\begin{aligned}(a+b)^2 &= (a+b)(a+b) \\\\ &= a^2 + 2ab + b^2\\end{aligned}",
    symbol: "=",
  },
  {
    title: "Une fiche de cours",
    category: "Document",
    mode: "document",
    source: INITIAL_DOCUMENT,
    symbol: "▤",
  },
  {
    title: "Une note de physique",
    category: "Document",
    mode: "document",
    source:
      "## Énergie et mouvement\n\nPour un objet de masse $m$ se déplaçant à la vitesse $v$ :\n\n$$\nE_c = \\frac{1}{2}mv^2\\label{energie}\n$$\n\nLa relation $\\eqref{energie}$ relie son mouvement à son énergie cinétique.\n\n## Unités\n\n- La masse est exprimée en kilogrammes.\n- La vitesse est exprimée en mètres par seconde.\n- L’énergie est exprimée en joules.",
    symbol: "E",
  },
];
