'use strict';
/* ============================================================
   floatbars.spec.js — Barras de herramientas flotantes (v3.13.0).

   Aquí va lo que el arnés `node:vm` no puede ver por construcción: la
   visibilidad real del modo (CSS puro: `app--floatbars` solo actúa por
   encima de 1100px), el arrastre por el asa con el ratón, el clamp al
   viewport, el plegado con estilos aplicados y que recargar restaura las
   posiciones de fábrica conservando el modo. La lógica (construcción,
   partición, prefs, activo duplicado) vive en tests/app-interaction.test.js
   y tests/config-templates.test.js.
   ============================================================ */
const { test, expect } = require('@playwright/test');
const {
  WIDE, openApp, settle, drag, elements,
} = require('./helpers');

/** Activa el modo flotante desde el interruptor del topbar. */
async function activarBarras(page) {
  await page.locator('#btn-float-tools').click();
  await expect(page.locator('.floatbar')).toHaveCount(5);
  await expect(page.locator('.floatbar').first()).toBeVisible();
}

/** Elige una herramienta desde una barra flotante, cerrando sus ajustes si
    se abren — el gemelo de helpers.selectTool para `.floatbar__tool`. */
async function selectFloatTool(page, toolId) {
  await page.locator(`.floatbar__tool[data-tool="${toolId}"]`).click();
  for (const sel of ['#modal-stroke', '#modal-shape', '#modal-eraser',
    '#modal-text', '#modal-ui', '#modal-select']) {
    const modal = page.locator(sel);
    if (await modal.evaluate(d => d.open)) {
      await modal.locator('.modal__cancel').click();
    }
  }
  await settle(page);
}

test('conmutar enseña 5 barras rotuladas y oculta el sidebar; volver lo restaura', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await expect(page.locator('#sidebar')).toBeVisible();

  await activarBarras(page);
  await expect(page.locator('.floatbar__title')).toHaveText([
    'Edición', 'Dibujo', 'Formas y 3D', 'UI', 'Edificios y Jardín',
  ]);
  // El sidebar se OCULTA, no se vacía: sus botones siguen en el DOM.
  await expect(page.locator('#sidebar')).toBeHidden();
  await expect(page.locator('#btn-float-tools')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#btn-float-tools').click();
  await expect(page.locator('#sidebar')).toBeVisible();
  await expect(page.locator('.floatbar').first()).toBeHidden();
});

test('se dibuja desde una barra flotante igual que desde el sidebar', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await activarBarras(page);
  await selectFloatTool(page, 'rect');
  await drag(page, 300, 300, 500, 450);
  const els = await elements(page);
  expect(els.length).toBe(1);
  expect(els[0].type).toBe('rect');
  // Y el botón flotante queda marcado como activo.
  await expect(page.locator('.floatbar__tool[data-tool="rect"]'))
    .toHaveClass(/floatbar__tool--active/);
});

test('arrastrar una barra por el asa la mueve, y no puede salirse del viewport', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await activarBarras(page);
  const barra = page.locator('.floatbar').first();
  const antes = await barra.boundingBox();

  const asa = barra.locator('.floatbar__handle');
  const caja = await asa.boundingBox();
  const agarre = { x: caja.x + 20, y: caja.y + caja.height / 2 };
  await page.mouse.move(agarre.x, agarre.y);
  await page.mouse.down();
  await page.mouse.move(agarre.x + 300, agarre.y + 200, { steps: 8 });
  await page.mouse.up();
  const despues = await barra.boundingBox();
  expect(Math.round(despues.x - antes.x)).toBe(300);
  expect(Math.round(despues.y - antes.y)).toBe(200);

  // Un lanzamiento hacia fuera queda recortado: el asa sigue dentro.
  await page.mouse.move(despues.x + 20, despues.y + 12);
  await page.mouse.down();
  await page.mouse.move(WIDE.width + 400, WIDE.height + 400, { steps: 6 });
  await page.mouse.up();
  const clampada = await barra.boundingBox();
  expect(clampada.x + 84).toBeLessThanOrEqual(WIDE.width + 1);
  expect(clampada.y + 32).toBeLessThanOrEqual(WIDE.height + 1);
});

