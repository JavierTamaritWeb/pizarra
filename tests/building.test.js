'use strict';
/* ============================================================
   building.test.js — Geometría de la sección "Edificios" (src/js/building.js).
   Todas las herramientas son de creación: producen rect/line existentes.
   Ejecutar: node --test tests/building.test.js
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll, createCtxStub } = require('./helpers/load.js');

const ctx = loadAll();
const { Building, TOOLS, BUILDING_TOOLS, DOOR_TYPES, WINDOW_TYPES, ROOF_TYPES,
        FACADE_TYPES, BALCONY_TYPES, FORGE_TYPES, FENCE_VIEWS,
        GATE_TYPES, GATE_VIEWS, Renderer } = ctx;
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

// Guarda de regresión: el perfil es el canto del edificio, no una segunda
// fachada — no lleva el acceso principal y sus plantas van acompasadas.
test('perfil: sin puerta central y con la planta baja acompasada', () => {
  const p1 = { x: 0, y: 0 }, p2 = { x: 260, y: 320 };   // ancho > alto del cuerpo
  const opts = { ...O, floors: 3, bays: 3 };
  const per = Building.elements(TOOLS.BUILD_FACADE, p1, p2, { ...opts, facadeShape: 'profile' });
  const alz = Building.elements(TOOLS.BUILD_FACADE, p1, p2, { ...opts, facadeShape: 'gable' });
  // La puerta es el rect estrecho centrado y apoyado en la rasante (y = 320).
  const doorOf = els => els.find(e => e.type === 'rect' && e.w < 100
    && Math.abs((e.x + e.w / 2) - 130) < 4 && Math.abs((e.y + e.h) - 320) < 2);
  assert.ok(doorOf(alz), 'el alzado sí lleva la puerta principal apoyada en la base');
  assert.equal(doorOf(per), undefined, 'el perfil no debe llevar puerta');
  // Ritmo uniforme: las 3 plantas con los 3 vanos, sin el hueco de la entrada.
  const rows = new Map();
  per.filter(e => e.type === 'rect' && e.h > e.w)
     .forEach(e => rows.set(e.y, (rows.get(e.y) || 0) + 1));
  const counts = [...rows.values()];
  assert.equal(counts.length, 3, 'perfil: una fila de ventanas por planta');
  assert.ok(counts.every(c => c === 3), `perfil: 3 vanos en cada planta, hay ${counts}`);
});

// Guarda de regresión: la cubierta del alzado la fija `state.roofType` (panel
// Edificios / modal), así que ningún texto del catálogo puede prometer una
// forma —con «Alzado (2 aguas)» el botón mentía al tener hip/mansarda activos.
test('el catálogo de Fachada no promete una cubierta concreta en el nombre', () => {
  const gable = FACADE_TYPES.find(ft => ft.id === 'gable');
  assert.ok(gable, 'sigue existiendo la vista de alzado');
  const ROOF_WORDS = ['agua', 'aguas', 'mansarda'];
  for (const word of ROOF_WORDS) {
    for (const field of ['name', 'hint']) {
      assert.ok(!gable[field].toLowerCase().includes(word),
        `${field} del alzado («${gable[field]}») no debe fijar la cubierta: contiene «${word}»`);
    }
  }
});

// El catálogo se dibuja con `name` (lenguaje llano) + `hint` (término técnico):
// si a una entrada le falta uno, el botón sale con un subtítulo "undefined".
test('cada vista de Fachada tiene nombre llano y término técnico', () => {
  for (const ft of FACADE_TYPES) {
    assert.equal(typeof ft.name, 'string', `${ft.id} sin name`);
    assert.equal(typeof ft.hint, 'string', `${ft.id} sin hint`);
    assert.ok(ft.name.length && ft.hint.length, `${ft.id} con textos vacíos`);
    assert.notEqual(ft.name, ft.hint, `${ft.id}: el subtítulo repite el nombre`);
  }
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

/* ---------------- balcones ---------------- */

const balcon = (id, p1 = { x: 0, y: 0 }, p2 = { x: 120, y: 64 }) =>
  Building.elements(TOOLS.BUILD_BALCONY, p1, p2, { ...O, balconyType: id });

/** Caja que envuelve un grupo de piezas (el vuelo se sale de la del arrastre). */
function unionBounds(els) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const el of els) {
    const b = el.type === 'line' || el.type === 'curveArrow'
      ? { x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2),
          w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) }
      : el;
    x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

test('balcón: barandilla arriba, losa volada abajo y sin tipos nuevos', () => {
  const els = balcon('balcony');
  assert.ok(els.every(e => ['rect', 'line', 'circle', 'curveArrow'].includes(e.type)),
    'solo tipos de elemento ya existentes');
  assert.ok(els.every(e => e.seed === undefined), 'el seed lo pone app.js');
  const rects = els.filter(e => e.type === 'rect');
  const slab = rects.find(r => r.y + r.h === 64);
  assert.ok(slab, 'la losa cierra la caja por abajo');
  assert.ok(slab.x < 0 && slab.x + slab.w > 120, 'la losa vuela por los dos lados');
  const bars = els.filter(e => e.type === 'line' && e.x1 === e.x2);
  assert.ok(bars.length >= 3, 'la barandilla lleva barrotes');
  assert.ok(bars.every(b => b.y2 <= slab.y + 0.01), 'los barrotes no invaden la losa');
});

// El balcón francés no vuela: es lo único que lo separa de un balcón a secas, y
// sin losa la caja del arrastre es toda barandilla.
test('balcón francés: sin losa, y su caja no sobresale por abajo', () => {
  const els = balcon('french', { x: 0, y: 0 }, { x: 88, y: 78 });
  const b = unionBounds(els);
  assert.equal(b.y + b.h, 78, 'no hay losa colgando bajo la caja');
  const wide = els.filter(e => e.type === 'rect' && e.w > 60);
  assert.equal(wide.length, 1, 'solo el pasamanos: sin losa');
});

