'use strict';
/* ============================================================
   panel.spec.js — El panel lateral reorganizado (v2.9.0).

   Va en e2e y no en `tests/` por la razón de siempre: el arnés `node:vm` ve
   `hidden` como una propiedad JS, pero no sabe si el CSS la respeta. Aquí lo
   que se comprueba es la visibilidad REAL —`.panel__section` es display:flex y
   sin la regla `[hidden]{display:none}` el atributo no oculta nada— y que los
   controles que quedan se pueden pulsar de verdad, también dentro del cajón.
   ============================================================ */

const { test, expect } = require('@playwright/test');
const { WIDE, openApp, settle, selectTool, setSlider, drag, clickCanvas, readAutosave } = require('./helpers');

test.use({ viewport: WIDE });

test('el panel enseña solo las secciones de la herramienta activa', async ({ page }) => {
  await openApp(page);

  // Arranca en Lápiz: ni Edificios, ni Jardín, ni Relleno, ni Texto.
  await expect(page.locator('#panel-sec-build')).toBeHidden();
  await expect(page.locator('#panel-sec-garden')).toBeHidden();
  await expect(page.locator('#panel-sec-fill')).toBeHidden();
  await expect(page.locator('#panel-sec-text')).toBeHidden();
  // Lo que aplica siempre, sí.
  await expect(page.locator('#panel-sec-stroke')).toBeVisible();
  await expect(page.locator('#panel-sec-canvas')).toBeVisible();
  await expect(page.locator('#panel-sec-selection')).toBeVisible();

  await selectTool(page, 'rect');
  await expect(page.locator('#panel-sec-fill')).toBeVisible();
  await expect(page.locator('#check-fill')).toBeVisible();

  // Se elige una vista en vez de cancelar: cancelar devuelve a la herramienta
  // anterior (wireBuildModalCancel), y entonces «Edificios» se iría con ella.
  await selectTool(page, 'fachada');
  await page.locator('#facade-catalog .modal__facade').first().click();
  await settle(page);
  await expect(page.locator('#panel-sec-build')).toBeVisible();
  // Y son pulsables de verdad, no solo visibles.
  await page.locator('#build-floors').selectOption('3');
  await expect(page.locator('#build-floors')).toHaveValue('3');
  await expect(page.locator('#panel-sec-garden')).toBeHidden();
});

test('pulsar una herramienta de dibujo abre sus ajustes de trazo', async ({ page }) => {
  await openApp(page);
  const modal = page.locator('#modal-stroke');
  const gear = page.locator('#btn-eraser-size');

  // Lo mismo que hacen el Borrador y los catálogos: elegir la herramienta abre
  // su modal. Las cinco de dibujo, sin excepción.
  for (const tool of ['pencil', 'line', 'arrow', 'curveArrow', 'arc']) {
    await page.locator(`.sidebar__tool[data-tool="${tool}"]`).click();
    await expect(modal, `${tool} debería abrir sus ajustes de trazo`)
      .toHaveAttribute('open', '');
    await page.locator('#modal-stroke .modal__cancel').click();
    await expect(modal).not.toHaveAttribute('open', '');
    // Y cerrar deja la herramienta puesta: no hay nada que elegir, como en el
    // Borrador. Si volviera a la anterior, no se podría dibujar.
    await expect(page.locator('.sidebar__tool--active')).toHaveAttribute('data-tool', tool);
  }

  // El ⚙ del panel lo reabre sin cambiar de herramienta.
  await expect(gear).toBeVisible();
  await gear.click();
  await expect(modal).toHaveAttribute('open', '');

  // El grosor del modal y el del panel son el mismo ajuste.
  await setSlider(page, 'stroke-modal-slider', 6, { release: true });
  await expect(page.locator('#stroke-val')).toHaveText('6');
  await page.locator('#modal-stroke .modal__cancel').click();
  await expect(page.locator('#stroke-slider')).toHaveValue('6');

  // Mover abre los ajustes de selección, como «Select»: la casilla gobierna el
  // clic de las dos (v2.18.0). Y su ⚙ los reabre — ni asoma el del trazo.
  await page.locator('.sidebar__tool[data-tool="select"]').click();
  const selModal = page.locator('#modal-select');
  await expect(selModal).toHaveAttribute('open', '');
  await expect(modal).not.toHaveAttribute('open', '');
  await selModal.locator('.modal__cancel').click();
  await expect(selModal).not.toHaveAttribute('open', '');
  await expect(gear).toBeVisible();
  await gear.click();
  await expect(selModal).toHaveAttribute('open', '');
  await expect(modal).not.toHaveAttribute('open', '');
  await selModal.locator('.modal__cancel').click();

  // Y con el borrador el mismo ⚙ lleva a su propio modal, no al de trazo.
  await selectTool(page, 'eraser');
  await gear.click();
  await expect(page.locator('#modal-eraser')).toHaveAttribute('open', '');
  await expect(modal).not.toHaveAttribute('open', '');
});

