'use strict';
/* ============================================================
   modal-fit.spec.js — La salida de un modal siempre alcanzable.

   Un `<dialog showModal>` vuelve INERTE todo lo que hay detrás. Si su botón
   de cierre queda fuera de la ventana, no se puede cerrar con el ratón y la
   aplicación entera parece rota: el lienzo no responde, no se puede dibujar
   ni escribir. Le pasó a #modal-text en la v2.16.0 al añadirle los ajustes
   de negrita y sombra, en una ventana de altura corriente.

   Va en e2e por la razón de siempre: esto es alto real, scroll real y
   posición pegajosa real. El arnés `node:vm` no tiene layout, así que aquí
   no vería absolutamente nada.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { openApp, settle } = require('./helpers');

/* Deliberadamente BAJO: es donde el modal más alto deja de caber. Con los 700
   de NARROW el fallo no se reproduce, y una guarda que no puede fallar no
   guarda nada. Un portátil con la barra de marcadores abierta ronda esto. */
const CORTA = { width: 1160, height: 560 };

test.use({ viewport: CORTA });

/* Los modales de ajustes: se abren solos al elegir su herramienta, que es lo
   que convierte un botón inalcanzable en una app bloqueada. */
const MODALES = [
  { tool: 'text',   modal: '#modal-text' },
  { tool: 'rect',   modal: '#modal-shape' },
  { tool: 'pencil', modal: '#modal-stroke' },
  { tool: 'button', modal: '#modal-ui' },
  { tool: 'eraser', modal: '#modal-eraser' },
  { tool: 'pick',   modal: '#modal-select' },
  // El del aerógrafo es el más alto del grupo Dibujo (seis mandos más el
  // bloque del área): el mejor candidato a repetir el fallo de la v2.16.2.
  { tool: 'airbrush', modal: '#modal-airbrush' },
];

for (const { tool, modal } of MODALES) {
  test(`${modal} se puede cerrar con el ratón en una ventana baja`, async ({ page }) => {
    await openApp(page);
    await page.locator(`.sidebar__tool[data-tool="${tool}"]`).click();
    await settle(page);

    const dialog = page.locator(modal);
    await expect(dialog).toBeVisible();
    const cerrar = dialog.locator('.modal__cancel');

    // Dentro de la ventana: si su borde inferior cae por debajo, no hay forma
    // de pulsarlo —y detrás no se puede pulsar nada, porque el diálogo es modal—.
    const caja = await cerrar.boundingBox();
    const alto = page.viewportSize().height;
    expect(caja, 'el botón de cierre debe existir y tener caja').not.toBeNull();
    expect(caja.y + caja.height,
      `«Cerrar» de ${modal} se sale de la ventana (${alto}px de alto)`).toBeLessThanOrEqual(alto);
    expect(caja.y).toBeGreaterThanOrEqual(0);

    // Y pulsable de verdad, no solo dentro: nada suyo ni ajeno lo tapa.
    // `click` de Playwright ya falla si el punto está cubierto por otro elemento.
    await cerrar.click({ timeout: 3000 });
    await settle(page);
    await expect(dialog).toBeHidden();

    // La prueba final es la que reportó el usuario: con el modal cerrado, el
    // lienzo vuelve a responder.
    await expect(page.locator('#main-canvas')).toBeVisible();
    await page.locator('#main-canvas').click({ position: { x: 200, y: 150 } });
    await settle(page);
  });
}

/* El de exportación no se abre con una herramienta sino desde la barra de
   arriba, así que no cabe en el bucle — pero creció con los ajustes de la
   v3.9.0 (resolución, transparencia, selección y el botón de copiar), que es
   exactamente la forma en que este fallo aparece: añadiendo mandos a un modal
   que ya iba justo. */
test('#modal-export se puede cerrar con el ratón en una ventana baja', async ({ page }) => {
  await openApp(page);
  await page.locator('#btn-export').click();
  const dialog = page.locator('#modal-export');
  await expect(dialog).toBeVisible();

  const cerrar = dialog.locator('.modal__cancel');
  const caja = await cerrar.boundingBox();
  const alto = page.viewportSize().height;
  expect(caja, 'el botón de cierre debe existir y tener caja').not.toBeNull();
  expect(caja.y + caja.height,
    `«Cancelar» de #modal-export se sale de la ventana (${alto}px de alto)`).toBeLessThanOrEqual(alto);
  expect(caja.y).toBeGreaterThanOrEqual(0);

  await cerrar.click({ timeout: 3000 });
  await settle(page);
  await expect(dialog).toBeHidden();
  await page.locator('#main-canvas').click({ position: { x: 200, y: 150 } });
  await settle(page);
});
