'use strict';

const { test, expect } = require('@playwright/test');
const { openApp, elements, selectTool, drag, paintedPixels } = require('./helpers.js');

test('Muro y cancela: la cóncava se ve, se dibuja y sobrevive a una recarga', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await openApp(page);

  const tool = page.locator('.sidebar__tool[data-tool="muro"]');
  await expect(tool).toContainText('Muro y cancela');
  const before = await paintedPixels(page);
  await selectTool(page, 'muro');

  await expect(page.locator('#modal-wall')).toBeVisible();
  await expect(page.locator('#wall-gate-type')).toHaveValue('concave');
  const concaveTypes = await page.locator('#wall-gate-type option').evaluateAll(options =>
    options.map(o => o.value).filter(v => v.startsWith('concave') || v.startsWith('convex') ||
      ['solidTransom', 'openBars', 'openScrolls'].includes(v)));
  expect(concaveTypes).toEqual(['concave', 'concaveSwan', 'concavePanel', 'concaveOrnate',
    'concaveFan', 'concaveLyre', 'concaveDiamond', 'concaveRings', 'concavePalmette',
    'convexPanel', 'convexFan', 'convexMedallion', 'convexBlind', 'solidTransom',
    'openBars', 'openScrolls']);
  const previews = [];
  for (const type of concaveTypes) {
    await page.locator('#wall-gate-type').selectOption(type);
    previews.push(await page.locator('#wall-preview').evaluate(canvas => {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261;
      for (let i = 0; i < data.length; i += 17) hash = Math.imul(hash ^ data[i], 16777619);
      return hash >>> 0;
    }));
  }
  expect(new Set(previews).size, 'cada diseño debe cambiar la miniatura').toBe(16);
  await page.locator('#wall-gate-type').selectOption('concave');
  await page.locator('#wall-railing').check();
  const railingTypes = await page.locator('#wall-railing-type option').evaluateAll(options =>
    options.map(o => o.value));
  expect(railingTypes).toEqual(['spear', 'minimal', 'arches', 'diamonds', 'rings', 'scrolls', 'fans',
    'castilian', 'plateresque', 'herrerian', 'andalusian', 'catalan', 'valencian']);
  const railingPreviews = [];
  for (const type of railingTypes) {
    await page.locator('#wall-railing-type').selectOption(type);
    railingPreviews.push(await page.locator('#wall-preview').evaluate(canvas => {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261;
      for (let i = 0; i < data.length; i += 17) hash = Math.imul(hash ^ data[i], 16777619);
      return hash >>> 0;
    }));
  }
  expect(new Set(railingPreviews).size, 'cada verja debe cambiar la miniatura').toBe(13);
  await page.locator('#wall-railing-type').selectOption('spear');
  await page.locator('#wall-railing-height').fill('1.4');
  await page.locator('#wall-railing-height').dispatchEvent('input');
  await page.locator('#wall-railing-height').dispatchEvent('change');
  await expect(page.locator('#wall-railing-height-val')).toHaveText('1,4');
  await expect(page.locator('.modal__wall[data-wall="elevation"]')).toHaveAttribute('aria-pressed', 'true');
  const previewInk = await page.locator('#wall-preview').evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] < 360) dark++;
    }
    return dark;
  });
  expect(previewInk, 'la miniatura debe enseñar el muro y la cancela').toBeGreaterThan(100);

  await page.locator('.modal__wall[data-wall="elevation"]').click();
  await expect(page.locator('#modal-wall')).not.toBeVisible();
  await drag(page, 180, 250, 760, 500);

  const scene = await elements(page);
  const profiles = scene.filter(e => e.type === 'curveArrow' && e.lineWidth === 2 && e.y1 !== e.y2);
  expect(profiles, 'una curva superior para cada hoja').toHaveLength(2);
  expect(profiles.every(e => Math.abs(e.y2 - e.y1) > 8), 'ambas hojas caen hacia el centro').toBe(true);
  expect(scene.some(e => e.type === 'circle'), 'rosetón en el cierre central').toBe(true);
  expect(await paintedPixels(page)).toBeGreaterThan(before + 300);
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('sketchwire.prefs')));
  expect(prefs.wallRailingHeight).toBe(1.4);

  await page.reload();
  await expect(page.locator('.sidebar__tool').first()).toBeVisible();
  expect((await elements(page)).length).toBe(scene.length);
  expect(await paintedPixels(page)).toBeGreaterThan(before + 300);
  expect(errors).toEqual([]);
});
