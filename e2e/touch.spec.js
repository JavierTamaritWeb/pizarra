// Táctil (v3.7.0): dos dedos = cámara (pan + pinch), doble-tap = doble clic,
// long-press = Alt+tap (aislar pieza) y el auto-ajuste por debajo del 100% en
// dispositivos táctiles. Los gestos multitáctiles se despachan por CDP
// (Input.dispatchTouchEvent) porque la API de Playwright solo trae el tap.
const { test, expect } = require('@playwright/test');
const {
  NARROW, openApp, settle, selectTool, drag, elements, canvasPoint, zoomPct,
} = require('./helpers');

test.use({ hasTouch: true });

const cdp = page => page.context().newCDPSession(page);

// Dibuja una fachada con el ratón (el catálogo pide elegir vista) y devuelve
// cuántas piezas tiene: la materia prima de los tests de grupo.
async function drawFacade(page) {
  await page.locator('.sidebar__tool[data-tool="fachada"]').click();
  await page.locator('#facade-catalog .modal__facade').first().click();
  await settle(page);
  await drag(page, 250, 150, 700, 500);
  return (await elements(page)).length;
}

test('dos dedos hacen pinch-zoom sin dejar ni un punto dibujado', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await selectTool(page, 'pencil');
  const s = await cdp(page);
  const c = await canvasPoint(page, 600, 400);
  const pts = d => [{ x: c.x - d, y: c.y }, { x: c.x + d, y: c.y }];

  // El primer dedo abre un trazo de lápiz; el segundo debe ABORTARLO y pasar
  // a cámara — si lo cometiera, quedaría un punto en el lienzo.
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(40) });
  for (let d = 50; d <= 140; d += 10) {
    await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d) });
  }
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(page);

  expect(await zoomPct(page)).toBeGreaterThan(100);
  expect(await elements(page)).toHaveLength(0);
});

test('el doble-tap desciende a la pieza de un grupo, como el doble clic', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  const total = await drawFacade(page);
  expect(total).toBeGreaterThan(2);
  await selectTool(page, 'select');

  const p = await canvasPoint(page, 300, 480); // sobre el muro de la fachada
  await page.touchscreen.tap(p.x, p.y);
  await page.touchscreen.tap(p.x, p.y);
  await settle(page);
  await page.keyboard.press('Delete');
  await settle(page);

  // Un tap simple selecciona el edificio ENTERO (Delete lo habría vaciado);
  // el doble-tap baja a la pieza, así que solo cae una.
  expect(await elements(page)).toHaveLength(total - 1);
});

test('el long-press aísla la pieza (el Alt+clic que el táctil no tiene)', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  const total = await drawFacade(page);
  await selectTool(page, 'select');

  const s = await cdp(page);
  const p = await canvasPoint(page, 300, 480);
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  await page.waitForTimeout(700); // > 500ms sin moverse: dispara el long-press
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(page);
  await page.keyboard.press('Delete');
  await settle(page);

  expect(await elements(page)).toHaveLength(total - 1);
});

test('el auto-ajuste baja del 100% para que el lienzo quepa en un móvil', async ({ page }) => {
  // hasTouch (arriba, a nivel de fichero) hace que (pointer: coarse) case en
  // Chromium; el viewport es el de un móvil corriente.
  await openApp(page, { viewport: { width: 393, height: 700 } });
  // A este ancho el panel es un cajón cerrado y #zoom-val no se ve (innerText
  // vacío): el zoom se lee del value del slider, que existe igual.
  const pct = Number(await page.locator('#zoom-slider').inputValue());
  expect(pct).toBeLessThan(100);
  expect(pct).toBeGreaterThanOrEqual(30); // ZOOM_MIN sigue mandando
});
