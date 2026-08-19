// Manipulación (v3.8.0): menú contextual del clic derecho, candado de
// elementos y Alt+arrastre que duplica. En e2e porque son visibilidad real,
// posicionamiento de un flotante y modificadores del sistema.
const { test, expect } = require('@playwright/test');
const {
  NARROW, openApp, settle, selectTool, drag, elements, canvasPoint,
} = require('./helpers');

async function drawRect(page) {
  await selectTool(page, 'rect');
  await drag(page, 300, 200, 460, 320);
  await selectTool(page, 'select');
}

test('el clic derecho sobre un elemento abre el menú y Duplicar duplica', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await drawRect(page);
  const c = await canvasPoint(page, 380, 260);
  await page.mouse.click(c.x, c.y, { button: 'right' });

  const menu = page.locator('#context-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('.ctxmenu__item')).toHaveCount(12);
  await menu.locator('.ctxmenu__item', { hasText: 'Duplicar' }).click();
  await settle(page);
  await expect(menu).toBeHidden();
  expect(await elements(page)).toHaveLength(2);
});

test('Escape cierra el menú del lienzo vacío sin tocar nada', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  const c = await canvasPoint(page, 600, 400);
  await page.mouse.click(c.x, c.y, { button: 'right' });
  const menu = page.locator('#context-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('.ctxmenu__item', { hasText: 'Seleccionar todo' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('bloquear protege del clic y del borrador; el clic derecho es la llave', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await drawRect(page);
  const c = await canvasPoint(page, 380, 260);

  // Bloquear desde el menú contextual.
  await page.mouse.click(c.x, c.y, { button: 'right' });
  await page.locator('#context-menu .ctxmenu__item', { hasText: 'Bloquear' }).click();
  await settle(page);

  // El clic ya no lo selecciona (Supr no actúa) y el borrador no lo borra.
  await page.mouse.click(c.x, c.y);
  await page.keyboard.press('Delete');
  await settle(page);
  expect(await elements(page)).toHaveLength(1);
  await selectTool(page, 'eraser');
  await drag(page, 290, 260, 470, 260);
  expect(await elements(page)).toHaveLength(1);

  // Clic derecho sobre el bloqueado: «Desbloquear», y vuelve a estar vivo.
  await page.mouse.click(c.x, c.y, { button: 'right' });
  await page.locator('#context-menu .ctxmenu__item', { hasText: 'Desbloquear' }).click();
  await settle(page);
  await page.keyboard.press('Delete'); // desbloquear lo deja seleccionado
  await settle(page);
  expect(await elements(page)).toHaveLength(0);
});

test('Alt+arrastre sobre la selección se lleva una copia', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await drawRect(page);
  const c = await canvasPoint(page, 380, 260);
  await page.mouse.click(c.x, c.y);
  await settle(page);

  await page.keyboard.down('Alt');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 120, c.y + 60, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  await settle(page);

  const els = await elements(page);
  expect(els).toHaveLength(2);
  expect(els[0].x).toBe(300);            // el original, quieto
  expect(els[1].x).toBeGreaterThan(350); // la copia, donde el puntero
});
