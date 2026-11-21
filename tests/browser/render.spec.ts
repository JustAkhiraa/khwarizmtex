/// <reference types="node" />
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

type Engine = typeof import('../../src/index');
const root = fileURLToPath(new URL('../../', import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.route('http://khwarizm.test/**', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test</title><body><main id="formulas"></main></body></html>',
  }));
  await page.goto('http://khwarizm.test/');
  await page.addStyleTag({ path: resolve(root, 'dist/khwarizm.css') });
  await page.addScriptTag({ path: resolve(root, 'dist/khwarizmtex.global.js') });
});

test('fraction, racine et matrice ont une géométrie cohérente', async ({ page }, info) => {
  await page.evaluate(() => {
    const engine = (window as unknown as { KhwarizmTeX: Engine }).KhwarizmTeX;
    engine.renderToElement('\\frac{a}{b}+\\sqrt{x}+\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}',
      document.getElementById('formulas')!, { displayMode: true });
  });
  const num = await page.locator('.khw-num').boundingBox();
  const den = await page.locator('.khw-den').boundingBox();
  expect(num && den && num.y + num.height <= den.y + 2).toBeTruthy();
  expect((await page.locator('.khw-sqrt').boundingBox())?.height).toBeGreaterThan(10);
  await expect(page.locator('.khw-mtr')).toHaveCount(2);
  await expect(page.locator('.khw-error')).toHaveCount(0);
  await info.attach('rendu-formules', { body: await page.screenshot(), contentType: 'image/png' });
});

test('le numéro ne chevauche pas une longue formule sur petit écran', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await page.evaluate(() => {
    const engine = (window as unknown as { KhwarizmTeX: Engine }).KhwarizmTeX;
    engine.renderToElement('\\frac{' + 'x'.repeat(80) + '}{y}\\tag{12}',
      document.getElementById('formulas')!, { displayMode: true, copyButton: false });
  });
  const formula = await page.locator('.khw > .khw-html').boundingBox();
  const tag = await page.locator('.khw-tag').boundingBox();
  expect(formula && tag && formula.x + formula.width <= tag.x + 1).toBeTruthy();
  expect(tag && tag.x + tag.width <= 320).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('un clic sur la référence atteint le bon id, avec caractères spéciaux', async ({ page }) => {
  await page.evaluate(() => {
    const engine = (window as unknown as { KhwarizmTeX: Engine }).KhwarizmTeX;
    const batch = engine.renderAll(['\\eqref{éq:énergie}', 'E=mc^2\\label{éq:énergie}\\label{alias}'],
      { output: 'html', displayMode: true, throwOnError: true });
    // Vérifie le parcours SSR réel : le HTML généré est inséré par le consommateur.
    document.getElementById('formulas')!.innerHTML = batch.html.join('');
  });
  await page.locator('.khw-ref').click();
  const target = await page.evaluate(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.getAttribute('data-latex'));
  expect(target).toContain('E=mc^2');
  expect(await page.locator('[id="khw-eq-alias"]').count()).toBe(1);
});

test('liens refusés sans confiance, liens autorisés accessibles au clavier', async ({ page }) => {
  await page.evaluate(() => {
    const engine = (window as unknown as { KhwarizmTeX: Engine }).KhwarizmTeX;
    const host = document.getElementById('formulas')!;
    engine.renderToElement('\\href{https://example.org}{x}', host);
  });
  await expect(page.locator('a')).toHaveCount(0);
  await page.evaluate(() => {
    const engine = (window as unknown as { KhwarizmTeX: Engine }).KhwarizmTeX;
    engine.renderToElement('\\href{https://example.org}{x}', document.getElementById('formulas')!, { trustLinks: true });
  });
  await expect(page.locator('[aria-hidden="true"] a')).toHaveAttribute('tabindex', '-1');
  const accessible = page.locator('.khw-a11y-link');
  await accessible.focus();
  await expect(accessible).toBeFocused();
  await expect(accessible).toBeVisible();
  await expect(accessible).toHaveAttribute('href', 'https://example.org/');
});

test('la construction DOM ne crée aucun attribut exécutable', async ({ page }) => {
  await page.evaluate(() => {
    const engine = (window as unknown as { KhwarizmTeX: Engine }).KhwarizmTeX;
    engine.renderToElement('\\href{#x"onclick="alert(1)}{x}', document.getElementById('formulas')!, { trustLinks: true });
  });
  await expect(page.locator('[onclick]')).toHaveCount(0);
  await expect(page.locator('#formulas script')).toHaveCount(0);
});

test('le composant se met à jour sans perdre la source', async ({ page }) => {
  await page.evaluate(() => {
    const element = document.createElement('khwarizm-math');
    element.setAttribute('latex', 'x^2');
    document.getElementById('formulas')!.append(element);
  });
  await expect(page.locator('khwarizm-math .khw')).toHaveAttribute('data-latex', 'x^2');
  await page.locator('khwarizm-math').evaluate((element) => element.setAttribute('latex', '\\frac{1}{2}'));
  await expect(page.locator('khwarizm-math .khw-frac')).toHaveCount(1);
  await expect(page.locator('khwarizm-math .khw')).toHaveAttribute('data-latex', '\\frac{1}{2}');
});
