// Saisie directe dans l'aperçu : un clic sur un numérateur, un dénominateur ou
// une racine ouvre un petit champ à cet endroit ; chaque frappe réécrit la
// portion exacte de la source, puis l'aperçu, la sauvegarde et l'historique suivent.
import { eraseAt } from "./keys.js";
import { findSlots, partText, ROLE_NAMES } from "./slots.js";

const child = (box, selector) =>
  [...box.children].find((el) => el.matches(selector));
// Pour chaque sorte de zone : où la trouver dans le rendu, et comment atteindre
// chacune de ses parties. Les numéros suivent l'ordre du document.
const DOM_PARTS = {
  frac: {
    selector: ".khw-frac",
    find: (box, part) => child(box, part.role === "num" ? ".khw-num" : ".khw-den"),
  },
  sqrt: {
    selector: ".khw-sqrt",
    find: (box, part) => child(box, part.role === "index" ? ".khw-root" : ".khw-radicand"),
  },
  // Exposant ou borne du haut d'une somme affichée en grand.
  sup: { selector: "sup, .khw-limits > .khw-col > .khw-up > .khw-over, .khw-braced > .khw-over > .khw-brace-label", find: (box) => box },
  sub: { selector: "sub, .khw-limits > .khw-low > .khw-under, .khw-braced > .khw-under > .khw-brace-label", find: (box) => box },
  accent: { selector: ".khw-accent", find: (box) => child(box, ".khw-base") },
  text: { selector: ".khw-text", find: (box) => box },
  fenced: { selector: ".khw-lr", find: (box) => box },
  strike: {
    selector: ":is(.khw-cancel, .khw-bcancel, .khw-xcancel, .khw-strike, .khw-longdiv)",
    find: (box) => box,
  },
  brace: { selector: ".khw-braced", find: (box) => child(box, ".khw-base") },
  arrow: {
    selector: ".khw-xstack",
    find: (box, part) => box.querySelector(
      part.role === "under" ? ":scope > .khw-low > .khw-under" : ":scope > .khw-col > .khw-up > .khw-over",
    ),
  },
  font: { selector: ".khw-font", find: (box) => box },
  boxed: { selector: ".khw-boxed", find: (box) => box },
  cell: {
    selector: ".khw-mtable",
    find: (box, part) =>
      box.querySelectorAll(":scope > .khw-mtr")[part.row]?.querySelectorAll(":scope > .khw-mtd")[part.col],
  },
};
const KIND_NAMES = {
  frac: " de la fraction ",
  sqrt: " de la racine ",
  sup: " ",
  sub: " ",
  accent: " de l'accent ",
  text: " ",
  cell: " du tableau ",
  fenced: " des parenthèses ",
  boxed: " du cadre ",
  font: " de la police ",
  strike: " barré ",
  brace: " de l’accolade ",
  arrow: " de la flèche ",
};
const squash = (text) => text.replace(/[\s​⁡-⁤]+/g, "");
function balanced(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth < 0) return false;
  }
  return depth === 0;
}

