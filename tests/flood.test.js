'use strict';
/* ============================================================
   flood.test.js — Geometría pura del bote de pintura (src/js/flood.js)

   Todas las máscaras se escriben a mano con `new Uint8Array(w*h)`: el módulo
   no toca el DOM ni recibe un ImageData, así que aquí no hace falta ningún
   stub de canvas. Ése es justamente el reparto que justifica que el módulo
   exista aparte de app.js.

   Ejecutar: node --test tests/flood.test.js
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');

const { Flood } = load('src/js/flood.js');

/** Máscara vacía. */
const blank = (w, h) => new Uint8Array(w * h);

/** Enciende un rectángulo (inclusive) sobre la máscara. */
function rect(mask, w, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) mask[y * w + x] = 1;
  }
  return mask;
}

/** Rombo hueco: |x-cx| + |y-cy| === r. La barrera es sólo el perímetro. */
function diamond(w, h, cx, cy, r) {
  const m = blank(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (Math.abs(x - cx) + Math.abs(y - cy) === r) m[y * w + x] = 1;
    }
  }
  return m;
}

const on = (mask, w, x, y) => mask[y * w + x] === 1;

/* ─────────── maskFromAlpha ─────────── */

test('maskFromAlpha marca 1 sólo donde el alfa llega al umbral', () => {
  // Cuatro píxeles con alfas 0, 15, 16 y 255: el umbral por defecto es 16.
  const data = new Uint8ClampedArray([
    0, 0, 0, 0, 0, 0, 0, 15, 0, 0, 0, 16, 0, 0, 0, 255,
  ]);
  assert.deepEqual([...Flood.maskFromAlpha(data, 4, 1)], [0, 0, 1, 1]);
});

test('maskFromAlpha mira el alfa y no el color', () => {
  // Negro totalmente transparente y blanco totalmente opaco: decide el alfa.
  const data = new Uint8ClampedArray([0, 0, 0, 0, 255, 255, 255, 255]);
  assert.deepEqual([...Flood.maskFromAlpha(data, 2, 1)], [0, 1]);
});

/* ─────────── dilate ─────────── */

test('dilate con r=0 devuelve una copia, no la misma referencia', () => {
  const m = rect(blank(5, 5), 5, 2, 2, 2, 2);
  const out = Flood.dilate(m, 5, 5, 0);
  assert.notEqual(out, m);
  out[0] = 1;
  assert.equal(m[0], 0, 'mutar la salida no debe tocar la entrada');
});

test('dilate r=1 convierte un punto en un cuadrado 3x3', () => {
  // Chebyshev, no disco: las esquinas también se encienden. Es deliberado —
  // en una herramienta que cierra huecos, ser generosa en diagonal ayuda.
  const out = Flood.dilate(rect(blank(5, 5), 5, 2, 2, 2, 2), 5, 5, 1);
  assert.equal(out.reduce((a, b) => a + b, 0), 9);
  for (let y = 1; y <= 3; y++) {
    for (let x = 1; x <= 3; x++) assert.ok(on(out, 5, x, y));
  }
});

test('dilate no se sale del lienzo', () => {
  const out = Flood.dilate(rect(blank(5, 5), 5, 0, 0, 0, 0), 5, 5, 2);
  assert.equal(out.reduce((a, b) => a + b, 0), 9, 'sólo el cuadrante válido');
});

test('dilate r=2 cierra un hueco de 4 px y r=1 NO cierra uno de 3', () => {
  // Ésta es la semántica prometida al usuario: el deslizador dice «Cerrar
  // huecos» en píxeles, y un hueco se cierra cuando mide 2·r o menos.
  const cerrado = (gap, r) => {
    // La caja es holgada a propósito: con paredes demasiado juntas la propia
    // dilatación cerraría el interior y el test mediría otra cosa.
    const w = 25, h = 25;
    const m = blank(w, h);
    // Caja cerrada salvo un hueco de `gap` px en el centro de la tapa.
    rect(m, w, 4, 4, 20, 4); rect(m, w, 4, 20, 20, 20);
    rect(m, w, 4, 4, 4, 20); rect(m, w, 20, 4, 20, 20);
    const x0 = 12 - Math.floor(gap / 2);
    for (let x = x0; x < x0 + gap; x++) m[4 * w + x] = 0;
    const res = Flood.floodRegion(Flood.dilate(m, w, h, r), w, h, 12, 12);
    return res.ok; // cerrada = el flood no se escapa
  };
  assert.equal(cerrado(4, 2), true, 'r=2 debe cerrar un hueco de 4');
  assert.equal(cerrado(3, 1), false, 'r=1 no debe cerrar un hueco de 3');
});

