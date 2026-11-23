// Catalogue de commandes réellement prises en charge par le moteur.
// Noms français et synonymes : on retrouve un outil sans connaître sa commande.
// Le premier nom devient l'étiquette visible, les suivants servent à la recherche.
const FRENCH = {
  lt: "inférieur strict|plus petit que",
  gt: "supérieur strict|plus grand que",
  leq: "inférieur ou égal|plus petit ou égal|inferieur",
  geq: "supérieur ou égal|plus grand ou égal|superieur",
  leqslant: "inférieur ou égal incliné|inferieur",
  geqslant: "supérieur ou égal incliné|superieur",
  neq: "différent|non égal",
  equiv: "équivalent|congru|identique",
  approx: "environ égal|approximation|à peu près",
  sim: "équivalent asymptotique|tilde",
  propto: "proportionnel",
  ll: "très inférieur",
  gg: "très supérieur",
  perp: "perpendiculaire|orthogonal",
  parallel: "parallèle",
  therefore: "donc",
  because: "car|parce que",
  coloneqq: "défini par|définition",
  in: "appartient|élément de",
  notin: "n'appartient pas",
  subset: "inclus strictement|sous-ensemble",
  subseteq: "inclus|sous-ensemble",
  supset: "contient strictement",
  supseteq: "contient",
  emptyset: "ensemble vide|vide",
  varnothing: "ensemble vide rond|vide",
  cup: "union|réunion",
  cap: "intersection|inter",
  setminus: "privé de|différence d'ensembles",
  bigcup: "grande union|réunion",
  bigcap: "grande intersection",
  forall: "pour tout|quel que soit",
  exists: "il existe",
  nexists: "il n'existe pas",
  neg: "non logique|négation",
  land: "et logique",
  lor: "ou logique",
  rightarrow: "flèche droite|tend vers",
  leftarrow: "flèche gauche",
  leftrightarrow: "flèche double",
  Rightarrow: "implique|implication",
  Leftarrow: "est impliqué par|réciproque",
  Leftrightarrow: "équivalent|si et seulement si|équivalence",
  Longrightarrow: "implique long",
  Longleftrightarrow: "équivalence longue",
  mapsto: "associe|fonction flèche",
  pm: "plus ou moins",
  mp: "moins ou plus",
  times: "multiplié|fois|produit|croix",
  div: "divisé|division",
  cdot: "point multiplié|produit scalaire|fois",
  circ: "rond composée|composition",
  nabla: "nabla|gradient",
  partial: "d rond|dérivée partielle",
  infty: "infini",
  hbar: "h barre|constante de planck réduite",
  degree: "degré",
  complement: "complémentaire",
  nsubset: "non inclus strictement",
  nsubseteq: "non inclus",
  sqcup: "union disjointe|réunion disjointe",
  bigsqcup: "grande union disjointe",
  notni: "ne contient pas l'élément",
  prime: "prime|dérivée",
  ldots: "points de suspension",
  cdots: "points centrés",
  angle: "angle",
  triangle: "triangle",
};
const KEYWORDS = {
  "\\frac{□}{□}": "quotient division sur",
  "□^{□}": "carré cube exposant",
  "□_{□}": "indice bas",
  "\\sqrt{□}": "racine",
  "\\sqrt[□]{□}": "racine cubique",
  "\\sum_{n=1}^{□} □": "sigma série",
  "\\int_{0}^{1} □\\,dx": "primitive aire",
  "\\lim_{x\\to 0} □": "tend vers",
  "\\frac{d}{dx} □": "dériver dérivation",
  "\\frac{\\partial □}{\\partial x}": "dérivée d rond",
  "\\vec{□}": "flèche",
  "\\overrightarrow{□}": "vecteur AB flèche",
  "\\mathbb{N}": "entiers naturels",
  "\\mathbb{Z}": "entiers relatifs",
  "\\mathbb{Q}": "rationnels",
  "\\mathbb{R}": "réels ensemble réel",
  "\\mathbb{C}": "complexes",
  "\\left|□\\right|": "module",
  "\\begin{cases} □ & x\\geq 0 \\\\ □ & x<0 \\end{cases}": "accolade conditions",
};
const symbols = (words) =>
  words
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => {
      const [label, ...others] = (FRENCH[name] || name).split("|");
      return {
        label,
        source: "\\" + name + " ",
        keywords: [name, ...others].join(" "),
      };
    });
