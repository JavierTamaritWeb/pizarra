// Navegación del lienzo (v3.5.0): zoom al cursor con Ctrl+rueda, pan con
// espacio y botón central, encuadres (Mayús+1, Ctrl+0, % clicable) y el botón
// «Volver al dibujo». Todo esto vive en e2e porque es exactamente lo que el
// arnés node:vm no puede ver: eventos wheel reales, scroll de un contenedor
// con layout, modificadores del teclado del sistema y cajas renderizadas.
const { test, expect } = require('@playwright/test');
const {
  WIDE, NARROW, openApp, settle, selectTool, drag, elements,
  canvasPoint, zoomPct, setZoom,
} = require('./helpers');

// Scroll actual del área (el contenedor de scroll es .canvas-area).
const areaScroll = page => page.evaluate(() => {
  const a = document.querySelector('.canvas-area');
  return { left: a.scrollLeft, top: a.scrollTop };
});

test('Ctrl+rueda hace zoom manteniendo el punto del lienzo bajo el cursor', async ({ page }) => {
  // NARROW: auto-ajuste al 100% y el lienzo desborda el área — el caso en el
  // que un zoom mal anclado "huye" del sitio que se está mirando.
  await openApp(page, { viewport: NARROW });
  await selectTool(page, 'rect');
  await drag(page, 250, 150, 450, 300);

  const anchor = await canvasPoint(page, 350, 225); // centro del rectángulo
  await page.mouse.move(anchor.x, anchor.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -240); // rueda hacia arriba = acercar
  await page.keyboard.up('Control');
  await settle(page);

  expect(await zoomPct(page)).toBeGreaterThan(100);
  // El mismo punto del lienzo debe seguir bajo el mismo píxel de pantalla.
  const after = await canvasPoint(page, 350, 225);
  expect(Math.abs(after.x - anchor.x)).toBeLessThan(3);
  expect(Math.abs(after.y - anchor.y)).toBeLessThan(3);
});

test('la rueda sin Ctrl NO hace zoom: sigue siendo scroll', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  const p = await canvasPoint(page, 600, 400);
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(0, -240);
  await settle(page);
  expect(await zoomPct(page)).toBe(100);
});

test('espacio + arrastre desplaza la vista sin crear ni mover nada', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await selectTool(page, 'pencil');
  const before = await areaScroll(page);
  const p = await canvasPoint(page, 800, 400);
  await page.keyboard.down('Space');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 120, p.y);
  await page.mouse.up();
  await page.keyboard.up('Space');
  await settle(page);

  const afterScroll = await areaScroll(page);
  expect(afterScroll.left).toBeGreaterThan(before.left + 60);
  expect(await elements(page)).toHaveLength(0);

  // Al soltar el espacio, el lápiz vuelve a dibujar: la mano no se queda
  // pegada. (En coordenadas que sigan visibles tras el scroll de 120px: el
  // (100,100) del lienzo queda ahora debajo del sidebar.)
  await drag(page, 400, 200, 500, 260);
  expect(await elements(page)).toHaveLength(1);
});

test('el botón central del ratón panea con cualquier herramienta', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await selectTool(page, 'rect');
  const before = await areaScroll(page);
  const p = await canvasPoint(page, 800, 400);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(p.x - 120, p.y - 40);
  await page.mouse.up({ button: 'middle' });
  await settle(page);

  const after = await areaScroll(page);
  expect(after.left).toBeGreaterThan(before.left + 60);
  expect(await elements(page)).toHaveLength(0);
});

test('Mayús+1 encuadra el dibujo y Ctrl+0 (o el % clicable) vuelve al 100%', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await selectTool(page, 'rect');
  await drag(page, 100, 100, 300, 250);

  // Un rectángulo pequeño en un viewport grande: el encuadre debe subir el
  // zoom hasta el tope del slider (300%).
  await page.keyboard.press('Shift+Digit1');
  await settle(page);
  expect(await zoomPct(page)).toBe(300);

  await page.keyboard.press('Control+Digit0');
  await settle(page);
  expect(await zoomPct(page)).toBe(100);

  // La vía de ratón del mismo par: el botón «Encuadrar» y el % clicable.
  await page.locator('#btn-zoom-fit').click();
  await settle(page);
  expect(await zoomPct(page)).toBe(300);
  await page.locator('#zoom-val').click();
  await settle(page);
  expect(await zoomPct(page)).toBe(100);
});

test('«Volver al dibujo» aparece al perderlo de vista y un clic lo encuadra', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await selectTool(page, 'rect');
  await drag(page, 100, 100, 260, 220);

  const back = page.locator('#btn-back-content');
  await expect(back).toBeHidden();

  // Zoom alto + scroll a la esquina opuesta: el rectángulo queda fuera del
  // viewport del área y el botón debe aparecer solo.
  await setZoom(page, 300);
  await page.evaluate(() => {
    const a = document.querySelector('.canvas-area');
    a.scrollLeft = a.scrollWidth;
    a.scrollTop = a.scrollHeight;
  });
  await expect(back).toBeVisible();

  await back.click();
  await settle(page);
  await expect(back).toBeHidden();
  // Y el rectángulo vuelve a estar en pantalla: su centro cae dentro del área.
  const c = await canvasPoint(page, 180, 160);
  const area = await page.locator('.canvas-area').boundingBox();
  expect(c.x).toBeGreaterThan(area.x);
  expect(c.x).toBeLessThan(area.x + area.width);
  expect(c.y).toBeGreaterThan(area.y);
  expect(c.y).toBeLessThan(area.y + area.height);
});
