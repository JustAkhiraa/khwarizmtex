# KhwarizmTeX

Un moteur tout neuf de rendu de formules mathématiques : soigné, rapide et sans dépendance.

Synchrone, sans dépendance à l'exécution, utilisable côté serveur comme dans le navigateur. Rien n'est chargé depuis Internet : ni script, ni police, ni icône.

## Démarrer

### KhwarizmTeX Online

`npm run online` lance l’atelier sur `http://127.0.0.1:4173/online/` : modes
Formule et Document, interface ordinateur/téléphone, sauvegarde locale,
autocomplétion, galerie, partage de formules et exports. Le mode Document
compose texte et maths ; ce n’est pas un compilateur de projets LaTeX complets.
Voir le [guide de l’atelier](apps/online/README.md).

`npm run build:online` prépare un site statique autonome dans `build/online/`,
prêt à héberger séparément sans créer un deuxième dépôt. Aucune publication automatique.

### Démo technique

Après installation des dépendances de développement, lancer `npm run demo`, puis ouvrir `http://127.0.0.1:4173/demo/` dans le navigateur. Cette commande reconstruit le moteur et sert la démo uniquement sur cet ordinateur, sans accès Internet. Arrêter avec Ctrl+C. Le port peut être changé avec la variable `KHW_DEMO_PORT`.

La démo montre un éditeur en direct, le rendu HTML/CSS à côté du rendu natif du navigateur, et une galerie d'exemples. L'ouverture directe de `demo/index.html` reste possible après compilation, mais dépend des règles du navigateur pour les fichiers locaux. Si la source, les aperçus et la galerie restent vides, utiliser l'adresse locale ci-dessus : un message de démarrage aide à distinguer un moteur absent, une erreur JavaScript et des scripts bloqués. Avec JavaScript désactivé, un message dédié s'affiche. Il n'est pas nécessaire de désactiver les protections de Safari.

Pour refaire la bibliothèque après une modification :

Le développement utilise Node 22.12+ ou Node 24+. Les fichiers distribués du
moteur restent utilisables à partir de Node 18.

```bash
npm install
```

```bash
npm run build
```

Le résultat est dans `dist/` : `index.js` (ESM), `index.cjs` (CommonJS), les types `.d.ts`, `khwarizm.css` et `khwarizmtex.global.js` (fichier autonome pour une balise `<script>`).

## Utilisation

### Une ligne de JavaScript

```js
import { renderToString, renderToElement } from 'khwarizmtex';
import 'khwarizmtex/khwarizm.css';
// Optionnel : mêmes polices locales que dans Online (SIL OFL 1.1).
import 'khwarizmtex/khwarizm-fonts.css';

renderToElement('\\frac{a}{b}', document.getElementById('formule'));
const html = renderToString('e^{i\\pi} + 1 = 0', { displayMode: true });
```

`renderToString` sert au rendu serveur et à la génération statique : la chaîne est prête, aucun script n'est nécessaire à l'affichage, donc aucun clignotement.

`renderToElement` construit le DOM élément par élément. Il n'utilise jamais `innerHTML`.

### Équations numérotées et références

`\tag` affiche un numéro à droite d'une équation affichée ; `\label` lui donne
une ancre et `\ref` / `\eqref` créent un lien interne. Pour un document complet,
utiliser `renderAll()` : les étiquettes sont indexées avant le rendu, donc une
référence peut viser une équation écrite plus loin.

```js
import { renderAll } from 'khwarizmtex';

const result = renderAll([
  '\\text{Voir }\\eqref{eq:energie}.',
  'E = mc^2\\label{eq:energie}',
], { displayMode: true });

const target = document.getElementById('formules');
result.html.forEach((html) => target.insertAdjacentHTML('beforeend', html));
// result.references === { 'eq:energie': '1' }
// result.errors : diagnostics par formule, dans le même ordre
```

Pour un rendu isolé, fournir les numéros connus :

```js
renderToString('\\text{Voir }\\eqref{eq:energie}.', {
  references: { 'eq:energie': 1 },
});
```

La numérotation automatique de `renderAll()` concerne les formules portant un
label et redémarre à 1 par appel. `\notag` et `\nonumber` la désactivent pour toute
la formule ; un tag explicite reste prioritaire. Plusieurs labels peuvent viser
une formule. Les doublons sont signalés et la première cible est conservée.
Un seul tag par formule est pris en charge : la numérotation AMS par ligne reste
à développer.

### Liens dans une formule

`\href` et `\url` nécessitent l'option `trustLinks: true`. Même activés, seuls
HTTP(S), mailto et les fragments locaux `#...` sont autorisés. Les URL relatives,
les identifiants intégrés à l'URL et les protocoles exécutables sont refusés.
Écrire `\%` pour un pourcentage encodé dans une URL TeX.

