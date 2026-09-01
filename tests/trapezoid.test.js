'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { load, createCtxStub } = require('./helpers/load.js');

const ctx = load('src/js/sketchy.js', 'src/js/shape-rotation.js', 'src/js/renderer.js', 'src/js/exporter.js');
const { Trapezoid, Renderer, Exporter, ShapeRotation } = ctx;
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

/* ── Triángulo irregular (v3.19.0): la otra «forma de caja» del módulo ── */

const tri = {
  type: 'freeTriangle',
  x: 20,
  y: 30,
  w: 120,
  h: 60,
  color: '#333344',
  lineWidth: 2,
  seed: 7,
};

test('FreeTriangle: sin `apex` es isósceles — vértice centrado y lados inclinados iguales', () => {
  assert.equal(Trapezoid.isType('freeTriangle'), true);
  assert.equal(Trapezoid.isType('trapezoid'), true);
  assert.equal(Trapezoid.isType('triangle'), false);
  const vertices = Trapezoid.vertices(tri);
  assert.equal(vertices.length, 3);
  // Vértice arriba en el centro, base completa abajo: llena la caja entera.
  assert.deepEqual({ ...vertices[0] }, { x: 80, y: 30 });
  assert.deepEqual({ ...vertices[1] }, { x: 140, y: 90 });
  assert.deepEqual({ ...vertices[2] }, { x: 20, y: 90 });
  const lado = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  assert.equal(lado(vertices[0], vertices[2]), lado(vertices[0], vertices[1]));
});

test('FreeTriangle: `apex` desplaza el vértice y deja los tres lados distintos', () => {
  const vertices = Trapezoid.vertices({ ...tri, apex: 0.25 });
  assert.deepEqual({ ...vertices[0] }, { x: 50, y: 30 });   // 20 + 120·0.25
  const lado = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const lados = [
    lado(vertices[0], vertices[1]),
    lado(vertices[1], vertices[2]),
    lado(vertices[2], vertices[0]),
  ];
  assert.equal(new Set(lados).size, 3, 'escaleno: ningún lado repetido');
});

test('FreeTriangle: un `apex` degenerado o ausente cae al isósceles', () => {
  for (const apex of [0, 1, -2, 7, NaN, 'x', undefined]) {
    assert.equal(Trapezoid.apexRatio({ apex }), 0.5, `apex=${apex}`);
  }
  assert.equal(Trapezoid.apexRatio({ apex: 0.25 }), 0.25);
  assert.deepEqual({ ...Trapezoid.APEX }, { isosceles: 0.5, escaleno: 0.25 });
});

test('FreeTriangle conserva la silueta y el centro al girar 90°, y contains usa la silueta real', () => {
  const girado = ShapeRotation.rotateElement({ ...tri, apex: 0.25 });
  assert.equal(girado.rotation, 90);
  assert.equal(girado.w, tri.h);
  assert.equal(girado.h, tri.w);
  const antes = Trapezoid.vertices({ ...tri, apex: 0.25 });
  const despues = Trapezoid.vertices(girado);
  assert.equal(despues.length, 3);
  // Mismo centro y mismas longitudes de lado: el giro no deforma.
  const lado = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const lados = vs => vs.map((v, i) => lado(v, vs[(i + 1) % vs.length]))
    .map(l => Math.round(l * 1e6) / 1e6).sort((a, b) => a - b);
  assert.deepEqual(lados(despues), lados(antes));
  // Dentro del triángulo sí; en la esquina vacía de la caja, no.
  assert.equal(Trapezoid.contains({ x: 80, y: 80 }, tri), true);
  assert.equal(Trapezoid.contains({ x: 22, y: 32 }, tri), false);
});

test('Renderer dibuja, rellena y reconoce el triángulo irregular para solapamientos', () => {
  const canvas = createCtxStub();
  Renderer.renderElement(canvas, { ...tri, fill: true, fillColor: '#e94560' });
  assert.equal(canvas.callsTo('stroke').length, 3);
  assert.equal(canvas.callsTo('fill').length, 1);
  assert.equal(Renderer.isOverlapShape(tri), true);
  assert.equal(Renderer.pointInOverlapShape({ x: 80, y: 80 }, tri), true);
  assert.equal(Renderer.pointInOverlapShape({ x: 22, y: 32 }, tri), false);
});

test('Exporter valida y conserva el triángulo irregular (con su `apex`) en SVG y JSON', async () => {
  assert.equal(Exporter.isValidElement(tri), true);
  assert.equal(Exporter.isValidElement({ ...tri, apex: 0.25 }), true);
  assert.equal(Exporter.isValidElement({ ...tri, rotation: 90 }), true);
  // apex fuera de (0,1), o en un tipo ajeno: JSON manipulado, se rechaza.
  assert.equal(Exporter.isValidElement({ ...tri, apex: 0 }), false);
  assert.equal(Exporter.isValidElement({ ...tri, apex: 1.2 }), false);
  assert.equal(Exporter.isValidElement({ ...base, apex: 0.25 }), false);
  assert.equal(Exporter.isValidElement({ ...tri, rotation: 45 }), false);

  Exporter.svg([{ ...tri, apex: 0.25 }]);
  const svg = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  assert.equal((svg.match(/<polygon /g) || []).length, 1);

  Exporter.json([{ ...tri, apex: 0.25 }]);
  const json = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  const promise = Exporter.importJSON();
  const input = ctx.document.created[ctx.document.created.length - 1];
  input.onchange({ target: { files: [{ text: json }] } });
  const imported = await promise;
  assert.equal(imported[0].type, 'freeTriangle');
  assert.equal(imported[0].apex, 0.25);
});
