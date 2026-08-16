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

/* Guardias de BUGS.md (v2.2.0): el recorte usaba solo `r` donde `touches`
   usa `r + grosor/2`, y todo trozo perdía id/anclas incondicionalmente. */

test('el roce que toca la tinta gruesa pero no el eje también muerde (mismo umbral que touches)', () => {
  // lineWidth 12: la tinta llega hasta ±6 del eje. El borrador (r=8) pasa a
  // y=10: toca la tinta (10 ≤ 8+6) sin acercarse nunca a 8 del eje — antes
  // "tocaba" sin borrar nada visible y aun así reconstruía la recta.
  const els = [line(0, 0, 200, 0, { lineWidth: 12 })];
  const out = Eraser.erase(els, stroke([100, 10]), 8, DEPS);
  assert.equal(out.length, 2, 'el mordisco se ve: la recta queda partida');
});

test('mordisco en la cola de una flecha anclada: la punta no se desconecta', () => {
  const els = [arrow(0, 100, 200, 100, {
    id: 'a1', startAnchor: { id: 'n3' }, endAnchor: { id: 'n7' },
  })];
  const out = Eraser.erase(els, stroke([30, 100]), 8, DEPS);
  assert.equal(out.length, 2);
  const tip = out.find(e => e.type === 'arrow');
  assert.equal(tip.endAnchor && tip.endAnchor.id, 'n7', 'la punta, que no se ha movido, sigue anclada');
  assert.equal(tip.startAnchor, undefined, 'el extremo recortado sí pierde su ancla');
  const tail = out.find(e => e.type === 'line');
  assert.equal(tail.startAnchor, undefined, 'el trozo degradado a línea no arrastra anclas muertas');
  assert.ok(out.every(e => e.id === undefined), 'ningún trozo hereda el id');
});

test('roce que toca sin que ninguna muestra caiga dentro: intacto por referencia (sin undo fantasma)', () => {
  // Contacto continuo justo entre dos muestras (paso 4 px): touches da sí,
  // pero ninguna muestra queda dentro del área efectiva (r+grosor/2 = 9):
  // a (2, 8.9) la distancia continua es 8.9 y la muestra más cercana está a ~9.12.
  const els = [line(0, 0, 100, 0)];
  assert.equal(Eraser.touches(els[0], stroke([2, 8.9]), 8, DEPS), true, 'premisa: sí hay contacto');
  const out = Eraser.erase(els, stroke([2, 8.9]), 8, DEPS);
  assert.equal(out, els, 'ni se reconstruye ni pierde anclas ni apila undo');
});

/* ────────────────────────────────────────────────────────────
   Aerógrafo (v2.22.0)
   ──────────────────────────────────────────────────────────── */

const spray = extra => Object.assign({
  type: 'airbrush', color: '#000000', lineWidth: 3, seed: 5,
  points: stroke([100, 100], [300, 300]),
  radius: 20, density: 40,
}, extra || {});

test('cruzar el eje parte la mancha en dos, no la borra entera (v2.33.0)', () => {
  // Hasta la v2.33.0 bastaba rozar la banda para que la nube entera
  // desapareciera — lo que el usuario reportó como «el borrador no funciona
  // bien en el aerógrafo». Ahora se recorta el EJE, que es lo que el elemento
  // guarda, y cada trozo regenera su propia nube.
  const el = spray();
  const paso = stroke([200, 180], [200, 220]); // cruza el eje por el medio
  assert.equal(Eraser.touches(el, paso, 6, DEPS), true);
  const escena = [el, rect(600, 600, 40, 40)];
  const tras = Eraser.erase(escena, paso, 6, DEPS);
  const nubes = tras.filter(e => e.type === 'airbrush');
  assert.equal(nubes.length, 2, 'quedan los dos tramos de eje, uno a cada lado');
  // Cada trozo conserva boquilla, densidad y grano: es la misma mancha.
  for (const n of nubes) {
    assert.equal(n.radius, el.radius);
    assert.equal(n.density, el.density);
    assert.equal(n.lineWidth, el.lineWidth);
    assert.ok(n.points.length >= 2);
  }
  // Y hay hueco de verdad entre los dos: el final de uno queda antes del
  // principio del otro, no pegados.
  const finA = nubes[0].points[nubes[0].points.length - 1];
  const iniB = nubes[1].points[0];
  assert.ok(Math.hypot(iniB.x - finA.x, iniB.y - finA.y) > 6, 'el claro existe');
});

test('un soplo de un solo punto no tiene eje que partir: se borra entero', () => {
  const el = spray({ points: stroke([100, 100]) });
  assert.equal(Eraser.erase([el], stroke([100, 100]), 6, DEPS).length, 0);
});

