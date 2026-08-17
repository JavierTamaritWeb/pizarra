'use strict';
/* ============================================================
   freehand.test.js — Tests de src/js/freehand.js (presión simulada).

   El contorno se regenera en el lienzo, en la previsualización del gesto,
   en la muestra del modal y en el export SVG, así que el determinismo no es
   cosmético: sin él, cuatro dibujos del mismo trazo saldrían distintos.
   Los objetos que cruzan el vm se leen por propiedades numéricas.
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');

const F = () => load('src/js/freehand.js').Freehand;

/** Gesto de referencia: S suave con separación variable (lento → rápido). */
function gesto() {
  const pts = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    pts.push({ x: 100 + 200 * t * t, y: 150 + Math.sin(t * Math.PI * 2) * 40 });
  }
  return pts;
}

test('mismo gesto, mismo polígono: el contorno es determinista', () => {
  const Freehand = F();
  const a = Freehand.outline(gesto(), 6);
  const b = Freehand.outline(gesto(), 6);
  assert.ok(a.length > 4, 'el contorno tiene cuerpo');
  assert.deepEqual(
    a.map(p => [p.x, p.y]),
    b.map(p => [p.x, p.y]),
  );
});

test('la envolvente respeta el grosor nominal: nada sale a más de lineWidth/2 del eje', () => {
  const Freehand = F();
  const pts = gesto();
  const lw = 8;
  const poly = Freehand.outline(pts, lw);
  // Distancia de cada vértice del contorno a la POLILÍNEA del eje (a los
  // segmentos, no solo a los vértices: entre dos puntos crudos espaciados el
  // vértice más cercano queda lejos aunque el eje pase al lado). El
  // streamline mueve el eje efectivo, de ahí el medio píxel de margen — la
  // cota que sostiene bounds, hit-test y el alcance del borrador.
  const dSeg = (q, a, b) => {
    const vx = b.x - a.x, vy = b.y - a.y;
    const L2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.y - a.y) * vy) / L2));
    return Math.hypot(q.x - (a.x + vx * t), q.y - (a.y + vy * t));
  };
  for (const q of poly) {
    let d = Infinity;
    for (let i = 1; i < pts.length; i++) d = Math.min(d, dSeg(q, pts[i - 1], pts[i]));
    assert.ok(d <= lw / 2 + 0.5, `vértice a ${d}px del eje, cota ${lw / 2}`);
  }
});

test('el trazo rápido sale más fino que el lento, y las puntas afiladas', () => {
  const Freehand = F();
  // Recta horizontal: separación 2 px en la primera mitad (lento), 12 px en
  // la segunda (rápido). El ancho local es la distancia entre las dos bandas.
  const pts = [];
  let x = 100;
  for (let i = 0; i < 30; i++) { pts.push({ x, y: 200 }); x += 2; }
  for (let i = 0; i < 30; i++) { pts.push({ x, y: 200 }); x += 12; }
  const poly = Freehand.outline(pts, 8);
  const n = poly.length / 2;
  const widthAt = frac => {
    const i = Math.round((n - 1) * frac);
    const top = poly[i], bot = poly[poly.length - 1 - i];
    return Math.hypot(top.x - bot.x, top.y - bot.y);
  };
  const slow = widthAt(0.3), fast = widthAt(0.75);
  assert.ok(slow > fast * 1.5,
    `lento ${slow.toFixed(1)}px debe superar con margen a rápido ${fast.toFixed(1)}px`);
  // Y los extremos, más finos que el crucero: el afilado de las puntas.
  assert.ok(widthAt(0.02) < slow * 0.6, 'la entrada se afila');
  assert.ok(widthAt(0.98) < slow * 0.6, 'la salida se afila');
});

test('sin dirección no hay contorno: 0, 1 o N puntos clavados devuelven []', () => {
  const Freehand = F();
  assert.deepEqual([...Freehand.outline([], 4)], []);
  assert.deepEqual([...Freehand.outline([{ x: 5, y: 5 }], 4)], []);
  const clavados = Array.from({ length: 6 }, () => ({ x: 50, y: 50 }));
  assert.deepEqual([...Freehand.outline(clavados, 4)], []);
});

