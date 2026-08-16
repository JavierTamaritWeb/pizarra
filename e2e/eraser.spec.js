'use strict';
/* ============================================================
   eraser.spec.js — El borrador recorta, no fulmina (v2.33.0)

   Va en e2e y no en `tests/` porque lo que el usuario reportó no es una
   propiedad de la geometría sino lo que se ve: «el borrador funciona bien
   con Lápiz, Línea y Flecha pero no con el aerógrafo, las flechas curvas y
   las formas». La geometría del recorte se prueba con vértices a mano en
   tests/eraser.test.js; aquí se comprueba sobre PÍXELES que pasar el
   borrador por un sitio borra ahí y deja el resto dibujado.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { WIDE, openApp, settle, selectTool, drag, clickCanvas, elements } = require('./helpers');

test.use({ viewport: WIDE });

/** Nº de píxeles con tinta dentro de un rectángulo de coordenadas de lienzo. */
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

/** Deja la cuadrícula fuera: sus líneas cuentan como tinta al medir. */
async function sinCuadricula(page) {
  await page.locator('#check-grid').uncheck();
  await settle(page);
}

test('un mordisco a un rectángulo se lleva ese lado y deja los otros tres', async ({ page }) => {
  await openApp(page);
  await sinCuadricula(page);
  await selectTool(page, 'rect');
  await drag(page, 300, 200, 700, 500);

  const arribaAntes = await inkIn(page, 440, 190, 120, 20);
  const ladoAntes = await inkIn(page, 290, 300, 20, 100);
  expect(arribaAntes).toBeGreaterThan(50);

  await selectTool(page, 'eraser');
  await drag(page, 460, 200, 540, 200);          // barre un trozo del lado de arriba
  await settle(page);

  // Donde pasó el borrador no queda tinta…
  expect(await inkIn(page, 470, 190, 60, 20)).toBe(0);
  // …y el resto del contorno sigue ahí: antes de la v2.33.0 el rectángulo
  // entero desaparecía de un roce.
  expect(await inkIn(page, 290, 300, 20, 100)).toBeGreaterThan(ladoAntes * 0.8);
  expect(await inkIn(page, 690, 300, 20, 100)).toBeGreaterThan(50);
  expect(await inkIn(page, 440, 490, 120, 20)).toBeGreaterThan(50);
});

test('la flecha curva se muerde por donde pasa el borrador', async ({ page }) => {
  await openApp(page);
  await sinCuadricula(page);
  await selectTool(page, 'curveArrow');
  await drag(page, 300, 500, 700, 500);          // la comba sube por el centro

  const els = await elements(page);
  expect(els.length).toBe(1);
  const cima = { x: (els[0].x1 + els[0].x2) / 2, y: els[0].cy !== undefined
    ? (els[0].y1 + els[0].cy) / 2 : 450 };
  const antes = await inkIn(page, cima.x - 40, cima.y - 40, 80, 80);
  expect(antes).toBeGreaterThan(20);

  await selectTool(page, 'eraser');
  await drag(page, cima.x, cima.y - 30, cima.x, cima.y + 30);
  await settle(page);

  expect(await inkIn(page, cima.x - 8, cima.y - 30, 16, 60)).toBe(0);
  // Los dos extremos siguen dibujados.
  expect(await inkIn(page, 290, 470, 40, 60)).toBeGreaterThan(10);
  expect(await inkIn(page, 670, 470, 40, 60)).toBeGreaterThan(10);
});

test('el aerógrafo se parte en dos por donde cruza el borrador', async ({ page }) => {
  await openApp(page);
  await sinCuadricula(page);
  await selectTool(page, 'airbrush');
  await drag(page, 250, 400, 750, 400);

  expect(await inkIn(page, 480, 370, 40, 60)).toBeGreaterThan(50);

  await selectTool(page, 'eraser');
  await drag(page, 500, 340, 500, 460);          // cruza el eje por el medio
  await settle(page);

  const centro = await inkIn(page, 490, 370, 20, 60);
  const izq = await inkIn(page, 300, 370, 60, 60);
  const der = await inkIn(page, 700, 370, 60, 60);
  expect(centro, 'el claro del borrador').toBeLessThan(20);
  expect(izq, 'la mitad izquierda sigue pintada').toBeGreaterThan(50);
  expect(der, 'y la derecha también').toBeGreaterThan(50);

  const tras = await elements(page);
  expect(tras.filter(e => e.type === 'airbrush').length).toBe(2);
});

