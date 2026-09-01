'use strict';
/* ============================================================
   ui-form.spec.js — Formulario (v3.22.0) en un navegador real: el catálogo de
   variantes pintado con el renderer, la variante estampada en el elemento (y
   la default NO), y el autosave como juez.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { openApp, elements, selectTool, drag } = require('./helpers.js');

test('Formulario: catálogo, variante estampada y default ausente', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await openApp(page);

  const tool = page.locator('.sidebar__tool[data-tool="formControl"]');
  await expect(tool).toContainText('Formulario');
  await selectTool(page, 'formControl');
  await expect(page.locator('#modal-form')).toBeVisible();

  const variantes = await page.locator('#form-catalog .modal__form').evaluateAll(botones =>
    botones.map(b => b.dataset.form));
  expect(variantes).toEqual(['checkbox', 'radio', 'switch', 'select', 'slider']);

  // «Interruptor» y arrastrar: el elemento guarda variant:'switch'
  await page.locator('#form-catalog .modal__form[data-form="switch"]').click();
  await expect(page.locator('#modal-form')).not.toBeVisible();
  await drag(page, 200, 160, 360, 190);
  let piezas = await elements(page);
  expect(piezas.length).toBe(1);
  expect(piezas[0].type).toBe('formControl');
  expect(piezas[0].variant).toBe('switch');

  // Con la default (Casilla), el campo NO se serializa: la ausencia es el default
  await selectTool(page, 'formControl');
  await page.locator('#form-catalog .modal__form[data-form="checkbox"]').click();
  await drag(page, 200, 260, 360, 290);
  piezas = await elements(page);
  expect(piezas.length).toBe(2);
  expect(piezas[1].variant).toBeUndefined();
  expect(errors).toEqual([]);
});
