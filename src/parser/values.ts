/**
 * Lecture des valeurs littérales : dimensions (\hspace{1em}) et couleurs.
 * Tout ce qui sort d'ici est validé : aucune chaîne libre n'atteint le CSS.
 */

/** Unités TeX converties en em (police de 10 pt : 1 em = 10 pt). */
const UNITS: Record<string, number> = {
  em: 1,
  ex: 0.431,
  mu: 1 / 18,
  pt: 0.1,
  pc: 1.2,
  bp: 0.1004,
  dd: 0.107,
  cc: 1.284,
  sp: 0.1 / 65536,
  in: 7.227,
  cm: 2.8453,
  mm: 0.28453,
  px: 0.0625,
};

/** « 1.5em », « -3mu », « .5 cm » → valeur en em ; null si illisible. */
export function parseDimension(text: string): number | null {
  const s = text.trim();
  let i = 0;
  let sign = 1;
  while (s[i] === '-' || s[i] === '+') {
    if (s[i] === '-') sign = -sign;
    i++;
  }
  const start = i;
  while (i < s.length && ((s[i] as string) >= '0' && (s[i] as string) <= '9' || s[i] === '.' || s[i] === ',')) i++;
  const numberText = s.slice(start, i).replace(',', '.');
  if (numberText === '' || numberText === '.') return null;
  const value = Number(numberText);
  if (!Number.isFinite(value)) return null;
  const unit = s.slice(i).trim().toLowerCase();
  const factor = UNITS[unit];
  if (factor === undefined) return null;
  return sign * value * factor;
}

function isHex(s: string): boolean {
  for (const ch of s) {
    const c = ch.toLowerCase();
    if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
  }
  return true;
}

function isLetters(s: string): boolean {
  for (const ch of s) {
    const c = ch.toLowerCase();
    if (c < 'a' || c > 'z') return false;
  }
  return true;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/**
 * Couleur de la source → couleur CSS sûre, ou null.
 * Modèles : nom (red), #rgb/#rrggbb, [HTML]{FF8800}, [rgb]{1,0.5,0}, [RGB]{255,128,0}, [gray]{0.5}.
 */
export function parseColor(value: string, model?: string): string | null {
  const v = value.trim();
  if (model === undefined || model === '') {
    if (v.startsWith('#')) {
      const hex = v.slice(1);
      return [3, 4, 6, 8].includes(hex.length) && isHex(hex) ? '#' + hex.toLowerCase() : null;
    }
    return v.length > 0 && v.length <= 30 && isLetters(v) ? v.toLowerCase() : null;
  }
  const m = model.trim();
  if (m === 'HTML') return v.length === 6 && isHex(v) ? '#' + v.toLowerCase() : null;
  const parts = v.split(',').map((p) => Number(p.trim()));
  if (parts.some((p) => !Number.isFinite(p))) return null;
  if (m === 'rgb' && parts.length === 3) {
    const [r, g, b] = parts.map((p) => clampByte(p * 255));
    return `rgb(${r} ${g} ${b})`;
  }
  if (m === 'RGB' && parts.length === 3) {
    const [r, g, b] = parts.map(clampByte);
    return `rgb(${r} ${g} ${b})`;
  }
  if (m === 'gray' && parts.length === 1) {
    const g = clampByte((parts[0] as number) * 255);
    return `rgb(${g} ${g} ${g})`;
  }
  return null;
}
