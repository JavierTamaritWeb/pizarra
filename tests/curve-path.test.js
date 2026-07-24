'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { load, createCtxStub } = require('./helpers/load.js');

const ctx = load('js/sketchy.js', 'js/renderer.js', 'js/exporter.js');
const { CurvePath, Renderer, Exporter } = ctx;

const segments = [
  { x1: 10, y1: 20, cx: 35, cy: 0, x2: 60, y2: 20 },
  { x1: 60, y1: 20, cx: 85, cy: 50, x2: 110, y2: 20 },
  { x1: 110, y1: 20, cx: 135, cy: -10, x2: 160, y2: 20 },
];
const chain = {
  type: 'curveArrow',
  x1: 10, y1: 20, x2: 160, y2: 20,
  segments,
  color: '#333344',
  lineWidth: 2,
  seed: 7,
};

test('CurvePath: normaliza curvas antiguas y reconoce cadenas', () => {
  const old = { type: 'curveArrow', x1: 0, y1: 0, cx: 50, cy: 80, x2: 100, y2: 0 };
  assert.equal(CurvePath.isChain(old), false);
  assert.equal(CurvePath.segments(old).length, 1);
  assert.equal(CurvePath.isChain(chain), true);
  assert.equal(CurvePath.segments(chain).length, 3);
});

test('CurvePath: mover y escalar conserva continuidad y no muta el original', () => {
  const moved = CurvePath.move(chain, 5, -3);
  assert.equal(moved.segments[0].x1, 15);
  assert.equal(moved.segments[0].y1, 17);
  assert.equal(moved.segments[0].x2, moved.segments[1].x1);
  assert.equal(moved.x2, 165);
  assert.equal(chain.x1, 10);

  const scaled = CurvePath.scale(chain, x => x * 2, y => y + 10);
  assert.equal(scaled.x1, 20);
  assert.equal(scaled.segments[1].x1, scaled.segments[0].x2);
  assert.equal(scaled.segments[2].cy, 0);
});

test('CurvePath: mover una unión mantiene unidos ambos tramos y desplaza controles vecinos', () => {
  const changed = CurvePath.withJoin(chain, 0, { x: 70, y: 30 });
  assert.equal(changed.segments[0].x2, 70);
  assert.equal(changed.segments[0].y2, 30);
  assert.equal(changed.segments[1].x1, 70);
  assert.equal(changed.segments[1].y1, 30);
  assert.equal(changed.segments[0].cx, 45);
  assert.equal(changed.segments[1].cx, 95);
});

test('CurvePath: invertir cambia orden y dirección sin perder continuidad', () => {
  const reversed = CurvePath.reverse(chain);
  assert.equal(reversed.x1, 160);
  assert.equal(reversed.y1, 20);
  assert.equal(reversed.x2, 10);
  assert.equal(reversed.segments[0].x2, reversed.segments[1].x1);
  assert.equal(reversed.segments[2].x2, 10);
});

test('CurvePath.isValidSegments exige continuidad y limita el número de tramos', () => {
  const isNum = n => typeof n === 'number' && Number.isFinite(n);
  assert.equal(CurvePath.isValidSegments(segments, isNum), true);
  const broken = segments.map(s => ({ ...s }));
  broken[1].x1++;
  assert.equal(CurvePath.isValidSegments(broken, isNum), false);
  assert.equal(CurvePath.isValidSegments([], isNum), false);
  assert.equal(
    CurvePath.isValidSegments(Array.from({ length: 201 }, (_, i) => ({
      x1: i, y1: 0, cx: i + 0.5, cy: 1, x2: i + 1, y2: 0,
    })), isNum),
    false
  );
});

test('Renderer: una cadena dibuja todos los tramos y una sola punta final', () => {
  const canvas = createCtxStub();
  Renderer.renderElement(canvas, chain);
  assert.equal(canvas.callsTo('stroke').length, 5, '3 curvas + 2 líneas de punta');
  const moveTos = canvas.callsTo('moveTo');
  assert.deepEqual(moveTos[3].args, [160, 20]);
  assert.deepEqual(moveTos[4].args, [160, 20]);
});

test('Exporter valida una cadena y SVG concatena Q con una sola punta', () => {
  assert.equal(Exporter.isValidElement(chain), true);
  assert.equal(Exporter.isValidElement({ ...chain, x2: 999 }), false);
  assert.equal(Exporter.isValidElement({
    ...chain,
    segments: chain.segments.map((s, i) => i === 1 ? { ...s, x1: 61 } : s),
  }), false);

  Exporter.svg([chain]);
  const svg = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  assert.match(svg, /M10 20 Q35 0 60 20 Q85 50 110 20 Q135 -10 160 20/);
  assert.equal((svg.match(/<path /g) || []).length, 1);
  assert.equal((svg.match(/<line /g) || []).length, 2);
});

test('Exporter JSON/import conserva todos los tramos de la cadena', async () => {
  Exporter.json([chain]);
  const json = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  const promise = Exporter.importJSON();
  const input = ctx.document.created[ctx.document.created.length - 1];
  input.onchange({ target: { files: [{ text: json }] } });
  const imported = await promise;
  assert.equal(imported.length, 1);
  assert.equal(imported[0].segments.length, 3);
  assert.equal(imported[0].segments[2].x2, 160);
});