const templates = (rows) =>
  rows.map(([label, source, keywords]) => ({ label, source, keywords }));
export const CATEGORIES = [
  {
    id: "structures",
    label: "Structures",
    items: templates([
      ["Fraction", "\\frac{□}{□}"],
      ["Fraction imbriquée", "\\cfrac{1}{□}"],
      ["Puissance", "□^{□}"],
      ["Indice", "□_{□}"],
      ["Indice et puissance", "□_{□}^{□}"],
      ["Racine carrée", "\\sqrt{□}"],
      ["Racine n-ième", "\\sqrt[□]{□}"],
      ["Binôme", "\\binom{□}{□}"],
      ["Somme", "\\sum_{n=1}^{□} □"],
      ["Produit", "\\prod_{n=1}^{□} □"],
      ["Intégrale", "\\int_{0}^{1} □\\,dx"],
      ["Intégrale double", "\\iint_{D} □\\,dx\\,dy"],
      ["Intégrale triple", "\\iiint_{V} □\\,dV"],
      ["Intégrale de contour", "\\oint_{C} □\\,dz"],
      ["Limite", "\\lim_{x\\to 0} □"],
      ["Dérivée", "\\frac{d}{dx} □"],
      ["Dérivée partielle", "\\frac{\\partial □}{\\partial x}"],
      [
        "Système par cas",
        "\\begin{cases} □ & x\\geq 0 \\\\ □ & x<0 \\end{cases}",
      ],
      ["Calcul aligné", "\\begin{aligned} □ &= □ \\\\ &= □ \\end{aligned}"],
    ]),
  },
  {
    id: "greek",
    label: "Grec",
    items: symbols(
      "alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi omicron pi varpi rho varrho sigma varsigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega",
    ),
  },
  {
    id: "relations",
    label: "Relations",
    items: symbols(
      "lt gt leq geq neq equiv approx approxeq cong sim simeq propto ll gg prec succ preceq succeq perp parallel nparallel mid nmid doteq asymp leqslant geqslant lesssim gtrsim therefore because coloneqq",
    ),
  },
  {
    id: "sets",
    label: "Ensembles & logique",
    items: [
      ...templates(
        ["N", "Z", "Q", "R", "C", "P"].map((letter) => [
          "Ensemble " + letter,
          "\\mathbb{" + letter + "}",
        ]),
      ),
      ...symbols(
        "in notin ni subset supset subseteq supseteq subsetneq supsetneq emptyset varnothing cup cap setminus complement nsubset nsubseteq notni sqcup uplus bigcup bigcap bigsqcup forall exists nexists neg land lor top bot vdash models aleph",
      ),
    ],
  },
  {
    id: "arrows",
    label: "Flèches",
    items: [
      ...symbols(
        "rightarrow leftarrow leftrightarrow Rightarrow Leftarrow Leftrightarrow longrightarrow longleftarrow longleftrightarrow Longrightarrow Longleftarrow Longleftrightarrow mapsto longmapsto uparrow downarrow updownarrow nearrow searrow swarrow nwarrow rightleftharpoons leftrightharpoons hookrightarrow hookleftarrow leadsto",
      ),
      ...templates([
        ["Flèche annotée", "\\xrightarrow{□}"],
        ["Flèche annotée à gauche", "\\xleftarrow{□}"],
      ]),
    ],
  },
  {
    id: "functions",
    label: "Fonctions",
    items: [
      ..."sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh exp log ln lg arg det gcd max min sup inf dim ker"
        .split(" ")
        .map((name) => ({
          label: name,
          source: "\\" + name + "\\left(□\\right)",
        })),
      ...templates([
        ["Fonction personnalisée", "\\operatorname{□}\\left(□\\right)"],
        ["Valeur absolue", "\\left|□\\right|"],
        ["Norme", "\\left\\|□\\right\\|"],
      ]),
    ],
  },
  {
    id: "operators",
    label: "Opérateurs",
    items: symbols(
      "pm mp times div cdot ast star circ bullet oplus ominus otimes oslash odot nabla partial infty hbar ell Re Im degree prime ldots cdots vdots ddots triangle angle measuredangle",
    ),
  },
  {
    id: "accents",
    label: "Accents & vecteurs",
    items: templates([
      ["Vecteur", "\\vec{□}"],
      ["Vecteur long", "\\overrightarrow{□}"],
      ["Vecteur vers la gauche", "\\overleftarrow{□}"],
      ["Chapeau", "\\hat{□}"],
      ["Chapeau large", "\\widehat{□}"],
      ["Barre", "\\bar{□}"],
      ["Trait supérieur", "\\overline{□}"],
      ["Souligné", "\\underline{□}"],
      ["Tilde", "\\tilde{□}"],
      ["Tilde large", "\\widetilde{□}"],
      ["Point", "\\dot{□}"],
      ["Deux points", "\\ddot{□}"],
      ["Accolade inférieure", "\\underbrace{□}_{□}"],
      ["Accolade supérieure", "\\overbrace{□}^{□}"],
      ["Barrer", "\\cancel{□}"],
      ["Barrer vers une valeur", "\\cancelto{0}{□}", "simplifier"],
      ["Barrer à l’horizontale", "\\sout{□}", "rayer"],
      ["Arc sous", "\\underparen{□}"],
      ["Crochet supérieur", "\\overbracket{□}"],
      ["Crochet inférieur", "\\underbracket{□}"],
      ["Barrer en croix", "\\xcancel{□}"],
      ["Accent aigu", "\\acute{□}"],
      ["Accent grave", "\\grave{□}"],
    ]),
  },
  {
    id: "delimiters",
    label: "Délimiteurs",
    items: templates([
      ["Parenthèses", "\\left(□\\right)"],
      ["Crochets", "\\left[□\\right]"],
      ["Accolades", "\\left\\{□\\right\\}"],
      ["Chevrons", "\\left\\langle □\\right\\rangle"],
      ["Plancher", "\\left\\lfloor □\\right\\rfloor"],
      ["Plafond", "\\left\\lceil □\\right\\rceil"],
      ["Barres doubles", "\\left\\|□\\right\\|"],
    ]),
  },
  {
    id: "styles",
    label: "Texte & styles",
    items: templates([
      ["Texte", "\\text{□}"],
      ["Texte gras", "\\textbf{□}"],
      ["Texte italique", "\\textit{□}"],
      ["Maths grasses", "\\mathbf{□}"],
      ["Maths italiques", "\\mathit{□}"],
      ["Maths romaines", "\\mathrm{□}"],
      ["Sans empattement", "\\mathsf{□}"],
      ["Chasse fixe", "\\mathtt{□}"],
      ["Double barre", "\\mathbb{□}"],
      ["Calligraphie", "\\mathcal{□}"],
      ["Fraktur", "\\mathfrak{□}"],
      ["Symboles gras", "\\boldsymbol{□}"],
      ["Style display", "{\\displaystyle □}"],
      ["Style texte", "{\\textstyle □}"],
      ["Style indice", "{\\scriptstyle □}"],
      ["Style petit indice", "{\\scriptscriptstyle □}"],
      ["Encadré", "\\boxed{□}"],
      ["Fond coloré", "\\colorbox{yellow}{□}", "surligner"],
      ["Espace fin", "\\,"],
      ["Espace moyen", "\\;"],
      ["Grand espace", "\\quad"],
    ]),
  },
  {
    id: "probability",
    label: "Probabilités & stats",
    items: templates([
      ["Événement contraire", "\\overline{A}", "A barre complémentaire"],
      ["Union d’événements", "A\\cup B", "A ou B réunion"],
      ["Intersection d’événements", "A\\cap B", "A et B inter"],
      ["Différence d’événements", "A\\setminus B", "A privé de B"],
      ["Contraire d’une union", "\\overline{A\\cup B}=\\overline{A}\\cap\\overline{B}", "loi de Morgan"],
      ["Contraire d’une intersection", "\\overline{A\\cap B}=\\overline{A}\\cup\\overline{B}", "loi de Morgan"],
      ["Événements incompatibles", "A\\cap B=\\varnothing", "disjoints"],
      ["Probabilité", "P(□)"],
      ["Probabilité du contraire", "P\\left(\\overline{A}\\right)=1-P(A)", "A barre"],
      ["Probabilité d’une union", "P(A\\cup B)=P(A)+P(B)-P(A\\cap B)", "A ou B"],
      ["Probabilité conditionnelle", "P_{B}(A)=\\frac{P(A\\cap B)}{P(B)}", "sachant"],
      ["A sachant B", "P(A\\mid B)", "conditionnelle"],
      ["Indépendance", "P(A\\cap B)=P(A)\\times P(B)", "indépendants"],
      ["Symbole d’indépendance", "A\\indep B", "indépendants"],
      ["Probabilités totales", "P(B)=\\sum_{i=1}^{n}P(A_i)P_{A_i}(B)"],
      ["Formule de Bayes", "P_{B}(A)=\\frac{P_{A}(B)\\,P(A)}{P(B)}"],
      ["Factorielle", "□!"],
      ["Arrangements", "A_{n}^{k}=\\frac{n!}{(n-k)!}", "dénombrement"],
      ["Combinaisons", "\\binom{n}{k}=\\frac{n!}{k!(n-k)!}", "k parmi n dénombrement"],
      ["Espérance", "E(X)=\\sum_{i=1}^{n}x_i\\,p_i", "moyenne"],
      ["Variance", "V(X)=E\\left(X^2\\right)-E(X)^2"],
      ["Écart type", "\\sigma(X)=\\sqrt{V(X)}"],
      ["Covariance", "\\Cov(X,Y)=E(XY)-E(X)E(Y)"],
      ["Loi binomiale", "P(X=k)=\\binom{n}{k}p^{k}(1-p)^{n-k}"],
      ["Suit une loi binomiale", "X\\sim\\mathcal{B}(n,p)"],
      ["Loi de Poisson", "P(X=k)=\\frac{\\lambda^{k}}{k!}e^{-\\lambda}"],
      ["Suit une loi normale", "X\\sim\\mathcal{N}\\left(\\mu,\\sigma^{2}\\right)", "gauss"],
      ["Densité normale", "f(x)=\\frac{1}{\\sigma\\sqrt{2\\pi}}e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}", "gauss"],
      ["Loi exponentielle", "f(x)=\\lambda e^{-\\lambda x}"],
      ["Centrer et réduire", "Z=\\frac{X-\\mu}{\\sigma}", "centrée réduite"],
      ["Moyenne", "\\overline{x}=\\frac{1}{n}\\sum_{i=1}^{n}x_i", "x barre"],
      ["Intervalle de confiance", "\\left[\\overline{x}-1{,}96\\frac{\\sigma}{\\sqrt{n}}\\,;\\,\\overline{x}+1{,}96\\frac{\\sigma}{\\sqrt{n}}\\right]"],
      ["Corrélation", "r=\\frac{\\Cov(X,Y)}{\\sigma_X\\,\\sigma_Y}"],
      ["Indicatrice", "\\mathds{1}_{A}"],
    ]),
  },
  {
    id: "analysis",
    label: "Analyse",
    items: templates([
      ["Limite à l’infini", "\\lim_{x\\to +\\infty} □"],
      ["Limite à droite", "\\lim_{x\\to a^{+}} □"],
      ["Dérivée prime", "f'(x)"],
      ["Dérivée seconde", "f''(x)"],
      ["Dérivée de f par x", "\\dv{□}{□}"],
      ["Dérivée partielle de f par x", "\\pdv{□}{□}"],
      ["Évaluation en un point", "\\left.□\\right|_{x=0}"],
      ["Primitive entre bornes", "\\left[F(x)\\right]_{a}^{b}", "crochet"],
      ["Intégrale entre bornes", "\\int_{a}^{b} □\\,dx"],
      ["Intégrale impropre", "\\int_{-\\infty}^{+\\infty} □\\,dx"],
      ["Série infinie", "\\sum_{n=0}^{+\\infty} □"],
      ["Suite", "\\left(u_n\\right)_{n\\in\\mathbb{N}}"],
      ["Suite récurrente", "u_{n+1}=f(u_n)"],
      ["Développement limité", "f(x)=f(a)+f'(a)(x-a)+o(x-a)", "Taylor"],
      ["Équation différentielle", "y'+ay=b"],
      ["Transformée de Laplace", "F(p)=\\int_{0}^{+\\infty}f(t)e^{-pt}\\,dt"],
      ["Transformée en z", "X(z)=\\sum_{n=0}^{+\\infty}x_n z^{-n}"],
      ["Transformée de Fourier", "\\hat{f}(\\nu)=\\int_{-\\infty}^{+\\infty}f(t)e^{-2i\\pi\\nu t}\\,dt"],
      ["Série de Fourier", "a_0+\\sum_{n=1}^{+\\infty}\\left(a_n\\cos(n\\omega t)+b_n\\sin(n\\omega t)\\right)"],
      ["Intervalle ouvert", "\\left]□\\,;\\,□\\right["],
      ["Intervalle fermé", "\\left[□\\,;\\,□\\right]"],
      ["Intervalle d’entiers", "\\left\\llbracket □\\,;\\,□\\right\\rrbracket"],
      ["Application", "f:E\\to F,\\;x\\mapsto f(x)", "fonction"],
    ]),
  },
  {
    id: "algebra",
    label: "Algèbre & géométrie",
    items: templates([
      ["Discriminant", "\\Delta=b^2-4ac"],
      ["Solutions du second degré", "x=\\frac{-b\\pm\\sqrt{\\Delta}}{2a}", "racines"],
      ["Forme algébrique", "z=a+ib", "complexe"],
      ["Conjugué", "\\overline{z}", "z barre complexe"],
      ["Module d’un complexe", "\\left|z\\right|=\\sqrt{a^2+b^2}"],
      ["Forme exponentielle", "z=re^{i\\theta}", "complexe"],
      ["Argument", "\\arg(z)\\equiv\\theta\\pmod{2\\pi}"],
      ["Congruence", "a\\equiv b\\pmod{n}", "modulo"],
      ["PGCD", "\\pgcd(a,b)"],
      ["PPCM", "\\ppcm(a,b)"],
      ["Transposée", "{}^{t}A"],
      ["Matrice inverse", "A^{-1}"],
      ["Trace", "\\Tr(A)"],
      ["Vecteur colonne", "\\begin{pmatrix} □ \\\\ □ \\end{pmatrix}", "coordonnées"],
      ["Produit scalaire", "\\vec{u}\\cdot\\vec{v}"],
      ["Produit vectoriel", "\\vec{u}\\wedge\\vec{v}"],
      ["Norme d’un vecteur", "\\left\\|\\vec{u}\\right\\|"],
      ["Angle", "\\widehat{ABC}"],
      ["Arc", "\\overarc{AB}"],
      ["Perpendiculaires", "(AB)\\perp(CD)"],
      ["Parallèles", "(AB)\\parallel(CD)"],
      ["Division posée", "\\begin{array}{r|l} □ & □ \\\\ \\hline □ & □ \\end{array}", "potence"],
      ["Diagramme commutatif", "\\begin{CD} A @>f>> B \\\\ @VgVV @VVhV \\\\ C @>>k> D \\end{CD}"],
      ["Théorème de Pythagore", "BC^2=AB^2+AC^2"],
      ["Contraire logique", "\\overline{a\\cdot b}=\\overline{a}+\\overline{b}", "Boole Morgan a barre"],
      ["Ou exclusif", "a\\oplus b", "xor Boole"],
    ]),
  },
  {
    id: "physics",
    label: "Physique",
    items: templates([
      ["Deuxième loi de Newton", "\\vec{F}=m\\vec{a}"],
      ["Grandeur avec unité", "\\SI{9.81}{m/s^2}", "unités mesure"],
      ["Notation scientifique", "\\num{3.0e8}", "puissance de dix"],
      ["Énergie cinétique", "E_c=\\frac{1}{2}mv^2"],
      ["Énergie de masse", "E=mc^2"],
      ["Loi d’Ohm", "U=RI"],
      ["Puissance électrique", "P=UI"],
      ["Fréquence et période", "f=\\frac{1}{T}"],
      ["Onde", "v=\\lambda f"],
      ["Quantité de mouvement", "\\vec{p}=m\\vec{v}"],
      ["Gravitation", "F=G\\frac{m_1m_2}{r^2}"],
      ["Énergie du photon", "E=h\\nu"],
      ["Gaz parfait", "PV=nRT"],
    ]),
  },
  {
    id: "chemistry",
    label: "Chimie",
    items: templates([
      ["Eau", "\\mathrm{H}_2\\mathrm{O}"],
      ["Dioxyde de carbone", "\\mathrm{CO}_2"],
      ["Ion sodium", "\\mathrm{Na}^{+}"],
      ["Ion sulfate", "\\mathrm{SO}_4^{2-}"],
      ["Isotope carbone 14", "{}^{14}_{6}\\mathrm{C}"],
      [
        "Formation de l’eau",
        "2\\mathrm{H}_2+\\mathrm{O}_2\\rightarrow 2\\mathrm{H}_2\\mathrm{O}",
      ],
      [
        "Équilibre chimique",
        "\\mathrm{N}_2+3\\mathrm{H}_2\\rightleftharpoons 2\\mathrm{NH}_3",
      ],
      ["Équation chimique", "\\ce{2H2 + O2 -> 2H2O}", "réaction"],
      ["Ion en notation rapide", "\\ce{SO4^2-}", "chimie"],
      ["Concentration molaire", "c=\\frac{n}{V}"],
      ["Quantité de matière", "n=\\frac{m}{M}"],
      [
        "Définition du pH",
        "\\mathrm{pH}=-\\log_{10}\\left[\\mathrm{H}_3\\mathrm{O}^{+}\\right]",
      ],
    ]),
  },
];
// Identifiant durable : la famille et la source, pas la place dans la liste.
export const CATALOG = CATEGORIES.flatMap((group) =>
  group.items.map((item, index) => ({
    ...item,
    keywords: [item.keywords, KEYWORDS[item.source]].filter(Boolean).join(" "),
    category: group.id,
    id: group.id + ":" + item.source.trim(),
    legacyId: group.id + "-" + index,
  })),
);
export const normalizeSearch = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
/**
 * Cherche par nom français, synonyme, commande ou symbole affiché (`symbolOf`).
 * Les correspondances exactes passent devant les débuts de mot, puis le reste.
 */
