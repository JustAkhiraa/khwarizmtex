// Modèle du dessin de molécule, sans DOM : géométrie, modifications, lecture et écriture.
// Les positions sont en longueurs de liaison, ordonnée vers le bas.
export const MARKS = ["-", "=", "#", ">", "<"];
const LIMIT = 40;
const round = (v) => Math.round(v * 100) / 100 || 0;

export function readMolecule(source) {
  const m = /^\s*\\molecule\{([^{}]*)\}\s*$/.exec(source);
  if (!m) return null;
  const [atomText = "", bondText = ""] = m[1].split("|");
  const list = (s) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  const atoms = [];
  for (const item of list(atomText)) {
    const a = /^([A-Z][a-z]?)\s*([+-]?)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)$/.exec(item);
    if (!a) return null;
    atoms.push({ element: a[1], charge: a[2], x: Number(a[3]), y: Number(a[4]) });
  }
  const bonds = [];
  for (const item of list(bondText)) {
    const b = /^(\d+)\s*([-=#<>])\s*(\d+)$/.exec(item);
    if (!b || !atoms[b[1] - 1] || !atoms[b[3] - 1] || b[1] === b[3]) return null;
    bonds.push({ from: b[1] - 1, to: b[3] - 1, mark: b[2] });
  }
  return { atoms, bonds };
}

export function writeMolecule({ atoms, bonds }) {
  if (!atoms.length) return "";
  const a = atoms.map((t) => `${t.element}${t.charge} ${round(t.x)} ${round(t.y)}`).join(", ");
  const b = bonds.map((t) => `${t.from + 1}${t.mark}${t.to + 1}`).join(", ");
  return "\\molecule{" + a + (b ? " | " + b : "") + "}";
}

export function nearestAtom(model, x, y, reach = 0.35) {
  let best = -1;
  let distance = reach;
  model.atoms.forEach((atom, i) => {
    const d = Math.hypot(atom.x - x, atom.y - y);
    if (d < distance) [best, distance] = [i, d];
  });
  return best;
}

export function nearestBond(model, x, y, reach = 0.22) {
  let best = -1;
  let distance = reach;
  model.bonds.forEach((bond, i) => {
    const a = model.atoms[bond.from];
    const b = model.atoms[bond.to];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(a.x + t * dx - x, a.y + t * dy - y);
    if (d < distance) [best, distance] = [i, d];
  });
  return best;
}

/** Bout d'une liaison tirée depuis `from` : longueur 1, angle multiple de 30°. */
export function snap(from, x, y) {
  const step = Math.PI / 6;
  const angle = Math.round(Math.atan2(y - from.y, x - from.x) / step) * step;
  return { x: round(from.x + Math.cos(angle)), y: round(from.y + Math.sin(angle)) };
}

/** Direction la plus dégagée autour d'un atome, pour y ajouter une liaison. */
export function freeSpot(model, index) {
  const atom = model.atoms[index];
  const angles = model.bonds
    .filter((b) => b.from === index || b.to === index)
    .map((b) => model.atoms[b.from === index ? b.to : b.from])
    .map((o) => Math.atan2(o.y - atom.y, o.x - atom.x));
  let best = -Math.PI / 6;
  let score = -1;
  for (let k = 0; k < 12; k++) {
    const angle = -Math.PI / 6 + (k * Math.PI) / 6;
    // À 120° d'une seule liaison : la chaîne dessine un zigzag.
    const gap = Math.min(
      (2 * Math.PI) / 3,
      ...angles.map((a) => Math.abs(Math.atan2(Math.sin(angle - a), Math.cos(angle - a)))),
    );
    const spot = { x: atom.x + Math.cos(angle), y: atom.y + Math.sin(angle) };
    const free = nearestAtom(model, spot.x, spot.y, 0.5) < 0 ? 1 : 0;
    if (gap + free * 4 > score + 1e-6) [best, score] = [angle, gap + free * 4];
  }
  return { x: round(atom.x + Math.cos(best)), y: round(atom.y + Math.sin(best)) };
}

export function addAtom(model, element, x, y) {
  if (model.atoms.length >= 120 || Math.abs(x) > LIMIT || Math.abs(y) > LIMIT) return -1;
  model.atoms.push({ element, charge: "", x: round(x), y: round(y) });
  return model.atoms.length - 1;
}

/** Pose ou remplace une liaison entre deux atomes. */
export function connect(model, from, to, mark) {
  if (from === to || from < 0 || to < 0) return;
  const bond = model.bonds.find(
    (b) => (b.from === from && b.to === to) || (b.from === to && b.to === from),
  );
  if (bond) Object.assign(bond, { from, to, mark });
  else if (model.bonds.length < 160) model.bonds.push({ from, to, mark });
}

export function removeAtom(model, index) {
  model.atoms.splice(index, 1);
  model.bonds = model.bonds
    .filter((b) => b.from !== index && b.to !== index)
    .map((b) => ({
      ...b,
      from: b.from > index ? b.from - 1 : b.from,
      to: b.to > index ? b.to - 1 : b.to,
    }));
}

/** Cycle régulier centré en (x, y) ; `alternate` : une liaison double sur deux. */
export function addRing(model, size, x, y, alternate) {
  const radius = 1 / (2 * Math.sin(Math.PI / size));
  const ids = [];
  for (let k = 0; k < size; k++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * k) / size;
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    // Un sommet posé sur un atome existant le réutilise : les cycles s'accolent.
    const near = nearestAtom(model, px, py, 0.3);
    ids.push(near >= 0 ? near : addAtom(model, "C", px, py));
  }
  if (ids.includes(-1)) return false;
  ids.forEach((id, k) => {
    const next = ids[(k + 1) % size];
    const exists = model.bonds.some(
      (b) => (b.from === id && b.to === next) || (b.from === next && b.to === id),
    );
    if (!exists) connect(model, id, next, alternate && k % 2 === 0 ? "=" : "-");
  });
  return true;
}