// La panza se reparte desde el centro, que es como se lee de frente una
// barandilla curva: los extremos comban hacia fuera y el central sale recto.
test('balcón de forja: barrotes abombados hacia fuera desde el centro', () => {
  const els = balcon('iron');
  const bows = els.filter(e => e.type === 'curveArrow');
  assert.ok(bows.length >= 6, 'los barrotes de forja son curvas');
  assert.ok(bows.every(e => e.arc === true && e.heads === 'none'),
    'son arcos sin punta, como los de las ventanas');
  const mid = 60;
  const bulge = e => (e.cx + e.cx2) / 2 - e.x1;    // desplazamiento del control
  const izq = bows.filter(e => e.x1 < mid - 10), der = bows.filter(e => e.x1 > mid + 10);
  assert.ok(izq.length && der.length, 'hay barrotes a ambos lados');
  assert.ok(izq.every(e => bulge(e) < 0), 'los de la izquierda comban a la izquierda');
  assert.ok(der.every(e => bulge(e) > 0), 'los de la derecha comban a la derecha');
});

test('balaustrada: balaustres torneados (panza redonda) entre pasamanos y zócalo', () => {
  const els = balcon('balustrade', { x: 0, y: 0 }, { x: 140, y: 68 });
  const bellies = els.filter(e => e.type === 'circle');
  assert.ok(bellies.length >= 4, 'un balaustre por hueco');
  const rects = els.filter(e => e.type === 'rect');
  assert.ok(rects.length >= 3, 'pasamanos + zócalo + losa');
  const top = Math.min(...rects.map(r => r.y + r.h));
  assert.ok(bellies.every(c => c.y >= top), 'las panzas quedan bajo el pasamanos');
});

test('balcón corrido: ménsulas bajo la losa y barrotes más espaciados', () => {
  const long = balcon('long', { x: 0, y: 0 }, { x: 260, y: 62 });
  const plain = balcon('balcony', { x: 0, y: 0 }, { x: 260, y: 62 });
  const b = unionBounds(long);
  assert.ok(b.y + b.h > 62, 'las ménsulas cuelgan por debajo de la caja');
  const barsOf = els => els.filter(e => e.type === 'line' && e.x1 === e.x2).length;
  assert.ok(barsOf(long) < barsOf(plain),
    'al triple de largo el ritmo corto se emborrona: van más sueltos');
});

test('terraza: antepecho macizo, sin un solo barrote', () => {
  const els = balcon('terrace', { x: 0, y: 0 }, { x: 180, y: 58 });
  assert.equal(els.filter(e => e.type === 'line').length, 0, 'macizo: sin barrotes');
  assert.ok(els.filter(e => e.type === 'rect').length >= 3, 'albardilla + antepecho + losa');
});

test('mirador: cuerpo cerrado con tejadillo volando sobre la caja', () => {
  const els = balcon('mirador', { x: 0, y: 0 }, { x: 130, y: 100 });
  const b = unionBounds(els);
  assert.ok(b.y < 0, 'el tejadillo vuela por encima, como un alero');
  assert.ok(b.x < 0 && b.x + b.w > 130, 'y también por los lados');
});

// Como en el jardín: dos variantes que se dibujan igual son dos botones que
// nadie puede elegir. La firma es el multiconjunto de tipos MÁS la proporción,
// porque hay variantes que se eligen justo por su proporción.
test('dentro del catálogo de Balcón, dos tipos nunca se dibujan igual', () => {
  const seen = new Map();
  for (const v of BALCONY_TYPES) {
    // Cada tipo con SU caja por defecto (clic sin arrastrar), que es la que
    // decide la proporción con la que nace.
    const els = balcon(v.id, { x: 0, y: 0 }, { x: 0, y: 0 });
    const kinds = els.map(e => e.type).sort().join(',');
    const b = unionBounds(els);
    const sig = `${kinds}|${(b.w / Math.max(1, b.h)).toFixed(1)}`;
    const twin = seen.get(sig);
    assert.equal(twin, undefined,
      `"${v.name}" se dibuja igual que "${twin}" — nadie podría elegir`);
    seen.set(sig, v.name);
  }
});

// El tipo manda en la proporción (un mirador es alto, un corrido es una
// franja), así que el clic sin arrastrar tiene que dar una caja por variante:
// con una sola caja por herramienta la mitad del catálogo nacería deformada.
test('el clic sin arrastrar da la caja propia de cada tipo de balcón', () => {
  const boxOf = id => {
    const els = balcon(id, { x: 0, y: 0 }, { x: 0, y: 0 });
    const rects = els.filter(e => e.type === 'rect');
    return { w: Math.max(...rects.map(r => r.w)), h: unionBounds(els).h };
  };
  const corrido = boxOf('long'), mirador = boxOf('mirador');
  assert.ok(corrido.w > boxOf('balcony').w, 'el corrido nace más largo');
  assert.ok(mirador.h > boxOf('terrace').h, 'el mirador nace más alto que la terraza');
  // Y un arrastre de verdad manda sobre el default (MIN_SPAN hacia arriba).
  const dragged = balcon('long', { x: 0, y: 0 }, { x: 90, y: 50 });
  assert.ok(Math.max(...dragged.filter(e => e.type === 'rect').map(r => r.w)) < 130,
    'arrastrando, la caja la pone el gesto');
});

// Guarda de regresión: la validación de importación rechaza rect/circle con
// w o h ≤ 0 (auditoría v1.17.1), así que un balcón minúsculo no puede colar
// ninguno — y un arrastre de 6 px es un clic tembloroso, no algo raro.
test('balcones diminutos: ningún rect ni círculo degenerado', () => {
  for (const v of BALCONY_TYPES) {
    for (const p2 of [{ x: 8, y: 7 }, { x: 40, y: 9 }, { x: 9, y: 40 }, { x: 6, y: 6 }]) {
      for (const el of balcon(v.id, { x: 0, y: 0 }, p2)) {
        if (el.type === 'rect' || el.type === 'circle') {
          assert.ok(el.w > 0 && el.h > 0,
            `${v.id} en ${p2.x}x${p2.y}: ${el.type} degenerado ${el.w}x${el.h}`);
        }
      }
    }
  }
});

