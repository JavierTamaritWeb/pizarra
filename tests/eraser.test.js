'use strict';
/* ============================================================
   eraser.test.js — Geometría pura del borrador (js/eraser.js).
   Ejecutar: node --test tests/eraser.test.js
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll } = require('./helpers/load.js');

const ctx = loadAll();
const { Eraser, CurvePath, RegularPolygon, Trapezoid, TOOLS } = ctx;

const DEPS = {
  sampleCurve: (el, n) => CurvePath.sample(el, n),
  polygonVertices: el => (RegularPolygon.isType(el.type) ? RegularPolygon.vertices(el) : null),
  trapezoidVertices: el => (el.type === TOOLS.TRAPEZOID ? Trapezoid.vertices(el) : null),
};
const stroke = (...xy) => xy.map(([x, y]) => ({ x, y }));
const rect = (x, y, w, h) => ({ type: 'rect', x, y, w, h, color: '#000000', lineWidth: 2 });

test('Eraser expone su API', () => {
  assert.equal(typeof Eraser.touches, 'function');
  assert.equal(typeof Eraser.doomedIndices, 'function');
  assert.equal(typeof Eraser.apply, 'function');
});

test('segDist: 0 si los segmentos se cruzan, distancia real si no', () => {
  const a1 = { x: 0, y: 0 }, a2 = { x: 10, y: 0 };
  assert.equal(Eraser.segDist(a1, a2, { x: 5, y: -5 }, { x: 5, y: 5 }), 0, 'en cruz → 0');
  assert.equal(Eraser.segDist(a1, a2, { x: 0, y: 4 }, { x: 10, y: 4 }), 4, 'paralelos → separación');
});

test('un trazo que cruza una forma la marca; uno lejano no', () => {
  const r = rect(100, 100, 100, 100);
  assert.equal(Eraser.touches(r, stroke([90, 150], [210, 150]), 8, DEPS), true, 'la atraviesa');
  assert.equal(Eraser.touches(r, stroke([300, 150], [400, 150]), 8, DEPS), false, 'pasa lejos');
});

test('el radio del borrador amplía el alcance', () => {
  const r = rect(100, 100, 100, 100);
  const rozando = stroke([100, 90], [200, 90]);   // 10px por encima del borde
  assert.equal(Eraser.touches(r, rozando, 2, DEPS), false, 'con radio 2 no llega');
  assert.equal(Eraser.touches(r, rozando, 12, DEPS), true, 'con radio 12 sí');
});

test('un solo punto (clic sin arrastrar) también borra', () => {
  const r = rect(100, 100, 100, 100);
  assert.equal(Eraser.touches(r, stroke([150, 150]), 8, DEPS), true, 'clic dentro');
  assert.equal(Eraser.touches(r, stroke([400, 400]), 8, DEPS), false, 'clic fuera');
});

test('líneas: usa la distancia al segmento, no su caja', () => {
  const diag = { type: 'line', x1: 0, y1: 0, x2: 200, y2: 200, color: '#000000', lineWidth: 2 };
  // (190, 10) está dentro de la caja de la diagonal pero lejísimos del trazo
  assert.equal(Eraser.touches(diag, stroke([185, 5], [195, 15]), 6, DEPS), false,
    'dentro de la caja pero lejos del trazo → no borra');
  assert.equal(Eraser.touches(diag, stroke([95, 105], [105, 95]), 6, DEPS), true,
    'sobre el trazo → borra');
});

test('trazos de lápiz: se comparan sus puntos', () => {
  const pencil = {
    type: 'pencil', color: '#000000', lineWidth: 2,
    points: stroke([10, 10], [20, 20], [30, 10]),
  };
  assert.equal(Eraser.touches(pencil, stroke([20, 0], [20, 40]), 3, DEPS), true);
  assert.equal(Eraser.touches(pencil, stroke([200, 0], [200, 40]), 3, DEPS), false);
});

test('polígonos regulares: usa la silueta real', () => {
  const tri = { type: 'triangle', x: 0, y: 0, w: 100, h: 100, color: '#000000', lineWidth: 2, rotation: 0 };
  assert.equal(Eraser.touches(tri, stroke([50, 50]), 4, DEPS), true, 'dentro del triángulo');
});

test('curvas: se muestrean en vez de usar los extremos', () => {
  const curve = {
    type: 'curveArrow', x1: 0, y1: 0, x2: 200, y2: 0, cx: 100, cy: 200,
    color: '#000000', lineWidth: 2,
  };
  assert.equal(Eraser.touches(curve, stroke([100, 95], [100, 105]), 8, DEPS), true,
    'la comba pasa por el centro, lejos de la cuerda');
});

test('doomedIndices devuelve los índices tocados, en orden', () => {
  const els = [rect(0, 0, 50, 50), rect(100, 0, 50, 50), rect(200, 0, 50, 50)];
  const idx = Eraser.doomedIndices(els, stroke([-10, 25], [130, 25]), 4, DEPS);
  assert.deepEqual([...idx], [0, 1], 'solo los dos primeros');
});

test('apply devuelve un array NUEVO sin los tocados y no muta la entrada', () => {
  const els = [rect(0, 0, 50, 50), rect(200, 0, 50, 50)];
  const out = Eraser.apply(els, stroke([-10, 25], [60, 25]), 4, DEPS);
  assert.equal(els.length, 2, 'la entrada no se muta');
  assert.equal(out.length, 1);
  assert.equal(out[0].x, 200, 'sobrevive el lejano');
  assert.notEqual(out, els);
});

test('apply sin tocar nada devuelve la misma referencia (sin repintado inútil)', () => {
  const els = [rect(0, 0, 50, 50)];
  assert.equal(Eraser.apply(els, stroke([500, 500], [600, 600]), 4, DEPS), els);
});

// Los `eraser` heredados son máscaras de proyectos antiguos: borrarlas haría
// reaparecer justo lo que ocultan, que es el fallo que este cambio corrige.
test('las máscaras heredadas no se borran con el borrador nuevo', () => {
  const els = [
    rect(100, 100, 100, 100),
    { type: 'eraser', points: stroke([90, 150], [210, 150]), color: '#000000', lineWidth: 2, size: 16 },
  ];
  const idx = Eraser.doomedIndices(els, stroke([90, 150], [210, 150]), 8, DEPS);
  assert.deepEqual([...idx], [0], 'elimina el rect, conserva la máscara');
});

test('sin deps se degrada a la caja del elemento (no lanza)', () => {
  const r = rect(100, 100, 100, 100);
  assert.equal(Eraser.touches(r, stroke([150, 150]), 4), true);
  assert.equal(Eraser.touches({ type: 'curveArrow', x1: 0, y1: 0, x2: 10, y2: 0 }, stroke([5, 0]), 4), true);
});
