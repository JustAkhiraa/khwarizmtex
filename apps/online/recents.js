// Outils récemment insérés : identifiants du catalogue seulement, jamais de contenu saisi.
import { CATALOG } from "./catalog.js";

const KEY = "khwarizm-online-recents";
const MAX = 12;
const known = new Map(CATALOG.map((item) => [item.id, item]));

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.filter((id) => known.has(id)))].slice(0, MAX);
  } catch {
    return [];
  }
}

export function createRecents() {
  let ids = load();
  return {
    items: () => ids.map((id) => known.get(id)),
    add(id) {
      if (!known.has(id)) return;
      ids = [id, ...ids.filter((other) => other !== id)].slice(0, MAX);
      try {
        localStorage.setItem(KEY, JSON.stringify(ids));
      } catch {
        // Stockage indisponible : les récents vivent pendant la session.
      }
    },
  };
}

/** Retrouve l'outil du catalogue qui correspond à une source insérée. */
export function catalogIdFor(source) {
  return CATALOG.find((item) => item.source === source)?.id;
}
