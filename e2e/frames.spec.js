'use strict';
/* ============================================================
   frames.spec.js — Marcos y biblioteca de piezas (v3.12.0).

   Aquí va lo que el arnés `node:vm` no puede ver: que el marco se DIBUJA en
   el lienzo (su borde y su rótulo), que exportar con él seleccionado produce
   un PNG del tamaño del marco, y que las filas de «Mis piezas» aparecen y se
   pulsan de verdad.
   ============================================================ */
const fs = require('node:fs');
const { test, expect } = require('@playwright/test');
const {
  NARROW, openApp, settle, selectTool, drag, elements, readAutosave, canvasPoint,
} = require('./helpers');

/** Ancho y alto de un PNG (firma 8 + longitud 4 + "IHDR" 4). */
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test('el marco se dibuja con su rótulo y no se rellena', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await selectTool(page, 'frame');
  await drag(page, 200, 200, 500, 600);
  await settle(page);

  const els = await elements(page);
  expect(els[0].type).toBe('frame');
  expect(els[0].label).toBe('Marco 1');

  // El borde tiene tinta y el centro no: un marco es un contorno.
  const tinta = (x, y) => page.evaluate(([px, py]) => {
    const c = document.getElementById('main-canvas');
    const d = c.getContext('2d').getImageData(px - 2, py - 2, 5, 5).data;
    const bg = document.getElementById('canvas-bg-picker').value;
    const [r, g, b] = [1, 3, 5].map(i => parseInt(bg.slice(i, i + 2), 16));
    const lim = (0.299 * r + 0.587 * g + 0.114 * b) * 0.85;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < lim) n++;
    }
    return n;
  }, [x, y]);
  expect(await tinta(350, 200)).toBeGreaterThan(0);   // borde superior
  expect(await tinta(350, 400)).toBe(0);              // centro vacío
});

test('arrastrar el marco se lleva lo que hay dentro', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await selectTool(page, 'frame');
  await drag(page, 150, 150, 500, 550);
  await selectTool(page, 'rect');
  await drag(page, 250, 250, 350, 350);
  await selectTool(page, 'select');

  // Por el CENTRO del borde superior: en la esquina hay tirador de
  // redimensión, y el gesto sería otro.
  const c = await canvasPoint(page, 325, 150);
  await page.mouse.click(c.x, c.y);
  await settle(page);
  const d1 = await canvasPoint(page, 325, 150);
  const d2 = await canvasPoint(page, 425, 150);
  await page.mouse.move(d1.x, d1.y);
  await page.mouse.down();
  await page.mouse.move(d2.x, d2.y, { steps: 6 });
  await page.mouse.up();
  await settle(page);

  await expect.poll(async () => {
    const els = await readAutosave(page);
    const marco = els.find(e => e.type === 'frame');
    const rect = els.find(e => e.type === 'rect');
    return marco && rect ? [Math.round(marco.x), Math.round(rect.x)] : null;
  }).toEqual([250, 350]);
});

test('exportar con el marco seleccionado da un PNG del tamaño del marco', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await selectTool(page, 'frame');
  await drag(page, 200, 100, 500, 500);
  await selectTool(page, 'select');
  const c = await canvasPoint(page, 200, 100);
  await page.mouse.click(c.x, c.y);
  await settle(page);

  await page.locator('#btn-export').click();
  await page.locator('#export-selection').check();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-export="png"]').click(),
  ]);
  // Exactamente la caja del marco, sin margen: su borde ES el borde querido.
  expect(pngSize(await dl.path())).toEqual({ w: 300, h: 400 });
});

test('una pieza guardada aparece en Plantillas y se inserta', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await selectTool(page, 'rect');
  await drag(page, 300, 300, 400, 400);
  await selectTool(page, 'select');
  await page.keyboard.press('Control+a');
  await settle(page);

  await expect(page.locator('#btn-save-piece')).toBeVisible();
  await page.locator('#btn-save-piece').click();
  await page.locator('#piece-name').fill('Mi caja');
  await page.locator('#btn-piece-save').click();
  await expect(page.locator('#modal-save-piece')).toBeHidden();
  await expect(page.locator('.toast')).toContainText('Mi caja');

  // Se vacía el lienzo y se inserta desde «Plantillas».
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await settle(page);
  await page.locator('#btn-templates').click();
  const bloque = page.locator('#library-block');
  await expect(bloque).toBeVisible();
  await expect(bloque).toContainText('Mi caja');
  await bloque.locator('.modal__piece-use').first().click();
  await settle(page);

  await expect.poll(async () => (await readAutosave(page)).length).toBe(1);
  const [ins] = await elements(page);
  expect(Math.round(ins.x)).toBe(550);      // centrada en el lienzo
});

test('borrar una pieza pide confirmación en la propia fila', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await selectTool(page, 'rect');
  await drag(page, 300, 300, 400, 400);
  await selectTool(page, 'select');
  await page.keyboard.press('Control+a');
  await settle(page);
  await page.locator('#btn-save-piece').click();
  await page.locator('#btn-piece-save').click();

  await page.locator('#btn-templates').click();
  const borrar = page.locator('#library-block .modal__piece-del').first();
  await borrar.click();
  // Un clic no borra: la biblioteca no entra en el undo.
  await expect(borrar).toContainText('¿Seguro?');
  await expect(page.locator('#library-block .modal__piece')).toHaveCount(1);
  await borrar.click();
  await expect(page.locator('#library-block')).toBeHidden();
});
