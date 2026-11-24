// Les deux touches du clavier de maths qui ne sont pas des symboles : effacer, avancer.

/** Commande entière (avec ses groupes) qui contient la position, la plus petite. */
export function commandAround(src, position) {
  let best = null;
  for (const m of src.matchAll(/\\[a-zA-Z]+|[\^_](?=\{)/g)) {
    let end = m.index + m[0].length;
    for (;;) {
      const open = src[end];
      if (open !== "{" && open !== "[") break;
      const close = open === "{" ? "}" : "]";
      let depth = 0;
      let i = end;
      for (; i < src.length; i++) {
        if (src[i] === "\\") i++;
        else if (src[i] === open) depth++;
        else if (src[i] === close && --depth === 0) break;
      }
      if (i >= src.length) break;
      end = i + 1;
    }
    if (m.index < position && position <= end && (!best || end - m.index < best[1] - best[0])) best = [m.index, end];
  }
  return best;
}

/** Effacer : renvoie la sélection à faire, ou la portion à retirer. */
export function eraseAt(src, start, end) {
  if (start !== end) return { remove: [start, end] };
  if (!start) return null;
  const before = src.slice(0, start);
  // Une accolade seule casserait la formule : la commande entière est d'abord montrée.
  if (/[{}\[\]]$/.test(before)) {
    const command = commandAround(src, start);
    if (command) return { select: command };
  }
  const name = /\\(?:[a-zA-Z]+|.) ?$/.exec(before);
  if (name) {
    const command = commandAround(src, start - (name[0].endsWith(" ") ? 1 : 0));
    const opened = /^[{[]/.test(src.slice(start));
    if (opened && command) return { select: command };
    return { remove: [start - name[0].length, start] };
  }
  const last = [...before].pop();
  return { remove: [start - last.length, start] };
}

/** Case suivante : le prochain □, sinon la sortie du groupe, sinon la fin. */
export function nextStop(src, start, end) {
  const hole = src.indexOf("□", end);
  if (hole >= 0) return [hole, hole + 1];
  const close = src.slice(end).search(/(?<!\\)\}/);
  if (close >= 0) {
    let at = end + close + 1;
    // \frac{1}|{2} : on entre directement dans le groupe suivant.
    if (src[at] === "{") at++;
    return [at, at];
  }
  const first = src.indexOf("□");
  if (first >= 0 && first < start) return [first, first + 1];
  return [src.length, src.length];
}
