'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, getGlobal } = require('./helpers/load.js');

function rotationContext(...extra) {
  const ctx = load('js/shape-rotation.js', ...extra);
  return {
    ctx,
    ShapeRotation: getGlobal(ctx, 'ShapeRotation'),
  };
}

test('ShapeRotation asigna los pasos solicitados a cada forma', () => {
  const { ShapeRotation } = rotationContext();
  assert.equal(ShapeRotation.step('hexagon'), 30);
  assert.equal(ShapeRotation.step('rect'), 90);
  assert.equal(ShapeRotation.step('roundedRect'), 90);
  assert.equal(ShapeRotation.step('triangle'), 90);
  assert.equal(ShapeRotation.step('pentagon'), 36);
  assert.equal(ShapeRotation.step('circle'), 0);
});

test('ShapeRotation gira rectángulos 90° alrededor de su centro', () => {
  const { ShapeRotation } = rotationContext();
  const original = { type: 'rect', x: 10, y: 20, w: 80, h: 40, color: '#000000' };
  const rotated = ShapeRotation.rotateElement(original);
  assert.deepEqual(
    { x: rotated.x, y: rotated.y, w: rotated.w, h: rotated.h },
    { x: 30, y: 0, w: 40, h: 80 }
  );
  assert.deepEqual(original, { type: 'rect', x: 10, y: 20, w: 80, h: 40, color: '#000000' });
});

test('ShapeRotation aplica también el cuarto de vuelta a rectángulos redondeados', () => {
  const { ShapeRotation } = rotationContext();
  const rotated = ShapeRotation.rotateElement({ type: 'roundedRect', x: 0, y: 0, w: 30, h: 70 });
  assert.deepEqual(
    { x: rotated.x, y: rotated.y, w: rotated.w, h: rotated.h },
    { x: -20, y: 20, w: 70, h: 30 }
  );
});

test('ShapeRotation acumula pentágonos de 36° y normaliza la vuelta completa', () => {
  const { ShapeRotation } = rotationContext();
  let el = { type: 'pentagon', x: 0, y: 0, w: 100, h: 100 };
  el = ShapeRotation.rotateElement(el);
  assert.equal(el.rotation, 36);
  for (let i = 0; i < 9; i++) el = ShapeRotation.rotateElement(el);
  assert.equal(el.rotation, undefined);
});

test('ShapeRotation acumula polígonos y no modifica tipos incompatibles', () => {
  const { ShapeRotation } = rotationContext();
  let hexagon = { type: 'hexagon', x: 0, y: 0, w: 100, h: 100 };
  for (let i = 0; i < 11; i++) hexagon = ShapeRotation.rotateElement(hexagon);
  assert.equal(hexagon.rotation, 330);
  hexagon = ShapeRotation.rotateElement(hexagon);
  assert.equal(hexagon.rotation, undefined);

  let triangle = { type: 'triangle', x: 0, y: 0, w: 100, h: 100 };
  triangle = ShapeRotation.rotateElement(triangle);
  assert.equal(triangle.rotation, 90);
  for (let i = 0; i < 3; i++) triangle = ShapeRotation.rotateElement(triangle);
  assert.equal(triangle.rotation, undefined);

  const circle = { type: 'circle', x: 0, y: 0, w: 100, h: 100 };
  assert.equal(ShapeRotation.rotateElement(circle), circle);
});

test('RegularPolygon aplica la orientación guardada sin deformar los lados', () => {
  const { ctx } = rotationContext('js/regular-polygon.js');
  const RegularPolygon = getGlobal(ctx, 'RegularPolygon');
  const base = RegularPolygon.vertices({ type: 'pentagon', x: 0, y: 0, w: 100, h: 100 });
  const rotated = RegularPolygon.vertices({
    type: 'pentagon', x: 0, y: 0, w: 100, h: 100, rotation: 36,
  });
  assert.notDeepEqual([...rotated], [...base]);
  const lengths = rotated.map((point, index) => {
    const next = rotated[(index + 1) % rotated.length];
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
  lengths.forEach(length => assert.ok(Math.abs(length - lengths[0]) < 1e-9));
});
