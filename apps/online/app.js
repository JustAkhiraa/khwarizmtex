import { EXAMPLES } from "./presets.js";
import {
  History,
  loadState,
  saveState,
  validateState,
  encodeFormula,
  decodeFormula,
  initialState,
} from "./model.js";
import { renderDocument } from "./document.js";
import { bindEditor } from "./editor.js";
import { bindTools } from "./tools.js";
import { bindImports } from "./imports.js";
import { download, filename, copyText, mathml } from "./exports.js";

const $ = (id) => document.getElementById(id);
const engine = window.KhwarizmTeX;
const source = $("source");
const title = $("title");
let storage;
let loaded;
try {
  storage = window.localStorage;
  loaded = loadState(storage);
} catch {
  loaded = {
    state: initialState(),
    warning: "Sauvegarde locale indisponible. Utilisez les exports.",
  };
}
let state = loaded.state;
try {
  const shared = decodeFormula(location.hash);
  if (shared !== null) {
    state.mode = "formula";
    state.formula = { title: "Formule partagée", source: shared };
    loaded.warning =
      "Formule partagée ouverte. Le brouillon précédent reste sauvegardé jusqu’à votre prochaine modification.";
  }
} catch {
  loaded.warning =
    "Ce lien de partage est invalide. Votre brouillon a été conservé.";
}
const histories = {
  formula: new History(state.formula),
  document: new History(state.document),
};
let renderTimer;
let saveTimer;
let toastTimer;
let zoom = 1;

function notify(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("toast").hidden = true;
  }, 6000);
}
function persist() {
  clearTimeout(saveTimer);
  const saved = saveState(storage, state);
  $("save-status").textContent = saved
    ? "Enregistré sur cet appareil"
    : "Sauvegarde indisponible";
  if (!saved)
    notify(
      "Le navigateur ne permet pas la sauvegarde. Exportez votre travail pour le conserver.",
    );
}
function schedule() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 100);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 250);
  $("save-status").textContent = "Enregistrement…";
}
function historyButtons() {
  $("undo").disabled = !histories[state.mode].canUndo;
  $("redo").disabled = !histories[state.mode].canRedo;
}
function edit(group) {
  state[state.mode] = { source: source.value, title: title.value };
  histories[state.mode].push(state[state.mode], group);
  historyButtons();
  schedule();
  $("character-count").textContent =
    source.value.length.toLocaleString("fr") + " car.";
}
function showErrors(errors) {
  $("error-list").replaceChildren();
  for (const error of errors.slice(0, 20)) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    const line = source.value.slice(0, error.start).split("\n").length;
    button.textContent = "Ligne " + line + " · " + error.message;
    button.addEventListener("click", () => {
      source.focus();
      source.setSelectionRange(error.start, error.end);
    });
    li.append(button);
    $("error-list").append(li);
  }
  $("diagnostics").hidden = errors.length === 0;
}
function render() {
  clearTimeout(renderTimer);
  const start = performance.now();
  const preview = $("preview");
  try {
    let errors;
    if (state.mode === "document") {
      const result = renderDocument(source.value, title.value, preview, engine);
      errors = result.errors;
    } else {
      engine.renderToElement(source.value, preview, {
        displayMode: true,
        maxLength: 50000,
        maxDepth: 64,
        maxExpand: 500,
      });
      errors = engine.parse(source.value, {
        maxLength: 50000,
        maxDepth: 64,
        maxExpand: 500,
      }).errors;
    }
    showErrors(errors);
    $("render-status").textContent = errors.length
      ? errors.length + " point(s) à vérifier"
      : "Rendu en " +
        Math.max(1, Math.round(performance.now() - start)) +
        " ms";
  } catch (error) {
    preview.replaceChildren();
    const message = document.createElement("p");
    message.textContent =
      "Cet aperçu ne peut pas être affiché. Votre source est conservée.";
    preview.append(message);
    showErrors([
      {
        message: error.message || "Erreur de rendu",
        start: 0,
        end: source.value.length,
      },
    ]);
    $("render-status").textContent = "Aperçu indisponible";
  }
}
function syncView() {
  source.value = state[state.mode].source;
  title.value = state[state.mode].title;
  const isDocument = state.mode === "document";
  $("workspace").classList.toggle("document-mode", isDocument);
  $("preview").className = isDocument ? "document-preview" : "formula-preview";
  $("breadcrumb-mode").textContent = isDocument ? "Document" : "Formule";
  $("language").textContent = isDocument ? "Texte + maths" : "Formule";
  $("copy").textContent = isDocument ? "Copier la source" : "Copier la formule";
  $("share").hidden = isDocument;
  $("export-mathml").hidden = isDocument;
  $("source-help").textContent = isDocument
    ? "Titres # · Maths $…$ · Blocs $$ sur lignes séparées"
    : "Une commande commence par \\ · Tab pour compléter";
  $("character-count").textContent =
    source.value.length.toLocaleString("fr") + " car.";
  document
    .querySelectorAll("[data-mode]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.mode === state.mode),
      ),
    );
  editor.close();
  historyButtons();
  render();
}
function switchMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  syncView();
  persist();
}
function moveHistory(direction) {
  state[state.mode] = histories[state.mode].move(direction);
  syncView();
  persist();
}
const editor = bindEditor(
  source,
  $("math-toolbar"),
  $("suggestions"),
  edit,
  notify,
  () => state.mode,
);
bindTools(editor, source, engine, notify, edit);
bindImports((imported) => {
  if (imported.kind === "backup") {
    for (const mode of ["formula", "document"])
      histories[mode].push(imported.state[mode]);
    state = imported.state;
  } else {
    const mode = imported.kind;
    state[mode] = { title: imported.title, source: imported.source };
    histories[mode].push(state[mode]);
    state.mode = mode;
  }
  syncView();
  persist();
  notify("Import terminé. Annuler permet de retrouver le brouillon précédent.");
});
title.addEventListener("input", () => edit(true));
$("undo").addEventListener("click", () => moveHistory(-1));
$("redo").addEventListener("click", () => moveHistory(1));
document
  .querySelectorAll("[data-mode]")
  .forEach((button) =>
    button.addEventListener("click", () => switchMode(button.dataset.mode)),
  );
