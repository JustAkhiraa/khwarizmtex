import { describe, it, expect } from "vitest";
import { parse } from "../src/index.ts";
import {
  CATALOG,
  searchCatalog,
  matrixSource,
} from "../apps/online/catalog.js";
import { parseTextImport, pdfText } from "../apps/online/imports.js";
import { initialState } from "../apps/online/model.js";

describe("palette Online", () => {
  it.each(CATALOG)("le modèle $label reste valide une fois rempli", (item) => {
    expect(parse(item.source.replaceAll("□", "x")).errors).toEqual([]);
  });
  it("cherche avec accents, commandes et catégories", () => {
    expect(searchCatalog("energie")).toHaveLength(3);
    expect(searchCatalog("\\alpha")[0].label).toBe("alpha");
    expect(searchCatalog("energie", "greek")).toEqual([]);
    expect(new Set(CATALOG.map((item) => item.id)).size).toBe(CATALOG.length);
  });
  it("construit les matrices et empêche de casser les cellules", () => {
    const value = matrixSource(2, 3, "bmatrix", ["1", "2", "3", "4", "", "6"]);
    expect(value).toBe(
      "\\begin{bmatrix} 1 & 2 & 3 \\\\ 4 & □ & 6 \\end{bmatrix}",
    );
    expect(parse(value).errors).toEqual([]);
    expect(() => matrixSource(7, 1, "matrix", [])).toThrow();
    expect(() => matrixSource(1, 1, "array", ["x"])).toThrow();
    for (const cell of ["a&b", "a\\\\b", "\\end{matrix}", "a\nb"]) {
      expect(() => matrixSource(1, 1, "matrix", [cell])).toThrow();
    }
  });
});
describe("imports locaux", () => {
  it("conserve les maths Markdown et choisit le bon brouillon", () => {
    expect(parseTextImport("cours.MD", "\uFEFF# Cours\r\n$x^2$")).toMatchObject(
      { kind: "document", title: "cours", source: "# Cours\n$x^2$" },
    );
    expect(parseTextImport("calcul.tex", "\\frac{a}{b}")).toMatchObject({
      kind: "formula",
      source: "\\frac{a}{b}",
    });
    expect(parseTextImport("notes.txt", "<script>texte</script>").source).toBe(
      "<script>texte</script>",
    );
    expect(
      parseTextImport("atelier.json", JSON.stringify(initialState())).state,
    ).toEqual(initialState());
  });
  it("refuse les formats et documents non pris en charge sans tronquer", () => {
    for (const [name, text] of [
      ["x.docx", "x"],
      ["x.md", "x".repeat(50001)],
      ["x.txt", "x\0y"],
      ["x.tex", "\\documentclass{article}"],
      ["x.tex", "\\begin{document}x"],
      ["x.json", "{}"],
    ]) {
      expect(() => parseTextImport(name, text)).toThrow();
    }
  });
  it("récupère les lignes PDF sans inventer une formule", () => {
    expect(
      pdfText([
        { str: "E =", hasEOL: false },
        { str: "mc2", hasEOL: true },
        { type: "beginMarkedContent" },
        { str: "Texte", hasEOL: true },
      ]),
    ).toBe("E = mc2\nTexte");
  });
});
