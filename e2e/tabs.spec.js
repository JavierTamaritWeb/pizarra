'use strict';
/* ============================================================
   tabs.spec.js — Pestañas de documento (v3.17.0) en un navegador real.

   Lo que el arnés node:vm no puede juzgar: que la barra se pinte y responda
   a clics y doble clic de verdad, que el lienzo REPINTE al cambiar de
   pestaña, y que una recarga completa devuelva todas las pestañas con la
   activa recordada (el flujo restoreTabs entero contra localStorage real).
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { openApp, readAutosave, selectTool, drag, settle, setZoom } = require('./helpers.js');

const indice = page => page.evaluate(() =>
  JSON.parse(localStorage.getItem('sketchwire.tabs')));

const nombresBarra = page =>
  page.locator('#doctabs-list .doctabs__label').allTextContents();

test('crear, dibujar, cambiar, recargar: cada pestaña conserva su dibujo y vuelven todas', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await openApp(page);

  // Pestaña 1: un rectángulo
  await selectTool(page, 'rect');
  await page.keyboard.press('Escape');           // cierra el modal de ajustes
  await drag(page, 200, 200, 320, 280);
  await expect.poll(() => readAutosave(page).then(els => els.length)).toBe(1);

  // Pestaña 2: un círculo
  await page.locator('#btn-tab-new').click();
  await settle(page);
  await expect.poll(() => readAutosave(page).then(els => els.length),
    { message: 'la pestaña nueva nace vacía' }).toBe(0);
  await selectTool(page, 'circle');
  await page.keyboard.press('Escape');
  await drag(page, 400, 300, 500, 400);
  await expect.poll(() => readAutosave(page).then(els => els.length)).toBe(1);

  // Pestaña 3: dos líneas
  await page.locator('#btn-tab-new').click();
  await settle(page);
  await selectTool(page, 'line');
  await drag(page, 100, 100, 300, 100);
  await drag(page, 100, 150, 300, 150);
  await expect.poll(() => readAutosave(page).then(els => els.length)).toBe(2);

  expect(await nombresBarra(page)).toEqual(['Pizarra 1', 'Pizarra 2', 'Pizarra 3']);

  // Volver a la 1: su rect, y el lienzo repintado de verdad
  await page.locator('#doctabs-list .doctabs__label', { hasText: 'Pizarra 1' }).click();
  await settle(page);
  await expect.poll(async () => (await readAutosave(page)).map(e => e.type).join(','))
    .toBe('rect');

  // Recarga completa: vuelven las tres, con la activa recordada (la 1)
  await page.reload();
  await page.waitForSelector('.sidebar__tool');
  await settle(page);
  expect(await nombresBarra(page)).toEqual(['Pizarra 1', 'Pizarra 2', 'Pizarra 3']);
  const idx = await indice(page);
  expect(idx.active).toBe(idx.order[0].id);
  expect((await readAutosave(page)).map(e => e.type)).toEqual(['rect']);

  // Y la 2 despierta con su círculo tras la recarga
  await page.locator('#doctabs-list .doctabs__label', { hasText: 'Pizarra 2' }).click();
  await settle(page);
  await expect.poll(async () => (await readAutosave(page)).map(e => e.type).join(','))
    .toBe('circle');
  expect(errors).toEqual([]);
});

test('cerrar: la vacía sin preguntar, la ocupada con el diálogo propio; renombrar con doble clic', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  // Ningún confirm()/prompt() nativo debe aparecer en todo el flujo.
  page.on('dialog', d => { errors.push('diálogo nativo: ' + d.type()); d.dismiss(); });
  await openApp(page);

  await selectTool(page, 'rect');
  await page.keyboard.press('Escape');
  await drag(page, 200, 200, 320, 280);
  await page.locator('#btn-tab-new').click();   // Pizarra 2, vacía
  await settle(page);

  // Cerrar la vacía (activa): directo, sin diálogo
  await page.locator('.doctabs__tab', { hasText: 'Pizarra 2' })
    .locator('.doctabs__close').click();
  await settle(page);
  expect(await nombresBarra(page)).toEqual(['Pizarra 1']);
  await expect(page.locator('#modal-tab-close')).not.toBeVisible();
  // La superviviente ha despertado con su dibujo
  await expect.poll(() => readAutosave(page).then(els => els.length)).toBe(1);

  // Cerrar la ocupada: diálogo propio. Cancelar primero, cerrar después.
  await page.locator('#btn-tab-new').click();
  await settle(page);
  await page.locator('.doctabs__tab', { hasText: 'Pizarra 1' })
    .locator('.doctabs__close').click();
  await expect(page.locator('#modal-tab-close')).toBeVisible();
  await expect(page.locator('#tab-close-name')).toHaveText('Pizarra 1');
  await page.locator('#btn-tab-close-cancel').click();
  await expect(page.locator('#modal-tab-close')).not.toBeVisible();
  expect((await indice(page)).order.length).toBe(2);

  await page.locator('.doctabs__tab', { hasText: 'Pizarra 1' })
    .locator('.doctabs__close').click();
  await page.locator('#btn-tab-close-confirm').click();
  await settle(page);
  expect(await nombresBarra(page)).toEqual(['Pizarra 2']);
  const restante = await indice(page);
  expect(await page.evaluate(
    ids => ids.map(id => localStorage.getItem('sketchwire.doc.' + id)),
    [restante.order[0].id]),
  ).toEqual([null]);

  // Renombrar la activa con doble clic
  await page.locator('#doctabs-list .doctabs__label').dblclick();
  const input = page.locator('.doctabs__input');
  await expect(input).toBeVisible();
  await input.fill('Fachada sur');
  await input.press('Enter');
  await expect(page.locator('#doctabs-list .doctabs__label')).toHaveText('Fachada sur');
  expect((await indice(page)).order[0].name).toBe('Fachada sur');

  // Y el nombre sobrevive a la recarga
  await page.reload();
  await page.waitForSelector('.sidebar__tool');
  expect(await nombresBarra(page)).toEqual(['Fachada sur']);
  expect(errors).toEqual([]);
});

test('el zoom es de cada pestaña dentro de la sesión', async ({ page }) => {
  await openApp(page);
  const zoomDe = () => page.locator('#zoom-val').textContent();

  // Zoom manual en la 1 (200%: ningún auto-ajuste llega ahí)
  await setZoom(page, 200);
  const zoomA = await zoomDe();

  // La 2 nace con auto-ajuste, no con el zoom de la 1
  await page.locator('#btn-tab-new').click();
  await settle(page);
  const zoomB = await zoomDe();
  expect(zoomB).not.toBe(zoomA);

  // Y al volver, la 1 recupera el suyo
  await page.locator('#doctabs-list .doctabs__label', { hasText: 'Pizarra 1' }).click();
  await settle(page);
  expect(await zoomDe()).toBe(zoomA);
});