/* ---------------- muros ---------------- */

const muro = (view, o2 = {}, p1 = { x: 0, y: 0 }, p2 = { x: 200, y: 24 }) =>
  Building.elements(TOOLS.BUILD_WALL, p1, p2, { ...O, wallView: view, ...o2 });

test('muro: solo tipos ya existentes, sin seed', () => {
  const els = muro('elevation', { wallMaterial: 'stone', wallRailing: true, wallGateType: 'double' }, { x: 0, y: 0 }, { x: 200, y: 90 });
  assert.ok(els.length > 10, 'un muro de piedra con verja y puerta doble genera bastantes piezas');
  assert.ok(els.every(e => ['rect', 'line', 'circle', 'curveArrow'].includes(e.type)),
    'solo tipos de elemento ya existentes');
  assert.ok(els.every(e => e.seed === undefined), 'el seed lo pone app.js');
});

test('muro en planta: piedra lleva achurado, hormigón liso', () => {
  const stone = muro('plan', { wallMaterial: 'stone' });
  const concrete = muro('plan', { wallMaterial: 'concrete' });
  // El achurado va inclinado al azar (mampostería, no panel prefabricado), así
  // que se cuenta por trazo fino, no por "vertical exacta".
  const ticksOf = els => els.filter(e => e.type === 'line' && e.lineWidth < O.lineWidth).length;
  assert.ok(ticksOf(stone) >= 4, 'la piedra lleva tics de achurado');
  assert.equal(ticksOf(concrete), 0, 'el hormigón es liso: sin achurado');
});

// El muro salía de una retícula exacta (hilada de 22 px, junta siempre a media
// pieza) y parecía de bloques prefabricados. La irregularidad es determinista
// (_noise, nunca Math.random): el icono, la miniatura y el trazo comprometido
// tienen que salir idénticos.
test('muro de piedra: mampostería irregular y determinista, no una retícula de bloques', () => {
  const box = [{ x: 0, y: 0 }, { x: 240, y: 120 }];
  const els = muro('elevation', { wallMaterial: 'stone' }, ...box);
  const beds = els.filter(e => e.type === 'line' && e.y1 === e.y2 && e.lineWidth < O.lineWidth)
    .map(e => e.y1).sort((a, b) => a - b);
  assert.ok(beds.length >= 3, 'varias hiladas');
  const gaps = beds.slice(1).map((y, i) => y - beds[i]);
  assert.ok(Math.max(...gaps) - Math.min(...gaps) > 1.5, 'las hiladas no miden todas lo mismo');

  const joints = els.filter(e => e.type === 'line' && e.y1 !== e.y2);
  assert.ok(joints.length >= 8, 'llagas verticales de mampuesto');
  assert.ok(joints.some(e => Math.abs(e.x2 - e.x1) > 0.5), 'las llagas no son todas verticales exactas');
  const xs = [...new Set(joints.map(e => Math.round(e.x1)))];
  assert.ok(xs.length > joints.length * 0.6, 'las llagas no se alinean en columnas');

  const again = muro('elevation', { wallMaterial: 'stone' }, ...box);
  assert.deepEqual(again.map(e => JSON.stringify(e)), els.map(e => JSON.stringify(e)),
    'determinista: dos llamadas iguales dan el mismo muro');
});

// La altura en metros es la ESCALA del dibujo, no solo la caja por defecto:
// con el mismo arrastre, 2 m son hiladas y mampuestos la mitad de grandes.
// Antes solo se notaba al hacer clic sin arrastrar —es decir, casi nunca—.
test('la altura en metros cambia la textura aunque el arrastre sea el mismo', () => {
  const box = [{ x: 0, y: 0 }, { x: 240, y: 120 }];
  const bedsOf = els => els.filter(e => e.type === 'line' && e.y1 === e.y2).length;
  const oneM = muro('elevation', { wallMaterial: 'stone', wallHeight: 1 }, ...box);
  const twoM = muro('elevation', { wallMaterial: 'stone', wallHeight: 2 }, ...box);
  assert.ok(bedsOf(twoM) > bedsOf(oneM) + 1, 'a 2 m caben más hiladas en el mismo paño');
  const concrete1 = muro('elevation', { wallMaterial: 'concrete', wallHeight: 1 }, ...box);
  const concrete2 = muro('elevation', { wallMaterial: 'concrete', wallHeight: 2 }, ...box);
  assert.ok(bedsOf(concrete2) > bedsOf(concrete1), 'el hormigón de 2 m lleva más tongadas');
});

test('muro en alzado: piedra con hiladas y juntas de sillar, hormigón con una sola junta', () => {
  const stone = muro('elevation', { wallMaterial: 'stone' }, { x: 0, y: 0 }, { x: 200, y: 90 });
  const concrete = muro('elevation', { wallMaterial: 'concrete' }, { x: 0, y: 0 }, { x: 200, y: 90 });
  const stoneLines = stone.filter(e => e.type === 'line').length;
  const concreteLines = concrete.filter(e => e.type === 'line').length;
  // Lo que separa los dos materiales no es el número de líneas —el hormigón
  // encofrado lleva una tongada por altura de vertido, ver el test de arriba—
  // sino las LLAGAS: la piedra tiene juntas verticales entre mampuestos y el
  // hormigón no tiene ninguna, solo tongadas horizontales.
  const llagasOf = els => els.filter(e => e.type === 'line' && e.y1 !== e.y2).length;
  assert.equal(llagasOf(concrete), 0, 'el hormigón no tiene llagas: solo tongadas horizontales');
  assert.ok(llagasOf(stone) >= 4, 'la piedra lleva juntas verticales entre mampuestos');
  assert.ok(stoneLines > concreteLines + 3, 'la piedra lleva mucho más detalle que el hormigón');
});

