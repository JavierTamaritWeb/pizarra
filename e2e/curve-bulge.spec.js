'use strict';
/* ============================================================
   curve-bulge.spec.js — Curvatura ajustable de las flechas curvas (v3.2.0).

   Va en e2e por las dos cosas que el arnés `node:vm` no puede ver:
   el ATENUADO del mando (una clase CSS y la propiedad `disabled` sobre un
   control real) y que una comba mayor se traduzca en más dibujo en pantalla
   — píxeles, no coordenadas.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { WIDE, openApp, settle, selectTool, drag, elements } = require('./helpers');

test.use({ viewport: WIDE });

/** Abre los ajustes de trazo pulsando la herramienta (la vía de siempre) y los
    deja abiertos: aquí lo que se mira es el propio modal. */
async function abrirAjustes(page, tool) {
  await page.locator(`.sidebar__tool[data-tool="${tool}"]`).click();
  await settle(page);
  await expect(page.locator('#modal-stroke')).toHaveJSProperty('open', true);
}

test('la curvatura se atenúa salvo con la Flecha curva o una curva seleccionada', async ({ page }) => {
  await openApp(page);

  // Con el Lápiz: el mando existe pero está apagado, como el discontinuo.
  await abrirAjustes(page, 'pencil');
  await expect(page.locator('#stroke-modal-curve')).toBeDisabled();
  await expect(page.locator('#stroke-modal-curve-row')).toHaveClass(/modal__field--off/);
  await page.locator('#modal-stroke .modal__cancel').click();
  await settle(page);

  // Con la Flecha curva: habilitado y a plena opacidad.
  await abrirAjustes(page, 'curveArrow');
  await expect(page.locator('#stroke-modal-curve')).toBeEnabled();
  await expect(page.locator('#stroke-modal-curve-row')).not.toHaveClass(/modal__field--off/);
  // Y visible de verdad dentro del diálogo, no recortado fuera de la vista.
  const caja = await page.locator('#stroke-modal-curve').boundingBox();
  expect(caja.width).toBeGreaterThan(40);
});

test('subir la curvatura dibuja una curva más combada', async ({ page }) => {
  await openApp(page);

  const dibujarCon = async pct => {
    await page.locator('.sidebar__tool[data-tool="curveArrow"]').click();
    await settle(page);
    const slider = page.locator('#stroke-modal-curve');
    await slider.fill(String(pct));
    await slider.dispatchEvent('input');
    await slider.dispatchEvent('change');
    await page.locator('#modal-stroke .modal__cancel').click();
    await settle(page);
    await drag(page, 200, 400, 600, 400);
    const els = await elements(page);
    return els[els.length - 1];
  };

  const suave = await dibujarCon(10);
  const honda = await dibujarCon(70);

  // La cuerda es la misma en las dos (mismo arrastre horizontal), así que la
  // distancia del control al eje es directamente la comba dibujada.
  const comba = el => Math.abs(el.cy - (el.y1 + el.y2) / 2);
  expect(comba(suave)).toBeGreaterThan(0);
  expect(comba(honda)).toBeGreaterThan(comba(suave) * 3);

  // Y se ve: la caja que ocupa la curva honda es mucho más alta.
  const alto = el => Math.abs(el.cy - el.y1);
  expect(alto(honda)).toBeGreaterThan(alto(suave) * 3);
});

test('la muestra del modal se curva con el mando, y no es una recta', async ({ page }) => {
  await openApp(page);
  await abrirAjustes(page, 'curveArrow');

  // Tinta pintada en la muestra: una curva honda ocupa más filas de píxeles
  // que una casi recta, con el mismo grosor y color.
  const tinta = async () => page.locator('#stroke-preview').evaluate(c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const filas = new Set();
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        // Cualquier píxel que no sea el papel del lienzo (uniforme) cuenta.
        if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) { filas.add(y); break; }
      }
    }
    return filas.size;
  });

  const slider = page.locator('#stroke-modal-curve');
  await slider.fill('0');
  await slider.dispatchEvent('input');
  await settle(page);
  const recta = await tinta();

  await slider.fill('80');
  await slider.dispatchEvent('input');
  await settle(page);
  const combada = await tinta();

  expect(recta).toBeGreaterThan(0);
  expect(combada).toBeGreaterThan(recta + 10);
});
