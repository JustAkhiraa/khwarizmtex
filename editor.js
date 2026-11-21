import { COMMANDS, STRUCTURES } from "./presets.js";
import { MAX_SOURCE } from "./model.js";

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
    if (source.value.length - (end - start) + value.length > MAX_SOURCE) {
      notify("La limite de 50 000 caractères est atteinte.");
      return;
    }
    const placeholder = value.indexOf("□");
    source.setRangeText(value, start, end, "end");
    source.focus({ preventScroll: true });
    if (placeholder >= 0)
      source.setSelectionRange(start + placeholder, start + placeholder + 1);
    close();
    onChange(false);
  }
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
    matches = COMMANDS.filter((c) => c[0].startsWith(match[1])).slice(0, 5);
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
  for (const structure of STRUCTURES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = structure.icon;
    button.title = structure.label;
    button.setAttribute("aria-label", structure.label);
    button.addEventListener("click", () => {
      let value = structure.source;
      // Le document garde une grammaire simple : l’insertion crée une formule inline
      // sauf si le curseur est déjà dans des délimiteurs mathématiques.
      if (getMode() === "document") {
        const before = source.value.slice(0, source.selectionStart);
        const displayCount = (before.match(/^\s*\$\$\s*$/gm) || []).length;
        const last = before
          .slice(before.lastIndexOf("\n") + 1)
          .replace(/\\\$/g, "");
        const inlineCount = (last.match(/\$/g) || []).length;
        if (displayCount % 2 === 0 && inlineCount % 2 === 0)
          value = "$" + value + "$";
      }
      replace(value);
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
    } else if (event.key === "Escape") close();
  });
  source.addEventListener("blur", () =>
    setTimeout(() => {
      if (!suggestions.contains(document.activeElement)) close();
    }, 150),
  );
  return { close };
}
