'use strict';
/* ============================================================
   piezas.spec.js — «Piezas» de UI en el navegador real.

   La paginación (v3.25.1): sus botones tenían un tope fijo de 22 px, así
   que agrandarla con el handle cambiaba la caja pero no el dibujo — «no se
   puede cambiar de tamaño». Se comprueba sobre PÍXELES que al agrandar la
   pieza hay tinta donde antes solo había papel.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { WIDE, openApp, settle, selectTool, drag, clickCanvas, elements } = require('./helpers');

test.use({ viewport: WIDE });

/** Nº de píxeles con tinta dentro de un rectángulo en coordenadas de lienzo. */
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

test('agrandar la paginación con el handle agranda sus botones', async ({ page }) => {
  await openApp(page);
  await page.locator('#check-grid').uncheck();
  await settle(page);
  await page.locator('.sidebar__tool[data-tool="uiPiece"]').click();
  await page.locator('#uipiece-catalog .modal__uipiece[data-uipiece="pagination"]').click();
  await settle(page);
  await clickCanvas(page, 300, 300);            // la caja por defecto: 200×32
  const [antes] = await elements(page);
  expect(antes.variant).toBe('pagination');
  expect([antes.w, antes.h]).toEqual([200, 32]);
  const cx = antes.x + antes.w / 2;
  // Con 32 px de alto, por encima de y+2 y por debajo de y+30 no hay tinta.
  expect(await inkIn(page, cx - 60, antes.y - 40, 120, 38)).toBe(0);

  await selectTool(page, 'select');
  await clickCanvas(page, cx, antes.y + 16);
  await drag(page, antes.x + antes.w + 4, antes.y + antes.h + 4,
    antes.x + antes.w + 200, antes.y + antes.h + 100);     // handle SE: 400×132
  await settle(page);
  await expect.poll(async () => Math.round((await elements(page))[0].h)).toBe(132);
  const [tras] = await elements(page);
  // Botón de min(132·0.6875, 400/6.5) ≈ 61 px centrado: hay tinta 20 px por
  // encima del centro, donde el dibujo de 22 px jamás llegaba.
  const cy = tras.y + tras.h / 2, ncx = tras.x + tras.w / 2;
  expect(await inkIn(page, ncx - 60, cy - 32, 120, 10)).toBeGreaterThan(5);
  expect(await inkIn(page, ncx - 60, cy + 22, 120, 10)).toBeGreaterThan(5);
});