$("atelier").addEventListener("click", () => source.focus());

function loadExample(example) {
  const mode = example.mode || "formula";
  state[mode] = { source: example.source, title: example.title };
  histories[mode].push(state[mode]);
  state.mode = mode;
  syncView();
  persist();
  $("library-dialog").close();
  notify("Exemple chargé. Annuler permet de retrouver votre brouillon.");
}
function fillLibrary(query = "") {
  $("examples").replaceChildren();
  const normalized = query.toLocaleLowerCase("fr");
  for (const example of EXAMPLES.filter((e) =>
    (e.title + " " + e.category).toLocaleLowerCase("fr").includes(normalized),
  )) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "example-card";
    const label = document.createElement("strong");
    label.textContent = example.title;
    const category = document.createElement("small");
    category.textContent = example.category;
    const formula = document.createElement("span");
    formula.className = "example-math";
    if (example.mode) formula.textContent = "Texte, équations et références";
    else engine.renderToElement(example.source, formula, { displayMode: true });
    button.append(label, formula, category);
    button.addEventListener("click", () => loadExample(example));
    $("examples").append(button);
  }
  if (!$("examples").children.length) {
    const empty = document.createElement("p");
    empty.textContent = "Aucun exemple trouvé. Essayez un autre mot.";
    $("examples").append(empty);
  }
}
for (const example of EXAMPLES.slice(0, 4)) {
  const button = document.createElement("button");
  button.type = "button";
  const symbol = document.createElement("span");
  symbol.textContent = example.symbol;
  symbol.setAttribute("aria-hidden", "true");
  button.append(symbol, example.title);
  button.addEventListener("click", () => loadExample(example));
  $("quick-examples").append(button);
}
document.querySelectorAll("[data-library]").forEach((button) =>
  button.addEventListener("click", () => {
    fillLibrary();
    $("example-search").value = "";
    $("library-dialog").showModal();
    $("example-search").focus();
  }),
);
$("example-search").addEventListener("input", () =>
  fillLibrary($("example-search").value),
);
document
  .querySelectorAll("[data-help]")
  .forEach((button) =>
    button.addEventListener("click", () => $("help-dialog").showModal()),
  );
document
  .querySelectorAll("[data-close]")
  .forEach((button) =>
    button.addEventListener("click", () => button.closest("dialog").close()),
  );
$("export-open").addEventListener("click", () =>
  $("export-dialog").showModal(),
);

