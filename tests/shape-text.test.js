'use strict';
/* ============================================================
   shape-text.test.js — Texto dentro de una forma (src/js/shape-text.js, v3.28.0).

   El módulo es geometría y reparto puros con la medida INYECTADA: aquí se
   comprueban la caja inscrita de cada forma (como el cuadro de texto de
   Word), el ajuste por palabras y la reducción de la letra hasta que cabe.
   La medida sintética hace el ancho proporcional al tamaño de letra, que es
   lo que hace real la reducción; la del navegador la cubre el e2e.
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll } = require('./helpers/load.js');
const { createCtxStub } = require('./helpers/ctx-stub.js');

const { ShapeText, RegularPolygon, Renderer } = loadAll();

/** Ancho sintético: medio «em» por carácter. */
const pxOf = font => parseFloat((String(font).match(/(\d+(?:\.\d+)?)px/) || [0, 0])[1]);
const measure = (t, font) => String(t).length * pxOf(font) * 0.5;

const forma = (type, extra = {}) => ({
  type, x: 100, y: 100, w: 200, h: 140, color: '#333344', lineWidth: 2, fill: false, ...extra,
});
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('la caja de un rectángulo es la caja entera menos el margen', () => {
  const box = ShapeText.innerBox(forma('rect'));
  cerca(box.x, 104, 1, 'x');
  cerca(box.y, 104, 1, 'y');
  cerca(box.w, 192, 1, 'w');
  cerca(box.h, 132, 1, 'h');
});

test('en un óvalo la caja inscrita es ≈ 0,707 de la caja, centrada', () => {
  const el = forma('circle');
  const box = ShapeText.innerBox(el);
  const k = (box.w + ShapeText.PAD * 2) / el.w;
  cerca(k, Math.SQRT1_2, 0.02, 'proporción');
  cerca(box.x + box.w / 2, 200, 1, 'centro x');
  cerca(box.y + box.h / 2, 170, 1, 'centro y');
});

test('en un triángulo y una estrella la caja cabe entera dentro de la silueta y es menor que la caja', () => {
  for (const type of ['triangle', 'star5', 'pentagon']) {
    const el = forma(type, { w: 200, h: 200, seed: 1 });
    const box = ShapeText.innerBox(el);
    assert.ok(box, `${type}: hay caja`);
    assert.ok(box.w < 200 - ShapeText.PAD * 2, `${type}: menor que la caja`);
    for (const [px, py] of [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h],
      [box.x + box.w, box.y + box.h], [box.x + box.w / 2, box.y], [box.x + box.w / 2, box.y + box.h]]) {
      assert.ok(RegularPolygon.contains({ x: px, y: py }, el), `${type}: (${px},${py}) dentro`);
    }
  }
  const estrella = ShapeText.innerBox(forma('star5', { w: 200, h: 200 }));
  assert.ok(estrella.w < 100, `la estrella deja poco sitio: ${estrella.w}`);
  // En el triángulo la caja baja hacia la base, donde hay sitio (centroide),
  // y por eso es más ancha que centrada en la caja.
  const tri = ShapeText.innerBox(forma('triangle', { w: 200, h: 200 }));
  assert.ok(tri.y + tri.h / 2 > 200, `centrada por debajo del centro de la caja: ${tri.y + tri.h / 2}`);
  assert.ok(tri.w > 60, `ancha, no la cajita centrada de 50: ${tri.w}`);
});

test('un pentágono girado cambia de caja, y la nueva sigue dentro', () => {
  const recto = ShapeText.innerBox(forma('pentagon', { w: 200, h: 200 }));
  const girado = forma('pentagon', { w: 200, h: 200, rotation: 15 });
  const box = ShapeText.innerBox(girado);
  assert.notDeepEqual([box.w, box.h].map(Math.round), [recto.w, recto.h].map(Math.round));
  assert.ok(RegularPolygon.contains({ x: box.x, y: box.y }, girado));
  assert.ok(RegularPolygon.contains({ x: box.x + box.w, y: box.y + box.h }, girado));
});

test('wrap reparte por palabras, respeta los saltos y corta la palabra que no cabe', () => {
  const width = t => t.length * 10;
  assert.deepEqual([...ShapeText.wrap('hola que tal', 90, width)], ['hola que', 'tal']);
  assert.deepEqual([...ShapeText.wrap('hola que tal', 55, width)], ['hola', 'que', 'tal']);
  assert.deepEqual([...ShapeText.wrap('uno\ndos tres', 200, width)], ['uno', 'dos tres']);
  assert.deepEqual([...ShapeText.wrap('abcdefghijkl', 50, width)], ['abcde', 'fghij', 'kl']);
  assert.deepEqual([...ShapeText.wrap('a\n\nb', 50, width)], ['a', '', 'b'], 'una línea en blanco se conserva');
});

test('layout centra una línea corta en la caja con el tamaño pedido', () => {
  const lay = ShapeText.layout(forma('rect', { label: 'Hola', labelSize: 24 }), measure);
  assert.equal(lay.size, 24);
  assert.equal(lay.lines.length, 1);
  assert.equal(lay.lines[0].text, 'Hola');
  cerca(lay.lines[0].x, 200, 0.5, 'x centrado');
  cerca(lay.lines[0].y, 170, 0.5, 'y centrado');
  assert.match(lay.font, /^24px /);
});

