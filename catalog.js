// Catalogue de commandes réellement prises en charge par le moteur.
const symbols = (words) =>
  words
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => ({ label: name, source: "\\" + name + " " }));
const templates = (rows) => rows.map(([label, source]) => ({ label, source }));
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
        "in notin ni subset supset subseteq supseteq subsetneq supsetneq emptyset varnothing cup cap setminus bigcup bigcap forall exists nexists neg land lor top bot vdash models aleph",
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
      ["Espace fin", "\\,"],
      ["Espace moyen", "\\;"],
      ["Grand espace", "\\quad"],
    ]),
  },
  {
    id: "physics",
    label: "Physique",
    items: templates([
      ["Deuxième loi de Newton", "\\vec{F}=m\\vec{a}"],
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
      ["Concentration molaire", "c=\\frac{n}{V}"],
      ["Quantité de matière", "n=\\frac{m}{M}"],
      [
        "Définition du pH",
        "\\mathrm{pH}=-\\log_{10}\\left[\\mathrm{H}_3\\mathrm{O}^{+}\\right]",
      ],
    ]),
  },
];
export const CATALOG = CATEGORIES.flatMap((group) =>
  group.items.map((item, index) => ({
    ...item,
    category: group.id,
    id: group.id + "-" + index,
  })),
);
export const normalizeSearch = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
export function searchCatalog(query, category = "all") {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return CATALOG.filter(
    (item) =>
      (category === "all" || item.category === category) &&
      terms.every((term) =>
        normalizeSearch(item.label + " " + item.source).includes(term),
      ),
  );
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