test('ladrillo cara vista: hiladas regulares y juntas verticales alternadas', () => {
  const brick = muro('elevation', { wallMaterial: 'brick' }, { x: 0, y: 0 }, { x: 240, y: 100 });
  const beds = brick.filter(e => e.type === 'line' && e.y1 === e.y2 && e.lineWidth < O.lineWidth);
  const joints = brick.filter(e => e.type === 'line' && e.x1 === e.x2 && e.lineWidth < O.lineWidth);
  assert.ok(beds.length >= 6, 'varias hiladas horizontales');
  assert.ok(joints.length >= 12, 'juntas de ladrillo a soga');
  const jointXs = [...new Set(joints.map(e => Math.round(e.x1)))];
  assert.ok(jointXs.length >= 6, 'las juntas se alternan y no forman una única columna');
});

test('verja de forja arriba: solo aparece con wallRailing activado, combada con ArcMath', () => {
  const withRailing = muro('elevation', { wallRailing: true }, { x: 0, y: 0 }, { x: 200, y: 90 });
  const without = muro('elevation', { wallRailing: false }, { x: 0, y: 0 }, { x: 200, y: 90 });
  const bows = els => els.filter(e => e.type === 'curveArrow');
  assert.equal(bows(without).length, 0, 'sin verja: ningún arco de forja');
  assert.ok(bows(withRailing).length >= 2, 'con verja: barrotes combados');
  assert.ok(bows(withRailing).every(e => e.arc === true && e.heads === 'none'),
    'son arcos sin punta, como los del balcón de forja');
  const b = unionBounds(withRailing);
  assert.ok(b.y < 0, 'la verja sobresale por encima del remate del muro');
});

test('la altura de la verja superior se regula en metros y se acota', () => {
  const box = [{ x: 0, y: 0 }, { x: 240, y: 100 }];
  const hOf = height => unionBounds(muro('elevation', {
    wallRailing: true, wallRailingHeight: height, wallGateType: 'none',
  }, ...box)).h;
  assert.ok(hOf(1.5) > hOf(0.3) + 80, 'la verja alta sobresale claramente más que la baja');
  assert.equal(hOf(99), hOf(Building.WALL_RAIL_H_MAX), 'los valores altos se recortan');
  assert.equal(hOf(0), hOf(0.7), 'un valor imposible cae al alto por defecto');
});

test('los trece diseños de verja superior generan forjas distintas', () => {
  const types = FORGE_TYPES.map(type => type.id);
  const draw = type => muro('elevation', {
    wallRailing: true, wallRailingType: type, wallRailingHeight: 1,
    wallGateType: 'none', wallMaterial: 'concrete',
  }, { x: 0, y: 0 }, { x: 260, y: 100 });
  const drawings = Object.fromEntries(types.map(type => [type, draw(type)]));
  assert.equal(new Set(types.map(type => JSON.stringify(drawings[type]))).size, FORGE_TYPES.length);
  assert.ok(drawings.arches.some(e => e.type === 'curveArrow'), 'arcos curvos');
  assert.ok(drawings.rings.filter(e => e.type === 'circle').length >= 4, 'anillas repetidas');
  assert.ok(drawings.scrolls.filter(e => e.type === 'curveArrow').length >= 4, 'roleos alternos');
  assert.ok(drawings.fans.filter(e => e.type === 'circle').length >= 2, 'cubos de los abanicos');
  assert.ok(drawings.diamonds.filter(e => e.type === 'line').length > drawings.minimal.filter(e => e.type === 'line').length,
    'los rombos añaden diagonales cruzadas');
  types.forEach(type => {
    const finials = new Map();
    drawings[type].filter(e => e.type === 'line' && e.y2 < e.y1 && e.x1 !== e.x2).forEach(e => {
      const key = `${e.x2.toFixed(2)},${e.y2.toFixed(2)}`;
      finials.set(key, (finials.get(key) || 0) + 1);
    });
    assert.ok([...finials.values()].some(count => count >= 2),
      `${type}: debe conservar puntas de lanza defensivas`);
  });
});

test('cancela en planta: dos pilastras flanqueando el paso y una hoja por batiente', () => {
  // Solo el CONTORNO cuenta como pilastra: cada una lleva su basa dibujada
  // dentro con trazo fino, y contarlas juntas daría cuatro.
  const piersOf = els => els.filter(e =>
    e.type === 'rect' && e.w < 20 && e.lineWidth === O.lineWidth).length;
  const leavesOf = els => els.filter(e => e.type === 'line' && e.lineWidth < O.lineWidth && e.y1 === e.y2).length;
  const single = muro('plan', { wallGateType: 'single' });
  const double = muro('plan', { wallGateType: 'double' });
  assert.equal(piersOf(single), 2, 'el paso va flanqueado por dos pilastras');
  assert.equal(piersOf(double), 2);
  assert.equal(leavesOf(single), 1, 'una hoja cerrando el vano');
  assert.equal(leavesOf(double), 2, 'dos hojas');
});

// El paño se parte en la entrada: si el muro pasara por detrás, su remate
// cruzaría la cancela y el hueco dejaría de leerse como un paso.
test('el paño del muro se interrumpe en la entrada', () => {
  const box = [{ x: 0, y: 0 }, { x: 240, y: 100 }];
  const sin = muro('elevation', { wallGateType: 'none' }, ...box);
  const con = muro('elevation', { wallGateType: 'double' }, ...box);
  const wide = els => els.filter(e => e.type === 'rect' && e.w > 40 && e.h > 40);
  assert.equal(wide(sin).length, 1, 'sin puerta, el paño es una sola pieza');
  assert.equal(wide(con).length, 2, 'con puerta, dos paños flanqueando el paso');
  assert.ok(wide(con).every(r => r.x + r.w <= 240));
});

