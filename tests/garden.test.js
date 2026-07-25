'use strict';
/* ============================================================
   garden.test.js — Geometría de la sección "Jardín" (js/garden.js).
   Todas las herramientas son de creación: producen elementos ya existentes
   (rect/line/circle/curveArrow/text) en vista de planta.
   Ejecutar: node --test tests/garden.test.js
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll, createCtxStub } = require('./helpers/load.js');

const ctx = loadAll();
const {
  Garden, TOOLS, GARDEN_TOOLS, PLOT_SHAPES, TREE_TYPES, SHRUB_TYPES,
  FLOWER_TYPES, DECOR_TYPES, HERB_TYPES, Renderer, Exporter, CurvePath,
} = ctx;

const O = { color: '#123456', lineWidth: 3 };
const P1 = { x: 100, y: 100 }, P2 = { x: 260, y: 240 };

/** Clave de opts que elige la variante de cada herramienta. */
const VARIANT_KEY = {
  [TOOLS.GARDEN_PLOT]:   'plotShape',
  [TOOLS.GARDEN_TREE]:   'treeType',
  [TOOLS.GARDEN_SHRUB]:  'shrubType',
  [TOOLS.GARDEN_FLOWER]: 'flowerType',
  [TOOLS.GARDEN_DECOR]:  'decorType',
  [TOOLS.GARDEN_HERB]:   'herbType',
};

const CATALOG = {
  [TOOLS.GARDEN_PLOT]:   PLOT_SHAPES,
  [TOOLS.GARDEN_TREE]:   TREE_TYPES,
  [TOOLS.GARDEN_SHRUB]:  SHRUB_TYPES,
  [TOOLS.GARDEN_FLOWER]: FLOWER_TYPES,
  [TOOLS.GARDEN_DECOR]:  DECOR_TYPES,
  [TOOLS.GARDEN_HERB]:   HERB_TYPES,
};

/** Todas las combinaciones herramienta × variante del catálogo. */
const ALL_VARIANTS = GARDEN_TOOLS.flatMap(tool =>
  CATALOG[tool].map(v => ({ tool, id: v.id, name: v.name })));

const make = (tool, id, opts = {}, p1 = P1, p2 = P2) =>
  Garden.elements(tool, p1, p2, { ...O, [VARIANT_KEY[tool]]: id, ...opts });

/* ---------------- contrato del módulo ---------------- */

test('solo emite tipos de elemento que ya existían', () => {
  const allowed = new Set(['rect', 'line', 'circle', 'curveArrow', 'text']);
  for (const { tool, id } of ALL_VARIANTS) {
    for (const el of make(tool, id)) {
      assert.ok(allowed.has(el.type), `tipo inesperado "${el.type}" en ${tool}/${id}`);
    }
  }
});

test('ninguna pieza trae seed: lo pone app.js con withSeeds', () => {
  for (const { tool, id } of ALL_VARIANTS) {
    for (const el of make(tool, id)) {
      assert.equal(el.seed, undefined, `${tool}/${id} llega con seed`);
    }
  }
});

// La guarda más valiosa del archivo: caza cualquier curva encadenada mal
// formada, que se renderiza bien pero se DESCARTA en silencio al reimportar
// el JSON (exporter.js avisa con un "se descartaron N elementos" y poco más).
test('toda pieza emitida pasa isValidElement (sobrevive al round-trip JSON)', () => {
  for (const { tool, id } of ALL_VARIANTS) {
    const els = make(tool, id);
    assert.ok(els.length, `${tool}/${id} no produjo nada`);
    for (const el of els) {
      assert.ok(Exporter.isValidElement({ ...el, seed: 1 }),
        `elemento inválido en ${tool}/${id}: ${JSON.stringify(el)}`);
    }
  }
});

// Sin heads:'none' el renderer dibuja la punta de flecha por defecto: una copa
// de árbol con una flecha tangente en la costura.
test('ningún curveArrow lleva punta de flecha', () => {
  for (const { tool, id } of ALL_VARIANTS) {
    for (const el of make(tool, id)) {
      if (el.type === 'curveArrow') {
        assert.equal(el.heads, 'none', `punta de flecha en ${tool}/${id}`);
      }
    }
  }
});

