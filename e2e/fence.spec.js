'use strict';

const { test, expect } = require('@playwright/test');
const { openApp, elements, selectTool, drag } = require('./helpers.js');

test('Verjas: modal, trece forjas, altura 0–350 cm y vistas persistentes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await openApp(page);

  const tool = page.locator('.sidebar__tool[data-tool="verja"]');
  await expect(tool).toContainText('Verjas');
  await selectTool(page, 'verja');
  await expect(page.locator('#modal-fence')).toBeVisible();

  const types = await page.locator('#fence-type option').evaluateAll(options =>
    options.map(option => option.value));
  expect(types).toEqual(['spear', 'minimal', 'arches', 'diamonds', 'rings', 'scrolls', 'fans',
    'castilian', 'plateresque', 'herrerian', 'andalusian', 'catalan', 'valencian']);
  await expect(page.locator('#fence-height')).toHaveAttribute('min', '0');
  await expect(page.locator('#fence-height')).toHaveAttribute('max', '350');
  const views = await page.locator('#fence-catalog .modal__fence').evaluateAll(buttons =>
    buttons.map(button => button.dataset.fence));
  expect(views).toEqual(['plan', 'elevation']);

  const previews = [];
  for (const type of types) {
    await page.locator('#fence-type').selectOption(type);
    previews.push(await page.locator('#fence-preview').evaluate(canvas => {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261;
      for (let i = 0; i < data.length; i += 17) hash = Math.imul(hash ^ data[i], 16777619);
      return hash >>> 0;
    }));
  }
  expect(new Set(previews).size, 'cada tipo debe cambiar la miniatura').toBe(13);

  await page.locator('#fence-type').selectOption('fans');
  await page.locator('#fence-height').fill('350');
  await page.locator('#fence-height').dispatchEvent('input');
  await page.locator('#fence-height').dispatchEvent('change');
  await expect(page.locator('#fence-height-val')).toHaveText('350');
  await page.locator('#fence-catalog .modal__fence[data-fence="elevation"]').click();
  await expect(page.locator('#modal-fence')).not.toBeVisible();

  await drag(page, 220, 180, 520, 180);
  const drawn = await elements(page);
  expect(drawn.length).toBeGreaterThan(15);
  expect(drawn.some(element => element.type === 'circle')).toBe(true);

  await page.reload();
  await selectTool(page, 'verja');
  await expect(page.locator('#fence-type')).toHaveValue('fans');
  await expect(page.locator('#fence-height')).toHaveValue('350');
  await expect(page.locator('#fence-catalog .modal__fence[data-fence="elevation"]'))
    .toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});
