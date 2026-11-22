// Saisie directe dans l'aperçu : un clic sur un numérateur, un dénominateur ou
// une racine ouvre un petit champ à cet endroit ; chaque frappe réécrit la
// portion exacte de la source, puis l'aperçu, la sauvegarde et l'historique suivent.
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
  sup: { selector: "sup, .khw-limits > .khw-over", find: (box) => box },
  sub: { selector: "sub, .khw-limits > .khw-under", find: (box) => box },
  accent: { selector: ".khw-accent", find: (box) => child(box, ".khw-base") },
  text: { selector: ".khw-text", find: (box) => box },
  fenced: { selector: ".khw-lr", find: (box) => box },
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
};
const EDITABLE =
  ".khw-num, .khw-den, .khw-radicand, .khw-root, .khw-html sup, .khw-html sub, .khw-over, .khw-under, .khw-mtd, .khw-text, .khw-lr, .khw-boxed";
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
  source,
  engine,
  getMode,
  apply,
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
  surface.append(input);

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
      if (ofKind.length !== elements.length || ofKind.length > 200) continue;
      ofKind.forEach((slot, rank) => {
        const box = elements[rank];
        for (const part of slot.parts) {
          if (part.start < 0) continue;
          const el = spec.find(box, part);
          if (!el) continue;
          const text = src.slice(part.start, part.end);
          // Le rendu de la portion doit correspondre à ce qui est affiché.
          // Un texte s'affiche tel quel ; le reste passe par le moteur.
          const expected = kind === "text" && !/[\\$]/.test(text) ? squash(text) : renderedText(text);
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
    launcher.hidden = zones.length === 0;
    if (zones.length) coach();
    if (current) {
      const zone = zones.find((z) => z.key === current);
      if (!zone) close(false);
      else show(zone, false);
    }
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
    const box = zone.el.getBoundingClientRect();
    const frame = surface.getBoundingClientRect();
    const width = Math.max(box.width + 16, 88);
    const left = Math.min(
      Math.max(4, box.left - frame.left + surface.scrollLeft + box.width / 2 - width / 2),
      surface.scrollWidth - width - 4,
    );
    input.style.width = width + "px";
    input.style.left = left + "px";
    // Au-dessus pour le haut d'une structure, dessous pour le bas :
    // le champ ne recouvre jamais l'autre zone de la même fraction.
    const above = ["num", "index", "sup"].includes(zone.part.role);
    const height = input.offsetHeight || 38;
    const top = above
      ? Math.max(2, box.top - frame.top + surface.scrollTop - height - 6)
      : box.bottom - frame.top + surface.scrollTop + 6;
    input.style.top = top + "px";
    if (focus) {
      input.focus({ preventScroll: true });
      input.select();
      input.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }
  function open(key) {
    // Un rendu encore en attente décrirait l'ancienne source : on le fait d'abord.
    if (pending()) flush();
    const zone = zones.find((z) => z.key === key);
    if (!zone) return;
    current = key;
    show(zone, true);
  }
  function close(returnFocus) {
    current = null;
    input.hidden = true;
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
    if (event.target.closest(EDITABLE))
      notify(
        "Cette partie ne peut pas être reliée avec certitude à la source : modifiez-la à gauche.",
      );
  });
  launcher.addEventListener("click", () => {
    if (pending()) flush();
    const after = zones.find((z) => z.part.end >= source.selectionStart);
    open((after || zones[0])?.key);
  });
  window.addEventListener("resize", () => {
    const zone = zones.find((z) => z.key === current);
    if (zone) show(zone, false);
  });
  // Astuce affichée une seule fois, la première fois qu'une zone est modifiable.
  const COACH = "khwarizm-online-coach";
  let coached = false;
  function coach() {
    if (coached) return;
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
  return { decorate, close: () => close(false) };
}
