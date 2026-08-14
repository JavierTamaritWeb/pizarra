'use strict';
/* Aerógrafo (v2.22.0) en un navegador de verdad.

   Lo que solo se puede comprobar aquí y no en el arnés `node:vm`:

   · Un <dialog showModal> deja INERTE todo lo que hay detrás, lienzo incluido.
     El arnés no sabe qué es eso —allí `showModal()` solo pone `open = true`—,
     así que la promesa «armar el área cierra el modal y te deja dibujar» solo
     se puede probar en un navegador. Es exactamente el fallo de la v2.16.2.
   · Que la pintura CAIGA donde tiene que caer: el canvas del arnés anota
     llamadas, no pinta píxeles. Aquí se cuentan.
*/

const { test, expect } = require('@playwright/test');
const {
  WIDE, openApp, settle, elements, selectTool, drag, canvasPoint, setZoom,
} = require('./helpers.js');

test.use({ viewport: WIDE });

/** Píxeles con tinta dentro de un rectángulo del LIENZO (coordenadas de la
    app, no del viewport): la misma medida que `paintedPixels` pero acotada,
    para poder comparar dentro y fuera del área. */
function inkIn(page, box) {
  return page.evaluate(({ x, y, w, h }) => {
    const c = document.getElementById('main-canvas');
    const bg = document.getElementById('canvas-bg-picker').value;
    const [br, bgr, bb] = [1, 3, 5].map(i => parseInt(bg.slice(i, i + 2), 16));
    const limite = (0.299 * br + 0.587 * bgr + 0.114 * bb) * 0.6;
    const d = c.getContext('2d').getImageData(x, y, w, h).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (d[i + 3] > 0 && lum < limite) n++;
    }
    return n;
  }, box);
}

test('elegir el Aerógrafo abre sus ajustes y cerrarlos deja la herramienta puesta', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await openApp(page);

  await page.locator('.sidebar__tool[data-tool="airbrush"]').click();
  await settle(page);
  await expect(page.locator('#modal-airbrush')).toBeVisible();
  // La muestra se pinta con el Renderer real: si el <canvas> se quedara en
  // blanco, el modal estaría prometiendo algo que no enseña.
  await expect(page.locator('#airbrush-preview')).toBeVisible();

  await page.locator('#modal-airbrush .modal__cancel').click();
  await settle(page);
  await expect(page.locator('#modal-airbrush')).not.toBeVisible();
  await expect(page.locator('.sidebar__tool--active')).toHaveAttribute('data-tool', 'airbrush');
  expect(errors).toEqual([]);
});

test('el Aerógrafo pinta píxeles de verdad y su mancha es más ancha que su eje', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'airbrush');
  await drag(page, 300, 400, 700, 400);
  expect(await elements(page)).toHaveLength(1);

  // Tres franjas de 10 px, a distancias crecientes del eje (y = 400). La
  // boquilla por defecto es de radio 24, así que la primera y la segunda están
  // dentro de la banda y la tercera, fuera.
  const eje = await inkIn(page, { x: 300, y: 395, w: 400, h: 10 });
  const borde = await inkIn(page, { x: 300, y: 380, w: 400, h: 10 });
  const fuera = await inkIn(page, { x: 300, y: 340, w: 400, h: 10 });
  expect(eje, 'el eje tiene que quedar bien cubierto').toBeGreaterThan(300);
  expect(borde, 'la pintura llega hasta los lados, no solo al eje').toBeGreaterThan(20);
  // Denso en el centro y difuminado hacia el borde: es lo que distingue un
  // aerógrafo de una brocha, y lo que fija la distribución elegida.
  expect(borde, 'el borde tiene que ser más ralo que el eje').toBeLessThan(eje);
  // Y ni una gota más allá de la boquilla: el radio es una cota dura, y de eso
  // dependen los bounds, el recorte al área y el alcance del borrador.
  expect(fuera, 'la boquilla es una cota dura').toBe(0);
});