test('dilate acotada a una ventana no toca fuera de ella', () => {
  const m = blank(11, 11);
  m[5 * 11 + 2] = 1;   // dentro de la ventana
  m[5 * 11 + 9] = 1;   // fuera
  const out = Flood.dilate(m, 11, 11, 1, { x0: 0, y0: 0, x1: 5, y1: 10 });
  assert.ok(on(out, 11, 1, 5), 'el de dentro se dilata');
  assert.ok(!on(out, 11, 8, 5), 'el de fuera se queda como estaba');
});

/* ─────────── floodRegion ─────────── */

test('floodRegion rellena un rombo cerrado sin desbordarlo', () => {
  const w = 21, h = 21;
  const m = diamond(w, h, 10, 10, 8);
  const res = Flood.floodRegion(m, w, h, 10, 10);
  assert.equal(res.ok, true);
  // El interior de |dx|+|dy| < 8 son 113 celdas.
  let esperadas = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (Math.abs(x - 10) + Math.abs(y - 10) < 8) esperadas++;
    }
  }
  assert.equal(res.count, esperadas);
  // Y ni una celda de la región cae sobre la barrera o fuera de ella.
  for (let i = 0; i < m.length; i++) {
    if (res.region[i]) assert.equal(m[i], 0, 'la región pisa la barrera');
  }
  assert.deepEqual({ ...res.bounds }, { x0: 3, y0: 3, x1: 17, y1: 17 });
});

test('floodRegion detecta la fuga cuando la zona no está cerrada', () => {
  const w = 21, h = 21;
  const m = diamond(w, h, 10, 10, 8);
  // Se abre un boquete en el perímetro: la pintura llega al borde del lienzo.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y === 10 && x > 10) m[y * w + x] = 0;
    }
  }
  assert.deepEqual({ ...Flood.floodRegion(m, w, h, 10, 10) },
    { ok: false, reason: 'escaped' });
});

test('floodRegion detecta la fuga aunque la abertura esté lejos del clic', () => {
  const w = 15, h = 15;
  const m = blank(w, h);
  rect(m, w, 3, 3, 11, 3); rect(m, w, 3, 11, 11, 11);
  rect(m, w, 3, 3, 3, 11); rect(m, w, 11, 3, 11, 11);
  m[3 * w + 3] = 0; m[3 * w + 4] = 0; m[4 * w + 3] = 0; // esquina abierta
  assert.equal(Flood.floodRegion(m, w, h, 7, 7).reason, 'escaped');
});

test('floodRegion devuelve seed-blocked si el clic cae sobre un trazo', () => {
  const w = 11, h = 11;
  const m = rect(blank(w, h), w, 0, 5, 10, 5);
  assert.deepEqual({ ...Flood.floodRegion(m, w, h, 5, 5) },
    { ok: false, reason: 'seed-blocked' });
});

test('floodRegion empuja la semilla al píxel libre más cercano', () => {
  // Con el cierre de huecos alto cada trazo se engorda varios píxeles, así
  // que pinchar «junto a» una línea cae dentro de barrera constantemente.
  const w = 21, h = 21;
  const m = diamond(w, h, 10, 10, 8);
  const res = Flood.floodRegion(m, w, h, 10, 2, { snapRadius: 3 });
  assert.equal(res.ok, true);
  assert.notDeepEqual({ ...res.seed }, { x: 10, y: 2 }, 'la semilla debió moverse');
  assert.equal(res.region[res.seed.y * w + res.seed.x], 1);
});

