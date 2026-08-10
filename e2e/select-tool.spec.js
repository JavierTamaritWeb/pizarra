'use strict';
/* ============================================================
   select-tool.spec.js — La herramienta «Select» (v2.11.0).

   «Select» es SOLO selección: el clic selecciona cualquier elemento y el
   arrastre dibuja siempre marquesina, incluso naciendo ENCIMA de un elemento
   — el gesto que con Mover lo movería. La lógica está guardada en el arnés
   vm (tests/app-interaction.test.js); aquí se comprueba lo que aquel no ve:
   el botón real del sidebar, el cursor CSS aplicado al lienzo y el gesto
   completo con el ratón del navegador, panel incluido.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { WIDE, openApp, settle, selectTool, drag, clickCanvas, elements } = require('./helpers');

test.use({ viewport: WIDE });

test('«Select»: el botón existe, el clic selecciona y la marquesina nace encima sin mover nada', async ({ page }) => {
  await openApp(page);

  // Dos rectángulos de partida.
  await selectTool(page, 'rect');
  await drag(page, 100, 100, 250, 220);
  await drag(page, 500, 100, 650, 220);
  await expect.poll(async () => (await elements(page)).length).toBe(2);

  // El botón «Select» está en el sidebar, visible y pulsable; al activarlo,
  // el lienzo cambia al cursor de solo-selección (flecha, no cruz ni move).
  const btn = page.locator('.sidebar__tool[data-tool="pick"]');
  await expect(btn).toBeVisible();
  await btn.click();
  // Desde la 2.17.0 elegirla abre sus ajustes, como toda herramienta
  // configurable. Este spec pulsa el botón del sidebar a propósito (para
  // comprobar que existe), así que cierra el modal a mano — es lo que hace el
  // helper selectTool() y lo que haría cualquiera antes de tocar el lienzo.
  await page.locator('#modal-select .modal__cancel').click();
  await settle(page);
  await expect(page.locator('#main-canvas')).toHaveClass(/canvas-area__canvas--pick/);

  // Clic sobre un elemento: lo selecciona — el panel enseña «Posición y
  // tamaño» con su X real, la prueba de que la selección existe de verdad.
  await clickCanvas(page, 150, 150);
  await expect(page.locator('#panel-sec-element')).toBeVisible();
  await expect(page.locator('#el-x')).toHaveValue('100');

  // Arrastre que NACE encima del primer rect y cruza hasta cubrir el segundo:
  // con Mover esto lo desplazaría; con «Select» es marquesina. Nada se mueve…
  await drag(page, 150, 150, 700, 250);
  await expect.poll(async () =>
    (await elements(page)).map(e => e.x).sort((a, b) => a - b).join(',')
  ).toBe('100,500');

  // …y los dos quedaron seleccionados: Supr los borra a la vez.
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await elements(page)).length).toBe(0);
});

/* Tipografías manuscritas autoalojadas (v2.13.0). El arnés vm no puede ver
   nada de esto: si una fuente cargó, si el lienzo la usa de verdad y si la
   app pide algo por red. Todo falla en silencio —el canvas dibuja con el
   resguardo del sistema y nadie se entera—, así que se comprueba aquí. */
test('las manuscritas se sirven desde el repo y elegir una cambia lo que dibuja el lienzo', async ({ page }) => {
  const externas = [];
  page.on('request', r => {
    if (/googleapis|gstatic/.test(r.url())) externas.push(r.url());
  });
  await openApp(page);

  // 1. La app no pide ninguna fuente por red, y la de arranque ya está cargada
  //    (el <canvas> no dispara la descarga: hay que pedirla a mano).
  expect(externas).toEqual([]);
  await expect.poll(async () => page.evaluate(
    () => [...document.fonts].some(f => f.family === 'Architects Daughter' && f.status === 'loaded')
  )).toBe(true);

  // 2. Elegir otra letra la carga y CAMBIA las métricas reales del lienzo:
  //    la prueba de que ctx.font la está usando, no un resguardo.
  const ancho = () => page.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = "24px 'Kalam'";
    return Math.round(c.measureText('Pizarra manuscrita').width);
  });
  const antes = await ancho();
  await page.selectOption('#sketch-font', 'kalam');
  await settle(page);
  await expect.poll(ancho, { timeout: 5000 }).not.toBe(antes);
  expect(externas).toEqual([]);

  // 3. El gemelo de «Ajustes del texto» sigue al del panel: es el mismo ajuste.
  await expect(page.locator('#text-modal-font')).toHaveValue('kalam');
});

// v2.17.0: «Los clics acumulan selección» dejó el panel y es el ajuste de
// «Select». Lo que el arnés vm no puede juzgar: que el modal se abra de verdad
// al pulsar el botón del sidebar, que su casilla se vea, y —la lección de la
// v2.16.2— que al cerrarlo el lienzo vuelva a responder. Un <dialog showModal>
// deja inerte todo lo que hay detrás, así que un modal que no se cierra bien
// convierte la herramienta en un callejón sin salida.
test('«Select» abre sus ajustes, y al cerrarlos el lienzo sigue vivo', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'rect');
  await drag(page, 100, 100, 200, 200);
  await drag(page, 400, 100, 500, 200);

  await page.locator('.sidebar__tool[data-tool="pick"]').click();
  const modal = page.locator('#modal-select');
  await expect(modal).toHaveAttribute('open', '');
  const casilla = page.locator('#select-modal-multi');
  await expect(casilla).toBeVisible();
  await expect(casilla).not.toBeChecked();

  // La casilla vieja del panel ya no existe.
  await expect(page.locator('#check-multi-select')).toHaveCount(0);

  await casilla.check();
  await page.locator('#modal-select .modal__cancel').click();
  await expect(modal).not.toHaveAttribute('open', '');
  await settle(page);

  // Y el ajuste hace su trabajo: dos clics sueltos acumulan los dos rects.
  await clickCanvas(page, 150, 150);
  await clickCanvas(page, 450, 150);
  await page.keyboard.press('Delete');
  await settle(page);
  expect(await elements(page)).toHaveLength(0);
});