export function searchCatalog(query, category = "all", symbolOf = () => "") {
  const raw = query.trim();
  const terms = normalizeSearch(raw).split(/\s+/).filter(Boolean);
  const scored = [];
  for (const item of CATALOG) {
    if (category !== "all" && item.category !== category) continue;
    const symbol = symbolOf(item);
    const names = [item.label, item.source.trim(), item.keywords, symbol];
    const text = normalizeSearch(names.join(" "));
    if (!terms.every((term) => text.includes(term))) continue;
    const whole = normalizeSearch(raw);
    let score = 2;
    if (
      (symbol && symbol === raw) ||
      names.some((name) => normalizeSearch(name || "") === whole) ||
      normalizeSearch(item.source.trim()) === "\\" + whole
    )
      score = 0;
    else if (text.split(/[\s{}\\]+/).some((word) => word.startsWith(terms[0] || "")))
      score = 1;
    scored.push({ item, score });
  }
  return scored.sort((a, b) => a.score - b.score).map((entry) => entry.item);
}
export function matrixSource(rows, columns, environment, cells) {
  if (
    !Number.isInteger(rows) ||
    rows < 1 ||
    rows > 6 ||
    !Number.isInteger(columns) ||
    columns < 1 ||
    columns > 6 ||
    !["pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "matrix"].includes(
      environment,
    )
  )
    throw new Error("Matrice invalide (de 1 à 6 lignes et colonnes).");
  const lines = [];
  for (let row = 0; row < rows; row++) {
    const values = [];
    for (let col = 0; col < columns; col++) {
      const value = String(cells[row * columns + col] ?? "").trim();
      if (value.length > 150 || /[&\r\n]|\\\\|\\(?:begin|end)\b/.test(value))
        throw new Error(
          "Une cellule ne peut pas contenir de séparateur de ligne ou de colonne.",
        );
      values.push(value || "□");
    }
    lines.push(values.join(" & "));
  }
  return (
    "\\begin{" +
    environment +
    "} " +
    lines.join(" \\\\ ") +
    " \\end{" +
    environment +
    "}"
  );
}
