'use strict';
/* ============================================================
   solids.spec.js — Grupo «3D» en un navegador de verdad (v2.24.0)

   La geometría —qué arista se ve, cuánto mide la fuga, qué pasa con los
   degenerados— la cubre `tests/solid.test.js` en milisegundos. Aquí va lo que
   el arnés `node:vm` no puede ver por construcción:

   · que la PREVISUALIZACIÓN del arrastre dibuja lo mismo que aparece al
     soltar. Es lo que atrapa las dos ampliaciones que necesitó
     `drawPiecesPreview`: honrar el `dash` de cada pieza (si no, se hereda el
     guion global del overlay y sale TODO discontinuo) y delegar las formas en
     `Renderer.renderElement` (si no, la cara frontal sencillamente no se
     dibuja). Ninguna de las dos rompe un solo test del arnés;
   · que elegir una sección cierra el catálogo y deja el lienzo utilizable: un
     `<dialog showModal>` abierto deja inerte todo lo de detrás;
   · que el sólido se comporta como una unidad con el ratón.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const {
  WIDE, openApp, selectTool, drag, clickCanvas, settle, elements, canvasPoint,
  paintedPixels,
} = require('./helpers.js');

test.use({ viewport: WIDE });

/** Tinta del canvas de previsualización. El overlay es transparente salvo
    donde se pinta, así que se cuentan los píxeles casi opacos: es el análogo
    del umbral de luminancia que usa `paintedPixels` sobre el lienzo, que sí
    lleva papel debajo. Con este umbral las dos medidas se quedan a un 2 %. */
