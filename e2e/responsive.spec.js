'use strict';
/* Responsive: comportamiento que vive SOLO en CSS y que ningún test de lógica
   puede ver. Los tres breakpoints que la documentación promete
   (1201px, 1100px, 360px) se comprueban aquí contra el layout de verdad. */

const { test, expect } = require('@playwright/test');
const { openApp, setSlider } = require('./helpers.js');

// CLAUDE.md: "the @media (min-width: 1201px) rule widens it to 132px and turns
// every .sidebar__group into a two-column grid". El breakpoint es exacto a
// propósito, así que se prueba a los dos lados.
test('el sidebar pasa a dos columnas justo por encima de 1200px', async ({ page }) => {
  await openApp(page, { viewport: { width: 1400, height: 900 } });
  const sidebar = page.locator('#sidebar');
  await expect(sidebar).toHaveCSS('width', '132px');
  const cols = await page.locator('.sidebar__group').first()
    .evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols, 'dos columnas en escritorio amplio').toBe(2);

  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(sidebar).toHaveCSS('width', '72px');
});

// BUGS.md › "En ventanas ≤1100px el panel entero desaparecía sin alternativa".
test('por debajo de 1100px el panel es un cajón que se abre con «⚙ Panel»', async ({ page }) => {
  await openApp(page, { viewport: { width: 900, height: 800 } });
  const toggle = page.locator('#btn-panel-toggle');
  const panel = page.locator('.panel');

  await expect(toggle).toBeVisible();
  // Cerrado: desplazado fuera por la derecha
  const closed = await panel.boundingBox();
  const width = 900;
  expect(closed.x, 'el cajón empieza fuera de la ventana').toBeGreaterThanOrEqual(width - 1);

  await toggle.click();
  await expect(page.locator('.app--panel-open')).toHaveCount(1);
  // El cajón entra con una transición de 0.2s: hay que esperar a que llegue
  await expect.poll(() => panel.boundingBox().then(b => b.x)).toBeLessThan(width - 100);
  // Y sus controles son usables de verdad
  await expect(page.locator('#zoom-slider')).toBeVisible();
  await setSlider(page, 'zoom-slider', 150);
  await expect(page.locator('#zoom-val')).toHaveText('150');

  // El fondo lo cierra
  await page.locator('#panel-backdrop').click();
  await expect(page.locator('.app--panel-open')).toHaveCount(0);
});

test('en escritorio ancho el panel está fijo y el botón «⚙ Panel» oculto', async ({ page }) => {
  await openApp(page, { viewport: { width: 1400, height: 900 } });
  await expect(page.locator('#btn-panel-toggle')).toBeHidden();
  await expect(page.locator('#zoom-slider')).toBeVisible();
});

// BUGS.md › "Los modales desbordaban en pantallas estrechas (~320px)".
test('a 320px de ancho los modales caben sin desborde horizontal', async ({ page }) => {
  await openApp(page, { viewport: { width: 320, height: 640 } });
  await page.locator('#btn-help').click();
  await expect(page.locator('#modal-help')).toHaveAttribute('open', '');

  // El propio <dialog> lleva la clase .modal: no hay un hijo con ella
  const box = await page.locator('#modal-help').boundingBox();
  expect(box.width).toBeLessThanOrEqual(320);
  expect(box.x).toBeGreaterThanOrEqual(0);
  const overflows = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflows, 'la página no debe desbordar horizontalmente').toBe(false);
});

test('a 320px las variantes de un catálogo se apilan en una columna', async ({ page }) => {
  await openApp(page, { viewport: { width: 320, height: 640 } });
  await page.locator('.sidebar__tool[data-tool="puerta"]').click();
  await expect(page.locator('#modal-door')).toHaveAttribute('open', '');

  const cols = await page.locator('#door-catalog')
    .evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(1);
});