// El alto de la cancela es un ajuste propio en metros, sobre la misma escala
// que el muro: no lo decide el arrastre, y por eso se puede modular.
test('el alto de la cancela se modula en metros y se acota al rango del deslizador', () => {
  const box = [{ x: 0, y: 0 }, { x: 240, y: 100 }];
  const hOf = m => unionBounds(muro('elevation', { wallGateType: 'single', wallGateHeight: m }, ...box)).h;
  assert.ok(hOf(3) > hOf(1) + 40, 'una cancela de 3 m asoma muy por encima de una de 1 m');
  assert.ok(hOf(Building.WALL_GATE_H_MIN) < hOf(2), 'y la más baja no llega a la de 2 m');
  assert.equal(hOf(99), hOf(Building.WALL_GATE_H_MAX), 'por encima del tope, se recorta');
  assert.equal(hOf(0), hOf(2), 'un valor imposible cae al alto por defecto');
});

test('puerta de barrotes en alzado: una hoja sin montante, dos hojas con montante central de contorno', () => {
  const single = muro('elevation', { wallGateType: 'single' }, { x: 0, y: 0 }, { x: 200, y: 90 });
  const double = muro('elevation', { wallGateType: 'double' }, { x: 0, y: 0 }, { x: 200, y: 90 });
  const mullion = els => els.find(e => e.type === 'line' && e.lineWidth === O.lineWidth && e.x1 === e.x2);
  assert.equal(mullion(single), undefined, 'una hoja: sin montante');
  assert.ok(mullion(double), 'dos hojas: montante central de contorno, como en _doubleDoor');
  const bows = els => els.filter(e => e.type === 'curveArrow');
  assert.ok(bows(single).length >= 2 && bows(double).length >= 2, 'ambas llevan barrotes combados');
});

test('cancela cóncava: dos hojas, caída central, lanzas graduadas y sin arco de fábrica', () => {
  const els = muro('elevation', { wallGateType: 'concave', wallGateHeight: 2 }, { x: 0, y: 0 }, { x: 240, y: 100 });
  const curves = els.filter(e => e.type === 'curveArrow');
  const topProfiles = curves.filter(e => e.lineWidth === O.lineWidth && e.y1 !== e.y2);
  assert.equal(topProfiles.length, 2, 'una curva superior por hoja');
  const meetingY = topProfiles.map(e => e.x1 < 120 ? e.y2 : e.y1);
  const outerY = topProfiles.map(e => e.x1 < 120 ? e.y1 : e.y2);
  assert.ok(meetingY.every((y, i) => y > outerY[i] + 8), 'el perfil cae hacia el centro');
  assert.ok(els.some(e => e.type === 'circle'), 'rosetón central que disimula el encuentro');
  assert.ok(els.filter(e => e.type === 'line' && e.lineWidth < O.lineWidth).length >= 12,
    'barrotes y puntas de lanza graduados');
  const horizontalArcs = curves.filter(e => e.arc === true && e.y1 === e.y2);
  assert.equal(horizontalArcs.length, 0, 'el seno abierto no queda encerrado por un arco de dovelas');
});

test('las nueve cancelas cóncavas tienen siluetas y detalles propios', () => {
  const box = [{ x: 0, y: 0 }, { x: 240, y: 100 }];
  const draw = type => muro('elevation', { wallGateType: type, wallGateHeight: 2 }, ...box);
  const pure = draw('concave');
  const swan = draw('concaveSwan');
  const panel = draw('concavePanel');
  const ornate = draw('concaveOrnate');
  const fan = draw('concaveFan');
  const lyre = draw('concaveLyre');
  const diamond = draw('concaveDiamond');
  const rings = draw('concaveRings');
  const palmette = draw('concavePalmette');

  assert.ok(swan.some(e => e.type === 'curveArrow' && e.cx2 !== undefined && e.y1 !== e.y2),
    'el cuello de cisne usa curvas cúbicas para bajar y volver a subir');
  assert.ok(panel.some(e => e.type === 'rect' && e.lineWidth < O.lineWidth && e.w >= 90 && e.h >= 16),
    'la variante con zócalo lleva una chapa ciega a todo el ancho del vano');
  assert.ok(ornate.filter(e => e.type === 'curveArrow').length > pure.filter(e => e.type === 'curveArrow').length + 2,
    'la ornamental suma doble pletina y roleos laterales');
  assert.ok(fan.filter(e => e.type === 'line').length > pure.filter(e => e.type === 'line').length + 4,
    'el abanico suma varios radios desde su cubo central');
  assert.ok(lyre.filter(e => e.type === 'curveArrow').length >= pure.filter(e => e.type === 'curveArrow').length + 2,
    'la lira añade dos brazos curvos');
  assert.ok(diamond.filter(e => e.type === 'line').length > pure.filter(e => e.type === 'line').length + 8,
    'el diseño inglés añade una banda cruzada de rombos');
  assert.ok(rings.filter(e => e.type === 'circle').length >= pure.filter(e => e.type === 'circle').length + 3,
    'el neoclásico añade una secuencia de anillas');
  assert.ok(palmette.filter(e => e.type === 'circle').length >= pure.filter(e => e.type === 'circle').length + 2,
    'el barroco añade dos palmetas con corazón circular');
  const signatures = [pure, swan, panel, ornate, fan, lyre, diamond, rings, palmette]
    .map(els => JSON.stringify(els));
  assert.equal(new Set(signatures).size, 9, 'ningún diseño se reduce a la misma geometría que otro');
});