test('sin labelSize se usa el tamaño de fábrica de Texto', () => {
  const lay = ShapeText.layout(forma('rect', { label: 'Hola' }), measure);
  assert.equal(lay.size, ShapeText.DEFAULT_SIZE);
});

test('un texto largo baja de tamaño hasta caber, y nunca por debajo del mínimo', () => {
  const largo = 'palabra '.repeat(30).trim();
  const lay = ShapeText.layout(forma('rect', { label: largo, labelSize: 18 }), measure);
  assert.ok(lay.size < 18, `se redujo: ${lay.size}`);
  assert.ok(lay.size >= ShapeText.MIN_SIZE);
  assert.ok(lay.lines.length * (lay.size + ShapeText.LEADING) <= lay.box.h, 'cabe en alto');
  assert.ok(lay.lines.every(ln => measure(ln.text, lay.font) <= lay.box.w), 'cabe en ancho');

  const absurdo = 'x'.repeat(5000);
  const min = ShapeText.layout(forma('circle', { label: absurdo }), measure);
  assert.equal(min.size, ShapeText.MIN_SIZE, 'al mínimo aunque no quepa');
});

test('sin texto, con texto en blanco o en un tipo sin texto no hay layout', () => {
  assert.equal(ShapeText.layout(forma('rect'), measure), null);
  assert.equal(ShapeText.layout(forma('rect', { label: '   ' }), measure), null);
  assert.equal(ShapeText.layout({ type: 'arrow', x1: 0, y1: 0, x2: 9, y2: 9, label: 'x' }, measure), null);
  assert.equal(ShapeText.hasLabel(forma('rect', { label: 'x' })), true);
  assert.equal(ShapeText.isType('polygon'), false, 'el polígono libre no lleva texto');
});

test('el renderer pinta el texto centrado solo cuando la forma lo tiene', () => {
  const sin = createCtxStub();
  Renderer.renderElement(sin, forma('rect', { seed: 1 }));
  assert.equal(sin.callsTo('fillText').length, 0, 'sin texto no hay fillText: dibujo idéntico al de siempre');

  const con = createCtxStub();
  Renderer.renderElement(con, forma('circle', { seed: 1, label: 'Hola mundo', labelSize: 20 }));
  const textos = con.callsTo('fillText');
  assert.ok(textos.length >= 1, 'con texto sí');
  assert.equal(con.callsTo('set textAlign').pop().args[0], 'center');
  assert.equal(con.callsTo('set textBaseline').pop().args[0], 'middle');

  // La pasada de «solo contorno» (bordes ocultos, borrador) no lo repite.
  const contorno = createCtxStub();
  Renderer.renderElement(contorno, forma('circle', { seed: 1, label: 'Hola' }), { shapeFill: false });
  assert.equal(contorno.callsTo('fillText').length, 0);
});

/* ── Estilo propio del texto (v3.29.0) ── */

test('alineación, negrita, color y letra propios entran en el layout; su ausencia es lo de siempre', () => {
  const base = forma('rect', { label: 'Hola', labelSize: 20 });
  const def = ShapeText.layout(base, measure);
  assert.equal(def.align, 'center');
  assert.equal(def.valign, 'middle');
  assert.equal(def.bold, false);
  assert.equal(def.color, '#333344', 'sin color propio, el del trazo');
  assert.equal(def.family, ShapeText.family(base));

  const izq = ShapeText.layout({ ...base, labelAlign: 'left', labelValign: 'top' }, measure);
  cerca(izq.lines[0].x, def.box.x, 0.5, 'a la izquierda arranca en el borde de la caja');
  cerca(izq.lines[0].y, def.box.y + (20 + ShapeText.LEADING) / 2, 0.5, 'arriba: primera línea pegada al techo');
  const der = ShapeText.layout({ ...base, labelAlign: 'right', labelValign: 'bottom' }, measure);
  cerca(der.lines[0].x, def.box.x + def.box.w, 0.5, 'a la derecha acaba en el borde');
  cerca(der.lines[0].y, def.box.y + def.box.h - (20 + ShapeText.LEADING) / 2, 0.5, 'abajo: pegada al suelo');

  const neg = ShapeText.layout({ ...base, labelBold: true, labelColor: '#ff0000', labelFont: 'caveat' }, measure);
  assert.equal(neg.bold, true);
  assert.match(neg.font, /^bold 20px /);
  assert.equal(neg.color, '#ff0000');
  assert.notEqual(neg.family, def.family, 'la letra pedida no es la del lienzo');
  assert.ok(neg.font.includes(neg.family));
  // Un valor desconocido cae al de siempre, no rompe
  assert.equal(ShapeText.layout({ ...base, labelAlign: 'justify' }, measure).align, 'center');
});

test('el renderer respeta alineación y color propios', () => {
  const ctx = createCtxStub();
  Renderer.renderElement(ctx, forma('rect', { seed: 1, label: 'Hola', labelAlign: 'right', labelColor: '#00ff00', labelBold: true }));
  assert.equal(ctx.callsTo('set textAlign').pop().args[0], 'right');
  assert.equal(ctx.callsTo('set fillStyle').pop().args[0], '#00ff00');
  assert.match(ctx.callsTo('set font').pop().args[0], /^bold /);
});