test('isValidElement ata `taper` al lápiz y solo en true (la ausencia es el clásico)', () => {
  const ctx = load('src/js/freehand.js', 'src/js/sketchy.js', 'src/js/arc.js',
    'src/js/curve-path.js', 'src/js/shape-rotation.js', 'src/js/regular-polygon.js',
    'src/js/trapezoid.js', 'src/js/airbrush.js', 'src/js/renderer.js', 'src/js/exporter.js');
  const { Exporter } = ctx;
  const pencil = { type: 'pencil', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    color: '#1a1a2e', lineWidth: 3 };
  assert.equal(Exporter.isValidElement({ ...pencil, taper: true }), true);
  assert.equal(Exporter.isValidElement({ ...pencil, taper: false }), false,
    'taper:false no se serializa — la ausencia ES el lápiz clásico');
  assert.equal(Exporter.isValidElement(
    { type: 'line', x1: 0, y1: 0, x2: 9, y2: 9, color: '#1a1a2e', lineWidth: 2, taper: true },
  ), false, 'taper suelto en otro tipo es basura serializada');
});

test('el SVG de un lápiz con presión es un polígono relleno, no una polilínea trazada', () => {
  const ctx = load('src/js/freehand.js', 'src/js/sketchy.js', 'src/js/arc.js',
    'src/js/curve-path.js', 'src/js/shape-rotation.js', 'src/js/regular-polygon.js',
    'src/js/trapezoid.js', 'src/js/airbrush.js', 'src/js/renderer.js', 'src/js/exporter.js');
  const { Exporter } = ctx;
  const el = { type: 'pencil', points: gesto(), color: '#4361ee', lineWidth: 5,
    taper: true, seed: 3 };
  Exporter.svg([el]);
  const svg = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  const m = svg.match(/<path d="M[^"]+Z" fill="#4361ee" stroke="none"\/>/);
  assert.ok(m, 'debe salir un path cerrado con fill y sin stroke');
  // Y el clásico sigue saliendo trazado, como siempre.
  const clasico = { ...el };
  delete clasico.taper;
  Exporter.svg([clasico]);
  const out = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  assert.ok(/stroke="#4361ee"/.test(out) && !/fill="#4361ee"/.test(out));
});

test('el suavizado no aleja la tinta del eje crudo más que un tope fijo', () => {
  // Un `pencil` importado puede traer puntos dispersos (isValidElement no
  // exige densidad), y el retraso del streamline era proporcional a la
  // separación: en una esquina de segmentos largos la tinta quedaba a ~9 px
  // del eje contra el que miden bounds, hit-test y el borrador (auditoría
  // v2.39.1). LAG_MAX lo acota: contorno ≤ lineWidth/2 + tope del eje crudo.
  const Freehand = F();
  const eje = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  const lw = 4;
  const poly = Freehand.outline(eje, lw);
  const dSeg = (p, a, b) => {
    const vx = b.x - a.x, vy = b.y - a.y;
    const t = Math.max(0, Math.min(1,
      ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
  };
  const desv = Math.max(...poly.map(p =>
    Math.min(dSeg(p, eje[0], eje[1]), dSeg(p, eje[1], eje[2]))));
  assert.ok(desv <= lw / 2 + 2 + 0.5,
    `el contorno se aleja ${desv.toFixed(2)} px del eje crudo (tope: ${lw / 2 + 2})`);
});

test('halfWidths es paralelo a los puntos, acotado, y más fino donde el gesto corre', () => {
  const Freehand = F();
  const pts = gesto();
  const halfs = Freehand.halfWidths(pts, 6);
  assert.equal(halfs.length, pts.length, 'un semiancho por punto crudo');
  assert.ok(halfs.every(h => h > 0 && h <= 3 + 1e-9), 'acotado por lineWidth/2');
  // El gesto acelera hacia el final: el tramo rápido es más fino que el lento.
  const lento = halfs[Math.floor(pts.length * 0.3)];
  const rapido = halfs[pts.length - 3];
  assert.ok(rapido < lento, `rápido (${rapido.toFixed(2)}) < lento (${lento.toFixed(2)})`);
  // Sin trazo útil no hay semianchos.
  assert.equal(Freehand.halfWidths([{ x: 1, y: 1 }], 6), null);
});
