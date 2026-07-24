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
const { Building, TOOLS, BUILDING_TOOLS, DOOR_TYPES, WINDOW_TYPES, ROOF_TYPES, FACADE_TYPES, Renderer } = ctx;
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

test('fachada rica: honra windowType (Óculo → ventanas circle)', () => {
  const base = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 200, y: 240 }, { ...O, windowType: 'window' });
  const round = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 200, y: 240 }, { ...O, windowType: 'round' });
  assert.equal(base.filter(e => e.type === 'circle').length, 0, 'la fachada básica no lleva círculos');
  assert.ok(round.filter(e => e.type === 'circle').length >= 1, 'con Óculo la fachada tiene ventanas circulares');
});

test('fachada rica: honra doorType (Puerta de arco → curveArrow)', () => {
  const base = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 200, y: 240 }, { ...O, doorType: 'door' });
  const arch = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 200, y: 240 }, { ...O, doorType: 'arch', windowType: 'window' });
  assert.equal(base.filter(e => e.type === 'curveArrow').length, 0, 'la fachada básica no lleva arcos');
  assert.ok(arch.some(e => e.type === 'curveArrow' && e.arc === true && e.heads === 'none'), 'la puerta de arco añade un curveArrow');
});

test('fachada con tipos por defecto = geometría previa (retrocompat)', () => {
  const noOpts = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 180, y: 240 }, O);
  const defs = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 180, y: 240 }, { ...O, doorType: 'door', windowType: 'window' });
  assert.equal(defs.length, noOpts.length, 'door/window explícitos = sin opts');
  assert.equal(noOpts.filter(e => e.type === 'circle').length, 0);
  assert.equal(noOpts.filter(e => e.type === 'curveArrow').length, 0);
});

test('opciones: floors fija el nº de plantas (impostas = floors-1)', () => {
  // Las impostas son las únicas líneas horizontales que van justo de x a x+w.
  const impostas = els => els.filter(e => e.type === 'line' && e.y1 === e.y2 && e.x1 === 0 && e.x2 === 180).length;
  const f2 = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 180, y: 240 }, { ...O, floors: 2 });
  const f6 = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 180, y: 240 }, { ...O, floors: 6 });
  assert.equal(impostas(f2), 1, '2 plantas → 1 imposta');
  assert.equal(impostas(f6), 5, '6 plantas → 5 impostas');
});

test('opciones: más bays → más ventanas por fachada', () => {
  const winCount = els => els.filter(e => e.type === 'rect' && e.h > e.w).length;
  const b1 = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 240, y: 240 }, { ...O, bays: 1, floors: 3 });
  const b4 = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 240, y: 240 }, { ...O, bays: 4, floors: 3 });
  assert.ok(winCount(b4) > winCount(b1), 'bays:4 debe producir más ventanas que bays:1');
});

test('opciones: roofPitch mayor baja el arranque del cuerpo (tejado más alto)', () => {
  // El alero del tejado es la línea horizontal superior que sobresale a la izquierda del muro.
  const eaveY = els => Math.min(...els.filter(e => e.type === 'line' && e.y1 === e.y2 && e.x1 < 0).map(e => e.y1));
  const low = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 120, y: 300 }, { ...O, facadeShape: 'gable', roofPitch: 0.25 });
  const high = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 120, y: 300 }, { ...O, facadeShape: 'gable', roofPitch: 0.45 });
  assert.ok(eaveY(high) > eaveY(low), 'más pendiente → tejado más alto → cuerpo empieza más abajo');
});

test('alzado: cuerpo + tejado a dos aguas (ápice) con tejas + ventanas y puerta', () => {
  const els = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 120, y: 300 }, { ...O, facadeShape: 'gable' });
  const lines = els.filter(e => e.type === 'line');
  assert.ok(els.filter(e => e.type === 'rect').length >= 2);   // cuerpo + ventanas/puerta
  assert.ok(lines.some(l => l.x2 === 60 && l.y2 === 0));       // ápice arriba-centro
  assert.ok(lines.length >= 4);                               // 2 faldones + ≥1 teja
});

test('perfil ≠ alzado: perfil con cumbrera horizontal, alzado con ápice puntual', () => {
  const p2 = { x: 120, y: 300 };
  const alz = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, p2, { ...O, facadeShape: 'gable' }).filter(e => e.type === 'line');
  const per = Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, p2, { ...O, facadeShape: 'profile' }).filter(e => e.type === 'line');
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

