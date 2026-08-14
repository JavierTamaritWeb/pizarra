'use strict';
/* ============================================================
   modal-palette.spec.js — Paletas dentro de los modales de ajustes y ancho
   del diálogo en pantallas grandes (v2.26.0).

   Va en e2e y no en `tests/`: lo que se comprueba es CSS puro —el ancho
   medido del <dialog> a cada lado del breakpoint y que los campos pasan a dos
   columnas— y clics reales sobre las muestras. El arnés `node:vm` no tiene
   layout, así que ahí las dos cosas pasarían dijera lo que dijera la hoja.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { WIDE, NARROW, openApp, settle, selectTool, drag, clickCanvas, elements } = require('./helpers');

/** Ancho en px del diálogo, medido de verdad. */
const anchoModal = (page, id) =>
  page.locator(`#${id}`).evaluate(d => d.getBoundingClientRect().width);

test('el modal de ajustes se ensancha por encima de 1200px, y no antes', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await expect(page.locator('#modal-shape')).toBeVisible();
  const estrecho = await anchoModal(page, 'modal-shape');
  // 46rem = el ancho del modal corriente (1rem = 10px por el 62.5%)
  expect(estrecho).toBeCloseTo(460, 0);
  // Y sus campos siguen en UNA columna
  expect(await page.locator('#modal-shape .modal__build-fields')
    .evaluate(n => getComputedStyle(n).gridTemplateColumns.split(' ').length)).toBe(1);

  await page.setViewportSize(WIDE);
  await settle(page);
  const ancho = await anchoModal(page, 'modal-shape');
  expect(ancho).toBeCloseTo(760, 0);      // 76rem
  expect(ancho).toBeGreaterThan(estrecho);
  expect(await page.locator('#modal-shape .modal__build-fields')
    .evaluate(n => getComputedStyle(n).gridTemplateColumns.split(' ').length)).toBe(2);
});

test('los quince modales con miniatura son los que se ensanchan', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  // La clase la lleva el diálogo, no el contenedor: si alguien añade un modal
  // con miniatura y se olvida, se queda estrecho y con una columna larguísima.
  // Las fichas botánicas quedan fuera: tienen su propio ancho (.modal--plant).
  const conMiniatura = await page.locator('dialog:has(.modal__build):not(.modal--plant)').count();
  const anchos = await page.locator('dialog.modal--settings').count();
  expect(conMiniatura).toBe(15);
  expect(anchos).toBe(conMiniatura);
});

test('la paleta del trazo del modal pinta el elemento seleccionado', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await page.locator('#modal-shape').evaluate(d => d.close());
  await drag(page, 300, 300, 420, 400);
  await settle(page);

  // Se selecciona con Mover —con Rectángulo puesto, un clic en el lienzo
  // crearía otra forma— y se vuelve a pulsar la herramienta del elemento
  // seleccionado, que lo edita en vez de deseleccionar (v2.10.0).
  await selectTool(page, 'select');
  await clickCanvas(page, 310, 310);
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await expect(page.locator('#modal-shape')).toBeVisible();
  await page.locator('#shape-modal-color-grid .panel__color-swatch[data-color="#e74c3c"]').click();
  await expect.poll(async () =>
    (await elements(page)).every(el => el.color === '#e74c3c')).toBe(true);
  // La muestra elegida queda resaltada, y sólo ella
  await expect(page.locator('#shape-modal-color-grid .panel__color-swatch--active'))
    .toHaveCount(1);
});

test('la paleta del relleno rellena con ESE color, y no toca el del trazo', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await page.locator('#modal-shape').evaluate(d => d.close());
  await drag(page, 300, 300, 420, 400);
  await settle(page);

  const antes = (await elements(page))[0].color;
  await selectTool(page, 'select');
  await clickCanvas(page, 310, 310);
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await page.locator('#shape-modal-fill-grid .panel__fill-swatch[data-color="#e74c3c"]').click();
  await expect.poll(async () => {
    const el = (await elements(page))[0];
    return `${el.fill}/${el.fillColor}/${el.color}`;
  }).toBe(`true/#e74c3c/${antes}`);

  // El resaltado va por su cuenta: la muestra del trazo con ese mismo color NO
  // se marca, porque el trazo sigue siendo el de antes.
  await expect(page.locator('#shape-modal-fill-grid .panel__fill-swatch--active'))
    .toHaveCount(1);
  await expect(page.locator('#shape-modal-color-grid .panel__color-swatch[data-color="#e74c3c"]'))
    .not.toHaveClass(/panel__color-swatch--active/);
});

test('un clic en una muestra de relleno es UN paso de deshacer', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await page.locator('#modal-shape').evaluate(d => d.close());
  await drag(page, 300, 300, 420, 400);
  await settle(page);
  await selectTool(page, 'select');
  await clickCanvas(page, 310, 310);
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await page.locator('#shape-modal-fill-grid .panel__fill-swatch[data-color="#e74c3c"]').click();
  await expect.poll(async () => (await elements(page))[0].fillColor).toBe('#e74c3c');

  await page.locator('#modal-shape').evaluate(d => d.close());
  await page.locator('#btn-undo').click();
  await expect.poll(async () => {
    const el = (await elements(page))[0];
    return el && el.fillColor === undefined && el.fill !== true;
  }).toBe(true);
});

