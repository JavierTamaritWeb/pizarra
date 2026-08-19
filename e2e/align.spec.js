'use strict';
/* ============================================================
   align.spec.js — Colocación (v3.10.0): alinear/distribuir/voltear y
   agrupar.

   Lo que sólo se puede ver aquí: que la rejilla nueva APAREZCA de verdad (la
   trampa del `[hidden]` contra un bloque que declara `display`, que el arnés
   `node:vm` no puede ver porque allí `hidden` es una propiedad de JS y no un
   estilo), y que `Mayús+H` llegue al atajo en vez de escribir en algún sitio.
   ============================================================ */
const { test, expect } = require('@playwright/test');
const {
  NARROW, openApp, settle, selectTool, drag, elements, readAutosave, canvasPoint,
} = require('./helpers');

/**
 * Espera a que el autosave refleje un cambio que NO altera el número de
 * elementos (voltear, alinear, agrupar).
 *
 * `elements()` espera a que el contador «Elementos» y el autosave coincidan,
 * y aquí ese acuerdo ya se cumple con la escena ANTERIOR (2 === 2): devuelve
 * el estado viejo sin fallar. El autosave va con 500 ms de rebote, así que
 * hay que sondear el valor concreto que tiene que cambiar.
 */
function sceneField(page, get) {
  return expect.poll(async () => get(await readAutosave(page)), { timeout: 4000 });
}

async function dosRects(page) {
  await selectTool(page, 'rect');
  await drag(page, 100, 100, 200, 200);
  await selectTool(page, 'rect');
  await drag(page, 400, 300, 560, 420);
  await selectTool(page, 'select');
}

test('la rejilla de colocación aparece con la selección y se va sin ella', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await dosRects(page);
  const rejilla = page.locator('#align-row');
  // La trampa del [hidden]: .panel__align declara display:grid, así que sin su
  // regla propia el atributo no oculta nada y la rejilla se ve siempre.
  await expect(rejilla).toBeHidden();

  await page.keyboard.press('Control+a');
  await settle(page);
  await expect(rejilla).toBeVisible();
  await expect(rejilla.locator('button')).toHaveCount(6);
  // Repartir pide TRES unidades: con dos, su fila no está.
  await expect(page.locator('#dist-row')).toBeHidden();
  await expect(page.locator('#mirror-row')).toBeVisible();

  const c = await canvasPoint(page, 850, 480);   // clic en el vacío
  await page.mouse.click(c.x, c.y);
  await settle(page);
  await expect(rejilla).toBeHidden();
});

test('alinear a la izquierda mueve de verdad, desde el botón del panel', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await dosRects(page);
  await page.keyboard.press('Control+a');
  await settle(page);
  await page.locator('#align-row [data-align="left"]').click();
  await settle(page);
  await sceneField(page, els => els.map(e => e.x)).toEqual([100, 100]);
});

test('Mayús+H voltea la selección en vez de elegir la herramienta', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await dosRects(page);
  await page.keyboard.press('Control+a');
  await settle(page);
  const antes = (await elements(page)).map(e => e.x);

  await page.keyboard.press('Shift+H');
  await settle(page);
  // La caja combinada va de 100 a 560: el espejo manda el primero al fondo.
  await sceneField(page, els => els.map(e => e.x)).not.toEqual(antes);
  // Y la herramienta no ha cambiado: el bloque del volteo corta antes.
  await expect(page.locator('.sidebar__tool--active')).toHaveAttribute('data-tool', 'select');

  // Ida y vuelta: el volteo es su propio inverso.
  await page.keyboard.press('Shift+H');
  await settle(page);
  await sceneField(page, els => els.map(e => e.x)).toEqual(antes);
});

test('Ctrl+G agrupa y el botón «Desagrupar» lo deshace', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await dosRects(page);
  await page.keyboard.press('Control+a');
  await settle(page);
  await expect(page.locator('#btn-group')).toBeVisible();

  await page.keyboard.press('Control+g');
  await settle(page);
  await sceneField(page, els => !!(els[0] && els[0].buildingGroupId)).toBe(true);

  // Un clic en el vacío y otro sobre uno solo: la selección coge a los dos,
  // así que «Desagrupar» está disponible.
  const vacio = await canvasPoint(page, 850, 480);
  await page.mouse.click(vacio.x, vacio.y);
  const uno = await canvasPoint(page, 150, 150);
  await page.mouse.click(uno.x, uno.y);
  await settle(page);
  await expect(page.locator('#btn-ungroup')).toBeEnabled();
  await page.locator('#btn-ungroup').click();
  await settle(page);
  await sceneField(page, els => els.every(e => e.buildingGroupId === undefined)).toBe(true);
});