test('pulsar una forma abre sus ajustes, con trazo y relleno', async ({ page }) => {
  await openApp(page);
  const modal = page.locator('#modal-shape');

  for (const tool of ['rect', 'roundedRect', 'circle', 'square',
    'trapezoid', 'triangle', 'pentagon', 'hexagon']) {
    await page.locator(`.sidebar__tool[data-tool="${tool}"]`).click();
    await expect(modal, `${tool} debería abrir sus ajustes`).toHaveAttribute('open', '');
    await page.locator('#modal-shape .modal__cancel').click();
    await expect(page.locator('.sidebar__tool--active')).toHaveAttribute('data-tool', tool);
  }

  // El relleno del modal y el del panel son el mismo ajuste.
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await page.locator('#shape-modal-fill').check();
  await page.locator('#shape-modal-fill-transparent').check();
  await expect(page.locator('#shape-modal-opacity')).toBeEnabled();
  await setSlider(page, 'shape-modal-opacity', 70, { release: true });
  await page.locator('#modal-shape .modal__cancel').click();

  await expect(page.locator('#check-fill')).toBeChecked();
  await expect(page.locator('#check-fill-transparent')).toBeChecked();
  await expect(page.locator('#fill-opacity-val')).toHaveText('70');
});

test('el giro se elige en los ajustes de la forma, con el paso de cada tipo', async ({ page }) => {
  await openApp(page);
  const row = page.locator('#shape-modal-rotation-row');
  const slider = page.locator('#shape-modal-rotation');

  // El rectángulo guarda su giro en las dimensiones, no como ángulo: no lo ofrece.
  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  await expect(row).toBeHidden();
  await page.locator('#modal-shape .modal__cancel').click();

  await page.locator('.sidebar__tool[data-tool="pentagon"]').click();
  await expect(row).toBeVisible();
  await expect(slider).toHaveAttribute('step', '36');   // 360 / 5 lados
  await setSlider(page, 'shape-modal-rotation', 72, { release: true });
  await expect(page.locator('#shape-modal-rotation-val')).toHaveText('72');
  await page.locator('#modal-shape .modal__cancel').click();

  // Y el hexágono reconfigura el paso: 36° no es una orientación suya.
  await page.locator('.sidebar__tool[data-tool="hexagon"]').click();
  await expect(slider).toHaveAttribute('step', '30');
  await expect(page.locator('#shape-modal-rotation-val')).toHaveText('60');
});

test('un componente de UI se recolorea, se mide y se rotula desde el panel', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'button');
  await drag(page, 200, 200, 340, 250);
  await selectTool(page, 'select');
  await clickCanvas(page, 270, 225);

  await expect(page.locator('#panel-sec-element')).toBeVisible();
  await expect(page.locator('#el-label-row')).toBeVisible();

  // Medidas exactas: se escriben y el elemento las toma.
  await page.locator('#el-w').fill('300');
  await page.locator('#el-w').blur();
  await page.locator('#el-x').fill('60');
  await page.locator('#el-x').blur();
  // Rótulo, que antes solo se cambiaba con doble clic sobre el dibujo.
  await page.locator('#el-label').fill('Enviar');
  await page.locator('#el-label').blur();

  // Se sondea el autosave en vez de leerlo una vez: editar no cambia el número
  // de elementos, así que el `elements()` corriente se contentaría con el par
  // (1 === 1) de la escena ANTERIOR —el autosave va con 500 ms de retardo— y
  // pasaría o fallaría según lo que tardase el navegador.
  const field = name => expect.poll(async () => {
    const [el] = await readAutosave(page);
    return el && el[name];
  });

  await field('w').toBe(300);
  await field('x').toBe(60);
  await field('label').toBe('Enviar');

  // Y el color, que era el único control de aspecto sin semántica dual.
  // Por `data-color`, no por posición: la paleta se reordenó por tono en la
  // v2.19.0 y un índice fijo convierte cualquier reordenación en un fallo.
  await page.locator('.panel__color-swatch[data-color="#e94560"]').click();
  await settle(page);
  await field('color').toBe('#e94560');
});