/* Los grupos de cada modal de ajustes. Es una tabla y no un recuento porque
   lo que importa es QUÉ dice cada bloque: un título equivocado o un grupo que
   se cuela en otro modal no cambia ningún número. */
const GRUPOS = [
  ['prisma', 'modal-prism', ['Proyección', 'Trazo', 'Relleno']],
  ['piramide', 'modal-pyramid', ['Proyección', 'Trazo', 'Relleno']],
  ['tronco', 'modal-frustum', ['Proyección', 'Trazo', 'Relleno']],
  ['esfera', 'modal-sphere', ['Proyección', 'Trazo', 'Relleno']],
  ['pencil', 'modal-stroke', ['Línea', 'Color']],
  // Con el pentágono, que SÍ guarda su giro como ángulo; con el rectángulo
  // el bloque «Orientación» no está, y eso se comprueba justo debajo.
  ['pentagon', 'modal-shape', ['Trazo', 'Relleno', 'Orientación']],
  ['text', 'modal-text', ['Letra', 'Trazo', 'Sombra']],
  ['button', 'modal-ui', ['Contenido', 'Trazo']],
  ['airbrush', 'modal-airbrush', ['Boquilla', 'Pintura', 'Dónde pinta']],
  ['fachada', 'modal-facade', ['Edificio', 'Cubierta', 'Huecos']],
  ['muro', 'modal-wall', ['Muro', 'Verja de coronación', 'Entrada']],
];

test('cada modal de ajustes agrupa sus mandos en bloques con título', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  for (const [tool, modal, titulos] of GRUPOS) {
    await page.locator(`.sidebar__tool[data-tool="${tool}"]`).click();
    await expect(page.locator(`#${modal}`)).toBeVisible();
    // Sin selección, «Posición y tamaño» está oculto: no se cuenta. Y esa es la
    // comprobación de que .modal__group[hidden] existe — .modal__group declara
    // `display`, así que sin su regla el bloque se vería siempre.
    await expect(page.locator(`#${modal} fieldset.modal__group:visible legend`))
      .toHaveText(titulos);
    // El reset del fieldset importa: sin él su `min-width: min-content` no deja
    // encoger la celda del grid y el bloque desborda la columna del modal.
    const ancho = await page.locator(`#${modal}`).evaluate(d => d.clientWidth);
    for (const g of await page.locator(`#${modal} .modal__group:visible`).all()) {
      expect(await g.evaluate(n => n.getBoundingClientRect().width))
        .toBeLessThanOrEqual(ancho);
    }
    await page.locator(`#${modal}`).evaluate(d => d.close());
  }
});

test('«Orientación» solo está con las formas que guardan su giro como ángulo', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  // .modal__group declara `display`, así que el [hidden] del user-agent no
  // basta: sin la regla `.modal__group[hidden]` el rectángulo enseñaría un
  // recuadro con título y nada dentro.
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await expect(page.locator('#shape-modal-rotation-row')).toBeHidden();
  await page.locator('#modal-shape').evaluate(d => d.close());
  await page.locator('.sidebar__tool[data-tool="hexagon"]').click();
  await expect(page.locator('#shape-modal-rotation-row')).toBeVisible();
});

test('los modales 3D agrupan sus mandos en Proyección, Trazo y Relleno', async ({ page }) => {
  await openApp(page, { viewport: WIDE });
  for (const [tool, modal] of [['prisma', 'modal-prism'], ['piramide', 'modal-pyramid'],
    ['tronco', 'modal-frustum'], ['esfera', 'modal-sphere']]) {
    await page.locator(`.sidebar__tool[data-tool="${tool}"]`).click();
    await expect(page.locator(`#${modal}`)).toBeVisible();
    // <fieldset> de verdad, con su <legend>: la agrupación tiene que llegar
    // también a un lector de pantalla, no ser solo tres recuadros.
    await expect(page.locator(`#${modal} fieldset.modal__group legend`))
      .toHaveText(['Proyección', 'Trazo', 'Relleno']);
    // El reset del fieldset importa: sin él su `min-width: min-content` no deja
    // encoger la celda y el bloque desborda la columna del modal.
    const ancho = await page.locator(`#${modal}`).evaluate(d => d.clientWidth);
    for (const g of await page.locator(`#${modal} .modal__group`).all()) {
      expect(await g.evaluate(n => n.getBoundingClientRect().width))
        .toBeLessThanOrEqual(ancho);
    }
    // Y el selector de color vive dentro de su paleta, no suelto en otra columna
    await expect(page.locator(`#${modal} .modal__palette input[type="color"]`))
      .toHaveCount(2);
    await page.locator(`#${modal}`).evaluate(d => d.close());
  }
});
