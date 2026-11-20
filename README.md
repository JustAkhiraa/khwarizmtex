# KhwarizmTeX

Moteur de rendu de formules LaTeX, en HTML/CSS et en MathML Core.

Synchrone, sans dépendance à l'exécution, utilisable côté serveur comme dans le navigateur. Rien n'est chargé depuis Internet : ni script, ni police, ni icône.

## Démarrer

Ouvrir `demo/index.html` d'un double-clic. La démo montre un éditeur en direct, le rendu HTML à côté du MathML natif du navigateur, et une galerie d'exemples.

Pour refaire la bibliothèque après une modification :

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

renderToElement('\\frac{a}{b}', document.getElementById('formule'));
const html = renderToString('e^{i\\pi} + 1 = 0', { displayMode: true });
```

`renderToString` sert au rendu serveur et à la génération statique : la chaîne est prête, aucun script n'est nécessaire à l'affichage, donc aucun clignotement.

`renderToElement` construit le DOM élément par élément. Il n'utilise jamais `innerHTML`.

### L'élément `<khwarizm-math>`

```html
<script src="khwarizmtex.global.js"></script>

<khwarizm-math>\sqrt{x^2 + y^2}</khwarizm-math>
<khwarizm-math display copy>\sum_{k=1}^{n} k = \frac{n(n+1)}{2}</khwarizm-math>
```

Attributs : `display` (formule centrée), `copy` (bouton copier), `latex` (source, prioritaire sur le texte). Le fichier autonome déclare l'élément et ajoute la feuille de style tout seul.

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
| `output` | `'htmlAndMathml'` | `'html'`, `'mathml'` ou les deux (MathML caché, pour les lecteurs d'écran) |
| `throwOnError` | `false` | Lever une `KhwarizmError` au lieu d'isoler l'erreur |
| `macros` | aucune | `{ '\\vect': '\\overrightarrow{#1}' }` |
| `maxExpand` | `1000` | Expansions de macros au plus, par formule |
| `maxDepth` | `128` | Profondeur d'imbrication au plus |
| `maxSize` | `20` | Taille maximale d'une espace explicite, en em |
| `lineBreaks` | `true` | Retour à la ligne permis après `=`, `+`, `−`, `,` |
| `copyButton` | `false` | Petit bouton « copier le LaTeX » au survol |
| `className` | aucune | Classe ajoutée à l'élément racine |

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
- 456 commandes de symboles et d'opérateurs : grec, opérateurs, relations, flèches, ensembles, logique.

## Erreurs

Une formule fautive s'affiche quand même. La partie en cause est soulignée d'une vague discrète ; sa cause s'affiche au survol, en français (« Commande inconnue : \foo », « Accolade « { » jamais fermée. »). Un argument manquant laisse une petite case en pointillés.

`parse(latex)` renvoie l'arbre et la liste des erreurs, avec leur position dans la source.

## Sécurité

- Aucun `eval`, aucun `innerHTML` : le DOM est construit nœud par nœud, la chaîne HTML est entièrement échappée.
- Les couleurs passent par une liste blanche (noms, `#rgb`, modèles `HTML`, `rgb`, `RGB`, `gray`) : aucune valeur libre n'atteint le CSS.
- Pas de liens, d'images ni de classes arbitraires.
- `maxExpand` arrête une macro qui s'appelle elle-même ; `maxDepth` arrête une imbrication excessive avant de saturer la pile.

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
├── ast/         Types de l'arbre, classes d'atomes et espacements de TeX
├── symbols/     Tables de symboles, alphabets mathématiques Unicode
├── renderers/   html.ts, mathml.ts, délimiteurs SVG, mesures
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

Mesures du 20 novembre 2026 sur ce Mac (Node 26) :

- 90 tests, tous verts (lexer, parseur, récupération d'erreurs, macros, sécurité, rendus HTML et MathML, plugins, feuille de style) ;
- environ 52 µs par formule, HTML et MathML ensemble ;
- fichier autonome : 30 Ko compressé ; feuille de style : 3,4 Ko compressée ;
- rendu comparé à l'œil dans les moteurs de Chrome et de Safari : positions identiques au sous-pixel près.

## Limites connues

- La police est celle du système (STIX Two sur Mac, Cambria sur Windows, Latin Modern ou Times ailleurs). Pour un rendu identique partout, il faudra embarquer une police mathématique libre dans `dist/`.
- Le moteur de Firefox n'a pas encore été vérifié à l'œil.
- Pas encore de `\tag`, de `\href`, ni de chimie (`\ce`).
