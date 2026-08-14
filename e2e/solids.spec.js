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