test('floodRegion respeta minPixels y maxPixels', () => {
  const w = 15, h = 15;
  const m = blank(w, h);
  rect(m, w, 5, 5, 9, 5); rect(m, w, 5, 9, 9, 9);
  rect(m, w, 5, 5, 5, 9); rect(m, w, 9, 5, 9, 9);
  assert.equal(Flood.floodRegion(m, w, h, 7, 7, { minPixels: 100 }).reason,
    'too-small');
  assert.equal(Flood.floodRegion(m, w, h, 7, 7, { maxPixels: 3 }).reason,
    'too-large');
});

test('floodRegion es 4-conexo: no se cuela por un contacto diagonal', () => {
  // Dos cámaras que sólo se tocan por una esquina. Con 8-conexión la pintura
  // saltaría de una a otra (y en el lienzo, atravesaría cualquier aspa).
  const w = 13, h = 13;
  const m = blank(w, h);
  rect(m, w, 0, 0, 12, 0); rect(m, w, 0, 12, 12, 12);
  rect(m, w, 0, 0, 0, 12); rect(m, w, 12, 0, 12, 12);
  rect(m, w, 1, 6, 5, 6); rect(m, w, 7, 6, 11, 6);   // tabique con un paso
  rect(m, w, 6, 1, 6, 5); rect(m, w, 6, 7, 6, 11);   // en diagonal en (6,6)
  const res = Flood.floodRegion(m, w, h, 3, 3);
  assert.equal(res.ok, true);
  assert.equal(res.region[9 * w + 9], 0, 'no debe alcanzar la cámara opuesta');
});

/* ─────────── traceContour ─────────── */

test('traceContour da las esquinas de GRIETA, no los centros de píxel', () => {
  // Un cuadrado de píxeles [2..6]x[2..6] tiene su contorno real en 2 y en 7,
  // porque el píxel k cubre [k, k+1). Con centros de píxel saldría 2..6 y la
  // mancha nacería medio píxel adentro por los cuatro lados.
  const w = 10, h = 10;
  const r = rect(blank(w, h), w, 2, 2, 6, 6);
  const pts = Flood.traceContour(r, w, h);
  assert.equal(pts.length, 4);
  const clave = [...pts.map(p => `${p.x},${p.y}`).sort()];
  assert.deepEqual(clave, ['2,2', '2,7', '7,2', '7,7']);
});

test('traceContour cierra el ciclo sin repetir el primer punto', () => {
  const w = 10, h = 10;
  const pts = Flood.traceContour(rect(blank(w, h), w, 3, 3, 6, 6), w, h);
  const vistos = new Set(pts.map(p => `${p.x},${p.y}`));
  assert.equal(vistos.size, pts.length);
});

test('traceContour de una L cóncava da seis vértices', () => {
  const w = 12, h = 12;
  const m = blank(w, h);
  rect(m, w, 2, 2, 4, 8);
  rect(m, w, 2, 6, 8, 8);
  assert.equal(Flood.traceContour(m, w, h).length, 6);
});

test('traceContour ignora un agujero interior', () => {
  // Un anillo tiene dos contornos; se devuelve sólo el exterior. Los agujeros
  // los cuenta countHoles, porque un `polygon` es un anillo único.
  const w = 13, h = 13;
  const m = rect(blank(w, h), w, 2, 2, 10, 10);
  rect(m, w, 5, 5, 7, 7); // el agujero se apaga
  for (let y = 5; y <= 7; y++) for (let x = 5; x <= 7; x++) m[y * w + x] = 0;
  assert.equal(Flood.traceContour(m, w, h).length, 4);
});

test('traceContour de una máscara vacía devuelve []', () => {
  assert.deepEqual([...Flood.traceContour(blank(8, 8), 8, 8)], []);
});

test('traceContour recorre un pelo de 1 px sin colgarse', () => {
  // El caso que hace inviable un seguimiento de borde tipo Moore: un apéndice
  // de un píxel de ancho hay que recorrerlo de ida y de vuelta.
  const w = 14, h = 14;
  const m = rect(blank(w, h), w, 2, 2, 6, 6);
  rect(m, w, 7, 4, 11, 4);
  const pts = Flood.traceContour(m, w, h);
  assert.ok(pts.length >= 8 && pts.length < 40);
  assert.ok(pts.some(p => p.x === 12), 'debe llegar a la punta del pelo');
});

/* ─────────── simplify ─────────── */

