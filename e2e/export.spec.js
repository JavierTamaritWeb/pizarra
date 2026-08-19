'use strict';
/* ============================================================
   export.spec.js — Opciones de exportación (v3.9.0).

   Va en e2e y no en el arnés vm porque lo que se comprueba es el FICHERO que
   sale: el arnés tiene un canvas de mentira (`toDataURL: () => 'data:fake'`),
   así que allí se puede probar qué se le pide al exportador, pero no lo que
   produce. Aquí el PNG se descarga de verdad y se le lee la cabecera.
   ============================================================ */
const fs = require('node:fs');
const { test, expect } = require('@playwright/test');
const { NARROW, openApp, settle, selectTool, drag, canvasPoint } = require('./helpers');

/** Ancho y alto de un PNG: firma (8) + longitud (4) + "IHDR" (4) = ancho en
    el byte 16 y alto en el 20. */
function pngSize(file) {
  const b = fs.readFileSync(file);
  expect(b.slice(1, 4).toString()).toBe('PNG');
  expect(b.slice(12, 16).toString()).toBe('IHDR');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

/** Abre el modal, aplica ajustes y pulsa un formato; devuelve la descarga. */
async function exportar(page, format, ajustes = {}) {
  await page.locator('#btn-export').click();
  await expect(page.locator('#modal-export')).toBeVisible();
  if (ajustes.scale) await page.locator('#export-scale').selectOption(String(ajustes.scale));
  if (ajustes.transparent) await page.locator('#export-transparent').check();
  if (ajustes.selection) await page.locator('#export-selection').check();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator(`[data-export="${format}"]`).click(),
  ]);
  return download;
}

async function dibujarRect(page) {
  await selectTool(page, 'rect');
  await drag(page, 300, 200, 500, 400);
  await selectTool(page, 'select');
}

test('la resolución 2× multiplica los píxeles del PNG, no el dibujo', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await dibujarRect(page);
  const uno = await exportar(page, 'png');
  expect(pngSize(await uno.path())).toEqual({ w: 1200, h: 800 });

  const dos = await exportar(page, 'png', { scale: 2 });
  expect(pngSize(await dos.path())).toEqual({ w: 2400, h: 1600 });
});

test('«solo la selección» recorta el PNG a la caja de lo seleccionado', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await dibujarRect(page);
  const c = await canvasPoint(page, 400, 300);
  await page.mouse.click(c.x, c.y);
  await settle(page);

  const d = await exportar(page, 'png', { selection: true });
  // 200×200 de rectángulo + los 8px de margen por lado.
  expect(pngSize(await d.path())).toEqual({ w: 216, h: 216 });
});

test('sin selección la casilla está deshabilitada y el PNG sale entero', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await dibujarRect(page);
  await page.locator('#btn-export').click();
  await expect(page.locator('#export-selection')).toBeDisabled();
  await page.keyboard.press('Escape');

  const d = await exportar(page, 'png');
  expect(pngSize(await d.path())).toEqual({ w: 1200, h: 800 });
});

test('el fondo transparente deja el PNG sin papel y el SVG sin <rect> de papel', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await dibujarRect(page);

  const png = await exportar(page, 'png', { transparent: true });
  // La esquina superior izquierda del PNG: con papel es blanca opaca, sin
  // papel es transparente. Se decodifica en la propia página (createImageBitmap
  // no está en Node) y se mira el canal alfa.
  const alpha = await page.evaluate(async data => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = data; });
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.getContext('2d').getImageData(0, 0, 1, 1).data[3];
  }, 'data:image/png;base64,' + fs.readFileSync(await png.path()).toString('base64'));
  expect(alpha).toBe(0);

  const svg = await exportar(page, 'svg', { transparent: true });
  const txt = fs.readFileSync(await svg.path(), 'utf8');
  expect(txt).not.toContain('class="paper"');
});

test('«Copiar imagen» deja un PNG en el portapapeles', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openApp(page, { viewport: NARROW });
  await dibujarRect(page);

  await page.locator('#btn-export').click();
  const boton = page.locator('#btn-copy-image');
  await expect(boton).toBeEnabled();
  await boton.click();
  await expect(page.locator('#modal-export')).toBeHidden();
  await expect(page.locator('.toast')).toContainText('Imagen copiada');

  const tipos = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    return items.flatMap(i => i.types);
  });
  expect(tipos).toContain('image/png');
});