test('las siluetas orgánicas son UNA curva encadenada y cerrada', () => {
  const cases = [
    [TOOLS.GARDEN_TREE, 'broadleaf'], [TOOLS.GARDEN_TREE, 'olive'],
    [TOOLS.GARDEN_SHRUB, 'clump'], [TOOLS.GARDEN_DECOR, 'stone'],
    [TOOLS.GARDEN_DECOR, 'pond'], [TOOLS.GARDEN_PLOT, 'organic'],
    [TOOLS.GARDEN_FLOWER, 'bed'],
  ];
  for (const [tool, id] of cases) {
    const chain = make(tool, id).find(el => el.type === 'curveArrow' && CurvePath.isChain(el));
    assert.ok(chain, `${tool}/${id} no produjo una curva encadenada`);
    // Cerrada: el último extremo vuelve al primero, y los espejos de nivel
    // superior lo reflejan (es lo que exige isValidElement).
    assert.equal(chain.x1, chain.x2, `silueta abierta en ${tool}/${id}`);
    assert.equal(chain.y1, chain.y2, `silueta abierta en ${tool}/${id}`);
    // Con `segments` no puede haber arc/cx2/cy2 arriba
    assert.equal(chain.arc, undefined);
    assert.equal(chain.cx2, undefined);
    assert.equal(chain.cy2, undefined);
    assert.ok(chain.segments.length >= 3, 'una silueta necesita al menos 3 tramos');
  }
});

// Si la geometría fuera aleatoria, la previsualización del arrastre no
// coincidiría con lo que aparece al soltar y no habría nada que fijar.
test('es determinista: dos llamadas iguales dan el mismo resultado', () => {
  for (const { tool, id } of ALL_VARIANTS) {
    assert.equal(JSON.stringify(make(tool, id)), JSON.stringify(make(tool, id)),
      `${tool}/${id} no es determinista`);
  }
});

// Detectado mirando el catálogo en el navegador: "Frondoso" y "Olivo" eran una
// copa lobulada con radios y solo cambiaba la tabla de lóbulos, así que en el
// icono resultaban indistinguibles y no había forma de elegir. Los tests
// pasaban todos: ninguno comparaba una variante con sus hermanas.
test('dentro de un catálogo, dos variantes nunca se dibujan igual', () => {
  // Firma: qué tipos de elemento hay y cuántos. Para las curvas distingue
  // además si son siluetas cerradas o trazos abiertos.
  const signature = els => els.filter(el => el.type !== 'text')
    .map(el => el.type === 'curveArrow'
      ? `curveArrow:${CurvePath.isChain(el) && el.x1 === el.x2 && el.y1 === el.y2 ? 'closed' : 'open'}`
      : el.type)
    .sort().join(',');

  for (const tool of GARDEN_TOOLS) {
    const seen = new Map();
    for (const v of CATALOG[tool]) {
      const sig = signature(make(tool, v.id));
      const twin = seen.get(sig);
      assert.equal(twin, undefined,
        `en ${tool}, "${v.name}" se dibuja igual que "${twin}" — nadie podría elegir`);
      seen.set(sig, v.name);
    }
  }
});

/* ---------------- etiquetas ---------------- */

test('cada pieza lleva una etiqueta de texto con el nombre de su variante', () => {
  for (const { tool, id, name } of ALL_VARIANTS) {
    const texts = make(tool, id).filter(el => el.type === 'text');
    assert.equal(texts.length, 1, `${tool}/${id} debería llevar una etiqueta`);
    assert.equal(texts[0].value, name);
    assert.ok(texts[0].fontSize > 0);
  }
});

test('labels:false quita la etiqueta y no toca nada más', () => {
  for (const { tool, id } of ALL_VARIANTS) {
    const con = make(tool, id);
    const sin = make(tool, id, { labels: false });
    assert.equal(sin.filter(el => el.type === 'text').length, 0);
    assert.equal(JSON.stringify(sin),
      JSON.stringify(con.filter(el => el.type !== 'text')),
      `labels:false alteró el dibujo en ${tool}/${id}`);
  }
});

test('la etiqueta se centra bajo la pieza', () => {
  const els = make(TOOLS.GARDEN_TREE, 'broadleaf');
  const label = els.find(el => el.type === 'text');
  const midBox = (P1.x + P2.x) / 2;
  const midLabel = label.x + (label.value.length * label.fontSize * 0.5) / 2;
  assert.ok(Math.abs(midBox - midLabel) < 1, 'la etiqueta no está centrada');
  assert.ok(label.y > P2.y, 'la etiqueta debe ir por debajo de la pieza');
});

// El measureText inyectado (app.js lo saca del canvas real) solo puede MOVER la
// etiqueta: si cambiara el número de piezas o cualquier otra coordenada, los
// tests —que corren con la estimación— estarían fijando algo que el navegador
// no hace.
test('measureText inyectado solo mueve la etiqueta', () => {
  for (const { tool, id } of ALL_VARIANTS) {
    const estimado = make(tool, id);
    const medido = make(tool, id, { measureText: (v, size) => v.length * size * 0.83 });
    assert.equal(medido.length, estimado.length);
    const soloTexto = a => a.filter(el => el.type !== 'text');
    assert.equal(JSON.stringify(soloTexto(medido)), JSON.stringify(soloTexto(estimado)),
      `measureText alteró el dibujo en ${tool}/${id}`);
    const t1 = estimado.find(el => el.type === 'text');
    const t2 = medido.find(el => el.type === 'text');
    assert.equal(t1.y, t2.y, 'la medida no debe mover la etiqueta en vertical');
    assert.notEqual(t1.x, t2.x, 'con otra medida la x debe recolocarse');
  }
});

