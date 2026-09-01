'use strict';
/* ============================================================
   free-triangle.spec.js — Triángulo irregular (v3.19.0)

   Su geometría, validación y exportaciones las cubre
   tests/trapezoid.test.js, y los gestos tests/app-interaction.test.js.
   Aquí va lo que el arnés vm no ve: la previsualización del arrastre
   (el `case` de paintOverlay), y el selector real del modal cambiando
   la silueta pintada de verdad.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const {
  WIDE, openApp, canvasPoint, settle, elements, paintedPixels,
} = require('./helpers.js');

const overlayPixels = page => page.evaluate(() => {
  const c = document.getElementById('overlay-canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
});

test('el triángulo irregular se previsualiza, nace isósceles y el selector crea el escaleno', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await openApp(page, { viewport: WIDE });
  // Clic directo del sidebar (selectTool cierra los modales de ajustes):
  // elegir la herramienta abre «Ajustes de la forma» con la fila nueva.
  await page.locator('.sidebar__tool[data-tool="freeTriangle"]').click();
  await expect(page.locator('#modal-shape')).toBeVisible();
  await expect(page.locator('#shape-modal-tri-row')).toBeVisible();
  await expect(page.locator('#shape-modal-tri')).toHaveValue('isosceles');
  await page.keyboard.press('Escape');
  await settle(page);

  const tinta = await paintedPixels(page);
  const from = await canvasPoint(page, 300, 300);
  const to = await canvasPoint(page, 500, 420);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await settle(page);
  // A mitad de gesto el overlay enseña el triángulo (el `case` de paintOverlay).
  await expect.poll(() => overlayPixels(page)).toBeGreaterThan(200);
  await page.mouse.up();
  await settle(page);
  await expect.poll(() => overlayPixels(page)).toBe(0);
  expect(await paintedPixels(page)).toBeGreaterThan(tinta);

  let els = await elements(page);
  expect(els.length).toBe(1);
  expect(els[0].type).toBe('freeTriangle');
  // Caja libre (no cuadrada). La geometría exacta ya la fija el arnés vm:
  // aquí el mapeo pasa por el zoom del viewport y se tolera su redondeo.
  expect(Math.abs(els[0].w - 200)).toBeLessThan(10);
  expect(Math.abs(els[0].h - 120)).toBeLessThan(10);
  expect(els[0].apex).toBeUndefined();       // isósceles: formato compacto

  // Escaleno para el próximo: volver a pulsar la herramienta reabre el modal.
  await page.locator('.sidebar__tool[data-tool="freeTriangle"]').click();
  await expect(page.locator('#modal-shape')).toBeVisible();
  await page.locator('#shape-modal-tri').selectOption('escaleno');
  await page.keyboard.press('Escape');
  await settle(page);
  const from2 = await canvasPoint(page, 600, 300);
  const to2 = await canvasPoint(page, 760, 400);
  await page.mouse.move(from2.x, from2.y);
  await page.mouse.down();
  await page.mouse.move(to2.x, to2.y);
  await page.mouse.up();
  await settle(page);

  els = await elements(page);
  expect(els.length).toBe(2);
  expect(els[1].apex).toBe(0.25);
  expect(errors).toEqual([]);
});
