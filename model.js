import { INITIAL_FORMULA, INITIAL_DOCUMENT } from "./presets.js";

export const MAX_SOURCE = 50000;
export const STORAGE_KEY = "khwarizm-online-v1";
export function initialState() {
  return {
    version: 1,
    mode: "formula",
    formula: { title: "L’intégrale de Gauss", source: INITIAL_FORMULA },
    document: {
      title: "Les équations du second degré",
      source: INITIAL_DOCUMENT,
    },
  };
}
export function validateState(value) {
  if (
    !value ||
    value.version !== 1 ||
    !["formula", "document"].includes(value.mode)
  )
    throw new Error("Format de sauvegarde inconnu.");
  for (const mode of ["formula", "document"]) {
    const item = value[mode];
    if (
      !item ||
      typeof item.title !== "string" ||
      item.title.length > 100 ||
      typeof item.source !== "string" ||
      item.source.length > MAX_SOURCE
    )
      throw new Error("Sauvegarde invalide ou trop volumineuse.");
  }
  // Copie uniquement les champs autorisés, sans fusion d’objets non fiables.
  return {
    version: 1,
    mode: value.mode,
    formula: { title: value.formula.title, source: value.formula.source },
    document: { title: value.document.title, source: value.document.source },
  };
}
export function loadState(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return {
      state: raw ? validateState(JSON.parse(raw)) : initialState(),
      warning: "",
    };
  } catch {
    return {
      state: initialState(),
      warning:
        "La sauvegarde est indisponible ou illisible. Elle n’a pas été effacée ; exportez votre travail.",
    };
  }
}
export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(validateState(state)));
    return true;
  } catch {
    return false;
  }
}
export class History {
  constructor(value) {
    this.items = [{ ...value }];
    this.index = 0;
    this.lastEdit = 0;
  }
  push(value, group = false, now = Date.now()) {
    if (JSON.stringify(value) === JSON.stringify(this.items[this.index]))
      return;
    const merge =
      group &&
      this.lastEdit > 0 &&
      now - this.lastEdit < 600 &&
      this.index > 0 &&
      this.index === this.items.length - 1;
    this.items = this.items.slice(0, this.index + 1);
    if (merge) this.items[this.index] = { ...value };
    else {
      this.items.push({ ...value });
      if (this.items.length > 80) this.items.shift();
      this.index = this.items.length - 1;
    }
    this.lastEdit = group ? now : 0;
  }
  move(delta) {
    this.index = Math.max(
      0,
      Math.min(this.items.length - 1, this.index + delta),
    );
    this.lastEdit = 0;
    return { ...this.items[this.index] };
  }
  get canUndo() {
    return this.index > 0;
  }
  get canRedo() {
    return this.index < this.items.length - 1;
  }
}
export function encodeFormula(source) {
  if (source.length > 4000)
    throw new Error(
      "Pour une formule longue, utilisez l’export de source plutôt qu’un lien.",
    );
  const bytes = new TextEncoder().encode(source);
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function decodeFormula(hash) {
  if (!hash.startsWith("#f=")) return null;
  if (hash.length > 22000) throw new Error("Lien de partage trop long.");
  const bytes = Uint8Array.from(
    atob(hash.slice(3).replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (source.length > 4000) throw new Error("Formule partagée trop longue.");
  return source;
}