test('plegar deja solo el asa y aria-expanded lo cuenta', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await activarBarras(page);
  const barra = page.locator('.floatbar').first();
  const pliegue = barra.locator('.floatbar__collapse');
  await expect(barra.locator('.floatbar__tool').first()).toBeVisible();

  await pliegue.click();
  await expect(pliegue).toHaveAttribute('aria-expanded', 'false');
  await expect(barra.locator('.floatbar__tool').first()).toBeHidden();

  await pliegue.click();
  await expect(barra.locator('.floatbar__tool').first()).toBeVisible();
});

test('recargar conserva el modo pero devuelve posiciones y plegado a fábrica', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await activarBarras(page);
  const barra = page.locator('.floatbar').first();
  const fabrica = await barra.boundingBox();

  // Se arrastra y se pliega la primera barra…
  const asa = await barra.locator('.floatbar__handle').boundingBox();
  await page.mouse.move(asa.x + 20, asa.y + asa.height / 2);
  await page.mouse.down();
  await page.mouse.move(asa.x + 500, asa.y + 300, { steps: 6 });
  await page.mouse.up();
  await barra.locator('.floatbar__collapse').click();
  expect((await barra.boundingBox()).x).not.toBe(fabrica.x);

  // …y la recarga la devuelve a su sitio, desplegada, con el modo puesto.
  await page.reload();
  await expect(page.locator('.floatbar')).toHaveCount(5);
  await expect(page.locator('.floatbar').first()).toBeVisible();
  await expect(page.locator('#sidebar')).toBeHidden();
  const trasRecarga = await page.locator('.floatbar').first().boundingBox();
  expect(Math.round(trasRecarga.x)).toBe(Math.round(fabrica.x));
  expect(Math.round(trasRecarga.y)).toBe(Math.round(fabrica.y));
  await expect(page.locator('.floatbar').first().locator('.floatbar__collapse'))
    .toHaveAttribute('aria-expanded', 'true');
});

test('bajo 1100px el modo no existe: vuelve el sidebar; al crecer, las barras siguen donde estaban', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await activarBarras(page);
  // Se aparta una barra para comprobar que la posición sobrevive DENTRO de
  // la sesión (lo que muere es la sesión, no el viewport).
  const barra = page.locator('.floatbar').first();
  const asa = await barra.locator('.floatbar__handle').boundingBox();
  await page.mouse.move(asa.x + 20, asa.y + asa.height / 2);
  await page.mouse.down();
  await page.mouse.move(asa.x + 220, asa.y + 120, { steps: 6 });
  await page.mouse.up();
  const movida = await barra.boundingBox();

  await page.setViewportSize({ width: 1000, height: 700 });
  await expect(page.locator('.floatbar').first()).toBeHidden();
  await expect(page.locator('#sidebar')).toBeVisible();
  // Y el interruptor tampoco está: el modo no existe aquí.
  await expect(page.locator('#btn-float-tools')).toBeHidden();

  await page.setViewportSize(WIDE);
  await expect(page.locator('.floatbar').first()).toBeVisible();
  const devuelta = await barra.boundingBox();
  expect(Math.round(devuelta.x)).toBe(Math.round(movida.x));
  expect(Math.round(devuelta.y)).toBe(Math.round(movida.y));
});

test('cada barra flotante es UNA parada de Tab, con flechas por dentro', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await activarBarras(page);
  // En cada barra hay exactamente un botón tabulable.
  for (let i = 0; i < 5; i++) {
    await expect(page.locator('.floatbar').nth(i)
      .locator('.floatbar__tool[tabindex="0"]')).toHaveCount(1);
  }
  // Y las flechas mueven el foco por dentro de la barra (roving tabindex).
  const primera = page.locator('.floatbar').first();
  await primera.locator('.floatbar__tool[tabindex="0"]').focus();
  await page.keyboard.press('ArrowDown');
  const enfocado = await page.evaluate(() => document.activeElement.dataset.tool);
  expect(enfocado).toBe('pick');
});
