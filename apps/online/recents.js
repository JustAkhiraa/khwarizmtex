// Préférences d'outils : identifiants du catalogue seulement, jamais de contenu saisi.
// Stockées à part des brouillons ; un stockage bloqué les garde pour la session.
import { CATALOG } from "./catalog.js";

const MAX = 12;
const known = new Map(CATALOG.map((item) => [item.id, item]));
// Les anciens identifiants (famille-rang) restent lisibles après la mise à jour.
const legacy = new Map(CATALOG.map((item) => [item.legacyId, item.id]));

function load(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(raw)) return [];
    const ids = raw
      .map((id) => (known.has(id) ? id : legacy.get(id)))
      .filter(Boolean);
    return [...new Set(ids)].slice(0, MAX);
  } catch {
    return [];
  }
}
function store(key, ids) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Stockage indisponible : la liste vit pendant la session.
  }
}

/** Derniers outils utilisés, le plus récent en premier. */
export function createRecents(key = "khwarizm-online-recents") {
  let ids = load(key);
  return {
    items: () => ids.map((id) => known.get(id)),
    add(id) {
      if (!known.has(id)) return;
      ids = [id, ...ids.filter((other) => other !== id)].slice(0, MAX);
      store(key, ids);
    },
  };
}

/** Favoris épinglés : ordre choisi par l'utilisateur, jamais réordonné seul. */
export function createFavorites(key = "khwarizm-online-favorites") {
  let ids = load(key);
  return {
    items: () => ids.map((id) => known.get(id)),
    has: (id) => ids.includes(id),
    get full() {
      return ids.length >= MAX;
    },
    /** Épingle ou retire ; renvoie false si la liste est pleine. */
    toggle(id) {
      if (!known.has(id)) return false;
      if (ids.includes(id)) ids = ids.filter((other) => other !== id);
      else if (ids.length >= MAX) return false;
      else ids = [...ids, id];
      store(key, ids);
      return true;
    },
    move(id, delta) {
      const from = ids.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= ids.length) return;
      const next = [...ids];
      [next[from], next[to]] = [next[to], next[from]];
      ids = next;
      store(key, ids);
    },
  };
}

/** Retrouve l'outil du catalogue qui correspond à une source insérée. */
export function catalogIdFor(source) {
  return CATALOG.find((item) => item.source === source)?.id;
}
