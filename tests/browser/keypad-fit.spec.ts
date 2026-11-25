import { test, expect } from '@playwright/test';

// iPhone au zoom d'affichage, SE, 13, Max : barres de Safari déduites.
for (const [width, height] of [[320, 556], [375, 548], [390, 664], [430, 740], [382, 574], [951, 585], [669, 865], [844, 340]] as [number, number][])
  test(`pavé entier sans défiler en ${width} × ${height}`, async ({ page, hasTouch }) => {
    test.skip(!hasTouch, 'le pavé est celui des téléphones');
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:4189/online/');
    await page.locator('[data-category="keypad"]').click();
    await expect(page.locator('.pad-key')).toHaveCount(24);
    const fit = await page.evaluate(() => {
      const panel = document.getElementById('palette-panel')!;
      const status = document.getElementById('save-status')!;
      const last = [...document.querySelectorAll('.pad-key')].at(-1)!.getBoundingClientRect();
      return {
        scroll: panel.scrollHeight - panel.clientHeight,
        bottom: last.bottom - innerHeight,
        bottomPanel: last.bottom - panel.getBoundingClientRect().bottom,
        key: last.height,
        status: status.scrollWidth - status.clientWidth,
        preview: document.querySelector('.preview-pane')!.clientHeight,
      };
    });
    expect(fit.scroll).toBeLessThanOrEqual(0);
    expect(fit.bottom).toBeLessThanOrEqual(0);
    expect(fit.bottomPanel).toBeLessThanOrEqual(0.5);
    expect(fit.key).toBeGreaterThanOrEqual(36);
    expect(fit.status).toBeLessThanOrEqual(0);
    expect(fit.preview).toBeGreaterThan(100);
    if (process.env.SHOT) {
      await page.locator('#source').fill('\\frac{12}{5}6_{□}2');
      await page.locator('#source').evaluate((e) => (e as HTMLElement).blur());
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${process.env.SHOT}/${width}.png` });
    }
  });

test('le curseur se montre sans ouvrir le clavier du téléphone', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'au doigt seulement');
  await page.goto('http://127.0.0.1:4189/online/');
  const source = page.locator('#source');
  await page.locator('.pad-key', { hasText: '7' }).tap();
  await expect(source).toBeFocused();
  await expect(source).toHaveAttribute('inputmode', 'none');
  await source.tap();
  await expect(source).toBeFocused();
  expect(await source.evaluate((e) => (e as HTMLElement).inputMode)).toBe('');
});

test('écran pliant ouvert : la formule reste entière quand le clavier monte', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'au doigt seulement');
  await page.setViewportSize({ width: 951, height: 585 });
  await page.goto('http://127.0.0.1:4189/online/');
  for (const writing of ['source', 'inplace']) {
    const shown = await page.evaluate((w) => {
      document.documentElement.classList.add('keyboard-open');
      document.documentElement.dataset.writing = w;
      document.documentElement.style.setProperty('--app-height', '245px');
      const box = (id: string) => document.querySelector(id)!.getBoundingClientRect();
      const pane = box('.preview-pane'), formula = box('#preview .khw');
      return { top: formula.top - pane.top, bottom: pane.bottom - formula.bottom, dock: 245 - box('.quick-row').bottom };
    }, writing);
    expect(shown.top, writing).toBeGreaterThanOrEqual(0);
    expect(shown.bottom, writing).toBeGreaterThanOrEqual(0);
    expect(shown.dock, writing).toBeGreaterThanOrEqual(0);
  }
});
