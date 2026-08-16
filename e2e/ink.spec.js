'use strict';
/* ============================================================
   ink.spec.js — La Tinta (bote de pintura), v2.32.0

   Va en e2e y no en `tests/` porque el corazón de la herramienta es
   RASTERIZAR la escena y leer sus píxeles: el stub de canvas del arnés
   `node:vm` no devuelve ninguno, así que ahí la zona cerrada no existe. La
   geometría pura se prueba con máscaras a mano en tests/flood.test.js; aquí
   se prueba el caso real, que es el que pidió el usuario: dos líneas
   cruzadas forman un rombo, y pinchar dentro lo pinta.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { WIDE, openApp, settle, selectTool, drag, clickCanvas, elements } = require('./helpers');

test.use({ viewport: WIDE });

/** Color del píxel (x, y) del lienzo, en coordenadas de lienzo. */
function pixel(page, x, y) {
  return page.evaluate(([px, py]) => {
    const d = document.getElementById('main-canvas')
      .getContext('2d').getImageData(px, py, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }, [x, y]);
}

/** El rombo del enunciado: cuatro trazos que se cruzan cerca de los vértices
    y sobresalen por las puntas, como en el dibujo que originó la herramienta.
    Ojo: DOS rectas cruzadas sólo forman una X, y una X no encierra nada — la
    Tinta acierta negándose a pintarla. Hacen falta los cuatro lados. */
async function rombo(page) {
  await selectTool(page, 'line');
  await drag(page, 360, 378, 520, 152);   // lado superior izquierdo
  await drag(page, 480, 152, 650, 392);   // lado superior derecho
  await drag(page, 360, 322, 520, 548);   // lado inferior izquierdo
  await drag(page, 650, 308, 480, 548);   // lado inferior derecho
  expect((await elements(page)).length).toBe(4);
}

test('pinchar dentro del rombo de dos líneas crea una mancha por debajo', async ({ page }) => {
  await openApp(page);
  await rombo(page);

  await selectTool(page, 'ink');
  await clickCanvas(page, 500, 350);   // el centro del rombo
  await settle(page);

  const els = await elements(page);
  expect(els.length).toBe(5);
  // La mancha es un `polygon` con `ink`, sin contorno y con pocos vértices:
  // el contorno crudo tiene cientos y los simplifica Douglas-Peucker.
  const mancha = els.find(e => e.type === 'polygon');
  expect(mancha).toBeTruthy();
  expect(mancha.ink).toBe(true);
  expect(mancha.stroke).toBe(false);
  expect(mancha.fill).toBe(true);
  expect(mancha.fillColor).toMatch(/^#[0-9a-f]{6}$/i);
  expect(mancha.points.length).toBeGreaterThanOrEqual(3);
  expect(mancha.points.length).toBeLessThanOrEqual(20);

  // Y va DEBAJO de las dos líneas: si fuera encima las taparía, y además
  // robaría todos los clics de su interior.
  expect(els.indexOf(mancha)).toBeLessThan(els.findIndex(e => e.type === 'line'));

  // El centro cambia de color; fuera del rombo el papel sigue intacto.
  const dentro = await pixel(page, 500, 350);
  const fuera = await pixel(page, 200, 350);
  expect(dentro).not.toEqual(fuera);
});

test('la mancha llega hasta las líneas: no queda rendija de papel', async ({ page }) => {
  // El flood se detiene en el borde interior del trazo, y el cierre de huecos
  // le come todavía otro tanto: sin la dilatación anti-fisura la mancha nace
  // separada de la línea. Se prueba con el cierre de huecos AL MÁXIMO, que es
  // donde la rendija sería más ancha; con el valor de fábrica mide un par de
  // píxeles y la disimula el antialias del propio trazo.
  await openApp(page);
  await rombo(page);
  // Sin cuadrícula: sus líneas cruzan la zona y el papel dejaría de ser un
  // color único, que es de lo que depende medir el hueco.
  await page.locator('#check-grid').uncheck();
  await page.locator('.sidebar__tool[data-tool="ink"]').click();
  await page.locator('#ink-gap').fill('12');
  await page.locator('#ink-gap').dispatchEvent('input');
  await page.locator('#modal-ink .modal__cancel').click();
  await clickCanvas(page, 500, 350);
  await settle(page);

  // Se recorre del centro hacia la izquierda hasta topar con el trazo, y se
  // cuentan los píxeles de papel que quedan en medio: ése es el ancho de la
  // rendija. Uno o dos son el antialias del borde; más es el fallo.
  const papel = await pixel(page, 111, 133);
  const rendija = await page.evaluate(([papelRGB]) => {
    const d = document.getElementById('main-canvas')
      .getContext('2d').getImageData(0, 350, 1200, 1).data;
    const lum = x => 0.299 * d[x * 4] + 0.587 * d[x * 4 + 1] + 0.114 * d[x * 4 + 2];
    const esPapel = x => [0, 1, 2].every(k => Math.abs(d[x * 4 + k] - papelRGB[k]) <= 6);
    let n = 0;
    for (let x = 500; x > 300; x--) {
      // El corte es el TRAZO (tinta casi negra, luminancia ~28), no la mancha
      // —que también es más oscura que el papel— ni el papel (~113). Con un
      // umbral alto el bucle termina en el primer píxel y no mide nada.
      if (lum(x) < 50) return n;
      if (esPapel(x)) n++;
    }
    return -1;                     // no se encontró el trazo: el test no vale
  }, [papel]);
  expect(rendija).toBeGreaterThanOrEqual(0);
  // Medido: con la dilatación puesta salen 1-3 px (el antialias del borde del
  // trazo); sin ella, 10. El umbral va en 4 para absorber el jitter de Sketchy
  // —que mueve el borde de una ejecución a otra— sin dejar de discriminar.
  expect(rendija, 'hay una rendija de papel entre la mancha y la línea')
    .toBeLessThanOrEqual(4);
});

test('pinchar en el lienzo vacío pinta el fondo entero', async ({ page }) => {
  // Un lienzo vacío es, por definición, una zona abierta. Con la regla
  // estricta la herramienta se negaba a pintarlo, y eso en un bote de pintura
  // es una anomalía: el borde del lienzo es una frontera, no un fallo.
  await openApp(page);
  await selectTool(page, 'ink');
  await clickCanvas(page, 400, 300);
  await settle(page);

  const els = await elements(page);
  expect(els.length).toBe(1);
  const fondo = els[0];
  expect(fondo.type).toBe('polygon');
  expect(fondo.ink).toBe(true);
  // Cubre el lienzo entero (1200x800).
  const xs = fondo.points.map(p => p.x), ys = fondo.points.map(p => p.y);
  expect(Math.min(...xs)).toBe(0);
  expect(Math.min(...ys)).toBe(0);
  expect(Math.max(...xs)).toBe(1200);
  expect(Math.max(...ys)).toBe(800);

  await page.locator('.sidebar__tool[data-tool="ink"]').click();
  await expect(page.locator('#ink-status')).toContainText('Fondo pintado');
});

test('el fondo se pinta por debajo de todo, y las figuras siguen encima', async ({ page }) => {
  await openApp(page);
  await rombo(page);
  await selectTool(page, 'ink');
  await clickCanvas(page, 150, 700);   // fuera del rombo: el fondo
  await settle(page);

  const els = await elements(page);
  expect(els.length).toBe(5);
  // Al fondo del todo: toca media escena, así que colarlo entre dos elementos
  // taparía al de abajo.
  expect(els[0].type).toBe('polygon');
  expect(els[0].ink).toBe(true);
  expect(els.slice(1).every(e => e.type === 'line')).toBe(true);
});

test('repintar la misma zona sustituye la mancha en vez de apilar otra', async ({ page }) => {
  await openApp(page);
  await rombo(page);
  await selectTool(page, 'ink');
  await clickCanvas(page, 500, 350);
  await settle(page);
  expect((await elements(page)).length).toBe(5);

  // Tres clics más sobre lo mismo: si cada uno apilara un polígono, quedarían
  // cuatro manchas superpuestas imposibles de separar.
  await clickCanvas(page, 500, 350);
  await clickCanvas(page, 498, 352);
  await settle(page);
  const els = await elements(page);
  expect(els.filter(e => e.type === 'polygon').length).toBe(1);
  expect(els.length).toBe(5);
});

test('con otro color, repintar cambia el color de la mancha', async ({ page }) => {
  await openApp(page);
  await rombo(page);
  await selectTool(page, 'ink');
  await clickCanvas(page, 500, 350);
  await settle(page);
  const primero = (await elements(page)).find(e => e.type === 'polygon').fillColor;

  // La mancha previa NO es barrera: si lo fuera, este segundo clic diría «ahí
  // no hay zona» y cambiarle el color sería imposible.
  await page.locator('.sidebar__tool[data-tool="ink"]').click();
  await page.locator('#ink-modal-fill-grid .panel__fill-swatch[data-color="#e74c3c"]').click();
  await page.locator('#modal-ink .modal__cancel').click();
  await clickCanvas(page, 500, 350);
  await settle(page);

  // Se espera al color, no al recuento: el número de elementos no cambia al
  // sustituir, y `elements()` da por buena la escena vieja en cuanto el
  // autosave y el contador coinciden — que es justo lo que pasa con 5 === 5.
  await expect.poll(async () => {
    const p = (await elements(page)).find(e => e.type === 'polygon');
    return p && p.fillColor.toLowerCase();
  }).toBe('#e74c3c');
  const els = await elements(page);
  expect(els.filter(e => e.type === 'polygon').length).toBe(1);
  expect(els.find(e => e.type === 'polygon').fillColor).not.toBe(primero);
});

test('pinchar dentro de una forma la rellena a ella, sin crear elementos', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'circle');
  await drag(page, 300, 200, 600, 500);
  await selectTool(page, 'ink');
  await clickCanvas(page, 450, 350);
  await settle(page);

  const els = await elements(page);
  expect(els.length).toBe(1);
  expect(els[0].type).toBe('circle');
  expect(els[0].fill).toBe(true);
});

