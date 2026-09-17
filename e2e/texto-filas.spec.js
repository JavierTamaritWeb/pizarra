'use strict';
/* ============================================================
   texto-filas.spec.js — Texto suelto en varias filas (v3.30.0).

   Enter parte la línea y Ctrl/Cmd+Enter confirma: aquí se pulsa la tecla de
   verdad y se mira la acción por defecto del textarea (el salto) y la tinta
   del lienzo, que tiene que salir en dos bandas. También que el editor no
   envuelve: una frase larga ensancha el editor en vez de partirse a la vista.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { WIDE, openApp, settle, selectTool, clickCanvas, elements } = require('./helpers');

test.use({ viewport: WIDE });

function inkIn(page, x, y, w, h) {
  return page.evaluate(([bx, by, bw, bh]) => {
    const c = document.getElementById('main-canvas');
    const bg = document.getElementById('canvas-bg-picker').value;
    const [br, bgr, bb] = [1, 3, 5].map(i => parseInt(bg.slice(i, i + 2), 16));
    const limite = (0.299 * br + 0.587 * bgr + 0.114 * bb) * 0.6;
    const d = c.getContext('2d').getImageData(bx, by, bw, bh).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (d[i + 3] > 0 && lum < limite) n++;
    }
    return n;
  }, [x, y, w, h]);
}

test('Enter parte la línea, Ctrl+Enter confirma y el texto se pinta en dos filas', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('check-grid');
    if (c.checked) { c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await selectTool(page, 'text');
  await clickCanvas(page, 200, 200);
  const input = page.locator('#text-input');
  await expect(input).toBeVisible();
  await expect(input).toHaveCSS('white-space', 'pre');
  const anchoCorto = (await input.boundingBox()).width;

  await input.pressSequentially('Crea un botón con una apariencia de casa');
  const anchoLargo = (await input.boundingBox()).width;
  expect(anchoLargo).toBeGreaterThan(anchoCorto + 100); // crece, no envuelve
  await input.press('Enter');
  await expect(input).toBeVisible(); // Enter no confirma
  await expect(input).toHaveValue(/\n$/);
  await input.pressSequentially('y al ejecutarlo vaya al index');
  await expect(input).toHaveAttribute('rows', '2');

  await input.press('Control+Enter');
  await expect(input).toBeHidden();
  await settle(page);
  await expect.poll(async () => (await elements(page)).length).toBe(1);
  const [texto] = await elements(page);
  expect(texto.type).toBe('text');
  expect(texto.value.split('\n')).toHaveLength(2);

  // Dos bandas de tinta: la segunda fila queda un interlineado por debajo
  const paso = texto.fontSize + 4;
  const fila1 = await inkIn(page, texto.x, texto.y, 400, paso);
  const fila2 = await inkIn(page, texto.x, texto.y + paso, 400, paso);
  const debajo = await inkIn(page, texto.x, texto.y + paso * 2 + 4, 400, paso);
  expect(fila1).toBeGreaterThan(50);
  expect(fila2).toBeGreaterThan(50);
  expect(debajo).toBe(0);
});

test('en el rótulo de un botón Enter sigue confirmando', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'button');
  const { drag, canvasPoint } = require('./helpers');
  await drag(page, 100, 100, 300, 160);
  await selectTool(page, 'select');
  const p = await canvasPoint(page, 200, 130);
  await page.mouse.click(p.x, p.y);
  await page.mouse.dblclick(p.x, p.y);
  const input = page.locator('#text-input');
  await expect(input).toBeVisible();
  await input.fill('Enviar');
  await input.press('Enter');
  await expect(input).toBeHidden();
  await expect.poll(async () => (await elements(page))[0].label).toBe('Enviar');
});

test('Esc termina el texto, «✓ Listo» también, y el clic fuera con Texto no abre otro editor', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'text');
  await clickCanvas(page, 200, 200);
  const input = page.locator('#text-input');
  const done = page.locator('#text-done');
  await expect(input).toBeVisible();
  await expect(done).toBeVisible();
  const ib = await input.boundingBox(); const db = await done.boundingBox();
  expect(db.y).toBeGreaterThanOrEqual(ib.y + ib.height); // colgado debajo
  await input.pressSequentially('Uno');
  await input.press('Enter');
  await input.pressSequentially('Dos');
  await input.press('Escape');
  await expect(input).toBeHidden();
  await expect(done).toBeHidden();
  await expect.poll(async () => (await elements(page)).map(e => e.value)).toEqual(['Uno\nDos']);

  await clickCanvas(page, 200, 400);
  await input.pressSequentially('Tres');
  await done.click();
  await expect(input).toBeHidden();
  await expect.poll(async () => (await elements(page)).map(e => e.value)).toEqual(['Uno\nDos', 'Tres']);

  await clickCanvas(page, 200, 600);
  await input.pressSequentially('Cuatro');
  await input.press('Enter');
  await clickCanvas(page, 700, 600); // fuera: termina y no abre otro
  await expect(input).toBeHidden();
  await expect.poll(async () => (await elements(page)).map(e => e.value)).toEqual(['Uno\nDos', 'Tres', 'Cuatro']);
});
