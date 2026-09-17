'use strict';
/* ============================================================
   forma-texto.spec.js — Texto dentro de una forma (v3.28.0).

   Va en e2e por la FUENTE: el arnés node:vm mide 7 px por carácter, y aquí
   el reparto en líneas y la reducción de la letra se calculan con la letra
   real del lienzo. Se mira la tinta: el texto tiene que quedar dentro de la
   figura, y un texto que no cabe tiene que pintarse más pequeño.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { WIDE, openApp, settle, selectTool, drag, clickCanvas, canvasPoint, elements } = require('./helpers');

test.use({ viewport: WIDE });

/** Tinta mucho más oscura que el papel en una región (coordenadas de lienzo). */
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

/** Editar el texto no cambia el recuento de elementos, así que `elements()`
    daría por buena la escena anterior: se espera a que el autosave (500 ms
    de rebote) refleje el texto esperado. */
async function esperarTexto(page, idx, esperado) {
  await expect.poll(async () => (await elements(page))[idx].label, { timeout: 4000 }).toBe(esperado);
  return elements(page);
}

async function sinCuadricula(page) {
  await page.evaluate(() => {
    const c = document.getElementById('check-grid');
    if (c.checked) { c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await settle(page);
}

async function escribirEnForma(page, x, y, texto) {
  await selectTool(page, 'select');
  await clickCanvas(page, x, y);
  const p = await canvasPoint(page, x, y);
  await page.mouse.dblclick(p.x, p.y);
  const input = page.locator('#text-input');
  await expect(input).toBeVisible();
  await input.fill(texto);
  await input.press('Enter');
  await settle(page);
}

test('el texto de un óvalo queda dentro de la elipse, y un texto largo se pinta más pequeño', async ({ page }) => {
  await openApp(page);
  await sinCuadricula(page);
  await selectTool(page, 'circle');
  await drag(page, 300, 200, 700, 500);   // centro (500,350), semiejes 200×150

  await escribirEnForma(page, 500, 350, 'Hola mundo');
  let [ovalo] = await esperarTexto(page, 0, 'Hola mundo');
  expect(ovalo.labelSize).toBe(18);
  // Tinta en el centro, y ninguna en las esquinas de la caja, fuera de la
  // elipse pero dentro del bbox (donde caería un texto sin ajustar).
  expect(await inkIn(page, 440, 335, 120, 30)).toBeGreaterThan(30);
  expect(await inkIn(page, 302, 202, 40, 25)).toBe(0);
  expect(await inkIn(page, 658, 473, 40, 25)).toBe(0);
  const tintaCorto = await inkIn(page, 320, 220, 360, 260);

  const largo = 'Este es un texto bastante largo que no cabe a dieciocho píxeles y tiene que repartirse en varias líneas y encoger para entrar entero en el óvalo sin salirse por ningún lado. '.repeat(2);
  await escribirEnForma(page, 500, 350, largo);
  [ovalo] = await esperarTexto(page, 0, largo.trim());
  expect(ovalo.labelSize, 'el tamaño pedido no cambia: la reducción es del dibujo').toBe(18);
  // Sigue sin salirse de la elipse…
  expect(await inkIn(page, 302, 202, 40, 25)).toBe(0);
  expect(await inkIn(page, 658, 473, 40, 25)).toBe(0);
  expect(await inkIn(page, 302, 473, 40, 25)).toBe(0);
  // …ocupa mucha más tinta (muchas líneas) y llega a la mitad superior.
  expect(await inkIn(page, 320, 220, 360, 260)).toBeGreaterThan(tintaCorto * 3);
  expect(await inkIn(page, 400, 240, 200, 40)).toBeGreaterThan(20);
});

test('el texto de un triángulo cae en su mitad inferior, como en Word', async ({ page }) => {
  await openApp(page);
  await sinCuadricula(page);
  await selectTool(page, 'triangle');
  await drag(page, 500, 400, 700, 600);   // nace desde el centro: caja 400..800 × 300..700
  const [tri] = await elements(page);
  await escribirEnForma(page, tri.x + tri.w / 2, tri.y + tri.h * 0.6, 'Texto');
  await esperarTexto(page, 0, 'Texto');
  // Nada de tinta en el tercio superior de la caja (el vértice, fuera de los
  // lados: el tramo sin trazo), sí en la mitad inferior.
  const cx = tri.x + tri.w / 2;
  expect(await inkIn(page, cx - 20, tri.y + tri.h * 0.2, 40, 30)).toBe(0);
  expect(await inkIn(page, cx - 60, tri.y + tri.h * 0.45, 120, 120)).toBeGreaterThan(20);
});

test('el panel edita el texto de la forma y vaciarlo lo quita', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'rect');
  await drag(page, 300, 300, 600, 450);
  await selectTool(page, 'select');
  await clickCanvas(page, 450, 375);
  const campo = page.locator('#el-label');
  await expect(campo).toBeVisible();
  await campo.fill('Desde el panel');
  await campo.dispatchEvent('change');
  await settle(page);
  await esperarTexto(page, 0, 'Desde el panel');
  // Estilo propio (v3.29.0): color, letra y alineación desde la sección «Texto».
  await expect(page.locator('#row-label-color')).toBeVisible();
  await page.locator('#label-color').fill('#ff0000');
  await page.locator('#label-color').dispatchEvent('change');
  await page.locator('#label-font').selectOption('caveat');
  await page.locator('#label-align').selectOption('left');
  await page.locator('#label-valign').selectOption('top');
  await settle(page);
  await expect.poll(async () => (await elements(page))[0].labelValign).toBe('top');
  const [conEstilo] = await elements(page);
  expect(conEstilo.labelColor).toBe('#ff0000');
  expect(conEstilo.labelFont).toBe('caveat');
  expect(conEstilo.labelAlign).toBe('left');
  // Y se ve: tinta roja arriba a la izquierda de la caja, nada rojo en el centro
  const rojo = (x, y, w, h) => page.evaluate(([bx, by, bw, bh]) => {
    const d = document.getElementById('main-canvas').getContext('2d').getImageData(bx, by, bw, bh).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 90 && d[i + 2] < 90) n++;
    return n;
  }, [x, y, w, h]);
  expect(await rojo(304, 304, 120, 30)).toBeGreaterThan(20);
  expect(await rojo(400, 360, 100, 40)).toBe(0);

  await campo.fill('');
  await campo.dispatchEvent('change');
  await settle(page);
  const [rect] = await esperarTexto(page, 0, undefined);
  expect(rect.label).toBeUndefined();
  expect(rect.labelSize).toBeUndefined();
  expect(rect.labelColor, 'vaciar el texto se lleva su estilo').toBeUndefined();
});
