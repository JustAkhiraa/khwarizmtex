/**
 * Nœuds de l'arbre syntaxique (AST).
 *
 * L'arbre est indépendant de toute sortie : les moteurs HTML et natif le lisent
 * sans jamais le modifier. Chaque nœud est un objet simple, sérialisable en JSON.
 */

/** Position dans la source (indices de caractères, fin exclue). */
export interface Loc {
  start: number;
  end: number;
}

/**
 * Classe d'atome au sens de TeX : elle décide des espacements automatiques
 * (une relation « = » est plus aérée qu'un opérateur binaire « + »).
 */
export type AtomClass = 'ord' | 'op' | 'bin' | 'rel' | 'open' | 'close' | 'punct' | 'inner';

/** Style mathématique : la taille et la place des exposants en dépendent. */
export type MathStyle = 'display' | 'text' | 'script' | 'scriptscript';

/** Variante de police d'un symbole mathématique. */
export type MathVariant =
  | 'normal'
  | 'italic'
  | 'bold'
  | 'bold-italic'
  | 'double-struck'
  | 'script'
  | 'fraktur'
  | 'sans-serif'
  | 'monospace';

/** Police d'un texte (\text, \textbf...). */
export type TextFont = 'normal' | 'bold' | 'italic' | 'monospace' | 'sans-serif';

/** Rôle sémantique d'un symbole : identifiant, nombre ou opérateur. */
export type SymbolRole = 'mi' | 'mn' | 'mo';

/** Un caractère ou une suite de chiffres. */
export interface SymbolNode {
  type: 'symbol';
  role: SymbolRole;
  cls: AtomClass;
  text: string;
  /** Absent : italique pour une lettre seule, droit sinon. */
  variant?: MathVariant;
  /** Flèche extensible (\xrightarrow) : s'étire à la largeur de ses étiquettes. */
  stretchy?: boolean;
  /** Produit par une commande de police : repère neutre pour les outils. */
  fontMark?: boolean;
  loc?: Loc;
}

/** Un groupe entre accolades, ou \mathbin{...} et consorts (cls imposée). */
export interface GroupNode {
  type: 'group';
  body: MathNode[];
  cls?: AtomClass;
  /** Produit par une commande de police : repère neutre pour les outils. */
  fontMark?: boolean;
  /** \multicolumn : colonnes couvertes, quand le groupe est seul dans sa cellule. */
  span?: { columns: number; align: ColumnAlign; left: boolean; right: boolean };
}

/** \frac, \binom, \dfrac... */
export interface FracNode {
  type: 'frac';
  num: MathNode;
  den: MathNode;
  /** false pour \binom (pas de barre). */
  bar: boolean;
  /** Délimiteurs autour de la fraction (\binom). */
  left?: string;
  right?: string;
  /** Alignement du numérateur (\cfrac[l]). */
  align?: 'l' | 'r';
  /** Épaisseur de barre choisie, en em (\genfrac). */
  rule?: number;
}

/** \sqrt{x} ou \sqrt[n]{x}. */
export interface SqrtNode {
  type: 'sqrt';
  body: MathNode;
  index?: MathNode;
}

/** Exposant et/ou indice attachés à une base (qui peut être vide). */
export interface ScriptsNode {
  type: 'scripts';
  base: MathNode | null;
  sup?: MathNode;
  sub?: MathNode;
}

/** Grand opérateur (\sum, \int) ou nom de fonction (\sin, \lim, \operatorname). */
export interface OpNode {
  type: 'op';
  name: string;
  /** true : un symbole (∑) ; false : un mot en romain (lim). */
  symbol: boolean;
  /** Bornes au-dessus et au-dessous (limits) ou en indice (nolimits). */
  limits: 'auto' | 'limits' | 'nolimits';
  /** Trait sur ou sous le nom (\varlimsup, \varliminf). */
  mark?: 'over' | 'under';
  /** Indices accolés des deux côtés (\sideset). */
  sides?: { left: MathNode; right: MathNode };
}

/** \left( ... \middle| ... \right). */
export interface FencedNode {
  type: 'fenced';
  left: string;
  right: string;
  body: MathNode[];
}

/** \middle| à l'intérieur d'un \left...\right. */
export interface MiddleNode {
  type: 'middle';
  delim: string;
}

/** \big( \Big] ... : délimiteur de taille fixe. */
export interface DelimNode {
  type: 'delim';
  delim: string;
  size: 1 | 2 | 3 | 4;
  cls: AtomClass;
}

/** Accent : \hat, \vec, \overline, \underbrace... */
export interface AccentNode {
  type: 'accent';
  /** Nom canonique de l'accent : 'hat', 'vec', 'overline', 'overbrace'... */
  accent: string;
  body: MathNode;
  /** true : l'accent s'étire à la largeur de la base. */
  stretchy: boolean;
  /** true : sous la base (\underline, \underbrace). */
  under: boolean;
}

/** \overset, \underset, \stackrel, \xrightarrow... */
export interface UnderOverNode {
  type: 'underover';
  base: MathNode;
  over?: MathNode;
  under?: MathNode;
  cls: AtomClass;
}

/** Alignement d'une colonne de tableau. */
export type ColumnAlign = 'l' | 'c' | 'r';

/** Famille d'environnement : décide des espacements et du style des cellules. */
export type ArrayKind = 'matrix' | 'small' | 'cases' | 'aligned' | 'gathered' | 'array';

