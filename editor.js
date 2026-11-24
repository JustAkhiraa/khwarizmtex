import { COMMANDS, STRUCTURES } from "./presets.js";
import { MAX_SOURCE } from "./model.js";
import { CATALOG } from "./catalog.js";
import { catalogIdFor } from "./recents.js";
import { parseDocument, inlineParts } from "./document.js";
import { coarse } from "./layout.js";
import { eraseAt, nextStop } from "./keys.js";

const completionMap = new Map(COMMANDS.map((entry) => [entry[0], entry]));
for (const item of CATALOG) {
  const name = /^\\([a-zA-Z]+)/.exec(item.source)?.[1];
  if (name && !completionMap.has(name))
    completionMap.set(name, [name, item.source, item.label]);
}
const completions = [...completionMap.values()];

export function bindEditor(
  source,
  toolbar,
  suggestions,
  onChange,
  notify,
  getMode,
) {
  let matches = [];
  let active = 0;
  let prefix = null;
  let composing = false;
  function close() {
    suggestions.hidden = true;
    matches = [];
  }
  function replace(
    value,
    start = source.selectionStart,
    end = source.selectionEnd,
    wrapSelection = true,
  ) {
    const selected = source.value.slice(start, end);
    if (wrapSelection && selected && value.includes("□"))
      value = value.replace("□", selected);
    // \pi puis x : sans espace, la commande deviendrait \pix.
    if (/\\[a-zA-Z]+$/.test(source.value.slice(0, start)) && /^[a-zA-Z]/.test(value)) value = " " + value;
    if (source.value.length - (end - start) + value.length > MAX_SOURCE) {
      notify("La limite de 50 000 caractères est atteinte.");
      return;
    }
    const placeholder = value.indexOf("□");
    source.setRangeText(value, start, end, "end");
    focusSource();
    if (placeholder >= 0)
      source.setSelectionRange(start + placeholder, start + placeholder + 1);
    close();
    onChange(false);
  }
  /** Au doigt, le curseur se montre sans ouvrir le clavier du téléphone. */
  function focusSource() {
    if (coarse() && document.activeElement !== source) source.inputMode = "none";
    source.focus({ preventScroll: true });
  }
  // Toucher le code, lui, rend le clavier du téléphone.
  source.addEventListener("pointerdown", () => {
    if (source.inputMode === "none") source.blur();
  });
  source.addEventListener("blur", () => (source.inputMode = ""));
  function accept(index) {
    if (prefix && matches[index])
      replace(matches[index][1], prefix.start, source.selectionStart, false);
  }
  function suggest() {
    if (composing || source.selectionStart !== source.selectionEnd) {
      close();
      return;
    }
    const match = /\\([a-zA-Z]{1,20})$/.exec(
      source.value.slice(0, source.selectionStart),
    );
    if (!match) {
      close();
      return;
    }
    prefix = { start: source.selectionStart - match[0].length };
    matches = completions.filter((c) => c[0].startsWith(match[1])).slice(0, 5);
    active = 0;
    suggestions.replaceChildren();
    matches.forEach((command, index) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      const name = document.createElement("code");
      name.textContent = "\\" + command[0];
      const description = document.createElement("span");
      description.textContent = command[2];
      button.append(name, description);
      button.classList.toggle("active", index === active);
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => accept(index));
      li.append(button);
      suggestions.append(li);
    });
    suggestions.hidden = matches.length === 0;
  }
  function insert(
    value,
    selection = [source.selectionStart, source.selectionEnd],
  ) {
    if (api.intercept?.(value)) return;
    if (getMode() === "document") {
      const position = selection[0];
      const inMath = parseDocument(source.value).blocks.some((block) =>
        block.type === "math"
          ? position >= block.start &&
            selection[1] <= block.start + block.text.length
          : inlineParts(block.text).some(
              (part) =>
                part.type === "math" &&
                position >= block.start + part.start &&
                selection[1] <= block.start + part.start + part.text.length,
            ),
      );
      if (!inMath) value = "$" + value + "$";
    }
    replace(value, selection[0], selection[1]);
  }
  function select(start, end) {
    focusSource();
    source.setSelectionRange(start, end);
    api.onMove?.();
  }
  function erase() {
    if (api.interceptKey?.("erase")) return;
    const found = eraseAt(source.value, source.selectionStart, source.selectionEnd);
    if (found?.select) select(...found.select);
    else if (found) {
      // Vider une case la rend de nouveau visible.
      const [a, b] = found.remove;
      const empty = source.value[a - 1] === "{" && source.value[b] === "}" && source.value.slice(a, b) !== "□";
      source.setRangeText(empty ? "□" : "", a, b, "end");
      if (empty) source.setSelectionRange(a, a + 1);
      focusSource();
      onChange(false);
    }
  }
  function next() {
    if (api.interceptKey?.("next")) return;
    select(...nextStop(source.value, source.selectionStart, source.selectionEnd));
  }
  const api = { close, insert, erase, next, onInsertStructure: null, intercept: null, interceptKey: null, onMove: null };
  for (const [id, action] of [["key-back", erase], ["key-next", next]]) {
    const key = document.getElementById(id);
    key.addEventListener("mousedown", (event) => event.preventDefault());
    key.addEventListener("click", action);
  }
  for (const structure of STRUCTURES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = structure.icon;
    button.title = structure.label;
    button.setAttribute("aria-label", structure.label);
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      const before = source.value;
      insert(structure.source);
      const id = catalogIdFor(structure.source);
      if (id && source.value !== before) api.onInsertStructure?.(id);
    });
    toolbar.append(button);
  }
  source.addEventListener("compositionstart", () => {
    composing = true;
    close();
  });
  source.addEventListener("compositionend", () => {
    composing = false;
    onChange(true);
    suggest();
  });
  source.addEventListener("input", () => {
    if (!composing) {
      onChange(true);
      suggest();
    }
  });
  source.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (!suggestions.hidden && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      active =
        (active + (event.key === "ArrowDown" ? 1 : -1) + matches.length) %
        matches.length;
      suggestions
        .querySelectorAll("button")
        .forEach((button, index) =>
          button.classList.toggle("active", index === active),
        );
    } else if (!suggestions.hidden && ["Tab", "Enter"].includes(event.key)) {
      event.preventDefault();
      accept(active);
    } else if (
      event.key === "Tab" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      source.value.includes("□")
    ) {
      // Tab passe au □ suivant (Maj+Tab : précédent) ; sans □, navigation normale.
      const value = source.value;
      const at = event.shiftKey
        ? value.lastIndexOf("□", source.selectionStart - 1)
        : value.indexOf("□", source.selectionEnd);
      if (at < 0 || (event.shiftKey && source.selectionStart === 0)) return;
      event.preventDefault();
      source.setSelectionRange(at, at + 1);
    } else if (event.key === "Escape") close();
  });
  source.addEventListener("blur", () =>
    setTimeout(() => {
      if (
        document.activeElement !== source &&
        !suggestions.contains(document.activeElement)
      )
        close();
    }, 150),
  );
  return api;
}