test('rozar el halo muerde ese tramo de banda, no la mancha entera', () => {
  // El eje que pinta el halo está debajo, así que pasar por el borde de la
  // banda corta ahí. Lo que NO puede pasar es que desaparezca todo.
  const el = spray({ points: stroke([100, 100], [300, 100]), radius: 20 });
  const roce = stroke([200, 118], [205, 118]);
  assert.equal(Eraser.touches(el, roce, 2, DEPS), true);
  const tras = Eraser.erase([el], roce, 2, DEPS);
  assert.equal(tras.length, 2, 'quedan los dos lados del roce');
  assert.ok(tras[0].points[0].x === 100, 'el principio del eje sigue donde estaba');
});

test('pasar lejos de la banda no reconstruye la mancha (misma referencia)', () => {
  const el = spray({ points: stroke([100, 100], [300, 100]), radius: 20 });
  const escena = [el];
  assert.equal(Eraser.erase(escena, stroke([200, 160], [205, 160]), 2, DEPS), escena);
});

test('pasar por la esquina vacía de su caja NO borra la mancha', () => {
  // La regresión que evita el caso «caja»: la mancha va de (100,100) a
  // (300,300), así que la esquina superior derecha de su bbox está a más de
  // 100 px de cualquier gota. Con _touchesBox se habría borrado igual.
  const el = spray();
  const esquina = stroke([290, 110], [300, 120]);
  assert.equal(Eraser.touches(el, esquina, 6, DEPS), false);
  assert.equal(Eraser.erase([el], esquina, 6, DEPS).length, 1);
});

test('el alcance del borrador llega hasta el borde de la banda, no solo al eje', () => {
  // A 18 px del eje (radio 20) hay tinta: rozar ahí tiene que borrar, aunque
  // el eje quede lejos. Es lo que distingue una banda de una línea.
  const el = spray({ points: stroke([100, 100], [300, 100]), radius: 20 });
  assert.equal(Eraser.touches(el, stroke([200, 118], [205, 118]), 2, DEPS), true);
  // Y a 40 px ya no hay ninguna gota: la boquilla es una cota dura.
  assert.equal(Eraser.touches(el, stroke([200, 145], [205, 145]), 2, DEPS), false);
});

test('con área, barrer por la parte recortada no borra nada', () => {
  // Se borra lo que se VE: fuera del área no hay tinta, por mucho que el eje
  // pase por debajo.
  const el = spray({
    points: stroke([100, 100], [500, 100]),
    clip: { x: 100, y: 60, w: 100, h: 80 },
  });
  assert.equal(Eraser.touches(el, stroke([400, 95], [410, 105]), 6, DEPS), false,
    'el tramo sin pintar del eje no puede borrar la mancha');
  assert.equal(Eraser.touches(el, stroke([150, 95], [160, 105]), 6, DEPS), true,
    'y dentro del área sí');
});

test('la mancha no se cuela por las ramas de lápiz ni de forma', () => {
  // Comparte el campo `points` con el lápiz y podría caer en su rama, que
  // usaría solo lineWidth y perdería la boquilla entera.
  const el = spray({ points: stroke([100, 100], [300, 100]), radius: 30, lineWidth: 1 });
  assert.equal(Eraser.touches(el, stroke([200, 125], [205, 125]), 1, DEPS), true,
    'con la rama del lápiz esto no tocaría: 25 px del eje con lineWidth 1');
});

/* ────────────────────────────────────────────────────────────
   Borrado parcial de curvas y contornos (v2.33.0)

   Hasta aquí, tocar una flecha curva o el contorno de una forma se llevaba
   el elemento entero: el usuario lo reportó como «el borrador no funciona
   bien en las flechas curvas ni en las formas». Ahora se recortan como una
   recta, y los trozos salen como trazo a mano alzada.
   ──────────────────────────────────────────────────────────── */

const curva = extra => Object.assign({
  type: 'curveArrow', color: '#000000', lineWidth: 2, seed: 3,
  x1: 100, y1: 300, cx: 200, cy: 100, x2: 300, y2: 300,
}, extra || {});

test('morder una flecha curva por el medio deja dos trozos, no la borra', () => {
  const el = curva();
  const paso = stroke([200, 140], [200, 200]);     // cruza el vértice de la curva
  assert.equal(Eraser.touches(el, paso, 8, DEPS), true);
  const tras = Eraser.erase([el], paso, 8, DEPS);
  assert.equal(tras.length, 2, 'sobreviven los dos extremos de la curva');
  assert.ok(tras.every(p => p.type === 'pencil'), 'un trozo de curva ya no es una curva');
  assert.ok(tras.every(p => p.points.length >= 2));
  // El primer trozo arranca donde arrancaba la curva y el segundo acaba donde acababa.
  assert.deepEqual({ ...tras[0].points[0] }, { x: 100, y: 300 });
  const fin = tras[1].points[tras[1].points.length - 1];
  assert.deepEqual({ ...fin }, { x: 300, y: 300 });
});

