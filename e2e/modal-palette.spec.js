'use strict';
/* ============================================================
   modal-palette.spec.js — Paletas dentro de los modales de ajustes y ancho
   del diálogo en pantallas grandes (v2.26.0).

   Va en e2e y no en `tests/`: lo que se comprueba es CSS puro —el ancho
   medido del <dialog> a cada lado del breakpoint y que los campos pasan a dos
   columnas— y clics reales sobre las muestras. El arnés `node:vm` no tiene
   layout, así que ahí las dos cosas pasarían dijera lo que dijera la hoja.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { WIDE, NARROW, openApp, settle, selectTool, drag, clickCanvas, elements } = require('./helpers');

/** Ancho en px del diálogo, medido de verdad. */
const anchoModal = (page, id) =>
  page.locator(`#${id}`).evaluate(d => d.getBoundingClientRect().width);

test('el modal de ajustes se ensancha por encima de 1200px, y no antes', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await expect(page.locator('#modal-shape')).toBeVisible();
  const estrecho = await anchoModal(page, 'modal-shape');
  // 46rem = el ancho del modal corriente (1rem = 10px por el 62.5%)
  expect(estrecho).toBeCloseTo(460, 0);
  // Y sus campos siguen en UNA columna
  expect(await page.locator('#modal-shape .modal__build-fields')
    .evaluate(n => getComputedStyle(n).gridTemplateColumns.split(' ').length)).toBe(1);

  await page.setViewportSize(WIDE);
  await settle(page);
  const ancho = await anchoModal(page, 'modal-shape');
  expect(ancho).toBeCloseTo(760, 0);      // 76rem
  expect(ancho).toBeGreaterThan(estrecho);
  expect(await page.locator('#modal-shape .modal__build-fields')
    .evaluate(n => getComputedStyle(n).gridTemplateColumns.split(' ').length)).toBe(2);
});

test('los quince modales con miniatura son los que se ensanchan', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  // La clase la lleva el diálogo, no el contenedor: si alguien añade un modal
  // con miniatura y se olvida, se queda estrecho y con una columna larguísima.
  // Las fichas botánicas quedan fuera: tienen su propio ancho (.modal--plant).
  const conMiniatura = await page.locator('dialog:has(.modal__build):not(.modal--plant)').count();
  const anchos = await page.locator('dialog.modal--settings').count();
  expect(conMiniatura).toBe(15);
  expect(anchos).toBe(conMiniatura);
});

test('la paleta del trazo del modal pinta el elemento seleccionado', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await page.locator('#modal-shape').evaluate(d => d.close());
  await drag(page, 300, 300, 420, 400);
  await settle(page);

  // Se selecciona con Mover —con Rectángulo puesto, un clic en el lienzo
  // crearía otra forma— y se vuelve a pulsar la herramienta del elemento
  // seleccionado, que lo edita en vez de deseleccionar (v2.10.0).
  await selectTool(page, 'select');
  await clickCanvas(page, 310, 310);
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await expect(page.locator('#modal-shape')).toBeVisible();
  await page.locator('#shape-modal-color-grid .panel__color-swatch[data-color="#e74c3c"]').click();
  await expect.poll(async () =>
    (await elements(page)).every(el => el.color === '#e74c3c')).toBe(true);
  // La muestra elegida queda resaltada, y sólo ella
  await expect(page.locator('#shape-modal-color-grid .panel__color-swatch--active'))
    .toHaveCount(1);
});

test('la paleta del relleno rellena con ESE color, y no toca el del trazo', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await page.locator('#modal-shape').evaluate(d => d.close());
  await drag(page, 300, 300, 420, 400);
  await settle(page);

  const antes = (await elements(page))[0].color;
  await selectTool(page, 'select');
  await clickCanvas(page, 310, 310);
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await page.locator('#shape-modal-fill-grid .panel__fill-swatch[data-color="#e74c3c"]').click();
  await expect.poll(async () => {
    const el = (await elements(page))[0];
    return `${el.fill}/${el.fillColor}/${el.color}`;
  }).toBe(`true/#e74c3c/${antes}`);

  // El resaltado va por su cuenta: la muestra del trazo con ese mismo color NO
  // se marca, porque el trazo sigue siendo el de antes.
  await expect(page.locator('#shape-modal-fill-grid .panel__fill-swatch--active'))
    .toHaveCount(1);
  await expect(page.locator('#shape-modal-color-grid .panel__color-swatch[data-color="#e74c3c"]'))
    .not.toHaveClass(/panel__color-swatch--active/);
});

test('un clic en una muestra de relleno es UN paso de deshacer', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await page.locator('#modal-shape').evaluate(d => d.close());
  await drag(page, 300, 300, 420, 400);
  await settle(page);
  await selectTool(page, 'select');
  await clickCanvas(page, 310, 310);
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await page.locator('#shape-modal-fill-grid .panel__fill-swatch[data-color="#e74c3c"]').click();
  await expect.poll(async () => (await elements(page))[0].fillColor).toBe('#e74c3c');

  await page.locator('#modal-shape').evaluate(d => d.close());
  await page.locator('#btn-undo').click();
  await expect.poll(async () => {
    const el = (await elements(page))[0];
    return el && el.fillColor === undefined && el.fill !== true;
  }).toBe(true);
});
