'use strict';
/* ============================================================
   building-plano.test.js — La parte técnica del plano (v3.22.0):
   Escalera, Cota, Símbolos, Pilar, Mobiliario, Porche y Siluetas, más el
   complemento del Tejado. Mismo contrato que garden.test.js: herramientas de
   creación que producen SOLO tipos ya existentes.
   Ejecutar: node --test tests/building-plano.test.js
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll, createCtxStub } = require('./helpers/load.js');

const ctx = loadAll();
const {
  Building, TOOLS, STAIR_TYPES, STAIR_VIEWS, SYMBOL_TYPES, COLUMN_TYPES,
  FURNITURE_TYPES, PORCH_TYPES, SILHOUETTE_TYPES, ROOF_ADDONS, ROOF_TYPES,
  Renderer, Exporter,
} = ctx;

const O = { color: '#123456', lineWidth: 3, dimScale: 50, symbolLevelM: 3.2 };
const P1 = { x: 100, y: 100 }, P2 = { x: 300, y: 280 };

const VARIANT_KEY = {
  [TOOLS.BUILD_STAIR]:      'stairType',
  [TOOLS.BUILD_SYMBOL]:     'symbolType',
  [TOOLS.BUILD_COLUMN]:     'columnType',
  [TOOLS.BUILD_FURNITURE]:  'furnitureType',
  [TOOLS.BUILD_PORCH]:      'porchType',
  [TOOLS.BUILD_SILHOUETTE]: 'silhouetteType',
};

const CATALOG = {
  [TOOLS.BUILD_STAIR]:      STAIR_TYPES,
  [TOOLS.BUILD_SYMBOL]:     SYMBOL_TYPES,
  [TOOLS.BUILD_COLUMN]:     COLUMN_TYPES,
  [TOOLS.BUILD_FURNITURE]:  FURNITURE_TYPES,
  [TOOLS.BUILD_PORCH]:      PORCH_TYPES,
  [TOOLS.BUILD_SILHOUETTE]: SILHOUETTE_TYPES,
};

/** Todas las combinaciones herramienta × variante × vista (la vista solo
    distingue en Escalera; en el resto es inocua y multiplicar no estorba). */
const ALL_VARIANTS = Object.keys(CATALOG).flatMap(tool =>
  CATALOG[tool].flatMap(v =>
    STAIR_VIEWS.map(view => ({ tool, id: v.id, view: view.id }))));

const make = (tool, id, opts = {}, p1 = P1, p2 = P2) =>
  Building.elements(tool, p1, p2, { ...O, [VARIANT_KEY[tool]]: id, ...opts });

/* ---------------- contrato del módulo ---------------- */

test('solo emite tipos de elemento que ya existían', () => {
  const allowed = new Set(['rect', 'line', 'circle', 'curveArrow', 'arrow', 'text']);
  for (const { tool, id, view } of ALL_VARIANTS) {
    for (const el of make(tool, id, { stairView: view })) {
      assert.ok(allowed.has(el.type), `tipo inesperado "${el.type}" en ${tool}/${id}/${view}`);
    }
  }
});

test('ninguna pieza trae seed: lo pone app.js con withSeeds', () => {
  for (const { tool, id, view } of ALL_VARIANTS) {
    for (const el of make(tool, id, { stairView: view })) {
      assert.equal(el.seed, undefined, `${tool}/${id} llega con seed`);
    }
  }
});

test('toda pieza emitida pasa isValidElement (sobrevive al round-trip JSON)', () => {
  for (const { tool, id, view } of ALL_VARIANTS) {
    const els = make(tool, id, { stairView: view });
    assert.ok(els.length, `${tool}/${id}/${view} no produjo nada`);
    for (const el of els) {
      assert.ok(Exporter.isValidElement({ ...el, seed: 1 }),
        `elemento inválido en ${tool}/${id}/${view}: ${JSON.stringify(el)}`);
    }
  }
});

test('la geometría es determinista: dos llamadas idénticas, mismas piezas', () => {
  for (const { tool, id, view } of ALL_VARIANTS) {
    assert.deepEqual(make(tool, id, { stairView: view }),
      make(tool, id, { stairView: view }), `${tool}/${id}/${view} no es determinista`);
  }
});

