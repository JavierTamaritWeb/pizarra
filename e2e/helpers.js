'use strict';
/* ============================================================
   helpers.js — Utilidades compartidas por los specs de Playwright.

   Mismo principio de observabilidad que el arnés `node:vm`: **no hay hooks de
   test en producción**. La escena se lee del autosave, que es la
   serialización real de `state.elements` en localStorage.

   La diferencia está en la entrada: aquí los gestos son eventos de puntero
   de verdad, así que hay que traducir coordenadas de lienzo a coordenadas de
   viewport — el lienzo va escalado con `transform: scale()` y puede estar
   desplazado por el scroll. De eso se encarga `canvasPoint`.
   ============================================================ */

const { expect } = require('@playwright/test');

/** Ventanas de referencia. El zoom se auto-ajusta al espacio disponible, así
    que el tamaño de la ventana decide el zoom inicial: con WIDE sobra sitio
    (>100%) y con NARROW no (100%). Medidos contra el layout real. */
const WIDE = { width: 1920, height: 1200 };     // auto-ajuste = 120%
// Por encima de 1100px a propósito: por debajo el panel es un cajón oculto y
// sus botones (p. ej. «Limpiar todo») no se pueden pulsar sin abrirlo antes.
const NARROW = { width: 1160, height: 700 };    // auto-ajuste = 100%

/** Abre la app y espera a que el sidebar esté construido (init() terminado). */
async function openApp(page, { viewport } = {}) {
  if (viewport) await page.setViewportSize(viewport);
  await page.goto('/index.html');
  await expect(page.locator('.sidebar__tool').first()).toBeVisible();
  // Las tipografías externas cambian el layout al llegar: esperarlas evita que
  // una caja medida antes de tiempo mande un clic a otro sitio.
  await page.evaluate(() => document.fonts.ready);
  return page;
}

/**
 * Espera a que la app termine de reaccionar al último gesto.
 *
 * `redraw()` está coalescido con requestAnimationFrame, así que justo después
 * de soltar el ratón el DOM (contador «Elementos», botones de selección) sigue
 * mostrando el estado anterior. Dos frames bastan y no cuestan nada; dormir un
 * número fijo de milisegundos sería más lento y menos fiable.
 */
const settle = page => page.evaluate(() => new Promise(res => {
  requestAnimationFrame(() => requestAnimationFrame(() => res(null)));
}));

/** Zoom actual, leído del panel (no del estado interno). */
const zoomPct = page => page.locator('#zoom-val').innerText().then(Number);

/** Lectura cruda del autosave (puede ir por detrás de la escena en pantalla). */
const readAutosave = page => page.evaluate(() => {
  const raw = localStorage.getItem('sketchwire.autosave');
  if (!raw) return [];
  const saved = JSON.parse(raw);
  return Array.isArray(saved) ? saved : (saved.elements || []);
});

/**
 * Escena actual, tal como la app la serializa en localStorage.
 *
 * El autosave tiene 500 ms de rebote (`scheduleAutosave`), así que leerlo justo
 * después de un gesto devuelve la escena ANTERIOR. En vez de dormir un rato
 * fijo, se espera a que cuadre con el contador «Elementos» del panel, que sí se
 * actualiza en el redraw: así el test es determinista y de paso comprueba que
 * el contador y lo guardado no divergen.
 *
 * Ojo: esto solo funciona porque los gestos llaman antes a `settle()`. Sin eso
 * el contador todavía marcaría el valor viejo, coincidiría con el autosave
 * viejo y la espera terminaría al instante devolviendo la escena anterior.
 */
async function elements(page) {
  let stored = [];
  await expect
    .poll(async () => {
      const shown = Number(await page.locator('#el-count').innerText());
      stored = await readAutosave(page);
      return stored.length === shown;
    }, {
      timeout: 4000,
      message: 'el contador del panel y el autosave no llegaron a coincidir',
    })
    .toBe(true);
  return stored;
}

/**
 * Traduce un punto en coordenadas de lienzo (0..1200 × 0..800) al punto de
 * viewport donde hay que pinchar. Usa la caja renderizada del propio canvas,
 * así que absorbe a la vez el zoom y el scroll: si esto se desalinea, es que
 * la app tiene un bug de coordenadas, que es justo lo que se quiere detectar.
 */
async function canvasPoint(page, x, y) {
  const box = await page.locator('#main-canvas').boundingBox();
  const scale = box.width / 1200;
  return { x: box.x + x * scale, y: box.y + y * scale };
}

/** Elige una herramienta del sidebar por su id de TOOLS. */
async function selectTool(page, toolId) {
  await page.locator(`.sidebar__tool[data-tool="${toolId}"]`).click();
  await settle(page);
}

/** Herramienta activa según el sidebar. */
const activeTool = page =>
  page.locator('.sidebar__tool--active').getAttribute('data-tool');

/** Arrastre completo en coordenadas de lienzo. */
async function drag(page, x1, y1, x2, y2) {
  const from = await canvasPoint(page, x1, y1);
  const to = await canvasPoint(page, x2, y2);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
  await settle(page);
}

/** Clic simple en coordenadas de lienzo. */
async function clickCanvas(page, x, y, opts = {}) {
  const p = await canvasPoint(page, x, y);
  await page.mouse.click(p.x, p.y, opts);
  await settle(page);
}

/** Mueve un slider del panel y confirma el gesto ('input' = arrastrando,
    'change' = soltar, que es cuando el panel suelta el foco). */
async function setSlider(page, id, value, { release = false } = {}) {
  const slider = page.locator(`#${id}`);
  await slider.fill(String(value));
  await slider.dispatchEvent('input');
  if (release) await slider.dispatchEvent('change');
  await settle(page);
}

/**
 * Fija el zoom y espera a que el lienzo TERMINE de crecer.
 *
 * `.canvas-area__sizer` y el wrapper llevan una transición de 0.2s, así que
 * justo después de mover el slider la caja pintada está a medio camino. Medir
 * ahí manda los clics a coordenadas equivocadas y deja el área scrollable a
 * mitad de tamaño: los dos falsos negativos que costó descubrir montando esto.
 */
async function setZoom(page, pct) {
  await setSlider(page, 'zoom-slider', pct);
  await expect
    .poll(() => page.locator('#main-canvas').boundingBox().then(b => Math.round(b.width)), {
      message: `el lienzo no llegó a escalarse al ${pct}%`,
    })
    .toBe(Math.round(1200 * pct / 100));
}

/**
 * Píxeles de tinta del lienzo: prueba que algo se ha dibujado de verdad, no
 * solo que el estado lo diga.
 *
 * Cuenta píxeles OSCUROS, no opacos: el lienzo se pinta con un fondo blanco
 * sólido, así que "alfa > 0" da 1200×800 siempre, tenga o no dibujo. La
 * cuadrícula (#cdd3de) es clara y queda fuera del umbral; el trazo por defecto
 * (#1a1a2e) queda muy dentro.
 */
function paintedPixels(page) {
  return page.evaluate(() => {
    const c = document.getElementById('main-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (d[i + 3] > 0 && lum < 128) n++;
    }
    return n;
  });
}

module.exports = {
  WIDE, NARROW, openApp, settle, zoomPct, elements, readAutosave, canvasPoint,
  selectTool, activeTool, drag, clickCanvas, setSlider, setZoom, paintedPixels,
};
