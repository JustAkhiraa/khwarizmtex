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