test('el trozo de curva no hereda ni punta ni etiqueta ni campos de curva', () => {
  const el = curva({ heads: 'both', label: 'flujo', labelT: 0.5, dash: true, id: 'ab12' });
  const tras = Eraser.erase([el], stroke([200, 140], [200, 200]), 8, DEPS);
  for (const p of tras) {
    assert.equal(p.heads, undefined, 'cortar una curva no inventa una punta en el corte');
    assert.equal(p.label, undefined);
    assert.equal(p.labelT, undefined);
    assert.equal(p.cx, undefined, 'un pencil con cx sería basura serializada');
    assert.equal(p.id, undefined);
    // `dash` no se hereda: el renderer no lo aplica a un pencil, así que
    // copiarlo dibujaría continuo diciendo discontinuo.
    assert.equal(p.dash, undefined);
    assert.equal(p.color, el.color);
    assert.equal(p.lineWidth, el.lineWidth);
  }
});

test('rozar una curva sin morderla la deja intacta POR REFERENCIA', () => {
  const el = curva();
  const escena = [el];
  // A 30 px del trazado: `touches` no llega y no se reconstruye nada.
  assert.equal(Eraser.erase(escena, stroke([200, 40], [210, 40]), 4, DEPS), escena);
});

test('borrar un lado de un rectángulo deja el resto del contorno', () => {
  const el = rect(100, 100, 200, 200);
  const paso = stroke([140, 100], [260, 100]);     // barre el lado superior
  const tras = Eraser.erase([el], paso, 10, DEPS);
  assert.ok(tras.length >= 1, 'no se borra el rectángulo entero');
  assert.ok(tras.every(p => p.type === 'pencil'));
  // Lo que queda es un trozo continuo: el anillo se cortó SOLO por donde pasó
  // el borrador, no también por su costura.
  assert.equal(tras.length, 1, 'una sola tira, no dos');
  const pts = tras[0].points;
  // Y sigue rodeando la forma: llega a las cuatro esquinas útiles.
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  assert.ok(Math.min(...xs) <= 101 && Math.max(...xs) >= 299);
  assert.ok(Math.min(...ys) <= 101 && Math.max(...ys) >= 299);
  // El hueco está donde pasó el borrador, en el lado de arriba.
  assert.ok(!pts.some(p => p.y < 105 && p.x > 160 && p.x < 240), 'el lado barrido no está');
});

test('dos pasadas por lados opuestos parten el contorno en dos tiras', () => {
  const el = rect(100, 100, 200, 200);
  const tras = Eraser.erase([el], stroke([140, 100], [260, 100]), 10, DEPS);
  const final = Eraser.erase(tras, stroke([140, 300], [260, 300]), 10, DEPS);
  assert.equal(final.length, 2, 'quedan los dos laterales, separados');
  assert.ok(final.every(p => p.type === 'pencil' && p.points.length >= 2));
});

test('una forma RELLENA sigue yéndose entera: su dibujo es la superficie', () => {
  const el = Object.assign(rect(100, 100, 200, 200), { fill: true, fillColor: '#e74c3c' });
  const tras = Eraser.erase([el], stroke([140, 100], [260, 100]), 10, DEPS);
  assert.equal(tras.length, 0, 'no hay tipo que represente una superficie mordida');
});

test('el círculo se recorta por su elipse, no por su caja', () => {
  const el = { type: 'circle', x: 100, y: 100, w: 200, h: 200, color: '#000000', lineWidth: 2 };
  // La esquina de la caja está a ~41 px de la circunferencia: no borra nada.
  const escena = [el];
  assert.equal(Eraser.erase(escena, stroke([100, 100], [110, 110]), 6, DEPS), escena);
  // Y por el borde de arriba sí muerde.
  const tras = Eraser.erase(escena, stroke([190, 100], [210, 100]), 10, DEPS);
  assert.equal(tras.length, 1);
  assert.equal(tras[0].type, 'pencil');
  assert.ok(tras[0].points.length > 8, 'queda casi toda la circunferencia');
});

test('el trozo de contorno de un polígono regular no hereda su rotación', () => {
  // `isValidElement` RECHAZA un `rotation` que no esté en un polígono regular
  // o un trapecio: heredarlo con `{...el}` daría trozos que no se reimportan.
  const el = {
    type: 'pentagon', x: 100, y: 100, w: 200, h: 200,
    color: '#000000', lineWidth: 2, rotation: 36, buildingGroupId: 'g1',
  };
  const tras = Eraser.erase([el], stroke([100, 200], [130, 200]), 12, DEPS);
  assert.ok(tras.length >= 1);
  for (const p of tras) {
    assert.equal(p.type, 'pencil');
    assert.equal(p.rotation, undefined);
    assert.equal(p.w, undefined);
    assert.equal(p.h, undefined);
    // El grupo sí viaja: el trozo sigue siendo pieza del mismo conjunto.
    assert.equal(p.buildingGroupId, 'g1');
  }
});

test('texto, imagen y componentes siguen borrándose enteros', () => {
  const texto = { type: 'text', x: 100, y: 100, w: 80, h: 20, value: 'hola',
    color: '#000000', lineWidth: 2, fontSize: 18 };
  assert.equal(Eraser.erase([texto], stroke([100, 105], [140, 105]), 6, DEPS).length, 0);
});
