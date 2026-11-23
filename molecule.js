// Fenêtre de dessin d'une molécule : on tire des liaisons, la source suit.
import {
  addAtom, addRing, connect, freeSpot, nearestAtom, nearestBond, readMolecule, removeAtom, snap, writeMolecule,
} from "./molecule-model.js";

const $ = (id) => document.getElementById(id);
const SCALE = 45;
const SVG = "http://www.w3.org/2000/svg";
const TEMPLATES = {
  ethanol: "\\molecule{C 0 0, C 0.87 -0.5, O 1.73 0 | 1-2, 2-3}",
  acetic: "\\molecule{C 0 0, C 0.87 -0.5, O 1.73 0, O 0.87 -1.5 | 1-2, 2-3, 2=4}",
  water: "\\molecule{O 0 0}",
};

export function bindMolecule(editor, source, engine, notify) {
  let model = { atoms: [], bonds: [] };
  let tool = { kind: "atom", value: "C" };
  let mark = "-";
  let past = [];
  let drag = null;
  let range = [0, 0];
  const board = $("molecule-board");

  const copy = () => JSON.parse(JSON.stringify(model));
  function change(action) {
    const before = copy();
    action();
    if (JSON.stringify(before) === JSON.stringify(model)) return;
    past.push(before);
    if (past.length > 60) past.shift();
    draw();
    $("molecule-source").value = writeMolecule(model);
    check();
  }
  function shape(tag, attributes, text) {
    const element = document.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (text) element.textContent = text;
    return element;
  }
  function size() {
    const box = board.getBoundingClientRect();
    return { w: box.width || 600, h: box.height || 320, box };
  }
  // Le dessin est celui du moteur ; par-dessus, des repères invisibles pour viser.
  function draw(preview) {
    const { w, h } = size();
    board.setAttribute("viewBox", `${-w / 2} ${-h / 2} ${w} ${h}`);
    board.replaceChildren();
    const shown = writeMolecule(model);
    if (shown) {
      const holder = document.createElement("div");
      engine.renderToElement(shown, holder, { output: "html", displayMode: false });
      const svg = holder.querySelector(".khw-molecule");
      if (svg) {
        const layer = shape("g", { class: "molecule-drawing" });
        layer.append(...svg.childNodes);
        board.append(layer);
      }
    }
    for (const atom of model.atoms)
      board.append(shape("circle", { cx: atom.x * SCALE, cy: atom.y * SCALE, r: 9, class: "molecule-dot" }));
    if (preview)
      board.append(
        shape("line", {
          x1: preview.from.x * SCALE, y1: preview.from.y * SCALE, x2: preview.to.x * SCALE, y2: preview.to.y * SCALE,
          class: "molecule-preview",
        }),
      );
    $("molecule-undo").disabled = past.length === 0;
    $("molecule-empty").hidden = model.atoms.length > 0;
  }
  function check() {
    const text = $("molecule-source").value.trim();
    const errors = text ? engine.parse(text).errors : [];
    $("molecule-error").textContent = errors[0]?.message || "";
    $("molecule-insert").disabled = !text || errors.length > 0 || !readMolecule(text);
  }
  function place(event) {
    const { w, h, box } = size();
    return {
      x: (event.clientX - box.left - w / 2) / SCALE,
      y: (event.clientY - box.top - h / 2) / SCALE,
    };
  }
  function target(point, from) {
    const near = nearestAtom(model, point.x, point.y);
    if (near >= 0 && near !== from) return { ...model.atoms[near], index: near };
    const end = snap(model.atoms[from], point.x, point.y);
    const landed = nearestAtom(model, end.x, end.y, 0.2);
    return landed >= 0 && landed !== from ? { ...model.atoms[landed], index: landed } : { ...end, index: -1 };
  }
  board.addEventListener("pointerdown", (event) => {
    if (event.button) return;
    event.preventDefault();
    const point = place(event);
    drag = { point, atom: nearestAtom(model, point.x, point.y), moved: false, id: event.pointerId };
    board.setPointerCapture(event.pointerId);
  });
  board.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const point = place(event);
    if (Math.hypot(point.x - drag.point.x, point.y - drag.point.y) > 0.3) drag.moved = true;
    if (drag.moved && tool.kind === "atom" && drag.atom >= 0)
      draw({ from: model.atoms[drag.atom], to: target(point, drag.atom) });
  });
  board.addEventListener("pointercancel", () => {
    drag = null;
    draw();
  });
  board.addEventListener("pointerup", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const point = place(event);
    const { atom, moved, point: start } = drag;
    drag = null;
    const bond = atom < 0 ? nearestBond(model, start.x, start.y) : -1;
    change(() => {
      if (tool.kind === "erase") {
        if (atom >= 0) removeAtom(model, atom);
        else if (bond >= 0) model.bonds.splice(bond, 1);
      } else if (tool.kind === "charge") {
        if (atom >= 0)
          model.atoms[atom].charge = model.atoms[atom].charge === tool.value ? "" : tool.value;
      } else if (tool.kind === "ring") {
        // Sur un atome, le cycle l'utilise comme sommet du bas.
        const radius = 1 / (2 * Math.sin(Math.PI / tool.size));
        const base = atom >= 0 ? model.atoms[atom] : null;
        const x = base ? base.x : start.x;
        const y = base ? base.y + radius : start.y;
        if (!addRing(model, tool.size, x, y, tool.alternate)) notify("Dessin trop grand : 120 atomes au plus.");
      } else if (atom >= 0 && moved) {
        const end = target(point, atom);
        const to = end.index >= 0 ? end.index : addAtom(model, tool.value, end.x, end.y);
        connect(model, atom, to, mark);
      } else if (atom >= 0) {
        if (model.atoms[atom].element !== tool.value) model.atoms[atom].element = tool.value;
        else {
          const spot = freeSpot(model, atom);
          connect(model, atom, addAtom(model, tool.value, spot.x, spot.y), mark);
        }
      } else if (bond >= 0) {
        const current = model.bonds[bond];
        // Recliquer un coin le retourne ; sinon on applique le type choisi.
        if (current.mark === mark && (mark === ">" || mark === "<"))
          [current.from, current.to] = [current.to, current.from];
        else current.mark = mark;
      } else if (addAtom(model, tool.value, start.x, start.y) < 0) notify("Dessin trop grand : 120 atomes au plus.");
    });
    draw();
  });

  function press(group, button) {
    for (const other of $(group).querySelectorAll("button"))
      other.setAttribute("aria-pressed", String(other === button));
  }
  $("molecule-tools").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-kind]");
    if (!button) return;
    const { kind, value, size: ring, alternate } = button.dataset;
    tool = { kind, value, size: Number(ring), alternate: Boolean(alternate) };
    press("molecule-tools", button);
  });
  $("molecule-bonds").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mark]");
    if (!button) return;
    mark = button.dataset.mark;
    press("molecule-bonds", button);
  });
  function load(next) {
    // Recentre le dessin dans le cadre.
    const xs = next.atoms.map((a) => a.x);
    const ys = next.atoms.map((a) => a.y);
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    const cy = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
    model = { atoms: next.atoms.map((a) => ({ ...a, x: a.x - cx, y: a.y - cy })), bonds: next.bonds };
  }
  $("molecule-template").addEventListener("change", (event) => {
    const value = event.target.value;
    event.target.value = "";
    change(() => {
      if (value === "benzene") {
        model = { atoms: [], bonds: [] };
        addRing(model, 6, 0, 0, true);
      } else if (TEMPLATES[value]) load(readMolecule(TEMPLATES[value]));
    });
  });
  $("molecule-undo").addEventListener("click", () => {
    if (!past.length) return;
    model = past.pop();
    $("molecule-source").value = writeMolecule(model);
    check();
    draw();
  });
  $("molecule-clear").addEventListener("click", () => change(() => (model = { atoms: [], bonds: [] })));
  $("molecule-source").addEventListener("input", () => {
    const read = readMolecule($("molecule-source").value);
    check();
    if (read && !$("molecule-error").textContent) {
      past.push(copy());
      model = read;
      draw();
    }
  });
  /** Molécule déjà écrite autour du curseur : on la rouvre au lieu d'en créer une. */
  function under() {
    const at = source.selectionStart;
    for (const m of source.value.matchAll(/\\molecule\{[^{}]*\}/g))
      if (at >= m.index && at <= m.index + m[0].length) return m;
    return null;
  }
  $("molecule-open").addEventListener("click", () => {
    editor.close();
    const found = under();
    range = found
      ? [found.index, found.index + found[0].length]
      : [source.selectionStart, source.selectionEnd];
    const read = found && readMolecule(found[0]);
    past = [];
    load(read || { atoms: [], bonds: [] });
    $("molecule-insert").textContent = read ? "Mettre à jour la molécule" : "Insérer la molécule";
    $("molecule-source").value = writeMolecule(model);
    $("molecule-dialog").showModal();
    check();
    draw();
  });
  $("molecule-insert").addEventListener("click", () => {
    const text = $("molecule-source").value.trim();
    $("molecule-dialog").close();
    editor.insert(text, range);
  });
  window.addEventListener("resize", () => {
    if ($("molecule-dialog").open) draw();
  });
}
