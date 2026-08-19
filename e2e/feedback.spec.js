// Feedback y descubribilidad (v3.6.0): hover-highlight, cotas en vivo,
// toasts, undo/redo honestos y el estado vacío. Todo vive en e2e porque son
// píxeles del overlay, visibilidad real y eventos de portapapeles/teclado del
// navegador — justo lo que el arnés node:vm no ve.
const { test, expect } = require('@playwright/test');
const {
  NARROW, openApp, settle, selectTool, drag, canvasPoint,
} = require('./helpers');

// Píxeles no transparentes del canvas de OVERLAY (donde viven el hover, las
// cotas y las guías). `rgb` opcional acota al color exacto de la pastilla.
const overlayPixels = (page, rgb) => page.evaluate(sel => {
  const c = document.getElementById('overlay-canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    if (sel && (d[i] !== sel[0] || d[i + 1] !== sel[1] || d[i + 2] !== sel[2])) continue;
    n++;
  }
  return n;
}, rgb || null);

test('con Mover, el elemento bajo el puntero se resalta antes del clic', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await selectTool(page, 'rect');
  await drag(page, 300, 200, 500, 350);
  await selectTool(page, 'select');

  // Sobre el rectángulo: aparece el marco de hover en el overlay.
  const over = await canvasPoint(page, 400, 275);
  await page.mouse.move(over.x, over.y);
  await expect.poll(() => overlayPixels(page)).toBeGreaterThan(50);

  // Sobre el vacío: el overlay vuelve a quedar limpio.
  const empty = await canvasPoint(page, 900, 600);
  await page.mouse.move(empty.x, empty.y);
  await expect.poll(() => overlayPixels(page)).toBe(0);
});

test('al arrastrar una selección aparece la cota X, Y junto al puntero', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await selectTool(page, 'rect');
  await drag(page, 300, 200, 500, 350);
  await selectTool(page, 'select');
  const c = await canvasPoint(page, 400, 275);
  await page.mouse.click(c.x, c.y);
  await settle(page);

  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 60, c.y + 40);
  // La pastilla es el relleno turquesa exacto de drawBadge (#4ecdc4).
  await expect.poll(() => overlayPixels(page, [78, 205, 196])).toBeGreaterThan(100);
  await page.mouse.up();
  await settle(page);
  // Al soltar, el overlay se limpia: la cota no se queda colgada.
  await expect.poll(() => overlayPixels(page, [78, 205, 196])).toBe(0);
});

test('crear una forma enseña su ancho × alto en vivo', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await selectTool(page, 'rect');
  const from = await canvasPoint(page, 200, 150);
  const to = await canvasPoint(page, 420, 300);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await expect.poll(() => overlayPixels(page, [78, 205, 196])).toBeGreaterThan(100);
  await page.mouse.up();
  await settle(page);
});

test('copiar y duplicar avisan con un toast que se autodescarta', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await selectTool(page, 'rect');
  await drag(page, 300, 200, 450, 300);
  await page.keyboard.press('Control+KeyA');
  await settle(page);

  // Ctrl+C sintético no despacha el evento `copy` en headless sin una
  // selección de TEXTO del documento; execCommand sí emite el evento real,
  // con clipboardData, que es lo que el handler de la app escucha.
  await page.evaluate(() => document.execCommand('copy'));
  await expect(page.locator('.toast')).toHaveText(/Copiado \(1 elemento\)/i);

  await page.keyboard.press('Control+KeyD');
  await expect(page.locator('.toast').last()).toHaveText(/Duplicado \(1 elemento\)/i);

  // Y desaparecen solos (TOAST_MS = 2200).
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 4000 });
});

test('undo/redo se atenúan con las pilas vacías, y el lienzo vacío da la bienvenida', async ({ page }) => {
  await openApp(page, { viewport: NARROW });
  await expect(page.locator('#btn-undo')).toBeDisabled();
  await expect(page.locator('#btn-redo')).toBeDisabled();
  await expect(page.locator('#canvas-empty')).toBeVisible();

  await selectTool(page, 'rect');
  await drag(page, 300, 200, 450, 300);
  await expect(page.locator('#btn-undo')).toBeEnabled();
  await expect(page.locator('#canvas-empty')).toBeHidden();

  await page.keyboard.press('Control+KeyZ');
  await settle(page);
  await expect(page.locator('#btn-undo')).toBeDisabled();
  await expect(page.locator('#btn-redo')).toBeEnabled();
  await expect(page.locator('#canvas-empty')).toBeVisible();

  // «Limpiar todo» (confirm nativo) también la devuelve.
  await page.keyboard.press('Control+Shift+KeyZ'); // rehacer el rectángulo
  await settle(page);
  page.on('dialog', d => d.accept());
  await page.locator('#btn-clear').click();
  await expect(page.locator('#canvas-empty')).toBeVisible();
});
