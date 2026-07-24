'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { load, createCtxStub } = require('./helpers/load.js');

const ctx = load('js/sketchy.js', 'js/renderer.js', 'js/exporter.js');
const { Trapezoid, Renderer, Exporter } = ctx;
const base = {
  type: 'trapezoid',
  x: 20,
  y: 30,
  w: 120,
  h: 60,
  color: '#333344',
  lineWidth: 2,
  seed: 7,
};

test('Trapezoid genera cuatro vértices, bases paralelas y superior más corta', () => {
  const vertices = Trapezoid.vertices(base);
  assert.equal(vertices.length, 4);
  assert.equal(vertices[0].y, vertices[1].y);
  assert.equal(vertices[2].y, vertices[3].y);
  const top = vertices[1].x - vertices[0].x;
  const bottom = vertices[2].x - vertices[3].x;
  assert.ok(top < bottom);
  assert.equal(top, 72);
  assert.equal(bottom, 120);
});

test('Trapezoid conserva la silueta y el centro al girar 90°', () => {
  const rotated = { ...base, x: 50, y: 0, w: 60, h: 120, rotation: 90 };
  const vertices = Trapezoid.vertices(rotated);
  const xs = vertices.map(point => point.x);
  const ys = vertices.map(point => point.y);
  assert.ok(Math.abs(Math.min(...xs) - 50) < 1e-9);
  assert.ok(Math.abs(Math.max(...xs) - 110) < 1e-9);
  assert.ok(Math.abs(Math.min(...ys) - 0) < 1e-9);
  assert.ok(Math.abs(Math.max(...ys) - 120) < 1e-9);
});

test('Trapezoid.contains usa la silueta real y no todo el rectángulo', () => {
  assert.equal(Trapezoid.contains({ x: 80, y: 60 }, base), true);
  assert.equal(Trapezoid.contains({ x: 21, y: 31 }, base), false);
});

test('Renderer dibuja, rellena y reconoce el trapecio para solapamientos', () => {
  const canvas = createCtxStub();
  Renderer.renderElement(canvas, { ...base, fill: true, fillColor: '#e94560' });
  assert.equal(canvas.callsTo('stroke').length, 4);
  assert.equal(canvas.callsTo('fill').length, 1);
  assert.equal(canvas.callsTo('closePath').length, 1);
  assert.equal(Renderer.isOverlapShape(base), true);
  assert.equal(Renderer.pointInOverlapShape({ x: 80, y: 60 }, base), true);
  assert.equal(Renderer.pointInOverlapShape({ x: 21, y: 31 }, base), false);
});

test('Exporter valida y conserva el trapecio en SVG, HTML y JSON', async () => {
  assert.equal(Exporter.isValidElement(base), true);
  assert.equal(Exporter.isValidElement({ ...base, rotation: 90 }), true);
  assert.equal(Exporter.isValidElement({ ...base, rotation: 45 }), false);
  assert.equal(Exporter.isValidElement({ ...base, w: 0 }), false);

  Exporter.svg([base]);
  const svg = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  assert.equal((svg.match(/<polygon /g) || []).length, 1);

  Exporter.html([base]);
  const html = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  assert.equal((html.match(/<polygon /g) || []).length, 1);

  Exporter.json([{ ...base, rotation: 90 }]);
  const json = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  const promise = Exporter.importJSON();
  const input = ctx.document.created[ctx.document.created.length - 1];
  input.onchange({ target: { files: [{ text: json }] } });
  const imported = await promise;
  assert.equal(imported[0].type, 'trapezoid');
  assert.equal(imported[0].rotation, 90);
  assert.equal(imported[0].w, 120);
  assert.equal(imported[0].h, 60);
});
