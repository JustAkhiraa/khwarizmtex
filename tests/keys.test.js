import { describe, it, expect } from "vitest";
import { commandAround, eraseAt, nextStop } from "../apps/online/keys.js";

describe("touches du clavier de maths", () => {
  it("n'efface jamais une accolade seule : la commande est d'abord sélectionnée", () => {
    const src = "a+\\frac{1}{2}";
    expect(eraseAt(src, src.length, src.length)).toEqual({ select: [2, src.length] });
    expect(eraseAt(src, 2, src.length)).toEqual({ remove: [2, src.length] });
    expect(eraseAt(src, 8, 8)).toEqual({ select: [2, src.length] });
  });
  it("efface une commande entière ou un seul caractère", () => {
    expect(eraseAt("x+\\alpha ", 9, 9)).toEqual({ remove: [2, 9] });
    expect(eraseAt("ab", 2, 2)).toEqual({ remove: [1, 2] });
    expect(eraseAt("", 0, 0)).toBe(null);
  });
  it("avance vers la case, puis vers le groupe suivant, puis la fin", () => {
    expect(nextStop("\\frac{1}{□}", 7, 7)).toEqual([9, 10]);
    expect(nextStop("\\frac{1}{2}", 7, 7)).toEqual([9, 9]);
    expect(nextStop("\\sqrt{2}", 7, 7)).toEqual([8, 8]);
    expect(nextStop("x+1", 1, 1)).toEqual([3, 3]);
  });
  it("trouve la plus petite commande", () => {
    const src = "\\frac{\\sqrt{x}}{2}";
    expect(commandAround(src, 13)).toEqual([6, 14]);
  });
});