test('cancela convexa monumental: coronación central, barrotes densos, cenefa y paneles', () => {
  const els = muro('elevation', { wallGateType: 'convexPanel', wallGateHeight: 2.4 },
    { x: 0, y: 0 }, { x: 280, y: 110 });
  const profiles = els.filter(e => e.type === 'curveArrow' && e.lineWidth === O.lineWidth && e.y1 !== e.y2);
  assert.equal(profiles.length, 2, 'una curva convexa por hoja');
  assert.ok(profiles[0].y2 < profiles[0].y1 && profiles[1].y1 < profiles[1].y2,
    'el cierre central es el punto más alto');
  const bars = els.filter(e => e.type === 'line' && e.lineWidth < O.lineWidth && e.x1 === e.x2);
  assert.ok(bars.length >= 12, 'barrotera superior densa');
  const moulded = els.filter(e => e.type === 'rect' && e.lineWidth < O.lineWidth && e.h > 20);
  assert.ok(moulded.length >= 4, 'cuatro casetones inferiores moldurados');
  assert.ok(els.some(e => e.type === 'rect' && e.w >= 95 && e.h <= 18), 'cenefa calada horizontal');
  assert.equal(els.filter(e => e.type === 'curveArrow' && e.arc === true).length, 0,
    'sin arco de fábrica sobre la cancela');
});

test('las cuatro convexas monumentales son opciones geométricamente distintas', () => {
  const box = [{ x: 0, y: 0 }, { x: 280, y: 110 }];
  const draw = type => muro('elevation', { wallGateType: type, wallGateHeight: 2.4 }, ...box);
  const panel = draw('convexPanel');
  const fan = draw('convexFan');
  const medallion = draw('convexMedallion');
  const blind = draw('convexBlind');
  const lines = els => els.filter(e => e.type === 'line').length;
  const circles = els => els.filter(e => e.type === 'circle').length;

  assert.ok(lines(fan) > lines(panel) + 8, 'el abanico imperial añade sus radios');
  assert.ok(circles(medallion) >= circles(panel) + 4, 'la doble cenefa añade medallones concéntricos');
  assert.ok(lines(blind) > lines(panel) + 8, 'la versión ciega añade acanaladuras verticales');
  const lowerBlind = blind.filter(e => e.type === 'rect' && e.lineWidth < O.lineWidth && e.h > 45);
  assert.ok(lowerBlind.length >= 1, 'la chapa ciega ocupa la mayor parte inferior');
  assert.equal(new Set([panel, fan, medallion, blind].map(JSON.stringify)).size, 4);
});

test('portón ciego con montante: chapa doble, barrotes superiores, remaches y machones de ladrillo', () => {
  const els = muro('elevation', { wallGateType: 'solidTransom', wallMaterial: 'brick', wallGateHeight: 2.4 },
    { x: 0, y: 0 }, { x: 280, y: 110 });
  const leaves = els.filter(e => e.type === 'rect' && e.lineWidth === O.lineWidth && e.w > 35 && e.h > 45);
  assert.ok(leaves.length >= 2, 'dos hojas grandes de chapa');
  const upperBars = els.filter(e => e.type === 'line' && e.lineWidth < O.lineWidth && e.x1 === e.x2 && e.y2 - e.y1 < 40);
  assert.ok(upperBars.length >= 8, 'montante superior de barrotes');
  assert.ok(els.filter(e => e.type === 'circle' && e.w <= 5).length >= 6, 'banda de remaches');
  assert.ok(els.some(e => e.type === 'line' && e.y1 !== e.y2 && e.lineWidth < O.lineWidth),
    'albardillas inclinadas sobre los machones');
  assert.equal(els.filter(e => e.type === 'curveArrow' && e.arc === true).length, 0,
    'el portón recto no recibe arco de fábrica');
});

test('los dos portones abiertos dejan la hoja calada, llevan lanzas y son distintos', () => {
  const draw = type => muro('elevation', {
    wallGateType: type, wallMaterial: 'brick', wallGateHeight: 2.4,
  }, { x: 0, y: 0 }, { x: 280, y: 110 });
  const bars = draw('openBars');
  const scrolls = draw('openScrolls');

  for (const [name, els] of [['barrotes', bars], ['ornamental', scrolls]]) {
    const openBars = els.filter(e => e.type === 'line' && e.lineWidth < O.lineWidth &&
      e.x1 === e.x2 && e.y2 - e.y1 > 45);
    assert.ok(openBars.length >= 5, `${name}: barrotes abiertos a toda altura`);
    const solidLeaves = els.filter(e => e.type === 'rect' && e.lineWidth === O.lineWidth &&
      e.x >= 80 && e.x + e.w <= 200 && e.w > 35 && e.h > 45);
    assert.equal(solidLeaves.length, 0, `${name}: no contiene hojas de chapa ciega`);
    const finials = new Map();
    els.filter(e => e.type === 'line' && e.lineWidth < O.lineWidth && e.y2 < e.y1 && e.x1 !== e.x2)
      .forEach(e => {
        const key = `${e.x2.toFixed(2)},${e.y2.toFixed(2)}`;
        finials.set(key, (finials.get(key) || 0) + 1);
      });
    assert.ok([...finials.values()].some(count => count >= 2), `${name}: coronación con lanzas`);
    assert.equal(els.filter(e => e.type === 'curveArrow' && e.arc === true).length, 0,
      `${name}: portada recta sin arco de fábrica`);
  }
  assert.ok(scrolls.filter(e => e.type === 'curveArrow').length >= 8,
    'la variante ornamental incorpora roleos abiertos');
  assert.ok(scrolls.filter(e => e.type === 'circle').length > bars.filter(e => e.type === 'circle').length,
    'la variante ornamental incorpora una cenefa de rosetas');
  assert.notEqual(JSON.stringify(bars), JSON.stringify(scrolls));
});

