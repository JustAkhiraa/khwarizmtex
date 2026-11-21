import { test, expect } from '@playwright/test';

const demo = 'http://127.0.0.1:4189/demo/';

test('la vraie démo démarre et répond à la saisie', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(demo);
  await expect(page.locator('#startup')).toBeHidden();
  await expect(page.locator('#gallery .card')).toHaveCount(22);
  await expect(page.locator('#stage-html .khw')).toBeVisible();
  await expect(page.locator('#stage-mathml math')).toBeVisible();
  await page.locator('#source').fill('x^2');
  await expect(page.locator('#stage-html .khw')).toHaveAttribute('data-latex', 'x^2');
  await page.locator('#gallery .card').filter({ hasText: 'Second degré' }).click();
  await expect(page.locator('#source')).toHaveValue(/sqrt/);
  expect(errors).toEqual([]);
});

test('un moteur bloqué produit une explication, pas une démo vide silencieuse', async ({ page }) => {
  await page.route('**/dist/khwarizmtex.global.js', (route) => route.abort());
  await page.goto(demo);
  await expect(page.locator('#startup')).toBeVisible();
  await expect(page.locator('#startup-message')).toContainText('Le moteur KhwarizmTeX n’est pas chargé');
  await expect(page.locator('#startup-message')).toContainText('npm run demo');
});

test('un script de démo bloqué est signalé', async ({ page }) => {
  await page.route('**/demo/demo.js', (route) => route.abort());
  await page.goto(demo);
  await expect(page.locator('#startup-message')).toContainText('Un fichier JavaScript n’a pas pu être chargé');
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('explique pourquoi la démo ne peut pas démarrer', async ({ page }) => {
    await page.goto(demo);
    await expect(page.locator('#startup noscript p')).toContainText('JavaScript est désactivé');
    await expect(page.locator('#startup noscript p')).toBeVisible();
  });
});

test('le serveur ne publie ni sources ni fichiers personnels', async ({ request }) => {
  for (const path of ['/package.json', '/.git/config', '/src/index.ts', '/Compte%20rendu/compte%20rendu%202.txt', '/demo/inconnu.pdf']) {
    expect((await request.get('http://127.0.0.1:4189' + path)).status()).toBe(404);
  }
  expect((await request.post(demo)).status()).toBe(405);
});
