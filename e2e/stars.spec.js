'use strict';
/* ============================================================
   stars.spec.js — Estrellas regulares de 5 y 6 puntas (v2.23.0)

   Las estrellas no traen código propio: entran en REGULAR_POLYGON_TYPES y en
   RegularPolygon, y de ahí lo heredan todo. Su geometría, su validación y sus
   exportaciones las cubre `tests/regular-polygon.test.js` en milisegundos.

   Aquí va lo único que el arnés `node:vm` NO puede ver: que la
   PREVISUALIZACIÓN del arrastre las dibuja. `paintOverlay` pinta sobre el
   canvas de overlay y su `switch` lleva un `case` por herramienta; olvidarlo
   no lanza ningún error —simplemente no se ve nada mientras arrastras— y el
   arnés vm, que lee la escena del autosave, da el visto bueno igual. Se
   comprobó: quitar los dos `case` no rompe ni una de las 193 pruebas de
   `app-interaction`, y sí rompe esta.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const {
  WIDE, openApp, selectTool, canvasPoint, settle, elements, paintedPixels,
} = require('./helpers.js');

/** Píxeles pintados en el canvas de OVERLAY (el de las previsualizaciones).
    Ahí no hay papel de fondo, así que basta con contar los no transparentes. */
const overlayPixels = page => page.evaluate(() => {
  const c = document.getElementById('overlay-canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
});

for (const [tool, nombre] of [['star5', '5 puntas'], ['star6', '6 puntas']]) {
  test(`la estrella de ${nombre} se previsualiza al arrastrar y queda dibujada`, async ({ page }) => {
    await openApp(page, { viewport: WIDE });
    await selectTool(page, tool);

    const tinta = await paintedPixels(page);
    const from = await canvasPoint(page, 400, 400);
    const to = await canvasPoint(page, 400, 520);

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y);
    await settle(page);

    // A mitad de gesto: el overlay tiene que enseñar la estrella. Sin el
    // `case` en paintOverlay esto es exactamente 0.
    expect(await overlayPixels(page)).toBeGreaterThan(200);

    await page.mouse.up();
    await settle(page);

    // Y al soltar, el overlay se limpia y la tinta pasa al lienzo de verdad.
    expect(await overlayPixels(page)).toBe(0);
    expect(await paintedPixels(page)).toBeGreaterThan(tinta + 200);

    const [star] = await elements(page);
    expect(star.type).toBe(tool);
    expect(Math.round(star.w)).toBe(240);
    expect(star.w).toBe(star.h);
  });
}

test('las dos estrellas se dibujan distintas', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  const silueta = async tool => {
    await selectTool(page, tool);
    await page.evaluate(() => localStorage.removeItem('sketchwire.autosave'));
    return page.evaluate(t => {
      // Se lee la geometría publicada por el módulo, que es lo que pintan por
      // igual el lienzo, el overlay y los dos exportadores.
      const v = RegularPolygon.vertices({ type: t, x: 0, y: 0, w: 100, h: 100 });
      return v.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    }, tool);
  };
  const cinco = await silueta('star5');
  const seis = await silueta('star6');
  expect(cinco.split(' ')).toHaveLength(10);
  expect(seis.split(' ')).toHaveLength(12);
  expect(cinco).not.toBe(seis);
});
