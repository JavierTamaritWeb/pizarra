'use strict';
/* ============================================================
   canvas-presets.spec.js — La fila de aspectos de «Lienzo» (v2.31.0).

   Va en e2e y no en `tests/` por lo de siempre: el arnés `node:vm` comprueba
   qué valores quedan en el estado y en los mandos, pero no puede mirar el
   lienzo. Y aquí lo que importa es justo eso — que el papel cambie DE VERDAD
   de color y que la cuadrícula desaparezca —, más que las cinco muestras se
   distingan entre sí en pantalla, que es toda la razón de que la fila exista.

   `paintedPixels` (helpers.js) NO sirve aquí: mide la tinta como «más oscura
   que el 60% de la luminancia del papel», y sobre el aspecto Pizarra el papel
   es más oscuro que la tinta. Se leen los píxeles directamente.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { WIDE, openApp, settle } = require('./helpers');

test.use({ viewport: WIDE });

/** Color del píxel (x, y) del lienzo principal, como [r, g, b]. */
function pixel(page, x, y) {
  return page.evaluate(([px, py]) => {
    const cv = document.getElementById('main-canvas');
    const d = cv.getContext('2d').getImageData(px, py, 1, 1).data;
    return [d[0], d[1], d[2]];
  }, [x, y]);
}

/** Cuántos colores distintos hay en una franja horizontal del lienzo: con
    cuadrícula son varios (papel + líneas), sin ella uno solo. */
function coloresEnFranja(page, y) {
  return page.evaluate(py => {
    const cv = document.getElementById('main-canvas');
    const d = cv.getContext('2d').getImageData(0, py, cv.width, 1).data;
    const vistos = new Set();
    for (let i = 0; i < d.length; i += 4) vistos.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return vistos.size;
  }, y);
}

test('un clic cambia el papel entero, y la vuelta también', async ({ page }) => {
  await openApp(page);

  const fila = page.locator('#canvas-preset-grid .panel__canvas-preset');
  await expect(fila).toHaveCount(5);
  await expect(fila.first()).toBeVisible();

  // De fábrica: el plano azulado, con su rejilla puesta y marcado en la fila.
  expect(await pixel(page, 5, 5)).toEqual([104, 111, 146]);
  expect(await coloresEnFranja(page, 0)).toBeGreaterThan(1);
  await expect(page.locator('[data-preset="plano"]')).toHaveAttribute('aria-pressed', 'true');

  // Blanco: papel blanco y NADA de rejilla. Un solo color en toda la franja.
  await page.locator('[data-preset="blanco"]').click();
  await settle(page);
  expect(await pixel(page, 5, 5)).toEqual([255, 255, 255]);
  expect(await coloresEnFranja(page, 0)).toBe(1);
  await expect(page.locator('#check-grid')).not.toBeChecked();
  await expect(page.locator('[data-preset="blanco"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-preset="plano"]')).toHaveAttribute('aria-pressed', 'false');

  // El camino de vuelta, que antes de la v2.31.0 exigía recordar dos hex.
  await page.locator('[data-preset="plano"]').click();
  await settle(page);
  expect(await pixel(page, 5, 5)).toEqual([104, 111, 146]);
  expect(await coloresEnFranja(page, 0)).toBeGreaterThan(1);
  await expect(page.locator('#check-grid')).toBeChecked();
});

test('«Blanco» y «Milimetrado» se distinguen: uno lleva rejilla y el otro no', async ({ page }) => {
  await openApp(page);

  // Comparten los dos colores y sólo se diferencian por la cuadrícula, en el
  // lienzo y en su propia muestra. Si la muestra no dibujara las líneas, la
  // fila enseñaría dos cuadrados blancos idénticos y sería inservible.
  await page.locator('[data-preset="milimetrado"]').click();
  await settle(page);
  expect(await pixel(page, 5, 5)).toEqual([255, 255, 255]);
  expect(await coloresEnFranja(page, 0)).toBeGreaterThan(1);

  const imagen = sel => page.locator(sel).evaluate(
    el => getComputedStyle(el).backgroundImage);
  const conRejilla = await imagen('[data-preset="milimetrado"]');
  const sinRejilla = await imagen('[data-preset="blanco"]');
  expect(conRejilla).toContain('rgb(205, 211, 222)');   // #cdd3de, las líneas
  expect(sinRejilla).not.toContain('rgb(205, 211, 222)');
  expect(conRejilla).not.toEqual(sinRejilla);
});

test('el aspecto elegido sigue puesto tras recargar', async ({ page }) => {
  await openApp(page);
  await page.locator('[data-preset="crema"]').click();
  await settle(page);
  const antes = await pixel(page, 5, 5);

  await page.reload();
  await settle(page);
  expect(await pixel(page, 5, 5)).toEqual(antes);
  await expect(page.locator('[data-preset="crema"]')).toHaveAttribute('aria-pressed', 'true');
});

test('retocar un color a mano desmarca el aspecto en vez de mentir', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('[data-preset="plano"]')).toHaveAttribute('aria-pressed', 'true');

  // Un <input type="color"> no se puede pilotar con el diálogo del sistema:
  // se asigna el valor y se dispara el evento, que es lo que hace el navegador
  // al elegir un tono.
  await page.locator('#canvas-bg-picker').evaluate(el => {
    el.value = '#123456';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(page);

  expect(await pixel(page, 5, 5)).toEqual([18, 52, 86]);
  await expect(page.locator('#canvas-preset-grid .panel__canvas-preset--active')).toHaveCount(0);
});