/* ── Tipos de puerta nuevos ── */
test('puerta "double": marco + montante central de contorno + tiradores', () => {
  const p1 = { x: 0, y: 0 }, p2 = { x: 90, y: 200 };
  const full = Building.elements(TOOLS.BUILD_DOOR, p1, p2, { ...O, doorType: 'double' });
  assert.ok(full.some(e => e.type === 'rect'), 'marco');
  // Montante central: línea vertical en el eje con el grosor de contorno
  const cx = 45;
  const mullion = full.find(e => e.type === 'line' && e.x1 === cx && e.x2 === cx
    && e.lineWidth === O.lineWidth);
  assert.ok(mullion, 'montante central de dos hojas con trazo de contorno');
  // "doubleFrame": solo marco + montante (sin dintel ni tiradores)
  const frame = Building.elements(TOOLS.BUILD_DOOR, p1, p2, { ...O, doorType: 'doubleFrame' });
  assert.equal(frame.filter(e => e.type === 'rect').length, 1);
  assert.equal(frame.filter(e => e.type === 'line').length, 1, 'solo el montante');
  assert.ok(full.filter(e => e.type === 'line').length > frame.filter(e => e.type === 'line').length);
});

test('puerta "panel": marco + dos paneles rehundidos con trazo fino', () => {
  const els = Building.elements(TOOLS.BUILD_DOOR, { x: 0, y: 0 }, { x: 80, y: 200 }, { ...O, doorType: 'panel' });
  const rects = els.filter(e => e.type === 'rect');
  assert.equal(rects.length, 3, 'contorno + 2 paneles');
  const contour = rects[0], panels = rects.slice(1);
  assert.ok(panels.every(p => p.lineWidth < contour.lineWidth), 'paneles con trazo fino');
  assert.ok(panels.every(p => p.x > contour.x && p.x + p.w < contour.x + contour.w), 'paneles dentro del marco');
});

test('puerta "garage": marco + lamas horizontales finas', () => {
  const els = Building.elements(TOOLS.BUILD_DOOR, { x: 0, y: 0 }, { x: 120, y: 160 }, { ...O, doorType: 'garage' });
  assert.equal(els.filter(e => e.type === 'rect').length, 1, 'un contorno');
  const slats = els.filter(e => e.type === 'line');
  assert.ok(slats.length >= 3, 'varias lamas');
  assert.ok(slats.every(l => l.y1 === l.y2 && l.lineWidth < O.lineWidth), 'lamas horizontales finas');
});

/* ── Tipos de ventana nuevos ── */
test('ventana "double": marco + montante de contorno + travesaño + alféizar', () => {
  const els = Building.elements(TOOLS.BUILD_WINDOW, { x: 0, y: 0 }, { x: 90, y: 120 }, { ...O, windowType: 'double' });
  assert.ok(els.some(e => e.type === 'rect'), 'marco');
  const mullion = els.find(e => e.type === 'line' && e.x1 === 45 && e.x2 === 45 && e.lineWidth === O.lineWidth);
  assert.ok(mullion, 'montante central de dos hojas (contorno)');
});

test('ventana "grid": marco + varios parteluces finos', () => {
  const els = Building.elements(TOOLS.BUILD_WINDOW, { x: 0, y: 0 }, { x: 100, y: 140 }, { ...O, windowType: 'grid' });
  assert.equal(els.filter(e => e.type === 'rect').length, 1, 'un marco');
  const bars = els.filter(e => e.type === 'line');
  assert.ok(bars.length >= 4, 'montantes + travesaños + alféizar');
  assert.ok(bars.every(l => l.lineWidth < O.lineWidth), 'parteluces con trazo fino');
});

test('óculo "round" / "roundFrame": círculo (elipse) inscrito; con cruz o sin ella', () => {
  const p1 = { x: 0, y: 0 }, p2 = { x: 100, y: 100 };
  const round = Building.elements(TOOLS.BUILD_WINDOW, p1, p2, { ...O, windowType: 'round' });
  const circle = round.find(e => e.type === 'circle');
  assert.ok(circle, 'óculo dibuja un círculo (tipo existente)');
  assert.deepEqual({ x: circle.x, y: circle.y, w: circle.w, h: circle.h }, { x: 0, y: 0, w: 100, h: 100 });
  assert.equal(round.filter(e => e.type === 'line').length, 2, 'cruz de dos diámetros');
  const frame = Building.elements(TOOLS.BUILD_WINDOW, p1, p2, { ...O, windowType: 'roundFrame' });
  assert.equal(frame.length, 1, 'solo el aro');
  assert.equal(frame[0].type, 'circle');
});

test('tejados 2 aguas / 1 agua → contorno + tejas; plano → 1 rect', () => {
  const g = Building.elements(TOOLS.BUILD_ROOF, P1, P2, { ...O, roofShape: 'gable' }).filter(e => e.type === 'line');
  const m = Building.elements(TOOLS.BUILD_ROOF, P1, P2, { ...O, roofShape: 'mono' }).filter(e => e.type === 'line');
  assert.ok(g.length >= 4, 'tejado 2 aguas: 3 contorno + ≥1 teja');
  assert.ok(m.length >= 4, 'tejado 1 agua: 3 contorno + ≥1 teja');
  const flat = Building.elements(TOOLS.BUILD_ROOF, P1, P2, { ...O, roofShape: 'flat' });
  assert.equal(flat.length, 1);
  assert.equal(flat[0].type, 'rect');
});

