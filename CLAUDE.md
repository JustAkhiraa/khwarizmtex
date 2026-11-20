# CLAUDE.md — Khwarizm

## 1. Identité du projet
**Khwarizm** est un moteur de rendu mathématique moderne, open source et ultra-léger, inspiré du meilleur de KaTeX et MathJax ("Fusion++").
- **Objectif** : Rendre des formules LaTeX en **HTML/CSS haute précision** (prioritaire sur l'esthétique) et en **MathML Core natif** (accessibilité et sémantique), avec une ergonomie irréprochable.
- **Licence** : Propriété de l'auteur (licence définie dans `LICENSE`).

---

## 2. Philosophie & Principes directeurs
Dans la continuité de mes projets précédents (`bts-ciel-CFA-Insta` et `sakina`), ce dépôt suit des règles strictes :

- **Zéro dépendance runtime** : `dependencies: {}` obligatoire. Le moteur doit fonctionner 100 % en local et hors ligne, sans aucun CDN externe (ni pour le JS, ni pour les polices, ni pour les icônes).
- **Code propre et modulaire** : Architecture découpée par responsabilités claires. Pas de fichiers monolithiques géants, pas de sur-ingénierie inutile.
- **Ergonomie avant tout** : Chaque détail visuel compte (alignement optique, espacements, lisibilité, retour à la ligne propre sur mobile, bouton copier en un clic).
- **Sécurité par défaut** : Jamais d'`eval()`, jamais d'`innerHTML` non sécurisé. Protection stricte contre les boucles infinies (`maxExpand`) et l'imbrication excessive (`maxDepth`).

---

## 3. Stack Technique
- **Cœur du moteur** : TypeScript (`strict: true`, zéro `any`) compilé en JavaScript standard (ESM + CJS + types `.d.ts`) via `tsup` ou `Vite`.
- **Styles** : CSS pur moderne (variables CSS `--khw-*`, Flexbox/Grid, zéro préprocesseur lourd).
- **Tests** : `Vitest` (tests unitaires pour le Lexer, le Parser, l'AST, les macros, la sécurité et les snapshots de rendu).
- **Démo (`demo/`)** : HTML5, CSS3 et JavaScript Vanilla pur (aucun framework type React/Vue, aucun CDN).

---

## 4. Architecture du dépôt
```text
khwarizm/
├── src/
│   ├── lexer/          # Tokenisation caractère par caractère (zéro regex catastrophique)
│   ├── parser/         # Parseur récursif descendant -> AST strictement typé
│   ├── ast/            # Types et nœuds de l'arbre syntaxique
│   ├── macros/         # Expansion de macros (\newcommand) avec garde-fou maxExpand
│   ├── symbols/        # Tables de symboles (grec, opérateurs, flèches, logique, ensembles)
│   ├── renderers/
│   │   ├── html.ts     # Rendu HTML/CSS haute précision (DOM minimal et sémantique)
│   │   └── mathml.ts   # Rendu MathML Core natif
│   ├── styles/
│   │   └── khwarizm.css # Feuille de style isolée (classes préfixées .khw-*)
│   ├── plugins/        # autoRender (scan DOM) + Web Component <khwarizm-math>
│   └── index.ts        # Point d'entrée public
├── tests/              # Suite de tests Vitest miroir de src/
├── demo/               # Page de test interactive locale (HTML/CSS/JS Vanilla)
├── CLAUDE.md
└── README.md