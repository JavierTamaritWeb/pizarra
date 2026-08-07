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
const { Building, TOOLS, BUILDING_TOOLS, DOOR_TYPES, WINDOW_TYPES, ROOF_TYPES,
        FACADE_TYPES, BALCONY_TYPES, Renderer } = ctx;
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
});