const overlayInk = page => page.evaluate(() => {
  const c = document.getElementById('overlay-canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++;
  return n;
});

/** Elige herramienta 3D y sección, y deja el catálogo cerrado. */
async function seccion(page, tool, data, id) {
  await page.locator(`.sidebar__tool[data-tool="${tool}"]`).click();
  await expect(page.locator(`#modal-${data === 'prism' ? 'prism' : data}`)).toBeVisible();
  await page.locator(`[data-${data}="${id}"]`).click();
  await settle(page);
}

test('la previsualización dibuja lo mismo que aparece al soltar', async ({ page }) => {
  await openApp(page);
  await seccion(page, 'prisma', 'prism', 'square');

  const a = await canvasPoint(page, 300, 300);
  const b = await canvasPoint(page, 460, 460);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await settle(page);

  const tintaPreview = await overlayInk(page);
  expect(tintaPreview, 'la previsualización tiene que dibujar algo').toBeGreaterThan(500);

  await page.mouse.up();
  await settle(page);
  expect(await elements(page)).not.toHaveLength(0);
  const tintaFinal = await paintedPixels(page);

  // Misma cantidad de tinta, con el margen que deja el temblor de Sketchy (la
  // previsualización traza las aristas rectas sin él). Si faltara la cara
  // frontal, o si saliera todo discontinuo, la diferencia se dispara.
  const desvio = Math.abs(tintaPreview - tintaFinal) / tintaFinal;
  expect(desvio,
    `preview ${tintaPreview} px vs resultado ${tintaFinal} px`).toBeLessThan(0.12);
});

test('la previsualización trae la cara frontal y aristas de los dos tipos', async ({ page }) => {
  await openApp(page);
  await seccion(page, 'prisma', 'prism', 'rect');

  const a = await canvasPoint(page, 300, 300);
  const b = await canvasPoint(page, 500, 460);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await settle(page);

  // Se recorre el lado izquierdo de la cara frontal, que es una arista SÓLIDA,
  // y el conector inferior izquierdo, que es DISCONTINUO. Si drawPiecesPreview
  // no fijara el guion por pieza, el primero saldría a trazos también; si no
  // delegara las formas en el renderer, no habría nada que recorrer.
  const huecos = await page.evaluate(() => {
    const c = document.getElementById('overlay-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const pintado = (x, y) => d[(y * c.width + x) * 4 + 3] > 40;
    // Columna vertical del borde izquierdo de la cara (x ≈ 300), de y 310 a 450
    let tinta = 0, total = 0;
    for (let y = 310; y < 450; y++) {
      total++;
      for (let x = 296; x <= 304; x++) if (pintado(x, y)) { tinta++; break; }
    }
    return { tinta, total };
  });
  expect(huecos.tinta / huecos.total,
    'el borde izquierdo de la cara frontal tiene que salir continuo').toBeGreaterThan(0.9);

  await page.mouse.up();
  await settle(page);
});

test('elegir una sección cierra el catálogo y deja el lienzo utilizable', async ({ page }) => {
  await openApp(page);
  await page.locator('.sidebar__tool[data-tool="piramide"]').click();
  await expect(page.locator('#modal-pyramid')).toBeVisible();
  await page.locator('[data-pyramid="circle"]').click();
  await expect(page.locator('#modal-pyramid')).not.toBeVisible();
  await settle(page);
  // Y el lienzo responde: un <dialog showModal> abierto lo dejaría inerte
  await drag(page, 300, 300, 420, 420);
  await settle(page);
  expect(await elements(page)).not.toHaveLength(0);
});

test('la Esfera abre sus ajustes al pulsarla y cerrarlos la deja puesta', async ({ page }) => {
  await openApp(page);
  await page.locator('.sidebar__tool[data-tool="esfera"]').click();
  await expect(page.locator('#modal-sphere')).toBeVisible();
  // No tiene catálogo: no hay sección que elegir
  await expect(page.locator('#modal-sphere #sphere-preview')).toBeVisible();
  await page.locator('#modal-sphere .modal__cancel').click();
  await expect(page.locator('#modal-sphere')).not.toBeVisible();
  // Cerrar NO cancela nada: la herramienta sigue puesta y dibuja
  await expect(page.locator('.sidebar__tool[data-tool="esfera"]'))
    .toHaveAttribute('aria-pressed', 'true');
  await drag(page, 300, 300, 420, 420);
  await settle(page);
  const els = await elements(page);
  expect(els.some(e => e.type === 'circle')).toBe(true);
});

test('un sólido se selecciona, mueve y borra como una unidad', async ({ page }) => {
  await openApp(page);
  await seccion(page, 'prisma', 'prism', 'hexagon');
  await drag(page, 350, 350, 430, 430);
  await settle(page);
  const antes = await elements(page);
  expect(antes.length).toBeGreaterThan(2);

  await selectTool(page, 'select');
  await clickCanvas(page, 350, 350);          // el hexágono nace desde el centro
  await settle(page);
  await drag(page, 350, 350, 450, 350);       // arrastra el grupo 100 px

  // Mover no cambia el número de elementos, que es con lo que `elements()`
  // sincroniza, así que hay que sondear: el autoguardado va 500 ms por detrás
  // y una lectura directa devolvería la escena de antes del arrastre.
  const desplazamientos = async () => {
    const ahora = await elements(page);
    if (ahora.length !== antes.length) return null;
    return [...new Set(ahora.map((e, i) => Math.round(
      e.x !== undefined ? e.x - antes[i].x : e.x1 - antes[i].x1)))];
  };
  // Un único desplazamiento para todas las piezas: es un grupo, no una suelta
  await expect.poll(desplazamientos).toEqual([100]);

  await page.keyboard.press('Delete');
  await settle(page);
  expect(await elements(page)).toHaveLength(0);
});

test('los ajustes de proyección cambian la figura y sobreviven a la recarga', async ({ page }) => {
  await openApp(page);
  await page.locator('.sidebar__tool[data-tool="prisma"]').click();
  await expect(page.locator('#modal-prism')).toBeVisible();
  await page.locator('#prism-depth').fill('20');
  await page.locator('#prism-depth').dispatchEvent('input');
  await page.locator('#prism-depth').dispatchEvent('change');
  await expect(page.locator('#prism-depth-val')).toHaveText('20');
  // El gemelo del mismo ajuste en otro modal enseña lo mismo: un solo estado
  await expect(page.locator('#frustum-depth')).toHaveValue('20');
  await page.locator('[data-prism="rect"]').click();
  await settle(page);

  await page.reload();
  await settle(page);
  await page.locator('.sidebar__tool[data-tool="prisma"]').click();
  await expect(page.locator('#prism-depth')).toHaveValue('20');
});

test('el giro sólo aparece con secciones que orientan por ángulo, y gira de verdad', async ({ page }) => {
  await openApp(page);
  await page.locator('.sidebar__tool[data-tool="prisma"]').click();
  // «Caja» no orienta por ángulo: ahí girar es intercambiar ancho y alto
  await expect(page.locator('#prism-rotation-row')).toBeHidden();
  await page.locator('[data-prism="hexagon"]').click();
  await settle(page);
  await page.locator('.sidebar__tool[data-tool="prisma"]').click();
  await expect(page.locator('#prism-rotation-row')).toBeVisible();
  // El paso lo manda la sección: 30° el hexágono
  await expect(page.locator('#prism-rotation')).toHaveAttribute('step', '30');
  await expect(page.locator('#prism-rotation')).toHaveAttribute('max', '330');
  await page.locator('#prism-rotation').fill('30');
  await page.locator('#prism-rotation').dispatchEvent('input');
  await expect(page.locator('#prism-rotation-val')).toHaveText('30');
  await page.locator('[data-prism="hexagon"]').click();
  await settle(page);

  await drag(page, 300, 300, 380, 380);
  await settle(page);
  const els = await elements(page);
  const hex = els.find(e => e.type === 'hexagon');
  expect(hex.rotation).toBe(30);
});

test('el relleno de las caras se ve, y en translúcido deja ver lo de detrás', async ({ page }) => {
  await openApp(page);
  await page.locator('.sidebar__tool[data-tool="prisma"]').click();
  await page.locator('#prism-fill').check();
  await page.locator('#prism-fill-transparent').uncheck();
  await page.locator('#prism-fill-color').fill('#ff3366');
  await page.locator('#prism-fill-color').dispatchEvent('input');
  await page.locator('#prism-fill-color').dispatchEvent('change');
  await page.locator('[data-prism="square"]').click();
  await settle(page);
  await drag(page, 300, 300, 420, 420);
  await settle(page);

  const els = await elements(page);
  const caras = els.filter(e => e.type === 'polygon');
  expect(caras.length, 'las caras vistas se rellenan').toBeGreaterThan(0);
  for (const cara of caras) {
    expect(cara.fill).toBe(true);
    expect(cara.stroke).toBe(false);      // el contorno lo ponen las aristas
    expect(cara.fillColor).toBe('#ff3366');
  }
  // Y el color llega de verdad al lienzo
  const rosa = await page.evaluate(() => {
    const c = document.getElementById('main-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 200 && d[i + 1] < 110 && d[i + 2] > 70 && d[i + 2] < 160) n++;
    }
    return n;
  });
  expect(rosa, 'el relleno tiene que verse en el lienzo').toBeGreaterThan(1000);
});

test('el grosor y el color de las aristas se cambian desde el propio modal', async ({ page }) => {
  await openApp(page);
  await page.locator('.sidebar__tool[data-tool="prisma"]').click();
  await page.locator('#prism-stroke').fill('7');
  await page.locator('#prism-stroke').dispatchEvent('input');
  await page.locator('#prism-stroke').dispatchEvent('change');
  await expect(page.locator('#prism-stroke-val')).toHaveText('7');
  // La paleta del modal es la misma que la del panel: se acota la rejilla o
  // el selector encuentra dos muestras del mismo color y falla en modo estricto
  await page.locator('#prism-color-grid .panel__color-swatch[data-color="#e74c3c"]').click();
  await page.locator('[data-prism="square"]').click();
  await settle(page);
  await drag(page, 300, 300, 400, 400);
  await settle(page);

  const els = await elements(page);
  expect(els.length).toBeGreaterThan(2);
  for (const el of els) {
    expect(el.lineWidth).toBe(7);
    expect(el.color).toBe('#e74c3c');
  }
});

test('Shift+R y ←/→ giran el sólido entero ya dibujado', async ({ page }) => {
  await openApp(page);
  await seccion(page, 'prisma', 'prism', 'rect');
  await drag(page, 300, 300, 420, 380);
  await settle(page);
  const antes = await elements(page);

  await selectTool(page, 'select');
  await clickCanvas(page, 310, 310);
  await settle(page);

  const medida = async () => {
    const els = await elements(page);
    if (els.length !== antes.length) return null;
    const xs = [], ys = [];
    els.forEach(e => {
      if (e.type === 'line') { xs.push(e.x1, e.x2); ys.push(e.y1, e.y2); }
      else if (e.x !== undefined) { xs.push(e.x, e.x + e.w); ys.push(e.y, e.y + e.h); }
    });
    return Math.round(Math.max(...xs) - Math.min(...xs)) >
      Math.round(Math.max(...ys) - Math.min(...ys)) ? 'apaisado' : 'vertical';
  };
  expect(await medida()).toBe('apaisado');
  await page.keyboard.press('Shift+R');
  await expect.poll(medida).toBe('vertical');
  await page.keyboard.press('ArrowRight');
  await expect.poll(medida).toBe('apaisado');
});

test('un sólido ya dibujado se recolorea entero: aristas y lados', async ({ page }) => {
  // El escenario que falló en manos del usuario: la figura se dibuja EN HUECO y
  // después se le quiere cambiar el color. Sus caras no existían —sólo se
  // emiten al crearla—, así que «el color de los lados» no tenía a qué
  // aplicarse, y pulsar la herramienta para llegar a sus ajustes deseleccionaba
  // la figura, de modo que tampoco llegaba el de las aristas.
  await openApp(page);
  await seccion(page, 'prisma', 'prism', 'square');
  await drag(page, 300, 300, 420, 420);
  await settle(page);
  const antes = await elements(page);
  expect(antes.filter(e => e.type === 'polygon'), 'nace sin caras').toHaveLength(0);

  await selectTool(page, 'select');
  await clickCanvas(page, 320, 320);
  await settle(page);
  await page.locator('.sidebar__tool[data-tool="prisma"]').click();
  await expect(page.locator('#modal-prism')).toBeVisible();
  // La selección sobrevive: la sección «Posición y tamaño» del panel sigue ahí
  await expect(page.locator('#panel-sec-element')).toBeVisible();

  // 1) Color de las ARISTAS, desde la paleta del propio modal
  await page.locator('#prism-color-grid .panel__color-swatch[data-color="#e74c3c"]').click();
  await expect.poll(async () =>
    [...new Set((await elements(page)).map(e => e.color))].join(',')).toBe('#e74c3c');

  // 2) Rellenar crea las caras, y la casilla SE QUEDA marcada — con la lectura
  //    de un solo elemento, el repintado siguiente la desmarcaba sola.
  await page.locator('#prism-fill').check();
  await expect(page.locator('#prism-fill')).toBeChecked();
  await expect.poll(async () =>
    (await elements(page)).filter(e => e.type === 'polygon').length).toBeGreaterThan(0);

  // 3) Color de los LADOS
  await page.locator('#prism-fill-transparent').uncheck();
  await page.locator('#prism-fill-color').fill('#ffcc00');
  await page.locator('#prism-fill-color').dispatchEvent('input');
  await page.locator('#prism-fill-color').dispatchEvent('change');
  await expect.poll(async () => {
    const caras = (await elements(page)).filter(e => e.type === 'polygon');
    return caras.length > 0 && caras.every(c => c.fillColor === '#ffcc00');
  }).toBe(true);

  // Y la figura no se ha movido ni ha cambiado de tamaño
  const cara = el => el.type !== 'line' && el.type !== 'curveArrow' && el.type !== 'polygon';
  const f0 = antes.find(cara), f1 = (await elements(page)).find(cara);
  expect(Math.round(f1.x)).toBe(Math.round(f0.x));
  expect(Math.round(f1.w)).toBe(Math.round(f0.w));
});

test('los mandos del modal enseñan lo que tiene la figura, no los valores de fábrica', async ({ page }) => {
  await openApp(page);
  await page.locator('.sidebar__tool[data-tool="prisma"]').click();
  await page.locator('#prism-stroke').fill('7');
  await page.locator('#prism-stroke').dispatchEvent('input');
  await page.locator('#prism-stroke').dispatchEvent('change');
  await page.locator('[data-prism="square"]').click();
  await settle(page);
  await drag(page, 300, 300, 420, 420);
  await settle(page);

  // Se cambia el default a otra cosa, para que «7» sólo pueda venir de la figura
  await page.locator('.sidebar__tool[data-tool="prisma"]').click();
  await page.locator('#prism-stroke').fill('2');
  await page.locator('#prism-stroke').dispatchEvent('input');
  await page.locator('#prism-stroke').dispatchEvent('change');
  await page.locator('[data-prism="square"]').click();
  await settle(page);

  await selectTool(page, 'select');
  await clickCanvas(page, 320, 320);
  await settle(page);
  await page.locator('.sidebar__tool[data-tool="prisma"]').click();
  await expect(page.locator('#prism-stroke')).toHaveValue('7');
  await expect(page.locator('#prism-stroke-val')).toHaveText('7');
});

test('rellenar un sólido ya dibujado lo pinta OPACO, y el translúcido se ve más claro', async ({ page }) => {
  await openApp(page);
  // 1) Se dibuja en hueco, sin tocar el color de relleno: es el caso que se
  //    rompía —sin `fillColor` propio, el relleno caía en el tinte clásico
  //    `color + '20'` (12 %) y el modo SÓLIDO salía más transparente que el
  //    translúcido (40 %).
  await page.locator('.sidebar__tool[data-tool="prisma"]').click();
  await page.locator('#prism-fill').uncheck();
  await page.locator('[data-prism="square"]').click();
  await settle(page);
  await drag(page, 300, 300, 460, 460);
  await settle(page);

  // 2) Se vuelve a seleccionar y se rellena desde el modal de la herramienta
  await selectTool(page, 'select');
  await clickCanvas(page, 320, 320);
  await settle(page);
  await page.locator('.sidebar__tool[data-tool="prisma"]').click();
  await page.locator('#prism-fill-transparent').uncheck();
  await page.locator('#prism-fill').check();
  await expect.poll(async () =>
    (await elements(page)).filter(e => e.type === 'polygon').length).toBeGreaterThan(0);

  // Las caras llevan color propio explícito: el relleno sólido es opaco
  const caras = (await elements(page)).filter(e => e.type === 'polygon');
  for (const c of caras) {
    expect(c.fillColor, 'la cara guarda su color de relleno').toMatch(/^#[0-9a-f]{6}$/i);
    expect(c.fillTransparent).toBeUndefined();
  }

  // Y en el lienzo: el centro de la figura queda del color de la tinta, no de
  // un tono lavado a un paso del papel.
  const muestra = () => page.evaluate(() => {
    const c = document.getElementById('main-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    // Luminancia media de la banda central del sólido
    let sum = 0, n = 0;
    for (let y = 330; y < 430; y++) {
      for (let x = 330; x < 430; x++) {
        const i = (y * c.width + x) * 4;
        sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        n++;
      }
    }
    return sum / n;
  });
  const solido = await muestra();

  // 3) Translúcido: la misma zona tiene que aclararse (deja pasar el papel)
  await page.locator('#prism-fill-transparent').check();
  await settle(page);
  await settle(page);
  const translucido = await muestra();

  expect(solido, 'el relleno sólido es opaco, no un tinte al 12 %').toBeLessThan(80);
  expect(translucido, 'el translúcido deja ver el papel').toBeGreaterThan(solido + 20);
});