/** Tableau : matrices, cases, aligned, array. */
export interface ArrayNode {
  type: 'array';
  kind: ArrayKind;
  /** Une ligne est une liste de cellules ; une cellule est une liste de nœuds. */
  rows: MathNode[][][];
  /** Alignement de chaque colonne (la dernière valeur se répète au besoin). */
  cols: ColumnAlign[];
  /** Filet vertical avant la colonne i (taille : nombre de colonnes + 1). */
  colLines: boolean[];
  /** Filet horizontal avant la ligne i (taille : nombre de lignes + 1). */
  rowLines: boolean[];
  left?: string;
  right?: string;
}

/** Texte en mode texte (\text{...}). */
export interface TextNode {
  type: 'text';
  text: string;
  font: TextFont;
}

/** Espace explicite, en em (négatif possible : \!). */
export interface SpaceNode {
  type: 'space';
  width: number;
}

/** \displaystyle, \scriptstyle... jusqu'à la fin du groupe. */
export interface StyleNode {
  type: 'style';
  style: MathStyle;
  body: MathNode[];
}

/** \color, \textcolor. La couleur est déjà validée (aucune injection possible). */
export interface ColorNode {
  type: 'color';
  color: string;
  body: MathNode[];
}

/** \phantom (invisible mais occupe sa place). */
export interface PhantomNode {
  type: 'phantom';
  body: MathNode;
}

/** \molecule : atomes placés et liaisons, déjà validés. */
export interface MoleculeNode {
  type: 'molecule';
  atoms: { element: string; charge: number; x: number; y: number; hydrogens: number; degree: number }[];
  bonds: { from: number; to: number; order: number; wedge: 'up' | 'down' | null }[];
}

/** \boxed, \cancel, \sout, \longdiv, \colorbox, \mathclap, \raisebox, \rule. */
export interface EncloseNode {
  type: 'enclose';
  notation:
    | 'box' | 'cancel' | 'bcancel' | 'xcancel' | 'strike' | 'longdiv'
    | 'fill' | 'cancelto' | 'clap' | 'llap' | 'rlap' | 'raise' | 'rule';
  body: MathNode;
  /** Fond (\colorbox) et cadre (\fcolorbox) : couleurs déjà validées. */
  color?: string;
  border?: string;
  /** Dimensions en em, déjà bornées (\rule, \raisebox). */
  width?: number;
  height?: number;
  shift?: number;
}

/** Une étiquette d'équation (`\label{...}`), sans représentation visuelle. */
export interface LabelNode {
  type: 'label';
  name: string;
  loc?: Loc;
}

export interface LinkNode {
  type: 'link';
  href: string;
  body: MathNode;
}

export interface NoTagNode {
  type: 'notag';
}

/** Une référence interne (`\ref` ou `\eqref`). */
export interface ReferenceNode {
  type: 'ref';
  /** Texte résolu, ou « ?? » si l'étiquette n'est pas connue. */
  text: string;
  /** Cible du lien HTML, absente pour une référence non résolue. */
  target?: string;
  resolved: boolean;
}

/** Numéro affiché par `\tag{...}` ou ajouté automatiquement à une équation étiquetée. */
export interface TagNode {
  type: 'tag';
  body: MathNode;
  /** `\tag*` supprime les parenthèses automatiques. */
  starred: boolean;
}

/** \\ hors d'un tableau : retour à la ligne forcé. */
export interface NewlineNode {
  type: 'newline';
}

/**
 * Erreur isolée : la partie fautive de la source, et pourquoi.
 * Le reste de la formule est rendu normalement autour.
 */
export interface ErrorNode {
  type: 'error';
  message: string;
  source: string;
  loc: Loc;
}

export type MathNode =
  | SymbolNode
  | GroupNode
  | FracNode
  | SqrtNode
  | ScriptsNode
  | OpNode
  | FencedNode
  | MiddleNode
  | DelimNode
  | AccentNode
  | UnderOverNode
  | ArrayNode
  | TextNode
  | SpaceNode
  | StyleNode
  | ColorNode
  | PhantomNode
  | EncloseNode
  | MoleculeNode
  | LabelNode
  | ReferenceNode
  | TagNode
  | LinkNode
  | NoTagNode
  | NewlineNode
  | ErrorNode;

export type MathNodeType = MathNode['type'];

/** Groupe vide (base d'un exposant isolé, argument manquant...). */
export function emptyGroup(): GroupNode {
  return { type: 'group', body: [] };
}

/** Rassemble une liste en un seul nœud (sans groupe inutile pour un seul élément). */
export function toNode(list: MathNode[]): MathNode {
  if (list.length === 1) {
    const only = list[0];
    if (only !== undefined) return only;
  }
  return { type: 'group', body: list };
}

/** Parcourt l'arbre en profondeur (pour les tests et les plugins). */
export function walk(node: MathNode, visit: (n: MathNode) => void): void {
  visit(node);
  for (const child of childrenOf(node)) walk(child, visit);
}

/** Les enfants directs d'un nœud, dans l'ordre de lecture. */
export function childrenOf(node: MathNode): MathNode[] {
  switch (node.type) {
    case 'group':
    case 'fenced':
    case 'style':
    case 'color':
      return node.body;
    case 'frac':
      return [node.num, node.den];
    case 'sqrt':
      return node.index ? [node.index, node.body] : [node.body];
    case 'scripts': {
      const out: MathNode[] = [];
      if (node.base) out.push(node.base);
      if (node.sub) out.push(node.sub);
      if (node.sup) out.push(node.sup);
      return out;
    }
    case 'accent':
    case 'phantom':
    case 'enclose':
    case 'tag':
    case 'link':
      return [node.body];
    case 'underover': {
      const out: MathNode[] = [node.base];
      if (node.under) out.push(node.under);
      if (node.over) out.push(node.over);
      return out;
    }
    case 'array':
      return node.rows.flat(2);
    default:
      return [];
  }
}
