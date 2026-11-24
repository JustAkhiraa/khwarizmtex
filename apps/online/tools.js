import { CATALOG, CATEGORIES, searchCatalog, matrixSource } from "./catalog.js";
import { coarse } from "./layout.js";
import { createRecents, createFavorites } from "./recents.js";
const $ = (id) => document.getElementById(id);
/** Clavier de calcul : chiffres et lettres courantes, sans ouvrir le clavier du téléphone. */
const KEYPAD = [
  ["7"], ["8"], ["9"], ["+"], ["x"], ["("],
  ["4"], ["5"], ["6"], ["-", "−", "moins"], ["y"], [")"],
  ["1"], ["2"], ["3"], ["\\times ", "×", "fois"], ["n"], ["a"],
  ["0"], [",", ",", "virgule"], ["=", "=", "égale"], ["\\div ", "÷", "divisé par"], ["i"], ["b"],
];
export function bindTools(editor, source, engine, notify, onChange, getMode) {
  let selection = [0, 0];
  const touch = coarse() || matchMedia("(max-width: 899px)").matches;
  let category = touch ? "keypad" : "structures";
  let limit = 60;
  function remember() {
    selection = [source.selectionStart, source.selectionEnd];
    editor.close();
  }
  function insert(value, dialog) {
    dialog.close();
    editor.insert(value, selection);
  }
  const recents = createRecents();
  const favorites = createFavorites();
  let recentsDirty = false;
  // Symbole affiché par chaque outil, pour chercher « ≤ » comme « \\leq ».
  const symbolCache = new Map();
  function symbolOf(item) {
    if (!symbolCache.has(item.id)) {
      const probe = document.createElement("span");
      try {
        engine.renderToElement(item.source.replaceAll("□", ""), probe, {
          output: "html",
          displayMode: false,
        });
      } catch {
        /* Aperçu impossible : pas de recherche par symbole. */
      }
      symbolCache.set(item.id, probe.textContent.replace(/\s+/g, ""));
    }
    return symbolCache.get(item.id);
  }
  function announce(message) {
    $("tool-status").textContent = "";
    requestAnimationFrame(() => ($("tool-status").textContent = message));
  }
  function pinButton(item) {
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "pin-button";
    const update = () => {
      const on = favorites.has(item.id);
      pin.textContent = on ? "★" : "☆";
      pin.setAttribute("aria-pressed", String(on));
      pin.setAttribute(
        "aria-label",
        (on ? "Retirer des favoris : " : "Épingler en favori : ") + item.label,
      );
      pin.title = on ? "Retirer des favoris" : "Épingler en favori";
    };
    update();
    pin.addEventListener("mousedown", (event) => event.preventDefault());
    pin.addEventListener("click", () => {
      if (!favorites.toggle(item.id)) {
        notify("Douze favoris au plus : retirez-en un pour en épingler un autre.");
        return;
      }
      announce(favorites.has(item.id) ? "Épinglé en favori." : "Retiré des favoris.");
      if (category === "favorites" && !$("palette-search").value.trim()) {
        drawPalette();
        $("palette-grid").querySelector(".pin-button")?.focus();
      } else update();
      drawCategories();
    });
    return pin;
  }
  function paletteItem(item) {
    const wrap = document.createElement("div");
    wrap.className = "symbol-item";
    const main = card(item, false);
    wrap.append(main, pinButton(item));
    if (category === "favorites" && !$("palette-search").value.trim())
      main.addEventListener("keydown", (event) => {
        if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        favorites.move(item.id, event.key === "ArrowLeft" ? -1 : 1);
        drawPalette();
        $("palette-grid").querySelector('[data-tool="' + CSS.escape(item.id) + '"]')?.focus();
        announce("Favori déplacé.");
      });
    return wrap;
  }
  function card(item, compact) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = compact ? "recent-chip" : "symbol-card";
    button.setAttribute("aria-label", item.label);
    button.title = item.label + " : " + item.source;
    button.dataset.tool = item.id;
    const preview = document.createElement("span");
    preview.className = "symbol-preview";
    preview.setAttribute("aria-hidden", "true");
    engine.renderToElement(item.source.replaceAll("□", "x"), preview, {
      output: "html",
      displayMode: false,
    });
    button.append(preview);
    if (!compact) {
      const name = document.createElement("span");
      name.className = "symbol-label";
      name.textContent = item.label;
      button.append(name);
    }
    // Garde le curseur dans la source : l'insertion se fait à la sélection actuelle.
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => use(item));
    return button;
  }
  function keypad() {
    return KEYPAD.map(([value, shown = value, label = shown]) => {
      const key = document.createElement("button");
      key.type = "button";
      key.className = "pad-key" + (/^\d$/.test(value) ? " digit" : /^[a-z]$/.test(value) ? " letter" : "");
      key.textContent = shown;
      key.setAttribute("aria-label", label);
      key.addEventListener("mousedown", (event) => event.preventDefault());
      key.addEventListener("click", () => editor.insert(value));
      return key;
    });
  }
  function use(item) {
    const before = source.value;
    editor.insert(item.source);
    if (source.value === before) return;
    announce("Inséré : " + item.label);
    recents.add(item.id);
    // Pas de réordonnancement sous le pointeur : on redessine en quittant la ligne.
    if ($("recent-row").matches(":hover, :focus-within")) recentsDirty = true;
    else drawRecents();
  }
  function drawRecents() {
    recentsDirty = false;
    const items = recents.items();
    $("recent-list").replaceChildren(...items.map((item) => card(item, true)));
    $("recent-row").hidden =
      items.length === 0 || category === "keypad" || Boolean($("palette-search").value.trim());
  }
  for (const type of ["mouseleave", "focusout"])
    $("recent-row").addEventListener(type, () => {
      if (recentsDirty && !$("recent-row").matches(":focus-within")) drawRecents();
    });
  editor.onInsertStructure = (id) => {
    recents.add(id);
    drawRecents();
  };
  drawRecents();
  function drawPalette() {
    const query = $("palette-search").value.trim();
    const pad = !query && category === "keypad";
    $("palette-grid").classList.toggle("keypad", pad);
    $("builders").hidden = pad || Boolean(query);
    $("recent-row").hidden = pad || Boolean(query) || recents.items().length === 0;
    if (pad) {
      $("palette-grid").replaceChildren(...keypad());
      $("palette-count").textContent = "";
      $("palette-more").hidden = true;
      $("palette-clear").hidden = true;
      drawCategories();
      return;
    }
    const items =
      !query && category === "favorites"
        ? favorites.items()
        : searchCatalog(query, query || category === "favorites" ? "all" : category, symbolOf);
    $("palette-clear").hidden = !query;
    $("palette-grid").replaceChildren(
      ...items.slice(0, limit).map((item) => paletteItem(item)),
    );
    $("palette-count").textContent = query
      ? items.length + " résultat" + (items.length > 1 ? "s" : "") + " dans tout le catalogue"
      : category === "favorites"
        ? items.length + " favori" + (items.length > 1 ? "s" : "") + " sur 12 · Alt + flèches pour les ranger"
        : "";
    $("palette-more").hidden = items.length <= limit;
    if (!items.length) {
      const p = document.createElement("p");
      p.className = "palette-empty";
      p.textContent =
        !query && category === "favorites"
          ? "Aucun favori. Touchez ☆ sur un outil pour l’épingler ici."
          : "Aucun résultat. Essayez un nom (inférieur, racine), une commande ou un symbole (≤).";
      $("palette-grid").append(p);
    }
    drawCategories();
  }
  function drawCategories() {
    const query = $("palette-search").value.trim();
    $("palette-categories")
      .querySelectorAll("button")
      .forEach((b) => {
        b.setAttribute("aria-pressed", String(!query && b.dataset.category === category));
        if (b.dataset.category === "favorites")
          b.textContent = "★ Favoris (" + favorites.items().length + ")";
      });
  }
  for (const group of [
    { id: "keypad", label: "123" },
    ...CATEGORIES.slice(0, 1),
    { id: "favorites", label: "★ Favoris" },
    { id: "all", label: "Tout (" + CATALOG.length + ")" },
    ...CATEGORIES.slice(1),
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = group.label;
    button.dataset.category = group.id;
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      category = group.id;
      limit = 60;
      $("palette-search").value = "";
      searching(false);
      panel(true);
      drawPalette();
      $("palette-panel").scrollTop = 0;
      button.scrollIntoView({ block: "nearest", inline: "center" });
    });
    $("palette-categories").append(button);
  }
  const narrow = matchMedia("(max-width: 899px)");
  function panel(open) {
    $("palette-panel").hidden = !open;
    $("palette-open").setAttribute("aria-expanded", String(open));
  }
  function searching(open) {
    $("palette-search-row").hidden = !open;
    $("search-open").setAttribute("aria-expanded", String(open));
    if (!open && $("palette-search").value) {
      $("palette-search").value = "";
      drawPalette();
    }
  }
  $("palette-open").addEventListener("mousedown", (event) => event.preventDefault());
  $("palette-open").addEventListener("click", () => {
    // Le clavier du téléphone prend la place des symboles : on le ferme d'abord.
    if (document.documentElement.classList.contains("keyboard-open")) {
      document.activeElement.blur();
      panel(true);
    } else panel($("palette-panel").hidden);
  });
  $("search-open").addEventListener("click", () => {
    const open = $("palette-search-row").hidden;
    panel(true);
    searching(open);
    if (open) $("palette-search").focus({ preventScroll: true });
  });
  function modeChanged() {
    const isDocument = getMode() === "document";
    // Un cours s'écrit surtout en texte : le clavier de calcul reste à la formule.
    $("palette-categories").querySelector('[data-category="keypad"]').hidden = isDocument || !touch;
    if (isDocument && category === "keypad") category = "structures";
    panel(!(isDocument && narrow.matches));
    drawPalette();
  }
  // Échap ramène à la source, sans fermer le panneau.
  $("palette-panel").addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (event.target === $("palette-search") && $("palette-search").value) return;
    event.preventDefault();
    source.focus();
  });
  $("palette-search").addEventListener("input", () => {
    limit = 60;
    drawPalette();
  });
  $("palette-clear").addEventListener("click", () => {
    $("palette-search").value = "";
    drawPalette();
    $("palette-search").focus();
  });
  $("palette-more").addEventListener("click", () => {
    limit += 60;
    drawPalette();
  });
  let rows = 2,
    columns = 2;
  let cells = new Map();
  function matrixGrid() {
    $("matrix-grid")
      .querySelectorAll("input")
      .forEach((input) => cells.set(input.dataset.cell, input.value));
    rows = Number($("matrix-rows").value);
    columns = Number($("matrix-columns").value);
    $("matrix-grid").replaceChildren();
    $("matrix-grid").style.setProperty("--columns", columns);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++) {
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 150;
        input.placeholder = "□";
        input.dataset.cell = r + ":" + c;
        input.value = cells.get(input.dataset.cell) || "";
        input.setAttribute(
          "aria-label",
          "Ligne " + (r + 1) + ", colonne " + (c + 1),
        );
        input.addEventListener("input", drawMatrix);
        $("matrix-grid").append(input);
      }
    drawMatrix();
  }
  function getMatrix() {
    return matrixSource(
      rows,
      columns,
      $("matrix-brackets").value,
      [...$("matrix-grid").querySelectorAll("input")].map(
        (input) => input.value,
      ),
    );
  }
  function drawMatrix() {
    try {
      const value = getMatrix();
      engine.renderToElement(value, $("matrix-preview"), { displayMode: true });
      $("matrix-error").textContent = "";
      $("matrix-insert").disabled = false;
    } catch (error) {
      $("matrix-error").textContent = error.message;
      $("matrix-insert").disabled = true;
    }
  }
  $("matrix-open").addEventListener("click", () => {
    remember();
    matrixGrid();
    $("matrix-dialog").showModal();
  });
  for (const id of ["matrix-rows", "matrix-columns"])
    $(id).addEventListener("change", matrixGrid);
  $("matrix-brackets").addEventListener("change", drawMatrix);
  $("matrix-identity").addEventListener("click", () => {
    $("matrix-grid")
      .querySelectorAll("input")
      .forEach((input) => {
        const [r, c] = input.dataset.cell.split(":");
        input.value = r === c ? "1" : "0";
      });
    drawMatrix();
  });
  $("matrix-insert").addEventListener("click", () => {
    try {
      insert(getMatrix(), $("matrix-dialog"));
    } catch (error) {
      notify(error.message);
    }
  });
  $("appearance-open").addEventListener("click", () => {
    remember();
    $("appearance-dialog").showModal();
  });
  $("apply-color").addEventListener("click", () => {
    const color = $("formula-color").value;
    if (/^#[0-9a-f]{6}$/i.test(color))
      insert("\\textcolor{" + color + "}{□}", $("appearance-dialog"));
  });
  $("preview-size").addEventListener("input", () => {
    const size = Math.min(48, Math.max(12, Number($("preview-size").value)));
    $("preview-size-value").textContent = size + " px";
    $("preview").style.setProperty("--formula-size", size + "px");
  });
  $("preview-background").addEventListener("change", () => {
    const value = $("preview-background").value;
    const colors = {
      auto: "",
      white: "#ffffff",
      ivory: "#fff8e7",
      mint: "#eaf7ef",
      night: "#1a2038",
    };
    $("preview-surface").style.backgroundColor = colors[value] || "";
    $("preview-pane").style.backgroundColor = colors[value] || "";
    $("preview").style.setProperty(
      "--preview-ink",
      value === "auto" ? "inherit" : value === "night" ? "#f6f6ff" : "#222238",
    );
  });
  $("join-lines").addEventListener("click", () => {
    // Ne touche qu'aux retours de ligne réels, jamais aux séparateurs \\.
    if (
      source.value.includes("\n") &&
      window.confirm(
        "Remplacer les retours de ligne par des espaces ? En mode Document, cela modifie aussi la structure du texte. Vous pourrez annuler.",
      )
    ) {
      source.value = source.value.replace(/\r?\n/g, " ");
      onChange(false);
      source.focus();
    }
  });
  return { modeChanged };
}
