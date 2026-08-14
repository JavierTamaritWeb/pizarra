'use strict';
/* ============================================================
   rotate-keys.spec.js — ←/→ giran la forma seleccionada (v2.23.0)

   La lógica —qué gira, cuánto y en qué sentido— la cubre
   `tests/app-interaction.test.js` en milisegundos. Aquí va lo que el arnés
   `node:vm` no puede ver por construcción: que el atajo funciona con el foco
   real del navegador y que **consume la tecla**. Sin `preventDefault`, ←/→ son
   además el scroll horizontal del área del lienzo: la forma giraría y el
   lienzo se movería debajo a la vez, que es justo lo que no se quiere al estar
   colocando algo. El arnés vm no simula acciones por defecto del navegador, así
   que ese fallo pasaría sus pruebas enteras.

   Se ejecuta en NARROW porque ahí el lienzo (1200 px al 100 %) desborda la
   ventana: hay scroll horizontal real que perder. En WIDE cabe entero y la
   comprobación no comprobaría nada.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const {
  NARROW, openApp, selectTool, drag, clickCanvas, settle, elements,
} = require('./helpers.js');

test.use({ viewport: NARROW });

test('←/→ giran la forma seleccionada sin llevarse el scroll del lienzo', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'hexagon');

  await drag(page, 200, 180, 260, 240);   // el hexágono nace desde su centro
  await settle(page);
  expect(await elements(page)).toHaveLength(1);

  await selectTool(page, 'select');
  await clickCanvas(page, 200, 180);
  await settle(page);
  // La selección existe de verdad: el panel enseña la X del hexágono.
  await expect(page.locator('#panel-sec-element')).toBeVisible();

  // Desplazamos el área a mano: es lo que ←/→ moverían si el atajo no
  // consumiera la tecla.
  const scrollAntes = await page.evaluate(() => {
    const area = document.querySelector('.canvas-area');
    area.scrollLeft = 40;
    return area.scrollLeft;
  });
  expect(scrollAntes, 'en NARROW el lienzo desborda y hay scroll que perder')
    .toBeGreaterThan(0);

  // El giro no cambia el número de elementos, que es con lo que `elements()`
  // sincroniza, así que hay que sondear: el autoguardado va 500 ms por detrás
  // y una lectura directa devuelve la orientación anterior.
  const rotacion = async () => (await elements(page))[0].rotation;

  await page.keyboard.press('ArrowRight');
  await expect.poll(rotacion).toBe(30);

  await page.keyboard.press('ArrowRight');
  await expect.poll(rotacion).toBe(60);

  await page.keyboard.press('ArrowLeft');
  await expect.poll(rotacion).toBe(30);

  const scrollDespues = await page.evaluate(
    () => document.querySelector('.canvas-area').scrollLeft);
  expect(scrollDespues, 'la tecla se consume: el lienzo no se desplaza al girar')
    .toBe(scrollAntes);
});
