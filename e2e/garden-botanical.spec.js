'use strict';

const { test, expect } = require('@playwright/test');
const { openApp, elements, readAutosave, selectTool, clickCanvas } = require('./helpers.js');

const canvasHash = locator => locator.evaluate(canvas => {
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let hash = 2166136261;
  for (let i = 0; i < data.length; i += 17) hash = Math.imul(hash ^ data[i], 16777619);
  return hash >>> 0;
});

const canvasInkBox = locator => locator.evaluate(canvas => {
  const ctx = canvas.getContext('2d');
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bg = [image.data[0], image.data[1], image.data[2]];
  let x1 = canvas.width, y1 = canvas.height, x2 = -1, y2 = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const diff = Math.abs(image.data[i] - bg[0]) +
        Math.abs(image.data[i + 1] - bg[1]) + Math.abs(image.data[i + 2] - bg[2]);
      if (diff <= 35) continue;
      x1 = Math.min(x1, x); y1 = Math.min(y1, y);
      x2 = Math.max(x2, x); y2 = Math.max(y2, y);
    }
  }
  return { w: x2 - x1 + 1, h: y2 - y1 + 1 };
});

test('el icono del ciprés conserva su silueta fastigiada en llama', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'arbol');
  await page.locator('#tree-plant-view').selectOption('elevation');
  const cypress = await canvasInkBox(
    page.locator('#tree-catalog .modal__tree[data-tree="cypress"] canvas'));
  const holmOak = await canvasInkBox(
    page.locator('#tree-catalog .modal__tree[data-tree="broadleaf"] canvas'));
  expect(cypress.h / cypress.w).toBeGreaterThan(3);
  expect(holmOak.w).toBeGreaterThan(cypress.w * 3);
});

test('Jardín botánico: planta/alzado, escala, especies y persistencia', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openApp(page);

  await selectTool(page, 'arbol');
  const modal = page.locator('#modal-tree');
  await expect(modal).toBeVisible();
  await expect(page.locator('#tree-catalog .modal__tree')).toHaveCount(14);
  await expect(page.locator('#tree-catalog .modal__shape-note--botanical')).toHaveCount(14);
  await expect(page.locator('#tree-plant-view')).toHaveValue('plan');
  await expect(page.locator('#tree-plant-stage')).toHaveValue('adult');
  await expect(page.locator('#tree-plant-scale')).toHaveValue('100');
  await expect(page.locator('#tree-plant-px')).toHaveValue('20');
  await expect(page.locator('#tree-plant-natural')).toBeChecked();
  await expect(page.locator('#tree-plant-dimensions')).toContainText('Encina');
  await expect(page.locator('#tree-plant-dimensions')).toContainText('Quercus ilex');

  const planHash = await canvasHash(page.locator('#modal-tree .modal__plant-preview'));
  await page.locator('#tree-plant-view').selectOption('elevation');
  const elevationHash = await canvasHash(page.locator('#modal-tree .modal__plant-preview'));
  expect(elevationHash).not.toBe(planHash);

  await page.locator('#tree-plant-stage').selectOption('developing');
  await page.locator('#tree-plant-scale').fill('75');
  await page.locator('#tree-plant-scale').dispatchEvent('input');
  await page.locator('#tree-plant-px').fill('24');
  await page.locator('#tree-plant-px').dispatchEvent('input');
  await page.locator('#tree-plant-label-mode').selectOption('botanical');
  await page.locator('#tree-catalog .modal__tree[data-tree="olive"]').hover();
  await expect(page.locator('#tree-plant-dimensions')).toContainText('Olea europaea');
  await page.locator('#tree-catalog .modal__tree[data-tree="olive"]').click();
  await expect(modal).not.toBeVisible();

  await clickCanvas(page, 260, 140);
  const drawn = await elements(page);
  expect(drawn.length).toBeGreaterThan(10);
  expect(drawn.some(el => el.type === 'line' && el.y1 === el.y2)).toBe(true);
  expect(drawn.some(el => el.fill && el.fillTransparent)).toBe(true);
  expect(drawn.find(el => el.type === 'text').value).toContain('Olea europaea');
  expect(drawn.every(el => el.gardenMeta && el.gardenMeta.variant === 'olive')).toBe(true);

  await selectTool(page, 'select');
  // En alzado el punto de inserción es la esquina superior de la envolvente;
  // se pulsa el centro visible de la copa, no el ancla vacía.
  await clickCanvas(page, 310, 160);
  await expect(page.locator('#btn-edit-garden')).toBeVisible();
  await page.locator('#btn-edit-garden').click();
  await expect(modal).toBeVisible();
  await expect(page.locator('#tree-plant-view')).toHaveValue('elevation');
  await page.locator('#tree-plant-scale').fill('125');
  await page.locator('#tree-plant-scale').dispatchEvent('input');
  await page.locator('#tree-catalog .modal__tree[data-tree="cypress"]').click();
  // La edición puede conservar el mismo número de primitivas; en ese caso el
  // contador no distingue el autosave viejo del nuevo y se espera la ficha.
  await expect.poll(async () => {
    const saved = await readAutosave(page);
    return saved.length > 0 && saved.every(el => el.gardenMeta?.variant === 'cypress');
  }).toBe(true);
  const edited = await elements(page);
  expect(edited.every(el => el.gardenMeta && el.gardenMeta.variant === 'cypress')).toBe(true);
  expect(edited.every(el => el.gardenMeta.plantScalePct === 125)).toBe(true);
  expect(edited.find(el => el.type === 'text').value).toContain('Cupressus sempervirens');

  await page.reload();
  await selectTool(page, 'arbol');
  await expect(page.locator('#tree-plant-view')).toHaveValue('elevation');
  await expect(page.locator('#tree-plant-stage')).toHaveValue('developing');
  await expect(page.locator('#tree-plant-scale')).toHaveValue('125');
  await expect(page.locator('#tree-plant-px')).toHaveValue('24');
  await expect(page.locator('#tree-catalog .modal__tree[data-tree="cypress"]'))
    .toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('Arbusto y Flor muestran el repertorio mediterráneo sin especies tóxicas descartadas', async ({ page }) => {
  await openApp(page);
  await selectTool(page, 'arbusto');
  const shrubs = page.locator('#shrub-catalog');
  await expect(shrubs).toContainText('Romero arbustivo');
  await expect(shrubs).toContainText('Olivo recortado');
  await expect(shrubs).not.toContainText(/Baladre|Adelfa|Boj|Durillo|Laurel/i);
  await shrubs.locator('.modal__shrub[data-shrub="bush"]').click();

  await selectTool(page, 'flor');
  const flowers = page.locator('#flower-catalog');
  await expect(flowers).toContainText('Caléndula');
  await expect(flowers).toContainText('Estátice mediterráneo');
  await expect(flowers).toContainText('Boca de dragón');
  await expect(flowers).not.toContainText(/Amapola|Iris|Gladiolo|Baladre|Adelfa/i);
});

test('Trepadoras ofrece seis especies y el modal botánico cabe en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openApp(page);
  await selectTool(page, 'trepadora');
  const modal = page.locator('#modal-climber');
  await expect(modal).toBeVisible();
  await expect(page.locator('#climber-catalog .modal__climber')).toHaveCount(6);
  const box = await modal.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(740);
  await expect(page.locator('#climber-plant-view')).toBeVisible();
  await expect(page.locator('#climber-plant-scale')).toBeVisible();
  await page.locator('#climber-plant-view').selectOption('elevation');
  await page.locator('#climber-catalog .modal__climber[data-climber="wisteria"]').click();
  // La comprobación móvil termina aquí; se amplía el viewport para dibujar
  // sobre una zona visible del lienzo sin que el scroll del toolbar intervenga.
  await page.setViewportSize({ width: 1440, height: 900 });
  await clickCanvas(page, 160, 120);
  const drawn = await elements(page);
  expect(drawn.find(el => el.type === 'text').value).toContain('Glicinia');
});

