// Repère, dans la source, les zones modifiables depuis l'aperçu :
// numérateur et dénominateur des fractions, radicande et indice des racines.
// Pur et sans DOM : testé à part, réutilisé par preview-edit.js.

const FRACTIONS = new Set(["frac", "dfrac", "tfrac", "cfrac", "binom", "dbinom", "tbinom"]);
const ACCENTS = new Set(
  "vec hat widehat bar overline underline tilde widetilde dot ddot acute grave breve check overrightarrow overleftarrow overleftrightarrow overarc".split(" "),
);
const STRIKES = new Set("cancel bcancel xcancel cancelto sout longdiv".split(" "));
const TEXTS = new Set("text textbf textit textrm textsf texttt textnormal mbox".split(" "));
const TABLES = new Set(
  "matrix pmatrix bmatrix Bmatrix vmatrix Vmatrix smallmatrix cases dcases rcases aligned alignedat gathered array subarray split".split(" "),
);

/** Délimiteur qui suit \\left ou \\right : un caractère ou une commande. */
function delimiterEnd(src, i) {
  i = skipSpaces(src, i);
  const cmd = /^\\(?:[a-zA-Z]+|.)/.exec(src.slice(i, i + 20));
  return i + (cmd ? cmd[0].length : 1);
}
/** Contenu entre \\left… et le \\right qui lui répond ; refusé s'il y a un \\middle. */
function leftRight(src, bodyStart) {
  let depth = 0;
  let middle = false;
  for (let i = bodyStart; i < src.length; i++) {
    if (src[i] !== "\\") continue;
    const name = /^\\([a-zA-Z]+)/.exec(src.slice(i, i + 10))?.[1];
    if (!name) {
      i++;
      continue;
    }
    if (name === "left") depth++;
    else if (name === "middle" && depth === 0) middle = true;
    else if (name === "right") {
      if (depth === 0) {
        let a = bodyStart;
        let b = i;
        while (a < b && /\s/.test(src[a])) a++;
        while (b > a && /\s/.test(src[b - 1])) b--;
        return middle ? { start: -1, end: -1 } : { start: a, end: b };
      }
      depth--;
    }
    i += name.length;
  }
  return null;
}

/** Cellules d'un tableau, ligne par ligne, coupées aux & et \\\\ de premier niveau. */
function tableCells(src, bodyStart, env) {
  const rows = [[]];
  let cell = bodyStart;
  let depth = 0;
  let envs = 0;
  const push = (end) => {
    let a = cell;
    let b = end;
    while (a < b && /\s/.test(src[a])) a++;
    while (b > a && /\s/.test(src[b - 1])) b--;
    rows[rows.length - 1].push({ start: a, end: b });
  };
  for (let i = bodyStart; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === "\\") {
      const rest = src.slice(i, i + 60);
      const begin = /^\\begin\{([^}]*)\}/.exec(rest);
      const end = /^\\end\{([^}]*)\}/.exec(rest);
      if (begin) {
        envs++;
        i += begin[0].length - 1;
      } else if (end) {
        if (envs === 0 && depth === 0) {
          if (end[1] !== env) return null;
          push(i);
          return { rows, end: i + end[0].length };
        }
        envs--;
        i += end[0].length - 1;
      } else if (src[i + 1] === "\\" && depth === 0 && envs === 0) {
        push(i);
        rows.push([]);
        i++;
        // Écart optionnel \\[2pt] : il n'appartient à aucune cellule.
        const gap = /^\s*\[[^\]]*\]/.exec(src.slice(i + 1, i + 40));
        if (gap) i += gap[0].length;
        cell = i + 1;
      } else i++;
    } else if (c === "&" && depth === 0 && envs === 0) {
      push(i);
      cell = i + 1;
    }
  }
  return null;
}

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
        parts.push({ role: "radicand", start: body.start, end: body.end, bare: body.bare });
        slots.push({ kind: "sqrt", at: i, parts });
      }
    } else if (ACCENTS.has(name) || TEXTS.has(name)) {
      const arg = argument(src, after);
      if (arg)
        slots.push({
          kind: ACCENTS.has(name) ? "accent" : "text",
          at: i,
          parts: [{ role: ACCENTS.has(name) ? "base" : "text", start: arg.start, end: arg.end, bare: arg.bare }],
        });
    } else if (name === "left") {
      const body = leftRight(src, delimiterEnd(src, after));
      if (body) slots.push({ kind: "fenced", at: i, parts: [{ role: "fenced", ...body }] });
    } else if (STRIKES.has(name)) {
      let j = after;
      if (name === "cancelto") j = argument(src, after)?.next ?? after;
      const arg = argument(src, j);
      if (arg) slots.push({ kind: "strike", at: i, parts: [{ role: "base", start: arg.start, end: arg.end, bare: arg.bare }] });
    } else if (name === "overbrace" || name === "underbrace") {
      const arg = argument(src, after);
      if (arg) slots.push({ kind: "brace", at: i, parts: [{ role: "base", start: arg.start, end: arg.end, bare: arg.bare }] });
    } else if (/^x[a-zA-Z]*(arrow|harpoon|harpoons|mapsto)$/.test(name)) {
      let j = skipSpaces(src, after);
      const parts = [];
      if (src[j] === "[") {
        const end = closing(src, j, "]", "[");
        if (end < 0) continue;
        parts.push({ role: "under", start: j + 1, end: end - 1 });
        j = end;
      }
      const arg = argument(src, j);
      if (arg) slots.push({ kind: "arrow", at: i, parts: [{ role: "over", start: arg.start, end: arg.end, bare: arg.bare }, ...parts] });
    } else if (name === "boxed") {
      const arg = argument(src, after);
      if (arg) slots.push({ kind: "boxed", at: i, parts: [{ role: "base", start: arg.start, end: arg.end }] });
    } else if (name === "begin") {
      const env = /^\{([a-zA-Z*]+)\}/.exec(src.slice(after, after + 30));
      if (env && TABLES.has(env[1])) {
        let body = after + env[0].length;
        // array et alignedat : la description des colonnes n'est pas une cellule.
        if (env[1] === "array" || env[1] === "subarray" || env[1] === "alignedat") {
          const spec = argument(src, body);
          if (spec) body = spec.next;
        }
        const table = tableCells(src, body, env[1]);
        if (table)
          slots.push({
            kind: "cell",
            at: i,
            parts: table.rows.flatMap((row, r) =>
              row.map((cell, c) => ({ role: "cell", row: r, col: c, ...cell })),
            ),
          });
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
  base: "Contenu",
  text: "Texte",
  cell: "Cellule",
  fenced: "Contenu",
  over: "Texte au-dessus",
  under: "Texte au-dessous",
  sub: "Indice bas",
};
