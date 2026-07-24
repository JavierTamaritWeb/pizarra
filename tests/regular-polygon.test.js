'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { load, createCtxStub } = require('./helpers/load.js');

const ctx = load('js/sketchy.js', 'js/renderer.js', 'js/exporter.js');
const { RegularPolygon, Renderer, Exporter } = ctx;
const base = { x: 20, y: 30, w: 100, h: 100, color: '#333344', lineWidth: 2, seed: 4 };

test('RegularPolygon reconoce únicamente los tres tipos nuevos', () => {
  assert.equal(RegularPolygon.isType('triangle'), true);
  assert.equal(RegularPolygon.isType('pentagon'), true);
  assert.equal(RegularPolygon.isType('hexagon'), true);
  assert.equal(RegularPolygon.isType('circle'), false);
});

test('RegularPolygon genera el número correcto de vértices y lados iguales', () => {
  for (const [type, count] of [['triangle', 3], ['pentagon', 5], ['hexagon', 6]]) {
    const vertices = RegularPolygon.vertices({ ...base, type });
    assert.equal(vertices.length, count);
    const lengths = vertices.map((p, i) => {
      const q = vertices[(i + 1) % vertices.length];
      return Math.hypot(q.x - p.x, q.y - p.y);
    });
    lengths.forEach(length => assert.ok(Math.abs(length - lengths[0]) < 1e-9));
    assert.ok(Math.abs(vertices[0].x - 70) < 1e-9, 'primer vértice centrado arriba');
    assert.ok(Math.abs(vertices[0].y - 30) < 1e-9);
  }
});

test('RegularPolygon.fromCenter produce siempre un bbox cuadrado', () => {
  const box = RegularPolygon.fromCenter({ x: 50, y: 60 }, { x: 80, y: 100 });
  assert.equal(box.w, 100);
  assert.equal(box.h, 100);
  assert.equal(box.x, 0);
  assert.equal(box.y, 10);
});

test('RegularPolygon.contains usa la silueta real y no todo el bbox', () => {
  const triangle = { ...base, type: 'triangle' };
  assert.equal(RegularPolygon.contains({ x: 70, y: 70 }, triangle), true);
  assert.equal(RegularPolygon.contains({ x: 22, y: 32 }, triangle), false);
});

test('Renderer dibuja 3/5/6 lados y aplica relleno cuando corresponde', () => {
  for (const [type, count] of [['triangle', 3], ['pentagon', 5], ['hexagon', 6]]) {
    const canvas = createCtxStub();
    Renderer.renderElement(canvas, { ...base, type, fill: true, fillColor: '#e94560' });
    assert.equal(canvas.callsTo('stroke').length, count);
    assert.equal(canvas.callsTo('fill').length, 1);
    assert.equal(canvas.callsTo('closePath').length, 1);
  }
});

test('El solapamiento reconoce interior y contorno de polígonos regulares', () => {
  const triangle = { ...base, type: 'triangle', fill: true };
  const cover = { ...base, type: 'hexagon', x: 55, y: 45, w: 80, h: 80, fill: true };
  assert.equal(Renderer.isOverlapShape(triangle), true);
  assert.equal(Renderer.pointInOverlapShape({ x: 70, y: 70 }, triangle), true);
  assert.equal(Renderer.pointInOverlapShape({ x: 22, y: 32 }, triangle), false);
  const plan = Renderer.buildOverlapPlan([triangle, cover]);
  assert.ok(plan[0].targets.some(target => target === 1));
});

test('Exporter valida polígonos cuadrados y rechaza deformados', () => {
  const triangle = { ...base, type: 'triangle' };
  assert.equal(Exporter.isValidElement(triangle), true);
  assert.equal(Exporter.isValidElement({ ...triangle, rotation: 36 }), true);
  assert.equal(Exporter.isValidElement({ ...triangle, rotation: -1 }), false);
  assert.equal(Exporter.isValidElement({ ...triangle, rotation: 360 }), false);
  assert.equal(Exporter.isValidElement({ ...triangle, h: 80 }), false);
  assert.equal(Exporter.isValidElement({ ...triangle, w: 0 }), false);
});

test('SVG y HTML exportan los polígonos como elementos vectoriales', () => {
  const elements = [
    { ...base, type: 'triangle' },
    { ...base, type: 'pentagon', x: 150 },
    { ...base, type: 'hexagon', x: 280 },
  ];
  Exporter.svg(elements);
  const svg = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  assert.equal((svg.match(/<polygon /g) || []).length, 3);

  Exporter.html(elements);
  const html = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  assert.equal((html.match(/<polygon /g) || []).length, 3);
});

test('JSON conserva el tipo, la orientación y las dimensiones regulares', async () => {
  const polygon = {
    ...base,
    type: 'hexagon',
    fill: true,
    fillTransparent: true,
    fillOpacity: 0.4,
    rotation: 30,
  };
  Exporter.json([polygon]);
  const json = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  const promise = Exporter.importJSON();
  const input = ctx.document.created[ctx.document.created.length - 1];
  input.onchange({ target: { files: [{ text: json }] } });
  const imported = await promise;
  assert.equal(imported[0].type, 'hexagon');
  assert.equal(imported[0].w, imported[0].h);
  assert.equal(imported[0].fillOpacity, 0.4);
  assert.equal(imported[0].rotation, 30);
});