test('los controles botánicos no se cortan en anchos intermedios', async ({ page }) => {
  const auditControls = async () => page.locator('#modal-tree').evaluate(modal => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const clipped = [];
    for (const select of modal.querySelectorAll('.modal__plant-fields select')) {
      const style = getComputedStyle(select);
      ctx.font = style.font;
      // 30px reservan la flecha nativa además del padding declarado.
      const needed = ctx.measureText(select.selectedOptions[0].text).width +
        parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 30;
      if (needed > select.clientWidth + 1) {
        clipped.push(`${select.id}: necesita ${Math.ceil(needed)}, tiene ${select.clientWidth}`);
      }
    }
    return {
      clipped,
      modalOverflow: modal.scrollWidth > modal.clientWidth + 1,
      fieldsOverflow: [...modal.querySelectorAll('.modal__plant-fields')]
        .some(el => el.scrollWidth > el.clientWidth + 1),
    };
  });

  await openApp(page, { viewport: { width: 460, height: 760 } });
  await selectTool(page, 'arbol');
  await page.locator('#tree-plant-view').selectOption('elevation');
  await expect(page.locator('#tree-plant-stage')).toHaveValue('adult');
  await expect(page.locator('#tree-plant-label-mode')).toHaveValue('dimensions');
  await expect.poll(() => page.locator('#modal-tree .modal__plant-fields')
    .evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);
  expect(await auditControls(), '460px: ficha en una columna').toEqual({
    clipped: [], modalOverflow: false, fieldsOverflow: false,
  });

  await page.setViewportSize({ width: 720, height: 800 });
  await expect.poll(() => page.locator('#modal-tree .modal__plant-build')
    .evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
  expect(await auditControls(), '720px: ficha amplia en dos columnas').toEqual({
    clipped: [], modalOverflow: false, fieldsOverflow: false,
  });
});