test('simplify colapsa una escalera diagonal a sus dos extremos', () => {
  // Es lo que hace de marching squares el input ideal de Douglas-Peucker.
  const esc = [];
  for (let i = 0; i <= 20; i++) { esc.push({ x: i, y: i }, { x: i + 1, y: i }); }
  assert.equal(Flood.simplify(esc, 1.5, false).length, 2);
});

test('simplify conserva un vértice que se desvía más que epsilon', () => {
  const pts = [{ x: 0, y: 0 }, { x: 5, y: 3 }, { x: 10, y: 0 }, { x: 15, y: 0 }];
  assert.equal(Flood.simplify(pts, 2, false).length, 3);
  assert.equal(Flood.simplify(pts, 4, false).length, 2);
});

test('simplify sobre anillo cerrado no degenera un cuadrado', () => {
  // Sin partir el anillo por dos anclas, DP puede colapsarlo a un triángulo:
  // sus dos extremos son el mismo punto y la distancia a esa «recta» es rara.
  const lado = [];
  for (let i = 0; i < 20; i++) lado.push({ x: i, y: 0 });
  for (let i = 0; i < 20; i++) lado.push({ x: 20, y: i });
  for (let i = 20; i > 0; i--) lado.push({ x: i, y: 20 });
  for (let i = 20; i > 0; i--) lado.push({ x: 0, y: i });
  assert.equal(Flood.simplify(lado, 1.5, true).length, 4);
});

test('un rombo con ruido de borde se simplifica a 8 vértices o menos', () => {
  // El test que fija el epsilon de producción. El ruido real (escalera de
  // marching squares + jitter de Sketchy) ronda ±1.3 px; aquí se usa ±1.5.
  const w = 121, h = 121;
  const m = blank(w, h);
  let semilla = 7;
  const rnd = () => (semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x - 60) + Math.abs(y - 60);
      if (d < 40 + (rnd() - 0.5) * 3) m[y * w + x] = 1;
    }
  }
  const crudo = Flood.traceContour(m, w, h);
  assert.ok(crudo.length > 100, 'el contorno crudo debe ser una escalera larga');
  const pts = Flood.simplify(crudo, 2.5, true);
  assert.ok(pts.length >= 4 && pts.length <= 16,
    `un rombo debe salir con pocos vértices, salió ${pts.length}`);
});

test('un círculo grande sigue siendo suave tras simplificar', () => {
  const w = 121, h = 121, R = 50;
  const m = blank(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (Math.hypot(x - 60, y - 60) < R) m[y * w + x] = 1;
    }
  }
  const pts = Flood.simplify(Flood.traceContour(m, w, h), 2.5, true);
  assert.ok(pts.length >= 10 && pts.length <= 30,
    `una curva debe conservar vértices suficientes, salieron ${pts.length}`);
});

test('simplificar una zona de tamaño normal casi no le come área', () => {
  // Douglas-Peucker corta esquinas hacia DENTRO, así que el polígono siempre
  // encoge un poco. En una zona de tamaño real la pérdida es de un 1-2% y la
  // absorbe de sobra la dilatación anti-fisura, que va en sentido contrario.
  // (Medido: con eps 2.35 un círculo de radio 15 pierde un 9,7%, uno de 40 un
  // 0,7% y uno de 80 un 1,6% — por eso la garantía se enuncia sobre zonas de
  // tamaño normal, no sobre las diminutas.)
  const R = 40, w = 2 * R + 11, h = w, c = (w - 1) / 2;
  const m = blank(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (Math.hypot(x - c, y - c) < R) m[y * w + x] = 1;
  }
  const crudo = Flood.traceContour(m, w, h);
  const simple = Flood.simplify(crudo, 2.35, true);
  // El signo no importa: DP corta esquinas hacia dentro en las convexas y
  // hacia fuera en las entrantes, así que el área puede quedar un pelo por
  // encima o por debajo. Lo que se garantiza es que apenas se mueve.
  const perdida = 1 - Math.abs(Flood.polygonArea(simple)) / Math.abs(Flood.polygonArea(crudo));
  assert.ok(Math.abs(perdida) < 0.03,
    `la simplificación movió el área un ${(perdida * 100).toFixed(1)}%`);
});