// La altura manda en la caja por defecto (clic sin arrastrar) —igual que
// byVariant en Balcón: un arrastre de verdad siempre gana— y además fija la
// escala de la textura (ver el test de arriba). La clave de tamaño la deriva
// building.js de la vista + la altura, no app.js: así el icono de cada vista
// del catálogo nace con SU caja aunque la vista activa sea la otra.
test('el clic sin arrastrar da la caja propia de cada vista/altura de Muro', () => {
  const boxOf = (view, wallHeight) => {
    const els = muro(view, { wallHeight }, { x: 0, y: 0 }, { x: 0, y: 0 });
    return unionBounds(els);
  };
  const plan = boxOf('plan', 1), h1 = boxOf('elevation', 1), h2 = boxOf('elevation', 2);
  assert.ok(plan.h < h1.h, 'la tira de planta nace mucho más fina que un alzado de 1 m');
  assert.ok(h2.h > h1.h, 'el alzado de 2 m nace más alto que el de 1 m');
  assert.ok(Math.abs(h2.h - 2 * h1.h) < 1, 'la altura escala linealmente con los metros');
  assert.ok(boxOf('plan', 2).h > plan.h, 'en planta, un muro de 2 m nace con más canto');
  // Y un arrastre de verdad manda sobre el default (MIN_SPAN hacia arriba).
  const dragged = muro('elevation', { wallHeight: 2 }, { x: 0, y: 0 }, { x: 90, y: 40 });
  assert.ok(unionBounds(dragged).h < 60, 'arrastrando, la caja la pone el gesto');
});

// La verja también se ve en planta (el pasamanos desde arriba). No es adorno:
// un ajuste sin efecto en una vista acaba deshabilitado justo cuando se quiere
// elegir, y elegir vista cierra el modal.
test('la verja se ve en las dos vistas del muro', () => {
  const fineRuns = els => els.filter(e => e.type === 'line' && e.y1 === e.y2 && e.lineWidth < O.lineWidth).length;
  const withRail = muro('plan', { wallMaterial: 'concrete', wallRailing: true });
  const without = muro('plan', { wallMaterial: 'concrete', wallRailing: false });
  assert.equal(fineRuns(without), 0, 'sin verja, el hormigón en planta va liso');
  assert.equal(fineRuns(withRail), 2, 'con verja, las dos líneas del pasamanos');
});

/* ---------------- verjas independientes ---------------- */

const verja = (view, type = 'spear', height = 180, p1 = { x: 0, y: 0 }, p2 = { x: 200, y: 0 }) =>
  Building.elements(TOOLS.BUILD_FENCE, p1, p2, {
    ...O, fenceView: view, fenceType: type, fenceHeightCm: height,
  });

test('Verjas ofrece planta y alzado como geometrías arquitectónicas distintas', () => {
  assert.deepEqual([...FENCE_VIEWS.map(v => v.id)], ['plan', 'elevation']);
  const plan = verja('plan', 'spear', 180);
  const elevation = verja('elevation', 'spear', 180);
  assert.ok(plan.length > 4, 'planta: pletinas, eje y postes');
  assert.ok(elevation.length > plan.length, 'alzado: desarrolla la forja completa');
  assert.notEqual(JSON.stringify(plan), JSON.stringify(elevation));
});

test('los trece tipos de Verjas son distintos y todos conservan lanzas', () => {
  const drawings = FORGE_TYPES.map(type => verja('elevation', type.id, 220));
  assert.equal(new Set(drawings.map(JSON.stringify)).size, FORGE_TYPES.length);
  drawings.forEach((els, index) => {
    const finials = new Map();
    els.filter(e => e.type === 'line' && e.y2 < e.y1 && e.x1 !== e.x2).forEach(e => {
      const key = `${e.x2.toFixed(2)},${e.y2.toFixed(2)}`;
      finials.set(key, (finials.get(key) || 0) + 1);
    });
    assert.ok([...finials.values()].some(count => count >= 2),
      `${FORGE_TYPES[index].id}: falta la punta de lanza`);
  });
});

test('cada diseño de Verjas tiene una coronación ornamental propia', () => {
  const drawings = FORGE_TYPES.map(type => verja('elevation', type.id, 220));
  const bladeProfiles = drawings.map(els => {
    const rising = els.filter(el => el.type === 'line' && el.y2 < el.y1 && el.x1 !== el.x2);
    const tipY = Math.min(...rising.map(el => el.y2));
    const firstTipX = Math.min(...rising.filter(el => Math.abs(el.y2 - tipY) < 0.001)
      .map(el => el.x2));
    return rising.filter(el => Math.abs(el.y2 - tipY) < 0.001 && Math.abs(el.x2 - firstTipX) < 0.001)
      .map(el => [Number(Math.abs(el.x1 - el.x2).toFixed(3)), Number((el.y1 - el.y2).toFixed(3))])
      .sort((a, b) => a[0] - b[0]);
  });
  assert.equal(new Set(bladeProfiles.map(JSON.stringify)).size, FORGE_TYPES.length,
    'cada modelo debe tener una hoja de lanza realmente distinta, no solo otro collar');
  bladeProfiles.forEach((profile, index) => {
    assert.equal(profile.length, 2, `${FORGE_TYPES[index].id}: la hoja debe converger en dos filos`);
  });
  const crowns = drawings.map(els => {
    const railTop = els[0].y;
    return els.filter(el => {
      const ys = [el.y, el.y1, el.y2, el.cy, el.cy2]
        .filter(value => Number.isFinite(value));
      return ys.some(value => value < railTop);
    });
  });
  assert.equal(new Set(crowns.map(JSON.stringify)).size, FORGE_TYPES.length,
    'las trece siluetas de remate deben ser distintas');
  crowns.forEach((crown, index) => {
    assert.ok(crown.length >= 5, `${FORGE_TYPES[index].id}: remate demasiado simple`);
  });
  assert.ok(crowns[FORGE_TYPES.findIndex(type => type.id === 'rings')]
    .some(el => el.type === 'circle'), 'la neoclásica corona con anillas');
  assert.ok(crowns[FORGE_TYPES.findIndex(type => type.id === 'plateresque')]
    .some(el => el.type === 'curveArrow'), 'la plateresca corona con hojas curvas');
  assert.ok(crowns[FORGE_TYPES.findIndex(type => type.id === 'valencian')]
    .some(el => el.type === 'curveArrow'), 'la valenciana corona con rocalla curva');
});