export function bindPreviewEditor({
  preview,
  surface,
  scroller,
  source,
  engine,
  getMode,
  apply,
  renderProbe,
  locate,
  notify,
  launcher,
  flush,
  pending,
}) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "inplace-input";
  input.id = "inplace-input";
  input.hidden = true;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("enterkeyhint", "done");
  // Ordinateur : le champ flotte près de la zone. Téléphone : une barre fixe, sous la
  // formule, qui ne la recouvre jamais, avec les boutons qui remplacent Tab et Échap.
  const box = document.createElement("div");
  box.className = "inplace-box";
  box.hidden = true;
  const name = document.createElement("span");
  name.className = "inplace-name";
  name.setAttribute("aria-hidden", "true");
  function button(label, icon, action) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "icon-button inplace-key";
    el.setAttribute("aria-label", label);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#i-" + icon);
    svg.append(use);
    el.append(svg);
    el.addEventListener("mousedown", (event) => event.preventDefault());
    el.addEventListener("click", action);
    return el;
  }
  box.append(
    name,
    input,
    button("Partie suivante", "next", () => step(1)),
    button("Terminer", "check", () => close(false)),
  );
  surface.append(box);

  let zones = [];
  let current = null; // clé "kind:rang:partie" de la zone en cours
  const probe = document.createElement("span");
  const rendered = new Map();
  function renderedText(text) {
    if (!rendered.has(text)) {
      try {
        engine.renderToElement(text, probe, { output: "html", displayMode: false });
        rendered.set(text, squash(probe.textContent));
      } catch {
        rendered.set(text, null);
      }
      if (rendered.size > 400) rendered.delete(rendered.keys().next().value);
    }
    return rendered.get(text);
  }

  /** Relie chaque zone rendue à sa portion de source ; refuse en cas de doute. */
  function decorate() {
    zones = [];
    const src = source.value;
    const slots = src.length <= 50000 ? findSlots(src, { comments: getMode() === "formula" }) : [];
    for (const kind of Object.keys(DOM_PARTS)) {
      const spec = DOM_PARTS[kind];
      const ofKind = slots.filter((slot) => slot.kind === kind);
      const elements = [...preview.querySelectorAll(".khw-html " + spec.selector)];
      // Une macro, \over ou une erreur change le nombre : rien n'est relié.
      if (ofKind.length !== elements.length || ofKind.length > 800) continue;
      ofKind.forEach((slot, rank) => {
        const box = elements[rank];
        for (const part of slot.parts) {
          if (part.start < 0) continue;
          const el = spec.find(box, part);
          if (!el) continue;
          const text = src.slice(part.start, part.end);
          // Le rendu de la portion doit correspondre à ce qui est affiché.
          // Un texte s'affiche tel quel ; le reste passe par le moteur.
          const expected =
            kind === "text" && !/[\\$]/.test(text)
              ? squash(text)
              : renderedText(
                  // Une police change les caractères : on compare la commande entière.
                  kind === "font" ? src.slice(slot.at, part.end + (part.bare ? 0 : 1)) : text,
                );
          if (expected !== squash(el.textContent)) continue;
          const key =
            kind + ":" + rank + ":" + part.role + (part.role === "cell" ? ":" + part.row + "-" + part.col : "");
          el.dataset.slot = key;
          el.classList.add("khw-editable");
          const label =
            ROLE_NAMES[part.role] +
            (part.role === "cell" ? " ligne " + (part.row + 1) + ", colonne " + (part.col + 1) : "") +
            KIND_NAMES[kind] +
            (rank + 1);
          el.title = label + " : cliquer pour modifier";
          zones.push({ key, el, part, label, at: slot.at });
        }
      });
    }
    zones.sort((a, b) => a.part.start - b.part.start);
    target();
    launcher.hidden = zones.length === 0;
    if (zones.length) coach();
    if (current) {
      const zone = zones.find((z) => z.key === current);
      if (!zone) close(false);
      else show(zone, false);
    }
  }
  /** Montre dans la formule la case où tombera le prochain symbole. */
  function target() {
    for (const el of preview.querySelectorAll(".khw-target")) el.classList.remove("khw-target");
    if (current) return;
    const at = source.selectionStart;
    const zone = zones
      .filter((z) => z.part.start <= at && source.selectionEnd <= z.part.end && source.value.slice(z.part.start, z.part.end) === "□")
      .pop();
    zone?.el.classList.add("khw-target");
  }
  function step(direction) {
    const index = zones.findIndex((z) => z.key === current);
    const next = zones[index + direction];
    if (next) open(next.key);
    else close(false);
  }
  function show(zone, focus) {
    for (const el of preview.querySelectorAll(".khw-editing"))
      el.classList.remove("khw-editing");
    zone.el.classList.add("khw-editing");
    const text = source.value.slice(zone.part.start, zone.part.end);
    const value = text === "□" ? "" : text;
    if (input.value !== value && document.activeElement !== input) input.value = value;
    else if (focus) input.value = value;
    input.setAttribute("aria-label", zone.label);
    input.placeholder = "□";
    input.hidden = false;
    box.hidden = false;
    name.textContent = zone.label.replace(/ \d+$/, "");
    const area = zone.el.getBoundingClientRect();
    const frame = surface.getBoundingClientRect();
    const width = Math.max(area.width + 16, 88);
    const left = Math.min(
      Math.max(4, area.left - frame.left + surface.scrollLeft + area.width / 2 - width / 2),
      surface.scrollWidth - width - 4,
    );
    box.style.width = width + "px";
    box.style.left = left + "px";
    // Au-dessus pour le haut d'une structure, dessous pour le bas :
    // le champ ne recouvre jamais l'autre zone de la même fraction.
    const above = ["num", "index", "sup"].includes(zone.part.role);
    const height = input.offsetHeight || 38;
    const top = above
      ? Math.max(2, area.top - frame.top + surface.scrollTop - height - 6)
      : area.bottom - frame.top + surface.scrollTop + 6;
    box.style.top = top + "px";
    if (focus) {
      input.focus({ preventScroll: true });
      input.select();
      zone.el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }
  /**
   * Preuve avant modification : on remplace la portion par un témoin, hors écran.
   * S'il n'apparaît pas dans la zone cliquée, le lien est faux et on refuse.
   */
  const WITNESS = "⟐";
  const FORMULAS = ".equation-block, .inline-math";
  function formulaIndex(el) {
    return [...preview.querySelectorAll(FORMULAS)].indexOf(el.closest(FORMULAS));
  }
  function proven(zone) {
    const [kind, rank] = zone.key.split(":");
    try {
      // Seule la formule concernée est refaite : un long document reste fluide.
      const formula = locate(zone.part.start);
      if (!formula || (formula.index >= 0 && formulaIndex(zone.el) !== formula.index)) return false;
      const at = zone.part.start - formula.start;
      const text = formula.text;
      const changed =
        text.slice(0, at) + partText(zone.part, WITNESS) + text.slice(zone.part.end - formula.start);
      const box = document.createElement("div");
      const before = [...preview.querySelectorAll(".khw-html " + DOM_PARTS[kind].selector)];
      const root = formula.index >= 0 ? zone.el.closest(FORMULAS) : preview;
      const local = before.filter((el) => root.contains(el)).indexOf(before[Number(rank)]);
      if (local < 0) return false;
      renderProbe(changed, formula.display, box);
      const spec = DOM_PARTS[kind];
      const element = box.querySelectorAll(".khw-html " + spec.selector)[local];
      const el = element && spec.find(element, zone.part);
      return Boolean(el) && squash(el.textContent) === WITNESS;
    } catch {
      return false;
    }
  }
  function refuse() {
    notify(
      "Cette partie ne peut pas être reliée avec certitude au code : modifiez-la dans le code.",
    );
  }
  function open(key) {
    // Un rendu encore en attente décrirait l'ancienne source : on le fait d'abord.
    if (pending()) flush();
    const zone = zones.find((z) => z.key === key);
    if (!zone) return;
    if (!proven(zone)) {
      close(false);
      refuse();
      return;
    }
    current = key;
    show(zone, true);
  }
  function close(returnFocus) {
    current = null;
    input.hidden = true;
    box.hidden = true;
    input.classList.remove("invalid");
    for (const el of preview.querySelectorAll(".khw-editing"))
      el.classList.remove("khw-editing");
    if (returnFocus) (launcher.hidden ? source : launcher).focus({ preventScroll: true });
  }
  input.addEventListener("input", () => {
    const zone = zones.find((z) => z.key === current);
    if (!zone) return;
    // Une accolade seule casserait la structure autour : on attend la paire.
    if (!balanced(input.value)) {
      input.classList.add("invalid");
      return;
    }
    input.classList.remove("invalid");
    // La frappe précédente a pu changer la structure : le lien est reprouvé.
    if (!proven(zone)) {
      close(false);
      refuse();
      return;
    }
    apply(zone.part.start, zone.part.end, partText(zone.part, input.value));
  });
  input.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "Escape" || event.key === "Enter") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      const index = zones.findIndex((z) => z.key === current);
      const next = zones[index + (event.shiftKey ? -1 : 1)];
      if (!next) return close(false);
      event.preventDefault();
      open(next.key);
    }
  });
  input.addEventListener("blur", () =>
    setTimeout(() => {
      if (document.activeElement !== input && current) close(false);
    }, 120),
  );
  preview.addEventListener("mousedown", (event) => {
    // Garde le champ actif quand on passe d'une zone à l'autre.
    if (event.target.closest("[data-slot]") && current) event.preventDefault();
  });
  preview.addEventListener("click", (event) => {
    const zone = event.target.closest("[data-slot]");
    if (zone) {
      // La zone la plus intérieure gagne : \frac{\frac{1}{2}}{3} vise le 2.
      open(zone.dataset.slot);
      const part = zones.find((z) => z.key === zone.dataset.slot)?.part;
      if (part) source.setSelectionRange(part.start, part.end);
      return;
    }
    if (event.target.closest(".khw-html"))
      refuse();
  });
  launcher.addEventListener("click", () => {
    if (pending()) flush();
    const after = zones.find((z) => z.part.end >= source.selectionStart);
    open((after || zones[0])?.key);
  });
  scroller.addEventListener("scroll", () => {
    const zone = zones.find((z) => z.key === current);
    if (zone) show(zone, false);
  });
  document.addEventListener("selectionchange", () => {
    if (document.activeElement === source) target();
  });
  function type(text, start = input.selectionStart, end = input.selectionEnd) {
    if (/\\[a-zA-Z]+$/.test(input.value.slice(0, start)) && /^[a-zA-Z]/.test(text)) text = " " + text;
    const hole = text.indexOf("□");
    const picked = input.value.slice(start, end);
    if (hole >= 0 && picked) text = text.replace("□", picked);
    input.setRangeText(text, start, end, "end");
    if (hole >= 0 && !picked) input.setSelectionRange(start + hole, start + hole + 1);
    input.dispatchEvent(new Event("input"));
    input.focus({ preventScroll: true });
  }
  /** Une touche du clavier de maths pendant la saisie dans l'aperçu. */
  function insertText(text) {
    if (!current || input.hidden) return false;
    type(text);
    return true;
  }
  function key(name) {
    if (!current || input.hidden) return false;
    if (name === "next") {
      const hole = input.value.indexOf("□", input.selectionEnd);
      if (hole >= 0) input.setSelectionRange(hole, hole + 1);
      else step(1);
      return true;
    }
    const found = eraseAt(input.value, input.selectionStart, input.selectionEnd);
    if (found?.select) input.setSelectionRange(...found.select);
    else if (found) type("", ...found.remove);
    return true;
  }
  window.addEventListener("resize", () => {
    const zone = zones.find((z) => z.key === current);
    if (zone) show(zone, false);
  });
  // Astuce affichée une seule fois, la première fois qu'une zone est modifiable.
  const COACH = "khwarizm-online-coach";
  let coached = false;
  function coach() {
    if (coached || getMode() === "document") return;
    coached = true;
    try {
      if (localStorage.getItem(COACH)) return;
    } catch {
      return;
    }
    document.getElementById("coach").hidden = false;
  }
  function dismissCoach() {
    document.getElementById("coach").hidden = true;
    try {
      localStorage.setItem(COACH, "1");
    } catch {
      /* Rien à retenir. */
    }
  }
  document.getElementById("coach-close").addEventListener("click", dismissCoach);
  input.addEventListener("focus", dismissCoach);
  return { decorate, target, insertText, key, close: () => close(false) };
}
