'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { load, createCtxStub } = require('./helpers/load.js');

const ctx = load('src/js/sketchy.js', 'src/js/renderer.js', 'src/js/exporter.js');
const { RegularPolygon, Renderer, Exporter } = ctx;
const base = { x: 20, y: 30, w: 100, h: 100, color: '#333344', lineWidth: 2, seed: 4 };

test('RegularPolygon reconoce cuadrado, triángulo, pentágono y hexágono', () => {
  assert.equal(RegularPolygon.isType('square'), true);
  assert.equal(RegularPolygon.isType('triangle'), true);
  assert.equal(RegularPolygon.isType('pentagon'), true);
  assert.equal(RegularPolygon.isType('hexagon'), true);
  assert.equal(RegularPolygon.isType('circle'), false);
});

test('RegularPolygon genera el número correcto de vértices y lados iguales', () => {
  for (const [type, count] of [['square', 4], ['triangle', 3], ['pentagon', 5], ['hexagon', 6]]) {
    const vertices = RegularPolygon.vertices({ ...base, type });
    assert.equal(vertices.length, count);
    const lengths = vertices.map((p, i) => {
      const q = vertices[(i + 1) % vertices.length];
      return Math.hypot(q.x - p.x, q.y - p.y);
    });
    lengths.forEach(length => assert.ok(Math.abs(length - lengths[0]) < 1e-9));
    if (type !== 'square') {
      assert.ok(Math.abs(vertices[0].x - 70) < 1e-9, 'primer vértice centrado arriba');
      assert.ok(Math.abs(vertices[0].y - 30) < 1e-9);
    }
  }
});

