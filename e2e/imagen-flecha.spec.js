'use strict';
/* Comprobación end-to-end del arreglo v3.14.2 con una IMAGEN de verdad: una
   flecha trazada ENTERA encima de ella debe quedarse donde se dibuja. La
   guarda de `tests/` usa un rect grande porque el arnés node:vm no decodifica
   imágenes; aquí se suelta un PNG real sobre el lienzo, como un arrastre desde
   el Finder, que es el gesto que destapó el fallo. */
const { test, expect } = require('@playwright/test');
const { openApp, selectTool, drag, elements, WIDE } = require('./helpers.js');

/** Suelta un PNG generado al vuelo sobre el lienzo y devuelve su caja.
    `addImage` lo escala al 80 % del lienzo y lo centra: 960×640 sobre 1200×800,
    de sobra para que quepan dentro los dos extremos de una flecha. */
async function soltarImagen(page, ancho = 1500, alto = 1000) {
  await page.evaluate(async ([w, h]) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#1b4332'; g.fillRect(0, 0, w, h);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'foto.png', { type: 'image/png' }));
    const canvas = document.getElementById('main-canvas');
    const r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new DragEvent('drop', {
      bubbles: true, cancelable: true, dataTransfer: dt,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
    }));
  }, [ancho, alto]);
  // Entra tras FileReader + Image.onload, no en el mismo turno del evento
  await expect.poll(async () => (await elements(page)).length).toBe(1);
  const img = (await elements(page))[0];
  expect(img.type).toBe('image');
  return img;
}

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

test('una flecha que sale de la imagen hacia fuera sigue anclándose a ella', async ({ page }) => {
  // La otra mitad de la regla: el conector de siempre no se toca. La imagen se
  // suelta pequeña (300×200 cabe sin escalar) para que quede sitio fuera.
  await openApp(page, { viewport: WIDE });
  const img = await soltarImagen(page, 300, 200);

  await selectTool(page, 'arrow');
  await drag(page, img.x + img.w / 2, img.y + img.h / 2, 1150, 760);

  const flecha = (await elements(page)).find(e => e.type === 'arrow');
  expect(flecha.startAnchor, 'el origen, dentro de la imagen, sí ancla').toBeTruthy();
  expect(flecha.endAnchor, 'la punta queda libre, fuera').toBeUndefined();
  // Materializado sobre el perímetro de la imagen
  const x1 = Math.round(flecha.x1), y1 = Math.round(flecha.y1);
  const enElBorde = [img.x, img.x + img.w].includes(x1) || [img.y, img.y + img.h].includes(y1);
  expect(enElBorde, `el origen debía caer en el borde y quedó en ${x1},${y1}`).toBe(true);
});
