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
    const [slot] = findSlots("\\frac12");
    expect(slot.parts.every((p) => p.start === -1)).toBe(true);
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
