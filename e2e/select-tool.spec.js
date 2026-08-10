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