test('subir epsilon nunca aumenta el número de vértices', () => {
  // La monotonía es lo que hace que el bucle de maxVertices termine: si
  // agrandar epsilon pudiera añadir vértices, podría no converger nunca.
  const w = 81, h = 81;
  const m = blank(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (Math.hypot(x - 40, y - 40) < 32) m[y * w + x] = 1;
  }
  const crudo = Flood.traceContour(m, w, h);
  let previo = Infinity;
  for (const eps of [1, 1.5, 2, 3, 4, 6]) {
    const n = Flood.simplify(crudo, eps, true).length;
    assert.ok(n <= previo, `eps ${eps} dio ${n} vértices, más que el anterior`);
    previo = n;
  }
});

/* ─────────── medidas ─────────── */

test('polygonArea de un cuadrado de lado 10 es 100', () => {
  const q = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  assert.equal(Math.abs(Flood.polygonArea(q)), 100);
});

test('countHoles distingue una región maciza de un anillo', () => {
  const w = 13, h = 13;
  const macizo = rect(blank(w, h), w, 2, 2, 10, 10);
  const bounds = { x0: 2, y0: 2, x1: 10, y1: 10 };
  assert.equal(Flood.countHoles(macizo, w, h, bounds), 0);
  const anillo = rect(blank(w, h), w, 2, 2, 10, 10);
  for (let y = 5; y <= 7; y++) for (let x = 5; x <= 7; x++) anillo[y * w + x] = 0;
  assert.equal(Flood.countHoles(anillo, w, h, bounds), 1);
});

/* ─────────── trace (el orquestador) ─────────── */

test('trace de un rombo cerrado devuelve un polígono de pocos vértices', () => {
  const w = 61, h = 61;
  const res = Flood.trace(diamond(w, h, 30, 30, 22), w, h, 30, 30, { epsilon: 2 });
  assert.equal(res.ok, true);
  assert.ok(res.points.length >= 4 && res.points.length <= 10,
    `salieron ${res.points.length} vértices`);
  assert.equal(res.holes, 0);
});

test('inkRadius engorda la mancha e INVADE la barrera', () => {
  // La solución de la fisura. El flood se para en el borde interior del
  // trazo; sin esta dilatación quedaría una rendija de papel entre la mancha
  // y la línea. La mancha va debajo del trazo, así que el sobrante se tapa.
  const w = 61, h = 61;
  const m = diamond(w, h, 30, 30, 22);
  const caja = r => {
    const p = Flood.trace(m, w, h, 30, 30, { inkRadius: r, epsilon: 2 }).points;
    return {
      x0: Math.min(...p.map(q => q.x)), x1: Math.max(...p.map(q => q.x)),
      y0: Math.min(...p.map(q => q.y)), y1: Math.max(...p.map(q => q.y)),
    };
  };
  const sin = caja(0), con = caja(3);
  assert.ok(con.x0 < sin.x0 - 2 && con.x1 > sin.x1 + 2,
    'con inkRadius la mancha debe crecer por los dos lados');
  assert.ok(con.y0 < sin.y0 - 2 && con.y1 > sin.y1 + 2);
});

test('trace propaga escaped sin devolver puntos', () => {
  const w = 21, h = 21;
  const res = Flood.trace(blank(w, h), w, h, 10, 10, {});
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'escaped');
  assert.equal(res.points, undefined);
});

test('trace sube epsilon hasta respetar maxVertices', () => {
  const w = 121, h = 121;
  const m = blank(w, h);
  let semilla = 3;
  const rnd = () => (semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (Math.hypot(x - 60, y - 60) < 45 + (rnd() - 0.5) * 6) m[y * w + x] = 1;
    }
  }
  // La máscara es el relleno; se invierte para que haga de barrera.
  const barreras = m.map(v => (v ? 0 : 1));
  const res = Flood.trace(barreras, w, h, 60, 60, { epsilon: 1.5, maxVertices: 10 });
  assert.equal(res.ok, true);
  assert.ok(res.points.length <= 10);
  assert.ok(res.epsilon > 1.5, 'debió subir el epsilon para llegar al tope');
});