/* ---------------- tamaños por defecto ---------------- */

// Un clic sin arrastrar cae en DEFAULTS. A diferencia de Edificios, aquí la
// variante manda: un seto es apaisado y una flor suelta es un punto.
test('cada variante tiene un tamaño por defecto positivo al hacer clic', () => {
  const click = { x: 400, y: 300 };
  for (const { tool, id } of ALL_VARIANTS) {
    const els = make(tool, id, {}, click, { x: 402, y: 301 }); // arrastre < MIN_SPAN
    assert.ok(els.length, `${tool}/${id} no produjo nada con un clic`);
    for (const el of els) {
      if (el.type === 'rect' || el.type === 'circle') {
        assert.ok(el.w > 0 && el.h > 0,
          `caja degenerada en ${tool}/${id}: ${el.w}×${el.h}`);
      }
    }
  }
});

test('el seto y el camino nacen apaisados; la flor suelta, menuda', () => {
  const click = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  const boxOf = (tool, id) => {
    const rect = make(tool, id, { labels: false }, ...click)
      .find(el => el.type === 'rect' || el.type === 'circle');
    return rect;
  };
  const hedge = boxOf(TOOLS.GARDEN_SHRUB, 'hedge');
  assert.ok(hedge.w > hedge.h * 2, 'un seto por defecto debe ser alargado');
  const bush = boxOf(TOOLS.GARDEN_SHRUB, 'bush');
  assert.ok(Math.abs(bush.w - bush.h) < 1, 'una mata por defecto es redonda');
  const daisy = boxOf(TOOLS.GARDEN_FLOWER, 'daisy');
  assert.ok(daisy.w < bush.w, 'una flor suelta es menor que un arbusto');
});

/* ---------------- geometría por herramienta ---------------- */

test('la parcela lleva contorno y césped, y el césped va en trazo fino', () => {
  for (const shape of PLOT_SHAPES.map(s => s.id)) {
    const els = make(TOOLS.GARDEN_PLOT, shape, { labels: false });
    const grass = els.filter(el => el.type === 'line' && el.lineWidth < O.lineWidth);
    assert.ok(grass.length >= 3, `sin césped en la parcela ${shape}`);
    assert.ok(grass.length % 3 === 0, 'cada mata son tres briznas');
  }
});

test('el césped no se sale de una parcela redonda', () => {
  const b = { x: 0, y: 0, w: 200, h: 160 };
  const els = make(TOOLS.GARDEN_PLOT, 'round', { labels: false },
    { x: b.x, y: b.y }, { x: b.w, y: b.h });
  const cx = b.w / 2, cy = b.h / 2;
  for (const el of els.filter(e => e.type === 'line')) {
    const nx = (el.x1 - cx) / (b.w / 2), ny = (el.y1 - cy) / (b.h / 2);
    assert.ok(nx * nx + ny * ny <= 1, 'una mata de césped nace fuera de la elipse');
  }
});

test('cada árbol lleva copa y su detalle va más fino que el contorno', () => {
  for (const type of TREE_TYPES.map(t => t.id)) {
    const els = make(TOOLS.GARDEN_TREE, type, { labels: false });
    assert.ok(els.length >= 2, `el árbol ${type} necesita copa y detalle`);
    const contour = els.filter(el => el.lineWidth === O.lineWidth);
    const detail = els.filter(el => el.lineWidth < O.lineWidth);
    assert.ok(contour.length >= 1, `sin contorno en ${type}`);
    assert.ok(detail.length >= 1, `sin detalle fino en ${type}`);
  }
});

test('la conífera dibuja sus acículas como radios desde el centro', () => {
  const els = make(TOOLS.GARDEN_TREE, 'conifer', { labels: false });
  const spokes = els.filter(el => el.type === 'line');
  assert.equal(spokes.length, 12);
  const cx = (P1.x + P2.x) / 2, cy = (P1.y + P2.y) / 2;
  for (const s of spokes) {
    const inner = Math.hypot(s.x1 - cx, s.y1 - cy);
    const outer = Math.hypot(s.x2 - cx, s.y2 - cy);
    assert.ok(outer > inner, 'la acícula debe ir de dentro hacia fuera');
  }
});

