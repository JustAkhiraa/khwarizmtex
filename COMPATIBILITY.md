# Compatibilité LaTeX

Cette matrice décrit le comportement réellement testé par KhwarizmTeX 0.1.x.
Elle décrit un corpus testé et ses limites, pas une certification de conformité
typographique à TeX ou une validation par des lecteurs d'écran.

| État | Sens |
| --- | --- |
| Complet | Exemples usuels couverts par les tests ; ne signifie pas une conformité TeX exhaustive. |
| Partiel | Pris en charge avec des limites documentées. |
| Prévu | Hors du moteur actuel. Certaines approximations historiques sont précisées ci-dessous. |

## Structures

| Commande ou environnement | État | Notes |
| --- | --- | --- |
| `\frac`, `\dfrac`, `\tfrac`, `\binom`, `\over` | Complet | Fractions et coefficients binomiaux. |
| `\sqrt`, `\sqrt[n]` | Complet | Indice de racine pris en charge. |
| Exposants, indices, primes, `\limits` | Complet | Avec récupération d’erreurs. |
| `\left`, `\middle`, `\right`, `\big`…`\Bigg` | Complet | Délimiteurs extensibles pris en charge. |
| `matrix`, `pmatrix`, `bmatrix`, `cases`, `array` | Complet | `\hline` et traits de colonnes pour `array`. |
| `aligned`, `align`, `gathered`, `equation`, `split` | Partiel | Rendu multi-ligne ; pas de règles AMS spécialisées par ligne. |

## Numérotation et références

| Commande | État | Notes |
| --- | --- | --- |
| `\tag`, `\tag*` | Partiel | Un seul tag par formule, à droite en HTML ; dans l'expression en MathML. |
| `\label` | Complet | Ajoute une ancre stable `khw-eq-…` au rendu. |
| `\ref`, `\eqref` | Complet | Référence liée ; `renderAll()` résout les références avant et arrière. |
| `\notag`, `\nonumber` | Partiel | Désactivent le numéro automatique pour toute la formule ; un tag explicite reste prioritaire. |
| `\href`, `\url` | Partiel | Activation `trustLinks`, HTTP(S)/mailto/fragments seulement ; liens HTML complémentaires en sortie MathML. |

## Typographie et sémantique

| Famille | État | Notes |
| --- | --- | --- |
| Symboles, grec, relations, flèches, ensembles | Complet | 456 commandes de symboles et opérateurs. |
| `\mathbb`, `\mathcal`, `\mathfrak`, `\mathbf`, `\text` | Complet | Variantes Unicode et textes. |
| Accents, sur/sous-flèches, `\overset`, `\underset` | Complet | Versions extensibles incluses. |
| `\color`, `\textcolor` | Complet | Couleurs validées par liste blanche. |
| MathML | Partiel | Généré seul ou parallèlement au HTML ; certaines constructions dépendent du navigateur. |

## Hors périmètre actuel

| Fonctionnalité | État |
| --- | --- |
| Chimie `\ce` | Prévu |
| Unités `\SI`, `\qty` et dérivées physiques | Prévu |
| `\multicolumn` | Prévu |
| Polices mathématiques embarquées | STIX Two 2.13 b171, WOFF2 locales optionnelles, SIL OFL 1.1 |

`\hdashline` est actuellement traité comme `\hline` (trait plein). Les plugins
enregistrés restent globaux. Les appels à `renderAll()` ont des index indépendants :
éviter les mêmes labels dans plusieurs documents insérés sur une seule page.

Les tests `references.test.ts`, `links.test.ts` et `security.test.ts` couvrent
les ajouts documentaires, les protocoles et les garde-fous. Le corpus
`browser/render.spec.ts` vérifie géométrie et interactions sous Chromium,
Firefox, WebKit et WebKit mobile. Les captures ne sont pas encore comparées
pixel par pixel ; les lecteurs d'écran et la typographie exhaustive restent à valider.