test('el puntero es el círculo de la boquilla, y lo que pinta cabe justo dentro', async ({ page }) => {
  // La cruz del sistema no dice nada de lo que va a pasar (y en algunos temas
  // de macOS sale de colores encima del dibujo). Se sustituye por el círculo
  // del alcance real, como ya hacía el borrador.
  await openApp(page);
  await selectTool(page, 'airbrush');
  await expect(page.locator('#main-canvas')).toHaveCSS('cursor', 'none');

  // En reposo, el círculo sigue al puntero: se dibuja en el overlay, así que
  // no ensucia el lienzo ni cuenta como elemento.
  const p = await canvasPoint(page, 500, 400);
  await page.mouse.move(p.x, p.y);
  await settle(page);
  const aro = await page.evaluate(() => {
    const c = document.getElementById('overlay-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, n = 0;
    for (let i = 3, px = 0; i < d.length; i += 4, px++) {
      if (d[i] > 0) {
        n++;
        const x = px % c.width, y = (px / c.width) | 0;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    return { n, w: maxX - minX + 1, h: maxY - minY + 1, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  });
  expect(aro.n, 'el círculo tiene que dibujarse en reposo').toBeGreaterThan(100);
  expect(Math.round(aro.cx), 'centrado en el puntero').toBe(500);
  expect(Math.round(aro.cy)).toBe(400);
  // Diámetro = 2·radio (48 por defecto) más el grosor del propio trazo del aro.
  expect(aro.w).toBeGreaterThanOrEqual(48);
  expect(aro.w).toBeLessThanOrEqual(48 + 6);
  expect(Math.abs(aro.w - aro.h), 'es un círculo, no una elipse').toBeLessThanOrEqual(1);
  expect(await elements(page)).toHaveLength(0);

  // Y un soplo en ese punto cabe DENTRO de ese círculo: la superficie que
  // rodea el puntero es exactamente la que se pinta, ni más ni menos.
  await page.mouse.click(p.x, p.y);
  await settle(page);
  expect(await elements(page)).toHaveLength(1);
  const dentro = await inkIn(page, { x: 500 - 24, y: 400 - 24, w: 48, h: 48 });
  const total = await inkIn(page, { x: 500 - 60, y: 400 - 60, w: 120, h: 120 });
  expect(dentro, 'el soplo tiene que pintar').toBeGreaterThan(200);
  expect(total, 'ni una gota fuera del círculo que se había enseñado').toBe(dentro);
});

test('marcar un área cierra el modal y deja el lienzo utilizable', async ({ page }) => {
  // La guarda central de este spec: un <dialog showModal> abierto haría inerte
  // el lienzo y el arrastre siguiente no llegaría nunca — la app se leería
  // como rota, que es justo cómo se reportó la v2.16.2.
  await openApp(page);
  await page.locator('.sidebar__tool[data-tool="airbrush"]').click();
  await settle(page);
  await expect(page.locator('#modal-airbrush')).toBeVisible();

  await page.locator('#airbrush-area-mode').selectOption('area');
  await settle(page);
  await expect(page.locator('#modal-airbrush'), 'armar el área tiene que cerrar el diálogo')
    .not.toBeVisible();

  await drag(page, 200, 200, 600, 500);
  expect(await elements(page), 'ese arrastre marca el área, no pinta').toHaveLength(0);
  await expect(page.locator('#el-count')).toHaveText('0');
});

test('el aerógrafo pinta dentro del área y no fuera', async ({ page }) => {
  await openApp(page);
  await page.locator('.sidebar__tool[data-tool="airbrush"]').click();
  await settle(page);
  await page.locator('#airbrush-area-mode').selectOption('area');
  await settle(page);
  await drag(page, 200, 200, 500, 400);          // marca el área

  // Un trazo que cruza el borde derecho del área de lado a lado.
  await drag(page, 250, 300, 800, 300);
  expect(await elements(page)).toHaveLength(1);

  const dentro = await inkIn(page, { x: 260, y: 280, w: 200, h: 40 });
  const fuera = await inkIn(page, { x: 520, y: 280, w: 260, h: 40 });
  expect(dentro, 'dentro del área tiene que haber pintura').toBeGreaterThan(200);
  expect(fuera, 'fuera del área no puede quedar ni una gota').toBe(0);
});

test('el marco del área se ve, no cuenta como elemento y no viaja en el proyecto', async ({ page }) => {
  await openApp(page);
  await page.locator('.sidebar__tool[data-tool="airbrush"]').click();
  await settle(page);
  await page.locator('#airbrush-area-mode').selectOption('area');
  await settle(page);
  await drag(page, 200, 200, 600, 500);

  // El marco vive SOLO en el overlay: se dibuja ahí y el lienzo principal —el
  // que se exporta y el que cuenta— no lo conoce.
  const enOverlay = await page.evaluate(() => {
    const c = document.getElementById('overlay-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  expect(enOverlay, 'el marco discontinuo tiene que verse').toBeGreaterThan(100);
  expect(await elements(page)).toHaveLength(0);
  await expect(page.locator('#el-count')).toHaveText('0');
});

test('el área sobrevive a la recarga y «Quitar el área» la borra', async ({ page }) => {
  await openApp(page);
  // Es el único test del spec que compara MEDIDAS, así que fija el zoom al
  // 100 %: `setZoom` espera a que el sizer acabe su transición de 0.2 s, y a
  // 1:1 no hay redondeo del viewport al lienzo. Midiendo a mitad de la
  // transición (o al 120 % del auto-ajuste) el rectángulo sale con unos
  // píxeles de más o de menos y el test se vuelve intermitente.
  await setZoom(page, 100);
  await page.locator('.sidebar__tool[data-tool="airbrush"]').click();
  await settle(page);
  await page.locator('#airbrush-area-mode').selectOption('area');
  await settle(page);
  await drag(page, 200, 200, 600, 500);
  // El texto exacto no se fija: el mapeo del ratón al lienzo pasa por el zoom
  // (120 % en WIDE) y redondea a píxeles del viewport, así que un arrastre de
  // 400×300 puede quedar en 399×299. Lo que importa es que haya área y que
  // sobreviva IDÉNTICA a la recarga.
  await expect(page.locator('#airbrush-area-status')).toHaveText(/^Área marcada: \d+ × \d+ px$/);
  const marcada = await page.locator('#airbrush-area-status').innerText();
  const [w, h] = marcada.match(/(\d+) × (\d+)/).slice(1).map(Number);
  expect(Math.abs(w - 400), 'el área es la que se arrastró').toBeLessThanOrEqual(2);
  expect(Math.abs(h - 300)).toBeLessThanOrEqual(2);

  await page.reload();
  await page.waitForSelector('.sidebar__tool');
  await page.locator('.sidebar__tool[data-tool="airbrush"]').click();
  await settle(page);
  await expect(page.locator('#airbrush-area-mode')).toHaveValue('area');
  // El mismo rectángulo, al píxel: se guardó en coordenadas del lienzo.
  await expect(page.locator('#airbrush-area-status')).toHaveText(marcada);

  await page.locator('#btn-airbrush-clear-area').click();
  await settle(page);
  await expect(page.locator('#airbrush-area-status')).toHaveText('Sin área marcada');
  await expect(page.locator('#airbrush-area-mode')).toHaveValue('all');
  // Y a partir de aquí se pinta en todo el lienzo otra vez.
  await page.locator('#modal-airbrush .modal__cancel').click();
  await settle(page);
  await drag(page, 700, 600, 900, 700);
  const els = await elements(page);
  expect(els).toHaveLength(1);
  expect('clip' in els[0]).toBe(false);
});

test('la pintura translúcida se acumula: el cruce sale más oscuro que una pasada', async ({ page }) => {
  await openApp(page);
  await page.locator('.sidebar__tool[data-tool="airbrush"]').click();
  await settle(page);
  const op = page.locator('#airbrush-modal-opacity');
  await op.evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, 30);
  await page.locator('#modal-airbrush .modal__cancel').click();
  await settle(page);

  await drag(page, 300, 400, 700, 400);   // horizontal
  await drag(page, 500, 250, 500, 550);   // vertical, cruzándola
  expect(await elements(page)).toHaveLength(2);

  /** Luminosidad media de un cuadrado del lienzo (más bajo = más oscuro). */
  const lum = box => page.evaluate(({ x, y, w, h }) => {
    const d = document.getElementById('main-canvas')
      .getContext('2d').getImageData(x, y, w, h).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return s / (d.length / 4);
  }, box);

  const cruce = await lum({ x: 490, y: 390, w: 20, h: 20 });
  const soloUna = await lum({ x: 340, y: 390, w: 20, h: 20 });
  expect(cruce, 'dos pasadas translúcidas tienen que oscurecer más que una')
    .toBeLessThan(soloUna);
});
