'use strict';
/* Arranque de la app en un navegador real: que los scripts se carguen en el
   orden correcto, que el sidebar se construya y que dibujar deje píxeles.
   El arnés node:vm no puede probar lo último: su canvas es un stub que anota
   llamadas, no un motor que pinte. */

const { test, expect } = require('@playwright/test');
const { openApp, elements, selectTool, drag, paintedPixels } = require('./helpers.js');

test('la app arranca sin errores de consola y construye el sidebar', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await openApp(page);

  await expect(page.locator('.sidebar__tool')).not.toHaveCount(0);
  await expect(page.locator('#main-canvas')).toBeVisible();
  // Todos los globals que index.html carga por <script> en orden de dependencia.
  // Son `const` de nivel superior, así que viven en el ámbito léxico global y
  // NO son propiedades de `window`: hay que preguntar por su nombre.
  const globals = await page.evaluate(() => ['TOOLS', 'Sketchy', 'ArcMath', 'CurvePath',
    'ShapeRotation', 'RegularPolygon', 'Trapezoid', 'Eraser', 'Building', 'Garden',
    'Renderer', 'Exporter', 'Templates']
    .filter(g => new Function(`return typeof ${g}`)() === 'undefined'));
  expect(globals, 'globals que no se han cargado').toEqual([]);
  expect(errors).toEqual([]);
});

test('dibujar un rectángulo pinta píxeles de verdad en el lienzo', async ({ page }) => {
  await openApp(page);
  const before = await paintedPixels(page);

  await selectTool(page, 'rect');
  await drag(page, 200, 200, 500, 400);

  expect(await elements(page)).toHaveLength(1);
  expect(await paintedPixels(page)).toBeGreaterThan(before + 100);
  await expect(page.locator('#el-count')).toHaveText('1');
});

test('el contador de elementos y el autosave sobreviven a una recarga', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'rect');
  await drag(page, 200, 200, 400, 350);
  // El autosave va con 500ms de rebote: recargar antes se llevaría el dibujo
  // por delante y el test comprobaría que no se restaura nada.
  expect(await elements(page)).toHaveLength(1);

  await page.reload();
  await expect(page.locator('.sidebar__tool').first()).toBeVisible();
  await expect(page.locator('#el-count')).toHaveText('1');
  expect(await paintedPixels(page)).toBeGreaterThan(100);
});
