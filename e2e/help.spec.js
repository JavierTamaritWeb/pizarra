'use strict';
/* ============================================================
   help.spec.js — La Ayuda: buscador, índice y legibilidad (v3.3.0).

   Va en e2e porque nada de esto lo ve el arnés `node:vm`: allí el
   `textContent` de una línea con <kbd>/<strong> llega vacío (dom-stub no
   acumula el texto de los hijos), así que el emparejamiento del buscador solo
   se puede comprobar con texto de verdad. Y lo demás es CSS puro: que la
   prosa NO salga en mayúsculas y que el buscador se quede pegado arriba
   mientras el diálogo hace scroll.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { WIDE, openApp, settle } = require('./helpers');

test.use({ viewport: WIDE });

async function abrirAyuda(page) {
  await openApp(page);
  await page.locator('#btn-help').click();
  await settle(page);
  await expect(page.locator('#modal-help')).toHaveJSProperty('open', true);
}

/** Líneas de ayuda visibles de verdad (no las que el filtro ha ocultado). */
async function visibles(page) {
  return page.locator('#modal-help .modal__help-list li:not([hidden])').count();
}

test('el buscador encuentra sin acentos y esconde lo que no casa', async ({ page }) => {
  await abrirAyuda(page);
  const todas = await visibles(page);
  expect(todas).toBeGreaterThan(60);

  // Sin acentos y en minúsculas: la interfaz va en MAYÚSCULAS por CSS, pero el
  // DOM conserva «Botón», así que «boton» tiene que encontrarlo.
  await page.locator('#help-search').fill('boton');
  await settle(page);
  const conFiltro = await visibles(page);
  expect(conFiltro).toBeGreaterThan(0);
  expect(conFiltro).toBeLessThan(todas);
  await expect(page.locator('#help-count')).toContainText(/resultados?/);
  // Cada línea que queda menciona lo buscado (con o sin tilde).
  const textos = await page.locator('#modal-help .modal__help-list li:not([hidden])').allTextContents();
  for (const t of textos) {
    expect(t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')).toContain('boton');
  }

  // Buscar por el TÍTULO de una sección la trae entera: quien escribe «jardín»
  // quiere esa sección, no solo las líneas que repiten la palabra.
  await page.locator('#help-search').fill('jardin');
  await settle(page);
  // Por su TÍTULO, no por cualquier grupo que mencione la palabra: «Jardín»
  // sale también en una línea de Edificios, y ese grupo sí se filtra línea a
  // línea (fue lo que cazó esta guarda al escribirla mal).
  const jardin = page.locator('#modal-help .modal__help-group')
    .filter({ has: page.locator('.modal__help-title', { hasText: 'Jardín' }) }).first();
  await expect(jardin).toBeVisible();
  expect(await jardin.locator('li:not([hidden])').count())
    .toBe(await jardin.locator('li').count());

  // Algo que no está: aviso, no una ayuda vacía y muda.
  await page.locator('#help-search').fill('zzzz');
  await settle(page);
  expect(await visibles(page)).toBe(0);
  await expect(page.locator('#help-empty')).toBeVisible();

  // Vaciar lo devuelve todo.
  await page.locator('#help-search').fill('');
  await settle(page);
  expect(await visibles(page)).toBe(todas);
  await expect(page.locator('#help-empty')).toBeHidden();
});

test('el índice salta a su sección y el buscador se queda a la vista al bajar', async ({ page }) => {
  await abrirAyuda(page);

  const chips = page.locator('#help-index .modal__help-chip');
  expect(await chips.count()).toBeGreaterThan(10);

  // Saltar a una sección del final la trae a la vista.
  const chip = chips.filter({ hasText: 'Jardín' }).first();
  await chip.click();
  await settle(page);
  const jardin = page.locator('#modal-help .modal__help-group')
    .filter({ has: page.locator('.modal__help-title', { hasText: 'Jardín' }) }).first();
  await expect(jardin).toBeInViewport();

  // Y el buscador sigue arriba del diálogo tras el desplazamiento: si se fuera
  // con el scroll habría que volver al principio para cambiar la búsqueda.
  const caja = await page.locator('#help-search').boundingBox();
  const dialogo = await page.locator('#modal-help').boundingBox();
  expect(caja.y).toBeLessThan(dialogo.y + 120);
  expect(caja.y).toBeGreaterThanOrEqual(dialogo.y - 1);
});

test('la prosa de la Ayuda no va en mayúsculas, pero sus títulos sí', async ({ page }) => {
  await abrirAyuda(page);
  const tt = sel => page.locator(sel).first().evaluate(n => getComputedStyle(n).textTransform);

  // Veinte secciones de frases enteras en caja alta se leen letra a letra.
  expect(await tt('#modal-help .modal__help-list')).toBe('none');
  expect(await tt('#help-search')).toBe('none');
  expect(await tt('#help-index .modal__help-chip')).toBe('none');
  // Los títulos SÍ: ahí son rótulos, y es lo que ancla la ayuda a la interfaz.
  expect(await tt('#modal-help .modal__help-title')).toBe('uppercase');
  // Y el resto de la interfaz sigue igual (la regla de la v2.29.0 no se toca).
  expect(await tt('.sidebar__tool-name')).toBe('uppercase');
});

test('cerrar la Ayuda limpia la búsqueda', async ({ page }) => {
  await abrirAyuda(page);
  await page.locator('#help-search').fill('curva');
  await settle(page);
  const filtradas = await visibles(page);

  await page.locator('#modal-help .modal__cancel').click();
  await settle(page);
  await page.locator('#btn-help').click();
  await settle(page);

  await expect(page.locator('#help-search')).toHaveValue('');
  expect(await visibles(page)).toBeGreaterThan(filtradas);
});
