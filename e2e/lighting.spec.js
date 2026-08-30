'use strict';

const { test, expect } = require('@playwright/test');
const { openApp, elements, readAutosave, selectTool, drag } = require('./helpers.js');

/* Iluminación (v3.15.0): catálogo genérico de VARIANT_MODALS, como el Balcón.
   Lo que se comprueba aquí y NO puede comprobar el arnés node:vm es que el
   catálogo se pinte de verdad en un navegador —ocho iconos con su canvas— y
   que un clic seleccione la farola entera, no una de sus piezas. */
test('Iluminación: catálogo de 8 modelos, grupo al dibujar y elección persistente',
  async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await openApp(page);

    const tool = page.locator('.sidebar__tool[data-tool="iluminacion"]');
    await expect(tool).toContainText('Iluminación');
    await selectTool(page, 'iluminacion');
    await expect(page.locator('#modal-light')).toBeVisible();

    const botones = page.locator('#light-catalog .modal__light');
    await expect(botones).toHaveCount(8);
    expect(await botones.evaluateAll(bs => bs.map(b => b.dataset.light)))
      .toEqual(['post', 'post2', 'forge', 'forge2', 'wall', 'spot', 'mast', 'tower']);

    // El icono es la geometría real: cada botón lleva su canvas y ninguno sale
    // en blanco (un modelo que no dibuja nada pasaría desapercibido si no).
    const tintas = await botones.evaluateAll(bs => bs.map(b => {
      const canvas = b.querySelector('canvas');
      if (!canvas) return null;
      const { data } = canvas.getContext('2d')
        .getImageData(0, 0, canvas.width, canvas.height);
      let hash = 2166136261;
      for (let i = 0; i < data.length; i += 17) hash = Math.imul(hash ^ data[i], 16777619);
      return hash >>> 0;
    }));
    expect(tintas.includes(null), 'algún modelo sin icono').toBe(false);
    expect(new Set(tintas).size, 'dos modelos pintan el mismo icono').toBe(8);

    await page.locator('#light-catalog .modal__light[data-light="forge2"]').click();
    await expect(page.locator('#modal-light')).not.toBeVisible();

    await drag(page, 300, 120, 420, 420);
    const piezas = await elements(page);
    expect(piezas.length).toBeGreaterThan(6);
    const grupo = piezas[0].buildingGroupId;
    expect(grupo, 'las piezas deben nacer agrupadas').toBeTruthy();
    expect(piezas.every(p => p.buildingGroupId === grupo)).toBe(true);

    // Agarrar la farola por cualquier pieza la mueve ENTERA: es la prueba
    // observable de que el clic selecciona el grupo y no el barrote que se
    // pisó (el estado interno no se expone a propósito).
    await selectTool(page, 'select');
    // El punto de agarre sale de la geometría, no a ojo: el fuste es fino y un
    // punto elegido a mano cae fuera del trazo y dibuja marquesina en vez de
    // mover, que es un falso verde silencioso.
    const asa = piezas.find(p => typeof p.x1 === 'number');
    await drag(page, (asa.x1 + asa.x2) / 2, (asa.y1 + asa.y2) / 2,
               (asa.x1 + asa.x2) / 2 + 40, (asa.y1 + asa.y2) / 2 + 30);
    // El autosave va con retardo y mover no cambia el recuento de piezas, así
    // que `elements()` devolvería la escena vieja sin esperar a nada: hay que
    // sondear hasta ver el desplazamiento.
    let movidas = piezas;
    await expect.poll(async () => {
      movidas = await readAutosave(page);
      return movidas[0].x1;
    }, { message: 'la farola no se movió' }).not.toBe(piezas[0].x1);
    expect(movidas.length).toBe(piezas.length);
    const dx = new Set(), dy = new Set();
    for (let i = 0; i < piezas.length; i++) {
      const a = piezas[i], b = movidas[i];
      dx.add(Math.round(('x' in a ? b.x - a.x : b.x1 - a.x1)));
      dy.add(Math.round(('y' in a ? b.y - a.y : b.y1 - a.y1)));
    }
    expect(dx.size, 'las piezas no se movieron a la vez').toBe(1);
    expect(dy.size, 'las piezas no se movieron a la vez').toBe(1);
    expect([...dx][0]).not.toBe(0);

    await page.reload();
    await selectTool(page, 'iluminacion');
    await expect(page.locator('#light-catalog .modal__light[data-light="forge2"]'))
      .toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
  });

/* Alumbrado deportivo (v3.16.0): la altura del mástil y de la torre sale de la
   cota en metros del modal, no del arrastre. En el navegador se comprueba lo
   que el arnés no ve: que el selector de actividad mueva de verdad el
   deslizador y que el dibujo obedezca a la cota y no al ratón. */
test('Alumbrado deportivo: la actividad propone la cota y la cota manda sobre el arrastre',
  async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await openApp(page);
    await selectTool(page, 'iluminacion');

    const cota = page.locator('#light-mast-height');
    await page.locator('#light-sport').selectOption('football');
    await expect(cota).toHaveValue('16');
    await expect(page.locator('#light-mast-hint')).toContainText('15–18 m');

    await page.locator('#light-catalog .modal__light[data-light="tower"]').click();
    await expect(page.locator('#modal-light')).not.toBeVisible();

    // Dos arrastres verticales muy distintos, la misma torre de 16 m.
    await drag(page, 260, 120, 340, 200);
    const corta = await elements(page);
    await selectTool(page, 'iluminacion');
    await page.locator('#light-catalog .modal__light[data-light="tower"]').click();
    await drag(page, 600, 120, 680, 620);
    const todo = await elements(page);
    const larga = todo.filter(p => p.buildingGroupId !== corta[0].buildingGroupId);

    const alto = ps => Math.max(...ps.map(p => (p.y2 ?? p.y + p.h))) -
      Math.min(...ps.map(p => (p.y1 ?? p.y)));
    expect(Math.abs(alto(corta) - alto(larga)),
      'el arrastre vertical cambió la altura de la torre').toBeLessThan(2);

    // Bajar la cota SÍ la baja, y el aviso de rango aparece al salirse.
    await selectTool(page, 'iluminacion');
    await cota.fill('6');
    await cota.dispatchEvent('input');
    await expect(page.locator('#light-mast-hint')).toContainText('se sale de ese rango');
    await page.locator('#light-catalog .modal__light[data-light="tower"]').click();
    await drag(page, 900, 120, 960, 620);
    const bajita = (await elements(page))
      .filter(p => ![corta[0].buildingGroupId, larga[0].buildingGroupId]
        .includes(p.buildingGroupId));
    expect(alto(bajita), 'la torre de 6 m no salió más baja que la de 16 m')
      .toBeLessThan(alto(corta) * 0.6);
    expect(errors).toEqual([]);
  });