test('dentro de cada catálogo, dos variantes nunca se dibujan igual', () => {
  for (const tool of Object.keys(CATALOG)) {
    const dibujos = CATALOG[tool].map(v => JSON.stringify(make(tool, v.id)));
    assert.equal(new Set(dibujos).size, dibujos.length,
      `dos variantes de ${tool} producen el mismo dibujo`);
  }
});

test('la Escalera distingue planta de alzado en sus cinco tipos', () => {
  for (const v of STAIR_TYPES) {
    assert.notDeepEqual(
      make(TOOLS.BUILD_STAIR, v.id, { stairView: 'plan' }),
      make(TOOLS.BUILD_STAIR, v.id, { stairView: 'elevation' }),
      `stair/${v.id}: planta y alzado salen iguales`);
  }
});

test('sin rects ni círculos degenerados, ni en cajas pequeñas', () => {
  const casos = [[P1, P2], [{ x: 50, y: 50 }, { x: 74, y: 68 }]];
  for (const { tool, id, view } of ALL_VARIANTS) {
    for (const [p1, p2] of casos) {
      for (const el of make(tool, id, { stairView: view }, p1, p2)) {
        if (el.type === 'rect' || el.type === 'circle') {
          assert.ok(el.w > 0 && el.h > 0,
            `caja degenerada en ${tool}/${id}/${view}: ${JSON.stringify(el)}`);
        }
      }
    }
  }
});

test('todos los elementos generados se renderizan sin lanzar', () => {
  const stub = createCtxStub();
  for (const { tool, id, view } of ALL_VARIANTS) {
    for (const el of make(tool, id, { stairView: view })) {
      Renderer.renderElement(stub, { ...el, seed: 1 });
    }
  }
});

test('el clic sin arrastrar da la caja propia de cada variante', () => {
  // La cama y el inodoro no pueden nacer iguales: byVariant manda.
  const caja = id => {
    const els = make(TOOLS.BUILD_FURNITURE, id, {}, P1, P1);
    const rect = els.find(el => el.type === 'rect');
    return rect && `${rect.w}×${rect.h}`;
  };
  assert.notEqual(caja('wc'), caja('bed'));
  assert.notEqual(caja('bath'), caja('shower'));
});

/* ---------------- Cota ---------------- */

test('la cifra de la Cota sale de la longitud y de la escala, en metros con coma', () => {
  const texto = (p2, escala) =>
    Building.elements(TOOLS.BUILD_DIM, P1, p2, { ...O, dimScale: escala })
      .find(el => el.type === 'text').value;
  const px2m = 2 * Building.dimPxPerM(50);   // 2 m exactos a 1:50
  assert.equal(texto({ x: P1.x + px2m, y: P1.y }, 50), '2 m');
  // El doble de arrastre, el doble de metros
  assert.equal(texto({ x: P1.x + px2m * 2, y: P1.y }, 50), '4 m');
  // La misma distancia a 1:100 mide el doble de metros
  assert.equal(texto({ x: P1.x + px2m, y: P1.y }, 100), '4 m');
  // Decimales en español: coma, no punto
  const conComa = texto({ x: P1.x + px2m * 1.75, y: P1.y }, 50);
  assert.match(conComa, /^\d+,\d+ m$/);
});

test('la línea de cota es una flecha con remates de barra en ambos extremos', () => {
  const els = Building.elements(TOOLS.BUILD_DIM, P1, { x: 320, y: 100 }, O);
  const flecha = els.find(el => el.type === 'arrow');
  assert.ok(flecha, 'la Cota no emite su flecha');
  assert.equal(flecha.heads, 'both');
  assert.equal(flecha.headShape, 'bar');
  // Y dos testigos perpendiculares
  assert.equal(els.filter(el => el.type === 'line').length, 2);
});

