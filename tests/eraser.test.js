'use strict';
/* ============================================================
   eraser.test.js — Geometría pura del borrador (src/js/eraser.js).
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
  assert.equal(Eraser.touches(r, stroke([100, 150]), 8, DEPS), true, 'clic sobre el borde');
  assert.equal(Eraser.touches(r, stroke([400, 400]), 8, DEPS), false, 'clic fuera');
});

// Se borra lo que se VE: barrer por el hueco de una forma vacía no la elimina.
// Con la caja, una pasada por el centro de una fachada se llevaba el muro entero.
test('el interior hueco de una forma sin relleno no se borra; el contorno sí', () => {
  const vacio = rect(100, 100, 200, 200);
  const centro = stroke([140, 200], [260, 200]);   // cruza el interior, sin tocar bordes
  assert.equal(Eraser.touches(vacio, centro, 6, DEPS), false, 'hueco → no borra');
  assert.equal(Eraser.touches(vacio, stroke([90, 200], [110, 200]), 6, DEPS), true,
    'sobre el borde izquierdo → sí borra');
});

test('una forma RELLENA sí se borra por su interior', () => {
  const lleno = { ...rect(100, 100, 200, 200), fill: true };
  assert.equal(Eraser.touches(lleno, stroke([140, 200], [260, 200]), 6, DEPS), true,
    'el relleno es tinta: el interior cuenta');
});

// El interior de una forma rellena es su SILUETA, no su caja: la esquina del
// bbox de un círculo relleno está a ~15px de la tinta más cercana y borrarla
// desde ahí contradecía la regla «se borra lo que se ve». (Auditoría v1.17.0)
test('rellenas: el interior que cuenta es la silueta real, no la caja', () => {
  const circulo = { type: 'circle', x: 0, y: 0, w: 100, h: 100, color: '#000000', lineWidth: 2, fill: true };
  assert.equal(Eraser.touches(circulo, stroke([3, 3]), 6, DEPS), false,
    'esquina del bbox, fuera de la silueta → no borra');
  assert.equal(Eraser.touches(circulo, stroke([50, 50]), 6, DEPS), true,
    'el centro sí es tinta');
  assert.equal(Eraser.touches(circulo, stroke([-20, 50], [120, 50]), 6, DEPS), true,
    'un trazo que atraviesa el interior sin puntos dentro cruza el contorno → borra');

  const tri = { type: 'triangle', x: 0, y: 0, w: 100, h: 100, color: '#000000', lineWidth: 2, fill: true, rotation: 0 };
  assert.equal(Eraser.touches(tri, stroke([3, 3]), 6, DEPS), false,
    'esquina del bbox del triángulo relleno, fuera de la silueta → no borra');
  assert.equal(Eraser.touches(tri, stroke([50, 60]), 6, DEPS), true,
    'su interior real sí');
});

// `[]` es truthy: los vértices vacíos de un polígono degenerado (w=h=0, solo
// alcanzable desde datos externos) cortaban el encadenado de fallbacks y el
// elemento quedaba imborrable — invisible y sin hit-test, solo lo quitaba
// «Limpiar todo». (Auditoría v1.17.0)
test('un polígono degenerado (w=h=0) sigue siendo borrable', () => {
  const punto = { type: 'triangle', x: 40, y: 40, w: 0, h: 0, color: '#000000', lineWidth: 2, rotation: 0 };
  assert.equal(Eraser.touches(punto, stroke([40, 40]), 6, DEPS), true,
    'clic encima con vértices degenerados → cae a la caja y borra');
});

test('círculos vacíos: se usa la elipse, no su caja', () => {
  const c = { type: 'circle', x: 0, y: 0, w: 200, h: 200, color: '#000000', lineWidth: 2 };
  assert.equal(Eraser.touches(c, stroke([100, 100]), 6, DEPS), false, 'centro hueco');
  assert.equal(Eraser.touches(c, stroke([5, 5]), 6, DEPS), false, 'esquina de la caja, fuera del aro');
  assert.equal(Eraser.touches(c, stroke([0, 100]), 6, DEPS), true, 'sobre el aro');
});

test('texto e imágenes sí se borran por su caja (su caja es su dibujo)', () => {
  const img = { type: 'imagePlaceholder', x: 0, y: 0, w: 100, h: 100, color: '#000000', lineWidth: 2 };
  assert.equal(Eraser.touches(img, stroke([50, 50]), 4, DEPS), true);
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

test('polígonos regulares: usa la silueta real, no la caja', () => {
  const tri = { type: 'triangle', x: 0, y: 0, w: 100, h: 100, color: '#000000', lineWidth: 2, rotation: 0 };
  const verts = RegularPolygon.vertices(tri);
  const [a, b] = [verts[0], verts[1]];
  const medio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };   // punto sobre un lado
  assert.equal(Eraser.touches(tri, stroke([medio.x, medio.y]), 4, DEPS), true, 'sobre un lado');
  assert.equal(Eraser.touches(tri, stroke([2, 2]), 4, DEPS), false,
    'esquina de la caja, fuera de la silueta → no borra');
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

test('sin deps se degrada sin lanzar (contorno derivado de la caja)', () => {
  const r = rect(100, 100, 100, 100);
  assert.equal(Eraser.touches(r, stroke([100, 150]), 4), true, 'borde');
  assert.equal(Eraser.touches(r, stroke([150, 150]), 4), false, 'hueco interior');
  assert.equal(Eraser.touches({ type: 'curveArrow', x1: 0, y1: 0, x2: 10, y2: 0 }, stroke([5, 0]), 4), true);
});

/* ---- erase(): borrado parcial de recta/flecha/trazo ---- */

