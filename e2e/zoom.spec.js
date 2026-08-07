'use strict';
/* Zoom: auto-ajuste, alcance del scroll y coordenadas.

   Todo esto depende del layout real (`transform: scale()` no agranda la caja,
   el sizer sí) y por eso vivía en BUGS.md como "verificación manual". */

const { test, expect } = require('@playwright/test');
const {
  WIDE, NARROW, openApp, zoomPct, elements, selectTool, drag, clickCanvas,
  canvasPoint, setSlider, setZoom,
} = require('./helpers.js');

test('al abrir, el lienzo se ajusta al espacio disponible', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  expect(await zoomPct(page), 'con sitio de sobra el auto-ajuste agranda').toBeGreaterThan(100);

  // Y nunca por debajo del 100%: en ventanas justas se prefiere el scroll
  await openApp(page, { viewport: NARROW });
  expect(await zoomPct(page)).toBe(100);
});

// Regresión v1.16.1: el botón hacía `zoomManual = true; applyZoom(1)`, así que
// dejaba el lienzo más pequeño que recién abierto Y desactivaba el auto-ajuste
// para el resto de la sesión.
test('«Limpiar todo» devuelve el lienzo al ajuste automático, no a un 100% fijo', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  const fitted = await zoomPct(page);
  expect(fitted).toBeGreaterThan(100);

  await setSlider(page, 'zoom-slider', 50);
  expect(await zoomPct(page)).toBe(50);

  await page.locator('#btn-clear').click();
  await expect.poll(() => zoomPct(page),
    { message: 'tras limpiar debe verse como al abrir la app' }).toBe(fitted);
  await expect(page.locator('#canvas-sizer')).toHaveCSS('width', `${1200 * fitted / 100}px`);
});

test('tras «Limpiar todo» el auto-ajuste vuelve a actuar al redimensionar', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await setSlider(page, 'zoom-slider', 50);

  await page.locator('#btn-clear').click();
  await page.setViewportSize(WIDE);
  // El handler de resize va con 150ms de rebote
  await expect.poll(() => zoomPct(page)).toBeGreaterThan(100);
});

test('mover el slider desactiva el auto-ajuste para siempre', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await setSlider(page, 'zoom-slider', 130);

  await page.setViewportSize(WIDE);
  await page.waitForTimeout(500);
  expect(await zoomPct(page), 'una elección manual no se pisa nunca').toBe(130);
});

// BUGS.md › "Con zoom > 100% no se podía llegar a la parte izquierda/superior":
// `transform: scale()` no agranda la caja de layout, y lo que desborda en
// negativo no es scrollable en CSS. El sizer es lo que lo arregla.
test('con zoom al 300% se alcanza la esquina superior izquierda del lienzo', async ({ page }) => {
  await openApp(page);
  await setZoom(page, 300);
  expect(await zoomPct(page)).toBe(300);

  const area = await page.evaluate(() => {
    const a = document.querySelector('.canvas-area');
    a.scrollLeft = 0; a.scrollTop = 0;
    return { scrollWidth: a.scrollWidth, scrollHeight: a.scrollHeight };
  });
  expect(area.scrollWidth, 'el área scrollable debe seguir al lienzo escalado')
    .toBeGreaterThanOrEqual(1200 * 3);
  expect(area.scrollHeight).toBeGreaterThanOrEqual(800 * 3);

  // Con el scroll a 0, la esquina (0,0) del lienzo queda a la vista
  const canvas = await page.locator('#main-canvas').boundingBox();
  expect(canvas.width).toBeCloseTo(3600, 0);
  const visible = await page.locator('.canvas-area').boundingBox();
  expect(canvas.x).toBeGreaterThanOrEqual(visible.x - 1);
  expect(canvas.y).toBeGreaterThanOrEqual(visible.y - 1);
});

test('dibujar con zoom da coordenadas sin escalar', async ({ page }) => {
  await openApp(page);
  await setZoom(page, 200);

  await selectTool(page, 'rect');
  await drag(page, 100, 100, 300, 250);

  const [el] = await elements(page);
  expect(el.type).toBe('rect');
  // Las coordenadas viven siempre en el espacio del lienzo, no en el pintado
  expect(el.x).toBeCloseTo(100, 0);
  expect(el.y).toBeCloseTo(100, 0);
  expect(el.w).toBeCloseTo(200, 0);
  expect(el.h).toBeCloseTo(150, 0);
});

// BUGS.md › "El textarea de texto aparecía lejos del click con zoom ≠ 100%":
// el textarea vive DENTRO del wrapper ya escalado, así que se posiciona en
// coordenadas sin escalar. Multiplicarlas por el zoom lo mandaba lejos.
test('el editor de texto aparece donde se ha pulsado, con zoom ≠ 100%', async ({ page }) => {
  await openApp(page);
  await setZoom(page, 200);

  await selectTool(page, 'text');
  await clickCanvas(page, 200, 150);
  const input = page.locator('#text-input');
  await expect(input).toBeVisible();

  const box = await input.boundingBox();
  const target = await canvasPoint(page, 200, 150);
  // Tolerancia generosa: interesa "junto al click", no el píxel exacto
  expect(Math.abs(box.x - target.x)).toBeLessThan(30);
  expect(Math.abs(box.y - target.y)).toBeLessThan(30);
});
