'use strict';
/* ============================================================
   stair.spec.js — Escalera (v3.22.0) en un navegador real: catálogo con la
   geometría real, select de vista que reconstruye los iconos en caliente,
   piezas agrupadas al soltar y persistencia de tipo y vista.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { openApp, elements, selectTool, drag, settle } = require('./helpers.js');

test('Escalera: catálogo, vista planta/alzado y persistencia', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await openApp(page);

  const tool = page.locator('.sidebar__tool[data-tool="stair"]');
  await expect(tool).toContainText('Escalera');
  await selectTool(page, 'stair');
  await expect(page.locator('#modal-stair')).toBeVisible();

  // Los cinco tipos, con su icono de geometría real (canvas no vacío)
  const tipos = await page.locator('#stair-catalog .modal__stair').evaluateAll(botones =>
    botones.map(b => b.dataset.stair));
  expect(tipos).toEqual(['straight', 'l', 'u', 'spiral', 'ramp']);
  const conTinta = await page.locator('#stair-catalog .modal__shape-icon').evaluateAll(canvases =>
    canvases.map(c => {
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0) n++;
      return n > 40;
    }));
  expect(conTinta.every(Boolean), 'todos los iconos llevan dibujo').toBe(true);

  // Cambiar la vista reconstruye el catálogo (los iconos dependen de ella)
  const huella = () => page.locator('#stair-catalog .modal__shape-icon').first()
    .evaluate(c => {
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let hash = 2166136261;
      for (let i = 0; i < data.length; i += 17) hash = Math.imul(hash ^ data[i], 16777619);
      return hash >>> 0;
    });
  const enPlanta = await huella();
  await page.locator('#stair-view').selectOption('elevation');
  await settle(page);
  expect(await huella(), 'el icono cambia con la vista').not.toBe(enPlanta);

  // Elegir «En U» y dibujar: nace agrupada (buildingGroupId compartido)
  await page.locator('#stair-catalog .modal__stair[data-stair="u"]').click();
  await expect(page.locator('#modal-stair')).not.toBeVisible();
  await drag(page, 200, 160, 420, 340);
  const piezas = await elements(page);
  expect(piezas.length).toBeGreaterThan(5);
  const grupos = new Set(piezas.map(el => el.buildingGroupId));
  expect(grupos.size, 'todas las piezas comparten grupo').toBe(1);
  expect([...grupos][0]).toBeTruthy();

  // Tipo y vista sobreviven a la recarga
  await page.reload();
  await selectTool(page, 'stair');
  await expect(page.locator('#stair-view')).toHaveValue('elevation');
  const activo = await page.locator('#stair-catalog .modal__shape--active')
    .getAttribute('data-stair');
  expect(activo).toBe('u');
  expect(errors).toEqual([]);
});