$("copy").addEventListener("click", async () => {
  try {
    await copyText(source.value);
    notify("Source copiée.");
  } catch (error) {
    notify(error.message);
  }
});
$("share").addEventListener("click", async () => {
  try {
    const url = new URL(location.href);
    url.hash = "f=" + encodeFormula(source.value);
    await copyText(url.href);
    notify(
      location.hostname === "127.0.0.1" || location.hostname === "localhost"
        ? "Lien copié. Cette adresse locale ne fonctionne que sur cet ordinateur."
        : "Lien copié. Il contient la formule : partagez-le uniquement avec les personnes choisies.",
    );
  } catch (error) {
    notify(error.message);
  }
});
document.querySelectorAll("[data-export]").forEach((button) =>
  button.addEventListener("click", async () => {
    try {
      const kind = button.dataset.export;
      const name = filename(title.value);
      if (kind === "source")
        download(
          source.value,
          "text/plain;charset=utf-8",
          name + (state.mode === "formula" ? ".tex" : ".md"),
        );
      if (kind === "mathml")
        download(
          mathml(source.value, engine),
          "application/mathml+xml",
          name + ".mml",
        );
      if (kind === "backup")
        download(
          JSON.stringify(state, null, 2),
          "application/json",
          "khwarizm-atelier.json",
        );
      $("export-dialog").close();
      if (kind === "print") {
        render();
        await document.fonts.ready;
        const previous = document.title;
        document.title = title.value || "KhwarizmTeX";
        window.print();
        document.title = previous;
      }
    } catch (error) {
      notify(error.message || "Export indisponible.");
    }
  }),
);
$("import-open").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async () => {
  const file = $("import-file").files[0];
  $("import-file").value = "";
  if (!file) return;
  try {
    if (file.size > 650000) throw new Error("Ce fichier est trop volumineux.");
    const imported = validateState(JSON.parse(await file.text()));
    if (
      !window.confirm(
        "Remplacer les deux brouillons par cette sauvegarde ? Vous pourrez revenir en arrière avec Annuler dans chaque mode.",
      )
    )
      return;
    for (const mode of ["formula", "document"])
      histories[mode].push(imported[mode]);
    state = imported;
    syncView();
    persist();
    $("export-dialog").close();
    notify("Les deux brouillons ont été restaurés.");
  } catch (error) {
    notify("Import refusé : " + error.message);
  }
});
function setZoom(delta) {
  zoom = Math.max(0.6, Math.min(1.8, Math.round((zoom + delta) * 10) / 10));
  $("preview").style.setProperty("--zoom", zoom);
  $("zoom-value").textContent = Math.round(zoom * 100) + " %";
  $("zoom-out").disabled = zoom === 0.6;
  $("zoom-in").disabled = zoom === 1.8;
}
$("zoom-in").addEventListener("click", () => setZoom(0.1));
$("zoom-out").addEventListener("click", () => setZoom(-0.1));
const preference = window.matchMedia("(prefers-color-scheme: dark)");
let explicitTheme = null;
try {
  explicitTheme = storage.getItem("khwarizm-theme");
} catch {
  /* Thème système. */
}
function applyTheme() {
  document.documentElement.dataset.theme =
    explicitTheme === "dark" ||
    (explicitTheme !== "light" && preference.matches)
      ? "dark"
      : "light";
}
applyTheme();
preference.addEventListener("change", applyTheme);
$("theme").addEventListener("click", () => {
  explicitTheme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme();
  try {
    storage.setItem("khwarizm-theme", explicitTheme);
  } catch {
    /* Session seulement. */
  }
});
document.addEventListener("keydown", (event) => {
  if (
    !(event.metaKey || event.ctrlKey) ||
    event.altKey ||
    event.isComposing ||
    document.querySelector("dialog[open]")
  )
    return;
  const key = event.key.toLowerCase();
  if (key === "s") {
    event.preventDefault();
    persist();
  }
  if (key === "z") {
    event.preventDefault();
    moveHistory(event.shiftKey ? 1 : -1);
  }
  if (key === "y") {
    event.preventDefault();
    moveHistory(1);
  }
});
document.addEventListener("visibilitychange", () => {
  if (
    document.visibilityState === "hidden" &&
    $("save-status").textContent === "Enregistrement…"
  )
    persist();
});
window.addEventListener("pagehide", () => {
  if ($("save-status").textContent === "Enregistrement…") persist();
});
if (!engine?.renderAllToNodes) {
  $("startup").textContent =
    "Le moteur doit être reconstruit. Lancez npm run online, puis rechargez cette page.";
} else {
  syncView();
  $("startup").hidden = true;
  if (loaded.warning) {
    $("save-status").textContent = "Vérifiez la sauvegarde";
    notify(loaded.warning);
  }
}
