'use strict';
/* ============================================================
   ui-variantes.spec.js — La sección UI de la v3.23.0 en un navegador real:
   las veteranas con catálogo (el Botón como representante), y el Marco con
   preset de dispositivo — un CLIC coloca la caja del preset, un DRAG sigue
   dibujando libre. El autosave como juez, igual que en ui-form.spec.js.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { openApp, elements, drag, settle } = require('./helpers.js');

test('Botón: catálogo con orden pineado, variante estampada y default ausente', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await openApp(page);

  await page.locator('.sidebar__tool[data-tool="button"]').click();
  await expect(page.locator('#modal-button')).toBeVisible();
  const variantes = await page.locator('#button-catalog .modal__button').evaluateAll(botones =>
    botones.map(b => b.dataset.button));
  expect(variantes).toEqual(['primary', 'secondary', 'ghost', 'icon']);

  // «Fantasma» y arrastrar: el elemento guarda variant:'ghost'
  await page.locator('#button-catalog .modal__button[data-button="ghost"]').click();
  await expect(page.locator('#modal-button')).not.toBeVisible();
  await drag(page, 200, 160, 340, 200);
  let piezas = await elements(page);
  expect(piezas.length).toBe(1);
  expect(piezas[0].type).toBe('button');
  expect(piezas[0].variant).toBe('ghost');

  // Con la default (Primario), el campo NO se serializa
  await page.locator('.sidebar__tool[data-tool="button"]').click();
  await page.locator('#button-catalog .modal__button[data-button="primary"]').click();
  await drag(page, 200, 260, 340, 300);
  piezas = await elements(page);
  expect(piezas.length).toBe(2);
  expect(piezas[1].variant).toBeUndefined();
  expect(errors).toEqual([]);
});

test('Marco: el clic coloca la caja del preset; el drag dibuja libre', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await openApp(page);

  // Elegir el Marco abre sus ajustes; preset Tablet y cerrar.
  await page.locator('.sidebar__tool[data-tool="frame"]').click();
  await expect(page.locator('#modal-frame')).toBeVisible();
  await page.locator('#frame-preset').selectOption('tablet');
  await page.locator('#modal-frame .modal__cancel').click();
  await settle(page);

  // Un CLIC (drag nulo) coloca 768×1024, la caja del preset.
  await drag(page, 100, 100, 100, 100);
  let piezas = await elements(page);
  expect(piezas.length).toBe(1);
  expect(piezas[0].type).toBe('frame');
  expect(piezas[0].w).toBe(768);
  expect(piezas[0].h).toBe(1024);

  // Un DRAG de verdad sigue dibujando la caja del gesto.
  await drag(page, 400, 100, 640, 260);
  piezas = await elements(page);
  expect(piezas.length).toBe(2);
  expect(piezas[1].w).toBe(240);
  expect(piezas[1].h).toBe(160);

  // Y el preset sobrevive a la recarga (prefs).
  await page.reload();
  await page.waitForSelector('.sidebar__tool');
  await page.locator('.sidebar__tool[data-tool="frame"]').click();
  await expect(page.locator('#frame-preset')).toHaveValue('tablet');
  expect(errors).toEqual([]);
});