/* ── Sección UI: recorte por trama (v2.34.0) ──
   Ni una palabra ni un componente tienen geometría que partir, así que se
   rasterizan y lo que queda pasa a ser una imagen. Aquí sólo se puede probar
   en un navegador: el arnés vm no tiene canvas del que leer píxeles, y sin
   `deps.rasterErase` el borrador vuelve al borrado íntegro. */

/** Escribe un texto en el lienzo con la herramienta Texto. */
async function escribir(page, x, y, texto) {
  await selectTool(page, 'text');
  await clickCanvas(page, x, y);
  const input = page.locator('#text-input');
  await expect(input).toBeVisible();
  await input.fill(texto);
  await input.press('Enter');
  await settle(page);
}

test('borrar por el medio de una palabra deja lo de fuera, ya como imagen', async ({ page }) => {
  await openApp(page);
  await sinCuadricula(page);
  await escribir(page, 300, 400, 'Hola mundo');

  const antes = await elements(page);
  expect(antes.length).toBe(1);
  expect(antes[0].type).toBe('text');
  const caja = { x: antes[0].x, y: antes[0].y };

  await selectTool(page, 'eraser');
  await drag(page, caja.x + 60, caja.y - 20, caja.x + 60, caja.y + 40);
  await settle(page);

  // Se espera al TIPO, no al recuento: el número de elementos no cambia al
  // sustituir el texto por su trama, y `elements()` da por buena la escena
  // vieja en cuanto el autosave y el contador coinciden — 1 === 1.
  await expect.poll(async () => (await elements(page))[0].type).toBe('image');
  const tras = await elements(page);
  expect(tras.length).toBe(1);
  expect(tras[0].src, 'el texto mordido pasa a ser imagen')
    .toMatch(/^data:image\/png;base64,/);
  // Queda tinta a los dos lados del corte y ninguna dentro de él.
  await expect.poll(() => inkIn(page, caja.x + 52, caja.y - 10, 16, 40)).toBe(0);
  expect(await inkIn(page, caja.x, caja.y - 10, 40, 40)).toBeGreaterThan(10);
  expect(await inkIn(page, caja.x + 80, caja.y - 10, 40, 40)).toBeGreaterThan(10);
});

test('cruzar el hueco vacío de una tarjeta ya no se la lleva', async ({ page }) => {
  await openApp(page);
  await sinCuadricula(page);
  await selectTool(page, 'card');
  await drag(page, 300, 200, 600, 560);
  const antes = await elements(page);
  expect(antes[0].type).toBe('card');

  await selectTool(page, 'eraser');
  await drag(page, 380, 520, 520, 520);   // zona baja, entre las líneas: papel
  await settle(page);

  const tras = await elements(page);
  expect(tras.length).toBe(1);
  expect(tras[0].type, 'sin quitar un solo píxel, la tarjeta sigue siendo tarjeta')
    .toBe('card');
});

test('morder el borde de un botón le abre un hueco y conserva el resto', async ({ page }) => {
  await openApp(page);
  await sinCuadricula(page);
  await selectTool(page, 'button');
  await drag(page, 300, 300, 500, 380);
  expect((await elements(page))[0].type).toBe('button');

  await selectTool(page, 'eraser');
  await drag(page, 400, 285, 400, 315);   // muerde el borde de arriba
  await settle(page);

  await expect.poll(async () => (await elements(page))[0].type).toBe('image');
  const tras = await elements(page);
  expect(tras.length).toBe(1);
  expect(await inkIn(page, 392, 292, 16, 20)).toBe(0);
  // Los dos laterales del botón siguen dibujados.
  expect(await inkIn(page, 295, 320, 14, 40)).toBeGreaterThan(5);
  expect(await inkIn(page, 492, 320, 14, 40)).toBeGreaterThan(5);
});

test('el borrador no toca una forma por la que solo pasa cerca', async ({ page }) => {
  await openApp(page);
  await sinCuadricula(page);
  await selectTool(page, 'circle');
  await drag(page, 400, 250, 700, 550);
  const antes = await elements(page);

  await selectTool(page, 'eraser');
  await drag(page, 410, 260, 430, 280);          // esquina de la caja, fuera del aro
  await settle(page);

  const tras = await elements(page);
  expect(tras.length).toBe(1);
  expect(tras[0].type).toBe('circle');
  expect(tras[0].w).toBe(antes[0].w);
});
