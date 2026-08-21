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

/* En los tests con arrastre las barras se localizan por su rótulo, no por
   posición (.first()/.nth()): una barra arrastrada se muda de la columna a
   `.app` (floatFloatbar, app.js), así que el ORDEN del DOM cambia con el
   gesto y un locator posicional pasaría a señalar otra barra. */
const porNombre = (page, label) => page.locator(`.floatbar[aria-label="${label}"]`);

test('arrastrar una barra por el asa la mueve, y no puede salirse del viewport', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await activarBarras(page);
  const barra = porNombre(page, 'Edición');
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
  expect(clampada.x + 136).toBeLessThanOrEqual(WIDE.width + 1);
  expect(clampada.y + 32).toBeLessThanOrEqual(WIDE.height + 1);
});

test('la disposición de fábrica es UNA columna pegada al borde, sin huecos, que escrolea', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await activarBarras(page);
  const cajas = [];
  for (let i = 0; i < 5; i++) {
    cajas.push(await page.locator('.floatbar').nth(i).boundingBox());
  }
  // Donde vive el sidebar al abrir la app: pegadas al borde izquierdo, desde
  // el topbar, y cada barra empieza exactamente donde acaba la anterior —
  // el apilado es flujo CSS, así que aquí se mide que de verdad no hay ni
  // huecos ni solapes.
  expect(Math.round(cajas[0].x)).toBe(0);
  expect(Math.round(cajas[0].y)).toBe(52);
  for (let i = 1; i < 5; i++) {
    expect(Math.round(cajas[i].x)).toBe(0);
    expect(Math.abs(cajas[i].y - (cajas[i - 1].y + cajas[i - 1].height)))
      .toBeLessThanOrEqual(1);
  }
  // Y la columna escrolea como el sidebar cuando no caben todas.
  const antes = await page.locator('.floatbar').nth(4).boundingBox();
  await page.locator('#floatbars').evaluate(el => { el.scrollTop = 400; });
  const despues = await page.locator('.floatbar').nth(4).boundingBox();
  expect(Math.round(antes.y - despues.y)).toBe(400);
});

test('los botones van en DOS columnas, como el sidebar ancho', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await activarBarras(page);
  const cols = await page.locator('.floatbar__tools').first()
    .evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(2);
});

test('apagar y encender el modo devuelve la barra movida a fábrica', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await activarBarras(page);
  const barra = porNombre(page, 'Edición');
  const fabrica = await barra.boundingBox();
  const asa = await barra.locator('.floatbar__handle').boundingBox();
  await page.mouse.move(asa.x + 20, asa.y + asa.height / 2);
  await page.mouse.down();
  await page.mouse.move(asa.x + 420, asa.y + 260, { steps: 6 });
  await page.mouse.up();
  expect((await barra.boundingBox()).x).not.toBe(fabrica.x);

  await page.locator('#btn-float-tools').click();   // apagar
  await page.locator('#btn-float-tools').click();   // encender
  await expect(barra).toBeVisible();
  const devuelta = await barra.boundingBox();
  expect(Math.round(devuelta.x)).toBe(Math.round(fabrica.x));
  expect(Math.round(devuelta.y)).toBe(Math.round(fabrica.y));
});

/** Arrastra una barra por su asa hasta dejar el PUNTERO en (x,y). */
async function llevarBarra(page, barra, x, y) {
  const asa = await barra.locator('.floatbar__handle').boundingBox();
  await page.mouse.move(asa.x + 20, asa.y + asa.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 6 });
  await page.mouse.up();
}

test('arrastrar una barra de vuelta a la franja la acopla sola, en su sitio', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await activarBarras(page);
  const b0 = porNombre(page, 'Edición');
  const b1 = porNombre(page, 'Dibujo');
  const b3 = porNombre(page, 'UI');
  const fabrica0 = await b0.boundingBox();

  // Dos barras fuera de la columna, en sitios distintos.
  await llevarBarra(page, b1, 800, 300);
  await llevarBarra(page, b3, 1100, 560);
  expect((await b1.boundingBox()).x).toBeGreaterThan(300);
  const quieta = await b3.boundingBox();

  // Y una vuelve sola: la franja se anuncia como destino mientras el puntero
  // está encima, y al soltar la barra se acopla.
  const asa = await b1.locator('.floatbar__handle').boundingBox();
  await page.mouse.move(asa.x + 20, asa.y + asa.height / 2);
  await page.mouse.down();
  await page.mouse.move(60, 300, { steps: 6 });
  await expect(page.locator('#floatbars')).toHaveClass(/floatbars--drop/);
  await page.mouse.up();
  await expect(page.locator('#floatbars')).not.toHaveClass(/floatbars--drop/);

  // Vuelve al FLUJO, o sea a su sitio de siempre: pegada al borde y justo
  // debajo de la barra 0, sin hueco (la misma medida que la columna de
  // fábrica). Las demás no se recomponen.
  const acoplada = await b1.boundingBox();
  expect(Math.round(acoplada.x)).toBe(0);
  expect(Math.abs(acoplada.y - (fabrica0.y + fabrica0.height))).toBeLessThanOrEqual(1);
  const despues = await b3.boundingBox();
  expect(Math.round(despues.x)).toBe(Math.round(quieta.x));
  expect(Math.round(despues.y)).toBe(Math.round(quieta.y));
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
  const barra = porNombre(page, 'Edición');
  const fabrica = await barra.boundingBox();

  // Se arrastra y se pliega la primera barra… (a la derecha de la cascada
  // entera: si cayera debajo de otra barra, el clic al pliegue lo
  // interceptaría la de encima)
  const asa = await barra.locator('.floatbar__handle').boundingBox();
  await page.mouse.move(asa.x + 20, asa.y + asa.height / 2);
  await page.mouse.down();
  await page.mouse.move(asa.x + 900, asa.y + 300, { steps: 6 });
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
  const barra = porNombre(page, 'Edición');
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
