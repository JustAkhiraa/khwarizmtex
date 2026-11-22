import { CATALOG, CATEGORIES, searchCatalog, matrixSource } from "./catalog.js";
import { createRecents } from "./recents.js";
const $ = (id) => document.getElementById(id);
export function bindTools(editor, source, engine, notify, onChange) {
  let selection = [0, 0];
  let category = "structures";
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
  let recentsDirty = false;
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
  function use(item) {
    const before = source.value;
    editor.insert(item.source);
    if (source.value === before) return;
    recents.add(item.id);
    // Pas de réordonnancement sous le pointeur : on redessine en quittant la ligne.
    if ($("recent-row").matches(":hover, :focus-within")) recentsDirty = true;
    else drawRecents();
  }
  function drawRecents() {
    recentsDirty = false;
    const items = recents.items();
    $("recent-list").replaceChildren(...items.map((item) => card(item, true)));
    $("recent-row").hidden = items.length === 0;
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
    const items = searchCatalog(query, query ? "all" : category);
    $("palette-clear").hidden = !query;
    $("palette-grid").replaceChildren(
      ...items.slice(0, limit).map((item) => card(item, false)),
    );
    $("palette-count").textContent = query
      ? items.length + " résultat" + (items.length > 1 ? "s" : "") + " dans tout le catalogue"
      : items.length + " choix";
    $("palette-more").hidden = items.length <= limit;
    if (!items.length) {
      const p = document.createElement("p");
      p.textContent = "Aucun résultat. Essayez un nom ou une commande.";
      $("palette-grid").append(p);
    }
    $("science-note").hidden = category !== "chemistry" || Boolean(query);
    $("palette-categories")
      .querySelectorAll("button")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(!query && b.dataset.category === category),
        ),
      );
  }
  for (const group of [
    { id: "all", label: "Tout (" + CATALOG.length + ")" },
    ...CATEGORIES,
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
      drawPalette();
    });
    $("palette-categories").append(button);
  }
  let drawn = false;
  $("palette-open").addEventListener("click", () => {
    const open = $("palette-panel").hidden;
    $("palette-panel").hidden = !open;
    $("palette-open").setAttribute("aria-expanded", String(open));
    $("palette-open").textContent = open ? "Réduire les symboles" : "Tous les symboles";
    if (open && !drawn) {
      drawn = true;
      drawPalette();
    }
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
    $("preview-surface").style.backgroundImage = value === "auto" ? "" : "none";
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
}
