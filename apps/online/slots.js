// Repère, dans la source, les zones modifiables depuis l'aperçu :
// numérateur et dénominateur des fractions, radicande et indice des racines.
// Pur et sans DOM : testé à part, réutilisé par preview-edit.js.

const FRACTIONS = new Set(["frac", "dfrac", "tfrac", "cfrac", "binom", "dbinom", "tbinom"]);

/** Fin (exclue) du groupe entre accolades qui s'ouvre en `open`, ou -1. */
function closing(src, open, close = "}", start = "{") {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === start) depth++;
    else if (c === close && --depth === 0) return i + 1;
  }
  return -1;
}
function skipSpaces(src, i) {
  while (i < src.length && /\s/.test(src[i])) i++;
  return i;
}
/** Argument entre accolades : contenu modifiable. Sans accolades : non relié. */
function argument(src, i) {
  i = skipSpaces(src, i);
  if (src[i] === "{") {
    const end = closing(src, i);
    if (end < 0) return null;
    return { start: i + 1, end: end - 1, next: end };
  }
  // \frac12 ou \frac\alpha\beta : rendu correct, mais pas de zone à remplacer.
  if (src[i] === "\\") {
    const name = /^\\(?:[a-zA-Z]+|.)/.exec(src.slice(i));
    return { start: -1, end: -1, next: i + (name ? name[0].length : 1) };
  }
  // x^2 : un seul caractère, modifiable ; il reçoit des accolades s'il s'allonge.
  if (i < src.length && /[^\s{}^_&%$#~]/.test(src[i]))
    return { start: i, end: i + 1, next: i + 1, bare: true };
  return { start: -1, end: -1, next: i + 1 };
}

/**
 * Liste, dans l'ordre de la source, chaque fraction et chaque racine.
 * `kind` vaut "frac" ou "sqrt" ; chaque partie porte [start, end) dans la source,
 * ou start = -1 quand elle ne peut pas être reliée sans ambiguïté.
 * `comments` : % commence un commentaire (vrai pour une formule seule).
 */
export function findSlots(src, { comments = true } = {}) {
  const slots = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    // En mode Document, « 50 % » reste du texte : pas de commentaire.
    if (c === "%" && comments) {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "^" || c === "_") {
      const arg = argument(src, i + 1);
      if (arg)
        slots.push({
          kind: c === "^" ? "sup" : "sub",
          at: i,
          parts: [{ role: c === "^" ? "sup" : "sub", start: arg.start, end: arg.end, bare: arg.bare }],
        });
      continue;
    }
    if (c !== "\\") continue;
    const name = /^\\([a-zA-Z]+)/.exec(src.slice(i, i + 40))?.[1];
    if (!name) {
      i++;
      continue;
    }
    const after = i + 1 + name.length;
    if (FRACTIONS.has(name)) {
      const num = argument(src, after);
      const den = num && argument(src, num.next);
      if (den)
        slots.push({
          kind: "frac",
          at: i,
          parts: [
            { role: "num", start: num.start, end: num.end, bare: num.bare },
            { role: "den", start: den.start, end: den.end, bare: den.bare },
          ],
        });
    } else if (name === "sqrt") {
      let j = skipSpaces(src, after);
      const parts = [];
      if (src[j] === "[") {
        const end = closing(src, j, "]", "[");
        if (end < 0) continue;
        parts.push({ role: "index", start: j + 1, end: end - 1 });
        j = end;
      }
      const body = argument(src, j);
      if (body) {
        parts.push({ role: "radicand", start: body.start, end: body.end });
        slots.push({ kind: "sqrt", at: i, parts });
      }
    }
    i = after - 1;
  }
  return slots;
}

/** Remplace le contenu d'une partie ; une partie vidée redevient un emplacement □. */
export function partText(part, text) {
  if (text === "") return "□";
  return part.bare && [...text].length > 1 ? "{" + text + "}" : text;
}
export function replacePart(src, part, text) {
  return src.slice(0, part.start) + partText(part, text) + src.slice(part.end);
}

export const ROLE_NAMES = {
  num: "Numérateur",
  den: "Dénominateur",
  radicand: "Contenu",
  index: "Indice",
  sup: "Exposant",
  sub: "Indice bas",
};
