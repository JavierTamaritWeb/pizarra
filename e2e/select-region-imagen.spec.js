'use strict';
/* ============================================================
   select-region-imagen.spec.js — «Select» dentro de una imagen (v3.26.0).

   Un marco de «Select» que cae entero dentro de una única foto separa esa
   región como pieza propia y deja la foto con el hueco. El arnés vm no
   decodifica imágenes, así que el corte de verdad solo se puede ver aquí,
   con un PNG real soltado sobre el lienzo.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { WIDE, openApp, selectTool, drag, elements, soltarImagen } = require('./helpers');

test.use({ viewport: WIDE });

test('un marco dentro de la imagen separa el trozo y deja el resto con el hueco', async ({ page }) => {
  await openApp(page);
  const img = await soltarImagen(page);
  const R = { x: img.x + 100, y: img.y + 80, w: 200, h: 120 };

  await selectTool(page, 'pick');
  await drag(page, R.x, R.y, R.x + R.w, R.y + R.h);

  await expect.poll(async () => (await elements(page)).length).toBe(2);
  const [resto, trozo] = await elements(page);
  expect(resto.type).toBe('image');
  expect(trozo.type).toBe('image');
  // El resto conserva la caja de la foto (el hueco es interior); el trozo es
  // exactamente la región enmarcada (opaca entera: no hay margen que recortar).
  expect([resto.x, resto.y, resto.w, resto.h]).toEqual([img.x, img.y, img.w, img.h]);
  expect([trozo.x, trozo.y, trozo.w, trozo.h]).toEqual([R.x, R.y, R.w, R.h]);
  expect(resto.src).not.toBe(img.src);

  // El trozo queda seleccionado: Supr se lo lleva solo a él.
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await elements(page)).length).toBe(1);
  expect((await elements(page))[0].w).toBe(img.w);
});

test('Deshacer devuelve la imagen original de una pieza', async ({ page }) => {
  await openApp(page);
  const img = await soltarImagen(page);
  await selectTool(page, 'pick');
  await drag(page, img.x + 100, img.y + 80, img.x + 300, img.y + 200);
  await expect.poll(async () => (await elements(page)).length).toBe(2);

  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await elements(page)).length).toBe(1);
  expect((await elements(page))[0].src).toBe(img.src);
});

test('un marco que se sale de la imagen selecciona la imagen entera sin partirla', async ({ page }) => {
  await openApp(page);
  const img = await soltarImagen(page, 300, 200);   // cabe sin escalar: hay sitio fuera
  await selectTool(page, 'pick');
  await drag(page, img.x + 100, img.y + 50, img.x + img.w + 60, img.y + 120);

  await page.keyboard.press('Delete');
  await expect.poll(async () => (await elements(page)).length).toBe(0);
});

test('un marco que toca otro elemento no parte la imagen: selecciona los dos', async ({ page }) => {
  await openApp(page);
  const img = await soltarImagen(page);
  // Un rect dibujado encima de la foto, dentro del futuro marco.
  await selectTool(page, 'rect');
  await drag(page, img.x + 150, img.y + 120, img.x + 220, img.y + 170);
  await expect.poll(async () => (await elements(page)).length).toBe(2);

  await selectTool(page, 'pick');
  await drag(page, img.x + 100, img.y + 80, img.x + 300, img.y + 200);
  await expect.poll(async () => (await elements(page)).length).toBe(2);

  await page.keyboard.press('Delete');
  await expect.poll(async () => (await elements(page)).length).toBe(0);
});

test('con Mover el mismo gesto arrastra la imagen entera', async ({ page }) => {
  await openApp(page);
  const img = await soltarImagen(page, 300, 200);
  await selectTool(page, 'select');
  await drag(page, img.x + 100, img.y + 80, img.x + 150, img.y + 80);

  // El recuento no cambia, así que `elements()` puede devolver el autosave
  // anterior al rebote: se espera a la X nueva en vez de leerla una vez.
  await expect.poll(async () => Math.round((await elements(page))[0].x - img.x)).toBe(50);
  const [moved] = await elements(page);
  expect(moved.src).toBe(img.src);
});