const line = (x1, y1, x2, y2, extra = {}) =>
  ({ type: 'line', x1, y1, x2, y2, color: '#000000', lineWidth: 2, ...extra });
const arrow = (x1, y1, x2, y2, extra = {}) =>
  ({ type: 'arrow', x1, y1, x2, y2, color: '#000000', lineWidth: 2, ...extra });
const pencil = (pts, extra = {}) =>
  ({ type: 'pencil', points: stroke(...pts), color: '#000000', lineWidth: 2, seed: 7, ...extra });

test('erase() expone su API', () => {
  assert.equal(typeof Eraser.erase, 'function');
});

test('erase() sin tocar nada devuelve la misma referencia', () => {
  const els = [rect(0, 0, 50, 50), line(0, 0, 100, 0)];
  assert.equal(Eraser.erase(els, stroke([500, 500], [600, 600]), 4, DEPS), els);
});

test('erase() no muta la entrada', () => {
  const els = [line(0, 100, 200, 100)];
  Eraser.erase(els, stroke([90, 100], [110, 100]), 8, DEPS);
  assert.equal(els.length, 1, 'la entrada original sigue intacta');
  assert.equal(els[0].x1, 0);
});

test('recta: un mordisco en el medio la parte en dos, no la borra entera', () => {
  const els = [line(0, 100, 200, 100)];
  const out = Eraser.erase(els, stroke([90, 100], [110, 100]), 8, DEPS);
  assert.equal(out.length, 2, 'sobreviven dos trozos');
  assert.ok(out.every(e => e.type === 'line'));
  const [a, b] = out.sort((p, q) => p.x1 - q.x1);
  assert.ok(a.x1 <= 1 && a.x2 < 90, 'el trozo izquierdo no llega al mordisco');
  assert.ok(b.x1 > 110 && b.x2 >= 199, 'el trozo derecho empieza después del mordisco');
  assert.equal(a.color, '#000000');
  assert.equal(a.lineWidth, 2);
});

test('recta: si el borrador la cubre entera, desaparece (no sobrevive ningún trozo)', () => {
  const els = [line(0, 100, 50, 100)];
  const out = Eraser.erase(els, stroke([-10, 100], [60, 100]), 8, DEPS);
  assert.equal(out.length, 0);
});

test('recta: un mordisco cerca de un extremo solo recorta ese lado', () => {
  const els = [line(0, 100, 200, 100)];
  const out = Eraser.erase(els, stroke([-10, 100], [10, 100]), 8, DEPS);
  assert.equal(out.length, 1, 'solo sobrevive el resto de la recta');
  assert.ok(out[0].x1 > 10, 'el extremo mordido no vuelve');
  assert.ok(out[0].x2 >= 199, 'el otro extremo se conserva');
});

