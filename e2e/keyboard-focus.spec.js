'use strict';
/* Teclado y foco: el terreno donde el arnés node:vm no llega, porque no
   simula las acciones por defecto del navegador ni mueve el foco de verdad.
   Los tres casos de aquí son bugs reales que solo aparecieron al abrir la app
   en un navegador (ver BUGS.md). */

const { test, expect } = require('@playwright/test');
const { openApp, elements, selectTool, activeTool, drag, setSlider, settle } = require('./helpers.js');

// BUGS.md › "Tras usar un control del panel, los atajos y Ctrl+Z/C/V dejaban de
// funcionar": el foco se quedaba en el control y el handler global hace return
// cuando el target es un <input>.
test('tras usar un control del panel, Ctrl+Z sigue deshaciendo', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'rect');
  await drag(page, 150, 150, 350, 300);
  expect(await elements(page)).toHaveLength(1);

  await setSlider(page, 'stroke-slider', 8, { release: true });

  // Sin tocar el lienzo:
  await page.keyboard.press('Control+z');
  await settle(page);
  expect(await elements(page), 'el panel debe soltar el foco al terminar').toHaveLength(0);
});

test('tras marcar un checkbox del panel, las teclas de herramienta responden', async ({ page }) => {
  await openApp(page);
  const check = page.locator('#check-fill');
  await check.click();

  await page.keyboard.press('r');
  await settle(page);
  expect(await activeTool(page)).toBe('rect');
});

// BUGS.md › "Los atajos de teclado seguían activos con un modal abierto".
test('con un modal abierto, los atajos no actúan sobre el lienzo de detrás', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'rect');
  await drag(page, 150, 150, 350, 300);
  await selectTool(page, 'select');
  await page.locator('#main-canvas').click({ position: { x: 200, y: 200 } });

  await page.locator('#btn-help').click();
  await expect(page.locator('#modal-help')).toHaveAttribute('open', '');

  const toolBefore = await activeTool(page);
  await page.keyboard.press('Delete');
  await page.keyboard.press('c');
  await settle(page);
  expect(await elements(page), 'Supr no debe borrar con el modal abierto').toHaveLength(1);
  expect(await activeTool(page), 'ni cambiar la herramienta').toBe(toolBefore);

  await page.keyboard.press('Escape');
  await expect(page.locator('#modal-help')).not.toHaveAttribute('open', '');
});

// BUGS.md › v1.14.1: pulsar "1" abría Fachada y la tecla seguía viva; la
// recibía el control que <dialog>.showModal() enfoca y el <select> de Plantas
// la interpretaba como su type-ahead. Solo se ve con acciones por defecto
// reales, que es exactamente lo que el arnés node:vm no simula.
test('el atajo que abre un catálogo no se filtra al modal', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('1');

  await expect(page.locator('#modal-facade')).toHaveAttribute('open', '');
  await expect(page.locator('#facade-floors')).toHaveValue('auto');
  await expect(page.locator('#build-floors')).toHaveValue('auto');
});

test('el modal de Fachada enfoca la vista activa, no un <select>', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('1');

  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el.tagName, cls: el.className, active: el.classList.contains('modal__shape--active') };
  });
  expect(focused.tag).toBe('BUTTON');
  expect(focused.active, 'el foco va a la vista activa: Enter la confirma').toBe(true);
});

test('Escape cancela el catálogo y devuelve la herramienta anterior', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'rect');
  await selectTool(page, 'planta');
  await expect(page.locator('#modal-planta')).toHaveAttribute('open', '');

  await page.keyboard.press('Escape');
  await expect(page.locator('#modal-planta')).not.toHaveAttribute('open', '');
  // El evento 'close' del <dialog> se despacha DESPUÉS de que desaparezca el
  // atributo `open`, así que la restauración de la herramienta llega un tick
  // más tarde: hay que esperarla, no leerla una vez.
  await expect.poll(() => activeTool(page)).toBe('rect');
});