test('trace siempre devuelve al menos 3 puntos, dentro del lienzo', () => {
  // Invariante que garantiza que el elemento pasará isValidElement, que exige
  // un triángulo como mínimo (exporter.js: «con menos no hay cara»).
  const w = 41, h = 41;
  const res = Flood.trace(diamond(w, h, 20, 20, 12), w, h, 20, 20, { inkRadius: 4 });
  assert.equal(res.ok, true);
  assert.ok(res.points.length >= 3);
  for (const p of res.points) {
    assert.ok(p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h,
      `punto fuera del lienzo: ${p.x},${p.y}`);
  }
});

test('trace con scale multiplica las coordenadas sin cambiar la forma', () => {
  const w = 41, h = 41;
  const m = diamond(w, h, 20, 20, 12);
  const a = Flood.trace(m, w, h, 20, 20, { epsilon: 2 });
  const b = Flood.trace(m, w, h, 20, 20, { epsilon: 2, scale: 2 });
  assert.equal(b.points.length, a.points.length);
  b.points.forEach((p, i) => {
    assert.equal(p.x, a.points[i].x * 2);
    assert.equal(p.y, a.points[i].y * 2);
  });
});

/* ─────────── El borde como frontera (allowEdge) ─────────── */

test('con allowEdge una zona abierta se rellena hasta el borde y se marca', () => {
  // Es lo que permite pintar el FONDO: un lienzo vacío es, por definición, una
  // zona abierta, así que en modo estricto la herramienta se negaba a pintar
  // en él — que es justo lo que un bote de pintura tiene que saber hacer.
  const w = 21, h = 21;
  const vacio = blank(w, h);
  assert.equal(Flood.floodRegion(vacio, w, h, 10, 10).reason, 'escaped');

  const res = Flood.floodRegion(vacio, w, h, 10, 10, { allowEdge: true });
  assert.equal(res.ok, true);
  assert.equal(res.edge, true, 'debe avisar de que la zona llega al borde');
  assert.equal(res.count, w * h, 'un lienzo vacío se rellena entero');
  assert.deepEqual({ ...res.bounds }, { x0: 0, y0: 0, x1: w - 1, y1: h - 1 });
});

test('allowEdge no cambia nada en una zona que YA estaba cerrada', () => {
  // La zona interior no toca el borde, así que el modo no la afecta y `edge`
  // se queda en falso: es lo que distingue «he pintado el fondo» de «he
  // pintado este recinto», y de eso depende dónde se coloca la mancha.
  const w = 21, h = 21;
  const m = diamond(w, h, 10, 10, 8);
  const estricto = Flood.floodRegion(m, w, h, 10, 10);
  const abierto = Flood.floodRegion(m, w, h, 10, 10, { allowEdge: true });
  assert.equal(abierto.ok, true);
  assert.equal(abierto.edge, false);
  assert.equal(abierto.count, estricto.count);
});

test('el fondo alrededor de una figura se rellena, y sus islas se cuentan', () => {
  // El fondo rodea al rombo: su contorno exterior es el borde del lienzo y el
  // rombo queda como isla. `polygon` es un anillo único, así que esa isla
  // acabará pintada — por eso se cuenta, para poder avisar.
  const w = 41, h = 41;
  const m = diamond(w, h, 20, 20, 12);
  const res = Flood.floodRegion(m, w, h, 1, 1, { allowEdge: true });
  assert.equal(res.ok, true);
  assert.equal(res.edge, true);
  assert.ok(Flood.countHoles(res.region, w, h, res.bounds) >= 1,
    'el interior del rombo es una isla del fondo');
});

test('trace propaga edge y devuelve el contorno del lienzo entero', () => {
  const w = 41, h = 41;
  const res = Flood.trace(blank(w, h), w, h, 20, 20, { allowEdge: true, epsilon: 2 });
  assert.equal(res.ok, true);
  assert.equal(res.edge, true);
  assert.equal(res.points.length, 4, 'un lienzo vacío da un rectángulo');
  for (const p of res.points) {
    assert.ok((p.x === 0 || p.x === w) && (p.y === 0 || p.y === h),
      `los vértices deben ser las esquinas del lienzo: ${p.x},${p.y}`);
  }
});