test('la palmera son frondas curvas, sin copa cerrada', () => {
  const els = make(TOOLS.GARDEN_TREE, 'palm', { labels: false });
  const fronds = els.filter(el => el.type === 'curveArrow');
  assert.equal(fronds.length, 8);
  assert.ok(fronds.every(f => !CurvePath.isChain(f)), 'una fronda es una curva suelta');
});

test('el seto es una caja con la ondulación del recorte dentro', () => {
  const els = make(TOOLS.GARDEN_SHRUB, 'hedge', { labels: false });
  assert.equal(els.filter(el => el.type === 'rect').length, 1);
  const wave = els.find(el => el.type === 'curveArrow');
  assert.ok(wave && CurvePath.isChain(wave), 'el seto necesita su onda');
  assert.ok(wave.lineWidth < O.lineWidth, 'la ondulación es detalle, va fina');
});

test('el banco lleva sus lamas horizontales y finas', () => {
  const els = make(TOOLS.GARDEN_DECOR, 'bench', { labels: false });
  assert.equal(els.filter(el => el.type === 'rect').length, 1);
  const slats = els.filter(el => el.type === 'line');
  assert.equal(slats.length, 3);
  assert.ok(slats.every(l => l.y1 === l.y2 && l.lineWidth < O.lineWidth));
});

test('el camino son dos bordes que serpentean', () => {
  const els = make(TOOLS.GARDEN_DECOR, 'path', { labels: false });
  const edges = els.filter(el => el.type === 'curveArrow');
  assert.equal(edges.length, 2);
  assert.ok(edges.every(e => CurvePath.isChain(e) && e.x1 !== e.x2),
    'los bordes del camino son curvas abiertas');
});

test('la fuente y la maceta son anillos concéntricos', () => {
  const centro = els => els.filter(el => el.type === 'circle')
    .map(el => `${el.x + el.w / 2},${el.y + el.h / 2}`);
  for (const id of ['fountain', 'pot']) {
    const c = centro(make(TOOLS.GARDEN_DECOR, id, { labels: false }));
    assert.ok(c.length >= 2, `${id} necesita al menos dos anillos`);
    assert.equal(new Set(c).size, 1, `los anillos de ${id} no son concéntricos`);
  }
});

/* ---------------- robustez ---------------- */

test('herramienta desconocida no produce nada', () => {
  assert.deepEqual([...Garden.elements('no-existe', P1, P2, O)], []);
});

test('una variante inexistente cae en la primera del catálogo', () => {
  for (const tool of GARDEN_TOOLS) {
    const raro = make(tool, 'variante-que-no-existe');
    const primera = make(tool, CATALOG[tool][0].id);
    assert.equal(JSON.stringify(raro), JSON.stringify(primera),
      `${tool} no cae en su variante por defecto`);
  }
});

// Guarda de regresión: en cajas pequeñas ningún cálculo puede degenerar.
test('cajas pequeñas: sin rects ni círculos de w/h ≤ 0', () => {
  const smalls = [
    [{ x: 0, y: 0 }, { x: 12, y: 10 }],
    [{ x: 0, y: 0 }, { x: 15, y: 15 }],
    [{ x: 0, y: 0 }, { x: 7, y: 8 }],
    [{ x: 0, y: 0 }, { x: 60, y: 7 }],   // muy apaisada
    [{ x: 0, y: 0 }, { x: 7, y: 60 }],   // muy apaisada al revés
  ];
  for (const [a, b] of smalls) {
    for (const { tool, id } of ALL_VARIANTS) {
      for (const el of make(tool, id, {}, a, b)) {
        if (el.type === 'rect' || el.type === 'circle') {
          assert.ok(el.w > 0 && el.h > 0,
            `caja degenerada ${tool}/${id} en ${b.x}×${b.y}: ${el.w}×${el.h}`);
        }
        if (el.type === 'curveArrow' && el.segments) {
          assert.ok(el.segments.length >= 1);
        }
      }
    }
  }
});

test('todos los elementos generados se renderizan sin lanzar', () => {
  const stub = createCtxStub();
  for (const { tool, id } of ALL_VARIANTS) {
    for (const el of make(tool, id)) {
      assert.doesNotThrow(() => Renderer.renderElement(stub, { ...el, seed: 1 }),
        `${tool}/${id} rompe el render`);
    }
  }
});

test('las herramientas de jardín no son tipos de elemento válidos', () => {
  for (const tool of GARDEN_TOOLS) {
    assert.equal(
      Exporter.isValidElement({ type: tool, x: 0, y: 0, w: 10, h: 10, color: '#000000', lineWidth: 2 }),
      false,
      `type:'${tool}' colaría como elemento fantasma`);
  }
});
