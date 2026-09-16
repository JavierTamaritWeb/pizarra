'use strict';
/* ============================================================
   ovalo-flecha.spec.js — Las flechas se quedan donde se sueltan (v3.27.0).

   El gesto de la captura que destapó el fallo: un óvalo y, con Flecha,
   Flecha curva o Flecha semicírculo, un arrastre que cruza su borde. Hasta la
   3.26 el extremo que caía dentro de la caja del óvalo se «anclaba» y saltaba
   al perímetro de esa caja —fuera de la elipse—, mientras la Línea, que nunca
   anclaba, entraba sin problema. El anclaje de conectores se retiró entero.
   Va en e2e porque es el gesto real con el ratón, de punta a punta.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { WIDE, openApp, selectTool, drag, elements } = require('./helpers');

test.use({ viewport: WIDE });

const OVALO = [400, 250, 800, 550];   // caja (400,250)-(800,550), centro (600,400)

const extremos = el => [el.x1, el.y1, el.x2, el.y2].map(Math.round);

test('desde el centro del óvalo hacia fuera: la flecha, la curva y el semicírculo se quedan donde se dibujan', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'circle');
  await drag(page, ...OVALO);

  const gestos = [
    ['arrow',      600, 400, 1000, 400],
    ['curveArrow', 600, 420, 1000, 600],
    ['arcArrow',   600, 380, 1000, 200],
  ];
  for (const [tool, ...g] of gestos) {
    await selectTool(page, tool);
    await drag(page, ...g);
  }

  const els = await elements(page);
  expect(els).toHaveLength(4);
  expect(els[0].id, 'el óvalo no recibe un id de destino').toBeUndefined();
  gestos.forEach(([tool, ...g], i) => {
    const el = els[i + 1];
    expect(extremos(el), `${tool}: extremos exactos`).toEqual(g);
    expect(el.startAnchor, `${tool}: sin startAnchor`).toBeUndefined();
    expect(el.endAnchor, `${tool}: sin endAnchor`).toBeUndefined();
  });
});

test('desde fuera hasta dentro del óvalo: la punta entra en la figura', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'circle');
  await drag(page, ...OVALO);

  const gestos = [
    ['arrow',      200, 400, 600, 400],
    ['curveArrow', 900, 700, 650, 450],
    ['arcArrow',   300, 100, 550, 350],
  ];
  for (const [tool, ...g] of gestos) {
    await selectTool(page, tool);
    await drag(page, ...g);
  }

  const els = await elements(page);
  gestos.forEach(([tool, ...g], i) => {
    const el = els[i + 1];
    expect(extremos(el), `${tool}: la punta se queda dentro`).toEqual(g);
    expect(el.endAnchor, `${tool}: sin endAnchor`).toBeUndefined();
  });
});

test('un componente UI tampoco ancla la flecha que sale de él', async ({ page }) => {
  // Era el conector clásico: origen dentro de un botón, punta fuera.
  await openApp(page);
  await selectTool(page, 'button');
  await drag(page, 100, 100, 300, 250);
  await selectTool(page, 'arrow');
  await drag(page, 200, 180, 800, 600);

  const [boton, flecha] = await elements(page);
  expect(boton.id).toBeUndefined();
  expect(extremos(flecha)).toEqual([200, 180, 800, 600]);
  expect(flecha.startAnchor).toBeUndefined();
});