test('tejado 4 aguas: trapecio con cumbrera más corta que el alero + tejas', () => {
  const lines = Building.elements(TOOLS.BUILD_ROOF, { x: 0, y: 0 }, { x: 200, y: 100 }, { ...O, roofShape: 'hip' }).filter(e => e.type === 'line');
  const ridge = lines.find(l => l.y1 === 0 && l.y2 === 0);      // cumbrera arriba
  const base = lines.find(l => l.y1 === 100 && l.y2 === 100);   // alero abajo
  assert.ok(ridge && base, 'debe tener cumbrera y alero horizontales');
  assert.ok(Math.abs(ridge.x2 - ridge.x1) < Math.abs(base.x2 - base.x1), 'la cumbrera es más corta que el alero (4 aguas)');
  assert.ok(lines.length >= 4, '4 faldones/aristas + ≥1 teja');
});

test('tejado mansarda: doble pendiente con línea de quiebre a media altura', () => {
  const lines = Building.elements(TOOLS.BUILD_ROOF, { x: 0, y: 0 }, { x: 200, y: 100 }, { ...O, roofShape: 'mansard' }).filter(e => e.type === 'line');
  const knee = lines.find(l => l.y1 === l.y2 && l.y1 > 0 && l.y1 < 100 && Math.abs(l.x2 - l.x1) > 100);
  assert.ok(knee, 'debe haber una línea de quiebre horizontal a media altura');
  assert.ok(lines.length >= 6, 'mansarda tiene doble pendiente por lado');
});

test('alzado: roofType cambia la cubierta (hip/mansarda con cumbrera horizontal; 2 aguas con ápice puntual)', () => {
  const box = [{ x: 0, y: 0 }, { x: 160, y: 300 }];
  const gable = Building.elements(TOOLS.BUILD_FACADE, ...box, { ...O, facadeShape: 'gable' });
  const mansard = Building.elements(TOOLS.BUILD_FACADE, ...box, { ...O, facadeShape: 'gable', roofType: 'mansard' });
  const hip = Building.elements(TOOLS.BUILD_FACADE, ...box, { ...O, facadeShape: 'gable', roofType: 'hip' });
  // La cumbrera del hip/mansarda es una línea horizontal en y=0 (arriba del tejado);
  // el alzado a dos aguas tiene ápice puntual, sin esa cumbrera horizontal.
  const ridgeAt0 = els => els.some(e => e.type === 'line' && e.y1 === 0 && e.y2 === 0 && e.x1 !== e.x2);
  assert.ok(!ridgeAt0(gable), 'dos aguas: ápice puntual, sin cumbrera horizontal');
  assert.ok(ridgeAt0(hip), 'hip (4 aguas): cumbrera horizontal');
  assert.ok(ridgeAt0(mansard), 'mansarda: cumbrera horizontal');
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
    ...FACADE_TYPES.map(ft => ({ tool: TOOLS.BUILD_FACADE, facadeShape: ft.id })),
    ...ROOF_TYPES.map(rt => ({ tool: TOOLS.BUILD_ROOF, roofShape: rt.id })),
  ];
  for (const [a, b] of smalls) {
    for (const { tool, shape, roofShape, facadeShape } of cases) {
      const els = Building.elements(tool, a, b, { ...O, plantaShape: shape, roofShape, facadeShape });
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
  for (const dt of DOOR_TYPES.map(d => d.id)) {
    for (const el of Building.elements(TOOLS.BUILD_DOOR, P1, { x: 320, y: 460 }, { ...O, doorType: dt })) {
      assert.doesNotThrow(() => Renderer.renderElement(stub, { ...el, seed: 1 }));
    }
  }
  for (const wt of WINDOW_TYPES.map(w => w.id)) {
    for (const el of Building.elements(TOOLS.BUILD_WINDOW, P1, { x: 260, y: 380 }, { ...O, windowType: wt })) {
      assert.doesNotThrow(() => Renderer.renderElement(stub, { ...el, seed: 1 }));
    }
  }
  for (const rt of ROOF_TYPES.map(r => r.id)) {
    for (const el of Building.elements(TOOLS.BUILD_ROOF, P1, P2, { ...O, roofShape: rt })) {
      assert.doesNotThrow(() => Renderer.renderElement(stub, { ...el, seed: 1 }));
    }
  }
  for (const ft of FACADE_TYPES.map(f => f.id)) {
    for (const el of Building.elements(TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: 160, y: 300 }, { ...O, facadeShape: ft })) {
      assert.doesNotThrow(() => Renderer.renderElement(stub, { ...el, seed: 1 }));
    }
  }
});
