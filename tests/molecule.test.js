import { describe, it, expect } from "vitest";
import { parse, renderToString } from "../src/index.ts";
import { parseMolecule, molecularFormula } from "../src/parser/molecule.ts";
import { addRing, connect, freeSpot, readMolecule, removeAtom, snap, writeMolecule, addAtom } from "../apps/online/molecule-model.js";

describe("molécules", () => {
  it.each([
    ["C 0 0, C 1 0, O 2 0 | 1-2, 2-3", "C2H6O"],
    ["O 0 0", "H2O"],
    ["N+ 0 0", "H4N+"],
    ["C 0 0, O 1 0, O- 0 1 | 1=2, 1-3", "CHO2−"],
    ["C 0 0, N 1 0 | 1#2", "CHN"],
  ])("%s vaut %s", (text, formula) => {
    const m = parseMolecule(text);
    expect(molecularFormula(m)).toBe(formula);
    expect(renderToString("\\molecule{" + text + "}")).toContain("khw-molecule");
  });
  it.each(["", "C 0", "c 0 0", "C 0 0 | 1-2", "C 0 0, C 0 0 | 1-2", "C 0 0, C 1 0 | 1-2, 2-1", "C 999 0", "C 0 0 | 1-1", "<b> 0 0"])(
    "refuse « %s »",
    (text) => {
      expect(parse("\\molecule{" + text + "}").errors).toHaveLength(1);
    },
  );
  it("dessine le benzène et l'accole sans doubler les atomes", () => {
    const m = { atoms: [], bonds: [] };
    addRing(m, 6, 0, 0, true);
    expect(molecularFormula(parseMolecule(writeMolecule(m).slice(10, -1)))).toBe("C6H6");
    addRing(m, 6, Math.sqrt(3), 0, false);
    expect(m.atoms).toHaveLength(10);
    expect(m.bonds).toHaveLength(11);
  });
  it("aimante, trouve la place libre, efface et relit", () => {
    expect(snap({ x: 0, y: 0 }, 2, 0.1)).toEqual({ x: 1, y: 0 });
    const m = { atoms: [], bonds: [] };
    addAtom(m, "C", 0, 0);
    const spot = freeSpot(m, 0);
    connect(m, 0, addAtom(m, "O", spot.x, spot.y), "=");
    const text = writeMolecule(m);
    expect(readMolecule(text)).toEqual(m);
    expect(parse(text).errors).toEqual([]);
    removeAtom(m, 0);
    expect(m).toMatchObject({ atoms: [{ element: "O" }], bonds: [] });
  });
});
