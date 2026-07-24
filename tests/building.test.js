'use strict';
/* ============================================================
   building.test.js — Geometría de la sección "Edificios" (js/building.js).
   Todas las herramientas son de creación: producen rect/line existentes.
   Ejecutar: node --test tests/building.test.js
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll, createCtxStub } = require('./helpers/load.js');

const ctx = loadAll();
const { Building, TOOLS, BUILDING_TOOLS, Renderer } = ctx;
const O = { color: '#123456', lineWidth: 3 };
const P1 = { x: 100, y: 100 }, P2 = { x: 300, y: 260 };
const planta = (shape, p1 = { x: 0, y: 0 }, p2 = P2) =>
  Building.elements(TOOLS.BUILD_PLANTA, p1, p2, { ...O, plantaShape: shape });

test('Building.elements existe', () => {
  assert.equal(typeof Building.elements, 'function');
});

test('planta rectangular / sin forma → un rect sin relleno, sin seed', () => {
  const a = planta('rect');
  assert.equal(a.length, 1);
  assert.equal(a[0].type, 'rect');
  assert.equal(a[0].fill, false);
  assert.equal(a[0].seed, undefined);        // el seed lo pone app.js (withSeeds)
  const b = Building.elements(TOOLS.BUILD_PLANTA, P1, P2, O); // sin plantaShape → rect
  assert.equal(b.length, 1);
  assert.equal(b[0].type, 'rect');
});

test('planta en U → polilínea cerrada de 8 líneas', () => {
  const els = planta('u');
  assert.equal(els.length, 8);
  assert.ok(els.every(e => e.type === 'line'));
});

test('planta en L → polilínea cerrada de 6 líneas', () => {
  assert.equal(planta('l').length, 6);
});

test('planta claustro → dos rects (exterior + patio interior menor)', () => {
  const els = planta('claustro');
  assert.equal(els.length, 2);
  assert.ok(els.every(e => e.type === 'rect'));
  assert.ok(els[1].w < els[0].w && els[1].h < els[0].h);
});

test('el shape no se filtra dentro de los elementos', () => {
  for (const el of planta('u')) assert.equal(el.plantaShape, undefined);
});

test('fachada: cornisa + muro + ventanas verticales + detalle', () => {
  const els = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 180, y: 240 }, O);
  assert.equal(els[0].type, 'rect');                            // cornisa
  const rects = els.filter(e => e.type === 'rect');
  assert.ok(rects.some(r => r.h > r.w), 'debe haber ventanas verticales');
  assert.ok(els.some(e => e.type === 'line'), 'montantes/alféizares/rasante');
});

test('fachada: puerta centrada apoyada en la base', () => {
  const els = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 180, y: 240 }, O);
  const door = els.find(e => e.type === 'rect' && e.w < 60
    && Math.abs((e.x + e.w / 2) - 90) < 4 && Math.abs((e.y + e.h) - 240) < 2);
  assert.ok(door, 'debe haber una puerta centrada en la planta baja');
});

test('alzado: cuerpo + tejado a dos aguas (ápice) con tejas + ventanas y puerta', () => {
  const els = Building.elements(TOOLS.BUILD_ALZADO, { x: 0, y: 0 }, { x: 120, y: 300 }, O);
  const lines = els.filter(e => e.type === 'line');
  assert.ok(els.filter(e => e.type === 'rect').length >= 2);   // cuerpo + ventanas/puerta
  assert.ok(lines.some(l => l.x2 === 60 && l.y2 === 0));       // ápice arriba-centro
  assert.ok(lines.length >= 4);                               // 2 faldones + ≥1 teja
});

test('perfil ≠ alzado: perfil con cumbrera horizontal, alzado con ápice puntual', () => {
  const p2 = { x: 120, y: 300 };
  const alz = Building.elements(TOOLS.BUILD_ALZADO, { x: 0, y: 0 }, p2, O).filter(e => e.type === 'line');
  const per = Building.elements(TOOLS.BUILD_PERFIL, { x: 0, y: 0 }, p2, O).filter(e => e.type === 'line');
  const cumbreraHoriz = ls => ls.some(l => l.y1 === 0 && l.y2 === 0 && l.x1 !== l.x2);
  assert.ok(!cumbreraHoriz(alz), 'el alzado no debe tener cumbrera horizontal (es un ápice)');
  assert.ok(cumbreraHoriz(per), 'el perfil debe tener cumbrera horizontal (tejado trapezoidal)');
});

test('puerta tipo "door": marco ajustado a la caja + dintel + junta', () => {
  const els = Building.elements(TOOLS.BUILD_DOOR, { x: 10, y: 20 }, { x: 70, y: 160 }, { ...O, doorType: 'door' });
  const frame = els.find(e => e.type === 'rect');
  assert.deepEqual(
    { x: frame.x, y: frame.y, w: frame.w, h: frame.h },
    { x: 10, y: 20, w: 60, h: 140 });
  assert.ok(els.filter(e => e.type === 'line').length >= 2); // dintel + junta
});

test('puerta tipo "arch": arco de medio punto hacia arriba + altura ajustable', () => {
  const els = Building.elements(TOOLS.BUILD_DOOR, { x: 0, y: 0 }, { x: 66, y: 140 }, { ...O, doorType: 'arch' });
  const arch = els.find(e => e.type === 'curveArrow');
  assert.ok(arch && arch.arc === true && arch.heads === 'none', 'debe haber un arco');
  const apexY = (arch.y1 + 3 * arch.cy + 3 * arch.cy2 + arch.y2) / 8;
  assert.ok(apexY < arch.y1, 'el arco debe combar hacia arriba');
  const alto = Building.elements(TOOLS.BUILD_DOOR, { x: 0, y: 0 }, { x: 66, y: 240 }, { ...O, doorType: 'arch' });
  assert.ok(alto.find(e => e.type === 'rect').h > els.find(e => e.type === 'rect').h, 'más alto → vano mayor');
});

test('puerta tipos "frame" y "archFrame": solo el marco (sin hoja)', () => {
  const p1 = { x: 0, y: 0 }, p2 = { x: 66, y: 140 };
  const frame = Building.elements(TOOLS.BUILD_DOOR, p1, p2, { ...O, doorType: 'frame' });
  assert.equal(frame.length, 1);
  assert.equal(frame[0].type, 'rect');                    // marco rectangular = un rect
  const archFull = Building.elements(TOOLS.BUILD_DOOR, p1, p2, { ...O, doorType: 'arch' });
  const archFrame = Building.elements(TOOLS.BUILD_DOOR, p1, p2, { ...O, doorType: 'archFrame' });
  assert.ok(archFull.some(e => e.type === 'rect'), 'arco con hoja: rect');
  assert.ok(!archFrame.some(e => e.type === 'rect'), 'arco solo marco: sin rect');
  assert.ok(archFrame.some(e => e.type === 'curveArrow'), 'arco solo marco: conserva el arco');
  assert.equal(archFrame.filter(e => e.type === 'line').length, 3, 'jambas + umbral');
});

test('ventana tipo "window": marco + montante en cruz + alféizar', () => {
  const els = Building.elements(TOOLS.BUILD_WINDOW, { x: 0, y: 0 }, { x: 80, y: 110 }, { ...O, windowType: 'window' });
  assert.ok(els.some(e => e.type === 'rect'), 'marco');
  assert.ok(els.filter(e => e.type === 'line').length >= 3, 'montante + travesaño + alféizar');
});

test('ventana tipo "arch": arco de medio punto hacia arriba + parte recta', () => {
  const els = Building.elements(TOOLS.BUILD_WINDOW, { x: 0, y: 0 }, { x: 80, y: 120 }, { ...O, windowType: 'arch' });
  const arch = els.find(e => e.type === 'curveArrow');
  assert.ok(arch && arch.arc === true && arch.heads === 'none', 'debe haber un arco');
  const apexY = (arch.y1 + 3 * arch.cy + 3 * arch.cy2 + arch.y2) / 8;
  assert.ok(apexY < arch.y1, 'el arco comba hacia arriba');
  assert.ok(els.some(e => e.type === 'rect'), 'parte recta');
});

test('ventana tipos "frame" y "archFrame": solo el marco (sin partición)', () => {
  const p1 = { x: 0, y: 0 }, p2 = { x: 80, y: 110 };
  const frame = Building.elements(TOOLS.BUILD_WINDOW, p1, p2, { ...O, windowType: 'frame' });
  assert.equal(frame.length, 1);
  assert.equal(frame[0].type, 'rect');
  const archFrame = Building.elements(TOOLS.BUILD_WINDOW, p1, p2, { ...O, windowType: 'archFrame' });
  assert.ok(!archFrame.some(e => e.type === 'rect'), 'arco solo marco: sin rect');
  assert.ok(archFrame.some(e => e.type === 'curveArrow'), 'conserva el arco');
  assert.equal(archFrame.filter(e => e.type === 'line').length, 3, 'jambas + dintel inferior');
});

test('tejados 2 aguas / 1 agua → contorno + tejas; plano → 1 rect', () => {
  const g = Building.elements(TOOLS.BUILD_ROOF2, P1, P2, O).filter(e => e.type === 'line');
  const m = Building.elements(TOOLS.BUILD_ROOF1, P1, P2, O).filter(e => e.type === 'line');
  assert.ok(g.length >= 4, 'tejado 2 aguas: 3 contorno + ≥1 teja');
  assert.ok(m.length >= 4, 'tejado 1 agua: 3 contorno + ≥1 teja');
  const flat = Building.elements(TOOLS.BUILD_ROOFF, P1, P2, O);
  assert.equal(flat.length, 1);
  assert.equal(flat[0].type, 'rect');
});

// Guarda de regresión (crítica adversarial #1): en cajas pequeñas el grosor de
// ala no debe degenerar la geometría (patios de w/h negativos, U/L cruzadas).
test('cajas pequeñas: sin rects de w/h ≤ 0 ni polilíneas U cruzadas', () => {
  const smalls = [
    [{ x: 0, y: 0 }, { x: 12, y: 10 }],
    [{ x: 0, y: 0 }, { x: 15, y: 15 }],
    [{ x: 0, y: 0 }, { x: 7, y: 8 }],
  ];
  const cases = [
    ...['rect', 'l', 'u', 'claustro'].map(shape => ({ tool: TOOLS.BUILD_PLANTA, shape })),
    { tool: TOOLS.BUILD_FACADE }, { tool: TOOLS.BUILD_ALZADO }, { tool: TOOLS.BUILD_PERFIL },
    { tool: TOOLS.BUILD_ROOF2 }, { tool: TOOLS.BUILD_ROOF1 }, { tool: TOOLS.BUILD_ROOFF },
  ];
  for (const [a, b] of smalls) {
    for (const { tool, shape } of cases) {
      const els = Building.elements(tool, a, b, { ...O, plantaShape: shape });
      for (const el of els) {
        if (el.type === 'rect') {
          assert.ok(el.w > 0 && el.h > 0, `rect degenerado tool=${tool} shape=${shape}: ${el.w}x${el.h}`);
        }
      }
      if (shape === 'u') {
        // El segmento interior inferior va de izquierda a derecha (sin cruce)
        assert.ok(els[2].x1 <= els[2].x2, 'silueta en U cruzada');
      }
    }
  }
});

test('todos los elementos generados se renderizan sin lanzar', () => {
  const stub = createCtxStub();
  for (const t of BUILDING_TOOLS) {
    for (const el of Building.elements(t, P1, P2, { ...O, plantaShape: 'u' })) {
      assert.doesNotThrow(() => Renderer.renderElement(stub, { ...el, seed: 1 }));
    }
  }
  for (const shape of ['rect', 'l', 'u', 'claustro']) {
    for (const el of planta(shape)) {
      assert.doesNotThrow(() => Renderer.renderElement(stub, { ...el, seed: 1 }));
    }
  }
  for (const dt of ['door', 'arch', 'frame', 'archFrame']) {
    for (const el of Building.elements(TOOLS.BUILD_DOOR, P1, { x: 320, y: 460 }, { ...O, doorType: dt })) {
      assert.doesNotThrow(() => Renderer.renderElement(stub, { ...el, seed: 1 }));
    }
  }
  for (const wt of ['window', 'arch', 'frame', 'archFrame']) {
    for (const el of Building.elements(TOOLS.BUILD_WINDOW, P1, { x: 260, y: 380 }, { ...O, windowType: wt })) {
      assert.doesNotThrow(() => Renderer.renderElement(stub, { ...el, seed: 1 }));
    }
  }
});
