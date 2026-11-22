/**
 * Alphabets mathématiques Unicode (bloc U+1D400) : ℝ, 𝔉, 𝒜, 𝐱...
 *
 * La norme du balisage natif recommande ces caractères plutôt que l'attribut mathvariant.
 * Le rendu HTML s'en sert pour \mathbb, \mathcal et \mathfrak, qu'aucune
 * propriété CSS ne sait produire.
 */
import type { MathVariant } from '../ast/nodes';

interface Alphabet {
  upper: number;
  lower: number;
  digit?: number;
  /** Lettres déjà codées ailleurs (bloc « Letterlike Symbols »). */
  holes?: Record<string, number>;
}

const ALPHABETS: Partial<Record<MathVariant, Alphabet>> = {
  bold: { upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce },
  italic: { upper: 0x1d434, lower: 0x1d44e, holes: { h: 0x210e } },
  'bold-italic': { upper: 0x1d468, lower: 0x1d482 },
  script: {
    upper: 0x1d49c,
    lower: 0x1d4b6,
    holes: {
      B: 0x212c,
      E: 0x2130,
      F: 0x2131,
      H: 0x210b,
      I: 0x2110,
      L: 0x2112,
      M: 0x2133,
      R: 0x211b,
      e: 0x212f,
      g: 0x210a,
      o: 0x2134,
    },
  },
  fraktur: {
    upper: 0x1d504,
    lower: 0x1d51e,
    holes: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 },
  },
  'double-struck': {
    upper: 0x1d538,
    lower: 0x1d552,
    digit: 0x1d7d8,
    holes: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
  },
  'sans-serif': { upper: 0x1d5a0, lower: 0x1d5ba, digit: 0x1d7e2 },
  monospace: { upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 },
};

/** Grec : début de chaque alphabet (Α majuscule). */
const GREEK_START: Partial<Record<MathVariant, number>> = {
  bold: 0x1d6a8,
  italic: 0x1d6e2,
  'bold-italic': 0x1d71c,
};

/** Rang d'une lettre grecque dans l'ordre des alphabets mathématiques, ou -1. */
function greekIndex(cp: number): number {
  if (cp >= 0x391 && cp <= 0x3a1) return cp - 0x391; // Α..Ρ
  if (cp === 0x3f4) return 17; // ϴ
  if (cp >= 0x3a3 && cp <= 0x3a9) return cp - 0x3a3 + 18; // Σ..Ω
  if (cp === 0x2207) return 25; // ∇
  if (cp >= 0x3b1 && cp <= 0x3c9) return cp - 0x3b1 + 26; // α..ω (ς compris)
  const tail: Record<number, number> = {
    0x2202: 51, // ∂
    0x3f5: 52, // ϵ
    0x3d1: 53, // ϑ
    0x3f0: 54, // ϰ
    0x3d5: 55, // ϕ
    0x3f1: 56, // ϱ
    0x3d6: 57, // ϖ
  };
  return tail[cp] ?? -1;
}

/** Transforme un caractère dans la variante demandée (ou le rend tel quel). */
export function toMathAlphabet(char: string, variant: MathVariant): string {
  const cp = char.codePointAt(0);
  if (cp === undefined || char.length > 2) return char;
  const alphabet = ALPHABETS[variant];
  if (alphabet) {
    const hole = alphabet.holes?.[char];
    if (hole !== undefined) return String.fromCodePoint(hole);
    if (cp >= 65 && cp <= 90) return String.fromCodePoint(alphabet.upper + cp - 65);
    if (cp >= 97 && cp <= 122) return String.fromCodePoint(alphabet.lower + cp - 97);
    if (cp >= 48 && cp <= 57 && alphabet.digit !== undefined) {
      return String.fromCodePoint(alphabet.digit + cp - 48);
    }
  }
  const greek = GREEK_START[variant];
  if (greek !== undefined) {
    const index = greekIndex(cp);
    if (index >= 0) return String.fromCodePoint(greek + index);
  }
  return char;
}

/** Transforme chaque caractère d'une chaîne. */
export function toMathAlphabetString(text: string, variant: MathVariant): string {
  let out = '';
  for (const ch of text) out += toMathAlphabet(ch, variant);
  return out;
}

/** Vrai si le caractère est une lettre latine ou grecque minuscule (italique par défaut). */
export function isItalicByDefault(char: string): boolean {
  const cp = char.codePointAt(0);
  if (cp === undefined || char.length > 2) return false;
  if ((cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122)) return true;
  if (cp >= 0x3b1 && cp <= 0x3c9) return true;
  return cp === 0x3d1 || cp === 0x3d5 || cp === 0x3d6 || cp === 0x3f0 || cp === 0x3f1 || cp === 0x3f5;
}
