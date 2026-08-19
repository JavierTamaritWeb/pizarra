'use strict';
/* ============================================================
   hatch.test.js — Rellenos tramados (src/js/hatch.js, v3.11.0).

   El módulo es geometría pura: aquí se comprueban las propiedades que hacen
   que la trama se comporte como un dibujo y no como un patrón de imprenta —
   determinismo, que no se salga de la figura y, sobre todo, que no HIERVA al
   redimensionar (la lección del aerógrafo).
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll } = require('./helpers/load.js');

const { Hatch, RegularPolygon } = loadAll();

const rect = (extra = {}) => ({
  type: 'rect', x: 100, y: 100, w: 200, h: 140,
  color: '#333344', lineWidth: 2, fill: true, seed: 42, ...extra,
});

/** ¿Está el punto dentro del polígono? (ray casting, como el propio módulo) */
function dentro(poly, p) {
  let d = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) d = !d;
  }
  return d;
}

test('sin fillPattern la geometría es vacía: la ausencia es el relleno plano', () => {
  assert.equal(Hatch.geometry(rect()).lines.length, 0);
  assert.equal(Hatch.geometry(rect()).dots.length, 0);
  // Y un patrón inventado tampoco dibuja nada (no cae en el rayado por error).
  assert.equal(Hatch.geometry(rect({ fillPattern: 'rayas' })).lines.length, 0);
});

test('la trama es determinista: mismo elemento, misma geometría', () => {
  for (const p of Hatch.PATTERNS) {
    const a = JSON.stringify(Hatch.geometry(rect({ fillPattern: p })));
    const b = JSON.stringify(Hatch.geometry(rect({ fillPattern: p })));
    assert.equal(a, b, `el patrón ${p} no es determinista`);
  }
});

test('la semilla cambia la trama: dos formas iguales no salen calcadas', () => {
  const a = JSON.stringify(Hatch.geometry(rect({ fillPattern: 'hachure', seed: 1 })));
  const b = JSON.stringify(Hatch.geometry(rect({ fillPattern: 'hachure', seed: 2 })));
  assert.notEqual(a, b);
});

test('ninguna línea ni punto se sale de la figura', () => {
  // Una estrella es el caso duro: cóncava, así que un barrido ingenuo
  // atravesaría los huecos entre puntas.
  const estrella = {
    type: 'star5', x: 100, y: 100, w: 200, h: 200,
    color: '#333344', lineWidth: 2, fill: true, seed: 9, fillPattern: 'hachure',
  };
  const poly = RegularPolygon.vertices(estrella);
  const g = Hatch.geometry(estrella);
  assert.ok(g.lines.length > 4, 'la estrella tiene que llevar rayado');
  for (const l of g.lines) {
    for (const p of [{ x: l.x1, y: l.y1 }, { x: l.x2, y: l.y2 },
                     { x: (l.x1 + l.x2) / 2, y: (l.y1 + l.y2) / 2 }]) {
      assert.ok(dentro(poly, p),
        `un tramo del rayado se sale de la estrella: ${JSON.stringify(p)}`);
    }
  }
  const puntos = Hatch.geometry({ ...estrella, fillPattern: 'dots' }).dots;
  assert.ok(puntos.length > 4);
  for (const d of puntos) assert.ok(dentro(poly, d), 'un punto cae fuera');
});

test('agrandar la figura AÑADE líneas sin mover las que ya estaban', () => {
  // La prueba anti-«boiling»: con una secuencia aleatoria en vez de un hash
  // por línea, cambiar el número de líneas re-tira todas y la trama hierve
  // mientras se redimensiona. Se compara alrededor del centro, que es donde
  // está anclada la rejilla.
  const chico = Hatch.geometry(rect({ fillPattern: 'hachure' }));
  const grande = Hatch.geometry(rect({ fillPattern: 'hachure', w: 300, h: 220 }));
  assert.ok(grande.lines.length > chico.lines.length, 'al crecer tiene que añadir');

  // Cada línea del pequeño tiene que existir en el grande con la MISMA
  // inclinación y a la misma distancia del centro (su longitud sí cambia:
  // la figura es más ancha).
  const clave = (l, c) => {
    const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
    const ang = Math.atan2(dy, dx);
    // Distancia con signo del centro a la recta.
    const n = { x: -Math.sin(ang), y: Math.cos(ang) };
    return ((l.x1 - c.x) * n.x + (l.y1 - c.y) * n.y).toFixed(2);
  };
  const cChico = { x: 200, y: 170 };            // centro de la caja pequeña
  const cGrande = { x: 250, y: 210 };
  const enGrande = new Set(grande.lines.map(l => clave(l, cGrande)));
  const conservadas = chico.lines.filter(l => enGrande.has(clave(l, cChico))).length;
  assert.ok(conservadas / chico.lines.length > 0.8,
    `solo ${conservadas} de ${chico.lines.length} líneas siguen en su sitio: la trama hierve`);
});

test('el cruzado son DOS direcciones y el rayado una sola', () => {
  const dir = g => new Set(g.lines.map(l => {
    const a = Math.atan2(l.y2 - l.y1, l.x2 - l.x1);
    return Math.round(((a % Math.PI) + Math.PI) % Math.PI * 4 / Math.PI);
  }));
  assert.equal(dir(Hatch.geometry(rect({ fillPattern: 'hachure' }))).size, 1);
  assert.equal(dir(Hatch.geometry(rect({ fillPattern: 'cross-hatch' }))).size, 2);
});

test('el grosor separa la trama: más gordo, menos líneas', () => {
  const fino = Hatch.geometry(rect({ fillPattern: 'hachure', lineWidth: 1 }));
  const gordo = Hatch.geometry(rect({ fillPattern: 'hachure', lineWidth: 8 }));
  assert.ok(fino.lines.length > gordo.lines.length,
    'la separación tiene que crecer con el grosor');
});

test('el contorno de la trama es el de cada tipo, no siempre la caja', () => {
  // Si `outline` cayera al rectángulo para todos, la trama de un círculo
  // llenaría las esquinas — que es exactamente como se ve el fallo.
  const circulo = { type: 'circle', x: 0, y: 0, w: 100, h: 100, color: '#000000', lineWidth: 2 };
  const puntos = Hatch.outline(circulo);
  assert.ok(puntos.length > 8, 'el círculo se muestrea, no son 4 esquinas');
  for (const p of puntos) {
    const d = Math.hypot(p.x - 50, p.y - 50);
    assert.ok(Math.abs(d - 50) < 1e-6, 'los puntos están sobre la circunferencia');
  }
  // Y una figura sin superficie no tiene contorno que tramar.
  assert.equal(Hatch.outline({ type: 'line', x1: 0, y1: 0, x2: 10, y2: 10 }).length, 0);
  assert.equal(Hatch.outline({ type: 'rect', x: 0, y: 0, w: 0, h: 10 }).length, 0);
});

test('una figura enorme con trama fina no se dispara', () => {
  // Cota de seguridad: sin ella, el repintado se cuelga en vez de dibujar.
  const g = Hatch.geometry({
    type: 'rect', x: 0, y: 0, w: 100000, h: 100000,
    color: '#000000', lineWidth: 1, fill: true, seed: 3, fillPattern: 'hachure',
  });
  assert.ok(g.lines.length < 500, `${g.lines.length} líneas es demasiado`);
});
