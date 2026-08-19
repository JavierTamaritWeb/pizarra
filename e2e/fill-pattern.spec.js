'use strict';
/* ============================================================
   fill-pattern.spec.js — Aspecto de boceto (v3.11.0): trama, temblor y
   forma de la punta.

   Lo que solo se puede ver aquí: que la trama pinta PÍXELES distintos de un
   relleno plano (el arnés `node:vm` cuenta llamadas, no tinta), y que los dos
   mandos gemelos —panel y modal— se mantienen en sincronía de verdad.
   ============================================================ */
const { test, expect } = require('@playwright/test');
const {
  NARROW, openApp, settle, selectTool, drag, canvasPoint, readAutosave,
} = require('./helpers');

/** Píxeles con TINTA dentro de una caja de coordenadas de lienzo.
    Medido contra el papel, como `paintedPixels` del helper: el lienzo tiene
    fondo, así que contar píxeles no transparentes cuenta el papel entero. */
const tintaEn = (page, box) => page.evaluate(b => {
  const c = document.getElementById('main-canvas');
  const bg = document.getElementById('canvas-bg-picker').value;
  const [br, bgr, bb] = [1, 3, 5].map(i => parseInt(bg.slice(i, i + 2), 16));
  const limite = (0.299 * br + 0.587 * bgr + 0.114 * bb) * 0.75;
  const d = c.getContext('2d').getImageData(b.x, b.y, b.w, b.h).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (d[i + 3] > 0 && lum < limite) n++;
  }
  return n;
}, box);

/** Abre los ajustes de una herramienta y los deja abiertos: `selectTool` del
    helper los cierra a propósito (un <dialog> deja el lienzo inerte). */
async function abrirAjustes(page, tool, modal) {
  await page.locator(`.sidebar__tool[data-tool="${tool}"]`).click();
  await expect(page.locator(modal)).toBeVisible();
}

async function marcarRelleno(page) {
  await page.evaluate(() => {
    const c = document.getElementById('check-fill');
    c.checked = true;
    c.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle(page);
}

test('la trama pinta rayas donde el relleno plano pinta una mancha', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await marcarRelleno(page);

  await selectTool(page, 'rect');
  await drag(page, 100, 100, 300, 250);
  await settle(page);
  const caja = { x: 120, y: 120, w: 160, h: 110 };   // dentro del rectángulo
  const plano = await tintaEn(page, caja);

  // Otro rectángulo igual, pero rayado: el interior deja de ser continuo.
  await page.locator('#fill-pattern').selectOption('hachure');
  await selectTool(page, 'rect');
  await drag(page, 500, 100, 700, 250);
  await settle(page);
  const rayado = await tintaEn(page, { x: 520, y: 120, w: 160, h: 110 });
  expect(rayado).toBeGreaterThan(300);              // hay rayas de verdad
  // Y son rayas, no una mancha: la superficie plana cubre mucho más. (Se
  // comparan las dos medidas entre sí y no contra el área: el relleno de
  // fábrica es translúcido y deja ver la cuadrícula, así que ni el plano
  // llega al 100 % de tinta.)
  expect(plano).toBeGreaterThan(rayado * 2);
});

test('los dos selectores de trama son el mismo ajuste', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await marcarRelleno(page);
  // El panel es contextual: «Relleno» solo está con una herramienta (o una
  // selección) que admita relleno.
  await selectTool(page, 'rect');

  // Del panel al modal…
  await page.locator('#fill-pattern').selectOption('dots');
  await abrirAjustes(page, 'rect', '#modal-shape');
  await expect(page.locator('#shape-modal-pattern')).toHaveValue('dots');

  // …y del modal al panel.
  await page.locator('#shape-modal-pattern').selectOption('zigzag');
  await page.locator('#modal-shape .modal__cancel').click();
  await expect(page.locator('#fill-pattern')).toHaveValue('zigzag');
});

test('el temblor cambia el trazo y su mando es el mismo en los dos modales', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await abrirAjustes(page, 'pencil', '#modal-stroke');
  await page.locator('#stroke-modal-rough').selectOption('2');
  await page.locator('#modal-stroke .modal__cancel').click();
  await settle(page);

  await abrirAjustes(page, 'rect', '#modal-shape');
  await expect(page.locator('#shape-modal-rough')).toHaveValue('2');
  await page.locator('#modal-shape .modal__cancel').click();
  await drag(page, 100, 100, 300, 250);
  await settle(page);

  await expect.poll(async () => (await readAutosave(page))[0]?.rough).toBe(2);
});

test('la punta de punto pinta MÁS ALLÁ del extremo, donde la clásica no llega', async ({ page }) => {
  // La comprobación tiene que ser cualitativa: la punta clásica apunta hacia
  // ATRÁS desde el extremo, así que un disco centrado en el extremo pinta
  // donde ella no puede pintar nada. Comparar cantidades de tinta en la zona
  // de la punta no distingue: dos rayas de 2 px pesan casi lo mismo que el
  // triángulo macizo que forman.
  const alFrente = { x: 402, y: 397, w: 5, h: 6 };
  await openApp(page, { viewport: NARROW });

  await abrirAjustes(page, 'arrow', '#modal-stroke');
  await page.locator('#stroke-modal-head').selectOption('line');
  await page.locator('#modal-stroke .modal__cancel').click();
  await drag(page, 100, 400, 400, 400);
  await settle(page);
  expect(await tintaEn(page, alFrente)).toBe(0);

  await page.keyboard.press('Control+z');
  await settle(page);
  await abrirAjustes(page, 'arrow', '#modal-stroke');
  await page.locator('#stroke-modal-head').selectOption('dot');
  await page.locator('#modal-stroke .modal__cancel').click();
  await drag(page, 100, 400, 400, 400);
  await settle(page);
  await expect.poll(async () => (await readAutosave(page))[0]?.headShape).toBe('dot');
  expect(await tintaEn(page, alFrente)).toBeGreaterThan(10);
});

test('con el relleno apagado, el selector de trama se atenúa', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await expect(page.locator('#fill-pattern')).toBeDisabled();
  await marcarRelleno(page);
  await expect(page.locator('#fill-pattern')).toBeEnabled();
});
