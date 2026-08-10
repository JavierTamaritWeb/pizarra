'use strict';
/* Teclado y foco: el terreno donde el arnés node:vm no llega, porque no
   simula las acciones por defecto del navegador ni mueve el foco de verdad.
   Los tres casos de aquí son bugs reales que solo aparecieron al abrir la app
   en un navegador (ver BUGS.md). */

const { test, expect } = require('@playwright/test');
const {
  openApp, elements, selectTool, activeTool, drag, setSlider, settle, canvasPoint,
} = require('./helpers.js');

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
  // «Mostrar cuadrícula» y no «Rellenar formas»: desde que el panel enseña solo
  // las secciones de la herramienta activa, «Relleno» está oculto con el lápiz
  // (arranca activo) y no se puede pulsar. Este de «Lienzo» está siempre.
  const check = page.locator('#check-grid');
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

/* ── Auditoría v1.17.0: foco, modales y overlay — solo visibles aquí ── */

// El blur que "revive" los atajos tras usar un control del panel solo cubría
// los <input>: cambiar «Solapamiento» o «Plantas» con el ratón dejaba el
// <select> enfocado y TODOS los atajos muertos hasta clicar en otro sitio.
test('tras cambiar un <select> del panel, los atajos siguen vivos', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'rect');
  await drag(page, 150, 150, 350, 300);
  expect(await elements(page)).toHaveLength(1);

  // Como el usuario real: el select queda ENFOCADO al elegir (selectOption a
  // secas no mueve el foco y el test pasaría incluso sin el arreglo).
  const select = page.locator('#overlap-mode');
  await select.focus();
  await select.selectOption('hidden-dashed');

  // Sin tocar el lienzo:
  await page.keyboard.press('Control+z');
  await settle(page);
  expect(await elements(page), 'el select debe soltar el foco al cambiar').toHaveLength(0);
});

// El listener global de paste no miraba dialog[open]: Ctrl+V con un payload
// propio pegaba clones DETRÁS del modal y cambiaba la herramienta a Mover.
test('pegar funciona en el lienzo pero no detrás de un modal abierto', async ({ page }) => {
  await openApp(page);
  const paste = () => page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', JSON.stringify({
      app: 'sketchwire/elements',
      elements: [{ type: 'rect', x: 10, y: 10, w: 50, h: 50, color: '#1a1a2e', lineWidth: 2, seed: 1 }],
    }));
    document.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: dt, bubbles: true, cancelable: true,
    }));
  });

  // Control positivo: sin modal, el mismo payload sí se pega (si esto falla,
  // el resto del test no probaría nada).
  await paste();
  await settle(page);
  expect(await elements(page)).toHaveLength(1);

  await page.locator('#btn-help').click();
  await expect(page.locator('#modal-help')).toHaveAttribute('open', '');
  const toolBefore = await activeTool(page);
  await paste();
  await settle(page);
  expect(await elements(page), 'con un modal abierto no se pega nada').toHaveLength(1);
  expect(await activeTool(page), 'ni cambia la herramienta').toBe(toolBefore);
  await expect(page.locator('#modal-help')).toHaveAttribute('open', '');
});

// '?' corre antes del guard de dialog[open] para poder CERRAR la Ayuda, pero
// también la abría apilada encima de cualquier otro modal.
test('«?» no apila la Ayuda sobre otro modal, y su toggle sigue vivo', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('1');
  await expect(page.locator('#modal-facade')).toHaveAttribute('open', '');

  await page.keyboard.press('?');
  await settle(page);
  await expect(page.locator('#modal-help')).not.toHaveAttribute('open', '');
  await expect(page.locator('#modal-facade')).toHaveAttribute('open', '');

  await page.keyboard.press('Escape');
  await expect(page.locator('#modal-facade')).not.toHaveAttribute('open', '');
  await page.keyboard.press('?');
  await expect(page.locator('#modal-help')).toHaveAttribute('open', '');
  await page.keyboard.press('?');
  await expect(page.locator('#modal-help')).not.toHaveAttribute('open', '');
});

// selectTool no repintaba el overlay: cambiar de herramienta por teclado sin
// mover el ratón dejaba el círculo del borrador pintado hasta el gesto
// siguiente (pointerleave solo limpia si la herramienta sigue siendo Borrador).
test('el círculo del borrador no queda fantasma al cambiar de herramienta', async ({ page }) => {
  await openApp(page);
  // Elegir Borrador abre su modal de tamaño (como Planta abre su catálogo) y el
  // lienzo queda inerte mientras el <dialog> está abierto: el helper lo cierra,
  // que es lo que hace cualquiera antes de ponerse a borrar.
  await selectTool(page, 'eraser');
  const p = await canvasPoint(page, 400, 300);
  await page.mouse.move(p.x, p.y);
  await settle(page);

  const inked = () => page.evaluate(() => {
    const c = document.getElementById('overlay-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  expect(await inked(), 'premisa: el indicador se pinta al pasar el cursor').toBeGreaterThan(0);

  await page.keyboard.press('v');    // a Mover, sin mover el ratón
  await settle(page);
  expect(await inked(), 'el overlay debe quedar limpio').toBe(0);
});

// BUGS.md › "role=toolbar sin el patrón de teclado que promete": cada botón
// era una parada de Tab (~45 tabulaciones para cruzar la barra). Con roving
// tabindex la barra es UNA parada y las flechas mueven el foco por dentro.
test('la barra de herramientas es una sola parada de Tab y se recorre con flechas', async ({ page }) => {
  await openApp(page);
  const tools = page.locator('.sidebar__tool');

  // Un solo tabstop: exactamente un botón con tabindex=0
  await expect(tools.locator('nth=0')).toHaveAttribute('tabindex', '0');
  expect(await page.locator('.sidebar__tool[tabindex="0"]').count()).toBe(1);

  // Las flechas mueven el foco (y el tabstop viaja con él)
  await tools.first().focus();
  await page.keyboard.press('ArrowDown');
  const second = await page.evaluate(() =>
    document.activeElement.classList.contains('sidebar__tool') &&
    document.activeElement.tabIndex === 0 &&
    document.activeElement !== document.querySelectorAll('.sidebar__tool')[0]);
  expect(second, 'ArrowDown enfoca la siguiente herramienta').toBe(true);

  await page.keyboard.press('End');
  const last = await page.evaluate(() => {
    const all = document.querySelectorAll('.sidebar__tool');
    return document.activeElement === all[all.length - 1];
  });
  expect(last, 'End salta a la última herramienta').toBe(true);

  // Tab desde la barra sale de ella (no recorre las ~45 herramientas)
  await page.keyboard.press('Tab');
  const outside = await page.evaluate(() =>
    !document.activeElement.classList.contains('sidebar__tool'));
  expect(outside, 'Tab abandona la barra en un solo paso').toBe(true);
});
