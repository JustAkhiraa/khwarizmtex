/// <reference types="node" />
import { test, expect } from "@playwright/test";

// Petit PDF autonome et déterministe : une page, une police standard,
// aucun fichier personnel ni service de conversion pendant les tests.
function pdfFixture(text: string) {
  const stream = text
    ? `BT /F1 16 Tf 50 700 Td (${text}) Tj ET`
    : "50 50 100 100 re S";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [i, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  pdf += offsets
    .slice(1)
    .map((offset) => String(offset).padStart(10, "0") + " 00000 n \n")
    .join("");
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test.beforeEach(async ({ page }) => {
  await page.goto("http://127.0.0.1:4189/online/");
  await expect(page.locator("#startup")).toBeHidden();
});

test("palette : recherche, sélection, insertion et annulation", async ({
  page,
}, info) => {
  await page.locator("#source").fill("ab");
  await page.locator("#source").selectText();
  await page.locator("#palette-open").click();
  await expect(page.locator("#palette-categories")).toContainText("Tout (365)");
  await page.locator("#palette-search").fill("chevrons");
  await expect(page.locator("#palette-grid .symbol-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Chevrons", exact: true }).click();
  await expect(page.locator("#source")).toHaveValue(
    "\\left\\langle ab\\right\\rangle",
  );
  await expect(page.locator("#diagnostics")).toBeHidden();
  await page.locator("#undo").click();
  await expect(page.locator("#source")).toHaveValue("ab");
  // Le panneau reste ouvert et garde la recherche après l'insertion.
  await expect(page.locator("#palette-panel")).toBeVisible();
  await expect(page.locator("#palette-search")).toHaveValue("chevrons");
  await page.locator("[data-category=greek]").click();
  await info.attach("palette", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await page.setViewportSize({ width: 320, height: 720 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await info.attach("palette-mobile", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("palette ouverte : cinq insertions de suite et récents conservés", async ({
  page,
}) => {
  await page.locator("#source").fill("");
  await page.locator("#palette-open").click();
  await page.locator("[data-category=greek]").click();
  for (const name of ["alpha", "beta", "gamma", "delta", "epsilon"])
    await page
      .locator("#palette-grid")
      .getByRole("button", { name, exact: true })
      .click();
  await expect(page.locator("#source")).toHaveValue(
    "\\alpha \\beta \\gamma \\delta \\epsilon ",
  );
  await expect(page.locator("#palette-panel")).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.locator("#recent-list button").first()).toHaveAttribute(
    "aria-label",
    "epsilon",
  );
  await page.reload();
  await expect(page.locator("#recent-row")).toBeVisible();
  await expect(page.locator("#recent-list button")).toHaveCount(5);
});

test("insertion Document : respecte les blocs et les dollars échappés", async ({
  page,
}) => {
  await page.locator("[data-mode=document]").click();
  for (const [text, expected] of [
    ["Prix 5 \\$ : x", "Prix 5 \\$ : $\\sqrt{x}$"],
    ["## Valeur $x$", "## Valeur $\\sqrt{x}$"],
    ["$$\nx\n$$", "$$\n\\sqrt{x}\n$$"],
  ] as const) {
    await page.locator("#source").fill(text);
    await page.locator("#source").evaluate((element: HTMLTextAreaElement) => {
      const position = element.value.lastIndexOf("x");
      element.setSelectionRange(position, position + 1);
    });
    if (await page.locator("#palette-panel").isHidden())
      await page.locator("#palette-open").click();
    await page
      .locator("#palette-grid")
      .getByRole("button", { name: "Racine carrée", exact: true })
      .click();
    await expect(page.locator("#source")).toHaveValue(expected);
  }
});

test("revenir rapidement à la saisie conserve les suggestions", async ({
  page,
}) => {
  await page.clock.install();
  await page.locator("#source").fill("x");
  await page
    .locator("#source")
    .evaluate((element: HTMLTextAreaElement) => element.blur());
  await page.locator("#source").fill("\\sq");
  await page.clock.runFor(200);
  await expect(page.locator("#suggestions")).toBeVisible();
  await page.locator("#source").press("Tab");
  await expect(page.locator("#source")).toHaveValue("\\sqrt{□}");
});

test("matrice personnalisée, validation des cellules et couleur", async ({
  page,
}, info) => {
  await page.locator("#source").fill("");
  await page.locator("#matrix-open").click();
  await page.locator("#matrix-rows").selectOption("3");
  await page.locator("#matrix-columns").selectOption("2");
  await page.locator("#matrix-brackets").selectOption("bmatrix");
  await page.locator("#matrix-identity").click();
  await page.getByLabel("Ligne 3, colonne 2", { exact: true }).fill("a&b");
  await expect(page.locator("#matrix-insert")).toBeDisabled();
  await page.getByLabel("Ligne 3, colonne 2", { exact: true }).fill("7");
  await info.attach("matrice", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await page.locator("#matrix-insert").click();
  await expect(page.locator("#source")).toHaveValue(
    "\\begin{bmatrix} 1 & 0 \\\\ 0 & 1 \\\\ 0 & 7 \\end{bmatrix}",
  );
  await expect(page.locator("#diagnostics")).toBeHidden();
  await page.locator("#source").selectText();
  await page.locator("#appearance-open").click();
  await page.locator("#formula-color").fill("#123456");
  await page.locator("#apply-color").click();
  await expect(page.locator("#source")).toHaveValue(
    /^\\textcolor\{#123456\}\{\\begin/,
  );
  await expect(page.locator("#diagnostics")).toBeHidden();
});

test("le fond sombre préserve la lisibilité du document et de l’impression", async ({
  page,
}) => {
  await page.locator("#appearance-open").click();
  await page.locator("#preview-background").selectOption("night");
  await page.getByLabel("Fermer la présentation", { exact: true }).click();
  await expect(page.locator("#preview .khw").first()).toHaveCSS(
    "color",
    "rgb(246, 246, 255)",
  );
  await page.locator("[data-mode=document]").click();
  await expect(page.locator("#preview .khw").first()).toHaveCSS(
    "color",
    "rgb(36, 37, 61)",
  );
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#preview .khw").first()).toHaveCSS(
    "color",
    "rgb(0, 0, 0)",
  );
});

test("import Markdown : aperçu, confirmation, annulation et formules préservées", async ({
  page,
}) => {
  await page.locator("[data-mode=document]").click();
  await page.locator("#source").fill("Mon brouillon");
  await page.locator("#document-import-open").click();
  const content = "# Cours\n\nÉnergie $E=mc^2$.\n\n$$\n\\frac{a}{b}\n$$";
  await page.locator("#document-file").setInputFiles({
    name: "cours.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(content),
  });
  await expect(page.locator("#document-import-preview")).toHaveValue(content);
  await expect(page.locator("#source")).toHaveValue("Mon brouillon");
  await page.locator("#document-import-confirm").click();
  await expect(page.locator("#source")).toHaveValue(content);
  await expect(page.locator("#preview .khw")).toHaveCount(2);
  await page.locator("#undo").click();
  await expect(page.locator("#source")).toHaveValue("Mon brouillon");
  await page.locator("#document-import-open").click();
  await page.locator("#document-file").setInputFiles({
    name: "x.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Autre texte"),
  });
  await expect(page.locator("#document-import-confirm")).toBeEnabled();
  await page.locator("#document-import-cancel").click();
  await expect(page.locator("#source")).toHaveValue("Mon brouillon");
});

test("PDF : extrait localement, avertit sur les formules et refuse une page sans texte", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.locator("#source").fill("brouillon");
  await page.locator("#document-import-open").click();
  await page.locator("#document-file").setInputFiles({
    name: "physique.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture("E = mc2. Cours de physique."),
  });
  await expect(page.locator("#document-import-confirm")).toBeEnabled({
    timeout: 20000,
  });
  await expect(page.locator("#document-import-preview")).toHaveValue(
    /E = mc2. Cours de physique/,
  );
  await expect(page.locator("#document-import-warning")).toContainText(
    "pas de conversion mathématique en source",
  );
  await page.locator("#document-import-confirm").click();
  await expect(page.locator("#source")).toHaveValue(/## Page 1/);
  await page.locator("[data-mode=formula]").click();
  await expect(page.locator("#source")).toHaveValue("brouillon");
  await page.locator("#document-import-open").click();
  await page.locator("#document-file").setInputFiles({
    name: "scan.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(""),
  });
  await expect(page.locator("#document-import-status")).toContainText("OCR", {
    timeout: 20000,
  });
  await expect(page.locator("#document-import-confirm")).toBeDisabled();
  await page.locator("#document-file").setInputFiles({
    name: "invalide.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("Not a PDF"),
  });
  await expect(page.locator("#document-import-status")).toContainText(
    "pas un PDF valide",
  );
  expect(
    requests.every((url) => url.startsWith("http://127.0.0.1:4189/")),
  ).toBe(true);
});
