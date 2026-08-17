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
  // Cerrado: desplazado fuera por la derecha. boundingBox() devolvería null
  // (el cajón cerrado es visibility:hidden desde v2.2.0), así que se mide
  // con getBoundingClientRect, que ignora la visibilidad.
  const closed = await panel.evaluate(el => el.getBoundingClientRect().x);
  const width = 900;
  expect(closed, 'el cajón empieza fuera de la ventana').toBeGreaterThanOrEqual(width - 1);

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

// BUGS.md › "El cajón cerrado seguía siendo tabulable (oculto solo con
// transform)": el foco entraba en ~30 controles invisibles y desaparecía de
// pantalla. Solo un navegador real ve visibility, foco y Escape.
test('el cajón cerrado no puede recibir el foco; aria-expanded y Escape acompañan', async ({ page }) => {
  await openApp(page, { viewport: { width: 900, height: 800 } });
  const toggle = page.locator('#btn-panel-toggle');

  // Cerrado: sus controles ni se ven ni pueden enfocarse (visibility: hidden)
  await expect(page.locator('#zoom-slider')).toBeHidden();
  const focusable = await page.locator('#zoom-slider').evaluate(el => {
    el.focus();
    return document.activeElement === el;
  });
  expect(focusable, 'un control del cajón cerrado no debe poder enfocarse').toBe(false);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  // Abierto: visible, enfocable, y el botón lo anuncia
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#zoom-slider')).toBeVisible();

  // Escape lo cierra (sin modal abierto, la tecla es del cajón)
  await page.keyboard.press('Escape');
  await expect(page.locator('.app--panel-open')).toHaveCount(0);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
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

// BUGS.md › "Los nombres del sidebar se partían por dentro y pisaban su icono".
// Se comprueba en los dos modos (una y dos columnas): OpenDyslexic es ancha y
// un cambio de fuente, de cuerpo o de ancho de botón rompe esto en silencio.
test('los nombres del sidebar caben enteros y no pisan su icono', async ({ page }) => {
  await openApp(page, { viewport: { width: 1400, height: 900 } });
  const audit = () => page.evaluate(() => {
    const bad = [];
    for (const btn of document.querySelectorAll('.sidebar__tool')) {
      const name = btn.querySelector('.sidebar__tool-name');
      const icon = btn.querySelector('span:not(.sidebar__tool-name)');
      if (!name) continue;
      // Sin sitio para la palabra más larga, el contenido desborda su caja…
      if (name.scrollWidth > name.clientWidth + 1) bad.push(`desborda: ${name.textContent}`);
      // …y, si el rótulo es más ancho que el propio botón, se sale por los
      // lados y toca al vecino aunque su caja no "desborde": el span crece a
      // max-content y el overflow es visible, así que scrollWidth no lo ve.
      // Es lo que pasó al poner la interfaz en MAYÚSCULAS (v2.29.0).
      if (name.getBoundingClientRect().width > btn.getBoundingClientRect().width + 1) {
        bad.push(`más ancho que su botón: ${name.textContent}`);
      }
      const n = name.getBoundingClientRect();
      if (icon && n.top < icon.getBoundingClientRect().bottom - 1) {
        bad.push(`pisa el icono: ${name.textContent}`);
      }
      if (n.bottom > btn.getBoundingClientRect().bottom + 1) {
        bad.push(`se sale del botón: ${name.textContent}`);
      }
    }
    return bad;
  });
  expect(await audit(), 'sidebar ancho (dos columnas)').toEqual([]);

  // Caber no basta: a dos columnas los nombres largos ocupan casi todo su
  // botón, así que la separación real entre dos rótulos vecinos es la calle
  // del grid más lo poco que le sobre al más ancho. Con 0.2rem de calle eran
  // 3.5px y «RECTÁNGULO REDONDEADO» se leía de corrido. Se mide el hueco, no
  // el desbordamiento: ninguna de las comprobaciones de arriba lo veía.
  const hueco = await page.evaluate(() => {
    const names = [...document.querySelectorAll('.sidebar__tool-name')];
    let peor = Infinity;
    for (const a of names) {
      for (const b of names) {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        if (ra.left >= rb.left || Math.abs(ra.top - rb.top) > 3) continue;  // misma fila
        peor = Math.min(peor, rb.left - ra.right);
      }
    }
    return peor;
  });
  expect(hueco, 'los rótulos de dos botones vecinos se tocan').toBeGreaterThanOrEqual(6);

  await page.setViewportSize({ width: 1100, height: 800 });
  expect(await audit(), 'sidebar compacto (una columna)').toEqual([]);
});

// La barra superior desbordaba en silencio por debajo de ~1040px: ahí aparece
// el botón «Panel» (el panel pasa a cajón) y los siete rótulos dejan de caber,
// así que «Exportar» se salía de la pantalla. Por debajo de $topbar-icons los
// botones se quedan en icono. Se prueba a los dos lados del breakpoint, y que
// el rótulo siga estando para un lector de pantalla.
test('la barra superior se queda en iconos antes de desbordar', async ({ page }) => {
  await openApp(page, { viewport: { width: 1200, height: 800 } });
  // El rótulo se mide por ANCHO, no con toBeVisible: oculto sigue teniendo
  // una caja de 1px (se recorta, no se quita) y Playwright lo daría por
  // visible.
  const rotuloAncho = () => page.locator('#btn-export .btn__label')
    .evaluate(el => el.getBoundingClientRect().width);
  expect(await rotuloAncho(), 'ancha: el rótulo se lee').toBeGreaterThan(10);

  const exceso = () => page.locator('.topbar')
    .evaluate(el => el.scrollWidth - el.clientWidth);
  expect(await exceso(), 'ancha: cabe con rótulos').toBeLessThanOrEqual(0);

  // Justo por debajo del breakpoint: rótulos fuera y la barra deja de desbordar.
  for (const width of [1060, 900, 700]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await exceso(), `a ${width}px la barra no puede desbordar`)
      .toBeLessThanOrEqual(0);
    expect(await rotuloAncho(), `a ${width}px el rótulo se oculta`)
      .toBeLessThan(3);
    // El icono sigue, y el botón sigue estando dentro de la pantalla.
    await expect(page.locator('#btn-export .btn__icon')).toBeVisible();
    const dentro = await page.locator('#btn-export').evaluate(
      el => el.getBoundingClientRect().right <= window.innerWidth + 1);
    expect(dentro, `a ${width}px «Exportar» tiene que estar en pantalla`).toBe(true);
  }
  // El rótulo se oculta a la VISTA, no al lector de pantalla: el botón
  // conserva su nombre.
  expect(await page.locator('#btn-export').evaluate(el => el.textContent.trim()))
    .toContain('Exportar');
});
