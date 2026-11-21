/// <reference types="node" />
import { test, expect } from '@playwright/test';
const url = 'http://127.0.0.1:4189/online/';
test.beforeEach(async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#startup')).toBeHidden();
});

test('atelier responsive avec police locale et aperçu réel', async ({ page }, info) => {
  await expect(page.locator('#preview .khw')).toBeVisible();
  await page.evaluate(() => document.fonts.load('16px "Khwarizm Math"'));
  expect(await page.evaluate(() => document.fonts.check('16px "Khwarizm Math"'))).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await info.attach('atelier-desktop', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.locator('#theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await info.attach('atelier-mobile', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});
test('les brouillons sont indépendants et restaurés après rechargement', async ({ page }) => {
  await page.locator('#source').fill('x^3+1');
  await expect(page.locator('#save-status')).toHaveText('Enregistré sur cet appareil');
  await page.locator('[data-mode=document]').click();
  await page.locator('#source').fill('## Mon document\n\nUne formule $x^2$.');
  await expect(page.locator('#save-status')).toHaveText('Enregistré sur cet appareil');
  await page.reload();
  await expect(page.locator('#source')).toHaveValue(/Mon document/);
  await page.locator('[data-mode=formula]').click();
  await expect(page.locator('#source')).toHaveValue('x^3+1');
});
test('insertion, autocomplétion et annulation fonctionnent au clavier', async ({ page }) => {
  await page.locator('#source').fill('x');
  await page.locator('#source').selectText();
  await page.getByRole('button', { name: 'Fraction', exact: true }).click();
  await expect(page.locator('#source')).toHaveValue('\\frac{x}{□}');
  await page.locator('#undo').click();
  await expect(page.locator('#source')).toHaveValue('x');
  await page.locator('#source').fill('\\sq');
  await page.locator('#source').press('Tab');
  await expect(page.locator('#source')).toHaveValue('\\sqrt{□}');
});
test('les références se renumérotent après suppression d’une équation', async ({ page }, info) => {
  await page.locator('[data-mode=document]').click();
  await info.attach('atelier-document', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  const first = '$$\na=1\\label{a}\n$$\n\n';
  const rest = '$$\nb=2\\label{b}\n$$\n\nVoir $\\eqref{b}$.';
  await page.locator('#source').fill(first + rest);
  await expect(page.locator('#preview .khw-tag')).toHaveText(['(1)', '(2)']);
  await expect(page.locator('#preview .khw-ref')).toHaveText('(2)');
  await page.locator('#source').fill(rest);
  await expect(page.locator('#preview .khw-tag')).toHaveText(['(1)']);
  await expect(page.locator('#preview .khw-ref')).toHaveText('(1)');
  await expect(page.locator('#diagnostics')).toBeHidden();
});
test('texte malveillant et erreurs restent du contenu inerte', async ({ page }) => {
  await page.locator('[data-mode=document]').click();
  await page.locator('#source').fill('<img src=x onerror=alert(1)>\n\n$\\inconnue$');
  await expect(page.locator('#preview')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#preview img')).toHaveCount(0);
  await expect(page.locator('#diagnostics')).toBeVisible();
  await page.locator('#error-list button').first().click();
  await expect(page.locator('#source')).toBeFocused();
});
test('bibliothèque, export source et export de sauvegarde', async ({ page }) => {
  if (await page.locator('.mobile-brand').isVisible()) await page.getByRole('button', { name: 'Bibliothèque d’exemples', exact: true }).click();
  else await page.getByRole('button', { name: 'Exemples', exact: true }).click();
  await page.locator('#example-search').fill('Euler');
  await page.locator('.example-card').click();
  await expect(page.locator('#source')).toHaveValue('e^{i\\pi} + 1 = 0');
  await page.locator('#export-open').click();
  const pending = page.waitForEvent('download');
  await page.locator('[data-export=source]').click();
  expect((await pending).suggestedFilename()).toMatch(/\.tex$/);
  await page.locator('#export-open').click();
  const backup = page.waitForEvent('download');
  await page.locator('[data-export=backup]').click();
  expect((await backup).suggestedFilename()).toBe('khwarizm-atelier.json');
});
test('un lien partagé Unicode ouvre la formule sans effacer immédiatement le brouillon', async ({ page }) => {
  await page.locator('#source').fill('brouillon');
  await expect(page.locator('#save-status')).toHaveText('Enregistré sur cet appareil');
  const formula = '\\text{énergie} = mc^2';
  const encoded = Buffer.from(formula, 'utf8').toString('base64url');
  await page.goto(url + '#f=' + encoded);
  // Le lien utilise une autre source ; le brouillon persiste tant qu’on n’édite pas.
  await page.reload();
  await expect(page.locator('#title')).toHaveValue('Formule partagée');
  await expect(page.locator('#source')).toHaveValue(formula);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('khwarizm-online-v1') || '{}').formula.source);
  expect(saved).toBe('brouillon');
});
test('les formules répétées produisent des nœuds DOM distincts', async ({ page }) => {
  await page.locator('[data-mode=document]').click();
  await page.locator('#source').fill('$$\nx^2\n$$\n\n$$\nx^2\n$$');
  await expect(page.locator('#preview .equation-block .khw')).toHaveCount(2);
});

test('restaure les deux modes après confirmation et refuse un fichier invalide', async ({ page }) => {
  await page.locator('#export-open').click();
  const state = { version: 1, mode: 'document', formula: { title: 'Formule restaurée', source: 'a+b' },
    document: { title: 'Document restauré', source: 'Bonjour $x$.' } };
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#import-file').setInputFiles({ name: 'atelier.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(state)) });
  await expect(page.locator('#title')).toHaveValue('Document restauré');
  await expect(page.locator('#source')).toHaveValue('Bonjour $x$.');
  await page.locator('[data-mode=formula]').click();
  await expect(page.locator('#source')).toHaveValue('a+b');
  await page.locator('#export-open').click();
  await page.locator('#import-file').setInputFiles({ name: 'faux.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.locator('#toast')).toContainText('Import refusé');
  await expect(page.locator('#source')).toHaveValue('a+b');
});

test('le mode impression masque l’interface et conserve tout le document', async ({ page }, info) => {
  await page.locator('[data-mode=document]').click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('.editor-pane')).toBeHidden();
  await expect(page.locator('#preview h1')).toBeVisible();
  await expect(page.locator('#preview')).toContainText('À vous de jouer');
  expect(await page.locator('.preview-surface').evaluate((element) => getComputedStyle(element).maxHeight)).toBe('none');
  await info.attach('document-impression', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});

test('un stockage bloqué ne casse pas l’éditeur', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get: () => { throw new Error('Stockage bloqué'); } });
  });
  await page.reload();
  await expect(page.locator('#startup')).toBeHidden();
  await page.locator('#source').fill('x+1');
  await expect(page.locator('#preview .khw')).toHaveAttribute('data-latex', 'x+1');
  await expect(page.locator('#save-status')).toHaveText('Sauvegarde indisponible');
});
