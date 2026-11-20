/**
 * Mesures typographiques, en em de la taille courante.
 *
 * Le moteur HTML s'en sert pour placer exposants et indices, et pour dessiner
 * à la bonne hauteur les délimiteurs extensibles. Les hauteurs des glyphes ont
 * été relevées sur la police par défaut (famille STIX Two) ; les polices de
 * secours (Cambria, Times) en sont proches à quelques centièmes d'em.
 *
 * La mise en page elle-même ne dépend pas de ces valeurs : barres de fraction,
 * limites et bornes sont placées par le CSS (tableaux à légende), qui reste
 * exact quelle que soit la police.
 */

/** Axe mathématique : hauteur du milieu du signe moins (doit égaler --khw-axis). */
export const AXIS = 0.25;
/** Épaisseur des filets (barre de fraction, racine), comme --khw-rule-em. */
export const RULE = 0.05;
/** Hauteur d'x. */
export const X_HEIGHT = 0.47;
/** Boîte d'une ligne avec line-height: 1 : montée et descente (somme = 1). */
export const LINE_ASCENT = 0.76;
export const LINE_DESCENT = 0.24;

/** Paramètres de placement des indices (valeurs de TeX). */
export const SUP_DISPLAY = 0.413;
export const SUP_TEXT = 0.363;
export const SUP_CRAMPED = 0.289;
export const SUB_ALONE = 0.15;
export const SUB_WITH_SUP = 0.247;
export const SUP_DROP = 0.386;
export const SUB_DROP = 0.05;

const ASCENDERS = new Set('bdfhklt0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!?%&#@/\\'.split(''));
const DESCENDERS = new Set('gjpqy,;'.split(''));
const GREEK_TALL = new Set('βδζθλξϑψϕ∂ℓ'.split(''));
const GREEK_DEEP = new Set('βγζημξρςφχψϕϱ'.split(''));
const DELIMS = new Set('()[]{}|‖⟨⟩⌊⌋⌈⌉⟦⟧'.split(''));
const OPERATORS = new Set('+−±∓×÷=≠≤≥<>≈≡∼≃≅∝∈∉⊂⊃⊆⊇∪∩∧∨⊕⊗→←↔⇒⇐⇔↦'.split(''));
const LOW = new Set('.,…'.split(''));
const MID = new Set('⋯·⋅∘∙∗⋆'.split(''));

/** Hauteur et profondeur d'un caractère, en em. */
export function charMetrics(ch: string, italic: boolean): [number, number] {
  if (DELIMS.has(ch)) return [0.74, 0.2];
  if (OPERATORS.has(ch)) return [0.56, 0.06];
  if (LOW.has(ch)) return [0.12, ch === ',' ? 0.2 : 0];
  if (MID.has(ch)) return [0.33, 0];
  if (ch === '∑' || ch === '∏' || ch === '∐' || ch === '⋃' || ch === '⋂') return [0.78, 0.25];
  if (ch === '∫' || ch === '∮' || ch === '∬' || ch === '∭') return [0.73, 0.23];
  if (ch === '∞' || ch === '∝') return [0.44, 0];
  if (ch === '′' || ch === '″' || ch === '‴') return [0.75, 0];
  const deep = DESCENDERS.has(ch) || GREEK_DEEP.has(ch) || (italic && ch === 'f');
  const tall = ASCENDERS.has(ch) || GREEK_TALL.has(ch) || ch === 'i' || ch === 'j';
  const code = ch.codePointAt(0) ?? 0;
  // Majuscules grecques, lettres accentuées, alphabets mathématiques : hauteur de capitale.
  const capital = (code >= 0x391 && code <= 0x3a9) || code >= 0x1d400 || (code >= 0x2100 && code <= 0x214f);
  const h = tall || capital ? 0.7 : code >= 0xc0 && code < 0x250 ? 0.7 : 0.48;
  return [h, deep ? 0.22 : 0];
}

/** Hauteur et profondeur d'une chaîne (maximum de ses caractères). */
export function textMetrics(text: string, italic: boolean): [number, number] {
  let h = 0;
  let d = 0;
  for (const ch of text) {
    const [ch_h, ch_d] = charMetrics(ch, italic);
    if (ch_h > h) h = ch_h;
    if (ch_d > d) d = ch_d;
  }
  return [h, d];
}

/** Correction italique : de combien une lettre penchée déborde à droite, en em. */
const LEANING: Record<string, number> = { f: 0.1, j: 0.05, V: 0.1, W: 0.1, Y: 0.1, T: 0.08, F: 0.08, P: 0.06 };

export function italicCorrection(ch: string): number {
  return LEANING[ch] ?? 0.03;
}