test('pulsar Botón abre sus ajustes y el rótulo escrito sale en el elemento', async ({ page }) => {
  await openApp(page);
  // Click directo al sidebar: aquí se comprueba la APERTURA, sin el helper.
  await page.locator('.sidebar__tool[data-tool="button"]').click();
  const modal = page.locator('#modal-ui');
  await expect(modal).toHaveAttribute('open', '');
  await expect(page.locator('#modal-ui-title')).toHaveText('Ajustes de Botón');

  await page.locator('#ui-modal-label').fill('Enviar');
  await page.locator('#ui-modal-label').blur();
  await page.locator('#modal-ui .modal__cancel').click();
  await expect(modal).not.toHaveAttribute('open', '');
  // Cerrar deja la herramienta puesta, como el resto de ajustes.
  await expect(page.locator('.sidebar__tool--active')).toHaveAttribute('data-tool', 'button');

  await drag(page, 200, 200, 340, 250);
  const field = name => expect.poll(async () => {
    const [el] = await readAutosave(page);
    return el && el[name];
  });
  await field('type').toBe('button');
  await field('label').toBe('Enviar');
});

// v2.10.0: pulsar la herramienta de un elemento seleccionado ya no
// deselecciona — el modal abre editando ESE elemento, posición incluida.
test('pulsar la herramienta del elemento seleccionado lo edita desde su modal', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'rect');
  await drag(page, 150, 150, 270, 230);
  await selectTool(page, 'select');
  await clickCanvas(page, 210, 190);
  await expect(page.locator('#panel-sec-element')).toBeVisible();

  await page.locator('.sidebar__tool[data-tool="rect"]').click();
  const modal = page.locator('#modal-shape');
  await expect(modal).toHaveAttribute('open', '');
  await expect(page.locator('#shape-modal-geo')).toBeVisible();
  await expect(page.locator('#shape-modal-x')).toHaveValue('150');

  await page.locator('#shape-modal-w').fill('300');
  await page.locator('#shape-modal-w').blur();
  const field = name => expect.poll(async () => {
    const [el] = await readAutosave(page);
    return el && Math.round(el[name]);
  });
  await field('w').toBe(300);
  // El campo del panel dice lo mismo: un solo cuerpo para los cinco juegos.
  await page.locator('#modal-shape .modal__cancel').click();
  await expect(page.locator('#el-w')).toHaveValue('300');
});

// Auditoría v2.10.1: en navegador, clicar otro elemento dispara PRIMERO el
// mousedown (que cambia la selección) y DESPUÉS el blur→change del campo de
// medida. Sin el guard de identidad, el ancho tecleado para A se aplicaba al
// B recién seleccionado. Este orden de eventos es exactamente lo que el arnés
// vm no simula (acciones por defecto), así que la guarda vive aquí.
test('un ancho tecleado y sin confirmar no se aplica al elemento que se clica después', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'rect');
  await drag(page, 100, 100, 200, 160);
  await drag(page, 300, 300, 400, 360);
  await selectTool(page, 'select');
  await clickCanvas(page, 150, 130);            // selecciona A
  await expect(page.locator('#el-w')).toHaveValue('100');

  await page.locator('#el-w').fill('500');      // teclea… sin blur
  await clickCanvas(page, 350, 330);            // clic directo en B
  await settle(page);

  const widths = () => expect.poll(async () => {
    const els = await readAutosave(page);
    return els.map(el => Math.round(el.w)).join(',');
  });
  await widths().toBe('100,100');               // ni A cambió ni B heredó el 500
  await expect(page.locator('#el-w')).toHaveValue('100', 'los campos hablan ya de B');
});

test('el cajón estrecho sigue dando zoom, cuadrícula y «Limpiar todo»', async ({ page }) => {
  // El motivo de acortar el panel: por debajo de 1100px es un cajón, y cada
  // control de más se paga en scroll. Lo que queda tiene que seguir alcanzable.
  await openApp(page, { viewport: { width: 900, height: 800 } });
  await page.locator('#btn-panel-toggle').click();
  await expect(page.locator('.app--panel-open')).toHaveCount(1);

  await expect(page.locator('#zoom-slider')).toBeVisible();
  await expect(page.locator('#check-grid')).toBeVisible();
  await expect(page.locator('#el-count')).toBeVisible();
  await expect(page.locator('#btn-clear')).toBeVisible();
  // Y lo que no aplica al lápiz no ocupa sitio ahí dentro.
  await expect(page.locator('#panel-sec-build')).toBeHidden();
  await expect(page.locator('#panel-sec-garden')).toBeHidden();
});

test('«Etiquetas» del modal del jardín y la del panel son la misma casilla', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'arbol');
  const modalBox = page.locator('#tree-garden-labels');
  await expect(modalBox).toBeChecked();

  await modalBox.uncheck();
  await page.locator('#modal-tree .modal__cancel').click();
  await settle(page);
  await expect(page.locator('#check-garden-labels')).not.toBeChecked();

  // Con las etiquetas apagadas el modo de etiqueta no rotula nada: se deshabilita.
  await selectTool(page, 'arbol');
  await expect(page.locator('#tree-plant-label-mode')).toBeDisabled();
});
