'use strict';
/* ============================================================
   arc-arrow.spec.js — Flecha semicírculo (v3.20.0)

   La geometría (idéntica a la del Semicírculo) y el estampado de
   heads/headShape los cubre tests/app-interaction.test.js. Aquí va lo
   que el arnés vm no ve: el modal de trazo real con «Punta» operativa,
   la previsualización del arrastre (el `case` de paintOverlay) y el
   cambio de punta pintando de verdad.
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

test('la flecha semicírculo se previsualiza, nace con punta y el selector cambia la forma', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await openApp(page, { viewport: WIDE });
  // Clic directo del sidebar (selectTool cierra los modales de ajustes):
  // elegir la herramienta abre «Ajustes del trazo» con la punta operativa
  // (el Semicírculo pelado la atenúa; su gemela con flecha no).
  await page.locator('.sidebar__tool[data-tool="arcArrow"]').click();
  await expect(page.locator('#modal-stroke')).toBeVisible();
  await expect(page.locator('#stroke-modal-head')).toBeEnabled();
  await expect(page.locator('#stroke-modal-double')).toBeEnabled();
  await page.keyboard.press('Escape');
  await settle(page);

  const tinta = await paintedPixels(page);
  const from = await canvasPoint(page, 300, 400);
  const to = await canvasPoint(page, 560, 400);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await settle(page);
  // A mitad de gesto el overlay enseña el arco (el `case` de paintOverlay).
  await expect.poll(() => overlayPixels(page)).toBeGreaterThan(200);
  await page.mouse.up();
  await settle(page);
  await expect.poll(() => overlayPixels(page)).toBe(0);
  expect(await paintedPixels(page)).toBeGreaterThan(tinta);

  let els = await elements(page);
  expect(els.length).toBe(1);
  expect(els[0].type).toBe('curveArrow');
  expect(els[0].arc).toBe(true);
  expect(els[0].heads).toBeUndefined();      // punta en el extremo final
  expect(els[0].headShape).toBeUndefined();  // la clásica no se estampa

  // Punta «Barra» para la próxima: volver a pulsarla reabre el modal.
  await page.locator('.sidebar__tool[data-tool="arcArrow"]').click();
  await expect(page.locator('#modal-stroke')).toBeVisible();
  await page.locator('#stroke-modal-head').selectOption('bar');
  await page.keyboard.press('Escape');
  await settle(page);
  const from2 = await canvasPoint(page, 300, 600);
  const to2 = await canvasPoint(page, 560, 600);
  await page.mouse.move(from2.x, from2.y);
  await page.mouse.down();
  await page.mouse.move(to2.x, to2.y);
  await page.mouse.up();
  await settle(page);

  els = await elements(page);
  expect(els.length).toBe(2);
  expect(els[1].arc).toBe(true);
  expect(els[1].headShape).toBe('bar');
  expect(errors).toEqual([]);
});