test('measureText solo puede MOVER la cifra, nunca cambiar las piezas', () => {
  const sin = Building.elements(TOOLS.BUILD_DIM, P1, { x: 320, y: 100 }, O);
  const con = Building.elements(TOOLS.BUILD_DIM, P1, { x: 320, y: 100 },
    { ...O, measureText: () => 999 });
  assert.equal(sin.length, con.length);
  sin.forEach((el, i) => {
    if (el.type === 'text') {
      assert.equal(el.value, con[i].value);
      assert.equal(el.y, con[i].y);        // solo la x puede variar
    } else {
      assert.deepEqual(el, con[i]);
    }
  });
});

/* ---------------- Símbolos ---------------- */

test('la escala gráfica mide metros exactos según la escala activa', () => {
  const px = Building.dimPxPerM(50);
  const els = make(TOOLS.BUILD_SYMBOL, 'scaleBar', {}, { x: 0, y: 0 }, { x: px * 2 + 4, y: 26 });
  const barra = els.find(el => el.type === 'rect');
  // 2 m justos: la barra NO se estira al gesto — estirada mentiría
  assert.ok(Math.abs(barra.w - px * 2) < 0.001, `barra de ${barra.w}px ≠ ${px * 2}px`);
  assert.equal(els.filter(el => el.type === 'text').pop().value, '2 m');
});

test('la cota de nivel lleva signo siempre y dos decimales con coma', () => {
  const valor = m => make(TOOLS.BUILD_SYMBOL, 'level', { symbolLevelM: m })
    .find(el => el.type === 'text').value;
  assert.equal(valor(3.2), '+3,20');
  assert.equal(valor(0), '+0,00');
  assert.equal(valor(-1.5), '-1,50');
});

test('el norte no usa texto: la N son tres líneas, como en el Jardín', () => {
  const els = make(TOOLS.BUILD_SYMBOL, 'north');
  assert.equal(els.filter(el => el.type === 'text').length, 0);
  assert.ok(els.some(el => el.type === 'arrow'));
});

/* ---------------- Siluetas ---------------- */

test('un clic planta la silueta a su medida real según la escala 1:N', () => {
  const px = Building.dimPxPerM(50);
  const els = make(TOOLS.BUILD_SILHOUETTE, 'person', {}, P1, P1);
  let y1 = Infinity, y2 = -Infinity;
  for (const el of els) {
    if (el.type === 'line') { y1 = Math.min(y1, el.y1, el.y2); y2 = Math.max(y2, el.y1, el.y2); }
    if (el.type === 'circle') { y1 = Math.min(y1, el.y); y2 = Math.max(y2, el.y + el.h); }
  }
  // 1,75 m de persona a 1:50 ≈ 132 px (la geometría llena la caja entera)
  assert.ok(Math.abs((y2 - y1) - 1.75 * px) < 2,
    `la persona mide ${y2 - y1}px y debía medir ${1.75 * px}px`);
});

/* ---------------- Complemento del Tejado ---------------- */

test('roofAddon "none" deja el tejado EXACTAMENTE como siempre', () => {
  for (const forma of ROOF_TYPES) {
    const base = Building.elements(TOOLS.BUILD_ROOF, P1, P2, { ...O, roofShape: forma.id });
    const none = Building.elements(TOOLS.BUILD_ROOF, P1, P2,
      { ...O, roofShape: forma.id, roofAddon: 'none' });
    assert.deepEqual(none, base, `roofAddon none altera el tejado ${forma.id}`);
  }
});

test('cada complemento añade piezas sobre cualquier forma de tejado', () => {
  for (const forma of ROOF_TYPES) {
    const base = Building.elements(TOOLS.BUILD_ROOF, P1, P2, { ...O, roofShape: forma.id });
    for (const addon of ROOF_ADDONS.filter(a => a.id !== 'none')) {
      const con = Building.elements(TOOLS.BUILD_ROOF, P1, P2,
        { ...O, roofShape: forma.id, roofAddon: addon.id });
      assert.ok(con.length > base.length,
        `${addon.id} no añade nada sobre el tejado ${forma.id}`);
      for (const el of con) {
        assert.ok(Exporter.isValidElement({ ...el, seed: 1 }),
          `pieza inválida en tejado ${forma.id}+${addon.id}`);
      }
    }
  }
});