test('El cuadrado nace horizontal y al girar 45° se convierte en rombo', () => {
  const initial = RegularPolygon.vertices({ ...base, type: 'square' });
  const rotated = RegularPolygon.vertices({ ...base, type: 'square', rotation: 45 });
  const eps = 1e-9;
  assert.ok(Math.abs(initial[0].y - initial[3].y) < eps, 'lado superior horizontal');
  assert.ok(Math.abs(initial[0].x - initial[1].x) < eps, 'lado derecho vertical');
  assert.ok(Math.abs(rotated[0].x - 120) < eps, 'vértice derecho del rombo');
  assert.ok(Math.abs(rotated[1].y - 130) < eps, 'vértice inferior del rombo');
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

/* ── Estrellas regulares (v2.23.0) ──────────────────────────────────────────
   Viven dentro de RegularPolygon: su silueta es un polígono cóncavo más, con
   el doble de vértices que puntas. Todo lo demás —hit-test, borrador, relleno,
   solapamiento, giro, w===h, SVG/HTML/JSON— lo heredan de ahí sin código
   propio, así que estas guardas cubren justamente lo único que es suyo: dónde
   caen los vértices. */

test('RegularPolygon reconoce las estrellas y las cuenta como polígonos', () => {
  for (const [type, puntas] of [['star5', 5], ['star6', 6]]) {
    assert.equal(RegularPolygon.isType(type), true);
    assert.equal(RegularPolygon.isStar(type), true);
    assert.equal(RegularPolygon.points(type), puntas);
    // `sides` son los lados de la SILUETA, que es lo que consulta vertices():
    // una estrella alterna radio exterior e interior, así que tiene el doble.
    assert.equal(RegularPolygon.sides(type), puntas * 2);
  }
  assert.equal(RegularPolygon.isStar('pentagon'), false);
  assert.equal(RegularPolygon.points('hexagon'), 0);
});

test('Las estrellas alternan radio exterior e interior, con una punta arriba', () => {
  const cx = base.x + base.w / 2, cy = base.y + base.h / 2;
  for (const [type, puntas, ratio] of [['star5', 5, 0.3819660112], ['star6', 6, 0.5773502692]]) {
    const v = RegularPolygon.vertices({ ...base, type });
    assert.equal(v.length, puntas * 2);
    v.forEach((p, i) => {
      const r = Math.hypot(p.x - cx, p.y - cy);
      const esperado = i % 2 ? 50 * ratio : 50;
      assert.ok(Math.abs(r - esperado) < 1e-6,
        `${type}: el vértice ${i} debería estar a ${esperado}, está a ${r}`);
    });
    // Nace de punta arriba, como el resto de polígonos (el cuadrado aparte).
    assert.ok(Math.abs(v[0].x - cx) < 1e-9 && Math.abs(v[0].y - (cy - 50)) < 1e-9,
      `${type}: la primera punta va centrada arriba`);
  }
});

// La propiedad que distingue la estrella CLÁSICA de una flor de pétalos
// rectos: prolongar el lado de una punta lleva exactamente a otra punta. Es lo
// único que fija el radio interior, así que es la guarda que hay que romper si
// alguien "redondea" innerRatio a 0.38 o 0.5.
test('El radio interior es el canónico: el lado de una punta apunta a otra punta', () => {
  for (const [type, salto] of [['star5', 4], ['star6', 4]]) {
    const v = RegularPolygon.vertices({ ...base, type });
    const a = v[0];                       // punta de arriba
    const b = v[1];                       // vértice interior contiguo
    const c = v[salto];                   // la punta a la que debe apuntar
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const escala = Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - a.x, c.y - a.y);
    assert.ok(Math.abs(cross) / escala < 1e-9,
      `${type}: el lado de la punta debe prolongarse hasta otra punta`);
  }
});

test('El contains de una estrella deja fuera los huecos entre puntas', () => {
  for (const type of ['star5', 'star6']) {
    const star = { ...base, type };
    assert.equal(RegularPolygon.contains({ x: 70, y: 80 }, star), true, 'el centro es interior');
    // Media altura, pegado al borde de la caja: ahí solo hay hueco entre dos
    // puntas. Con el bbox por silueta —el error fácil— saldría `true`.
    assert.equal(RegularPolygon.contains({ x: 21, y: 80 }, star), false);
    assert.equal(RegularPolygon.contains({ x: 22, y: 32 }, star), false, 'esquina del bbox');
  }
});

test('Renderer, borrador y solapamiento tratan la estrella como una forma más', () => {
  for (const [type, lados] of [['star5', 10], ['star6', 12]]) {
    const canvas = createCtxStub();
    Renderer.renderElement(canvas, { ...base, type, fill: true, fillColor: '#e94560' });
    assert.equal(canvas.callsTo('stroke').length, lados, `${type}: un trazo por lado`);
    assert.equal(canvas.callsTo('fill').length, 1);
    const star = { ...base, type, fill: true };
    assert.equal(Renderer.isOverlapShape(star), true);
    assert.equal(Renderer.pointInOverlapShape({ x: 70, y: 80 }, star), true);
    assert.equal(Renderer.pointInOverlapShape({ x: 21, y: 80 }, star), false);
  }
});

test('Exporter valida, exporta y reimporta las estrellas', () => {
  for (const type of ['star5', 'star6']) {
    const star = { ...base, type };
    assert.equal(Exporter.isValidElement(star), true);
    assert.equal(Exporter.isValidElement({ ...star, rotation: 36 }), true);
    // Caja cuadrada obligatoria, igual que el resto de polígonos regulares.
    assert.equal(Exporter.isValidElement({ ...star, h: 80 }), false);
  }
  const elements = [{ ...base, type: 'star5' }, { ...base, type: 'star6', x: 150 }];
  Exporter.svg(elements);
  const svg = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  assert.equal((svg.match(/<polygon /g) || []).length, 2);
  // 10 y 12 vértices: si alguien las exportara como un polígono convexo, el
  // recuento de pares delataría el atajo.
  const puntos = [...svg.matchAll(/<polygon points="([^"]+)"/g)]
    .map(m => m[1].trim().split(/\s+/).length);
  assert.deepEqual(puntos, [10, 12]);

  Exporter.html(elements);
  const html = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  assert.equal((html.match(/<polygon /g) || []).length, 2);
});

test('Renderer dibuja 3/5/6 lados y aplica relleno cuando corresponde', () => {
  for (const [type, count] of [['square', 4], ['triangle', 3], ['pentagon', 5], ['hexagon', 6]]) {
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
    { ...base, type: 'square' },
    { ...base, type: 'triangle', x: 150 },
    { ...base, type: 'pentagon', x: 280 },
    { ...base, type: 'hexagon', x: 410 },
  ];
  Exporter.svg(elements);
  const svg = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  assert.equal((svg.match(/<polygon /g) || []).length, 4);

  Exporter.html(elements);
  const html = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  assert.equal((html.match(/<polygon /g) || []).length, 4);
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