```js
renderToString('\\href{https://example.org/cours}{\\text{Le cours}}', {
  trustLinks: true,
});
```

Le texte d'un lien refusé reste lisible, accompagné d'un diagnostic. En sortie
combinée ou MathML, des liens HTML complémentaires deviennent visibles au focus
clavier ; le MathML conserve le contenu mathématique.

### L'élément `<khwarizm-math>`

```html
<script src="khwarizmtex.global.js"></script>

<khwarizm-math>\sqrt{x^2 + y^2}</khwarizm-math>
<khwarizm-math display copy>\sum_{k=1}^{n} k = \frac{n(n+1)}{2}</khwarizm-math>
```

Attributs : `display` (formule centrée), `copy` (bouton copier), `latex` (source de la formule, prioritaire sur le texte). Le fichier autonome déclare l'élément et ajoute la feuille de style tout seul.

### Toute une page

```js
import { autoRender } from 'khwarizmtex';
autoRender(document.body);
```

Remplace `$...$`, `$$...$$`, `\(...\)` et `\[...\]`. Un prix comme « 5 $ » reste du texte. Les balises `pre`, `code`, `textarea`, `script` et la classe `no-math` sont ignorées.

## Options

| Option | Par défaut | Rôle |
|---|---|---|
| `displayMode` | `false` | Formule centrée sur sa ligne |
| `output` | `'htmlAndMathml'` | `'html'`, `'mathml'` (balisage mathématique natif) ou les deux (le balisage natif reste caché, pour les lecteurs d'écran) |
| `throwOnError` | `false` | Lever une `KhwarizmError` au lieu d'isoler l'erreur |
| `macros` | aucune | `{ '\\vect': '\\overrightarrow{#1}' }` |
| `maxExpand` | `1000` | Expansions de macros au plus, par formule |
| `maxDepth` | `128` | Profondeur d'imbrication au plus |
| `maxLength` | `250000` | Longueur maximale de la source avant tokenisation, en unités UTF-16 |
| `maxSize` | `20` | Taille maximale d'une espace explicite, en em |
| `lineBreaks` | `true` | Retour à la ligne permis après `=`, `+`, `−`, `,` |
| `copyButton` | `false` | Petit bouton « copier la formule » au survol |
| `className` | aucune | Classe ajoutée à l'élément racine |
| `references` | aucune | Étiquettes déjà connues pour `\ref` et `\eqref` |
| `trustLinks` | `false` | Active les liens autorisés de `\href` et `\url` |

## Apparence

Toutes les règles CSS sont préfixées par `.khw` : rien ne déborde sur la page. Les réglages se posent sur n'importe quel parent, `:root` compris.

```css
:root {
  --khw-font-size: 1.1em;      /* taille des formules */
  --khw-color: inherit;        /* couleur (celle du texte par défaut) */
  --khw-accent: #2f6fde;       /* bouton copier, survol */
  --khw-error-color: #c2410c;  /* erreurs */
  --khw-line-height: 1.5;      /* interligne des formules centrées */
  --khw-rule-em: 0.05;         /* épaisseur des filets */
}
```

Les formules prennent la couleur du texte (`currentColor`) : le thème sombre fonctionne sans rien ajouter.

## Ce qui est pris en charge

- Fractions (`\frac`, `\dfrac`, `\tfrac`, `\cfrac`, `\binom`, `\over`), racines (`\sqrt`, `\sqrt[n]`).
- Exposants, indices, primes, grands opérateurs (`\sum`, `\int`, `\prod`...) avec `\limits` et `\nolimits`, fonctions (`\sin`, `\lim`, `\operatorname`).
- Délimiteurs extensibles : `\left`, `\middle`, `\right`, `\big` à `\Bigg`, pour ( ) [ ] { } | ‖ ⟨ ⟩ ⌊ ⌋ ⌈ ⌉ ⟦ ⟧.
- Environnements : `matrix`, `pmatrix`, `bmatrix`, `Bmatrix`, `vmatrix`, `Vmatrix`, `smallmatrix`, `cases`, `array` (avec `|` et `\hline`), `aligned`, `align`, `gathered`, `split`, `\substack`.
- Accents : `\hat`, `\vec`, `\bar`, `\dot`, `\tilde`... et leurs versions larges, `\overline`, `\underline`, `\overrightarrow`, `\overbrace`, `\underbrace`, `\xrightarrow`, `\overset`, `\underset`, `\stackrel`.
- Polices : `\mathbb`, `\mathcal`, `\mathfrak`, `\mathscr`, `\mathbf`, `\boldsymbol`, `\mathrm`, `\mathsf`, `\mathtt`, `\text` (avec `$...$` à l'intérieur et les accents `\'e`).
- Couleurs (`\color`, `\textcolor`), `\boxed`, `\cancel`, `\bcancel`, `\xcancel`, `\phantom`, espaces (`\,` `\;` `\quad` `\hspace`...).
- Macros : `\newcommand`, `\renewcommand`, `\providecommand`, `\def`, avec paramètre optionnel. Raccourcis intégrés : `\R`, `\N`, `\Z`, `\Q`, `\C`, `\iff`, `\implies`, `\pmod`...
- Équations structurées : `\tag`, `\tag*`, `\label`, `\ref`, `\eqref`, avec `renderAll()` pour les références dans un document complet.
- 456 commandes de symboles et d'opérateurs : grec, opérateurs, relations, flèches, ensembles, logique.

## Erreurs

Une formule fautive s'affiche quand même. La partie en cause est soulignée d'une vague discrète ; sa cause s'affiche au survol, en français (« Commande inconnue : \foo », « Accolade « { » jamais fermée. »). Un argument manquant laisse une petite case en pointillés.

`parse(source)` renvoie l'arbre et la liste des erreurs, avec leur position dans la source.

## Sécurité

- Aucun `eval`, aucun `innerHTML` : le DOM est construit nœud par nœud, la chaîne HTML est entièrement échappée.
- Les couleurs passent par une liste blanche (noms, `#rgb`, modèles `HTML`, `rgb`, `RGB`, `gray`) : aucune valeur libre n'atteint le CSS.
- Liens désactivés par défaut et protocoles limités après activation ; pas d'images ni de commandes de classes arbitraires.
- `maxExpand` arrête une macro qui s'appelle elle-même ; `maxDepth` arrête une imbrication excessive avant de saturer la pile.
- `maxLength` borne la source avant tokenisation. La profondeur de l'arbre final est également contrôlée.

## Plugins

```js
import { registerPlugin } from 'khwarizmtex';

registerPlugin({
  name: 'cours',
  macros: { '\\vect': '\\overrightarrow{#1}' },
  symbols: { '\\copie': { char: '⧉', class: 'rel', role: 'mo' } },
  functions: {
    '\\abs': (p, t) => ({ type: 'fenced', left: '|', right: '|', body: [p.parseArg(t)] }),
  },
});
```

## Architecture

```text
src/
├── lexer/       Analyse lexicale, caractère par caractère
├── macros/      Expansion des macros, garde-fou maxExpand
├── parser/      Parseur récursif descendant, commandes, environnements
├── ast/         Types de l'arbre, classes d'atomes et espacements
├── symbols/     Tables de symboles, alphabets mathématiques Unicode
├── renderers/   rendu HTML/CSS, balisage natif, délimiteurs SVG, mesures
├── styles/      khwarizm.css
├── plugins/     autoRender, <khwarizm-math>, copier, plugins
└── index.ts     API publique
```

Le rendu HTML place fractions, bornes et accents avec des tableaux CSS à légende : la ligne de base tombe exactement sur la barre de fraction ou sur la base, quel que soit le navigateur et quelle que soit la police. Les seules valeurs calculées (décalage des exposants, hauteur des délimiteurs) sont écrites en em.

## Vérifications

```bash
npm test
```

```bash
npm run bench
```

La [matrice de compatibilité](COMPATIBILITY.md) précise les limites et les tests
associés. La CI vérifie types, tests et build avec Node 22/24, puis teste les
artefacts ESM et CommonJS sans dépendances sous Node 18/20/22/24.

Pour les contrôles de géométrie et d'interaction dans Chromium, Firefox, WebKit
et WebKit au format mobile :

```bash
npx playwright install chromium firefox webkit
npm run test:browser
```

Le rapport local `playwright-report/` inclut des captures des formules et des
traces en cas d'échec. Ces tests ne remplacent pas une revue typographique ni des
essais sur appareil iOS réel. Les captures ne sont pas encore comparées pixel
par pixel à des images de référence.

Mesures historiques de la version initiale, le 20 novembre 2026 sur ce Mac (Node 26) :

- 90 tests, tous verts (lexer, parseur, récupération d'erreurs, macros, sécurité, les deux rendus, plugins, feuille de style) ;
- environ 52 µs par formule, les deux rendus ensemble ;
- fichier autonome : 30 Ko compressé ; feuille de style : 3,4 Ko compressée ;
- rendu comparé à l'œil dans les moteurs de Chrome et de Safari : positions identiques au sous-pixel près.

## Limites connues

- STIX Two est fournie localement via la feuille optionnelle `khwarizm-fonts.css`, activée dans la démo et Online. Sans cette feuille, les polices du système sont utilisées. L'utilisation d'une même police ne garantit pas un rendu strictement identique entre moteurs de navigateur ; les métriques HTML restent approximatives.
- Le corpus automatisé est limité ; la conformité typographique et les lecteurs d'écran restent à évaluer plus largement.
- Pas encore de chimie (`\ce`) ni de numérotation AMS par ligne.