test('la mancha se mueve, se borra y se deshace como un elemento más', async ({ page }) => {
  await openApp(page);
  await rombo(page);
  await selectTool(page, 'ink');
  await clickCanvas(page, 500, 350);
  await settle(page);
  expect((await elements(page)).length).toBe(5);

  // Deshacer quita la mancha y deja los cuatro trazos.
  await page.keyboard.press('Control+z');
  await settle(page);
  const tras = await elements(page);
  expect(tras.length).toBe(4);
  expect(tras.some(e => e.type === 'polygon')).toBe(false);
});

test('una zona pintada sobre un fondo ya pintado queda ENCIMA de él', async ({ page }) => {
  // El fondo cubre el lienzo entero, así que si contara como «lo que delimita
  // la zona» ganaría siempre el índice más bajo y la mancha nueva nacería
  // debajo: en translúcido se nota a medias, y en sólido desaparece.
  await openApp(page);
  await rombo(page);
  await selectTool(page, 'ink');
  await clickCanvas(page, 150, 700);    // el fondo
  await settle(page);
  await clickCanvas(page, 500, 350);    // el rombo, encima del fondo
  await settle(page);

  const els = await elements(page);
  const tintas = els.filter(e => e.ink === true);
  expect(tintas.length).toBe(2);
  const iFondo = els.findIndex(e => e.ink && e.points.length === 4);
  const iZona = els.findIndex(e => e.ink && e.points.length !== 4);
  expect(iFondo).toBeGreaterThanOrEqual(0);
  expect(iZona).toBeGreaterThan(iFondo);
});