test('recta sin tocar sobrevive idéntica (sin trozos de más)', () => {
  const els = [line(0, 0, 100, 0)];
  const out = Eraser.erase(els, stroke([500, 500]), 8, DEPS);
  assert.equal(out, els, 'ni se toca ni se reconstruye');
});

test('flecha: el trozo con la punta original sigue siendo flecha; el otro pasa a línea suelta', () => {
  const els = [arrow(0, 100, 200, 100)];
  const out = Eraser.erase(els, stroke([90, 100], [110, 100]), 8, DEPS);
  assert.equal(out.length, 2);
  const withHead = out.find(e => Math.round(e.x2) >= 199);
  const withoutHead = out.find(e => e !== withHead);
  assert.equal(withHead.type, 'arrow', 'el trozo que llega a la punta original sigue siendo flecha');
  assert.equal(withoutHead.type, 'line', 'el trozo cortado de la punta pasa a línea, no inventa una punta nueva');
  assert.equal(withoutHead.heads, undefined);
  assert.equal(withoutHead.label, undefined);
});

test('flecha con doble punta que el borrador no llega a tocar: pasa intacta, con sus dos puntas', () => {
  const original = arrow(0, 100, 200, 100, { heads: 'both' });
  const out = Eraser.erase([original], stroke([500, 500]), 8, DEPS);
  assert.equal(out[0], original, 'ni se reconstruye ni pierde su marca de doble punta');
});

test('flecha con doble punta partida por el medio: cada mitad se queda solo con su punta', () => {
  const els = [arrow(0, 100, 200, 100, { heads: 'both' })];
  const out = Eraser.erase(els, stroke([90, 100], [110, 100]), 8, DEPS);
  assert.equal(out.length, 2);
  out.forEach(e => assert.notEqual(e.heads, 'both', 'ningún trozo conserva las dos puntas: cada uno solo tiene un extremo original'));
});

test('lápiz: un hueco en medio del trazo lo parte en dos trazos independientes', () => {
  const els = [pencil([[0, 0], [50, 0], [100, 0], [150, 0], [200, 0]])];
  const out = Eraser.erase(els, stroke([90, 0], [110, 0]), 8, DEPS);
  assert.equal(out.length, 2, 'dos trazos, no uno con hueco ni el trazo borrado entero');
  assert.ok(out.every(e => e.type === 'pencil'));
  assert.ok(out.every(e => e.points.length >= 2));
  assert.equal(out[0].seed, 7, 'conserva la semilla del trazo original');
  const maxXLeft = Math.max(...out[0].points.map(p => p.x));
  const minXRight = Math.min(...out[1].points.map(p => p.x));
  assert.ok(maxXLeft < 90 && minXRight > 110, 'el hueco separa los dos trazos');
});

test('lápiz: borrar en la intersección de dos trazos parte los dos, no los borra enteros', () => {
  // Dos trazos en cruz, se tocan en (100,100).
  const horiz = pencil([[0, 100], [50, 100], [100, 100], [150, 100], [200, 100]]);
  const vert = pencil([[100, 0], [100, 50], [100, 100], [100, 150], [100, 200]]);
  const out = Eraser.erase([horiz, vert], stroke([90, 100], [110, 100], [100, 90], [100, 110]), 8, DEPS);
  // Cada trazo pierde solo el trocito del cruce: sobreviven cuatro trozos, dos por trazo.
  assert.equal(out.length, 4, 'ninguno de los dos trazos desaparece entero');
  assert.ok(out.every(e => e.type === 'pencil'));
});

test('erase() sigue borrando entero lo que no es recta/flecha/lápiz', () => {
  const els = [rect(0, 0, 50, 50), line(100, 25, 300, 25)];
  const out = Eraser.erase(els, stroke([-10, 25], [130, 25]), 8, DEPS);
  assert.ok(out.every(e => e.type !== 'rect'), 'el rectángulo tocado se elimina entero, no se recorta');
});

test('erase() no borra las máscaras heredadas', () => {
  const els = [
    line(0, 100, 200, 100),
    { type: 'eraser', points: stroke([90, 100], [110, 100]), color: '#000000', lineWidth: 2, size: 16 },
  ];
  const out = Eraser.erase(els, stroke([90, 100], [110, 100]), 8, DEPS);
  assert.equal(out.filter(e => e.type === 'eraser').length, 1, 'la máscara sobrevive intacta');
});