test('la altura de Verjas cubre y acota exactamente 0–350 cm', () => {
  assert.equal(Building.FENCE_H_MIN_CM, 0);
  assert.equal(Building.FENCE_H_MAX_CM, 350);
  const zero = verja('elevation', 'minimal', 0);
  assert.equal(zero.length, 1, '0 cm conserva solo la línea de implantación');
  assert.equal(zero[0].y1, zero[0].y2);
  const low = unionBounds(verja('elevation', 'minimal', 100));
  const high = unionBounds(verja('elevation', 'minimal', 350));
  assert.ok(high.h > low.h * 2.5, '350 cm se representa bastante más alto que 100 cm');
  assert.equal(JSON.stringify(verja('elevation', 'minimal', -20)), JSON.stringify(zero),
    'los negativos se acotan a cero');
  assert.equal(JSON.stringify(verja('elevation', 'minimal', 900)),
    JSON.stringify(verja('elevation', 'minimal', 350)), 'el exceso se acota a 350 cm');
});

/* ---------------- cancelas independientes ---------------- */

const cancela = (view, type = 'concave', height = 200,
  p1 = { x: 0, y: 0 }, p2 = { x: 180, y: 0 }) =>
  Building.elements(TOOLS.BUILD_GATE, p1, p2, {
    ...O, gateView: view, gateType: type, gateHeightCm: height,
  });

test('Cancela ofrece los dieciocho estilos en planta y alzado', () => {
  assert.equal(GATE_TYPES.length, 18);
  assert.deepEqual([...GATE_VIEWS.map(view => view.id)], ['plan', 'elevation']);
  const drawings = GATE_TYPES.map(type => cancela('elevation', type.id, 220));
  assert.equal(new Set(drawings.map(JSON.stringify)).size, GATE_TYPES.length,
    'cada estilo debe conservar su geometría propia fuera del Muro');
  assert.notEqual(JSON.stringify(cancela('plan')), JSON.stringify(cancela('elevation')));
  assert.ok(cancela('plan').some(el => el.type === 'rect'), 'planta con pilastras');
  assert.ok(cancela('elevation').length > 20, 'alzado con hojas, remates y pilastras');
});

test('la altura de Cancela cubre y acota exactamente 0–350 cm', () => {
  assert.equal(Building.GATE_H_MIN_CM, 0);
  assert.equal(Building.GATE_H_MAX_CM, 350);
  const zero = cancela('elevation', 'concave', 0);
  assert.equal(zero.length, 1, '0 cm conserva solo la línea de implantación');
  const low = unionBounds(cancela('elevation', 'concave', 100));
  const high = unionBounds(cancela('elevation', 'concave', 350));
  assert.ok(high.h > low.h * 1.8,
    '350 cm produce una cancela claramente más alta, conservando arco y pilastras');
  assert.equal(JSON.stringify(cancela('elevation', 'concave', -1)), JSON.stringify(zero));
  assert.equal(JSON.stringify(cancela('elevation', 'concave', 999)),
    JSON.stringify(cancela('elevation', 'concave', 350)));
});

// Guarda de regresión: mismo motivo que en Balcón — la validación de
// importación rechaza rect/circle con w o h ≤ 0.
test('muros diminutos: ningún rect degenerado', () => {
  const smalls = [{ x: 8, y: 7 }, { x: 40, y: 9 }, { x: 9, y: 40 }, { x: 6, y: 6 }];
  const combos = [
    { wallView: 'plan', wallMaterial: 'stone', wallGateType: 'double' },
    { wallView: 'plan', wallMaterial: 'concrete', wallGateType: 'none' },
    { wallView: 'elevation', wallMaterial: 'stone', wallRailing: true, wallGateType: 'single' },
    { wallView: 'elevation', wallMaterial: 'concrete', wallRailing: false, wallGateType: 'double' },
  ];
  for (const opts of combos) {
    for (const p2 of smalls) {
      const els = Building.elements(TOOLS.BUILD_WALL, { x: 0, y: 0 }, p2, { ...O, ...opts });
      assert.ok(els.length > 0, `${JSON.stringify(opts)} en ${p2.x}x${p2.y}: no generó nada`);
      for (const el of els) {
        if (el.type === 'rect' || el.type === 'circle') {
          assert.ok(el.w > 0 && el.h > 0,
            `${JSON.stringify(opts)} en ${p2.x}x${p2.y}: ${el.type} degenerado ${el.w}x${el.h}`);
        }
      }
    }
  }
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
  for (const bt of BALCONY_TYPES.map(v => v.id)) {
    for (const el of balcon(bt)) {
      assert.doesNotThrow(() => Renderer.renderElement(stub, { ...el, seed: 1 }));
    }
  }
  const wallCombos = [
    { wallView: 'plan', wallMaterial: 'stone', wallGateType: 'none' },
    { wallView: 'plan', wallMaterial: 'concrete', wallGateType: 'single' },
    { wallView: 'plan', wallMaterial: 'stone', wallGateType: 'double' },
    { wallView: 'elevation', wallMaterial: 'stone', wallRailing: true, wallGateType: 'none' },
    { wallView: 'elevation', wallMaterial: 'concrete', wallRailing: false, wallGateType: 'single' },
    { wallView: 'elevation', wallMaterial: 'stone', wallRailing: true, wallGateType: 'double' },
  ];
  for (const opts of wallCombos) {
    const els = Building.elements(TOOLS.BUILD_WALL, { x: 0, y: 0 }, { x: 200, y: 90 }, { ...O, ...opts });
    assert.ok(els.length > 0, `${JSON.stringify(opts)}: no generó nada`);
    for (const el of els) {
      assert.doesNotThrow(() => Renderer.renderElement(stub, { ...el, seed: 1 }));
    }
  }
});
