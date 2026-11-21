// Démo de KhwarizmTeX : JavaScript simple, aucune bibliothèque.
(function () {
  'use strict';
  var K = window.KhwarizmTeX;
  if (!K) {
    document.getElementById('startup-message').textContent = 'Le moteur KhwarizmTeX n’est pas chargé. Lancez npm run demo depuis le dossier du projet, puis ouvrez l’adresse locale indiquée. Aucun réglage de sécurité du navigateur n’a besoin d’être désactivé.';
    return;
  }

  var EXAMPLES = [
    { title: 'Second degré', tex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
    { title: 'Série', tex: '\\sum_{n=1}^{+\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}' },
    { title: 'Intégrale', tex: '\\int_0^1 x^n \\, dx = \\frac{1}{n+1}' },
    { title: 'Limite', tex: '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1' },
    { title: 'Matrice', tex: 'A = \\begin{pmatrix} a_{11} & a_{12} & a_{13} \\\\ a_{21} & a_{22} & a_{23} \\\\ a_{31} & a_{32} & a_{33} \\end{pmatrix}' },
    { title: 'Déterminant', tex: '\\det A = \\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc' },
    { title: 'Système', tex: '|x| = \\begin{cases} x & \\text{si } x \\geq 0 \\\\ -x & \\text{sinon} \\end{cases}' },
    { title: 'Calcul aligné', tex: '\\begin{aligned} (a+b)^2 &= (a+b)(a+b) \\\\ &= a^2 + 2ab + b^2 \\end{aligned}' },
    { title: 'Fractions emboîtées', tex: '\\cfrac{1}{1 + \\cfrac{1}{1 + \\cfrac{1}{1 + x}}}' },
    { title: 'Racines', tex: '\\sqrt[3]{x^3 + y^3} \\leq \\sqrt{x^2 + \\sqrt{y}}' },
    { title: 'Délimiteurs', tex: '\\left( \\frac{a}{b} \\right)^{2} \\left[ \\frac{x}{y} \\right] \\left\\{ \\frac{1}{2} \\right\\} \\left\\langle \\frac{u}{v} \\right\\rangle' },
    { title: 'Ensembles', tex: '\\{ x \\in \\R \\mid x^2 < 2 \\} \\subset \\left] -\\sqrt{2} ; \\sqrt{2} \\right[' },
    { title: 'Accents', tex: '\\vec{u} \\cdot \\vec{v} = \\|\\vec u\\| \\, \\|\\vec v\\| \\cos\\theta, \\quad \\hat{x}, \\bar{z}, \\dot{y}, \\tilde{n}' },
    { title: 'Accolades', tex: '\\underbrace{1 + 2 + \\cdots + n}_{n \\text{ termes}} = \\overbrace{\\frac{n(n+1)}{2}}^{\\text{Gauss}}' },
    { title: 'Flèches', tex: 'A \\xrightarrow[\\text{dérivée}]{f\'} B \\implies \\overrightarrow{AB} + \\overline{z}' },
    { title: 'Binôme', tex: '(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^k b^{n-k}' },
    { title: 'Polices', tex: '\\mathbb{N} \\subset \\mathbb{Z} \\subset \\mathbb{Q} \\subset \\mathbb{R}, \\quad \\mathcal{F}, \\mathfrak{g}, \\mathbf{v}, \\boldsymbol{\\alpha}' },
    { title: 'Couleur et barré', tex: '\\frac{\\cancel{3} \\times 5}{\\cancel{3} \\times 7} = \\textcolor{#2f6fde}{\\frac{5}{7}} \\quad \\boxed{E = mc^2}' },
    { title: 'Macro', tex: '\\newcommand{\\norme}[1]{\\left\\| #1 \\right\\|} \\norme{\\vec{u} + \\vec{v}} \\leq \\norme{\\vec u} + \\norme{\\vec v}' },
    { title: 'Erreurs isolées', tex: '\\frac{1}{x + \\inconnu} + \\sqrt{y^}' },
    { title: 'Retour à la ligne', tex: 'f(x) = a_0 + a_1 x + a_2 x^2 + a_3 x^3 + a_4 x^4 + a_5 x^5 + a_6 x^6 + a_7 x^7 + a_8 x^8' },
    { title: 'Tableau', tex: '\\begin{array}{c|cc} x & -\\infty & +\\infty \\\\ \\hline f(x) & 0 & 1 \\end{array}' },
  ];

  var source = document.getElementById('source');
  var display = document.getElementById('display');
  var copy = document.getElementById('copy');
  var width = document.getElementById('width');
  var widthValue = document.getElementById('width-value');
  var stageHtml = document.getElementById('stage-html');
  var stageMathml = document.getElementById('stage-mathml');
  var timing = document.getElementById('timing');
  var diagnostics = document.getElementById('diagnostics');
  var errorList = document.getElementById('error-list');

  function render() {
    var tex = source.value;
    var options = { displayMode: display.checked, copyButton: copy.checked };
    var t0 = performance.now();
    K.renderToElement(tex, stageHtml, options);
    var t1 = performance.now();
    K.renderToElement(tex, stageMathml, { displayMode: display.checked, output: 'mathml' });
    timing.textContent = 'Rendu en ' + (t1 - t0).toFixed(2).replace('.', ',') + ' ms';

    var errors = K.parse(tex).errors;
    errorList.replaceChildren();
    errors.forEach(function (e) {
      var li = document.createElement('li');
      var code = document.createElement('code');
      code.textContent = tex.slice(e.start, e.end) || '(vide)';
      li.append(e.message + ' ', code, ' (caractères ' + e.start + ' à ' + e.end + ')');
      errorList.appendChild(li);
    });
    diagnostics.hidden = errors.length === 0;
  }

  function setWidth() {
    var max = Number(width.max);
    var w = Number(width.value);
    var full = w >= max;
    stageHtml.style.maxWidth = full ? '' : w + 'px';
    widthValue.textContent = full ? '100 %' : w + ' px';
  }

  EXAMPLES.forEach(function (example, i) {
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    var title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = example.title;
    var math = document.createElement('span');
    math.className = 'card-math';
    K.renderToElement(example.tex, math, { displayMode: true });
    card.append(title, math);
    card.addEventListener('click', function () {
      source.value = example.tex;
      render();
      source.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('gallery').appendChild(card);
    if (i === 0) source.value = example.tex;
  });

  source.addEventListener('input', render);
  display.addEventListener('change', render);
  copy.addEventListener('change', render);
  width.addEventListener('input', setWidth);

  document.getElementById('theme').addEventListener('click', function () {
    var root = document.documentElement;
    var dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
  });

  K.enableCopy();
  K.autoRender(document.getElementById('prose'), { copyButton: true });
  render();
  setWidth();
  document.getElementById('startup').hidden = true;
})();
