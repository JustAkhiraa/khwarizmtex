import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("http://127.0.0.1:4189/online/");
  await expect(page.locator("#startup")).toBeHidden();
});

test("aperçu : taper dans le dénominateur puis le numérateur réécrit la source", async ({
  page,
}) => {
  await page.fill("#source", "\\frac{□}{□}");
  const den = page.locator('#preview [data-slot="frac:0:den"]');
  await expect(den).toBeVisible();
  await den.click();
  const field = page.locator("#inplace-input");
  await expect(field).toBeFocused();
  await field.pressSequentially("5");
  await expect(page.locator("#source")).toHaveValue("\\frac{□}{5}");
  await page.locator('#preview [data-slot="frac:0:num"]').click();
  await field.pressSequentially("2");
  await expect(page.locator("#source")).toHaveValue("\\frac{2}{5}");
  await page.locator('#preview [data-slot="frac:0:den"]').click();
  await expect(field).toHaveValue("5");
  await field.fill("12");
  await expect(page.locator("#source")).toHaveValue("\\frac{2}{12}");
  // Une seule annulation revient à la saisie précédente, les deux vues suivent.
  await page.locator("#undo").click();
  await expect(page.locator("#source")).not.toHaveValue("\\frac{2}{12}");
  await page.locator("#redo").click();
  await expect(page.locator("#source")).toHaveValue("\\frac{2}{12}");
  await expect(page.locator("#preview .khw-den")).toHaveText(/12/);
});

test("aperçu : clavier seul, Tab passe à la zone suivante, Échap revient", async ({
  page,
}) => {
  await page.fill("#source", "\\sqrt{□}+\\frac{a}{□}");
  await page.locator("#preview-edit").click();
  const field = page.locator("#inplace-input");
  await expect(field).toBeFocused();
  await page.keyboard.type("x");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.type("b");
  await expect(page.locator("#source")).toHaveValue("\\sqrt{x}+\\frac{a}{b}");
  await page.keyboard.press("Escape");
  await expect(field).toBeHidden();
});

test("aperçu : une zone ambiguë n'est jamais modifiée", async ({ page }) => {
  await page.fill("#source", "\\newcommand{\\half}{\\frac{1}{2}}\\half+\\half");
  await expect(page.locator("#preview .khw-frac").first()).toBeVisible();
  await expect(page.locator("#preview [data-slot]")).toHaveCount(0);
});

test("source : Tab sélectionne le □ suivant", async ({ page }) => {
  await page.fill("#source", "\\frac{□}{□}");
  await page.locator("#source").focus();
  await page.locator("#source").evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0));
  await page.locator("#source").press("Tab");
  await page.keyboard.type("1");
  await page.locator("#source").press("Tab");
  await page.keyboard.type("2");
  await expect(page.locator("#source")).toHaveValue("\\frac{1}{2}");
});

test("palette : symbole, synonyme et favoris conservés", async ({ page }) => {
  await page.locator("#palette-open").click();
  await page.fill("#palette-search", "≤");
  await expect(page.locator('#palette-grid [data-tool="relations:\\\\leq"]')).toBeVisible();
  await page.fill("#palette-search", "ensemble réel");
  await expect(page.locator("#palette-grid .symbol-card").first()).toHaveAttribute(
    "aria-label",
    "Ensemble R",
  );
  await page.locator("#palette-grid .pin-button").first().click();
  await page.locator("#palette-clear").click();
  await page.locator('#palette-categories [data-category="favorites"]').click();
  await expect(page.locator("#palette-grid .symbol-card")).toHaveCount(1);
  await page.reload();
  await page.locator("#palette-open").click();
  await page.locator('#palette-categories [data-category="favorites"]').click();
  await expect(page.locator("#palette-grid .symbol-card")).toHaveAttribute(
    "aria-label",
    "Ensemble R",
  );
});

