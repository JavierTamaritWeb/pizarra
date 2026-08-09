'use strict';

const { test, expect } = require('@playwright/test');
const { openApp, elements, selectTool, drag } = require('./helpers.js');

test('Cancela: modal, dieciocho estilos, altura 0–350 cm y vistas persistentes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await openApp(page);

  const tool = page.locator('.sidebar__tool[data-tool="cancela"]');
  await expect(tool).toContainText('Cancela');
  await selectTool(page, 'cancela');
  await expect(page.locator('#modal-gate')).toBeVisible();

  const types = await page.locator('#gate-type option').evaluateAll(options =>
    options.map(option => option.value));
  expect(types).toEqual([
    'single', 'double', 'concave', 'concaveSwan', 'concavePanel', 'concaveOrnate',
    'concaveFan', 'concaveLyre', 'concaveDiamond', 'concaveRings', 'concavePalmette',
    'convexPanel', 'convexFan', 'convexMedallion', 'convexBlind',
    'solidTransom', 'openBars', 'openScrolls',
  ]);
  await expect(page.locator('#gate-height')).toHaveAttribute('min', '0');
  await expect(page.locator('#gate-height')).toHaveAttribute('max', '350');
  const views = await page.locator('#gate-catalog .modal__gate').evaluateAll(buttons =>
    buttons.map(button => button.dataset.gate));
  expect(views).toEqual(['plan', 'elevation']);

  const previews = [];
  for (const type of types) {
    await page.locator('#gate-type').selectOption(type);
    previews.push(await page.locator('#gate-preview').evaluate(canvas => {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261;
      for (let i = 0; i < data.length; i += 17) hash = Math.imul(hash ^ data[i], 16777619);
      return hash >>> 0;
    }));
  }
  expect(new Set(previews).size, 'cada estilo debe cambiar la miniatura').toBe(18);

  await page.locator('#gate-type').selectOption('openScrolls');
  await page.locator('#gate-height').fill('350');
  await page.locator('#gate-height').dispatchEvent('input');
  await page.locator('#gate-height').dispatchEvent('change');
  await expect(page.locator('#gate-height-val')).toHaveText('350');
  await page.locator('#gate-catalog .modal__gate[data-gate="elevation"]').click();
  await expect(page.locator('#modal-gate')).not.toBeVisible();

  await drag(page, 220, 180, 520, 180);
  const drawn = await elements(page);
  expect(drawn.length).toBeGreaterThan(20);
  expect(drawn.some(element => element.type === 'circle')).toBe(true);

  await page.reload();
  await selectTool(page, 'cancela');
  await expect(page.locator('#gate-type')).toHaveValue('openScrolls');
  await expect(page.locator('#gate-height')).toHaveValue('350');
  await expect(page.locator('#gate-catalog .modal__gate[data-gate="elevation"]'))
    .toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});
