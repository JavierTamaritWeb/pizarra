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
const { WIDE, openApp, settle, selectTool, drag, elements } = require('./helpers');

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