test("menu Plus : Joindre les lignes reste accessible", async ({ page }) => {
  await expect(page.locator("#join-lines")).toBeHidden();
  await page.locator("#more-menu summary").click();
  await expect(page.locator("#join-lines")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#join-lines")).toBeHidden();
});

test("réussite : remplir le dernier □ affiche « Formule complète »", async ({ page }) => {
  await page.fill("#source", "\\frac{1}{□}");
  await page.locator('#preview [data-slot="frac:0:den"]').click();
  await page.keyboard.type("2");
  await expect(page.locator("#complete-badge")).toBeVisible();
  await expect(page.locator("#coach")).toBeHidden();
});

test("aperçu : l'exposant x^2 devient x^{10}", async ({ page }) => {
  await page.fill("#source", "x^2");
  // Le rendu suit la frappe de 100 ms : on vise la nouvelle formule, pas l'ancienne.
  await expect(page.locator("#preview [data-slot]")).toHaveCount(1);
  await page.locator('#preview [data-slot="sup:0:sup"]').click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("10");
  await expect(page.locator("#source")).toHaveValue("x^{10}");
});

test("accueil : une source vide reste accueillante", async ({ page }) => {
  await page.fill("#source", "");
  await expect(page.locator("#preview .empty-state")).toContainText("Votre formule apparaîtra ici");
});

test("aperçu : bornes d'une somme affichée, cellules, accents et texte", async ({ page }) => {
  await page.fill("#source", "\\sum_{n=1}^{N} u_n");
  await page.locator('#preview [data-slot="sup:0:sup"]').click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("100");
  await expect(page.locator("#source")).toHaveValue("\\sum_{n=1}^{100} u_n");

  await page.fill("#source", "\\begin{pmatrix} a & b \\\\ c & □ \\end{pmatrix}");
  await page.locator('#preview [data-slot="cell:0:cell:1-1"]').click();
  await page.keyboard.type("d");
  await expect(page.locator("#source")).toHaveValue("\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}");

  await page.fill("#source", "\\vec{□} \\text{pour tout } x");
  await page.locator('#preview [data-slot="accent:0:base"]').click();
  await page.keyboard.type("u");
  await page.locator('#preview [data-slot="text:0:text"]').click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("si ");
  await expect(page.locator("#source")).toHaveValue("\\vec{u} \\text{si } x");
});

test("aperçu : barrés, accolades et flèches se modifient", async ({ page }) => {
  for (const [src, slot, expected] of [
    ["\\cancel{□}", "strike:0:base", "\\cancel{y}"],
    ["\\overbrace{□}^{n}", "brace:0:base", "\\overbrace{y}^{n}"],
    ["\\underbrace{a}_{□}", "sub:0:sub", "\\underbrace{a}_{y}"],
    ["\\xrightarrow{□}", "arrow:0:over", "\\xrightarrow{y}"],
    ["\\mathbb{R}^{□}", "sup:0:sup", "\\mathbb{R}^{y}"],
  ] as [string, string, string][]) {
    await page.fill("#source", src);
    await page.locator(`#preview [data-slot="${slot}"]`).click();
    await page.keyboard.type("y");
    await expect(page.locator("#source")).toHaveValue(expected);
    await page.keyboard.press("Escape");
  }
});

test("aperçu : deux valeurs égales dans un ordre différent ne sont jamais confondues", async ({ page }) => {
  // L'étiquette est affichée avant le contenu, mais écrite après dans la source.
  const src = "\\overbrace{a^{2}}^{2}";
  await page.fill("#source", src);
  await page.locator("#preview .khw-brace-label").click();
  await expect(page.locator("#inplace-input")).toBeHidden();
  await expect(page.locator("#toast")).toContainText("à gauche");
  await expect(page.locator("#source")).toHaveValue(src);
});

test("molécule : dessiner, insérer, puis rouvrir celle sous le curseur", async ({ page }) => {
  await page.fill("#source", "");
  await page.locator("#molecule-open").click();
  const board = page.locator("#molecule-board");
  const box = (await board.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 25, y, { steps: 3 });
  await page.mouse.move(x + 46, y, { steps: 3 });
  await page.mouse.up();
  await expect(page.locator("#molecule-source")).toHaveValue(/C 0 [-\d.]+, C 1 [-\d.]+ \| 1-2/);
  await page.getByRole("button", { name: "Oxygène" }).click();
  await page.mouse.click(x + 45, y);
  await page.getByRole("button", { name: "Liaison double" }).click();
  await page.mouse.click(x + 22, y);
  await expect(page.locator("#molecule-source")).toHaveValue(/O 1 [-\d.]+ \| 1=2/);
  await page.locator("#molecule-undo").click();
  await expect(page.locator("#molecule-source")).toHaveValue(/O 1 [-\d.]+ \| 1-2/);
  await page.locator("#molecule-insert").click();
  await expect(page.locator("#preview .khw-molecule")).toBeVisible();
  await page.locator("#source").evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 5));
  await page.locator("#molecule-open").click();
  await expect(page.locator("#molecule-insert")).toHaveText("Mettre à jour la molécule");
  await page.locator("#molecule-template").selectOption("benzene");
  await page.locator("#molecule-insert").click();
  await expect(page.locator("#source")).toHaveValue(/^\\molecule\{C 0 -1,.*\}$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("aperçu : polices et \\middle se modifient", async ({ page }) => {
  for (const [src, slot, key, expected] of [
    ["\\mathbb{R}", "font:0:base", "N", "\\mathbb{N}"],
    ["\\left(a\\middle|b\\right)", "fenced:1:fenced", "c", "\\left(a\\middle|c\\right)"],
  ] as [string, string, string, string][]) {
    await page.fill("#source", src);
    await page.locator(`#preview [data-slot="${slot}"]`).click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(key);
    await expect(page.locator("#source")).toHaveValue(expected);
    await page.keyboard.press("Escape");
  }
});

test("aperçu : document long, la bonne formule change et la frappe reste fluide", async ({ page }) => {
  await page.locator('[data-mode="document"]').first().click();
  const many = Array.from({ length: 140 }, (_, i) => `Ligne $\\frac{1}{2}$\n\n$$\nx_{${i}}=\\frac{a}{b}\n$$\n`).join("\n");
  await page.fill("#source", many);
  await page.waitForTimeout(1500);
  const zone = page.locator('#preview [data-slot="frac:100:den"]');
  await zone.scrollIntoViewIfNeeded();
  await zone.click();
  const ms = await page.evaluate(() => {
    const input = document.getElementById("inplace-input") as HTMLInputElement;
    const t = performance.now();
    input.value = "7";
    input.dispatchEvent(new Event("input"));
    return performance.now() - t;
  });
  expect(ms).toBeLessThan(1000);
  const value = await page.inputValue("#source");
  expect(value.split("}{7}").length).toBe(2);
  expect(value.slice(0, value.indexOf("}{7}")).split("\\frac").length - 1).toBe(101);
});

test("bornes et étiquettes : le haut et le bas sont visibles, centrés et du bon côté", async ({ page }) => {
  for (const source of ["\\sum_{i=1}^{n} i", "\\xrightarrow[b]{texte}"]) {
    await page.fill("#source", source);
    const stack = page.locator("#preview :is(.khw-limits, .khw-xstack)").first();
    await expect(stack).toBeVisible();
    await expect
      .poll(() =>
        stack.evaluate((el) => {
          const [over, base, under] = [".khw-over", ".khw-base", ".khw-under"].map((s) => el.querySelector(s)?.getBoundingClientRect());
          if (!over || !base || !under || !over.height || !under.height) return "absent";
          if (!(over.top < base.top && under.bottom > base.bottom)) return "mal placé";
          const mid = (r: DOMRect) => r.left + r.width / 2;
          return Math.abs(mid(over) - mid(base)) < 2 && Math.abs(mid(under) - mid(base)) < 2 ? "ok" : "décentré";
        }),
      )
      .toBe("ok");
  }
});

test("aperçu : les étiquettes d'une flèche se modifient", async ({ page }) => {
  await page.fill("#source", "\\xrightarrow[b]{a}");
  await page.locator('#preview [data-slot="arrow:0:under"]').click();
  await page.locator("#inplace-input").fill("c");
  await expect(page.locator("#source")).toHaveValue("\\xrightarrow[c]{a}");
});
