import { describe, it, expect } from "vitest";
import { findSlots, replacePart } from "../apps/online/slots.js";
import { searchCatalog } from "../apps/online/catalog.js";

describe("zones modifiables depuis l'aperçu", () => {
  it("relie numérateur et dénominateur à la source", () => {
    const src = "\\frac{□}{□}";
    const [slot] = findSlots(src);
    const den = slot.parts[1];
    expect(src.slice(den.start, den.end)).toBe("□");
    const step1 = replacePart(src, den, "5");
    expect(step1).toBe("\\frac{□}{5}");
    const step2 = replacePart(step1, findSlots(step1)[0].parts[0], "2");
    expect(step2).toBe("\\frac{2}{5}");
    expect(replacePart(step2, findSlots(step2)[0].parts[1], "12")).toBe("\\frac{2}{12}");
    expect(replacePart(step2, findSlots(step2)[0].parts[1], "")).toBe("\\frac{2}{□}");
  });
  it("garde l'ordre de la source pour les imbrications et les racines", () => {
    const src = "\\frac{\\frac{a}{b}}{\\sqrt[3]{c}}";
    const slots = findSlots(src);
    expect(slots.map((s) => s.kind)).toEqual(["frac", "frac", "sqrt"]);
    expect(slots[2].parts.map((p) => src.slice(p.start, p.end))).toEqual(["3", "c"]);
  });
  it("refuse les arguments sans accolades et ignore les commentaires", () => {
    const [slot] = findSlots("\\frac\\alpha\\beta");
    expect(slot.parts.every((p) => p.start === -1)).toBe(true);
    const [digits] = findSlots("\\frac12");
    expect(replacePart("\\frac12", digits.parts[1], "12")).toBe("\\frac1{12}");
    expect(findSlots("x % \\frac{a}{b}")).toEqual([]);
    expect(findSlots("50 % \\frac{a}{b}", { comments: false })).toHaveLength(1);
    expect(findSlots("\\fracture{a}{b}")).toEqual([]);
  });
});
describe("recherche sans connaître la commande", () => {
  it.each([
    ["inférieur", "\\leq "],
    ["racine", "\\sqrt{□}"],
    ["carré", "□^{□}"],
    ["vecteur", "\\vec{□}"],
    ["ensemble réel", "\\mathbb{R}"],
    ["dérivée", "\\frac{d}{dx} □"],
    ["\\leq", "\\leq "],
  ])("« %s » trouve %s", (query, source) => {
    expect(searchCatalog(query).map((i) => i.source)).toContain(source);
  });
  it("retrouve un symbole affiché et classe l'exact d'abord", () => {
    const symbolOf = (item) => (item.source === "\\leq " ? "≤" : "");
    expect(searchCatalog("≤", "all", symbolOf)[0].source).toBe("\\leq ");
    expect(searchCatalog("\\leq")[0].source).toBe("\\leq ");
  });
});
describe("exposants et indices", () => {
  it("relie ^{…}, _{…} et x^2, et ajoute les accolades si besoin", () => {
    const src = "x^2+a_{n}";
    const [sup, sub] = findSlots(src);
    expect([sup.kind, sub.kind]).toEqual(["sup", "sub"]);
    expect(replacePart(src, sup.parts[0], "10")).toBe("x^{10}+a_{n}");
    expect(replacePart(src, sup.parts[0], "3")).toBe("x^3+a_{n}");
    expect(replacePart(src, sub.parts[0], "")).toBe("x^2+a_{□}");
    expect(findSlots("x^\\alpha")[0].parts[0].start).toBe(-1);
    expect(findSlots("a\\_b")).toEqual([]);
  });
});
describe("tableaux, parenthèses, accents et texte", () => {
  it("découpe les cellules aux & et \\\\ de premier niveau", () => {
    const src = "\\begin{pmatrix} a & \\frac{1}{2} \\\\[2pt] c & \\end{pmatrix}";
    const cell = findSlots(src).find((s) => s.kind === "cell");
    expect(cell.parts.map((p) => src.slice(p.start, p.end))).toEqual(["a", "\\frac{1}{2}", "c", ""]);
    expect(replacePart(src, cell.parts[3], "d")).toContain("c & d");
  });
  it("relie \\left…\\right, mais pas avec \\middle", () => {
    const src = "\\left( a+b \\right)";
    const [f] = findSlots(src);
    expect(src.slice(f.parts[0].start, f.parts[0].end)).toBe("a+b");
    expect(findSlots("\\left( a \\middle| b \\right)")[0].parts[0].start).toBe(-1);
  });
  it("relie accents et texte", () => {
    const src = "\\vec{u}+\\text{si }";
    expect(findSlots(src).map((s) => s.kind)).toEqual(["accent", "text"]);
  });
});
