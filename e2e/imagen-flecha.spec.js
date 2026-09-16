'use strict';
/* Comprobación end-to-end con una IMAGEN de verdad: una flecha trazada sobre
   ella —entera encima (arreglo v3.14.2) o saliendo hacia fuera (desde la
   v3.27.0, sin anclaje de conectores)— se queda donde se dibuja. El arnés
   node:vm no decodifica imágenes; aquí se suelta un PNG real sobre el lienzo,
   como un arrastre desde el Finder, que es el gesto que destapó el fallo. */
const { test, expect } = require('@playwright/test');
const { openApp, selectTool, drag, elements, soltarImagen, WIDE } = require('./helpers.js');

test('una flecha trazada entera sobre la imagen se queda donde se dibuja', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  const img = await soltarImagen(page);
  // Los dos extremos del trazo, holgadamente dentro de la imagen
  const P = [img.x + 80, img.y + 80, img.x + img.w - 80, img.y + img.h - 80];

  await selectTool(page, 'arrow');
  await drag(page, ...P);

  const flecha = (await elements(page)).find(e => e.type === 'arrow');
  expect(flecha, 'la flecha se creó').toBeTruthy();
  expect(flecha.startAnchor, 'el origen NO debe anclarse a la imagen').toBeUndefined();
  expect(flecha.endAnchor, 'ni la punta').toBeUndefined();
  expect([flecha.x1, flecha.y1, flecha.x2, flecha.y2].map(Math.round),
    'la flecha se queda exactamente donde se trazó').toEqual(P);
});

test('la flecha curva entera sobre la imagen tampoco se ancla', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  const img = await soltarImagen(page);
  const P = [img.x + 80, img.y + 200, img.x + img.w - 80, img.y + 260];

  await selectTool(page, 'curveArrow');
  await drag(page, ...P);

  const curva = (await elements(page)).find(e => e.type === 'curveArrow');
  expect(curva.startAnchor).toBeUndefined();
  expect(curva.endAnchor).toBeUndefined();
  expect([curva.x1, curva.y1, curva.x2, curva.y2].map(Math.round)).toEqual(P);
});

test('una flecha que sale de la imagen hacia fuera se queda donde se dibuja (v3.27.0)', async ({ page }) => {
  // Hasta la 3.26 este era el conector clásico: el origen, dentro de la
  // imagen, se anclaba y se proyectaba a su borde. Ya no hay anclaje. La
  // imagen se suelta pequeña (300×200 cabe sin escalar) para que quede sitio fuera.
  await openApp(page, { viewport: WIDE });
  const img = await soltarImagen(page, 300, 200);

  const x1 = img.x + img.w / 2, y1 = img.y + img.h / 2;
  await selectTool(page, 'arrow');
  await drag(page, x1, y1, 1150, 760);

  const flecha = (await elements(page)).find(e => e.type === 'arrow');
  expect(flecha.startAnchor).toBeUndefined();
  expect(flecha.endAnchor).toBeUndefined();
  expect([Math.round(flecha.x1), Math.round(flecha.y1)]).toEqual([Math.round(x1), Math.round(y1)]);
  expect([Math.round(flecha.x2), Math.round(flecha.y2)]).toEqual([1150, 760]);
});
